//! Document and workspace symbol indexing with rayon parallelism
//!
//! Provides fast parallel symbol search across workspace files using
//! regex-based extraction and fuzzy matching.

use rayon::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::info;
use walkdir::WalkDir;

const DEFAULT_MAX_RESULTS: u32 = 100;
const ABSOLUTE_MAX_RESULTS: u32 = 1000;

use crate::fs::security::validate_path_for_read;

const MAX_QUERY_LENGTH: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SymbolKind {
    Function,
    Method,
    Class,
    Interface,
    Enum,
    Struct,
    Constant,
    Variable,
    Module,
    Property,
    TypeAlias,
    Trait,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolEntry {
    pub name: String,
    pub kind: SymbolKind,
    pub file_path: String,
    pub line: u32,
    pub column: u32,
    pub container_name: Option<String>,
    pub score: f64,
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".cache"
            | ".idea"
            | ".vscode"
    )
}

fn is_searchable_extension(ext: &str) -> bool {
    matches!(
        ext,
        "rs" | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "py"
            | "java"
            | "kt"
            | "go"
            | "c"
            | "cpp"
            | "h"
            | "hpp"
            | "cs"
            | "rb"
            | "swift"
            | "lua"
            | "zig"
    )
}

fn get_symbol_patterns(ext: &str) -> Vec<(&'static str, SymbolKind)> {
    match ext {
        "rs" => vec![
            (
                r"(?m)^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)",
                SymbolKind::Function,
            ),
            (r"(?m)^\s*(?:pub\s+)?struct\s+(\w+)", SymbolKind::Struct),
            (r"(?m)^\s*(?:pub\s+)?enum\s+(\w+)", SymbolKind::Enum),
            (r"(?m)^\s*(?:pub\s+)?trait\s+(\w+)", SymbolKind::Trait),
            (r"(?m)^\s*(?:pub\s+)?mod\s+(\w+)", SymbolKind::Module),
            (r"(?m)^\s*(?:pub\s+)?type\s+(\w+)", SymbolKind::TypeAlias),
            (r"(?m)^\s*(?:pub\s+)?const\s+(\w+)", SymbolKind::Constant),
        ],
        "ts" | "tsx" | "js" | "jsx" => vec![
            (
                r"(?m)^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)",
                SymbolKind::Function,
            ),
            (r"(?m)^\s*(?:export\s+)?class\s+(\w+)", SymbolKind::Class),
            (
                r"(?m)^\s*(?:export\s+)?interface\s+(\w+)",
                SymbolKind::Interface,
            ),
            (r"(?m)^\s*(?:export\s+)?enum\s+(\w+)", SymbolKind::Enum),
            (r"(?m)^\s*(?:export\s+)?type\s+(\w+)", SymbolKind::TypeAlias),
            (r"(?m)^\s*(?:export\s+)?const\s+(\w+)", SymbolKind::Constant),
        ],
        "py" => vec![
            (r"(?m)^\s*(?:async\s+)?def\s+(\w+)", SymbolKind::Function),
            (r"(?m)^\s*class\s+(\w+)", SymbolKind::Class),
        ],
        "java" | "kt" => vec![
            (
                r"(?m)^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(\w+)",
                SymbolKind::Class,
            ),
            (
                r"(?m)^\s*(?:public|private|protected)?\s*(?:static\s+)?interface\s+(\w+)",
                SymbolKind::Interface,
            ),
            (
                r"(?m)^\s*(?:public|private|protected)?\s*(?:static\s+)?enum\s+(\w+)",
                SymbolKind::Enum,
            ),
            (
                r"(?m)^\s*(?:public|private|protected)?\s*(?:static\s+)?\w+\s+(\w+)\s*\(",
                SymbolKind::Method,
            ),
        ],
        "go" => vec![
            (
                r"(?m)^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)",
                SymbolKind::Function,
            ),
            (r"(?m)^type\s+(\w+)\s+struct", SymbolKind::Struct),
            (r"(?m)^type\s+(\w+)\s+interface", SymbolKind::Interface),
        ],
        "c" | "cpp" | "h" | "hpp" => vec![
            (
                r"(?m)^\s*(?:static\s+)?(?:inline\s+)?\w[\w:]*\s+(\w+)\s*\(",
                SymbolKind::Function,
            ),
            (r"(?m)^\s*(?:class|struct)\s+(\w+)", SymbolKind::Class),
            (r"(?m)^\s*enum\s+(?:class\s+)?(\w+)", SymbolKind::Enum),
            (r"(?m)^\s*#define\s+(\w+)", SymbolKind::Constant),
        ],
        _ => vec![
            (
                r"(?m)^\s*(?:pub\s+)?(?:async\s+)?(?:def|fn|func|function)\s+(\w+)",
                SymbolKind::Function,
            ),
            (
                r"(?m)^\s*(?:pub\s+)?(?:class|struct)\s+(\w+)",
                SymbolKind::Class,
            ),
        ],
    }
}

fn fuzzy_score(name: &str, query: &str) -> f64 {
    if query.is_empty() {
        return 1.0;
    }

    let name_lower = name.to_lowercase();
    let query_lower = query.to_lowercase();

    if name_lower == query_lower {
        return 100.0;
    }

    if name_lower.starts_with(&query_lower) {
        return 90.0 + (query.len() as f64 / name.len() as f64) * 10.0;
    }

    if name_lower.contains(&query_lower) {
        return 70.0 + (query.len() as f64 / name.len() as f64) * 10.0;
    }

    let mut query_chars = query_lower.chars().peekable();
    let mut score = 0.0;
    let mut consecutive = 0.0;
    let mut matched = 0;

    for ch in name_lower.chars() {
        if let Some(&qc) = query_chars.peek() {
            if ch == qc {
                matched += 1;
                consecutive += 1.0;
                score += 1.0 + consecutive;
                query_chars.next();
            } else {
                consecutive = 0.0;
            }
        }
    }

    if query_chars.peek().is_some() {
        return 0.0;
    }

    let base_score = score / query.len() as f64;
    let length_penalty =
        1.0 - (name.len() as f64 - query.len() as f64).abs() / name.len().max(1) as f64;
    let match_ratio = matched as f64 / query.len() as f64;

    base_score * 10.0 * length_penalty * match_ratio
}

fn extract_symbols_from_file(path: &Path, content: &str, query: &str) -> Vec<SymbolEntry> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    let patterns = get_symbol_patterns(ext);
    let file_path = path.to_string_lossy().to_string();
    let mut symbols = Vec::new();

    for (pattern, kind) in patterns {
        let re = match Regex::new(pattern) {
            Ok(r) => r,
            Err(_) => continue,
        };

        for caps in re.captures_iter(content) {
            if let Some(name_match) = caps.get(1) {
                let name = name_match.as_str().to_string();
                let score = fuzzy_score(&name, query);

                if score > 0.0 || query.is_empty() {
                    let byte_offset = name_match.start();
                    let line = content[..byte_offset].matches('\n').count() as u32;
                    let last_newline = content[..byte_offset].rfind('\n').map_or(0, |p| p + 1);
                    let column = (byte_offset - last_newline) as u32;

                    symbols.push(SymbolEntry {
                        name,
                        kind: kind.clone(),
                        file_path: file_path.clone(),
                        line,
                        column,
                        container_name: None,
                        score,
                    });
                }
            }
        }
    }

    symbols
}

#[tauri::command]
pub async fn get_workspace_symbols(
    workspace_path: String,
    query: String,
    max_results: Option<u32>,
) -> Result<Vec<SymbolEntry>, String> {
    if query.len() > MAX_QUERY_LENGTH {
        return Err(format!(
            "Query exceeds maximum length of {} characters",
            MAX_QUERY_LENGTH
        ));
    }

    let max = max_results
        .unwrap_or(DEFAULT_MAX_RESULTS)
        .min(ABSOLUTE_MAX_RESULTS) as usize;

    let validated_workspace = validate_path_for_read(Path::new(&workspace_path))
        .map_err(|e| format!("Invalid workspace path: {}", e))?;

    let symbols = tokio::task::spawn_blocking(move || {
        let workspace = &validated_workspace;
        if !workspace.is_dir() {
            return Err("Workspace path is not a directory".to_string());
        }

        let files: Vec<_> = WalkDir::new(workspace)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    let name = e.file_name().to_string_lossy();
                    return !should_skip_dir(&name);
                }
                true
            })
            .filter_map(|e| e.ok())
            .filter(|e| {
                if !e.file_type().is_file() {
                    return false;
                }
                e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .is_some_and(is_searchable_extension)
            })
            .map(|e| e.into_path())
            .collect();

        info!(
            "Scanning {} files for symbols matching '{}'",
            files.len(),
            query
        );

        let mut all_symbols: Vec<SymbolEntry> = files
            .par_iter()
            .filter_map(|path| {
                let content = std::fs::read_to_string(path).ok()?;
                let symbols = extract_symbols_from_file(path, &content, &query);
                if symbols.is_empty() {
                    None
                } else {
                    Some(symbols)
                }
            })
            .flatten()
            .collect();

        all_symbols.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        all_symbols.truncate(max);

        info!("Found {} symbols", all_symbols.len());
        Ok(all_symbols)
    })
    .await
    .map_err(|e| format!("Symbol search failed: {}", e))??;

    Ok(symbols)
}
