//! Watch mode functionality for test auto-running

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::LazyState;

/// State for managing test watchers
pub struct TestWatcherState {
    watchers: Mutex<HashMap<String, WatcherHandle>>,
}

impl TestWatcherState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }

    /// Stop all test watchers (for cleanup on exit)
    pub fn stop_all(&self) -> Result<u32, String> {
        let mut watchers = self
            .watchers
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        let count = watchers.len() as u32;

        for (id, handle) in watchers.drain() {
            let _ = handle.shutdown_tx.try_send(());
            tracing::info!("Test watcher {} stopped", id);
        }

        Ok(count)
    }
}

struct WatcherHandle {
    shutdown_tx: mpsc::Sender<()>,
}

/// Start watching for test file changes and auto-run tests
#[tauri::command]
pub async fn testing_watch(
    path: String,
    framework: String,
    pattern: Option<String>,
    app: AppHandle,
) -> Result<String, String> {
    let watcher_id = Uuid::new_v4().to_string();
    let path_buf = PathBuf::from(&path);

    // Validate path exists
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Create shutdown channel
    let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);

    // Get the watcher state
    let watcher_state = app.try_state::<LazyState<TestWatcherState>>();

    // Store watcher handle
    if let Some(state) = watcher_state {
        let mut watchers = state
            .get()
            .watchers
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        watchers.insert(watcher_id.clone(), WatcherHandle { shutdown_tx });
    }

    let watcher_id_clone = watcher_id.clone();
    let app_clone = app.clone();
    let framework_clone = framework.clone();
    let path_clone = path.clone();

    // Spawn watcher task
    tokio::spawn(async move {
        // Determine test file patterns based on framework
        let test_patterns = match framework_clone.to_lowercase().as_str() {
            "jest" | "vitest" => vec![
                "**/*.test.ts",
                "**/*.test.tsx",
                "**/*.test.js",
                "**/*.test.jsx",
                "**/*.spec.ts",
                "**/*.spec.tsx",
                "**/*.spec.js",
                "**/*.spec.jsx",
            ],
            "mocha" => vec![
                "**/*.test.js",
                "**/*.test.ts",
                "**/test/**/*.js",
                "**/test/**/*.ts",
            ],
            "pytest" => vec!["**/test_*.py", "**/*_test.py", "**/tests/**/*.py"],
            "cargo" => vec!["**/tests/**/*.rs", "**/*_test.rs", "**/src/**/*.rs"],
            _ => vec!["**/*.test.*", "**/*.spec.*"],
        };

        let pattern_to_use = pattern.unwrap_or_else(|| test_patterns.join(","));

        // Emit watch started event
        let _ = app_clone.emit(
            "testing:watch-started",
            serde_json::json!({
                "watcher_id": watcher_id_clone,
                "path": path_clone,
                "framework": framework_clone,
                "patterns": pattern_to_use,
            }),
        );

        // Use notify crate for file watching
        use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
        use std::sync::mpsc as std_mpsc;

        let (tx, rx) = std_mpsc::channel();

        let mut watcher = match RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        ) {
            Ok(w) => w,
            Err(e) => {
                let _ = app_clone.emit(
                    "testing:watch-error",
                    serde_json::json!({
                        "watcher_id": watcher_id_clone,
                        "error": format!("Failed to create watcher: {}", e),
                    }),
                );
                return;
            }
        };

        if let Err(e) = watcher.watch(std::path::Path::new(&path_clone), RecursiveMode::Recursive) {
            let _ = app_clone.emit(
                "testing:watch-error",
                serde_json::json!({
                    "watcher_id": watcher_id_clone,
                    "error": format!("Failed to watch path: {}", e),
                }),
            );
            return;
        }

        let mut last_run = std::time::Instant::now();
        let debounce_duration = Duration::from_millis(500);

        loop {
            tokio::select! {
                _ = shutdown_rx.recv() => {
                    // Shutdown requested
                    let _ = app_clone.emit("testing:watch-stopped", serde_json::json!({
                        "watcher_id": watcher_id_clone,
                    }));
                    break;
                }
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    // Check for file events
                    while let Ok(event) = rx.try_recv() {
                        // Check if the changed file matches our patterns
                        let paths: Vec<String> = event.paths.iter()
                            .filter_map(|p| p.to_str().map(|s| s.to_string()))
                            .collect();

                        if paths.is_empty() {
                            continue;
                        }

                        // Debounce - don't run tests too frequently
                        if last_run.elapsed() < debounce_duration {
                            continue;
                        }
                        last_run = std::time::Instant::now();

                        // Emit file changed event
                        let _ = app_clone.emit("testing:file-changed", serde_json::json!({
                            "watcher_id": watcher_id_clone,
                            "paths": paths,
                            "event_kind": format!("{:?}", event.kind),
                        }));

                        // Auto-run tests for the changed files
                        let test_paths: Vec<String> = paths.iter()
                            .filter(|p| {
                                let p_lower = p.to_lowercase();
                                p_lower.contains(".test.") ||
                                p_lower.contains(".spec.") ||
                                p_lower.contains("_test.") ||
                                p_lower.starts_with("test_")
                            })
                            .cloned()
                            .collect();

                        if !test_paths.is_empty() {
                            // Emit event to trigger test run
                            let _ = app_clone.emit("testing:auto-run", serde_json::json!({
                                "watcher_id": watcher_id_clone,
                                "test_files": test_paths,
                                "framework": framework_clone,
                            }));
                        }
                    }
                }
            }
        }
    });

    // Emit success response
    let _ = app.emit(
        "testing:watch-created",
        serde_json::json!({
            "watcher_id": watcher_id,
            "path": path,
            "framework": framework,
        }),
    );

    Ok(watcher_id)
}

/// Stop a test watcher
#[tauri::command]
pub fn testing_stop_watch(watcher_id: String, app: AppHandle) -> Result<(), String> {
    let watcher_state = app
        .try_state::<LazyState<TestWatcherState>>()
        .ok_or("TestWatcherState not available")?;

    let mut watchers = watcher_state
        .get()
        .watchers
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if let Some(handle) = watchers.remove(&watcher_id) {
        // Send shutdown signal using try_send (non-blocking)
        let _ = handle.shutdown_tx.try_send(());
        Ok(())
    } else {
        Err(format!("Watcher not found: {}", watcher_id))
    }
}

/// Stop all test watchers
#[tauri::command]
pub fn testing_stop_all_watchers(app: AppHandle) -> Result<u32, String> {
    let watcher_state = app
        .try_state::<LazyState<TestWatcherState>>()
        .ok_or("TestWatcherState not available")?;

    let mut watchers = watcher_state
        .get()
        .watchers
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let count = watchers.len() as u32;

    // Send shutdown signals using try_send (non-blocking)
    for (_, handle) in watchers.drain() {
        let _ = handle.shutdown_tx.try_send(());
    }

    Ok(count)
}
