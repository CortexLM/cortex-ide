//! Workspace module
//!
//! Provides workspace folder management, cross-folder file operations,
//! trust management, and workspace configuration persistence.

pub mod commands;
pub mod core;
pub mod manager;
pub mod multi_root;
pub mod types;

pub use core::*;
