//! Language features implementation
//!
//! This module provides language feature operations such as completion, hover,
//! definition, references, formatting, code actions, and more.

use anyhow::Result;
use serde_json::{Value, json};

use super::conversions::*;
use super::core::LspClient;
use super::protocol_types::*;
use crate::lsp::types::*;

impl LspClient {
    /// Request completions at a position
    pub async fn completion(&self, params: CompletionParams) -> Result<CompletionResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            },
            "context": {
                "triggerKind": params.trigger_kind.unwrap_or(1),
                "triggerCharacter": params.trigger_character
            }
        });

        let result: Value = self.request("textDocument/completion", lsp_params).await?;

        // Handle both array and CompletionList responses
        let (items, is_incomplete) = if result.is_array() {
            (result, false)
        } else {
            let items = result.get("items").cloned().unwrap_or(json!([]));
            let is_incomplete = result
                .get("isIncomplete")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            (items, is_incomplete)
        };

        let items: Vec<LspCompletionItem> = serde_json::from_value(items).unwrap_or_default();

        Ok(CompletionResult {
            items: items.into_iter().map(convert_completion_item).collect(),
            is_incomplete,
        })
    }

    /// Request hover information at a position
    pub async fn hover(&self, params: TextDocumentPositionParams) -> Result<Option<HoverInfo>> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            }
        });

        let result: Value = self.request("textDocument/hover", lsp_params).await?;

        if result.is_null() {
            return Ok(None);
        }

        let contents = extract_hover_contents(&result);
        let range = result
            .get("range")
            .and_then(|r| serde_json::from_value(r.clone()).ok())
            .map(convert_range);

        Ok(Some(HoverInfo { contents, range }))
    }

    /// Request definition locations
    pub async fn definition(&self, params: TextDocumentPositionParams) -> Result<DefinitionResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            }
        });

        let result: Value = self.request("textDocument/definition", lsp_params).await?;

        let locations = parse_location_response(result);

        Ok(DefinitionResult { locations })
    }

    /// Request reference locations
    pub async fn references(&self, params: TextDocumentPositionParams) -> Result<ReferencesResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            },
            "context": {
                "includeDeclaration": true
            }
        });

        let result: Value = self.request("textDocument/references", lsp_params).await?;

        let locations = parse_location_response(result);

        Ok(ReferencesResult { locations })
    }

    /// Request type definition locations
    pub async fn type_definition(
        &self,
        params: TextDocumentPositionParams,
    ) -> Result<TypeDefinitionResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            }
        });

        let result: Value = self
            .request("textDocument/typeDefinition", lsp_params)
            .await?;

        let locations = parse_location_response(result);

        Ok(TypeDefinitionResult { locations })
    }

    /// Request implementation locations
    pub async fn implementation(
        &self,
        params: TextDocumentPositionParams,
    ) -> Result<ImplementationResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            }
        });

        let result: Value = self
            .request("textDocument/implementation", lsp_params)
            .await?;

        let locations = parse_location_response(result);

        Ok(ImplementationResult { locations })
    }

    /// Request signature help at a position
    pub async fn signature_help(
        &self,
        params: SignatureHelpParams,
    ) -> Result<Option<SignatureHelp>> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            },
            "context": {
                "triggerKind": params.trigger_kind.unwrap_or(1),
                "triggerCharacter": params.trigger_character,
                "isRetrigger": params.is_retrigger.unwrap_or(false)
            }
        });

        let result: Value = self
            .request("textDocument/signatureHelp", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        let signatures = result
            .get("signatures")
            .and_then(|s| s.as_array())
            .map(|sigs| {
                sigs.iter()
                    .filter_map(|sig| {
                        let label = sig.get("label")?.as_str()?.to_string();
                        let documentation =
                            sig.get("documentation").and_then(extract_markup_content);
                        let parameters =
                            sig.get("parameters")
                                .and_then(|p| p.as_array())
                                .map(|params| {
                                    params
                                        .iter()
                                        .filter_map(|param| {
                                            let label = match param.get("label")? {
                                                Value::String(s) => s.clone(),
                                                Value::Array(arr) if arr.len() >= 2 => {
                                                    // Label can be [start, end] offsets
                                                    format!("[{}, {}]", arr[0], arr[1])
                                                }
                                                _ => return None,
                                            };
                                            let documentation = param
                                                .get("documentation")
                                                .and_then(extract_markup_content);
                                            Some(ParameterInformation {
                                                label,
                                                documentation,
                                            })
                                        })
                                        .collect()
                                });
                        let active_parameter = sig
                            .get("activeParameter")
                            .and_then(|v| v.as_u64())
                            .map(|v| v as u32);
                        Some(SignatureInformation {
                            label,
                            documentation,
                            parameters,
                            active_parameter,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let active_signature = result
            .get("activeSignature")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);
        let active_parameter = result
            .get("activeParameter")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);

        Ok(Some(SignatureHelp {
            signatures,
            active_signature,
            active_parameter,
        }))
    }

    /// Rename symbol at position
    pub async fn rename(&self, params: RenameParams) -> Result<WorkspaceEdit> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "position": {
                "line": params.position.line,
                "character": params.position.character
            },
            "newName": params.new_name
        });

        let result: Value = self.request("textDocument/rename", lsp_params).await?;

        if result.is_null() {
            return Ok(WorkspaceEdit { changes: None });
        }

        let changes = result.get("changes").and_then(|c| {
            c.as_object().map(|obj| {
                obj.iter()
                    .map(|(uri, edits)| {
                        let edits = edits
                            .as_array()
                            .map(|arr| arr.iter().filter_map(parse_text_edit_value).collect())
                            .unwrap_or_default();
                        (uri.clone(), edits)
                    })
                    .collect()
            })
        });

        Ok(WorkspaceEdit { changes })
    }

    /// Request code actions for a range
    pub async fn code_action(&self, params: CodeActionParams) -> Result<CodeActionResult> {
        let diagnostics: Vec<Value> = params
            .diagnostics
            .iter()
            .map(|d| {
                json!({
                    "range": {
                        "start": { "line": d.range.start.line, "character": d.range.start.character },
                        "end": { "line": d.range.end.line, "character": d.range.end.character }
                    },
                    "message": d.message,
                    "severity": d.severity.map(|s| match s {
                        DiagnosticSeverity::Error => 1,
                        DiagnosticSeverity::Warning => 2,
                        DiagnosticSeverity::Information => 3,
                        DiagnosticSeverity::Hint => 4,
                    }),
                    "code": d.code,
                    "source": d.source
                })
            })
            .collect();

        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "range": {
                "start": { "line": params.range.start.line, "character": params.range.start.character },
                "end": { "line": params.range.end.line, "character": params.range.end.character }
            },
            "context": {
                "diagnostics": diagnostics,
                "only": null,
                "triggerKind": 1
            }
        });

        let result: Value = self.request("textDocument/codeAction", lsp_params).await?;

        if result.is_null() {
            return Ok(CodeActionResult { actions: vec![] });
        }

        let actions = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|action| {
                        let title = action.get("title")?.as_str()?.to_string();
                        let kind = action
                            .get("kind")
                            .and_then(|k| k.as_str())
                            .map(String::from);
                        let is_preferred = action.get("isPreferred").and_then(|p| p.as_bool());
                        let diagnostics = action.get("diagnostics").and_then(|d| {
                            d.as_array()
                                .map(|arr| arr.iter().filter_map(parse_diagnostic).collect())
                        });
                        let edit = action.get("edit").map(|e| {
                            let changes = e.get("changes").and_then(|c| {
                                c.as_object().map(|obj| {
                                    obj.iter()
                                        .map(|(uri, edits)| {
                                            let edits = edits
                                                .as_array()
                                                .map(|arr| {
                                                    arr.iter()
                                                        .filter_map(parse_text_edit_value)
                                                        .collect()
                                                })
                                                .unwrap_or_default();
                                            (uri.clone(), edits)
                                        })
                                        .collect()
                                })
                            });
                            WorkspaceEdit { changes }
                        });
                        let command = action.get("command").and_then(|c| {
                            let title = c.get("title")?.as_str()?.to_string();
                            let command = c.get("command")?.as_str()?.to_string();
                            let arguments = c
                                .get("arguments")
                                .map(|a| a.as_array().cloned().unwrap_or_default());
                            Some(Command {
                                title,
                                command,
                                arguments,
                            })
                        });

                        Some(CodeAction {
                            title,
                            kind,
                            diagnostics,
                            is_preferred,
                            edit,
                            command,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(CodeActionResult { actions })
    }

    /// Execute a command (workspace/executeCommand)
    pub async fn execute_command(
        &self,
        command: &str,
        arguments: Option<Vec<Value>>,
    ) -> Result<Value> {
        let lsp_params = json!({
            "command": command,
            "arguments": arguments.unwrap_or_default()
        });

        self.request("workspace/executeCommand", lsp_params).await
    }

    /// Format document
    pub async fn format(&self, params: FormattingParams) -> Result<FormattingResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "options": {
                "tabSize": params.tab_size,
                "insertSpaces": params.insert_spaces
            }
        });

        let result: Value = self.request("textDocument/formatting", lsp_params).await?;

        if result.is_null() {
            return Ok(FormattingResult { edits: vec![] });
        }

        let edits = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_text_edit_value).collect())
            .unwrap_or_default();

        Ok(FormattingResult { edits })
    }

    /// Format document range
    pub async fn format_range(&self, params: RangeFormattingParams) -> Result<FormattingResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            },
            "range": {
                "start": { "line": params.range.start.line, "character": params.range.start.character },
                "end": { "line": params.range.end.line, "character": params.range.end.character }
            },
            "options": {
                "tabSize": params.tab_size,
                "insertSpaces": params.insert_spaces
            }
        });

        let result: Value = self
            .request("textDocument/rangeFormatting", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(FormattingResult { edits: vec![] });
        }

        let edits = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_text_edit_value).collect())
            .unwrap_or_default();

        Ok(FormattingResult { edits })
    }

    /// Request document symbols
    pub async fn document_symbols(&self, uri: &str) -> Result<Vec<Value>> {
        let lsp_params = json!({
            "textDocument": {
                "uri": uri
            }
        });

        let result: Value = self
            .request("textDocument/documentSymbol", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        // Handle both DocumentSymbol[] and SymbolInformation[] responses
        match result {
            Value::Array(arr) => {
                // Convert to our internal format
                let symbols: Vec<Value> = arr.into_iter().map(convert_symbol_response).collect();
                Ok(symbols)
            }
            _ => Ok(vec![]),
        }
    }

    /// Request code lenses for a document
    pub async fn code_lens(&self, uri: &str) -> Result<Vec<CodeLens>> {
        let lsp_params = json!({
            "textDocument": {
                "uri": uri
            }
        });

        let result: Value = self.request("textDocument/codeLens", lsp_params).await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let lenses = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|lens| {
                        let range = lens.get("range")?;
                        let lsp_range: LspRange = serde_json::from_value(range.clone()).ok()?;
                        let command = lens.get("command").and_then(|c| {
                            let title = c.get("title")?.as_str()?.to_string();
                            let cmd = c.get("command")?.as_str()?.to_string();
                            let arguments = c.get("arguments").cloned();
                            Some(Command {
                                title,
                                command: cmd,
                                arguments: arguments.and_then(|a| a.as_array().cloned()),
                            })
                        });
                        let data = lens.get("data").cloned();
                        Some(CodeLens {
                            range: convert_range(lsp_range),
                            command,
                            data,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(lenses)
    }

    /// Resolve a code lens (fill in command if not present)
    pub async fn code_lens_resolve(&self, lens: CodeLens) -> Result<CodeLens> {
        let lsp_params = json!({
            "range": {
                "start": { "line": lens.range.start.line, "character": lens.range.start.character },
                "end": { "line": lens.range.end.line, "character": lens.range.end.character }
            },
            "command": lens.command.as_ref().map(|c| json!({
                "title": c.title,
                "command": c.command,
                "arguments": c.arguments
            })),
            "data": lens.data
        });

        let result: Value = self.request("codeLens/resolve", lsp_params).await?;

        if result.is_null() {
            return Ok(lens);
        }

        let range = result
            .get("range")
            .and_then(|r| {
                let lsp_range: LspRange = serde_json::from_value(r.clone()).ok()?;
                Some(convert_range(lsp_range))
            })
            .unwrap_or(lens.range.clone());

        let command = result.get("command").and_then(|c| {
            let title = c.get("title")?.as_str()?.to_string();
            let cmd = c.get("command")?.as_str()?.to_string();
            let arguments = c.get("arguments").cloned();
            Some(Command {
                title,
                command: cmd,
                arguments: arguments.and_then(|a| a.as_array().cloned()),
            })
        });

        let data = result.get("data").cloned();

        Ok(CodeLens {
            range,
            command,
            data,
        })
    }

    /// Request semantic tokens for a document (full)
    pub async fn semantic_tokens_full(&self, uri: &str) -> Result<SemanticTokensResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": uri
            }
        });

        let result: Value = self
            .request("textDocument/semanticTokens/full", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(SemanticTokensResult {
                data: vec![],
                result_id: None,
            });
        }

        let data = result
            .get("data")
            .and_then(|d| d.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|n| n as u32))
                    .collect()
            })
            .unwrap_or_default();

        let result_id = result
            .get("resultId")
            .and_then(|r| r.as_str())
            .map(String::from);

        Ok(SemanticTokensResult { data, result_id })
    }

    /// Search for workspace symbols matching a query
    pub async fn workspace_symbol(
        &self,
        query: &str,
    ) -> Result<Vec<crate::lsp::types::SymbolInformation>> {
        let lsp_params = json!({
            "query": query
        });

        let result: Value = self.request("workspace/symbol", lsp_params).await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let symbols = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|sym| {
                        let name = sym.get("name")?.as_str()?.to_string();
                        let kind = sym.get("kind")?.as_u64()? as u32;
                        let container_name = sym
                            .get("containerName")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let tags = sym.get("tags").and_then(|t| {
                            t.as_array().map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_u64().map(|n| n as u32))
                                    .collect()
                            })
                        });
                        let loc = sym.get("location")?;
                        let uri = loc.get("uri")?.as_str()?.to_string();
                        let lsp_range: LspRange =
                            serde_json::from_value(loc.get("range")?.clone()).ok()?;
                        Some(SymbolInformation {
                            name,
                            kind,
                            location: Location {
                                uri,
                                range: convert_range(lsp_range),
                            },
                            container_name,
                            tags,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(symbols)
    }

    /// Format on typing a character
    pub async fn on_type_formatting(
        &self,
        uri: &str,
        position: &crate::lsp::types::Position,
        ch: &str,
        tab_size: u32,
        insert_spaces: bool,
    ) -> Result<crate::lsp::types::FormattingResult> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", uri.replace('\\', "/"))
            },
            "position": {
                "line": position.line,
                "character": position.character
            },
            "ch": ch,
            "options": {
                "tabSize": tab_size,
                "insertSpaces": insert_spaces
            }
        });

        let result: Value = self
            .request("textDocument/onTypeFormatting", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(FormattingResult { edits: vec![] });
        }

        let edits = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_text_edit_value).collect())
            .unwrap_or_default();

        Ok(FormattingResult { edits })
    }

    /// Prepare a rename operation at a position
    pub async fn prepare_rename(
        &self,
        uri: &str,
        position: &crate::lsp::types::Position,
    ) -> Result<Option<crate::lsp::types::PrepareRenameResult>> {
        let lsp_params = json!({
            "textDocument": {
                "uri": format!("file://{}", uri.replace('\\', "/"))
            },
            "position": {
                "line": position.line,
                "character": position.character
            }
        });

        let result: Value = self
            .request("textDocument/prepareRename", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(None);
        }

        if let Some(range_value) = result.get("range") {
            let lsp_range: LspRange = serde_json::from_value(range_value.clone())
                .map_err(|e| anyhow::anyhow!("Failed to parse range: {}", e))?;
            let placeholder = result
                .get("placeholder")
                .and_then(|v| v.as_str())
                .map(String::from);
            Ok(Some(PrepareRenameResult {
                range: convert_range(lsp_range),
                placeholder,
            }))
        } else if result.get("start").is_some() && result.get("end").is_some() {
            let lsp_range: LspRange = serde_json::from_value(result)
                .map_err(|e| anyhow::anyhow!("Failed to parse range: {}", e))?;
            Ok(Some(PrepareRenameResult {
                range: convert_range(lsp_range),
                placeholder: None,
            }))
        } else {
            Ok(None)
        }
    }
}
