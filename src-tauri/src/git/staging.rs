//! Git staging and commit operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::find_repo;

// ============================================================================
// Staging Commands
// ============================================================================

#[tauri::command]
pub async fn git_stage(path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        index
            .add_path(Path::new(&file_path))
            .map_err(|e| format!("Failed to stage file: {}", e))?;

        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;

        info!("Staged file: {}", file_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_unstage(path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_commit = head
            .peel_to_commit()
            .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

        repo.reset_default(Some(&head_commit.into_object()), [Path::new(&file_path)])
            .map_err(|e| format!("Failed to unstage file: {}", e))?;

        info!("Unstaged file: {}", file_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_stage_all(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| format!("Failed to stage all files: {}", e))?;

        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;

        info!("Staged all files");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_unstage_all(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_commit = head
            .peel_to_commit()
            .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

        repo.reset(&head_commit.into_object(), git2::ResetType::Mixed, None)
            .map_err(|e| format!("Failed to unstage all files: {}", e))?;

        info!("Unstaged all files");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Commit Commands
// ============================================================================

#[tauri::command]
pub async fn git_commit(
    path: String,
    message: String,
    sign: Option<bool>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        // If signing is requested, use git CLI for GPG support (libgit2 GPG support is limited)
        if sign.unwrap_or(false) {
            let workdir = repo
                .workdir()
                .ok_or("Repository has no working directory")?;

            let output = git_command_with_timeout(&["commit", "-S", "-m", &message], workdir)?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Failed to create signed commit: {}", stderr));
            }

            // Get the new commit hash
            let head = repo
                .head()
                .map_err(|e| format!("Failed to get HEAD after commit: {}", e))?;
            let commit = head
                .peel_to_commit()
                .map_err(|e| format!("Failed to get commit: {}", e))?;

            info!("Created signed commit: {}", commit.id());
            return Ok(commit.id().to_string());
        }

        // Regular commit without signing
        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("Failed to write tree: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("Failed to find tree: {}", e))?;

        let signature = repo
            .signature()
            .map_err(|e| format!("Failed to get signature: {}", e))?;

        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

        let parents: Vec<&git2::Commit> = parent.iter().collect();

        let oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                &message,
                &tree,
                &parents,
            )
            .map_err(|e| format!("Failed to commit: {}", e))?;

        info!("Created commit: {}", oid);
        Ok(oid.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Check if GPG signing is configured for the repository
#[tauri::command]
pub async fn git_is_gpg_configured(path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let workdir = repo
            .workdir()
            .ok_or("Repository has no working directory")?;

        // Check for user.signingkey in git config
        let output = git_command_with_timeout(&["config", "user.signingkey"], workdir)?;

        // GPG is configured if the command succeeds and returns a non-empty value
        Ok(output.status.success() && !output.stdout.is_empty())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_discard(path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.path(&file_path);
        checkout_opts.force();

        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Failed to discard changes: {}", e))?;

        info!("Discarded changes to: {}", file_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
