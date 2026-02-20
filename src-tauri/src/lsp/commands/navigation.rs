//! Navigation commands
//!
//! Commands for code navigation: definition, references, type definition,
//! implementation, and hover.

use tauri::State;

use crate::lsp::types::{
    DefinitionResult, HoverInfo, ImplementationResult, ReferencesResult,
    TextDocumentPositionParams, TypeDefinitionResult,
};

use super::state::LspState;

/// Request hover information
#[tauri::command]
pub async fn lsp_hover(
    server_id: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<Option<HoverInfo>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .hover(params)
        .await
        .map_err(|e| format!("Hover request failed: {}", e))
}

/// Request definition locations
#[tauri::command]
pub async fn lsp_definition(
    server_id: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<DefinitionResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .definition(params)
        .await
        .map_err(|e| format!("Definition request failed: {}", e))
}

/// Request references
#[tauri::command]
pub async fn lsp_references(
    server_id: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<ReferencesResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .references(params)
        .await
        .map_err(|e| format!("References request failed: {}", e))
}

/// Request type definition
#[tauri::command]
pub async fn lsp_type_definition(
    server_id: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<TypeDefinitionResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .type_definition(params)
        .await
        .map_err(|e| format!("Type definition request failed: {}", e))
}

/// Request implementation
#[tauri::command]
pub async fn lsp_implementation(
    server_id: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<ImplementationResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .implementation(params)
        .await
        .map_err(|e| format!("Implementation request failed: {}", e))
}
