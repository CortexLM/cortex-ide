//! Tauri commands for cross-platform sandboxed process execution.
//!
//! Provides commands to spawn, wait, kill, and query the status of
//! sandboxed processes across all supported platforms.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use dashmap::DashMap;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{error, info};
use uuid::Uuid;

use super::{SandboxConfig, SandboxedProcess};
use crate::LazyState;

/// State for tracking active sandboxed processes.
pub struct SandboxState(pub Arc<DashMap<String, Arc<Mutex<SandboxedProcess>>>>);

impl SandboxState {
    /// Create a new empty sandbox state.
    pub fn new() -> Self {
        Self(Arc::new(DashMap::new()))
    }
}

/// Request payload for spawning a sandboxed process.
#[derive(Debug, Clone, Deserialize)]
pub struct SandboxSpawnRequest {
    /// Command to execute
    pub command: String,
    /// Arguments for the command
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory
    pub working_dir: Option<String>,
    /// Additional environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Block network access
    #[serde(default)]
    pub block_network: bool,
    /// Paths allowed for read-only access
    #[serde(default)]
    pub allowed_read_paths: Vec<PathBuf>,
    /// Paths allowed for read-write access
    #[serde(default)]
    pub allowed_write_paths: Vec<PathBuf>,
}

/// Response payload after spawning a sandboxed process.
#[derive(Debug, Clone, Serialize)]
pub struct SandboxSpawnResponse {
    /// Unique identifier for the spawned process
    pub process_id: String,
}

/// Spawn a new sandboxed process.
#[tauri::command]
pub async fn sandbox_spawn(
    state: State<'_, LazyState<SandboxState>>,
    config: SandboxSpawnRequest,
) -> Result<SandboxSpawnResponse, String> {
    let sandbox_config = SandboxConfig {
        command: config.command.clone(),
        args: config.args,
        working_dir: config.working_dir,
        env: config.env,
        block_network: config.block_network,
        allowed_read_paths: config.allowed_read_paths,
        allowed_write_paths: config.allowed_write_paths,
    };

    let command_name = config.command;
    let process = tokio::task::spawn_blocking(move || SandboxedProcess::spawn(&sandbox_config))
        .await
        .map_err(|e| format!("Sandbox spawn task failed: {}", e))?
        .map_err(|e| {
            error!(error = %e, "Failed to spawn sandboxed process");
            e
        })?;

    let process_id = Uuid::new_v4().to_string();
    info!(
        process_id = %process_id,
        command = %command_name,
        "Sandboxed process spawned"
    );

    state
        .get()
        .0
        .insert(process_id.clone(), Arc::new(Mutex::new(process)));

    Ok(SandboxSpawnResponse { process_id })
}

/// Wait for a sandboxed process to exit and return its exit code.
#[tauri::command]
pub async fn sandbox_wait(
    state: State<'_, LazyState<SandboxState>>,
    process_id: String,
) -> Result<i32, String> {
    let process_mutex = state
        .get()
        .0
        .get(&process_id)
        .map(|entry| Arc::clone(entry.value()))
        .ok_or_else(|| format!("Process not found: {}", process_id))?;

    let pid = process_id.clone();
    let exit_code = tokio::task::spawn_blocking(move || {
        let mut process = process_mutex.lock();
        process.wait()
    })
    .await
    .map_err(|e| format!("Sandbox wait task failed: {}", e))?
    .map_err(|e| {
        error!(process_id = %pid, error = %e, "Failed to wait for sandboxed process");
        e
    })?;

    state.get().0.remove(&process_id);

    info!(
        process_id = %process_id,
        exit_code = exit_code,
        "Sandboxed process exited"
    );

    Ok(exit_code)
}

/// Kill a sandboxed process.
#[tauri::command]
pub async fn sandbox_kill(
    state: State<'_, LazyState<SandboxState>>,
    process_id: String,
) -> Result<(), String> {
    let process_mutex = state
        .get()
        .0
        .get(&process_id)
        .map(|entry| Arc::clone(entry.value()))
        .ok_or_else(|| format!("Process not found: {}", process_id))?;

    let pid = process_id.clone();
    tokio::task::spawn_blocking(move || {
        let mut process = process_mutex.lock();
        process.kill()
    })
    .await
    .map_err(|e| format!("Sandbox kill task failed: {}", e))?
    .map_err(|e| {
        error!(process_id = %pid, error = %e, "Failed to kill sandboxed process");
        e
    })?;

    state.get().0.remove(&process_id);

    info!(process_id = %process_id, "Sandboxed process killed");

    Ok(())
}

/// Check if a sandboxed process is still running.
#[tauri::command]
pub async fn sandbox_status(
    state: State<'_, LazyState<SandboxState>>,
    process_id: String,
) -> Result<bool, String> {
    let process_mutex = state
        .get()
        .0
        .get(&process_id)
        .map(|entry| Arc::clone(entry.value()))
        .ok_or_else(|| format!("Process not found: {}", process_id))?;

    let mut process = process_mutex.lock();
    Ok(process.is_running())
}
