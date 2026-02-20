//! Error types for remote development operations.

use thiserror::Error;

/// Errors that can occur during remote operations
#[derive(Error, Debug)]
pub enum RemoteError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    #[error("SSH error: {0}")]
    SshError(#[from] ssh2::Error),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Connection not found: {0}")]
    ConnectionNotFound(String),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("Keyring error: {0}")]
    KeyringError(String),
}

impl From<RemoteError> for String {
    fn from(e: RemoteError) -> String {
        e.to_string()
    }
}
