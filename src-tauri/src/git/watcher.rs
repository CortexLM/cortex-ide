//! Git repository file watching.

use std::time::Duration;
use tauri::Emitter;
use tracing::{info, warn};

// ============================================================================
// Repository Watcher
// ============================================================================

/// Watch a git repository's .git directory for changes
/// Emits "git:repository-changed" events when changes are detected
#[tauri::command]
pub async fn git_watch_repository(
    path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let watch_id = format!(
        "watch-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let git_dir = std::path::Path::new(&path).join(".git");

    if !git_dir.exists() {
        return Err("Not a git repository: .git directory not found".to_string());
    }

    let watch_id_clone = watch_id.clone();
    let path_clone = path.clone();

    // Spawn watcher in background thread
    std::thread::spawn(move || {
        let mut last_emit = std::time::Instant::now();
        let debounce_duration = Duration::from_millis(500);

        // Simple polling-based watcher for .git directory
        // Check for modifications every 500ms
        loop {
            std::thread::sleep(Duration::from_millis(500));

            // Check if HEAD, index, or refs changed
            let head_path = git_dir.join("HEAD");
            let index_path = git_dir.join("index");

            let should_emit = if let (Ok(head_meta), Ok(index_meta)) = (
                std::fs::metadata(&head_path),
                std::fs::metadata(&index_path),
            ) {
                // Check if modified recently (within last second)
                if let (Ok(head_modified), Ok(index_modified)) =
                    (head_meta.modified(), index_meta.modified())
                {
                    let now = std::time::SystemTime::now();
                    let one_sec = Duration::from_secs(1);

                    now.duration_since(head_modified)
                        .map(|d| d < one_sec)
                        .unwrap_or(false)
                        || now
                            .duration_since(index_modified)
                            .map(|d| d < one_sec)
                            .unwrap_or(false)
                } else {
                    false
                }
            } else {
                false
            };

            if should_emit && last_emit.elapsed() > debounce_duration {
                if let Err(e) = app_handle.emit("git:repository-changed", &path_clone) {
                    warn!("Failed to emit git:repository-changed event: {}", e);
                }
                last_emit = std::time::Instant::now();
            }
        }
    });

    info!("Started git watcher {} for {}", watch_id_clone, path);
    Ok(watch_id)
}
