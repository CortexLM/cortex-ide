//! File System Utilities - Helper functions for file operations
//!
//! This module contains utility functions used throughout the fs module,
//! including hidden file detection, file filtering, and sorting.

use rayon::prelude::*;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::fs::types::FileEntry;

// ============================================================================
// File Detection Utilities
// ============================================================================

/// Check if a file is hidden based on name and platform-specific attributes
pub fn is_hidden(name: &str, _path: &Path) -> bool {
    if name.starts_with('.') {
        return true;
    }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(metadata) = std::fs::metadata(_path) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return (metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0;
        }
    }

    false
}

/// Check if a file or directory should be ignored in listings
pub fn should_ignore(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".git"
            | ".svn"
            | ".hg"
            | "__pycache__"
            | ".pytest_cache"
            | ".mypy_cache"
            | ".tox"
            | ".eggs"
            | "*.egg-info"
            | ".venv"
            | "venv"
            | ".env"
            | "env"
            | ".next"
            | ".nuxt"
            | ".cache"
            | ".parcel-cache"
            | "coverage"
            | ".nyc_output"
    )
}

/// Get the file extension from a filename
pub fn get_extension(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
}

/// Convert SystemTime to Unix timestamp
pub fn system_time_to_unix(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH).ok().map(|d| d.as_secs())
}

// ============================================================================
// Sorting Utilities
// ============================================================================

/// Parallel sort using rayon - directories first, then alphabetical
pub fn parallel_sort_entries(entries: &mut [FileEntry]) {
    entries.par_sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
}

// ============================================================================
// Search Skip Utilities
// ============================================================================

/// Check if a file or directory should be skipped during content search
pub fn should_skip_for_search(name: &str) -> bool {
    let skip_dirs = [
        "node_modules",
        ".git",
        "target",
        "dist",
        "build",
        ".next",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        "venv",
        ".venv",
        "coverage",
        ".coverage",
        ".nyc_output",
        ".cache",
        ".parcel-cache",
    ];
    let skip_extensions = [
        "png", "jpg", "jpeg", "gif", "ico", "svg", "webp", "bmp", "mp3", "mp4", "wav", "avi",
        "mov", "mkv", "webm", "zip", "tar", "gz", "rar", "7z", "bz2", "exe", "dll", "so", "dylib",
        "bin", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "woff", "woff2", "ttf", "otf",
        "eot", "lock", "map",
    ];

    // Skip directories
    if skip_dirs.contains(&name) {
        return true;
    }

    // Skip binary/media files by extension
    if let Some(ext) = name.rsplit('.').next() {
        if skip_extensions.iter().any(|e| ext.eq_ignore_ascii_case(e)) {
            return true;
        }
    }

    false
}

/// Check if a path matches any of the exclude patterns
pub fn matches_exclude_pattern(path: &Path, exclude_patterns: &[String]) -> bool {
    let path_str = path.to_string_lossy();

    for pattern in exclude_patterns {
        // Try to match the pattern against the path
        if let Ok(glob_pattern) = glob::Pattern::new(pattern) {
            // Check if the pattern matches the full path or any component
            if glob_pattern.matches(&path_str) {
                return true;
            }

            // Also try matching against just the path components
            // This handles patterns like "**/node_modules/**"
            let normalized_pattern = pattern
                .replace("\\", "/")
                .trim_start_matches("**/")
                .to_string();

            if let Ok(simple_pattern) = glob::Pattern::new(&normalized_pattern) {
                // Check if any part of the path matches
                for component in path.components() {
                    if let std::path::Component::Normal(name) = component {
                        if simple_pattern.matches(&name.to_string_lossy()) {
                            return true;
                        }
                    }
                }
            }

            // Check if the path string contains the pattern's key parts
            // This handles glob patterns that should match directory trees
            let key_part = pattern
                .replace("**/", "")
                .replace("/**", "")
                .replace("*", "");

            if !key_part.is_empty() && path_str.contains(&key_part) {
                return true;
            }
        }
    }

    false
}
