//! CodeLens commands
//!
//! Commands for code lens operations.

use tauri::State;
use tracing::warn;

use crate::lsp::types::{CodeLens, CodeLensParams, CodeLensResult};

use super::state::LspState;

/// Request code lenses for a document
#[tauri::command]
pub async fn lsp_code_lens(
    server_id: String,
    params: CodeLensParams,
    state: State<'_, LspState>,
) -> Result<CodeLensResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    let uri = format!("file://{}", params.uri.replace('\\', "/"));
    let lenses = client
        .code_lens(&uri)
        .await
        .map_err(|e| format!("Code lens request failed: {}", e))?;

    Ok(CodeLensResult { lenses })
}

/// Request code lenses from all providers for a language and merge results
#[tauri::command]
pub async fn lsp_multi_code_lens(
    language: String,
    params: CodeLensParams,
    state: State<'_, LspState>,
) -> Result<CodeLensResult, String> {
    let clients = state.get_clients_for_language(&language);

    if clients.is_empty() {
        return Ok(CodeLensResult { lenses: vec![] });
    }

    let uri = format!("file://{}", params.uri.replace('\\', "/"));

    // Query all clients in parallel
    let futures: Vec<_> = clients
        .iter()
        .map(|client| {
            let uri = uri.clone();
            let client = client.clone();
            async move { client.code_lens(&uri).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    // Merge all code lenses
    let mut all_lenses: Vec<CodeLens> = Vec::new();

    for result in results {
        match result {
            Ok(lenses) => {
                all_lenses.extend(lenses);
            }
            Err(e) => {
                warn!("Multi-provider code lens: one provider failed: {}", e);
            }
        }
    }

    // Sort by line number for consistent display
    all_lenses.sort_by(|a, b| {
        a.range
            .start
            .line
            .cmp(&b.range.start.line)
            .then(a.range.start.character.cmp(&b.range.start.character))
    });

    Ok(CodeLensResult { lenses: all_lenses })
}

/// Resolve a code lens (fill in command details)
#[tauri::command]
pub async fn lsp_code_lens_resolve(
    server_id: String,
    lens: CodeLens,
    state: State<'_, LspState>,
) -> Result<CodeLens, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .code_lens_resolve(lens)
        .await
        .map_err(|e| format!("Code lens resolve failed: {}", e))
}
