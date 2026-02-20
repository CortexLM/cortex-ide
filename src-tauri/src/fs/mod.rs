//! File System Module - High-Performance Parallel File Operations for Cortex Desktop
//!
//! This module provides Tauri commands for all file system operations with
//! optimizations including:
//! - Parallel directory reading with tokio JoinSet
//! - Thread-safe LRU caching with DashMap
//! - Rayon for CPU-bound sorting/filtering
//! - Semaphore-limited concurrency to prevent file handle exhaustion
//! - Shallow tree loading for lazy UI loading
//! - Background prefetching for cache warming
//! - Path traversal protection for all file operations
//!
//! # Module Structure
//!
//! - `types` - Data structures (FileEntry, FileMetadata, cache types, etc.)
//! - `security` - Path validation and traversal protection
//! - `utils` - Helper functions (hidden file detection, sorting, etc.)
//! - `operations` - File CRUD operations (read, write, copy, move, delete)
//! - `directory` - Directory operations and tree traversal
//! - `watcher` - File system change monitoring
//! - `search` - File name and content search
//! - `encoding` - File encoding detection and conversion
//! - `workspace_edit` - Text edit operations for refactoring

pub mod directory;
pub mod encoding;
pub mod operations;
pub mod search;
pub mod security;
pub mod types;
pub mod utils;
pub mod watcher;
pub mod workspace_edit;

// Re-export types for public use
pub use types::{DirectoryCache, FileWatcherState, IoSemaphore};

// Re-export everything from submodules for Tauri command registration
// Note: Tauri's #[tauri::command] macro generates internal items that need to be accessible
// from the module path used in invoke_handler!, so we use glob re-exports.

// Operations module - file CRUD
pub use operations::*;

// Directory module - directory operations and tree traversal
pub use directory::*;

// Watcher module - file system monitoring
pub use watcher::*;

// Search module - file and content search
pub use search::*;

// Encoding module - encoding detection and conversion
pub use encoding::*;

// Workspace edit module - text edit operations
pub use workspace_edit::*;

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::types::FileEntry;
    use super::*;
    use std::path::Path;

    #[test]
    fn test_is_hidden() {
        use utils::is_hidden;
        assert!(is_hidden(".gitignore", Path::new(".gitignore")));
        assert!(is_hidden(".env", Path::new(".env")));
        assert!(!is_hidden("README.md", Path::new("README.md")));
    }

    #[test]
    fn test_should_ignore() {
        use utils::should_ignore;
        assert!(should_ignore("node_modules"));
        assert!(should_ignore("target"));
        assert!(should_ignore(".git"));
        assert!(!should_ignore("src"));
        assert!(!should_ignore("lib"));
    }

    #[test]
    fn test_get_extension() {
        use utils::get_extension;
        assert_eq!(get_extension("file.ts"), Some("ts".to_string()));
        assert_eq!(get_extension("file.test.tsx"), Some("tsx".to_string()));
        assert_eq!(get_extension("Makefile"), None);
    }

    #[test]
    fn test_directory_cache() {
        let cache = DirectoryCache::new();

        let entries = vec![FileEntry {
            name: "test.txt".to_string(),
            path: "/test/test.txt".to_string(),
            is_dir: false,
            is_hidden: false,
            is_symlink: false,
            size: Some(100),
            modified_at: Some(1234567890),
            extension: Some("txt".to_string()),
            children: None,
        }];

        cache.insert("/test".to_string(), entries.clone());

        let cached = cache.get("/test");
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().len(), 1);

        cache.invalidate("/test");
        assert!(cache.get("/test").is_none());
    }

    #[test]
    fn test_parallel_sort() {
        use utils::parallel_sort_entries;

        let mut entries = vec![
            FileEntry {
                name: "zebra.txt".to_string(),
                path: "/zebra.txt".to_string(),
                is_dir: false,
                is_hidden: false,
                is_symlink: false,
                size: Some(100),
                modified_at: None,
                extension: Some("txt".to_string()),
                children: None,
            },
            FileEntry {
                name: "src".to_string(),
                path: "/src".to_string(),
                is_dir: true,
                is_hidden: false,
                is_symlink: false,
                size: None,
                modified_at: None,
                extension: None,
                children: None,
            },
            FileEntry {
                name: "alpha.txt".to_string(),
                path: "/alpha.txt".to_string(),
                is_dir: false,
                is_hidden: false,
                is_symlink: false,
                size: Some(50),
                modified_at: None,
                extension: Some("txt".to_string()),
                children: None,
            },
        ];

        parallel_sort_entries(&mut entries);

        assert_eq!(entries[0].name, "src");
        assert_eq!(entries[1].name, "alpha.txt");
        assert_eq!(entries[2].name, "zebra.txt");
    }
}
