//! Session management commands
//!
//! This module contains Tauri commands for managing debug sessions:
//! starting, stopping, getting session info, and capabilities.

use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};
use tokio::sync::{RwLock, mpsc};

use super::super::{DebugSession, DebugSessionConfig, DebugSessionEvent, DebugSessionState};
use super::state::DebuggerState;
use super::types::DebugSessionInfo;

/// Start a new debug session
#[tauri::command]
pub async fn debug_start_session(
    app: AppHandle,
    state: State<'_, DebuggerState>,
    config: DebugSessionConfig,
) -> Result<DebugSessionInfo, String> {
    let session_id = config.id.clone();
    let session_name = config.name.clone();
    let session_type = config.type_.clone();

    // Create event channel
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<DebugSessionEvent>();

    // Store event sender
    *state.event_tx.write().await = Some(event_tx.clone());

    // Forward events to frontend
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            // Emit event to frontend
            let _ = app_clone.emit(&format!("debug:event:{}", session_id_clone), &event);
            let _ = app_clone.emit("debug:event", &event);
        }
    });

    // Create the debug session
    let mut session = DebugSession::new(config, event_tx)
        .await
        .map_err(|e| format!("Failed to create debug session: {}", e))?;

    // Start the session
    session
        .start()
        .await
        .map_err(|e| format!("Failed to start debug session: {}", e))?;

    let current_state = session.state().await;
    let session = Arc::new(RwLock::new(session));

    // Store the session
    state
        .sessions
        .write()
        .await
        .insert(session_id.clone(), session.clone());

    // Start event processing loop
    let session_clone = session.clone();
    tokio::spawn(async move {
        let mut session = session_clone.write().await;
        session.process_events().await;
    });

    Ok(DebugSessionInfo {
        id: session_id,
        name: session_name,
        type_: session_type,
        state: current_state,
    })
}

/// Stop a debug session
#[tauri::command]
pub async fn debug_stop_session(
    state: State<'_, DebuggerState>,
    session_id: String,
    terminate_debuggee: bool,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .stop(terminate_debuggee)
        .await
        .map_err(|e| format!("Failed to stop session: {}", e))?;

    drop(session);
    drop(sessions);

    // Remove the session
    state.sessions.write().await.remove(&session_id);

    Ok(())
}

/// Get all active debug sessions
#[tauri::command]
pub async fn debug_get_sessions(
    state: State<'_, DebuggerState>,
) -> Result<Vec<DebugSessionInfo>, String> {
    let sessions = state.sessions.read().await;
    let mut result = Vec::new();

    for (id, session) in sessions.iter() {
        let session = session.read().await;
        result.push(DebugSessionInfo {
            id: id.clone(),
            name: session.config.name.clone(),
            type_: session.config.type_.clone(),
            state: session.state().await,
        });
    }

    Ok(result)
}

/// Get session state
#[tauri::command]
pub async fn debug_get_session_state(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<DebugSessionState, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    Ok(session.state().await)
}

/// Get adapter capabilities for a debug session
#[tauri::command]
pub async fn debug_get_capabilities(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<serde_json::Value, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let capabilities = session.capabilities().await;

    // Return the capabilities as JSON, or an empty object if none
    Ok(serde_json::to_value(&capabilities).unwrap_or_default())
}

/// Terminate a debug session (alias for stop with terminate_debuggee=true)
#[tauri::command]
pub async fn debug_terminate(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .stop(true) // terminate_debuggee = true
        .await
        .map_err(|e| format!("Failed to terminate session: {}", e))?;

    drop(session);
    drop(sessions);

    // Remove the session
    state.sessions.write().await.remove(&session_id);

    Ok(())
}

/// Disconnect from a debug session without terminating the debuggee
#[tauri::command]
pub async fn debug_disconnect(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<(), String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .stop(false) // terminate_debuggee = false
        .await
        .map_err(|e| format!("Failed to disconnect session: {}", e))?;

    drop(session);
    drop(sessions);

    // Remove the session
    state.sessions.write().await.remove(&session_id);

    Ok(())
}
