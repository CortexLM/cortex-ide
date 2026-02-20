//! Helper types for workflow execution results
//!
//! Contains data structures representing the results of various
//! execution operations like shell commands, HTTP requests, and AI calls.

use std::collections::HashMap;

/// Result of a shell command execution
pub struct ShellOutput {
    /// Standard output from the command
    pub stdout: String,
    /// Standard error from the command
    pub stderr: String,
    /// Exit code of the command
    pub exit_code: i32,
    /// Duration of execution in milliseconds
    pub duration_ms: u64,
}

/// Result of an HTTP request
pub struct HttpResponse {
    /// HTTP status code
    pub status_code: u16,
    /// Response body as string
    pub body: String,
    /// Response headers
    pub headers: HashMap<String, String>,
    /// Duration of request in milliseconds
    pub duration_ms: u64,
}

/// Result of an AI call
pub struct AiResponse {
    /// AI-generated content
    pub content: String,
    /// Total tokens used
    pub tokens_used: u32,
    /// Duration of call in milliseconds
    pub duration_ms: u64,
}
