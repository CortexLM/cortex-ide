//! Git blame operations.

use serde::Serialize;
use std::path::Path;
use tracing::{debug, warn};

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;
use super::types::BlameHeatmapEntry;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct BlameEntry {
    pub hash: String,
    pub author: String,
    #[serde(rename = "authorEmail")]
    pub author_email: String,
    pub date: String,
    #[serde(rename = "lineStart")]
    pub line_start: u32,
    #[serde(rename = "lineEnd")]
    pub line_end: u32,
    pub content: String,
    pub message: String,
    pub timestamp: i64,
}

// ============================================================================
// Blame Commands
// ============================================================================

#[tauri::command]
pub async fn git_blame(path: String, file: String) -> Result<Vec<BlameEntry>, String> {
    debug!("git_blame: path={}, file={}", path, file);
    tokio::task::spawn_blocking(move || git_blame_sync(&path, &file))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_blame_line_range(
    path: String,
    file: String,
    start_line: u32,
    end_line: u32,
) -> Result<Vec<BlameEntry>, String> {
    debug!(
        "git_blame_line_range: path={}, file={}, lines={}-{}",
        path, file, start_line, end_line
    );
    tokio::task::spawn_blocking(move || git_blame_range_sync(&path, &file, start_line, end_line))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_blame_with_heatmap(
    path: String,
    file: String,
) -> Result<Vec<BlameHeatmapEntry>, String> {
    debug!("git_blame_with_heatmap: path={}, file={}", path, file);
    tokio::task::spawn_blocking(move || {
        let entries = git_blame_sync(&path, &file)?;

        if entries.is_empty() {
            return Ok(Vec::new());
        }

        let timestamps: Vec<i64> = entries
            .iter()
            .map(|e| e.timestamp)
            .filter(|&t| t > 0)
            .collect();
        let min_ts = timestamps.iter().copied().min().unwrap_or(0);
        let max_ts = timestamps.iter().copied().max().unwrap_or(0);
        let range = (max_ts - min_ts) as f64;

        let heatmap_entries: Vec<BlameHeatmapEntry> = entries
            .into_iter()
            .map(|entry| {
                let heat_score = if range > 0.0 && entry.timestamp > 0 {
                    ((entry.timestamp - min_ts) as f64 / range).clamp(0.0, 1.0)
                } else {
                    0.0
                };

                BlameHeatmapEntry {
                    hash: entry.hash,
                    author: entry.author,
                    author_email: entry.author_email,
                    date: entry.date,
                    line_start: entry.line_start,
                    line_end: entry.line_end,
                    content: entry.content,
                    message: entry.message,
                    timestamp: entry.timestamp,
                    heat_score,
                }
            })
            .collect();

        Ok(heatmap_entries)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Internal Implementation
// ============================================================================

fn git_blame_sync(path: &str, file: &str) -> Result<Vec<BlameEntry>, String> {
    let repo_root = get_repo_root(path)?;
    let repo_path = Path::new(&repo_root);

    let output = git_command_with_timeout(&["blame", "--porcelain", "--", file], repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git blame failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_porcelain_blame(&stdout)
}

fn git_blame_range_sync(
    path: &str,
    file: &str,
    start_line: u32,
    end_line: u32,
) -> Result<Vec<BlameEntry>, String> {
    let repo_root = get_repo_root(path)?;
    let repo_path = Path::new(&repo_root);

    let line_range = format!("-L{},{}", start_line, end_line);
    let output = git_command_with_timeout(
        &["blame", "--porcelain", &line_range, "--", file],
        repo_path,
    )?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git blame failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_porcelain_blame(&stdout)
}

/// Parse `git blame --porcelain` output into structured blame entries.
///
/// Porcelain format emits blocks like:
/// ```text
/// <40-char-sha> <orig-line> <final-line> [<num-lines>]
/// author <name>
/// author-mail <<email>>
/// author-time <timestamp>
/// author-tz <tz>
/// committer <name>
/// committer-mail <<email>>
/// committer-time <timestamp>
/// committer-tz <tz>
/// summary <message>
/// ...
/// \t<line-content>
/// ```
///
/// When a commit is repeated, only the first occurrence has the full header;
/// subsequent lines for the same commit only have the hash line and the
/// tab-prefixed content line.
fn parse_porcelain_blame(output: &str) -> Result<Vec<BlameEntry>, String> {
    use std::collections::HashMap;

    struct CommitInfo {
        author: String,
        author_email: String,
        timestamp: i64,
        summary: String,
    }

    let mut commits: HashMap<String, CommitInfo> = HashMap::new();
    let mut entries: Vec<BlameEntry> = Vec::new();

    let mut current_hash = String::new();
    let mut current_final_line: u32 = 0;
    let mut current_author = String::new();
    let mut current_email = String::new();
    let mut current_timestamp: i64 = 0;
    let mut current_summary = String::new();
    let mut in_header = false;

    for line in output.lines() {
        if let Some(line_content) = line.strip_prefix('\t') {
            // Content line — marks the end of a block

            let (author, email, timestamp, summary) = if let Some(info) = commits.get(&current_hash)
            {
                (
                    info.author.clone(),
                    info.author_email.clone(),
                    info.timestamp,
                    info.summary.clone(),
                )
            } else {
                // First time seeing this commit, store it
                let info = CommitInfo {
                    author: current_author.clone(),
                    author_email: current_email.clone(),
                    timestamp: current_timestamp,
                    summary: current_summary.clone(),
                };
                let result = (
                    info.author.clone(),
                    info.author_email.clone(),
                    info.timestamp,
                    info.summary.clone(),
                );
                commits.insert(current_hash.clone(), info);
                result
            };

            let date = format_timestamp(timestamp);

            entries.push(BlameEntry {
                hash: current_hash.clone(),
                author,
                author_email: email,
                date,
                line_start: current_final_line,
                line_end: current_final_line,
                content: line_content.to_string(),
                message: summary,
                timestamp,
            });

            in_header = false;
            continue;
        }

        // Check if this is a commit hash line (40 hex chars followed by line numbers)
        if !in_header
            && line.len() >= 40
            && line
                .as_bytes()
                .iter()
                .take(40)
                .all(|b| b.is_ascii_hexdigit())
        {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                current_hash = parts[0].to_string();
                current_final_line = parts[2].parse::<u32>().unwrap_or(1);
                in_header = true;

                // Reset header fields for new block
                current_author.clear();
                current_email.clear();
                current_timestamp = 0;
                current_summary.clear();
            }
            continue;
        }

        // Parse header fields
        if in_header {
            if let Some(value) = line.strip_prefix("author ") {
                current_author = value.to_string();
            } else if let Some(value) = line.strip_prefix("author-mail ") {
                current_email = value.trim_matches(|c| c == '<' || c == '>').to_string();
            } else if let Some(value) = line.strip_prefix("author-time ") {
                current_timestamp = value.parse::<i64>().unwrap_or(0);
            } else if let Some(value) = line.strip_prefix("summary ") {
                current_summary = value.to_string();
            }
        }
    }

    if entries.is_empty() && !output.trim().is_empty() {
        warn!("git blame produced output but no entries were parsed");
    }

    Ok(entries)
}

/// Format a Unix timestamp as an ISO 8601 date string.
fn format_timestamp(timestamp: i64) -> String {
    use std::time::{Duration, UNIX_EPOCH};

    if timestamp <= 0 {
        return String::new();
    }

    let duration = if timestamp >= 0 {
        Duration::from_secs(timestamp as u64)
    } else {
        return String::new();
    };

    let datetime = UNIX_EPOCH + duration;

    // Format as ISO 8601 using chrono-free approach
    match datetime.duration_since(UNIX_EPOCH) {
        Ok(d) => {
            let secs = d.as_secs();
            // Calculate date components
            let days = secs / 86400;
            let time_secs = secs % 86400;
            let hours = time_secs / 3600;
            let minutes = (time_secs % 3600) / 60;
            let seconds = time_secs % 60;

            // Days since epoch to date (simplified algorithm)
            let (year, month, day) = days_to_date(days);

            format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                year, month, day, hours, minutes, seconds
            )
        }
        Err(_) => String::new(),
    }
}

/// Convert days since Unix epoch to (year, month, day).
fn days_to_date(days: u64) -> (i64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };

    (year as i64, m, d)
}
