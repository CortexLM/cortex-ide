//! Plugin API surface for WASM runtime host function bindings.
//!
//! This module defines the host-side API that WASM extension plugins can call
//! into, including command registration, workspace file access, configuration
//! reading, and window message display.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// A command registered by an extension plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandRegistration {
    pub extension_id: String,
    pub command_id: String,
    pub title: String,
    #[serde(default)]
    pub category: Option<String>,
}

/// A window message intended to be forwarded as a Tauri event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowMessage {
    pub id: String,
    pub level: String,
    pub message: String,
    #[serde(default)]
    pub actions: Vec<String>,
}

/// A handle to an open document tracked by the plugin API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentHandle {
    pub id: String,
    pub uri: String,
    pub language_id: String,
    pub version: u32,
}

/// A decoration type registered by an extension plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecorationTypeHandle {
    pub id: String,
    pub extension_id: String,
    pub options: serde_json::Value,
}

// ============================================================================
// PluginCommands
// ============================================================================

/// Thread-safe registry of commands contributed by WASM extension plugins.
#[derive(Clone)]
pub struct PluginCommands {
    inner: Arc<DashMap<String, CommandRegistration>>,
}

impl Default for PluginCommands {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginCommands {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(DashMap::new()),
        }
    }

    /// Register a command contributed by an extension.
    pub fn register_command(
        &self,
        extension_id: String,
        command_id: String,
        title: String,
        category: Option<String>,
    ) {
        info!(
            extension_id = %extension_id,
            command_id = %command_id,
            "Registering plugin command"
        );
        self.inner.insert(
            command_id.clone(),
            CommandRegistration {
                extension_id,
                command_id,
                title,
                category,
            },
        );
    }

    /// Remove a previously registered command.
    pub fn unregister_command(&self, command_id: &str) {
        if self.inner.remove(command_id).is_some() {
            info!(command_id = %command_id, "Unregistered plugin command");
        } else {
            warn!(command_id = %command_id, "Attempted to unregister unknown command");
        }
    }

    /// Look up a registered command and return its registration as JSON.
    ///
    /// Actual execution of the command happens inside the WASM runtime; this
    /// method only resolves the registration metadata so the caller can
    /// dispatch accordingly.
    pub fn execute_command(&self, command_id: &str, _args_json: &str) -> Result<String, String> {
        let entry = self
            .inner
            .get(command_id)
            .ok_or_else(|| format!("Command not found: {}", command_id))?;
        serde_json::to_string(entry.value())
            .map_err(|e| format!("Failed to serialize command registration: {}", e))
    }

    /// Return all registered commands.
    pub fn get_commands(&self) -> Vec<CommandRegistration> {
        self.inner.iter().map(|r| r.value().clone()).collect()
    }

    /// Return commands registered by a specific extension.
    pub fn get_commands_for_extension(&self, extension_id: &str) -> Vec<CommandRegistration> {
        self.inner
            .iter()
            .filter(|r| r.value().extension_id == extension_id)
            .map(|r| r.value().clone())
            .collect()
    }
}

// ============================================================================
// PluginApiState
// ============================================================================

/// Shared state for the Plugin API, managed via `app.manage()`.
#[derive(Clone)]
pub struct PluginApiState {
    pub commands: PluginCommands,
    pub workspace_config: Arc<Mutex<serde_json::Value>>,
    pub documents: Arc<DashMap<String, DocumentHandle>>,
    pub decoration_types: Arc<DashMap<String, DecorationTypeHandle>>,
}

impl Default for PluginApiState {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginApiState {
    pub fn new() -> Self {
        Self {
            commands: PluginCommands::new(),
            workspace_config: Arc::new(Mutex::new(serde_json::Value::Object(Default::default()))),
            documents: Arc::new(DashMap::new()),
            decoration_types: Arc::new(DashMap::new()),
        }
    }

    // ========================================================================
    // Workspace configuration
    // ========================================================================

    /// Read a value from the workspace configuration by dot-separated key.
    pub fn get_configuration(&self, key: &str) -> Option<serde_json::Value> {
        let config = self
            .workspace_config
            .lock()
            .map_err(|_| "Failed to acquire workspace config lock")
            .ok()?;

        let mut current = &*config;
        for segment in key.split('.') {
            current = current.get(segment)?;
        }
        Some(current.clone())
    }

    // ========================================================================
    // Workspace file operations
    // ========================================================================

    /// Read a file that resides within the workspace root.
    ///
    /// The resolved path is validated to ensure it does not escape the
    /// workspace directory (prevents path-traversal attacks).
    pub fn read_workspace_file(
        &self,
        workspace_root: &str,
        relative_path: &str,
    ) -> Result<String, String> {
        let resolved = resolve_workspace_path(workspace_root, relative_path)?;
        std::fs::read_to_string(&resolved)
            .map_err(|e| format!("Failed to read file {}: {}", resolved.display(), e))
    }

    /// Write content to a file within the workspace root.
    ///
    /// Parent directories are created automatically. The resolved path is
    /// validated for workspace scoping.
    pub fn write_workspace_file(
        &self,
        workspace_root: &str,
        relative_path: &str,
        content: &str,
    ) -> Result<(), String> {
        let resolved = resolve_workspace_path(workspace_root, relative_path)?;

        if let Some(parent) = resolved.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }

        std::fs::write(&resolved, content)
            .map_err(|e| format!("Failed to write file {}: {}", resolved.display(), e))
    }

    /// List files within the workspace that match a glob pattern.
    ///
    /// Returns paths relative to the workspace root. All matched paths are
    /// validated to stay within the workspace boundary.
    pub fn list_workspace_files(
        &self,
        workspace_root: &str,
        glob_pattern: &str,
    ) -> Result<Vec<String>, String> {
        let root = std::fs::canonicalize(workspace_root)
            .map_err(|e| format!("Invalid workspace root: {}", e))?;

        let full_pattern = root.join(glob_pattern);
        let pattern_str = full_pattern
            .to_str()
            .ok_or_else(|| "Glob pattern contains invalid UTF-8".to_string())?;

        let entries =
            glob::glob(pattern_str).map_err(|e| format!("Invalid glob pattern: {}", e))?;

        let mut results = Vec::new();
        for entry in entries {
            let path = entry.map_err(|e| format!("Glob iteration error: {}", e))?;

            let canonical = std::fs::canonicalize(&path)
                .map_err(|e| format!("Failed to canonicalize {}: {}", path.display(), e))?;

            if !canonical.starts_with(&root) {
                warn!(
                    path = %canonical.display(),
                    workspace = %root.display(),
                    "Skipping file outside workspace scope"
                );
                continue;
            }

            if let Ok(relative) = canonical.strip_prefix(&root) {
                if let Some(s) = relative.to_str() {
                    results.push(s.to_string());
                }
            }
        }

        Ok(results)
    }
}

// ============================================================================
// Window API helpers
// ============================================================================

/// Create an informational window message.
pub fn show_info_message(message: &str) -> WindowMessage {
    WindowMessage {
        id: Uuid::new_v4().to_string(),
        level: "info".to_string(),
        message: message.to_string(),
        actions: Vec::new(),
    }
}

/// Create a warning window message.
pub fn show_warning_message(message: &str) -> WindowMessage {
    WindowMessage {
        id: Uuid::new_v4().to_string(),
        level: "warning".to_string(),
        message: message.to_string(),
        actions: Vec::new(),
    }
}

/// Create an error window message.
pub fn show_error_message(message: &str) -> WindowMessage {
    WindowMessage {
        id: Uuid::new_v4().to_string(),
        level: "error".to_string(),
        message: message.to_string(),
        actions: Vec::new(),
    }
}

// ============================================================================
// Path helpers
// ============================================================================

/// Resolve a relative path against a workspace root and verify the result
/// stays within the workspace boundary.
fn resolve_workspace_path(workspace_root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root = std::fs::canonicalize(workspace_root)
        .map_err(|e| format!("Invalid workspace root: {}", e))?;

    let joined = root.join(relative_path);

    let target = normalize_path(&joined);

    if !target.starts_with(&root) {
        return Err(format!("Path escapes workspace root: {}", relative_path));
    }

    Ok(target)
}

/// Normalize a path by resolving `.` and `..` components without requiring
/// the path to exist on disk (unlike `std::fs::canonicalize`).
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                components.pop();
            }
            std::path::Component::CurDir => {}
            other => components.push(other),
        }
    }
    components.iter().collect()
}

// ============================================================================
// Tauri commands
// ============================================================================

/// Register a plugin command via IPC.
#[tauri::command]
pub async fn plugin_api_register_command(
    app: AppHandle,
    extension_id: String,
    command_id: String,
    title: String,
    category: Option<String>,
) -> Result<(), String> {
    let state = app.state::<PluginApiState>();
    state
        .commands
        .register_command(extension_id, command_id, title, category);
    Ok(())
}

/// Get all registered plugin commands via IPC.
#[tauri::command]
pub async fn plugin_api_get_commands(app: AppHandle) -> Result<Vec<CommandRegistration>, String> {
    let state = app.state::<PluginApiState>();
    Ok(state.commands.get_commands())
}

/// Show a window message via IPC.
#[tauri::command]
pub async fn plugin_api_show_message(
    _app: AppHandle,
    level: String,
    message: String,
) -> Result<WindowMessage, String> {
    let msg = match level.as_str() {
        "info" => show_info_message(&message),
        "warning" => show_warning_message(&message),
        "error" => show_error_message(&message),
        other => {
            return Err(format!(
                "Invalid message level '{}': expected info, warning, or error",
                other
            ));
        }
    };
    Ok(msg)
}

/// Get a document by URI via IPC.
#[tauri::command]
pub async fn plugin_api_get_document(
    app: AppHandle,
    uri: String,
) -> Result<Option<DocumentHandle>, String> {
    let state = app.state::<PluginApiState>();
    Ok(state.documents.get(&uri).map(|d| d.value().clone()))
}

/// Set decorations on an editor via IPC.
#[tauri::command]
pub async fn plugin_api_set_decorations(
    app: AppHandle,
    extension_id: String,
    decoration_type_id: String,
    editor_uri: String,
    _ranges_json: String,
) -> Result<(), String> {
    let state = app.state::<PluginApiState>();
    if !state.decoration_types.contains_key(&decoration_type_id) {
        return Err(format!(
            "Decoration type '{}' not found",
            decoration_type_id
        ));
    }
    info!(
        extension_id = %extension_id,
        decoration_type_id = %decoration_type_id,
        editor_uri = %editor_uri,
        "Decorations set"
    );
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_get_commands() {
        let cmds = PluginCommands::new();
        cmds.register_command(
            "ext-1".into(),
            "ext-1.hello".into(),
            "Say Hello".into(),
            Some("Greetings".into()),
        );
        cmds.register_command("ext-2".into(), "ext-2.bye".into(), "Say Bye".into(), None);

        let all = cmds.get_commands();
        assert_eq!(all.len(), 2);

        let ext1 = cmds.get_commands_for_extension("ext-1");
        assert_eq!(ext1.len(), 1);
        assert_eq!(ext1[0].command_id, "ext-1.hello");
    }

    #[test]
    fn test_unregister_command() {
        let cmds = PluginCommands::new();
        cmds.register_command("ext".into(), "cmd.a".into(), "A".into(), None);
        assert_eq!(cmds.get_commands().len(), 1);

        cmds.unregister_command("cmd.a");
        assert_eq!(cmds.get_commands().len(), 0);
    }

    #[test]
    fn test_execute_command_not_found() {
        let cmds = PluginCommands::new();
        let result = cmds.execute_command("nonexistent", "{}");
        assert!(result.is_err());
    }

    #[test]
    fn test_execute_command_found() {
        let cmds = PluginCommands::new();
        cmds.register_command("ext".into(), "cmd.x".into(), "X".into(), None);

        let json = cmds.execute_command("cmd.x", "{}").unwrap();
        let reg: CommandRegistration = serde_json::from_str(&json).unwrap();
        assert_eq!(reg.command_id, "cmd.x");
        assert_eq!(reg.extension_id, "ext");
    }

    #[test]
    fn test_get_configuration_nested() {
        let state = PluginApiState::new();
        {
            let mut config = state.workspace_config.lock().unwrap();
            *config = serde_json::json!({
                "editor": {
                    "fontSize": 14,
                    "tabSize": 4
                }
            });
        }

        assert_eq!(
            state.get_configuration("editor.fontSize"),
            Some(serde_json::json!(14))
        );
        assert!(state.get_configuration("editor.nonexistent").is_none());
        assert!(state.get_configuration("missing").is_none());
    }

    #[test]
    fn test_window_message_levels() {
        let info = show_info_message("hello");
        assert_eq!(info.level, "info");
        assert_eq!(info.message, "hello");
        assert!(!info.id.is_empty());

        let warn_msg = show_warning_message("careful");
        assert_eq!(warn_msg.level, "warning");

        let err = show_error_message("broken");
        assert_eq!(err.level, "error");
    }

    #[test]
    fn test_normalize_path_removes_parent_dir() {
        let p = normalize_path(Path::new("/workspace/project/../secret/file.txt"));
        assert_eq!(p, PathBuf::from("/workspace/secret/file.txt"));
    }

    #[test]
    fn test_normalize_path_removes_cur_dir() {
        let p = normalize_path(Path::new("/workspace/./project/./file.txt"));
        assert_eq!(p, PathBuf::from("/workspace/project/file.txt"));
    }
}
