//! LSP (Language Server Protocol) integration for Cortex
//!
//! This module provides a full LSP client implementation that can:
//! - Start/stop language servers
//! - Handle document synchronization (didOpen, didChange, didSave)
//! - Request completions, hover info, definitions, references
//! - Receive and process diagnostics

pub mod client;
pub mod commands;
pub mod types;

// Re-export state and event setup
pub use commands::{LspState, setup_lsp_events};
