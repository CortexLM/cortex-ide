//! System-level commands: server management, logging, notifications, version info

use std::collections::VecDeque;
use std::net::TcpListener;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;

const _MAX_LOG_ENTRIES: usize = 500;

#[derive(Clone)]
pub struct ServerState(pub Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>);

#[derive(Clone)]
pub struct LogState(pub Arc<Mutex<VecDeque<String>>>);

#[derive(Clone)]
pub struct PortState(pub Arc<Mutex<u32>>);

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub port: u32,
    pub url: String,
    pub running: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CortexConfig {
    pub model: String,
    pub provider: String,
    pub sandbox_mode: String,
    pub approval_mode: String,
}

pub fn find_free_port() -> Result<u32, String> {
    if TcpListener::bind("127.0.0.1:4096").is_ok() {
        return Ok(4096);
    }

    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port() as u32)
        .map_err(|e| format!("Failed to find free port: {}", e))
}

#[tauri::command]
pub async fn start_server(_app: AppHandle) -> Result<ServerInfo, String> {
    Ok(ServerInfo {
        port: 4096,
        url: "http://127.0.0.1:4096".to_string(),
        running: true,
    })
}

#[tauri::command]
pub async fn stop_server(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn get_server_info(_app: AppHandle) -> Result<ServerInfo, String> {
    Ok(ServerInfo {
        port: 4096,
        url: "http://127.0.0.1:4096".to_string(),
        running: true,
    })
}

#[tauri::command]
pub async fn get_logs(app: AppHandle) -> Result<String, String> {
    let log_state = app.state::<LogState>();

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;

    Ok(logs.iter().cloned().collect::<Vec<_>>().join(""))
}

#[tauri::command]
pub async fn copy_logs_to_clipboard(app: AppHandle) -> Result<(), String> {
    let log_state = app.state::<LogState>();

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;

    let log_text = logs.iter().cloned().collect::<Vec<_>>().join("");

    app.clipboard()
        .write_text(log_text)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

#[tauri::command]
pub async fn show_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))
}
