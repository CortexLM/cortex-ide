//! Codebase semantic indexer.
//!
//! On workspace open, walks the file tree (respecting `.gitignore`),
//! chunks source files into semantic units (functions, classes, blocks),
//! generates embeddings, and stores them in the SQLite vector index.

use super::vector_store::{CodeChunk, generate_embedding};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};
use walkdir::WalkDir;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Indexing progress event emitted via Tauri events.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgress {
    /// Total files to index.
    pub total_files: usize,
    /// Files indexed so far.
    pub indexed_files: usize,
    /// Total chunks created.
    pub total_chunks: usize,
    /// Whether indexing is complete.
    pub done: bool,
    /// Current file being indexed (if any).
    pub current_file: Option<String>,
}

/// Indexing status.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub is_indexing: bool,
    pub indexed_files: usize,
    pub total_chunks: usize,
    pub workspace_path: Option<String>,
}

// ---------------------------------------------------------------------------
// Indexer State
// ---------------------------------------------------------------------------

/// Thread-safe indexer state.
pub struct IndexerState {
    status: Arc<Mutex<IndexStatus>>,
    cancel: Arc<Mutex<bool>>,
}

impl IndexerState {
    pub fn new() -> Self {
        Self {
            status: Arc::new(Mutex::new(IndexStatus {
                is_indexing: false,
                indexed_files: 0,
                total_chunks: 0,
                workspace_path: None,
            })),
            cancel: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn get_status(&self) -> IndexStatus {
        self.status.lock().await.clone()
    }
}

impl Default for IndexerState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/// Source file extensions we index.
const INDEXABLE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "kt", "scala", "c", "cpp", "cc", "cxx",
    "h", "hpp", "cs", "rb", "swift", "m", "lua", "zig", "hs", "ml", "mli", "ex", "exs", "erl",
    "hrl", "php", "sh", "bash", "zsh", "fish", "ps1", "r", "jl", "dart", "vue", "svelte", "astro",
    "sql", "graphql", "gql", "proto", "toml", "yaml", "yml", "json", "xml", "html", "css", "scss",
    "less", "md", "mdx", "txt",
];

/// Directories to always skip.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".tox",
    "venv",
    ".venv",
    "env",
    ".env",
    ".next",
    ".nuxt",
    ".output",
    "out",
    ".cache",
    ".parcel-cache",
    "coverage",
    ".nyc_output",
    ".cortex",
];

/// Collect indexable files from a workspace, respecting .gitignore.
fn collect_files(workspace_path: &Path) -> Vec<PathBuf> {
    let gitignore_patterns = load_gitignore(workspace_path);

    let mut files = Vec::new();

    for entry in WalkDir::new(workspace_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            // Skip hidden dirs (except the workspace root)
            if e.depth() > 0 && name.starts_with('.') && e.file_type().is_dir() {
                return false;
            }
            // Skip known dirs
            if e.file_type().is_dir() && SKIP_DIRS.contains(&name.as_ref()) {
                return false;
            }
            true
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();

        // Check extension
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !INDEXABLE_EXTENSIONS.contains(&ext) {
            continue;
        }

        // Check gitignore
        let relative = path.strip_prefix(workspace_path).unwrap_or(path);
        let rel_str = relative.to_string_lossy();
        if gitignore_patterns
            .iter()
            .any(|p| matches_gitignore(p, &rel_str))
        {
            continue;
        }

        // Skip very large files (> 1MB)
        if let Ok(meta) = std::fs::metadata(path) {
            if meta.len() > 1_048_576 {
                continue;
            }
        }

        files.push(path.to_path_buf());
    }

    files
}

/// Load .gitignore patterns (simplified).
fn load_gitignore(workspace_path: &Path) -> Vec<String> {
    let gitignore_path = workspace_path.join(".gitignore");
    match std::fs::read_to_string(&gitignore_path) {
        Ok(content) => content
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.starts_with('#'))
            .map(|l| l.trim().to_string())
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// Simple gitignore pattern matching.
fn matches_gitignore(pattern: &str, path: &str) -> bool {
    let pattern = pattern.trim_start_matches('/');
    let pattern = pattern.trim_end_matches('/');

    if pattern.contains('*') {
        // Simple glob: convert * to regex-like matching
        let parts: Vec<&str> = pattern.split('*').collect();
        if parts.len() == 2 {
            let starts = parts[0].is_empty() || path.contains(parts[0]);
            let ends = parts[1].is_empty() || path.contains(parts[1]);
            return starts && ends;
        }
    }

    path.contains(pattern)
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/// Detect language from file extension.
fn detect_language(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "rs" => "rust",
        "ts" => "typescript",
        "tsx" => "typescriptreact",
        "js" => "javascript",
        "jsx" => "javascriptreact",
        "py" => "python",
        "go" => "go",
        "java" => "java",
        "kt" => "kotlin",
        "scala" => "scala",
        "c" => "c",
        "cpp" | "cc" | "cxx" => "cpp",
        "h" | "hpp" => "cpp",
        "cs" => "csharp",
        "rb" => "ruby",
        "swift" => "swift",
        "lua" => "lua",
        "zig" => "zig",
        "hs" => "haskell",
        "ex" | "exs" => "elixir",
        "erl" | "hrl" => "erlang",
        "php" => "php",
        "sh" | "bash" | "zsh" | "fish" => "shellscript",
        "r" => "r",
        "jl" => "julia",
        "dart" => "dart",
        "vue" => "vue",
        "svelte" => "svelte",
        "sql" => "sql",
        "html" => "html",
        "css" | "scss" | "less" => "css",
        "md" | "mdx" => "markdown",
        "json" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" => "xml",
        ext => ext,
    }
    .to_string()
}

/// Chunk a source file into semantic units.
///
/// Uses regex-based heuristics to identify function/class/block boundaries.
/// Falls back to fixed-size line chunks for unrecognized patterns.
fn chunk_file(file_path: &str, content: &str, language: &str) -> Vec<CodeChunk> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();

    // Try semantic chunking based on language patterns
    let semantic_chunks = extract_semantic_chunks(&lines, language);

    if !semantic_chunks.is_empty() {
        for (chunk_type, start, end) in semantic_chunks {
            let chunk_content: String = lines[start..=end.min(lines.len() - 1)].join("\n");

            if chunk_content.trim().is_empty() {
                continue;
            }

            chunks.push(CodeChunk {
                id: format!("{}:{}:{}", file_path, start + 1, end + 1),
                file_path: file_path.to_string(),
                content: chunk_content,
                chunk_type,
                start_line: (start + 1) as u32,
                end_line: (end + 1) as u32,
                language: language.to_string(),
                score: 0.0,
            });
        }
    }

    // If no semantic chunks found, fall back to fixed-size chunks
    if chunks.is_empty() {
        let chunk_size = 30; // lines per chunk
        let overlap = 5;
        let mut start = 0;
        while start < lines.len() {
            let end = (start + chunk_size).min(lines.len());
            let chunk_content: String = lines[start..end].join("\n");

            if !chunk_content.trim().is_empty() {
                chunks.push(CodeChunk {
                    id: format!("{}:{}:{}", file_path, start + 1, end),
                    file_path: file_path.to_string(),
                    content: chunk_content,
                    chunk_type: "block".to_string(),
                    start_line: (start + 1) as u32,
                    end_line: end as u32,
                    language: language.to_string(),
                    score: 0.0,
                });
            }

            if end >= lines.len() {
                break;
            }
            start = end.saturating_sub(overlap);
        }
    }

    chunks
}

/// Extract semantic chunk boundaries (function, class, impl, struct, etc.).
///
/// Returns `Vec<(chunk_type, start_line_idx, end_line_idx)>`.
fn extract_semantic_chunks(lines: &[&str], language: &str) -> Vec<(String, usize, usize)> {
    let mut chunks = Vec::new();

    // Language-specific block-start patterns
    let is_block_start = |line: &str| -> Option<String> {
        let trimmed = line.trim();
        match language {
            "rust" => {
                if trimmed.starts_with("pub fn ")
                    || trimmed.starts_with("fn ")
                    || trimmed.starts_with("pub async fn ")
                    || trimmed.starts_with("async fn ")
                    || trimmed.starts_with("pub(crate) fn ")
                {
                    return Some("function".to_string());
                }
                if trimmed.starts_with("pub struct ") || trimmed.starts_with("struct ") {
                    return Some("class".to_string());
                }
                if trimmed.starts_with("pub enum ") || trimmed.starts_with("enum ") {
                    return Some("class".to_string());
                }
                if trimmed.starts_with("impl ")
                    || trimmed.starts_with("pub trait ")
                    || trimmed.starts_with("trait ")
                {
                    return Some("class".to_string());
                }
                if trimmed.starts_with("pub mod ") || trimmed.starts_with("mod ") {
                    return Some("module".to_string());
                }
                None
            }
            "typescript" | "typescriptreact" | "javascript" | "javascriptreact" => {
                if trimmed.starts_with("function ")
                    || trimmed.starts_with("export function ")
                    || trimmed.starts_with("export default function ")
                    || trimmed.starts_with("export async function ")
                    || trimmed.starts_with("async function ")
                    || trimmed.contains("=> {")
                    || trimmed.contains("=> (")
                {
                    return Some("function".to_string());
                }
                if trimmed.starts_with("class ")
                    || trimmed.starts_with("export class ")
                    || trimmed.starts_with("export default class ")
                    || trimmed.starts_with("abstract class ")
                {
                    return Some("class".to_string());
                }
                if trimmed.starts_with("interface ")
                    || trimmed.starts_with("export interface ")
                    || trimmed.starts_with("type ")
                    || trimmed.starts_with("export type ")
                {
                    return Some("class".to_string());
                }
                // Method definitions
                if (trimmed.contains("(") && trimmed.contains(")") && trimmed.contains("{"))
                    && !trimmed.starts_with("if ")
                    && !trimmed.starts_with("for ")
                    && !trimmed.starts_with("while ")
                    && !trimmed.starts_with("switch ")
                {
                    return Some("function".to_string());
                }
                None
            }
            "python" => {
                if trimmed.starts_with("def ") || trimmed.starts_with("async def ") {
                    return Some("function".to_string());
                }
                if trimmed.starts_with("class ") {
                    return Some("class".to_string());
                }
                None
            }
            "go" => {
                if trimmed.starts_with("func ") {
                    return Some("function".to_string());
                }
                if trimmed.starts_with("type ") && trimmed.contains("struct") {
                    return Some("class".to_string());
                }
                if trimmed.starts_with("type ") && trimmed.contains("interface") {
                    return Some("class".to_string());
                }
                None
            }
            "java" | "kotlin" | "scala" => {
                if trimmed.contains("void ")
                    || trimmed.contains("public ")
                    || trimmed.contains("private ")
                    || trimmed.contains("protected ")
                {
                    if trimmed.contains("(") && trimmed.contains(")") {
                        if trimmed.contains("class ") {
                            return Some("class".to_string());
                        }
                        return Some("function".to_string());
                    }
                    if trimmed.contains("class ") {
                        return Some("class".to_string());
                    }
                }
                if trimmed.starts_with("fun ") || trimmed.starts_with("suspend fun ") {
                    return Some("function".to_string());
                }
                None
            }
            _ => {
                // Generic: look for function/class keywords
                if trimmed.starts_with("function ")
                    || trimmed.starts_with("def ")
                    || trimmed.starts_with("fn ")
                    || trimmed.starts_with("func ")
                {
                    return Some("function".to_string());
                }
                if trimmed.starts_with("class ")
                    || trimmed.starts_with("struct ")
                    || trimmed.starts_with("interface ")
                {
                    return Some("class".to_string());
                }
                None
            }
        }
    };

    let mut i = 0;
    while i < lines.len() {
        if let Some(chunk_type) = is_block_start(lines[i]) {
            let start = i;
            // Find the end of this block by tracking brace depth
            let end = if language == "python" {
                find_python_block_end(lines, i)
            } else {
                find_brace_block_end(lines, i)
            };
            chunks.push((chunk_type, start, end));
            i = end + 1;
        } else {
            i += 1;
        }
    }

    chunks
}

/// Find the end of a brace-delimited block.
fn find_brace_block_end(lines: &[&str], start: usize) -> usize {
    let mut depth = 0i32;
    let mut found_open = false;

    for (i, line) in lines.iter().enumerate().skip(start) {
        for ch in line.chars() {
            if ch == '{' {
                depth += 1;
                found_open = true;
            } else if ch == '}' {
                depth -= 1;
                if found_open && depth == 0 {
                    return i;
                }
            }
        }
    }

    // If no matching brace found, return a reasonable range
    (start + 30).min(lines.len().saturating_sub(1))
}

/// Find the end of a Python indentation-based block.
fn find_python_block_end(lines: &[&str], start: usize) -> usize {
    if start >= lines.len() {
        return start;
    }

    let base_indent = lines[start].len() - lines[start].trim_start().len();

    for (i, line) in lines.iter().enumerate().skip(start + 1) {
        if line.trim().is_empty() {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        if indent <= base_indent {
            return i.saturating_sub(1);
        }
    }

    lines.len().saturating_sub(1)
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Index a workspace: walk files, chunk, embed, and store.
///
/// Emits `ai:index_progress` events during indexing.
#[tauri::command]
pub async fn index_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, super::AIState>,
    workspace_path: String,
) -> Result<IndexStatus, String> {
    use tauri::Emitter;

    let indexer = &state.indexer_state;
    let vector_store = &state.vector_store_state;

    // Check if already indexing
    {
        let status = indexer.status.lock().await;
        if status.is_indexing {
            return Err("Indexing already in progress".to_string());
        }
    }

    // Initialize vector store
    let ws_path = PathBuf::from(&workspace_path);
    vector_store.init(&ws_path).await?;

    // Reset cancel flag
    *indexer.cancel.lock().await = false;

    // Update status
    {
        let mut status = indexer.status.lock().await;
        status.is_indexing = true;
        status.workspace_path = Some(workspace_path.clone());
        status.indexed_files = 0;
        status.total_chunks = 0;
    }

    info!(workspace = %workspace_path, "Starting workspace indexing");

    // Collect files (CPU-bound, use spawn_blocking)
    let ws_path_clone = ws_path.clone();
    let files = tokio::task::spawn_blocking(move || collect_files(&ws_path_clone))
        .await
        .map_err(|e| format!("Failed to collect files: {}", e))?;

    let total_files = files.len();
    info!(total_files = total_files, "Collected files for indexing");

    // Emit initial progress
    let _ = app.emit(
        "ai:index-progress",
        &IndexProgress {
            total_files,
            indexed_files: 0,
            total_chunks: 0,
            done: false,
            current_file: None,
        },
    );

    let mut indexed_files = 0usize;
    let mut total_chunks = 0usize;

    // Process files in batches
    let batch_size = 50;
    for batch in files.chunks(batch_size) {
        // Check cancellation
        if *indexer.cancel.lock().await {
            info!("Indexing cancelled");
            break;
        }

        // Process batch (CPU-bound work)
        let batch_owned: Vec<PathBuf> = batch.to_vec();
        let chunks_batch: Vec<(CodeChunk, Vec<f32>)> = tokio::task::spawn_blocking(move || {
            let mut result = Vec::new();
            for file_path in &batch_owned {
                let content = match std::fs::read_to_string(file_path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let language = detect_language(file_path);
                let file_str = file_path.to_string_lossy().to_string();
                let file_chunks = chunk_file(&file_str, &content, &language);

                for chunk in file_chunks {
                    let embedding = generate_embedding(&chunk.content);
                    result.push((chunk, embedding));
                }
            }
            result
        })
        .await
        .map_err(|e| format!("Chunking task failed: {}", e))?;

        // Store chunks in SQLite
        let store_lock: tokio::sync::MutexGuard<'_, Option<super::vector_store::VectorStore>> =
            vector_store.store.lock().await;
        if let Some(ref store) = *store_lock {
            for (chunk, embedding) in &chunks_batch {
                if let Err(e) = store.upsert_chunk(chunk, embedding) {
                    warn!(error = %e, "Failed to store chunk");
                }
            }
        }
        drop(store_lock);

        indexed_files += batch.len();
        total_chunks += chunks_batch.len();

        // Update status
        {
            let mut status = indexer.status.lock().await;
            status.indexed_files = indexed_files;
            status.total_chunks = total_chunks;
        }

        // Emit progress
        let current_file = batch.last().map(|p| p.to_string_lossy().to_string());
        let _ = app.emit(
            "ai:index-progress",
            &IndexProgress {
                total_files,
                indexed_files,
                total_chunks,
                done: false,
                current_file,
            },
        );
    }

    // Finalize
    {
        let mut status = indexer.status.lock().await;
        status.is_indexing = false;
        status.indexed_files = indexed_files;
        status.total_chunks = total_chunks;
    }

    let _ = app.emit(
        "ai:index-progress",
        &IndexProgress {
            total_files,
            indexed_files,
            total_chunks,
            done: true,
            current_file: None,
        },
    );

    info!(
        indexed_files = indexed_files,
        total_chunks = total_chunks,
        "Workspace indexing complete"
    );

    Ok(IndexStatus {
        is_indexing: false,
        indexed_files,
        total_chunks,
        workspace_path: Some(workspace_path),
    })
}

/// Search the indexed codebase for relevant code chunks.
#[tauri::command]
pub async fn search_codebase(
    state: tauri::State<'_, super::AIState>,
    query: String,
    top_k: Option<usize>,
    language: Option<String>,
) -> Result<Vec<super::vector_store::SearchResult>, String> {
    let vector_store = &state.vector_store_state;
    let k = top_k.unwrap_or(10);

    let query_embedding = generate_embedding(&query);

    let store_lock: tokio::sync::MutexGuard<'_, Option<super::vector_store::VectorStore>> =
        vector_store.store.lock().await;
    match *store_lock {
        Some(ref store) => store.search_similar(&query_embedding, k, language.as_deref()),
        None => Err("Vector store not initialized. Run index_workspace first.".to_string()),
    }
}
