//! Timeline / Local History Backend
//!
//! Provides VS Code-like local file history tracking.
//! Automatically saves file snapshots before edits, supports browsing
//! history, comparing versions, and restoring previous versions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};
use tracing::{info, warn};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Source that triggered the timeline snapshot
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TimelineSource {
    AutoSave,
    ManualSave,
    Undo,
    GitCommit,
    Refactor,
}

/// A single timeline entry representing a file snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEntry {
    pub id: String,
    pub file_path: String,
    pub timestamp: u64,
    pub label: Option<String>,
    pub source: TimelineSource,
    pub size: u64,
    pub snapshot_path: String,
}

/// Statistics about the timeline storage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineStats {
    pub total_entries: usize,
    pub total_files: usize,
    pub disk_usage_bytes: u64,
}

/// A single line in a diff hunk
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String,
    pub content: String,
}

/// A contiguous region of changes in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<DiffLine>,
}

/// Result of comparing two snapshots
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub old_entry_id: String,
    pub new_entry_id: String,
    pub added_lines: usize,
    pub removed_lines: usize,
    pub hunks: Vec<DiffHunk>,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for timeline tracking
pub struct TimelineState {
    entries: Mutex<HashMap<String, Vec<TimelineEntry>>>,
    storage_dir: Mutex<Option<String>>,
    max_entries_per_file: usize,
    max_file_size: u64,
}

impl TimelineState {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            storage_dir: Mutex::new(None),
            max_entries_per_file: 50,
            max_file_size: 10 * 1024 * 1024,
        }
    }
}

impl Default for TimelineState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

fn now_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn hash_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn get_storage_dir(state: &TimelineState) -> Result<String, String> {
    let guard = state
        .storage_dir
        .lock()
        .map_err(|_| "Failed to acquire storage_dir lock".to_string())?;
    guard
        .clone()
        .ok_or_else(|| "Timeline not initialized. Call timeline_init first.".to_string())
}

/// Compute a simple line-by-line diff using the longest common subsequence algorithm.
fn compute_diff(old_text: &str, new_text: &str) -> (Vec<DiffHunk>, usize, usize) {
    let old_lines: Vec<&str> = old_text.lines().collect();
    let new_lines: Vec<&str> = new_text.lines().collect();

    let n = old_lines.len();
    let m = new_lines.len();

    let mut dp = vec![vec![0u32; m + 1]; n + 1];
    for i in 1..=n {
        for j in 1..=m {
            if old_lines[i - 1] == new_lines[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    let mut edits: Vec<(char, usize, usize, &str)> = Vec::new();
    let mut i = n;
    let mut j = m;
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && old_lines[i - 1] == new_lines[j - 1] {
            edits.push(('=', i - 1, j - 1, old_lines[i - 1]));
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            edits.push(('+', i, j - 1, new_lines[j - 1]));
            j -= 1;
        } else {
            edits.push(('-', i - 1, j, old_lines[i - 1]));
            i -= 1;
        }
    }
    edits.reverse();

    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut added: usize = 0;
    let mut removed: usize = 0;
    let mut current_lines: Vec<DiffLine> = Vec::new();
    let mut hunk_old_start: Option<usize> = None;
    let mut hunk_new_start: Option<usize> = None;
    let mut hunk_old_count: usize = 0;
    let mut hunk_new_count: usize = 0;
    let mut trailing_context = 0u32;

    for (kind, old_idx, new_idx, content) in &edits {
        match kind {
            '=' => {
                if hunk_old_start.is_some() {
                    trailing_context += 1;
                    if trailing_context <= 3 {
                        current_lines.push(DiffLine {
                            kind: "context".to_string(),
                            content: content.to_string(),
                        });
                        hunk_old_count += 1;
                        hunk_new_count += 1;
                    }
                    if trailing_context >= 6 {
                        hunks.push(DiffHunk {
                            old_start: hunk_old_start.unwrap_or(0),
                            old_count: hunk_old_count,
                            new_start: hunk_new_start.unwrap_or(0),
                            new_count: hunk_new_count,
                            lines: std::mem::take(&mut current_lines),
                        });
                        hunk_old_start = None;
                        hunk_new_start = None;
                        hunk_old_count = 0;
                        hunk_new_count = 0;
                    }
                }
            }
            '+' => {
                trailing_context = 0;
                added += 1;
                if hunk_old_start.is_none() {
                    let ctx_start = old_idx.saturating_sub(3);
                    hunk_old_start = Some(ctx_start);
                    hunk_new_start = Some(new_idx.saturating_sub(3));
                }
                current_lines.push(DiffLine {
                    kind: "added".to_string(),
                    content: content.to_string(),
                });
                hunk_new_count += 1;
            }
            '-' => {
                trailing_context = 0;
                removed += 1;
                if hunk_old_start.is_none() {
                    let ctx_start = old_idx.saturating_sub(3);
                    hunk_old_start = Some(ctx_start);
                    hunk_new_start = Some(new_idx.saturating_sub(3));
                }
                current_lines.push(DiffLine {
                    kind: "removed".to_string(),
                    content: content.to_string(),
                });
                hunk_old_count += 1;
            }
            _ => {}
        }
    }

    if hunk_old_start.is_some() && !current_lines.is_empty() {
        hunks.push(DiffHunk {
            old_start: hunk_old_start.unwrap_or(0),
            old_count: hunk_old_count,
            new_start: hunk_new_start.unwrap_or(0),
            new_count: hunk_new_count,
            lines: current_lines,
        });
    }

    (hunks, added, removed)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Initialize timeline storage directory
#[tauri::command]
pub async fn timeline_init(
    _app: AppHandle,
    state: State<'_, Arc<TimelineState>>,
) -> Result<String, String> {
    let base = dirs::data_dir().ok_or_else(|| "Could not determine data directory".to_string())?;
    let storage = base.join("cortex").join("local-history");
    tokio::fs::create_dir_all(&storage)
        .await
        .map_err(|e| format!("Failed to create timeline storage directory: {}", e))?;

    let storage_str = storage
        .to_str()
        .ok_or_else(|| "Storage path contains invalid UTF-8".to_string())?
        .to_string();

    {
        let mut dir = state
            .storage_dir
            .lock()
            .map_err(|_| "Failed to acquire storage_dir lock".to_string())?;
        *dir = Some(storage_str.clone());
    }

    info!("Timeline storage initialized at: {}", storage_str);
    Ok(storage_str)
}

/// Get timeline entries for a file path
#[tauri::command]
pub async fn timeline_get_entries(
    state: State<'_, Arc<TimelineState>>,
    file_path: String,
) -> Result<Vec<TimelineEntry>, String> {
    let entries = state
        .entries
        .lock()
        .map_err(|_| "Failed to acquire entries lock".to_string())?;
    Ok(entries.get(&file_path).cloned().unwrap_or_default())
}

/// Get a specific timeline entry by id
#[tauri::command]
pub async fn timeline_get_entry(
    state: State<'_, Arc<TimelineState>>,
    entry_id: String,
) -> Result<Option<TimelineEntry>, String> {
    let entries = state
        .entries
        .lock()
        .map_err(|_| "Failed to acquire entries lock".to_string())?;
    for file_entries in entries.values() {
        if let Some(entry) = file_entries.iter().find(|e| e.id == entry_id) {
            return Ok(Some(entry.clone()));
        }
    }
    Ok(None)
}

/// Create a new snapshot of a file
#[tauri::command]
pub async fn timeline_create_snapshot(
    _app: AppHandle,
    state: State<'_, Arc<TimelineState>>,
    file_path: String,
    source: TimelineSource,
    label: Option<String>,
) -> Result<TimelineEntry, String> {
    let storage_dir = get_storage_dir(&state)?;
    let max_file_size = state.max_file_size;
    let max_entries = state.max_entries_per_file;

    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let file_size = metadata.len();
    if file_size > max_file_size {
        return Err(format!(
            "File too large for snapshot: {} bytes (max: {} bytes)",
            file_size, max_file_size
        ));
    }

    let content = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let hashed = hash_path(&file_path);
    let snapshot_dir = std::path::PathBuf::from(&storage_dir).join(&hashed);
    tokio::fs::create_dir_all(&snapshot_dir)
        .await
        .map_err(|e| format!("Failed to create snapshot directory: {}", e))?;

    let timestamp = now_timestamp();
    let id = Uuid::new_v4().to_string();
    let short_id = &id[..8];
    let snapshot_filename = format!("{}-{}.snapshot", timestamp, short_id);
    let snapshot_path = snapshot_dir.join(&snapshot_filename);

    tokio::fs::write(&snapshot_path, &content)
        .await
        .map_err(|e| format!("Failed to write snapshot: {}", e))?;

    let snapshot_path_str = snapshot_path
        .to_str()
        .ok_or_else(|| "Snapshot path contains invalid UTF-8".to_string())?
        .to_string();

    let entry = TimelineEntry {
        id,
        file_path: file_path.clone(),
        timestamp,
        label,
        source,
        size: file_size,
        snapshot_path: snapshot_path_str,
    };

    let removed = {
        let mut entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        let file_entries = entries.entry(file_path).or_default();
        file_entries.insert(0, entry.clone());

        if file_entries.len() > max_entries {
            file_entries.drain(max_entries..).collect::<Vec<_>>()
        } else {
            Vec::new()
        }
    };

    for old_entry in removed {
        if let Err(e) = tokio::fs::remove_file(&old_entry.snapshot_path).await {
            warn!(
                "Failed to remove old snapshot {}: {}",
                old_entry.snapshot_path, e
            );
        }
    }

    Ok(entry)
}

/// Restore a file from a snapshot
#[tauri::command]
pub async fn timeline_restore_snapshot(
    _app: AppHandle,
    state: State<'_, Arc<TimelineState>>,
    entry_id: String,
) -> Result<(), String> {
    let entry = {
        let entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        let mut found: Option<TimelineEntry> = None;
        for file_entries in entries.values() {
            if let Some(e) = file_entries.iter().find(|e| e.id == entry_id) {
                found = Some(e.clone());
                break;
            }
        }
        found.ok_or_else(|| format!("Timeline entry not found: {}", entry_id))?
    };

    let content = tokio::fs::read(&entry.snapshot_path)
        .await
        .map_err(|e| format!("Failed to read snapshot: {}", e))?;

    tokio::fs::write(&entry.file_path, &content)
        .await
        .map_err(|e| format!("Failed to restore file: {}", e))?;

    info!(
        "Restored file {} from snapshot {}",
        entry.file_path, entry.id
    );
    Ok(())
}

/// Delete a timeline entry
#[tauri::command]
pub async fn timeline_delete_entry(
    _app: AppHandle,
    state: State<'_, Arc<TimelineState>>,
    entry_id: String,
) -> Result<(), String> {
    let snapshot_path = {
        let mut entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        let mut found_path: Option<String> = None;
        for file_entries in entries.values_mut() {
            if let Some(pos) = file_entries.iter().position(|e| e.id == entry_id) {
                let removed = file_entries.remove(pos);
                found_path = Some(removed.snapshot_path);
                break;
            }
        }
        found_path.ok_or_else(|| format!("Timeline entry not found: {}", entry_id))?
    };

    if let Err(e) = tokio::fs::remove_file(&snapshot_path).await {
        warn!("Failed to remove snapshot file {}: {}", snapshot_path, e);
    }

    Ok(())
}

/// Clear all entries for a file
#[tauri::command]
pub async fn timeline_clear_file(
    _app: AppHandle,
    state: State<'_, Arc<TimelineState>>,
    file_path: String,
) -> Result<(), String> {
    let removed_entries = {
        let mut entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        entries.remove(&file_path).unwrap_or_default()
    };

    for entry in removed_entries {
        if let Err(e) = tokio::fs::remove_file(&entry.snapshot_path).await {
            warn!(
                "Failed to remove snapshot file {}: {}",
                entry.snapshot_path, e
            );
        }
    }

    info!("Cleared timeline entries for: {}", file_path);
    Ok(())
}

/// Clear all timeline entries
#[tauri::command]
pub async fn timeline_clear_all(
    _app: AppHandle,
    state: State<'_, Arc<TimelineState>>,
) -> Result<(), String> {
    let all_entries = {
        let mut entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        let drained: HashMap<String, Vec<TimelineEntry>> = entries.drain().collect();
        drained
    };

    for file_entries in all_entries.values() {
        for entry in file_entries {
            if let Err(e) = tokio::fs::remove_file(&entry.snapshot_path).await {
                warn!(
                    "Failed to remove snapshot file {}: {}",
                    entry.snapshot_path, e
                );
            }
        }
    }

    info!("Cleared all timeline entries");
    Ok(())
}

/// Get the content of a snapshot
#[tauri::command]
pub async fn timeline_get_content(
    state: State<'_, Arc<TimelineState>>,
    entry_id: String,
) -> Result<String, String> {
    let snapshot_path = {
        let entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        let mut found: Option<String> = None;
        for file_entries in entries.values() {
            if let Some(e) = file_entries.iter().find(|e| e.id == entry_id) {
                found = Some(e.snapshot_path.clone());
                break;
            }
        }
        found.ok_or_else(|| format!("Timeline entry not found: {}", entry_id))?
    };

    let content = tokio::fs::read_to_string(&snapshot_path)
        .await
        .map_err(|e| format!("Failed to read snapshot content: {}", e))?;

    Ok(content)
}

/// Compare two snapshots and return a diff
#[tauri::command]
pub async fn timeline_compare(
    state: State<'_, Arc<TimelineState>>,
    old_entry_id: String,
    new_entry_id: String,
) -> Result<DiffResult, String> {
    let (old_path, new_path) = {
        let entries = state
            .entries
            .lock()
            .map_err(|_| "Failed to acquire entries lock".to_string())?;
        let mut old_found: Option<String> = None;
        let mut new_found: Option<String> = None;
        for file_entries in entries.values() {
            for e in file_entries {
                if e.id == old_entry_id {
                    old_found = Some(e.snapshot_path.clone());
                }
                if e.id == new_entry_id {
                    new_found = Some(e.snapshot_path.clone());
                }
            }
        }
        let old_path = old_found.ok_or_else(|| format!("Old entry not found: {}", old_entry_id))?;
        let new_path = new_found.ok_or_else(|| format!("New entry not found: {}", new_entry_id))?;
        (old_path, new_path)
    };

    let old_content = tokio::fs::read_to_string(&old_path)
        .await
        .map_err(|e| format!("Failed to read old snapshot: {}", e))?;

    let new_content = tokio::fs::read_to_string(&new_path)
        .await
        .map_err(|e| format!("Failed to read new snapshot: {}", e))?;

    let (hunks, added_lines, removed_lines) = compute_diff(&old_content, &new_content);

    Ok(DiffResult {
        old_entry_id,
        new_entry_id,
        added_lines,
        removed_lines,
        hunks,
    })
}

/// Set or update a label on a timeline entry
#[tauri::command]
pub async fn timeline_set_label(
    state: State<'_, Arc<TimelineState>>,
    entry_id: String,
    label: Option<String>,
) -> Result<(), String> {
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "Failed to acquire entries lock".to_string())?;
    for file_entries in entries.values_mut() {
        if let Some(entry) = file_entries.iter_mut().find(|e| e.id == entry_id) {
            entry.label = label;
            return Ok(());
        }
    }
    Err(format!("Timeline entry not found: {}", entry_id))
}

/// Get statistics about timeline storage
#[tauri::command]
pub async fn timeline_get_stats(
    state: State<'_, Arc<TimelineState>>,
) -> Result<TimelineStats, String> {
    let entries = state
        .entries
        .lock()
        .map_err(|_| "Failed to acquire entries lock".to_string())?;

    let total_files = entries.len();
    let mut total_entries: usize = 0;
    let mut disk_usage_bytes: u64 = 0;

    for file_entries in entries.values() {
        total_entries += file_entries.len();
        for entry in file_entries {
            disk_usage_bytes += entry.size;
        }
    }

    Ok(TimelineStats {
        total_entries,
        total_files,
        disk_usage_bytes,
    })
}

// ============================================================================
// Module Registration
// ============================================================================

/// Get all timeline-related Tauri commands
#[macro_export]
macro_rules! timeline_commands {
    () => {
        timeline::timeline_init,
        timeline::timeline_get_entries,
        timeline::timeline_get_entry,
        timeline::timeline_create_snapshot,
        timeline::timeline_restore_snapshot,
        timeline::timeline_delete_entry,
        timeline::timeline_clear_file,
        timeline::timeline_clear_all,
        timeline::timeline_get_content,
        timeline::timeline_compare,
        timeline::timeline_set_label,
        timeline::timeline_get_stats,
    };
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn timeline_source_serde_round_trip() {
        let variants = vec![
            (TimelineSource::AutoSave, r#""autoSave""#),
            (TimelineSource::ManualSave, r#""manualSave""#),
            (TimelineSource::Undo, r#""undo""#),
            (TimelineSource::GitCommit, r#""gitCommit""#),
            (TimelineSource::Refactor, r#""refactor""#),
        ];
        for (variant, expected_json) in variants {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, expected_json);
            let deserialized: TimelineSource = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, variant);
        }
    }

    #[test]
    fn timeline_entry_construction_and_serialization() {
        let entry = TimelineEntry {
            id: "abc-123".to_string(),
            file_path: "/tmp/test.rs".to_string(),
            timestamp: 1700000000000,
            label: Some("before refactor".to_string()),
            source: TimelineSource::ManualSave,
            size: 4096,
            snapshot_path: "/data/snapshots/abc.snapshot".to_string(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["filePath"], "/tmp/test.rs");
        assert_eq!(parsed["snapshotPath"], "/data/snapshots/abc.snapshot");
        assert_eq!(parsed["label"], "before refactor");

        let deserialized: TimelineEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "abc-123");
        assert_eq!(deserialized.size, 4096);
    }

    #[test]
    fn timeline_entry_with_no_label() {
        let entry = TimelineEntry {
            id: "x".to_string(),
            file_path: "/f".to_string(),
            timestamp: 0,
            label: None,
            source: TimelineSource::AutoSave,
            size: 0,
            snapshot_path: "/s".to_string(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: TimelineEntry = serde_json::from_str(&json).unwrap();
        assert!(deserialized.label.is_none());
    }

    #[test]
    fn timeline_stats_serialization() {
        let stats = TimelineStats {
            total_entries: 42,
            total_files: 7,
            disk_usage_bytes: 1024 * 1024,
        };
        let json = serde_json::to_string(&stats).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["totalEntries"], 42);
        assert_eq!(parsed["totalFiles"], 7);
        assert_eq!(parsed["diskUsageBytes"], 1024 * 1024);
    }

    #[test]
    fn timeline_state_new_and_default() {
        let state = TimelineState::new();
        assert_eq!(state.max_entries_per_file, 50);
        assert_eq!(state.max_file_size, 10 * 1024 * 1024);

        let default_state = TimelineState::default();
        assert_eq!(default_state.max_entries_per_file, 50);
    }

    #[test]
    fn hash_path_deterministic() {
        let h1 = hash_path("/some/file.rs");
        let h2 = hash_path("/some/file.rs");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 16);
    }

    #[test]
    fn hash_path_different_inputs() {
        let h1 = hash_path("/a/b.rs");
        let h2 = hash_path("/c/d.rs");
        assert_ne!(h1, h2);
    }

    #[test]
    fn now_timestamp_returns_nonzero() {
        let ts = now_timestamp();
        assert!(ts > 0);
    }

    #[test]
    fn compute_diff_identical_text() {
        let text = "line1\nline2\nline3\n";
        let (hunks, added, removed) = compute_diff(text, text);
        assert_eq!(added, 0);
        assert_eq!(removed, 0);
        assert!(hunks.is_empty());
    }

    #[test]
    fn compute_diff_added_lines() {
        let old = "line1\nline2\n";
        let new = "line1\nline2\nline3\n";
        let (hunks, added, removed) = compute_diff(old, new);
        assert_eq!(added, 1);
        assert_eq!(removed, 0);
        assert!(!hunks.is_empty());
    }

    #[test]
    fn compute_diff_removed_lines() {
        let old = "line1\nline2\nline3\n";
        let new = "line1\nline2\n";
        let (hunks, added, removed) = compute_diff(old, new);
        assert_eq!(added, 0);
        assert_eq!(removed, 1);
        assert!(!hunks.is_empty());
    }

    #[test]
    fn compute_diff_modified_line() {
        let old = "line1\nold line\nline3\n";
        let new = "line1\nnew line\nline3\n";
        let (hunks, added, removed) = compute_diff(old, new);
        assert_eq!(added, 1);
        assert_eq!(removed, 1);
        assert!(!hunks.is_empty());
    }

    #[test]
    fn compute_diff_empty_old() {
        let (hunks, added, removed) = compute_diff("", "line1\nline2\n");
        assert_eq!(removed, 0);
        assert!(added > 0);
        assert!(!hunks.is_empty());
    }

    #[test]
    fn compute_diff_empty_new() {
        let (hunks, added, removed) = compute_diff("line1\nline2\n", "");
        assert_eq!(added, 0);
        assert!(removed > 0);
        assert!(!hunks.is_empty());
    }

    #[test]
    fn compute_diff_both_empty() {
        let (hunks, added, removed) = compute_diff("", "");
        assert_eq!(added, 0);
        assert_eq!(removed, 0);
        assert!(hunks.is_empty());
    }

    #[test]
    fn diff_line_construction() {
        let line = DiffLine {
            kind: "added".to_string(),
            content: "hello".to_string(),
        };
        assert_eq!(line.kind, "added");
        assert_eq!(line.content, "hello");
    }

    #[test]
    fn diff_hunk_construction() {
        let hunk = DiffHunk {
            old_start: 1,
            old_count: 3,
            new_start: 1,
            new_count: 4,
            lines: vec![],
        };
        assert_eq!(hunk.old_start, 1);
        assert_eq!(hunk.new_count, 4);
    }

    #[test]
    fn diff_result_serialization() {
        let result = DiffResult {
            old_entry_id: "old".to_string(),
            new_entry_id: "new".to_string(),
            added_lines: 5,
            removed_lines: 2,
            hunks: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["oldEntryId"], "old");
        assert_eq!(parsed["newEntryId"], "new");
        assert_eq!(parsed["addedLines"], 5);
        assert_eq!(parsed["removedLines"], 2);
    }

    #[test]
    fn get_storage_dir_returns_error_when_uninitialized() {
        let state = TimelineState::new();
        let result = get_storage_dir(&state);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not initialized"));
    }

    #[test]
    fn get_storage_dir_returns_path_when_set() {
        let state = TimelineState::new();
        {
            let mut dir = state.storage_dir.lock().unwrap();
            *dir = Some("/tmp/timeline".to_string());
        }
        let result = get_storage_dir(&state);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "/tmp/timeline");
    }

    #[test]
    fn state_entries_insert_and_retrieve() {
        let state = TimelineState::new();
        let entry = TimelineEntry {
            id: "e1".to_string(),
            file_path: "/test.rs".to_string(),
            timestamp: 100,
            label: None,
            source: TimelineSource::AutoSave,
            size: 256,
            snapshot_path: "/snap/e1".to_string(),
        };
        {
            let mut entries = state.entries.lock().unwrap();
            entries
                .entry("/test.rs".to_string())
                .or_default()
                .push(entry);
        }
        let entries = state.entries.lock().unwrap();
        let file_entries = entries.get("/test.rs").unwrap();
        assert_eq!(file_entries.len(), 1);
        assert_eq!(file_entries[0].id, "e1");
    }

    #[test]
    fn state_entries_multiple_files() {
        let state = TimelineState::new();
        {
            let mut entries = state.entries.lock().unwrap();
            entries
                .entry("/a.rs".to_string())
                .or_default()
                .push(TimelineEntry {
                    id: "a1".to_string(),
                    file_path: "/a.rs".to_string(),
                    timestamp: 1,
                    label: None,
                    source: TimelineSource::Undo,
                    size: 10,
                    snapshot_path: "/s/a1".to_string(),
                });
            entries
                .entry("/b.rs".to_string())
                .or_default()
                .push(TimelineEntry {
                    id: "b1".to_string(),
                    file_path: "/b.rs".to_string(),
                    timestamp: 2,
                    label: None,
                    source: TimelineSource::Refactor,
                    size: 20,
                    snapshot_path: "/s/b1".to_string(),
                });
        }
        let entries = state.entries.lock().unwrap();
        assert_eq!(entries.len(), 2);
    }
}
