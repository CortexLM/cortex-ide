//! Debug API for extension plugins.
//!
//! Provides Tauri IPC commands for extensions to register debug configuration
//! providers and emit debug session lifecycle events.

use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::info;

// ============================================================================
// Types
// ============================================================================

/// A debug configuration provider registered by an extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugConfigProvider {
    pub id: String,
    pub extension_id: String,
    pub debug_type: String,
    pub label: String,
}

/// Payload emitted for debug session lifecycle events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugSessionEvent {
    pub extension_id: String,
    pub session_id: String,
    pub event_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub configuration: Option<serde_json::Value>,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for debug-related plugin API resources.
#[derive(Clone)]
pub struct DebugApiState {
    pub config_providers: Arc<DashMap<String, DebugConfigProvider>>,
}

impl Default for DebugApiState {
    fn default() -> Self {
        Self::new()
    }
}

impl DebugApiState {
    pub fn new() -> Self {
        Self {
            config_providers: Arc::new(DashMap::new()),
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Register a debug configuration provider for a debug type.
#[tauri::command]
pub async fn plugin_register_debug_config_provider(
    app: AppHandle,
    extension_id: String,
    debug_type: String,
    label: String,
) -> Result<String, String> {
    let state = app.state::<DebugApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let provider = DebugConfigProvider {
        id: id.clone(),
        extension_id: extension_id.clone(),
        debug_type: debug_type.clone(),
        label: label.clone(),
    };

    state.config_providers.insert(id.clone(), provider.clone());

    app.emit("plugin:debug-config-provider-registered", &provider)
        .map_err(|e| {
            format!(
                "Failed to emit debug-config-provider-registered event: {}",
                e
            )
        })?;

    info!(
        extension_id = %extension_id,
        debug_type = %debug_type,
        provider_id = %id,
        "Debug config provider registered"
    );

    Ok(id)
}

/// Notify the system that a debug session has started.
///
/// Emits `plugin:debug-session-start` so the frontend and other extensions
/// can react to the session lifecycle.
#[tauri::command]
pub async fn plugin_on_debug_session_start(
    app: AppHandle,
    extension_id: String,
    session_id: String,
    configuration: Option<serde_json::Value>,
) -> Result<(), String> {
    let event = DebugSessionEvent {
        extension_id: extension_id.clone(),
        session_id: session_id.clone(),
        event_type: "start".to_string(),
        configuration,
    };

    app.emit("plugin:debug-session-start", &event)
        .map_err(|e| format!("Failed to emit debug-session-start event: {}", e))?;

    info!(
        extension_id = %extension_id,
        session_id = %session_id,
        "Debug session started"
    );

    Ok(())
}

/// Notify the system that a debug session has ended.
///
/// Emits `plugin:debug-session-end` so the frontend and other extensions
/// can clean up resources.
#[tauri::command]
pub async fn plugin_on_debug_session_end(
    app: AppHandle,
    extension_id: String,
    session_id: String,
) -> Result<(), String> {
    let event = DebugSessionEvent {
        extension_id: extension_id.clone(),
        session_id: session_id.clone(),
        event_type: "end".to_string(),
        configuration: None,
    };

    app.emit("plugin:debug-session-end", &event)
        .map_err(|e| format!("Failed to emit debug-session-end event: {}", e))?;

    info!(
        extension_id = %extension_id,
        session_id = %session_id,
        "Debug session ended"
    );

    Ok(())
}
