//! DAP Protocol base message types
//!
//! These types represent the fundamental message structure of the
//! Debug Adapter Protocol.

use serde::{Deserialize, Serialize};

/// Base message type for DAP protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DapMessage {
    Request(DapRequest),
    Response(DapResponse),
    Event(DapEvent),
}

/// Request message from client to debug adapter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DapRequest {
    pub seq: u64,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<serde_json::Value>,
}

/// Response message from debug adapter to client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DapResponse {
    pub seq: u64,
    pub request_seq: u64,
    pub success: bool,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
}

/// Event message from debug adapter to client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DapEvent {
    pub seq: u64,
    pub event: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
}
