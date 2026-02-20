//! Persistent storage types for agents

use serde::{Deserialize, Serialize};

use super::types::{AgentStatus, AgentType};

fn default_enabled() -> bool {
    true
}

fn default_can_delegate() -> bool {
    true
}

/// Stored agent data for persistence (different from runtime SubAgent)
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAgent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub model: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub is_built_in: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub tokens_used: u64,
    pub cost_usd: f64,
    pub tasks_completed: u32,
    pub tasks_failed: u32,
    pub last_active_at: Option<i64>,
    /// Whether the agent is enabled (available in Cortex's Task tool)
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Allowed tools (None means all tools)
    #[serde(default)]
    pub allowed_tools: Option<Vec<String>>,
    /// Denied tools
    #[serde(default)]
    pub denied_tools: Vec<String>,
    /// Tags for categorization
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Agent metadata format compatible with Cortex's agent.json
/// This is the format written to the OS-specific agents directory
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CortexAgentMetadata {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub denied_tools: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_can_delegate")]
    pub can_delegate: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_turns: Option<u32>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

/// History entry for agent tasks
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHistoryEntry {
    pub id: String,
    pub agent_id: String,
    pub prompt: String,
    pub result: Option<String>,
    pub tokens_used: u64,
    pub cost_usd: f64,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub status: AgentStatus,
    pub error: Option<String>,
}

/// Data structure for storing agents
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentStoreData {
    pub version: String,
    pub agents: Vec<StoredAgent>,
    pub history: Vec<AgentHistoryEntry>,
}
