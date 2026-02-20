//! DAP Protocol event body types
//!
//! These types represent the event bodies for various DAP events.

use serde::{Deserialize, Serialize};

use super::types::{Breakpoint, Source};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoppedEventBody {
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preserve_focus_hint: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_threads_stopped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_breakpoint_ids: Option<Vec<i64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuedEventBody {
    pub thread_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_threads_continued: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitedEventBody {
    pub exit_code: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminatedEventBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restart: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadEventBody {
    pub reason: String,
    pub thread_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputEventBody {
    pub category: Option<String>,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables_reference: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointEventBody {
    pub reason: String,
    pub breakpoint: Breakpoint,
}
