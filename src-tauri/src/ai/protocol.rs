use serde::{Deserialize, Serialize};

/// Token usage information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsageInfo {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
}

/// Server-to-client WebSocket messages.
/// Adapted for Tauri event emitting.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    /// Pong response.
    Pong { timestamp: u64 },
    /// Authentication result.
    AuthResult {
        success: bool,
        user_id: Option<String>,
    },
    /// Joined session confirmation.
    JoinedSession { session_id: String },
    /// Left session confirmation.
    LeftSession { session_id: Option<String> },
    /// Message received confirmation.
    MessageReceived {
        id: String,
        role: String,
        content: String,
    },
    /// Streaming response chunk.
    StreamChunk { content: String },
    /// Full agent message (end of streaming).
    AgentMessage { content: String },
    /// Tool call started.
    ToolCallBegin {
        call_id: String,
        tool_name: String,
        arguments: serde_json::Value,
    },
    /// Tool call completed.
    ToolCallEnd {
        call_id: String,
        tool_name: String,
        output: String,
        success: bool,
        duration_ms: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        metadata: Option<serde_json::Value>,
    },
    /// Tool call output chunk (streaming).
    ToolCallOutputDelta {
        call_id: String,
        stream: String, // "stdout" or "stderr"
        chunk: String,  // base64 encoded
    },
    /// Legacy tool call (kept for compatibility).
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
    /// Tool result.
    ToolResult {
        id: String,
        output: String,
        success: bool,
    },
    /// Approval request from CLI.
    ApprovalRequest {
        call_id: String,
        command: Vec<String>,
        cwd: String,
    },
    /// Task started.
    TaskStarted,
    /// Task completed.
    TaskComplete { message: Option<String> },
    /// Token usage update.
    TokenUsage {
        input_tokens: u32,
        output_tokens: u32,
        total_tokens: u32,
    },
    /// Stream ended (legacy).
    StreamEnd { usage: TokenUsageInfo },
    /// Operation cancelled.
    Cancelled,
    /// Connection status.
    Status {
        connected: bool,
        authenticated: bool,
        session_id: Option<String>,
        uptime_seconds: u64,
    },
    /// Session configured by CLI.
    SessionConfigured {
        session_id: String,
        model: String,
        cwd: String,
    },
    /// Model updated confirmation.
    ModelUpdated { model: String },
    /// Reasoning/thinking delta.
    ReasoningDelta { delta: String },
    /// Warning message.
    Warning { message: String },
    /// Session closed.
    SessionClosed,
    /// Error message.
    Error { code: String, message: String },
    /// Terminal created.
    TerminalCreated {
        terminal_id: String,
        name: String,
        cwd: String,
    },
    /// Terminal output line.
    TerminalOutput {
        terminal_id: String,
        timestamp: u64,
        content: String,
        stream: String,
    },
    /// Terminal status changed.
    TerminalStatus {
        terminal_id: String,
        status: String,
        exit_code: Option<i32>,
    },
    /// Terminal list.
    TerminalList { terminals: Vec<serde_json::Value> },
    /// Design system selection pending - UI should show picker and wait for user.
    DesignSystemPending {
        call_id: String,
        project_type: String,
        fonts: serde_json::Value,
        palettes: serde_json::Value,
    },
    /// Design system selection received.
    DesignSystemReceived { call_id: String },
}
