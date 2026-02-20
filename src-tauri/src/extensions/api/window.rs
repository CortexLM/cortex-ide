//! Window / UI API for extension plugins.
//!
//! Provides Tauri IPC commands that let extensions interact with the UI:
//! messages, quick pick menus, input boxes, output channels, status bar
//! items, and progress indicators.

use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// An item displayed in a quick-pick menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPickItem {
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default)]
    pub picked: bool,
}

/// Options for displaying a quick-pick menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPickOptions {
    pub request_id: String,
    pub extension_id: String,
    pub items: Vec<QuickPickItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default)]
    pub can_pick_many: bool,
}

/// Options for displaying an input box.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputBoxOptions {
    pub request_id: String,
    pub extension_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(default)]
    pub password: bool,
}

/// Metadata for a plugin-created output channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputChannelInfo {
    pub channel_id: String,
    pub extension_id: String,
    pub name: String,
}

/// Payload emitted when a plugin updates the status bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusBarUpdate {
    pub extension_id: String,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tooltip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

/// Options for displaying a progress indicator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressOptions {
    pub progress_id: String,
    pub extension_id: String,
    pub title: String,
    #[serde(default)]
    pub cancellable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub percentage: Option<u32>,
}

/// Payload for a window message with optional action buttons.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePayload {
    pub message_id: String,
    pub extension_id: String,
    pub level: String,
    pub message: String,
    #[serde(default)]
    pub actions: Vec<String>,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for pending window API interactions (quick pick, input box).
#[derive(Clone)]
pub struct WindowApiState {
    pub pending_quick_picks: Arc<DashMap<String, tokio::sync::oneshot::Sender<Option<Vec<usize>>>>>,
    pub pending_input_boxes: Arc<DashMap<String, tokio::sync::oneshot::Sender<Option<String>>>>,
    pub output_channels: Arc<DashMap<String, OutputChannelInfo>>,
    pub tree_views: Arc<DashMap<String, TreeViewInfo>>,
    pub webview_panels: Arc<DashMap<String, WebviewPanelInfo>>,
    pub decoration_types: Arc<DashMap<String, DecorationTypeInfo>>,
}

impl Default for WindowApiState {
    fn default() -> Self {
        Self::new()
    }
}

impl WindowApiState {
    pub fn new() -> Self {
        Self {
            pending_quick_picks: Arc::new(DashMap::new()),
            pending_input_boxes: Arc::new(DashMap::new()),
            output_channels: Arc::new(DashMap::new()),
            tree_views: Arc::new(DashMap::new()),
            webview_panels: Arc::new(DashMap::new()),
            decoration_types: Arc::new(DashMap::new()),
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Show a message notification to the user with optional action buttons.
///
/// Emits a `plugin:show-message` event to the frontend and returns the
/// generated message identifier.
#[tauri::command]
pub async fn plugin_show_message(
    app: AppHandle,
    extension_id: String,
    level: String,
    message: String,
    actions: Option<Vec<String>>,
) -> Result<String, String> {
    let valid_levels = ["info", "warning", "error"];
    if !valid_levels.contains(&level.as_str()) {
        return Err(format!(
            "Invalid message level '{}': expected info, warning, or error",
            level
        ));
    }

    let message_id = Uuid::new_v4().to_string();

    let payload = MessagePayload {
        message_id: message_id.clone(),
        extension_id: extension_id.clone(),
        level: level.clone(),
        message: message.clone(),
        actions: actions.unwrap_or_default(),
    };

    app.emit("plugin:show-message", &payload)
        .map_err(|e| format!("Failed to emit show-message event: {}", e))?;

    info!(
        extension_id = %extension_id,
        level = %level,
        message_id = %message_id,
        "Plugin message shown"
    );

    Ok(message_id)
}

/// Show a quick-pick menu and wait for the user's selection.
///
/// Emits `plugin:show-quick-pick` and blocks until the frontend responds via
/// `plugin_respond_quick_pick`.  Returns the indices of selected items, or
/// `None` if the user cancelled.
#[tauri::command]
pub async fn plugin_show_quick_pick(
    app: AppHandle,
    extension_id: String,
    items: Vec<QuickPickItem>,
    placeholder: Option<String>,
    can_pick_many: Option<bool>,
) -> Result<Option<Vec<usize>>, String> {
    let state = app.state::<WindowApiState>();
    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel();

    state.pending_quick_picks.insert(request_id.clone(), tx);

    let options = QuickPickOptions {
        request_id: request_id.clone(),
        extension_id: extension_id.clone(),
        items,
        placeholder,
        can_pick_many: can_pick_many.unwrap_or(false),
    };

    app.emit("plugin:show-quick-pick", &options)
        .map_err(|e| format!("Failed to emit quick-pick event: {}", e))?;

    info!(
        extension_id = %extension_id,
        request_id = %request_id,
        "Quick pick shown"
    );

    match rx.await {
        Ok(selection) => Ok(selection),
        Err(_) => {
            warn!(request_id = %request_id, "Quick pick channel closed without response");
            Ok(None)
        }
    }
}

/// Deliver the user's response to a pending quick-pick request.
#[tauri::command]
pub async fn plugin_respond_quick_pick(
    app: AppHandle,
    request_id: String,
    selected_indices: Option<Vec<usize>>,
) -> Result<(), String> {
    let state = app.state::<WindowApiState>();
    let (_, tx) = state
        .pending_quick_picks
        .remove(&request_id)
        .ok_or_else(|| format!("No pending quick pick with id '{}'", request_id))?;

    tx.send(selected_indices)
        .map_err(|_| "Failed to deliver quick pick response: receiver dropped".to_string())
}

/// Show an input box and wait for the user's input.
///
/// Emits `plugin:show-input-box` and blocks until the frontend responds via
/// `plugin_respond_input_box`.  Returns the entered text, or `None` if the
/// user cancelled.
#[tauri::command]
pub async fn plugin_show_input_box(
    app: AppHandle,
    extension_id: String,
    prompt: Option<String>,
    placeholder: Option<String>,
    value: Option<String>,
    password: Option<bool>,
) -> Result<Option<String>, String> {
    let state = app.state::<WindowApiState>();
    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel();

    state.pending_input_boxes.insert(request_id.clone(), tx);

    let options = InputBoxOptions {
        request_id: request_id.clone(),
        extension_id: extension_id.clone(),
        prompt,
        placeholder,
        value,
        password: password.unwrap_or(false),
    };

    app.emit("plugin:show-input-box", &options)
        .map_err(|e| format!("Failed to emit input-box event: {}", e))?;

    info!(
        extension_id = %extension_id,
        request_id = %request_id,
        "Input box shown"
    );

    match rx.await {
        Ok(input) => Ok(input),
        Err(_) => {
            warn!(request_id = %request_id, "Input box channel closed without response");
            Ok(None)
        }
    }
}

/// Deliver the user's response to a pending input-box request.
#[tauri::command]
pub async fn plugin_respond_input_box(
    app: AppHandle,
    request_id: String,
    value: Option<String>,
) -> Result<(), String> {
    let state = app.state::<WindowApiState>();
    let (_, tx) = state
        .pending_input_boxes
        .remove(&request_id)
        .ok_or_else(|| format!("No pending input box with id '{}'", request_id))?;

    tx.send(value)
        .map_err(|_| "Failed to deliver input box response: receiver dropped".to_string())
}

/// Create a named output channel for an extension.
///
/// Returns the generated `channel_id` that the extension can use to append
/// output lines via the frontend.
#[tauri::command]
pub async fn plugin_create_output_channel(
    app: AppHandle,
    extension_id: String,
    name: String,
) -> Result<String, String> {
    let state = app.state::<WindowApiState>();
    let channel_id = Uuid::new_v4().to_string();

    let channel = OutputChannelInfo {
        channel_id: channel_id.clone(),
        extension_id: extension_id.clone(),
        name: name.clone(),
    };

    state
        .output_channels
        .insert(channel_id.clone(), channel.clone());

    app.emit("plugin:output-channel-created", &channel)
        .map_err(|e| format!("Failed to emit output-channel-created event: {}", e))?;

    info!(
        extension_id = %extension_id,
        channel_id = %channel_id,
        name = %name,
        "Output channel created"
    );

    Ok(channel_id)
}

/// Update the status bar text contributed by an extension.
///
/// Emits `plugin:statusbar-update` so the frontend can render the change.
#[tauri::command]
pub async fn plugin_set_status_bar_message(
    app: AppHandle,
    extension_id: String,
    text: String,
    tooltip: Option<String>,
    command: Option<String>,
) -> Result<(), String> {
    let update = StatusBarUpdate {
        extension_id: extension_id.clone(),
        text,
        tooltip,
        command,
    };

    app.emit("plugin:statusbar-update", &update)
        .map_err(|e| format!("Failed to emit statusbar-update event: {}", e))?;

    info!(extension_id = %extension_id, "Status bar updated");

    Ok(())
}

/// Show a progress indicator for a long-running operation.
///
/// Emits `plugin:show-progress` so the frontend can render the indicator.
#[tauri::command]
pub async fn plugin_show_progress(
    app: AppHandle,
    extension_id: String,
    title: String,
    cancellable: Option<bool>,
    message: Option<String>,
    percentage: Option<u32>,
) -> Result<String, String> {
    let progress_id = Uuid::new_v4().to_string();

    let clamped_pct = percentage.map(|p| p.min(100));

    let options = ProgressOptions {
        progress_id: progress_id.clone(),
        extension_id: extension_id.clone(),
        title,
        cancellable: cancellable.unwrap_or(false),
        message,
        percentage: clamped_pct,
    };

    app.emit("plugin:show-progress", &options)
        .map_err(|e| format!("Failed to emit show-progress event: {}", e))?;

    info!(
        extension_id = %extension_id,
        progress_id = %progress_id,
        "Progress indicator shown"
    );

    Ok(progress_id)
}

/// Payload emitted when a plugin requests a new terminal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCreationRequest {
    pub terminal_id: String,
    pub extension_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shell_path: Option<String>,
}

/// Metadata for a tree view created by a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeViewInfo {
    pub view_id: String,
    pub extension_id: String,
    pub tree_id: String,
    pub title: String,
}

/// Metadata for a webview panel created by a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebviewPanelInfo {
    pub panel_id: String,
    pub extension_id: String,
    pub view_type: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column: Option<u32>,
}

/// Metadata for a text editor decoration type created by a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecorationTypeInfo {
    pub decoration_type_id: String,
    pub extension_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub border: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outline: Option<String>,
    #[serde(default)]
    pub is_whole_line: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overview_ruler_color: Option<String>,
}

/// Payload for setting decorations on an editor.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetDecorationsPayload {
    pub extension_id: String,
    pub decoration_type_id: String,
    pub editor_uri: String,
    pub ranges: Vec<DecorationRange>,
}

/// A range for a decoration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecorationRange {
    pub start_line: u32,
    pub start_character: u32,
    pub end_line: u32,
    pub end_character: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hover_message: Option<String>,
}

/// Payload for sending text to a terminal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSendTextPayload {
    pub terminal_id: String,
    pub extension_id: String,
    pub text: String,
    #[serde(default = "default_true")]
    pub add_newline: bool,
}

fn default_true() -> bool {
    true
}

/// Payload for disposing a terminal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalDisposePayload {
    pub terminal_id: String,
    pub extension_id: String,
}

/// Request the frontend to create a new terminal instance for a plugin.
///
/// Emits `plugin:create-terminal` so the terminal manager can spawn a new PTY.
#[tauri::command]
pub async fn plugin_create_terminal(
    app: AppHandle,
    extension_id: String,
    name: String,
    cwd: Option<String>,
    shell_path: Option<String>,
) -> Result<String, String> {
    let terminal_id = Uuid::new_v4().to_string();

    let request = TerminalCreationRequest {
        terminal_id: terminal_id.clone(),
        extension_id: extension_id.clone(),
        name,
        cwd,
        shell_path,
    };

    app.emit("plugin:create-terminal", &request)
        .map_err(|e| format!("Failed to emit create-terminal event: {}", e))?;

    info!(
        extension_id = %extension_id,
        terminal_id = %terminal_id,
        "Plugin terminal creation requested"
    );

    Ok(terminal_id)
}

/// Create a tree view for an extension.
///
/// Emits `plugin:tree-view-created` so the frontend can render the tree.
#[tauri::command]
pub async fn plugin_create_tree_view(
    app: AppHandle,
    extension_id: String,
    tree_id: String,
    title: String,
) -> Result<String, String> {
    let state = app.state::<WindowApiState>();
    let view_id = Uuid::new_v4().to_string();

    let view = TreeViewInfo {
        view_id: view_id.clone(),
        extension_id: extension_id.clone(),
        tree_id,
        title: title.clone(),
    };

    state.tree_views.insert(view_id.clone(), view.clone());

    app.emit("plugin:tree-view-created", &view)
        .map_err(|e| format!("Failed to emit tree-view-created event: {}", e))?;

    info!(
        extension_id = %extension_id,
        view_id = %view_id,
        title = %title,
        "Tree view created"
    );

    Ok(view_id)
}

/// Create a webview panel for an extension.
///
/// Emits `plugin:webview-panel-created` so the frontend can render the panel.
#[tauri::command]
pub async fn plugin_create_webview_panel(
    app: AppHandle,
    extension_id: String,
    view_type: String,
    title: String,
    column: Option<u32>,
) -> Result<String, String> {
    let state = app.state::<WindowApiState>();
    let panel_id = Uuid::new_v4().to_string();

    let panel = WebviewPanelInfo {
        panel_id: panel_id.clone(),
        extension_id: extension_id.clone(),
        view_type,
        title: title.clone(),
        column,
    };

    state.webview_panels.insert(panel_id.clone(), panel.clone());

    app.emit("plugin:webview-panel-created", &panel)
        .map_err(|e| format!("Failed to emit webview-panel-created event: {}", e))?;

    info!(
        extension_id = %extension_id,
        panel_id = %panel_id,
        title = %title,
        "Webview panel created"
    );

    Ok(panel_id)
}

/// Create a text editor decoration type.
///
/// Emits `plugin:decoration-type-created` so the frontend can register the style.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn plugin_create_text_editor_decoration_type(
    app: AppHandle,
    extension_id: String,
    background_color: Option<String>,
    border: Option<String>,
    color: Option<String>,
    outline: Option<String>,
    is_whole_line: Option<bool>,
    overview_ruler_color: Option<String>,
) -> Result<String, String> {
    let state = app.state::<WindowApiState>();
    let decoration_type_id = Uuid::new_v4().to_string();

    let decoration = DecorationTypeInfo {
        decoration_type_id: decoration_type_id.clone(),
        extension_id: extension_id.clone(),
        background_color,
        border,
        color,
        outline,
        is_whole_line: is_whole_line.unwrap_or(false),
        overview_ruler_color,
    };

    state
        .decoration_types
        .insert(decoration_type_id.clone(), decoration.clone());

    app.emit("plugin:decoration-type-created", &decoration)
        .map_err(|e| format!("Failed to emit decoration-type-created event: {}", e))?;

    info!(
        extension_id = %extension_id,
        decoration_type_id = %decoration_type_id,
        "Text editor decoration type created"
    );

    Ok(decoration_type_id)
}

/// Set decorations on a text editor.
///
/// Emits `plugin:set-decorations` so the frontend can apply the visual decorations.
#[tauri::command]
pub async fn plugin_set_decorations(
    app: AppHandle,
    extension_id: String,
    decoration_type_id: String,
    editor_uri: String,
    ranges: Vec<DecorationRange>,
) -> Result<(), String> {
    let payload = SetDecorationsPayload {
        extension_id: extension_id.clone(),
        decoration_type_id,
        editor_uri,
        ranges,
    };

    app.emit("plugin:set-decorations", &payload)
        .map_err(|e| format!("Failed to emit set-decorations event: {}", e))?;

    info!(extension_id = %extension_id, "Decorations set");

    Ok(())
}

/// Send text to a terminal created by a plugin.
///
/// Emits `plugin:terminal-send-text` so the terminal manager can forward the text.
#[tauri::command]
pub async fn plugin_terminal_send_text(
    app: AppHandle,
    extension_id: String,
    terminal_id: String,
    text: String,
    add_newline: Option<bool>,
) -> Result<(), String> {
    let payload = TerminalSendTextPayload {
        terminal_id: terminal_id.clone(),
        extension_id: extension_id.clone(),
        text,
        add_newline: add_newline.unwrap_or(true),
    };

    app.emit("plugin:terminal-send-text", &payload)
        .map_err(|e| format!("Failed to emit terminal-send-text event: {}", e))?;

    info!(
        extension_id = %extension_id,
        terminal_id = %terminal_id,
        "Terminal text sent"
    );

    Ok(())
}

/// Dispose of a terminal created by a plugin.
///
/// Emits `plugin:terminal-dispose` so the terminal manager can clean up.
#[tauri::command]
pub async fn plugin_terminal_dispose(
    app: AppHandle,
    extension_id: String,
    terminal_id: String,
) -> Result<(), String> {
    let payload = TerminalDisposePayload {
        terminal_id: terminal_id.clone(),
        extension_id: extension_id.clone(),
    };

    app.emit("plugin:terminal-dispose", &payload)
        .map_err(|e| format!("Failed to emit terminal-dispose event: {}", e))?;

    info!(
        extension_id = %extension_id,
        terminal_id = %terminal_id,
        "Terminal disposed"
    );

    Ok(())
}
