//! Git submodule operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::{find_repo, get_repo_root};
use super::types::SubmoduleInfo;

// ============================================================================
// Submodule Commands
// ============================================================================

/// List all submodules in the repository
#[tauri::command]
pub async fn git_submodule_list(path: String) -> Result<Vec<SubmoduleInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let submodules = repo.submodules().map_err(|e| e.to_string())?;

        Ok(submodules
            .iter()
            .map(|sm| {
                let status = if sm.open().is_err() {
                    "uninitialized"
                } else if sm.head_id().is_none() {
                    "initialized"
                } else {
                    "modified"
                };

                SubmoduleInfo {
                    name: sm.name().unwrap_or("").to_string(),
                    path: sm.path().to_string_lossy().to_string(),
                    url: sm.url().unwrap_or("").to_string(),
                    branch: sm.branch().map(|s| s.to_string()),
                    head_id: sm.head_id().map(|id| id.to_string()),
                    status: status.to_string(),
                }
            })
            .collect())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Initialize a submodule
#[tauri::command]
pub async fn git_submodule_init(
    path: String,
    submodule_path: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = if let Some(sp) = submodule_path {
            git_command_with_timeout(&["submodule", "init", &sp], repo_root_path)?
        } else {
            git_command_with_timeout(&["submodule", "init"], repo_root_path)?
        };

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        info!("Initialized submodule");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Update submodules
#[tauri::command]
pub async fn git_submodule_update(path: String, init: bool, recursive: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["submodule", "update"];
        if init {
            args.push("--init");
        }
        if recursive {
            args.push("--recursive");
        }

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        info!(
            "Updated submodules (init: {}, recursive: {})",
            init, recursive
        );
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Add a new submodule
#[tauri::command]
pub async fn git_submodule_add(
    path: String,
    url: String,
    submodule_path: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = if let Some(ref sp) = submodule_path {
            git_command_with_timeout(&["submodule", "add", &url, sp], repo_root_path)?
        } else {
            git_command_with_timeout(&["submodule", "add", &url], repo_root_path)?
        };

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        info!("Added submodule: {} at {:?}", url, submodule_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Sync submodule URLs
#[tauri::command]
pub async fn git_submodule_sync(path: String, recursive: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["submodule", "sync"];
        if recursive {
            args.push("--recursive");
        }

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        info!("Synced submodule URLs (recursive: {})", recursive);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Deinitialize a submodule
#[tauri::command]
pub async fn git_submodule_deinit(
    path: String,
    submodule_path: String,
    force: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["submodule", "deinit"];
        if force {
            args.push("--force");
        }
        args.push(&submodule_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        info!("Deinitialized submodule: {}", submodule_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
