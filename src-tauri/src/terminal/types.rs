//! Terminal data types and structures
//!
//! Contains all the data structures used by the terminal PTY system.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Information about a terminal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub cwd: String,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub status: String,
    pub created_at: i64,
    pub last_command: Option<String>,
    pub last_exit_code: Option<i32>,
    pub command_running: bool,
}

/// Terminal output event sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub terminal_id: String,
    pub data: String,
}

/// Terminal status event sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalStatus {
    pub terminal_id: String,
    pub status: String,
    pub exit_code: Option<i32>,
}

/// Options for creating a terminal
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTerminalOptions {
    pub name: Option<String>,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    /// Whether to inject shell integration scripts (defaults to true)
    #[serde(default)]
    pub shell_integration: Option<bool>,
}

impl Default for CreateTerminalOptions {
    fn default() -> Self {
        Self {
            name: None,
            cwd: None,
            shell: None,
            env: None,
            cols: None,
            rows: None,
            shell_integration: None,
        }
    }
}

/// Options for updating a terminal
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTerminalOptions {
    pub cwd: Option<String>,
    pub last_command: Option<String>,
    pub last_exit_code: Option<i32>,
    pub command_running: Option<bool>,
}

/// Information about a process using a network port
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProcess {
    pub port: u16,
    pub pid: u32,
    #[serde(rename = "processName")]
    pub process_name: String,
    pub command: String,
    pub user: String,
    pub protocol: String,
    #[serde(rename = "localAddress")]
    pub local_address: Option<String>,
    pub state: Option<String>,
}
