//! Keybinding Management Backend
//!
//! Provides Tauri commands for loading, saving, importing, exporting,
//! and conflict detection for keyboard shortcuts. User keybindings are
//! persisted as JSON in the app data directory; default keybindings
//! are managed on the frontend.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{info, warn};

// ============================================================================
// Types
// ============================================================================

/// A single keybinding entry mapping a key chord to a command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingEntry {
    pub command: String,
    pub key: String,
    pub when: Option<String>,
    pub source: String,
}

/// File format for persisted keybindings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingsFile {
    pub version: u32,
    pub bindings: Vec<KeybindingEntry>,
}

/// A detected conflict where the same key is bound to multiple commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingConflict {
    pub key: String,
    pub commands: Vec<String>,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for keybinding management
#[derive(Clone)]
pub struct KeybindingsState(pub Arc<Mutex<Vec<KeybindingEntry>>>);

impl KeybindingsState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(Vec::new())))
    }
}

impl Default for KeybindingsState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Resolve the keybindings file path under the user data directory
fn get_keybindings_path() -> Result<std::path::PathBuf, String> {
    let data_dir =
        dirs::data_dir().ok_or_else(|| "Could not determine data directory".to_string())?;
    Ok(data_dir.join("Cortex").join("keybindings.json"))
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Load keybindings from the app data directory.
/// Returns an empty vec if the file does not exist.
#[tauri::command]
pub async fn load_keybindings_file(_app: tauri::AppHandle) -> Result<Vec<KeybindingEntry>, String> {
    let path = get_keybindings_path()?;

    tokio::task::spawn_blocking(move || {
        if !path.exists() {
            info!("Keybindings file not found, returning empty list");
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read keybindings file: {}", e))?;

        let file: KeybindingsFile = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse keybindings file: {}", e))?;

        info!("Loaded {} keybindings from disk", file.bindings.len());
        Ok(file.bindings)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Save keybindings to the app data directory.
/// Creates the parent directory if it does not exist.
#[tauri::command]
pub async fn save_keybindings_file(
    _app: tauri::AppHandle,
    bindings: Vec<KeybindingEntry>,
) -> Result<(), String> {
    let path = get_keybindings_path()?;
    let count = bindings.len();

    tokio::task::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create keybindings directory: {}", e))?;
        }

        let file = KeybindingsFile {
            version: 1,
            bindings,
        };

        let content = serde_json::to_string_pretty(&file)
            .map_err(|e| format!("Failed to serialize keybindings: {}", e))?;

        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write keybindings file: {}", e))?;

        info!("Saved {} keybindings to disk", count);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Return default keybindings (empty — defaults are managed on the frontend).
#[tauri::command]
pub async fn get_default_keybindings() -> Result<Vec<KeybindingEntry>, String> {
    Ok(Vec::new())
}

/// Import keybindings from a user-specified file path.
#[tauri::command]
pub async fn import_keybindings(path: String) -> Result<Vec<KeybindingEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read keybindings from {}: {}", path, e))?;

        let file: KeybindingsFile = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse keybindings from {}: {}", path, e))?;

        info!("Imported {} keybindings from {}", file.bindings.len(), path);
        Ok(file.bindings)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Export keybindings to a user-specified file path.
#[tauri::command]
pub async fn export_keybindings(
    path: String,
    bindings: Vec<KeybindingEntry>,
) -> Result<(), String> {
    let count = bindings.len();

    tokio::task::spawn_blocking(move || {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create export directory: {}", e))?;
        }

        let file = KeybindingsFile {
            version: 1,
            bindings,
        };

        let content = serde_json::to_string_pretty(&file)
            .map_err(|e| format!("Failed to serialize keybindings: {}", e))?;

        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write keybindings to {}: {}", path, e))?;

        info!("Exported {} keybindings to {}", count, path);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Detect conflicting keybindings where the same key is mapped to multiple commands.
#[tauri::command]
pub async fn detect_conflicts(
    bindings: Vec<KeybindingEntry>,
) -> Result<Vec<KeybindingConflict>, String> {
    let mut key_commands: HashMap<String, Vec<String>> = HashMap::new();

    for entry in &bindings {
        key_commands
            .entry(entry.key.clone())
            .or_default()
            .push(entry.command.clone());
    }

    let conflicts: Vec<KeybindingConflict> = key_commands
        .into_iter()
        .filter(|(_, commands)| {
            let mut unique = commands.clone();
            unique.sort();
            unique.dedup();
            unique.len() > 1
        })
        .map(|(key, commands)| {
            let mut unique = commands;
            unique.sort();
            unique.dedup();
            KeybindingConflict {
                key,
                commands: unique,
            }
        })
        .collect();

    if !conflicts.is_empty() {
        warn!("Detected {} keybinding conflicts", conflicts.len());
    }

    Ok(conflicts)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn make_entry(command: &str, key: &str) -> KeybindingEntry {
        KeybindingEntry {
            command: command.to_string(),
            key: key.to_string(),
            when: None,
            source: "test".to_string(),
        }
    }

    // ---- KeybindingEntry serialization ----

    #[test]
    fn keybinding_entry_roundtrip() {
        let entry = KeybindingEntry {
            command: "editor.action.formatDocument".to_string(),
            key: "ctrl+shift+f".to_string(),
            when: Some("editorTextFocus".to_string()),
            source: "user".to_string(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: KeybindingEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.command, "editor.action.formatDocument");
        assert_eq!(deserialized.key, "ctrl+shift+f");
        assert_eq!(deserialized.when, Some("editorTextFocus".to_string()));
        assert_eq!(deserialized.source, "user");
    }

    #[test]
    fn keybinding_entry_camel_case() {
        let json = r#"{"command":"cmd","key":"a","when":null,"source":"default"}"#;
        let entry: KeybindingEntry = serde_json::from_str(json).unwrap();
        assert_eq!(entry.command, "cmd");
        assert!(entry.when.is_none());
    }

    // ---- KeybindingsFile serialization ----

    #[test]
    fn keybindings_file_roundtrip() {
        let file = KeybindingsFile {
            version: 1,
            bindings: vec![make_entry("cmd1", "ctrl+a")],
        };
        let json = serde_json::to_string(&file).unwrap();
        let deserialized: KeybindingsFile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.version, 1);
        assert_eq!(deserialized.bindings.len(), 1);
        assert_eq!(deserialized.bindings[0].command, "cmd1");
    }

    #[test]
    fn keybindings_file_empty_bindings() {
        let file = KeybindingsFile {
            version: 1,
            bindings: vec![],
        };
        let json = serde_json::to_string(&file).unwrap();
        let deserialized: KeybindingsFile = serde_json::from_str(&json).unwrap();
        assert!(deserialized.bindings.is_empty());
    }

    // ---- KeybindingConflict serialization ----

    #[test]
    fn keybinding_conflict_roundtrip() {
        let conflict = KeybindingConflict {
            key: "ctrl+s".to_string(),
            commands: vec!["save".to_string(), "saveAll".to_string()],
        };
        let json = serde_json::to_string(&conflict).unwrap();
        let deserialized: KeybindingConflict = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.key, "ctrl+s");
        assert_eq!(deserialized.commands.len(), 2);
    }

    // ---- detect_conflicts logic ----

    #[tokio::test]
    async fn detect_conflicts_with_conflict() {
        let bindings = vec![
            make_entry("save", "ctrl+s"),
            make_entry("saveAll", "ctrl+s"),
        ];
        let conflicts = detect_conflicts(bindings).await.unwrap();
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].key, "ctrl+s");
        assert!(conflicts[0].commands.contains(&"save".to_string()));
        assert!(conflicts[0].commands.contains(&"saveAll".to_string()));
    }

    #[tokio::test]
    async fn detect_conflicts_no_conflict_same_command() {
        let bindings = vec![make_entry("save", "ctrl+s"), make_entry("save", "ctrl+s")];
        let conflicts = detect_conflicts(bindings).await.unwrap();
        assert!(conflicts.is_empty());
    }

    #[tokio::test]
    async fn detect_conflicts_no_conflict_different_keys() {
        let bindings = vec![make_entry("save", "ctrl+s"), make_entry("open", "ctrl+o")];
        let conflicts = detect_conflicts(bindings).await.unwrap();
        assert!(conflicts.is_empty());
    }

    #[tokio::test]
    async fn detect_conflicts_empty_bindings() {
        let conflicts = detect_conflicts(vec![]).await.unwrap();
        assert!(conflicts.is_empty());
    }

    #[tokio::test]
    async fn detect_conflicts_single_binding() {
        let bindings = vec![make_entry("save", "ctrl+s")];
        let conflicts = detect_conflicts(bindings).await.unwrap();
        assert!(conflicts.is_empty());
    }

    #[tokio::test]
    async fn detect_conflicts_multiple_conflicts() {
        let bindings = vec![
            make_entry("cmd1", "ctrl+a"),
            make_entry("cmd2", "ctrl+a"),
            make_entry("cmd3", "ctrl+b"),
            make_entry("cmd4", "ctrl+b"),
        ];
        let conflicts = detect_conflicts(bindings).await.unwrap();
        assert_eq!(conflicts.len(), 2);
    }

    #[tokio::test]
    async fn detect_conflicts_three_commands_same_key() {
        let bindings = vec![
            make_entry("cmd1", "ctrl+x"),
            make_entry("cmd2", "ctrl+x"),
            make_entry("cmd3", "ctrl+x"),
        ];
        let conflicts = detect_conflicts(bindings).await.unwrap();
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].commands.len(), 3);
    }

    // ---- KeybindingsState ----

    #[test]
    fn keybindings_state_new() {
        let state = KeybindingsState::new();
        let bindings = state.0.lock().unwrap();
        assert!(bindings.is_empty());
    }

    #[test]
    fn keybindings_state_default() {
        let state = KeybindingsState::default();
        let bindings = state.0.lock().unwrap();
        assert!(bindings.is_empty());
    }

    #[test]
    fn keybindings_state_add_entries() {
        let state = KeybindingsState::new();
        {
            let mut bindings = state.0.lock().unwrap();
            bindings.push(make_entry("test", "ctrl+t"));
        }
        let bindings = state.0.lock().unwrap();
        assert_eq!(bindings.len(), 1);
    }
}
