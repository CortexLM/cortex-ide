//! Workspace Symbols Backend
//!
//! Provides workspace-wide symbol search (like VS Code's Ctrl+T / Go to Symbol in Workspace).
//! Indexes source files using regex-based symbol extraction and supports fuzzy search
//! with relevance-based ranking.
#![allow(clippy::expect_used, clippy::unwrap_used)]

use rayon::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};
use tracing::info;
use walkdir::WalkDir;

// ============================================================================
// Types
// ============================================================================

/// LSP Symbol Kind (matches LSP specification)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SymbolKind {
    File,
    Module,
    Namespace,
    Package,
    Class,
    Method,
    Property,
    Field,
    Constructor,
    Enum,
    Interface,
    Function,
    Variable,
    Constant,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Key,
    Null,
    EnumMember,
    Struct,
    Event,
    Operator,
    TypeParameter,
}

/// A symbol found in the workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSymbol {
    pub name: String,
    pub kind: SymbolKind,
    pub container_name: Option<String>,
    pub file_path: String,
    pub line: u32,
    pub column: u32,
    pub end_line: Option<u32>,
    pub end_column: Option<u32>,
}

/// Index of symbols for a workspace
#[derive(Debug, Clone)]
struct SymbolIndex {
    symbols: Vec<WorkspaceSymbol>,
    last_indexed: Option<u64>,
}

impl SymbolIndex {
    fn new() -> Self {
        Self {
            symbols: Vec::new(),
            last_indexed: None,
        }
    }
}

/// Statistics about the symbol index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    pub total_symbols: usize,
    pub total_files: usize,
    pub last_indexed: Option<u64>,
    pub indexed: bool,
}

/// Shared state for workspace symbol tracking
pub struct WorkspaceSymbolState {
    indices: Mutex<HashMap<String, SymbolIndex>>,
}

impl WorkspaceSymbolState {
    pub fn new() -> Self {
        Self {
            indices: Mutex::new(HashMap::new()),
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Default for WorkspaceSymbolState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Symbol Pattern Extraction
// ============================================================================

struct SymbolPattern {
    pattern: Regex,
    kind: SymbolKind,
    name_group: usize,
}

fn get_patterns_for_extension(ext: &str) -> Vec<SymbolPattern> {
    match ext {
        "ts" | "tsx" => get_typescript_patterns(),
        "js" | "jsx" => get_javascript_patterns(),
        "rs" => get_rust_patterns(),
        "py" => get_python_patterns(),
        "go" => get_go_patterns(),
        _ => Vec::new(),
    }
}

fn get_typescript_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?interface\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?type\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::TypeParameter,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?enum\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
    ]
}

fn get_javascript_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
    ]
}

fn get_rust_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Struct,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?trait\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*impl(?:\s+<[^>]+>)?\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Module,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?const\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Constant,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?static\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*(?:pub(?:\([^)]*\))?\s+)?type\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::TypeParameter,
            name_group: 1,
        },
    ]
}

fn get_python_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: Regex::new(r"^class\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^(?:async\s+)?def\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s+(?:async\s+)?def\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
    ]
}

fn get_go_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: Regex::new(r"^type\s+(\w+)\s+struct")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Struct,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^type\s+(\w+)\s+interface")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^func\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^func\s+\([^)]+\)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*const\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Constant,
            name_group: 1,
        },
        SymbolPattern {
            pattern: Regex::new(r"^\s*var\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
    ]
}

// ============================================================================
// Indexing Helpers
// ============================================================================

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".next",
    ".nuxt",
    ".venv",
    "vendor",
];

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "c", "cpp", "h", "cs", "rb", "php",
];

fn should_skip_dir(name: &str) -> bool {
    SKIP_DIRS.contains(&name)
}

fn is_supported_extension(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext)
}

fn extract_container_name(file_path: &str, workspace_path: &str) -> Option<String> {
    let relative = file_path.strip_prefix(workspace_path).unwrap_or(file_path);
    let relative = relative.trim_start_matches('/').trim_start_matches('\\');
    let path = Path::new(relative);
    path.parent()
        .and_then(|p| p.to_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.replace('\\', "/"))
}

fn parse_file_symbols(file_path: &str, workspace_path: &str) -> Vec<WorkspaceSymbol> {
    let path = Path::new(file_path);
    let ext = match path.extension().and_then(|e| e.to_str()) {
        Some(e) => e,
        None => return Vec::new(),
    };

    let patterns = get_patterns_for_extension(ext);
    if patterns.is_empty() {
        return Vec::new();
    }

    let content = match fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let container = extract_container_name(file_path, workspace_path);
    let mut symbols = Vec::new();

    for (line_idx, line) in content.lines().enumerate() {
        for pattern_def in &patterns {
            if let Some(captures) = pattern_def.pattern.captures(line) {
                if let Some(name_match) = captures.get(pattern_def.name_group) {
                    let name = name_match.as_str().to_string();
                    let start_col = name_match.start() as u32;
                    let end_col = name_match.end() as u32;

                    symbols.push(WorkspaceSymbol {
                        name,
                        kind: pattern_def.kind,
                        container_name: container.clone(),
                        file_path: file_path.to_string(),
                        line: line_idx as u32,
                        column: start_col,
                        end_line: Some(line_idx as u32),
                        end_column: Some(end_col),
                    });
                    break;
                }
            }
        }
    }

    symbols
}

fn index_workspace_sync(workspace_path: &str) -> SymbolIndex {
    let file_paths: Vec<String> = WalkDir::new(workspace_path)
        .into_iter()
        .filter_entry(|entry| {
            if entry.file_type().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    return !should_skip_dir(name);
                }
            }
            true
        })
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .map(is_supported_extension)
                .unwrap_or(false)
        })
        .filter_map(|entry| entry.path().to_str().map(|s| s.to_string()))
        .collect();

    let workspace_owned = workspace_path.to_string();
    let symbols: Vec<WorkspaceSymbol> = file_paths
        .par_iter()
        .flat_map(|path| parse_file_symbols(path, &workspace_owned))
        .collect();

    SymbolIndex {
        symbols,
        last_indexed: Some(WorkspaceSymbolState::now_ms()),
    }
}

// ============================================================================
// Search Helpers
// ============================================================================

fn compute_relevance(symbol_name: &str, query_lower: &str) -> u32 {
    let name_lower = symbol_name.to_lowercase();
    if name_lower == query_lower {
        3
    } else if name_lower.starts_with(query_lower) {
        2
    } else if name_lower.contains(query_lower) {
        1
    } else {
        0
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Search workspace symbols by query string with fuzzy matching
#[tauri::command]
pub async fn workspace_symbols_search(
    _app: AppHandle,
    state: State<'_, WorkspaceSymbolState>,
    workspace_path: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<WorkspaceSymbol>, String> {
    let max = max_results.unwrap_or(100);
    let query_lower = query.to_lowercase();

    let indices = state
        .indices
        .lock()
        .map_err(|_| "Failed to acquire lock")?;

    let index = match indices.get(&workspace_path) {
        Some(idx) => idx,
        None => return Ok(Vec::new()),
    };

    if query_lower.is_empty() {
        let results: Vec<WorkspaceSymbol> = index.symbols.iter().take(max).cloned().collect();
        return Ok(results);
    }

    let mut scored: Vec<(u32, &WorkspaceSymbol)> = index
        .symbols
        .iter()
        .filter_map(|sym| {
            let score = compute_relevance(&sym.name, &query_lower);
            if score > 0 {
                Some((score, sym))
            } else {
                None
            }
        })
        .collect();

    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name.cmp(&b.1.name)));

    let results: Vec<WorkspaceSymbol> = scored.into_iter().take(max).map(|(_, s)| s.clone()).collect();

    Ok(results)
}

/// Index or re-index a workspace directory
#[tauri::command]
pub async fn workspace_symbols_index(
    _app: AppHandle,
    state: State<'_, WorkspaceSymbolState>,
    workspace_path: String,
) -> Result<IndexStats, String> {
    let workspace = workspace_path.clone();

    let index = tokio::task::spawn_blocking(move || index_workspace_sync(&workspace))
        .await
        .map_err(|e| format!("Indexing task failed: {}", e))?;

    let total_symbols = index.symbols.len();
    let last_indexed = index.last_indexed;

    let file_count = {
        let mut files: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for sym in &index.symbols {
            files.insert(&sym.file_path);
        }
        files.len()
    };

    info!(
        "Indexed {} symbols from {} files in workspace: {}",
        total_symbols, file_count, workspace_path
    );

    {
        let mut indices = state
            .indices
            .lock()
            .map_err(|_| "Failed to acquire lock")?;
        indices.insert(workspace_path, index);
    }

    Ok(IndexStats {
        total_symbols,
        total_files: file_count,
        last_indexed,
        indexed: true,
    })
}

/// Clear the symbol index for a workspace
#[tauri::command]
pub async fn workspace_symbols_clear(
    _app: AppHandle,
    state: State<'_, WorkspaceSymbolState>,
    workspace_path: String,
) -> Result<(), String> {
    let mut indices = state
        .indices
        .lock()
        .map_err(|_| "Failed to acquire lock")?;
    indices.remove(&workspace_path);

    info!("Cleared symbol index for workspace: {}", workspace_path);

    Ok(())
}

/// Get indexing statistics for a workspace
#[tauri::command]
pub async fn workspace_symbols_get_stats(
    _app: AppHandle,
    state: State<'_, WorkspaceSymbolState>,
    workspace_path: String,
) -> Result<IndexStats, String> {
    let indices = state
        .indices
        .lock()
        .map_err(|_| "Failed to acquire lock")?;

    match indices.get(&workspace_path) {
        Some(index) => {
            let mut files: std::collections::HashSet<&str> = std::collections::HashSet::new();
            for sym in &index.symbols {
                files.insert(&sym.file_path);
            }

            Ok(IndexStats {
                total_symbols: index.symbols.len(),
                total_files: files.len(),
                last_indexed: index.last_indexed,
                indexed: true,
            })
        }
        None => Ok(IndexStats {
            total_symbols: 0,
            total_files: 0,
            last_indexed: None,
            indexed: false,
        }),
    }
}
