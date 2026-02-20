//! Tauri commands for settings sync operations
//!
//! Provides the IPC interface for the frontend to interact with
//! the settings sync backend.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use tauri::{AppHandle, Manager};
use tracing::info;

use super::SettingsSyncState;
use super::github_gist;
use super::storage;
use super::types::{
    ConflictResolution, SyncBundle, SyncConflict, SyncProfile, SyncResult, SyncStatus,
    SyncStatusResponse,
};

/// Get a machine-specific identifier based on the data directory path
fn get_machine_id() -> String {
    let data_dir = dirs::data_dir()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let mut hasher = DefaultHasher::new();
    data_dir.hash(&mut hasher);
    format!("machine-{:x}", hasher.finish())
}

/// Push local settings to the remote sync backend
#[tauri::command]
pub async fn sync_push(
    app: AppHandle,
    token: String,
    gist_id: Option<String>,
) -> Result<SyncResult, String> {
    let state = app.state::<SettingsSyncState>();

    {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.status = SyncStatus::Syncing;
        guard.last_error = None;
    }

    let machine_id = get_machine_id();
    let bundle = storage::collect_local_bundle(&machine_id);
    let timestamp = bundle.timestamp;

    let result_gist_id = match gist_id {
        Some(id) if !id.is_empty() => {
            github_gist::update_gist(&token, &id, &bundle).await?;
            id
        }
        _ => github_gist::create_gist(&token, &bundle).await?,
    };

    {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.status = SyncStatus::Synced;
        guard.last_sync_time = Some(timestamp);
        if let Some(ref mut profile) = guard.profile {
            profile.gist_id = Some(result_gist_id.clone());
            profile.last_sync_at = Some(timestamp);
        } else {
            guard.profile = Some(SyncProfile {
                id: uuid::Uuid::new_v4().to_string(),
                provider: "github".to_string(),
                gist_id: Some(result_gist_id.clone()),
                username: None,
                custom_endpoint: None,
                created_at: timestamp,
                last_sync_at: Some(timestamp),
            });
        }
    }

    info!("Settings pushed to gist: {}", result_gist_id);

    Ok(SyncResult {
        success: true,
        message: format!("Settings pushed successfully to gist {}", result_gist_id),
        conflicts: Vec::new(),
        timestamp,
    })
}

/// Pull settings from the remote sync backend
#[tauri::command]
pub async fn sync_pull(
    app: AppHandle,
    token: String,
    gist_id: String,
) -> Result<SyncResult, String> {
    let state = app.state::<SettingsSyncState>();

    {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.status = SyncStatus::Syncing;
        guard.last_error = None;
    }

    let remote_bundle = github_gist::fetch_gist(&token, &gist_id)
        .await?
        .ok_or_else(|| "No sync data found in gist".to_string())?;

    let machine_id = get_machine_id();
    let local_bundle = storage::collect_local_bundle(&machine_id);
    let conflicts = detect_conflicts(&local_bundle, &remote_bundle);

    if !conflicts.is_empty() {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.status = SyncStatus::Conflict;
        guard.conflicts = conflicts.clone();
        return Ok(SyncResult {
            success: false,
            message: format!("{} conflict(s) detected", conflicts.len()),
            conflicts,
            timestamp: chrono::Utc::now().timestamp_millis(),
        });
    }

    storage::apply_remote_bundle(&remote_bundle)?;

    let timestamp = chrono::Utc::now().timestamp_millis();

    {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.status = SyncStatus::Synced;
        guard.last_sync_time = Some(timestamp);
        guard.conflicts.clear();
        if let Some(ref mut profile) = guard.profile {
            profile.last_sync_at = Some(timestamp);
        }
    }

    info!("Settings pulled from gist: {}", gist_id);

    Ok(SyncResult {
        success: true,
        message: "Settings pulled successfully".to_string(),
        conflicts: Vec::new(),
        timestamp,
    })
}

/// Get current sync status
#[tauri::command]
pub async fn sync_status(app: AppHandle) -> Result<SyncStatusResponse, String> {
    let state = app.state::<SettingsSyncState>();
    let guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;

    Ok(SyncStatusResponse {
        status: guard.status.clone(),
        profile: guard.profile.clone(),
        conflicts: guard.conflicts.clone(),
        last_error: guard.last_error.clone(),
        last_sync_time: guard.last_sync_time,
    })
}

/// Resolve sync conflicts
#[tauri::command]
pub async fn sync_resolve_conflicts(
    app: AppHandle,
    token: String,
    gist_id: String,
    resolution: ConflictResolution,
) -> Result<SyncResult, String> {
    let state = app.state::<SettingsSyncState>();

    let timestamp = chrono::Utc::now().timestamp_millis();

    match resolution {
        ConflictResolution::Local => {
            let machine_id = get_machine_id();
            let bundle = storage::collect_local_bundle(&machine_id);
            github_gist::update_gist(&token, &gist_id, &bundle).await?;
            info!("Conflict resolved: kept local settings");
        }
        ConflictResolution::Remote => {
            let remote_bundle = github_gist::fetch_gist(&token, &gist_id)
                .await?
                .ok_or_else(|| "No sync data found in gist".to_string())?;
            storage::apply_remote_bundle(&remote_bundle)?;
            info!("Conflict resolved: applied remote settings");
        }
        ConflictResolution::Merge => {
            let machine_id = get_machine_id();
            let bundle = storage::collect_local_bundle(&machine_id);
            github_gist::update_gist(&token, &gist_id, &bundle).await?;
            info!("Conflict resolved: merged (kept local, pushed to remote)");
        }
    }

    {
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.status = SyncStatus::Synced;
        guard.conflicts.clear();
        guard.last_sync_time = Some(timestamp);
    }

    Ok(SyncResult {
        success: true,
        message: "Conflicts resolved".to_string(),
        conflicts: Vec::new(),
        timestamp,
    })
}

/// Detect conflicts between local and remote bundles
fn detect_conflicts(local: &SyncBundle, remote: &SyncBundle) -> Vec<SyncConflict> {
    let mut conflicts = Vec::new();

    if local.machine_id == remote.machine_id {
        return conflicts;
    }

    if local.settings.is_some() && remote.settings.is_some() {
        let local_str = serde_json::to_string(&local.settings).unwrap_or_default();
        let remote_str = serde_json::to_string(&remote.settings).unwrap_or_default();
        if local_str != remote_str {
            conflicts.push(SyncConflict {
                id: uuid::Uuid::new_v4().to_string(),
                item_kind: super::types::SyncItemKind::Settings,
                local_timestamp: local.timestamp,
                remote_timestamp: remote.timestamp,
                local_preview: truncate_preview(&local_str, 200),
                remote_preview: truncate_preview(&remote_str, 200),
            });
        }
    }

    if local.keybindings.is_some() && remote.keybindings.is_some() {
        let local_str = serde_json::to_string(&local.keybindings).unwrap_or_default();
        let remote_str = serde_json::to_string(&remote.keybindings).unwrap_or_default();
        if local_str != remote_str {
            conflicts.push(SyncConflict {
                id: uuid::Uuid::new_v4().to_string(),
                item_kind: super::types::SyncItemKind::Keybindings,
                local_timestamp: local.timestamp,
                remote_timestamp: remote.timestamp,
                local_preview: truncate_preview(&local_str, 200),
                remote_preview: truncate_preview(&remote_str, 200),
            });
        }
    }

    if local.snippets.is_some() && remote.snippets.is_some() {
        let local_str = serde_json::to_string(&local.snippets).unwrap_or_default();
        let remote_str = serde_json::to_string(&remote.snippets).unwrap_or_default();
        if local_str != remote_str {
            conflicts.push(SyncConflict {
                id: uuid::Uuid::new_v4().to_string(),
                item_kind: super::types::SyncItemKind::Snippets,
                local_timestamp: local.timestamp,
                remote_timestamp: remote.timestamp,
                local_preview: truncate_preview(&local_str, 200),
                remote_preview: truncate_preview(&remote_str, 200),
            });
        }
    }

    conflicts
}

/// Truncate a string for preview purposes
fn truncate_preview(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}
