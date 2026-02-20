//! Multi-root workspace support for `.cortex-workspace.json` files.
//!
//! Provides parsing, serialization, folder management, and per-folder settings
//! for multi-root workspace configurations.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::fs::security::{validate_path_for_read, validate_path_for_write};

const ALLOWED_WORKSPACE_EXTENSIONS: &[&str] = &["cortex-workspace", "json"];

fn validate_workspace_path_for_read(file_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(file_path);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !ALLOWED_WORKSPACE_EXTENSIONS.contains(&ext) {
        return Err(format!(
            "Invalid workspace file extension '.{}'. Allowed: {:?}",
            ext, ALLOWED_WORKSPACE_EXTENSIONS
        ));
    }
    validate_path_for_read(path)
}

fn validate_workspace_path_for_write(file_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(file_path);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !ALLOWED_WORKSPACE_EXTENSIONS.contains(&ext) {
        return Err(format!(
            "Invalid workspace file extension '.{}'. Allowed: {:?}",
            ext, ALLOWED_WORKSPACE_EXTENSIONS
        ));
    }
    validate_path_for_write(path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiRootFolder {
    pub path: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CortexWorkspaceFile {
    pub folders: Vec<MultiRootFolder>,
    pub settings: serde_json::Value,
    #[serde(default)]
    pub per_folder_settings: HashMap<String, serde_json::Value>,
}

pub fn parse_cortex_workspace(content: &str) -> Result<CortexWorkspaceFile, String> {
    serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse cortex-workspace JSON: {}", e))
}

pub fn serialize_cortex_workspace(ws: &CortexWorkspaceFile) -> Result<String, String> {
    serde_json::to_string_pretty(ws)
        .map_err(|e| format!("Failed to serialize cortex-workspace: {}", e))
}

pub fn get_folder_settings(ws: &CortexWorkspaceFile, folder_path: &str) -> serde_json::Value {
    let folder_override = ws
        .per_folder_settings
        .get(folder_path)
        .cloned()
        .unwrap_or(serde_json::Value::Object(Default::default()));
    merge_settings(&ws.settings, &folder_override)
}

pub fn merge_settings(base: &serde_json::Value, overlay: &serde_json::Value) -> serde_json::Value {
    match (base, overlay) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(overlay_map)) => {
            let mut merged = base_map.clone();
            for (key, overlay_val) in overlay_map {
                let merged_val = if let Some(base_val) = base_map.get(key) {
                    merge_settings(base_val, overlay_val)
                } else {
                    overlay_val.clone()
                };
                merged.insert(key.clone(), merged_val);
            }
            serde_json::Value::Object(merged)
        }
        (_, overlay_val) => overlay_val.clone(),
    }
}

#[tauri::command]
pub async fn multi_root_add_folder(
    file_path: String,
    folder_path: String,
    name: Option<String>,
) -> Result<CortexWorkspaceFile, String> {
    let validated_path = validate_workspace_path_for_write(&file_path)?;
    let content = tokio::fs::read_to_string(&validated_path)
        .await
        .map_err(|e| format!("Failed to read workspace file: {}", e))?;

    let mut ws = parse_cortex_workspace(&content)?;

    if ws.folders.iter().any(|f| f.path == folder_path) {
        warn!(
            "[MultiRoot] Folder already exists in workspace: {}",
            folder_path
        );
        return Ok(ws);
    }

    ws.folders.push(MultiRootFolder {
        path: folder_path.clone(),
        name,
        color: None,
        icon: None,
    });

    let serialized = serialize_cortex_workspace(&ws)?;
    let tmp_path = validated_path.with_extension("tmp");
    tokio::fs::write(&tmp_path, &serialized)
        .await
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    tokio::fs::rename(&tmp_path, &validated_path)
        .await
        .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

    info!("[MultiRoot] Added folder to workspace");
    Ok(ws)
}

#[tauri::command]
pub async fn multi_root_remove_folder(
    file_path: String,
    folder_path: String,
) -> Result<CortexWorkspaceFile, String> {
    let validated_path = validate_workspace_path_for_write(&file_path)?;
    let content = tokio::fs::read_to_string(&validated_path)
        .await
        .map_err(|e| format!("Failed to read workspace file: {}", e))?;

    let mut ws = parse_cortex_workspace(&content)?;

    let before = ws.folders.len();
    ws.folders.retain(|f| f.path != folder_path);

    if ws.folders.len() == before {
        warn!("[MultiRoot] Folder not found for removal: {}", folder_path);
    }

    ws.per_folder_settings.remove(&folder_path);

    let serialized = serialize_cortex_workspace(&ws)?;
    let tmp_path = validated_path.with_extension("tmp");
    tokio::fs::write(&tmp_path, &serialized)
        .await
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    tokio::fs::rename(&tmp_path, &validated_path)
        .await
        .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

    info!("[MultiRoot] Removed folder from workspace");
    Ok(ws)
}

#[tauri::command]
pub async fn multi_root_save_workspace(
    file_path: String,
    data: CortexWorkspaceFile,
) -> Result<(), String> {
    let validated_path = validate_workspace_path_for_write(&file_path)?;
    let serialized = serialize_cortex_workspace(&data)?;

    if let Some(parent) = validated_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    let tmp_path = validated_path.with_extension("tmp");
    tokio::fs::write(&tmp_path, &serialized)
        .await
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    tokio::fs::rename(&tmp_path, &validated_path)
        .await
        .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

    info!("[MultiRoot] Saved workspace file");
    Ok(())
}

#[tauri::command]
pub async fn multi_root_load_workspace(file_path: String) -> Result<CortexWorkspaceFile, String> {
    let validated_path = validate_workspace_path_for_read(&file_path)?;
    let content = tokio::fs::read_to_string(&validated_path)
        .await
        .map_err(|e| format!("Failed to read workspace file: {}", e))?;

    let ws = parse_cortex_workspace(&content)?;

    info!(
        "[MultiRoot] Loaded workspace ({} folders)",
        ws.folders.len()
    );
    Ok(ws)
}

#[tauri::command]
pub async fn multi_root_get_folder_settings(
    file_path: String,
    folder_path: String,
) -> Result<serde_json::Value, String> {
    let validated_path = validate_workspace_path_for_read(&file_path)?;
    let content = tokio::fs::read_to_string(&validated_path)
        .await
        .map_err(|e| format!("Failed to read workspace file: {}", e))?;

    let ws = parse_cortex_workspace(&content)?;
    let settings = get_folder_settings(&ws, &folder_path);

    info!("[MultiRoot] Retrieved folder settings");
    Ok(settings)
}

#[tauri::command]
pub async fn multi_root_set_folder_settings(
    file_path: String,
    folder_path: String,
    settings: serde_json::Value,
) -> Result<(), String> {
    let validated_path = validate_workspace_path_for_write(&file_path)?;
    let content = tokio::fs::read_to_string(&validated_path)
        .await
        .map_err(|e| format!("Failed to read workspace file: {}", e))?;

    let mut ws = parse_cortex_workspace(&content)?;
    ws.per_folder_settings.insert(folder_path.clone(), settings);

    let serialized = serialize_cortex_workspace(&ws)?;
    let tmp_path = validated_path.with_extension("tmp");
    tokio::fs::write(&tmp_path, &serialized)
        .await
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    tokio::fs::rename(&tmp_path, &validated_path)
        .await
        .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

    info!("[MultiRoot] Updated folder settings");
    Ok(())
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;

    fn resolve_folder_path(base_dir: &Path, folder_path: &str) -> PathBuf {
        let p = Path::new(folder_path);
        if p.is_absolute() {
            p.to_path_buf()
        } else {
            base_dir.join(p)
        }
    }

    #[test]
    fn test_parse_valid_workspace() {
        let json = r##"{
            "folders": [
                {"path": "./src", "name": "Source"},
                {"path": "/absolute/path", "name": null, "color": "#ff0000", "icon": "folder-src"}
            ],
            "settings": {"editor.tabSize": 4},
            "perFolderSettings": {
                "./src": {"editor.tabSize": 2}
            }
        }"##;

        let ws = parse_cortex_workspace(json).expect("should parse valid workspace");
        assert_eq!(ws.folders.len(), 2);
        assert_eq!(ws.folders[0].path, "./src");
        assert_eq!(ws.folders[0].name, Some("Source".to_string()));
        assert_eq!(ws.folders[1].path, "/absolute/path");
        assert_eq!(ws.folders[1].color, Some("#ff0000".to_string()));
        assert_eq!(ws.folders[1].icon, Some("folder-src".to_string()));
        assert_eq!(ws.settings["editor.tabSize"], 4);
        assert!(ws.per_folder_settings.contains_key("./src"));
    }

    #[test]
    fn test_serialization_roundtrip() {
        let ws = CortexWorkspaceFile {
            folders: vec![
                MultiRootFolder {
                    path: "./frontend".to_string(),
                    name: Some("Frontend".to_string()),
                    color: Some("#00ff00".to_string()),
                    icon: None,
                },
                MultiRootFolder {
                    path: "./backend".to_string(),
                    name: None,
                    color: None,
                    icon: Some("folder-rust".to_string()),
                },
            ],
            settings: serde_json::json!({"editor.fontSize": 14}),
            per_folder_settings: {
                let mut m = HashMap::new();
                m.insert(
                    "./frontend".to_string(),
                    serde_json::json!({"editor.fontSize": 16}),
                );
                m
            },
        };

        let serialized = serialize_cortex_workspace(&ws).expect("should serialize");
        let deserialized =
            parse_cortex_workspace(&serialized).expect("should parse serialized output");

        assert_eq!(deserialized.folders.len(), 2);
        assert_eq!(deserialized.folders[0].path, "./frontend");
        assert_eq!(deserialized.folders[0].name, Some("Frontend".to_string()));
        assert_eq!(
            deserialized.folders[1].icon,
            Some("folder-rust".to_string())
        );
        assert_eq!(deserialized.settings["editor.fontSize"], 14);
        assert_eq!(
            deserialized.per_folder_settings["./frontend"]["editor.fontSize"],
            16
        );
    }

    #[test]
    fn test_merge_settings() {
        let base = serde_json::json!({
            "editor.tabSize": 4,
            "editor.fontSize": 14,
            "nested": {
                "a": 1,
                "b": 2
            }
        });

        let overlay = serde_json::json!({
            "editor.tabSize": 2,
            "editor.wordWrap": "on",
            "nested": {
                "b": 99,
                "c": 3
            }
        });

        let merged = merge_settings(&base, &overlay);
        assert_eq!(merged["editor.tabSize"], 2);
        assert_eq!(merged["editor.fontSize"], 14);
        assert_eq!(merged["editor.wordWrap"], "on");
        assert_eq!(merged["nested"]["a"], 1);
        assert_eq!(merged["nested"]["b"], 99);
        assert_eq!(merged["nested"]["c"], 3);
    }

    #[test]
    fn test_resolve_folder_path_relative() {
        let base = Path::new("/home/user/project");
        let resolved = resolve_folder_path(base, "./src");
        assert_eq!(resolved, PathBuf::from("/home/user/project/src"));
    }

    #[test]
    fn test_resolve_folder_path_absolute() {
        let base = Path::new("/home/user/project");
        let resolved = resolve_folder_path(base, "/opt/external");
        assert_eq!(resolved, PathBuf::from("/opt/external"));
    }
}
