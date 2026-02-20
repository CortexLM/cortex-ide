//! LSP Client implementation
//!
//! This module provides a full LSP client that communicates with language servers
//! using the Language Server Protocol over stdio.
//!
//! # Module Structure
//! - `core`: Core client struct and process management
//! - `protocol_types`: Internal LSP protocol types for serialization
//! - `conversions`: Type conversion utilities
//! - `document_sync`: Document lifecycle operations (open, change, save, close)
//! - `language_features`: Standard language features (completion, hover, etc.)
//! - `extended_features`: Additional LSP methods for VS Code parity

mod conversions;
mod core;
mod document_sync;
mod extended_features;
mod hierarchy;
mod language_features;
mod protocol_types;

// Re-export the main client type
pub use core::LspClient;
