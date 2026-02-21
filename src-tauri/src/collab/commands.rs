//! Collaboration Tauri Commands
//!
//! Tauri command handlers for collaboration operations including
//! session management, cursor broadcasting, and document sync.

use tauri::{AppHandle, Emitter, State};
use tracing::info;

use super::CollabState;
use super::types::{CollabSessionInfo, CursorPosition};
use crate::LazyState;

/// Create a new collaboration session and start the WebSocket server
#[tauri::command]
pub async fn collab_create_session(
    app: AppHandle,
    state: State<'_, LazyState<CollabState>>,
    name: String,
    user_name: String,
) -> Result<CollabSessionInfo, String> {
    let mut manager = state.get().0.lock().await;

    // Start the WebSocket server if not already running
    let port = manager.ensure_server_running(app.clone()).await?;

    let session_id = uuid::Uuid::new_v4().to_string();
    let user_id = uuid::Uuid::new_v4().to_string();

    let session_info =
        manager
            .session_manager
            .create_session(&session_id, &name, &user_id, &user_name);

    // Emit event to frontend
    let _ = app.emit("collab:session-created", &session_info);

    info!(
        "Created collaboration session '{}' (id: {}) on port {}",
        name, session_id, port
    );

    Ok(session_info)
}

/// Join an existing collaboration session
#[tauri::command]
pub async fn collab_join_session(
    app: AppHandle,
    state: State<'_, LazyState<CollabState>>,
    session_id: String,
    user_name: String,
) -> Result<CollabSessionInfo, String> {
    let mut manager = state.get().0.lock().await;

    // Ensure server is running
    manager.ensure_server_running(app.clone()).await?;

    let user_id = uuid::Uuid::new_v4().to_string();

    let session_info = manager
        .session_manager
        .join_session(&session_id, &user_id, &user_name)?;

    // Emit event to frontend
    let _ = app.emit("collab:user-joined", &session_info);

    info!(
        "User '{}' joined session '{}' (id: {})",
        user_name, session_info.name, session_id
    );

    Ok(session_info)
}

/// Leave a collaboration session
#[tauri::command]
pub async fn collab_leave_session(
    app: AppHandle,
    state: State<'_, LazyState<CollabState>>,
    session_id: String,
    user_id: String,
) -> Result<(), String> {
    let mut manager = state.get().0.lock().await;

    let session_removed = manager
        .session_manager
        .leave_session(&session_id, &user_id)?;

    // Emit event to frontend
    let _ = app.emit(
        "collab:user-left",
        serde_json::json!({
            "sessionId": session_id,
            "userId": user_id,
            "sessionRemoved": session_removed,
        }),
    );

    // Stop server if no more sessions
    if session_removed && manager.session_manager.session_count() == 0 {
        manager.stop_server();
    }

    Ok(())
}

/// Broadcast cursor position to all peers in a session
#[tauri::command]
pub async fn collab_broadcast_cursor(
    state: State<'_, LazyState<CollabState>>,
    session_id: String,
    user_id: String,
    file_id: String,
    line: u32,
    column: u32,
) -> Result<(), String> {
    let mut manager = state.get().0.lock().await;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let cursor = CursorPosition {
        file_id,
        line,
        column,
        timestamp: now,
    };

    manager
        .session_manager
        .update_cursor(&session_id, &user_id, cursor)?;

    Ok(())
}

/// Sync a document update via the CRDT engine
#[tauri::command]
pub async fn collab_sync_document(
    state: State<'_, LazyState<CollabState>>,
    session_id: String,
    file_id: String,
    update: Vec<u8>,
) -> Result<Vec<u8>, String> {
    let manager = state.get().0.lock().await;

    let doc_store = manager
        .session_manager
        .get_document_store(&session_id)
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    // Apply the incoming update
    doc_store.apply_update(&file_id, &update).await?;

    // Return the full state so the caller can sync
    let state_data = doc_store.encode_state(&file_id).await;

    Ok(state_data)
}
