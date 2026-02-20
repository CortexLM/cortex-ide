use crate::repl::{KernelEvent, KernelInfo, KernelManager};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, command};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

const KERNEL_START_TIMEOUT: Duration = Duration::from_secs(30);
const KERNEL_EXECUTE_TIMEOUT: Duration = Duration::from_secs(30);
const KERNEL_INTERRUPT_TIMEOUT: Duration = Duration::from_secs(10);
const KERNEL_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(10);

/// Execute a cell in a notebook's kernel
#[command]
pub async fn notebook_execute_cell(
    app: AppHandle,
    kernel_id: String,
    cell_id: String,
    code: String,
    notebook_path: String,
) -> Result<u32, String> {
    info!(
        "[Notebook] Execute cell {} in kernel {} for {}",
        cell_id, kernel_id, notebook_path
    );

    let repl_state = app.state::<crate::app::REPLState>();
    let state_clone = repl_state.0.clone();
    let kid = kernel_id.clone();
    let cid = cell_id.clone();

    let result = tokio::time::timeout(
        KERNEL_EXECUTE_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            match guard.as_mut() {
                Some(manager) => manager.execute(&kid, &code, &cid),
                None => Err("No kernel manager initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Execute cell {} timed out after {:?}",
            cell_id, KERNEL_EXECUTE_TIMEOUT
        );
        format!(
            "Execute cell timed out after {} seconds",
            KERNEL_EXECUTE_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Execute task failed: {}", e))??;

    Ok(result)
}

/// Interrupt a notebook's kernel
#[command]
pub async fn notebook_interrupt_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    info!("[Notebook] Interrupt kernel {}", kernel_id);

    let repl_state = app.state::<crate::app::REPLState>();
    let state_clone = repl_state.0.clone();
    let kid = kernel_id.clone();

    tokio::time::timeout(
        KERNEL_INTERRUPT_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            match guard.as_mut() {
                Some(manager) => manager.interrupt(&kid),
                None => Err("No kernel manager initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Interrupt kernel {} timed out after {:?}",
            kernel_id, KERNEL_INTERRUPT_TIMEOUT
        );
        format!(
            "Interrupt kernel timed out after {} seconds",
            KERNEL_INTERRUPT_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Interrupt task failed: {}", e))?
}

/// Shutdown a notebook's kernel
#[command]
pub async fn notebook_shutdown_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    info!("[Notebook] Shutdown kernel {}", kernel_id);

    let repl_state = app.state::<crate::app::REPLState>();
    let state_clone = repl_state.0.clone();
    let kid = kernel_id.clone();

    tokio::time::timeout(
        KERNEL_SHUTDOWN_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            match guard.as_mut() {
                Some(manager) => manager.shutdown(&kid),
                None => Err("No kernel manager initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Shutdown kernel {} timed out after {:?}",
            kernel_id, KERNEL_SHUTDOWN_TIMEOUT
        );
        format!(
            "Shutdown kernel timed out after {} seconds",
            KERNEL_SHUTDOWN_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Shutdown task failed: {}", e))?
}

/// Start a kernel for a notebook
#[command]
pub async fn notebook_start_kernel(
    app: AppHandle,
    kernel_id: String,
    language: String,
    notebook_path: String,
) -> Result<KernelInfo, String> {
    info!(
        "[Notebook] Start {} kernel {} for {}",
        language, kernel_id, notebook_path
    );

    let repl_state = app.state::<crate::app::REPLState>();
    let state_clone = repl_state.0.clone();
    let app_clone = app.clone();

    let spec_id = match language.as_str() {
        "python" => "python3".to_string(),
        "javascript" | "typescript" => "node".to_string(),
        _ => language.clone(),
    };

    let result = tokio::time::timeout(
        KERNEL_START_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            if guard.is_none() {
                let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
                let emitter = app_clone.clone();

                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        let _ = emitter.emit("repl:event", &event);
                    }
                });

                *guard = Some(KernelManager::new(tx));
            }

            match guard.as_mut() {
                Some(manager) => manager.start_kernel(&spec_id),
                None => Err("Kernel manager not initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Start kernel {} timed out after {:?}",
            kernel_id, KERNEL_START_TIMEOUT
        );
        format!(
            "Start kernel timed out after {} seconds",
            KERNEL_START_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Start kernel task failed: {}", e))??;

    Ok(result)
}

/// Restart a notebook's kernel (shutdown + start).
#[command]
pub async fn notebook_restart_kernel(
    app: AppHandle,
    kernel_id: String,
    language: String,
    notebook_path: String,
) -> Result<KernelInfo, String> {
    info!(
        "[Notebook] Restarting kernel {} for {}",
        kernel_id, notebook_path
    );

    // Attempt shutdown, ignoring errors if kernel is already dead
    let shutdown_result = notebook_shutdown_kernel(app.clone(), kernel_id.clone()).await;
    if let Err(ref e) = shutdown_result {
        warn!(
            "[Notebook] Shutdown during restart failed (continuing): {}",
            e
        );
    }

    // Start a new kernel
    let info = notebook_start_kernel(app, kernel_id, language, notebook_path).await?;
    Ok(info)
}

/// Poll the status of a kernel.
#[command]
pub async fn notebook_kernel_status(app: AppHandle, kernel_id: String) -> Result<String, String> {
    let repl_state = app.state::<crate::app::REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock".to_string())?;

    match guard.as_ref() {
        Some(manager) => match manager.get_kernel(&kernel_id) {
            Some(info) => {
                let status_str = serde_json::to_string(&info.status)
                    .unwrap_or_else(|_| "\"unknown\"".to_string());
                // Remove surrounding quotes from serialized enum
                Ok(status_str.trim_matches('"').to_string())
            }
            None => Ok("disconnected".to_string()),
        },
        None => Ok("disconnected".to_string()),
    }
}
