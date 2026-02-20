//! Git clone operations with progress tracking.

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::Emitter;
use tracing::info;

use super::types::CloneProgress;
use crate::process_utils;

// ============================================================================
// Clone Commands
// ============================================================================

/// Clone a git repository with progress events
#[tauri::command]
pub async fn git_clone(
    url: String,
    target_dir: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    git_clone_internal(url, target_dir, false, app).await
}

/// Clone a git repository with submodules recursively
#[tauri::command]
pub async fn git_clone_recursive(
    url: String,
    target_dir: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    git_clone_internal(url, target_dir, true, app).await
}

/// Internal clone implementation with progress tracking
async fn git_clone_internal(
    url: String,
    target_dir: String,
    recursive: bool,
    app: tauri::AppHandle,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let target_path = Path::new(&target_dir);

        // Create parent directory if it doesn't exist
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        // Build clone command with progress
        let mut args = vec!["clone", "--progress"];
        if recursive {
            args.push("--recurse-submodules");
        }
        args.push(&url);
        args.push(&target_dir);

        info!(
            "Cloning repository from {} to {} (recursive: {})",
            url, target_dir, recursive
        );

        // Emit initial progress
        let _ = app.emit(
            "git:clone-progress",
            CloneProgress {
                stage: "starting".to_string(),
                current: 0,
                total: 0,
                bytes_received: None,
                message: Some(format!("Cloning {}", url)),
            },
        );

        // Spawn git clone process
        let mut child = process_utils::command("git")
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn git clone: {}", e))?;

        // Git outputs progress to stderr
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to capture stderr".to_string())?;

        let reader = BufReader::new(stderr);
        let app_clone = app.clone();

        // Process stderr for progress in a separate thread
        let progress_handle = std::thread::spawn(move || {
            for line in reader.lines().map_while(Result::ok) {
                // Parse git progress output
                let progress = parse_git_progress(&line);
                let _ = app_clone.emit("git:clone-progress", progress);
            }
        });

        // Wait for the process to complete with timeout (10 minutes for clone)
        let clone_timeout = Duration::from_secs(600);
        let start = Instant::now();

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    // Wait for progress thread to finish
                    let _ = progress_handle.join();

                    if status.success() {
                        // Emit completion
                        let _ = app.emit(
                            "git:clone-progress",
                            CloneProgress {
                                stage: "complete".to_string(),
                                current: 100,
                                total: 100,
                                bytes_received: None,
                                message: Some("Clone completed successfully".to_string()),
                            },
                        );

                        info!("Clone completed successfully: {}", target_dir);
                        return Ok(target_dir);
                    } else {
                        // Emit error
                        let _ = app.emit(
                            "git:clone-progress",
                            CloneProgress {
                                stage: "error".to_string(),
                                current: 0,
                                total: 0,
                                bytes_received: None,
                                message: Some("Clone failed".to_string()),
                            },
                        );
                        return Err("Git clone failed".to_string());
                    }
                }
                Ok(None) => {
                    if start.elapsed() > clone_timeout {
                        let _ = child.kill();
                        return Err("Git clone timed out after 10 minutes".to_string());
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(e) => {
                    return Err(format!("Error waiting for git clone: {}", e));
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Parse git progress output into CloneProgress struct
fn parse_git_progress(line: &str) -> CloneProgress {
    let line = line.trim();

    // Parse patterns like:
    // "Receiving objects:  75% (3/4), 1.50 KiB | 1.50 MiB/s"
    // "Resolving deltas: 100% (5/5), done."
    // "Checking out files: 100% (10/10)"

    let (stage, progress) =
        if line.contains("Counting objects") || line.contains("Enumerating objects") {
            ("counting", extract_progress(line))
        } else if line.contains("Compressing objects") {
            ("compressing", extract_progress(line))
        } else if line.contains("Receiving objects") {
            ("receiving", extract_progress(line))
        } else if line.contains("Resolving deltas") {
            ("resolving", extract_progress(line))
        } else if line.contains("Checking out files") {
            ("checking_out", extract_progress(line))
        } else if line.contains("Cloning into") {
            ("starting", (0, 0))
        } else if line.contains("Updating files") {
            ("updating", extract_progress(line))
        } else {
            ("unknown", (0, 0))
        };

    // Extract bytes if present (e.g., "1.50 KiB")
    let bytes_received = extract_bytes(line);

    CloneProgress {
        stage: stage.to_string(),
        current: progress.0,
        total: progress.1,
        bytes_received,
        message: Some(line.to_string()),
    }
}

/// Extract progress numbers from a line like "75% (3/4)"
fn extract_progress(line: &str) -> (u32, u32) {
    // Try to find pattern like "(3/4)" or "75%"
    if let Some(paren_start) = line.find('(') {
        if let Some(paren_end) = line.find(')') {
            let inner = &line[paren_start + 1..paren_end];
            if let Some(slash_pos) = inner.find('/') {
                let current = inner[..slash_pos].trim().parse::<u32>().unwrap_or(0);
                let total = inner[slash_pos + 1..].trim().parse::<u32>().unwrap_or(0);
                return (current, total);
            }
        }
    }

    // Try percentage
    if let Some(pct_pos) = line.find('%') {
        let before_pct = &line[..pct_pos];
        if let Some(last_space) = before_pct.rfind(|c: char| !c.is_ascii_digit()) {
            let pct_str = &before_pct[last_space + 1..];
            if let Ok(pct) = pct_str.parse::<u32>() {
                return (pct, 100);
            }
        }
    }

    (0, 0)
}

/// Extract bytes from progress line
fn extract_bytes(line: &str) -> Option<u64> {
    // Look for patterns like "1.50 KiB", "10 MiB", etc.
    let re_patterns = [
        (r"(\d+(?:\.\d+)?)\s*KiB", 1024u64),
        (r"(\d+(?:\.\d+)?)\s*MiB", 1024 * 1024),
        (r"(\d+(?:\.\d+)?)\s*GiB", 1024 * 1024 * 1024),
        (r"(\d+(?:\.\d+)?)\s*bytes", 1),
    ];

    for (pattern, multiplier) in re_patterns.iter() {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(line) {
                if let Some(num_str) = caps.get(1) {
                    if let Ok(num) = num_str.as_str().parse::<f64>() {
                        return Some((num * (*multiplier as f64)) as u64);
                    }
                }
            }
        }
    }

    None
}
