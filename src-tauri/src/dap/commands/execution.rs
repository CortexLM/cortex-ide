//! Execution control commands
//!
//! This module contains Tauri commands for controlling program execution:
//! continue, pause, stepping, and restart operations.

use tauri::State;

use super::state::DebuggerState;

/// Continue execution
#[tauri::command]
pub async fn debug_continue(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .continue_()
        .await
        .map_err(|e| format!("Failed to continue: {}", e))
}

/// Pause execution
#[tauri::command]
pub async fn debug_pause(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .pause()
        .await
        .map_err(|e| format!("Failed to pause: {}", e))
}

/// Step over (next line)
#[tauri::command]
pub async fn debug_step_over(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .step_over()
        .await
        .map_err(|e| format!("Failed to step over: {}", e))
}

/// Step into function
#[tauri::command]
pub async fn debug_step_into(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .step_into()
        .await
        .map_err(|e| format!("Failed to step into: {}", e))
}

/// Step out of function
#[tauri::command]
pub async fn debug_step_out(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .step_out()
        .await
        .map_err(|e| format!("Failed to step out: {}", e))
}

/// Step back (reverse debugging)
#[tauri::command]
pub async fn debug_step_back(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .step_back()
        .await
        .map_err(|e| format!("Failed to step back: {}", e))
}

/// Reverse continue (reverse debugging)
#[tauri::command]
pub async fn debug_reverse_continue(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .reverse_continue()
        .await
        .map_err(|e| format!("Failed to reverse continue: {}", e))
}

/// Restart the debug session
#[tauri::command]
pub async fn debug_restart(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let mut session = session.write().await;
    session
        .restart()
        .await
        .map_err(|e| format!("Failed to restart: {}", e))
}

/// Step to next instruction (instruction-level stepping)
#[tauri::command]
pub async fn debug_step_instruction(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .step_instruction()
        .await
        .map_err(|e| format!("Failed to step instruction: {}", e))
}
