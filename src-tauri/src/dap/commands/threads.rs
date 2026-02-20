//! Thread and stack frame commands
//!
//! This module contains Tauri commands for working with threads and stack frames:
//! getting threads, stack traces, scopes, and managing active thread/frame.

use tauri::State;

use super::super::protocol::{Scope, StackFrame, Thread};
use super::state::DebuggerState;

/// Get threads
#[tauri::command]
pub async fn debug_get_threads(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<Vec<Thread>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    Ok(session.threads().await)
}

/// Get stack trace for a thread
#[tauri::command]
pub async fn debug_get_stack_trace(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_id: i64,
) -> Result<Vec<StackFrame>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    Ok(session.stack_frames(thread_id).await)
}

/// Get scopes for a stack frame
#[tauri::command]
pub async fn debug_get_scopes(
    state: State<'_, DebuggerState>,
    session_id: String,
    frame_id: i64,
) -> Result<Vec<Scope>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .get_scopes(frame_id)
        .await
        .map_err(|e| format!("Failed to get scopes: {}", e))
}

/// Set active thread
#[tauri::command]
pub async fn debug_set_active_thread(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_id: i64,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session.set_active_thread(thread_id).await;
    Ok(())
}

/// Set active frame
#[tauri::command]
pub async fn debug_set_active_frame(
    state: State<'_, DebuggerState>,
    session_id: String,
    frame_id: i64,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session.set_active_frame(frame_id).await;
    Ok(())
}

/// Get active thread ID
#[tauri::command]
pub async fn debug_get_active_thread(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<Option<i64>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    Ok(session.active_thread_id().await)
}

/// Get active frame ID
#[tauri::command]
pub async fn debug_get_active_frame(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<Option<i64>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    Ok(session.active_frame_id().await)
}

/// Terminate specific threads
#[tauri::command]
pub async fn debug_terminate_threads(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_ids: Vec<i64>,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .terminate_threads(thread_ids)
        .await
        .map_err(|e| e.to_string())
}
