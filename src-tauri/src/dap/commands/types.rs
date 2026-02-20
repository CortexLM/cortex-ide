//! Common types for DAP commands
//!
//! This module contains all request/response types used by the DAP commands.

use serde::{Deserialize, Serialize};

use super::super::{DebugSessionState, protocol::DisassembledInstruction};

/// Information about a debug session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugSessionInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub state: DebugSessionState,
}

/// A breakpoint location request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointLocation {
    pub path: String,
    pub line: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_message: Option<String>,
}

/// A breakpoint that has been set in a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionBreakpoint {
    pub id: Option<i64>,
    pub path: String,
    pub line: i64,
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Result of evaluating an expression
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateResult {
    pub result: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    pub variables_reference: i64,
}

/// Result of setting a variable's value
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetVariableResult {
    /// The new value of the variable
    pub value: String,
    /// The type of the new value
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    /// If variablesReference is > 0, the new value is structured
    pub variables_reference: i64,
}

/// Result of a disassemble operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisassembleResult {
    pub instructions: Vec<DisassembledInstruction>,
}

/// Input for an instruction breakpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionBreakpointInput {
    pub instruction_reference: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
}

/// Result of setting instruction breakpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionBreakpointResult {
    pub breakpoints: Vec<SessionBreakpoint>,
}

/// Input for a data breakpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataBreakpointInput {
    pub data_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
}

/// Result of setting data breakpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataBreakpointResult {
    pub breakpoints: Vec<SessionBreakpoint>,
}

/// Input for an exception filter option
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionFilterOptionInput {
    pub filter_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
}

/// Result of setting exception breakpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionBreakpointResult {
    pub breakpoints: Option<Vec<SessionBreakpoint>>,
}
