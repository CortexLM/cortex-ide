//! Output Channels Backend
//!
//! Provides VS Code-like output channels for logging from extensions,
//! LSP servers, build tools, and other subsystems. Supports multiple
//! named channels with ring-buffer behavior and real-time event emission.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

// ============================================================================
// Types
// ============================================================================

/// Log level for output lines
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OutputLevel {
    Info,
    Warning,
    Error,
    Debug,
    Trace,
}

impl Default for OutputLevel {
    fn default() -> Self {
        OutputLevel::Info
    }
}

/// A single line of output in a channel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputLine {
    pub timestamp: u64,
    pub text: String,
    pub level: OutputLevel,
}

/// An output channel that collects log lines
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputChannel {
    pub id: String,
    pub name: String,
    pub language_id: Option<String>,
    pub lines: Vec<OutputLine>,
    pub visible: bool,
    pub created_at: u64,
    pub max_lines: usize,
}

/// Summary of an output channel (without lines, for listing)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputChannelSummary {
    pub id: String,
    pub name: String,
    pub language_id: Option<String>,
    pub line_count: usize,
    pub visible: bool,
    pub created_at: u64,
}

/// Event payload for output channel events
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputChannelEvent {
    pub channel_id: String,
    pub channel_name: String,
}

/// Event payload for content-related events
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputContentEvent {
    pub channel_id: String,
    pub text: String,
}

// ============================================================================
// State
// ============================================================================

const DEFAULT_MAX_LINES: usize = 10_000;

/// Shared state for output channel management
pub struct OutputChannelState {
    channels: Mutex<HashMap<String, OutputChannel>>,
    channel_counter: Mutex<u64>,
}

impl OutputChannelState {
    pub fn new() -> Self {
        Self {
            channels: Mutex::new(HashMap::new()),
            channel_counter: Mutex::new(0),
        }
    }

    fn generate_id(&self) -> Result<String, String> {
        let mut counter = self
            .channel_counter
            .lock()
            .map_err(|_| "Channel counter mutex poisoned".to_string())?;
        *counter += 1;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        Ok(format!("output_{}_{}", timestamp, *counter))
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}

impl Default for OutputChannelState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Enforce ring-buffer max_lines by draining oldest lines from the front.
fn enforce_max_lines(channel: &mut OutputChannel) {
    if channel.lines.len() > channel.max_lines {
        let excess = channel.lines.len() - channel.max_lines;
        channel.lines.drain(..excess);
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Create a new output channel
#[tauri::command]
pub async fn output_channel_create(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    name: String,
    language_id: Option<String>,
    max_lines: Option<usize>,
) -> Result<String, String> {
    let id = state.generate_id()?;
    let now = OutputChannelState::now_ms();

    let channel = OutputChannel {
        id: id.clone(),
        name: name.clone(),
        language_id,
        lines: Vec::new(),
        visible: false,
        created_at: now,
        max_lines: max_lines.unwrap_or(DEFAULT_MAX_LINES),
    };

    {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        channels.insert(id.clone(), channel);
    }

    let event = OutputChannelEvent {
        channel_id: id.clone(),
        channel_name: name,
    };
    let _ = app.emit("output:created", &event);

    Ok(id)
}

/// Delete an output channel
#[tauri::command]
pub async fn output_channel_delete(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
) -> Result<(), String> {
    let channel_name = {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .remove(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;
        channel.name
    };

    let event = OutputChannelEvent {
        channel_id,
        channel_name,
    };
    let _ = app.emit("output:deleted", &event);

    Ok(())
}

/// Append text to a channel
#[tauri::command]
pub async fn output_channel_append(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
    text: String,
    level: Option<OutputLevel>,
) -> Result<(), String> {
    let now = OutputChannelState::now_ms();
    let level = level.unwrap_or_default();

    {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .get_mut(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

        let line = OutputLine {
            timestamp: now,
            text: text.clone(),
            level,
        };
        channel.lines.push(line);
        enforce_max_lines(channel);
    }

    let event = OutputContentEvent { channel_id, text };
    let _ = app.emit("output:append", &event);

    Ok(())
}

/// Append a line with newline to a channel
#[tauri::command]
pub async fn output_channel_append_line(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
    text: String,
    level: Option<OutputLevel>,
) -> Result<(), String> {
    let now = OutputChannelState::now_ms();
    let level = level.unwrap_or_default();
    let line_text = format!("{}\n", text);

    {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .get_mut(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

        let line = OutputLine {
            timestamp: now,
            text: line_text.clone(),
            level,
        };
        channel.lines.push(line);
        enforce_max_lines(channel);
    }

    let event = OutputContentEvent {
        channel_id,
        text: line_text,
    };
    let _ = app.emit("output:append", &event);

    Ok(())
}

/// Clear a channel's content
#[tauri::command]
pub async fn output_channel_clear(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
) -> Result<(), String> {
    let channel_name = {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .get_mut(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;
        channel.lines.clear();
        channel.name.clone()
    };

    let event = OutputChannelEvent {
        channel_id,
        channel_name,
    };
    let _ = app.emit("output:clear", &event);

    Ok(())
}

/// Show/reveal a channel
#[tauri::command]
pub async fn output_channel_show(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
) -> Result<(), String> {
    let channel_name = {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .get_mut(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;
        channel.visible = true;
        channel.name.clone()
    };

    let event = OutputChannelEvent {
        channel_id,
        channel_name,
    };
    let _ = app.emit("output:show", &event);

    Ok(())
}

/// Hide a channel
#[tauri::command]
pub async fn output_channel_hide(
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
) -> Result<(), String> {
    let mut channels = state
        .channels
        .lock()
        .map_err(|_| "Failed to acquire lock".to_string())?;
    let channel = channels
        .get_mut(&channel_id)
        .ok_or_else(|| format!("Channel not found: {}", channel_id))?;
    channel.visible = false;

    Ok(())
}

/// List all channels (summaries without line content)
#[tauri::command]
pub async fn output_channel_list(
    state: State<'_, Arc<OutputChannelState>>,
) -> Result<Vec<OutputChannelSummary>, String> {
    let channels = state
        .channels
        .lock()
        .map_err(|_| "Failed to acquire lock".to_string())?;

    let summaries = channels
        .values()
        .map(|ch| OutputChannelSummary {
            id: ch.id.clone(),
            name: ch.name.clone(),
            language_id: ch.language_id.clone(),
            line_count: ch.lines.len(),
            visible: ch.visible,
            created_at: ch.created_at,
        })
        .collect();

    Ok(summaries)
}

/// Get full content of a channel
#[tauri::command]
pub async fn output_channel_get_content(
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
) -> Result<Vec<OutputLine>, String> {
    let channels = state
        .channels
        .lock()
        .map_err(|_| "Failed to acquire lock".to_string())?;
    let channel = channels
        .get(&channel_id)
        .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

    Ok(channel.lines.clone())
}

/// Replace all content in a channel
#[tauri::command]
pub async fn output_channel_replace(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
    text: String,
    level: Option<OutputLevel>,
) -> Result<(), String> {
    let now = OutputChannelState::now_ms();
    let level = level.unwrap_or_default();

    let channel_name = {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .get_mut(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;

        channel.lines.clear();
        let line = OutputLine {
            timestamp: now,
            text: text.clone(),
            level,
        };
        channel.lines.push(line);
        enforce_max_lines(channel);
        channel.name.clone()
    };

    let clear_event = OutputChannelEvent {
        channel_id: channel_id.clone(),
        channel_name,
    };
    let _ = app.emit("output:clear", &clear_event);

    let append_event = OutputContentEvent { channel_id, text };
    let _ = app.emit("output:append", &append_event);

    Ok(())
}

/// Set the language ID for syntax highlighting
#[tauri::command]
pub async fn output_channel_set_language(
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
    language_id: String,
) -> Result<(), String> {
    let mut channels = state
        .channels
        .lock()
        .map_err(|_| "Failed to acquire lock".to_string())?;
    let channel = channels
        .get_mut(&channel_id)
        .ok_or_else(|| format!("Channel not found: {}", channel_id))?;
    channel.language_id = Some(language_id);

    Ok(())
}

/// Dispose/cleanup a channel (removes it entirely)
#[tauri::command]
pub async fn output_channel_dispose(
    app: AppHandle,
    state: State<'_, Arc<OutputChannelState>>,
    channel_id: String,
) -> Result<(), String> {
    let channel_name = {
        let mut channels = state
            .channels
            .lock()
            .map_err(|_| "Failed to acquire lock".to_string())?;
        let channel = channels
            .remove(&channel_id)
            .ok_or_else(|| format!("Channel not found: {}", channel_id))?;
        channel.name
    };

    let event = OutputChannelEvent {
        channel_id,
        channel_name,
    };
    let _ = app.emit("output:deleted", &event);

    Ok(())
}
