//! Host functions exposed to WASM extensions.
//!
//! These functions are callable from within the WASM sandbox and provide
//! controlled access to Cortex Desktop capabilities.

use std::collections::HashMap;
use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::extensions::permissions::PermissionsManager;

// ============================================================================
// Provider ID Generation
// ============================================================================

static NEXT_PROVIDER_ID: AtomicU64 = AtomicU64::new(1);

fn next_provider_id() -> u64 {
    NEXT_PROVIDER_ID.fetch_add(1, Ordering::Relaxed)
}

// ============================================================================
// Command Registry
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegisteredCommand {
    extension_id: String,
    command_id: String,
    title: String,
}

static COMMAND_REGISTRY: Lazy<Mutex<Vec<RegisteredCommand>>> = Lazy::new(|| Mutex::new(Vec::new()));

// ============================================================================
// Additional Registries
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OutputChannelEntry {
    id: String,
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TreeViewEntry {
    id: String,
    view_id: String,
    title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WebviewPanelEntry {
    id: String,
    view_type: String,
    title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LanguageProviderEntry {
    id: String,
    provider_type: String,
    language_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TerminalEntry {
    id: String,
    name: String,
    cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DecorationTypeEntry {
    id: String,
    options: String,
}

static OUTPUT_CHANNELS: Lazy<Mutex<Vec<OutputChannelEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
static TREE_VIEWS: Lazy<Mutex<Vec<TreeViewEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
static WEBVIEW_PANELS: Lazy<Mutex<Vec<WebviewPanelEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
static LANGUAGE_PROVIDERS: Lazy<Mutex<Vec<LanguageProviderEntry>>> =
    Lazy::new(|| Mutex::new(Vec::new()));
static TERMINALS: Lazy<Mutex<Vec<TerminalEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
static DECORATION_TYPES: Lazy<Mutex<Vec<DecorationTypeEntry>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

// ============================================================================
// Supporting Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStat {
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub created: u64,
    pub modified: u64,
    pub accessed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRange {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorInfo {
    pub uri: String,
    pub language_id: String,
    pub version: u32,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decoration {
    pub range: TextRange,
    pub hover_message: String,
    pub css_class: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPickItem {
    pub label: String,
    pub description: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputBoxOptions {
    pub prompt: String,
    pub placeholder: String,
    pub value: String,
    pub password: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticSeverity(pub u32);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: TextRange,
    pub message: String,
    pub severity: u32,
    pub source: String,
    pub code: String,
}

#[derive(Debug, Clone, Default)]
pub struct RegisteredProviders {
    pub completion_providers: HashMap<String, Vec<String>>,
    pub hover_providers: Vec<String>,
    pub definition_providers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeViewRegistration {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusBarItem {
    pub id: String,
    pub text: String,
    pub alignment: u32,
    pub priority: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScmProviderRegistration {
    pub id: String,
    pub label: String,
}

// ============================================================================
// Host Context
// ============================================================================

pub struct HostContext {
    pub extension_id: String,
    pub workspace_root: Option<String>,
    pub permissions: Arc<PermissionsManager>,
    pub registered_providers: RegisteredProviders,
    pub tree_views: Vec<TreeViewRegistration>,
    pub status_bar_items: HashMap<String, StatusBarItem>,
    pub scm_providers: Vec<ScmProviderRegistration>,
    pub debug_adapters: Vec<String>,
}

// ============================================================================
// Logging
// ============================================================================

pub fn host_log(level: u32, message: &str) {
    match level {
        0 => debug!("[WasmExt] {}", message),
        1 => debug!("[WasmExt] {}", message),
        2 => info!("[WasmExt] {}", message),
        3 => warn!("[WasmExt] {}", message),
        4 => tracing::error!("[WasmExt] {}", message),
        _ => info!("[WasmExt] {}", message),
    }
}

// ============================================================================
// Configuration
// ============================================================================

pub fn host_get_config(_key: &str) -> Option<String> {
    None
}

// ============================================================================
// Message Display
// ============================================================================

pub fn host_show_message(level: u32, message: &str) {
    match level {
        0 => info!("[WasmExt:Info] {}", message),
        1 => warn!("[WasmExt:Warn] {}", message),
        2 => tracing::error!("[WasmExt:Error] {}", message),
        _ => info!("[WasmExt:Msg] {}", message),
    }
}

pub fn host_show_info_message(message: &str) -> String {
    let id = Uuid::new_v4().to_string();
    info!("[WasmExt:Info] {}", message);
    id
}

pub fn host_show_warning_message(message: &str) -> String {
    let id = Uuid::new_v4().to_string();
    warn!("[WasmExt:Warn] {}", message);
    id
}

pub fn host_show_error_message(message: &str) -> String {
    let id = Uuid::new_v4().to_string();
    tracing::error!("[WasmExt:Error] {}", message);
    id
}

// ============================================================================
// Command Management
// ============================================================================

pub fn host_register_command(extension_id: &str, command_id: &str, title: &str) {
    let command = RegisteredCommand {
        extension_id: extension_id.to_string(),
        command_id: command_id.to_string(),
        title: title.to_string(),
    };

    let mut registry = COMMAND_REGISTRY.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(command);

    info!(
        "[WasmExt] Registered command '{}' from extension '{}'",
        command_id, extension_id
    );
}

pub fn host_execute_command(command_id: &str, args_json: &str) -> Result<String, String> {
    debug!(
        "[WasmExt] Executing command '{}' with args: {}",
        command_id, args_json
    );

    let registry = COMMAND_REGISTRY
        .lock()
        .map_err(|_| "Failed to acquire command registry lock".to_string())?;

    let found = registry.iter().any(|cmd| cmd.command_id == command_id);
    if !found {
        return Err(format!("Command '{}' not found in registry", command_id));
    }

    let result = serde_json::json!({
        "command": command_id,
        "status": "dispatched"
    });

    serde_json::to_string(&result).map_err(|e| format!("Failed to serialize command result: {}", e))
}

pub fn host_get_commands() -> String {
    let registry = COMMAND_REGISTRY.lock().unwrap_or_else(|e| e.into_inner());

    serde_json::to_string(&*registry).unwrap_or_else(|_| "[]".to_string())
}

// ============================================================================
// File Operations (workspace-scoped)
// ============================================================================

fn validate_workspace_path(
    workspace_root: &str,
    relative_path: &str,
) -> Result<std::path::PathBuf, String> {
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let target = root.join(relative_path);
    let canonical = target.canonicalize().unwrap_or_else(|_| target.clone());
    if !canonical.starts_with(&root) {
        return Err("Path escapes workspace root".to_string());
    }
    Ok(canonical)
}

pub fn host_read_file(workspace_root: &str, relative_path: &str) -> Result<String, String> {
    let path = validate_workspace_path(workspace_root, relative_path)?;
    debug!("[WasmExt] Reading file: {}", path.display());
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn host_write_file(
    workspace_root: &str,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let target = root.join(relative_path);

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    let canonical_parent = target
        .parent()
        .unwrap_or(root.as_path())
        .canonicalize()
        .map_err(|e| format!("Cannot resolve parent: {}", e))?;
    if !canonical_parent.starts_with(&root) {
        return Err("Path escapes workspace root".to_string());
    }

    debug!("[WasmExt] Writing file: {}", target.display());
    fs::write(&target, content).map_err(|e| format!("Failed to write file: {}", e))
}

pub fn host_list_files(workspace_root: &str, pattern: &str) -> Result<String, String> {
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let full_pattern = root.join(pattern).to_string_lossy().to_string();

    let entries = glob::glob(&full_pattern).map_err(|e| format!("Invalid glob pattern: {}", e))?;

    let mut results: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        if let Ok(canonical) = entry.canonicalize() {
            if canonical.starts_with(&root) {
                if let Ok(rel) = canonical.strip_prefix(&root) {
                    results.push(rel.to_string_lossy().to_string());
                }
            }
        }
    }

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize file list: {}", e))
}

// ============================================================================
// Event Emission
// ============================================================================

pub fn host_emit_event(event_name: &str, data_json: &str) {
    info!(
        "[WasmExt] Event emitted: {} with data: {}",
        event_name, data_json
    );
}

// ============================================================================
// Filesystem Host Functions (HostContext-based)
// ============================================================================

fn resolve_ctx_path(ctx: &HostContext, path: &str) -> Result<PathBuf, String> {
    let workspace_root = ctx
        .workspace_root
        .as_deref()
        .ok_or_else(|| "No workspace root configured".to_string())?;
    validate_workspace_path(workspace_root, path)
}

fn system_time_to_epoch(time: std::io::Result<SystemTime>) -> u64 {
    time.ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn host_read_file_bytes(ctx: &HostContext, path: &str) -> Result<Vec<u8>, String> {
    let resolved = resolve_ctx_path(ctx, path)?;
    ctx.permissions
        .check_file_access(&ctx.extension_id, &resolved, false)?;
    debug!(
        "[WasmExt:{}] Reading file bytes: {}",
        ctx.extension_id,
        resolved.display()
    );
    fs::read(&resolved).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn host_write_file_bytes(ctx: &HostContext, path: &str, data: &[u8]) -> Result<(), String> {
    let workspace_root = ctx
        .workspace_root
        .as_deref()
        .ok_or_else(|| "No workspace root configured".to_string())?;
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let target = root.join(path);

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    let canonical_parent = target
        .parent()
        .unwrap_or(root.as_path())
        .canonicalize()
        .map_err(|e| format!("Cannot resolve parent: {}", e))?;
    if !canonical_parent.starts_with(&root) {
        return Err("Path escapes workspace root".to_string());
    }

    ctx.permissions
        .check_file_access(&ctx.extension_id, &canonical_parent, true)?;
    debug!(
        "[WasmExt:{}] Writing file bytes: {}",
        ctx.extension_id,
        target.display()
    );
    fs::write(&target, data).map_err(|e| format!("Failed to write file: {}", e))
}

pub fn host_list_directory(ctx: &HostContext, path: &str) -> Result<Vec<DirEntry>, String> {
    let resolved = resolve_ctx_path(ctx, path)?;
    ctx.permissions
        .check_file_access(&ctx.extension_id, &resolved, false)?;
    debug!(
        "[WasmExt:{}] Listing directory: {}",
        ctx.extension_id,
        resolved.display()
    );

    let read_dir =
        fs::read_dir(&resolved).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut entries = Vec::new();
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read entry metadata: {}", e))?;
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            size: metadata.len(),
        });
    }
    Ok(entries)
}

pub fn host_watch_file(ctx: &HostContext, path: &str) -> Result<u64, String> {
    let resolved = resolve_ctx_path(ctx, path)?;
    ctx.permissions
        .check_file_access(&ctx.extension_id, &resolved, false)?;
    debug!(
        "[WasmExt:{}] Watch requested for: {} (stub)",
        ctx.extension_id,
        resolved.display()
    );
    Ok(0)
}

pub fn host_stat_file_ctx(ctx: &HostContext, path: &str) -> Result<FileStat, String> {
    let resolved = resolve_ctx_path(ctx, path)?;
    ctx.permissions
        .check_file_access(&ctx.extension_id, &resolved, false)?;
    debug!(
        "[WasmExt:{}] Stat file: {}",
        ctx.extension_id,
        resolved.display()
    );

    let metadata =
        fs::symlink_metadata(&resolved).map_err(|e| format!("Failed to stat file: {}", e))?;

    Ok(FileStat {
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        is_symlink: metadata.file_type().is_symlink(),
        created: system_time_to_epoch(metadata.created()),
        modified: system_time_to_epoch(metadata.modified()),
        accessed: system_time_to_epoch(metadata.accessed()),
    })
}

pub fn host_delete_file(ctx: &HostContext, path: &str) -> Result<(), String> {
    let resolved = resolve_ctx_path(ctx, path)?;
    ctx.permissions
        .check_file_access(&ctx.extension_id, &resolved, true)?;
    debug!(
        "[WasmExt:{}] Deleting file: {}",
        ctx.extension_id,
        resolved.display()
    );
    fs::remove_file(&resolved).map_err(|e| format!("Failed to delete file: {}", e))
}

// ============================================================================
// Workspace Operations (simple)
// ============================================================================

pub fn host_stat_file(workspace_root: &str, relative_path: &str) -> Result<String, String> {
    let path = validate_workspace_path(workspace_root, relative_path)?;
    debug!("[WasmExt] Stat file: {}", path.display());

    let metadata =
        fs::symlink_metadata(&path).map_err(|e| format!("Failed to stat file: {}", e))?;

    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let result = serde_json::json!({
        "size": metadata.len(),
        "modified_at": modified_at,
        "is_dir": metadata.is_dir(),
        "is_file": metadata.is_file(),
        "is_symlink": metadata.file_type().is_symlink(),
    });

    serde_json::to_string(&result).map_err(|e| format!("Failed to serialize stat result: {}", e))
}

// ============================================================================
// Document Operations
// ============================================================================

pub fn host_open_document(uri: &str) -> String {
    let document_id = Uuid::new_v4().to_string();
    info!(
        "[WasmExt] Open document requested: uri='{}', document_id='{}'",
        uri, document_id
    );
    document_id
}

pub fn host_save_document(uri: &str) -> Result<(), String> {
    info!("[WasmExt] Save document requested: uri='{}'", uri);
    Ok(())
}

pub fn host_get_document_text_by_uri(uri: &str) -> Result<String, String> {
    debug!("[WasmExt] Get document text: uri='{}'", uri);
    fs::read_to_string(uri).map_err(|e| format!("Failed to read document '{}': {}", uri, e))
}

pub fn host_document_line_at(uri: &str, line: u32) -> Result<String, String> {
    debug!("[WasmExt] Get document line: uri='{}', line={}", uri, line);
    let file =
        fs::File::open(uri).map_err(|e| format!("Failed to open document '{}': {}", uri, e))?;
    let reader = std::io::BufReader::new(file);
    reader
        .lines()
        .nth(line as usize)
        .ok_or_else(|| format!("Line {} out of range in '{}'", line, uri))?
        .map_err(|e| format!("Failed to read line {} from '{}': {}", line, uri, e))
}

pub fn host_document_position_at(uri: &str, offset: u32) -> Result<String, String> {
    debug!(
        "[WasmExt] Get document position: uri='{}', offset={}",
        uri, offset
    );
    let content =
        fs::read_to_string(uri).map_err(|e| format!("Failed to read document '{}': {}", uri, e))?;

    let offset = offset as usize;
    if offset > content.len() {
        return Err(format!(
            "Offset {} exceeds document length {} in '{}'",
            offset,
            content.len(),
            uri
        ));
    }

    let mut line: u32 = 0;
    let mut character: u32 = 0;
    for (i, ch) in content.char_indices() {
        if i >= offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            character = 0;
        } else {
            character += 1;
        }
    }

    let result = serde_json::json!({
        "line": line,
        "character": character,
    });

    serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize position result: {}", e))
}

pub fn host_apply_document_edits(uri: &str, edits_json: &str) -> Result<(), String> {
    info!(
        "[WasmExt] Apply document edits: uri='{}', edits={}",
        uri, edits_json
    );
    Ok(())
}

// ============================================================================
// Editor Host Functions (stubs)
// ============================================================================

pub fn host_get_active_editor(_ctx: &HostContext) -> Option<EditorInfo> {
    None
}

pub fn host_get_selection(_ctx: &HostContext) -> Option<TextRange> {
    None
}

pub fn host_insert_text(
    _ctx: &HostContext,
    _position: &Position,
    _text: &str,
) -> Result<(), String> {
    debug!("[WasmExt] insert_text called (stub)");
    Ok(())
}

pub fn host_replace_range(
    _ctx: &HostContext,
    _range: &TextRange,
    _text: &str,
) -> Result<(), String> {
    debug!("[WasmExt] replace_range called (stub)");
    Ok(())
}

pub fn host_set_decorations_ctx(
    _ctx: &HostContext,
    _decorations: &[Decoration],
) -> Result<(), String> {
    debug!("[WasmExt] set_decorations called (stub)");
    Ok(())
}

pub fn host_get_document_text(_ctx: &HostContext, _uri: &str) -> Result<String, String> {
    Err("not implemented".to_string())
}

// ============================================================================
// Workspace Host Functions
// ============================================================================

pub fn host_get_workspace_folders(ctx: &HostContext) -> Vec<String> {
    match &ctx.workspace_root {
        Some(root) => vec![root.clone()],
        None => Vec::new(),
    }
}

pub fn host_find_files(
    ctx: &HostContext,
    glob_pattern: &str,
    max_results: u32,
) -> Result<Vec<String>, String> {
    let workspace_root = ctx
        .workspace_root
        .as_deref()
        .ok_or_else(|| "No workspace root configured".to_string())?;
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let full_pattern = root.join(glob_pattern).to_string_lossy().to_string();

    let entries = glob::glob(&full_pattern).map_err(|e| format!("Invalid glob pattern: {}", e))?;

    let mut results: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        if results.len() >= max_results as usize {
            break;
        }
        if let Ok(canonical) = entry.canonicalize() {
            if canonical.starts_with(&root) {
                if let Ok(rel) = canonical.strip_prefix(&root) {
                    results.push(rel.to_string_lossy().to_string());
                }
            }
        }
    }
    Ok(results)
}

pub fn host_get_configuration(_ctx: &HostContext, _section: &str) -> Option<String> {
    None
}

pub fn host_set_configuration(
    _ctx: &HostContext,
    _section: &str,
    _value: &str,
) -> Result<(), String> {
    debug!("[WasmExt] set_configuration called (stub)");
    Ok(())
}

// ============================================================================
// UI Host Functions (HostContext-based)
// ============================================================================

pub fn host_register_tree_view(ctx: &mut HostContext, id: &str, title: &str) -> Result<(), String> {
    info!(
        "[WasmExt:{}] Registering tree view '{}' ({})",
        ctx.extension_id, id, title
    );
    ctx.tree_views.push(TreeViewRegistration {
        id: id.to_string(),
        title: title.to_string(),
    });
    Ok(())
}

pub fn host_register_status_bar_item(
    ctx: &mut HostContext,
    id: &str,
    text: &str,
    alignment: u32,
    priority: u32,
) -> Result<(), String> {
    info!(
        "[WasmExt:{}] Registering status bar item '{}'",
        ctx.extension_id, id
    );
    ctx.status_bar_items.insert(
        id.to_string(),
        StatusBarItem {
            id: id.to_string(),
            text: text.to_string(),
            alignment,
            priority,
        },
    );
    Ok(())
}

pub fn host_update_status_bar_item(
    ctx: &mut HostContext,
    id: &str,
    text: &str,
) -> Result<(), String> {
    match ctx.status_bar_items.get_mut(id) {
        Some(item) => {
            item.text = text.to_string();
            debug!(
                "[WasmExt:{}] Updated status bar item '{}'",
                ctx.extension_id, id
            );
            Ok(())
        }
        None => Err(format!("Status bar item '{}' not found", id)),
    }
}

pub fn host_show_quick_pick_ctx(
    _ctx: &HostContext,
    _items: &[QuickPickItem],
) -> Result<Option<String>, String> {
    debug!("[WasmExt] show_quick_pick called (stub)");
    Ok(None)
}

pub fn host_show_input_box_ctx(
    _ctx: &HostContext,
    _options: &InputBoxOptions,
) -> Result<Option<String>, String> {
    debug!("[WasmExt] show_input_box called (stub)");
    Ok(None)
}

// ============================================================================
// Window/UI Operations (simple)
// ============================================================================

pub fn host_show_quick_pick(items_json: &str) -> String {
    let request_id = Uuid::new_v4().to_string();
    info!(
        "[WasmExt] Show quick pick requested: request_id='{}', items={}",
        request_id, items_json
    );
    request_id
}

pub fn host_show_input_box(options_json: &str) -> String {
    let request_id = Uuid::new_v4().to_string();
    info!(
        "[WasmExt] Show input box requested: request_id='{}', options={}",
        request_id, options_json
    );
    request_id
}

pub fn host_create_output_channel(name: &str) -> String {
    let channel_id = Uuid::new_v4().to_string();
    let entry = OutputChannelEntry {
        id: channel_id.clone(),
        name: name.to_string(),
    };

    let mut registry = OUTPUT_CHANNELS.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(entry);

    info!(
        "[WasmExt] Created output channel: name='{}', channel_id='{}'",
        name, channel_id
    );
    channel_id
}

pub fn host_output_channel_append(channel_id: &str, text: &str) {
    debug!(
        "[WasmExt] Output channel append: channel_id='{}', text='{}'",
        channel_id, text
    );
}

pub fn host_create_tree_view(id: &str, title: &str) -> String {
    let view_id = Uuid::new_v4().to_string();
    let entry = TreeViewEntry {
        id: id.to_string(),
        view_id: view_id.clone(),
        title: title.to_string(),
    };

    let mut registry = TREE_VIEWS.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(entry);

    info!(
        "[WasmExt] Created tree view: id='{}', title='{}', view_id='{}'",
        id, title, view_id
    );
    view_id
}

pub fn host_create_webview_panel(view_type: &str, title: &str) -> String {
    let panel_id = Uuid::new_v4().to_string();
    let entry = WebviewPanelEntry {
        id: panel_id.clone(),
        view_type: view_type.to_string(),
        title: title.to_string(),
    };

    let mut registry = WEBVIEW_PANELS.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(entry);

    info!(
        "[WasmExt] Created webview panel: view_type='{}', title='{}', panel_id='{}'",
        view_type, title, panel_id
    );
    panel_id
}

// ============================================================================
// Language Host Functions (HostContext-based)
// ============================================================================

pub fn host_register_completion_provider_ctx(
    ctx: &mut HostContext,
    language_id: &str,
    trigger_chars: Vec<String>,
) -> Result<u64, String> {
    let provider_id = next_provider_id();
    info!(
        "[WasmExt:{}] Registering completion provider for '{}' (id={})",
        ctx.extension_id, language_id, provider_id
    );
    ctx.registered_providers
        .completion_providers
        .insert(language_id.to_string(), trigger_chars);
    Ok(provider_id)
}

pub fn host_register_hover_provider_ctx(
    ctx: &mut HostContext,
    language_id: &str,
) -> Result<u64, String> {
    let provider_id = next_provider_id();
    info!(
        "[WasmExt:{}] Registering hover provider for '{}' (id={})",
        ctx.extension_id, language_id, provider_id
    );
    ctx.registered_providers
        .hover_providers
        .push(language_id.to_string());
    Ok(provider_id)
}

pub fn host_register_definition_provider_ctx(
    ctx: &mut HostContext,
    language_id: &str,
) -> Result<u64, String> {
    let provider_id = next_provider_id();
    info!(
        "[WasmExt:{}] Registering definition provider for '{}' (id={})",
        ctx.extension_id, language_id, provider_id
    );
    ctx.registered_providers
        .definition_providers
        .push(language_id.to_string());
    Ok(provider_id)
}

pub fn host_register_diagnostics(
    _ctx: &HostContext,
    uri: &str,
    diagnostics: &[Diagnostic],
) -> Result<(), String> {
    debug!(
        "[WasmExt] Registering {} diagnostics for '{}'",
        diagnostics.len(),
        uri
    );
    Ok(())
}

// ============================================================================
// Language Feature Registration (simple)
// ============================================================================

fn register_language_provider(provider_type: &str, language_id: &str) -> String {
    let provider_id = Uuid::new_v4().to_string();
    let entry = LanguageProviderEntry {
        id: provider_id.clone(),
        provider_type: provider_type.to_string(),
        language_id: language_id.to_string(),
    };

    let mut registry = LANGUAGE_PROVIDERS.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(entry);

    info!(
        "[WasmExt] Registered {} provider for language '{}', provider_id='{}'",
        provider_type, language_id, provider_id
    );
    provider_id
}

pub fn host_register_completion_provider(language_id: &str, trigger_chars_json: &str) -> String {
    debug!(
        "[WasmExt] Completion provider trigger chars: {}",
        trigger_chars_json
    );
    register_language_provider("completion", language_id)
}

pub fn host_register_hover_provider(language_id: &str) -> String {
    register_language_provider("hover", language_id)
}

pub fn host_register_definition_provider(language_id: &str) -> String {
    register_language_provider("definition", language_id)
}

pub fn host_register_code_actions_provider(language_id: &str) -> String {
    register_language_provider("codeActions", language_id)
}

pub fn host_register_code_lens_provider(language_id: &str) -> String {
    register_language_provider("codeLens", language_id)
}

// ============================================================================
// SCM Host Functions
// ============================================================================

pub fn host_register_scm_provider(
    ctx: &mut HostContext,
    id: &str,
    label: &str,
) -> Result<(), String> {
    info!(
        "[WasmExt:{}] Registering SCM provider '{}' ({})",
        ctx.extension_id, id, label
    );
    ctx.scm_providers.push(ScmProviderRegistration {
        id: id.to_string(),
        label: label.to_string(),
    });
    Ok(())
}

// ============================================================================
// Debug Host Functions
// ============================================================================

pub fn host_register_debug_adapter(ctx: &mut HostContext, type_name: &str) -> Result<(), String> {
    info!(
        "[WasmExt:{}] Registering debug adapter type '{}'",
        ctx.extension_id, type_name
    );
    ctx.debug_adapters.push(type_name.to_string());
    Ok(())
}

// ============================================================================
// Terminal Operations
// ============================================================================

pub fn host_create_terminal(name: &str, cwd: &str) -> String {
    let terminal_id = Uuid::new_v4().to_string();
    let entry = TerminalEntry {
        id: terminal_id.clone(),
        name: name.to_string(),
        cwd: cwd.to_string(),
    };

    let mut registry = TERMINALS.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(entry);

    info!(
        "[WasmExt] Created terminal: name='{}', cwd='{}', terminal_id='{}'",
        name, cwd, terminal_id
    );
    terminal_id
}

pub fn host_terminal_send_text(terminal_id: &str, text: &str) -> Result<(), String> {
    debug!(
        "[WasmExt] Terminal send text: terminal_id='{}', text='{}'",
        terminal_id, text
    );
    Ok(())
}

pub fn host_terminal_dispose(terminal_id: &str) -> Result<(), String> {
    let mut registry = TERMINALS
        .lock()
        .map_err(|_| "Failed to acquire terminals registry lock".to_string())?;

    let initial_len = registry.len();
    registry.retain(|t| t.id != terminal_id);

    if registry.len() == initial_len {
        return Err(format!("Terminal '{}' not found in registry", terminal_id));
    }

    info!("[WasmExt] Disposed terminal: terminal_id='{}'", terminal_id);
    Ok(())
}

// ============================================================================
// Decoration/Theming
// ============================================================================

pub fn host_create_decoration_type(options_json: &str) -> String {
    let decoration_type_id = Uuid::new_v4().to_string();
    let entry = DecorationTypeEntry {
        id: decoration_type_id.clone(),
        options: options_json.to_string(),
    };

    let mut registry = DECORATION_TYPES.lock().unwrap_or_else(|e| e.into_inner());
    registry.push(entry);

    info!(
        "[WasmExt] Created decoration type: decoration_type_id='{}', options={}",
        decoration_type_id, options_json
    );
    decoration_type_id
}

pub fn host_set_decorations(editor_uri: &str, decoration_type_id: &str, ranges_json: &str) {
    debug!(
        "[WasmExt] Set decorations: editor_uri='{}', decoration_type_id='{}', ranges={}",
        editor_uri, decoration_type_id, ranges_json
    );
}

// ============================================================================
// Language Registration (legacy simple API)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegisteredLanguage {
    language_id: String,
    extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DiagnosticEntry {
    uri: String,
    diagnostics: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StatusBarEntry {
    text: String,
    timeout_ms: Option<u32>,
    created_at: u64,
}

static REGISTERED_LANGUAGES: Lazy<Mutex<Vec<RegisteredLanguage>>> =
    Lazy::new(|| Mutex::new(Vec::new()));
static DIAGNOSTICS: Lazy<Mutex<Vec<DiagnosticEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
static STATUS_BAR_MESSAGES: Lazy<Mutex<Vec<StatusBarEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
static CODE_ACTION_PROVIDERS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[allow(clippy::expect_used)]
pub fn host_register_language(language_id: &str, extensions_json: &str) {
    let extensions: Vec<String> = serde_json::from_str(extensions_json).unwrap_or_default();
    let entry = RegisteredLanguage {
        language_id: language_id.to_string(),
        extensions,
    };

    let mut registry = REGISTERED_LANGUAGES
        .lock()
        .expect("Registered languages lock poisoned");
    registry.push(entry);

    info!(
        "[WasmExt] Registered language: language_id='{}'",
        language_id
    );
}

#[allow(clippy::expect_used)]
pub fn host_register_diagnostic(uri: &str, diagnostics: &str) {
    let entry = DiagnosticEntry {
        uri: uri.to_string(),
        diagnostics: diagnostics.to_string(),
    };

    let mut registry = DIAGNOSTICS
        .lock()
        .expect("Diagnostics registry lock poisoned");
    registry.retain(|d| d.uri != uri);
    registry.push(entry);

    info!("[WasmExt] Registered diagnostics for uri='{}'", uri);
}

#[allow(clippy::expect_used)]
pub fn host_register_code_action_provider(language_id: &str) {
    let mut registry = CODE_ACTION_PROVIDERS
        .lock()
        .expect("Code action providers lock poisoned");
    if !registry.contains(&language_id.to_string()) {
        registry.push(language_id.to_string());
    }
    info!(
        "[WasmExt] Registered code action provider for language_id='{}'",
        language_id
    );
}

pub fn host_get_workspace_path() -> Option<String> {
    debug!("[WasmExt] Get workspace path requested");
    None
}

#[allow(clippy::expect_used)]
pub fn host_set_status_bar_message(text: &str, timeout_ms: Option<u32>) {
    let created_at = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let entry = StatusBarEntry {
        text: text.to_string(),
        timeout_ms,
        created_at,
    };

    let mut registry = STATUS_BAR_MESSAGES
        .lock()
        .expect("Status bar messages lock poisoned");
    registry.push(entry);

    info!(
        "[WasmExt] Status bar message: text='{}', timeout_ms={:?}",
        text, timeout_ms
    );
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn create_test_context(workspace_root: &Path) -> HostContext {
        let permissions = Arc::new(PermissionsManager::new());
        permissions.set_workspace_folders(vec![workspace_root.to_path_buf()]);
        HostContext {
            extension_id: "test-extension".to_string(),
            workspace_root: Some(workspace_root.to_string_lossy().to_string()),
            permissions,
            registered_providers: RegisteredProviders::default(),
            tree_views: Vec::new(),
            status_bar_items: HashMap::new(),
            scm_providers: Vec::new(),
            debug_adapters: Vec::new(),
        }
    }

    fn create_temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("cortex_host_test_{}_{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("Failed to create temp dir");
        dir
    }

    fn cleanup_temp_dir(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_host_log_levels() {
        host_log(0, "trace message");
        host_log(1, "debug message");
        host_log(2, "info message");
        host_log(3, "warn message");
        host_log(4, "error message");
        host_log(99, "unknown level message");
    }

    #[test]
    fn test_validate_workspace_path_prevents_traversal() {
        let dir = create_temp_dir("traversal");
        let root = dir.to_string_lossy().to_string();

        let result = validate_workspace_path(&root, "../../../etc/passwd");
        assert!(result.is_err(), "Path traversal should be rejected");

        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("escapes workspace root") || err_msg.contains("Invalid"),
            "Error should mention path escape: {}",
            err_msg
        );

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_validate_workspace_path_allows_valid() {
        let dir = create_temp_dir("valid_path");
        let test_file = dir.join("hello.txt");
        fs::write(&test_file, "content").expect("Failed to write test file");

        let root = dir.to_string_lossy().to_string();
        let result = validate_workspace_path(&root, "hello.txt");
        assert!(result.is_ok(), "Valid path should be allowed: {:?}", result);

        let resolved = result.unwrap();
        assert!(resolved.starts_with(dir.canonicalize().unwrap()));

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_context_default() {
        let permissions = Arc::new(PermissionsManager::new());
        let ctx = HostContext {
            extension_id: "my-ext".to_string(),
            workspace_root: None,
            permissions,
            registered_providers: RegisteredProviders::default(),
            tree_views: Vec::new(),
            status_bar_items: HashMap::new(),
            scm_providers: Vec::new(),
            debug_adapters: Vec::new(),
        };
        assert_eq!(ctx.extension_id, "my-ext");
        assert!(ctx.workspace_root.is_none());
        assert!(ctx.tree_views.is_empty());
        assert!(ctx.status_bar_items.is_empty());
        assert!(ctx.scm_providers.is_empty());
        assert!(ctx.debug_adapters.is_empty());
        assert!(ctx.registered_providers.completion_providers.is_empty());
        assert!(ctx.registered_providers.hover_providers.is_empty());
        assert!(ctx.registered_providers.definition_providers.is_empty());
    }

    #[test]
    fn test_host_list_directory() {
        let dir = create_temp_dir("list_dir");
        fs::write(dir.join("file1.txt"), "a").unwrap();
        fs::write(dir.join("file2.txt"), "bb").unwrap();
        fs::create_dir(dir.join("subdir")).unwrap();

        let ctx = create_test_context(&dir);
        let result = host_list_directory(&ctx, ".").unwrap();

        assert_eq!(result.len(), 3);
        let names: Vec<&str> = result.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"file1.txt"));
        assert!(names.contains(&"file2.txt"));
        assert!(names.contains(&"subdir"));

        let subdir_entry = result.iter().find(|e| e.name == "subdir").unwrap();
        assert!(subdir_entry.is_dir);
        assert!(!subdir_entry.is_file);

        let file_entry = result.iter().find(|e| e.name == "file1.txt").unwrap();
        assert!(file_entry.is_file);
        assert!(!file_entry.is_dir);

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_stat_file() {
        let dir = create_temp_dir("stat_file");
        let file_path = dir.join("stat_test.txt");
        fs::write(&file_path, "hello world").unwrap();

        let ctx = create_test_context(&dir);
        let stat = host_stat_file_ctx(&ctx, "stat_test.txt").unwrap();

        assert_eq!(stat.size, 11);
        assert!(stat.is_file);
        assert!(!stat.is_dir);
        assert!(!stat.is_symlink);
        assert!(stat.modified > 0);

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_read_write_file_bytes() {
        let dir = create_temp_dir("rw_bytes");
        let ctx = create_test_context(&dir);

        let data = b"binary\x00data\xff\xfe";
        host_write_file_bytes(&ctx, "test.bin", data).unwrap();

        let read_back = host_read_file_bytes(&ctx, "test.bin").unwrap();
        assert_eq!(read_back, data);

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_delete_file() {
        let dir = create_temp_dir("delete_file");
        let file_path = dir.join("to_delete.txt");
        fs::write(&file_path, "delete me").unwrap();
        assert!(file_path.exists());

        let ctx = create_test_context(&dir);
        host_delete_file(&ctx, "to_delete.txt").unwrap();
        assert!(!file_path.exists());

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_register_providers() {
        let dir = create_temp_dir("providers");
        let mut ctx = create_test_context(&dir);

        let comp_id = host_register_completion_provider_ctx(
            &mut ctx,
            "rust",
            vec![".".to_string(), "::".to_string()],
        )
        .unwrap();
        assert!(comp_id > 0);

        let hover_id = host_register_hover_provider_ctx(&mut ctx, "rust").unwrap();
        assert!(hover_id > 0);
        assert_ne!(comp_id, hover_id);

        let def_id = host_register_definition_provider_ctx(&mut ctx, "typescript").unwrap();
        assert!(def_id > 0);
        assert_ne!(hover_id, def_id);

        assert!(
            ctx.registered_providers
                .completion_providers
                .contains_key("rust")
        );
        let triggers = &ctx.registered_providers.completion_providers["rust"];
        assert_eq!(triggers, &vec![".".to_string(), "::".to_string()]);

        assert!(
            ctx.registered_providers
                .hover_providers
                .contains(&"rust".to_string())
        );
        assert!(
            ctx.registered_providers
                .definition_providers
                .contains(&"typescript".to_string())
        );

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_register_tree_view() {
        let dir = create_temp_dir("tree_view");
        let mut ctx = create_test_context(&dir);

        host_register_tree_view(&mut ctx, "explorer", "File Explorer").unwrap();
        assert_eq!(ctx.tree_views.len(), 1);
        assert_eq!(ctx.tree_views[0].id, "explorer");
        assert_eq!(ctx.tree_views[0].title, "File Explorer");

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_register_status_bar_item() {
        let dir = create_temp_dir("status_bar");
        let mut ctx = create_test_context(&dir);

        host_register_status_bar_item(&mut ctx, "git-branch", "main", 0, 100).unwrap();
        assert!(ctx.status_bar_items.contains_key("git-branch"));

        let item = &ctx.status_bar_items["git-branch"];
        assert_eq!(item.text, "main");
        assert_eq!(item.alignment, 0);
        assert_eq!(item.priority, 100);

        host_update_status_bar_item(&mut ctx, "git-branch", "develop").unwrap();
        assert_eq!(ctx.status_bar_items["git-branch"].text, "develop");

        let err = host_update_status_bar_item(&mut ctx, "nonexistent", "text");
        assert!(err.is_err());

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_register_scm_provider() {
        let dir = create_temp_dir("scm");
        let mut ctx = create_test_context(&dir);

        host_register_scm_provider(&mut ctx, "git", "Git").unwrap();
        assert_eq!(ctx.scm_providers.len(), 1);
        assert_eq!(ctx.scm_providers[0].id, "git");
        assert_eq!(ctx.scm_providers[0].label, "Git");

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_register_debug_adapter() {
        let dir = create_temp_dir("debug");
        let mut ctx = create_test_context(&dir);

        host_register_debug_adapter(&mut ctx, "lldb").unwrap();
        assert_eq!(ctx.debug_adapters.len(), 1);
        assert_eq!(ctx.debug_adapters[0], "lldb");

        host_register_debug_adapter(&mut ctx, "gdb").unwrap();
        assert_eq!(ctx.debug_adapters.len(), 2);

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_find_files() {
        let dir = create_temp_dir("find_files");
        fs::write(dir.join("a.rs"), "fn main() {}").unwrap();
        fs::write(dir.join("b.rs"), "fn test() {}").unwrap();
        fs::write(dir.join("c.txt"), "hello").unwrap();

        let ctx = create_test_context(&dir);

        let results = host_find_files(&ctx, "*.rs", 100).unwrap();
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|r| r == "a.rs"));
        assert!(results.iter().any(|r| r == "b.rs"));

        let limited = host_find_files(&ctx, "*.rs", 1).unwrap();
        assert_eq!(limited.len(), 1);

        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_get_selection_returns_none() {
        let dir = create_temp_dir("selection");
        let ctx = create_test_context(&dir);
        assert!(host_get_selection(&ctx).is_none());
        cleanup_temp_dir(&dir);
    }

    #[test]
    fn test_host_get_workspace_path_returns_none() {
        assert!(host_get_workspace_path().is_none());
    }

    #[test]
    fn test_host_register_language() {
        host_register_language("rust", r#"[".rs"]"#);
    }

    #[test]
    fn test_host_register_diagnostic() {
        host_register_diagnostic("file:///test.rs", r#"[{"message":"error"}]"#);
    }

    #[test]
    fn test_host_set_status_bar_message() {
        host_set_status_bar_message("Building...", Some(5000));
        host_set_status_bar_message("Ready", None);
    }

    #[test]
    fn test_host_create_output_channel() {
        let id = host_create_output_channel("Test Output");
        assert!(!id.is_empty());
    }
}
