//! Document synchronization operations
//!
//! This module provides document lifecycle operations like open, change, save, and close.

use anyhow::Result;
use serde_json::json;

use super::core::LspClient;
use crate::lsp::types::*;

impl LspClient {
    /// Notify that a document was opened
    pub fn did_open(&self, params: DidOpenParams) -> Result<()> {
        self.notify(
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": format!("file://{}", params.uri.replace('\\', "/")),
                    "languageId": params.language_id,
                    "version": params.version,
                    "text": params.text
                }
            }),
        )
    }

    /// Notify that a document was changed
    pub fn did_change(&self, params: DidChangeParams) -> Result<()> {
        self.notify(
            "textDocument/didChange",
            json!({
                "textDocument": {
                    "uri": format!("file://{}", params.uri.replace('\\', "/")),
                    "version": params.version
                },
                "contentChanges": [{
                    "text": params.text
                }]
            }),
        )
    }

    /// Notify that a document was saved
    pub fn did_save(&self, params: DidSaveParams) -> Result<()> {
        let mut notification = json!({
            "textDocument": {
                "uri": format!("file://{}", params.uri.replace('\\', "/"))
            }
        });

        if let Some(text) = params.text {
            notification["text"] = json!(text);
        }

        self.notify("textDocument/didSave", notification)
    }

    /// Notify that a document was closed
    pub fn did_close(&self, params: DidCloseParams) -> Result<()> {
        self.notify(
            "textDocument/didClose",
            json!({
                "textDocument": {
                    "uri": format!("file://{}", params.uri.replace('\\', "/"))
                }
            }),
        )
    }
}
