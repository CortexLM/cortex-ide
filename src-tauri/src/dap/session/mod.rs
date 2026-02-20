//! Debug Session management
//!
//! Handles the lifecycle of a debug session including starting adapters,
//! managing breakpoints, and coordinating debug state.

mod adapter;
mod breakpoints;
mod control;
mod core;
mod events;
mod memory;
mod navigation;
mod sources;
mod types;
mod variables;

// Re-export public types
pub use core::DebugSession;
pub use types::{DebugSessionConfig, DebugSessionEvent, DebugSessionState};
