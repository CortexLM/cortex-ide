//! Git bisect operations.

use std::path::Path;
use tracing::{error, info};

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;
use super::types::{BisectResult, BisectStatus};

// ============================================================================
// Bisect Helper Functions
// ============================================================================

/// Parse git bisect log output to extract good/bad commits
fn parse_bisect_log(output: &str) -> (Vec<String>, Vec<String>) {
    let mut good_commits = Vec::new();
    let mut bad_commits = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.starts_with("# good:") {
            // Format: "# good: [<commit>] <message>"
            if let Some(rest) = line.strip_prefix("# good:") {
                let rest = rest.trim();
                if rest.starts_with('[') {
                    if let Some(end) = rest.find(']') {
                        let commit = rest[1..end].to_string();
                        if !commit.is_empty() {
                            good_commits.push(commit);
                        }
                    }
                }
            }
        } else if line.starts_with("# bad:") {
            // Format: "# bad: [<commit>] <message>"
            if let Some(rest) = line.strip_prefix("# bad:") {
                let rest = rest.trim();
                if rest.starts_with('[') {
                    if let Some(end) = rest.find(']') {
                        let commit = rest[1..end].to_string();
                        if !commit.is_empty() {
                            bad_commits.push(commit);
                        }
                    }
                }
            }
        } else if line.starts_with("git bisect good ") {
            if let Some(commit) = line.strip_prefix("git bisect good ") {
                good_commits.push(commit.trim().to_string());
            }
        } else if line.starts_with("git bisect bad ") {
            if let Some(commit) = line.strip_prefix("git bisect bad ") {
                bad_commits.push(commit.trim().to_string());
            }
        }
    }

    (good_commits, bad_commits)
}

/// Estimate remaining bisect steps from git output
fn parse_remaining_steps(output: &str) -> u32 {
    // Look for pattern like "Bisecting: X revisions left to test after this (roughly Y steps)"
    for line in output.lines() {
        if line.contains("roughly") && line.contains("step") {
            // Extract the number before "steps"
            let parts: Vec<&str> = line.split_whitespace().collect();
            for (i, part) in parts.iter().enumerate() {
                if *part == "roughly" && i + 1 < parts.len() {
                    if let Ok(steps) = parts[i + 1].parse::<u32>() {
                        return steps;
                    }
                }
            }
        }
    }
    0
}

/// Check if bisect found the culprit from output
fn parse_culprit(output: &str) -> Option<String> {
    // Look for pattern indicating first bad commit found
    // "abc123... is the first bad commit"
    for line in output.lines() {
        if line.contains("is the first bad commit") {
            let words: Vec<&str> = line.split_whitespace().collect();
            if !words.is_empty() {
                let sha = words[0].trim_end_matches("...");
                if sha.len() >= 7 && sha.chars().all(|c| c.is_ascii_hexdigit()) {
                    return Some(sha.to_string());
                }
            }
        }
    }
    None
}

// ============================================================================
// Bisect Commands
// ============================================================================

#[tauri::command]
pub async fn git_bisect_status(path: String) -> Result<BisectStatus, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;

        // Check if bisect is in progress by checking for .git/BISECT_LOG
        let bisect_log_path = Path::new(&repo_root).join(".git").join("BISECT_LOG");
        let in_progress = bisect_log_path.exists();

        if !in_progress {
            return Ok(BisectStatus {
                in_progress: false,
                current_commit: None,
                good_commits: Vec::new(),
                bad_commits: Vec::new(),
                remaining_steps: 0,
            });
        }

        // Get current HEAD
        let repo_root_path = Path::new(&repo_root);
        let current_output = git_command_with_timeout(&["rev-parse", "HEAD"], repo_root_path);

        let current_commit = if let Ok(output) = current_output {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        } else {
            None
        };

        // Get bisect log to find good/bad commits
        let log_output = git_command_with_timeout(&["bisect", "log"], repo_root_path)?;

        let log_text = String::from_utf8_lossy(&log_output.stdout);
        let (good_commits, bad_commits) = parse_bisect_log(&log_text);

        // Try to get remaining steps by visualizing
        let viz_output =
            git_command_with_timeout(&["bisect", "visualize", "--oneline"], repo_root_path);

        let remaining_steps = if let Ok(output) = viz_output {
            if output.status.success() {
                let line_count = String::from_utf8_lossy(&output.stdout).lines().count();
                // Approximate steps as log2 of remaining commits
                if line_count > 0 {
                    ((line_count as f64).log2().ceil() as u32).max(1)
                } else {
                    0
                }
            } else {
                0
            }
        } else {
            0
        };

        Ok(BisectStatus {
            in_progress,
            current_commit,
            good_commits,
            bad_commits,
            remaining_steps,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_bisect_start(
    path: String,
    bad: String,
    good: String,
) -> Result<BisectResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        info!("Starting git bisect with bad={}, good={}", bad, good);

        // Start bisect with bad and good commits
        let output = git_command_with_timeout(&["bisect", "start", &bad, &good], repo_root_path)?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            error!("Git bisect start failed: {}", stderr);
            return Err(format!("Git bisect start failed: {}", stderr));
        }

        let combined = format!("{}\n{}", stdout, stderr);

        // Check if culprit was immediately found
        if let Some(culprit) = parse_culprit(&combined) {
            info!("Bisect immediately found culprit: {}", culprit);
            return Ok(BisectResult {
                current_commit: culprit.clone(),
                remaining_steps: 0,
                found_culprit: true,
                culprit_commit: Some(culprit),
            });
        }

        // Get current commit after bisect start
        let head_output = git_command_with_timeout(&["rev-parse", "HEAD"], repo_root_path)?;

        let current_commit = String::from_utf8_lossy(&head_output.stdout)
            .trim()
            .to_string();
        let remaining_steps = parse_remaining_steps(&combined);

        info!(
            "Bisect started, current commit: {}, remaining steps: ~{}",
            current_commit, remaining_steps
        );

        Ok(BisectResult {
            current_commit,
            remaining_steps,
            found_culprit: false,
            culprit_commit: None,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_bisect_mark(path: String, mark: String) -> Result<BisectResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Validate mark
        let mark_cmd = match mark.as_str() {
            "good" => "good",
            "bad" => "bad",
            "skip" => "skip",
            _ => {
                return Err(format!(
                    "Invalid mark: {}. Must be 'good', 'bad', or 'skip'",
                    mark
                ));
            }
        };

        info!("Marking current commit as {}", mark_cmd);

        let output = git_command_with_timeout(&["bisect", mark_cmd], repo_root_path)?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            error!("Git bisect {} failed: {}", mark_cmd, stderr);
            return Err(format!("Git bisect {} failed: {}", mark_cmd, stderr));
        }

        let combined = format!("{}\n{}", stdout, stderr);

        // Check if culprit was found
        if let Some(culprit) = parse_culprit(&combined) {
            info!("Bisect found culprit: {}", culprit);
            return Ok(BisectResult {
                current_commit: culprit.clone(),
                remaining_steps: 0,
                found_culprit: true,
                culprit_commit: Some(culprit),
            });
        }

        // Get current commit after mark
        let head_output = git_command_with_timeout(&["rev-parse", "HEAD"], repo_root_path)?;

        let current_commit = String::from_utf8_lossy(&head_output.stdout)
            .trim()
            .to_string();
        let remaining_steps = parse_remaining_steps(&combined);

        info!(
            "Bisect marked, moved to commit: {}, remaining steps: ~{}",
            current_commit, remaining_steps
        );

        Ok(BisectResult {
            current_commit,
            remaining_steps,
            found_culprit: false,
            culprit_commit: None,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_bisect_reset(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        info!("Resetting git bisect");

        let output = git_command_with_timeout(&["bisect", "reset"], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Git bisect reset failed: {}", stderr);
            return Err(format!("Git bisect reset failed: {}", stderr));
        }

        info!("Bisect reset complete");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
