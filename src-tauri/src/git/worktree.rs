//! Git worktree operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;
use super::types::WorktreeInfo;

// ============================================================================
// Worktree Commands
// ============================================================================

/// List all worktrees in the repository (sync version for internal use)
fn git_worktree_list_sync(path: &str) -> Result<Vec<WorktreeInfo>, String> {
    let repo_root = get_repo_root(path)?;
    let repo_root_path = Path::new(&repo_root);

    // Use git worktree list --porcelain for machine-readable output
    let output = git_command_with_timeout(&["worktree", "list", "--porcelain"], repo_root_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to list worktrees: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut worktrees = Vec::new();
    let mut current_worktree: Option<WorktreeInfo> = None;

    for line in stdout.lines() {
        if line.starts_with("worktree ") {
            // Save previous worktree if any
            if let Some(wt) = current_worktree.take() {
                worktrees.push(wt);
            }
            // Start new worktree
            let worktree_path = line.strip_prefix("worktree ").unwrap_or("").to_string();
            current_worktree = Some(WorktreeInfo {
                path: worktree_path,
                head: None,
                branch: None,
                is_bare: false,
                is_detached: false,
                is_locked: false,
                lock_reason: None,
                prunable: false,
            });
        } else if let Some(ref mut wt) = current_worktree {
            if line.starts_with("HEAD ") {
                wt.head = Some(line.strip_prefix("HEAD ").unwrap_or("").to_string());
            } else if line.starts_with("branch ") {
                let branch = line
                    .strip_prefix("branch refs/heads/")
                    .unwrap_or(line.strip_prefix("branch ").unwrap_or(""));
                wt.branch = Some(branch.to_string());
            } else if line == "bare" {
                wt.is_bare = true;
            } else if line == "detached" {
                wt.is_detached = true;
            } else if line == "locked" {
                wt.is_locked = true;
            } else if line.starts_with("locked ") {
                wt.is_locked = true;
                wt.lock_reason = Some(line.strip_prefix("locked ").unwrap_or("").to_string());
            } else if line == "prunable" {
                wt.prunable = true;
            }
        }
    }

    // Don't forget the last worktree
    if let Some(wt) = current_worktree {
        worktrees.push(wt);
    }

    Ok(worktrees)
}

/// List all worktrees in the repository
#[tauri::command]
pub async fn git_worktree_list(path: String) -> Result<Vec<WorktreeInfo>, String> {
    tokio::task::spawn_blocking(move || git_worktree_list_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Add a new worktree
#[tauri::command]
pub async fn git_worktree_add(
    path: String,
    worktree_path: String,
    branch: Option<String>,
    new_branch: Option<String>,
    commit: Option<String>,
    force: bool,
    detach: bool,
) -> Result<WorktreeInfo, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["worktree", "add"];

        if force {
            args.push("--force");
        }

        if detach {
            args.push("--detach");
        }

        // Handle new branch creation
        let new_branch_owned;
        if let Some(ref nb) = new_branch {
            args.push("-b");
            new_branch_owned = nb.clone();
            args.push(&new_branch_owned);
        }

        args.push(&worktree_path);

        // Add branch or commit to checkout
        let branch_owned;
        let commit_owned;
        if let Some(ref b) = branch {
            branch_owned = b.clone();
            args.push(&branch_owned);
        } else if let Some(ref c) = commit {
            commit_owned = c.clone();
            args.push(&commit_owned);
        }

        info!("Adding worktree at: {}", worktree_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to add worktree: {}", stderr));
        }

        // Return info about the newly created worktree
        let worktrees = git_worktree_list_sync(&path)?;
        worktrees
            .into_iter()
            .find(|wt| wt.path.ends_with(&worktree_path) || wt.path == worktree_path)
            .ok_or_else(|| "Failed to find created worktree".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Remove a worktree
#[tauri::command]
pub async fn git_worktree_remove(
    path: String,
    worktree_path: String,
    force: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["worktree", "remove"];

        if force {
            args.push("--force");
        }

        args.push(&worktree_path);

        info!("Removing worktree: {}", worktree_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to remove worktree: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Lock a worktree to prevent it from being pruned
#[tauri::command]
pub async fn git_worktree_lock(
    path: String,
    worktree_path: String,
    reason: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["worktree", "lock"];

        let reason_owned;
        if let Some(ref r) = reason {
            args.push("--reason");
            reason_owned = r.clone();
            args.push(&reason_owned);
        }

        args.push(&worktree_path);

        info!("Locking worktree: {}", worktree_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to lock worktree: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Unlock a locked worktree
#[tauri::command]
pub async fn git_worktree_unlock(path: String, worktree_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let args = vec!["worktree", "unlock", &worktree_path];

        info!("Unlocking worktree: {}", worktree_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to unlock worktree: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Move a worktree to a new location
#[tauri::command]
pub async fn git_worktree_move(
    path: String,
    worktree_path: String,
    new_path: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let args = vec!["worktree", "move", &worktree_path, &new_path];

        info!("Moving worktree from {} to {}", worktree_path, new_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to move worktree: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Repair worktree administrative files
#[tauri::command]
pub async fn git_worktree_repair(
    path: String,
    worktree_paths: Option<Vec<String>>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["worktree", "repair"];

        let paths_owned: Vec<String>;
        if let Some(ref paths) = worktree_paths {
            paths_owned = paths.clone();
            for p in &paths_owned {
                args.push(p.as_str());
            }
        }

        info!("Repairing worktrees");

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to repair worktrees: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Prune worktree information (removes stale entries)
#[tauri::command]
pub async fn git_worktree_prune(path: String, dry_run: bool) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["worktree", "prune"];

        if dry_run {
            args.push("--dry-run");
            args.push("-v"); // Verbose to see what would be pruned
        }

        info!("Pruning worktrees (dry_run: {})", dry_run);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to prune worktrees: {}", stderr));
        }

        // Parse output to return list of pruned/would-be-pruned paths
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{}\n{}", stdout, stderr_str);

        let pruned: Vec<String> = combined
            .lines()
            .filter(|line| line.contains("Removing") || line.contains("would prune"))
            .map(|line| line.to_string())
            .collect();

        Ok(pruned)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
