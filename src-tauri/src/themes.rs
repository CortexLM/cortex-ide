//! Theme Management Backend
//!
//! Provides theme loading, storage, and export for Cortex Desktop.
//! Supports both Cortex native and VS Code theme formats with
//! concurrent state management via DashMap.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

// ============================================================================
// Types
// ============================================================================

/// Source origin of a theme
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ThemeSource {
    BuiltIn,
    Plugin,
    Custom,
    VSCode,
}

/// A single token color rule for syntax highlighting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenColorRule {
    pub scope: Option<Vec<String>>,
    pub settings: HashMap<String, String>,
}

/// Full theme data including colors and token rules
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeData {
    pub id: String,
    pub name: String,
    pub theme_type: String,
    pub colors: HashMap<String, String>,
    pub token_colors: Vec<TokenColorRule>,
    pub source: ThemeSource,
}

/// Raw theme file format for deserialization (Cortex / VS Code compatible)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawThemeFile {
    name: Option<String>,
    #[serde(alias = "type")]
    theme_type: Option<String>,
    #[serde(default)]
    colors: HashMap<String, String>,
    #[serde(default, alias = "tokenColors")]
    token_colors: Vec<RawTokenColorRule>,
}

/// Raw token color rule from theme JSON
#[derive(Debug, Deserialize)]
struct RawTokenColorRule {
    scope: Option<RawScope>,
    #[serde(default)]
    settings: HashMap<String, String>,
}

/// Scope can be a single string or a list of strings
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RawScope {
    Single(String),
    Multiple(Vec<String>),
}

// ============================================================================
// State
// ============================================================================

/// Concurrent theme state backed by DashMap
#[derive(Clone)]
pub struct ThemeState {
    themes: DashMap<String, ThemeData>,
}

impl ThemeState {
    pub fn new() -> Self {
        Self {
            themes: DashMap::new(),
        }
    }
}

impl Default for ThemeState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Generate a kebab-case theme ID from a display name
fn generate_theme_id(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Create built-in theme stubs for default population
fn create_builtin_stubs() -> Vec<ThemeData> {
    vec![
        ThemeData {
            id: "dark-plus".to_string(),
            name: "Dark+".to_string(),
            theme_type: "dark".to_string(),
            colors: HashMap::new(),
            token_colors: Vec::new(),
            source: ThemeSource::BuiltIn,
        },
        ThemeData {
            id: "light-plus".to_string(),
            name: "Light+".to_string(),
            theme_type: "light".to_string(),
            colors: HashMap::new(),
            token_colors: Vec::new(),
            source: ThemeSource::BuiltIn,
        },
        ThemeData {
            id: "high-contrast".to_string(),
            name: "High Contrast".to_string(),
            theme_type: "dark".to_string(),
            colors: HashMap::new(),
            token_colors: Vec::new(),
            source: ThemeSource::BuiltIn,
        },
        ThemeData {
            id: "high-contrast-light".to_string(),
            name: "High Contrast Light".to_string(),
            theme_type: "light".to_string(),
            colors: HashMap::new(),
            token_colors: Vec::new(),
            source: ThemeSource::BuiltIn,
        },
    ]
}

/// Convert a raw token color rule to the public type
fn convert_token_rule(raw: RawTokenColorRule) -> TokenColorRule {
    let scope = raw.scope.map(|s| match s {
        RawScope::Single(single) => vec![single],
        RawScope::Multiple(multiple) => multiple,
    });
    TokenColorRule {
        scope,
        settings: raw.settings,
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Load a theme JSON file from disk (Cortex or VS Code format)
#[tauri::command]
pub async fn load_theme_file(
    path: String,
    state: tauri::State<'_, ThemeState>,
) -> Result<ThemeData, String> {
    let file_path = path.clone();

    let content = tokio::task::spawn_blocking(move || std::fs::read_to_string(&file_path))
        .await
        .map_err(|e| format!("Failed to spawn blocking task: {}", e))?
        .map_err(|e| format!("Failed to read theme file '{}': {}", path, e))?;

    let raw: RawThemeFile =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse theme JSON: {}", e))?;

    let name = raw.name.unwrap_or_else(|| {
        std::path::Path::new(&path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown Theme")
            .to_string()
    });

    let theme_type = raw.theme_type.unwrap_or_else(|| "dark".to_string());
    let id = generate_theme_id(&name);

    if theme_type != "dark" && theme_type != "light" {
        warn!(
            theme_id = %id,
            theme_type = %theme_type,
            "Theme has non-standard type, defaulting behavior may vary"
        );
    }

    let token_colors: Vec<TokenColorRule> = raw
        .token_colors
        .into_iter()
        .map(convert_token_rule)
        .collect();

    let theme = ThemeData {
        id: id.clone(),
        name,
        theme_type,
        colors: raw.colors,
        token_colors,
        source: ThemeSource::VSCode,
    };

    state.themes.insert(id.clone(), theme.clone());
    info!(theme_id = %id, path = %path, "Loaded theme from file");

    Ok(theme)
}

/// List all available themes, populating with built-in stubs if empty
#[tauri::command]
pub async fn list_available_themes(
    state: tauri::State<'_, ThemeState>,
) -> Result<Vec<ThemeData>, String> {
    if state.themes.is_empty() {
        info!("No themes loaded, populating with built-in stubs");
        for stub in create_builtin_stubs() {
            state.themes.insert(stub.id.clone(), stub);
        }
    }

    let themes: Vec<ThemeData> = state
        .themes
        .iter()
        .map(|entry| entry.value().clone())
        .collect();

    Ok(themes)
}

/// Look up a theme by its ID
#[tauri::command]
pub async fn get_theme_by_id(
    id: String,
    state: tauri::State<'_, ThemeState>,
) -> Result<Option<ThemeData>, String> {
    let theme = state.themes.get(&id).map(|entry| entry.value().clone());
    Ok(theme)
}

/// Export a theme to disk as a JSON file
#[tauri::command]
pub async fn export_theme(
    id: String,
    path: String,
    state: tauri::State<'_, ThemeState>,
) -> Result<(), String> {
    let theme = state
        .themes
        .get(&id)
        .map(|entry| entry.value().clone())
        .ok_or_else(|| format!("Theme not found: {}", id))?;

    let json = serde_json::to_string_pretty(&theme)
        .map_err(|e| format!("Failed to serialize theme: {}", e))?;

    let export_path = path.clone();
    tokio::task::spawn_blocking(move || std::fs::write(&export_path, json))
        .await
        .map_err(|e| format!("Failed to spawn blocking task: {}", e))?
        .map_err(|e| format!("Failed to write theme file '{}': {}", path, e))?;

    info!(theme_id = %id, path = %path, "Exported theme to file");

    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn theme_source_serde_round_trip() {
        let variants = vec![
            (ThemeSource::BuiltIn, r#""builtin""#),
            (ThemeSource::Plugin, r#""plugin""#),
            (ThemeSource::Custom, r#""custom""#),
            (ThemeSource::VSCode, r#""vscode""#),
        ];
        for (variant, expected_json) in variants {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, expected_json);
            let deserialized: ThemeSource = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, variant);
        }
    }

    #[test]
    fn token_color_rule_serialization() {
        let mut settings = HashMap::new();
        settings.insert("foreground".to_string(), "#ff0000".to_string());
        let rule = TokenColorRule {
            scope: Some(vec!["comment".to_string(), "string".to_string()]),
            settings,
        };
        let json = serde_json::to_string(&rule).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["scope"][0], "comment");
        assert_eq!(parsed["scope"][1], "string");
        assert_eq!(parsed["settings"]["foreground"], "#ff0000");
    }

    #[test]
    fn token_color_rule_with_no_scope() {
        let rule = TokenColorRule {
            scope: None,
            settings: HashMap::new(),
        };
        let json = serde_json::to_string(&rule).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed["scope"].is_null());
    }

    #[test]
    fn theme_data_serde_round_trip() {
        let mut colors = HashMap::new();
        colors.insert("editor.background".to_string(), "#1e1e1e".to_string());
        let theme = ThemeData {
            id: "my-theme".to_string(),
            name: "My Theme".to_string(),
            theme_type: "dark".to_string(),
            colors,
            token_colors: vec![],
            source: ThemeSource::Custom,
        };
        let json = serde_json::to_string(&theme).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["themeType"], "dark");
        assert_eq!(parsed["tokenColors"], serde_json::json!([]));

        let deserialized: ThemeData = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "my-theme");
        assert_eq!(deserialized.name, "My Theme");
        assert_eq!(deserialized.theme_type, "dark");
        assert_eq!(deserialized.source, ThemeSource::Custom);
    }

    #[test]
    fn theme_state_new_is_empty() {
        let state = ThemeState::new();
        assert!(state.themes.is_empty());
    }

    #[test]
    fn theme_state_default_is_empty() {
        let state = ThemeState::default();
        assert!(state.themes.is_empty());
    }

    #[test]
    fn theme_state_insert_and_get() {
        let state = ThemeState::new();
        let theme = ThemeData {
            id: "test-id".to_string(),
            name: "Test".to_string(),
            theme_type: "dark".to_string(),
            colors: HashMap::new(),
            token_colors: vec![],
            source: ThemeSource::BuiltIn,
        };
        state.themes.insert("test-id".to_string(), theme);
        assert_eq!(state.themes.len(), 1);
        let retrieved = state.themes.get("test-id").unwrap();
        assert_eq!(retrieved.name, "Test");
    }

    #[test]
    fn theme_state_overwrite() {
        let state = ThemeState::new();
        let theme1 = ThemeData {
            id: "id".to_string(),
            name: "First".to_string(),
            theme_type: "dark".to_string(),
            colors: HashMap::new(),
            token_colors: vec![],
            source: ThemeSource::BuiltIn,
        };
        let theme2 = ThemeData {
            id: "id".to_string(),
            name: "Second".to_string(),
            theme_type: "light".to_string(),
            colors: HashMap::new(),
            token_colors: vec![],
            source: ThemeSource::Custom,
        };
        state.themes.insert("id".to_string(), theme1);
        state.themes.insert("id".to_string(), theme2);
        assert_eq!(state.themes.len(), 1);
        let retrieved = state.themes.get("id").unwrap();
        assert_eq!(retrieved.name, "Second");
    }

    #[test]
    fn generate_theme_id_normal() {
        assert_eq!(generate_theme_id("Dark Plus"), "dark-plus");
    }

    #[test]
    fn generate_theme_id_special_chars() {
        assert_eq!(generate_theme_id("My (Custom) Theme!"), "my-custom-theme");
    }

    #[test]
    fn generate_theme_id_multiple_spaces() {
        assert_eq!(generate_theme_id("A   B   C"), "a-b-c");
    }

    #[test]
    fn generate_theme_id_empty() {
        assert_eq!(generate_theme_id(""), "");
    }

    #[test]
    fn generate_theme_id_already_kebab() {
        assert_eq!(generate_theme_id("already-kebab"), "already-kebab");
    }

    #[test]
    fn create_builtin_stubs_returns_four() {
        let stubs = create_builtin_stubs();
        assert_eq!(stubs.len(), 4);
        let ids: Vec<&str> = stubs.iter().map(|s| s.id.as_str()).collect();
        assert!(ids.contains(&"dark-plus"));
        assert!(ids.contains(&"light-plus"));
        assert!(ids.contains(&"high-contrast"));
        assert!(ids.contains(&"high-contrast-light"));
    }

    #[test]
    fn create_builtin_stubs_all_builtin_source() {
        for stub in create_builtin_stubs() {
            assert_eq!(stub.source, ThemeSource::BuiltIn);
        }
    }

    #[test]
    fn convert_token_rule_single_scope() {
        let raw = RawTokenColorRule {
            scope: Some(RawScope::Single("comment".to_string())),
            settings: HashMap::new(),
        };
        let result = convert_token_rule(raw);
        assert_eq!(result.scope, Some(vec!["comment".to_string()]));
    }

    #[test]
    fn convert_token_rule_multiple_scope() {
        let raw = RawTokenColorRule {
            scope: Some(RawScope::Multiple(vec![
                "string".to_string(),
                "constant".to_string(),
            ])),
            settings: HashMap::new(),
        };
        let result = convert_token_rule(raw);
        assert_eq!(
            result.scope,
            Some(vec!["string".to_string(), "constant".to_string()])
        );
    }

    #[test]
    fn convert_token_rule_no_scope() {
        let raw = RawTokenColorRule {
            scope: None,
            settings: HashMap::new(),
        };
        let result = convert_token_rule(raw);
        assert!(result.scope.is_none());
    }

    #[test]
    fn convert_token_rule_preserves_settings() {
        let mut settings = HashMap::new();
        settings.insert("foreground".to_string(), "#aabbcc".to_string());
        settings.insert("fontStyle".to_string(), "italic".to_string());
        let raw = RawTokenColorRule {
            scope: None,
            settings,
        };
        let result = convert_token_rule(raw);
        assert_eq!(result.settings.len(), 2);
        assert_eq!(result.settings["foreground"], "#aabbcc");
        assert_eq!(result.settings["fontStyle"], "italic");
    }

    #[test]
    fn raw_theme_file_deserialization() {
        let json = r##"{
            "name": "Test Theme",
            "type": "dark",
            "colors": {"editor.background": "#000"},
            "tokenColors": [
                {"scope": "comment", "settings": {"foreground": "#888"}}
            ]
        }"##;
        let raw: RawThemeFile = serde_json::from_str(json).unwrap();
        assert_eq!(raw.name, Some("Test Theme".to_string()));
        assert_eq!(raw.theme_type, Some("dark".to_string()));
        assert_eq!(raw.colors.len(), 1);
        assert_eq!(raw.token_colors.len(), 1);
    }

    #[test]
    fn raw_theme_file_defaults_when_missing() {
        let json = r#"{}"#;
        let raw: RawThemeFile = serde_json::from_str(json).unwrap();
        assert!(raw.name.is_none());
        assert!(raw.theme_type.is_none());
        assert!(raw.colors.is_empty());
        assert!(raw.token_colors.is_empty());
    }
}
