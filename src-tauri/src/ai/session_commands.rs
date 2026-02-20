use crate::ai::{AIState, CreateSessionOptions, SessionInfo};
use crate::cortex_storage::{SessionSummary, StoredMessage};
use std::path::PathBuf;
use tauri::{AppHandle, State};

/// Create a new AI session.
#[tauri::command]
pub async fn cortex_create_session(
    app_handle: AppHandle,
    state: State<'_, AIState>,
    model: Option<String>,
    cwd: Option<String>,
) -> Result<SessionInfo, String> {
    let options = CreateSessionOptions {
        model,
        cwd: cwd.map(PathBuf::from),
        ..Default::default()
    };
    state
        .session_manager
        .create_session(app_handle, options)
        .await
        .map_err(|e| e.to_string())
}

/// Send a message to an AI session.
#[tauri::command]
pub async fn cortex_send_message(
    state: State<'_, AIState>,
    session_id: String,
    content: String,
) -> Result<(), String> {
    state
        .session_manager
        .send_message(&session_id, content)
        .await
        .map_err(|e| e.to_string())
}

/// Approve a tool execution call.
#[tauri::command]
pub async fn cortex_approve_exec(
    state: State<'_, AIState>,
    session_id: String,
    call_id: String,
    approved: bool,
) -> Result<(), String> {
    state
        .session_manager
        .approve_exec(&session_id, call_id, approved)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel the current operation in a session.
#[tauri::command]
pub async fn cortex_cancel(state: State<'_, AIState>, session_id: String) -> Result<(), String> {
    state
        .session_manager
        .interrupt(&session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the current status/info of a session.
#[tauri::command]
pub async fn cortex_get_status(
    state: State<'_, AIState>,
    session_id: String,
) -> Result<SessionInfo, String> {
    state
        .session_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| format!("Session {} not found", session_id))
}

/// List all stored sessions from disk.
#[tauri::command]
pub async fn cortex_list_stored_sessions(
    state: State<'_, AIState>,
) -> Result<Vec<SessionSummary>, String> {
    state
        .session_manager
        .storage()
        .list_sessions_sync()
        .map_err(|e| e.to_string())
}

/// Get message history for a session.
#[tauri::command]
pub async fn cortex_get_history(
    state: State<'_, AIState>,
    session_id: String,
) -> Result<Vec<StoredMessage>, String> {
    state
        .session_manager
        .storage()
        .get_history_sync(&session_id)
        .map_err(|e| e.to_string())
}

/// Shutdown and destroy a session in memory.
#[tauri::command]
pub async fn cortex_destroy_session(
    state: State<'_, AIState>,
    session_id: String,
) -> Result<(), String> {
    state
        .session_manager
        .destroy_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Delete a session from memory and disk.
#[tauri::command]
pub async fn cortex_delete_session(
    state: State<'_, AIState>,
    session_id: String,
) -> Result<(), String> {
    state
        .session_manager
        .delete_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Update the model for an existing session.
#[tauri::command]
pub async fn cortex_update_model(
    state: State<'_, AIState>,
    session_id: String,
    model: String,
) -> Result<(), String> {
    state
        .session_manager
        .update_model(&session_id, &model)
        .await
        .map_err(|e| e.to_string())
}

/// Update the working directory for an existing session.
#[tauri::command]
pub async fn cortex_update_cwd(
    state: State<'_, AIState>,
    session_id: String,
    cwd: String,
) -> Result<(), String> {
    state
        .session_manager
        .update_cwd(&session_id, &PathBuf::from(cwd))
        .await
        .map_err(|e| e.to_string())
}

/// Submit system selection (design system) to a session.
#[tauri::command]
pub async fn cortex_submit_system(
    state: State<'_, AIState>,
    session_id: String,
    call_id: String,
    config: serde_json::Value,
) -> Result<(), String> {
    state
        .session_manager
        .submit_design_system(&session_id, call_id, config)
        .await
        .map_err(|e| e.to_string())
}
