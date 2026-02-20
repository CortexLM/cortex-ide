//! JSON-RPC protocol between Rust and the Node.js extension host.
//!
//! Messages are exchanged as line-delimited JSON over stdin/stdout, matching
//! the VS Code extension host protocol conventions.  This module defines
//! request/response/notification types, standard error codes, and typed
//! extension host message envelopes.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};

use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, oneshot};

// ============================================================================
// ID generator
// ============================================================================

static NEXT_REQUEST_ID: AtomicI64 = AtomicI64::new(1);

// ============================================================================
// Core JSON-RPC types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: i64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum NodeHostMessage {
    Response(JsonRpcResponse),
    Notification(JsonRpcNotification),
}

impl JsonRpcRequest {
    pub fn new(method: &str, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: NEXT_REQUEST_ID.fetch_add(1, Ordering::SeqCst),
            method: method.to_string(),
            params,
        }
    }

    pub fn with_id(id: i64, method: &str, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        }
    }
}

impl JsonRpcNotification {
    pub fn new(method: &str, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        }
    }
}

impl JsonRpcResponse {
    pub fn success(id: i64, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(id),
            result: Some(result),
            error: None,
        }
    }

    pub fn error(id: i64, code: i64, message: String) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(id),
            result: None,
            error: Some(JsonRpcError {
                code,
                message,
                data: None,
            }),
        }
    }
}

// ============================================================================
// Standard JSON-RPC / VS Code error codes
// ============================================================================

pub mod error_codes {
    pub const PARSE_ERROR: i64 = -32700;
    pub const INVALID_REQUEST: i64 = -32600;
    pub const METHOD_NOT_FOUND: i64 = -32601;
    pub const INVALID_PARAMS: i64 = -32602;
    pub const INTERNAL_ERROR: i64 = -32603;
    pub const SERVER_NOT_INITIALIZED: i64 = -32002;
    pub const UNKNOWN_ERROR_CODE: i64 = -32001;
    pub const REQUEST_CANCELLED: i64 = -32800;
    pub const CONTENT_MODIFIED: i64 = -32801;
}

// ============================================================================
// Extension host protocol messages (typed wrappers)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ExtHostMessage {
    Initialize {
        capabilities: serde_json::Value,
    },
    Initialized,
    Shutdown,
    Exit,

    ActivateExtension {
        extension_id: String,
    },
    DeactivateExtension {
        extension_id: String,
    },
    ExecuteCommand {
        command_id: String,
        #[serde(default)]
        args: Vec<serde_json::Value>,
    },

    ExtensionActivated {
        extension_id: String,
        #[serde(default)]
        activation_time_ms: Option<f64>,
    },
    ExtensionDeactivated {
        extension_id: String,
    },
    ExtensionError {
        extension_id: String,
        error: String,
        #[serde(default)]
        phase: Option<String>,
    },

    ApiCall {
        namespace: String,
        method: String,
        args: serde_json::Value,
        #[serde(default)]
        extension_id: Option<String>,
    },
    ApiResult {
        request_id: i64,
        #[serde(default)]
        result: Option<serde_json::Value>,
        #[serde(default)]
        error: Option<String>,
    },

    Log {
        level: String,
        message: String,
        #[serde(default)]
        extension_id: Option<String>,
    },

    ContributeStatusBarItem {
        extension_id: String,
        item_id: String,
        text: String,
        #[serde(default)]
        tooltip: Option<String>,
        #[serde(default)]
        command: Option<String>,
        #[serde(default)]
        alignment: Option<String>,
        #[serde(default)]
        priority: Option<i32>,
    },
    ContributeTreeView {
        extension_id: String,
        view_id: String,
        title: String,
    },
    ContributeWebviewPanel {
        extension_id: String,
        panel_id: String,
        title: String,
        #[serde(default)]
        html: Option<String>,
    },
}

// ============================================================================
// Pending request tracker
// ============================================================================

pub struct PendingRequests {
    inner: Arc<Mutex<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>>,
}

impl PendingRequests {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn insert(&self, id: i64) -> oneshot::Receiver<JsonRpcResponse> {
        let (tx, rx) = oneshot::channel();
        self.inner.lock().await.insert(id, tx);
        rx
    }

    pub async fn resolve(&self, id: i64, response: JsonRpcResponse) -> bool {
        if let Some(tx) = self.inner.lock().await.remove(&id) {
            tx.send(response).is_ok()
        } else {
            false
        }
    }

    pub async fn cancel_all(&self) {
        let mut map = self.inner.lock().await;
        for (id, tx) in map.drain() {
            let _ = tx.send(JsonRpcResponse::error(
                id,
                error_codes::REQUEST_CANCELLED,
                "Extension host shutting down".to_string(),
            ));
        }
    }
}

impl Default for PendingRequests {
    fn default() -> Self {
        Self::new()
    }
}
