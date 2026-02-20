//! Formatter integration for Cortex Desktop
//!
//! This module provides code formatting capabilities via Prettier and other formatters.
//! It detects configuration files, runs formatters, and handles formatting requests.

// Submodules are public to expose Tauri command macro-generated symbols (__cmd__*)
pub mod commands;
mod handlers;
mod prettier;
mod types;
