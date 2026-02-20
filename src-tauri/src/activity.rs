//! Activity Indicator Backend
//!
//! Provides system-level task tracking for the activity indicator.
//! Manages background tasks, progress reporting, and task lifecycle.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

// ============================================================================
// Types
// ============================================================================

/// Priority levels for task display ordering
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    High,
    Normal,
    Low,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Normal
    }
}

/// Task status states
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Source systems that can register tasks
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum TaskSource {
    Lsp,
    Git,
    Build,
    Format,
    Remote,
    Extension,
    AutoUpdate,
    Repl,
    Debug,
    System,
    Mcp,
    Custom,
}

/// Activity task representation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityTask {
    pub id: String,
    pub title: String,
    pub message: Option<String>,
    pub source: TaskSource,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub progress: Option<u8>,
    pub cancellable: bool,
    pub started_at: u64,
    pub completed_at: Option<u64>,
    pub error: Option<String>,
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Task history entry for completed tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskHistoryEntry {
    pub id: String,
    pub title: String,
    pub source: TaskSource,
    pub status: TaskStatus,
    pub started_at: u64,
    pub completed_at: u64,
    pub duration_ms: u64,
    pub error: Option<String>,
}

/// Options for creating a new task
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskOptions {
    pub title: String,
    pub message: Option<String>,
    pub source: TaskSource,
    #[serde(default)]
    pub priority: TaskPriority,
    pub progress: Option<u8>,
    #[serde(default)]
    pub cancellable: bool,
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Options for updating an existing task
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskOptions {
    pub title: Option<String>,
    pub message: Option<String>,
    pub progress: Option<u8>,
    pub status: Option<TaskStatus>,
    pub error: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Event emitted when activity state changes
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub event_type: String,
    pub task_id: Option<String>,
    pub task: Option<ActivityTask>,
    pub history_entry: Option<TaskHistoryEntry>,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for activity tracking
pub struct ActivityState {
    tasks: Mutex<HashMap<String, ActivityTask>>,
    history: Mutex<Vec<TaskHistoryEntry>>,
    max_history_size: usize,
    task_counter: Mutex<u64>,
}

impl ActivityState {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
            history: Mutex::new(Vec::new()),
            max_history_size: 100,
            task_counter: Mutex::new(0),
        }
    }

    fn generate_id(&self) -> String {
        let mut counter = self.task_counter.lock().unwrap_or_else(|e| e.into_inner());
        *counter += 1;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        format!("task_{}_{}", timestamp, *counter)
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}

impl Default for ActivityState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Create a new activity task
#[tauri::command]
pub async fn activity_create_task(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
    options: CreateTaskOptions,
) -> Result<String, String> {
    let id = state.generate_id();
    let now = ActivityState::now_ms();

    let task = ActivityTask {
        id: id.clone(),
        title: options.title,
        message: options.message,
        source: options.source,
        status: TaskStatus::Running,
        priority: options.priority,
        progress: options.progress.map(|p| p.min(100)),
        cancellable: options.cancellable,
        started_at: now,
        completed_at: None,
        error: None,
        metadata: options.metadata,
    };

    {
        let mut tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
        tasks.insert(id.clone(), task.clone());
    }

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "task_created".to_string(),
        task_id: Some(id.clone()),
        task: Some(task),
        history_entry: None,
    };
    let _ = app.emit("activity:update", &event);

    Ok(id)
}

/// Update an existing task
#[tauri::command]
pub async fn activity_update_task(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
    task_id: String,
    options: UpdateTaskOptions,
) -> Result<(), String> {
    let task = {
        let mut tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
        let task = tasks.get_mut(&task_id).ok_or("Task not found")?;

        if let Some(title) = options.title {
            task.title = title;
        }
        if let Some(message) = options.message {
            task.message = Some(message);
        }
        if let Some(progress) = options.progress {
            task.progress = Some(progress.min(100));
        }
        if let Some(status) = options.status {
            task.status = status;
        }
        if let Some(error) = options.error {
            task.error = Some(error);
        }
        if let Some(metadata) = options.metadata {
            task.metadata.extend(metadata);
        }

        task.clone()
    };

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "task_updated".to_string(),
        task_id: Some(task_id),
        task: Some(task),
        history_entry: None,
    };
    let _ = app.emit("activity:update", &event);

    Ok(())
}

/// Complete a task (success or failure)
#[tauri::command]
pub async fn activity_complete_task(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
    task_id: String,
    error: Option<String>,
) -> Result<(), String> {
    let history_entry = {
        let mut tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
        let task = tasks.remove(&task_id).ok_or("Task not found")?;
        let now = ActivityState::now_ms();

        TaskHistoryEntry {
            id: task.id,
            title: task.title,
            source: task.source,
            status: if error.is_some() {
                TaskStatus::Failed
            } else {
                TaskStatus::Completed
            },
            started_at: task.started_at,
            completed_at: now,
            duration_ms: now.saturating_sub(task.started_at),
            error,
        }
    };

    // Add to history
    {
        let mut history = state.history.lock().map_err(|_| "Failed to acquire lock")?;
        history.insert(0, history_entry.clone());
        if history.len() > state.max_history_size {
            history.truncate(state.max_history_size);
        }
    }

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "task_completed".to_string(),
        task_id: Some(task_id),
        task: None,
        history_entry: Some(history_entry),
    };
    let _ = app.emit("activity:update", &event);

    Ok(())
}

/// Cancel a task
#[tauri::command]
pub async fn activity_cancel_task(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
    task_id: String,
) -> Result<(), String> {
    let history_entry = {
        let mut tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
        let task = tasks.get(&task_id).ok_or("Task not found")?;

        if !task.cancellable {
            return Err("Task is not cancellable".to_string());
        }

        let task = tasks
            .remove(&task_id)
            .ok_or_else(|| "Task was removed concurrently".to_string())?;
        let now = ActivityState::now_ms();

        TaskHistoryEntry {
            id: task.id,
            title: task.title,
            source: task.source,
            status: TaskStatus::Cancelled,
            started_at: task.started_at,
            completed_at: now,
            duration_ms: now.saturating_sub(task.started_at),
            error: None,
        }
    };

    // Add to history
    {
        let mut history = state.history.lock().map_err(|_| "Failed to acquire lock")?;
        history.insert(0, history_entry.clone());
        if history.len() > state.max_history_size {
            history.truncate(state.max_history_size);
        }
    }

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "task_cancelled".to_string(),
        task_id: Some(task_id),
        task: None,
        history_entry: Some(history_entry),
    };
    let _ = app.emit("activity:update", &event);

    Ok(())
}

/// Get all active tasks
#[tauri::command]
pub async fn activity_get_tasks(
    state: State<'_, Arc<ActivityState>>,
) -> Result<Vec<ActivityTask>, String> {
    let tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
    Ok(tasks.values().cloned().collect())
}

/// Get task history
#[tauri::command]
pub async fn activity_get_history(
    state: State<'_, Arc<ActivityState>>,
    limit: Option<usize>,
) -> Result<Vec<TaskHistoryEntry>, String> {
    let history = state.history.lock().map_err(|_| "Failed to acquire lock")?;
    let limit = limit.unwrap_or(50).min(state.max_history_size);
    Ok(history.iter().take(limit).cloned().collect())
}

/// Clear task history
#[tauri::command]
pub async fn activity_clear_history(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
) -> Result<(), String> {
    {
        let mut history = state.history.lock().map_err(|_| "Failed to acquire lock")?;
        history.clear();
    }

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "history_cleared".to_string(),
        task_id: None,
        task: None,
        history_entry: None,
    };
    let _ = app.emit("activity:update", &event);

    Ok(())
}

/// Get a specific task by ID
#[tauri::command]
pub async fn activity_get_task(
    state: State<'_, Arc<ActivityState>>,
    task_id: String,
) -> Result<Option<ActivityTask>, String> {
    let tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
    Ok(tasks.get(&task_id).cloned())
}

/// Set task progress
#[tauri::command]
pub async fn activity_set_progress(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
    task_id: String,
    progress: u8,
) -> Result<(), String> {
    let task = {
        let mut tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
        let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
        task.progress = Some(progress.min(100));
        task.clone()
    };

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "task_progress".to_string(),
        task_id: Some(task_id),
        task: Some(task),
        history_entry: None,
    };
    let _ = app.emit("activity:update", &event);

    Ok(())
}

/// Set task message
#[tauri::command]
pub async fn activity_set_message(
    app: AppHandle,
    state: State<'_, Arc<ActivityState>>,
    task_id: String,
    message: String,
) -> Result<(), String> {
    let task = {
        let mut tasks = state.tasks.lock().map_err(|_| "Failed to acquire lock")?;
        let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
        task.message = Some(message);
        task.clone()
    };

    // Emit event to frontend
    let event = ActivityEvent {
        event_type: "task_message".to_string(),
        task_id: Some(task_id),
        task: Some(task),
        history_entry: None,
    };
    let _ = app.emit("activity:update", &event);

    Ok(())
}

// ============================================================================
// Module Registration
// ============================================================================

/// Get all activity-related Tauri commands
#[macro_export]
macro_rules! activity_commands {
    () => {
        activity::activity_create_task,
        activity::activity_update_task,
        activity::activity_complete_task,
        activity::activity_cancel_task,
        activity::activity_get_tasks,
        activity::activity_get_history,
        activity::activity_clear_history,
        activity::activity_get_task,
        activity::activity_set_progress,
        activity::activity_set_message,
    };
}
