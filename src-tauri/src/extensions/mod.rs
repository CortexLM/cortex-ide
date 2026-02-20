//! Cortex Desktop Extension System
//!
//! This module provides the extension management system for Cortex Desktop,
//! including loading, installing, enabling/disabling, and managing extensions.
//! Extensions execute as sandboxed WASM modules via the wasmtime runtime.

pub mod activation;
pub mod api;
pub mod commands;
pub mod contributions;
pub mod marketplace;
pub mod node_host;
pub mod permissions;
pub mod plugin_api;
pub mod registry;
pub mod state;
pub mod types;
pub mod utils;
pub mod wasm;

// Re-export state types
pub use state::{ExtensionsManager, ExtensionsState};

// Re-export preload_extensions for lib.rs setup
pub use commands::preload_extensions;
