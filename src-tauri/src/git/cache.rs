//! Git status caching for performance optimization.

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use super::types::StatusResponse;

// ============================================================================
// Git Status Cache
// ============================================================================

/// Cache entry for git status with timestamp for invalidation
#[derive(Clone)]
pub struct StatusCacheEntry {
    pub response: StatusResponse,
    pub timestamp: Instant,
    pub head_sha: Option<String>,
}

/// Global cache for git status to avoid repeated expensive operations
/// Key is the repository path, value is cached status with timestamp
pub static STATUS_CACHE: Lazy<Arc<RwLock<HashMap<String, StatusCacheEntry>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Cache TTL - status is considered stale after this duration
pub const CACHE_TTL: Duration = Duration::from_millis(500);

/// Maximum number of files to include in status response (for large repos)
pub const MAX_STATUS_FILES: usize = 5000;

/// Check if cached status is still valid
pub fn get_cached_status(path: &str, current_head: &Option<String>) -> Option<StatusResponse> {
    if let Ok(cache) = STATUS_CACHE.read() {
        if let Some(entry) = cache.get(path) {
            // Check if cache is still fresh
            if entry.timestamp.elapsed() < CACHE_TTL {
                // Also verify HEAD hasn't changed (quick invalidation check)
                if entry.head_sha.as_ref() == current_head.as_ref() {
                    return Some(entry.response.clone());
                }
            }
        }
    }
    None
}

/// Store status in cache
pub fn cache_status(path: &str, response: StatusResponse, head_sha: Option<String>) {
    if let Ok(mut cache) = STATUS_CACHE.write() {
        // Limit cache size to prevent memory bloat
        if cache.len() > 100 {
            // Remove oldest entries
            let mut entries: Vec<_> = cache
                .iter()
                .map(|(k, v)| (k.clone(), v.timestamp))
                .collect();
            entries.sort_by_key(|(_, t)| *t);
            for (key, _) in entries.into_iter().take(50) {
                cache.remove(&key);
            }
        }

        cache.insert(
            path.to_string(),
            StatusCacheEntry {
                response,
                timestamp: Instant::now(),
                head_sha,
            },
        );
    }
}
