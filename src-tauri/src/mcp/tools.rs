//! MCP Tools Implementation
//!
//! Provides tools that AI agents can use to interact with Cortex Desktop.

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, Manager, Runtime, WebviewWindow};

use super::socket_server::SocketResponse;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotRequest {
    #[serde(default = "default_window_label")]
    pub window_label: String,
    pub quality: Option<u8>,
    pub max_width: Option<u32>,
}

fn default_window_label() -> String {
    "main".to_string()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotResponse {
    pub data: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDomRequest {
    #[serde(default = "default_window_label")]
    pub window_label: String,
    pub selector: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDomResponse {
    pub html: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteJsRequest {
    #[serde(default = "default_window_label")]
    pub window_label: String,
    pub script: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteJsResponse {
    pub result: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowManagerRequest {
    #[serde(default = "default_window_label")]
    pub window_label: String,
    pub operation: String,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextInputRequest {
    pub text: String,
    pub delay_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseRequest {
    pub action: String, // "move", "click", "doubleClick", "rightClick", "scroll"
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub scroll_x: Option<i32>,
    pub scroll_y: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStorageRequest {
    #[serde(default = "default_window_label")]
    pub window_label: String,
    pub operation: String, // "get", "set", "remove", "clear", "keys"
    pub key: Option<String>,
    pub value: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetElementPositionRequest {
    #[serde(default = "default_window_label")]
    pub window_label: String,
    pub selector: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementPosition {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub found: bool,
}

// ============================================================================
// Command Handler
// ============================================================================

pub async fn handle_command<R: Runtime>(
    app: &AppHandle<R>,
    command: &str,
    payload: Value,
) -> SocketResponse {
    match command {
        "ping" => SocketResponse::success(serde_json::json!({ "pong": true })),

        "takeScreenshot" => handle_screenshot(app, payload).await,

        "getDom" => handle_get_dom(app, payload).await,

        "executeJs" => handle_execute_js(app, payload).await,

        "manageWindow" => handle_manage_window(app, payload).await,

        "textInput" => handle_text_input(payload).await,

        "mouseMovement" => handle_mouse(payload).await,

        "manageLocalStorage" => handle_local_storage(app, payload).await,

        "getElementPosition" => handle_get_element_position(app, payload).await,

        "sendTextToElement" => handle_send_text_to_element(app, payload).await,

        "listWindows" => handle_list_windows(app).await,

        _ => SocketResponse::error(format!("Unknown command: {}", command)),
    }
}

// ============================================================================
// Tool Implementations
// ============================================================================

async fn handle_screenshot<R: Runtime>(app: &AppHandle<R>, payload: Value) -> SocketResponse {
    let request: ScreenshotRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    // Use platform-specific screenshot implementation
    #[cfg(target_os = "windows")]
    {
        match capture_window_screenshot_windows(&window, &request).await {
            Ok(data) => SocketResponse::success(data),
            Err(e) => SocketResponse::error(e),
        }
    }

    #[cfg(target_os = "macos")]
    {
        match capture_window_screenshot_macos(&window, &request).await {
            Ok(data) => SocketResponse::success(data),
            Err(e) => SocketResponse::error(e),
        }
    }

    #[cfg(target_os = "linux")]
    {
        match capture_window_screenshot_linux(&window, &request).await {
            Ok(data) => SocketResponse::success(data),
            Err(e) => SocketResponse::error(e),
        }
    }
}

#[cfg(target_os = "windows")]
async fn capture_window_screenshot_windows<R: Runtime>(
    window: &WebviewWindow<R>,
    request: &ScreenshotRequest,
) -> Result<ScreenshotResponse, String> {
    use image::imageops::FilterType;
    use win_screenshot::prelude::*;

    let title = window.title().unwrap_or_default();
    let hwnd = find_window(&title).map_err(|_| "Could not find window handle")?;

    let buf = capture_window(hwnd).map_err(|e| format!("Screenshot failed: {}", e))?;

    let img = image::RgbImage::from_raw(buf.width, buf.height, buf.pixels)
        .ok_or("Failed to create image")?;

    // Convert to DynamicImage for processing
    let mut dynamic_img = image::DynamicImage::ImageRgb8(img);
    let mut final_width = buf.width;
    let mut final_height = buf.height;

    // Resize if max_width is specified and image is larger
    if let Some(max_width) = request.max_width {
        if buf.width > max_width {
            let scale = max_width as f32 / buf.width as f32;
            let new_height = (buf.height as f32 * scale) as u32;
            dynamic_img = dynamic_img.resize(max_width, new_height, FilterType::Lanczos3);
            final_width = max_width;
            final_height = new_height;
        }
    }

    // Encode as JPEG with quality setting (default 75 for good compression)
    let quality = request.quality.unwrap_or(75).min(100);
    let jpeg_data = encode_jpeg(&dynamic_img, quality)?;

    let base64_data = base64::engine::general_purpose::STANDARD.encode(&jpeg_data);

    Ok(ScreenshotResponse {
        data: format!("data:image/jpeg;base64,{}", base64_data),
        mime_type: "image/jpeg".to_string(),
        width: final_width,
        height: final_height,
    })
}

#[cfg(target_os = "macos")]
async fn capture_window_screenshot_macos<R: Runtime>(
    window: &WebviewWindow<R>,
    request: &ScreenshotRequest,
) -> Result<ScreenshotResponse, String> {
    use image::imageops::FilterType;
    use xcap::Window;

    let title = window.title().unwrap_or_default();

    let windows = Window::all().map_err(|e| format!("Failed to list windows: {}", e))?;
    let target = windows
        .iter()
        .find(|w| w.title().contains(&title))
        .ok_or("Window not found")?;

    let img = target
        .capture_image()
        .map_err(|e| format!("Capture failed: {}", e))?;

    // Convert to DynamicImage for processing
    let mut dynamic_img = image::DynamicImage::ImageRgba8(img.clone());
    let orig_width = img.width();
    let orig_height = img.height();
    let mut final_width = orig_width;
    let mut final_height = orig_height;

    // Resize if max_width is specified and image is larger
    if let Some(max_width) = request.max_width {
        if orig_width > max_width {
            let scale = max_width as f32 / orig_width as f32;
            let new_height = (orig_height as f32 * scale) as u32;
            dynamic_img = dynamic_img.resize(max_width, new_height, FilterType::Lanczos3);
            final_width = max_width;
            final_height = new_height;
        }
    }

    // Encode as JPEG with quality setting (default 75 for good compression)
    let quality = request.quality.unwrap_or(75).min(100);
    let jpeg_data = encode_jpeg(&dynamic_img, quality)?;

    let base64_data = base64::engine::general_purpose::STANDARD.encode(&jpeg_data);

    Ok(ScreenshotResponse {
        data: format!("data:image/jpeg;base64,{}", base64_data),
        mime_type: "image/jpeg".to_string(),
        width: final_width,
        height: final_height,
    })
}

#[cfg(target_os = "linux")]
async fn capture_window_screenshot_linux<R: Runtime>(
    window: &WebviewWindow<R>,
    request: &ScreenshotRequest,
) -> Result<ScreenshotResponse, String> {
    // Create a temporary file for the screenshot
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("cortex_screenshot_{}.png", std::process::id()));
    let temp_path = temp_file.to_string_lossy().to_string();

    // Try different screenshot tools in order of preference
    let screenshot_result = capture_linux_screenshot(&temp_path, window).await;

    if let Err(e) = screenshot_result {
        return Err(format!("Failed to capture screenshot: {}", e));
    }

    // Read the captured image
    let img = image::open(&temp_file).map_err(|e| format!("Failed to open screenshot: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_file);

    // Process the image (resize if needed)
    let (width, height) = (img.width(), img.height());
    let max_dimension = request.max_width.unwrap_or(1920);

    let processed_img = if width > max_dimension || height > max_dimension {
        let scale = max_dimension as f32 / width.max(height) as f32;
        let new_width = (width as f32 * scale) as u32;
        let new_height = (height as f32 * scale) as u32;
        img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    let (final_width, final_height) = (processed_img.width(), processed_img.height());

    // Encode to JPEG
    let quality = request.quality.unwrap_or(80);
    let jpeg_data = encode_jpeg(&processed_img, quality)?;

    // Base64 encode
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&jpeg_data);

    Ok(ScreenshotResponse {
        data: base64_data,
        mime_type: "image/jpeg".to_string(),
        width: final_width,
        height: final_height,
    })
}

#[cfg(target_os = "linux")]
async fn capture_linux_screenshot<R: Runtime>(
    output_path: &str,
    _window: &WebviewWindow<R>,
) -> Result<(), String> {
    // Try gnome-screenshot first (most common on GNOME desktops)
    if let Ok(status) = crate::process_utils::command("gnome-screenshot")
        .args(["-w", "-f", output_path])
        .status()
    {
        if status.success() {
            return Ok(());
        }
    }

    // Try scrot (common lightweight option)
    if let Ok(status) = crate::process_utils::command("scrot")
        .args(["-u", output_path])
        .status()
    {
        if status.success() {
            return Ok(());
        }
    }

    // Try maim (another common option) - capture full screen since we can't get window handle
    if let Ok(status) = crate::process_utils::command("maim")
        .args([output_path])
        .status()
    {
        if status.success() {
            return Ok(());
        }
    }

    // Try import from ImageMagick
    if let Ok(status) = crate::process_utils::command("import")
        .args(["-window", "root", output_path])
        .status()
    {
        if status.success() {
            return Ok(());
        }
    }

    // Try spectacle (KDE)
    if let Ok(status) = crate::process_utils::command("spectacle")
        .args(["-b", "-n", "-o", output_path])
        .status()
    {
        if status.success() {
            return Ok(());
        }
    }

    Err("No screenshot tool available. Please install one of: gnome-screenshot, scrot, maim, imagemagick, or spectacle".to_string())
}

/// Encode a DynamicImage to JPEG with specified quality (0-100)
/// Lower quality = smaller file size, higher compression
fn encode_jpeg(img: &image::DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    use image::codecs::jpeg::JpegEncoder;
    use std::io::Cursor;

    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);

    // Convert to RGB8 for JPEG encoding (JPEG doesn't support alpha)
    let rgb_img = img.to_rgb8();

    let mut encoder = JpegEncoder::new_with_quality(&mut cursor, quality);
    encoder
        .encode(
            rgb_img.as_raw(),
            rgb_img.width(),
            rgb_img.height(),
            image::ColorType::Rgb8,
        )
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    Ok(jpeg_data)
}

async fn handle_get_dom<R: Runtime>(app: &AppHandle<R>, payload: Value) -> SocketResponse {
    let request: GetDomRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let _window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    // Set up channel to receive response
    let (tx, rx) = mpsc::channel::<String>();

    // Listen for response event (one-time)
    let _listener_id = app.once("mcp-get-dom-response", move |event| {
        let payload = event.payload().to_string();
        let _ = tx.send(payload);
    });

    // Build the payload with optional selector
    let event_payload = serde_json::json!({
        "selector": request.selector
    });

    // Emit event to frontend to get DOM
    if let Err(e) = app.emit_to(&request.window_label, "mcp-get-dom", &event_payload) {
        return SocketResponse::error(format!("Failed to emit get-dom event: {}", e));
    }

    // Wait for response with timeout (5 seconds)
    let timeout = Duration::from_secs(5);
    match rx.recv_timeout(timeout) {
        Ok(result_string) => {
            // Parse the response JSON
            let response: Value = match serde_json::from_str(&result_string) {
                Ok(v) => v,
                Err(e) => return SocketResponse::error(format!("Failed to parse response: {}", e)),
            };

            // Check if result contains an error
            if let Some(false) = response.get("success").and_then(|v| v.as_bool()) {
                let error = response
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error");
                return SocketResponse::error(format!("DOM error: {}", error));
            }

            // Get the HTML
            let html = response
                .get("html")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            SocketResponse::success(GetDomResponse { html })
        }
        Err(_) => SocketResponse::error("Get DOM timed out".to_string()),
    }
}

async fn handle_execute_js<R: Runtime>(app: &AppHandle<R>, payload: Value) -> SocketResponse {
    let request: ExecuteJsRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let _window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    // Set up channel to receive response
    let (tx, rx) = mpsc::channel::<String>();

    // Listen for response event (one-time)
    let listener_id = app.once("mcp-execute-js-response", move |event| {
        let payload = event.payload().to_string();
        let _ = tx.send(payload);
    });

    // Emit event to frontend to execute the script
    if let Err(e) = app.emit_to(&request.window_label, "mcp-execute-js", &request.script) {
        app.unlisten(listener_id);
        return SocketResponse::error(format!("Failed to emit execute-js event: {}", e));
    }

    // Wait for response with timeout (5 seconds)
    let timeout = Duration::from_secs(5);
    match rx.recv_timeout(timeout) {
        Ok(result_string) => {
            // Parse the response JSON
            let response: Value = match serde_json::from_str(&result_string) {
                Ok(v) => v,
                Err(e) => return SocketResponse::error(format!("Failed to parse response: {}", e)),
            };

            // Check if result contains an error
            if let Some(false) = response.get("success").and_then(|v| v.as_bool()) {
                let error = response
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error");
                return SocketResponse::error(format!("JS error: {}", error));
            }

            // Get the result value
            let result = response.get("result").cloned().unwrap_or(Value::Null);

            SocketResponse::success(ExecuteJsResponse { result })
        }
        Err(_) => SocketResponse::error("Script execution timed out".to_string()),
    }
}

async fn handle_manage_window<R: Runtime>(app: &AppHandle<R>, payload: Value) -> SocketResponse {
    let request: WindowManagerRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    let result = match request.operation.as_str() {
        "minimize" => window.minimize(),
        "maximize" => window.maximize(),
        "unmaximize" => window.unmaximize(),
        "close" => window.close(),
        "show" => window.show(),
        "hide" => window.hide(),
        "focus" => window.set_focus(),
        "center" => window.center(),
        "setPosition" => {
            if let (Some(x), Some(y)) = (request.x, request.y) {
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            } else {
                return SocketResponse::error("setPosition requires x and y");
            }
        }
        "setSize" => {
            if let (Some(w), Some(h)) = (request.width, request.height) {
                window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: w,
                    height: h,
                }))
            } else {
                return SocketResponse::error("setSize requires width and height");
            }
        }
        "toggleFullscreen" => match window.is_fullscreen() {
            Ok(is_fs) => window.set_fullscreen(!is_fs),
            Err(e) => return SocketResponse::error(format!("Failed to check fullscreen: {}", e)),
        },
        op => return SocketResponse::error(format!("Unknown operation: {}", op)),
    };

    match result {
        Ok(_) => SocketResponse::success(serde_json::json!({ "success": true })),
        Err(e) => SocketResponse::error(format!("Operation failed: {}", e)),
    }
}

async fn handle_text_input(payload: Value) -> SocketResponse {
    let request: TextInputRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    use enigo::{Enigo, Keyboard, Settings};

    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(e) => return SocketResponse::error(format!("Failed to initialize input: {}", e)),
    };

    let delay = request.delay_ms.unwrap_or(20);

    if delay == 0 {
        if let Err(e) = enigo.text(&request.text) {
            return SocketResponse::error(format!("Failed to type text: {}", e));
        }
    } else {
        for c in request.text.chars() {
            if let Err(e) = enigo.text(&c.to_string()) {
                return SocketResponse::error(format!("Failed to type char: {}", e));
            }
            std::thread::sleep(std::time::Duration::from_millis(delay));
        }
    }

    SocketResponse::success(serde_json::json!({
        "chars_typed": request.text.len(),
    }))
}

async fn handle_mouse(payload: Value) -> SocketResponse {
    let request: MouseRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    use enigo::{Button, Coordinate, Enigo, Mouse, Settings};

    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(e) => return SocketResponse::error(format!("Failed to initialize input: {}", e)),
    };

    let result = match request.action.as_str() {
        "move" => {
            if let (Some(x), Some(y)) = (request.x, request.y) {
                enigo.move_mouse(x, y, Coordinate::Abs)
            } else {
                return SocketResponse::error("move requires x and y");
            }
        }
        "click" => enigo.button(Button::Left, enigo::Direction::Click),
        "doubleClick" => {
            let _ = enigo.button(Button::Left, enigo::Direction::Click);
            std::thread::sleep(std::time::Duration::from_millis(50));
            enigo.button(Button::Left, enigo::Direction::Click)
        }
        "rightClick" => enigo.button(Button::Right, enigo::Direction::Click),
        "scroll" => {
            let sx = request.scroll_x.unwrap_or(0);
            let sy = request.scroll_y.unwrap_or(0);
            if sx != 0 {
                let _ = enigo.scroll(sx, enigo::Axis::Horizontal);
            }
            if sy != 0 {
                enigo.scroll(sy, enigo::Axis::Vertical)
            } else {
                Ok(())
            }
        }
        action => return SocketResponse::error(format!("Unknown action: {}", action)),
    };

    match result {
        Ok(_) => SocketResponse::success(serde_json::json!({ "success": true })),
        Err(e) => SocketResponse::error(format!("Mouse action failed: {}", e)),
    }
}

async fn handle_local_storage<R: Runtime>(app: &AppHandle<R>, payload: Value) -> SocketResponse {
    let request: LocalStorageRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    // Use JSON.stringify for proper escaping to prevent XSS/injection attacks
    let script = match request.operation.as_str() {
        "get" => {
            if let Some(key) = &request.key {
                let key_json = serde_json::to_string(key).unwrap_or_else(|_| "null".to_string());
                format!("localStorage.getItem({})", key_json)
            } else {
                return SocketResponse::error("get requires key");
            }
        }
        "set" => {
            if let (Some(key), Some(value)) = (&request.key, &request.value) {
                let key_json = serde_json::to_string(key).unwrap_or_else(|_| "null".to_string());
                let value_json =
                    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string());
                format!("localStorage.setItem({}, {})", key_json, value_json)
            } else {
                return SocketResponse::error("set requires key and value");
            }
        }
        "remove" => {
            if let Some(key) = &request.key {
                let key_json = serde_json::to_string(key).unwrap_or_else(|_| "null".to_string());
                format!("localStorage.removeItem({})", key_json)
            } else {
                return SocketResponse::error("remove requires key");
            }
        }
        "clear" => "localStorage.clear()".to_string(),
        "keys" => "Object.keys(localStorage)".to_string(),
        op => return SocketResponse::error(format!("Unknown operation: {}", op)),
    };

    match window.eval(&script) {
        Ok(_) => SocketResponse::success(serde_json::json!({ "success": true })),
        Err(e) => SocketResponse::error(format!("LocalStorage operation failed: {}", e)),
    }
}

async fn handle_get_element_position<R: Runtime>(
    app: &AppHandle<R>,
    payload: Value,
) -> SocketResponse {
    let request: GetElementPositionRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    let script = format!(
        r#"(function() {{
            const el = document.querySelector('{}');
            if (!el) return {{ found: false }};
            const rect = el.getBoundingClientRect();
            return {{
                found: true,
                x: rect.x + window.screenX,
                y: rect.y + window.screenY,
                width: rect.width,
                height: rect.height
            }};
        }})()"#,
        request.selector.replace("'", "\\'")
    );

    match window.eval(&script) {
        Ok(_) => SocketResponse::success(serde_json::json!({
            "message": "Position calculated - use executeJs with result retrieval"
        })),
        Err(e) => SocketResponse::error(format!("Failed to get element position: {}", e)),
    }
}

async fn handle_send_text_to_element<R: Runtime>(
    app: &AppHandle<R>,
    payload: Value,
) -> SocketResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SendTextRequest {
        #[serde(default = "default_window_label")]
        window_label: String,
        selector: String,
        text: String,
    }

    let request: SendTextRequest = match serde_json::from_value(payload) {
        Ok(r) => r,
        Err(e) => return SocketResponse::error(format!("Invalid payload: {}", e)),
    };

    let window = match app.get_webview_window(&request.window_label) {
        Some(w) => w,
        None => {
            return SocketResponse::error(format!("Window not found: {}", request.window_label));
        }
    };

    let script = format!(
        r#"(function() {{
            const el = document.querySelector('{}');
            if (!el) return false;
            el.focus();
            el.value = '{}';
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            return true;
        }})()"#,
        request.selector.replace("'", "\\'"),
        request.text.replace("'", "\\'").replace("\n", "\\n")
    );

    match window.eval(&script) {
        Ok(_) => SocketResponse::success(serde_json::json!({ "success": true })),
        Err(e) => SocketResponse::error(format!("Failed to send text: {}", e)),
    }
}

async fn handle_list_windows<R: Runtime>(app: &AppHandle<R>) -> SocketResponse {
    let windows: Vec<_> = app
        .webview_windows()
        .into_iter()
        .map(|(label, window)| {
            serde_json::json!({
                "label": label,
                "title": window.title().unwrap_or_default(),
                "visible": window.is_visible().unwrap_or(false),
                "focused": window.is_focused().unwrap_or(false),
            })
        })
        .collect();

    SocketResponse::success(serde_json::json!({ "windows": windows }))
}
