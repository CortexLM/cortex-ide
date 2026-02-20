//! Tauri IPC commands for the Node.js VS Code-compatible extension host.
//!
//! These commands provide a high-level interface for the frontend to manage
//! the extension host lifecycle, install VS Code extensions, activate
//! individual extensions, and invoke VS Code API methods.

use tauri::{AppHandle, Emitter, Manager};
use tracing::info;

use super::NodeHostState;
use super::manifest::parse_vscode_manifest_file;
use super::protocol::JsonRpcRequest;

// ============================================================================
// start_extension_host
// ============================================================================

#[tauri::command]
pub async fn start_extension_host(app: AppHandle) -> Result<(), String> {
    let state = app.state::<NodeHostState>();
    let mut guard = state.0.lock().await;

    if guard.is_some() {
        return Err("Extension host is already running".to_string());
    }

    let process = super::process::NodeHostProcess::start(app.clone()).await?;

    let init_req = JsonRpcRequest::new(
        "initialize",
        Some(serde_json::json!({
            "capabilities": super::api_shim::get_supported_api_surface(),
        })),
    );
    let msg = serde_json::to_string(&init_req)
        .map_err(|e| format!("Failed to serialize init request: {e}"))?;
    process.send(&msg).await?;

    *guard = Some(process);
    info!("Extension host started via start_extension_host command");

    let _ = app.emit("extension-host:status", "ready");
    Ok(())
}

// ============================================================================
// install_vscode_extension
// ============================================================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledVscodeExtension {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub version: String,
    pub path: String,
    pub activation_events: Vec<String>,
}

#[tauri::command]
pub async fn install_vscode_extension(
    app: AppHandle,
    extension_id: String,
) -> Result<InstalledVscodeExtension, String> {
    let extensions_dir = super::node_extensions_dir();

    std::fs::create_dir_all(&extensions_dir)
        .map_err(|e| format!("Failed to create node-extensions directory: {e}"))?;

    let target_dir = extensions_dir.join(&extension_id);
    let pkg_path = target_dir.join("package.json");

    if !pkg_path.exists() {
        return Err(format!(
            "Extension '{}' not found at {}. Install the VSIX first using extension_host_install_vsix, \
             or place the unpacked extension in the node-extensions directory.",
            extension_id,
            target_dir.display()
        ));
    }

    let manifest = parse_vscode_manifest_file(&pkg_path)?;

    let ext_id = manifest.extension_id();
    let result = InstalledVscodeExtension {
        id: ext_id.clone(),
        name: manifest.name.clone(),
        display_name: manifest.display_name.clone(),
        version: manifest.version.clone(),
        path: target_dir.to_string_lossy().to_string(),
        activation_events: manifest.activation_events.clone(),
    };

    let state = app.state::<NodeHostState>();
    let guard = state.0.lock().await;
    if let Some(process) = guard.as_ref() {
        let req = JsonRpcRequest::new(
            "installExtension",
            Some(serde_json::json!({
                "extensionId": ext_id,
                "extensionPath": target_dir.to_string_lossy(),
                "manifest": manifest,
            })),
        );
        let msg =
            serde_json::to_string(&req).map_err(|e| format!("Failed to serialize request: {e}"))?;
        process.send(&msg).await?;
    }

    info!(
        "Installed VS Code extension: {} v{}",
        result.id, result.version
    );

    let _ = app.emit("extension-host:installed", &result);
    Ok(result)
}

// ============================================================================
// activate_extension
// ============================================================================

#[tauri::command]
pub async fn activate_extension(app: AppHandle, extension_id: String) -> Result<(), String> {
    let state = app.state::<NodeHostState>();
    let guard = state.0.lock().await;

    match guard.as_ref() {
        Some(process) => {
            let req = JsonRpcRequest::new(
                "activateExtension",
                Some(serde_json::json!({
                    "extensionId": extension_id,
                })),
            );
            let msg = serde_json::to_string(&req)
                .map_err(|e| format!("Failed to serialize activate request: {e}"))?;
            process.send(&msg).await?;

            info!("Sent activation request for extension: {}", extension_id);

            let _ = app.emit(
                "extension-host:activating",
                serde_json::json!({ "extensionId": extension_id }),
            );
            Ok(())
        }
        None => Err("Extension host is not running. Call start_extension_host first.".to_string()),
    }
}

// ============================================================================
// call_extension_api
// ============================================================================

#[tauri::command]
pub async fn call_extension_api(
    app: AppHandle,
    namespace: String,
    method: String,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<NodeHostState>();
    let guard = state.0.lock().await;

    match guard.as_ref() {
        Some(process) => {
            let rpc_method = format!("vscode/{}.{}", namespace, method);
            let req = JsonRpcRequest::new(
                &rpc_method,
                Some(serde_json::json!({
                    "namespace": namespace,
                    "method": method,
                    "args": args.unwrap_or(serde_json::Value::Array(vec![])),
                })),
            );
            let msg = serde_json::to_string(&req)
                .map_err(|e| format!("Failed to serialize API call: {e}"))?;
            process.send(&msg).await?;

            info!("Sent VS Code API call: {}.{}", namespace, method);

            Ok(serde_json::json!({
                "status": "sent",
                "method": format!("{}.{}", namespace, method),
            }))
        }
        None => Err("Extension host is not running. Call start_extension_host first.".to_string()),
    }
}
