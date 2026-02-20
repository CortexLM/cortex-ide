//! Navigation commands
//!
//! This module contains Tauri commands for code navigation during debugging:
//! goto targets, step-in targets, restart frame, and similar operations.

use tauri::State;

use super::super::protocol::{GotoTarget, StepInTarget};
use super::state::DebuggerState;

/// Restart execution from a specific stack frame
#[tauri::command]
pub async fn debug_restart_frame(
    state: State<'_, DebuggerState>,
    session_id: String,
    frame_id: i64,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .restart_frame(frame_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get possible goto targets for a source location
#[tauri::command]
pub async fn debug_goto_targets(
    state: State<'_, DebuggerState>,
    session_id: String,
    source_path: String,
    line: i64,
    column: Option<i64>,
) -> Result<Vec<GotoTarget>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .goto_targets(&source_path, line, column)
        .await
        .map_err(|e| e.to_string())
}

/// Jump to a specific goto target
#[tauri::command]
pub async fn debug_goto(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_id: i64,
    target_id: i64,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .goto(thread_id, target_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get possible step-in targets for the current position
#[tauri::command]
pub async fn debug_step_in_targets(
    state: State<'_, DebuggerState>,
    session_id: String,
    frame_id: i64,
) -> Result<Vec<StepInTarget>, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .step_in_targets(frame_id)
        .await
        .map_err(|e| e.to_string())
}

/// Step into a specific target (when multiple step-in targets exist)
#[tauri::command]
pub async fn debug_step_in_target(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_id: i64,
    target_id: i64,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .step_in_target(thread_id, target_id)
        .await
        .map_err(|e| e.to_string())
}

/// Step into a specific target (for multi-target step into)
/// This is an alias for debug_step_in_target for API compatibility
#[tauri::command]
pub async fn debug_step_into_target(
    state: State<'_, DebuggerState>,
    session_id: String,
    thread_id: i64,
    target_id: i64,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .step_in_target(thread_id, target_id)
        .await
        .map_err(|e| format!("Failed to step into target: {}", e))
}
