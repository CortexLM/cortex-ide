//! Extended LSP features implementation
//!
//! This module provides additional LSP methods for full VS Code parity,
//! including document highlights, links, selection ranges, colors, folding, and more.

use anyhow::Result;
use serde_json::{Value, json};

use super::conversions::*;
use super::core::LspClient;
use super::protocol_types::LspRange;
use crate::lsp::commands;
use crate::lsp::types::*;

impl LspClient {
    /// Request document highlights (occurrences of symbol at position)
    pub async fn document_highlights(
        &self,
        uri: &str,
        position: Position,
    ) -> Result<Vec<commands::DocumentHighlight>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": position.line, "character": position.character }
        });

        let result: Value = self
            .request("textDocument/documentHighlight", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let highlights = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|h| {
                        let range = h.get("range")?;
                        let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;
                        let kind = h.get("kind").and_then(|k| k.as_u64()).map(|k| k as u8);
                        Some(commands::DocumentHighlight {
                            range: convert_range(lsp_range),
                            kind,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(highlights)
    }

    /// Request document links
    pub async fn document_links(&self, uri: &str) -> Result<Vec<commands::DocumentLink>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri }
        });

        let result: Value = self
            .request("textDocument/documentLink", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let links = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|l| {
                        let range = l.get("range")?;
                        let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;
                        let target = l.get("target").and_then(|t| t.as_str()).map(String::from);
                        let tooltip = l.get("tooltip").and_then(|t| t.as_str()).map(String::from);
                        let data = l.get("data").cloned();
                        Some(commands::DocumentLink {
                            range: convert_range(lsp_range),
                            target,
                            tooltip,
                            data,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(links)
    }

    /// Request selection ranges (smart selection)
    pub async fn selection_ranges(
        &self,
        uri: &str,
        positions: Vec<Position>,
    ) -> Result<Vec<commands::SelectionRange>> {
        let lsp_positions: Vec<Value> = positions
            .iter()
            .map(|p| json!({ "line": p.line, "character": p.character }))
            .collect();

        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "positions": lsp_positions
        });

        let result: Value = self
            .request("textDocument/selectionRange", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        fn parse_selection_range(value: &Value) -> Option<commands::SelectionRange> {
            let range = value.get("range")?;
            let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;
            let parent = value
                .get("parent")
                .and_then(|p| parse_selection_range(p).map(Box::new));
            Some(commands::SelectionRange {
                range: convert_range(lsp_range),
                parent,
            })
        }

        let ranges = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_selection_range).collect())
            .unwrap_or_default();

        Ok(ranges)
    }

    /// Request document colors
    pub async fn document_colors(&self, uri: &str) -> Result<Vec<commands::ColorInformation>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri }
        });

        let result: Value = self
            .request("textDocument/documentColor", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let colors = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|c| {
                        let range = c.get("range")?;
                        let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;
                        let color = c.get("color")?;
                        Some(commands::ColorInformation {
                            range: convert_range(lsp_range),
                            color: commands::Color {
                                red: color.get("red")?.as_f64()?,
                                green: color.get("green")?.as_f64()?,
                                blue: color.get("blue")?.as_f64()?,
                                alpha: color.get("alpha")?.as_f64()?,
                            },
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(colors)
    }

    /// Request color presentations
    pub async fn color_presentations(
        &self,
        uri: &str,
        color: commands::Color,
        range: Range,
    ) -> Result<Vec<commands::ColorPresentation>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "color": {
                "red": color.red,
                "green": color.green,
                "blue": color.blue,
                "alpha": color.alpha
            },
            "range": {
                "start": { "line": range.start.line, "character": range.start.character },
                "end": { "line": range.end.line, "character": range.end.character }
            }
        });

        let result: Value = self
            .request("textDocument/colorPresentation", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let presentations = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|p| {
                        let label = p.get("label")?.as_str()?.to_string();
                        let text_edit = p.get("textEdit").and_then(parse_text_edit_value);
                        let additional_text_edits =
                            p.get("additionalTextEdits").and_then(|edits| {
                                edits.as_array().map(|arr| {
                                    arr.iter().filter_map(parse_text_edit_value).collect()
                                })
                            });
                        Some(commands::ColorPresentation {
                            label,
                            text_edit,
                            additional_text_edits,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(presentations)
    }

    /// Request folding ranges
    pub async fn folding_ranges(&self, uri: &str) -> Result<Vec<commands::FoldingRange>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri }
        });

        let result: Value = self
            .request("textDocument/foldingRange", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let ranges = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|r| {
                        let start_line = r.get("startLine")?.as_u64()? as u32;
                        let end_line = r.get("endLine")?.as_u64()? as u32;
                        let start_character = r
                            .get("startCharacter")
                            .and_then(|c| c.as_u64())
                            .map(|c| c as u32);
                        let end_character = r
                            .get("endCharacter")
                            .and_then(|c| c.as_u64())
                            .map(|c| c as u32);
                        let kind = r.get("kind").and_then(|k| k.as_str()).map(String::from);
                        let collapsed_text = r
                            .get("collapsedText")
                            .and_then(|t| t.as_str())
                            .map(String::from);
                        Some(commands::FoldingRange {
                            start_line,
                            start_character,
                            end_line,
                            end_character,
                            kind,
                            collapsed_text,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(ranges)
    }

    /// Request linked editing ranges
    pub async fn linked_editing_ranges(
        &self,
        uri: &str,
        position: Position,
    ) -> Result<Option<commands::LinkedEditingRanges>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": position.line, "character": position.character }
        });

        let result: Value = self
            .request("textDocument/linkedEditingRange", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        let ranges = result.get("ranges").and_then(|r| r.as_array()).map(|arr| {
            arr.iter()
                .filter_map(|r| {
                    let lsp_range: LspRange = serde_json::from_value(r.clone()).ok()?;
                    Some(convert_range(lsp_range))
                })
                .collect()
        });

        let word_pattern = result
            .get("wordPattern")
            .and_then(|w| w.as_str())
            .map(String::from);

        if let Some(ranges) = ranges {
            Ok(Some(commands::LinkedEditingRanges {
                ranges,
                word_pattern,
            }))
        } else {
            Ok(None)
        }
    }

    /// Request inlay hints
    pub async fn inlay_hints(&self, uri: &str, range: Range) -> Result<Vec<commands::InlayHint>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "range": {
                "start": { "line": range.start.line, "character": range.start.character },
                "end": { "line": range.end.line, "character": range.end.character }
            }
        });

        let result: Value = self.request("textDocument/inlayHint", lsp_params).await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let hints = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|h| {
                        let position = h.get("position")?;
                        let pos = Position {
                            line: position.get("line")?.as_u64()? as u32,
                            character: position.get("character")?.as_u64()? as u32,
                        };
                        let label = h.get("label")?.clone();
                        let kind = h.get("kind").and_then(|k| k.as_u64()).map(|k| k as u8);
                        let tooltip = h.get("tooltip").and_then(|t| {
                            if t.is_string() {
                                t.as_str().map(String::from)
                            } else {
                                t.get("value").and_then(|v| v.as_str()).map(String::from)
                            }
                        });
                        let padding_left = h.get("paddingLeft").and_then(|p| p.as_bool());
                        let padding_right = h.get("paddingRight").and_then(|p| p.as_bool());
                        let text_edits = h.get("textEdits").and_then(|edits| {
                            edits
                                .as_array()
                                .map(|arr| arr.iter().filter_map(parse_text_edit_value).collect())
                        });
                        let data = h.get("data").cloned();

                        Some(commands::InlayHint {
                            position: pos,
                            label,
                            kind,
                            text_edits,
                            tooltip,
                            padding_left,
                            padding_right,
                            data,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(hints)
    }
}
