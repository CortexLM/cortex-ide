//! Testing module - Test discovery and execution for various frameworks
//!
//! Supports: Jest, Vitest, Mocha, Pytest, Cargo test
//!
//! Features:
//! - Test discovery and execution
//! - Watch mode with file change detection
//! - Code coverage with LCOV/Istanbul parsing

pub mod coverage;
pub mod detection;
pub mod discovery;
pub mod execution;
pub mod single_test;
pub mod types;
pub mod watch;

// Re-export watch state
pub use watch::TestWatcherState;
