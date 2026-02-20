//! Call hierarchy and type hierarchy LSP features implementation
//!
//! This module provides call hierarchy and type hierarchy operations
//! for navigating caller/callee and supertype/subtype relationships.

use anyhow::Result;
use serde_json::{Value, json};

use super::conversions::*;
use super::core::LspClient;
use super::protocol_types::LspRange;
use crate::lsp::types::*;

fn serialize_hierarchy_item(item: &CallHierarchyItem) -> Value {
    json!({
        "name": item.name,
        "kind": item.kind,
        "tags": item.tags,
        "detail": item.detail,
        "uri": item.uri,
        "range": {
            "start": { "line": item.range.start.line, "character": item.range.start.character },
            "end": { "line": item.range.end.line, "character": item.range.end.character }
        },
        "selectionRange": {
            "start": { "line": item.selection_range.start.line, "character": item.selection_range.start.character },
            "end": { "line": item.selection_range.end.line, "character": item.selection_range.end.character }
        },
        "data": item.data
    })
}

fn serialize_type_hierarchy_item(item: &TypeHierarchyItem) -> Value {
    json!({
        "name": item.name,
        "kind": item.kind,
        "tags": item.tags,
        "detail": item.detail,
        "uri": item.uri,
        "range": {
            "start": { "line": item.range.start.line, "character": item.range.start.character },
            "end": { "line": item.range.end.line, "character": item.range.end.character }
        },
        "selectionRange": {
            "start": { "line": item.selection_range.start.line, "character": item.selection_range.start.character },
            "end": { "line": item.selection_range.end.line, "character": item.selection_range.end.character }
        },
        "data": item.data
    })
}

fn parse_call_hierarchy_item(value: &Value) -> Option<CallHierarchyItem> {
    let name = value.get("name")?.as_str()?.to_string();
    let kind = value.get("kind")?.as_u64()? as u32;
    let tags = value.get("tags").and_then(|t| {
        t.as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_u64().map(|n| n as u32))
                .collect()
        })
    });
    let detail = value
        .get("detail")
        .and_then(|d| d.as_str())
        .map(String::from);
    let uri = value.get("uri")?.as_str()?.to_string();
    let range: LspRange = serde_json::from_value(value.get("range")?.clone()).ok()?;
    let selection_range: LspRange =
        serde_json::from_value(value.get("selectionRange")?.clone()).ok()?;
    let data = value.get("data").cloned();

    Some(CallHierarchyItem {
        name,
        kind,
        tags,
        detail,
        uri,
        range: convert_range(range),
        selection_range: convert_range(selection_range),
        data,
    })
}

fn parse_type_hierarchy_item(value: &Value) -> Option<TypeHierarchyItem> {
    let name = value.get("name")?.as_str()?.to_string();
    let kind = value.get("kind")?.as_u64()? as u32;
    let tags = value.get("tags").and_then(|t| {
        t.as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_u64().map(|n| n as u32))
                .collect()
        })
    });
    let detail = value
        .get("detail")
        .and_then(|d| d.as_str())
        .map(String::from);
    let uri = value.get("uri")?.as_str()?.to_string();
    let range: LspRange = serde_json::from_value(value.get("range")?.clone()).ok()?;
    let selection_range: LspRange =
        serde_json::from_value(value.get("selectionRange")?.clone()).ok()?;
    let data = value.get("data").cloned();

    Some(TypeHierarchyItem {
        name,
        kind,
        tags,
        detail,
        uri,
        range: convert_range(range),
        selection_range: convert_range(selection_range),
        data,
    })
}

fn parse_ranges(value: &Value) -> Vec<Range> {
    value
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|r| {
                    let lsp_range: LspRange = serde_json::from_value(r.clone()).ok()?;
                    Some(convert_range(lsp_range))
                })
                .collect()
        })
        .unwrap_or_default()
}

impl LspClient {
    /// Prepare call hierarchy at a position
    pub async fn call_hierarchy_prepare(
        &self,
        uri: &str,
        position: Position,
    ) -> Result<Vec<CallHierarchyItem>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": position.line, "character": position.character }
        });

        let result: Value = self
            .request("textDocument/prepareCallHierarchy", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let items = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_call_hierarchy_item).collect())
            .unwrap_or_default();

        Ok(items)
    }

    /// Request incoming calls for a call hierarchy item
    pub async fn call_hierarchy_incoming(
        &self,
        item: CallHierarchyItem,
    ) -> Result<Vec<CallHierarchyIncomingCall>> {
        let lsp_params = json!({
            "item": serialize_hierarchy_item(&item)
        });

        let result: Value = self
            .request("callHierarchy/incomingCalls", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let calls = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|c| {
                        let from = parse_call_hierarchy_item(c.get("from")?)?;
                        let from_ranges = parse_ranges(c.get("fromRanges")?);
                        Some(CallHierarchyIncomingCall { from, from_ranges })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(calls)
    }

    /// Request outgoing calls for a call hierarchy item
    pub async fn call_hierarchy_outgoing(
        &self,
        item: CallHierarchyItem,
    ) -> Result<Vec<CallHierarchyOutgoingCall>> {
        let lsp_params = json!({
            "item": serialize_hierarchy_item(&item)
        });

        let result: Value = self
            .request("callHierarchy/outgoingCalls", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let calls = result
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|c| {
                        let to = parse_call_hierarchy_item(c.get("to")?)?;
                        let from_ranges = parse_ranges(c.get("fromRanges")?);
                        Some(CallHierarchyOutgoingCall { to, from_ranges })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(calls)
    }

    /// Prepare type hierarchy at a position
    pub async fn type_hierarchy_prepare(
        &self,
        uri: &str,
        position: Position,
    ) -> Result<Vec<TypeHierarchyItem>> {
        let lsp_params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": position.line, "character": position.character }
        });

        let result: Value = self
            .request("textDocument/prepareTypeHierarchy", lsp_params)
            .await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let items = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_type_hierarchy_item).collect())
            .unwrap_or_default();

        Ok(items)
    }

    /// Request supertypes for a type hierarchy item
    pub async fn type_hierarchy_supertypes(
        &self,
        item: TypeHierarchyItem,
    ) -> Result<Vec<TypeHierarchyItem>> {
        let lsp_params = json!({
            "item": serialize_type_hierarchy_item(&item)
        });

        let result: Value = self.request("typeHierarchy/supertypes", lsp_params).await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let items = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_type_hierarchy_item).collect())
            .unwrap_or_default();

        Ok(items)
    }

    /// Request subtypes for a type hierarchy item
    pub async fn type_hierarchy_subtypes(
        &self,
        item: TypeHierarchyItem,
    ) -> Result<Vec<TypeHierarchyItem>> {
        let lsp_params = json!({
            "item": serialize_type_hierarchy_item(&item)
        });

        let result: Value = self.request("typeHierarchy/subtypes", lsp_params).await?;

        if result.is_null() {
            return Ok(vec![]);
        }

        let items = result
            .as_array()
            .map(|arr| arr.iter().filter_map(parse_type_hierarchy_item).collect())
            .unwrap_or_default();

        Ok(items)
    }
}
