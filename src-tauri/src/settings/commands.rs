//! Tauri commands for settings management
//!
//! This module contains all the Tauri command handlers for settings operations:
//! - Loading and saving settings
//! - Getting and updating individual sections
//! - Resetting settings to defaults
//! - Import/export functionality
//! - Extension settings management
//! - Secure API key management

use std::collections::HashMap;
use std::fs;

use tauri::{AppHandle, Manager};
use tracing::info;

use super::secure_store::SecureApiKeyStore;
use super::storage::{SettingsState, ensure_settings_dir, get_settings_path, set_file_permissions};
use super::types::{
    AISettings, CommandPaletteSettings, CortexSettings, DebugSettings, EditorSettings,
    ExplorerSettings, ExtensionSettingsMap, FilesSettings, HttpSettings, LanguageEditorOverride,
    ScreencastModeSettings, SearchSettings, SecuritySettings, TerminalSettings, ThemeSettings,
    WorkbenchSettings, ZenModeSettings,
};

/// Load settings from disk
#[tauri::command]
pub async fn settings_load(app: AppHandle) -> Result<CortexSettings, String> {
    let settings_state = app.state::<SettingsState>();

    // Return cached settings if already preloaded
    {
        let guard = settings_state
            .0
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        // Check if settings are already loaded (version > 0 means initialized)
        if guard.version > 0 {
            return Ok(guard.clone());
        }
    }

    let settings_path = get_settings_path()?;

    let settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings file: {}", e))?;

        match serde_json::from_str::<CortexSettings>(&content) {
            Ok(mut loaded) => {
                loaded.migrate();

                // Update API key presence flags from keyring
                loaded.ai.has_supermaven_api_key =
                    SecureApiKeyStore::has_api_key("supermaven_api_key").unwrap_or(false);
                loaded.http.has_proxy_authorization =
                    SecureApiKeyStore::has_api_key("proxy_authorization").unwrap_or(false);

                loaded
            }
            Err(e) => {
                tracing::warn!("Failed to parse settings, using defaults: {}", e);
                CortexSettings::default()
            }
        }
    } else {
        info!("No settings file found, using defaults");
        CortexSettings::default()
    };

    // Update state
    if let Ok(mut guard) = settings_state.0.lock() {
        *guard = settings.clone();
    }

    Ok(settings)
}

/// Save settings to disk
#[tauri::command]
pub async fn settings_save(app: AppHandle, settings: CortexSettings) -> Result<(), String> {
    let settings_state = app.state::<SettingsState>();

    // Ensure directory exists
    ensure_settings_dir()?;
    let settings_path = get_settings_path()?;

    // Serialize with pretty printing
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    // Write to file
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    // Set restrictive permissions
    set_file_permissions(&settings_path)?;

    // Update state
    if let Ok(mut guard) = settings_state.0.lock() {
        *guard = settings;
    }

    info!("Settings saved to {:?}", settings_path);
    Ok(())
}

/// Get current settings from state
#[tauri::command]
pub async fn settings_get(app: AppHandle) -> Result<CortexSettings, String> {
    let settings_state = app.state::<SettingsState>();

    let settings = settings_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire settings lock")?
        .clone();

    Ok(settings)
}

/// Update a specific section of settings
#[tauri::command]
pub async fn settings_update(
    app: AppHandle,
    section: String,
    value: serde_json::Value,
) -> Result<CortexSettings, String> {
    let settings_state = app.state::<SettingsState>();

    let mut settings = settings_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire settings lock")?
        .clone();

    // Update the specific section
    match section.as_str() {
        "editor" => {
            settings.editor = serde_json::from_value(value)
                .map_err(|e| format!("Invalid editor settings: {}", e))?;
        }
        "theme" => {
            settings.theme = serde_json::from_value(value)
                .map_err(|e| format!("Invalid theme settings: {}", e))?;
        }
        "terminal" => {
            settings.terminal = serde_json::from_value(value)
                .map_err(|e| format!("Invalid terminal settings: {}", e))?;
        }
        "ai" => {
            settings.ai =
                serde_json::from_value(value).map_err(|e| format!("Invalid AI settings: {}", e))?;
        }
        "security" => {
            settings.security = serde_json::from_value(value)
                .map_err(|e| format!("Invalid security settings: {}", e))?;
        }
        "debug" => {
            settings.debug = serde_json::from_value(value)
                .map_err(|e| format!("Invalid debug settings: {}", e))?;
        }
        "files" => {
            settings.files = serde_json::from_value(value)
                .map_err(|e| format!("Invalid files settings: {}", e))?;
        }
        "http" => {
            settings.http = serde_json::from_value(value)
                .map_err(|e| format!("Invalid HTTP settings: {}", e))?;
        }
        "explorer" => {
            settings.explorer = serde_json::from_value(value)
                .map_err(|e| format!("Invalid explorer settings: {}", e))?;
        }
        "zenMode" => {
            settings.zen_mode = serde_json::from_value(value)
                .map_err(|e| format!("Invalid zen mode settings: {}", e))?;
        }
        "screencastMode" => {
            settings.screencast_mode = serde_json::from_value(value)
                .map_err(|e| format!("Invalid screencast mode settings: {}", e))?;
        }
        "search" => {
            settings.search = serde_json::from_value(value)
                .map_err(|e| format!("Invalid search settings: {}", e))?;
        }
        "commandPalette" => {
            settings.command_palette = serde_json::from_value(value)
                .map_err(|e| format!("Invalid command palette settings: {}", e))?;
        }
        "workbench" => {
            settings.workbench = serde_json::from_value(value)
                .map_err(|e| format!("Invalid workbench settings: {}", e))?;
        }
        "extensions" => {
            settings.extensions = serde_json::from_value(value)
                .map_err(|e| format!("Invalid extensions settings: {}", e))?;
        }
        "vimEnabled" => {
            settings.vim_enabled = value.as_bool().ok_or("vimEnabled must be a boolean")?;
        }
        "languageOverrides" => {
            settings.language_overrides = serde_json::from_value(value)
                .map_err(|e| format!("Invalid language overrides settings: {}", e))?;
        }
        _ => {
            // Handle language-specific settings like "[python]", "[javascript]", etc.
            if section.starts_with('[') && section.ends_with(']') {
                let language_override: LanguageEditorOverride = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid language override for {}: {}", section, e))?;
                settings
                    .language_overrides
                    .insert(section, language_override);
            } else {
                return Err(format!("Unknown settings section: {}", section));
            }
        }
    }

    // Save and update state
    ensure_settings_dir()?;
    let settings_path = get_settings_path()?;

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    set_file_permissions(&settings_path)?;

    if let Ok(mut guard) = settings_state.0.lock() {
        *guard = settings.clone();
    }

    Ok(settings)
}

/// Reset settings to defaults
#[tauri::command]
pub async fn settings_reset(app: AppHandle) -> Result<CortexSettings, String> {
    let default_settings = CortexSettings::default();
    settings_save(app, default_settings.clone()).await?;
    Ok(default_settings)
}

/// Reset a specific section to defaults
#[tauri::command]
pub async fn settings_reset_section(
    app: AppHandle,
    section: String,
) -> Result<CortexSettings, String> {
    let settings_state = app.state::<SettingsState>();

    let mut settings = settings_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire settings lock")?
        .clone();

    match section.as_str() {
        "editor" => settings.editor = EditorSettings::default(),
        "theme" => settings.theme = ThemeSettings::default(),
        "terminal" => settings.terminal = TerminalSettings::default(),
        "ai" => settings.ai = AISettings::default(),
        "security" => settings.security = SecuritySettings::default(),
        "debug" => settings.debug = DebugSettings::default(),
        "files" => settings.files = FilesSettings::default(),
        "http" => settings.http = HttpSettings::default(),
        "explorer" => settings.explorer = ExplorerSettings::default(),
        "zenMode" => settings.zen_mode = ZenModeSettings::default(),
        "screencastMode" => settings.screencast_mode = ScreencastModeSettings::default(),
        "search" => settings.search = SearchSettings::default(),
        "commandPalette" => settings.command_palette = CommandPaletteSettings::default(),
        "workbench" => settings.workbench = WorkbenchSettings::default(),
        "extensions" => settings.extensions = ExtensionSettingsMap::default(),
        "vimEnabled" => settings.vim_enabled = false,
        "languageOverrides" => settings.language_overrides = HashMap::new(),
        _ => {
            // Handle language-specific settings like "[python]", "[javascript]", etc.
            if section.starts_with('[') && section.ends_with(']') {
                settings.language_overrides.remove(&section);
            } else {
                return Err(format!("Unknown settings section: {}", section));
            }
        }
    }

    settings_save(app, settings.clone()).await?;
    Ok(settings)
}

/// Get the settings file path
#[tauri::command]
pub async fn settings_get_path() -> Result<String, String> {
    get_settings_path().map(|p| p.to_string_lossy().to_string())
}

/// Export settings to a JSON string
#[tauri::command]
pub async fn settings_export(app: AppHandle) -> Result<String, String> {
    let settings = settings_get(app).await?;
    serde_json::to_string_pretty(&settings).map_err(|e| format!("Failed to export settings: {}", e))
}

/// Import settings from a JSON string
#[tauri::command]
pub async fn settings_import(app: AppHandle, json: String) -> Result<CortexSettings, String> {
    let mut settings: CortexSettings =
        serde_json::from_str(&json).map_err(|e| format!("Invalid settings JSON: {}", e))?;

    settings.migrate();
    settings_save(app, settings.clone()).await?;
    Ok(settings)
}

/// Get extension-specific settings
#[tauri::command]
pub async fn settings_get_extension(
    app: AppHandle,
    extension_id: String,
) -> Result<serde_json::Value, String> {
    let settings = settings_get(app).await?;
    Ok(settings
        .extensions
        .extensions
        .get(&extension_id)
        .cloned()
        .unwrap_or(serde_json::Value::Object(serde_json::Map::new())))
}

/// Set extension-specific settings
#[tauri::command]
pub async fn settings_set_extension(
    app: AppHandle,
    extension_id: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let settings_state = app.state::<SettingsState>();

    let mut settings = settings_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire settings lock")?
        .clone();

    settings.extensions.extensions.insert(extension_id, value);

    // Save
    ensure_settings_dir()?;
    let settings_path = get_settings_path()?;

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    set_file_permissions(&settings_path)?;

    if let Ok(mut guard) = settings_state.0.lock() {
        *guard = settings;
    }

    Ok(())
}

// === Secure API key commands ===

/// Store an API key securely in the keyring
#[tauri::command]
pub async fn settings_set_api_key(
    app: AppHandle,
    key_name: String,
    api_key: String,
) -> Result<(), String> {
    SecureApiKeyStore::set_api_key(&key_name, &api_key)?;

    // Update settings to reflect that key exists
    let settings_state = app.state::<SettingsState>();
    if let Ok(mut settings) = settings_state.0.lock() {
        match key_name.as_str() {
            "supermaven_api_key" => settings.ai.has_supermaven_api_key = true,
            "proxy_authorization" => settings.http.has_proxy_authorization = true,
            _ => {}
        }
    }

    Ok(())
}

/// Get an API key from the keyring (returns redacted version for UI)
#[tauri::command]
pub async fn settings_get_api_key_exists(key_name: String) -> Result<bool, String> {
    SecureApiKeyStore::has_api_key(&key_name)
}

/// Delete an API key from the keyring
#[tauri::command]
pub async fn settings_delete_api_key(app: AppHandle, key_name: String) -> Result<bool, String> {
    let deleted = SecureApiKeyStore::delete_api_key(&key_name)?;

    // Update settings to reflect that key is gone
    if deleted {
        let settings_state = app.state::<SettingsState>();
        if let Ok(mut settings) = settings_state.0.lock() {
            match key_name.as_str() {
                "supermaven_api_key" => settings.ai.has_supermaven_api_key = false,
                "proxy_authorization" => settings.http.has_proxy_authorization = false,
                _ => {}
            }
        };
    }

    Ok(deleted)
}
