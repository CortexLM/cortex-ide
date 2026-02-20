//! Search and replace functionality for Cortex Desktop
//!
//! This module provides backend support for project-wide search and replace operations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

/// A single search match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub id: String,
    pub line: u32,
    pub column: u32,
    pub length: u32,
    pub line_text: String,
    pub preview: String,
}

/// Search result for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub uri: String,
    pub matches: Vec<SearchMatch>,
    #[serde(rename = "totalMatches")]
    pub total_matches: u32,
}

/// Replace all matches across multiple files
#[command]
pub async fn search_replace_all(
    results: Vec<SearchResult>,
    replace_text: String,
    use_regex: bool,
    preserve_case: bool,
) -> Result<u32, String> {
    tokio::task::spawn_blocking(move || {
        let mut total_replaced = 0;

        for result in results {
            let path = result.uri.strip_prefix("file://").unwrap_or(&result.uri);

            match replace_in_file_internal(
                path,
                &result.matches,
                &replace_text,
                use_regex,
                preserve_case,
            ) {
                Ok(count) => {
                    total_replaced += count;
                    info!("[Search] Replaced {} matches in {}", count, path);
                }
                Err(e) => {
                    warn!("[Search] Failed to replace in {}: {}", path, e);
                    return Err(format!("Failed to replace in {}: {}", path, e));
                }
            }
        }

        Ok(total_replaced)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Replace all matches in a single file
#[command]
pub async fn search_replace_in_file(
    uri: String,
    matches: Vec<SearchMatch>,
    replace_text: String,
    use_regex: bool,
    preserve_case: bool,
) -> Result<u32, String> {
    tokio::task::spawn_blocking(move || {
        let path = uri.strip_prefix("file://").unwrap_or(&uri);
        replace_in_file_internal(path, &matches, &replace_text, use_regex, preserve_case)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Request structure for replacing a single match
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceMatchRequest {
    pub uri: String,
    /// The match to replace (renamed from 'match' which is a Rust keyword)
    #[serde(rename = "match")]
    pub match_info: SearchMatch,
    pub replace_text: String,
    #[serde(default)]
    pub use_regex: bool,
    #[serde(default)]
    pub preserve_case: bool,
}

/// Replace a single match
#[command]
pub async fn search_replace_match(request: ReplaceMatchRequest) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = request.uri.strip_prefix("file://").unwrap_or(&request.uri);
        let matches = vec![request.match_info];
        replace_in_file_internal(
            path,
            &matches,
            &request.replace_text,
            request.use_regex,
            request.preserve_case,
        )?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Internal function to perform replacements in a file
fn replace_in_file_internal(
    path: &str,
    matches: &[SearchMatch],
    replace_text: &str,
    _use_regex: bool,
    preserve_case: bool,
) -> Result<u32, String> {
    let file_path = PathBuf::from(path);
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let mut new_lines: Vec<String> = lines.iter().map(|s| s.to_string()).collect();

    // Group matches by line (in reverse order to handle offsets correctly)
    let mut matches_by_line: HashMap<u32, Vec<&SearchMatch>> = HashMap::new();
    for m in matches {
        matches_by_line.entry(m.line).or_default().push(m);
    }

    // Sort matches within each line by column (descending) for replacement
    for matches in matches_by_line.values_mut() {
        matches.sort_by(|a, b| b.column.cmp(&a.column));
    }

    let mut replaced_count = 0u32;

    for (line_num, line_matches) in matches_by_line {
        if (line_num as usize) >= new_lines.len() {
            continue;
        }

        let mut line = new_lines[line_num as usize].clone();

        for m in line_matches {
            let start = m.column as usize;
            let end = start + m.length as usize;

            if end <= line.len() {
                let original = &line[start..end];
                let replacement = if preserve_case {
                    apply_case_preservation(original, replace_text)
                } else {
                    replace_text.to_string()
                };

                line = format!("{}{}{}", &line[..start], replacement, &line[end..]);
                replaced_count += 1;
            }
        }

        new_lines[line_num as usize] = line;
    }

    // Create backup before writing
    let bak_path = file_path.with_extension("bak");
    fs::copy(&file_path, &bak_path).map_err(|e| format!("Failed to create backup: {}", e))?;

    // Write the modified content back
    let new_content = new_lines.join("\n");
    fs::write(&file_path, new_content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(replaced_count)
}

/// Apply case preservation to the replacement text
fn apply_case_preservation(original: &str, replacement: &str) -> String {
    if original.is_empty() || replacement.is_empty() {
        return replacement.to_string();
    }

    // Check if original is all uppercase
    if original
        .chars()
        .all(|c| !c.is_alphabetic() || c.is_uppercase())
    {
        return replacement.to_uppercase();
    }

    // Check if original is all lowercase
    if original
        .chars()
        .all(|c| !c.is_alphabetic() || c.is_lowercase())
    {
        return replacement.to_lowercase();
    }

    // Check if original is title case (first letter uppercase, rest lowercase)
    let chars: Vec<char> = original.chars().collect();
    if chars.first().is_some_and(|c| c.is_uppercase())
        && chars
            .iter()
            .skip(1)
            .all(|c| !c.is_alphabetic() || c.is_lowercase())
    {
        let mut result = replacement.to_lowercase();
        if let Some(first) = result.chars().next() {
            result = format!("{}{}", first.to_uppercase(), &result[first.len_utf8()..]);
        }
        return result;
    }

    // Default: return as-is
    replacement.to_string()
}

/// Result of validating a regex pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegexValidation {
    pub valid: bool,
    pub error: Option<String>,
}

/// A single search or replace history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryItem {
    pub id: String,
    pub pattern: String,
    pub timestamp: u64,
    #[serde(rename = "isReplace")]
    pub is_replace: bool,
    #[serde(rename = "replacePattern")]
    pub replace_pattern: Option<String>,
}

/// Persisted search history data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryData {
    #[serde(rename = "searchEntries")]
    pub search_entries: Vec<SearchHistoryItem>,
    #[serde(rename = "replaceEntries")]
    pub replace_entries: Vec<SearchHistoryItem>,
}

const MAX_HISTORY_ENTRIES: usize = 100;

/// Validate a regex pattern without performing a search
#[command]
pub async fn search_validate_regex(pattern: String) -> Result<RegexValidation, String> {
    tokio::task::spawn_blocking(move || match regex::Regex::new(&pattern) {
        Ok(_) => RegexValidation {
            valid: true,
            error: None,
        },
        Err(e) => RegexValidation {
            valid: false,
            error: Some(e.to_string()),
        },
    })
    .await
    .map_err(|e| e.to_string())
}

/// Get the search history file path from the app data directory
fn get_history_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| {
            dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Cortex-desktop")
        })
        .join("search_history.json")
}

/// Save search history entries to disk
#[command]
pub async fn search_history_save(
    entries: Vec<SearchHistoryItem>,
    app: AppHandle,
) -> Result<(), String> {
    let path = get_history_path(&app);

    let mut search_entries: Vec<SearchHistoryItem> =
        entries.iter().filter(|e| !e.is_replace).cloned().collect();
    let mut replace_entries: Vec<SearchHistoryItem> =
        entries.iter().filter(|e| e.is_replace).cloned().collect();

    search_entries.truncate(MAX_HISTORY_ENTRIES);
    replace_entries.truncate(MAX_HISTORY_ENTRIES);

    let data = SearchHistoryData {
        search_entries,
        replace_entries,
    };

    let json =
        serde_json::to_string_pretty(&data).map_err(|e| format!("Failed to serialize: {}", e))?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write history: {}", e))?;

    info!("[Search] Saved search history to {}", path.display());

    Ok(())
}

/// Load search history from disk
#[command]
pub async fn search_history_load(app: AppHandle) -> Result<SearchHistoryData, String> {
    let path = get_history_path(&app);

    if !path.exists() {
        return Ok(SearchHistoryData {
            search_entries: Vec::new(),
            replace_entries: Vec::new(),
        });
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read history: {}", e))?;

    let data: SearchHistoryData =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse history: {}", e))?;

    info!(
        "[Search] Loaded {} search + {} replace history entries",
        data.search_entries.len(),
        data.replace_entries.len()
    );

    Ok(data)
}

/// Restore a file from its `.bak` backup created during replace
#[command]
pub async fn search_undo_replace(file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let original = PathBuf::from(&file_path);
        let bak = original.with_extension("bak");

        if !bak.exists() {
            return Err(format!("No backup found for {}", file_path));
        }

        fs::copy(&bak, &original).map_err(|e| format!("Failed to restore backup: {}", e))?;
        fs::remove_file(&bak).map_err(|e| format!("Failed to remove backup: {}", e))?;

        info!("[Search] Restored {} from backup", file_path);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ============================================================================
// Replace Preview Types
// ============================================================================

/// A single line preview showing original and replaced text
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacePreviewLine {
    pub line_number: u32,
    pub original: String,
    pub replaced: String,
}

/// Options for filtered search
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilterOptions {
    pub query: String,
    pub paths: Vec<String>,
    pub case_sensitive: Option<bool>,
    pub use_regex: Option<bool>,
    pub whole_word: Option<bool>,
    pub multiline: Option<bool>,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub max_results: Option<u32>,
    pub file_list: Option<Vec<String>>,
}

/// Preview of replacements for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacePreviewEntry {
    pub uri: String,
    pub lines: Vec<ReplacePreviewLine>,
    pub total_replacements: u32,
    pub file_path: String,
    pub original_lines: Vec<String>,
    pub modified_lines: Vec<String>,
    pub match_count: u32,
}

/// Aggregated preview of all replacements
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacePreviewResult {
    pub entries: Vec<ReplacePreviewEntry>,
    pub total_files: u32,
    pub total_replacements: u32,
}

// ============================================================================
// Search History Persist Types
// ============================================================================

/// A persistent search history entry with full search parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHistoryPersistEntry {
    pub id: String,
    pub pattern: String,
    pub replace_pattern: Option<String>,
    pub case_sensitive: bool,
    pub use_regex: bool,
    pub whole_word: bool,
    pub timestamp: u64,
    pub results_count: u32,
}

/// Container for persisted search history
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHistoryPersistData {
    pub entries: Vec<SearchHistoryPersistEntry>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get the base data directory for search data
fn search_data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Cortex-desktop")
    })
}

/// Get the path to the persistent search history file
fn search_history_persist_path(app: &AppHandle) -> PathBuf {
    search_data_dir(app).join("search_history_persist.json")
}

// ============================================================================
// Workspace Search Command
// ============================================================================

/// Search across multiple workspace roots, aggregating results and emitting streaming events
#[command]
#[allow(clippy::too_many_arguments)]
pub async fn search_workspace(
    app: AppHandle,
    roots: Vec<String>,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_results: Option<u32>,
) -> Result<crate::fs::types::ContentSearchResponse, String> {
    let mut all_results: Vec<crate::fs::types::SearchResult> = Vec::new();
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    for root in &roots {
        let response = crate::fs::search::fs_search_content(
            root.clone(),
            query.clone(),
            case_sensitive,
            regex,
            whole_word,
            None,
            include.clone(),
            exclude.clone(),
            max_results,
        )
        .await?;

        for result in &response.results {
            if let Err(e) = app.emit("search:streaming-result", &result) {
                warn!("[Search] Failed to emit streaming result: {}", e);
            }
        }

        total_matches += response.total_matches;
        files_searched += response.files_searched;
        all_results.extend(response.results);
    }

    info!(
        "[Search] Workspace search complete: {} files, {} matches across {} roots",
        files_searched,
        total_matches,
        roots.len()
    );

    Ok(crate::fs::types::ContentSearchResponse {
        results: all_results,
        total_matches,
        files_searched,
    })
}

/// Search with full filter support across multiple paths
#[command]
pub async fn search_with_filters(
    options: SearchFilterOptions,
) -> Result<Vec<SearchResult>, String> {
    let case_sensitive = options.case_sensitive.unwrap_or(false);
    let use_regex = options.use_regex.unwrap_or(false);
    let whole_word = options.whole_word.unwrap_or(false);
    let multiline = options.multiline.unwrap_or(false);
    let max_results = options.max_results.unwrap_or(1000) as usize;

    let query = options.query.clone();
    let include = options.include_pattern.clone();
    let exclude = options.exclude_pattern.clone();
    let paths = options.paths.clone();
    let file_list = options.file_list.clone();

    tokio::task::spawn_blocking(move || {
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
            .multi_line(multiline)
            .dot_matches_new_line(multiline)
            .build()
            .map_err(|e| format!("Invalid search pattern: {}", e))?;

        let exclude_patterns: Vec<String> = exclude
            .unwrap_or_else(|| "node_modules,.git,dist,build".to_string())
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
        let mut total_found = 0usize;

        if let Some(files) = file_list {
            for file_path in files {
                if total_found >= max_results {
                    break;
                }
                let path = PathBuf::from(&file_path);
                if !path.is_file() {
                    continue;
                }
                if let Ok(content) = fs::read_to_string(&path) {
                    let mut file_matches = Vec::new();
                    for (line_num, line) in content.lines().enumerate() {
                        if total_found >= max_results {
                            break;
                        }
                        if line.len() > 10000 {
                            continue;
                        }
                        for mat in re.find_iter(line) {
                            file_matches.push(SearchMatch {
                                id: format!("{}:{}:{}", file_path, line_num + 1, mat.start()),
                                line: (line_num + 1) as u32,
                                column: (mat.start() + 1) as u32,
                                length: (mat.end() - mat.start()) as u32,
                                line_text: line.to_string(),
                                preview: line.to_string(),
                            });
                            total_found += 1;
                            if total_found >= max_results {
                                break;
                            }
                        }
                    }
                    if !file_matches.is_empty() {
                        all_results.push(SearchResult {
                            uri: format!("file://{}", file_path),
                            matches: file_matches.clone(),
                            total_matches: file_matches.len() as u32,
                        });
                    }
                }
            }
        } else {
            for search_path in &paths {
                if total_found >= max_results {
                    break;
                }
                let root = PathBuf::from(search_path);
                if !root.exists() {
                    continue;
                }
                search_directory_recursive(
                    &root,
                    &re,
                    &mut all_results,
                    &mut total_found,
                    max_results,
                    &exclude_patterns,
                    &include_patterns,
                );
            }
        }

        info!(
            "[Search] search_with_filters found {} matches in {} files",
            total_found,
            all_results.len()
        );
        Ok(all_results)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn search_directory_recursive(
    dir: &Path,
    re: &regex::Regex,
    results: &mut Vec<SearchResult>,
    total_found: &mut usize,
    max_results: usize,
    exclude_patterns: &[String],
    include_patterns: &[String],
) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if *total_found >= max_results {
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

        let path_str = path.to_string_lossy();
        if exclude_patterns.iter().any(|p| path_str.contains(p)) {
            continue;
        }

        if path.is_dir() {
            search_directory_recursive(
                &path,
                re,
                results,
                total_found,
                max_results,
                exclude_patterns,
                include_patterns,
            );
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

            if let Ok(content) = fs::read_to_string(&path) {
                let mut file_matches = Vec::new();
                for (line_num, line) in content.lines().enumerate() {
                    if *total_found >= max_results {
                        break;
                    }
                    if line.len() > 10000 {
                        continue;
                    }
                    for mat in re.find_iter(line) {
                        let file_path_str = path.to_string_lossy().to_string();
                        file_matches.push(SearchMatch {
                            id: format!("{}:{}:{}", file_path_str, line_num + 1, mat.start()),
                            line: (line_num + 1) as u32,
                            column: (mat.start() + 1) as u32,
                            length: (mat.end() - mat.start()) as u32,
                            line_text: line.to_string(),
                            preview: line.to_string(),
                        });
                        *total_found += 1;
                        if *total_found >= max_results {
                            break;
                        }
                    }
                }
                if !file_matches.is_empty() {
                    let file_path_str = path.to_string_lossy().to_string();
                    results.push(SearchResult {
                        uri: format!("file://{}", file_path_str),
                        matches: file_matches.clone(),
                        total_matches: file_matches.len() as u32,
                    });
                }
            }
        }
    }
}

// ============================================================================
// Replace Preview Command
// ============================================================================

/// Generate a preview of replacements without modifying any files
#[command]
pub async fn search_replace_preview(
    results: Vec<SearchResult>,
    replace_text: String,
    _use_regex: bool,
    preserve_case: bool,
) -> Result<ReplacePreviewResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut entries = Vec::new();
        let mut grand_total_replacements: u32 = 0;

        for result in &results {
            let path = result.uri.strip_prefix("file://").unwrap_or(&result.uri);
            let file_path = PathBuf::from(path);

            let content = match fs::read_to_string(&file_path) {
                Ok(c) => c,
                Err(e) => {
                    warn!("[Search] Failed to read file for preview {}: {}", path, e);
                    continue;
                }
            };

            let lines: Vec<&str> = content.lines().collect();
            let mut new_lines: Vec<String> = lines.iter().map(|s| s.to_string()).collect();

            let mut matches_by_line: HashMap<u32, Vec<&SearchMatch>> = HashMap::new();
            for m in &result.matches {
                matches_by_line.entry(m.line).or_default().push(m);
            }

            for matches in matches_by_line.values_mut() {
                matches.sort_by(|a, b| b.column.cmp(&a.column));
            }

            let mut file_replacements: u32 = 0;
            let mut preview_lines: Vec<ReplacePreviewLine> = Vec::new();

            for (line_num, line_matches) in &matches_by_line {
                if (*line_num as usize) >= new_lines.len() {
                    continue;
                }

                let original = new_lines[*line_num as usize].clone();
                let mut line = original.clone();

                for m in line_matches {
                    let start = m.column as usize;
                    let end = start + m.length as usize;

                    if end <= line.len() {
                        let matched_text = &line[start..end];
                        let replacement = if preserve_case {
                            apply_case_preservation(matched_text, &replace_text)
                        } else {
                            replace_text.clone()
                        };

                        line = format!("{}{}{}", &line[..start], replacement, &line[end..]);
                        file_replacements += 1;
                    }
                }

                new_lines[*line_num as usize] = line.clone();

                preview_lines.push(ReplacePreviewLine {
                    line_number: *line_num,
                    original,
                    replaced: line,
                });
            }

            preview_lines.sort_by_key(|p| p.line_number);

            if file_replacements > 0 {
                grand_total_replacements += file_replacements;
                entries.push(ReplacePreviewEntry {
                    uri: result.uri.clone(),
                    lines: preview_lines,
                    total_replacements: file_replacements,
                    file_path: path.to_string(),
                    original_lines: Vec::new(),
                    modified_lines: Vec::new(),
                    match_count: file_replacements,
                });
            }
        }

        Ok(ReplacePreviewResult {
            total_files: entries.len() as u32,
            total_replacements: grand_total_replacements,
            entries,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// ============================================================================
// Persistent Search History Commands
// ============================================================================

/// Load persistent search history from disk
#[command]
pub async fn get_search_history(app: AppHandle) -> Result<Vec<SearchHistoryPersistEntry>, String> {
    let path = search_history_persist_path(&app);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read search history: {}", e))?;

    let data: SearchHistoryPersistData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse search history: {}", e))?;

    info!(
        "[Search] Loaded {} persistent search history entries",
        data.entries.len()
    );

    Ok(data.entries)
}

/// Add a new entry to the persistent search history
#[command]
pub async fn add_search_history(
    app: AppHandle,
    entry: SearchHistoryPersistEntry,
) -> Result<(), String> {
    let path = search_history_persist_path(&app);

    let mut entries = if path.exists() {
        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read search history: {}", e))?;
        let data: SearchHistoryPersistData =
            serde_json::from_str(&content).unwrap_or_else(|_| SearchHistoryPersistData {
                entries: Vec::new(),
            });
        data.entries
    } else {
        Vec::new()
    };

    entries.retain(|e| e.pattern != entry.pattern);
    entries.insert(0, entry);
    entries.truncate(MAX_HISTORY_ENTRIES);

    let data = SearchHistoryPersistData { entries };
    let json =
        serde_json::to_string_pretty(&data).map_err(|e| format!("Failed to serialize: {}", e))?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    tokio::fs::write(&path, json)
        .await
        .map_err(|e| format!("Failed to write search history: {}", e))?;

    info!(
        "[Search] Added entry to persistent search history at {}",
        path.display()
    );

    Ok(())
}

/// Clear all persistent search history
#[command]
pub async fn clear_search_history(app: AppHandle) -> Result<(), String> {
    let path = search_history_persist_path(&app);

    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete search history: {}", e))?;

        info!(
            "[Search] Cleared persistent search history at {}",
            path.display()
        );
    }

    Ok(())
}

/// Delete a single entry from the persistent search history by id
#[command]
pub async fn delete_search_history_item(app: AppHandle, id: String) -> Result<(), String> {
    let path = search_history_persist_path(&app);

    if !path.exists() {
        return Ok(());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read search history: {}", e))?;

    let mut data: SearchHistoryPersistData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse search history: {}", e))?;

    let original_len = data.entries.len();
    data.entries.retain(|e| e.id != id);

    if data.entries.len() < original_len {
        let json = serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        tokio::fs::write(&path, json)
            .await
            .map_err(|e| format!("Failed to write search history: {}", e))?;

        info!("[Search] Deleted search history item with id: {}", id);
    }

    Ok(())
}

/// Get search history (delegates to search_history_load)
#[command]
pub async fn search_history_get(app: AppHandle) -> Result<SearchHistoryData, String> {
    search_history_load(app).await
}

/// Clear persisted search history
#[command]
pub async fn search_history_clear(app: AppHandle) -> Result<(), String> {
    let path = get_history_path(&app);
    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to clear search history: {}", e))?;
        info!("[Search] Cleared search history at {}", path.display());
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    // ---- apply_case_preservation ----

    #[test]
    fn case_preservation_all_uppercase() {
        assert_eq!(apply_case_preservation("FOO", "bar"), "BAR");
    }

    #[test]
    fn case_preservation_all_lowercase() {
        assert_eq!(apply_case_preservation("foo", "BAR"), "bar");
    }

    #[test]
    fn case_preservation_title_case() {
        assert_eq!(apply_case_preservation("Foo", "bar"), "Bar");
    }

    #[test]
    fn case_preservation_mixed_case_returns_as_is() {
        assert_eq!(apply_case_preservation("fOo", "bar"), "bar");
    }

    #[test]
    fn case_preservation_empty_original() {
        assert_eq!(apply_case_preservation("", "bar"), "bar");
    }

    #[test]
    fn case_preservation_empty_replacement() {
        assert_eq!(apply_case_preservation("FOO", ""), "");
    }

    #[test]
    fn case_preservation_both_empty() {
        assert_eq!(apply_case_preservation("", ""), "");
    }

    #[test]
    fn case_preservation_non_alpha_original_treated_as_uppercase() {
        assert_eq!(apply_case_preservation("123", "bar"), "BAR");
    }

    #[test]
    fn case_preservation_title_case_multi_word() {
        assert_eq!(apply_case_preservation("Hello", "world"), "World");
    }

    // ---- Regex validation ----

    #[test]
    fn regex_validation_valid_pattern() {
        let result = regex::Regex::new(r"\d+");
        assert!(result.is_ok());
    }

    #[test]
    fn regex_validation_invalid_pattern() {
        let pattern = "[invalid";
        let result = regex::Regex::new(pattern);
        assert!(result.is_err());
    }

    #[test]
    fn regex_validation_empty_pattern() {
        let result = regex::Regex::new("");
        assert!(result.is_ok());
    }

    #[test]
    fn regex_validation_complex_pattern() {
        let result = regex::Regex::new(r"^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)$");
        assert!(result.is_ok());
    }

    // ---- Serialization / Deserialization ----

    #[test]
    fn search_match_roundtrip() {
        let m = SearchMatch {
            id: "file.rs:10:5".to_string(),
            line: 10,
            column: 5,
            length: 3,
            line_text: "let foo = 1;".to_string(),
            preview: "let foo = 1;".to_string(),
        };
        let json = serde_json::to_string(&m).unwrap();
        let deserialized: SearchMatch = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, m.id);
        assert_eq!(deserialized.line, 10);
        assert_eq!(deserialized.column, 5);
        assert_eq!(deserialized.length, 3);
    }

    #[test]
    fn search_result_roundtrip() {
        let result = SearchResult {
            uri: "file:///test.rs".to_string(),
            matches: vec![],
            total_matches: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: SearchResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uri, "file:///test.rs");
        assert_eq!(deserialized.total_matches, 0);
    }

    #[test]
    fn search_history_data_roundtrip() {
        let data = SearchHistoryData {
            search_entries: vec![SearchHistoryItem {
                id: "1".to_string(),
                pattern: "foo".to_string(),
                timestamp: 12345,
                is_replace: false,
                replace_pattern: None,
            }],
            replace_entries: vec![SearchHistoryItem {
                id: "2".to_string(),
                pattern: "bar".to_string(),
                timestamp: 12346,
                is_replace: true,
                replace_pattern: Some("baz".to_string()),
            }],
        };
        let json = serde_json::to_string(&data).unwrap();
        let deserialized: SearchHistoryData = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.search_entries.len(), 1);
        assert_eq!(deserialized.replace_entries.len(), 1);
        assert_eq!(deserialized.search_entries[0].pattern, "foo");
        assert!(!deserialized.search_entries[0].is_replace);
        assert!(deserialized.replace_entries[0].is_replace);
        assert_eq!(
            deserialized.replace_entries[0].replace_pattern,
            Some("baz".to_string())
        );
    }

    #[test]
    fn search_history_data_camel_case_keys() {
        let json = r#"{"searchEntries":[],"replaceEntries":[]}"#;
        let data: SearchHistoryData = serde_json::from_str(json).unwrap();
        assert!(data.search_entries.is_empty());
        assert!(data.replace_entries.is_empty());
    }

    #[test]
    fn regex_validation_struct_roundtrip() {
        let v = RegexValidation {
            valid: true,
            error: None,
        };
        let json = serde_json::to_string(&v).unwrap();
        let deserialized: RegexValidation = serde_json::from_str(&json).unwrap();
        assert!(deserialized.valid);
        assert!(deserialized.error.is_none());

        let v2 = RegexValidation {
            valid: false,
            error: Some("bad pattern".to_string()),
        };
        let json2 = serde_json::to_string(&v2).unwrap();
        let deserialized2: RegexValidation = serde_json::from_str(&json2).unwrap();
        assert!(!deserialized2.valid);
        assert_eq!(deserialized2.error.unwrap(), "bad pattern");
    }

    #[test]
    fn search_history_persist_entry_roundtrip() {
        let entry = SearchHistoryPersistEntry {
            id: "abc".to_string(),
            pattern: "test".to_string(),
            replace_pattern: Some("replacement".to_string()),
            case_sensitive: true,
            use_regex: false,
            whole_word: true,
            timestamp: 999,
            results_count: 42,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: SearchHistoryPersistEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "abc");
        assert_eq!(deserialized.results_count, 42);
        assert!(deserialized.case_sensitive);
    }

    #[test]
    fn search_history_persist_data_roundtrip() {
        let data = SearchHistoryPersistData { entries: vec![] };
        let json = serde_json::to_string(&data).unwrap();
        let deserialized: SearchHistoryPersistData = serde_json::from_str(&json).unwrap();
        assert!(deserialized.entries.is_empty());
    }

    // ---- replace_in_file_internal ----

    #[test]
    fn replace_in_file_basic() {
        let dir = std::env::temp_dir().join("cortex_test_search_replace");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("test_replace.txt");
        fs::write(&file_path, "hello world\nfoo bar\n").unwrap();

        let matches = vec![SearchMatch {
            id: "1".to_string(),
            line: 0,
            column: 6,
            length: 5,
            line_text: "hello world".to_string(),
            preview: "hello world".to_string(),
        }];

        let result =
            replace_in_file_internal(file_path.to_str().unwrap(), &matches, "earth", false, false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("hello earth"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn replace_in_file_empty_replacement() {
        let dir = std::env::temp_dir().join("cortex_test_search_empty");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("test_empty.txt");
        fs::write(&file_path, "remove_me here\n").unwrap();

        let matches = vec![SearchMatch {
            id: "1".to_string(),
            line: 0,
            column: 0,
            length: 9,
            line_text: "remove_me here".to_string(),
            preview: "remove_me here".to_string(),
        }];

        let result =
            replace_in_file_internal(file_path.to_str().unwrap(), &matches, "", false, false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.starts_with(" here"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn replace_in_file_with_case_preservation() {
        let dir = std::env::temp_dir().join("cortex_test_search_case");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("test_case.txt");
        fs::write(&file_path, "Hello World\n").unwrap();

        let matches = vec![SearchMatch {
            id: "1".to_string(),
            line: 0,
            column: 0,
            length: 5,
            line_text: "Hello World".to_string(),
            preview: "Hello World".to_string(),
        }];

        let result = replace_in_file_internal(
            file_path.to_str().unwrap(),
            &matches,
            "goodbye",
            false,
            true,
        );
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.starts_with("Goodbye"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn replace_in_file_nonexistent_returns_error() {
        let result = replace_in_file_internal(
            "/nonexistent/path/file.txt",
            &[],
            "replacement",
            false,
            false,
        );
        assert!(result.is_err());
    }

    #[test]
    fn replace_in_file_out_of_bounds_line_skipped() {
        let dir = std::env::temp_dir().join("cortex_test_search_oob");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("test_oob.txt");
        fs::write(&file_path, "single line\n").unwrap();

        let matches = vec![SearchMatch {
            id: "1".to_string(),
            line: 999,
            column: 0,
            length: 3,
            line_text: "xxx".to_string(),
            preview: "xxx".to_string(),
        }];

        let result =
            replace_in_file_internal(file_path.to_str().unwrap(), &matches, "yyy", false, false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn replace_in_file_special_characters() {
        let dir = std::env::temp_dir().join("cortex_test_search_special");
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("test_special.txt");
        fs::write(&file_path, "price: $100\n").unwrap();

        let matches = vec![SearchMatch {
            id: "1".to_string(),
            line: 0,
            column: 7,
            length: 4,
            line_text: "price: $100".to_string(),
            preview: "price: $100".to_string(),
        }];

        let result =
            replace_in_file_internal(file_path.to_str().unwrap(), &matches, "€200", false, false);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("€200"));

        let _ = fs::remove_dir_all(&dir);
    }

    // ---- ReplaceMatchRequest deserialization ----

    #[test]
    fn replace_match_request_deserialization() {
        let json = r#"{
            "uri": "file:///test.rs",
            "match": {
                "id": "1",
                "line": 1,
                "column": 0,
                "length": 3,
                "line_text": "foo",
                "preview": "foo"
            },
            "replaceText": "bar"
        }"#;
        let req: ReplaceMatchRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.uri, "file:///test.rs");
        assert_eq!(req.match_info.id, "1");
        assert_eq!(req.replace_text, "bar");
        assert!(!req.use_regex);
        assert!(!req.preserve_case);
    }

    // ---- SearchFilterOptions deserialization ----

    #[test]
    fn search_filter_options_deserialization() {
        let json = r#"{
            "query": "test",
            "paths": ["/src"],
            "caseSensitive": true,
            "useRegex": false,
            "wholeWord": true
        }"#;
        let opts: SearchFilterOptions = serde_json::from_str(json).unwrap();
        assert_eq!(opts.query, "test");
        assert_eq!(opts.paths, vec!["/src"]);
        assert_eq!(opts.case_sensitive, Some(true));
        assert_eq!(opts.use_regex, Some(false));
        assert_eq!(opts.whole_word, Some(true));
        assert!(opts.multiline.is_none());
        assert!(opts.include_pattern.is_none());
        assert!(opts.exclude_pattern.is_none());
        assert!(opts.max_results.is_none());
        assert!(opts.file_list.is_none());
    }

    // ---- ReplacePreviewLine / ReplacePreviewResult ----

    #[test]
    fn replace_preview_line_roundtrip() {
        let line = ReplacePreviewLine {
            line_number: 5,
            original: "old text".to_string(),
            replaced: "new text".to_string(),
        };
        let json = serde_json::to_string(&line).unwrap();
        let deserialized: ReplacePreviewLine = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.line_number, 5);
        assert_eq!(deserialized.original, "old text");
        assert_eq!(deserialized.replaced, "new text");
    }

    #[test]
    fn replace_preview_result_roundtrip() {
        let result = ReplacePreviewResult {
            entries: vec![],
            total_files: 0,
            total_replacements: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: ReplacePreviewResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.total_files, 0);
        assert_eq!(deserialized.total_replacements, 0);
        assert!(deserialized.entries.is_empty());
    }

    #[test]
    fn max_history_entries_constant() {
        assert_eq!(MAX_HISTORY_ENTRIES, 100);
    }
}
