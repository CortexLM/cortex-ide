//! AI Module - AI core functionality for Cortex
//!
//! This module provides direct Tauri-to-Rust AI communication with support for
//! multiple LLM providers (OpenAI, Anthropic, etc.), conversation thread
//! management, and streaming responses via Tauri events.
//!
//! # Architecture
//!
//! - `types` - Shared data structures for AI operations
//! - `providers` - LLM provider integrations with unified interface
//! - `thread` - Conversation thread persistence and management
//! - `completions` - Inline ghost-text completions with FIM prompts
//! - `indexer` - Codebase semantic indexing (file walking, chunking)
//! - `vector_store` - SQLite-backed vector index for embeddings
//! - `context` - RAG context retrieval for AI prompts
//!
//! # Usage
//!
//! The AI module exposes Tauri commands for frontend integration:
//! - `ai_complete` - Non-streaming completion
//! - `ai_stream` - Streaming completion via events
//! - `ai_list_models` - List available models
//! - `request_inline_completion` / `accept_completion` / `reject_completion` / `cancel_completion`
//! - `index_workspace` / `search_codebase` / `get_ai_context`
//! - Thread CRUD operations

pub mod agents;
pub mod completions;
pub mod context;
pub mod indexer;
pub mod openrouter_commands;
pub mod protocol;
pub mod providers;
pub mod session;
pub mod session_commands;
pub mod thread;
pub mod tools;
pub mod types;
pub mod vector_store;

pub use agents::{AgentState, AgentStoreState};
pub use completions::CompletionState;
pub use indexer::IndexerState;
pub use openrouter_commands::*;
pub use providers::{SharedProviderManager, create_shared_provider_manager, get_provider_models};
pub use session::{CreateSessionOptions, SessionInfo, SessionManager};
pub use session_commands::*;
pub use thread::{ThreadManagerState, ThreadSummary, threads_to_summaries};
pub use tools::AIToolsState;
pub use types::*;
pub use vector_store::VectorStoreState;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use tracing::{error, info};

/// AI state container for Tauri
pub struct AIState {
    pub provider_manager: SharedProviderManager,
    pub thread_manager: ThreadManagerState,
    pub session_manager: Arc<SessionManager>,
    pub completion_state: CompletionState,
    pub indexer_state: IndexerState,
    pub vector_store_state: VectorStoreState,
}

impl AIState {
    pub fn new() -> Self {
        Self {
            provider_manager: create_shared_provider_manager(),
            thread_manager: ThreadManagerState::new(),
            session_manager: Arc::new(SessionManager::new()),
            completion_state: CompletionState::new(),
            indexer_state: IndexerState::new(),
            vector_store_state: VectorStoreState::new(),
        }
    }

    /// Initialize AI state from saved settings
    ///
    /// Loads provider configurations and initializes the thread manager.
    /// Called during app startup.
    pub async fn initialize_from_settings(&self, app: &AppHandle) -> Result<(), String> {
        // Initialize thread manager with app data directory
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        let mut thread_manager = self.thread_manager.0.lock().await;
        thread_manager
            .initialize(app_data_dir)
            .map_err(|e| format!("Failed to initialize thread manager: {}", e))?;

        // Load saved provider configurations from settings (if any)
        // This is a placeholder for future implementation where providers
        // can be persisted and restored from app settings
        info!("AI state initialized successfully");

        Ok(())
    }
}

impl Default for AIState {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Tauri Commands - Provider Operations
// =============================================================================

/// Configure an AI provider
#[tauri::command]
pub async fn ai_configure_provider(
    state: tauri::State<'_, AIState>,
    config: ProviderConfig,
) -> Result<(), String> {
    let mut manager = state.provider_manager.lock().await;
    manager.configure(config);
    Ok(())
}

/// Remove a provider configuration
#[tauri::command]
pub async fn ai_remove_provider(
    state: tauri::State<'_, AIState>,
    provider: AIProvider,
) -> Result<(), String> {
    let mut manager = state.provider_manager.lock().await;
    manager.remove(provider);
    Ok(())
}

/// List all available models
#[tauri::command]
pub async fn ai_list_models(state: tauri::State<'_, AIState>) -> Result<Vec<AIModel>, String> {
    let manager = state.provider_manager.lock().await;
    Ok(manager.list_models())
}

/// Get models for a specific provider
#[tauri::command]
pub async fn ai_get_provider_models(provider: AIProvider) -> Result<Vec<AIModel>, String> {
    Ok(get_provider_models(provider))
}

// =============================================================================
// Tauri Commands - Completion Operations
// =============================================================================

/// Complete a conversation (non-streaming)
#[tauri::command]
pub async fn ai_complete(
    state: tauri::State<'_, AIState>,
    messages: Vec<Message>,
    model: String,
    provider: AIProvider,
) -> Result<String, String> {
    let manager = state.provider_manager.lock().await;
    manager
        .complete(messages, &model, provider)
        .await
        .map_err(|e| e.to_string())
}

/// Stream a conversation response
///
/// Emits "ai:stream_chunk" events with StreamChunk payloads.
/// Event payload includes thread_id for routing to correct UI component.
#[tauri::command]
pub async fn ai_stream(
    app: AppHandle,
    state: tauri::State<'_, AIState>,
    messages: Vec<Message>,
    model: String,
    provider: AIProvider,
    thread_id: Option<String>,
) -> Result<(), String> {
    let manager = state.provider_manager.lock().await;
    let (tx, mut rx) = mpsc::channel::<StreamChunk>(100);

    let thread_id_clone = thread_id.clone().unwrap_or_default();

    // Spawn receiver task to emit events
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(chunk) = rx.recv().await {
            let event_payload = StreamEventPayload {
                thread_id: thread_id_clone.clone(),
                chunk,
            };
            if let Err(e) = app_clone.emit("ai:stream_chunk", &event_payload) {
                error!("Failed to emit stream event: {}", e);
            }
        }
    });

    // Start streaming
    manager
        .stream(messages, &model, provider, tx)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Payload for stream events
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamEventPayload {
    thread_id: String,
    chunk: StreamChunk,
}

// =============================================================================
// Tauri Commands - Thread Operations
// =============================================================================

/// Initialize the thread manager
#[tauri::command]
pub async fn ai_init_threads(
    app: AppHandle,
    state: tauri::State<'_, AIState>,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let mut manager = state.thread_manager.0.lock().await;
    manager
        .initialize(app_data_dir)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a new thread
#[tauri::command]
pub async fn ai_create_thread(
    state: tauri::State<'_, AIState>,
    model_id: String,
    provider: AIProvider,
    title: Option<String>,
    system_prompt: Option<String>,
) -> Result<Thread, String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager
        .create_thread(model_id, provider, title, system_prompt)
        .map_err(|e| e.to_string())
}

/// Get a thread by ID
#[tauri::command]
pub async fn ai_get_thread(
    state: tauri::State<'_, AIState>,
    thread_id: String,
) -> Result<Option<Thread>, String> {
    let manager = state.thread_manager.0.lock().await;
    Ok(manager.get_thread(&thread_id))
}

/// Update a thread
#[tauri::command]
pub async fn ai_update_thread(
    state: tauri::State<'_, AIState>,
    thread: Thread,
) -> Result<Thread, String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager.update_thread(thread).map_err(|e| e.to_string())
}

/// Delete a thread
#[tauri::command]
pub async fn ai_delete_thread(
    state: tauri::State<'_, AIState>,
    thread_id: String,
) -> Result<(), String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager.delete_thread(&thread_id).map_err(|e| e.to_string())
}

/// List all threads
#[tauri::command]
pub async fn ai_list_threads(state: tauri::State<'_, AIState>) -> Result<Vec<Thread>, String> {
    let manager = state.thread_manager.0.lock().await;
    Ok(manager.list_threads())
}

/// List threads as summaries (for list views)
#[tauri::command]
pub async fn ai_list_thread_summaries(
    state: tauri::State<'_, AIState>,
) -> Result<Vec<ThreadSummary>, String> {
    let manager = state.thread_manager.0.lock().await;
    let threads = manager.list_threads();
    Ok(threads_to_summaries(&threads))
}

/// Search threads
#[tauri::command]
pub async fn ai_search_threads(
    state: tauri::State<'_, AIState>,
    query: String,
) -> Result<Vec<Thread>, String> {
    let manager = state.thread_manager.0.lock().await;
    Ok(manager.search_threads(&query))
}

// =============================================================================
// Tauri Commands - Message Operations
// =============================================================================

/// Add a message to a thread
#[tauri::command]
pub async fn ai_add_message(
    state: tauri::State<'_, AIState>,
    thread_id: String,
    message: Message,
) -> Result<Thread, String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager
        .add_message(&thread_id, message)
        .map_err(|e| e.to_string())
}

/// Get messages from a thread
#[tauri::command]
pub async fn ai_get_messages(
    state: tauri::State<'_, AIState>,
    thread_id: String,
) -> Result<Vec<Message>, String> {
    let manager = state.thread_manager.0.lock().await;
    manager.get_messages(&thread_id).map_err(|e| e.to_string())
}

/// Clear messages from a thread
#[tauri::command]
pub async fn ai_clear_messages(
    state: tauri::State<'_, AIState>,
    thread_id: String,
) -> Result<Thread, String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager
        .clear_messages(&thread_id)
        .map_err(|e| e.to_string())
}

// =============================================================================
// Tauri Commands - Thread Utilities
// =============================================================================

/// Duplicate a thread
#[tauri::command]
pub async fn ai_duplicate_thread(
    state: tauri::State<'_, AIState>,
    thread_id: String,
) -> Result<Thread, String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager
        .duplicate_thread(&thread_id)
        .map_err(|e| e.to_string())
}

/// Export a thread to JSON
#[tauri::command]
pub async fn ai_export_thread(
    state: tauri::State<'_, AIState>,
    thread_id: String,
) -> Result<String, String> {
    let manager = state.thread_manager.0.lock().await;
    manager.export_thread(&thread_id).map_err(|e| e.to_string())
}

/// Import a thread from JSON
#[tauri::command]
pub async fn ai_import_thread(
    state: tauri::State<'_, AIState>,
    json: String,
) -> Result<Thread, String> {
    let mut manager = state.thread_manager.0.lock().await;
    manager.import_thread(&json).map_err(|e| e.to_string())
}

/// Get thread count
#[tauri::command]
pub async fn ai_thread_count(state: tauri::State<'_, AIState>) -> Result<usize, String> {
    let manager = state.thread_manager.0.lock().await;
    Ok(manager.thread_count())
}

// =============================================================================
// Tauri Commands - AI Predictions
// =============================================================================

/// AI code prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIPrediction {
    /// The predicted text
    pub text: String,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f32,
}

/// AI prediction request with cursor context
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictionCursor {
    pub line: u32,
    pub column: u32,
}

/// Get AI code predictions based on context
///
/// Returns inline completion suggestions based on the current file content
/// and cursor position.
#[tauri::command]
pub async fn ai_predict(
    content: String,
    language: String,
    cursor: PredictionCursor,
    file_path: Option<String>,
) -> Result<serde_json::Value, String> {
    // Extract prefix and suffix based on cursor position
    let lines: Vec<&str> = content.lines().collect();
    let line_idx = (cursor.line as usize).saturating_sub(1);

    // Build prefix (everything before cursor)
    let mut prefix = String::new();
    for (i, line) in lines.iter().enumerate() {
        if i < line_idx {
            prefix.push_str(line);
            prefix.push('\n');
        } else if i == line_idx {
            let col = (cursor.column as usize).saturating_sub(1).min(line.len());
            prefix.push_str(&line[..col]);
            break;
        }
    }

    // Build suffix (everything after cursor)
    let mut suffix = String::new();
    for (i, line) in lines.iter().enumerate() {
        if i == line_idx {
            let col = (cursor.column as usize).saturating_sub(1).min(line.len());
            suffix.push_str(&line[col..]);
            suffix.push('\n');
        } else if i > line_idx {
            suffix.push_str(line);
            if i < lines.len() - 1 {
                suffix.push('\n');
            }
        }
    }

    info!(
        language = %language,
        file_path = ?file_path,
        prefix_len = prefix.len(),
        suffix_len = suffix.len(),
        "AI prediction requested"
    );

    // For now, return empty prediction
    // In the future, this can integrate with Cortex-core or a local completion model
    // The structure matches what the frontend expects
    Ok(serde_json::json!({
        "prediction": null
    }))
}

// =============================================================================
// Tauri Commands - Feedback Submission
// =============================================================================

/// Feedback data submitted by users
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackData {
    /// Type of feedback: "bug", "feature", or "general"
    #[serde(rename = "type")]
    pub feedback_type: String,
    /// Title of the feedback
    pub title: String,
    /// Detailed description
    pub description: String,
    /// Optional email for follow-up
    pub email: Option<String>,
    /// Optional system information
    pub system_info: Option<serde_json::Value>,
    /// Optional application logs
    pub logs: Option<String>,
    /// Number of screenshots attached
    pub screenshot_count: Option<u32>,
}

/// Submit user feedback
///
/// Logs feedback locally for now. In production, this could send to a backend service.
#[tauri::command]
pub async fn submit_feedback(feedback: FeedbackData) -> Result<(), String> {
    info!(
        feedback_type = %feedback.feedback_type,
        title = %feedback.title,
        email = ?feedback.email,
        has_system_info = feedback.system_info.is_some(),
        has_logs = feedback.logs.is_some(),
        screenshot_count = ?feedback.screenshot_count,
        "Feedback submitted"
    );

    // Log the full feedback for debugging purposes
    tracing::debug!(
        description = %feedback.description,
        "Feedback details"
    );

    Ok(())
}

// =============================================================================
// Tauri Commands - Web Fetch
// =============================================================================

/// Maximum response size for fetch_url (10 MB)
const FETCH_URL_MAX_RESPONSE_SIZE: usize = 10 * 1024 * 1024;

/// Fetch content from a URL with comprehensive SSRF protection.
///
/// Used for slash commands that need to include web content in context.
/// Implements protection against Server-Side Request Forgery (SSRF) attacks:
/// - Protocol validation (http/https only)
/// - Localhost/local domain blocking
/// - Private/reserved IP range blocking
/// - DNS resolution check to prevent DNS rebinding
/// - Response size limits
#[tauri::command]
pub async fn fetch_url(url: String) -> Result<serde_json::Value, String> {
    info!(url = %url, "Fetching URL content");

    // Use Cortex-core's comprehensive SSRF protection
    use crate::cortex_engine::security::ssrf::SsrfProtection;

    let ssrf_protection = SsrfProtection::new();

    // Validate URL with comprehensive SSRF checks:
    // 1. Protocol validation (http/https only) - blocks file://, ftp://, gopher://, etc.
    // 2. Localhost/local domain blocking - blocks localhost, 127.x.x.x, ::1, .local, .internal
    // 3. Private/reserved IP range blocking:
    //    - 10.0.0.0/8 (private)
    //    - 172.16.0.0/12 (private)
    //    - 192.168.0.0/16 (private)
    //    - 169.254.0.0/16 (link-local, including AWS metadata endpoint)
    //    - 100.64.0.0/10 (CGN)
    //    - Various documentation/test ranges
    //    - Multicast and reserved ranges
    // 4. IPv6 blocking:
    //    - ::1 (loopback)
    //    - fe80::/10 (link-local)
    //    - fc00::/7 (unique local)
    //    - Various other reserved ranges
    // 5. DNS resolution to prevent DNS rebinding attacks
    let validated_url = ssrf_protection
        .validate_url(&url)
        .map_err(|e| format!("URL validation failed: {}", e))?;

    // Create HTTP client with security settings from SSRF protection
    let client = ssrf_protection
        .create_http_client()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Perform the request
    let response = client
        .get(validated_url.as_str())
        .header("User-Agent", "Cortex-GUI/0.1")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "HTTP error: {} {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("Unknown")
        ));
    }

    // Check Content-Length before reading to avoid downloading huge responses
    if let Some(content_length) = response.content_length() {
        if content_length as usize > FETCH_URL_MAX_RESPONSE_SIZE {
            return Err(format!(
                "Response too large: {} bytes exceeds limit of {} bytes",
                content_length, FETCH_URL_MAX_RESPONSE_SIZE
            ));
        }
    }

    // Read response with size limit
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if bytes.len() > FETCH_URL_MAX_RESPONSE_SIZE {
        return Err(format!(
            "Response too large: {} bytes exceeds limit of {} bytes",
            bytes.len(),
            FETCH_URL_MAX_RESPONSE_SIZE
        ));
    }

    let content = String::from_utf8(bytes.to_vec())
        .map_err(|e| format!("Response is not valid UTF-8: {}", e))?;

    Ok(serde_json::json!({
        "content": content,
        "text": content,
        "size": content.len(),
        "url": validated_url.as_str()
    }))
}
