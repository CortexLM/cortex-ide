//! WASM extension runtime using wasmtime.
//!
//! This module provides the sandboxed WASM execution environment for
//! Cortex Desktop extensions. Extensions are compiled to WASM and run
//! in isolated wasmtime instances with host function bindings.
//! Resource limits (memory, fuel, epoch interruption) are enforced
//! to prevent runaway extensions.

#[cfg(feature = "wasm-extensions")]
pub mod host;
#[cfg(feature = "wasm-extensions")]
mod runtime;

#[cfg(feature = "wasm-extensions")]
pub use runtime::WasmRuntime;

use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm-extensions")]
use tauri::{AppHandle, Manager};

#[cfg(feature = "wasm-extensions")]
use super::state::ExtensionsState;
#[cfg(feature = "wasm-extensions")]
use crate::LazyState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmRuntimeState {
    pub id: String,
    pub status: u32,
    pub activation_time: Option<f64>,
    pub error: Option<String>,
    pub last_activity: Option<f64>,
    pub memory_usage: Option<f64>,
    pub cpu_usage: Option<f64>,
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn load_wasm_extension(
    app: AppHandle,
    extension_id: String,
    wasm_path: String,
) -> Result<(), String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();

    manager
        .wasm_runtime
        .load_extension(&extension_id, &wasm_path)
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn load_wasm_extension(
    _app: tauri::AppHandle,
    _extension_id: String,
    _wasm_path: String,
) -> Result<(), String> {
    Err("WASM extensions feature is not enabled".to_string())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn unload_wasm_extension(app: AppHandle, extension_id: String) -> Result<(), String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();

    manager.wasm_runtime.unload_extension(&extension_id)
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn unload_wasm_extension(
    _app: tauri::AppHandle,
    _extension_id: String,
) -> Result<(), String> {
    Err("WASM extensions feature is not enabled".to_string())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn execute_wasm_command(
    app: AppHandle,
    extension_id: String,
    command: String,
    args: Option<Vec<serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();

    let args_json = serde_json::to_string(&args.unwrap_or_default())
        .map_err(|e| format!("Failed to serialize args: {}", e))?;

    let result = manager
        .wasm_runtime
        .execute_command(&extension_id, &command, &args_json)?;

    serde_json::from_str(&result).unwrap_or(Ok(serde_json::Value::String(result)))
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn execute_wasm_command(
    _app: tauri::AppHandle,
    _extension_id: String,
    _command: String,
    _args: Option<Vec<serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    Err("WASM extensions feature is not enabled".to_string())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn get_wasm_runtime_states(app: AppHandle) -> Result<Vec<WasmRuntimeState>, String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let manager = state.get().0.lock();

    Ok(manager.wasm_runtime.get_states())
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn get_wasm_runtime_states(
    _app: tauri::AppHandle,
) -> Result<Vec<WasmRuntimeState>, String> {
    Ok(Vec::new())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn notify_wasm_file_save(app: AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();
    manager.wasm_runtime.notify_file_save(&path);
    Ok(())
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn notify_wasm_file_save(_app: tauri::AppHandle, _path: String) -> Result<(), String> {
    Ok(())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn notify_wasm_file_open(app: AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();
    manager.wasm_runtime.notify_file_open(&path);
    Ok(())
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn notify_wasm_file_open(_app: tauri::AppHandle, _path: String) -> Result<(), String> {
    Ok(())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn notify_wasm_workspace_change(app: AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();
    manager.wasm_runtime.notify_workspace_change(&path);
    Ok(())
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn notify_wasm_workspace_change(
    _app: tauri::AppHandle,
    _path: String,
) -> Result<(), String> {
    Ok(())
}

#[cfg(feature = "wasm-extensions")]
#[tauri::command]
pub async fn notify_wasm_selection_change(app: AppHandle, text: String) -> Result<(), String> {
    let state = app.state::<LazyState<ExtensionsState>>();
    let mut manager = state.get().0.lock();
    manager.wasm_runtime.notify_selection_change(&text);
    Ok(())
}

#[cfg(not(feature = "wasm-extensions"))]
#[tauri::command]
pub async fn notify_wasm_selection_change(
    _app: tauri::AppHandle,
    _text: String,
) -> Result<(), String> {
    Ok(())
}
