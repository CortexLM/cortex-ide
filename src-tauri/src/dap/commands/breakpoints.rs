//! Breakpoint management commands
//!
//! This module contains Tauri commands for managing breakpoints:
//! setting, toggling, and getting breakpoints of various types.

use std::collections::HashMap;

use tauri::State;

use super::super::protocol::{
    DataBreakpoint, DataBreakpointAccessType, DataBreakpointInfoResponse, ExceptionFilterOptions,
    InstructionBreakpoint,
};
use super::state::DebuggerState;
use super::types::{
    BreakpointLocation, DataBreakpointInput, DataBreakpointResult, ExceptionBreakpointResult,
    ExceptionFilterOptionInput, InstructionBreakpointInput, InstructionBreakpointResult,
    SessionBreakpoint,
};
use crate::LazyState;

/// Set breakpoints for a file
#[tauri::command]
pub async fn debug_set_breakpoints(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    path: String,
    breakpoints: Vec<BreakpointLocation>,
) -> Result<Vec<SessionBreakpoint>, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    let lines: Vec<i64> = breakpoints.iter().map(|bp| bp.line).collect();
    let conditions: Vec<Option<String>> =
        breakpoints.iter().map(|bp| bp.condition.clone()).collect();
    let hit_conditions: Vec<Option<String>> = breakpoints
        .iter()
        .map(|bp| bp.hit_condition.clone())
        .collect();
    let log_messages: Vec<Option<String>> = breakpoints
        .iter()
        .map(|bp| bp.log_message.clone())
        .collect();

    let result = session
        .set_breakpoints(
            &path,
            lines,
            Some(conditions),
            Some(hit_conditions),
            Some(log_messages),
        )
        .await
        .map_err(|e| format!("Failed to set breakpoints: {}", e))?;

    Ok(result
        .into_iter()
        .map(|bp| SessionBreakpoint {
            id: bp.id,
            path: bp.path,
            line: bp.line,
            verified: bp.verified,
            message: bp.message,
        })
        .collect())
}

/// Set function breakpoints
#[tauri::command]
pub async fn debug_set_function_breakpoints(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    function_names: Vec<String>,
    conditions: Option<Vec<Option<String>>>,
) -> Result<Vec<SessionBreakpoint>, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    let result = session
        .set_function_breakpoints(function_names, conditions)
        .await
        .map_err(|e| format!("Failed to set function breakpoints: {}", e))?;

    Ok(result
        .into_iter()
        .map(|bp| SessionBreakpoint {
            id: bp.id,
            path: bp.path,
            line: bp.line,
            verified: bp.verified,
            message: bp.message,
        })
        .collect())
}

/// Toggle a breakpoint at a specific line
#[tauri::command]
pub async fn debug_toggle_breakpoint(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    path: String,
    line: i64,
) -> Result<Vec<SessionBreakpoint>, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let result = session
        .toggle_breakpoint(&path, line)
        .await
        .map_err(|e| format!("Failed to toggle breakpoint: {}", e))?;

    Ok(result
        .into_iter()
        .map(|bp| SessionBreakpoint {
            id: bp.id,
            path: bp.path,
            line: bp.line,
            verified: bp.verified,
            message: bp.message,
        })
        .collect())
}

/// Get all breakpoints for a session
#[tauri::command]
pub async fn debug_get_breakpoints(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
) -> Result<HashMap<String, Vec<SessionBreakpoint>>, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let breakpoints = session.breakpoints().await;

    Ok(breakpoints
        .into_iter()
        .map(|(path, bps)| {
            (
                path,
                bps.into_iter()
                    .map(|bp| SessionBreakpoint {
                        id: bp.id,
                        path: bp.path,
                        line: bp.line,
                        verified: bp.verified,
                        message: bp.message,
                    })
                    .collect(),
            )
        })
        .collect())
}

/// Set instruction breakpoints
#[tauri::command]
pub async fn debug_set_instruction_breakpoint(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    breakpoints: Vec<InstructionBreakpointInput>,
) -> Result<InstructionBreakpointResult, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    let instruction_breakpoints: Vec<InstructionBreakpoint> = breakpoints
        .into_iter()
        .map(|bp| InstructionBreakpoint {
            instruction_reference: bp.instruction_reference,
            offset: bp.offset,
            condition: bp.condition,
            hit_condition: bp.hit_condition,
        })
        .collect();

    let result = session
        .set_instruction_breakpoints(instruction_breakpoints)
        .await
        .map_err(|e| format!("Failed to set instruction breakpoints: {}", e))?;

    Ok(InstructionBreakpointResult {
        breakpoints: result
            .into_iter()
            .map(|bp| SessionBreakpoint {
                id: bp.id,
                path: bp.instruction_reference.unwrap_or_default(),
                line: bp.line.unwrap_or(0),
                verified: bp.verified,
                message: bp.message,
            })
            .collect(),
    })
}

/// Remove instruction breakpoints (by setting an empty list)
#[tauri::command]
pub async fn debug_remove_instruction_breakpoint(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    instruction_references: Vec<String>,
) -> Result<(), String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    // To remove specific breakpoints, we get the current list, filter out the ones to remove,
    // and set the remaining ones. However, DAP doesn't support removing individual instruction
    // breakpoints - you have to set all of them at once. For now, we'll just clear all if
    // an empty list is passed, or this command can be used to set the remaining breakpoints.
    // The frontend should maintain the list and pass the remaining breakpoints.

    // If instruction_references is empty, this effectively removes all instruction breakpoints
    let breakpoints: Vec<InstructionBreakpoint> = instruction_references
        .into_iter()
        .map(|ir| InstructionBreakpoint {
            instruction_reference: ir,
            offset: None,
            condition: None,
            hit_condition: None,
        })
        .collect();

    session
        .set_instruction_breakpoints(breakpoints)
        .await
        .map_err(|e| format!("Failed to remove instruction breakpoints: {}", e))?;

    Ok(())
}

/// Set data breakpoints (watchpoints)
#[tauri::command]
pub async fn debug_set_data_breakpoints(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    breakpoints: Vec<DataBreakpointInput>,
) -> Result<DataBreakpointResult, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    let data_breakpoints: Vec<DataBreakpoint> = breakpoints
        .into_iter()
        .map(|bp| DataBreakpoint {
            data_id: bp.data_id,
            access_type: bp.access_type.map(|at| match at.to_lowercase().as_str() {
                "read" => DataBreakpointAccessType::Read,
                "write" => DataBreakpointAccessType::Write,
                _ => DataBreakpointAccessType::ReadWrite,
            }),
            condition: bp.condition,
            hit_condition: bp.hit_condition,
        })
        .collect();

    let result = session
        .set_data_breakpoints(data_breakpoints)
        .await
        .map_err(|e| format!("Failed to set data breakpoints: {}", e))?;

    Ok(DataBreakpointResult {
        breakpoints: result
            .into_iter()
            .map(|bp| SessionBreakpoint {
                id: bp.id,
                path: "[data]".to_string(),
                line: bp.line.unwrap_or(0),
                verified: bp.verified,
                message: bp.message,
            })
            .collect(),
    })
}

/// Set exception breakpoints
#[tauri::command]
pub async fn debug_set_exception_breakpoints(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    filters: Vec<String>,
    filter_options: Option<Vec<ExceptionFilterOptionInput>>,
) -> Result<ExceptionBreakpointResult, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;

    let exception_filter_options: Option<Vec<ExceptionFilterOptions>> =
        filter_options.map(|opts| {
            opts.into_iter()
                .map(|opt| ExceptionFilterOptions {
                    filter_id: opt.filter_id,
                    condition: opt.condition,
                })
                .collect()
        });

    let result = session
        .set_exception_breakpoints(filters, exception_filter_options, None)
        .await
        .map_err(|e| format!("Failed to set exception breakpoints: {}", e))?;

    Ok(ExceptionBreakpointResult {
        breakpoints: result.map(|bps| {
            bps.into_iter()
                .map(|bp| SessionBreakpoint {
                    id: bp.id,
                    path: "[exception]".to_string(),
                    line: bp.line.unwrap_or(0),
                    verified: bp.verified,
                    message: bp.message,
                })
                .collect()
        }),
    })
}

/// Get data breakpoint info for a variable (check if data breakpoint can be set)
#[tauri::command]
pub async fn debug_data_breakpoint_info(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    variables_reference: Option<i64>,
    name: String,
    frame_id: Option<i64>,
) -> Result<DataBreakpointInfoResponse, String> {
    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    let session = session.read().await;
    session
        .data_breakpoint_info(variables_reference, &name, frame_id)
        .await
        .map_err(|e| e.to_string())
}
