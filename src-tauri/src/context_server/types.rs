//! MCP Protocol Types
//!
//! Type definitions for the Model Context Protocol (MCP) specification.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Protocol version constant
pub const LATEST_PROTOCOL_VERSION: &str = "2025-06-18";

// =====================
// Configuration Types
// =====================

/// Configuration for a context server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextServerConfig {
    /// Display name for the server
    pub name: String,
    /// Type of server (stdio, http, sse)
    pub server_type: ServerType,
    /// Command to execute (for stdio)
    pub command: Option<String>,
    /// Arguments for the command
    pub args: Option<Vec<String>>,
    /// Environment variables
    pub env: Option<HashMap<String, String>>,
    /// HTTP endpoint URL (for http/sse)
    pub url: Option<String>,
    /// HTTP headers
    pub headers: Option<HashMap<String, String>>,
    /// Working directory
    pub working_directory: Option<String>,
    /// Request timeout in milliseconds
    pub timeout_ms: Option<u64>,
    /// Auto-connect on startup
    pub auto_connect: Option<bool>,
}

/// Type of context server transport
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerType {
    Stdio,
    Http,
    Sse,
}

/// Status of a context server
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

/// Information about a context server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextServerInfo {
    pub id: String,
    pub name: String,
    pub server_type: ServerType,
    pub status: ServerStatus,
    pub capabilities: Option<ServerCapabilities>,
}

// =====================
// Protocol Types
// =====================

/// Client implementation info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Implementation {
    pub name: String,
    pub version: String,
}

/// Client capabilities sent during initialization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experimental: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sampling: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roots: Option<RootsCapabilities>,
    /// Elicitation capability - allows servers to request additional information from clients.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elicitation: Option<serde_json::Value>,
}

impl Default for ClientCapabilities {
    fn default() -> Self {
        Self {
            experimental: None,
            sampling: None,
            roots: Some(RootsCapabilities {
                list_changed: Some(true),
            }),
            elicitation: None,
        }
    }
}

/// Server capabilities received during initialization
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experimental: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logging: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completions: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<PromptsCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<ResourcesCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsCapabilities>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptsCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_changed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourcesCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscribe: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_changed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_changed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootsCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_changed: Option<bool>,
}

// =====================
// Initialize Types
// =====================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeParams {
    pub protocol_version: String,
    pub capabilities: ClientCapabilities,
    pub client_info: Implementation,
    #[serde(rename = "_meta", skip_serializing_if = "Option::is_none")]
    pub meta: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeResponse {
    pub protocol_version: String,
    pub capabilities: ServerCapabilities,
    pub server_info: Implementation,
    #[serde(rename = "_meta", skip_serializing_if = "Option::is_none")]
    pub meta: Option<HashMap<String, serde_json::Value>>,
}

// =====================
// Resource Types
// =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    pub uri: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourcesListResponse {
    pub resources: Vec<Resource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourcesReadParams {
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceContents {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blob: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourcesReadResponse {
    pub contents: Vec<ResourceContents>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceTemplate {
    pub uri_template: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceTemplatesListResponse {
    pub resource_templates: Vec<ResourceTemplate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// =====================
// Tool Types
// =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub input_schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotations: Option<ToolAnnotations>,
}

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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsListResponse {
    pub tools: Vec<Tool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallToolParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolResponseContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image", rename_all = "camelCase")]
    Image { data: String, mime_type: String },
    #[serde(rename = "audio", rename_all = "camelCase")]
    Audio { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { resource: ResourceContents },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallToolResponse {
    pub content: Vec<ToolResponseContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured_content: Option<serde_json::Value>,
}

// =====================
// Prompt Types
// =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<Vec<PromptArgument>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptArgument {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptsListResponse {
    pub prompts: Vec<Prompt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptsGetParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MessageContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image", rename_all = "camelCase")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { resource: ResourceContents },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptMessage {
    pub role: Role,
    pub content: MessageContent,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptsGetResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub messages: Vec<PromptMessage>,
}

// =====================
// Root Types
// =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootsListResponse {
    pub roots: Vec<Root>,
}

// =====================
// Logging Types
// =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoggingLevel {
    Debug,
    Info,
    Notice,
    Warning,
    Error,
    Critical,
    Alert,
    Emergency,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingSetLevelParams {
    pub level: LoggingLevel,
}

// =====================
// Completion Types
// =====================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionCompleteParams {
    #[serde(rename = "ref")]
    pub reference: CompletionReference,
    pub argument: CompletionArgument,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CompletionReference {
    Prompt(PromptReference),
    Resource(ResourceReference),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptReference {
    #[serde(rename = "type")]
    pub ty: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceReference {
    #[serde(rename = "type")]
    pub ty: String,
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionArgument {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionResult {
    pub values: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_more: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionCompleteResponse {
    pub completion: CompletionResult,
}

// =====================
// JSON-RPC Types
// =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RequestId {
    Int(i64), // Changed from i32 to i64 for compatibility with Cortex-mcp-types
    Str(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest<T> {
    pub jsonrpc: String,
    pub id: RequestId,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<T>,
}

#[derive(Debug, Deserialize)]
#[serde(bound(deserialize = "T: serde::de::DeserializeOwned"))]
pub struct JsonRpcResponse<T> {
    pub jsonrpc: String,
    pub id: RequestId,
    pub result: Option<T>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcNotification<T> {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<T>,
}
