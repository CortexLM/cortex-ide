//! Document notification commands
//!
//! Commands for document lifecycle notifications (open, change, save, close).

use tauri::State;

use crate::lsp::types::{DidChangeParams, DidCloseParams, DidOpenParams, DidSaveParams};

use super::state::LspState;

/// Notify that a document was opened
#[tauri::command]
pub fn lsp_did_open(
    server_id: String,
    params: DidOpenParams,
    state: State<'_, LspState>,
) -> Result<(), String> {
    let clients = state.clients.lock();
    let client = clients
        .get(&server_id)
        .ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .did_open(params)
        .map_err(|e| format!("Failed to send didOpen: {}", e))
}

/// Notify that a document was changed
#[tauri::command]
pub fn lsp_did_change(
    server_id: String,
    params: DidChangeParams,
    state: State<'_, LspState>,
) -> Result<(), String> {
    let clients = state.clients.lock();
    let client = clients
        .get(&server_id)
        .ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .did_change(params)
        .map_err(|e| format!("Failed to send didChange: {}", e))
}

/// Notify that a document was saved
#[tauri::command]
pub fn lsp_did_save(
    server_id: String,
    params: DidSaveParams,
    state: State<'_, LspState>,
) -> Result<(), String> {
    let clients = state.clients.lock();
    let client = clients
        .get(&server_id)
        .ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .did_save(params)
        .map_err(|e| format!("Failed to send didSave: {}", e))
}

/// Notify that a document was closed
#[tauri::command]
pub fn lsp_did_close(
    server_id: String,
    params: DidCloseParams,
    state: State<'_, LspState>,
) -> Result<(), String> {
    let clients = state.clients.lock();
    let client = clients
        .get(&server_id)
        .ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .did_close(params)
        .map_err(|e| format!("Failed to send didClose: {}", e))
}
