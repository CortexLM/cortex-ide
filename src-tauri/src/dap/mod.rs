//! Debug Adapter Protocol (DAP) implementation for Cortex
//!
//! This module provides a DAP client that can communicate with debug adapters
//! for various languages (Node.js, Python, etc.) using the standard DAP protocol.

mod client;
pub mod commands;
pub mod protocol;
mod session;
mod transport;

pub use commands::DebuggerState;
pub use session::{DebugSession, DebugSessionConfig, DebugSessionEvent, DebugSessionState};
