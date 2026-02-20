//! Workspace API for extension plugins.
//!
//! Provides Tauri IPC commands for reading configuration, opening documents,
//! saving files, applying workspace edits, searching files, and creating
//! file system watchers.

use std::path::Path;
use std::sync::Arc;

use tokio::fs as tokio_fs;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::info;
use uuid::Uuid;

use crate::extensions::permissions::PermissionsState;
use crate::extensions::plugin_api::PluginApiState;

// ============================================================================
// Types
// ============================================================================

/// A single text edit operation within a workspace edit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub path: String,
    pub content: String,
}

/// Payload emitted when a plugin requests a document to be opened.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenDocumentPayload {
    pub extension_id: String,
    pub path: String,
}

/// Payload emitted when a plugin requests all documents to be saved.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveAllPayload {
    pub extension_id: String,
}

/// Metadata for a file system watcher registered by a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatcherInfo {
    pub watcher_id: String,
    pub extension_id: String,
    pub glob_pattern: String,
}

/// Metadata for a configuration change subscription registered by a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigChangeSubscription {
    pub subscription_id: String,
    pub extension_id: String,
    pub section: String,
}

/// File metadata returned by stat operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStat {
    pub size: u64,
    pub modified_at: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for workspace-related plugin API resources.
#[derive(Clone)]
pub struct WorkspaceApiState {
    pub file_watchers: Arc<DashMap<String, FileWatcherInfo>>,
    pub config_subscriptions: Arc<DashMap<String, ConfigChangeSubscription>>,
}

impl Default for WorkspaceApiState {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkspaceApiState {
    pub fn new() -> Self {
        Self {
            file_watchers: Arc::new(DashMap::new()),
            config_subscriptions: Arc::new(DashMap::new()),
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Read a configuration value by dot-separated key from the workspace config.
#[tauri::command]
pub async fn plugin_get_configuration(
    app: AppHandle,
    _extension_id: String,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let state = app.state::<PluginApiState>();
    Ok(state.get_configuration(&key))
}

/// Request the frontend to open a text document.
///
/// Emits `plugin:open-document` so the editor can navigate to the file.
/// The path is validated against workspace roots via the permissions system.
#[tauri::command]
pub async fn plugin_open_text_document(
    app: AppHandle,
    extension_id: String,
    path: String,
) -> Result<(), String> {
    let perms = app.state::<PermissionsState>();
    perms
        .0
        .check_file_access(&extension_id, Path::new(&path), false)?;

    let payload = OpenDocumentPayload {
        extension_id: extension_id.clone(),
        path: path.clone(),
    };

    app.emit("plugin:open-document", &payload)
        .map_err(|e| format!("Failed to emit open-document event: {}", e))?;

    info!(
        extension_id = %extension_id,
        path = %path,
        "Open document requested"
    );

    Ok(())
}

/// Request the frontend to save all open documents.
///
/// Emits `plugin:save-all` so the editor can persist unsaved changes.
#[tauri::command]
pub async fn plugin_save_all(app: AppHandle, extension_id: String) -> Result<(), String> {
    let payload = SaveAllPayload {
        extension_id: extension_id.clone(),
    };

    app.emit("plugin:save-all", &payload)
        .map_err(|e| format!("Failed to emit save-all event: {}", e))?;

    info!(extension_id = %extension_id, "Save all requested");

    Ok(())
}

/// Apply a workspace edit consisting of one or more file writes.
///
/// Each path is validated against the workspace roots to prevent writes
/// outside the allowed scope.
#[tauri::command]
pub async fn plugin_apply_edit(
    app: AppHandle,
    extension_id: String,
    edits: Vec<TextEdit>,
) -> Result<(), String> {
    let perms = app.state::<PermissionsState>();

    for edit in &edits {
        perms
            .0
            .check_file_access(&extension_id, Path::new(&edit.path), true)?;
    }

    for edit in &edits {
        let path = Path::new(&edit.path);

        if let Some(parent) = path.parent() {
            tokio_fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }

        tokio_fs::write(path, &edit.content)
            .await
            .map_err(|e| format!("Failed to write {}: {}", edit.path, e))?;
    }

    info!(
        extension_id = %extension_id,
        count = edits.len(),
        "Workspace edits applied"
    );

    Ok(())
}

/// Find files within the workspace matching a glob pattern.
///
/// Returns paths relative to the workspace root. All matched paths are
/// validated to stay within the workspace boundary.
#[tauri::command]
pub async fn plugin_find_files(
    app: AppHandle,
    extension_id: String,
    glob_pattern: String,
    workspace_root: String,
) -> Result<Vec<String>, String> {
    let perms = app.state::<PermissionsState>();
    perms
        .0
        .check_file_access(&extension_id, Path::new(&workspace_root), false)?;

    let api_state = app.state::<PluginApiState>();
    api_state.list_workspace_files(&workspace_root, &glob_pattern)
}

/// Create a file system watcher for a glob pattern.
///
/// Returns a `watcher_id` that the extension can use to identify events.
/// The frontend is notified via `plugin:file-watcher-created`.
#[tauri::command]
pub async fn plugin_create_file_watcher(
    app: AppHandle,
    extension_id: String,
    glob_pattern: String,
) -> Result<String, String> {
    let state = app.state::<WorkspaceApiState>();
    let watcher_id = Uuid::new_v4().to_string();

    let watcher = FileWatcherInfo {
        watcher_id: watcher_id.clone(),
        extension_id: extension_id.clone(),
        glob_pattern: glob_pattern.clone(),
    };

    state
        .file_watchers
        .insert(watcher_id.clone(), watcher.clone());

    app.emit("plugin:file-watcher-created", &watcher)
        .map_err(|e| format!("Failed to emit file-watcher-created event: {}", e))?;

    info!(
        extension_id = %extension_id,
        watcher_id = %watcher_id,
        pattern = %glob_pattern,
        "File watcher created"
    );

    Ok(watcher_id)
}

/// Subscribe to configuration changes for a specific section.
///
/// Returns a `subscription_id`. The frontend is notified via
/// `plugin:config-change-subscribed` so it can route future config
/// change events back to the extension.
#[tauri::command]
pub async fn plugin_on_config_change(
    app: AppHandle,
    extension_id: String,
    section: String,
) -> Result<String, String> {
    let state = app.state::<WorkspaceApiState>();
    let subscription_id = Uuid::new_v4().to_string();

    let subscription = ConfigChangeSubscription {
        subscription_id: subscription_id.clone(),
        extension_id: extension_id.clone(),
        section: section.clone(),
    };

    state
        .config_subscriptions
        .insert(subscription_id.clone(), subscription.clone());

    app.emit("plugin:config-change-subscribed", &subscription)
        .map_err(|e| format!("Failed to emit config-change-subscribed event: {}", e))?;

    info!(
        extension_id = %extension_id,
        subscription_id = %subscription_id,
        section = %section,
        "Config change subscription created"
    );

    Ok(subscription_id)
}

/// Get file metadata (size, modification time, type).
///
/// The path is validated against the workspace roots via the permissions system.
#[tauri::command]
pub async fn plugin_stat_file(
    app: AppHandle,
    extension_id: String,
    path: String,
) -> Result<FileStat, String> {
    let perms = app.state::<PermissionsState>();
    perms
        .0
        .check_file_access(&extension_id, Path::new(&path), false)?;

    let metadata = tokio_fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to stat file: {}", e))?;

    let modified_at = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        })
        .unwrap_or(0);

    Ok(FileStat {
        size: metadata.len(),
        modified_at,
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        is_symlink: metadata.is_symlink(),
    })
}

/// Read a file's contents with permission checking.
///
/// Returns the file content as a string. The path is validated against
/// workspace roots via the permissions system.
#[tauri::command]
pub async fn plugin_read_file(
    app: AppHandle,
    extension_id: String,
    path: String,
) -> Result<String, String> {
    let perms = app.state::<PermissionsState>();
    perms
        .0
        .check_file_access(&extension_id, Path::new(&path), false)?;

    tokio_fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file with permission checking.
///
/// Parent directories are created automatically. The path is validated
/// against workspace roots via the permissions system.
#[tauri::command]
pub async fn plugin_write_file(
    app: AppHandle,
    extension_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let perms = app.state::<PermissionsState>();
    perms
        .0
        .check_file_access(&extension_id, Path::new(&path), true)?;

    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        tokio_fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }

    tokio_fs::write(&path, &content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}
