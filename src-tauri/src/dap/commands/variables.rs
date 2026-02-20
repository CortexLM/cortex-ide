//! Variable and evaluation commands
//!
//! This module contains Tauri commands for working with variables and expressions:
//! getting variables, expanding them, evaluating expressions, and setting values.

use tauri::State;

use super::super::protocol::{SetExpressionResponse, Variable};
use super::state::DebuggerState;
use super::types::{EvaluateResult, SetVariableResult};
use super::validation::validate_session_id;

const MAX_EXPRESSION_LEN: usize = 10_000;
const MAX_NAME_LEN: usize = 1_000;
const MAX_VALUE_LEN: usize = 100_000;

fn validate_expression(expression: &str) -> Result<(), String> {
    if expression.trim().is_empty() {
        return Err("Expression cannot be empty".to_string());
    }
    if expression.len() > MAX_EXPRESSION_LEN {
        return Err(format!(
            "Expression exceeds maximum length of {} characters",
            MAX_EXPRESSION_LEN
        ));
    }
    Ok(())
}

fn validate_variable_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Variable name cannot be empty".to_string());
    }
    if name.len() > MAX_NAME_LEN {
        return Err(format!(
            "Variable name exceeds maximum length of {} characters",
            MAX_NAME_LEN
        ));
    }
    Ok(())
}

fn validate_value(value: &str) -> Result<(), String> {
    if value.len() > MAX_VALUE_LEN {
        return Err(format!(
            "Value exceeds maximum length of {} characters",
            MAX_VALUE_LEN
        ));
    }
    Ok(())
}

/// Get variables for current frame
#[tauri::command]
pub async fn debug_get_variables(
    state: State<'_, DebuggerState>,
    session_id: String,
) -> Result<Vec<Variable>, String> {
    validate_session_id(&session_id)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .get_variables()
        .await
        .map_err(|e| format!("Failed to get variables: {}", e))
}

/// Expand a variable (get children)
#[tauri::command]
pub async fn debug_expand_variable(
    state: State<'_, DebuggerState>,
    session_id: String,
    variables_reference: i64,
) -> Result<Vec<Variable>, String> {
    validate_session_id(&session_id)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .expand_variable(variables_reference)
        .await
        .map_err(|e| format!("Failed to expand variable: {}", e))
}

/// Expand a variable with paging support (get children with start/count)
#[tauri::command]
pub async fn debug_expand_variable_paged(
    state: State<'_, DebuggerState>,
    session_id: String,
    variables_reference: i64,
    start: Option<i64>,
    count: Option<i64>,
) -> Result<Vec<Variable>, String> {
    validate_session_id(&session_id)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .expand_variable_paged(variables_reference, start, count)
        .await
        .map_err(|e| format!("Failed to expand variable: {}", e))
}

/// Evaluate an expression
#[tauri::command]
pub async fn debug_evaluate(
    state: State<'_, DebuggerState>,
    session_id: String,
    expression: String,
    context: Option<String>,
) -> Result<EvaluateResult, String> {
    validate_session_id(&session_id)?;
    validate_expression(&expression)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let result = session
        .evaluate(&expression, context.as_deref())
        .await
        .map_err(|e| format!("Failed to evaluate: {}", e))?;

    Ok(EvaluateResult {
        result: result.result,
        type_: result.type_,
        variables_reference: result.variables_reference,
    })
}

/// Set the value of a variable
#[tauri::command]
pub async fn debug_set_variable(
    state: State<'_, DebuggerState>,
    session_id: String,
    variables_reference: i64,
    name: String,
    value: String,
) -> Result<SetVariableResult, String> {
    validate_session_id(&session_id)?;
    validate_variable_name(&name)?;
    validate_value(&value)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let result = session
        .set_variable(variables_reference, &name, &value)
        .await
        .map_err(|e| format!("Failed to set variable: {}", e))?;

    Ok(SetVariableResult {
        value: result.value,
        type_: result.type_,
        variables_reference: result.variables_reference.unwrap_or(0),
    })
}

/// Set an expression value
#[tauri::command]
pub async fn debug_set_expression(
    state: State<'_, DebuggerState>,
    session_id: String,
    expression: String,
    value: String,
    frame_id: Option<i64>,
) -> Result<SetExpressionResponse, String> {
    validate_session_id(&session_id)?;
    validate_expression(&expression)?;
    validate_value(&value)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .set_expression(&expression, &value, frame_id)
        .await
        .map_err(|e| e.to_string())
}

/// Evaluate an expression in REPL context
#[tauri::command]
pub async fn debug_evaluate_repl(
    state: State<'_, DebuggerState>,
    session_id: String,
    expression: String,
) -> Result<EvaluateResult, String> {
    validate_session_id(&session_id)?;
    validate_expression(&expression)?;

    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let result = session
        .evaluate(&expression, Some("repl"))
        .await
        .map_err(|e| format!("Failed to evaluate in REPL: {}", e))?;

    Ok(EvaluateResult {
        result: result.result,
        type_: result.type_,
        variables_reference: result.variables_reference,
    })
}
