//! REPL (Read-Eval-Print-Loop) system for Cortex Desktop
//!
//! This module provides kernel management and execution capabilities for
//! interactive programming environments (Python, Node.js, etc.)

mod jupyter;
mod kernel;
mod types;

pub use kernel::*;
pub use types::*;
