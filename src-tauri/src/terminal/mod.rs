//! Terminal PTY module for Cortex Desktop
//!
//! Provides pseudo-terminal (PTY) support for running shell processes.
//! Uses portable-pty for cross-platform support.
//!
//! Performance optimizations:
//! - Uses parking_lot::Mutex for faster locking
//! - Buffered I/O with BufReader/BufWriter for reduced syscalls
//! - Batched output events (16ms intervals) to reduce IPC overhead
//! - Output throttling for fast-scrolling content
//!
//! # Module Structure
//!
//! - `types`: Data structures for terminal info, options, and events
//! - `constants`: Performance tuning constants
//! - `flow_control`: Backpressure management for terminal output
//! - `shell_integration`: Shell integration script injection
//! - `process`: Process management utilities
//! - `state`: Core terminal state and PTY management
//! - `commands`: Tauri IPC commands

pub mod commands;
mod constants;
mod flow_control;
mod process;
mod shell_integration;
mod state;
mod types;

pub mod links;
pub mod profiles;
pub mod protocol;
pub mod search;

// Re-export public types for external use
pub use types::CreateTerminalOptions;

// Re-export state
pub use profiles::TerminalProfilesState;
pub use state::TerminalState;
