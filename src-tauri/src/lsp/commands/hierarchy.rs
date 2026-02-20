//! Call hierarchy and type hierarchy commands
//!
//! Commands for call hierarchy (incoming/outgoing calls) and type hierarchy
//! (supertypes/subtypes).

use std::collections::HashSet;

use tauri::State;
use tracing::warn;

use crate::lsp::types::{
    CallHierarchyCallsParams, CallHierarchyIncomingCall, CallHierarchyItem,
    CallHierarchyOutgoingCall, CallHierarchyPrepareParams, TypeHierarchyItem,
    TypeHierarchyPrepareParams, TypeHierarchySubtypesParams, TypeHierarchySupertypesParams,
};

use super::state::LspState;

/// Prepare call hierarchy at a position
#[tauri::command]
pub async fn lsp_prepare_call_hierarchy(
    server_id: String,
    params: CallHierarchyPrepareParams,
    state: State<'_, LspState>,
) -> Result<Vec<CallHierarchyItem>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .call_hierarchy_prepare(&params.uri, params.position)
        .await
        .map_err(|e| format!("Prepare call hierarchy failed: {}", e))
}

/// Request incoming calls for a call hierarchy item
#[tauri::command]
pub async fn lsp_call_hierarchy_incoming(
    server_id: String,
    params: CallHierarchyCallsParams,
    state: State<'_, LspState>,
) -> Result<Vec<CallHierarchyIncomingCall>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .call_hierarchy_incoming(params.item)
        .await
        .map_err(|e| format!("Call hierarchy incoming calls failed: {}", e))
}

/// Request outgoing calls for a call hierarchy item
#[tauri::command]
pub async fn lsp_call_hierarchy_outgoing(
    server_id: String,
    params: CallHierarchyCallsParams,
    state: State<'_, LspState>,
) -> Result<Vec<CallHierarchyOutgoingCall>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .call_hierarchy_outgoing(params.item)
        .await
        .map_err(|e| format!("Call hierarchy outgoing calls failed: {}", e))
}

/// Prepare type hierarchy at a position
#[tauri::command]
pub async fn lsp_prepare_type_hierarchy(
    server_id: String,
    params: TypeHierarchyPrepareParams,
    state: State<'_, LspState>,
) -> Result<Vec<TypeHierarchyItem>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .type_hierarchy_prepare(&params.uri, params.position)
        .await
        .map_err(|e| format!("Prepare type hierarchy failed: {}", e))
}

/// Request supertypes for a type hierarchy item
#[tauri::command]
pub async fn lsp_type_hierarchy_supertypes(
    server_id: String,
    params: TypeHierarchySupertypesParams,
    state: State<'_, LspState>,
) -> Result<Vec<TypeHierarchyItem>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .type_hierarchy_supertypes(params.item)
        .await
        .map_err(|e| format!("Type hierarchy supertypes failed: {}", e))
}

/// Request subtypes for a type hierarchy item
#[tauri::command]
pub async fn lsp_type_hierarchy_subtypes(
    server_id: String,
    params: TypeHierarchySubtypesParams,
    state: State<'_, LspState>,
) -> Result<Vec<TypeHierarchyItem>, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .type_hierarchy_subtypes(params.item)
        .await
        .map_err(|e| format!("Type hierarchy subtypes failed: {}", e))
}

/// Prepare call hierarchy from all providers for a language and merge results
#[tauri::command]
pub async fn lsp_multi_prepare_call_hierarchy(
    language: String,
    params: CallHierarchyPrepareParams,
    state: State<'_, LspState>,
) -> Result<Vec<CallHierarchyItem>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(vec![]);
    }

    let mut all_items = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for client in clients {
        match client
            .call_hierarchy_prepare(&params.uri, params.position.clone())
            .await
        {
            Ok(items) => {
                for item in items {
                    let key = format!("{}:{}", item.name, item.uri);
                    if !seen.contains(&key) {
                        seen.insert(key);
                        all_items.push(item);
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Prepare call hierarchy failed for {}: {}",
                    client.config.name, e
                );
            }
        }
    }

    Ok(all_items)
}

/// Prepare type hierarchy from all providers for a language and merge results
#[tauri::command]
pub async fn lsp_multi_prepare_type_hierarchy(
    language: String,
    params: TypeHierarchyPrepareParams,
    state: State<'_, LspState>,
) -> Result<Vec<TypeHierarchyItem>, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(vec![]);
    }

    let mut all_items = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for client in clients {
        match client
            .type_hierarchy_prepare(&params.uri, params.position.clone())
            .await
        {
            Ok(items) => {
                for item in items {
                    let key = format!("{}:{}", item.name, item.uri);
                    if !seen.contains(&key) {
                        seen.insert(key);
                        all_items.push(item);
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Prepare type hierarchy failed for {}: {}",
                    client.config.name, e
                );
            }
        }
    }

    Ok(all_items)
}
