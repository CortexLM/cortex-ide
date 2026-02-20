//! Miscellaneous commands
//!
//! This module contains Tauri commands for various debugging operations:
//! completions, loaded sources, source content, exception info, modules, etc.

use tauri::State;

use super::super::protocol::{
    CompletionItem, ExceptionInfoResponse, ModulesResponse, Source, SourceResponse,
};
use super::state::DebuggerState;

/// Get completions for debug console input
#[tauri::command]
pub async fn debug_completions(
    state: State<'_, DebuggerState>,
    session_id: String,
    text: String,
    column: i64,
    line: Option<i64>,
) -> Result<Vec<CompletionItem>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    // Check if debug adapter supports completions
    let capabilities = session.capabilities().await;
    if let Some(caps) = &capabilities {
        if !caps.supports_completions_request.unwrap_or(false) {
            // Debug adapter doesn't support completions, return empty list
            return Ok(vec![]);
        }
    }

    let result = session
        .completions(&text, column, line)
        .await
        .map_err(|e| format!("Failed to get completions: {}", e))?;

    Ok(result.targets)
}

/// Cancel a pending request
#[tauri::command]
pub async fn debug_cancel_request(
    state: State<'_, DebuggerState>,
    session_id: String,
    request_id: Option<i64>,
    progress_id: Option<String>,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .cancel_request(request_id, progress_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get loaded sources
#[tauri::command]
pub async fn debug_loaded_sources(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<Vec<Source>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session.loaded_sources().await.map_err(|e| e.to_string())
}

/// Get source content for a source reference (for sources without a path)
#[tauri::command]
pub async fn debug_source(
    state: State<'_, DebuggerState>,
    session_id: String,
    source_reference: i64,
    source_path: Option<String>,
) -> Result<SourceResponse, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .source(source_reference, source_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Get exception info for the current exception
#[tauri::command]
pub async fn debug_exception_info(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_id: i64,
) -> Result<ExceptionInfoResponse, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .exception_info(thread_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get modules loaded by the debuggee
#[tauri::command]
pub async fn debug_modules(
    state: State<'_, DebuggerState>,
    session_id: String,
    start: Option<i64>,
    count: Option<i64>,
) -> Result<ModulesResponse, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .modules(start, count)
        .await
        .map_err(|e| e.to_string())
}
