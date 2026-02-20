//! DAP Protocol launch configuration types
//!
//! These types represent launch configurations for debugging sessions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Debug launch configuration (similar to VS Code's launch.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfig {
    #[serde(rename = "type")]
    pub type_: String,
    pub request: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub program: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub console: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_on_entry: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    // Additional adapter-specific fields
    #[serde(flatten)]
    pub additional: HashMap<String, serde_json::Value>,
}

/// Debug adapter type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DebugAdapterType {
    Node,
    Python,
    Go,
    Rust,
    Cpp,
    Custom(String),
}

impl DebugAdapterType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "node" | "pwa-node" | "node2" => Self::Node,
            "python" | "debugpy" => Self::Python,
            "go" | "delve" => Self::Go,
            "rust" | "lldb" | "codelldb" => Self::Rust,
            "cpp" | "cppdbg" | "cppvsdbg" => Self::Cpp,
            other => Self::Custom(other.to_string()),
        }
    }

    pub fn adapter_executable(&self) -> Option<&str> {
        match self {
            Self::Node => Some("node"),
            Self::Python => Some("python"),
            Self::Go => Some("dlv"),
            Self::Rust => Some("lldb-vscode"),
            Self::Cpp => Some("gdb"),
            Self::Custom(_) => None,
        }
    }
}
