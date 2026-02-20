//! Jupyter kernel protocol support
//!
//! This module provides support for the Jupyter kernel protocol,
//! enabling communication with Jupyter kernels for advanced REPL functionality.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Jupyter message header
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JupyterHeader {
    pub msg_id: String,
    pub msg_type: String,
    pub session: String,
    pub username: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
}

/// Jupyter message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JupyterMessage {
    pub header: JupyterHeader,
    pub parent_header: Option<JupyterHeader>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub content: serde_json::Value,
    #[serde(default)]
    pub buffers: Vec<Vec<u8>>,
}

impl JupyterMessage {
    /// Create a new Jupyter message
    pub fn new(msg_type: &str, content: serde_json::Value, session: &str) -> Self {
        Self {
            header: JupyterHeader {
                msg_id: generate_msg_id(),
                msg_type: msg_type.to_string(),
                session: session.to_string(),
                username: "Cortex".to_string(),
                version: "5.3".to_string(),
                date: Some(chrono_now()),
            },
            parent_header: None,
            metadata: HashMap::new(),
            content,
            buffers: Vec::new(),
        }
    }

    /// Create an execute request message
    pub fn execute_request(code: &str, session: &str) -> Self {
        Self::new(
            "execute_request",
            serde_json::json!({
                "code": code,
                "silent": false,
                "store_history": true,
                "user_expressions": {},
                "allow_stdin": false,
                "stop_on_error": true
            }),
            session,
        )
    }

    /// Create a kernel info request
    pub fn kernel_info_request(session: &str) -> Self {
        Self::new("kernel_info_request", serde_json::json!({}), session)
    }

    /// Create an interrupt request
    pub fn interrupt_request(session: &str) -> Self {
        Self::new("interrupt_request", serde_json::json!({}), session)
    }

    /// Create a shutdown request
    pub fn shutdown_request(restart: bool, session: &str) -> Self {
        Self::new(
            "shutdown_request",
            serde_json::json!({
                "restart": restart
            }),
            session,
        )
    }

    /// Create a complete request for code completion
    pub fn complete_request(code: &str, cursor_pos: usize, session: &str) -> Self {
        Self::new(
            "complete_request",
            serde_json::json!({
                "code": code,
                "cursor_pos": cursor_pos
            }),
            session,
        )
    }

    /// Create an inspect request for introspection
    pub fn inspect_request(code: &str, cursor_pos: usize, detail_level: u8, session: &str) -> Self {
        Self::new(
            "inspect_request",
            serde_json::json!({
                "code": code,
                "cursor_pos": cursor_pos,
                "detail_level": detail_level
            }),
            session,
        )
    }
}

/// Jupyter execute request content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub code: String,
    #[serde(default)]
    pub silent: bool,
    #[serde(default = "default_true")]
    pub store_history: bool,
    #[serde(default)]
    pub user_expressions: HashMap<String, String>,
    #[serde(default)]
    pub allow_stdin: bool,
    #[serde(default = "default_true")]
    pub stop_on_error: bool,
}

fn default_true() -> bool {
    true
}

/// Jupyter execute reply content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteReply {
    pub status: String,
    pub execution_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_expressions: Option<HashMap<String, serde_json::Value>>,
}

/// Jupyter stream output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamOutput {
    pub name: String, // "stdout" or "stderr"
    pub text: String,
}

/// Jupyter display data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayData {
    pub data: HashMap<String, serde_json::Value>,
    pub metadata: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transient: Option<TransientData>,
}

/// Transient display data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransientData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_id: Option<String>,
}

/// Jupyter execute result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteResult {
    pub execution_count: u32,
    pub data: HashMap<String, serde_json::Value>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Jupyter error output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorOutput {
    pub ename: String,
    pub evalue: String,
    pub traceback: Vec<String>,
}

/// Jupyter kernel status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelStatusMessage {
    pub execution_state: String, // "busy", "idle", "starting"
}

/// Jupyter complete reply
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteReply {
    pub status: String,
    pub matches: Vec<String>,
    pub cursor_start: usize,
    pub cursor_end: usize,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Jupyter inspect reply
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectReply {
    pub status: String,
    pub found: bool,
    pub data: HashMap<String, serde_json::Value>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// MIME type bundle for rich display
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MimeBundle {
    #[serde(rename = "text/plain", skip_serializing_if = "Option::is_none")]
    pub text_plain: Option<String>,
    #[serde(rename = "text/html", skip_serializing_if = "Option::is_none")]
    pub text_html: Option<String>,
    #[serde(rename = "text/markdown", skip_serializing_if = "Option::is_none")]
    pub text_markdown: Option<String>,
    #[serde(rename = "image/png", skip_serializing_if = "Option::is_none")]
    pub image_png: Option<String>,
    #[serde(rename = "image/jpeg", skip_serializing_if = "Option::is_none")]
    pub image_jpeg: Option<String>,
    #[serde(rename = "image/svg+xml", skip_serializing_if = "Option::is_none")]
    pub image_svg: Option<String>,
    #[serde(rename = "application/json", skip_serializing_if = "Option::is_none")]
    pub application_json: Option<serde_json::Value>,
}

impl MimeBundle {
    /// Get the best displayable content
    pub fn best_content(&self) -> Option<(String, String)> {
        if let Some(ref html) = self.text_html {
            return Some(("text/html".to_string(), html.clone()));
        }
        if let Some(ref markdown) = self.text_markdown {
            return Some(("text/markdown".to_string(), markdown.clone()));
        }
        if let Some(ref png) = self.image_png {
            return Some(("image/png".to_string(), png.clone()));
        }
        if let Some(ref jpeg) = self.image_jpeg {
            return Some(("image/jpeg".to_string(), jpeg.clone()));
        }
        if let Some(ref svg) = self.image_svg {
            return Some(("image/svg+xml".to_string(), svg.clone()));
        }
        if let Some(ref text) = self.text_plain {
            return Some(("text/plain".to_string(), text.clone()));
        }
        None
    }
}

/// Generate a unique message ID
#[allow(clippy::expect_used)]
fn generate_msg_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System time should be after UNIX_EPOCH")
        .as_nanos();
    format!("{:x}", now)
}

/// Get current ISO 8601 timestamp
#[allow(clippy::expect_used)]
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System time should be after UNIX_EPOCH")
        .as_secs();
    // Simple ISO format without external crate
    format!("{}Z", now)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_execute_request() {
        let msg = JupyterMessage::execute_request("print('hello')", "test-session");
        assert_eq!(msg.header.msg_type, "execute_request");
        assert_eq!(msg.content["code"], "print('hello')");
    }

    #[test]
    fn test_mime_bundle() {
        let bundle = MimeBundle {
            text_plain: Some("Hello".to_string()),
            text_html: Some("<b>Hello</b>".to_string()),
            ..Default::default()
        };

        let (mime, content) = bundle.best_content().unwrap();
        assert_eq!(mime, "text/html");
        assert_eq!(content, "<b>Hello</b>");
    }
}
