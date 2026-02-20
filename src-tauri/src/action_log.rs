//! ActionLog - Agent Action Tracking System
//!
//! Provides comprehensive tracking of AI agent actions including file operations,
//! terminal commands, search queries, and tool executions. Inspired by Zed's
//! implementation for maintaining diff information and enabling accept/reject
//! workflows for agent changes.
//!
//! # Features
//! - Real-time action logging with event emission for UI updates
//! - File tracking with diff support for agent modifications
//! - Session-based action grouping
//! - Accept/reject workflow for reverting agent changes

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Types of actions that an AI agent can perform
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentAction {
    /// Agent read a file
    FileRead {
        path: String,
        lines_read: Option<u32>,
    },
    /// Agent edited a file
    FileEdit {
        path: String,
        lines_changed: u32,
        diff_preview: Option<String>,
    },
    /// Agent created a new file
    FileCreate { path: String },
    /// Agent deleted a file
    FileDelete { path: String },
    /// Agent listed a directory
    DirectoryList { path: String, file_count: u32 },
    /// Agent performed a search
    Search { query: String, results_count: u32 },
    /// Agent executed a terminal command
    TerminalCommand {
        command: String,
        cwd: Option<String>,
    },
    /// Terminal output from a command
    TerminalOutput { output: String, is_error: bool },
    /// Agent is thinking/reasoning
    Thinking { content: String },
    /// Agent started using a tool
    ToolStart { tool_name: String, tool_id: String },
    /// Agent completed using a tool
    ToolComplete {
        tool_id: String,
        success: bool,
        duration_ms: u64,
    },
}

impl AgentAction {
    /// Get a human-readable description of the action
    pub fn description(&self) -> String {
        match self {
            AgentAction::FileRead { path, lines_read } => match lines_read {
                Some(lines) => format!("Read {} lines from {}", lines, path),
                None => format!("Read file {}", path),
            },
            AgentAction::FileEdit {
                path,
                lines_changed,
                ..
            } => {
                format!("Edited {} ({} lines changed)", path, lines_changed)
            }
            AgentAction::FileCreate { path } => format!("Created file {}", path),
            AgentAction::FileDelete { path } => format!("Deleted file {}", path),
            AgentAction::DirectoryList { path, file_count } => {
                format!("Listed {} ({} items)", path, file_count)
            }
            AgentAction::Search {
                query,
                results_count,
            } => {
                format!("Searched '{}' ({} results)", query, results_count)
            }
            AgentAction::TerminalCommand { command, cwd } => match cwd {
                Some(dir) => format!("Ran '{}' in {}", command, dir),
                None => format!("Ran '{}'", command),
            },
            AgentAction::TerminalOutput { is_error, .. } => {
                if *is_error {
                    "Error output".to_string()
                } else {
                    "Command output".to_string()
                }
            }
            AgentAction::Thinking { .. } => "Thinking...".to_string(),
            AgentAction::ToolStart { tool_name, .. } => format!("Started tool: {}", tool_name),
            AgentAction::ToolComplete {
                tool_id,
                success,
                duration_ms,
            } => {
                if *success {
                    format!("Tool {} completed in {}ms", tool_id, duration_ms)
                } else {
                    format!("Tool {} failed after {}ms", tool_id, duration_ms)
                }
            }
        }
    }

    /// Get the action category for filtering
    pub fn category(&self) -> &'static str {
        match self {
            AgentAction::FileRead { .. } => "file",
            AgentAction::FileEdit { .. } => "file",
            AgentAction::FileCreate { .. } => "file",
            AgentAction::FileDelete { .. } => "file",
            AgentAction::DirectoryList { .. } => "file",
            AgentAction::Search { .. } => "search",
            AgentAction::TerminalCommand { .. } => "terminal",
            AgentAction::TerminalOutput { .. } => "terminal",
            AgentAction::Thinking { .. } => "thinking",
            AgentAction::ToolStart { .. } => "tool",
            AgentAction::ToolComplete { .. } => "tool",
        }
    }
}

/// A logged action entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionLogEntry {
    /// Unique identifier for this entry
    pub id: String,
    /// Unix timestamp in milliseconds when the action occurred
    pub timestamp: u64,
    /// The action that was performed
    pub action: AgentAction,
    /// Session ID this action belongs to
    pub session_id: String,
    /// Human-readable description
    pub description: String,
    /// Action category for filtering
    pub category: String,
}

impl ActionLogEntry {
    /// Create a new action log entry
    pub fn new(action: AgentAction, session_id: &str) -> Self {
        let description = action.description();
        let category = action.category().to_string();
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Self::now_ms(),
            action,
            session_id: session_id.to_string(),
            description,
            category,
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

/// Status of agent changes to a file
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeStatus {
    /// Changes are pending review
    Pending,
    /// Changes have been accepted
    Accepted,
    /// Changes have been rejected/reverted
    Rejected,
}

/// Information about an individual edit made by the agent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEdit {
    /// Unique ID for this edit
    pub id: String,
    /// Timestamp when the edit was made
    pub timestamp: u64,
    /// Line number where the edit starts
    pub start_line: u32,
    /// Line number where the edit ends
    pub end_line: u32,
    /// Original content that was replaced
    pub original_content: String,
    /// New content that was inserted
    pub new_content: String,
    /// Preview of the diff
    pub diff_preview: Option<String>,
}

/// Tracks a file that has been modified by the agent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackedFile {
    /// File path
    pub path: String,
    /// Original content when tracking started
    pub original_content: String,
    /// Current content after agent modifications
    pub current_content: String,
    /// List of edits made by the agent
    pub agent_edits: Vec<AgentEdit>,
    /// Status of the changes
    pub status: FileChangeStatus,
    /// Session ID this file is tracked for
    pub session_id: String,
    /// Timestamp when tracking started
    pub tracked_at: u64,
    /// Last modification timestamp
    pub last_modified: u64,
}

impl TrackedFile {
    /// Create a new tracked file
    pub fn new(path: &str, original_content: &str, session_id: &str) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        Self {
            path: path.to_string(),
            original_content: original_content.to_string(),
            current_content: original_content.to_string(),
            agent_edits: Vec::new(),
            status: FileChangeStatus::Pending,
            session_id: session_id.to_string(),
            tracked_at: now,
            last_modified: now,
        }
    }

    /// Record an edit made by the agent
    pub fn record_edit(
        &mut self,
        start_line: u32,
        end_line: u32,
        original: &str,
        new_content: &str,
    ) -> String {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let edit_id = Uuid::new_v4().to_string();

        // Generate a simple diff preview
        let diff_preview = Self::generate_diff_preview(original, new_content);

        let edit = AgentEdit {
            id: edit_id.clone(),
            timestamp: now,
            start_line,
            end_line,
            original_content: original.to_string(),
            new_content: new_content.to_string(),
            diff_preview: Some(diff_preview),
        };

        self.agent_edits.push(edit);
        self.current_content = new_content.to_string();
        self.last_modified = now;

        edit_id
    }

    /// Generate a simple diff preview string
    fn generate_diff_preview(original: &str, new_content: &str) -> String {
        let original_lines: Vec<&str> = original.lines().collect();
        let new_lines: Vec<&str> = new_content.lines().collect();

        let mut preview = String::new();
        let max_lines = 5; // Limit preview to 5 lines
        let mut shown = 0;

        // Show removed lines
        for line in original_lines.iter().take(max_lines) {
            preview.push_str(&format!("- {}\n", line));
            shown += 1;
            if shown >= max_lines {
                break;
            }
        }

        if shown < max_lines {
            // Show added lines
            for line in new_lines.iter().take(max_lines - shown) {
                preview.push_str(&format!("+ {}\n", line));
            }
        }

        if original_lines.len() > max_lines || new_lines.len() > max_lines {
            preview.push_str("...\n");
        }

        preview
    }

    /// Check if there are pending changes
    pub fn has_pending_changes(&self) -> bool {
        self.status == FileChangeStatus::Pending && !self.agent_edits.is_empty()
    }

    /// Get the number of lines changed
    pub fn lines_changed(&self) -> u32 {
        let original_lines = self.original_content.lines().count();
        let current_lines = self.current_content.lines().count();
        (original_lines as i32 - current_lines as i32).unsigned_abs()
    }
}

/// Summary of a tracked file for the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackedFileSummary {
    pub path: String,
    pub edit_count: usize,
    pub lines_changed: u32,
    pub status: FileChangeStatus,
    pub tracked_at: u64,
    pub last_modified: u64,
}

impl From<&TrackedFile> for TrackedFileSummary {
    fn from(file: &TrackedFile) -> Self {
        Self {
            path: file.path.clone(),
            edit_count: file.agent_edits.len(),
            lines_changed: file.lines_changed(),
            status: file.status,
            tracked_at: file.tracked_at,
            last_modified: file.last_modified,
        }
    }
}

/// Event emitted when action log state changes
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionLogEvent {
    /// Type of event
    pub event_type: String,
    /// Optional entry that was affected
    pub entry: Option<ActionLogEntry>,
    /// Optional file that was affected
    pub file_path: Option<String>,
    /// Optional session ID
    pub session_id: Option<String>,
}

/// Configuration for action log behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionLogConfig {
    /// Maximum number of entries to keep per session
    pub max_entries_per_session: usize,
    /// Whether to auto-track files on edit
    pub auto_track_files: bool,
    /// Whether to emit events for UI updates
    pub emit_events: bool,
}

impl Default for ActionLogConfig {
    fn default() -> Self {
        Self {
            max_entries_per_session: 1000,
            auto_track_files: true,
            emit_events: true,
        }
    }
}

// ============================================================================
// State
// ============================================================================

/// Internal state for the action log
struct ActionLogInner {
    /// Action entries grouped by session ID
    entries: HashMap<String, Vec<ActionLogEntry>>,
    /// Tracked files by path
    tracked_files: HashMap<String, TrackedFile>,
    /// Current active session ID
    current_session: Option<String>,
    /// Configuration
    config: ActionLogConfig,
    /// Entry counter for generating sequential IDs
    entry_counter: u64,
}

impl ActionLogInner {
    fn new() -> Self {
        Self {
            entries: HashMap::new(),
            tracked_files: HashMap::new(),
            current_session: None,
            config: ActionLogConfig::default(),
            entry_counter: 0,
        }
    }
}

/// Thread-safe state manager for action logging
pub struct ActionLogState {
    inner: RwLock<ActionLogInner>,
}

impl ActionLogState {
    /// Create a new action log state
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(ActionLogInner::new()),
        }
    }

    /// Get or create the current session ID
    fn ensure_session(&self) -> String {
        let mut inner = match self.inner.write() {
            Ok(g) => g,
            Err(_) => {
                tracing::error!("Failed to acquire write lock in ensure_session");
                return Uuid::new_v4().to_string();
            }
        };
        if inner.current_session.is_none() {
            inner.current_session = Some(Uuid::new_v4().to_string());
        }
        inner
            .current_session
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string())
    }

    /// Log an action and return the entry
    fn log_action_internal(&self, action: AgentAction, session_id: Option<&str>) -> ActionLogEntry {
        let mut inner = match self.inner.write() {
            Ok(g) => g,
            Err(_) => {
                tracing::error!("Failed to acquire write lock in log_action_internal");
                // Return a minimal entry without storing it
                return ActionLogEntry::new(action, session_id.unwrap_or("unknown"));
            }
        };

        // Use provided session or current session
        let session = session_id
            .map(|s| s.to_string())
            .or_else(|| inner.current_session.clone())
            .unwrap_or_else(|| {
                let new_session = Uuid::new_v4().to_string();
                inner.current_session = Some(new_session.clone());
                new_session
            });

        let entry = ActionLogEntry::new(action, &session);

        // Get config limit before modifying entries
        let max_entries = inner.config.max_entries_per_session;

        // Add to entries map
        inner
            .entries
            .entry(session.clone())
            .or_insert_with(Vec::new)
            .push(entry.clone());

        // Trim entries if over limit
        if let Some(entries) = inner.entries.get_mut(&session) {
            if entries.len() > max_entries {
                let drain_count = entries.len() - max_entries;
                entries.drain(0..drain_count);
            }
        }

        inner.entry_counter += 1;

        entry
    }
}

impl Default for ActionLogState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Log a new action entry and emit an event for UI updates
#[tauri::command]
pub async fn action_log_entry(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    action: AgentAction,
    session_id: Option<String>,
) -> Result<ActionLogEntry, String> {
    let entry = state.log_action_internal(action, session_id.as_deref());

    // Emit event for real-time UI updates
    let event = ActionLogEvent {
        event_type: "action_logged".to_string(),
        entry: Some(entry.clone()),
        file_path: None,
        session_id: Some(entry.session_id.clone()),
    };
    let _ = app.emit("agent-action", &event);

    Ok(entry)
}

/// Get recent action log entries for a session
#[tauri::command]
pub async fn action_log_get_entries(
    state: State<'_, Arc<ActionLogState>>,
    session_id: Option<String>,
    limit: Option<usize>,
    category: Option<String>,
) -> Result<Vec<ActionLogEntry>, String> {
    let inner = state
        .inner
        .read()
        .map_err(|_| "Failed to acquire read lock")?;

    // Use provided session or current session
    let session = session_id.or_else(|| inner.current_session.clone());

    let Some(session) = session else {
        return Ok(Vec::new());
    };

    let Some(entries) = inner.entries.get(&session) else {
        return Ok(Vec::new());
    };

    let limit = limit.unwrap_or(100);

    let filtered: Vec<ActionLogEntry> = entries
        .iter()
        .rev() // Most recent first
        .filter(|e| {
            if let Some(ref cat) = category {
                &e.category == cat
            } else {
                true
            }
        })
        .take(limit)
        .cloned()
        .collect();

    Ok(filtered)
}

/// Start tracking a file for diff generation
#[tauri::command]
pub async fn action_log_track_file(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    path: String,
    content: String,
    session_id: Option<String>,
) -> Result<(), String> {
    let session = session_id.unwrap_or_else(|| state.ensure_session());

    {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;

        // Don't overwrite if already tracking with pending changes
        if let Some(existing) = inner.tracked_files.get(&path) {
            if existing.has_pending_changes() {
                return Err("File is already being tracked with pending changes".to_string());
            }
        }

        let tracked = TrackedFile::new(&path, &content, &session);
        inner.tracked_files.insert(path.clone(), tracked);
    }

    // Emit event
    let event = ActionLogEvent {
        event_type: "file_tracked".to_string(),
        entry: None,
        file_path: Some(path),
        session_id: Some(session),
    };
    let _ = app.emit("agent-action", &event);

    Ok(())
}

/// Record an edit to a tracked file
#[tauri::command]
pub async fn action_log_record_edit(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    path: String,
    start_line: u32,
    end_line: u32,
    original_content: String,
    new_content: String,
) -> Result<String, String> {
    let edit_id = {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;

        let file = inner
            .tracked_files
            .get_mut(&path)
            .ok_or_else(|| format!("File is not being tracked: {}", path))?;

        file.record_edit(start_line, end_line, &original_content, &new_content)
    };

    // Emit event
    let event = ActionLogEvent {
        event_type: "file_edited".to_string(),
        entry: None,
        file_path: Some(path),
        session_id: None,
    };
    let _ = app.emit("agent-action", &event);

    Ok(edit_id)
}

/// Get diff information for a tracked file
#[tauri::command]
pub async fn action_log_get_file_diff(
    state: State<'_, Arc<ActionLogState>>,
    path: String,
) -> Result<Option<TrackedFile>, String> {
    let inner = state
        .inner
        .read()
        .map_err(|_| "Failed to acquire read lock")?;
    Ok(inner.tracked_files.get(&path).cloned())
}

/// Get all tracked files with a summary
#[tauri::command]
pub async fn action_log_get_tracked_files(
    state: State<'_, Arc<ActionLogState>>,
    session_id: Option<String>,
) -> Result<Vec<TrackedFileSummary>, String> {
    let inner = state
        .inner
        .read()
        .map_err(|_| "Failed to acquire read lock")?;

    let files: Vec<TrackedFileSummary> = inner
        .tracked_files
        .values()
        .filter(|f| {
            if let Some(ref session) = session_id {
                &f.session_id == session
            } else {
                true
            }
        })
        .map(TrackedFileSummary::from)
        .collect();

    Ok(files)
}

/// Accept agent changes to a file
#[tauri::command]
pub async fn action_log_accept_changes(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    path: String,
) -> Result<(), String> {
    {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;

        let file = inner
            .tracked_files
            .get_mut(&path)
            .ok_or_else(|| format!("File is not being tracked: {}", path))?;

        file.status = FileChangeStatus::Accepted;
        // Clear edits since they're now accepted
        file.agent_edits.clear();
        // Update original to current (changes are now the baseline)
        file.original_content = file.current_content.clone();
    }

    // Emit event
    let event = ActionLogEvent {
        event_type: "changes_accepted".to_string(),
        entry: None,
        file_path: Some(path),
        session_id: None,
    };
    let _ = app.emit("agent-action", &event);

    Ok(())
}

/// Reject agent changes and get the original content for reverting
#[tauri::command]
pub async fn action_log_reject_changes(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    path: String,
) -> Result<String, String> {
    let original_content = {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;

        let file = inner
            .tracked_files
            .get_mut(&path)
            .ok_or_else(|| format!("File is not being tracked: {}", path))?;

        file.status = FileChangeStatus::Rejected;
        // Get original content for reverting
        let original = file.original_content.clone();
        // Reset current to original
        file.current_content = original.clone();
        // Clear edits
        file.agent_edits.clear();

        original
    };

    // Emit event
    let event = ActionLogEvent {
        event_type: "changes_rejected".to_string(),
        entry: None,
        file_path: Some(path),
        session_id: None,
    };
    let _ = app.emit("agent-action", &event);

    Ok(original_content)
}

/// Stop tracking a file
#[tauri::command]
pub async fn action_log_untrack_file(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    path: String,
) -> Result<(), String> {
    {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;
        inner.tracked_files.remove(&path);
    }

    // Emit event
    let event = ActionLogEvent {
        event_type: "file_untracked".to_string(),
        entry: None,
        file_path: Some(path),
        session_id: None,
    };
    let _ = app.emit("agent-action", &event);

    Ok(())
}

/// Clear all entries and tracked files for a session
#[tauri::command]
pub async fn action_log_clear_session(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
    session_id: Option<String>,
) -> Result<(), String> {
    let cleared_session = {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;

        // Use provided session or current session
        let session = session_id.or_else(|| inner.current_session.clone());

        let Some(session) = session else {
            return Ok(());
        };

        // Remove entries for this session
        inner.entries.remove(&session);

        // Remove tracked files for this session
        inner.tracked_files.retain(|_, f| f.session_id != session);

        // Clear current session if it matches
        if inner.current_session.as_ref() == Some(&session) {
            inner.current_session = None;
        }

        session
    };

    // Emit event
    let event = ActionLogEvent {
        event_type: "session_cleared".to_string(),
        entry: None,
        file_path: None,
        session_id: Some(cleared_session),
    };
    let _ = app.emit("agent-action", &event);

    Ok(())
}

/// Create a new session and return its ID
#[tauri::command]
pub async fn action_log_new_session(
    app: AppHandle,
    state: State<'_, Arc<ActionLogState>>,
) -> Result<String, String> {
    let session_id = {
        let mut inner = state
            .inner
            .write()
            .map_err(|_| "Failed to acquire write lock")?;
        let new_session = Uuid::new_v4().to_string();
        inner.current_session = Some(new_session.clone());
        new_session
    };

    // Emit event
    let event = ActionLogEvent {
        event_type: "session_created".to_string(),
        entry: None,
        file_path: None,
        session_id: Some(session_id.clone()),
    };
    let _ = app.emit("agent-action", &event);

    Ok(session_id)
}

/// Get the current session ID
#[tauri::command]
pub async fn action_log_get_session(
    state: State<'_, Arc<ActionLogState>>,
) -> Result<Option<String>, String> {
    let inner = state
        .inner
        .read()
        .map_err(|_| "Failed to acquire read lock")?;
    Ok(inner.current_session.clone())
}

/// Get statistics about the action log
#[tauri::command]
pub async fn action_log_get_stats(
    state: State<'_, Arc<ActionLogState>>,
    session_id: Option<String>,
) -> Result<ActionLogStats, String> {
    let inner = state
        .inner
        .read()
        .map_err(|_| "Failed to acquire read lock")?;

    let session = session_id.or_else(|| inner.current_session.clone());

    let entry_count = session
        .as_ref()
        .and_then(|s| inner.entries.get(s))
        .map(|e| e.len())
        .unwrap_or(0);

    let tracked_file_count = session
        .as_ref()
        .map(|s| {
            inner
                .tracked_files
                .values()
                .filter(|f| &f.session_id == s)
                .count()
        })
        .unwrap_or(inner.tracked_files.len());

    let pending_changes_count = inner
        .tracked_files
        .values()
        .filter(|f| {
            if let Some(ref s) = session {
                &f.session_id == s && f.has_pending_changes()
            } else {
                f.has_pending_changes()
            }
        })
        .count();

    Ok(ActionLogStats {
        entry_count,
        tracked_file_count,
        pending_changes_count,
        session_count: inner.entries.len(),
        current_session: inner.current_session.clone(),
    })
}

/// Statistics about the action log
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionLogStats {
    pub entry_count: usize,
    pub tracked_file_count: usize,
    pub pending_changes_count: usize,
    pub session_count: usize,
    pub current_session: Option<String>,
}

/// Update the action log configuration
#[tauri::command]
pub async fn action_log_set_config(
    state: State<'_, Arc<ActionLogState>>,
    config: ActionLogConfig,
) -> Result<(), String> {
    let mut inner = state
        .inner
        .write()
        .map_err(|_| "Failed to acquire write lock")?;
    inner.config = config;
    Ok(())
}

/// Get the current action log configuration
#[tauri::command]
pub async fn action_log_get_config(
    state: State<'_, Arc<ActionLogState>>,
) -> Result<ActionLogConfig, String> {
    let inner = state
        .inner
        .read()
        .map_err(|_| "Failed to acquire read lock")?;
    Ok(inner.config.clone())
}
