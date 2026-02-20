//! Git merge operations.

use std::path::Path;
use tracing::{info, warn};

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;
use super::types::MergeResult;

// ============================================================================
// Merge Commands
// ============================================================================

/// Merge a branch into the current branch
#[tauri::command]
pub async fn git_merge(
    path: String,
    branch: String,
    no_ff: Option<bool>,
    message: Option<String>,
) -> Result<MergeResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["merge".to_string()];

        if no_ff.unwrap_or(false) {
            args.push("--no-ff".to_string());
        }

        if let Some(ref msg) = message {
            args.push("-m".to_string());
            args.push(msg.clone());
        }

        args.push(branch.clone());

        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        info!("Merging branch '{}' into current branch", branch);

        let output = git_command_with_timeout(&args_refs, repo_root_path)?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if output.status.success() {
            let fast_forward = stdout.contains("Fast-forward") || stderr.contains("Fast-forward");

            info!(
                "Merge completed successfully (fast_forward: {})",
                fast_forward
            );

            Ok(MergeResult {
                success: true,
                fast_forward,
                conflicts: vec![],
                message: Some(stdout.to_string()),
            })
        } else {
            // Check if there are conflicts
            let combined = format!("{}\n{}", stdout, stderr);

            if combined.contains("CONFLICT") || combined.contains("Automatic merge failed") {
                // Get list of conflicting files
                let conflicts = get_conflict_files(&repo_root)?;

                warn!("Merge resulted in conflicts: {:?}", conflicts);

                Ok(MergeResult {
                    success: false,
                    fast_forward: false,
                    conflicts,
                    message: Some(
                        "Merge conflicts detected. Please resolve conflicts and commit."
                            .to_string(),
                    ),
                })
            } else {
                Err(format!("Merge failed: {}", stderr))
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get list of files with merge conflicts
fn get_conflict_files(repo_root: &str) -> Result<Vec<String>, String> {
    let output = git_command_with_timeout(
        &["diff", "--name-only", "--diff-filter=U"],
        Path::new(repo_root),
    )?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let conflicts: Vec<String> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect();

    Ok(conflicts)
}

/// Abort an in-progress merge
#[tauri::command]
pub async fn git_merge_abort(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["merge", "--abort"], repo_root_path)?;

        if output.status.success() {
            info!("Merge aborted successfully");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to abort merge: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Continue a merge after resolving conflicts
#[tauri::command]
pub async fn git_merge_continue(path: String) -> Result<MergeResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Check if there are still unresolved conflicts
        let conflicts = get_conflict_files(&repo_root)?;
        if !conflicts.is_empty() {
            return Ok(MergeResult {
                success: false,
                fast_forward: false,
                conflicts,
                message: Some("There are still unresolved conflicts".to_string()),
            });
        }

        // Continue merge by committing
        let output = git_command_with_timeout(&["commit", "--no-edit"], repo_root_path)?;

        if output.status.success() {
            info!("Merge continued and committed successfully");
            Ok(MergeResult {
                success: true,
                fast_forward: false,
                conflicts: vec![],
                message: Some("Merge completed".to_string()),
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to continue merge: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
