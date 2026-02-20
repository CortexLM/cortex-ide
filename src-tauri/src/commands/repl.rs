//! REPL kernel management commands

use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

use crate::repl::{KernelEvent, KernelInfo, KernelManager, KernelSpec};

#[derive(Clone)]
pub struct REPLState(pub Arc<Mutex<Option<KernelManager>>>);

#[tauri::command]
pub async fn repl_list_kernel_specs(app: AppHandle) -> Result<Vec<KernelSpec>, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });

        *guard = Some(KernelManager::new(tx));
    }

    match guard.as_ref() {
        Some(manager) => Ok(manager.list_kernel_specs()),
        None => Err("Kernel manager not initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_start_kernel(app: AppHandle, spec_id: String) -> Result<KernelInfo, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });

        *guard = Some(KernelManager::new(tx));
    }

    match guard.as_mut() {
        Some(manager) => manager.start_kernel(&spec_id),
        None => Err("Kernel manager not initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_list_kernels(app: AppHandle) -> Result<Vec<KernelInfo>, String> {
    let repl_state = app.state::<REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_ref() {
        Some(manager) => Ok(manager.list_kernels()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn repl_execute(
    app: AppHandle,
    kernel_id: String,
    code: String,
    cell_id: String,
) -> Result<u32, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.execute(&kernel_id, &code, &cell_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_interrupt(app: AppHandle, kernel_id: String) -> Result<(), String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.interrupt(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_shutdown_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.shutdown(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_restart_kernel(app: AppHandle, kernel_id: String) -> Result<KernelInfo, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.restart(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_get_kernel(
    app: AppHandle,
    kernel_id: String,
) -> Result<Option<KernelInfo>, String> {
    let repl_state = app.state::<REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_ref() {
        Some(manager) => Ok(manager.get_kernel(&kernel_id)),
        None => Ok(None),
    }
}
