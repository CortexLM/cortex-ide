//! Semantic tokens commands
//!
//! Commands for semantic token operations.

use tauri::State;
use tracing::warn;

use crate::lsp::types::{SemanticTokensParams, SemanticTokensResult};

use super::state::LspState;

/// Request semantic tokens for a document (full)
#[tauri::command]
pub async fn lsp_semantic_tokens(
    server_id: String,
    params: SemanticTokensParams,
    state: State<'_, LspState>,
) -> Result<SemanticTokensResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    let uri = format!("file://{}", params.uri.replace('\\', "/"));
    client
        .semantic_tokens_full(&uri)
        .await
        .map_err(|e| format!("Semantic tokens request failed: {}", e))
}

/// Request semantic tokens from all providers for a language
#[tauri::command]
pub async fn lsp_multi_semantic_tokens(
    language: String,
    params: SemanticTokensParams,
    state: State<'_, LspState>,
) -> Result<SemanticTokensResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(SemanticTokensResult {
            data: vec![],
            result_id: None,
        });
    }

    let uri = format!("file://{}", params.uri.replace('\\', "/"));

    // Query first client that returns non-empty results
    // (semantic tokens from multiple providers can't be easily merged)
    for client in clients {
        match client.semantic_tokens_full(&uri).await {
            Ok(result) if !result.data.is_empty() => {
                return Ok(result);
            }
            Ok(_) => continue,
            Err(e) => {
                warn!("Multi-provider semantic tokens: one provider failed: {}", e);
            }
        }
    }

    Ok(SemanticTokensResult {
        data: vec![],
        result_id: None,
    })
}
