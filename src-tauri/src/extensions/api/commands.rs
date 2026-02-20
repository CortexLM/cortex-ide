//! Plugin command registration and execution API.
//!
//! Provides Tauri IPC commands for extensions to register, query, and execute
//! plugin-contributed commands at runtime.

use tauri::{AppHandle, Manager};
use tracing::info;

use crate::extensions::plugin_api::{CommandRegistration, PluginApiState};

// ============================================================================
// Tauri Commands
// ============================================================================

/// Register a new command contributed by an extension plugin.
#[tauri::command]
pub async fn plugin_register_command(
    app: AppHandle,
    extension_id: String,
    command_id: String,
    title: String,
    category: Option<String>,
) -> Result<(), String> {
    let state = app.state::<PluginApiState>();
    state
        .commands
        .register_command(extension_id, command_id, title, category);
    Ok(())
}

/// Execute a previously registered plugin command by its identifier.
///
/// Returns the serialised `CommandRegistration` metadata so the caller can
/// dispatch the actual execution through the WASM runtime.
#[tauri::command]
pub async fn plugin_execute_command(
    app: AppHandle,
    command_id: String,
    args: Option<String>,
) -> Result<String, String> {
    let state = app.state::<PluginApiState>();
    let args_json = args.unwrap_or_else(|| "{}".to_string());

    info!(command_id = %command_id, "Executing plugin command");

    state.commands.execute_command(&command_id, &args_json)
}

/// Return all commands currently registered by extension plugins.
#[tauri::command]
pub async fn plugin_get_commands(app: AppHandle) -> Result<Vec<CommandRegistration>, String> {
    let state = app.state::<PluginApiState>();
    Ok(state.commands.get_commands())
}
