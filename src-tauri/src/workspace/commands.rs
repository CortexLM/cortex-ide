//! Tauri commands for workspace management.
//!
//! Provides commands for opening, saving, and managing workspace folders.

use std::path::Path;

use tauri::{AppHandle, Manager};
use tracing::{error, info};

use super::manager::WorkspaceManagerState;
use super::types::{WorkspaceConfig, WorkspaceFolder};

#[tauri::command]
pub async fn open_workspace(app: AppHandle, path: String) -> Result<WorkspaceConfig, String> {
    let state = app.state::<WorkspaceManagerState>();
    let ws_path = Path::new(&path);

    if !ws_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if ws_path.is_file()
        && ws_path
            .extension()
            .is_some_and(|ext| ext == "code-workspace")
    {
        let raw = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read workspace file '{}': {}", path, e))?;

        let config = {
            let manager = state
                .0
                .lock()
                .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
            manager.parse_code_workspace(&raw)?
        };

        {
            let mut manager = state
                .0
                .lock()
                .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
            manager.load_parsed(config.clone(), Some(ws_path.to_path_buf()));
        }

        info!(
            "[Workspace] Opened code-workspace: {} ({} folders)",
            path,
            config.folders.len()
        );
        Ok(config)
    } else if ws_path.is_dir() {
        let folder_name = ws_path.file_name().map(|n| n.to_string_lossy().to_string());

        let config = WorkspaceConfig {
            folders: vec![WorkspaceFolder {
                uri: path.clone(),
                name: folder_name,
                index: 0,
            }],
            settings: serde_json::Value::Object(Default::default()),
            launch: None,
            extensions: None,
        };

        {
            let mut manager = state
                .0
                .lock()
                .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
            manager.load_parsed(config.clone(), None);
        }

        info!("[Workspace] Opened folder workspace: {}", path);
        Ok(config)
    } else {
        Err(format!(
            "Path is not a directory or .code-workspace file: {}",
            path
        ))
    }
}

#[tauri::command]
pub async fn save_workspace(app: AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<WorkspaceManagerState>();
    let ws_path = Path::new(&path);

    let config = {
        let manager = state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
        WorkspaceConfig {
            folders: manager.get_folders(),
            settings: manager.get_settings(),
            launch: manager.get_launch(),
            extensions: None,
        }
    };

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize workspace config: {}", e))?;

    if let Some(parent) = ws_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    let tmp_path = format!("{}.tmp", path);
    tokio::fs::write(&tmp_path, &content)
        .await
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;

    tokio::fs::rename(&tmp_path, &path)
        .await
        .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

    info!("[Workspace] Saved workspace to {}", path);
    Ok(())
}

#[tauri::command]
pub async fn add_workspace_folder(
    app: AppHandle,
    folder_path: String,
    name: Option<String>,
) -> Result<Vec<WorkspaceFolder>, String> {
    let state = app.state::<WorkspaceManagerState>();

    let canonical = tokio::fs::canonicalize(&folder_path)
        .await
        .map_err(|e| format!("Failed to resolve folder path '{}': {}", folder_path, e))?;
    let uri = canonical.to_string_lossy().to_string();

    if !canonical.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    let folders = {
        let mut manager = state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
        manager.add_folder(uri, name);
        manager.get_folders()
    };

    info!("[Workspace] Added folder, total: {} folders", folders.len());
    Ok(folders)
}

#[tauri::command]
pub async fn remove_workspace_folder(
    app: AppHandle,
    folder_path: String,
) -> Result<Vec<WorkspaceFolder>, String> {
    let state = app.state::<WorkspaceManagerState>();

    let folders = {
        let mut manager = state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
        let removed = manager.remove_folder(&folder_path);
        if !removed {
            error!("[Workspace] Folder not found for removal: {}", folder_path);
        }
        manager.get_folders()
    };

    Ok(folders)
}

#[tauri::command]
pub async fn get_workspace_folders(app: AppHandle) -> Result<Vec<WorkspaceFolder>, String> {
    let state = app.state::<WorkspaceManagerState>();

    let folders = {
        let manager = state
            .0
            .lock()
            .map_err(|e| format!("Failed to acquire workspace lock: {}", e))?;
        manager.get_folders()
    };

    Ok(folders)
}
