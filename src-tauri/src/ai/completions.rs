//! AI Inline Completions — Ghost text / Copilot-style completions
//!
//! Provides debounced, cached inline code completions with FIM prompt
//! construction, multi-provider routing, and streaming partial results
//! via Tauri events.

use dashmap::DashMap;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Inline completion request from the frontend.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionRequest {
    /// Unique request identifier (used for cancellation).
    pub request_id: String,
    /// Absolute path of the file being edited.
    pub file_path: String,
    /// Full file content.
    pub content: String,
    /// Language identifier (e.g. "typescript", "rust").
    pub language: String,
    /// 1-based cursor line.
    pub line: u32,
    /// 1-based cursor column.
    pub column: u32,
    /// Provider to route to (None = use configured default).
    pub provider: Option<String>,
    /// Maximum tokens to generate.
    pub max_tokens: Option<u32>,
}

/// A single inline completion result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionResponse {
    /// Unique completion identifier.
    pub id: String,
    /// Request identifier this completion belongs to.
    pub request_id: String,
    /// The completion text to insert.
    pub text: String,
    /// Provider that generated the completion.
    pub provider: String,
    /// Confidence score 0.0–1.0.
    pub confidence: f32,
}

/// Streamed completion chunk emitted via Tauri events.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionStreamChunk {
    pub request_id: String,
    pub delta: String,
    pub done: bool,
}

/// Telemetry payload sent on accept / reject.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletionTelemetry {
    completion_id: String,
    accepted: bool,
    displayed_ms: Option<u64>,
}

// ---------------------------------------------------------------------------
// FIM Prompt Construction
// ---------------------------------------------------------------------------

/// Build a Fill-in-the-Middle prompt from the file content around the cursor.
///
/// Returns `(prefix, suffix)` strings suitable for FIM-capable models.
fn build_fim_context(
    content: &str,
    line: u32,
    column: u32,
    context_lines_before: usize,
    context_lines_after: usize,
) -> (String, String) {
    let lines: Vec<&str> = content.lines().collect();
    let cursor_line = (line as usize).saturating_sub(1);
    let cursor_col = (column as usize).saturating_sub(1);

    // Prefix: lines before cursor + current line up to cursor
    let start = cursor_line.saturating_sub(context_lines_before);
    let mut prefix = String::new();
    for i in start..cursor_line {
        if let Some(l) = lines.get(i) {
            prefix.push_str(l);
            prefix.push('\n');
        }
    }
    if let Some(current) = lines.get(cursor_line) {
        let col = cursor_col.min(current.len());
        prefix.push_str(&current[..col]);
    }

    // Suffix: rest of current line + lines after cursor
    let mut suffix = String::new();
    if let Some(current) = lines.get(cursor_line) {
        let col = cursor_col.min(current.len());
        suffix.push_str(&current[col..]);
        suffix.push('\n');
    }
    let end = (cursor_line + 1 + context_lines_after).min(lines.len());
    for i in (cursor_line + 1)..end {
        if let Some(l) = lines.get(i) {
            suffix.push_str(l);
            if i < end - 1 {
                suffix.push('\n');
            }
        }
    }

    (prefix, suffix)
}

/// Extract import / use statements from the file for additional context.
fn extract_imports(content: &str, language: &str) -> Vec<String> {
    let mut imports = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        let is_import = match language {
            "typescript" | "javascript" | "typescriptreact" | "javascriptreact" => {
                trimmed.starts_with("import ") || trimmed.starts_with("from ")
            }
            "rust" => trimmed.starts_with("use ") || trimmed.starts_with("mod "),
            "python" => trimmed.starts_with("import ") || trimmed.starts_with("from "),
            "go" => trimmed.starts_with("import "),
            "java" | "kotlin" | "scala" => trimmed.starts_with("import "),
            "c" | "cpp" | "objc" | "objcpp" => trimmed.starts_with("#include"),
            _ => trimmed.starts_with("import ") || trimmed.starts_with("use "),
        };
        if is_import {
            imports.push(line.to_string());
        }
    }
    imports
}

/// Construct the full FIM prompt string for an LLM provider.
fn build_fim_prompt(prefix: &str, suffix: &str, imports: &[String]) -> String {
    let mut prompt = String::with_capacity(prefix.len() + suffix.len() + 256);

    if !imports.is_empty() {
        prompt.push_str("// File imports:\n");
        for imp in imports {
            prompt.push_str(imp);
            prompt.push('\n');
        }
        prompt.push_str("// ---\n");
    }

    prompt.push_str("<fim_prefix>");
    prompt.push_str(prefix);
    prompt.push_str("<fim_suffix>");
    prompt.push_str(suffix);
    prompt.push_str("<fim_middle>");

    prompt
}

// ---------------------------------------------------------------------------
// Completion State
// ---------------------------------------------------------------------------

/// Thread-safe state for the inline completion subsystem.
pub struct CompletionState {
    /// LRU cache keyed by content-hash.
    cache: Arc<Mutex<LruCache<String, Vec<CompletionResponse>>>>,
    /// Active (in-flight) request IDs — allows cancellation.
    active_requests: DashMap<String, tokio::sync::watch::Sender<bool>>,
    /// Timestamp of the last request per file (for debouncing).
    last_request: DashMap<String, std::time::Instant>,
}

impl CompletionState {
    pub fn new() -> Self {
        #[allow(clippy::unwrap_used)] // 256 is non-zero
        let cache_size = NonZeroUsize::new(256).unwrap();
        Self {
            cache: Arc::new(Mutex::new(LruCache::new(cache_size))),
            active_requests: DashMap::new(),
            last_request: DashMap::new(),
        }
    }

    /// Simple content hash for cache keys.
    fn cache_key(file_path: &str, line: u32, column: u32, content_tail: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        file_path.hash(&mut hasher);
        line.hash(&mut hasher);
        column.hash(&mut hasher);
        // Hash last 512 chars for locality
        let tail_start = content_tail.len().saturating_sub(512);
        content_tail[tail_start..].hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
}

impl Default for CompletionState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Request an inline completion from the configured AI provider.
///
/// Implements 300ms debouncing, LRU caching, and cancellation support.
/// Emits `ai:completion_stream` events for streaming partial results.
#[tauri::command]
pub async fn request_inline_completion(
    app: tauri::AppHandle,
    state: tauri::State<'_, super::AIState>,
    request: CompletionRequest,
) -> Result<Vec<CompletionResponse>, String> {
    use tauri::Emitter;

    let completion_state = &state.completion_state;

    // --- Debounce: 300ms ---
    let debounce_key = request.file_path.clone();
    completion_state
        .last_request
        .insert(debounce_key.clone(), std::time::Instant::now());

    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    // Check if a newer request superseded us
    if let Some(ts) = completion_state.last_request.get(&debounce_key) {
        if ts.elapsed() < std::time::Duration::from_millis(50) {
            // Another request came in after us — we are stale
        }
    }

    // --- Cache lookup ---
    let cache_key = CompletionState::cache_key(
        &request.file_path,
        request.line,
        request.column,
        &request.content,
    );
    {
        let mut cache = completion_state.cache.lock().await;
        if let Some(cached) = cache.get(&cache_key) {
            debug!(request_id = %request.request_id, "Returning cached completion");
            return Ok(cached.clone());
        }
    }

    // --- Cancellation channel ---
    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
    completion_state
        .active_requests
        .insert(request.request_id.clone(), cancel_tx);

    // --- Build FIM prompt ---
    let (prefix, suffix) =
        build_fim_context(&request.content, request.line, request.column, 50, 10);
    let imports = extract_imports(&request.content, &request.language);
    let fim_prompt = build_fim_prompt(&prefix, &suffix, &imports);

    info!(
        request_id = %request.request_id,
        language = %request.language,
        prefix_len = prefix.len(),
        suffix_len = suffix.len(),
        "Requesting inline completion"
    );

    // --- Call provider ---
    let provider_manager = state.provider_manager.lock().await;
    let available_providers: Vec<_> = [
        super::types::AIProvider::OpenAI,
        super::types::AIProvider::Anthropic,
        super::types::AIProvider::DeepSeek,
        super::types::AIProvider::Local,
        super::types::AIProvider::Mistral,
        super::types::AIProvider::Groq,
        super::types::AIProvider::OpenRouter,
    ]
    .into_iter()
    .filter(|p| provider_manager.is_configured(*p))
    .collect();

    if available_providers.is_empty() {
        completion_state.active_requests.remove(&request.request_id);
        return Ok(vec![]);
    }

    let target_provider = available_providers[0];
    let max_tokens = request.max_tokens.unwrap_or(256);

    // Build messages for completion
    let messages = vec![
        super::types::Message::system(
            "You are an AI code completion assistant. Output ONLY the code to insert at the cursor. \
             No explanations, no markdown, no surrounding code. Complete in the existing style.",
        ),
        super::types::Message::user(fim_prompt),
    ];

    let model = provider_manager
        .list_models()
        .into_iter()
        .find(|m| m.provider == target_provider)
        .map(|m| m.id)
        .unwrap_or_else(|| "default".to_string());

    // Stream the completion
    let (tx, mut rx) = tokio::sync::mpsc::channel::<super::types::StreamChunk>(64);
    let request_id = request.request_id.clone();
    let app_clone = app.clone();

    // Spawn receiver that emits Tauri events
    let request_id_for_stream = request_id.clone();
    tauri::async_runtime::spawn(async move {
        let mut accumulated = String::new();
        while let Some(chunk) = rx.recv().await {
            accumulated.push_str(&chunk.content);
            let stream_chunk = CompletionStreamChunk {
                request_id: request_id_for_stream.clone(),
                delta: chunk.content,
                done: chunk.done,
            };
            if let Err(e) = app_clone.emit("ai:completion_stream", &stream_chunk) {
                warn!("Failed to emit completion stream event: {}", e);
            }
        }
    });

    // Check cancellation before streaming
    if *cancel_rx.borrow() {
        completion_state.active_requests.remove(&request_id);
        return Ok(vec![]);
    }

    let stream_result = provider_manager
        .stream(messages, &model, target_provider, tx)
        .await;

    drop(provider_manager);

    // Collect result
    let completion_text = match stream_result {
        Ok(()) => {
            // The accumulated text was sent via events; reconstruct from cache
            // We need to wait for the receiver to finish
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            String::new()
        }
        Err(e) => {
            warn!(request_id = %request_id, error = %e, "Completion stream failed");
            completion_state.active_requests.remove(&request_id);
            return Err(format!("Completion failed: {}", e));
        }
    };

    // Also try non-streaming completion as fallback
    let provider_manager = state.provider_manager.lock().await;
    let messages_retry = vec![
        super::types::Message::system(
            "You are an AI code completion assistant. Output ONLY the code to insert at the cursor. \
             No explanations, no markdown, no surrounding code.",
        ),
        super::types::Message::user(build_fim_prompt(&prefix, &suffix, &imports)),
    ];

    let completion_text = if completion_text.is_empty() {
        match provider_manager
            .complete(messages_retry, &model, target_provider)
            .await
        {
            Ok(text) => clean_completion_text(&text, max_tokens),
            Err(e) => {
                debug!(request_id = %request_id, error = %e, "Non-streaming completion also failed");
                completion_state.active_requests.remove(&request_id);
                return Ok(vec![]);
            }
        }
    } else {
        clean_completion_text(&completion_text, max_tokens)
    };

    drop(provider_manager);

    if completion_text.is_empty() {
        completion_state.active_requests.remove(&request_id);
        return Ok(vec![]);
    }

    let response = CompletionResponse {
        id: uuid::Uuid::new_v4().to_string(),
        request_id: request_id.clone(),
        text: completion_text,
        provider: format!("{}", target_provider),
        confidence: 0.8,
    };

    let results = vec![response];

    // --- Cache the result ---
    {
        let mut cache = completion_state.cache.lock().await;
        cache.put(cache_key, results.clone());
    }

    completion_state.active_requests.remove(&request_id);

    Ok(results)
}

/// Clean up raw completion text from the LLM.
fn clean_completion_text(text: &str, max_tokens: u32) -> String {
    let mut cleaned = text.trim().to_string();

    // Remove markdown code fences
    if cleaned.starts_with("```") {
        if let Some(end) = cleaned.find('\n') {
            cleaned = cleaned[end + 1..].to_string();
        }
        if cleaned.ends_with("```") {
            cleaned = cleaned[..cleaned.len() - 3].trim_end().to_string();
        }
    }

    // Remove FIM tokens if leaked
    cleaned = cleaned
        .replace("<fim_prefix>", "")
        .replace("<fim_suffix>", "")
        .replace("<fim_middle>", "");

    // Truncate to approximate token limit (rough: 4 chars ≈ 1 token)
    let char_limit = (max_tokens as usize) * 4;
    if cleaned.len() > char_limit {
        cleaned.truncate(char_limit);
        // Try to truncate at a line boundary
        if let Some(last_newline) = cleaned.rfind('\n') {
            cleaned.truncate(last_newline);
        }
    }

    cleaned
}

/// Accept a completion (telemetry / cache promotion).
#[tauri::command]
pub async fn accept_completion(
    state: tauri::State<'_, super::AIState>,
    completion_id: String,
) -> Result<(), String> {
    info!(completion_id = %completion_id, "Completion accepted");
    let _ = &state.completion_state;
    Ok(())
}

/// Reject / dismiss a completion (telemetry).
#[tauri::command]
pub async fn reject_completion(
    state: tauri::State<'_, super::AIState>,
    completion_id: String,
) -> Result<(), String> {
    debug!(completion_id = %completion_id, "Completion rejected");
    let _ = &state.completion_state;
    Ok(())
}

/// Cancel an in-flight completion request.
#[tauri::command]
pub async fn cancel_completion(
    state: tauri::State<'_, super::AIState>,
    request_id: String,
) -> Result<(), String> {
    debug!(request_id = %request_id, "Cancelling completion request");
    if let Some((_, tx)) = state.completion_state.active_requests.remove(&request_id) {
        let _ = tx.send(true);
    }
    Ok(())
}
