//! Rules Library - Tauri commands for managing AI instruction rules
//!
//! This module provides file system operations for .rules files,
//! including scanning project directories, reading, writing, and deleting rules files.

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

/// Information about a discovered .rules file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulesFileInfo {
    pub path: String,
    pub content: String,
}

/// Result of scanning a project for .rules files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub files: Vec<RulesFileInfo>,
    pub errors: Vec<String>,
}

/// Scan a project directory for .rules files
///
/// Looks for .rules files in:
/// - Project root
/// - .cortex/ directory
/// - .ai/ directory
/// - Common config locations
#[tauri::command]
pub async fn rules_scan_project(project_path: String) -> Result<Vec<RulesFileInfo>, String> {
    let project_dir = PathBuf::from(&project_path);

    if !project_dir.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    let mut rules_files = Vec::new();
    let mut search_paths = vec![
        project_dir.clone(),
        project_dir.join(".cortex"),
        project_dir.join(".ai"),
        project_dir.join(".config"),
    ];

    // Also check home directory for user rules
    if let Some(home) = dirs::home_dir() {
        search_paths.push(home.join(".cortex").join("rules"));
    }

    for search_path in search_paths {
        if search_path.exists() {
            match scan_directory_for_rules(&search_path).await {
                Ok(files) => rules_files.extend(files),
                Err(e) => warn!("Error scanning {}: {}", search_path.display(), e),
            }
        }
    }

    info!(
        "Found {} .rules files in project {}",
        rules_files.len(),
        project_path
    );
    Ok(rules_files)
}

/// Recursively scan a directory for .rules files (max depth 2)
async fn scan_directory_for_rules(dir: &Path) -> Result<Vec<RulesFileInfo>, std::io::Error> {
    scan_directory_recursive(dir, 0, 2).await
}

/// Helper function for recursive directory scanning
fn scan_directory_recursive(
    dir: &Path,
    current_depth: usize,
    max_depth: usize,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<Vec<RulesFileInfo>, std::io::Error>> + Send + '_>,
> {
    Box::pin(async move {
        let mut results = Vec::new();

        if current_depth > max_depth {
            return Ok(results);
        }

        let mut entries = tokio::fs::read_dir(dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            let file_type = entry.file_type().await?;

            if file_type.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "rules" {
                        match tokio::fs::read_to_string(&path).await {
                            Ok(content) => {
                                results.push(RulesFileInfo {
                                    path: path.to_string_lossy().to_string(),
                                    content,
                                });
                            }
                            Err(e) => {
                                warn!("Failed to read rules file {}: {}", path.display(), e);
                            }
                        }
                    }
                }
            } else if file_type.is_dir() {
                // Skip hidden directories except .cortex and .ai
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                if dir_name.starts_with('.') && dir_name != ".cortex" && dir_name != ".ai" {
                    continue;
                }

                // Skip common non-relevant directories
                if matches!(
                    dir_name,
                    "node_modules" | "target" | "dist" | "build" | ".git" | "__pycache__"
                ) {
                    continue;
                }

                match scan_directory_recursive(&path, current_depth + 1, max_depth).await {
                    Ok(files) => results.extend(files),
                    Err(e) => warn!("Error scanning subdirectory {}: {}", path.display(), e),
                }
            }
        }

        Ok(results)
    })
}

/// Read a .rules file from the filesystem
#[tauri::command]
pub async fn rules_read_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Rules file does not exist: {}", path));
    }

    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read rules file: {}", e))
}

/// Write content to a .rules file
#[tauri::command]
pub async fn rules_write_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    tokio::fs::write(&file_path, content)
        .await
        .map_err(|e| format!("Failed to write rules file: {}", e))?;

    info!("Saved rules file: {}", path);
    Ok(())
}

/// Save content to a .rules file (alias for rules_write_file)
///
/// This provides a consistent naming convention with the frontend
/// which expects `rules_save_file` for saving operations.
#[tauri::command]
pub async fn rules_save_file(path: String, content: String) -> Result<(), String> {
    rules_write_file(path, content).await
}

/// Delete a .rules file from the filesystem
#[tauri::command]
pub async fn rules_delete_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Ok(()); // Already deleted, not an error
    }

    tokio::fs::remove_file(&file_path)
        .await
        .map_err(|e| format!("Failed to delete rules file: {}", e))?;

    info!("Deleted rules file: {}", path);
    Ok(())
}

/// Create a new .rules file with default content
#[tauri::command]
pub async fn rules_create_file(path: String, name: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    if file_path.exists() {
        return Err(format!("Rules file already exists: {}", path));
    }

    let default_content = format!(
        r#"# {}
> Add your AI instruction rules here

@tags: custom
@priority: 50
@enabled: true

Write your rule content here. Use Markdown formatting.

- Be specific and actionable
- Include examples when helpful
- Focus on the "why" not just "what"
"#,
        name
    );

    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    tokio::fs::write(&file_path, &default_content)
        .await
        .map_err(|e| format!("Failed to create rules file: {}", e))?;

    info!("Created rules file: {}", path);
    Ok(default_content)
}

/// Get the user's rules directory path
#[tauri::command]
pub async fn rules_get_user_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|home| {
            home.join(".cortex")
                .join("rules")
                .to_string_lossy()
                .to_string()
        })
        .ok_or_else(|| "Could not determine home directory".to_string())
}

/// Ensure the user's rules directory exists
#[tauri::command]
pub async fn rules_ensure_user_dir() -> Result<String, String> {
    let user_dir = dirs::home_dir()
        .map(|home| home.join(".cortex").join("rules"))
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    if !user_dir.exists() {
        tokio::fs::create_dir_all(&user_dir)
            .await
            .map_err(|e| format!("Failed to create user rules directory: {}", e))?;
    }

    Ok(user_dir.to_string_lossy().to_string())
}

/// State for managing rules file watchers
pub struct RulesWatcherState {
    /// Active watchers by directory path
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl RulesWatcherState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for RulesWatcherState {
    fn default() -> Self {
        Self::new()
    }
}

/// Event emitted when rules files change
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RulesFileEvent {
    /// Type of change: "created", "modified", "removed"
    pub event_type: String,
    /// Path to the changed file
    pub path: String,
}

/// Watch a directory for .rules file changes
///
/// This uses the notify crate for efficient file system watching.
/// Events are emitted via Tauri events: "rules:file-changed"
#[tauri::command]
pub async fn rules_watch_directory(
    app: AppHandle,
    path: String,
    state: tauri::State<'_, RulesWatcherState>,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);

    if !watch_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    // Check if we're already watching this path
    {
        let watchers = state.watchers.lock();
        if watchers.contains_key(&path) {
            info!("Already watching directory: {}", path);
            return Ok(());
        }
    }

    // Create a channel for watcher events
    let (tx, mut rx) = mpsc::channel::<RulesFileEvent>(100);

    // Clone app handle for the event handler
    let app_clone = app.clone();

    // Spawn a task to forward events to the frontend
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let Err(e) = app_clone.emit("rules:file-changed", &event) {
                error!("Failed to emit rules file event: {}", e);
            }
        }
    });

    // Create the watcher
    let tx_clone = tx.clone();
    let path_clone = path.clone();

    let watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Only process events for .rules files
                let rules_paths: Vec<_> = event
                    .paths
                    .iter()
                    .filter(|p| p.extension().map(|ext| ext == "rules").unwrap_or(false))
                    .collect();

                if rules_paths.is_empty() {
                    return;
                }

                let event_type = match event.kind {
                    EventKind::Create(_) => "created",
                    EventKind::Modify(_) => "modified",
                    EventKind::Remove(_) => "removed",
                    _ => return,
                };

                for path in rules_paths {
                    let event = RulesFileEvent {
                        event_type: event_type.to_string(),
                        path: path.to_string_lossy().to_string(),
                    };

                    debug!("Rules file {}: {}", event_type, path.display());

                    if let Err(e) = tx_clone.blocking_send(event) {
                        error!("Failed to send rules file event: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Watch error for {}: {}", path_clone, e);
            }
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Store the watcher
    {
        let mut watchers = state.watchers.lock();
        watchers.insert(path.clone(), watcher);
    }

    // Start watching
    {
        let mut watchers = state.watchers.lock();
        if let Some(watcher) = watchers.get_mut(&path) {
            watcher
                .watch(&watch_path, RecursiveMode::Recursive)
                .map_err(|e| format!("Failed to watch directory: {}", e))?;
        }
    }

    info!("Started watching rules directory: {}", path);
    Ok(())
}

/// Stop watching a directory for .rules file changes
#[tauri::command]
pub fn rules_unwatch_directory(
    path: String,
    state: tauri::State<'_, RulesWatcherState>,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock();

    if let Some(mut watcher) = watchers.remove(&path) {
        let watch_path = PathBuf::from(&path);
        if let Err(e) = watcher.unwatch(&watch_path) {
            warn!("Error unwatching directory {}: {}", path, e);
        }
        info!("Stopped watching rules directory: {}", path);
    }

    Ok(())
}

/// Get home directory path
#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rules_get_user_dir() {
        let result = rules_get_user_dir().await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains(".cortex"));
    }

    #[test]
    fn test_get_home_dir() {
        let result = get_home_dir();
        assert!(result.is_ok());
    }
}
