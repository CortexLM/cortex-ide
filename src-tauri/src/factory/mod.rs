//! Agent Factory Module
//!
//! Provides a visual workflow designer for creating, orchestrating, and managing
//! AI agent pipelines. Supports workflow persistence, execution, interception,
//! and comprehensive audit logging.
//!
//! # Features
//! - Visual workflow designer with node-based editing
//! - Multi-agent orchestration with parallel/sequential execution
//! - Interception engine for human-in-the-loop approval
//! - Comprehensive audit logging to SQLite and files
//! - Workflow persistence in `.cortex/factory/` directory

pub mod audit;
pub mod commands;
pub mod events;
pub mod executor;
pub mod interception;
pub mod orchestrator;
pub mod persistence;
pub mod types;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex as TokioMutex, RwLock};

use audit::AuditLogger;
use executor::WorkflowExecutor;
use interception::InterceptionEngine;
use orchestrator::AgentOrchestrator;
use persistence::PersistenceManager;
use types::{AgentRuntimeState, ExecutionState, PendingApproval, Workflow};

/// State for managing the Agent Factory system
#[derive(Clone)]
pub struct FactoryState(pub Arc<TokioMutex<FactoryManager>>);

impl FactoryState {
    pub fn new() -> Self {
        Self(Arc::new(TokioMutex::new(FactoryManager::new())))
    }
}

impl Default for FactoryState {
    fn default() -> Self {
        Self::new()
    }
}

/// Central manager for the Agent Factory system
pub struct FactoryManager {
    /// Registered workflows by ID
    workflows: HashMap<String, Workflow>,
    /// Active workflow executions by ID
    executions: HashMap<String, Arc<RwLock<ExecutionState>>>,
    /// Agent runtime states by ID
    agents: HashMap<String, AgentRuntimeState>,
    /// Pending approvals by ID
    pending_approvals: HashMap<String, PendingApproval>,
    /// Workflow executor
    executor: WorkflowExecutor,
    /// Agent orchestrator
    orchestrator: AgentOrchestrator,
    /// Interception engine
    interception: InterceptionEngine,
    /// Audit logger
    audit: AuditLogger,
    /// Persistence manager
    persistence: PersistenceManager,
    /// ID counter for generating unique IDs
    next_id: u64,
}

impl FactoryManager {
    pub fn new() -> Self {
        Self {
            workflows: HashMap::new(),
            executions: HashMap::new(),
            agents: HashMap::new(),
            pending_approvals: HashMap::new(),
            executor: WorkflowExecutor::new(),
            orchestrator: AgentOrchestrator::new(10), // Max 10 concurrent agents
            interception: InterceptionEngine::new(),
            audit: AuditLogger::new(),
            persistence: PersistenceManager::new(),
            next_id: 1,
        }
    }

    /// Generate a unique ID with the given prefix
    pub fn generate_id(&mut self, prefix: &str) -> String {
        let id = format!("{}_{}", prefix, self.next_id);
        self.next_id += 1;
        id
    }

    // =========================================================================
    // Workflow Management
    // =========================================================================

    /// Create a new workflow
    pub fn create_workflow(&mut self, mut workflow: Workflow) -> String {
        if workflow.id.is_empty() {
            workflow.id = self.generate_id("wf");
        }
        let id = workflow.id.clone();
        workflow.created_at = Self::now_ms();
        workflow.updated_at = workflow.created_at;
        self.workflows.insert(id.clone(), workflow);
        id
    }

    /// Update an existing workflow
    pub fn update_workflow(&mut self, workflow: Workflow) -> Result<(), String> {
        let id = workflow.id.clone();
        if !self.workflows.contains_key(&id) {
            return Err(format!("Workflow not found: {}", id));
        }
        let mut updated = workflow;
        updated.updated_at = Self::now_ms();
        self.workflows.insert(id, updated);
        Ok(())
    }

    /// Delete a workflow
    pub fn delete_workflow(&mut self, workflow_id: &str) -> Result<Workflow, String> {
        self.workflows
            .remove(workflow_id)
            .ok_or_else(|| format!("Workflow not found: {}", workflow_id))
    }

    /// Get a workflow by ID
    pub fn get_workflow(&self, workflow_id: &str) -> Option<&Workflow> {
        self.workflows.get(workflow_id)
    }

    /// List all workflows
    pub fn list_workflows(&self) -> Vec<&Workflow> {
        self.workflows.values().collect()
    }

    // =========================================================================
    // Execution Management
    // =========================================================================

    /// Get an execution state by ID
    pub fn get_execution(&self, execution_id: &str) -> Option<Arc<RwLock<ExecutionState>>> {
        self.executions.get(execution_id).cloned()
    }

    /// Store an execution state
    pub fn store_execution(&mut self, state: ExecutionState) {
        self.executions
            .insert(state.id.clone(), Arc::new(RwLock::new(state)));
    }

    /// Remove an execution
    pub fn remove_execution(&mut self, execution_id: &str) -> bool {
        self.executions.remove(execution_id).is_some()
    }

    // =========================================================================
    // Agent Management
    // =========================================================================

    /// Create a new agent
    pub fn create_agent(&mut self, mut agent: AgentRuntimeState) -> String {
        if agent.id.is_empty() {
            agent.id = self.generate_id("agent");
        }
        let id = agent.id.clone();
        self.agents.insert(id.clone(), agent);
        id
    }

    /// Update an agent
    pub fn update_agent(&mut self, agent: AgentRuntimeState) -> Result<(), String> {
        let id = &agent.id;
        if !self.agents.contains_key(id) {
            return Err(format!("Agent not found: {}", id));
        }
        self.agents.insert(id.clone(), agent);
        Ok(())
    }

    /// Delete an agent
    pub fn delete_agent(&mut self, agent_id: &str) -> Result<AgentRuntimeState, String> {
        self.agents
            .remove(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))
    }

    /// Get an agent by ID
    pub fn get_agent(&self, agent_id: &str) -> Option<&AgentRuntimeState> {
        self.agents.get(agent_id)
    }

    /// Get a mutable agent by ID
    pub fn get_agent_mut(&mut self, agent_id: &str) -> Option<&mut AgentRuntimeState> {
        self.agents.get_mut(agent_id)
    }

    /// List all agents
    pub fn list_agents(&self) -> Vec<&AgentRuntimeState> {
        self.agents.values().collect()
    }

    // =========================================================================
    // Approval Management
    // =========================================================================

    /// Add a pending approval
    pub fn add_pending_approval(&mut self, mut approval: PendingApproval) -> String {
        if approval.id.is_empty() {
            approval.id = self.generate_id("approval");
        }
        let id = approval.id.clone();
        self.pending_approvals.insert(id.clone(), approval);
        id
    }

    /// Get a pending approval by ID
    pub fn get_pending_approval(&self, approval_id: &str) -> Option<&PendingApproval> {
        self.pending_approvals.get(approval_id)
    }

    /// Remove a pending approval
    pub fn remove_pending_approval(&mut self, approval_id: &str) -> Option<PendingApproval> {
        self.pending_approvals.remove(approval_id)
    }

    /// List all pending approvals
    pub fn list_pending_approvals(&self) -> Vec<&PendingApproval> {
        self.pending_approvals.values().collect()
    }

    // =========================================================================
    // Component Access
    // =========================================================================

    /// Get a reference to the executor
    pub fn executor(&self) -> &WorkflowExecutor {
        &self.executor
    }

    /// Get a mutable reference to the executor
    pub fn executor_mut(&mut self) -> &mut WorkflowExecutor {
        &mut self.executor
    }

    /// Get a reference to the orchestrator
    pub fn orchestrator(&self) -> &AgentOrchestrator {
        &self.orchestrator
    }

    /// Get a mutable reference to the orchestrator
    pub fn orchestrator_mut(&mut self) -> &mut AgentOrchestrator {
        &mut self.orchestrator
    }

    /// Get a reference to the interception engine
    pub fn interception(&self) -> &InterceptionEngine {
        &self.interception
    }

    /// Get a mutable reference to the interception engine
    pub fn interception_mut(&mut self) -> &mut InterceptionEngine {
        &mut self.interception
    }

    /// Get a reference to the audit logger
    pub fn audit(&self) -> &AuditLogger {
        &self.audit
    }

    /// Get a mutable reference to the audit logger
    pub fn audit_mut(&mut self) -> &mut AuditLogger {
        &mut self.audit
    }

    /// Get a reference to the persistence manager
    pub fn persistence(&self) -> &PersistenceManager {
        &self.persistence
    }

    /// Get a mutable reference to the persistence manager
    pub fn persistence_mut(&mut self) -> &mut PersistenceManager {
        &mut self.persistence
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    /// Get current timestamp in milliseconds
    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

impl Default for FactoryManager {
    fn default() -> Self {
        Self::new()
    }
}
