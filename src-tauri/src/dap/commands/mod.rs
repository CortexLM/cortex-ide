//! Tauri commands for the debugger
//!
//! This module exposes the DAP functionality as Tauri commands that can be
//! invoked from the frontend.
//!
//! The module is organized into logical submodules:
//! - `state`: Global debugger state management
//! - `types`: Request/response types for commands
//! - `session`: Session management (start, stop, get sessions)
//! - `breakpoints`: Breakpoint management (set, toggle, get)
//! - `execution`: Execution control (continue, pause, step)
//! - `threads`: Thread and stack frame operations
//! - `variables`: Variable inspection and evaluation
//! - `memory`: Memory and disassembly operations
//! - `navigation`: Code navigation (goto, step-in targets)
//! - `misc`: Miscellaneous commands (completions, sources, modules)

mod autodetect;
mod breakpoints;
mod execution;
mod memory;
mod misc;
mod navigation;
mod session;
mod state;
mod threads;
mod types;
mod validation;
mod variables;
mod watch;

// Re-export state
pub use state::DebuggerState;

// Re-export session commands (using * to include hidden __cmd__ functions)
pub use session::*;

// Re-export breakpoint commands
pub use breakpoints::*;

// Re-export execution commands
pub use execution::*;

// Re-export thread commands
pub use threads::*;

// Re-export variable commands
pub use variables::*;

// Re-export memory commands
pub use memory::*;

// Re-export navigation commands
pub use navigation::*;

// Re-export misc commands
pub use misc::*;

// Re-export watch commands
pub use watch::*;

// Re-export autodetect commands
pub use autodetect::*;
