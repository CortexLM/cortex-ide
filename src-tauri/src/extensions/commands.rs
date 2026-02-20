//! Tauri commands for extension management.
//!
//! This module contains all the Tauri IPC commands for managing extensions,
//! including loading, enabling, disabling, and uninstalling extensions.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::info;

use super::state::ExtensionsState;
use super::types::{Extension, ExtensionManifest};
use super::utils::extensions_directory_path;

/// Get all loaded extensions
#[tauri::command]
pub async fn get_extensions(app: AppHandle) -> Result<Vec<Extension>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();
    Ok(manager.get_extensions())
}

/// Get enabled extensions only
#[tauri::command]
pub async fn get_enabled_extensions(app: AppHandle) -> Result<Vec<Extension>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();
    Ok(manager.get_enabled_extensions())
}

/// Get a single extension by name
#[tauri::command]
pub async fn get_extension(app: AppHandle, name: String) -> Result<Option<Extension>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();
    Ok(manager.get_extension(&name))
}

/// Load/reload all extensions
#[tauri::command]
pub async fn load_extensions(app: AppHandle) -> Result<Vec<Extension>, String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock();

    if !manager.extensions.is_empty() {
        return Ok(manager.get_extensions());
    }

    manager.load_extensions()
}

/// Enable an extension
#[tauri::command]
pub async fn enable_extension(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock();
    manager.enable_extension(&name)
}

/// Disable an extension
#[tauri::command]
pub async fn disable_extension(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock();
    manager.disable_extension(&name)
}

/// Uninstall an extension
#[tauri::command]
pub async fn uninstall_extension(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock();
    manager.uninstall_extension(&name)
}

/// Install an extension from a local path
#[tauri::command]
pub async fn install_extension_from_path(
    app: AppHandle,
    path: String,
) -> Result<Extension, String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock();
    let source_path = PathBuf::from(path);
    manager.install_extension(&source_path)
}

/// Get the extensions directory path
#[tauri::command]
pub async fn get_extensions_directory() -> Result<String, String> {
    Ok(extensions_directory_path().to_string_lossy().to_string())
}

/// Open extensions directory in file explorer
#[tauri::command]
pub async fn open_extensions_directory() -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let extensions_dir = extensions_directory_path();

        // Ensure directory exists
        if !extensions_dir.exists() {
            fs::create_dir_all(&extensions_dir)
                .map_err(|e| format!("Failed to create extensions directory: {}", e))?;
        }

        open::that(&extensions_dir).map_err(|e| format!("Failed to open directory: {}", e))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Validate an extension manifest
#[tauri::command]
pub async fn validate_extension_manifest(
    manifest_json: String,
) -> Result<ExtensionManifest, String> {
    serde_json::from_str(&manifest_json).map_err(|e| format!("Invalid manifest: {}", e))
}

/// Update an extension to a new version
#[tauri::command]
pub async fn update_extension(app: AppHandle, name: String, version: String) -> Result<(), String> {
    info!("Updating extension {} to version {}", name, version);

    let was_enabled = {
        let state = app.state::<ExtensionsState>();
        let manager = state.0.lock();
        manager
            .extensions
            .get(&name)
            .map(|ext| ext.enabled)
            .unwrap_or(false)
    };

    uninstall_extension(app.clone(), name.clone()).await?;
    super::marketplace::install_from_marketplace(app.clone(), name.clone()).await?;

    if was_enabled {
        enable_extension(app, name).await?;
    }

    Ok(())
}

/// Get activation time metrics for all loaded WASM extensions.
#[tauri::command]
pub async fn get_activation_time_metrics(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();
    let states = manager.wasm_runtime.get_states();
    let metrics: Vec<serde_json::Value> = states
        .into_iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id,
                "status": s.status,
                "activationTime": s.activation_time,
                "error": s.error,
                "lastActivity": s.last_activity,
            })
        })
        .collect();
    Ok(metrics)
}

/// Update all installed extensions that have available updates.
#[tauri::command]
pub async fn update_all_extensions(app: AppHandle) -> Result<u32, String> {
    let installed = {
        let state = app.state::<ExtensionsState>();
        let manager = state.0.lock();
        manager
            .get_extensions()
            .into_iter()
            .map(|ext| (ext.manifest.name, ext.manifest.version))
            .collect::<Vec<(String, String)>>()
    };

    if installed.is_empty() {
        return Ok(0);
    }

    let registry = app.state::<super::marketplace::RegistryState>();
    let updates: Vec<super::marketplace::RegistryUpdateInfo> =
        registry.0.check_updates(installed).await?;

    let mut updated_count = 0u32;
    for update_info in &updates {
        match super::registry::registry_install(
            app.clone(),
            update_info.name.clone(),
            Some(update_info.available_version.clone()),
        )
        .await
        {
            Ok(()) => {
                updated_count += 1;
                info!(
                    "Updated extension '{}' to version {}",
                    update_info.name, update_info.available_version
                );
            }
            Err(e) => {
                tracing::warn!("Failed to update extension '{}': {}", update_info.name, e);
            }
        }
    }

    info!(
        "Updated {} of {} extensions with available updates",
        updated_count,
        updates.len()
    );
    Ok(updated_count)
}

/// Preload extensions at startup (called from lib.rs setup)
pub fn preload_extensions(app: &AppHandle) -> Result<(), String> {
    let extensions_state: tauri::State<'_, ExtensionsState> = app.state();
    let state_clone = extensions_state.0.clone();

    let mut guard = state_clone.lock();

    match guard.load_extensions() {
        Ok(extensions) => {
            info!("Preloaded {} extensions", extensions.len());
            Ok(())
        }
        Err(e) => {
            tracing::warn!("Failed to preload extensions: {}", e);
            Err(e)
        }
    }
}
