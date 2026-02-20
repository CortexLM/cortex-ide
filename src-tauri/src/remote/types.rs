//! Data types for remote development operations.

use serde::{Deserialize, Serialize};

/// SSH authentication method (stored version - no secrets)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AuthMethod {
    /// Password-based authentication (password stored in keyring)
    Password {
        /// Whether password is stored in keyring
        #[serde(default)]
        has_password: bool,
    },
    /// SSH key-based authentication (passphrase stored in keyring if needed)
    Key {
        private_key_path: String,
        /// Whether passphrase is stored in keyring
        #[serde(default)]
        has_passphrase: bool,
    },
    /// SSH agent authentication
    Agent,
}

/// SSH connection profile for saving and loading (no secrets)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    #[serde(default)]
    pub default_directory: Option<String>,
    #[serde(default)]
    pub port_forwards: Vec<PortForward>,
}

/// Port forwarding configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForward {
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
}

/// Remote file entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub permissions: Option<u32>,
}

/// Remote file tree node (for directory tree response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<RemoteFileNode>>,
}

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error { message: String },
}

/// Connection info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub profile: ConnectionProfile,
    pub status: ConnectionStatus,
    pub home_directory: Option<String>,
    pub platform: Option<String>,
}
