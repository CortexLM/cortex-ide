//! Workspace and folder settings management for Orion Desktop
//!
//! This module handles the VSCode-style settings hierarchy:
//! 1. Workspace folder settings (.vscode/settings.json in each folder)
//! 2. Workspace settings (*.code-workspace file or .cortex/settings.json)
//! 3. User settings (AppData/Cortex/settings.json)
//! 4. Default settings
//!
//! Language-specific settings are supported via "[languageId]": { ... } syntax.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tracing::info;

/// Workspace settings stored in .cortex/settings.json or .vscode/settings.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceSettings {
    #[serde(flatten)]
    pub settings: Map<String, Value>,
}

/// Language-specific settings override
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LanguageSettings {
    #[serde(flatten)]
    pub overrides: Map<String, Value>,
}

/// Settings scope for the UI
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SettingsScope {
    Default,
    User,
    Workspace,
    Folder,
    Language,
}

/// Information about where a setting value comes from
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingInfo {
    pub key: String,
    pub value: Value,
    pub scope: SettingsScope,
    pub scope_path: Option<String>,
    pub default_value: Option<Value>,
    pub is_modified: bool,
}

/// Ensure the .vscode directory exists in the workspace
fn ensure_vscode_folder(workspace_path: &Path) -> Result<PathBuf, String> {
    let vscode_dir = workspace_path.join(".vscode");
    if !vscode_dir.exists() {
        fs::create_dir_all(&vscode_dir)
            .map_err(|e| format!("Failed to create .vscode directory: {}", e))?;
    }
    Ok(vscode_dir)
}

/// Ensure the .cortex directory exists in the workspace
fn ensure_cortex_folder(workspace_path: &Path) -> Result<PathBuf, String> {
    let cortex_dir = workspace_path.join(".cortex");
    if !cortex_dir.exists() {
        fs::create_dir_all(&cortex_dir)
            .map_err(|e| format!("Failed to create .cortex directory: {}", e))?;
    }
    Ok(cortex_dir)
}

/// Read settings from a .vscode/settings.json file
fn read_vscode_settings(workspace_path: &Path) -> Result<Value, String> {
    let settings_path = workspace_path.join(".vscode").join("settings.json");

    if !settings_path.exists() {
        return Ok(Value::Object(Map::new()));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    // Parse JSONC (JSON with comments)
    parse_jsonc(&content)
}

/// Read settings from a .cortex/settings.json file
fn read_cortex_settings(workspace_path: &Path) -> Result<Value, String> {
    let settings_path = workspace_path.join(".cortex").join("settings.json");

    if !settings_path.exists() {
        return Ok(Value::Object(Map::new()));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    // Parse JSONC (JSON with comments)
    parse_jsonc(&content)
}

/// Parse JSONC (JSON with comments) content
fn parse_jsonc(content: &str) -> Result<Value, String> {
    // Remove single-line comments
    let mut result = String::new();
    let mut in_string = false;
    let mut escape_next = false;
    let mut i = 0;
    let chars: Vec<char> = content.chars().collect();

    while i < chars.len() {
        if escape_next {
            result.push(chars[i]);
            escape_next = false;
            i += 1;
            continue;
        }

        if chars[i] == '\\' && in_string {
            escape_next = true;
            result.push(chars[i]);
            i += 1;
            continue;
        }

        if chars[i] == '"' {
            in_string = !in_string;
            result.push(chars[i]);
            i += 1;
            continue;
        }

        if !in_string {
            // Check for single-line comment
            if i + 1 < chars.len() && chars[i] == '/' && chars[i + 1] == '/' {
                // Skip to end of line
                while i < chars.len() && chars[i] != '\n' {
                    i += 1;
                }
                continue;
            }

            // Check for multi-line comment
            if i + 1 < chars.len() && chars[i] == '/' && chars[i + 1] == '*' {
                i += 2;
                while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                    i += 1;
                }
                i += 2; // Skip */
                continue;
            }

            // Handle trailing commas - skip comma if followed by ] or }
            if chars[i] == ',' {
                let mut j = i + 1;
                while j < chars.len()
                    && (chars[j] == ' ' || chars[j] == '\n' || chars[j] == '\r' || chars[j] == '\t')
                {
                    j += 1;
                }
                if j < chars.len() && (chars[j] == ']' || chars[j] == '}') {
                    i += 1;
                    continue;
                }
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    serde_json::from_str(&result).map_err(|e| format!("Failed to parse JSON: {}", e))
}

/// Write settings to a .vscode/settings.json file
fn write_vscode_settings(workspace_path: &Path, settings: &Value) -> Result<(), String> {
    let vscode_dir = ensure_vscode_folder(workspace_path)?;
    let settings_path = vscode_dir.join("settings.json");

    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    info!("Wrote workspace settings to {:?}", settings_path);
    Ok(())
}

/// Write settings to a .cortex/settings.json file
fn write_cortex_settings(workspace_path: &Path, settings: &Value) -> Result<(), String> {
    let cortex_dir = ensure_cortex_folder(workspace_path)?;
    let settings_path = cortex_dir.join("settings.json");

    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    info!("Wrote workspace settings to {:?}", settings_path);
    Ok(())
}

/// Get a nested value from a JSON object using dot notation
fn get_nested_value(obj: &Value, key: &str) -> Option<Value> {
    let parts: Vec<&str> = key.split('.').collect();
    let mut current = obj;

    for part in parts {
        match current {
            Value::Object(map) => {
                current = map.get(part)?;
            }
            _ => return None,
        }
    }

    Some(current.clone())
}

/// Set a nested value in a JSON object using dot notation
fn set_nested_value(obj: &mut Value, key: &str, value: Value) {
    let parts: Vec<&str> = key.split('.').collect();
    let mut current = obj;

    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            // Last part - set the value
            if let Value::Object(map) = current {
                map.insert((*part).to_string(), value);
            }
            return;
        }

        // Ensure intermediate objects exist
        if let Value::Object(map) = current {
            if !map.contains_key(*part) {
                map.insert((*part).to_string(), Value::Object(Map::new()));
            }
            if let Some(val) = map.get_mut(*part) {
                current = val;
            } else {
                return;
            }
        } else {
            return;
        }
    }
}

/// Remove a nested value from a JSON object using dot notation
fn remove_nested_value(obj: &mut Value, key: &str) -> bool {
    let parts: Vec<&str> = key.split('.').collect();

    if parts.len() == 1 {
        if let Value::Object(map) = obj {
            return map.remove(parts[0]).is_some();
        }
        return false;
    }

    let mut current = obj;
    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            if let Value::Object(map) = current {
                return map.remove(*part).is_some();
            }
            return false;
        }

        if let Value::Object(map) = current {
            if let Some(next) = map.get_mut(*part) {
                current = next;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    false
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Get workspace settings from .vscode/settings.json
#[tauri::command]
pub async fn settings_get_workspace(workspace_path: String) -> Result<Value, String> {
    let path = PathBuf::from(&workspace_path);

    // Try .vscode/settings.json first, then .cortex/settings.json
    let vscode_settings = read_vscode_settings(&path);
    if let Ok(settings) = vscode_settings {
        if let Value::Object(ref map) = settings {
            if !map.is_empty() {
                return Ok(settings);
            }
        }
    }

    // Fall back to .cortex/settings.json
    read_cortex_settings(&path)
}

/// Set a single setting in workspace settings
#[tauri::command]
pub async fn settings_set_workspace(
    workspace_path: String,
    key: String,
    value: Value,
) -> Result<(), String> {
    let path = PathBuf::from(&workspace_path);

    // Read existing settings (prefer .vscode if it exists)
    let vscode_path = path.join(".vscode").join("settings.json");
    let use_vscode = vscode_path.exists();

    let mut settings = if use_vscode {
        read_vscode_settings(&path)?
    } else {
        read_cortex_settings(&path).unwrap_or_else(|_| Value::Object(Map::new()))
    };

    // Set the value
    set_nested_value(&mut settings, &key, value);

    // Write back
    if use_vscode {
        write_vscode_settings(&path, &settings)
    } else {
        write_cortex_settings(&path, &settings)
    }
}

/// Remove a setting from workspace settings
#[tauri::command]
pub async fn settings_remove_workspace(workspace_path: String, key: String) -> Result<(), String> {
    let path = PathBuf::from(&workspace_path);

    // Try both locations
    let vscode_path = path.join(".vscode").join("settings.json");
    let use_vscode = vscode_path.exists();

    let mut settings = if use_vscode {
        read_vscode_settings(&path)?
    } else {
        read_cortex_settings(&path)?
    };

    // Remove the value
    remove_nested_value(&mut settings, &key);

    // Write back
    if use_vscode {
        write_vscode_settings(&path, &settings)
    } else {
        write_cortex_settings(&path, &settings)
    }
}

/// Write complete workspace settings file
#[tauri::command]
pub async fn settings_set_workspace_file(
    workspace_path: String,
    content: Value,
) -> Result<(), String> {
    let path = PathBuf::from(&workspace_path);

    // Prefer .vscode if it exists, otherwise use .cortex
    let vscode_path = path.join(".vscode").join("settings.json");
    if vscode_path.exists() || path.join(".vscode").exists() {
        write_vscode_settings(&path, &content)
    } else {
        write_cortex_settings(&path, &content)
    }
}

/// Get folder-specific settings (for multi-root workspaces)
#[tauri::command]
pub async fn settings_get_folder(folder_path: String) -> Result<Value, String> {
    let path = PathBuf::from(&folder_path);

    // Try .vscode/settings.json first
    let vscode_settings = read_vscode_settings(&path);
    if let Ok(settings) = vscode_settings {
        if let Value::Object(ref map) = settings {
            if !map.is_empty() {
                return Ok(settings);
            }
        }
    }

    // Fall back to .cortex/settings.json
    read_cortex_settings(&path)
}

/// Set folder-specific settings
#[tauri::command]
pub async fn settings_set_folder(
    folder_path: String,
    key: String,
    value: Value,
) -> Result<(), String> {
    let path = PathBuf::from(&folder_path);

    // Read existing settings
    let vscode_path = path.join(".vscode").join("settings.json");
    let use_vscode = vscode_path.exists() || path.join(".vscode").exists();

    let mut settings = if use_vscode {
        read_vscode_settings(&path).unwrap_or_else(|_| Value::Object(Map::new()))
    } else {
        read_cortex_settings(&path).unwrap_or_else(|_| Value::Object(Map::new()))
    };

    // Set the value
    set_nested_value(&mut settings, &key, value);

    // Write back
    if use_vscode {
        write_vscode_settings(&path, &settings)
    } else {
        write_cortex_settings(&path, &settings)
    }
}

/// Write complete folder settings file
#[tauri::command]
pub async fn settings_set_folder_file(folder_path: String, content: Value) -> Result<(), String> {
    let path = PathBuf::from(&folder_path);

    // Prefer .vscode if it exists
    let vscode_path = path.join(".vscode").join("settings.json");
    if vscode_path.exists() || path.join(".vscode").exists() {
        write_vscode_settings(&path, &content)
    } else {
        write_cortex_settings(&path, &content)
    }
}

/// Get language-specific settings
#[tauri::command]
pub async fn settings_get_language(
    language_id: String,
    workspace_path: Option<String>,
) -> Result<Value, String> {
    let key = format!("[{}]", language_id);

    // Try workspace settings first if provided
    if let Some(ws_path) = workspace_path {
        let ws_settings = settings_get_workspace(ws_path).await?;
        if let Value::Object(map) = &ws_settings {
            if let Some(lang_settings) = map.get(&key) {
                return Ok(lang_settings.clone());
            }
        }
    }

    // Return empty object if not found
    Ok(Value::Object(Map::new()))
}

/// Set language-specific settings
#[tauri::command]
pub async fn settings_set_language(
    language_id: String,
    key: String,
    value: Value,
    workspace_path: Option<String>,
) -> Result<(), String> {
    let lang_key = format!("[{}]", language_id);

    if let Some(ws_path) = workspace_path {
        let path = PathBuf::from(&ws_path);

        // Read existing settings
        let mut settings = read_vscode_settings(&path)
            .or_else(|_| read_cortex_settings(&path))
            .unwrap_or_else(|_| Value::Object(Map::new()));

        // Get or create language section
        let lang_section = if let Value::Object(ref mut map) = settings {
            if !map.contains_key(&lang_key) {
                map.insert(lang_key.clone(), Value::Object(Map::new()));
            }
            match map.get_mut(&lang_key) {
                Some(section) => section,
                None => return Err("Failed to get language section".to_string()),
            }
        } else {
            return Err("Settings must be an object".to_string());
        };

        // Set the value in the language section
        set_nested_value(lang_section, &key, value);

        // Write back
        let vscode_path = path.join(".vscode").join("settings.json");
        if vscode_path.exists() {
            write_vscode_settings(&path, &settings)
        } else {
            write_cortex_settings(&path, &settings)
        }
    } else {
        Err("Workspace path required for language settings".to_string())
    }
}

/// Get effective setting value considering all hierarchy levels
#[tauri::command]
pub async fn settings_get_effective(
    key: String,
    workspace_path: Option<String>,
    folder_path: Option<String>,
    language_id: Option<String>,
    app: tauri::AppHandle,
) -> Result<SettingInfo, String> {
    // Start with default value (would need to be provided or looked up)
    let default_value = None;

    // Try language-specific settings first (highest priority)
    if let Some(lang) = &language_id {
        if let Some(ref folder) = folder_path {
            let folder_settings = settings_get_folder(folder.clone()).await?;
            let lang_key = format!("[{}]", lang);
            if let Value::Object(map) = &folder_settings {
                if let Some(Value::Object(lang_map)) = map.get(&lang_key) {
                    if let Some(value) = get_nested_value(&Value::Object(lang_map.clone()), &key) {
                        return Ok(SettingInfo {
                            key: key.clone(),
                            value,
                            scope: SettingsScope::Language,
                            scope_path: Some(folder.clone()),
                            default_value: default_value.clone(),
                            is_modified: true,
                        });
                    }
                }
            }
        }

        if let Some(ref ws_path) = workspace_path {
            let ws_settings = settings_get_workspace(ws_path.clone()).await?;
            let lang_key = format!("[{}]", lang);
            if let Value::Object(map) = &ws_settings {
                if let Some(Value::Object(lang_map)) = map.get(&lang_key) {
                    if let Some(value) = get_nested_value(&Value::Object(lang_map.clone()), &key) {
                        return Ok(SettingInfo {
                            key: key.clone(),
                            value,
                            scope: SettingsScope::Language,
                            scope_path: Some(ws_path.clone()),
                            default_value: default_value.clone(),
                            is_modified: true,
                        });
                    }
                }
            }
        }
    }

    // Try folder settings
    if let Some(folder) = &folder_path {
        let folder_settings = settings_get_folder(folder.clone()).await?;
        if let Some(value) = get_nested_value(&folder_settings, &key) {
            return Ok(SettingInfo {
                key: key.clone(),
                value,
                scope: SettingsScope::Folder,
                scope_path: Some(folder.clone()),
                default_value: default_value.clone(),
                is_modified: true,
            });
        }
    }

    // Try workspace settings
    if let Some(ws_path) = &workspace_path {
        let ws_settings = settings_get_workspace(ws_path.clone()).await?;
        if let Some(value) = get_nested_value(&ws_settings, &key) {
            return Ok(SettingInfo {
                key: key.clone(),
                value,
                scope: SettingsScope::Workspace,
                scope_path: Some(ws_path.clone()),
                default_value: default_value.clone(),
                is_modified: true,
            });
        }
    }

    // Try user settings
    let settings_state = app.state::<crate::settings::SettingsState>();
    let user_settings = settings_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire settings lock")?
        .clone();

    // Convert user settings to JSON and check for the key
    let user_json = serde_json::to_value(&user_settings)
        .map_err(|e| format!("Failed to serialize user settings: {}", e))?;

    if let Some(value) = get_nested_value(&user_json, &key) {
        return Ok(SettingInfo {
            key: key.clone(),
            value,
            scope: SettingsScope::User,
            scope_path: None,
            default_value: default_value.clone(),
            is_modified: true, // Would need to compare with default
        });
    }

    // Return default
    Ok(SettingInfo {
        key,
        value: default_value.clone().unwrap_or(Value::Null),
        scope: SettingsScope::Default,
        scope_path: None,
        default_value,
        is_modified: false,
    })
}

/// Check if .vscode folder exists
#[tauri::command]
pub async fn settings_has_vscode_folder(workspace_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&workspace_path);
    Ok(path.join(".vscode").exists())
}

/// Create .vscode folder if it doesn't exist
#[tauri::command]
pub async fn settings_ensure_vscode_folder(workspace_path: String) -> Result<String, String> {
    let path = PathBuf::from(&workspace_path);
    let vscode_dir = ensure_vscode_folder(&path)?;
    Ok(vscode_dir.to_string_lossy().to_string())
}

/// Get the settings file path for a workspace
#[tauri::command]
pub async fn settings_get_workspace_path(workspace_path: String) -> Result<String, String> {
    let path = PathBuf::from(&workspace_path);

    // Check for .vscode/settings.json first
    let vscode_path = path.join(".vscode").join("settings.json");
    if vscode_path.exists() {
        return Ok(vscode_path.to_string_lossy().to_string());
    }

    // Check for .cortex/settings.json
    let cortex_path = path.join(".cortex").join("settings.json");
    if cortex_path.exists() {
        return Ok(cortex_path.to_string_lossy().to_string());
    }

    // Return .vscode path as default (will be created if needed)
    Ok(vscode_path.to_string_lossy().to_string())
}

/// Load settings from a *.code-workspace file
#[tauri::command]
pub async fn settings_load_code_workspace(file_path: String) -> Result<Value, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("Workspace file does not exist".to_string());
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read workspace file: {}", e))?;

    let workspace_file = parse_jsonc(&content)?;

    // Extract settings section
    if let Value::Object(map) = &workspace_file {
        if let Some(settings) = map.get("settings") {
            return Ok(settings.clone());
        }
    }

    Ok(Value::Object(Map::new()))
}

/// Save settings to a *.code-workspace file
#[tauri::command]
pub async fn settings_save_code_workspace(
    file_path: String,
    settings: Value,
) -> Result<(), String> {
    let path = PathBuf::from(&file_path);

    // Read existing workspace file or create new one
    let mut workspace_file = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read workspace file: {}", e))?;
        parse_jsonc(&content)?
    } else {
        let mut map = Map::new();
        map.insert("folders".to_string(), Value::Array(vec![]));
        Value::Object(map)
    };

    // Update settings section
    if let Value::Object(ref mut map) = workspace_file {
        map.insert("settings".to_string(), settings);
    }

    // Write back
    let content = serde_json::to_string_pretty(&workspace_file)
        .map_err(|e| format!("Failed to serialize workspace file: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write workspace file: {}", e))?;

    info!("Wrote workspace file to {:?}", path);
    Ok(())
}

/// Merge settings from multiple sources with proper priority
#[tauri::command]
pub async fn settings_merge_hierarchy(
    user_settings: Value,
    workspace_settings: Option<Value>,
    folder_settings: Option<Value>,
    language_settings: Option<Value>,
) -> Result<Value, String> {
    let mut result = user_settings;

    // Merge workspace settings
    if let Some(ws) = workspace_settings {
        merge_json(&mut result, &ws);
    }

    // Merge folder settings
    if let Some(folder) = folder_settings {
        merge_json(&mut result, &folder);
    }

    // Merge language-specific settings
    if let Some(lang) = language_settings {
        merge_json(&mut result, &lang);
    }

    Ok(result)
}

/// Deep merge two JSON objects
fn merge_json(target: &mut Value, source: &Value) {
    match (target, source) {
        (Value::Object(target_map), Value::Object(source_map)) => {
            for (key, source_value) in source_map {
                if let Some(target_value) = target_map.get_mut(key) {
                    merge_json(target_value, source_value);
                } else {
                    target_map.insert(key.clone(), source_value.clone());
                }
            }
        }
        (target, source) => {
            *target = source.clone();
        }
    }
}

/// Get folder-level settings overrides for all workspace folders
#[tauri::command]
pub async fn settings_get_folder_overrides(
    folder_paths: Vec<String>,
) -> Result<Vec<(String, Value)>, String> {
    let mut results = Vec::new();
    for folder_path in folder_paths {
        let path = PathBuf::from(&folder_path);
        let settings = read_vscode_settings(&path)
            .or_else(|_| read_cortex_settings(&path))
            .unwrap_or_else(|_| Value::Object(Map::new()));
        results.push((folder_path, settings));
    }
    Ok(results)
}

/// Resolve effective settings for a file by finding its workspace folder
#[tauri::command]
pub async fn settings_resolve_for_file(
    file_path: String,
    workspace_folders: Vec<String>,
    workspace_path: Option<String>,
    language_id: Option<String>,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    let file = PathBuf::from(&file_path);

    // Find which workspace folder contains this file
    let mut matched_folder: Option<String> = None;
    for folder in &workspace_folders {
        let folder_path = PathBuf::from(folder);
        if let (Ok(canonical_file), Ok(canonical_folder)) = (
            std::fs::canonicalize(&file),
            std::fs::canonicalize(&folder_path),
        ) {
            if canonical_file.starts_with(&canonical_folder) {
                matched_folder = Some(folder.clone());
                break;
            }
        }
        // Fallback: simple string prefix check
        let normalized_file = file_path.replace('\\', "/");
        let normalized_folder = folder.replace('\\', "/");
        if normalized_file.starts_with(&normalized_folder) {
            matched_folder = Some(folder.clone());
            break;
        }
    }

    // Get user settings
    let settings_state = app.state::<crate::settings::SettingsState>();
    let user_settings = settings_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire settings lock")?
        .clone();
    let mut result = serde_json::to_value(&user_settings)
        .map_err(|e| format!("Failed to serialize user settings: {}", e))?;

    // Merge workspace settings
    if let Some(ref ws_path) = workspace_path {
        let ws_settings = settings_get_workspace(ws_path.clone()).await?;
        merge_json(&mut result, &ws_settings);
    }

    // Merge folder settings
    if let Some(ref folder) = matched_folder {
        let folder_settings = settings_get_folder(folder.clone()).await?;
        merge_json(&mut result, &folder_settings);
    }

    // Merge language-specific settings
    if let Some(ref lang) = language_id {
        let lang_key = format!("[{}]", lang);

        // Check folder language settings
        if let Some(ref folder) = matched_folder {
            let folder_settings = settings_get_folder(folder.clone()).await?;
            if let Value::Object(map) = &folder_settings {
                if let Some(lang_settings) = map.get(&lang_key) {
                    merge_json(&mut result, lang_settings);
                }
            }
        }

        // Check workspace language settings
        if let Some(ref ws_path) = workspace_path {
            let ws_settings = settings_get_workspace(ws_path.clone()).await?;
            if let Value::Object(map) = &ws_settings {
                if let Some(lang_settings) = map.get(&lang_key) {
                    merge_json(&mut result, lang_settings);
                }
            }
        }
    }

    Ok(result)
}
