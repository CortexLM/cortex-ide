//! Workspace operations for Cortex Desktop
//!
//! This module provides cross-folder file operations, workspace trust management,
//! and aggregated git status across multi-root workspaces.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, command};
use tracing::{error, info, warn};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustCheckResult {
    pub is_trusted: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderGitStatus {
    pub folder: String,
    pub branch: String,
    pub staged_count: u32,
    pub unstaged_count: u32,
    pub has_conflicts: bool,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct TrustedWorkspaces {
    paths: Vec<String>,
}

// ============================================================================
// Helpers
// ============================================================================

fn validate_path_in_roots(path: &str, workspace_roots: &[String]) -> Result<(), String> {
    let canonical =
        fs::canonicalize(path).map_err(|e| format!("Failed to resolve path '{}': {}", path, e))?;
    for root in workspace_roots {
        if let Ok(root_canonical) = fs::canonicalize(root) {
            if canonical.starts_with(&root_canonical) {
                return Ok(());
            }
        }
    }
    Err(format!("Path '{}' is not within any workspace root", path))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory {:?}: {}", dst, e))?;

    let entries =
        fs::read_dir(src).map_err(|e| format!("Failed to read directory {:?}: {}", src, e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy {:?} to {:?}: {}", src_path, dst_path, e))?;
        }
    }

    Ok(())
}

fn remove_dir_all_safe(path: &Path) -> Result<(), String> {
    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove {:?}: {}", path, e))
}

fn trust_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Cortex-desktop")
    });
    Ok(app_data_dir.join("trusted_workspaces.json"))
}

async fn read_trusted_workspaces(path: &Path) -> TrustedWorkspaces {
    match tokio::fs::read_to_string(path).await {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => TrustedWorkspaces::default(),
    }
}

async fn write_trusted_workspaces(path: &Path, data: &TrustedWorkspaces) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize trusted workspaces: {}", e))?;
    tokio::fs::write(path, content)
        .await
        .map_err(|e| format!("Failed to write trusted workspaces: {}", e))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[command]
pub async fn workspace_cross_folder_copy(
    source: String,
    destination: String,
    workspace_roots: Vec<String>,
) -> Result<(), String> {
    validate_path_in_roots(&source, &workspace_roots)?;

    let dest_parent = Path::new(&destination)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| destination.clone());
    validate_path_in_roots(&dest_parent, &workspace_roots)?;

    tokio::task::spawn_blocking(move || {
        let src = Path::new(&source);
        let dst = Path::new(&destination);

        if !src.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        if src.is_dir() {
            copy_dir_recursive(src, dst)?;
            info!("[Workspace] Copied directory {} -> {}", source, destination);
        } else {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            fs::copy(src, dst)
                .map_err(|e| format!("Failed to copy {} to {}: {}", source, destination, e))?;
            info!("[Workspace] Copied file {} -> {}", source, destination);
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn workspace_cross_folder_move(
    source: String,
    destination: String,
    workspace_roots: Vec<String>,
) -> Result<(), String> {
    validate_path_in_roots(&source, &workspace_roots)?;

    let dest_parent = Path::new(&destination)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| destination.clone());
    validate_path_in_roots(&dest_parent, &workspace_roots)?;

    tokio::task::spawn_blocking(move || {
        let src = Path::new(&source);
        let dst = Path::new(&destination);

        if !src.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        match fs::rename(src, dst) {
            Ok(()) => {
                info!("[Workspace] Moved {} -> {}", source, destination);
                Ok(())
            }
            Err(rename_err) => {
                warn!(
                    "[Workspace] Rename failed ({}), falling back to copy+delete",
                    rename_err
                );
                if src.is_dir() {
                    copy_dir_recursive(src, dst)?;
                    remove_dir_all_safe(src)?;
                } else {
                    fs::copy(src, dst).map_err(|e| {
                        format!("Failed to copy {} to {}: {}", source, destination, e)
                    })?;
                    fs::remove_file(src)
                        .map_err(|e| format!("Failed to remove source file {}: {}", source, e))?;
                }
                info!(
                    "[Workspace] Moved (via copy+delete) {} -> {}",
                    source, destination
                );
                Ok(())
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn workspace_trust_check(
    workspace_path: String,
    app: AppHandle,
) -> Result<TrustCheckResult, String> {
    let trust_path = trust_file_path(&app)?;
    let trusted = read_trusted_workspaces(&trust_path).await;
    let is_trusted = trusted.paths.iter().any(|p| p == &workspace_path);

    Ok(TrustCheckResult {
        is_trusted,
        path: workspace_path,
    })
}

#[command]
pub async fn workspace_trust_set(
    workspace_path: String,
    trusted: bool,
    app: AppHandle,
) -> Result<(), String> {
    let trust_path = trust_file_path(&app)?;
    let mut data = read_trusted_workspaces(&trust_path).await;

    if trusted {
        if !data.paths.contains(&workspace_path) {
            data.paths.push(workspace_path.clone());
            info!("[Workspace] Trusted workspace: {}", workspace_path);
        }
    } else {
        let before = data.paths.len();
        data.paths.retain(|p| p != &workspace_path);
        if data.paths.len() < before {
            info!("[Workspace] Untrusted workspace: {}", workspace_path);
        }
    }

    write_trusted_workspaces(&trust_path, &data).await
}

#[command]
pub async fn workspace_aggregate_git_status(
    workspace_roots: Vec<String>,
) -> Result<Vec<FolderGitStatus>, String> {
    tokio::task::spawn_blocking(move || {
        let mut results = Vec::with_capacity(workspace_roots.len());

        for root in &workspace_roots {
            match crate::git::status::git_status_sync(root) {
                Ok(status) => {
                    results.push(FolderGitStatus {
                        folder: root.clone(),
                        branch: status.branch,
                        staged_count: status.staged.len() as u32,
                        unstaged_count: status.unstaged.len() as u32,
                        has_conflicts: !status.conflicts.is_empty(),
                        ahead: status.ahead,
                        behind: status.behind,
                    });
                }
                Err(e) => {
                    error!("[Workspace] Failed to get git status for {}: {}", root, e);
                }
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ============================================================================
// Workspace File & State Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFolderEntry {
    pub path: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileData {
    pub folders: Vec<WorkspaceFolderEntry>,
    pub settings: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrollPosition {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorStateEntry {
    pub uri: String,
    pub view_column: u32,
    pub is_pinned: bool,
    pub is_preview: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStateData {
    pub open_editors: Vec<EditorStateEntry>,
    pub active_editor: Option<String>,
    pub layout: Option<serde_json::Value>,
    pub scroll_positions: HashMap<String, ScrollPosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspaceEntry {
    #[serde(default)]
    pub id: String,
    pub path: String,
    pub name: String,
    pub last_opened: u64,
    pub is_workspace_file: bool,
    pub folder_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspacesData {
    pub entries: Vec<RecentWorkspaceEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RecentWorkspacesList {
    entries: Vec<RecentWorkspaceEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeWorkspaceFolder {
    pub path: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeWorkspaceFile {
    pub folders: Vec<CodeWorkspaceFolder>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeWorkspaceImport {
    pub folders: Vec<CodeWorkspaceFolderEntry>,
    pub settings: serde_json::Value,
    pub extensions: serde_json::Value,
    pub launch: serde_json::Value,
    pub tasks: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeWorkspaceFolderEntry {
    pub path: String,
    pub name: Option<String>,
    pub resolved_path: String,
}

// ============================================================================
// Workspace File & State Helpers
// ============================================================================

const MAX_RECENT_WORKSPACES: usize = 20;

fn workspace_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Cortex-desktop")
    });
    Ok(app_data_dir.join("workspaces"))
}

fn recent_workspaces_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Cortex-desktop")
    });
    Ok(app_data_dir.join("recent_workspaces.json"))
}

pub fn strip_jsonc_comments(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escape_next = false;

    while let Some(&ch) = chars.peek() {
        if escape_next {
            result.push(ch);
            chars.next();
            escape_next = false;
            continue;
        }

        if in_string {
            if ch == '\\' {
                escape_next = true;
                result.push(ch);
                chars.next();
            } else if ch == '"' {
                in_string = false;
                result.push(ch);
                chars.next();
            } else {
                result.push(ch);
                chars.next();
            }
            continue;
        }

        if ch == '"' {
            in_string = true;
            result.push(ch);
            chars.next();
            continue;
        }

        if ch == '/' {
            chars.next();
            match chars.peek() {
                Some(&'/') => {
                    chars.next();
                    while let Some(&c) = chars.peek() {
                        chars.next();
                        if c == '\n' {
                            result.push('\n');
                            break;
                        }
                    }
                }
                Some(&'*') => {
                    chars.next();
                    let mut found_end = false;
                    while let Some(&c) = chars.peek() {
                        chars.next();
                        if c == '*' {
                            if let Some(&'/') = chars.peek() {
                                chars.next();
                                found_end = true;
                                break;
                            }
                        }
                    }
                    if !found_end {
                        break;
                    }
                }
                _ => {
                    result.push('/');
                }
            }
            continue;
        }

        result.push(ch);
        chars.next();
    }

    result
}

// ============================================================================
// Workspace File & State Commands
// ============================================================================

#[command]
pub async fn save_workspace_file(file_path: String, data: WorkspaceFileData) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize workspace file: {}", e))?;

    let target = Path::new(&file_path);
    let tmp_path = PathBuf::from(format!("{}.tmp", file_path));

    if let Some(parent) = target.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    tokio::fs::write(&tmp_path, &content)
        .await
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;

    tokio::fs::rename(&tmp_path, target)
        .await
        .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

    info!("[Workspace] Saved workspace file: {}", file_path);
    Ok(())
}

#[command]
pub async fn workspace_save_file(file_path: String, data: WorkspaceFileData) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            format!(
                "Failed to create parent directories for '{}': {}",
                file_path, e
            )
        })?;
    }
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize workspace data: {}", e))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write workspace file '{}': {}", file_path, e))?;
    info!("[Workspace] Saved workspace file: {}", file_path);
    Ok(())
}

#[command]
pub async fn load_workspace_file(file_path: String) -> Result<WorkspaceFileData, String> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read workspace file '{}': {}", file_path, e))?;

    let data: WorkspaceFileData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace file '{}': {}", file_path, e))?;

    info!("[Workspace] Loaded workspace file: {}", file_path);
    Ok(data)
}

#[command]
pub async fn workspace_load_file(file_path: String) -> Result<WorkspaceFileData, String> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read workspace file '{}': {}", file_path, e))?;
    let data: WorkspaceFileData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace file '{}': {}", file_path, e))?;
    info!(
        "[Workspace] Loaded workspace file: {} ({} folders)",
        file_path,
        data.folders.len()
    );
    Ok(data)
}

#[command]
pub async fn import_code_workspace(file_path: String) -> Result<WorkspaceFileData, String> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read .code-workspace file '{}': {}", file_path, e))?;

    let code_ws: CodeWorkspaceFile = serde_json::from_str(&content).map_err(|e| {
        format!(
            "Failed to parse .code-workspace file '{}': {}",
            file_path, e
        )
    })?;

    let ws_dir = Path::new(&file_path)
        .parent()
        .ok_or_else(|| format!("Cannot determine parent directory of '{}'", file_path))?;

    let folders = code_ws
        .folders
        .into_iter()
        .map(|f| {
            let resolved = if Path::new(&f.path).is_relative() {
                ws_dir.join(&f.path).to_string_lossy().to_string()
            } else {
                f.path
            };
            WorkspaceFolderEntry {
                path: resolved,
                name: f.name,
                color: None,
                icon: None,
            }
        })
        .collect();

    let data = WorkspaceFileData {
        folders,
        settings: code_ws
            .settings
            .unwrap_or(serde_json::Value::Object(Default::default())),
    };

    info!("[Workspace] Imported .code-workspace file: {}", file_path);
    Ok(data)
}

#[command]
pub async fn save_workspace_state(
    app: AppHandle,
    workspace_id: String,
    state: WorkspaceStateData,
) -> Result<(), String> {
    let dir = workspace_data_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create workspace data directory: {}", e))?;

    let state_path = dir.join(format!("{}.json", workspace_id));
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize workspace state: {}", e))?;

    tokio::fs::write(&state_path, content)
        .await
        .map_err(|e| format!("Failed to write workspace state: {}", e))?;

    info!("[Workspace] Saved workspace state: {}", workspace_id);
    Ok(())
}

#[command]
pub async fn restore_workspace_state(
    app: AppHandle,
    workspace_id: String,
) -> Result<Option<WorkspaceStateData>, String> {
    let dir = workspace_data_dir(&app)?;
    let state_path = dir.join(format!("{}.json", workspace_id));

    match tokio::fs::read_to_string(&state_path).await {
        Ok(content) => {
            let state: WorkspaceStateData = serde_json::from_str(&content).map_err(|e| {
                format!(
                    "Failed to parse workspace state for '{}': {}",
                    workspace_id, e
                )
            })?;
            info!("[Workspace] Restored workspace state: {}", workspace_id);
            Ok(Some(state))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            warn!("[Workspace] No saved state found for: {}", workspace_id);
            Ok(None)
        }
        Err(e) => Err(format!(
            "Failed to read workspace state for '{}': {}",
            workspace_id, e
        )),
    }
}

#[command]
pub async fn get_recent_workspaces(app: AppHandle) -> Result<Vec<RecentWorkspaceEntry>, String> {
    let path = recent_workspaces_path(&app)?;

    match tokio::fs::read_to_string(&path).await {
        Ok(content) => {
            let mut data: RecentWorkspacesData = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse recent workspaces: {}", e))?;
            data.entries.truncate(20);
            Ok(data.entries)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("Failed to read recent workspaces: {}", e)),
    }
}

#[command]
pub async fn workspace_reorder_folders(
    file_path: String,
    new_order: Vec<usize>,
) -> Result<WorkspaceFileData, String> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read workspace file '{}': {}", file_path, e))?;
    let mut data: WorkspaceFileData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace file '{}': {}", file_path, e))?;

    let folder_count = data.folders.len();
    if new_order.len() != folder_count {
        return Err(format!(
            "new_order length ({}) does not match folder count ({})",
            new_order.len(),
            folder_count
        ));
    }
    for &idx in &new_order {
        if idx >= folder_count {
            return Err(format!(
                "Index {} is out of bounds for {} folders",
                idx, folder_count
            ));
        }
    }

    let old_folders = data.folders.clone();
    let mut reordered = Vec::with_capacity(folder_count);
    for &idx in &new_order {
        reordered.push(old_folders[idx].clone());
    }
    data.folders = reordered;

    let serialized = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize workspace data: {}", e))?;
    tokio::fs::write(&file_path, serialized)
        .await
        .map_err(|e| format!("Failed to write workspace file '{}': {}", file_path, e))?;

    info!("[Workspace] Reordered folders in: {}", file_path);
    Ok(data)
}

#[command]
pub async fn workspace_import_code_workspace(
    file_path: String,
) -> Result<CodeWorkspaceImport, String> {
    let raw = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read code-workspace file '{}': {}", file_path, e))?;

    let stripped = strip_jsonc_comments(&raw);
    let parsed: serde_json::Value = serde_json::from_str(&stripped)
        .map_err(|e| format!("Failed to parse code-workspace file '{}': {}", file_path, e))?;

    let workspace_dir = Path::new(&file_path)
        .parent()
        .ok_or_else(|| format!("Cannot determine parent directory of '{}'", file_path))?;

    let raw_folders = parsed
        .get("folders")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut folders = Vec::with_capacity(raw_folders.len());
    for entry in &raw_folders {
        let folder_path = entry
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".")
            .to_string();
        let name = entry.get("name").and_then(|v| v.as_str()).map(String::from);

        let joined = workspace_dir.join(&folder_path);
        let resolved = std::fs::canonicalize(&joined)
            .unwrap_or(joined)
            .to_string_lossy()
            .to_string();

        folders.push(CodeWorkspaceFolderEntry {
            path: folder_path,
            name,
            resolved_path: resolved,
        });
    }

    let settings = parsed.get("settings").cloned().unwrap_or_default();
    let extensions = parsed.get("extensions").cloned().unwrap_or_default();
    let launch = parsed.get("launch").cloned().unwrap_or_default();
    let tasks = parsed.get("tasks").cloned().unwrap_or_default();

    info!(
        "[Workspace] Imported code-workspace file: {} ({} folders)",
        file_path,
        folders.len()
    );

    Ok(CodeWorkspaceImport {
        folders,
        settings,
        extensions,
        launch,
        tasks,
    })
}

#[command]
pub async fn workspace_get_recent(app: AppHandle) -> Result<Vec<RecentWorkspaceEntry>, String> {
    let path = recent_workspaces_path(&app)?;
    match tokio::fs::read_to_string(&path).await {
        Ok(content) => {
            let list: RecentWorkspacesList = serde_json::from_str(&content).unwrap_or_default();
            Ok(list.entries)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => {
            warn!("[Workspace] Failed to read recent workspaces: {}", e);
            Ok(Vec::new())
        }
    }
}

#[command]
pub async fn add_recent_workspace(
    app: AppHandle,
    entry: RecentWorkspaceEntry,
) -> Result<(), String> {
    let path = recent_workspaces_path(&app)?;

    let mut data: RecentWorkspacesData = match tokio::fs::read_to_string(&path).await {
        Ok(content) => serde_json::from_str(&content).unwrap_or(RecentWorkspacesData {
            entries: Vec::new(),
        }),
        Err(_) => RecentWorkspacesData {
            entries: Vec::new(),
        },
    };

    data.entries.retain(|e| e.path != entry.path);
    data.entries.insert(0, entry);
    data.entries.truncate(20);

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize recent workspaces: {}", e))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write recent workspaces: {}", e))?;

    info!(
        "[Workspace] Added recent workspace: {}",
        data.entries[0].path
    );
    Ok(())
}

#[command]
pub async fn workspace_save_recent(
    entries: Vec<RecentWorkspaceEntry>,
    app: AppHandle,
) -> Result<(), String> {
    let path = recent_workspaces_path(&app)?;
    let truncated: Vec<RecentWorkspaceEntry> =
        entries.into_iter().take(MAX_RECENT_WORKSPACES).collect();

    let list = RecentWorkspacesList { entries: truncated };

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&list)
        .map_err(|e| format!("Failed to serialize recent workspaces: {}", e))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write recent workspaces: {}", e))?;

    info!(
        "[Workspace] Saved {} recent workspace entries",
        list.entries.len()
    );
    Ok(())
}

#[command]
pub async fn remove_recent_workspace(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = recent_workspaces_path(&app)?;

    let mut data: RecentWorkspacesData = match tokio::fs::read_to_string(&file_path).await {
        Ok(content) => serde_json::from_str(&content).unwrap_or(RecentWorkspacesData {
            entries: Vec::new(),
        }),
        Err(_) => return Ok(()),
    };

    let before = data.entries.len();
    data.entries.retain(|e| e.path != path);

    if data.entries.len() < before {
        let content = serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Failed to serialize recent workspaces: {}", e))?;
        tokio::fs::write(&file_path, content)
            .await
            .map_err(|e| format!("Failed to write recent workspaces: {}", e))?;
        info!("[Workspace] Removed recent workspace: {}", path);
    }

    Ok(())
}
