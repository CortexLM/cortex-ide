//! Code action commands
//!
//! Commands for code actions, rename, signature help, and command execution.

use tauri::State;

use crate::lsp::types::{
    CodeActionParams, CodeActionResult, RenameParams, SignatureHelp, SignatureHelpParams,
    WorkspaceEdit,
};

use super::state::LspState;

/// Request signature help
#[tauri::command]
pub async fn lsp_signature_help(
    server_id: String,
    params: SignatureHelpParams,
    state: State<'_, LspState>,
) -> Result<Option<SignatureHelp>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .signature_help(params)
        .await
        .map_err(|e| format!("Signature help request failed: {}", e))
}

/// Rename symbol
#[tauri::command]
pub async fn lsp_rename(
    server_id: String,
    params: RenameParams,
    state: State<'_, LspState>,
) -> Result<WorkspaceEdit, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .rename(params)
        .await
        .map_err(|e| format!("Rename request failed: {}", e))
}

/// Request code actions
#[tauri::command]
pub async fn lsp_code_action(
    server_id: String,
    params: CodeActionParams,
    state: State<'_, LspState>,
) -> Result<CodeActionResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .code_action(params)
        .await
        .map_err(|e| format!("Code action request failed: {}", e))
}

/// Execute a command (workspace/executeCommand)
#[tauri::command]
pub async fn lsp_execute_command(
    server_id: String,
    command: String,
    arguments: Option<Vec<serde_json::Value>>,
    state: State<'_, LspState>,
) -> Result<serde_json::Value, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .execute_command(&command, arguments)
        .await
        .map_err(|e| format!("Execute command failed: {}", e))
}

/// Prepare rename (check if rename is valid at position and get range)
#[tauri::command]
pub async fn lsp_prepare_rename(
    server_id: String,
    uri: String,
    position: crate::lsp::types::Position,
    state: State<'_, LspState>,
) -> Result<Option<crate::lsp::types::PrepareRenameResult>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .prepare_rename(&uri, &position)
        .await
        .map_err(|e| format!("Prepare rename request failed: {}", e))
}
