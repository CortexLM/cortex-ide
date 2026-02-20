//! Server lifecycle commands
//!
//! Commands for starting, stopping, restarting, and managing LSP servers.

use std::sync::Arc;

use tauri::State;
use tracing::{error, info};

use crate::lsp::client::LspClient;
use crate::lsp::types::{LanguageServerConfig, ServerInfo};

use super::state::LspState;

/// Start a language server
#[tauri::command]
pub async fn lsp_start_server(
    config: LanguageServerConfig,
    state: State<'_, LspState>,
) -> Result<ServerInfo, String> {
    let server_id = config.id.clone();
    let language_id = config.language_id.clone();

    // Check if server is already running
    {
        let clients = state.clients.lock();
        if let Some(client) = clients.get(&server_id) {
            return Ok(client.info());
        }
    }

    // Create and start the client
    let client = LspClient::new(config, Some(state.diagnostics_tx.clone()))
        .map_err(|e| format!("Failed to start language server: {}", e))?;

    // Initialize the server
    client
        .initialize()
        .await
        .map_err(|e| format!("Failed to initialize language server: {}", e))?;

    let info = client.info();
    let client = Arc::new(client);

    // Store the client
    state.clients.lock().insert(server_id.clone(), client);

    // Register client for language (multi-provider support)
    state.register_client_for_language(&language_id, &server_id);
    info!(
        "Registered LSP server {} for language {}",
        server_id, language_id
    );

    Ok(info)
}

/// Stop a language server
#[tauri::command]
pub async fn lsp_stop_server(server_id: String, state: State<'_, LspState>) -> Result<(), String> {
    // Unregister from language mapping first
    state.unregister_client(&server_id);

    let client = state.clients.lock().remove(&server_id);

    if let Some(client) = client {
        client
            .shutdown()
            .await
            .map_err(|e| format!("Failed to shutdown server: {}", e))?;
    }

    Ok(())
}

/// Stop all language servers
#[tauri::command]
pub async fn lsp_stop_all_servers(state: State<'_, LspState>) -> Result<(), String> {
    // Clear language mapping
    state.language_clients.lock().clear();

    let clients: Vec<_> = state.clients.lock().drain().collect();

    for (_, client) in clients {
        if let Err(e) = client.shutdown().await {
            error!("Failed to shutdown server: {}", e);
        }
    }

    Ok(())
}

/// Get list of running servers
#[tauri::command]
pub fn lsp_list_servers(state: State<'_, LspState>) -> Vec<ServerInfo> {
    state.clients.lock().values().map(|c| c.info()).collect()
}

/// Get server info
#[tauri::command]
pub fn lsp_get_server_info(server_id: String, state: State<'_, LspState>) -> Option<ServerInfo> {
    state.clients.lock().get(&server_id).map(|c| c.info())
}

/// Restart a language server
#[tauri::command]
pub async fn lsp_restart(
    server_id: String,
    state: State<'_, LspState>,
) -> Result<ServerInfo, String> {
    // Get the current client's config
    let config = {
        let clients = state.clients.lock();
        let client = clients
            .get(&server_id)
            .ok_or_else(|| format!("Server not found: {}", server_id))?;
        client.config.clone()
    };

    // Stop the server
    {
        let client = state.clients.lock().remove(&server_id);
        if let Some(client) = client {
            client
                .shutdown()
                .await
                .map_err(|e| format!("Failed to shutdown server: {}", e))?;
        }
    }

    // Start a new server with the same config
    let client = LspClient::new(config.clone(), Some(state.diagnostics_tx.clone()))
        .map_err(|e| format!("Failed to start language server: {}", e))?;

    // Initialize the server
    client
        .initialize()
        .await
        .map_err(|e| format!("Failed to initialize language server: {}", e))?;

    let info = client.info();
    let client = Arc::new(client);

    // Store the client
    state.clients.lock().insert(server_id, client);

    Ok(info)
}

/// Get server logs
#[tauri::command]
pub fn lsp_get_logs(server_id: String, state: State<'_, LspState>) -> Result<Vec<String>, String> {
    // Check if server exists
    let clients = state.clients.lock();
    if !clients.contains_key(&server_id) {
        return Err(format!("Server not found: {}", server_id));
    }
    drop(clients); // Release lock before getting logs
    Ok(state.get_logs(&server_id))
}

/// Clear server logs
#[tauri::command]
pub fn lsp_clear_logs(server_id: String, state: State<'_, LspState>) -> Result<(), String> {
    // Check if server exists
    let clients = state.clients.lock();
    if !clients.contains_key(&server_id) {
        return Err(format!("Server not found: {}", server_id));
    }
    drop(clients);
    state.clear_logs(&server_id);
    Ok(())
}

/// Get list of servers for a specific language
#[tauri::command]
pub fn lsp_get_servers_for_language(
    language: String,
    state: State<'_, LspState>,
) -> Vec<ServerInfo> {
    state
        .get_clients_for_language(&language)
        .iter()
        .map(|c| c.info())
        .collect()
}
