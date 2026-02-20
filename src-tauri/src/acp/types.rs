//! ACP Types
//!
//! Type definitions for the Agent Communication Protocol tools system.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =====================
// Permission Types
// =====================

/// Permission types for tool execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ToolPermission {
    Read,
    Write,
    Network,
    Execute,
    Filesystem,
}

impl From<String> for ToolPermission {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "read" => Self::Read,
            "write" => Self::Write,
            "network" => Self::Network,
            "execute" => Self::Execute,
            "filesystem" => Self::Filesystem,
            _ => Self::Read,
        }
    }
}

impl From<&str> for ToolPermission {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "read" => Self::Read,
            "write" => Self::Write,
            "network" => Self::Network,
            "execute" => Self::Execute,
            "filesystem" => Self::Filesystem,
            _ => Self::Read,
        }
    }
}

// =====================
// Tool Types
// =====================

/// Source of the tool
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ToolSource {
    Builtin,
    Extension,
    Custom,
    Mcp,
}

/// Tool annotations providing hints about behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolAnnotations {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read_only_hint: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destructive_hint: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idempotent_hint: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_world_hint: Option<bool>,
}

/// Input parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolParameter {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(rename = "enum", skip_serializing_if = "Option::is_none")]
    pub enum_values: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minimum: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maximum: Option<f64>,
}

/// ACP Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ACPTool {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub input_schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotations: Option<ToolAnnotations>,
    pub permissions: Vec<ToolPermission>,
    pub enabled: bool,
    pub source: ToolSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handler: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_id: Option<String>,
}

impl ACPTool {
    /// Create a new builtin tool
    pub fn new_builtin(
        name: &str,
        description: &str,
        input_schema: serde_json::Value,
        permissions: Vec<ToolPermission>,
        annotations: Option<ToolAnnotations>,
        handler: &str,
    ) -> Self {
        Self {
            id: format!("builtin_{}", name),
            name: name.to_string(),
            description: Some(description.to_string()),
            input_schema,
            output_schema: None,
            annotations,
            permissions,
            enabled: true,
            source: ToolSource::Builtin,
            handler: Some(handler.to_string()),
            server_id: None,
        }
    }

    /// Create a new custom tool
    pub fn new_custom(
        id: String,
        name: String,
        description: Option<String>,
        input_schema: serde_json::Value,
        permissions: Vec<ToolPermission>,
        annotations: Option<ToolAnnotations>,
    ) -> Self {
        Self {
            id,
            name,
            description,
            input_schema,
            output_schema: None,
            annotations,
            permissions,
            enabled: true,
            source: ToolSource::Custom,
            handler: None,
            server_id: None,
        }
    }
}

/// Update fields for a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<ToolPermission>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotations: Option<ToolAnnotations>,
}

// =====================
// Execution Types
// =====================

/// Execution status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ToolExecutionStatus {
    Idle,
    Running,
    Completed,
    Error,
    Cancelled,
}

/// Content type in execution results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolResultContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "json")]
    Json { data: serde_json::Value },
    #[serde(rename = "image", rename_all = "camelCase")]
    Image { data: String, mime_type: String },
    #[serde(rename = "error")]
    Error {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
}

impl ToolResultContent {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    pub fn json(data: serde_json::Value) -> Self {
        Self::Json { data }
    }

    pub fn error(message: impl Into<String>, code: Option<String>) -> Self {
        Self::Error {
            message: message.into(),
            code,
        }
    }
}

/// Result of a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolExecutionResult {
    pub id: String,
    pub tool_id: String,
    pub status: ToolExecutionStatus,
    pub content: Vec<ToolResultContent>,
    pub is_error: bool,
    pub started_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl ToolExecutionResult {
    pub fn new(id: String, tool_id: String) -> Self {
        Self {
            id,
            tool_id,
            status: ToolExecutionStatus::Running,
            content: Vec::new(),
            is_error: false,
            started_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            completed_at: None,
            duration_ms: None,
            metadata: None,
        }
    }

    pub fn completed(mut self, content: Vec<ToolResultContent>) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.status = ToolExecutionStatus::Completed;
        self.content = content;
        self.completed_at = Some(now);
        self.duration_ms = Some(now - self.started_at);
        self
    }

    pub fn error(mut self, message: impl Into<String>, code: Option<String>) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.status = ToolExecutionStatus::Error;
        self.is_error = true;
        self.content = vec![ToolResultContent::error(message, code)];
        self.completed_at = Some(now);
        self.duration_ms = Some(now - self.started_at);
        self
    }

    pub fn cancelled(mut self) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.status = ToolExecutionStatus::Cancelled;
        self.completed_at = Some(now);
        self.duration_ms = Some(now - self.started_at);
        self
    }
}

// =====================
// Sandbox Types
// =====================

/// Sandbox configuration for tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSandboxConfig {
    pub allow_network: bool,
    pub allow_filesystem: bool,
    pub allow_execution: bool,
    pub timeout: u64,
    pub max_output_size: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_directory: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<HashMap<String, String>>,
}

impl Default for ToolSandboxConfig {
    fn default() -> Self {
        Self {
            allow_network: false,
            allow_filesystem: false,
            allow_execution: false,
            timeout: 30000,
            max_output_size: 1024 * 1024, // 1MB
            working_directory: None,
            environment: None,
        }
    }
}

// =====================
// Request Types
// =====================

/// Tool execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolExecutionRequest {
    pub tool_id: String,
    pub arguments: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
}

/// Permission request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolPermissionRequest {
    pub tool_id: String,
    pub tool_name: String,
    pub permissions: Vec<ToolPermission>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}
