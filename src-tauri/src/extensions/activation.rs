//! Extension activation events system.
//!
//! This module implements VS Code-compatible activation events for extensions,
//! allowing lazy activation based on language, command, workspace content, etc.

use std::path::PathBuf;
use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

/// Activation event types that trigger extension loading.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "value")]
pub enum ActivationEvent {
    OnStartupFinished,
    OnLanguage(String),
    OnCommand(String),
    OnFileSystem(String),
    WorkspaceContains(String),
    OnView(String),
    OnDebug,
    OnUri(String),
    Star,
}

/// Manages activation event registration and matching for all extensions.
pub struct ActivationManager {
    events: DashMap<String, Vec<ActivationEvent>>,
    activated: DashMap<String, bool>,
}

impl ActivationManager {
    pub fn new() -> Self {
        Self {
            events: DashMap::new(),
            activated: DashMap::new(),
        }
    }

    /// Register activation events for an extension.
    pub fn register_extension(&self, extension_id: &str, events: Vec<ActivationEvent>) {
        info!(
            "Registering {} activation events for extension '{}'",
            events.len(),
            extension_id
        );
        self.events.insert(extension_id.to_string(), events);
    }

    /// Check which extensions should be activated for a given event.
    /// Returns extension IDs that match and have not yet been activated.
    pub fn check_activation(&self, event: &ActivationEvent) -> Vec<String> {
        let mut result = Vec::new();
        for entry in self.events.iter() {
            let extension_id = entry.key();
            if self
                .activated
                .get(extension_id)
                .map(|v| *v)
                .unwrap_or(false)
            {
                continue;
            }
            let matches = entry.value().iter().any(|registered| match registered {
                ActivationEvent::Star => true,
                other => other == event,
            });
            if matches {
                result.push(extension_id.clone());
            }
        }
        result
    }

    /// Check if an extension should activate on startup (has Star or OnStartupFinished).
    pub fn should_activate_on_startup(&self, extension_id: &str) -> bool {
        self.events
            .get(extension_id)
            .map(|events| {
                events.iter().any(|e| {
                    matches!(
                        e,
                        ActivationEvent::Star | ActivationEvent::OnStartupFinished
                    )
                })
            })
            .unwrap_or(false)
    }

    /// Check if a workspace contains files matching a glob pattern.
    /// Uses `tokio::task::spawn_blocking` to avoid blocking the async runtime.
    pub async fn check_workspace_contains(&self, workspace_path: &str, glob_pattern: &str) -> bool {
        let full_pattern = PathBuf::from(workspace_path)
            .join(glob_pattern)
            .to_string_lossy()
            .to_string();

        tokio::task::spawn_blocking(move || match glob::glob(&full_pattern) {
            Ok(mut paths) => paths.next().is_some(),
            Err(e) => {
                warn!("Invalid glob pattern '{}': {}", full_pattern, e);
                false
            }
        })
        .await
        .unwrap_or(false)
    }

    /// Parse raw activation event strings (VS Code format) into typed events.
    ///
    /// Supported formats:
    /// - `"*"` → `Star`
    /// - `"onStartupFinished"` → `OnStartupFinished`
    /// - `"onDebug"` → `OnDebug`
    /// - `"onLanguage:rust"` → `OnLanguage("rust")`
    /// - `"onCommand:myext.run"` → `OnCommand("myext.run")`
    /// - `"workspaceContains:**/*.rs"` → `WorkspaceContains("**/*.rs")`
    /// - `"onView:myView"` → `OnView("myView")`
    pub fn parse_activation_events(raw_events: &[String]) -> Vec<ActivationEvent> {
        raw_events
            .iter()
            .filter_map(|raw| {
                let trimmed = raw.trim();
                if trimmed == "*" {
                    return Some(ActivationEvent::Star);
                }
                if trimmed == "onStartupFinished" {
                    return Some(ActivationEvent::OnStartupFinished);
                }
                if trimmed == "onDebug" {
                    return Some(ActivationEvent::OnDebug);
                }
                if let Some(value) = trimmed.strip_prefix("onLanguage:") {
                    return Some(ActivationEvent::OnLanguage(value.to_string()));
                }
                if let Some(value) = trimmed.strip_prefix("onCommand:") {
                    return Some(ActivationEvent::OnCommand(value.to_string()));
                }
                if let Some(value) = trimmed.strip_prefix("workspaceContains:") {
                    return Some(ActivationEvent::WorkspaceContains(value.to_string()));
                }
                if let Some(value) = trimmed.strip_prefix("onView:") {
                    return Some(ActivationEvent::OnView(value.to_string()));
                }
                if let Some(value) = trimmed.strip_prefix("onFileSystem:") {
                    return Some(ActivationEvent::OnFileSystem(value.to_string()));
                }
                if let Some(value) = trimmed.strip_prefix("onUri:") {
                    return Some(ActivationEvent::OnUri(value.to_string()));
                }
                warn!("Unknown activation event: '{}'", trimmed);
                None
            })
            .collect()
    }

    /// Get pending activation events for an extension that has not been activated.
    pub fn get_pending_activations(&self, extension_id: &str) -> Vec<ActivationEvent> {
        if self
            .activated
            .get(extension_id)
            .map(|v| *v)
            .unwrap_or(false)
        {
            return Vec::new();
        }
        self.events
            .get(extension_id)
            .map(|events| events.clone())
            .unwrap_or_default()
    }

    /// Mark an extension as activated.
    pub fn mark_activated(&self, extension_id: &str) {
        info!("Extension '{}' marked as activated", extension_id);
        self.activated.insert(extension_id.to_string(), true);
    }

    /// Check if an extension has been activated.
    pub fn is_activated(&self, extension_id: &str) -> bool {
        self.activated
            .get(extension_id)
            .map(|v| *v)
            .unwrap_or(false)
    }
}

impl Default for ActivationManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe state wrapper for the activation manager.
#[derive(Clone)]
pub struct ActivationState(pub Arc<ActivationManager>);

impl ActivationState {
    pub fn new() -> Self {
        Self(Arc::new(ActivationManager::new()))
    }
}

impl Default for ActivationState {
    fn default() -> Self {
        Self::new()
    }
}

/// Check which extensions should activate for a given event.
#[tauri::command]
pub async fn check_activation_event(
    app: AppHandle,
    event_type: String,
    event_value: Option<String>,
) -> Result<Vec<String>, String> {
    let state = app.state::<ActivationState>();

    let event = match event_type.as_str() {
        "onStartupFinished" => ActivationEvent::OnStartupFinished,
        "onDebug" => ActivationEvent::OnDebug,
        "*" => ActivationEvent::Star,
        "onLanguage" => ActivationEvent::OnLanguage(
            event_value.ok_or_else(|| "onLanguage requires a value".to_string())?,
        ),
        "onCommand" => ActivationEvent::OnCommand(
            event_value.ok_or_else(|| "onCommand requires a value".to_string())?,
        ),
        "workspaceContains" => ActivationEvent::WorkspaceContains(
            event_value.ok_or_else(|| "workspaceContains requires a value".to_string())?,
        ),
        "onView" => ActivationEvent::OnView(
            event_value.ok_or_else(|| "onView requires a value".to_string())?,
        ),
        "onFileSystem" => ActivationEvent::OnFileSystem(
            event_value.ok_or_else(|| "onFileSystem requires a value".to_string())?,
        ),
        "onUri" => {
            ActivationEvent::OnUri(event_value.ok_or_else(|| "onUri requires a value".to_string())?)
        }
        other => return Err(format!("Unknown activation event type: '{}'", other)),
    };

    Ok(state.0.check_activation(&event))
}

/// Get the activation status of an extension.
#[tauri::command]
pub async fn get_activation_status(app: AppHandle, extension_id: String) -> Result<bool, String> {
    let state = app.state::<ActivationState>();
    Ok(state.0.is_activated(&extension_id))
}

/// Trigger an activation event, activating matching extensions and returning their IDs.
///
/// This is a convenience command that checks for matching extensions,
/// marks them as activated, and emits `plugin:extensions-activated` with
/// the list of newly activated extension IDs.
#[tauri::command]
pub async fn trigger_activation_event(
    app: AppHandle,
    event_type: String,
    event_value: Option<String>,
) -> Result<Vec<String>, String> {
    let state = app.state::<ActivationState>();

    let event = match event_type.as_str() {
        "onStartupFinished" => ActivationEvent::OnStartupFinished,
        "onDebug" => ActivationEvent::OnDebug,
        "*" => ActivationEvent::Star,
        "onLanguage" => ActivationEvent::OnLanguage(
            event_value.ok_or_else(|| "onLanguage requires a value".to_string())?,
        ),
        "onCommand" => ActivationEvent::OnCommand(
            event_value.ok_or_else(|| "onCommand requires a value".to_string())?,
        ),
        "onFileSystem" => ActivationEvent::OnFileSystem(
            event_value.ok_or_else(|| "onFileSystem requires a value".to_string())?,
        ),
        "workspaceContains" => ActivationEvent::WorkspaceContains(
            event_value.ok_or_else(|| "workspaceContains requires a value".to_string())?,
        ),
        "onView" => ActivationEvent::OnView(
            event_value.ok_or_else(|| "onView requires a value".to_string())?,
        ),
        "onUri" => {
            ActivationEvent::OnUri(event_value.ok_or_else(|| "onUri requires a value".to_string())?)
        }
        other => return Err(format!("Unknown activation event type: '{}'", other)),
    };

    let extension_ids = state.0.check_activation(&event);

    for id in &extension_ids {
        state.0.mark_activated(id);
    }

    if !extension_ids.is_empty() {
        app.emit("plugin:extensions-activated", &extension_ids)
            .map_err(|e| format!("Failed to emit extensions-activated event: {}", e))?;

        info!(
            count = extension_ids.len(),
            event_type = %event_type,
            "Extensions activated"
        );
    }

    Ok(extension_ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_activation_events() {
        let raw = vec![
            "*".to_string(),
            "onStartupFinished".to_string(),
            "onDebug".to_string(),
            "onLanguage:rust".to_string(),
            "onCommand:myext.run".to_string(),
            "workspaceContains:**/*.rs".to_string(),
            "onView:explorer".to_string(),
        ];
        let events = ActivationManager::parse_activation_events(&raw);
        assert_eq!(events.len(), 7);
        assert_eq!(events[0], ActivationEvent::Star);
        assert_eq!(events[1], ActivationEvent::OnStartupFinished);
        assert_eq!(events[2], ActivationEvent::OnDebug);
        assert_eq!(events[3], ActivationEvent::OnLanguage("rust".to_string()));
        assert_eq!(
            events[4],
            ActivationEvent::OnCommand("myext.run".to_string())
        );
        assert_eq!(
            events[5],
            ActivationEvent::WorkspaceContains("**/*.rs".to_string())
        );
        assert_eq!(events[6], ActivationEvent::OnView("explorer".to_string()));
    }

    #[test]
    fn test_parse_unknown_event_skipped() {
        let raw = vec!["unknownEvent:foo".to_string()];
        let events = ActivationManager::parse_activation_events(&raw);
        assert!(events.is_empty());
    }

    #[test]
    fn test_register_and_check_activation() {
        let manager = ActivationManager::new();
        manager.register_extension(
            "ext-a",
            vec![ActivationEvent::OnLanguage("rust".to_string())],
        );
        manager.register_extension(
            "ext-b",
            vec![ActivationEvent::OnLanguage("python".to_string())],
        );

        let result = manager.check_activation(&ActivationEvent::OnLanguage("rust".to_string()));
        assert_eq!(result, vec!["ext-a".to_string()]);
    }

    #[test]
    fn test_star_matches_any_event() {
        let manager = ActivationManager::new();
        manager.register_extension("ext-star", vec![ActivationEvent::Star]);

        let result = manager.check_activation(&ActivationEvent::OnDebug);
        assert_eq!(result, vec!["ext-star".to_string()]);
    }

    #[test]
    fn test_activated_extension_excluded() {
        let manager = ActivationManager::new();
        manager.register_extension(
            "ext-a",
            vec![ActivationEvent::OnLanguage("rust".to_string())],
        );
        manager.mark_activated("ext-a");

        let result = manager.check_activation(&ActivationEvent::OnLanguage("rust".to_string()));
        assert!(result.is_empty());
    }

    #[test]
    fn test_should_activate_on_startup() {
        let manager = ActivationManager::new();
        manager.register_extension("ext-star", vec![ActivationEvent::Star]);
        manager.register_extension("ext-startup", vec![ActivationEvent::OnStartupFinished]);
        manager.register_extension(
            "ext-lang",
            vec![ActivationEvent::OnLanguage("go".to_string())],
        );

        assert!(manager.should_activate_on_startup("ext-star"));
        assert!(manager.should_activate_on_startup("ext-startup"));
        assert!(!manager.should_activate_on_startup("ext-lang"));
        assert!(!manager.should_activate_on_startup("nonexistent"));
    }

    #[test]
    fn test_get_pending_activations() {
        let manager = ActivationManager::new();
        let events = vec![
            ActivationEvent::OnLanguage("rust".to_string()),
            ActivationEvent::OnCommand("test".to_string()),
        ];
        manager.register_extension("ext-a", events.clone());

        let pending = manager.get_pending_activations("ext-a");
        assert_eq!(pending.len(), 2);

        manager.mark_activated("ext-a");
        let pending = manager.get_pending_activations("ext-a");
        assert!(pending.is_empty());
    }

    #[test]
    fn test_is_activated() {
        let manager = ActivationManager::new();
        assert!(!manager.is_activated("ext-a"));
        manager.mark_activated("ext-a");
        assert!(manager.is_activated("ext-a"));
    }
}
