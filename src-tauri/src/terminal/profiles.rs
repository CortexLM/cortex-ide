//! Terminal profiles management
//!
//! Save and load named terminal configurations with shell, args, env, and cwd.

use std::collections::HashMap;
use std::path::PathBuf;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

/// A saved terminal profile
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfile {
    pub id: String,
    pub name: String,
    pub shell: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

/// State for managing terminal profiles
pub struct TerminalProfilesState {
    profiles: Mutex<Vec<TerminalProfile>>,
}

impl TerminalProfilesState {
    pub fn new() -> Self {
        let state = Self {
            profiles: Mutex::new(Vec::new()),
        };
        state.load_from_disk();
        state
    }

    fn profiles_path() -> Option<PathBuf> {
        dirs::config_dir().map(|d| d.join("cortex-desktop").join("terminal-profiles.json"))
    }

    fn load_from_disk(&self) {
        if let Some(path) = Self::profiles_path() {
            if path.exists() {
                match std::fs::read_to_string(&path) {
                    Ok(content) => match serde_json::from_str::<Vec<TerminalProfile>>(&content) {
                        Ok(profiles) => {
                            *self.profiles.lock() = profiles;
                            info!("Loaded terminal profiles from {:?}", path);
                        }
                        Err(e) => {
                            error!("Failed to parse terminal profiles: {}", e);
                        }
                    },
                    Err(e) => {
                        error!("Failed to read terminal profiles: {}", e);
                    }
                }
            }
        }
    }

    fn save_to_disk(&self) {
        if let Some(path) = Self::profiles_path() {
            if let Some(parent) = path.parent() {
                if !parent.exists() {
                    if let Err(e) = std::fs::create_dir_all(parent) {
                        error!("Failed to create profiles directory: {}", e);
                        return;
                    }
                }
            }

            let profiles = self.profiles.lock().clone();
            match serde_json::to_string_pretty(&profiles) {
                Ok(json) => {
                    if let Err(e) = std::fs::write(&path, json) {
                        error!("Failed to write terminal profiles: {}", e);
                    }
                }
                Err(e) => {
                    error!("Failed to serialize terminal profiles: {}", e);
                }
            }
        }
    }
}

impl Default for TerminalProfilesState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get all terminal profiles
#[tauri::command]
pub async fn terminal_profiles_list(
    state: tauri::State<'_, TerminalProfilesState>,
) -> Result<Vec<TerminalProfile>, String> {
    Ok(state.profiles.lock().clone())
}

/// Save a terminal profile
#[tauri::command]
pub async fn terminal_profiles_save(
    state: tauri::State<'_, TerminalProfilesState>,
    profile: TerminalProfile,
) -> Result<TerminalProfile, String> {
    {
        let mut profiles = state.profiles.lock();
        if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile.clone();
        } else {
            profiles.push(profile.clone());
        }
    }

    state.save_to_disk();
    info!("Saved terminal profile: {}", profile.name);

    Ok(profile)
}

/// Delete a terminal profile
#[tauri::command]
pub async fn terminal_profiles_delete(
    state: tauri::State<'_, TerminalProfilesState>,
    profile_id: String,
) -> Result<(), String> {
    {
        let mut profiles = state.profiles.lock();
        let len_before = profiles.len();
        profiles.retain(|p| p.id != profile_id);
        if profiles.len() == len_before {
            return Err(format!("Profile not found: {}", profile_id));
        }
    }

    state.save_to_disk();
    info!("Deleted terminal profile: {}", profile_id);

    Ok(())
}

/// Get a terminal profile by ID
#[tauri::command]
pub async fn terminal_profiles_get(
    state: tauri::State<'_, TerminalProfilesState>,
    profile_id: String,
) -> Result<Option<TerminalProfile>, String> {
    Ok(state
        .profiles
        .lock()
        .iter()
        .find(|p| p.id == profile_id)
        .cloned())
}

/// Set a profile as the default
#[tauri::command]
pub async fn terminal_profiles_set_default(
    state: tauri::State<'_, TerminalProfilesState>,
    profile_id: String,
) -> Result<(), String> {
    {
        let mut profiles = state.profiles.lock();
        for profile in profiles.iter_mut() {
            profile.is_default = profile.id == profile_id;
        }
    }

    state.save_to_disk();
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_profile_serialization() {
        let profile = TerminalProfile {
            id: "test-1".to_string(),
            name: "My Shell".to_string(),
            shell: "/bin/bash".to_string(),
            args: vec!["-l".to_string()],
            env: HashMap::from([("FOO".to_string(), "bar".to_string())]),
            cwd: Some("/home/user".to_string()),
            icon: None,
            is_default: false,
        };

        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: TerminalProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "test-1");
        assert_eq!(deserialized.shell, "/bin/bash");
        assert_eq!(deserialized.args.len(), 1);
        assert_eq!(deserialized.env.get("FOO"), Some(&"bar".to_string()));
    }

    #[test]
    fn test_profile_state_operations() {
        let state = TerminalProfilesState {
            profiles: Mutex::new(Vec::new()),
        };

        let profile = TerminalProfile {
            id: "p1".to_string(),
            name: "Profile 1".to_string(),
            shell: "/bin/zsh".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            icon: None,
            is_default: false,
        };

        state.profiles.lock().push(profile);
        assert_eq!(state.profiles.lock().len(), 1);

        state.profiles.lock().retain(|p| p.id != "p1");
        assert!(state.profiles.lock().is_empty());
    }
}
