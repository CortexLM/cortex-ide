//! Git rebase operations.

use git2::{Oid, RepositoryState, StatusOptions};
use std::path::Path;
use tracing::{error, info};

use super::command::{git_command_with_timeout, git_command_with_timeout_env};
use super::helpers::find_repo;
use super::types::{RebaseAction, RebaseCommit, RebaseStatus, RebaseTodoEntry};

// ============================================================================
// Rebase Commands
// ============================================================================

/// Get commits that would be rebased when rebasing onto a target
#[tauri::command]
pub async fn git_rebase_commits(path: String, onto: String) -> Result<Vec<RebaseCommit>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        // Parse the 'onto' reference - could be HEAD~N, branch name, or commit hash
        let onto_oid = if onto.starts_with("HEAD~") {
            // Parse HEAD~N syntax
            let n: usize = onto
                .trim_start_matches("HEAD~")
                .parse()
                .map_err(|_| format!("Invalid HEAD~N syntax: {}", onto))?;

            let head = repo
                .head()
                .map_err(|e| format!("Failed to get HEAD: {}", e))?;
            let head_commit = head
                .peel_to_commit()
                .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

            // Walk back N commits
            let mut current = head_commit;
            for _ in 0..n {
                if current.parent_count() == 0 {
                    return Err(format!("Cannot go back {} commits, not enough history", n));
                }
                current = current
                    .parent(0)
                    .map_err(|e| format!("Failed to get parent commit: {}", e))?;
            }
            current.id()
        } else {
            // Try as branch name first, then as commit hash
            repo.revparse_single(&onto)
                .map_err(|e| format!("Failed to resolve '{}': {}", onto, e))?
                .id()
        };

        // Get HEAD commit
        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_oid = head
            .target()
            .ok_or_else(|| "HEAD has no target".to_string())?;

        // Get commits between onto and HEAD
        let mut revwalk = repo
            .revwalk()
            .map_err(|e| format!("Failed to create revwalk: {}", e))?;

        revwalk
            .push(head_oid)
            .map_err(|e| format!("Failed to push HEAD to revwalk: {}", e))?;
        revwalk
            .hide(onto_oid)
            .map_err(|e| format!("Failed to hide onto commit: {}", e))?;

        let mut commits = Vec::new();

        for oid_result in revwalk {
            let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| format!("Failed to find commit: {}", e))?;

            let hash = oid.to_string();
            let short_hash = hash[..7.min(hash.len())].to_string();
            let message = commit.message().unwrap_or("").to_string();
            let author = commit.author();
            let date = chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default();

            commits.push(RebaseCommit {
                hash,
                short_hash,
                message,
                author: author.name().unwrap_or("").to_string(),
                date,
            });
        }

        // Reverse to get chronological order (oldest first)
        commits.reverse();

        Ok(commits)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Check if a rebase is currently in progress and get its status
#[tauri::command]
pub async fn git_rebase_status(path: String) -> Result<RebaseStatus, String> {
    tokio::task::spawn_blocking(move || git_rebase_status_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

pub fn git_rebase_status_sync(path: &str) -> Result<RebaseStatus, String> {
    let repo = find_repo(path)?;

    let state = repo.state();
    let in_progress = matches!(
        state,
        RepositoryState::Rebase | RepositoryState::RebaseInteractive | RepositoryState::RebaseMerge
    );

    if !in_progress {
        return Ok(RebaseStatus {
            in_progress: false,
            current_commit: None,
            remaining: 0,
            total: 0,
            has_conflicts: false,
            conflict_files: Vec::new(),
            paused_commit: None,
        });
    }

    // Check for conflicts
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(false);
    let statuses = repo
        .statuses(Some(&mut status_opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let mut conflict_files = Vec::new();
    let mut has_conflicts = false;

    for entry in statuses.iter() {
        if entry.status().is_conflicted() {
            has_conflicts = true;
            if let Some(file_path) = entry.path() {
                conflict_files.push(file_path.to_string());
            }
        }
    }

    // Try to get rebase progress from git directory
    let git_dir = repo.path();
    let rebase_merge_dir = git_dir.join("rebase-merge");
    let rebase_apply_dir = git_dir.join("rebase-apply");

    let (remaining, total, current_commit) = if rebase_merge_dir.exists() {
        // Interactive rebase
        let msgnum = std::fs::read_to_string(rebase_merge_dir.join("msgnum"))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0);
        let end = std::fs::read_to_string(rebase_merge_dir.join("end"))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0);
        let stopped_sha = std::fs::read_to_string(rebase_merge_dir.join("stopped-sha"))
            .ok()
            .map(|s| s.trim().to_string());

        (end.saturating_sub(msgnum), end, stopped_sha)
    } else if rebase_apply_dir.exists() {
        // Regular rebase
        let next = std::fs::read_to_string(rebase_apply_dir.join("next"))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0);
        let last = std::fs::read_to_string(rebase_apply_dir.join("last"))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0);

        (last.saturating_sub(next) + 1, last, None)
    } else {
        (0, 0, None)
    };

    // Get paused commit info if we have a stopped sha
    let paused_commit = if let Some(ref sha) = current_commit {
        Oid::from_str(sha)
            .ok()
            .and_then(|oid| repo.find_commit(oid).ok())
            .map(|commit| {
                let hash = commit.id().to_string();
                let short_hash = hash[..7.min(hash.len())].to_string();
                let date = chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default();

                RebaseCommit {
                    hash,
                    short_hash,
                    message: commit.message().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("").to_string(),
                    date,
                }
            })
    } else {
        None
    };

    Ok(RebaseStatus {
        in_progress,
        current_commit,
        remaining,
        total,
        has_conflicts,
        conflict_files,
        paused_commit,
    })
}

/// Start an interactive rebase with the given actions
/// Uses git CLI as git2 doesn't fully support interactive rebase
#[tauri::command]
pub async fn git_rebase_start(
    path: String,
    onto: String,
    commits: Vec<RebaseAction>,
) -> Result<RebaseStatus, String> {
    tokio::task::spawn_blocking(move || {
        // Validate that all actions are valid
        for action in &commits {
            match action.action.as_str() {
                "pick" | "reword" | "edit" | "squash" | "fixup" | "drop" => {}
                other => return Err(format!("Invalid rebase action: {}", other)),
            }
        }

        // Create a temporary todo file for the rebase
        let repo = find_repo(&path)?;
        let git_dir = repo.path();

        // Build the todo list content
        let mut todo_content = String::new();
        for action in &commits {
            // Get short hash from the commit
            let short_hash = if action.hash.len() > 7 {
                &action.hash[..7]
            } else {
                &action.hash
            };

            // Get commit message for the todo file
            let commit_message = Oid::from_str(&action.hash)
                .ok()
                .and_then(|oid| repo.find_commit(oid).ok())
                .and_then(|c| {
                    c.message()
                        .map(|m| m.lines().next().unwrap_or("").to_string())
                })
                .unwrap_or_default();

            todo_content.push_str(&format!(
                "{} {} {}\n",
                action.action, short_hash, commit_message
            ));
        }

        // Write the todo file to a temp location
        let todo_path = git_dir.join("rebase-todo-temp");
        std::fs::write(&todo_path, &todo_content)
            .map_err(|e| format!("Failed to write rebase todo file: {}", e))?;

        // Use git CLI for interactive rebase with our custom todo
        // Set GIT_SEQUENCE_EDITOR to cat our todo file
        let todo_path_str = todo_path.to_string_lossy().to_string();

        #[cfg(target_os = "windows")]
        let editor_cmd = format!("cmd /c type \"{}\" &&", todo_path_str);
        #[cfg(not(target_os = "windows"))]
        let editor_cmd = format!("cat \"{}\" #", todo_path_str);

        let output = git_command_with_timeout_env(
            &["rebase", "-i", &onto],
            Path::new(&path),
            &[("GIT_SEQUENCE_EDITOR", &editor_cmd)],
        )?;

        // Clean up temp file
        let _ = std::fs::remove_file(&todo_path);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Check if it's a conflict (which is expected in some cases)
            if !stderr.contains("CONFLICT") && !stderr.contains("Stopped") {
                error!("Git rebase failed: {}", stderr);
                return Err(format!("Rebase failed: {}", stderr));
            }
        }

        info!("Started interactive rebase onto {}", onto);

        // Return current status
        git_rebase_status_sync(&path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Continue an in-progress rebase after resolving conflicts
#[tauri::command]
pub async fn git_rebase_continue(path: String) -> Result<RebaseStatus, String> {
    tokio::task::spawn_blocking(move || {
        // Use git CLI for continue with timeout
        let output = git_command_with_timeout_env(
            &["rebase", "--continue"],
            Path::new(&path),
            &[("GIT_EDITOR", "true")], // Auto-accept default messages
        )?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Check if it's a new conflict
            if stderr.contains("CONFLICT") {
                info!("Rebase continue hit a conflict");
            } else if stderr.contains("No changes") {
                // No changes, need to skip
                info!("No changes to commit, may need to skip");
            } else {
                error!("Git rebase --continue failed: {}", stderr);
                return Err(format!("Rebase continue failed: {}", stderr));
            }
        } else {
            info!("Rebase continued successfully");
        }

        // Return current status
        git_rebase_status_sync(&path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Skip the current commit during a rebase
#[tauri::command]
pub async fn git_rebase_skip(path: String) -> Result<RebaseStatus, String> {
    tokio::task::spawn_blocking(move || {
        let output = git_command_with_timeout(&["rebase", "--skip"], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("CONFLICT") {
                info!("Rebase skip hit another conflict");
            } else if !stderr.is_empty() {
                error!("Git rebase --skip failed: {}", stderr);
                return Err(format!("Rebase skip failed: {}", stderr));
            }
        } else {
            info!("Skipped current commit in rebase");
        }

        // Return current status
        git_rebase_status_sync(&path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Abort an in-progress rebase
#[tauri::command]
pub async fn git_rebase_abort(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        info!("Aborting rebase");
        let output = git_command_with_timeout(&["rebase", "--abort"], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to abort rebase: {}", stderr));
        }

        info!("Rebase aborted successfully");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get the current interactive rebase todo list.
///
/// Reads from `.git/rebase-merge/git-rebase-todo` and parses each entry
/// into a structured `RebaseTodoEntry`.
#[tauri::command]
pub async fn git_rebase_todo(path: String) -> Result<Vec<RebaseTodoEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let git_dir = repo.path();

        let todo_path = git_dir.join("rebase-merge").join("git-rebase-todo");
        if !todo_path.exists() {
            let todo_apply = git_dir.join("rebase-apply").join("todo");
            if !todo_apply.exists() {
                return Ok(Vec::new());
            }
            return parse_rebase_todo(&todo_apply);
        }

        parse_rebase_todo(&todo_path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

fn parse_rebase_todo(todo_path: &std::path::Path) -> Result<Vec<RebaseTodoEntry>, String> {
    let content = std::fs::read_to_string(todo_path)
        .map_err(|e| format!("Failed to read rebase todo file: {}", e))?;

    let mut entries = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = trimmed.splitn(3, ' ').collect();
        if parts.len() < 2 {
            continue;
        }

        let action = parts[0].to_string();
        let hash = parts[1].to_string();
        let short_hash = if hash.len() > 7 {
            hash[..7].to_string()
        } else {
            hash.clone()
        };
        let message = if parts.len() >= 3 {
            parts[2].to_string()
        } else {
            String::new()
        };

        entries.push(RebaseTodoEntry {
            action,
            hash,
            short_hash,
            message,
        });
    }

    Ok(entries)
}
