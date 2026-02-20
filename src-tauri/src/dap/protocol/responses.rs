//! DAP Protocol response body types
//!
//! These types represent the response bodies for various DAP requests.

use serde::{Deserialize, Serialize};

use super::types::{
    Breakpoint, CompletionItem, DisassembledInstruction, Module, Scope, StackFrame, Thread,
    Variable, VariablePresentationHint,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_configuration_done_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_function_breakpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_conditional_breakpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_hit_conditional_breakpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_evaluate_for_hovers: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_step_back: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_reverse_continue: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_set_variable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_restart_frame: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_goto_targets_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_step_in_targets_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_completions_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_modules_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_restart_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_exception_options: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_value_formatting_options: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_exception_info_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub support_terminate_debuggee: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub support_suspend_debuggee: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_delayed_stack_trace_loading: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_loaded_sources_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_log_points: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_terminate_threads_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_set_expression: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_terminate_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_data_breakpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_read_memory_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_write_memory_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_disassemble_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_cancel_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_breakpoint_locations_request: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_clipboard_context: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_stepping_granularity: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_instruction_breakpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_exception_filter_options: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_single_thread_execution_requests: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetBreakpointsResponse {
    pub breakpoints: Vec<Breakpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetFunctionBreakpointsResponse {
    pub breakpoints: Vec<Breakpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinueResponse {
    pub all_threads_continued: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StackTraceResponse {
    pub stack_frames: Vec<StackFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_frames: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopesResponse {
    pub scopes: Vec<Scope>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablesResponse {
    pub variables: Vec<Variable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadsResponse {
    pub threads: Vec<Thread>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateResponse {
    pub result: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation_hint: Option<VariablePresentationHint>,
    pub variables_reference: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub named_variables: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexed_variables: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_reference: Option<String>,
}

/// Response to setVariable request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetVariableResponse {
    /// The new value of the variable
    pub value: String,
    /// The type of the new value (if available)
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    /// If variablesReference is > 0, the new value is structured and has children
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables_reference: Option<i64>,
    /// The number of named child variables
    #[serde(skip_serializing_if = "Option::is_none")]
    pub named_variables: Option<i64>,
    /// The number of indexed child variables
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexed_variables: Option<i64>,
}

/// Response to completions request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionsResponse {
    /// The possible completions
    pub targets: Vec<CompletionItem>,
}

/// Response for disassemble request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisassembleResponse {
    pub instructions: Vec<DisassembledInstruction>,
}

/// Response for read memory request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMemoryResponse {
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unreadable_bytes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
}

/// Response for write memory request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteMemoryResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_written: Option<i64>,
}

/// Response for set instruction breakpoints request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetInstructionBreakpointsResponse {
    pub breakpoints: Vec<Breakpoint>,
}

/// Response for set data breakpoints request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDataBreakpointsResponse {
    pub breakpoints: Vec<Breakpoint>,
}

/// Response for set exception breakpoints request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetExceptionBreakpointsResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breakpoints: Option<Vec<Breakpoint>>,
}

/// Response from setExpression request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetExpressionResponse {
    /// The new value of the expression
    pub value: String,
    /// The optional type of the value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    /// If > 0, the value is structured and can be retrieved
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables_reference: Option<i64>,
    /// Number of named child variables
    #[serde(skip_serializing_if = "Option::is_none")]
    pub named_variables: Option<i64>,
    /// Number of indexed child variables
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexed_variables: Option<i64>,
}

/// Response from source request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceResponse {
    /// Content of the source file
    pub content: String,
    /// Optional mime type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

/// Response from exceptionInfo request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionInfoResponse {
    /// ID of the exception that was thrown
    pub exception_id: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Mode that caused the exception to break
    pub break_mode: String,
    /// Detailed information about the exception
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

/// Response from dataBreakpointInfo request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataBreakpointInfoResponse {
    /// Identifier for the data on which breakpoint can be registered
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_id: Option<String>,
    /// UI string that describes the variable
    pub description: String,
    /// Optional list of access types supported
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_types: Option<Vec<String>>,
    /// Whether the data breakpoint can persist across sessions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_persist: Option<bool>,
}

/// Response from modules request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModulesResponse {
    /// All modules
    pub modules: Vec<Module>,
    /// Total number of modules available
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_modules: Option<i64>,
}
