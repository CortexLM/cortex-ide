//! AI context retrieval for RAG-augmented prompts.
//!
//! Given a cursor position or a free-text query, retrieves the top-K
//! most relevant code chunks from the vector store and combines them
//! with file-proximity heuristics to build rich context for AI prompts.

use super::vector_store::{CodeChunk, SearchResult, generate_embedding};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// AI context assembled from the indexed codebase.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIContext {
    /// Relevant code chunks ranked by relevance.
    pub chunks: Vec<CodeChunk>,
    /// The query or cursor context used for retrieval.
    pub query: String,
    /// Total number of indexed chunks available.
    pub total_indexed: usize,
    /// Formatted context string ready for prompt injection.
    pub formatted_context: String,
}

/// Request for AI context retrieval.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextRequest {
    /// Free-text query or code snippet for similarity search.
    pub query: Option<String>,
    /// Current file path (for proximity boosting).
    pub file_path: Option<String>,
    /// Current file content (used to build query from cursor).
    pub file_content: Option<String>,
    /// 1-based cursor line.
    pub line: Option<u32>,
    /// 1-based cursor column.
    pub column: Option<u32>,
    /// Language filter.
    pub language: Option<String>,
    /// Number of chunks to retrieve.
    pub top_k: Option<usize>,
}

// ---------------------------------------------------------------------------
// Context building
// ---------------------------------------------------------------------------

/// Build a query string from cursor position in a file.
fn build_query_from_cursor(content: &str, line: u32, _column: u32, context_lines: usize) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let cursor_line = (line as usize).saturating_sub(1);

    let start = cursor_line.saturating_sub(context_lines);
    let end = (cursor_line + context_lines + 1).min(lines.len());

    lines[start..end].join("\n")
}

/// Apply proximity boost: chunks from the same file or nearby files
/// get a score bonus.
fn apply_proximity_boost(results: &mut [SearchResult], current_file: Option<&str>) {
    let current_file = match current_file {
        Some(f) => f,
        None => return,
    };

    let current_dir = std::path::Path::new(current_file)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    for result in results.iter_mut() {
        // Same file boost
        if result.chunk.file_path == current_file {
            result.score *= 1.5;
            result.chunk.score = result.score;
            continue;
        }

        // Same directory boost
        if result.chunk.file_path.starts_with(&current_dir) {
            result.score *= 1.2;
            result.chunk.score = result.score;
        }
    }

    // Re-sort after boosting
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
}

/// Format retrieved chunks into a context string for prompt injection.
fn format_context(chunks: &[CodeChunk]) -> String {
    if chunks.is_empty() {
        return String::new();
    }

    let mut formatted = String::with_capacity(4096);
    formatted.push_str("## Relevant code from the codebase:\n\n");

    for (i, chunk) in chunks.iter().enumerate() {
        formatted.push_str(&format!(
            "### [{}/{}] {} ({}:{}-{})\n```{}\n{}\n```\n\n",
            i + 1,
            chunks.len(),
            chunk.file_path,
            chunk.chunk_type,
            chunk.start_line,
            chunk.end_line,
            chunk.language,
            chunk.content,
        ));
    }

    formatted
}

// ---------------------------------------------------------------------------
// Tauri Command
// ---------------------------------------------------------------------------

/// Retrieve AI context for RAG-augmented prompts.
///
/// Combines vector similarity search with file proximity heuristics
/// to provide the most relevant code context for AI completions and chat.
#[tauri::command]
pub async fn get_ai_context(
    state: tauri::State<'_, super::AIState>,
    request: ContextRequest,
) -> Result<AIContext, String> {
    let vector_store = &state.vector_store_state;
    let top_k = request.top_k.unwrap_or(5);

    // Build the query
    let query = if let Some(q) = &request.query {
        q.clone()
    } else if let (Some(content), Some(line), Some(col)) =
        (&request.file_content, request.line, request.column)
    {
        build_query_from_cursor(content, line, col, 10)
    } else {
        return Err("Either 'query' or 'fileContent' with cursor position is required".to_string());
    };

    debug!(
        query_len = query.len(),
        top_k = top_k,
        "Retrieving AI context"
    );

    // Generate query embedding
    let query_embedding = generate_embedding(&query);

    // Search vector store
    let store_lock: tokio::sync::MutexGuard<'_, Option<super::vector_store::VectorStore>> =
        vector_store.store.lock().await;
    let (mut results, total_indexed) = match *store_lock {
        Some(ref store) => {
            let results: Vec<SearchResult> =
                store.search_similar(&query_embedding, top_k * 2, request.language.as_deref())?;
            let total = store.chunk_count()?;
            (results, total)
        }
        None => {
            return Ok(AIContext {
                chunks: Vec::new(),
                query,
                total_indexed: 0,
                formatted_context: String::new(),
            });
        }
    };
    drop(store_lock);

    // Apply proximity boosting
    apply_proximity_boost(&mut results, request.file_path.as_deref());

    // Take top-K after boosting
    results.truncate(top_k);

    let chunks: Vec<CodeChunk> = results.into_iter().map(|r| r.chunk).collect();
    let formatted_context = format_context(&chunks);

    info!(
        chunks = chunks.len(),
        total_indexed = total_indexed,
        "AI context retrieved"
    );

    Ok(AIContext {
        chunks,
        query,
        total_indexed,
        formatted_context,
    })
}
