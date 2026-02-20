//! Git stash operations.

use std::path::Path;

use git2::StashApplyOptions;
use git2::StashFlags;
use git2::build::CheckoutBuilder;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::{find_repo, get_repo_root, parse_stash_branch};
use super::types::{GitStash, StashDiff, StashDiffFile, StashEntry, StashesResponse};

// ============================================================================
// Stash Commands
// ============================================================================

#[tauri::command]
pub async fn git_stashes(path: String) -> Result<StashesResponse, String> {
    tokio::task::spawn_blocking(move || git_stashes_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_stashes_sync(path: &str) -> Result<StashesResponse, String> {
    let repo = find_repo(path)?;
    let mut stashes = Vec::new();

    // Need mutable repo for stash_foreach
    let mut repo = repo;

    let _ = repo.stash_foreach(|index, message, _oid| {
        stashes.push(GitStash {
            index,
            message: message.to_string(),
            branch: None,
        });
        true
    });

    Ok(StashesResponse { stashes })
}

/// List all stashes in the repository
#[tauri::command]
pub async fn git_stash_list(path: String) -> Result<Vec<StashEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = find_repo(&path)?;

        // First pass: collect basic info (cannot access repo inside closure)
        let mut stash_info: Vec<(usize, String, git2::Oid)> = Vec::new();

        let _ = repo.stash_foreach(|index, message, oid| {
            stash_info.push((index, message.to_string(), *oid));
            true
        });

        // Second pass: enrich with date info
        let stashes = stash_info
            .into_iter()
            .map(|(index, message, oid)| {
                // Try to get the stash commit for date information
                let date = repo
                    .find_commit(oid)
                    .ok()
                    .map(|commit| {
                        let time = commit.time();
                        let secs = time.seconds();
                        // Format as ISO 8601
                        chrono::DateTime::from_timestamp(secs, 0)
                            .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
                            .unwrap_or_else(|| secs.to_string())
                    })
                    .unwrap_or_default();

                // Parse branch from stash message (format: "WIP on branch: message" or "On branch: message")
                let branch = parse_stash_branch(&message);

                StashEntry {
                    index: index as u32,
                    message,
                    date,
                    branch,
                }
            })
            .collect();

        Ok(stashes)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Create a new stash
#[tauri::command]
pub async fn git_stash_create(
    path: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = find_repo(&path)?;

        let signature = repo
            .signature()
            .map_err(|e| format!("Failed to get signature: {}", e))?;

        let mut flags = StashFlags::DEFAULT;
        if include_untracked {
            flags |= StashFlags::INCLUDE_UNTRACKED;
        }

        let stash_message = message.as_deref();

        repo.stash_save(&signature, stash_message.unwrap_or(""), Some(flags))
            .map_err(|e| format!("Failed to create stash: {}", e))?;

        info!("Created stash: {:?}", stash_message);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Apply a stash by index (keeps stash in list)
#[tauri::command]
pub async fn git_stash_apply(path: String, index: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = find_repo(&path)?;

        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.safe();

        let mut apply_opts = StashApplyOptions::new();
        apply_opts.checkout_options(checkout_opts);

        repo.stash_apply(index as usize, Some(&mut apply_opts))
            .map_err(|e| format!("Failed to apply stash: {}", e))?;

        info!("Applied stash@{{{}}}", index);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Pop a stash by index (applies and removes from list)
#[tauri::command]
pub async fn git_stash_pop(path: String, index: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = find_repo(&path)?;

        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.safe();

        let mut apply_opts = StashApplyOptions::new();
        apply_opts.checkout_options(checkout_opts);

        repo.stash_pop(index as usize, Some(&mut apply_opts))
            .map_err(|e| format!("Failed to pop stash: {}", e))?;

        info!("Popped stash@{{{}}}", index);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Drop/delete a stash by index
#[tauri::command]
pub async fn git_stash_drop(path: String, index: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = find_repo(&path)?;

        repo.stash_drop(index as usize)
            .map_err(|e| format!("Failed to drop stash: {}", e))?;

        info!("Dropped stash@{{{}}}", index);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Show the contents of a stash (git stash show -p)
#[tauri::command]
pub async fn git_stash_show(path: String, index: usize) -> Result<StashDiff, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let stash_ref = format!("stash@{{{}}}", index);

        // Get stash message
        let list_output = git_command_with_timeout(&["stash", "list"], repo_root_path)?;
        let list_stdout = String::from_utf8_lossy(&list_output.stdout);
        let message = list_stdout
            .lines()
            .nth(index)
            .map(|l| {
                // Parse "stash@{0}: WIP on branch: message" -> "WIP on branch: message"
                if let Some(colon_pos) = l.find(':') {
                    l[colon_pos + 1..].trim().to_string()
                } else {
                    l.to_string()
                }
            })
            .unwrap_or_else(|| format!("stash@{{{}}}", index));

        // Get the full diff
        let diff_output =
            git_command_with_timeout(&["stash", "show", "-p", &stash_ref], repo_root_path)?;

        if !diff_output.status.success() {
            let stderr = String::from_utf8_lossy(&diff_output.stderr);
            return Err(format!("Failed to show stash: {}", stderr));
        }

        let diff = String::from_utf8_lossy(&diff_output.stdout).to_string();

        // Get file stats
        let stat_output =
            git_command_with_timeout(&["stash", "show", "--numstat", &stash_ref], repo_root_path)?;

        let stat_stdout = String::from_utf8_lossy(&stat_output.stdout);
        let files: Vec<StashDiffFile> = stat_stdout
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let additions = parts[0].parse::<u32>().unwrap_or(0);
                    let deletions = parts[1].parse::<u32>().unwrap_or(0);
                    let file_path = parts[2].to_string();

                    let status = if additions > 0 && deletions > 0 {
                        "modified"
                    } else if additions > 0 {
                        "added"
                    } else {
                        "deleted"
                    };

                    Some(StashDiffFile {
                        path: file_path,
                        status: status.to_string(),
                        additions,
                        deletions,
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(StashDiff {
            index,
            message,
            diff,
            files,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
