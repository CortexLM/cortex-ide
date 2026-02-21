//! Git cherry-pick operations.

use git2::{Oid, RepositoryState, StatusOptions};
use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::find_repo;
use super::types::{CherryPickStatus, CommitFile};

// ============================================================================
// Cherry-pick Helper Functions
// ============================================================================

/// Get line addition/deletion stats for a file in a commit using git CLI
fn get_file_stats_for_commit(repo_path: &str, hash: &str, file_path: &str) -> (u32, u32) {
    let parent_hash = format!("{}^", hash);
    let output = git_command_with_timeout(
        &["diff", "--numstat", &parent_hash, hash, "--", file_path],
        Path::new(repo_path),
    );

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = stdout.split_whitespace().collect();
            if parts.len() >= 2 {
                let additions = parts[0].parse().unwrap_or(0);
                let deletions = parts[1].parse().unwrap_or(0);
                return (additions, deletions);
            }
        }
        _ => {}
    }
    (0, 0)
}

// ============================================================================
// Cherry-pick Commands
// ============================================================================

/// Get files changed in a specific commit
#[tauri::command]
pub async fn git_commit_files(path: String, hash: String) -> Result<Vec<CommitFile>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let oid = Oid::from_str(&hash).map_err(|e| format!("Invalid commit hash: {}", e))?;

        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let commit_tree = commit
            .tree()
            .map_err(|e| format!("Failed to get commit tree: {}", e))?;

        // Get parent tree (or empty tree for first commit)
        let parent_tree = if commit.parent_count() > 0 {
            Some(
                commit
                    .parent(0)
                    .map_err(|e| format!("Failed to get parent: {}", e))?
                    .tree()
                    .map_err(|e| format!("Failed to get parent tree: {}", e))?,
            )
        } else {
            None
        };

        let diff = repo
            .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        let mut files = Vec::new();

        for delta in diff.deltas() {
            let file_path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                git2::Delta::Copied => "copied",
                _ => "modified",
            }
            .to_string();

            // Get line stats using git CLI since git2 doesn't provide them easily
            let (additions, deletions) = get_file_stats_for_commit(&path, &hash, &file_path);

            files.push(CommitFile {
                path: file_path,
                status,
                additions,
                deletions,
            });
        }

        Ok(files)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Check the current cherry-pick status
#[tauri::command]
pub async fn git_cherry_pick_status(path: String) -> Result<CherryPickStatus, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let state = repo.state();
        let in_progress =
            state == RepositoryState::CherryPick || state == RepositoryState::CherryPickSequence;

        let mut has_conflicts = false;
        let mut current_commit: Option<String> = None;

        if in_progress {
            // Check for conflicts
            let mut opts = StatusOptions::new();
            opts.include_untracked(false);

            if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
                for entry in statuses.iter() {
                    if entry.status().is_conflicted() {
                        has_conflicts = true;
                        break;
                    }
                }
            }

            // Try to get the current cherry-pick commit from CHERRY_PICK_HEAD
            let git_dir = repo.path();
            let cherry_pick_head = git_dir.join("CHERRY_PICK_HEAD");
            if cherry_pick_head.exists() {
                if let Ok(content) = std::fs::read_to_string(&cherry_pick_head) {
                    current_commit = Some(content.trim().to_string());
                }
            }
        }

        Ok(CherryPickStatus {
            in_progress,
            current_commit,
            has_conflicts,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Cherry-pick a single commit (simple wrapper for git-graph SDK)
#[tauri::command]
pub async fn git_cherry_pick(path: Option<String>, hash: String) -> Result<(), String> {
    let path = path.unwrap_or_else(|| ".".to_string());
    tokio::task::spawn_blocking(move || {
        info!("Cherry-picking commit {}", hash);

        let output = git_command_with_timeout(&["cherry-pick", &hash], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("CONFLICT") || stderr.contains("conflict") {
                info!("Cherry-pick has conflicts, waiting for resolution");
                return Ok(());
            }
            return Err(format!("Cherry-pick failed: {}", stderr));
        }

        info!("Cherry-pick of {} completed successfully", hash);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Start a cherry-pick operation for one or more commits
#[tauri::command]
pub async fn git_cherry_pick_start(path: String, commits: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if commits.is_empty() {
            return Err("No commits provided for cherry-pick".to_string());
        }

        info!("Starting cherry-pick of {} commits", commits.len());

        // Use git CLI for cherry-pick as git2 doesn't support it well
        let mut args: Vec<&str> = vec!["cherry-pick"];
        let commits_refs: Vec<&str> = commits.iter().map(|s| s.as_str()).collect();
        args.extend(commits_refs);

        let output = git_command_with_timeout(&args, Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Check if it's a conflict (which is expected and not an error)
            if stderr.contains("CONFLICT") || stderr.contains("conflict") {
                info!("Cherry-pick has conflicts, waiting for resolution");
                return Ok(());
            }
            return Err(format!("Cherry-pick failed: {}", stderr));
        }

        info!("Cherry-pick completed successfully");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Continue the cherry-pick operation after resolving conflicts
#[tauri::command]
pub async fn git_cherry_pick_continue(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        info!("Continuing cherry-pick");

        let output = git_command_with_timeout(&["cherry-pick", "--continue"], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Check if there are still conflicts
            if stderr.contains("CONFLICT") || stderr.contains("conflict") {
                return Err(
                    "Conflicts still exist. Please resolve all conflicts before continuing."
                        .to_string(),
                );
            }
            // Check if nothing to commit (conflicts resolved but not staged)
            if stderr.contains("nothing to commit") || stderr.contains("no changes added") {
                return Err(
                    "No changes staged. Please stage resolved files before continuing.".to_string(),
                );
            }
            return Err(format!("Failed to continue cherry-pick: {}", stderr));
        }

        info!("Cherry-pick continue successful");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Skip the current commit during cherry-pick
#[tauri::command]
pub async fn git_cherry_pick_skip(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        info!("Skipping current cherry-pick commit");

        let output = git_command_with_timeout(&["cherry-pick", "--skip"], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to skip cherry-pick: {}", stderr));
        }

        info!("Cherry-pick skip successful");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Abort the current cherry-pick operation
#[tauri::command]
pub async fn git_cherry_pick_abort(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        info!("Aborting cherry-pick");

        let output = git_command_with_timeout(&["cherry-pick", "--abort"], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to abort cherry-pick: {}", stderr));
        }

        info!("Cherry-pick aborted successfully");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
