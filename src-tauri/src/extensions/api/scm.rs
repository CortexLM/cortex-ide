//! Source Control Management (SCM) API for extension plugins.
//!
//! Provides Tauri IPC commands for extensions to register source control
//! providers that integrate with the SCM panel in the UI.

use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::info;

// ============================================================================
// Types
// ============================================================================

/// Registration metadata for a source control provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceControlRegistration {
    pub id: String,
    pub extension_id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_uri: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Extended source control creation metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceControlCreation {
    pub id: String,
    pub extension_id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_uri: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit_template: Option<String>,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for SCM-related plugin API resources.
#[derive(Clone)]
pub struct ScmApiState {
    pub providers: Arc<DashMap<String, SourceControlRegistration>>,
}

impl Default for ScmApiState {
    fn default() -> Self {
        Self::new()
    }
}

impl ScmApiState {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(DashMap::new()),
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Register a source control provider.
///
/// Returns the generated provider `id`.  The frontend is notified via
/// `plugin:scm-provider-registered` so the SCM panel can update.
#[tauri::command]
pub async fn plugin_register_source_control(
    app: AppHandle,
    extension_id: String,
    label: String,
    root_uri: Option<String>,
    icon: Option<String>,
) -> Result<String, String> {
    let state = app.state::<ScmApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = SourceControlRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        label: label.clone(),
        root_uri,
        icon,
    };

    state.providers.insert(id.clone(), registration.clone());

    app.emit("plugin:scm-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit scm-provider-registered event: {}", e))?;

    info!(
        extension_id = %extension_id,
        provider_id = %id,
        label = %label,
        "Source control provider registered"
    );

    Ok(id)
}

/// Create a source control instance with extended options.
///
/// Returns the generated provider `id`. The frontend is notified via
/// `plugin:source-control-created` so the SCM panel can render the
/// new provider with its initial state.
#[tauri::command]
pub async fn plugin_create_source_control(
    app: AppHandle,
    extension_id: String,
    label: String,
    root_uri: Option<String>,
    icon: Option<String>,
    count: Option<u32>,
    commit_template: Option<String>,
) -> Result<String, String> {
    let state = app.state::<ScmApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = SourceControlRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        label: label.clone(),
        root_uri: root_uri.clone(),
        icon: icon.clone(),
    };

    state.providers.insert(id.clone(), registration);

    let creation = SourceControlCreation {
        id: id.clone(),
        extension_id: extension_id.clone(),
        label: label.clone(),
        root_uri,
        icon,
        count,
        commit_template,
    };

    app.emit("plugin:source-control-created", &creation)
        .map_err(|e| format!("Failed to emit source-control-created event: {}", e))?;

    info!(
        extension_id = %extension_id,
        provider_id = %id,
        label = %label,
        "Source control instance created"
    );

    Ok(id)
}
