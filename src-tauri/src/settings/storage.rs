//! Settings file storage and persistence
//!
//! This module handles the file system operations for settings:
//! - Path management (settings directory and file locations)
//! - Loading settings from disk
//! - Saving settings to disk
//! - File permissions management

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::AppHandle;
use tracing::{info, warn};

use super::secure_store::SecureApiKeyStore;
use super::types::CortexSettings;

/// State wrapper for settings
#[derive(Clone)]
pub struct SettingsState(pub Arc<Mutex<CortexSettings>>);

impl SettingsState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(CortexSettings::default())))
    }
}

impl Default for SettingsState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the settings file path
pub fn get_settings_path() -> Result<PathBuf, String> {
    let app_data = dirs::data_dir().ok_or("Could not find app data directory")?;
    let cortex_dir = app_data.join("Cortex");
    Ok(cortex_dir.join("settings.json"))
}

/// Ensure the settings directory exists
pub fn ensure_settings_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_dir().ok_or("Could not find app data directory")?;
    let cortex_dir = app_data.join("Cortex");

    if !cortex_dir.exists() {
        fs::create_dir_all(&cortex_dir)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    Ok(cortex_dir)
}

/// Set restrictive file permissions (0600 on Unix)
pub fn set_file_permissions(path: &PathBuf) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(path, perms)
            .map_err(|e| format!("Failed to set file permissions: {}", e))?;
    }

    #[cfg(not(unix))]
    {
        let _ = path; // Suppress unused warning on Windows
    }

    Ok(())
}

/// Load settings from disk (internal async helper)
pub async fn load_settings_from_disk() -> Result<CortexSettings, String> {
    let settings_path = get_settings_path()?;

    if settings_path.exists() {
        let content = tokio::fs::read_to_string(&settings_path)
            .await
            .map_err(|e| format!("Failed to read settings file: {}", e))?;

        match serde_json::from_str::<CortexSettings>(&content) {
            Ok(mut loaded) => {
                loaded.migrate();

                // Update API key presence flags from keyring
                loaded.ai.has_supermaven_api_key =
                    SecureApiKeyStore::has_api_key("supermaven_api_key").unwrap_or(false);
                loaded.http.has_proxy_authorization =
                    SecureApiKeyStore::has_api_key("proxy_authorization").unwrap_or(false);

                Ok(loaded)
            }
            Err(e) => {
                warn!("Failed to parse settings, using defaults: {}", e);
                Ok(CortexSettings::default())
            }
        }
    } else {
        info!("No settings file found, using defaults");
        Ok(CortexSettings::default())
    }
}

/// Preload settings at startup (called from lib.rs setup)
pub async fn preload_settings(app: &AppHandle) -> Result<(), String> {
    use tauri::Manager;

    let settings_state = app.state::<SettingsState>();
    let settings = load_settings_from_disk().await?;

    if let Ok(mut guard) = settings_state.0.lock() {
        *guard = settings;
    }

    info!("Settings preloaded");
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn get_settings_path_ends_with_settings_json() {
        let path = get_settings_path().unwrap();
        assert!(path.ends_with("settings.json"));
    }

    #[test]
    fn get_settings_path_contains_cortex() {
        let path = get_settings_path().unwrap();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains("Cortex"));
    }

    #[test]
    fn ensure_settings_dir_creates_directory() {
        let dir = ensure_settings_dir().unwrap();
        assert!(dir.exists());
        assert!(dir.is_dir());
        assert!(dir.to_string_lossy().contains("Cortex"));
    }

    #[test]
    fn ensure_settings_dir_idempotent() {
        let dir1 = ensure_settings_dir().unwrap();
        let dir2 = ensure_settings_dir().unwrap();
        assert_eq!(dir1, dir2);
    }

    #[test]
    fn settings_state_new_creates_default() {
        let state = SettingsState::new();
        let guard = state.0.lock().unwrap();
        assert_eq!(guard.version, crate::settings::SETTINGS_VERSION);
    }

    #[test]
    fn settings_state_default_matches_new() {
        let state = SettingsState::default();
        let guard = state.0.lock().unwrap();
        assert_eq!(guard.version, crate::settings::SETTINGS_VERSION);
    }

    #[test]
    fn settings_state_mutex_is_lockable() {
        let state = SettingsState::new();
        let guard = state.0.lock();
        assert!(guard.is_ok());
    }

    #[test]
    fn settings_state_clone() {
        let state = SettingsState::new();
        let cloned = state.clone();
        let guard = cloned.0.lock().unwrap();
        assert_eq!(guard.version, crate::settings::SETTINGS_VERSION);
    }

    #[test]
    fn set_file_permissions_on_temp_file() {
        let dir = std::env::temp_dir();
        let path = dir.join("cortex_test_perms.tmp");
        fs::write(&path, "test").unwrap();
        let result = set_file_permissions(&path);
        assert!(result.is_ok());
        let _ = fs::remove_file(&path);
    }
}
