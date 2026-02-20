//! Watch expression management
//!
//! Manages watch expressions that are evaluated during debug sessions.
//! Watch expressions are stored in the debugger state and evaluated
//! against the current debug context.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

use super::state::DebuggerState;
use crate::LazyState;

/// A watch expression entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchExpression {
    pub id: String,
    pub expression: String,
    pub result: Option<WatchResult>,
}

/// Result of evaluating a watch expression
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchResult {
    pub value: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    pub variables_reference: i64,
    pub has_error: bool,
}

/// State for managing watch expressions (stored separately from debug sessions)
pub struct WatchState {
    expressions: Mutex<Vec<WatchExpression>>,
    next_id: Mutex<u64>,
}

impl WatchState {
    pub fn new() -> Self {
        Self {
            expressions: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
        }
    }
}

impl Default for WatchState {
    fn default() -> Self {
        Self::new()
    }
}

/// Add a watch expression
#[tauri::command]
pub async fn debug_add_watch(
    state: State<'_, WatchState>,
    expression: String,
) -> Result<WatchExpression, String> {
    let id = {
        let mut next_id = state.next_id.lock();
        let id = format!("watch_{}", *next_id);
        *next_id += 1;
        id
    };

    let watch = WatchExpression {
        id: id.clone(),
        expression,
        result: None,
    };

    state.expressions.lock().push(watch.clone());
    info!("Added watch expression: {}", id);

    Ok(watch)
}

/// Remove a watch expression by ID
#[tauri::command]
pub async fn debug_remove_watch(
    state: State<'_, WatchState>,
    watch_id: String,
) -> Result<(), String> {
    let mut expressions = state.expressions.lock();
    let len_before = expressions.len();
    expressions.retain(|w| w.id != watch_id);

    if expressions.len() == len_before {
        return Err(format!("Watch expression not found: {}", watch_id));
    }

    info!("Removed watch expression: {}", watch_id);
    Ok(())
}

/// Update a watch expression
#[tauri::command]
pub async fn debug_update_watch(
    state: State<'_, WatchState>,
    watch_id: String,
    expression: String,
) -> Result<WatchExpression, String> {
    let mut expressions = state.expressions.lock();
    let watch = expressions
        .iter_mut()
        .find(|w| w.id == watch_id)
        .ok_or_else(|| format!("Watch expression not found: {}", watch_id))?;

    watch.expression = expression;
    watch.result = None;
    let updated = watch.clone();

    Ok(updated)
}

/// Get all watch expressions
#[tauri::command]
pub async fn debug_get_watches(
    state: State<'_, WatchState>,
) -> Result<Vec<WatchExpression>, String> {
    Ok(state.expressions.lock().clone())
}

/// Evaluate all watch expressions against the current debug session
#[tauri::command]
pub async fn debug_evaluate_watches(
    watch_state: State<'_, WatchState>,
    debug_state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
) -> Result<Vec<WatchExpression>, String> {
    let expressions: Vec<WatchExpression> = watch_state.expressions.lock().clone();

    if expressions.is_empty() {
        return Ok(vec![]);
    }

    let sessions = debug_state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    let mut results = Vec::new();

    for mut watch in expressions {
        match session.evaluate(&watch.expression, Some("watch")).await {
            Ok(eval_result) => {
                watch.result = Some(WatchResult {
                    value: eval_result.result,
                    type_: eval_result.type_,
                    variables_reference: eval_result.variables_reference,
                    has_error: false,
                });
            }
            Err(e) => {
                watch.result = Some(WatchResult {
                    value: format!("{}", e),
                    type_: None,
                    variables_reference: 0,
                    has_error: true,
                });
            }
        }
        results.push(watch);
    }

    // Update stored results
    {
        let mut stored = watch_state.expressions.lock();
        for result in &results {
            if let Some(stored_watch) = stored.iter_mut().find(|w| w.id == result.id) {
                stored_watch.result = result.result.clone();
            }
        }
    }

    Ok(results)
}

/// Clear all watch expressions
#[tauri::command]
pub async fn debug_clear_watches(state: State<'_, WatchState>) -> Result<(), String> {
    state.expressions.lock().clear();
    info!("Cleared all watch expressions");
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_watch_state_new() {
        let state = WatchState::new();
        assert!(state.expressions.lock().is_empty());
    }

    #[test]
    fn test_watch_expression_serialization() {
        let watch = WatchExpression {
            id: "watch_1".to_string(),
            expression: "x + y".to_string(),
            result: Some(WatchResult {
                value: "42".to_string(),
                type_: Some("int".to_string()),
                variables_reference: 0,
                has_error: false,
            }),
        };

        let json = serde_json::to_string(&watch).unwrap();
        let deserialized: WatchExpression = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "watch_1");
        assert_eq!(deserialized.expression, "x + y");
        assert!(deserialized.result.is_some());
    }
}
