//! LSP event handling
//!
//! Setup and handling of LSP diagnostic events.

use tauri::{AppHandle, Emitter, Manager};
use tracing::error;

use super::state::LspState;

/// Setup LSP event listeners
pub fn setup_lsp_events(app: &AppHandle) {
    let state = app.state::<LspState>();

    if let Some(mut rx) = state.take_diagnostics_receiver() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                // Emit diagnostics to the frontend
                if let Err(e) = app.emit("lsp:diagnostics", &event) {
                    error!("Failed to emit diagnostics event: {}", e);
                }
            }
        });
    }
}
