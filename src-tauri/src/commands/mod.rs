//! Command modules for Cortex Desktop
//!
//! Each submodule groups related Tauri commands for better organization.
//! Commands are registered in lib.rs via the `tauri::generate_handler!` macro.

pub mod ai;
pub mod collab;
pub mod debug;
pub mod extensions;
pub mod factory;
pub mod fs;
pub mod git;
pub mod lsp;
pub mod repl;
pub mod search;
pub mod settings;
pub mod system;
pub mod tasks;
pub mod terminal;
