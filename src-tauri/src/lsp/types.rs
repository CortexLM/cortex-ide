//! LSP Types for the Cortex application
//!
//! These types are used for communication between the frontend and backend.

use serde::{Deserialize, Serialize};

/// Configuration for a language server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageServerConfig {
    /// Unique identifier for this language server instance
    pub id: String,
    /// Human-readable name (e.g., "rust-analyzer", "typescript-language-server")
    pub name: String,
    /// Path to the language server binary
    pub command: String,
    /// Arguments to pass to the language server
    pub args: Vec<String>,
    /// Working directory for the language server
    pub root_path: String,
    /// File extensions this server handles
    pub file_extensions: Vec<String>,
    /// Language ID for document identification
    pub language_id: String,
}

/// Status of a language server
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Starting,
    Running,
    Stopped,
    Error,
}

/// Information about a running language server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub id: String,
    pub name: String,
    pub status: ServerStatus,
    pub capabilities: Option<ServerCapabilities>,
}

/// Simplified server capabilities for the frontend
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerCapabilities {
    pub completion: bool,
    pub hover: bool,
    pub definition: bool,
    pub references: bool,
    pub diagnostics: bool,
    pub document_formatting: bool,
    pub document_range_formatting: bool,
    pub rename: bool,
    pub code_action: bool,
    pub signature_help: bool,
}

/// Position in a text document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    /// Line number (0-based)
    pub line: u32,
    /// Character offset (0-based, UTF-16 code units)
    pub character: u32,
}

/// Range in a text document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// A location in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

/// Diagnostic severity
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

/// A diagnostic message from the language server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: Option<DiagnosticSeverity>,
    pub code: Option<String>,
    pub source: Option<String>,
    pub message: String,
    pub related_information: Option<Vec<DiagnosticRelatedInfo>>,
}

/// Related information for a diagnostic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticRelatedInfo {
    pub location: Location,
    pub message: String,
}

/// Completion item kind
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CompletionItemKind {
    Text = 1,
    Method = 2,
    Function = 3,
    Constructor = 4,
    Field = 5,
    Variable = 6,
    Class = 7,
    Interface = 8,
    Module = 9,
    Property = 10,
    Unit = 11,
    Value = 12,
    Enum = 13,
    Keyword = 14,
    Snippet = 15,
    Color = 16,
    File = 17,
    Reference = 18,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}

/// A completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: Option<CompletionItemKind>,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
    pub insert_text_format: Option<u8>,
    pub text_edit: Option<TextEdit>,
    pub additional_text_edits: Option<Vec<TextEdit>>,
    pub sort_text: Option<String>,
    pub filter_text: Option<String>,
}

/// Text edit operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

/// Hover information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverInfo {
    pub contents: String,
    pub range: Option<Range>,
}

/// Document parameters for LSP requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentIdentifier {
    pub uri: String,
}

/// Parameters for opening a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidOpenParams {
    pub uri: String,
    pub language_id: String,
    pub version: i32,
    pub text: String,
}

/// Parameters for document changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidChangeParams {
    pub uri: String,
    pub version: i32,
    pub text: String,
}

/// Parameters for saving a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidSaveParams {
    pub uri: String,
    pub text: Option<String>,
}

/// Parameters for closing a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidCloseParams {
    pub uri: String,
}

/// Parameters for position-based requests (hover, definition, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentPositionParams {
    pub uri: String,
    pub position: Position,
}

/// Parameters for completion requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionParams {
    pub uri: String,
    pub position: Position,
    pub trigger_kind: Option<u8>,
    pub trigger_character: Option<String>,
}

/// Completion result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResult {
    pub items: Vec<CompletionItem>,
    pub is_incomplete: bool,
}

/// Definition result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefinitionResult {
    pub locations: Vec<Location>,
}

/// References result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferencesResult {
    pub locations: Vec<Location>,
}

/// Diagnostics for a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentDiagnostics {
    pub uri: String,
    pub version: Option<i32>,
    pub diagnostics: Vec<Diagnostic>,
}

/// Event emitted when diagnostics are published
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsEvent {
    pub server_id: String,
    pub uri: String,
    pub diagnostics: Vec<Diagnostic>,
}

/// Rename parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameParams {
    pub uri: String,
    pub position: Position,
    pub new_name: String,
}

/// Workspace edit result from rename
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEdit {
    /// Map of file URIs to text edits
    pub changes: Option<std::collections::HashMap<String, Vec<TextEdit>>>,
}

/// Code action parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeActionParams {
    pub uri: String,
    pub range: Range,
    pub diagnostics: Vec<Diagnostic>,
}

/// Code action kind
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeActionKind {
    QuickFix,
    Refactor,
    RefactorExtract,
    RefactorInline,
    RefactorRewrite,
    Source,
    SourceOrganizeImports,
    SourceFixAll,
}

/// A code action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAction {
    pub title: String,
    pub kind: Option<String>,
    pub diagnostics: Option<Vec<Diagnostic>>,
    pub is_preferred: Option<bool>,
    pub edit: Option<WorkspaceEdit>,
    pub command: Option<Command>,
}

/// LSP command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub title: String,
    pub command: String,
    pub arguments: Option<Vec<serde_json::Value>>,
}

/// Code action result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeActionResult {
    pub actions: Vec<CodeAction>,
}

/// Document formatting parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormattingParams {
    pub uri: String,
    pub tab_size: u32,
    pub insert_spaces: bool,
}

/// Range formatting parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RangeFormattingParams {
    pub uri: String,
    pub range: Range,
    pub tab_size: u32,
    pub insert_spaces: bool,
}

/// Formatting result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormattingResult {
    pub edits: Vec<TextEdit>,
}

/// Signature help parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureHelpParams {
    pub uri: String,
    pub position: Position,
    pub trigger_kind: Option<u8>,
    pub trigger_character: Option<String>,
    pub is_retrigger: Option<bool>,
}

/// Parameter information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterInformation {
    pub label: String,
    pub documentation: Option<String>,
}

/// Signature information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureInformation {
    pub label: String,
    pub documentation: Option<String>,
    pub parameters: Option<Vec<ParameterInformation>>,
    pub active_parameter: Option<u32>,
}

/// Signature help result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureHelp {
    pub signatures: Vec<SignatureInformation>,
    pub active_signature: Option<u32>,
    pub active_parameter: Option<u32>,
}

/// Type definition result (same structure as definition)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeDefinitionResult {
    pub locations: Vec<Location>,
}

/// Implementation result (same structure as definition)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImplementationResult {
    pub locations: Vec<Location>,
}

// ============================================================================
// CodeLens Types
// ============================================================================

/// Parameters for CodeLens requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeLensParams {
    pub uri: String,
}

/// A CodeLens represents a command that should be shown along with source text
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeLens {
    /// The range in which this code lens is valid
    pub range: Range,
    /// The command this code lens represents (optional until resolved)
    pub command: Option<Command>,
    /// A data entry field that is preserved on a code lens item between
    /// a code lens request and a code lens resolve request
    pub data: Option<serde_json::Value>,
}

/// Result of a CodeLens request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeLensResult {
    pub lenses: Vec<CodeLens>,
}

// ============================================================================
// Semantic Tokens Types
// ============================================================================

/// Parameters for semantic tokens full request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTokensParams {
    pub uri: String,
}

/// Semantic tokens represent additional color information for a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTokens {
    /// The actual tokens data (encoded as relative positions)
    pub data: Vec<u32>,
    /// An optional result id for delta requests
    #[serde(rename = "resultId")]
    pub result_id: Option<String>,
}

/// Result of a semantic tokens request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTokensResult {
    pub data: Vec<u32>,
    #[serde(rename = "resultId")]
    pub result_id: Option<String>,
}

/// Semantic token types legend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTokensLegend {
    #[serde(rename = "tokenTypes")]
    pub token_types: Vec<String>,
    #[serde(rename = "tokenModifiers")]
    pub token_modifiers: Vec<String>,
}

// ============================================================================
// Workspace Symbol Types
// ============================================================================

/// Parameters for workspace symbol requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSymbolParams {
    pub query: String,
}

/// Result of a workspace symbol request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSymbolResult {
    pub symbols: Vec<SymbolInformation>,
}

/// Information about a symbol in the workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInformation {
    pub name: String,
    pub kind: u32,
    pub location: Location,
    pub container_name: Option<String>,
    pub tags: Option<Vec<u32>>,
}

// ============================================================================
// On-Type Formatting Types
// ============================================================================

/// Parameters for on-type formatting requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnTypeFormattingParams {
    pub uri: String,
    pub position: Position,
    pub ch: String,
    pub tab_size: u32,
    pub insert_spaces: bool,
}

// ============================================================================
// Prepare Rename Types
// ============================================================================

/// Result of a prepare rename request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrepareRenameResult {
    pub range: Range,
    pub placeholder: Option<String>,
}

// ============================================================================
// Call Hierarchy Types
// ============================================================================

/// Represents a call hierarchy item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyItem {
    pub name: String,
    pub kind: u32,
    pub tags: Option<Vec<u32>>,
    pub detail: Option<String>,
    pub uri: String,
    pub range: Range,
    pub selection_range: Range,
    pub data: Option<serde_json::Value>,
}

/// Represents an incoming call in the call hierarchy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyIncomingCall {
    pub from: CallHierarchyItem,
    pub from_ranges: Vec<Range>,
}

/// Represents an outgoing call in the call hierarchy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyOutgoingCall {
    pub to: CallHierarchyItem,
    pub from_ranges: Vec<Range>,
}

/// Parameters for call hierarchy prepare requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyPrepareParams {
    pub uri: String,
    pub position: Position,
}

/// Parameters for call hierarchy incoming/outgoing calls requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyCallsParams {
    pub item: CallHierarchyItem,
}

// ============================================================================
// Type Hierarchy Types
// ============================================================================

/// Represents a type hierarchy item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeHierarchyItem {
    pub name: String,
    pub kind: u32,
    pub tags: Option<Vec<u32>>,
    pub detail: Option<String>,
    pub uri: String,
    pub range: Range,
    pub selection_range: Range,
    pub data: Option<serde_json::Value>,
}

/// Parameters for type hierarchy prepare requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeHierarchyPrepareParams {
    pub uri: String,
    pub position: Position,
}

/// Parameters for type hierarchy supertypes requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeHierarchySupertypesParams {
    pub item: TypeHierarchyItem,
}

/// Parameters for type hierarchy subtypes requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeHierarchySubtypesParams {
    pub item: TypeHierarchyItem,
}

// ============================================================================
// LSP Server Autodetect Types
// ============================================================================

/// Result of autodetecting an LSP server for a language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerAutodetectResult {
    pub language: String,
    pub server_name: String,
    pub command: String,
    pub args: Vec<String>,
    pub file_extensions: Vec<String>,
    pub installed: bool,
}
