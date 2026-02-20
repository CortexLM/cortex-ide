//! Sub-Agent Orchestration System
//!
//! This module provides agent management with support for:
//! - Runtime agent orchestration (spawn, run tasks, cancel)
//! - Persistent agent storage (OS-specific directories)
//! - AI-powered prompt generation

pub mod commands;
mod orchestrator;
pub mod prompt_generation;
pub mod storage;
mod storage_types;
mod types;

// Re-export orchestrator
pub use orchestrator::AgentState;

// Re-export storage
pub use storage::AgentStoreState;
