//! Additional LSP features
//!
//! Document highlights, links, selection ranges, colors, folding ranges,
//! linked editing, and inlay hints.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::warn;

use crate::lsp::types::{Command, Location, Position, Range, TextEdit};

use super::state::LspState;

// ============================================================================
// Document Highlights - Highlight all occurrences of a symbol
// ============================================================================

/// Document highlight kind
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentHighlightKind {
    Text = 1,
    Read = 2,
    Write = 3,
}

/// A document highlight
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentHighlight {
    pub range: Range,
    pub kind: Option<u8>,
}

/// Request document highlights (all occurrences of symbol at position)
#[tauri::command]
pub async fn lsp_document_highlights(
    uri: String,
    position: Position,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<DocumentHighlight>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .document_highlights(&uri, position)
        .await
        .map_err(|e| e.to_string())
}

/// Request document highlights from all providers for a language
#[tauri::command]
pub async fn lsp_multi_document_highlights(
    uri: String,
    position: Position,
    language: String,
    state: State<'_, LspState>,
) -> Result<Vec<DocumentHighlight>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(vec![]);
    }

    let mut all_highlights = Vec::new();
    let mut seen_ranges: HashSet<String> = HashSet::new();

    for client in clients {
        match client.document_highlights(&uri, position.clone()).await {
            Ok(highlights) => {
                for highlight in highlights {
                    let range_key = format!(
                        "{}:{}:{}:{}",
                        highlight.range.start.line,
                        highlight.range.start.character,
                        highlight.range.end.line,
                        highlight.range.end.character
                    );
                    if !seen_ranges.contains(&range_key) {
                        seen_ranges.insert(range_key);
                        all_highlights.push(highlight);
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Document highlights failed for {}: {}",
                    client.config.name, e
                );
            }
        }
    }

    Ok(all_highlights)
}

// ============================================================================
// Document Links - Clickable links in code
// ============================================================================

/// A document link
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentLink {
    pub range: Range,
    pub target: Option<String>,
    pub tooltip: Option<String>,
    pub data: Option<serde_json::Value>,
}

/// Request document links
#[tauri::command]
pub async fn lsp_document_links(
    uri: String,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<DocumentLink>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client.document_links(&uri).await.map_err(|e| e.to_string())
}

/// Request document links from all providers for a language
#[tauri::command]
pub async fn lsp_multi_document_links(
    uri: String,
    language: String,
    state: State<'_, LspState>,
) -> Result<Vec<DocumentLink>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(vec![]);
    }

    let mut all_links = Vec::new();

    for client in clients {
        match client.document_links(&uri).await {
            Ok(links) => {
                all_links.extend(links);
            }
            Err(e) => {
                warn!("Document links failed for {}: {}", client.config.name, e);
            }
        }
    }

    Ok(all_links)
}

// ============================================================================
// Selection Ranges - Smart selection expansion
// ============================================================================

/// A selection range with parent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub range: Range,
    pub parent: Option<Box<SelectionRange>>,
}

/// Request selection ranges for positions
#[tauri::command]
pub async fn lsp_selection_ranges(
    uri: String,
    positions: Vec<Position>,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<SelectionRange>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .selection_ranges(&uri, positions)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Color Provider - Colors in code with picker
// ============================================================================

/// A color in RGBA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Color {
    pub red: f64,
    pub green: f64,
    pub blue: f64,
    pub alpha: f64,
}

/// A color information in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorInformation {
    pub range: Range,
    pub color: Color,
}

/// A color presentation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorPresentation {
    pub label: String,
    pub text_edit: Option<TextEdit>,
    pub additional_text_edits: Option<Vec<TextEdit>>,
}

/// Request document colors
#[tauri::command]
pub async fn lsp_document_colors(
    uri: String,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<ColorInformation>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .document_colors(&uri)
        .await
        .map_err(|e| e.to_string())
}

/// Request color presentations (how to format a color)
#[tauri::command]
pub async fn lsp_color_presentations(
    uri: String,
    color: Color,
    range: Range,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<ColorPresentation>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .color_presentations(&uri, color, range)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Folding Ranges - Code folding regions
// ============================================================================

/// Folding range kind
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FoldingRangeKind {
    Comment,
    Imports,
    Region,
}

/// A folding range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoldingRange {
    pub start_line: u32,
    pub start_character: Option<u32>,
    pub end_line: u32,
    pub end_character: Option<u32>,
    pub kind: Option<String>,
    pub collapsed_text: Option<String>,
}

/// Request folding ranges
#[tauri::command]
pub async fn lsp_folding_ranges(
    uri: String,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<FoldingRange>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client.folding_ranges(&uri).await.map_err(|e| e.to_string())
}

/// Request folding ranges from all providers
#[tauri::command]
pub async fn lsp_multi_folding_ranges(
    uri: String,
    language: String,
    state: State<'_, LspState>,
) -> Result<Vec<FoldingRange>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(vec![]);
    }

    let mut all_ranges = Vec::new();
    let mut seen_ranges: HashSet<(u32, u32)> = HashSet::new();

    for client in clients {
        match client.folding_ranges(&uri).await {
            Ok(ranges) => {
                for range in ranges {
                    let key = (range.start_line, range.end_line);
                    if !seen_ranges.contains(&key) {
                        seen_ranges.insert(key);
                        all_ranges.push(range);
                    }
                }
            }
            Err(e) => {
                warn!("Folding ranges failed for {}: {}", client.config.name, e);
            }
        }
    }

    Ok(all_ranges)
}

// ============================================================================
// Linked Editing Ranges - Edit multiple occurrences simultaneously
// ============================================================================

/// Linked editing ranges response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedEditingRanges {
    pub ranges: Vec<Range>,
    pub word_pattern: Option<String>,
}

/// Request linked editing ranges
#[tauri::command]
pub async fn lsp_linked_editing_ranges(
    uri: String,
    position: Position,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Option<LinkedEditingRanges>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .linked_editing_ranges(&uri, position)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Inlay Hints - Inline type/parameter hints
// ============================================================================

/// Inlay hint kind
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum InlayHintKind {
    Type = 1,
    Parameter = 2,
}

/// An inlay hint label part
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlayHintLabelPart {
    pub value: String,
    pub tooltip: Option<String>,
    pub location: Option<Location>,
    pub command: Option<Command>,
}

/// An inlay hint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlayHint {
    pub position: Position,
    pub label: serde_json::Value, // String or InlayHintLabelPart[]
    pub kind: Option<u8>,
    pub text_edits: Option<Vec<TextEdit>>,
    pub tooltip: Option<String>,
    pub padding_left: Option<bool>,
    pub padding_right: Option<bool>,
    pub data: Option<serde_json::Value>,
}

/// Request inlay hints for a range
#[tauri::command]
pub async fn lsp_inlay_hints(
    uri: String,
    range: Range,
    server_id: String,
    state: State<'_, LspState>,
) -> Result<Vec<InlayHint>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .inlay_hints(&uri, range)
        .await
        .map_err(|e| e.to_string())
}

/// Request inlay hints from all providers
#[tauri::command]
pub async fn lsp_multi_inlay_hints(
    uri: String,
    range: Range,
    language: String,
    state: State<'_, LspState>,
) -> Result<Vec<InlayHint>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(vec![]);
    }

    let mut all_hints = Vec::new();

    for client in clients {
        match client.inlay_hints(&uri, range.clone()).await {
            Ok(hints) => {
                all_hints.extend(hints);
            }
            Err(e) => {
                warn!("Inlay hints failed for {}: {}", client.config.name, e);
            }
        }
    }

    // Sort by position
    all_hints.sort_by(|a, b| {
        let line_cmp = a.position.line.cmp(&b.position.line);
        if line_cmp == std::cmp::Ordering::Equal {
            a.position.character.cmp(&b.position.character)
        } else {
            line_cmp
        }
    });

    Ok(all_hints)
}
