//! Tauri Commands for Context Server
//!
//! Exposes MCP functionality to the frontend via Tauri commands.

use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex as TokioMutex;
use tracing::{error, info};

use super::ContextServerState;
use super::protocol::{McpClient, McpClientBuilder};
use super::types::*;
use crate::LazyState;

// =====================
// Server Management
// =====================

/// Add a new context server configuration
#[tauri::command]
pub async fn mcp_add_server(
    config: ContextServerConfig,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<String, String> {
    let mut manager = state.get().0.lock().await;
    let id = manager.add_server(config);
    info!("Added context server: {}", id);
    Ok(id)
}

/// Remove a context server
#[tauri::command]
pub async fn mcp_remove_server(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<bool, String> {
    let client_to_shutdown = {
        let mut manager = state.get().0.lock().await;

        // Disconnect if connected
        if let Some(server) = manager.get_server_mut(&server_id) {
            server.client.take()
        } else {
            None
        }
    };

    // Shutdown the client outside of the manager lock
    if let Some(client) = client_to_shutdown {
        let client = client.lock().await;
        let _ = client.shutdown().await;
    }

    let mut manager = state.get().0.lock().await;
    let removed = manager.remove_server(&server_id);
    if removed {
        info!("Removed context server: {}", server_id);
    }
    Ok(removed)
}

/// List all context servers
#[tauri::command]
pub async fn mcp_list_servers(
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<ContextServerInfo>, String> {
    let manager = state.get().0.lock().await;
    Ok(manager.list_servers())
}

/// Get info about a specific server
#[tauri::command]
pub async fn mcp_get_server(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Option<ContextServerInfo>, String> {
    let manager = state.get().0.lock().await;
    Ok(manager.get_server(&server_id).map(|s| s.to_info()))
}

/// Connect to a context server
#[tauri::command]
pub async fn mcp_connect(
    app: AppHandle,
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<ContextServerInfo, String> {
    // Get config and update status
    let config = {
        let mut manager = state.get().0.lock().await;
        let server = manager
            .get_server_mut(&server_id)
            .ok_or_else(|| format!("Server not found: {}", server_id))?;

        server.status = ServerStatus::Connecting;
        server.config.clone()
    };

    // Emit connecting event
    let _ = app.emit(
        "mcp:status",
        serde_json::json!({
            "serverId": server_id,
            "status": "connecting"
        }),
    );

    // Connect to the server
    let result = McpClientBuilder::new(config).connect_and_initialize().await;

    match result {
        Ok(client) => {
            let capabilities = client.capabilities.clone();
            let server_info_data = client.server_info.clone();

            let mut manager = state.get().0.lock().await;
            if let Some(server) = manager.get_server_mut(&server_id) {
                server.status = ServerStatus::Connected;
                server.client = Some(Arc::new(TokioMutex::new(client)));

                let info = ContextServerInfo {
                    id: server.id.clone(),
                    name: server.config.name.clone(),
                    server_type: server.config.server_type.clone(),
                    status: ServerStatus::Connected,
                    capabilities: Some(capabilities.clone()),
                };

                // Emit connected event
                let _ = app.emit(
                    "mcp:status",
                    serde_json::json!({
                        "serverId": server_id,
                        "status": "connected",
                        "capabilities": capabilities,
                        "serverInfo": server_info_data
                    }),
                );

                info!("Connected to context server: {}", server_id);
                Ok(info)
            } else {
                Err("Server was removed during connection".to_string())
            }
        }
        Err(e) => {
            error!("Failed to connect to context server {}: {}", server_id, e);

            let mut manager = state.get().0.lock().await;
            if let Some(server) = manager.get_server_mut(&server_id) {
                server.status = ServerStatus::Error;
            }

            // Emit error event
            let _ = app.emit(
                "mcp:status",
                serde_json::json!({
                    "serverId": server_id,
                    "status": "error",
                    "error": e.to_string()
                }),
            );

            Err(format!("Failed to connect: {}", e))
        }
    }
}

/// Disconnect from a context server
#[tauri::command]
pub async fn mcp_disconnect(
    app: AppHandle,
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<(), String> {
    let client = {
        let mut manager = state.get().0.lock().await;
        let server = manager
            .get_server_mut(&server_id)
            .ok_or_else(|| format!("Server not found: {}", server_id))?;

        server.status = ServerStatus::Disconnected;
        server.client.take()
    };

    if let Some(client) = client {
        let client = client.lock().await;
        client.shutdown().await.map_err(|e| e.to_string())?;
    }

    // Emit disconnected event
    let _ = app.emit(
        "mcp:status",
        serde_json::json!({
            "serverId": server_id,
            "status": "disconnected"
        }),
    );

    info!("Disconnected from context server: {}", server_id);
    Ok(())
}

// =====================
// Resource Operations
// =====================

/// List resources from a context server
#[tauri::command]
pub async fn mcp_list_resources(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<Resource>, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .list_resources()
        .await
        .map_err(|e| format!("Failed to list resources: {}", e))?;

    Ok(response.resources)
}

/// Read a resource from a context server
#[tauri::command]
pub async fn mcp_read_resource(
    server_id: String,
    uri: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<ResourceContents>, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .read_resource(&uri)
        .await
        .map_err(|e| format!("Failed to read resource: {}", e))?;

    Ok(response.contents)
}

/// List resource templates from a context server
#[tauri::command]
pub async fn mcp_list_resource_templates(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<ResourceTemplate>, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .list_resource_templates()
        .await
        .map_err(|e| format!("Failed to list resource templates: {}", e))?;

    Ok(response.resource_templates)
}

// =====================
// Tool Operations
// =====================

/// List tools from a context server
#[tauri::command]
pub async fn mcp_list_tools(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<Tool>, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .list_tools()
        .await
        .map_err(|e| format!("Failed to list tools: {}", e))?;

    Ok(response.tools)
}

/// Call a tool on a context server
#[tauri::command]
pub async fn mcp_call_tool(
    server_id: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<CallToolResponse, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .call_tool(&tool_name, arguments)
        .await
        .map_err(|e| format!("Failed to call tool: {}", e))?;

    Ok(response)
}

// =====================
// Prompt Operations
// =====================

/// List prompts from a context server
#[tauri::command]
pub async fn mcp_list_prompts(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<Prompt>, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .list_prompts()
        .await
        .map_err(|e| format!("Failed to list prompts: {}", e))?;

    Ok(response.prompts)
}

/// Get a prompt from a context server
#[tauri::command]
pub async fn mcp_get_prompt(
    server_id: String,
    prompt_name: String,
    arguments: Option<HashMap<String, String>>,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<PromptsGetResponse, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    let response = client
        .get_prompt(&prompt_name, arguments)
        .await
        .map_err(|e| format!("Failed to get prompt: {}", e))?;

    Ok(response)
}

// =====================
// Context Aggregation
// =====================

/// Query context from multiple servers and aggregate results
#[tauri::command]
pub async fn mcp_query_context(
    server_ids: Vec<String>,
    query: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<Vec<ResourceContents>, String> {
    let mut all_contents = Vec::new();

    for server_id in server_ids {
        let client = match get_client(&server_id, &state).await {
            Ok(c) => c,
            Err(_) => continue, // Skip disconnected servers
        };

        let client = client.lock().await;

        // List resources and find relevant ones based on query
        if let Ok(response) = client.list_resources().await {
            for resource in response.resources {
                // Simple relevance check - could be enhanced with embeddings
                let is_relevant = resource.name.to_lowercase().contains(&query.to_lowercase())
                    || resource
                        .description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&query.to_lowercase()))
                        .unwrap_or(false);

                if is_relevant {
                    if let Ok(read_response) = client.read_resource(&resource.uri).await {
                        all_contents.extend(read_response.contents);
                    }
                }
            }
        }
    }

    Ok(all_contents)
}

/// Get all available context for AI prompt inclusion
#[tauri::command]
pub async fn mcp_get_context_for_prompt(
    server_ids: Vec<String>,
    max_tokens: Option<usize>,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<String, String> {
    let max_tokens = max_tokens.unwrap_or(4000);
    let mut context_parts = Vec::new();
    let mut total_len = 0;

    for server_id in server_ids {
        let client = match get_client(&server_id, &state).await {
            Ok(c) => c,
            Err(_) => continue,
        };

        let client = client.lock().await;

        // Get resources
        if let Ok(response) = client.list_resources().await {
            for resource in response.resources {
                if let Ok(read_response) = client.read_resource(&resource.uri).await {
                    for content in read_response.contents {
                        if let Some(text) = &content.text {
                            // Estimate tokens (rough approximation: 4 chars per token)
                            let estimated_tokens = text.len() / 4;
                            if total_len + estimated_tokens > max_tokens {
                                break;
                            }

                            context_parts.push(format!(
                                "--- {} ({}) ---\n{}",
                                resource.name, content.uri, text
                            ));
                            total_len += estimated_tokens;
                        }
                    }
                }
            }
        }
    }

    Ok(context_parts.join("\n\n"))
}

// =====================
// Utility Operations
// =====================

/// Ping a context server
#[tauri::command]
pub async fn mcp_ping(
    server_id: String,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<bool, String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    match client.ping().await {
        Ok(_) => Ok(true),
        Err(e) => {
            error!("Ping failed for server {}: {}", server_id, e);
            Ok(false)
        }
    }
}

/// Set logging level on a context server
#[tauri::command]
pub async fn mcp_set_log_level(
    server_id: String,
    level: LoggingLevel,
    state: State<'_, LazyState<ContextServerState>>,
) -> Result<(), String> {
    let client = get_client(&server_id, &state).await?;
    let client = client.lock().await;

    client
        .set_logging_level(level)
        .await
        .map_err(|e| format!("Failed to set log level: {}", e))
}

// =====================
// Helper Functions
// =====================

async fn get_client(
    server_id: &str,
    state: &State<'_, LazyState<ContextServerState>>,
) -> Result<Arc<TokioMutex<McpClient>>, String> {
    let manager = state.get().0.lock().await;
    let server = manager
        .get_server(server_id)
        .ok_or_else(|| format!("Server not found: {}", server_id))?;

    server
        .client
        .clone()
        .ok_or_else(|| format!("Server not connected: {}", server_id))
}
