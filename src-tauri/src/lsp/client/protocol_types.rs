//! LSP protocol types used for internal communication
//!
//! These types are used for serialization/deserialization of LSP messages.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Parameters for LSP initialize request
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct InitializeParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_id: Option<i32>,
    #[serde(rename = "rootUri", skip_serializing_if = "Option::is_none")]
    pub root_uri: Option<String>,
    pub capabilities: ClientCapabilities,
}

/// Client capabilities sent during initialization
#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct ClientCapabilities {
    #[serde(rename = "textDocument")]
    pub text_document: Option<TextDocumentClientCapabilities>,
}

/// Text document specific client capabilities
#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct TextDocumentClientCapabilities {
    pub completion: Option<CompletionClientCapabilities>,
    pub hover: Option<HoverClientCapabilities>,
    #[serde(rename = "synchronization")]
    pub sync: Option<SynchronizationCapabilities>,
}

/// Completion related client capabilities
#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct CompletionClientCapabilities {
    #[serde(rename = "completionItem")]
    pub completion_item: Option<CompletionItemCapabilities>,
}

/// Completion item specific capabilities
#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct CompletionItemCapabilities {
    #[serde(rename = "snippetSupport")]
    pub snippet_support: Option<bool>,
}

/// Hover related client capabilities
#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct HoverClientCapabilities {
    #[serde(rename = "contentFormat")]
    pub content_format: Option<Vec<String>>,
}

/// Text document synchronization capabilities
#[derive(Debug, Default, Serialize, Deserialize)]
pub(crate) struct SynchronizationCapabilities {
    #[serde(rename = "didSave")]
    pub did_save: Option<bool>,
}

/// Response from LSP initialize request
#[derive(Debug, Deserialize)]
pub(crate) struct InitializeResult {
    pub capabilities: LspServerCapabilities,
}

/// Server capabilities returned during initialization
#[derive(Debug, Default, Deserialize)]
pub(crate) struct LspServerCapabilities {
    #[serde(rename = "completionProvider")]
    pub completion_provider: Option<Value>,
    #[serde(rename = "hoverProvider")]
    pub hover_provider: Option<Value>,
    #[serde(rename = "definitionProvider")]
    pub definition_provider: Option<Value>,
    #[serde(rename = "referencesProvider")]
    pub references_provider: Option<Value>,
    #[serde(rename = "documentFormattingProvider")]
    pub document_formatting_provider: Option<Value>,
    #[serde(rename = "documentRangeFormattingProvider")]
    pub document_range_formatting_provider: Option<Value>,
    #[serde(rename = "renameProvider")]
    pub rename_provider: Option<Value>,
    #[serde(rename = "codeActionProvider")]
    pub code_action_provider: Option<Value>,
    #[serde(rename = "signatureHelpProvider")]
    pub signature_help_provider: Option<Value>,
}

/// Parameters for publishDiagnostics notification
#[derive(Debug, Deserialize)]
pub(crate) struct PublishDiagnosticsParams {
    pub uri: String,
    pub diagnostics: Vec<LspDiagnostic>,
}

/// LSP diagnostic structure
#[derive(Debug, Deserialize)]
pub(crate) struct LspDiagnostic {
    pub range: LspRange,
    pub severity: Option<u8>,
    pub code: Option<Value>,
    pub source: Option<String>,
    pub message: String,
    #[serde(rename = "relatedInformation")]
    pub related_information: Option<Vec<LspDiagnosticRelatedInfo>>,
}

/// Related information for a diagnostic
#[derive(Debug, Deserialize)]
pub(crate) struct LspDiagnosticRelatedInfo {
    pub location: LspLocation,
    pub message: String,
}

/// LSP location structure
#[derive(Debug, Deserialize)]
pub(crate) struct LspLocation {
    pub uri: String,
    pub range: LspRange,
}

/// LSP range structure
#[derive(Debug, Deserialize)]
pub(crate) struct LspRange {
    pub start: LspPosition,
    pub end: LspPosition,
}

/// LSP position structure
#[derive(Debug, Deserialize)]
pub(crate) struct LspPosition {
    pub line: u32,
    pub character: u32,
}

/// LSP completion item structure
#[derive(Debug, Deserialize)]
pub(crate) struct LspCompletionItem {
    pub label: String,
    pub kind: Option<u8>,
    pub detail: Option<String>,
    pub documentation: Option<Value>,
    #[serde(rename = "insertText")]
    pub insert_text: Option<String>,
    #[serde(rename = "insertTextFormat")]
    pub insert_text_format: Option<u8>,
    #[serde(rename = "textEdit")]
    pub text_edit: Option<Value>,
    #[serde(rename = "additionalTextEdits")]
    pub additional_text_edits: Option<Vec<Value>>,
    #[serde(rename = "sortText")]
    pub sort_text: Option<String>,
    #[serde(rename = "filterText")]
    pub filter_text: Option<String>,
}
