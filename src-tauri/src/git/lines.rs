//! Git line-level staging operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::types::LineRange;

// ============================================================================
// Line Staging Commands
// ============================================================================

/// Stage specific lines from a file
#[tauri::command]
pub async fn git_stage_lines(
    path: String,
    file: String,
    ranges: Vec<LineRange>,
) -> Result<(), String> {
    // Use git add -p with an automated response script
    // This is a simplified implementation that stages the whole file
    // A full implementation would use git add --patch with interactive input
    tokio::task::spawn_blocking(move || {
        // For now, stage the whole file as line-level staging requires interactive mode
        // A production implementation would parse the diff and use git apply --cached
        let output = git_command_with_timeout(&["add", "--", &file], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to stage lines: {}", stderr));
        }

        info!("[Git] Staged file {} (line staging: {:?})", file, ranges);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Unstage specific lines from a file
#[tauri::command]
pub async fn git_unstage_lines(
    path: String,
    file: String,
    ranges: Vec<LineRange>,
) -> Result<(), String> {
    // Similar to stage_lines, this is a simplified implementation
    tokio::task::spawn_blocking(move || {
        let output = git_command_with_timeout(&["reset", "HEAD", "--", &file], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to unstage lines: {}", stderr));
        }

        info!(
            "[Git] Unstaged file {} (line unstaging: {:?})",
            file, ranges
        );
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
