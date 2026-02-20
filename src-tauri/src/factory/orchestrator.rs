//! Agent Orchestration
//!
//! Manages spawning and coordination of multiple AI agents.

use std::collections::HashMap;

use super::types::{
    AgentConfig, AgentRuntimeState, AgentStatus, StepExecution, StepStatus, StepType,
};
use tokio::sync::mpsc;

/// Message types for agent communication
#[derive(Debug, Clone)]
pub enum AgentMessage {
    /// Start a task
    Start {
        prompt: String,
        context: Vec<String>,
    },
    /// Cancel the current task
    Cancel,
    /// Pause execution
    Pause,
    /// Resume execution
    Resume,
    /// Agent output/progress
    Progress { step: StepExecution },
    /// Agent completed
    Completed { result: String },
    /// Agent failed
    Failed { error: String },
}

/// Handle for communicating with an agent
pub struct AgentHandle {
    pub agent_id: String,
    pub tx: mpsc::Sender<AgentMessage>,
}

/// Agent orchestrator for managing multiple agents
pub struct AgentOrchestrator {
    /// Active agents by ID
    agents: HashMap<String, AgentRuntimeState>,
    /// Agent handles for communication
    handles: HashMap<String, AgentHandle>,
    /// Maximum concurrent agents
    max_concurrent: usize,
    /// ID counter
    next_id: u64,
}

impl AgentOrchestrator {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            agents: HashMap::new(),
            handles: HashMap::new(),
            max_concurrent,
            next_id: 1,
        }
    }

    /// Spawn a new agent
    pub fn spawn_agent(
        &mut self,
        name: &str,
        system_prompt: &str,
        model: &str,
        config: Option<AgentConfig>,
    ) -> Result<String, String> {
        // Check concurrent limit
        let running_count = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Running)
            .count();

        if running_count >= self.max_concurrent {
            return Err(format!(
                "Maximum concurrent agents reached ({})",
                self.max_concurrent
            ));
        }

        // Create agent
        let agent_id = format!("agent_{}", self.next_id);
        self.next_id += 1;

        let mut agent = AgentRuntimeState::new(name, system_prompt, model);
        agent.id = agent_id.clone();
        if let Some(cfg) = config {
            agent.config = cfg;
        }

        self.agents.insert(agent_id.clone(), agent);

        Ok(agent_id)
    }

    /// Get an agent by ID
    pub fn get_agent(&self, agent_id: &str) -> Option<&AgentRuntimeState> {
        self.agents.get(agent_id)
    }

    /// Get a mutable agent reference
    pub fn get_agent_mut(&mut self, agent_id: &str) -> Option<&mut AgentRuntimeState> {
        self.agents.get_mut(agent_id)
    }

    /// List all agents
    pub fn list_agents(&self) -> Vec<&AgentRuntimeState> {
        self.agents.values().collect()
    }

    /// List agents by status
    pub fn list_agents_by_status(&self, status: AgentStatus) -> Vec<&AgentRuntimeState> {
        self.agents
            .values()
            .filter(|a| a.status == status)
            .collect()
    }

    /// Start an agent task
    pub async fn start_task(
        &mut self,
        agent_id: &str,
        prompt: &str,
        context: Vec<String>,
    ) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        if agent.status == AgentStatus::Running {
            return Err("Agent is already running".to_string());
        }

        // Update agent status
        agent.status = AgentStatus::Running;
        agent.last_active_at = Some(Self::now_ms());

        // Create initial step
        let step = StepExecution {
            step_number: 1,
            step_type: StepType::Thinking,
            description: "Processing task".to_string(),
            input: Some(serde_json::json!({
                "prompt": prompt,
                "context": context
            })),
            output: None,
            status: StepStatus::Running,
            error: None,
            started_at: Self::now_ms(),
            completed_at: None,
            duration_ms: None,
        };

        agent.current_step = Some(step);

        Ok(())
    }

    /// Cancel an agent's current task
    pub fn cancel_task(&mut self, agent_id: &str) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        if agent.status != AgentStatus::Running && agent.status != AgentStatus::Paused {
            return Err("Agent is not running".to_string());
        }

        // Update status
        agent.status = AgentStatus::Cancelled;
        agent.last_active_at = Some(Self::now_ms());

        // Complete current step as cancelled
        if let Some(step) = agent.current_step.as_mut() {
            step.status = StepStatus::Cancelled;
            step.completed_at = Some(Self::now_ms());
            if let Some(started) = Some(step.started_at) {
                step.duration_ms = Some(Self::now_ms() - started);
            }
        }

        // Move current step to history
        if let Some(step) = agent.current_step.take() {
            agent.step_history.push(step);
        }

        Ok(())
    }

    /// Pause an agent
    pub fn pause_agent(&mut self, agent_id: &str) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        if agent.status != AgentStatus::Running {
            return Err("Agent is not running".to_string());
        }

        agent.status = AgentStatus::Paused;
        agent.last_active_at = Some(Self::now_ms());

        Ok(())
    }

    /// Resume a paused agent
    pub fn resume_agent(&mut self, agent_id: &str) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        if agent.status != AgentStatus::Paused {
            return Err("Agent is not paused".to_string());
        }

        agent.status = AgentStatus::Running;
        agent.last_active_at = Some(Self::now_ms());

        Ok(())
    }

    /// Complete an agent's task
    pub fn complete_task(&mut self, agent_id: &str, result: &str) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        // Update status
        agent.status = AgentStatus::Completed;
        agent.last_active_at = Some(Self::now_ms());

        // Complete current step
        if let Some(step) = agent.current_step.as_mut() {
            step.status = StepStatus::Completed;
            step.output = Some(serde_json::json!({ "result": result }));
            step.completed_at = Some(Self::now_ms());
            if let Some(started) = Some(step.started_at) {
                step.duration_ms = Some(Self::now_ms() - started);
            }
        }

        // Move current step to history
        if let Some(step) = agent.current_step.take() {
            agent.step_history.push(step);
        }

        Ok(())
    }

    /// Mark an agent as failed
    pub fn fail_task(&mut self, agent_id: &str, error: &str) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        // Update status
        agent.status = AgentStatus::Failed;
        agent.error = Some(error.to_string());
        agent.last_active_at = Some(Self::now_ms());

        // Complete current step as failed
        if let Some(step) = agent.current_step.as_mut() {
            step.status = StepStatus::Failed;
            step.error = Some(error.to_string());
            step.completed_at = Some(Self::now_ms());
            if let Some(started) = Some(step.started_at) {
                step.duration_ms = Some(Self::now_ms() - started);
            }
        }

        // Move current step to history
        if let Some(step) = agent.current_step.take() {
            agent.step_history.push(step);
        }

        Ok(())
    }

    /// Remove an agent
    pub fn remove_agent(&mut self, agent_id: &str) -> Result<AgentRuntimeState, String> {
        // Check if agent is running
        if let Some(agent) = self.agents.get(agent_id) {
            if agent.status == AgentStatus::Running {
                return Err("Cannot remove running agent".to_string());
            }
        }

        self.agents
            .remove(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))
    }

    /// Add a step to an agent's history
    pub fn add_step(&mut self, agent_id: &str, step: StepExecution) -> Result<(), String> {
        let agent = self
            .agents
            .get_mut(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        // If there's a current step, move it to history
        if let Some(current) = agent.current_step.take() {
            agent.step_history.push(current);
        }

        // Set new step as current
        agent.current_step = Some(step);
        agent.last_active_at = Some(Self::now_ms());

        Ok(())
    }

    /// Get statistics about the orchestrator
    pub fn get_stats(&self) -> OrchestratorStats {
        let total = self.agents.len();
        let running = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Running)
            .count();
        let paused = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Paused)
            .count();
        let completed = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Completed)
            .count();
        let failed = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Failed)
            .count();

        OrchestratorStats {
            total_agents: total,
            running_agents: running,
            paused_agents: paused,
            completed_agents: completed,
            failed_agents: failed,
            max_concurrent: self.max_concurrent,
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

impl Default for AgentOrchestrator {
    fn default() -> Self {
        Self::new(10)
    }
}

/// Statistics about the orchestrator
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestratorStats {
    pub total_agents: usize,
    pub running_agents: usize,
    pub paused_agents: usize,
    pub completed_agents: usize,
    pub failed_agents: usize,
    pub max_concurrent: usize,
}
