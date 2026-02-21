//! Git branch operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;

// ============================================================================
// Branch Commands
// ============================================================================

/// Rename a local branch
#[tauri::command]
pub async fn git_branch_rename(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let output =
            git_command_with_timeout(&["branch", "-m", &old_name, &new_name], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to rename branch: {}", stderr));
        }

        info!("[Git] Renamed branch {} to {}", old_name, new_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Publish a local branch to a remote (git push -u)
#[tauri::command]
pub async fn git_publish_branch(
    path: String,
    branch: Option<String>,
    remote: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Get current branch if not specified
        let branch_name = match branch {
            Some(b) => b,
            None => {
                let output =
                    git_command_with_timeout(&["branch", "--show-current"], repo_root_path)?;
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
        };

        if branch_name.is_empty() {
            return Err("Not on a branch (HEAD is detached)".to_string());
        }

        let remote_name = remote.unwrap_or_else(|| "origin".to_string());

        info!(
            "Publishing branch '{}' to remote '{}'",
            branch_name, remote_name
        );

        // Push with upstream tracking
        let output =
            git_command_with_timeout(&["push", "-u", &remote_name, &branch_name], repo_root_path)?;

        if output.status.success() {
            info!("Branch '{}' published successfully", branch_name);
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to publish branch: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Set upstream branch for current branch
#[tauri::command]
pub async fn git_set_upstream(
    path: String,
    branch: Option<String>,
    upstream: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Get current branch if not specified
        let branch_name = match branch {
            Some(b) => b,
            None => {
                let output =
                    git_command_with_timeout(&["branch", "--show-current"], repo_root_path)?;
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
        };

        if branch_name.is_empty() {
            return Err("Not on a branch (HEAD is detached)".to_string());
        }

        info!("Setting upstream of '{}' to '{}'", branch_name, upstream);

        let output = git_command_with_timeout(
            &["branch", "--set-upstream-to", &upstream, &branch_name],
            repo_root_path,
        )?;

        if output.status.success() {
            info!("Upstream set successfully");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to set upstream: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Soft reset to a commit (keeps changes staged)
#[tauri::command]
pub async fn git_reset_soft(path: String, commit: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let output = git_command_with_timeout(&["reset", "--soft", &commit], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to soft reset: {}", stderr));
        }

        info!("[Git] Soft reset to {}", commit);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Clean untracked files
#[tauri::command]
pub async fn git_clean(path: String, files: Option<Vec<String>>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut args = vec!["clean", "-f", "-d"];

        // If specific files are provided, clean only those
        let file_refs: Vec<&str> = files
            .as_ref()
            .map(|f| f.iter().map(|s| s.as_str()).collect())
            .unwrap_or_default();

        if !file_refs.is_empty() {
            args.push("--");
            args.extend(file_refs);
        }

        let output = git_command_with_timeout(&args, Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to clean: {}", stderr));
        }

        info!("[Git] Cleaned untracked files");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Checkout a branch, tag, or commit
#[tauri::command]
pub async fn git_checkout(path: Option<String>, r#ref: String) -> Result<(), String> {
    let path = path.unwrap_or_else(|| ".".to_string());
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["checkout", &r#ref], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to checkout '{}': {}", r#ref, stderr));
        }

        info!("[Git] Checked out '{}'", r#ref);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Create a new branch
#[tauri::command]
pub async fn git_create_branch(
    path: Option<String>,
    name: String,
    start_point: Option<String>,
) -> Result<(), String> {
    let path = path.unwrap_or_else(|| ".".to_string());
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["branch".to_string(), name.clone()];
        if let Some(ref s) = start_point {
            args.push(s.clone());
        }
        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let output = git_command_with_timeout(&args_refs, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to create branch '{}': {}", name, stderr));
        }

        info!("[Git] Created branch '{}'", name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Delete a local branch
#[tauri::command]
pub async fn git_delete_branch(
    path: Option<String>,
    name: String,
    force: Option<bool>,
) -> Result<(), String> {
    let path = path.unwrap_or_else(|| ".".to_string());
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let flag = if force.unwrap_or(false) { "-D" } else { "-d" };
        let output = git_command_with_timeout(&["branch", flag, &name], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to delete branch '{}': {}", name, stderr));
        }

        info!("[Git] Deleted branch '{}'", name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Reset current HEAD to a specific commit
#[tauri::command]
pub async fn git_reset(
    path: Option<String>,
    hash: String,
    mode: Option<String>,
) -> Result<(), String> {
    let path = path.unwrap_or_else(|| ".".to_string());
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mode_str = mode.unwrap_or_else(|| "mixed".to_string());
        let mode_flag = match mode_str.as_str() {
            "soft" => "--soft",
            "mixed" => "--mixed",
            "hard" => "--hard",
            other => return Err(format!("Invalid reset mode: {}", other)),
        };

        let output = git_command_with_timeout(&["reset", mode_flag, &hash], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to reset to '{}': {}", hash, stderr));
        }

        info!("[Git] Reset ({}) to {}", mode_str, hash);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Revert a commit
#[tauri::command]
pub async fn git_revert(path: Option<String>, hash: String) -> Result<(), String> {
    let path = path.unwrap_or_else(|| ".".to_string());
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["revert", "--no-edit", &hash], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("CONFLICT") || stderr.contains("conflict") {
                info!(
                    "[Git] Revert of {} has conflicts, waiting for resolution",
                    hash
                );
                return Ok(());
            }
            return Err(format!("Failed to revert '{}': {}", hash, stderr));
        }

        info!("[Git] Reverted commit {}", hash);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn create_repo_with_commit(dir: &std::path::Path) -> git2::Repository {
        let repo = git2::Repository::init(dir).unwrap();
        std::fs::write(dir.join("initial.txt"), "content").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("initial.txt")).unwrap();
        index.write().unwrap();
        let sig = git2::Signature::now("Test User", "test@example.com").unwrap();
        let tree_id = index.write_tree().unwrap();
        {
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
                .unwrap();
        }
        repo
    }

    #[test]
    fn test_branch_rename_with_temp_repo() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_commit(dir.path());

        let head_ref = repo.head().unwrap();
        let commit = head_ref.peel_to_commit().unwrap();
        repo.branch("feature-old", &commit, false).unwrap();

        let result =
            git_command_with_timeout(&["branch", "-m", "feature-old", "feature-new"], dir.path())
                .unwrap();
        assert!(result.status.success());

        let branch = repo.find_branch("feature-new", git2::BranchType::Local);
        assert!(branch.is_ok());

        let old_branch = repo.find_branch("feature-old", git2::BranchType::Local);
        assert!(old_branch.is_err());
    }

    #[test]
    fn test_branch_rename_nonexistent_branch() {
        let dir = tempfile::tempdir().unwrap();
        create_repo_with_commit(dir.path());

        let result =
            git_command_with_timeout(&["branch", "-m", "nonexistent", "new-name"], dir.path())
                .unwrap();
        assert!(!result.status.success());
        let stderr = String::from_utf8_lossy(&result.stderr);
        assert!(!stderr.is_empty());
    }

    #[test]
    fn test_branch_rename_to_existing_name() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_commit(dir.path());

        let head_ref = repo.head().unwrap();
        let commit = head_ref.peel_to_commit().unwrap();
        repo.branch("branch-a", &commit, false).unwrap();
        repo.branch("branch-b", &commit, false).unwrap();

        let result =
            git_command_with_timeout(&["branch", "-m", "branch-a", "branch-b"], dir.path())
                .unwrap();
        assert!(!result.status.success());
    }

    #[test]
    fn test_git_clean_untracked_files() {
        let dir = tempfile::tempdir().unwrap();
        create_repo_with_commit(dir.path());

        std::fs::write(dir.path().join("untracked.txt"), "junk").unwrap();
        assert!(dir.path().join("untracked.txt").exists());

        let result = git_command_with_timeout(&["clean", "-f", "-d"], dir.path()).unwrap();
        assert!(result.status.success());
        assert!(!dir.path().join("untracked.txt").exists());
    }

    #[test]
    fn test_git_reset_soft_command() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_commit(dir.path());

        std::fs::write(dir.path().join("second.txt"), "data").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("second.txt")).unwrap();
        index.write().unwrap();
        let sig = git2::Signature::now("Test", "test@example.com").unwrap();
        let head_oid = repo.head().unwrap().target().unwrap();
        let parent = repo.find_commit(head_oid).unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Second commit", &tree, &[&parent])
            .unwrap();

        let first_sha = head_oid.to_string();
        let result =
            git_command_with_timeout(&["reset", "--soft", &first_sha], dir.path()).unwrap();
        assert!(result.status.success());

        let new_head = repo.head().unwrap().target().unwrap();
        assert_eq!(new_head, head_oid);
    }

    #[test]
    fn test_branch_list_after_create() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_commit(dir.path());

        let head_ref = repo.head().unwrap();
        let commit = head_ref.peel_to_commit().unwrap();
        repo.branch("test-branch", &commit, false).unwrap();

        let result = git_command_with_timeout(&["branch", "--list"], dir.path()).unwrap();
        assert!(result.status.success());
        let stdout = String::from_utf8_lossy(&result.stdout);
        assert!(stdout.contains("test-branch"));
    }

    #[test]
    fn test_branch_show_current() {
        let dir = tempfile::tempdir().unwrap();
        create_repo_with_commit(dir.path());

        let result = git_command_with_timeout(&["branch", "--show-current"], dir.path()).unwrap();
        assert!(result.status.success());
        let branch = String::from_utf8_lossy(&result.stdout);
        assert!(!branch.trim().is_empty());
    }
}
