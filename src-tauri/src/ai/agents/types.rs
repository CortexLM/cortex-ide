//! Agent types and core data structures

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use uuid::Uuid;

/// Get the current timestamp in milliseconds since Unix epoch
pub fn ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("Agent not found: {0}")]
    AgentNotFound(String),
    #[error("Task not found: {0}")]
    TaskNotFound(String),
    #[error("Agent busy: {0}")]
    AgentBusy(String),
    #[error("Task cancelled: {0}")]
    TaskCancelled(String),
    #[error("Max concurrent: {0}")]
    MaxConcurrentReached(usize),
    #[error("Invalid type: {0}")]
    InvalidAgentType(String),
    #[error("Internal: {0}")]
    Internal(String),
}

impl Serialize for AgentError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStreamChunk {
    pub stream_id: String,
    pub agent_id: String,
    pub task_id: String,
    pub content: String,
    pub is_final: bool,
    pub sequence: u32,
}

impl AgentStreamChunk {
    pub fn new(
        stream_id: &str,
        agent_id: &str,
        task_id: &str,
        content: &str,
        sequence: u32,
    ) -> Self {
        Self {
            stream_id: stream_id.into(),
            agent_id: agent_id.into(),
            task_id: task_id.into(),
            content: content.into(),
            is_final: false,
            sequence,
        }
    }
    pub fn finalize(mut self) -> Self {
        self.is_final = true;
        self
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Idle,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl Default for AgentStatus {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentType {
    Custom,
    Code,
    Research,
    Test,
    Review,
}

impl Default for AgentType {
    fn default() -> Self {
        Self::Custom
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubAgent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub model: String,
    pub status: AgentStatus,
    pub parent_id: Option<String>,
    pub agent_type: AgentType,
    pub created_at: i64,
    pub last_active_at: Option<i64>,
    pub tasks_completed: u32,
    pub tasks_failed: u32,
}

impl SubAgent {
    pub fn new(
        name: &str,
        desc: &str,
        prompt: &str,
        model: &str,
        at: AgentType,
        parent: Option<&str>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            description: desc.into(),
            system_prompt: prompt.into(),
            model: model.into(),
            status: AgentStatus::Idle,
            parent_id: parent.map(Into::into),
            agent_type: at,
            created_at: ts(),
            last_active_at: None,
            tasks_completed: 0,
            tasks_failed: 0,
        }
    }

    pub fn code_agent(m: &str, p: Option<&str>) -> Self {
        Self::new(
            "CodeAgent",
            "Code gen",
            "Code expert",
            m,
            AgentType::Code,
            p,
        )
    }

    pub fn research_agent(m: &str, p: Option<&str>) -> Self {
        Self::new(
            "ResearchAgent",
            "Research",
            "Research expert",
            m,
            AgentType::Research,
            p,
        )
    }

    pub fn test_agent(m: &str, p: Option<&str>) -> Self {
        Self::new("TestAgent", "Testing", "Test expert", m, AgentType::Test, p)
    }

    pub fn review_agent(m: &str, p: Option<&str>) -> Self {
        Self::new(
            "ReviewAgent",
            "Review",
            "Review expert",
            m,
            AgentType::Review,
            p,
        )
    }

    pub fn set_status(&mut self, s: AgentStatus) {
        self.status = s;
        self.last_active_at = Some(ts());
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTask {
    pub id: String,
    pub agent_id: String,
    pub prompt: String,
    pub context: Vec<String>,
    pub result: Option<String>,
    pub status: AgentStatus,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub error: Option<String>,
    pub priority: u32,
}

impl AgentTask {
    pub fn new(aid: &str, prompt: &str, ctx: Vec<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            agent_id: aid.into(),
            prompt: prompt.into(),
            context: ctx,
            result: None,
            status: AgentStatus::Idle,
            started_at: None,
            completed_at: None,
            error: None,
            priority: 0,
        }
    }

    pub fn start(&mut self) {
        self.status = AgentStatus::Running;
        self.started_at = Some(ts());
    }

    pub fn complete(&mut self, r: String) {
        self.status = AgentStatus::Completed;
        self.result = Some(r);
        self.completed_at = Some(ts());
    }

    pub fn fail(&mut self, e: String) {
        self.status = AgentStatus::Failed;
        self.error = Some(e);
        self.completed_at = Some(ts());
    }

    pub fn cancel(&mut self) {
        self.status = AgentStatus::Cancelled;
        self.completed_at = Some(ts());
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestratorStats {
    pub total_agents: usize,
    pub running_agents: usize,
    pub idle_agents: usize,
    pub total_tasks: usize,
    pub running_tasks: usize,
    pub completed_tasks: usize,
    pub failed_tasks: usize,
    pub history_size: usize,
    pub max_concurrent: usize,
}
