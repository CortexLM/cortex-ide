//! Extension API commands for themes, languages, commands, panels, settings, keybindings, and snippets.
//!
//! This module provides Tauri commands to access extension contributions like themes,
//! language definitions, commands, panels, settings, keybindings, and snippets.

use std::fs;
use tauri::{AppHandle, Manager};

use super::state::ExtensionsState;
use super::types::{
    CommandContribution, ConfigurationContribution, ExtensionTheme, GrammarContribution,
    KeybindingContribution, LanguageContribution, MenuContribution, PanelContribution,
    SettingsContribution, SnippetContribution, ViewContainerContribution, ViewContribution,
};

// ============================================================================
// Theme Management
// ============================================================================

/// Get all available themes from enabled extensions
#[tauri::command]
pub async fn get_extension_themes(app: AppHandle) -> Result<Vec<ExtensionTheme>, String> {
    let state = app.state::<ExtensionsState>();
    let extensions = {
        let manager = state.0.lock();
        manager.get_enabled_extensions()
    };

    tokio::task::spawn_blocking(move || {
        let mut themes = Vec::new();

        for ext in extensions {
            for theme_contrib in &ext.manifest.contributes.themes {
                let theme_path = ext.path.join(&theme_contrib.path);
                if theme_path.exists() {
                    if let Ok(content) = fs::read_to_string(&theme_path) {
                        if let Ok(colors) = serde_json::from_str::<serde_json::Value>(&content) {
                            themes.push(ExtensionTheme {
                                id: theme_contrib.id.clone(),
                                name: theme_contrib.label.clone(),
                                extension_name: ext.manifest.name.clone(),
                                ui_theme: theme_contrib.ui_theme.clone(),
                                colors,
                            });
                        }
                    }
                }
            }
        }

        Ok(themes)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Command Management
// ============================================================================

/// Get all commands from enabled extensions
#[tauri::command]
pub async fn get_extension_commands(app: AppHandle) -> Result<Vec<CommandContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut commands = Vec::new();

    for ext in manager.get_enabled_extensions() {
        commands.extend(ext.manifest.contributes.commands.clone());
    }

    Ok(commands)
}

// ============================================================================
// Language Management
// ============================================================================

/// Get all language contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_languages(app: AppHandle) -> Result<Vec<LanguageContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut languages = Vec::new();

    for ext in manager.get_enabled_extensions() {
        languages.extend(ext.manifest.contributes.languages.clone());
    }

    Ok(languages)
}

// ============================================================================
// Panel Management
// ============================================================================

/// Get all panel contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_panels(app: AppHandle) -> Result<Vec<PanelContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut panels = Vec::new();

    for ext in manager.get_enabled_extensions() {
        panels.extend(ext.manifest.contributes.panels.clone());
    }

    Ok(panels)
}

// ============================================================================
// Settings Management
// ============================================================================

/// Get all settings contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_settings(app: AppHandle) -> Result<Vec<SettingsContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut settings = Vec::new();

    for ext in manager.get_enabled_extensions() {
        settings.extend(ext.manifest.contributes.settings.clone());
    }

    Ok(settings)
}

// ============================================================================
// Keybinding Management
// ============================================================================

/// Get all keybinding contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_keybindings(
    app: AppHandle,
) -> Result<Vec<KeybindingContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut keybindings = Vec::new();

    for ext in manager.get_enabled_extensions() {
        keybindings.extend(ext.manifest.contributes.keybindings.clone());
    }

    Ok(keybindings)
}

// ============================================================================
// Snippet Management
// ============================================================================

/// Get all snippet contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_snippets(app: AppHandle) -> Result<Vec<SnippetContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut snippets = Vec::new();

    for ext in manager.get_enabled_extensions() {
        snippets.extend(ext.manifest.contributes.snippets.clone());
    }

    Ok(snippets)
}

// ============================================================================
// Extension Command Execution
// ============================================================================

/// Execute a command in an extension
#[tauri::command]
pub async fn execute_extension_command(
    app: AppHandle,
    extension_id: String,
    command: String,
    args: Option<Vec<serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock();

    let args_json = serde_json::to_string(&args.unwrap_or_default())
        .map_err(|e| format!("Failed to serialize args: {}", e))?;

    let result = manager
        .wasm_runtime
        .execute_command(&extension_id, &command, &args_json)?;

    serde_json::from_str(&result).unwrap_or(Ok(serde_json::Value::String(result)))
}

// ============================================================================
// Menu Management
// ============================================================================

/// Get all menu contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_menus(app: AppHandle) -> Result<Vec<MenuContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut menus = Vec::new();

    for ext in manager.get_enabled_extensions() {
        menus.extend(ext.manifest.contributes.menus.clone());
    }

    Ok(menus)
}

// ============================================================================
// View Container Management
// ============================================================================

/// Get all view container contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_views_containers(
    app: AppHandle,
) -> Result<Vec<ViewContainerContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut containers = Vec::new();

    for ext in manager.get_enabled_extensions() {
        containers.extend(ext.manifest.contributes.views_containers.clone());
    }

    Ok(containers)
}

// ============================================================================
// View Management
// ============================================================================

/// Get all view contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_views(app: AppHandle) -> Result<Vec<ViewContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut views = Vec::new();

    for ext in manager.get_enabled_extensions() {
        views.extend(ext.manifest.contributes.views.clone());
    }

    Ok(views)
}

// ============================================================================
// Configuration Management
// ============================================================================

/// Get all configuration contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_configuration(
    app: AppHandle,
) -> Result<Vec<ConfigurationContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut configs = Vec::new();

    for ext in manager.get_enabled_extensions() {
        configs.extend(ext.manifest.contributes.configuration.clone());
    }

    Ok(configs)
}

// ============================================================================
// Grammar Management
// ============================================================================

/// Get all grammar contributions from enabled extensions
#[tauri::command]
pub async fn get_extension_grammars(app: AppHandle) -> Result<Vec<GrammarContribution>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();

    let mut grammars = Vec::new();

    for ext in manager.get_enabled_extensions() {
        grammars.extend(ext.manifest.contributes.grammars.clone());
    }

    Ok(grammars)
}
