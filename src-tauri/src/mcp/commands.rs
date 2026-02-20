//! MCP Tauri Commands
//!
//! Exposes MCP functionality to the frontend via Tauri commands.

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use super::McpState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub socket_type: String,
    pub socket_path: Option<String>,
}

/// Get MCP server status
#[tauri::command]
pub async fn mcp_get_status<R: Runtime>(app: AppHandle<R>) -> Result<McpStatus, String> {
    let state = app.state::<McpState<R>>();

    let (socket_type, socket_path) = match &state.config.socket_type {
        super::SocketType::Ipc { path } => {
            let p = path.clone().unwrap_or_else(super::get_default_socket_path);
            ("ipc".to_string(), Some(p.to_string_lossy().to_string()))
        }
        super::SocketType::Tcp { host, port } => {
            ("tcp".to_string(), Some(format!("{}:{}", host, port)))
        }
    };

    Ok(McpStatus {
        running: state.is_running(),
        socket_type,
        socket_path,
    })
}

/// Start the MCP server
#[tauri::command]
pub async fn mcp_start<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<McpState<R>>();
    state.start(&app)
}

/// Stop the MCP server
#[tauri::command]
pub async fn mcp_stop<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<McpState<R>>();
    state.stop()
}

/// Get MCP configuration info for AI agents
#[tauri::command]
pub async fn mcp_get_config<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
    let state = app.state::<McpState<R>>();

    let (connection_type, connection_info) = match &state.config.socket_type {
        super::SocketType::Ipc { path } => {
            let p = path.clone().unwrap_or_else(super::get_default_socket_path);
            (
                "ipc",
                serde_json::json!({
                    "path": p.to_string_lossy().to_string()
                }),
            )
        }
        super::SocketType::Tcp { host, port } => (
            "tcp",
            serde_json::json!({
                "host": host,
                "port": port
            }),
        ),
    };

    Ok(serde_json::json!({
        "applicationName": state.config.application_name,
        "connectionType": connection_type,
        "connectionInfo": connection_info,
        "running": state.is_running(),
        "tools": [
            "ping",
            "takeScreenshot",
            "getDom",
            "executeJs",
            "manageWindow",
            "textInput",
            "mouseMovement",
            "manageLocalStorage",
            "getElementPosition",
            "sendTextToElement",
            "listWindows"
        ]
    }))
}
