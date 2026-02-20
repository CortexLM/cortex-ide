//! DAP Protocol request argument types
//!
//! These types represent the arguments for various DAP requests.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::types::{
    DataBreakpoint, ExceptionFilterOptions, ExceptionOptions, FunctionBreakpoint,
    InstructionBreakpoint, Source, SourceBreakpoint, StackFrameFormat, SteppingGranularity,
    ValueFormat,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeRequestArguments {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_name: Option<String>,
    pub adapter_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines_start_at1: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns_start_at1: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_variable_type: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_variable_paging: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_run_in_terminal_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_memory_references: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_progress_reporting: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_invalidated_event: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_memory_event: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_start_debugging_request: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequestArguments {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub no_debug: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restart: Option<serde_json::Value>,
    // Additional fields are adapter-specific
    #[serde(flatten)]
    pub additional: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AttachRequestArguments {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restart: Option<serde_json::Value>,
    // Additional fields are adapter-specific
    #[serde(flatten)]
    pub additional: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetBreakpointsArguments {
    pub source: Source,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breakpoints: Option<Vec<SourceBreakpoint>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<i64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_modified: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetFunctionBreakpointsArguments {
    pub breakpoints: Vec<FunctionBreakpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetExceptionBreakpointsArguments {
    pub filters: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_options: Option<Vec<ExceptionFilterOptions>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exception_options: Option<Vec<ExceptionOptions>>,
}

/// Arguments for the disassemble request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisassembleArguments {
    pub memory_reference: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction_offset: Option<i64>,
    pub instruction_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolve_symbols: Option<bool>,
}

/// Arguments for read memory request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMemoryArguments {
    pub memory_reference: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    pub count: i64,
}

/// Arguments for write memory request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteMemoryArguments {
    pub memory_reference: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_partial: Option<bool>,
    pub data: String,
}

/// Arguments for set instruction breakpoints request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetInstructionBreakpointsArguments {
    pub breakpoints: Vec<InstructionBreakpoint>,
}

/// Arguments for set data breakpoints request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDataBreakpointsArguments {
    pub breakpoints: Vec<DataBreakpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinueArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub single_thread: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NextArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub single_thread: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granularity: Option<SteppingGranularity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepInArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub single_thread: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granularity: Option<SteppingGranularity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepOutArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub single_thread: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granularity: Option<SteppingGranularity>,
}

/// Arguments for step back request (reverse debugging)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepBackArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub single_thread: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granularity: Option<SteppingGranularity>,
}

/// Arguments for reverse continue request (reverse debugging)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReverseContinueArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub single_thread: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PauseArguments {
    pub thread_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StackTraceArguments {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_frame: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub levels: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<StackFrameFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopesArguments {
    pub frame_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablesArguments {
    pub variables_reference: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<ValueFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateArguments {
    pub expression: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<ValueFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetExpressionArguments {
    pub expression: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<ValueFormat>,
}

/// Arguments for the setVariable request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetVariableArguments {
    /// The reference of the variable container (scope or parent variable)
    pub variables_reference: i64,
    /// The name of the variable in the container
    pub name: String,
    /// The new value of the variable
    pub value: String,
    /// Optional format for the value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<ValueFormat>,
}

/// Arguments for the completions request (DAP)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionsArguments {
    /// Returns completions in the scope of this stack frame. If not specified, the completions are returned for the global scope.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame_id: Option<i64>,
    /// One or more source lines. Typically this is the text users have typed into the debug console before they asked for completion.
    pub text: String,
    /// The position within `text` for which to determine the completion proposals. It is measured in UTF-16 code units and the client capability `columnsStartAt1` determines whether it is 0- or 1-based.
    pub column: i64,
    /// A line for which to determine the completion proposals. If missing the first line of the text is assumed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
}
