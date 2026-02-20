//! Git LFS (Large File Storage) operations.

use std::path::Path;
use tracing::{info, warn};

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;
use super::types::{
    LFSDirSummary, LFSFileEntry, LFSFileInfo, LFSLock, LFSStatus, LFSTrackPreviewFile,
};

// ============================================================================
// LFS Commands
// ============================================================================

/// Check Git LFS status for a repository
#[tauri::command]
pub async fn git_lfs_status(path: String) -> Result<LFSStatus, String> {
    tokio::task::spawn_blocking(move || git_lfs_status_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_lfs_status_sync(path: &str) -> Result<LFSStatus, String> {
    let repo_root = get_repo_root(path)?;
    let repo_root_path = Path::new(&repo_root);

    // Check if git-lfs is installed
    let version_output = git_command_with_timeout(&["lfs", "version"], repo_root_path);
    let (installed, version) = match version_output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str.lines().next().map(|s| s.trim().to_string());
            (true, version)
        }
        _ => (false, None),
    };

    if !installed {
        return Ok(LFSStatus {
            installed: false,
            initialized: false,
            version: None,
            tracked_patterns: Vec::new(),
            files_count: 0,
            files_size: 0,
            lfs_files: Vec::new(),
        });
    }

    // Check if LFS is initialized in this repo (look for .gitattributes with LFS patterns)
    let gitattributes_path = Path::new(&repo_root).join(".gitattributes");
    let initialized = gitattributes_path.exists() && {
        std::fs::read_to_string(&gitattributes_path)
            .map(|content| content.contains("filter=lfs"))
            .unwrap_or(false)
    };

    // Get tracked patterns
    let track_output = git_command_with_timeout(&["lfs", "track"], repo_root_path);
    let tracked_patterns = match track_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout
                .lines()
                .filter(|line| line.contains(" ("))
                .map(|line| {
                    // Format: "    *.psd (.gitattributes)"
                    line.trim().split(" (").next().unwrap_or("").to_string()
                })
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => Vec::new(),
    };

    // Get LFS files status
    let ls_files_output = git_command_with_timeout(&["lfs", "ls-files", "-l"], repo_root_path);
    let mut lfs_files = Vec::new();
    let mut files_size: u64 = 0;

    if let Ok(output) = ls_files_output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                // Format: "oid - path" or "oid * path" (* means downloaded)
                let parts: Vec<&str> = line.splitn(3, ['-', '*']).collect();
                if parts.len() >= 2 {
                    let oid = parts[0].trim();
                    let downloaded = line.contains(" * ");
                    let file_path = parts.last().unwrap_or(&"").trim();

                    // Try to get file size
                    let size = std::fs::metadata(Path::new(&repo_root).join(file_path))
                        .map(|m| m.len())
                        .unwrap_or(0);

                    files_size += size;

                    lfs_files.push(LFSFileEntry {
                        path: file_path.to_string(),
                        size,
                        oid: Some(oid.to_string()),
                        downloaded,
                    });
                }
            }
        }
    }

    Ok(LFSStatus {
        installed,
        initialized,
        version,
        tracked_patterns,
        files_count: lfs_files.len() as u32,
        files_size,
        lfs_files,
    })
}

/// Initialize Git LFS in a repository
#[tauri::command]
pub async fn git_lfs_init(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["lfs", "install", "--local"], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to initialize Git LFS: {}", stderr));
        }

        info!("Git LFS initialized in: {}", repo_root);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Track files matching a pattern with Git LFS
#[tauri::command]
pub async fn git_lfs_track(path: String, pattern: String, migrate: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // First, add the track pattern
        let output = git_command_with_timeout(&["lfs", "track", &pattern], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to track pattern '{}': {}", pattern, stderr));
        }

        // If migrate is requested, migrate existing files
        if migrate {
            let migrate_output = git_command_with_timeout(
                &["lfs", "migrate", "import", "--include", &pattern, "--yes"],
                repo_root_path,
            )?;

            if !migrate_output.status.success() {
                let stderr = String::from_utf8_lossy(&migrate_output.stderr);
                warn!("LFS migration warning: {}", stderr);
                // Don't fail completely, tracking was successful
            }
        }

        info!("Git LFS tracking pattern added: {}", pattern);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Stop tracking files matching a pattern
#[tauri::command]
pub async fn git_lfs_untrack(path: String, pattern: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["lfs", "untrack", &pattern], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Failed to untrack pattern '{}': {}",
                pattern, stderr
            ));
        }

        info!("Git LFS untracked pattern: {}", pattern);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Preview which files would be tracked by a pattern
#[tauri::command]
pub async fn git_lfs_track_preview(
    path: String,
    pattern: String,
) -> Result<Vec<LFSTrackPreviewFile>, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;

        // Use glob to find matching files
        let mut files = Vec::new();

        // Try to match the pattern using walkdir and glob-like matching
        let pattern_matcher =
            glob::Pattern::new(&pattern).map_err(|e| format!("Invalid pattern: {}", e))?;

        for entry in walkdir::WalkDir::new(&repo_root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let relative_path = entry
                .path()
                .strip_prefix(&repo_root)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .to_string()
                .replace('\\', "/");

            if pattern_matcher.matches(&relative_path)
                || relative_path.ends_with(pattern.trim_start_matches("*"))
            {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                files.push(LFSTrackPreviewFile {
                    path: relative_path,
                    size,
                    would_track: true,
                });
            }
        }

        Ok(files)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Fetch LFS files from remote
#[tauri::command]
pub async fn git_lfs_fetch(
    path: String,
    include: Option<String>,
    exclude: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["lfs", "fetch"];

        let include_owned;
        if let Some(ref inc) = include {
            args.push("--include");
            include_owned = inc.clone();
            args.push(&include_owned);
        }

        let exclude_owned;
        if let Some(ref exc) = exclude {
            args.push("--exclude");
            exclude_owned = exc.clone();
            args.push(&exclude_owned);
        }

        info!("Fetching LFS files");

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to fetch LFS files: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Pull LFS files (fetch + checkout)
#[tauri::command]
pub async fn git_lfs_pull(
    path: String,
    include: Option<String>,
    exclude: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["lfs", "pull"];

        let include_owned;
        if let Some(ref inc) = include {
            args.push("--include");
            include_owned = inc.clone();
            args.push(&include_owned);
        }

        let exclude_owned;
        if let Some(ref exc) = exclude {
            args.push("--exclude");
            exclude_owned = exc.clone();
            args.push(&exclude_owned);
        }

        info!("Pulling LFS files");

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to pull LFS files: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Push LFS files to remote
#[tauri::command]
pub async fn git_lfs_push(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        info!("Pushing LFS files");

        let output = git_command_with_timeout(&["lfs", "push", "--all", "origin"], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to push LFS files: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Prune old LFS files from local cache
#[tauri::command]
pub async fn git_lfs_prune(path: String, dry_run: bool) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["lfs", "prune"];

        if dry_run {
            args.push("--dry-run");
        }

        info!("Pruning LFS cache (dry_run: {})", dry_run);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to prune LFS cache: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let pruned: Vec<String> = stdout.lines().map(|s| s.to_string()).collect();

        Ok(pruned)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Lock an LFS file to prevent others from editing
#[tauri::command]
pub async fn git_lfs_lock(path: String, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["lfs", "lock", &file_path], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to lock file '{}': {}", file_path, stderr));
        }

        info!("Locked LFS file: {}", file_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Unlock an LFS file
#[tauri::command]
pub async fn git_lfs_unlock(path: String, file_path: String, force: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec!["lfs", "unlock"];

        if force {
            args.push("--force");
        }

        args.push(&file_path);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to unlock file '{}': {}", file_path, stderr));
        }

        info!("Unlocked LFS file: {}", file_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// List all LFS file locks
#[tauri::command]
pub async fn git_lfs_locks(path: String) -> Result<Vec<LFSLock>, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(&["lfs", "locks", "--json"], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to list LFS locks: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse JSON output
        let locks: Vec<LFSLock> = serde_json::from_str(&stdout).unwrap_or_else(|_| {
            // Fallback: parse non-JSON output
            stdout
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.len() >= 3 {
                        Some(LFSLock {
                            id: parts.first().unwrap_or(&"").to_string(),
                            path: parts.get(1).unwrap_or(&"").to_string(),
                            owner: parts.get(2).unwrap_or(&"").to_string(),
                            locked_at: parts.get(3).unwrap_or(&"").to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        });

        Ok(locks)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get detailed info about an LFS file
#[tauri::command]
pub async fn git_lfs_file_info(path: String, file_path: String) -> Result<LFSFileInfo, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let full_path = Path::new(&repo_root).join(&file_path);

        // Check if file is tracked by LFS
        let output =
            git_command_with_timeout(&["lfs", "ls-files", "-l", &file_path], repo_root_path)?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let is_lfs = !stdout.trim().is_empty();

        let (oid, downloaded) = if is_lfs {
            let parts: Vec<&str> = stdout.split_whitespace().collect();
            let oid = parts.first().map(|s| s.to_string());
            let downloaded = stdout.contains(" * ");
            (oid, downloaded)
        } else {
            (None, false)
        };

        let size = std::fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0);

        // Get pointer file size if it's an LFS file
        let pointer_size = if is_lfs && !downloaded {
            // Pointer files are typically ~130 bytes
            Some(size)
        } else {
            None
        };

        Ok(LFSFileInfo {
            path: file_path,
            is_lfs,
            size,
            oid,
            downloaded,
            pointer_size,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get summary of LFS usage in a directory
#[tauri::command]
pub async fn git_lfs_dir_summary(
    path: String,
    dir_path: Option<String>,
) -> Result<LFSDirSummary, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let target_dir = dir_path.unwrap_or_else(|| repo_root.clone());
        let target_path = Path::new(&target_dir);

        let mut total_files: u32 = 0;
        let mut lfs_files: u32 = 0;
        let mut total_size: u64 = 0;
        let mut lfs_size: u64 = 0;

        // Get LFS file list for comparison
        let lfs_output = git_command_with_timeout(&["lfs", "ls-files"], Path::new(&repo_root))?;
        let lfs_stdout = String::from_utf8_lossy(&lfs_output.stdout);
        let lfs_paths: std::collections::HashSet<String> = lfs_stdout
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(3, ['-', '*']).collect();
                parts.last().map(|p| p.trim().to_string())
            })
            .collect();

        // Walk the directory
        for entry in walkdir::WalkDir::new(target_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let relative_path = entry
                .path()
                .strip_prefix(&repo_root)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .to_string()
                .replace('\\', "/");

            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

            total_files += 1;
            total_size += size;

            if lfs_paths.contains(&relative_path) {
                lfs_files += 1;
                lfs_size += size;
            }
        }

        Ok(LFSDirSummary {
            total_files,
            lfs_files,
            total_size,
            lfs_size,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
