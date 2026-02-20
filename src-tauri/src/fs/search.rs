//! File Search - File name and content search operations
//!
//! This module provides file search capabilities including filename search
//! and content search with optional ripgrep integration.

use parking_lot::Mutex;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tracing::{info, warn};

use crate::fs::types::{ContentSearchResponse, FileEntry, IoSemaphore, SearchMatch, SearchResult};
use crate::fs::utils::{get_extension, should_ignore, should_skip_for_search, system_time_to_unix};

// ============================================================================
// File Name Search
// ============================================================================

#[tauri::command]
pub async fn fs_search_files(
    app: AppHandle,
    root_path: String,
    query: String,
    max_results: u32,
) -> Result<Vec<FileEntry>, String> {
    let root = PathBuf::from(&root_path);
    let query_lower = query.to_lowercase();
    let max = max_results as usize;
    let semaphore = app.state::<Arc<IoSemaphore>>();

    let results = Arc::new(Mutex::new(Vec::new()));
    search_files_parallel(
        root,
        query_lower,
        Arc::clone(&results),
        max,
        semaphore.get(),
    )
    .await?;

    let final_results = results.lock().clone();
    Ok(final_results)
}

fn search_files_parallel(
    dir: PathBuf,
    query: String,
    results: Arc<Mutex<Vec<FileEntry>>>,
    max: usize,
    semaphore: Arc<Semaphore>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send>> {
    Box::pin(async move {
        if results.lock().len() >= max {
            return Ok(());
        }

        let _permit = match semaphore.clone().try_acquire_owned() {
            Ok(p) => p,
            Err(_) => return Ok(()),
        };

        let dir_clone = dir.clone();
        let entries: Vec<(PathBuf, String, bool)> = tokio::task::spawn_blocking(move || {
            let mut entries = Vec::new();
            if let Ok(read_dir) = std::fs::read_dir(&dir_clone) {
                for entry in read_dir.flatten() {
                    let path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();

                    if name.starts_with('.') || should_ignore(&name) {
                        continue;
                    }

                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    entries.push((path, name, is_dir));
                }
            }
            entries
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;

        drop(_permit);

        let query_owned = query.clone();
        let matching: Vec<FileEntry> = entries
            .par_iter()
            .filter_map(|(path, name, is_dir)| {
                if name.to_lowercase().contains(&query_owned) {
                    let metadata = std::fs::metadata(path).ok();
                    Some(FileEntry {
                        name: name.clone(),
                        path: path.to_string_lossy().to_string(),
                        is_dir: *is_dir,
                        is_hidden: name.starts_with('.'),
                        is_symlink: std::fs::symlink_metadata(path)
                            .map(|m| m.file_type().is_symlink())
                            .unwrap_or(false),
                        size: metadata.as_ref().map(|m| m.len()),
                        modified_at: metadata
                            .and_then(|m| m.modified().ok())
                            .and_then(system_time_to_unix),
                        extension: get_extension(name),
                        children: None,
                    })
                } else {
                    None
                }
            })
            .collect();

        {
            let mut results_guard = results.lock();
            for entry in matching {
                if results_guard.len() >= max {
                    return Ok(());
                }
                results_guard.push(entry);
            }
        }

        let subdirs: Vec<PathBuf> = entries
            .into_iter()
            .filter(|(_, _, is_dir)| *is_dir)
            .map(|(path, _, _)| path)
            .collect();

        let mut join_set: JoinSet<Result<(), String>> = JoinSet::new();

        for subdir in subdirs {
            if results.lock().len() >= max {
                break;
            }

            let results_clone = Arc::clone(&results);
            let query_clone = query.clone();
            let sem_clone = Arc::clone(&semaphore);

            join_set.spawn(search_files_parallel(
                subdir,
                query_clone,
                results_clone,
                max,
                sem_clone,
            ));
        }

        while join_set.join_next().await.is_some() {}

        Ok(())
    })
}

// ============================================================================
// Content Search - Ripgrep Integration
// ============================================================================

/// Ripgrep JSON message types for parsing
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum RgMessage {
    #[serde(rename = "match")]
    Match { data: RgMatchData },
    #[serde(rename = "begin")]
    Begin { data: RgBeginData },
    #[serde(rename = "end")]
    End { data: RgEndData },
    #[serde(rename = "summary")]
    Summary { data: RgSummaryData },
    #[serde(rename = "context")]
    Context { data: RgContextData },
}

#[derive(Debug, Deserialize)]
struct RgMatchData {
    path: RgText,
    lines: RgText,
    line_number: u32,
    submatches: Vec<RgSubmatch>,
}

#[derive(Debug, Deserialize)]
struct RgBeginData {
    #[allow(dead_code)]
    path: RgText,
}

#[derive(Debug, Deserialize)]
struct RgEndData {
    #[allow(dead_code)]
    path: RgText,
    stats: Option<RgStats>,
}

#[derive(Debug, Deserialize)]
struct RgSummaryData {
    stats: RgStats,
}

#[derive(Debug, Deserialize)]
struct RgStats {
    #[allow(dead_code)]
    matched_lines: u64,
    searches: u64,
}

#[derive(Debug, Deserialize)]
struct RgContextData {
    path: RgText,
    lines: RgText,
    line_number: u32,
}

#[derive(Debug, Deserialize)]
struct RgText {
    text: String,
}

#[derive(Debug, Deserialize)]
struct RgSubmatch {
    #[serde(rename = "match")]
    match_text: RgText,
    start: u32,
    end: u32,
}

/// Try to execute ripgrep for content search. Returns None if ripgrep is not available
/// or if execution fails, allowing fallback to the regex-based implementation.
#[allow(clippy::too_many_arguments)]
fn try_ripgrep_search(
    path: &str,
    query: &str,
    case_sensitive: bool,
    use_regex: bool,
    whole_word: bool,
    include_patterns: &[String],
    exclude_patterns: &[String],
    max_results: usize,
) -> Option<ContentSearchResponse> {
    // Build the ripgrep command
    let mut cmd = crate::process_utils::command("rg");

    // JSON output for parsing
    cmd.arg("--json");
    cmd.arg("--line-number");

    // Case sensitivity
    if case_sensitive {
        cmd.arg("--case-sensitive");
    } else {
        cmd.arg("--ignore-case");
    }

    // Word matching
    if whole_word {
        cmd.arg("--word-regexp");
    }

    // Regex vs fixed string
    if use_regex {
        cmd.arg("--regexp");
    } else {
        cmd.arg("--fixed-strings");
    }
    cmd.arg(query);

    // Add include patterns (glob style)
    for pattern in include_patterns {
        if pattern.starts_with("*.") {
            // Convert *.ext to ripgrep glob
            cmd.arg("--glob").arg(pattern);
        } else if !pattern.is_empty() {
            cmd.arg("--glob").arg(format!("*{}*", pattern));
        }
    }

    // Add exclude patterns
    for pattern in exclude_patterns {
        if !pattern.is_empty() {
            cmd.arg("--glob").arg(format!("!**{}**", pattern));
            cmd.arg("--glob").arg(format!("!{}", pattern));
        }
    }

    // Skip binary files
    cmd.arg("--binary");
    cmd.arg("never");

    // Set max line length to avoid memory issues with minified files
    cmd.arg("--max-columns").arg("10000");

    // Don't follow symlinks for safety
    cmd.arg("--no-follow");

    // Search path
    cmd.arg(path);

    // Execute and capture output
    let output = match cmd.output() {
        Ok(output) => output,
        Err(e) => {
            // ripgrep not available or execution failed
            info!("ripgrep not available, falling back to regex search: {}", e);
            return None;
        }
    };

    // ripgrep returns exit code 1 when no matches found (which is fine)
    // Exit code 2+ indicates an error
    if !output.status.success() && output.status.code() != Some(1) {
        warn!("ripgrep returned error status: {:?}", output.status);
        return None;
    }

    // Parse JSON lines output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut file_matches: HashMap<String, Vec<SearchMatch>> = HashMap::new();
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    for line in stdout.lines() {
        if total_matches as usize >= max_results {
            break;
        }

        let msg: RgMessage = match serde_json::from_str(line) {
            Ok(m) => m,
            Err(_) => continue,
        };

        match msg {
            RgMessage::Match { data } => {
                let file_path = data.path.text.clone();
                let line_text = data.lines.text.trim_end_matches('\n').to_string();

                // Process each submatch
                for submatch in data.submatches {
                    if total_matches as usize >= max_results {
                        break;
                    }

                    let search_match = SearchMatch {
                        line: data.line_number,
                        column: submatch.start + 1,
                        text: line_text.clone(),
                        match_start: submatch.start,
                        match_end: submatch.end,
                    };

                    file_matches
                        .entry(file_path.clone())
                        .or_default()
                        .push(search_match);

                    total_matches += 1;
                }
            }
            RgMessage::End { data } => {
                if data.stats.is_some() {
                    files_searched += 1;
                }
            }
            RgMessage::Summary { data } => {
                files_searched = data.stats.searches as u32;
            }
            _ => {}
        }
    }

    // Convert HashMap to Vec<SearchResult>
    let results: Vec<SearchResult> = file_matches
        .into_iter()
        .map(|(file, matches)| SearchResult { file, matches })
        .collect();

    info!(
        "ripgrep search completed: {} matches in {} files",
        total_matches,
        results.len()
    );

    Some(ContentSearchResponse {
        results,
        total_matches,
        files_searched,
    })
}

// ============================================================================
// Content Search - Fallback Implementation
// ============================================================================

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn fs_search_content(
    path: String,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    multiline: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_results: Option<u32>,
) -> Result<ContentSearchResponse, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = regex.unwrap_or(false);
    let whole_word = whole_word.unwrap_or(false);
    let max = max_results.unwrap_or(1000) as usize;

    // Parse exclude patterns
    let exclude_patterns: Vec<String> = exclude
        .unwrap_or_else(|| "node_modules, .git, dist, build".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Parse include patterns (glob-style)
    let include_patterns: Vec<String> = include
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Try ripgrep first for better performance on large codebases
    if let Some(result) = try_ripgrep_search(
        &path,
        &query,
        case_sensitive,
        use_regex,
        whole_word,
        &include_patterns,
        &exclude_patterns,
        max,
    ) {
        return Ok(result);
    }

    // Fallback to Rust regex search if ripgrep is not available
    info!("Using fallback regex search");

    // Build regex pattern
    let search_pattern = if use_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };

    let search_pattern = if whole_word {
        format!(r"\b{}\b", search_pattern)
    } else {
        search_pattern
    };

    let use_multiline = multiline.unwrap_or(false);
    let re = regex::RegexBuilder::new(&search_pattern)
        .case_insensitive(!case_sensitive)
        .multi_line(use_multiline)
        .dot_matches_new_line(use_multiline)
        .build()
        .map_err(|e| format!("Invalid search pattern: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    // Recursive search function
    #[allow(clippy::too_many_arguments)]
    fn search_dir(
        dir: &std::path::Path,
        re: &regex::Regex,
        results: &mut Vec<SearchResult>,
        total_matches: &mut u32,
        files_searched: &mut u32,
        max: usize,
        exclude_patterns: &[String],
        include_patterns: &[String],
    ) -> Result<(), String> {
        let entries =
            std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries.flatten() {
            if *total_matches as usize >= max {
                break;
            }

            let path = entry.path();
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Skip hidden files and excluded patterns
            if name.starts_with('.') {
                continue;
            }

            if should_skip_for_search(&name) {
                continue;
            }

            // Check exclude patterns
            let path_str = path.to_string_lossy();
            if exclude_patterns.iter().any(|p| path_str.contains(p)) {
                continue;
            }

            if path.is_dir() {
                search_dir(
                    &path,
                    re,
                    results,
                    total_matches,
                    files_searched,
                    max,
                    exclude_patterns,
                    include_patterns,
                )?;
            } else if path.is_file() {
                // Check include patterns if specified
                if !include_patterns.is_empty() {
                    let matches_include = include_patterns.iter().any(|pattern| {
                        if let Some(ext) = pattern.strip_prefix("*.") {
                            name.ends_with(&format!(".{}", ext))
                        } else {
                            name.contains(pattern)
                        }
                    });
                    if !matches_include {
                        continue;
                    }
                }

                // Try to read file as text
                if let Ok(file) = File::open(&path) {
                    *files_searched += 1;
                    let reader = BufReader::new(file);
                    let mut file_matches = Vec::new();

                    for (line_num, line_result) in reader.lines().enumerate() {
                        if *total_matches as usize >= max {
                            break;
                        }

                        if let Ok(line) = line_result {
                            // Skip very long lines (likely minified/binary)
                            if line.len() > 10000 {
                                continue;
                            }

                            for mat in re.find_iter(&line) {
                                file_matches.push(SearchMatch {
                                    line: (line_num + 1) as u32,
                                    column: (mat.start() + 1) as u32,
                                    text: line.clone(),
                                    match_start: mat.start() as u32,
                                    match_end: mat.end() as u32,
                                });
                                *total_matches += 1;

                                if *total_matches as usize >= max {
                                    break;
                                }
                            }
                        }
                    }

                    if !file_matches.is_empty() {
                        results.push(SearchResult {
                            file: path.to_string_lossy().to_string(),
                            matches: file_matches,
                        });
                    }
                }
            }
        }

        Ok(())
    }

    search_dir(
        &root,
        &re,
        &mut results,
        &mut total_matches,
        &mut files_searched,
        max,
        &exclude_patterns,
        &include_patterns,
    )?;

    Ok(ContentSearchResponse {
        results,
        total_matches,
        files_searched,
    })
}

// ============================================================================
// Content Search - Streaming
// ============================================================================

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn fs_search_content_streaming(
    app: AppHandle,
    path: String,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    multiline: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_results: Option<u32>,
) -> Result<ContentSearchResponse, String> {
    let response = fs_search_content(
        path,
        query,
        case_sensitive,
        regex,
        whole_word,
        multiline,
        include,
        exclude,
        max_results,
    )
    .await?;

    for result in &response.results {
        let _ = app.emit("search:streaming-result", result);
    }

    info!(
        "Streaming search emitted {} file results",
        response.results.len()
    );

    Ok(response)
}

/// Search content across multiple workspace roots in a single call
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn fs_search_content_multiroot(
    paths: Vec<String>,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    multiline: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_results: Option<u32>,
) -> Result<ContentSearchResponse, String> {
    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = regex.unwrap_or(false);
    let whole_word = whole_word.unwrap_or(false);
    let _multiline = multiline.unwrap_or(false);
    let max = max_results.unwrap_or(1000) as usize;

    let exclude_patterns: Vec<String> = exclude
        .unwrap_or_else(|| "node_modules, .git, dist, build".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let include_patterns: Vec<String> = include
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let mut all_results: Vec<SearchResult> = Vec::new();
    let mut total_matches: u32 = 0;
    let mut total_files_searched: u32 = 0;

    for path in &paths {
        let root = PathBuf::from(path);
        if !root.exists() {
            continue;
        }

        let remaining = max.saturating_sub(total_matches as usize) as u32;
        if remaining == 0 {
            break;
        }

        // Try ripgrep first for each root
        if let Some(result) = try_ripgrep_search(
            path,
            &query,
            case_sensitive,
            use_regex,
            whole_word,
            &include_patterns,
            &exclude_patterns,
            remaining as usize,
        ) {
            total_matches += result.total_matches;
            total_files_searched += result.files_searched;
            all_results.extend(result.results);
            continue;
        }

        // Fallback to regex search
        let search_pattern = if use_regex {
            query.clone()
        } else {
            regex::escape(&query)
        };

        let search_pattern = if whole_word {
            format!(r"\b{}\b", search_pattern)
        } else {
            search_pattern
        };

        let re = regex::RegexBuilder::new(&search_pattern)
            .case_insensitive(!case_sensitive)
            .multi_line(_multiline)
            .dot_matches_new_line(_multiline)
            .build()
            .map_err(|e| format!("Invalid search pattern: {}", e))?;

        let mut path_results: Vec<SearchResult> = Vec::new();
        let mut path_matches: u32 = 0;
        let mut path_files: u32 = 0;

        #[allow(clippy::too_many_arguments)]
        fn search_dir_multiroot(
            dir: &std::path::Path,
            re: &regex::Regex,
            results: &mut Vec<SearchResult>,
            total_matches: &mut u32,
            files_searched: &mut u32,
            max: usize,
            exclude_patterns: &[String],
            include_patterns: &[String],
        ) -> Result<(), String> {
            let entries =
                std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

            for entry in entries.flatten() {
                if *total_matches as usize >= max {
                    break;
                }

                let path = entry.path();
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                if name.starts_with('.') {
                    continue;
                }

                if should_skip_for_search(&name) {
                    continue;
                }

                let path_str = path.to_string_lossy();
                if exclude_patterns.iter().any(|p| path_str.contains(p)) {
                    continue;
                }

                if path.is_dir() {
                    search_dir_multiroot(
                        &path,
                        re,
                        results,
                        total_matches,
                        files_searched,
                        max,
                        exclude_patterns,
                        include_patterns,
                    )?;
                } else if path.is_file() {
                    if !include_patterns.is_empty() {
                        let matches_include = include_patterns.iter().any(|pattern| {
                            if let Some(ext) = pattern.strip_prefix("*.") {
                                name.ends_with(&format!(".{}", ext))
                            } else {
                                name.contains(pattern)
                            }
                        });
                        if !matches_include {
                            continue;
                        }
                    }

                    if let Ok(file) = File::open(&path) {
                        *files_searched += 1;
                        let reader = BufReader::new(file);
                        let mut file_matches = Vec::new();

                        for (line_num, line_result) in reader.lines().enumerate() {
                            if *total_matches as usize >= max {
                                break;
                            }

                            if let Ok(line) = line_result {
                                if line.len() > 10000 {
                                    continue;
                                }

                                for mat in re.find_iter(&line) {
                                    file_matches.push(SearchMatch {
                                        line: (line_num + 1) as u32,
                                        column: (mat.start() + 1) as u32,
                                        text: line.clone(),
                                        match_start: mat.start() as u32,
                                        match_end: mat.end() as u32,
                                    });
                                    *total_matches += 1;

                                    if *total_matches as usize >= max {
                                        break;
                                    }
                                }
                            }
                        }

                        if !file_matches.is_empty() {
                            results.push(SearchResult {
                                file: path.to_string_lossy().to_string(),
                                matches: file_matches,
                            });
                        }
                    }
                }
            }

            Ok(())
        }

        search_dir_multiroot(
            &root,
            &re,
            &mut path_results,
            &mut path_matches,
            &mut path_files,
            remaining as usize,
            &exclude_patterns,
            &include_patterns,
        )?;

        total_matches += path_matches;
        total_files_searched += path_files;
        all_results.extend(path_results);
    }

    Ok(ContentSearchResponse {
        results: all_results,
        total_matches,
        files_searched: total_files_searched,
    })
}

// ============================================================================
// Workspace Ripgrep Search
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextLine {
    pub line_number: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchMatch {
    pub line: u32,
    pub column: u32,
    pub text: String,
    pub match_start: u32,
    pub match_end: u32,
    pub before_context: Vec<ContextLine>,
    pub after_context: Vec<ContextLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchFileResult {
    pub file: String,
    pub root: String,
    pub matches: Vec<WorkspaceSearchMatch>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResponse {
    pub results: Vec<WorkspaceSearchFileResult>,
    pub total_matches: u32,
    pub files_searched: u32,
    pub roots_searched: u32,
}

struct PendingMatch {
    line: u32,
    column: u32,
    text: String,
    match_start: u32,
    match_end: u32,
    before_context: Vec<ContextLine>,
}

#[allow(clippy::too_many_arguments)]
fn run_ripgrep_workspace(
    root: &str,
    query: &str,
    case_sensitive: bool,
    use_regex: bool,
    whole_word: bool,
    include_patterns: &[String],
    exclude_patterns: &[String],
    context_lines: u32,
    max_results: usize,
) -> Option<(Vec<WorkspaceSearchFileResult>, u32, u32)> {
    let mut cmd = crate::process_utils::command("rg");

    cmd.arg("--json");
    cmd.arg("--line-number");

    if context_lines > 0 {
        cmd.arg("--context").arg(context_lines.to_string());
    }

    if case_sensitive {
        cmd.arg("--case-sensitive");
    } else {
        cmd.arg("--ignore-case");
    }

    if whole_word {
        cmd.arg("--word-regexp");
    }

    if use_regex {
        cmd.arg("--regexp");
    } else {
        cmd.arg("--fixed-strings");
    }
    cmd.arg(query);

    for pattern in include_patterns {
        if pattern.starts_with("*.") {
            cmd.arg("--glob").arg(pattern);
        } else if !pattern.is_empty() {
            cmd.arg("--glob").arg(format!("*{}*", pattern));
        }
    }

    for pattern in exclude_patterns {
        if !pattern.is_empty() {
            cmd.arg("--glob").arg(format!("!**{}**", pattern));
            cmd.arg("--glob").arg(format!("!{}", pattern));
        }
    }

    cmd.arg("--binary").arg("never");
    cmd.arg("--max-columns").arg("10000");
    cmd.arg("--no-follow");
    cmd.arg(root);

    let output = match cmd.output() {
        Ok(output) => output,
        Err(e) => {
            info!("ripgrep not available for workspace search: {}", e);
            return None;
        }
    };

    if !output.status.success() && output.status.code() != Some(1) {
        warn!("ripgrep returned error status: {:?}", output.status);
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut file_results: HashMap<String, Vec<PendingMatch>> = HashMap::new();
    let mut pending_context: Vec<ContextLine> = Vec::new();
    let mut last_match_file: Option<String> = None;
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    for line in stdout.lines() {
        if total_matches as usize >= max_results {
            break;
        }

        let msg: RgMessage = match serde_json::from_str(line) {
            Ok(m) => m,
            Err(_) => continue,
        };

        match msg {
            RgMessage::Context { data } => {
                let ctx_line = ContextLine {
                    line_number: data.line_number,
                    text: data.lines.text.trim_end_matches('\n').to_string(),
                };
                let ctx_file = data.path.text;

                if last_match_file.as_deref() == Some(&ctx_file) {
                    if let Some(matches) = file_results.get_mut(&ctx_file) {
                        if let Some(last) = matches.last_mut() {
                            if data.line_number > last.line {
                                last.before_context.push(ctx_line);
                                continue;
                            }
                        }
                    }
                }
                pending_context.push(ctx_line);
            }
            RgMessage::Match { data } => {
                let file_path = data.path.text.clone();
                let line_text = data.lines.text.trim_end_matches('\n').to_string();

                if last_match_file.as_deref() != Some(&file_path) {
                    pending_context.clear();
                }

                for submatch in &data.submatches {
                    if total_matches as usize >= max_results {
                        break;
                    }

                    let before = if pending_context.is_empty() {
                        Vec::new()
                    } else {
                        std::mem::take(&mut pending_context)
                    };

                    let pm = PendingMatch {
                        line: data.line_number,
                        column: submatch.start + 1,
                        text: line_text.clone(),
                        match_start: submatch.start,
                        match_end: submatch.end,
                        before_context: before,
                    };

                    file_results.entry(file_path.clone()).or_default().push(pm);

                    total_matches += 1;
                }

                last_match_file = Some(file_path);
                pending_context.clear();
            }
            RgMessage::End { data } => {
                if data.stats.is_some() {
                    files_searched += 1;
                }
                last_match_file = None;
                pending_context.clear();
            }
            RgMessage::Summary { data } => {
                files_searched = data.stats.searches as u32;
            }
            _ => {}
        }
    }

    let root_str = root.to_string();
    let results: Vec<WorkspaceSearchFileResult> = file_results
        .into_iter()
        .map(|(file, pending_matches)| {
            let matches = pending_matches
                .into_iter()
                .map(|pm| {
                    let after_context = pm
                        .before_context
                        .iter()
                        .filter(|c| c.line_number > pm.line)
                        .cloned()
                        .collect::<Vec<_>>();
                    let before_context = pm
                        .before_context
                        .into_iter()
                        .filter(|c| c.line_number < pm.line)
                        .collect::<Vec<_>>();

                    WorkspaceSearchMatch {
                        line: pm.line,
                        column: pm.column,
                        text: pm.text,
                        match_start: pm.match_start,
                        match_end: pm.match_end,
                        before_context,
                        after_context,
                    }
                })
                .collect();

            WorkspaceSearchFileResult {
                file,
                root: root_str.clone(),
                matches,
            }
        })
        .collect();

    Some((results, total_matches, files_searched))
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn search_workspace_ripgrep(
    roots: Vec<String>,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    include_patterns: Option<Vec<String>>,
    exclude_patterns: Option<Vec<String>>,
    context_lines: Option<u32>,
    max_results: Option<u32>,
) -> Result<WorkspaceSearchResponse, String> {
    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = regex.unwrap_or(false);
    let whole_word = whole_word.unwrap_or(false);
    let ctx_lines = context_lines.unwrap_or(0);
    let max = max_results.unwrap_or(1000) as usize;

    let include = include_patterns.unwrap_or_default();
    let exclude = exclude_patterns.unwrap_or_else(|| {
        vec![
            "node_modules".to_string(),
            ".git".to_string(),
            "dist".to_string(),
            "build".to_string(),
        ]
    });

    let valid_roots: Vec<String> = roots
        .into_iter()
        .filter(|r| PathBuf::from(r).exists())
        .collect();

    let roots_searched = valid_roots.len() as u32;

    let result = tokio::task::spawn_blocking(move || {
        let mut all_results: Vec<WorkspaceSearchFileResult> = Vec::new();
        let mut total_matches: u32 = 0;
        let mut total_files_searched: u32 = 0;

        for root in &valid_roots {
            let remaining = max.saturating_sub(total_matches as usize);
            if remaining == 0 {
                break;
            }

            if let Some((results, matches, files)) = run_ripgrep_workspace(
                root,
                &query,
                case_sensitive,
                use_regex,
                whole_word,
                &include,
                &exclude,
                ctx_lines,
                remaining,
            ) {
                total_matches += matches;
                total_files_searched += files;
                all_results.extend(results);
            } else {
                info!(
                    "ripgrep unavailable for root {}, using fallback search",
                    root
                );
                if let Some(fallback) = try_ripgrep_search(
                    root,
                    &query,
                    case_sensitive,
                    use_regex,
                    whole_word,
                    &include,
                    &exclude,
                    remaining,
                ) {
                    total_matches += fallback.total_matches;
                    total_files_searched += fallback.files_searched;
                    for sr in fallback.results {
                        all_results.push(WorkspaceSearchFileResult {
                            file: sr.file,
                            root: root.clone(),
                            matches: sr
                                .matches
                                .into_iter()
                                .map(|m| WorkspaceSearchMatch {
                                    line: m.line,
                                    column: m.column,
                                    text: m.text,
                                    match_start: m.match_start,
                                    match_end: m.match_end,
                                    before_context: Vec::new(),
                                    after_context: Vec::new(),
                                })
                                .collect(),
                        });
                    }
                }
            }
        }

        (all_results, total_matches, total_files_searched)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    let (all_results, total_matches, total_files_searched) = result;

    info!(
        "workspace ripgrep search completed: {} matches in {} files across {} roots",
        total_matches, total_files_searched, roots_searched
    );

    Ok(WorkspaceSearchResponse {
        results: all_results,
        total_matches,
        files_searched: total_files_searched,
        roots_searched,
    })
}

// ============================================================================
// Replace in Files
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReplacement {
    pub file_path: String,
    pub search_text: String,
    pub replace_text: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub whole_word: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub file_path: String,
    pub original_lines: Vec<String>,
    pub modified_lines: Vec<String>,
    pub changes_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceInFilesResult {
    pub diffs: Vec<FileDiff>,
    pub total_replacements: u32,
    pub total_files: u32,
    pub is_dry_run: bool,
}

#[tauri::command]
pub async fn replace_in_files(
    replacements: Vec<FileReplacement>,
    dry_run: Option<bool>,
) -> Result<ReplaceInFilesResult, String> {
    let is_dry_run = dry_run.unwrap_or(true);

    let result = tokio::task::spawn_blocking(move || {
        let mut diffs: Vec<FileDiff> = Vec::new();
        let mut total_replacements: u32 = 0;

        for replacement in &replacements {
            let path = PathBuf::from(&replacement.file_path);
            if !path.is_file() {
                warn!("skipping non-existent file: {}", replacement.file_path);
                continue;
            }

            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(e) => {
                    warn!("failed to read file {}: {}", replacement.file_path, e);
                    continue;
                }
            };

            let pattern = if replacement.is_regex {
                replacement.search_text.clone()
            } else {
                regex::escape(&replacement.search_text)
            };

            let pattern = if replacement.whole_word {
                format!(r"\b{}\b", pattern)
            } else {
                pattern
            };

            let re = match regex::RegexBuilder::new(&pattern)
                .case_insensitive(!replacement.case_sensitive)
                .build()
            {
                Ok(r) => r,
                Err(e) => {
                    warn!(
                        "invalid search pattern for file {}: {}",
                        replacement.file_path, e
                    );
                    continue;
                }
            };

            let match_count = re.find_iter(&content).count() as u32;
            if match_count == 0 {
                continue;
            }

            let modified = re.replace_all(&content, replacement.replace_text.as_str());

            let original_lines: Vec<String> = content.lines().map(String::from).collect();
            let modified_lines: Vec<String> = modified.lines().map(String::from).collect();

            if !is_dry_run {
                let backup_path = format!("{}.bak", replacement.file_path);
                if let Err(e) = std::fs::copy(&path, &backup_path) {
                    warn!(
                        "failed to create backup for {}: {}",
                        replacement.file_path, e
                    );
                    continue;
                }

                if let Err(e) = std::fs::write(&path, modified.as_ref()) {
                    warn!(
                        "failed to write modified file {}: {}",
                        replacement.file_path, e
                    );
                    if let Err(restore_err) = std::fs::copy(&backup_path, &path) {
                        warn!(
                            "failed to restore backup for {}: {}",
                            replacement.file_path, restore_err
                        );
                    }
                    continue;
                }
            }

            total_replacements += match_count;
            diffs.push(FileDiff {
                file_path: replacement.file_path.clone(),
                original_lines,
                modified_lines,
                changes_count: match_count,
            });
        }

        let total_files = diffs.len() as u32;

        ReplaceInFilesResult {
            diffs,
            total_replacements,
            total_files,
            is_dry_run,
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    info!(
        "replace_in_files completed: {} replacements in {} files (dry_run={})",
        result.total_replacements, result.total_files, result.is_dry_run
    );

    Ok(result)
}
