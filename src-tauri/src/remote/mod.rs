//! Remote Development (SSH) support for Cortex Desktop
//!
//! This module provides SSH-based remote development capabilities including:
//! - SSH connection management with key and password authentication
//! - Remote file system operations (list, read, write, delete)
//! - Remote command execution
//! - Port forwarding
//! - Connection profile persistence
//!
//! Security features:
//! - Passwords and passphrases stored in OS keychain (never on disk)
//! - Secure memory handling with secrecy crate
//! - Automatic memory zeroization
//! - File permissions enforcement (0600)

pub mod commands;
pub mod connection;
pub mod credentials;
pub mod error;
pub mod manager;
pub mod port_forwarding;
pub mod tunnel;
pub mod types;

// Re-export main types for backwards compatibility
#[cfg(feature = "remote-ssh")]
pub use credentials::SecureAuthCredentials;
pub use manager::RemoteManager;
#[cfg(feature = "remote-ssh")]
pub use types::AuthMethod;
