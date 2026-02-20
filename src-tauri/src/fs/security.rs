//! Path Security - Path traversal protection and validation
//!
//! This module provides security functions to validate file paths and prevent
//! path traversal attacks, symlink escapes, and access to restricted directories.

use std::path::{Component, Path, PathBuf};

// ============================================================================
// Path Traversal Protection
// ============================================================================

/// Allowed root directories for file operations.
/// These are typically the user's home directory and common workspace locations.
pub fn get_allowed_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // User's home directory
    if let Some(home) = dirs::home_dir() {
        roots.push(home);
    }

    // Common development directories
    if let Some(docs) = dirs::document_dir() {
        roots.push(docs);
    }

    // Temp directory for temporary files
    roots.push(std::env::temp_dir());

    // On Windows, add common development paths and drives with user directories
    // Note: Development tools typically need broad file access for projects that can
    // be located anywhere. The sandbox here primarily protects against path traversal
    // attacks (../../../ patterns) rather than restricting which drives can be accessed.
    #[cfg(windows)]
    {
        // Add current working directory and its drive
        if let Ok(cwd) = std::env::current_dir() {
            roots.push(cwd);
        }

        // Add common Windows development paths
        let dev_paths = [
            "C:\\dev",
            "C:\\projects",
            "C:\\src",
            "C:\\Users",
            "D:\\dev",
            "D:\\projects",
        ];
        for p in dev_paths {
            let path = PathBuf::from(p);
            if path.exists() && !roots.contains(&path) {
                roots.push(path);
            }
        }

        // Add drive roots for drives that have user directories
        // This allows accessing projects on secondary drives
        for letter in b'C'..=b'Z' {
            let users_path = format!("{}:\\Users", letter as char);
            if PathBuf::from(&users_path).exists() {
                let drive = PathBuf::from(format!("{}:\\", letter as char));
                if !roots.contains(&drive) {
                    roots.push(drive);
                }
            }
        }
    }

    // On Unix, allow common development paths
    #[cfg(unix)]
    {
        let unix_paths = ["/home", "/Users", "/tmp", "/var/tmp"];
        for p in unix_paths {
            let path = PathBuf::from(p);
            if path.exists() {
                roots.push(path);
            }
        }
    }

    roots
}

/// Normalizes a path by resolving `.` and `..` components without filesystem access.
pub fn normalize_path_components(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::ParentDir => {
                // Only pop if we have something to pop and it's not a root
                if !normalized.pop() {
                    // If we can't pop, this is an attempt to go above root
                    // For relative paths, preserve the ..
                    if !path.is_absolute() {
                        normalized.push("..");
                    }
                }
            }
            Component::CurDir => {
                // Skip current directory markers
            }
            _ => {
                normalized.push(component);
            }
        }
    }

    normalized
}

/// Checks if a path contains path traversal sequences.
#[allow(dead_code)]
pub fn contains_path_traversal(path: &Path) -> bool {
    path.components().any(|c| matches!(c, Component::ParentDir))
}

/// Validates that a path is safe for file operations.
///
/// This function:
/// 1. Checks for path traversal sequences
/// 2. Normalizes the path
/// 3. Validates the path is within allowed roots
/// 4. Handles symlinks securely
pub fn validate_path_safe(path: &Path) -> Result<PathBuf, String> {
    // Normalize the path first
    let normalized = normalize_path_components(path);

    // If path exists, canonicalize it to resolve symlinks
    let canonical = if path.exists() {
        path.canonicalize()
            .map_err(|e| format!("Failed to canonicalize path: {}", e))?
    } else {
        // For non-existent paths, check if parent exists and canonicalize that
        if let Some(parent) = normalized.parent() {
            if parent.exists() {
                let canonical_parent = parent
                    .canonicalize()
                    .map_err(|e| format!("Failed to canonicalize parent: {}", e))?;
                let file_name = normalized
                    .file_name()
                    .ok_or_else(|| "Invalid file name".to_string())?;
                canonical_parent.join(file_name)
            } else {
                normalized.clone()
            }
        } else {
            normalized.clone()
        }
    };

    // Check against allowed roots
    let allowed_roots = get_allowed_roots();
    let is_within_allowed = allowed_roots.iter().any(|root| {
        if let Ok(canonical_root) = root.canonicalize() {
            canonical.starts_with(&canonical_root)
        } else {
            canonical.starts_with(root)
        }
    });

    if !is_within_allowed {
        return Err(format!(
            "Path '{}' is outside allowed directories",
            path.display()
        ));
    }

    // Additional symlink check for existing paths
    if path.exists() {
        if let Ok(metadata) = std::fs::symlink_metadata(path) {
            if metadata.file_type().is_symlink() {
                // Read the symlink target and validate it too
                if let Ok(target) = std::fs::read_link(path) {
                    let absolute_target = if target.is_absolute() {
                        target
                    } else {
                        path.parent().map(|p| p.join(&target)).unwrap_or(target)
                    };

                    let target_canonical = if absolute_target.exists() {
                        absolute_target
                            .canonicalize()
                            .map_err(|e| format!("Failed to canonicalize symlink target: {}", e))?
                    } else {
                        normalize_path_components(&absolute_target)
                    };

                    let target_is_safe = allowed_roots.iter().any(|root| {
                        if let Ok(canonical_root) = root.canonicalize() {
                            target_canonical.starts_with(&canonical_root)
                        } else {
                            target_canonical.starts_with(root)
                        }
                    });

                    if !target_is_safe {
                        return Err(format!(
                            "Symlink '{}' points outside allowed directories",
                            path.display()
                        ));
                    }
                }
            }
        }
    }

    Ok(canonical)
}

/// Validates a path for read operations (less restrictive).
pub fn validate_path_for_read(path: &Path) -> Result<PathBuf, String> {
    validate_path_safe(path)
}

/// Validates a path for write operations.
pub fn validate_path_for_write(path: &Path) -> Result<PathBuf, String> {
    // For write operations, check that we're not writing to system directories
    let normalized = normalize_path_components(path);

    // Forbid writing to obvious system paths
    let forbidden_prefixes: &[&str] = if cfg!(windows) {
        &[
            "C:\\Windows",
            "C:\\Program Files",
            "C:\\Program Files (x86)",
        ]
    } else {
        &[
            "/bin",
            "/sbin",
            "/usr/bin",
            "/usr/sbin",
            "/etc",
            "/var/log",
            "/boot",
        ]
    };

    let path_str = normalized.to_string_lossy().to_lowercase();
    for prefix in forbidden_prefixes {
        if path_str.starts_with(&prefix.to_lowercase()) {
            return Err(format!(
                "Writing to system directory '{}' is not allowed",
                path.display()
            ));
        }
    }

    validate_path_safe(path)
}

/// Validates a path for delete operations (most restrictive).
pub fn validate_path_for_delete(path: &Path) -> Result<PathBuf, String> {
    // Apply write validation first
    let validated = validate_path_for_write(path)?;

    // Additional checks for delete operations
    let normalized = normalize_path_components(path);

    // Prevent deletion of home directory itself
    if let Some(home) = dirs::home_dir() {
        if normalized == home || validated == home {
            return Err("Cannot delete home directory".to_string());
        }
    }

    // Prevent deletion of root directories
    if normalized.parent().is_none() || normalized.as_os_str().is_empty() {
        return Err("Cannot delete root directory".to_string());
    }

    Ok(validated)
}
