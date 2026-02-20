//! Type definitions for settings sync

use serde::{Deserialize, Serialize};

/// Status of the sync operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Idle,
    Syncing,
    Synced,
    Error,
    Conflict,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self::Idle
    }
}

/// A syncable item category
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum SyncItemKind {
    Settings,
    Keybindings,
    Snippets,
    Extensions,
    UiState,
}

/// Configuration for a single sync item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncItem {
    pub kind: SyncItemKind,
    pub enabled: bool,
    pub last_synced: Option<i64>,
    pub content_hash: Option<String>,
}

/// A sync profile (connection to a sync backend)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProfile {
    pub id: String,
    pub provider: String,
    pub gist_id: Option<String>,
    pub username: Option<String>,
    pub custom_endpoint: Option<String>,
    pub created_at: i64,
    pub last_sync_at: Option<i64>,
}

/// A conflict between local and remote data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflict {
    pub id: String,
    pub item_kind: SyncItemKind,
    pub local_timestamp: i64,
    pub remote_timestamp: i64,
    pub local_preview: String,
    pub remote_preview: String,
}

/// Resolution strategy for a conflict
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    Local,
    Remote,
    Merge,
}

/// The data bundle that gets synced
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncBundle {
    pub version: u32,
    pub timestamp: i64,
    pub machine_id: String,
    pub settings: Option<serde_json::Value>,
    pub keybindings: Option<serde_json::Value>,
    pub snippets: Option<serde_json::Value>,
    pub extensions: Option<Vec<String>>,
    pub ui_state: Option<serde_json::Value>,
}

impl Default for SyncBundle {
    fn default() -> Self {
        Self {
            version: 1,
            timestamp: chrono::Utc::now().timestamp_millis(),
            machine_id: String::new(),
            settings: None,
            keybindings: None,
            snippets: None,
            extensions: None,
            ui_state: None,
        }
    }
}

/// Overall sync state managed by the backend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub status: SyncStatus,
    pub profile: Option<SyncProfile>,
    pub conflicts: Vec<SyncConflict>,
    pub last_error: Option<String>,
    pub last_sync_time: Option<i64>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            status: SyncStatus::Idle,
            profile: None,
            conflicts: Vec::new(),
            last_error: None,
            last_sync_time: None,
        }
    }
}

/// Result returned from sync_status command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResponse {
    pub status: SyncStatus,
    pub profile: Option<SyncProfile>,
    pub conflicts: Vec<SyncConflict>,
    pub last_error: Option<String>,
    pub last_sync_time: Option<i64>,
}

/// Result returned from sync_push/sync_pull
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    pub conflicts: Vec<SyncConflict>,
    pub timestamp: i64,
}
