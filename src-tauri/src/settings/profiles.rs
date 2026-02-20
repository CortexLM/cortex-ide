//! User profiles management
//!
//! This module handles saving and loading user profiles (settings/workspaces/configurations).
//! Profiles contain user settings, workspace configurations, and UI state.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tracing::info;
use uuid::Uuid;

/// Metadata for a single profile (lightweight, no full settings payload).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileMetadata {
    pub id: String,
    pub name: String,
    pub created_at: Option<String>,
}

/// Envelope used when exporting / importing a profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileExportEnvelope {
    pub version: u32,
    pub exported_at: u64,
    pub profile: serde_json::Value,
}

/// Resolve the application config directory from the Tauri `AppHandle`.
fn config_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))
}

/// Return the current UNIX timestamp in seconds.
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Existing commands (unchanged – use std::fs to preserve original behaviour)
// ---------------------------------------------------------------------------

/// Save user profiles (settings/workspaces/configurations)
///
/// This command persists user profiles to a local JSON file.
/// Profiles contain user settings, workspace configurations, and UI state.
#[tauri::command]
pub async fn profiles_save(
    app: AppHandle,
    profiles: String,
    active_id: Option<String>,
) -> Result<(), String> {
    let mut profiles_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;

    if !profiles_path.exists() {
        std::fs::create_dir_all(&profiles_path)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    profiles_path.push("profiles.json");

    // Write profiles data
    std::fs::write(&profiles_path, &profiles)
        .map_err(|e| format!("Failed to write profiles: {}", e))?;

    // Save active profile ID separately if provided
    if let Some(active) = active_id {
        let mut active_path = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("Failed to get config directory: {}", e))?;
        active_path.push("active_profile.txt");
        std::fs::write(&active_path, &active)
            .map_err(|e| format!("Failed to write active profile: {}", e))?;
    }

    info!("Profiles saved to {:?}", profiles_path);
    Ok(())
}

/// Load user profiles
#[tauri::command]
pub async fn profiles_load(app: AppHandle) -> Result<(String, Option<String>), String> {
    let mut profiles_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;
    profiles_path.push("profiles.json");

    let profiles = if profiles_path.exists() {
        std::fs::read_to_string(&profiles_path)
            .map_err(|e| format!("Failed to read profiles: {}", e))?
    } else {
        "[]".to_string()
    };

    // Load active profile ID
    let mut active_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;
    active_path.push("active_profile.txt");

    let active_id = if active_path.exists() {
        Some(
            std::fs::read_to_string(&active_path)
                .map_err(|e| format!("Failed to read active profile: {}", e))?,
        )
    } else {
        None
    };

    Ok((profiles, active_id))
}

// ---------------------------------------------------------------------------
// New commands (use tokio::fs for async I/O)
// ---------------------------------------------------------------------------

/// Export a single profile as pretty-printed JSON wrapped in an export envelope.
#[tauri::command]
pub async fn profile_export(app: AppHandle, profile_id: String) -> Result<String, String> {
    let mut path = config_dir(&app)?;
    path.push("profiles.json");

    let raw = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read profiles: {}", e))?;

    let profiles: Vec<serde_json::Value> =
        serde_json::from_str(&raw).map_err(|e| format!("Failed to parse profiles: {}", e))?;

    let profile = profiles
        .into_iter()
        .find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&profile_id))
        .ok_or_else(|| format!("Profile not found: {}", profile_id))?;

    let envelope = ProfileExportEnvelope {
        version: 1,
        exported_at: now_secs(),
        profile,
    };

    let json = serde_json::to_string_pretty(&envelope)
        .map_err(|e| format!("Failed to serialize export envelope: {}", e))?;

    info!("Exported profile {}", profile_id);
    Ok(json)
}

const MAX_IMPORT_SIZE: usize = 10 * 1024 * 1024;

/// Import a profile from a JSON export envelope string.
///
/// Validates the envelope, generates a new ID for the profile to avoid
/// conflicts, appends it to the existing profiles list, and returns the new ID.
#[tauri::command]
pub async fn profile_import(app: AppHandle, json: String) -> Result<String, String> {
    if json.len() > MAX_IMPORT_SIZE {
        return Err(format!(
            "Import data exceeds maximum size of {} bytes",
            MAX_IMPORT_SIZE
        ));
    }

    let envelope: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse import JSON: {}", e))?;

    let version = envelope
        .get("version")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "Invalid import envelope: missing or invalid version field".to_string())?;

    if version != 1 {
        return Err(format!(
            "Unsupported import envelope version: {}. Expected: 1",
            version
        ));
    }

    let mut profile = envelope
        .get("profile")
        .cloned()
        .ok_or_else(|| "Invalid import envelope: missing profile field".to_string())?;

    let new_id = Uuid::new_v4().to_string();
    if let Some(obj) = profile.as_object_mut() {
        obj.insert("id".to_string(), serde_json::Value::String(new_id.clone()));
    }

    let mut path = config_dir(&app)?;

    // Ensure config directory exists
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    path.push("profiles.json");

    let mut profiles: Vec<serde_json::Value> = if path.exists() {
        let raw = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read profiles: {}", e))?;
        serde_json::from_str(&raw).map_err(|e| format!("Failed to parse profiles: {}", e))?
    } else {
        Vec::new()
    };

    profiles.push(profile);

    let data = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;

    tokio::fs::write(&path, data.as_bytes())
        .await
        .map_err(|e| format!("Failed to write profiles: {}", e))?;

    info!("Imported profile with new id {}", new_id);
    Ok(new_id)
}

/// Switch the active profile by writing the profile ID to `active_profile.txt`.
#[tauri::command]
pub async fn profile_switch(app: AppHandle, profile_id: String) -> Result<(), String> {
    let mut path = config_dir(&app)?;

    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    path.push("active_profile.txt");

    tokio::fs::write(&path, profile_id.as_bytes())
        .await
        .map_err(|e| format!("Failed to write active profile: {}", e))?;

    info!("Switched active profile to {}", profile_id);
    Ok(())
}

/// Persist a workspace-to-profile default mapping in `workspace_profiles.json`.
#[tauri::command]
pub async fn profile_set_default_for_workspace(
    app: AppHandle,
    workspace_path: String,
    profile_id: String,
) -> Result<(), String> {
    let mut path = config_dir(&app)?;

    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    path.push("workspace_profiles.json");

    let mut map: HashMap<String, String> = if path.exists() {
        let raw = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read workspace profiles: {}", e))?;
        serde_json::from_str(&raw)
            .map_err(|e| format!("Failed to parse workspace profiles: {}", e))?
    } else {
        HashMap::new()
    };

    map.insert(workspace_path.clone(), profile_id.clone());

    let data = serde_json::to_string_pretty(&map)
        .map_err(|e| format!("Failed to serialize workspace profiles: {}", e))?;

    tokio::fs::write(&path, data.as_bytes())
        .await
        .map_err(|e| format!("Failed to write workspace profiles: {}", e))?;

    info!(
        "Set default profile {} for workspace {}",
        profile_id, workspace_path
    );
    Ok(())
}

/// Read the default profile ID for a given workspace path.
#[tauri::command]
pub async fn profile_get_default_for_workspace(
    app: AppHandle,
    workspace_path: String,
) -> Result<Option<String>, String> {
    let mut path = config_dir(&app)?;
    path.push("workspace_profiles.json");

    if !path.exists() {
        return Ok(None);
    }

    let raw = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read workspace profiles: {}", e))?;

    let map: HashMap<String, String> = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse workspace profiles: {}", e))?;

    Ok(map.get(&workspace_path).cloned())
}

/// List all profiles returning only lightweight metadata (id, name, created_at).
#[tauri::command]
pub async fn profile_list(app: AppHandle) -> Result<Vec<ProfileMetadata>, String> {
    let mut path = config_dir(&app)?;
    path.push("profiles.json");

    let raw = if path.exists() {
        tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read profiles: {}", e))?
    } else {
        return Ok(Vec::new());
    };

    let profiles: Vec<serde_json::Value> =
        serde_json::from_str(&raw).map_err(|e| format!("Failed to parse profiles: {}", e))?;

    let metadata = profiles
        .iter()
        .map(|p| ProfileMetadata {
            id: p
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            name: p
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            created_at: p
                .get("createdAt")
                .or_else(|| p.get("created_at"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        })
        .collect();

    Ok(metadata)
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_export_envelope_serialization_roundtrip() {
        let envelope = ProfileExportEnvelope {
            version: 1,
            exported_at: 1700000000,
            profile: serde_json::json!({
                "id": "abc-123",
                "name": "My Profile",
                "createdAt": "2024-01-01T00:00:00Z"
            }),
        };

        let json = serde_json::to_string(&envelope).expect("serialize");
        let restored: ProfileExportEnvelope = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(restored.version, 1);
        assert_eq!(restored.exported_at, 1700000000);
        assert_eq!(
            restored.profile.get("id").and_then(|v| v.as_str()),
            Some("abc-123")
        );
        assert_eq!(
            restored.profile.get("name").and_then(|v| v.as_str()),
            Some("My Profile")
        );
    }

    #[test]
    fn test_profile_metadata_serialization() {
        let meta = ProfileMetadata {
            id: "test-id".to_string(),
            name: "Test Profile".to_string(),
            created_at: Some("2024-06-15T12:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&meta).expect("serialize");
        let restored: ProfileMetadata = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(restored.id, "test-id");
        assert_eq!(restored.name, "Test Profile");
        assert_eq!(restored.created_at.as_deref(), Some("2024-06-15T12:00:00Z"));

        let meta_none = ProfileMetadata {
            id: "id2".to_string(),
            name: "No Date".to_string(),
            created_at: None,
        };

        let json_none = serde_json::to_string(&meta_none).expect("serialize");
        let restored_none: ProfileMetadata = serde_json::from_str(&json_none).expect("deserialize");

        assert_eq!(restored_none.created_at, None);
    }
}
