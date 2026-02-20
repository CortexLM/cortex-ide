//! Settings storage and management for Cortex Desktop
//!
//! This module handles persistent settings storage in AppData/Cortex/settings.json,
//! including loading, saving, migration, and default values.
//!
//! Security features:
//! - Sensitive settings (API keys) stored in OS keychain
//! - Secure memory handling with secrecy crate
//! - File permissions enforcement (0600)
//! - Automatic zeroization of sensitive data
//!
//! ## Module Structure
//!
//! - `types`: Settings structs and their default implementations
//! - `secure_store`: Secure API key storage using OS keyring
//! - `storage`: File system operations for settings persistence
//! - `commands`: Tauri command handlers for settings operations
//! - `profiles`: User profiles management

// Submodules are public to expose Tauri command macro-generated symbols (__cmd__*)
pub mod commands;
pub mod profiles;
pub mod secure_store;
pub mod storage;
pub mod types;

/// Current settings schema version for migration
pub const SETTINGS_VERSION: u32 = 2;

/// Keyring service name for secure settings
pub const KEYRING_SERVICE: &str = "Cortex-desktop";

// Re-export storage
pub use storage::{SettingsState, preload_settings};
