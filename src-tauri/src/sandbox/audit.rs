//! Security audit functions for Windows sandbox.
//!
//! This module provides functions to audit the security state
//! of the sandbox, including checking for world-writable paths.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Configuration for security audit.
#[derive(Debug, Clone)]
pub struct AuditConfig {
    /// Maximum number of paths to check
    pub max_paths: usize,
    /// Timeout for the audit operation
    pub timeout: Duration,
    /// Include hidden files/directories
    pub include_hidden: bool,
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            max_paths: 50_000,
            timeout: Duration::from_secs(2),
            include_hidden: false,
        }
    }
}

/// Result of a security audit.
#[derive(Debug, Clone)]
pub struct AuditResult {
    /// Paths that are world-writable (potential security issues)
    pub world_writable_paths: Vec<PathBuf>,
    /// Warning messages
    pub warnings: Vec<String>,
    /// Number of paths checked
    pub paths_checked: usize,
    /// Time taken for the audit
    pub duration: Duration,
    /// Whether the audit was truncated due to limits
    pub truncated: bool,
}

/// Audit a directory for world-writable paths.
///
/// This function walks the directory tree and checks each path
/// for overly permissive access controls.
pub fn audit_world_writable(root: &Path, config: &AuditConfig) -> AuditResult {
    let start = Instant::now();
    let mut result = AuditResult {
        world_writable_paths: Vec::new(),
        warnings: Vec::new(),
        paths_checked: 0,
        duration: Duration::ZERO,
        truncated: false,
    };

    let walker = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if !config.include_hidden {
                !is_hidden(e.path())
            } else {
                true
            }
        });

    for entry in walker {
        // Check timeout
        if start.elapsed() > config.timeout {
            result.truncated = true;
            result
                .warnings
                .push(format!("Audit timed out after {:?}", config.timeout));
            break;
        }

        // Check path limit
        if result.paths_checked >= config.max_paths {
            result.truncated = true;
            result.warnings.push(format!(
                "Audit stopped after checking {} paths",
                config.max_paths
            ));
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                result
                    .warnings
                    .push(format!("Error accessing path: {}", err));
                continue;
            }
        };

        result.paths_checked += 1;

        // Check if world-writable (simplified check)
        if let Ok(is_ww) = super::acl::is_world_writable(entry.path()) {
            if is_ww {
                result.world_writable_paths.push(entry.path().to_path_buf());
            }
        }
    }

    result.duration = start.elapsed();
    result
}

/// Quick pre-flight check for common world-writable locations.
pub fn quick_world_writable_check(paths: &[PathBuf]) -> Vec<PathBuf> {
    let mut results = Vec::new();

    for path in paths {
        if let Ok(true) = super::acl::is_world_writable(path) {
            results.push(path.clone());
        }
    }

    results
}

/// Check if a path is hidden (starts with .).
fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_audit_config_default() {
        let config = AuditConfig::default();
        assert_eq!(config.max_paths, 50_000);
        assert_eq!(config.timeout, Duration::from_secs(2));
    }

    #[test]
    fn test_audit_temp_dir() {
        let config = AuditConfig {
            max_paths: 100,
            timeout: Duration::from_millis(500),
            include_hidden: false,
        };

        let result = audit_world_writable(&env::temp_dir(), &config);
        assert!(result.paths_checked > 0);
    }

    #[test]
    fn test_is_hidden() {
        assert!(is_hidden(Path::new(".hidden")));
        assert!(is_hidden(Path::new("/path/to/.hidden")));
        assert!(!is_hidden(Path::new("visible")));
        assert!(!is_hidden(Path::new("/path/to/visible")));
    }
}
