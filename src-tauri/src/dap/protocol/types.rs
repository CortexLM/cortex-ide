//! DAP Protocol common types
//!
//! These types represent common data structures used throughout the
//! Debug Adapter Protocol.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_reference: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<Source>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksums: Option<Vec<Checksum>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checksum {
    pub algorithm: String,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceBreakpoint {
    pub line: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Breakpoint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction_reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionBreakpoint {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Vec<ExceptionPathSegment>>,
    pub break_mode: ExceptionBreakMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionPathSegment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negate: Option<bool>,
    pub names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExceptionBreakMode {
    Never,
    Always,
    Unhandled,
    UserUnhandled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExceptionFilterOptions {
    pub filter_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
}

/// An instruction breakpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionBreakpoint {
    pub instruction_reference: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
}

/// A data breakpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataBreakpoint {
    pub data_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_type: Option<DataBreakpointAccessType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
}

/// Access type for data breakpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DataBreakpointAccessType {
    Read,
    Write,
    ReadWrite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StackFrame {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
    pub line: i64,
    pub column: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_restart: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction_pointer_reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scope {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation_hint: Option<String>,
    pub variables_reference: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub named_variables: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexed_variables: Option<i64>,
    pub expensive: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Variable {
    pub name: String,
    pub value: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation_hint: Option<VariablePresentationHint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evaluate_name: Option<String>,
    pub variables_reference: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub named_variables: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexed_variables: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablePresentationHint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attributes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lazy: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Thread {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SteppingGranularity {
    Statement,
    Line,
    Instruction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StackFrameFormat {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_types: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_names: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_values: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_all: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValueFormat {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hex: Option<bool>,
}

/// A completion item represents a possible completion in the debug console
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionItem {
    /// The label of this completion item. By default, this is also the text that is inserted when selecting this completion.
    pub label: String,
    /// If text is returned and not an empty string, then it is inserted instead of the label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// A string that should be used when comparing this item with other items. If not returned, the label is used instead.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_text: Option<String>,
    /// A human-readable string with additional information about this item, like type or symbol information.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// The item's type. Typically the client uses this information to render the item in the UI with an icon.
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<CompletionItemType>,
    /// Start position (0-based) where the completion text is added. The start position can precede the current column to handle cases like word completion.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<i64>,
    /// Length determines how many characters are overwritten by the completion text and it is measured in UTF-16 code units.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<i64>,
    /// Determines the start of the new selection after the text has been inserted (or replaced). `selectionStart` is measured in UTF-16 code units and must be in the range 0 and length of the completion text. If omitted the selection starts at the end of the completion text.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selection_start: Option<i64>,
    /// Determines the length of the new selection after the text has been inserted (or replaced) and it is measured in UTF-16 code units. The selection can not extend beyond the bounds of the completion text. If omitted the length is assumed to be 0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selection_length: Option<i64>,
}

/// The kind of completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompletionItemType {
    Method,
    Function,
    Constructor,
    Field,
    Variable,
    Class,
    Interface,
    Module,
    Property,
    Unit,
    Value,
    Enum,
    Keyword,
    Snippet,
    Text,
    Color,
    File,
    Reference,
    CustomColor,
}

/// A disassembled instruction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisassembledInstruction {
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction_bytes: Option<String>,
    pub instruction: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<Source>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<i64>,
}

/// Goto target - a location that can be jumped to
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GotoTarget {
    /// Unique identifier for this goto target
    pub id: i64,
    /// The name of the goto target (shown in the UI)
    pub label: String,
    /// The line of the goto target
    pub line: i64,
    /// Optional column of the goto target
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    /// Optional end line
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<i64>,
    /// Optional end column
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<i64>,
    /// Optional instruction pointer reference
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instruction_pointer_reference: Option<String>,
}

/// Step-in target - a function that can be stepped into
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepInTarget {
    /// Unique identifier for this step-in target
    pub id: i64,
    /// The name of the step-in target (function name)
    pub label: String,
    /// Optional line number
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
    /// Optional column number
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    /// Optional end line
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<i64>,
    /// Optional end column
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<i64>,
}

/// Module information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Module {
    /// Unique identifier for the module
    pub id: serde_json::Value, // Can be number or string
    /// Name of the module
    pub name: String,
    /// Optional path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Whether this module is optimized
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_optimized: Option<bool>,
    /// Whether symbols were loaded
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_user_code: Option<bool>,
    /// Version string
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Symbol status
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol_status: Option<String>,
    /// Symbol file path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol_file_path: Option<String>,
    /// Date and time stamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_time_stamp: Option<String>,
    /// Address range covered by this module
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address_range: Option<String>,
}
