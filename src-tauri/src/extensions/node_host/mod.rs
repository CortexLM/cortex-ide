//! Node.js-based VS Code-compatible extension host.
//!
//! Runs as a sidecar process communicating with Rust via JSON-RPC over
//! stdin/stdout.  This is independent of the existing WASM extension system
//! in `extensions::wasm`.
//!
//! ## Modules
//!
//! - [`process`] – Child process lifecycle (spawn, stdin/stdout IO, kill).
//! - [`protocol`] – JSON-RPC message types and pending-request tracking.
//! - [`api_shim`] – Translates VS Code API calls into Tauri IPC events.
//! - [`manifest`] – VS Code `package.json` parser with activation events
//!   and contributes sections.
//! - [`commands`] – Tauri IPC commands: `start_extension_host`,
//!   `install_vscode_extension`, `activate_extension`, `call_extension_api`.

pub mod api_shim;
pub mod commands;
pub mod manifest;
pub mod process;
pub mod protocol;

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;
use tracing::info;

use process::NodeHostProcess;
use protocol::JsonRpcRequest;

// ============================================================================
// State
// ============================================================================

#[derive(Clone)]
pub struct NodeHostState(pub Arc<Mutex<Option<NodeHostProcess>>>);

impl NodeHostState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

impl Default for NodeHostState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Installed extension metadata
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledNodeExtension {
    pub id: String,
    pub name: String,
    pub version: String,
    pub path: String,
}

// ============================================================================
// Existing Tauri commands (backward-compatible)
// ============================================================================

#[tauri::command]
pub async fn extension_host_start(app: AppHandle) -> Result<(), String> {
    let state = app.state::<NodeHostState>();
    let mut guard = state.0.lock().await;

    if guard.is_some() {
        return Err("Extension host is already running".to_string());
    }

    let process = NodeHostProcess::start(app.clone()).await?;

    let init_req = JsonRpcRequest::new(
        "initialize",
        Some(serde_json::json!({
            "capabilities": api_shim::get_supported_api_surface(),
        })),
    );
    let msg = serde_json::to_string(&init_req)
        .map_err(|e| format!("Failed to serialize init request: {}", e))?;
    process.send(&msg).await?;

    *guard = Some(process);
    info!("Extension host started and initialized");
    Ok(())
}

#[tauri::command]
pub async fn extension_host_stop(app: AppHandle) -> Result<(), String> {
    let state = app.state::<NodeHostState>();
    let mut guard = state.0.lock().await;

    match guard.take() {
        Some(process) => {
            let shutdown_req = JsonRpcRequest::new("shutdown", None);
            let msg = serde_json::to_string(&shutdown_req)
                .map_err(|e| format!("Failed to serialize shutdown request: {}", e))?;
            let _ = process.send(&msg).await;

            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let _ = process.stop().await;
            info!("Extension host stopped");
            Ok(())
        }
        None => Err("Extension host is not running".to_string()),
    }
}

#[tauri::command]
pub async fn extension_host_install_vsix(
    app: AppHandle,
    vsix_path: String,
) -> Result<InstalledNodeExtension, String> {
    let extensions_dir = node_extensions_dir();

    std::fs::create_dir_all(&extensions_dir)
        .map_err(|e| format!("Failed to create node-extensions directory: {}", e))?;

    let vsix_file = std::path::Path::new(&vsix_path);
    if !vsix_file.exists() {
        return Err(format!("VSIX file not found: {}", vsix_path));
    }

    let temp_dir = extensions_dir.join(".tmp-vsix-extract");
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to clean temp dir: {}", e))?;
    }

    crate::extensions::utils::extract_zip_package(vsix_file, &temp_dir)?;

    let ext_root = find_vsix_extension_root(&temp_dir)?;

    let pkg_path = ext_root.join("package.json");
    if !pkg_path.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("No package.json found in VSIX package".to_string());
    }

    let pkg_content = std::fs::read_to_string(&pkg_path)
        .map_err(|e| format!("Failed to read package.json: {}", e))?;
    let pkg: serde_json::Value = serde_json::from_str(&pkg_content)
        .map_err(|e| format!("Failed to parse package.json: {}", e))?;

    let ext_name = pkg["name"].as_str().unwrap_or("unknown").to_string();
    let ext_version = pkg["version"].as_str().unwrap_or("0.0.0").to_string();
    let ext_id = format!(
        "{}.{}",
        pkg["publisher"].as_str().unwrap_or("unknown"),
        &ext_name
    );

    let target_dir = extensions_dir.join(&ext_id);
    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir)
            .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
    }

    std::fs::rename(&ext_root, &target_dir).or_else(|_| {
        crate::extensions::utils::copy_dir_recursive(&ext_root, &target_dir)
            .map_err(|e| format!("Failed to copy extension: {}", e))
    })?;

    let _ = std::fs::remove_dir_all(&temp_dir);

    let state = app.state::<NodeHostState>();
    let guard = state.0.lock().await;
    if let Some(process) = guard.as_ref() {
        let req = JsonRpcRequest::new(
            "installExtension",
            Some(serde_json::json!({
                "extensionId": ext_id,
                "extensionPath": target_dir.to_string_lossy(),
            })),
        );
        let msg = serde_json::to_string(&req)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;
        process.send(&msg).await?;
    }

    info!("Installed VSIX extension: {} v{}", ext_id, ext_version);

    Ok(InstalledNodeExtension {
        id: ext_id,
        name: ext_name,
        version: ext_version,
        path: target_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn extension_host_list_installed() -> Result<Vec<InstalledNodeExtension>, String> {
    let extensions_dir = node_extensions_dir();

    if !extensions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();

    let entries = std::fs::read_dir(&extensions_dir)
        .map_err(|e| format!("Failed to read node-extensions directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir()
            || path
                .file_name()
                .map(|n| n.to_string_lossy().starts_with('.'))
                .unwrap_or(true)
        {
            continue;
        }

        let pkg_path = path.join("package.json");
        if !pkg_path.exists() {
            continue;
        }

        if let Ok(content) = std::fs::read_to_string(&pkg_path) {
            if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                let name = pkg["name"].as_str().unwrap_or("unknown").to_string();
                let version = pkg["version"].as_str().unwrap_or("0.0.0").to_string();
                let id = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| name.clone());

                result.push(InstalledNodeExtension {
                    id,
                    name,
                    version,
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn extension_host_send_message(
    app: AppHandle,
    method: String,
    params: Option<serde_json::Value>,
) -> Result<(), String> {
    let state = app.state::<NodeHostState>();
    let guard = state.0.lock().await;

    match guard.as_ref() {
        Some(process) => {
            let req = JsonRpcRequest::new(&method, params);
            let msg = serde_json::to_string(&req)
                .map_err(|e| format!("Failed to serialize message: {}", e))?;
            process.send(&msg).await
        }
        None => Err("Extension host is not running".to_string()),
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn node_extensions_dir() -> std::path::PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".cortex")
        .join("node-extensions")
}

fn find_vsix_extension_root(dir: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let extension_subdir = dir.join("extension");
    if extension_subdir.is_dir() && extension_subdir.join("package.json").exists() {
        return Ok(extension_subdir);
    }

    if dir.join("package.json").exists() {
        return Ok(dir.to_path_buf());
    }

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("package.json").exists() {
                return Ok(path);
            }
        }
    }

    Err("Could not find package.json in VSIX package".to_string())
}
