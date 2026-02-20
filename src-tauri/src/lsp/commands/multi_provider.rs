//! Multi-provider LSP commands
//!
//! These commands query all LSP servers registered for a language and merge
//! the results, similar to VS Code's multi-provider support.

use std::collections::HashSet;

use tauri::State;
use tracing::warn;

use crate::lsp::types::{
    CodeAction, CodeActionParams, CodeActionResult, CompletionItem, CompletionParams,
    CompletionResult, DefinitionResult, HoverInfo, ImplementationResult, Location,
    ReferencesResult, TextDocumentPositionParams, TypeDefinitionResult,
};

use super::state::LspState;

/// Request completions from all providers for a language and merge results
#[tauri::command]
pub async fn lsp_multi_completion(
    language: String,
    params: CompletionParams,
    state: State<'_, LspState>,
) -> Result<CompletionResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(CompletionResult {
            items: vec![],
            is_incomplete: false,
        });
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.completion(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge results from all providers
    let mut all_items: Vec<CompletionItem> = Vec::new();
    let mut is_incomplete = false;

    for result in results {
        match result {
            Ok(completion_result) => {
                all_items.extend(completion_result.items);
                is_incomplete = is_incomplete || completion_result.is_incomplete;
            }
            Err(e) => {
                warn!("Multi-provider completion: one provider failed: {}", e);
            }
        }
    }

    // Sort by sort_text/label for consistent ordering
    all_items.sort_by(|a, b| {
        let a_sort = a.sort_text.as_ref().unwrap_or(&a.label);
        let b_sort = b.sort_text.as_ref().unwrap_or(&b.label);
        a_sort.cmp(b_sort)
    });

    // Deduplicate by label (keep first occurrence which has higher priority after sort)
    let mut seen_labels: HashSet<String> = HashSet::new();
    all_items.retain(|item| seen_labels.insert(item.label.clone()));

    Ok(CompletionResult {
        items: all_items,
        is_incomplete,
    })
}

/// Request hover information from all providers and concatenate results
#[tauri::command]
pub async fn lsp_multi_hover(
    language: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<Option<HoverInfo>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(None);
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.hover(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Collect and concatenate hover contents
    let mut contents_parts: Vec<String> = Vec::new();
    let mut range: Option<crate::lsp::types::Range> = None;

    for result in results {
        match result {
            Ok(Some(hover_info)) => {
                if !hover_info.contents.is_empty() {
                    contents_parts.push(hover_info.contents);
                }
                // Use the first range we find
                if range.is_none() {
                    range = hover_info.range;
                }
            }
            Ok(None) => {}
            Err(e) => {
                warn!("Multi-provider hover: one provider failed: {}", e);
            }
        }
    }

    if contents_parts.is_empty() {
        return Ok(None);
    }

    // Join contents with separator
    let contents = contents_parts.join("\n\n---\n\n");

    Ok(Some(HoverInfo { contents, range }))
}

/// Request definition locations from all providers and return all
#[tauri::command]
pub async fn lsp_multi_definition(
    language: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<DefinitionResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(DefinitionResult { locations: vec![] });
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.definition(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge all locations
    let mut all_locations: Vec<Location> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for result in results {
        match result {
            Ok(def_result) => {
                for loc in def_result.locations {
                    // Deduplicate by URI + range
                    let key = format!(
                        "{}:{}:{}-{}:{}",
                        loc.uri,
                        loc.range.start.line,
                        loc.range.start.character,
                        loc.range.end.line,
                        loc.range.end.character
                    );
                    if seen.insert(key) {
                        all_locations.push(loc);
                    }
                }
            }
            Err(e) => {
                warn!("Multi-provider definition: one provider failed: {}", e);
            }
        }
    }

    Ok(DefinitionResult {
        locations: all_locations,
    })
}

/// Request references from all providers and merge results
#[tauri::command]
pub async fn lsp_multi_references(
    language: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<ReferencesResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(ReferencesResult { locations: vec![] });
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.references(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge and deduplicate all locations
    let mut all_locations: Vec<Location> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for result in results {
        match result {
            Ok(ref_result) => {
                for loc in ref_result.locations {
                    // Deduplicate by URI + range
                    let key = format!(
                        "{}:{}:{}-{}:{}",
                        loc.uri,
                        loc.range.start.line,
                        loc.range.start.character,
                        loc.range.end.line,
                        loc.range.end.character
                    );
                    if seen.insert(key) {
                        all_locations.push(loc);
                    }
                }
            }
            Err(e) => {
                warn!("Multi-provider references: one provider failed: {}", e);
            }
        }
    }

    Ok(ReferencesResult {
        locations: all_locations,
    })
}

/// Request type definition from all providers and merge results
#[tauri::command]
pub async fn lsp_multi_type_definition(
    language: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<TypeDefinitionResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(TypeDefinitionResult { locations: vec![] });
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.type_definition(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge and deduplicate all locations
    let mut all_locations: Vec<Location> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for result in results {
        match result {
            Ok(typedef_result) => {
                for loc in typedef_result.locations {
                    // Deduplicate by URI + range
                    let key = format!(
                        "{}:{}:{}-{}:{}",
                        loc.uri,
                        loc.range.start.line,
                        loc.range.start.character,
                        loc.range.end.line,
                        loc.range.end.character
                    );
                    if seen.insert(key) {
                        all_locations.push(loc);
                    }
                }
            }
            Err(e) => {
                warn!("Multi-provider type definition: one provider failed: {}", e);
            }
        }
    }

    Ok(TypeDefinitionResult {
        locations: all_locations,
    })
}

/// Request implementation from all providers and merge results
#[tauri::command]
pub async fn lsp_multi_implementation(
    language: String,
    params: TextDocumentPositionParams,
    state: State<'_, LspState>,
) -> Result<ImplementationResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(ImplementationResult { locations: vec![] });
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.implementation(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge and deduplicate all locations
    let mut all_locations: Vec<Location> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for result in results {
        match result {
            Ok(impl_result) => {
                for loc in impl_result.locations {
                    // Deduplicate by URI + range
                    let key = format!(
                        "{}:{}:{}-{}:{}",
                        loc.uri,
                        loc.range.start.line,
                        loc.range.start.character,
                        loc.range.end.line,
                        loc.range.end.character
                    );
                    if seen.insert(key) {
                        all_locations.push(loc);
                    }
                }
            }
            Err(e) => {
                warn!("Multi-provider implementation: one provider failed: {}", e);
            }
        }
    }

    Ok(ImplementationResult {
        locations: all_locations,
    })
}

/// Request code actions from all providers and merge results
#[tauri::command]
pub async fn lsp_multi_code_action(
    language: String,
    params: CodeActionParams,
    state: State<'_, LspState>,
) -> Result<CodeActionResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(CodeActionResult { actions: vec![] });
    }

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let params = params.clone();
            let client = client.clone();
            async move { client.code_action(params).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge all code actions
    let mut all_actions: Vec<CodeAction> = Vec::new();
    let mut seen_titles: HashSet<String> = HashSet::new();

    for result in results {
        match result {
            Ok(action_result) => {
                for action in action_result.actions {
                    // Deduplicate by title
                    if seen_titles.insert(action.title.clone()) {
                        all_actions.push(action);
                    }
                }
            }
            Err(e) => {
                warn!("Multi-provider code action: one provider failed: {}", e);
            }
        }
    }

    // Sort: preferred actions first, then alphabetically
    all_actions.sort_by(|a, b| match (a.is_preferred, b.is_preferred) {
        (Some(true), Some(false)) => std::cmp::Ordering::Less,
        (Some(false), Some(true)) => std::cmp::Ordering::Greater,
        _ => a.title.cmp(&b.title),
    });

    Ok(CodeActionResult {
        actions: all_actions,
    })
}
