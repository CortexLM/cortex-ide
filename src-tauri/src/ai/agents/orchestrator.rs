//! Agent orchestrator for managing sub-agents and tasks

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex as TokioMutex, mpsc};
use uuid::Uuid;

use super::types::{
    AgentError, AgentStatus, AgentStreamChunk, AgentTask, AgentType, OrchestratorStats, SubAgent,
};

pub struct AgentOrchestrator {
    agents: HashMap<String, SubAgent>,
    tasks: HashMap<String, AgentTask>,
    running: HashMap<String, tokio::sync::watch::Sender<bool>>,
    max: usize,
    hist: Vec<AgentTask>,
}

impl AgentOrchestrator {
    pub fn new(max: usize) -> Self {
        Self {
            agents: HashMap::new(),
            tasks: HashMap::new(),
            running: HashMap::new(),
            max,
            hist: Vec::new(),
        }
    }

    pub fn spawn_agent(
        &mut self,
        name: &str,
        prompt: &str,
        model: &str,
        parent: Option<&str>,
    ) -> Result<String, AgentError> {
        if self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Running)
            .count()
            >= self.max
        {
            return Err(AgentError::MaxConcurrentReached(self.max));
        }
        let a = SubAgent::new(
            name,
            &format!("Custom: {}", name),
            prompt,
            model,
            AgentType::Custom,
            parent,
        );
        let id = a.id.clone();
        self.agents.insert(id.clone(), a);
        Ok(id)
    }

    pub fn spawn_specialized_agent(
        &mut self,
        at: AgentType,
        model: Option<&str>,
        parent: Option<&str>,
    ) -> Result<String, AgentError> {
        if self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Running)
            .count()
            >= self.max
        {
            return Err(AgentError::MaxConcurrentReached(self.max));
        }
        let m = model.unwrap_or("gpt-4");
        let a = match at {
            AgentType::Code => SubAgent::code_agent(m, parent),
            AgentType::Research => SubAgent::research_agent(m, parent),
            AgentType::Test => SubAgent::test_agent(m, parent),
            AgentType::Review => SubAgent::review_agent(m, parent),
            AgentType::Custom => {
                return Err(AgentError::InvalidAgentType("Use spawn_agent".into()));
            }
        };
        let id = a.id.clone();
        self.agents.insert(id.clone(), a);
        Ok(id)
    }

    pub async fn run_task(
        &mut self,
        aid: &str,
        prompt: &str,
        ctx: Vec<String>,
        tx: mpsc::Sender<AgentStreamChunk>,
    ) -> Result<String, AgentError> {
        let agent = self
            .agents
            .get_mut(aid)
            .ok_or_else(|| AgentError::AgentNotFound(aid.into()))?;
        if agent.status == AgentStatus::Running {
            return Err(AgentError::AgentBusy(aid.into()));
        }
        let mut task = AgentTask::new(aid, prompt, ctx);
        let tid = task.id.clone();
        agent.set_status(AgentStatus::Running);
        task.start();
        let (ctx, crx) = tokio::sync::watch::channel(false);
        self.running.insert(tid.clone(), ctx);
        self.tasks.insert(tid.clone(), task);
        let (a, t, s, _p) = (
            aid.to_string(),
            tid.clone(),
            Uuid::new_v4().to_string(),
            prompt.to_string(),
        );
        let r = tokio::spawn(async move {
            let mut seq = 0u32;
            let mut acc = String::new();
            for part in ["Processing...\n", "Done\n"] {
                if *crx.borrow() {
                    return Err(AgentError::TaskCancelled(t.clone()));
                }
                acc.push_str(part);
                if tx
                    .send(AgentStreamChunk::new(&s, &a, &t, part, seq))
                    .await
                    .is_err()
                {
                    return Err(AgentError::Internal("Send fail".into()));
                }
                seq += 1;
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
            let _ = tx
                .send(AgentStreamChunk::new(&s, &a, &t, "", seq).finalize())
                .await;
            Ok(acc)
        })
        .await
        .map_err(|e| AgentError::Internal(e.to_string()))?;
        self.running.remove(&tid);
        match r {
            Ok(c) => {
                if let Some(t) = self.tasks.get_mut(&tid) {
                    t.complete(c);
                }
                if let Some(a) = self.agents.get_mut(aid) {
                    a.set_status(AgentStatus::Idle);
                    a.tasks_completed += 1;
                }
                Ok(tid)
            }
            Err(e) => {
                if let Some(t) = self.tasks.get_mut(&tid) {
                    t.fail(e.to_string());
                }
                if let Some(a) = self.agents.get_mut(aid) {
                    a.set_status(AgentStatus::Idle);
                    a.tasks_failed += 1;
                }
                Err(e)
            }
        }
    }

    pub fn cancel_task(&mut self, tid: &str) -> Result<(), AgentError> {
        if let Some(tx) = self.running.get(tid) {
            let _ = tx.send(true);
        }
        if let Some(t) = self.tasks.get_mut(tid) {
            t.cancel();
            if let Some(a) = self.agents.get_mut(&t.agent_id) {
                a.set_status(AgentStatus::Idle);
            }
            self.running.remove(tid);
            Ok(())
        } else {
            Err(AgentError::TaskNotFound(tid.into()))
        }
    }

    pub fn get_agent(&self, id: &str) -> Option<&SubAgent> {
        self.agents.get(id)
    }

    pub fn list_agents(&self) -> Vec<&SubAgent> {
        self.agents.values().collect()
    }

    pub fn list_agents_by_status(&self, s: AgentStatus) -> Vec<&SubAgent> {
        self.agents.values().filter(|a| a.status == s).collect()
    }

    pub fn get_task(&self, id: &str) -> Option<&AgentTask> {
        self.tasks.get(id)
    }

    pub fn list_tasks(&self, aid: Option<&str>) -> Vec<&AgentTask> {
        match aid {
            Some(a) => self.tasks.values().filter(|t| t.agent_id == a).collect(),
            None => self.tasks.values().collect(),
        }
    }

    pub fn list_tasks_by_status(&self, s: AgentStatus) -> Vec<&AgentTask> {
        self.tasks.values().filter(|t| t.status == s).collect()
    }

    pub fn remove_agent(&mut self, id: &str) -> Result<SubAgent, AgentError> {
        if let Some(a) = self.agents.get(id) {
            if a.status == AgentStatus::Running {
                return Err(AgentError::AgentBusy(id.into()));
            }
        }
        self.agents
            .remove(id)
            .ok_or_else(|| AgentError::AgentNotFound(id.into()))
    }

    pub fn get_stats(&self) -> OrchestratorStats {
        OrchestratorStats {
            total_agents: self.agents.len(),
            running_agents: self
                .agents
                .values()
                .filter(|a| a.status == AgentStatus::Running)
                .count(),
            idle_agents: self
                .agents
                .values()
                .filter(|a| a.status == AgentStatus::Idle)
                .count(),
            total_tasks: self.tasks.len(),
            running_tasks: self
                .tasks
                .values()
                .filter(|t| t.status == AgentStatus::Running)
                .count(),
            completed_tasks: self
                .tasks
                .values()
                .filter(|t| t.status == AgentStatus::Completed)
                .count(),
            failed_tasks: self
                .tasks
                .values()
                .filter(|t| t.status == AgentStatus::Failed)
                .count(),
            history_size: self.hist.len(),
            max_concurrent: self.max,
        }
    }

    pub fn get_task_history(&self) -> &[AgentTask] {
        &self.hist
    }

    pub fn archive_completed_tasks(&mut self) {
        let ids: Vec<_> = self
            .tasks
            .iter()
            .filter(|(_, t)| {
                matches!(
                    t.status,
                    AgentStatus::Completed | AgentStatus::Failed | AgentStatus::Cancelled
                )
            })
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            if let Some(t) = self.tasks.remove(&id) {
                self.hist.push(t);
                if self.hist.len() > 100 {
                    self.hist.remove(0);
                }
            }
        }
    }
}

#[derive(Clone)]
pub struct AgentState(pub Arc<TokioMutex<AgentOrchestrator>>);

impl AgentState {
    pub fn new() -> Self {
        Self(Arc::new(TokioMutex::new(AgentOrchestrator::new(5))))
    }
}

impl Default for AgentState {
    fn default() -> Self {
        Self::new()
    }
}
