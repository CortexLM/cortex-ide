//! Batch Command System - High-performance IPC batching for Tauri
//!
//! This module provides a batched command execution system to reduce IPC overhead
//! by allowing multiple commands to be sent and executed in a single round-trip.
//!
//! Features:
//! - Parallel command execution using tokio
//! - Result caching for frequently accessed data
//! - MessagePack serialization for large payloads
//! - Automatic cache invalidation on file changes

use dashmap::DashMap;
use lru::LruCache;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tokio::fs;
use tracing::debug;

/// Maximum cache size for file contents
const FILE_CACHE_SIZE: usize = 256;
/// Maximum cache size for metadata
const METADATA_CACHE_SIZE: usize = 512;
/// Maximum cache size for existence checks
const EXISTS_CACHE_SIZE: usize = 1024;

/// Cache TTL for file contents (5 seconds)
const FILE_CACHE_TTL_SECS: u64 = 5;
/// Cache TTL for metadata (10 seconds)
const METADATA_CACHE_TTL_SECS: u64 = 10;
/// Cache TTL for existence checks (10 seconds)
const EXISTS_CACHE_TTL_SECS: u64 = 10;

/// Maximum file size to cache (1MB)
const MAX_CACHEABLE_FILE_SIZE: u64 = 1024 * 1024;

/// Batch command types that can be executed together
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "params")]
#[allow(clippy::enum_variant_names)]
pub enum BatchCommand {
    /// Read a file's contents as text
    #[serde(rename = "fs_read_file")]
    FsReadFile { path: String },

    /// Read multiple files' contents
    #[serde(rename = "fs_read_files")]
    FsReadFiles { paths: Vec<String> },

    /// Get file metadata
    #[serde(rename = "fs_get_metadata")]
    FsGetMetadata { path: String },

    /// Get metadata for multiple files
    #[serde(rename = "fs_get_metadata_batch")]
    FsGetMetadataBatch { paths: Vec<String> },

    /// Check if a file exists
    #[serde(rename = "fs_exists")]
    FsExists { path: String },

    /// Check if multiple files exist
    #[serde(rename = "fs_exists_batch")]
    FsExistsBatch { paths: Vec<String> },

    /// Read binary file as base64
    #[serde(rename = "fs_read_file_binary")]
    FsReadFileBinary { path: String },

    /// Check if path is a file
    #[serde(rename = "fs_is_file")]
    FsIsFile { path: String },

    /// Check if path is a directory
    #[serde(rename = "fs_is_directory")]
    FsIsDirectory { path: String },
}

/// Result of a single batched command execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum BatchResult {
    /// Command succeeded
    #[serde(rename = "ok")]
    Ok {
        data: serde_json::Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        cached: Option<bool>,
    },
    /// Command failed
    #[serde(rename = "error")]
    Error { message: String },
}

impl BatchResult {
    /// Create a successful result
    pub fn ok<T: Serialize>(value: T, cached: bool) -> Self {
        BatchResult::Ok {
            data: serde_json::to_value(value).unwrap_or(serde_json::Value::Null),
            cached: if cached { Some(true) } else { None },
        }
    }

    /// Create an error result
    pub fn error(message: impl Into<String>) -> Self {
        BatchResult::Error {
            message: message.into(),
        }
    }
}

/// Cached entry with timestamp for TTL
#[derive(Clone)]
struct CacheEntry<T> {
    value: T,
    created_at: Instant,
    ttl: Duration,
}

impl<T: Clone> CacheEntry<T> {
    fn new(value: T, ttl_secs: u64) -> Self {
        Self {
            value,
            created_at: Instant::now(),
            ttl: Duration::from_secs(ttl_secs),
        }
    }

    fn is_valid(&self) -> bool {
        self.created_at.elapsed() < self.ttl
    }

    fn get(&self) -> Option<T> {
        if self.is_valid() {
            Some(self.value.clone())
        } else {
            None
        }
    }
}

/// File metadata cached structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedMetadata {
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    #[serde(rename = "isFile")]
    pub is_file: bool,
    #[serde(rename = "isSymlink")]
    pub is_symlink: bool,
    #[serde(rename = "isHidden")]
    pub is_hidden: bool,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
    #[serde(rename = "accessedAt")]
    pub accessed_at: Option<u64>,
    pub readonly: bool,
}

/// State for batch command caching
pub struct BatchCacheState {
    /// LRU cache for file contents
    file_cache: Mutex<LruCache<String, CacheEntry<String>>>,
    /// Fast concurrent map for metadata
    metadata_cache: DashMap<String, CacheEntry<CachedMetadata>>,
    /// Fast concurrent map for existence checks
    exists_cache: DashMap<String, CacheEntry<bool>>,
    /// Track invalidated paths (set by file watcher)
    invalidated_paths: DashMap<String, Instant>,
}

impl BatchCacheState {
    pub fn new() -> Self {
        Self {
            #[allow(clippy::unwrap_used)]
            file_cache: Mutex::new(LruCache::new(NonZeroUsize::new(FILE_CACHE_SIZE).unwrap())),
            metadata_cache: DashMap::with_capacity(METADATA_CACHE_SIZE),
            exists_cache: DashMap::with_capacity(EXISTS_CACHE_SIZE),
            invalidated_paths: DashMap::new(),
        }
    }

    /// Invalidate cache for a specific path
    pub fn invalidate(&self, path: &str) {
        let normalized = normalize_path(path);

        // Mark as invalidated
        self.invalidated_paths
            .insert(normalized.clone(), Instant::now());

        // Remove from all caches
        self.file_cache.lock().pop(&normalized);
        self.metadata_cache.remove(&normalized);
        self.exists_cache.remove(&normalized);

        // Also invalidate parent directory for existence cache
        if let Some(parent) = PathBuf::from(&normalized).parent() {
            let parent_str = parent.to_string_lossy().to_string();
            self.exists_cache.remove(&parent_str);
        }

        debug!("Invalidated cache for: {}", normalized);
    }

    /// Invalidate all caches for paths under a directory
    pub fn invalidate_directory(&self, dir_path: &str) {
        let normalized = normalize_path(dir_path);

        // Remove all entries that start with this path
        self.file_cache.lock().iter().for_each(|(k, _)| {
            if k.starts_with(&normalized) {
                self.invalidated_paths.insert(k.clone(), Instant::now());
            }
        });

        self.metadata_cache
            .retain(|k, _| !k.starts_with(&normalized));
        self.exists_cache.retain(|k, _| !k.starts_with(&normalized));

        debug!("Invalidated cache for directory: {}", normalized);
    }

    /// Clean up old invalidation records
    pub fn cleanup_invalidations(&self) {
        let threshold = Duration::from_secs(60);
        self.invalidated_paths
            .retain(|_, instant| instant.elapsed() < threshold);
    }

    /// Get cached file content
    fn get_file(&self, path: &str) -> Option<String> {
        let normalized = normalize_path(path);

        // Check if recently invalidated
        if self.invalidated_paths.contains_key(&normalized) {
            return None;
        }

        self.file_cache
            .lock()
            .get(&normalized)
            .and_then(|e| e.get())
    }

    /// Cache file content
    fn put_file(&self, path: &str, content: String) {
        let normalized = normalize_path(path);
        self.file_cache
            .lock()
            .put(normalized, CacheEntry::new(content, FILE_CACHE_TTL_SECS));
    }

    /// Get cached metadata
    fn get_metadata(&self, path: &str) -> Option<CachedMetadata> {
        let normalized = normalize_path(path);

        if self.invalidated_paths.contains_key(&normalized) {
            return None;
        }

        self.metadata_cache.get(&normalized).and_then(|e| e.get())
    }

    /// Cache metadata
    fn put_metadata(&self, path: &str, metadata: CachedMetadata) {
        let normalized = normalize_path(path);
        self.metadata_cache.insert(
            normalized,
            CacheEntry::new(metadata, METADATA_CACHE_TTL_SECS),
        );
    }

    /// Get cached existence check
    fn get_exists(&self, path: &str) -> Option<bool> {
        let normalized = normalize_path(path);

        if self.invalidated_paths.contains_key(&normalized) {
            return None;
        }

        self.exists_cache.get(&normalized).and_then(|e| e.get())
    }

    /// Cache existence check
    fn put_exists(&self, path: &str, exists: bool) {
        let normalized = normalize_path(path);
        self.exists_cache
            .insert(normalized, CacheEntry::new(exists, EXISTS_CACHE_TTL_SECS));
    }

    /// Get cache statistics for debugging
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            file_cache_size: self.file_cache.lock().len(),
            metadata_cache_size: self.metadata_cache.len(),
            exists_cache_size: self.exists_cache.len(),
            invalidated_paths: self.invalidated_paths.len(),
        }
    }
}

impl Default for BatchCacheState {
    fn default() -> Self {
        Self::new()
    }
}

/// Cache statistics for debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub file_cache_size: usize,
    pub metadata_cache_size: usize,
    pub exists_cache_size: usize,
    pub invalidated_paths: usize,
}

/// Normalize path for consistent cache keys
fn normalize_path(path: &str) -> String {
    PathBuf::from(path)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string())
}

/// Check if a file name is hidden
fn is_hidden(name: &str, path: &std::path::Path) -> bool {
    if name.starts_with('.') {
        return true;
    }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0;
        }
    }

    let _ = path; // Silence unused warning on non-Windows

    false
}

/// Execute a single batch command
async fn execute_command(command: BatchCommand, cache: &Arc<BatchCacheState>) -> BatchResult {
    match command {
        BatchCommand::FsReadFile { path } => execute_fs_read_file(&path, cache).await,
        BatchCommand::FsReadFiles { paths } => execute_fs_read_files(paths, cache).await,
        BatchCommand::FsGetMetadata { path } => execute_fs_get_metadata(&path, cache).await,
        BatchCommand::FsGetMetadataBatch { paths } => {
            execute_fs_get_metadata_batch(paths, cache).await
        }
        BatchCommand::FsExists { path } => execute_fs_exists(&path, cache).await,
        BatchCommand::FsExistsBatch { paths } => execute_fs_exists_batch(paths, cache).await,
        BatchCommand::FsReadFileBinary { path } => execute_fs_read_file_binary(&path).await,
        BatchCommand::FsIsFile { path } => execute_fs_is_file(&path).await,
        BatchCommand::FsIsDirectory { path } => execute_fs_is_directory(&path).await,
    }
}

async fn execute_fs_read_file(path: &str, cache: &Arc<BatchCacheState>) -> BatchResult {
    // Check cache first
    if let Some(content) = cache.get_file(path) {
        return BatchResult::ok(content, true);
    }

    let file_path = PathBuf::from(path);

    if !file_path.exists() {
        return BatchResult::error(format!("File does not exist: {}", path));
    }

    if !file_path.is_file() {
        return BatchResult::error(format!("Path is not a file: {}", path));
    }

    // Check file size before reading
    match fs::metadata(&file_path).await {
        Ok(meta) if meta.len() > MAX_CACHEABLE_FILE_SIZE => {
            // Don't cache large files, just read directly
            match fs::read_to_string(&file_path).await {
                Ok(content) => BatchResult::ok(content, false),
                Err(e) => BatchResult::error(format!("Failed to read file: {}", e)),
            }
        }
        Ok(_) => match fs::read_to_string(&file_path).await {
            Ok(content) => {
                cache.put_file(path, content.clone());
                BatchResult::ok(content, false)
            }
            Err(e) => BatchResult::error(format!("Failed to read file: {}", e)),
        },
        Err(e) => BatchResult::error(format!("Failed to get file metadata: {}", e)),
    }
}

async fn execute_fs_read_files(paths: Vec<String>, cache: &Arc<BatchCacheState>) -> BatchResult {
    let futures: Vec<_> = paths
        .into_iter()
        .map(|path| {
            let cache = Arc::clone(cache);
            async move {
                let result = execute_fs_read_file(&path, &cache).await;
                (path, result)
            }
        })
        .collect();

    let results: Vec<_> = futures::future::join_all(futures).await;

    let results_map: std::collections::HashMap<String, BatchResult> = results.into_iter().collect();
    BatchResult::ok(results_map, false)
}

async fn execute_fs_get_metadata(path: &str, cache: &Arc<BatchCacheState>) -> BatchResult {
    // Check cache first
    if let Some(metadata) = cache.get_metadata(path) {
        return BatchResult::ok(metadata, true);
    }

    let file_path = PathBuf::from(path);

    if !file_path.exists() {
        return BatchResult::error(format!("Path does not exist: {}", path));
    }

    match fs::metadata(&file_path).await {
        Ok(metadata) => {
            let symlink_metadata = fs::symlink_metadata(&file_path).await.ok();

            let name = file_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            let created_at = metadata
                .created()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            let accessed_at = metadata
                .accessed()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            let cached_metadata = CachedMetadata {
                path: path.to_string(),
                is_dir: metadata.is_dir(),
                is_file: metadata.is_file(),
                is_symlink: symlink_metadata
                    .map(|m| m.file_type().is_symlink())
                    .unwrap_or(false),
                is_hidden: is_hidden(&name, &file_path),
                size: metadata.len(),
                modified_at,
                created_at,
                accessed_at,
                readonly: metadata.permissions().readonly(),
            };

            cache.put_metadata(path, cached_metadata.clone());
            BatchResult::ok(cached_metadata, false)
        }
        Err(e) => BatchResult::error(format!("Failed to get metadata: {}", e)),
    }
}

async fn execute_fs_get_metadata_batch(
    paths: Vec<String>,
    cache: &Arc<BatchCacheState>,
) -> BatchResult {
    let futures: Vec<_> = paths
        .into_iter()
        .map(|path| {
            let cache = Arc::clone(cache);
            async move {
                let result = execute_fs_get_metadata(&path, &cache).await;
                (path, result)
            }
        })
        .collect();

    let results: Vec<_> = futures::future::join_all(futures).await;

    let results_map: std::collections::HashMap<String, BatchResult> = results.into_iter().collect();
    BatchResult::ok(results_map, false)
}

async fn execute_fs_exists(path: &str, cache: &Arc<BatchCacheState>) -> BatchResult {
    // Check cache first
    if let Some(exists) = cache.get_exists(path) {
        return BatchResult::ok(exists, true);
    }

    let exists = PathBuf::from(path).exists();
    cache.put_exists(path, exists);
    BatchResult::ok(exists, false)
}

async fn execute_fs_exists_batch(paths: Vec<String>, cache: &Arc<BatchCacheState>) -> BatchResult {
    let results: std::collections::HashMap<String, bool> = paths
        .into_iter()
        .map(|path| {
            let exists = if let Some(cached) = cache.get_exists(&path) {
                cached
            } else {
                let exists = PathBuf::from(&path).exists();
                cache.put_exists(&path, exists);
                exists
            };
            (path, exists)
        })
        .collect();

    BatchResult::ok(results, false)
}

async fn execute_fs_read_file_binary(path: &str) -> BatchResult {
    let file_path = PathBuf::from(path);

    if !file_path.exists() {
        return BatchResult::error(format!("File does not exist: {}", path));
    }

    match fs::read(&file_path).await {
        Ok(bytes) => {
            use base64::{Engine, engine::general_purpose::STANDARD};
            BatchResult::ok(STANDARD.encode(bytes), false)
        }
        Err(e) => BatchResult::error(format!("Failed to read file: {}", e)),
    }
}

async fn execute_fs_is_file(path: &str) -> BatchResult {
    BatchResult::ok(PathBuf::from(path).is_file(), false)
}

async fn execute_fs_is_directory(path: &str) -> BatchResult {
    BatchResult::ok(PathBuf::from(path).is_dir(), false)
}

/// Execute multiple commands in a batch with parallel execution
#[tauri::command]
pub async fn batch_commands(app: AppHandle, commands: Vec<BatchCommand>) -> Vec<BatchResult> {
    let cache = app.state::<Arc<BatchCacheState>>();
    let cache = Arc::clone(&cache);

    // Execute all commands in parallel
    let futures: Vec<_> = commands
        .into_iter()
        .map(|cmd| {
            let cache = Arc::clone(&cache);
            async move { execute_command(cmd, &cache).await }
        })
        .collect();

    futures::future::join_all(futures).await
}

/// Execute batch commands with MessagePack serialization for large payloads
/// Input and output are base64-encoded MessagePack
#[tauri::command]
pub async fn batch_commands_msgpack(app: AppHandle, data: String) -> Result<String, String> {
    use base64::{Engine, engine::general_purpose::STANDARD};

    // Decode base64 input
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| format!("Invalid base64 input: {}", e))?;

    // Deserialize MessagePack commands
    let commands: Vec<BatchCommand> =
        rmp_serde::from_slice(&bytes).map_err(|e| format!("Invalid MessagePack data: {}", e))?;

    let cache = app.state::<Arc<BatchCacheState>>();
    let cache = Arc::clone(&cache);

    // Execute commands
    let futures: Vec<_> = commands
        .into_iter()
        .map(|cmd| {
            let cache = Arc::clone(&cache);
            async move { execute_command(cmd, &cache).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Serialize results to MessagePack
    let result_bytes =
        rmp_serde::to_vec(&results).map_err(|e| format!("Failed to serialize results: {}", e))?;

    // Encode as base64
    Ok(STANDARD.encode(result_bytes))
}

/// Invalidate cache for a path (called from file watcher)
#[tauri::command]
pub async fn batch_cache_invalidate(app: AppHandle, path: String) {
    let cache = app.state::<Arc<BatchCacheState>>();
    cache.invalidate(&path);
}

/// Invalidate cache for a directory (called from file watcher)
#[tauri::command]
pub async fn batch_cache_invalidate_directory(app: AppHandle, path: String) {
    let cache = app.state::<Arc<BatchCacheState>>();
    cache.invalidate_directory(&path);
}

/// Get cache statistics
#[tauri::command]
pub async fn batch_cache_stats(app: AppHandle) -> CacheStats {
    let cache = app.state::<Arc<BatchCacheState>>();
    cache.stats()
}

/// Clear all caches
#[tauri::command]
pub async fn batch_cache_clear(app: AppHandle) {
    let cache = app.state::<Arc<BatchCacheState>>();
    cache.file_cache.lock().clear();
    cache.metadata_cache.clear();
    cache.exists_cache.clear();
    cache.invalidated_paths.clear();
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path() {
        let path = "src/main.rs";
        let normalized = normalize_path(path);
        assert!(!normalized.is_empty());
    }

    #[test]
    fn test_cache_entry_validity() {
        let entry = CacheEntry::new("test".to_string(), 1);
        assert!(entry.is_valid());
        assert_eq!(entry.get(), Some("test".to_string()));
    }

    #[test]
    fn test_batch_result_serialization() {
        let ok_result = BatchResult::ok("test data", false);
        let serialized = serde_json::to_string(&ok_result).unwrap();
        assert!(serialized.contains("ok"));

        let error_result = BatchResult::error("test error");
        let serialized = serde_json::to_string(&error_result).unwrap();
        assert!(serialized.contains("error"));
    }

    #[test]
    fn test_cache_state_invalidation() {
        let cache = BatchCacheState::new();
        cache.put_file("/test/path.txt", "content".to_string());
        cache.put_exists("/test/path.txt", true);

        assert!(cache.get_file("/test/path.txt").is_some());
        assert!(cache.get_exists("/test/path.txt").is_some());

        cache.invalidate("/test/path.txt");

        assert!(cache.get_file("/test/path.txt").is_none());
        assert!(cache.get_exists("/test/path.txt").is_none());
    }
}
