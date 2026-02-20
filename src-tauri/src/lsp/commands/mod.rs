//! Tauri commands for LSP management
//!
//! This module provides the Tauri command handlers for starting/stopping
//! language servers and making LSP requests from the frontend.
//!
//! Supports multi-provider LSP (like VS Code) where multiple language servers
//! can handle the same language, with results merged from all providers.

pub mod actions;
pub mod autodetect;
pub mod code_lens;
pub mod completion;
pub mod document;
pub mod events;
pub mod features;
pub mod formatting;
pub mod hierarchy;
pub mod multi_provider;
pub mod navigation;
pub mod semantic_tokens;
pub mod server;
pub mod state;
pub mod symbols;

// Re-export the LspState for external use
pub use state::LspState;

// Re-export the event setup function
pub use events::setup_lsp_events;

// Re-export types from features module (used by lsp/client/extended_features.rs)
pub use features::{
    Color, ColorInformation, ColorPresentation, DocumentHighlight, DocumentLink, FoldingRange,
    InlayHint, LinkedEditingRanges, SelectionRange,
};
