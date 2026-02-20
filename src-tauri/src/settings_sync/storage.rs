//! Settings serialization and deserialization for sync
//!
//! Collects settings, keybindings, snippets, and extension lists
//! from disk and serializes them into a SyncBundle for upload.

use std::fs;
use std::path::PathBuf;

use tracing::{info, warn};

use super::types::SyncBundle;

/// Get the Cortex data directory
fn get_cortex_data_dir() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or("Could not find app data directory")?;
    Ok(data_dir.join("Cortex"))
}

/// Read a JSON file from the Cortex data directory
fn read_json_file(filename: &str) -> Option<serde_json::Value> {
    let path = get_cortex_data_dir().ok()?.join(filename);
    if !path.exists() {
        return None;
    }
    match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(value) => Some(value),
            Err(e) => {
                warn!("Failed to parse {}: {}", filename, e);
                None
            }
        },
        Err(e) => {
            warn!("Failed to read {}: {}", filename, e);
            None
        }
    }
}

/// Write a JSON file to the Cortex data directory
fn write_json_file(filename: &str, value: &serde_json::Value) -> Result<(), String> {
    let dir = get_cortex_data_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data directory: {}", e))?;
    }
    let path = dir.join(filename);
    let content =
        serde_json::to_string_pretty(value).map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", filename, e))?;
    info!("Wrote sync data to {}", path.display());
    Ok(())
}

/// Collect all local settings into a SyncBundle
pub fn collect_local_bundle(machine_id: &str) -> SyncBundle {
    SyncBundle {
        version: 1,
        timestamp: chrono::Utc::now().timestamp_millis(),
        machine_id: machine_id.to_string(),
        settings: read_json_file("settings.json"),
        keybindings: read_json_file("keybindings.json"),
        snippets: read_json_file("snippets.json"),
        extensions: read_extensions_list(),
        ui_state: read_json_file("ui-state.json"),
    }
}

/// Read the list of installed extensions
fn read_extensions_list() -> Option<Vec<String>> {
    let dir = get_cortex_data_dir().ok()?.join("extensions");
    if !dir.exists() {
        return None;
    }
    let mut extensions = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    extensions.push(name.to_string());
                }
            }
        }
    }
    if extensions.is_empty() {
        None
    } else {
        Some(extensions)
    }
}

/// Apply a remote SyncBundle to local storage
pub fn apply_remote_bundle(bundle: &SyncBundle) -> Result<(), String> {
    if let Some(ref settings) = bundle.settings {
        write_json_file("settings.json", settings)?;
    }
    if let Some(ref keybindings) = bundle.keybindings {
        write_json_file("keybindings.json", keybindings)?;
    }
    if let Some(ref snippets) = bundle.snippets {
        write_json_file("snippets.json", snippets)?;
    }
    if let Some(ref ui_state) = bundle.ui_state {
        write_json_file("ui-state.json", ui_state)?;
    }
    info!("Applied remote sync bundle");
    Ok(())
}

/// Serialize a SyncBundle to JSON string
pub fn serialize_bundle(bundle: &SyncBundle) -> Result<String, String> {
    serde_json::to_string_pretty(bundle).map_err(|e| format!("Failed to serialize bundle: {}", e))
}

/// Deserialize a SyncBundle from JSON string
pub fn deserialize_bundle(json: &str) -> Result<SyncBundle, String> {
    serde_json::from_str(json).map_err(|e| format!("Failed to deserialize bundle: {}", e))
}
