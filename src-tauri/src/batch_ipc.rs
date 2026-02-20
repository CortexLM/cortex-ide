//! Generic Batched IPC Command System
//!
//! Provides a single `batch_invoke` Tauri command that accepts an array of
//! command names + arguments, dispatches them concurrently on the backend,
//! and returns all results in one IPC round-trip.
//!
//! This is critical for startup performance: instead of ~50 individual IPC
//! calls during provider mount, the frontend can batch them into a single call.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tracing::debug;

use crate::extensions::ExtensionsState;
use crate::keybindings::KeybindingEntry;
use crate::settings::storage::SettingsState;
use crate::settings::types::CortexSettings;
use crate::themes::ThemeState;

/// A single call within a batch request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchedCall {
    pub id: String,
    pub cmd: String,
    #[serde(default)]
    pub args: serde_json::Value,
}

/// Result of a single batched call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchedResult {
    pub id: String,
    #[serde(flatten)]
    pub outcome: BatchedOutcome,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum BatchedOutcome {
    #[serde(rename = "ok")]
    Ok { data: serde_json::Value },
    #[serde(rename = "error")]
    Error { error: String },
}

impl BatchedResult {
    fn ok(id: String, data: serde_json::Value) -> Self {
        Self {
            id,
            outcome: BatchedOutcome::Ok { data },
        }
    }

    fn error(id: String, error: impl Into<String>) -> Self {
        Self {
            id,
            outcome: BatchedOutcome::Error {
                error: error.into(),
            },
        }
    }
}

/// Dispatch a single call to the appropriate handler.
async fn dispatch_call(app: &AppHandle, call: BatchedCall) -> BatchedResult {
    let id = call.id.clone();
    match call.cmd.as_str() {
        "settings_load" => dispatch_settings_load(app, id).await,
        "settings_get" => dispatch_settings_get(app, id).await,
        "get_version" => dispatch_get_version(id),
        "get_extensions" => dispatch_get_extensions(app, id).await,
        "get_enabled_extensions" => dispatch_get_enabled_extensions(app, id).await,
        "list_available_themes" => dispatch_list_available_themes(app, id).await,
        "load_keybindings_file" => dispatch_load_keybindings_file(id).await,
        "get_default_keybindings" => dispatch_get_default_keybindings(id),
        _ => BatchedResult::error(id, format!("Unknown batch command: {}", call.cmd)),
    }
}

async fn dispatch_settings_load(app: &AppHandle, id: String) -> BatchedResult {
    match crate::settings::commands::settings_load(app.clone()).await {
        Ok(settings) => match serde_json::to_value(settings) {
            Ok(v) => BatchedResult::ok(id, v),
            Err(e) => BatchedResult::error(id, format!("Serialization error: {}", e)),
        },
        Err(e) => BatchedResult::error(id, e),
    }
}

async fn dispatch_settings_get(app: &AppHandle, id: String) -> BatchedResult {
    let settings_state = app.state::<SettingsState>();
    let result: Result<CortexSettings, String> = settings_state
        .0
        .lock()
        .map(|guard| guard.clone())
        .map_err(|e| format!("Lock error: {}", e));
    match result {
        Ok(settings) => match serde_json::to_value(settings) {
            Ok(v) => BatchedResult::ok(id, v),
            Err(e) => BatchedResult::error(id, format!("Serialization error: {}", e)),
        },
        Err(e) => BatchedResult::error(id, e),
    }
}

fn dispatch_get_version(id: String) -> BatchedResult {
    BatchedResult::ok(
        id,
        serde_json::Value::String(env!("CARGO_PKG_VERSION").to_string()),
    )
}

async fn dispatch_get_extensions(app: &AppHandle, id: String) -> BatchedResult {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();
    let extensions = manager.get_extensions();
    match serde_json::to_value(extensions) {
        Ok(v) => BatchedResult::ok(id, v),
        Err(e) => BatchedResult::error(id, format!("Serialization error: {}", e)),
    }
}

async fn dispatch_get_enabled_extensions(app: &AppHandle, id: String) -> BatchedResult {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock();
    let extensions = manager.get_enabled_extensions();
    match serde_json::to_value(extensions) {
        Ok(v) => BatchedResult::ok(id, v),
        Err(e) => BatchedResult::error(id, format!("Serialization error: {}", e)),
    }
}

async fn dispatch_list_available_themes(app: &AppHandle, id: String) -> BatchedResult {
    let state = app.state::<ThemeState>();
    if state.themes.is_empty() {
        for stub in crate::themes::create_builtin_stubs() {
            state.themes.insert(stub.id.clone(), stub);
        }
    }
    let themes: Vec<crate::themes::ThemeData> = state
        .themes
        .iter()
        .map(|entry| entry.value().clone())
        .collect();
    match serde_json::to_value(themes) {
        Ok(v) => BatchedResult::ok(id, v),
        Err(e) => BatchedResult::error(id, format!("Serialization error: {}", e)),
    }
}

async fn dispatch_load_keybindings_file(id: String) -> BatchedResult {
    let result: Result<Vec<KeybindingEntry>, String> =
        crate::keybindings::load_keybindings_file_inner().await;
    match result {
        Ok(entries) => match serde_json::to_value(entries) {
            Ok(v) => BatchedResult::ok(id, v),
            Err(e) => BatchedResult::error(id, format!("Serialization error: {}", e)),
        },
        Err(e) => BatchedResult::error(id, e),
    }
}

fn dispatch_get_default_keybindings(id: String) -> BatchedResult {
    BatchedResult::ok(id, serde_json::Value::Array(Vec::new()))
}

/// Execute multiple IPC commands in a single round-trip.
///
/// Each call is dispatched concurrently. Results are returned in the same
/// order as the input calls.
#[tauri::command]
pub async fn batch_invoke(app: AppHandle, calls: Vec<BatchedCall>) -> Vec<BatchedResult> {
    debug!("batch_invoke: dispatching {} calls", calls.len());

    let futures: Vec<_> = calls
        .into_iter()
        .map(|call| {
            let app = app.clone();
            async move { dispatch_call(&app, call).await }
        })
        .collect();

    futures::future::join_all(futures).await
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn batched_call_deserialization() {
        let json = r#"{"id":"1","cmd":"get_version","args":{}}"#;
        let call: BatchedCall = serde_json::from_str(json).unwrap();
        assert_eq!(call.id, "1");
        assert_eq!(call.cmd, "get_version");
    }

    #[test]
    fn batched_call_deserialization_no_args() {
        let json = r#"{"id":"2","cmd":"settings_load"}"#;
        let call: BatchedCall = serde_json::from_str(json).unwrap();
        assert_eq!(call.id, "2");
        assert_eq!(call.cmd, "settings_load");
        assert!(call.args.is_null());
    }

    #[test]
    fn batched_result_ok_serialization() {
        let result = BatchedResult::ok("1".to_string(), serde_json::json!("2.22.0"));
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains(r#""status":"ok"#));
        assert!(json.contains(r#""id":"1"#));
        assert!(json.contains(r#""data":"2.22.0"#));
    }

    #[test]
    fn batched_result_error_serialization() {
        let result = BatchedResult::error("2".to_string(), "not found");
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains(r#""status":"error"#));
        assert!(json.contains(r#""error":"not found"#));
    }

    #[test]
    fn dispatch_get_version_returns_version() {
        let result = dispatch_get_version("test".to_string());
        match result.outcome {
            BatchedOutcome::Ok { data } => {
                assert!(data.as_str().is_some());
            }
            BatchedOutcome::Error { .. } => panic!("Expected Ok"),
        }
    }

    #[test]
    fn dispatch_get_default_keybindings_returns_empty() {
        let result = dispatch_get_default_keybindings("test".to_string());
        match result.outcome {
            BatchedOutcome::Ok { data } => {
                assert_eq!(data, serde_json::Value::Array(Vec::new()));
            }
            BatchedOutcome::Error { .. } => panic!("Expected Ok"),
        }
    }
}
