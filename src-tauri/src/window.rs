use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::{error, info};
use uuid::Uuid;

/// Apply vibrancy/blur effect to a window for glassmorphism
/// DISABLED: Using solid background instead of transparent vibrancy
#[allow(dead_code)]
fn apply_window_vibrancy(_window: &tauri::WebviewWindow) {
    // Vibrancy disabled - using solid JetBrains-style background
    // To re-enable, uncomment the platform-specific code below:
    /*
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::apply_acrylic;
        match apply_acrylic(_window, Some((18, 18, 18, 180))) {
            Ok(_) => info!("Acrylic blur effect applied to window: {}", _window.label()),
            Err(e) => error!("Failed to apply acrylic effect to {}: {:?}", _window.label(), e),
        }
    }

    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        if let Err(e) = apply_vibrancy(_window, NSVisualEffectMaterial::HudWindow, None, None) {
            error!("Failed to apply vibrancy to {}: {}", _window.label(), e);
        } else {
            info!("macOS vibrancy applied to window: {}", _window.label());
        }
    }
    */
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_maximized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSession {
    pub label: String,
    pub path: Option<String>,
    pub bounds: Option<WindowBounds>,
}

pub struct WindowManagerState {
    #[allow(clippy::type_complexity)]
    pub sessions: Mutex<HashMap<String, (Option<String>, Option<WindowBounds>)>>,
    pub is_exiting: Mutex<bool>,
}

impl WindowManagerState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            is_exiting: Mutex::new(false),
        }
    }
}

fn get_session_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get app config dir: {}", e))?;
    if !path.exists() {
        fs::create_dir_all(&path).ok();
    }
    path.push("window_sessions.json");
    Ok(path)
}

fn save_window_sessions(
    app: &AppHandle,
    sessions: &HashMap<String, (Option<String>, Option<WindowBounds>)>,
) {
    let session_vec: Vec<WindowSession> = sessions
        .iter()
        .map(|(label, (path, bounds))| WindowSession {
            label: label.clone(),
            path: path.clone(),
            bounds: bounds.clone(),
        })
        .collect();

    let path = match get_session_file_path(app) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to get session file path: {}", e);
            return;
        }
    };
    if let Ok(json) = serde_json::to_string(&session_vec) {
        fs::write(path, json).ok();
    }
}

#[tauri::command]
pub async fn register_window_project(
    app: AppHandle,
    label: String,
    path: Option<String>,
) -> Result<(), String> {
    let state = app.state::<WindowManagerState>();
    let mut guard = state
        .sessions
        .lock()
        .map_err(|_| "Failed to acquire session lock".to_string())?;
    if let Some(entry) = guard.get_mut(&label) {
        entry.0 = path;
    } else {
        guard.insert(label, (path, None));
    }
    save_window_sessions(&app, &guard);
    Ok(())
}

#[tauri::command]
pub async fn update_window_state(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_maximized: bool,
) -> Result<(), String> {
    let state = app.state::<WindowManagerState>();
    let mut guard = state
        .sessions
        .lock()
        .map_err(|_| "Failed to acquire session lock".to_string())?;
    let bounds = Some(WindowBounds {
        x,
        y,
        width,
        height,
        is_maximized,
    });
    if let Some(entry) = guard.get_mut(&label) {
        entry.1 = bounds;
    } else {
        guard.insert(label, (None, bounds));
    }
    save_window_sessions(&app, &guard);
    Ok(())
}

pub fn remove_window_session(app: &AppHandle, label: &str) {
    let state = app.state::<WindowManagerState>();

    // Don't remove if app is exiting, we want to restore these windows next time
    let is_exiting = match state.is_exiting.lock() {
        Ok(guard) => *guard,
        Err(_) => {
            error!("Failed to acquire is_exiting lock");
            return;
        }
    };
    if is_exiting {
        return;
    }

    let mut guard = match state.sessions.lock() {
        Ok(g) => g,
        Err(_) => {
            error!("Failed to acquire session lock");
            return;
        }
    };
    guard.remove(label);
    save_window_sessions(app, &guard);
}

#[tauri::command]
pub async fn unregister_window(app: AppHandle, label: String) -> Result<(), String> {
    remove_window_session(&app, &label);
    Ok(())
}

pub async fn restore_windows(app: &AppHandle) {
    let path = match get_session_file_path(app) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to get session file path: {}", e);
            return;
        }
    };
    if let Ok(json) = tokio::fs::read_to_string(&path).await {
        if let Ok(sessions) = serde_json::from_str::<Vec<WindowSession>>(&json) {
            let state = app.state::<WindowManagerState>();
            let mut guard = match state.sessions.lock() {
                Ok(g) => g,
                Err(_) => {
                    error!("Failed to acquire session lock");
                    return;
                }
            };
            for session in sessions {
                // Skip restoring windows that start with "main-" (additional IDE windows)
                // These windows were created by the user via "New Window" and shouldn't
                // persist across restarts to avoid the double window bug.
                // Only restore auxiliary windows (aux-*) or update the main window bounds.
                if session.label.starts_with("main-") {
                    info!(
                        "Skipping restoration of additional IDE window: {}",
                        session.label
                    );
                    continue;
                }

                guard.insert(
                    session.label.clone(),
                    (session.path.clone(), session.bounds.clone()),
                );

                // Re-create the window if it's not the main one (which is created by default)
                // Note: "main" window is created by tauri.conf.json, we only update its bounds
                if session.label != "main" {
                    let _ =
                        create_window_internal(app, session.label, session.path, session.bounds);
                } else if let Some(bounds) = session.bounds {
                    // Update main window bounds if it exists
                    if let Some(window) = app.get_webview_window("main") {
                        if bounds.is_maximized {
                            let _ = window.maximize();
                        } else {
                            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                                width: bounds.width,
                                height: bounds.height,
                            }));
                            let _ = window.set_position(tauri::Position::Logical(
                                tauri::LogicalPosition {
                                    x: bounds.x,
                                    y: bounds.y,
                                },
                            ));
                        }
                    }
                }
            }
        }
    }
}

fn create_window_internal(
    app: &AppHandle,
    label: String,
    path: Option<String>,
    bounds: Option<WindowBounds>,
) -> Result<(), String> {
    let mut url = format!("index.html?window={}", label);
    if let Some(p) = path {
        let normalized = p.replace('\\', "/");
        url.push_str(&format!("&project={}", url_encode(&normalized)));
    }

    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("Cortex")
        .decorations(false)
        .transparent(false) // Disabled - matches tauri.conf.json for consistent Windows behavior
        .visible(false); // Hidden until frontend signals UI shell is ready

    let is_max = if let Some(b) = bounds {
        builder = builder.inner_size(b.width, b.height).position(b.x, b.y);
        b.is_maximized
    } else {
        builder = builder.inner_size(1200.0, 800.0);
        false
    };

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Apply vibrancy effect for glassmorphism
    apply_window_vibrancy(&window);

    // Store maximized state for when window becomes visible
    if is_max {
        let window_clone = window.clone();
        tauri::async_runtime::spawn(async move {
            // Listen for the show event, then maximize
            let _ = window_clone.maximize();
        });
    }

    Ok(())
}

fn url_encode(s: &str) -> String {
    // Simple manual encoding for common path characters
    s.replace('%', "%25")
        .replace(' ', "%20")
        .replace('&', "%26")
        .replace('#', "%23")
        .replace('+', "%2B")
}

#[tauri::command]
pub async fn create_new_window(app: AppHandle, path: Option<String>) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let label = format!("main-{}", &id[..8]);

    info!(
        "Creating new IDE window with label: {}, path: {:?}",
        label, path
    );

    let mut url = format!("index.html?window={}", label);
    if let Some(p) = path {
        // Convert backslashes to forward slashes for URL compatibility
        let normalized = p.replace('\\', "/");
        url.push_str(&format!("&project={}", url_encode(&normalized)));
    }

    let window = WebviewWindowBuilder::new(&app, label.clone(), WebviewUrl::App(url.into()))
        .title("Cortex")
        .inner_size(1200.0, 800.0)
        .decorations(false) // Custom title bar is used
        .transparent(false) // Disabled - matches tauri.conf.json for consistent Windows behavior
        .visible(false) // Hidden until frontend signals UI shell is ready
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Fallback: show window after 3 seconds if frontend hasn't signaled ready
    // This prevents invisible windows if frontend fails to load
    let window_clone = window.clone();
    let label_clone = label.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        // Only show if window is still not visible
        if let Ok(visible) = window_clone.is_visible() {
            if !visible {
                info!("Fallback: showing window {} after timeout", label_clone);
                let _ = window_clone.show();
                let _ = window_clone.set_focus();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn create_auxiliary_window(
    app: AppHandle,
    window_type: String,
    content_id: String,
    title: Option<String>,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let label = format!("aux-{}", &id[..8]);
    let title = title.unwrap_or_else(|| format!("{}: {}", window_type, content_id));
    let width = width.unwrap_or(800.0);
    let height = height.unwrap_or(600.0);

    // Convert backslashes to forward slashes for content_id if it's a path
    let normalized_content = content_id.replace('\\', "/");
    let url = format!(
        "index.html?window={}&type={}&content={}",
        label,
        window_type,
        url_encode(&normalized_content)
    );

    info!(
        "Creating auxiliary window: {} with type: {}",
        label, window_type
    );

    let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width, height)
        .decorations(true) // Auxiliary windows use native decorations
        .transparent(false) // Consistent with main windows
        .visible(false) // Hidden until frontend signals UI shell is ready
        .build()
        .map_err(|e| format!("Failed to create auxiliary window: {}", e))?;

    // Show the auxiliary window (has decorations, no need to wait for custom titlebar)
    let _ = window.show();

    Ok(())
}

/// Show the main window after the frontend shell has rendered its first frame.
/// Called by AppShell.tsx onMount to ensure users see the loading skeleton
/// instead of a blank/white window.
#[tauri::command]
pub async fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    if let Err(e) = window.show() {
        error!("Failed to show main window: {}", e);
        return Err(format!("Failed to show main window: {}", e));
    }
    if let Err(e) = window.set_focus() {
        error!("Failed to focus main window: {}", e);
    }
    Ok(())
}

/// Signal that the UI shell is ready - show the window
/// Called by frontend when titlebar and background are rendered
#[tauri::command]
pub async fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    if let Err(e) = window.show() {
        error!("Failed to show window: {}", e);
        return Err(format!("Failed to show window: {}", e));
    }
    if let Err(e) = window.set_focus() {
        error!("Failed to focus window: {}", e);
    }
    Ok(())
}

/// Toggle developer tools for debugging
#[tauri::command]
pub async fn toggle_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
    #[cfg(not(debug_assertions))]
    {
        // In release mode, devtools are typically disabled
        let _ = window;
    }
    Ok(())
}
