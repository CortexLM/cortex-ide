//! Process management for Cortex Desktop
//!
//! This module provides backend support for process exploration and termination.

use serde::{Deserialize, Serialize};
use tauri::command;
use tracing::info;

/// Process information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
}

/// Terminate a Cortex-managed process
#[command]
pub async fn terminate_cortex_process(pid: u32, force: bool) -> Result<(), String> {
    info!("[Process] Terminating process {} (force: {})", pid, force);

    #[cfg(unix)]
    {
        let signal = if force { "SIGKILL" } else { "SIGTERM" };
        let _ = signal; // suppress unused warning
        let result = crate::process_utils::command("kill")
            .args([if force { "-9" } else { "-15" }, &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to execute kill command: {}", e))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(format!("Failed to terminate process {}: {}", pid, stderr));
        }
    }

    #[cfg(windows)]
    {
        let result = if force {
            crate::process_utils::command("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
        } else {
            crate::process_utils::command("taskkill")
                .args(["/PID", &pid.to_string()])
                .output()
        };

        match result {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Failed to terminate process {}: {}", pid, stderr));
                }
            }
            Err(e) => return Err(format!("Failed to execute taskkill: {}", e)),
        }
    }

    info!("[Process] Successfully terminated process {}", pid);
    Ok(())
}
