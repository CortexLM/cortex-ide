//! Audit Logging
//!
//! Comprehensive audit logging for the Agent Factory system.
//! Supports logging to memory, file, and SQLite database.

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;

use rusqlite::{Connection, params};

use super::types::{AuditEntry, AuditEventType, AuditFilter, AuditResult};

/// Audit logger for tracking all factory events
pub struct AuditLogger {
    /// In-memory log entries (ring buffer)
    entries: Vec<AuditEntry>,
    /// Maximum entries to keep in memory
    max_memory_entries: usize,
    /// SQLite connection (lazy initialized)
    db_connection: Option<Connection>,
    /// Path to the audit database
    db_path: Option<PathBuf>,
    /// Path to the audit log file
    log_file_path: Option<PathBuf>,
    /// ID counter
    next_id: u64,
}

impl AuditLogger {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            max_memory_entries: 10000,
            db_connection: None,
            db_path: None,
            log_file_path: None,
            next_id: 1,
        }
    }

    /// Initialize with a database path
    pub fn with_database(mut self, db_path: PathBuf) -> Result<Self, String> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create audit db directory: {}", e))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open audit database: {}", e))?;

        // Create tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_entries (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                actor TEXT NOT NULL,
                target TEXT,
                action TEXT NOT NULL,
                description TEXT,
                metadata TEXT,
                risk_level TEXT,
                result TEXT NOT NULL,
                workflow_id TEXT,
                execution_id TEXT,
                agent_id TEXT
            )",
            [],
        )
        .map_err(|e| format!("Failed to create audit table: {}", e))?;

        // Create indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp)",
            [],
        )
        .ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_workflow ON audit_entries(workflow_id)",
            [],
        )
        .ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_entries(agent_id)",
            [],
        )
        .ok();

        self.db_connection = Some(conn);
        self.db_path = Some(db_path);
        Ok(self)
    }

    /// Set the log file path
    pub fn with_log_file(mut self, path: PathBuf) -> Self {
        self.log_file_path = Some(path);
        self
    }

    /// Log an event
    pub fn log(
        &mut self,
        action: &str,
        actor: &str,
        target: Option<&str>,
        description: &str,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> String {
        let entry = AuditEntry {
            id: format!("audit_{}", self.next_id),
            timestamp: Self::now_ms(),
            event_type: Self::action_to_event_type(action),
            actor: actor.to_string(),
            target: target.map(|s| s.to_string()),
            action: action.to_string(),
            description: Some(description.to_string()),
            metadata: metadata.unwrap_or_default(),
            risk_level: None,
            result: AuditResult::Success,
            workflow_id: None,
            execution_id: None,
            agent_id: None,
        };

        self.next_id += 1;
        self.store_entry(entry.clone());
        entry.id
    }

    /// Log a detailed entry
    pub fn log_entry(&mut self, mut entry: AuditEntry) -> String {
        if entry.id.is_empty() {
            entry.id = format!("audit_{}", self.next_id);
            self.next_id += 1;
        }
        if entry.timestamp == 0 {
            entry.timestamp = Self::now_ms();
        }

        let id = entry.id.clone();
        self.store_entry(entry);
        id
    }

    /// Store an entry in all configured destinations
    fn store_entry(&mut self, entry: AuditEntry) {
        // Store in memory
        self.entries.push(entry.clone());
        if self.entries.len() > self.max_memory_entries {
            self.entries.remove(0);
        }

        // Store in database
        if let Some(conn) = &self.db_connection {
            let _ = conn.execute(
                "INSERT INTO audit_entries (
                    id, timestamp, event_type, actor, target, action,
                    description, metadata, risk_level, result,
                    workflow_id, execution_id, agent_id
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    entry.id,
                    entry.timestamp as i64,
                    format!("{:?}", entry.event_type),
                    entry.actor,
                    entry.target,
                    entry.action,
                    entry.description,
                    serde_json::to_string(&entry.metadata).ok(),
                    entry.risk_level.map(|r| format!("{:?}", r)),
                    format!("{:?}", entry.result),
                    entry.workflow_id,
                    entry.execution_id,
                    entry.agent_id,
                ],
            );
        }

        // Write to log file
        if let Some(path) = &self.log_file_path {
            if let Ok(file) = OpenOptions::new().create(true).append(true).open(path) {
                let mut writer = BufWriter::new(file);
                if let Ok(json) = serde_json::to_string(&entry) {
                    let _ = writeln!(writer, "{}", json);
                }
            }
        }
    }

    /// Query entries with filtering
    pub fn query(&self, filter: AuditFilter) -> Vec<AuditEntry> {
        let mut results: Vec<AuditEntry> = self
            .entries
            .iter()
            .filter(|e| {
                // Filter by event types
                if let Some(types) = &filter.event_types {
                    if !types.contains(&e.event_type) {
                        return false;
                    }
                }

                // Filter by actor
                if let Some(actor) = &filter.actor {
                    if &e.actor != actor {
                        return false;
                    }
                }

                // Filter by workflow ID
                if let Some(wf_id) = &filter.workflow_id {
                    if e.workflow_id.as_ref() != Some(wf_id) {
                        return false;
                    }
                }

                // Filter by execution ID
                if let Some(exec_id) = &filter.execution_id {
                    if e.execution_id.as_ref() != Some(exec_id) {
                        return false;
                    }
                }

                // Filter by agent ID
                if let Some(agent_id) = &filter.agent_id {
                    if e.agent_id.as_ref() != Some(agent_id) {
                        return false;
                    }
                }

                // Filter by risk level
                if let Some(min_risk) = &filter.min_risk_level {
                    if let Some(entry_risk) = &e.risk_level {
                        if entry_risk < min_risk {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }

                // Filter by timestamp range
                if let Some(from) = filter.from_timestamp {
                    if e.timestamp < from {
                        return false;
                    }
                }
                if let Some(to) = filter.to_timestamp {
                    if e.timestamp > to {
                        return false;
                    }
                }

                true
            })
            .cloned()
            .collect();

        // Sort by timestamp descending (most recent first)
        results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Apply offset and limit
        let start = filter.offset.min(results.len());
        let end = (start + filter.limit).min(results.len());
        results[start..end].to_vec()
    }

    /// Get an entry by ID
    pub fn get_entry(&self, entry_id: &str) -> Option<&AuditEntry> {
        self.entries.iter().find(|e| e.id == entry_id)
    }

    /// Export entries to a file
    pub fn export_to_file(&self, path: &str, filter: Option<AuditFilter>) -> Result<usize, String> {
        let entries = if let Some(f) = filter {
            self.query(f)
        } else {
            self.entries.clone()
        };

        let file =
            File::create(path).map_err(|e| format!("Failed to create export file: {}", e))?;

        let mut writer = BufWriter::new(file);

        for entry in &entries {
            let json = serde_json::to_string(entry)
                .map_err(|e| format!("Failed to serialize entry: {}", e))?;
            writeln!(writer, "{}", json).map_err(|e| format!("Failed to write entry: {}", e))?;
        }

        Ok(entries.len())
    }

    /// Get statistics about the audit log
    pub fn get_stats(&self) -> AuditStats {
        let mut event_counts: HashMap<String, usize> = HashMap::new();
        let mut risk_counts: HashMap<String, usize> = HashMap::new();

        for entry in &self.entries {
            *event_counts
                .entry(format!("{:?}", entry.event_type))
                .or_insert(0) += 1;
            if let Some(risk) = &entry.risk_level {
                *risk_counts.entry(format!("{:?}", risk)).or_insert(0) += 1;
            }
        }

        AuditStats {
            total_entries: self.entries.len(),
            entries_in_memory: self.entries.len(),
            event_type_counts: event_counts,
            risk_level_counts: risk_counts,
            oldest_entry_timestamp: self.entries.first().map(|e| e.timestamp),
            newest_entry_timestamp: self.entries.last().map(|e| e.timestamp),
        }
    }

    /// Clear all entries from memory
    pub fn clear_memory(&mut self) {
        self.entries.clear();
    }

    /// Convert action string to event type
    fn action_to_event_type(action: &str) -> AuditEventType {
        match action.to_lowercase().as_str() {
            "workflow_created" => AuditEventType::WorkflowCreated,
            "workflow_updated" => AuditEventType::WorkflowUpdated,
            "workflow_deleted" => AuditEventType::WorkflowDeleted,
            "workflow_started" => AuditEventType::WorkflowStarted,
            "workflow_completed" => AuditEventType::WorkflowCompleted,
            "workflow_failed" => AuditEventType::WorkflowFailed,
            "workflow_paused" => AuditEventType::WorkflowPaused,
            "workflow_resumed" => AuditEventType::WorkflowResumed,
            "workflow_stopped" => AuditEventType::WorkflowFailed,
            "workflow_imported" => AuditEventType::WorkflowCreated,
            "agent_created" | "agent_spawned" => AuditEventType::AgentSpawned,
            "agent_completed" => AuditEventType::AgentCompleted,
            "agent_failed" | "agent_deleted" => AuditEventType::AgentFailed,
            "step_executed" => AuditEventType::StepExecuted,
            "interception_triggered" => AuditEventType::InterceptionTriggered,
            "approval_requested" => AuditEventType::ApprovalRequested,
            "approval_granted" => AuditEventType::ApprovalGranted,
            "approval_denied" => AuditEventType::ApprovalDenied,
            "approval_modified" => AuditEventType::ApprovalModified,
            "approval_timeout" => AuditEventType::ApprovalTimeout,
            "file_access" => AuditEventType::FileAccess,
            "shell_execution" => AuditEventType::ShellExecution,
            "tool_execution" => AuditEventType::ToolExecution,
            "error" => AuditEventType::Error,
            "warning" => AuditEventType::Warning,
            _ => AuditEventType::Info,
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

impl Default for AuditLogger {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics about the audit log
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditStats {
    pub total_entries: usize,
    pub entries_in_memory: usize,
    pub event_type_counts: HashMap<String, usize>,
    pub risk_level_counts: HashMap<String, usize>,
    pub oldest_entry_timestamp: Option<u64>,
    pub newest_entry_timestamp: Option<u64>,
}
