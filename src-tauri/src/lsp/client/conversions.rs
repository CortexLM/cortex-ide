//! Conversion functions for LSP types
//!
//! This module provides functions to convert between LSP protocol types
//! and our internal representation types.

use serde_json::{Value, json};

use super::protocol_types::*;
use crate::lsp::types::*;

/// Convert LSP server capabilities to our internal representation
pub(crate) fn convert_server_capabilities(caps: &LspServerCapabilities) -> ServerCapabilities {
    ServerCapabilities {
        completion: caps.completion_provider.is_some(),
        hover: is_capability_enabled(&caps.hover_provider),
        definition: is_capability_enabled(&caps.definition_provider),
        references: is_capability_enabled(&caps.references_provider),
        diagnostics: true, // Always enabled via publishDiagnostics
        document_formatting: is_capability_enabled(&caps.document_formatting_provider),
        document_range_formatting: is_capability_enabled(&caps.document_range_formatting_provider),
        rename: is_capability_enabled(&caps.rename_provider),
        code_action: is_capability_enabled(&caps.code_action_provider),
        signature_help: caps.signature_help_provider.is_some(),
    }
}

/// Check if a capability is enabled based on its value
fn is_capability_enabled(cap: &Option<Value>) -> bool {
    match cap {
        Some(Value::Bool(b)) => *b,
        Some(Value::Object(_)) => true,
        _ => false,
    }
}

/// Convert LSP diagnostic to our internal representation
pub(crate) fn convert_diagnostic(diag: LspDiagnostic) -> Diagnostic {
    Diagnostic {
        range: convert_range(diag.range),
        severity: diag.severity.map(|s| match s {
            1 => DiagnosticSeverity::Error,
            2 => DiagnosticSeverity::Warning,
            3 => DiagnosticSeverity::Information,
            4 => DiagnosticSeverity::Hint,
            _ => DiagnosticSeverity::Information,
        }),
        code: diag.code.map(|c| match c {
            Value::String(s) => s,
            Value::Number(n) => n.to_string(),
            _ => c.to_string(),
        }),
        source: diag.source,
        message: diag.message,
        related_information: diag.related_information.map(|infos| {
            infos
                .into_iter()
                .map(|info| DiagnosticRelatedInfo {
                    location: convert_location(info.location),
                    message: info.message,
                })
                .collect()
        }),
    }
}

/// Convert LSP range to our internal representation
pub(crate) fn convert_range(range: LspRange) -> Range {
    Range {
        start: Position {
            line: range.start.line,
            character: range.start.character,
        },
        end: Position {
            line: range.end.line,
            character: range.end.character,
        },
    }
}

/// Convert LSP location to our internal representation
pub(crate) fn convert_location(loc: LspLocation) -> Location {
    Location {
        uri: loc.uri,
        range: convert_range(loc.range),
    }
}

/// Convert LSP completion item to our internal representation
pub(crate) fn convert_completion_item(item: LspCompletionItem) -> CompletionItem {
    CompletionItem {
        label: item.label,
        kind: item.kind.and_then(|k| {
            Some(match k {
                1 => CompletionItemKind::Text,
                2 => CompletionItemKind::Method,
                3 => CompletionItemKind::Function,
                4 => CompletionItemKind::Constructor,
                5 => CompletionItemKind::Field,
                6 => CompletionItemKind::Variable,
                7 => CompletionItemKind::Class,
                8 => CompletionItemKind::Interface,
                9 => CompletionItemKind::Module,
                10 => CompletionItemKind::Property,
                11 => CompletionItemKind::Unit,
                12 => CompletionItemKind::Value,
                13 => CompletionItemKind::Enum,
                14 => CompletionItemKind::Keyword,
                15 => CompletionItemKind::Snippet,
                16 => CompletionItemKind::Color,
                17 => CompletionItemKind::File,
                18 => CompletionItemKind::Reference,
                19 => CompletionItemKind::Folder,
                20 => CompletionItemKind::EnumMember,
                21 => CompletionItemKind::Constant,
                22 => CompletionItemKind::Struct,
                23 => CompletionItemKind::Event,
                24 => CompletionItemKind::Operator,
                25 => CompletionItemKind::TypeParameter,
                _ => return None,
            })
        }),
        detail: item.detail,
        documentation: item.documentation.map(extract_documentation),
        insert_text: item.insert_text,
        insert_text_format: item.insert_text_format,
        text_edit: item.text_edit.and_then(parse_text_edit),
        additional_text_edits: item
            .additional_text_edits
            .map(|edits| edits.into_iter().filter_map(parse_text_edit).collect()),
        sort_text: item.sort_text,
        filter_text: item.filter_text,
    }
}

/// Extract documentation string from LSP documentation value
pub(crate) fn extract_documentation(doc: Value) -> String {
    match doc {
        Value::String(s) => s,
        Value::Object(obj) => obj
            .get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

/// Extract hover contents from LSP hover response
pub(crate) fn extract_hover_contents(hover: &Value) -> String {
    let contents = hover.get("contents");

    match contents {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| match v {
                Value::String(s) => Some(s.clone()),
                Value::Object(obj) => obj.get("value").and_then(|v| v.as_str()).map(String::from),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n\n"),
        Some(Value::Object(obj)) => obj
            .get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

/// Parse a text edit from JSON value
pub(crate) fn parse_text_edit(value: Value) -> Option<TextEdit> {
    parse_text_edit_value(&value)
}

/// Parse a text edit from a JSON value reference
pub(crate) fn parse_text_edit_value(value: &Value) -> Option<TextEdit> {
    let range = value.get("range")?;
    let new_text = value.get("newText")?.as_str()?.to_string();

    let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;

    Some(TextEdit {
        range: convert_range(lsp_range),
        new_text,
    })
}

/// Extract markup content as a string
pub(crate) fn extract_markup_content(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Object(obj) => obj.get("value").and_then(|v| v.as_str()).map(String::from),
        _ => None,
    }
}

/// Parse a diagnostic from JSON value
pub(crate) fn parse_diagnostic(value: &Value) -> Option<Diagnostic> {
    let range = value.get("range")?;
    let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;

    let message = value.get("message")?.as_str()?.to_string();
    let severity = value
        .get("severity")
        .and_then(|s| s.as_u64())
        .map(|s| match s {
            1 => DiagnosticSeverity::Error,
            2 => DiagnosticSeverity::Warning,
            3 => DiagnosticSeverity::Information,
            4 => DiagnosticSeverity::Hint,
            _ => DiagnosticSeverity::Information,
        });
    let code = value.get("code").map(|c| match c {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => c.to_string(),
    });
    let source = value
        .get("source")
        .and_then(|s| s.as_str())
        .map(String::from);

    Some(Diagnostic {
        range: convert_range(lsp_range),
        severity,
        code,
        source,
        message,
        related_information: None,
    })
}

/// Parse a location response which can be a single location or array of locations
pub(crate) fn parse_location_response(result: Value) -> Vec<Location> {
    if result.is_null() {
        return Vec::new();
    }

    if result.is_array() {
        // Array of locations
        result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|loc| {
                        let uri = loc.get("uri")?.as_str()?.to_string();
                        let range: LspRange =
                            serde_json::from_value(loc.get("range")?.clone()).ok()?;
                        Some(Location {
                            uri,
                            range: convert_range(range),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else if result.is_object() {
        // Single location
        let uri = result.get("uri").and_then(|u| u.as_str());
        let range = result.get("range");

        if let (Some(uri), Some(range)) = (uri, range) {
            if let Ok(lsp_range) = serde_json::from_value::<LspRange>(range.clone()) {
                return vec![Location {
                    uri: uri.to_string(),
                    range: convert_range(lsp_range),
                }];
            }
        }
        Vec::new()
    } else {
        Vec::new()
    }
}

/// Convert LSP symbol response to our internal format
/// Handles both DocumentSymbol and SymbolInformation formats
pub(crate) fn convert_symbol_response(sym: Value) -> Value {
    // Check if this is a DocumentSymbol (has 'children' or 'selectionRange')
    // or SymbolInformation (has 'location')
    if sym.get("location").is_some() {
        // SymbolInformation format - convert to DocumentSymbol-like format
        let name = sym
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let kind = sym.get("kind").and_then(|v| v.as_u64()).unwrap_or(1) as u8;
        let location = sym.get("location").cloned().unwrap_or(json!({}));
        let range = location.get("range").cloned().unwrap_or(json!({
            "start": { "line": 0, "character": 0 },
            "end": { "line": 0, "character": 0 }
        }));
        let container_name = sym
            .get("containerName")
            .and_then(|v| v.as_str())
            .map(String::from);

        json!({
            "name": name,
            "kind": kind,
            "range": range.clone(),
            "selectionRange": range,
            "detail": container_name,
            "children": []
        })
    } else {
        // DocumentSymbol format - already in the right shape, just ensure children are converted
        let mut result = sym.clone();

        if let Some(children) = sym.get("children").and_then(|c| c.as_array()) {
            let converted_children: Vec<Value> = children
                .iter()
                .cloned()
                .map(convert_symbol_response)
                .collect();
            result["children"] = json!(converted_children);
        } else {
            result["children"] = json!([]);
        }

        result
    }
}
