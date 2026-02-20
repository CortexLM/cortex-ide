//! Factory Event System
//!
//! Defines events emitted to the frontend for real-time updates.

use serde::{Deserialize, Serialize};

use super::types::{
    AgentRuntimeState, ExecutionState, PendingApproval, SupervisorDecision, Workflow,
};

/// Events emitted by the factory system
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FactoryEvent {
    // =========================================================================
    // Workflow Events
    // =========================================================================
    /// A workflow was created
    WorkflowCreated { workflow: Workflow },

    /// A workflow was updated
    WorkflowUpdated { workflow: Workflow },

    /// A workflow was deleted
    WorkflowDeleted { workflow_id: String },

    // =========================================================================
    // Execution Events
    // =========================================================================
    /// A workflow execution started
    ExecutionStarted { execution: ExecutionState },

    /// A workflow execution completed
    ExecutionCompleted { execution: ExecutionState },

    /// A workflow execution failed
    ExecutionFailed { execution_id: String, error: String },

    /// A workflow execution was paused
    ExecutionPaused { execution_id: String },

    /// A workflow execution was resumed
    ExecutionResumed { execution_id: String },

    /// A workflow execution was stopped
    ExecutionStopped { execution_id: String },

    /// A node in the workflow started execution
    NodeStarted {
        execution_id: String,
        node_id: String,
    },

    /// A node in the workflow completed
    NodeCompleted {
        execution_id: String,
        node_id: String,
        output: Option<serde_json::Value>,
    },

    /// A node in the workflow failed
    NodeFailed {
        execution_id: String,
        node_id: String,
        error: String,
    },

    /// Execution progress update
    ExecutionProgress {
        execution_id: String,
        progress: f32,
        current_node: Option<String>,
        message: Option<String>,
    },

    // =========================================================================
    // Agent Events
    // =========================================================================
    /// An agent was spawned
    AgentSpawned { agent: AgentRuntimeState },

    /// An agent was updated
    AgentUpdated { agent: AgentRuntimeState },

    /// An agent was removed
    AgentRemoved { agent_id: String },

    /// An agent started a task
    AgentTaskStarted {
        agent_id: String,
        task_description: String,
    },

    /// An agent completed a task
    AgentTaskCompleted {
        agent_id: String,
        result: Option<String>,
    },

    /// An agent task failed
    AgentTaskFailed { agent_id: String, error: String },

    /// An agent step started
    AgentStepStarted {
        agent_id: String,
        step_number: u32,
        step_type: String,
        description: String,
    },

    /// An agent step completed
    AgentStepCompleted {
        agent_id: String,
        step_number: u32,
        output: Option<serde_json::Value>,
    },

    /// Agent stream chunk (for real-time output)
    AgentStreamChunk {
        agent_id: String,
        content: String,
        is_final: bool,
    },

    // =========================================================================
    // Approval Events
    // =========================================================================
    /// An approval was requested
    ApprovalRequested { approval: PendingApproval },

    /// An approval was granted
    ApprovalGranted {
        approval_id: String,
        decision: SupervisorDecision,
    },

    /// An approval was denied
    ApprovalDenied {
        approval_id: String,
        decision: SupervisorDecision,
    },

    /// An approval was modified
    ApprovalModified {
        approval_id: String,
        decision: SupervisorDecision,
    },

    /// An approval timed out
    ApprovalTimeout { approval_id: String },

    // =========================================================================
    // System Events
    // =========================================================================
    /// Factory system initialized
    Initialized,

    /// Error occurred
    Error {
        code: String,
        message: String,
        details: Option<serde_json::Value>,
    },

    /// Warning
    Warning { message: String },

    /// Info message
    Info { message: String },
}

impl FactoryEvent {
    // =========================================================================
    // Workflow Event Constructors
    // =========================================================================

    pub fn workflow_created(workflow: Workflow) -> Self {
        Self::WorkflowCreated { workflow }
    }

    pub fn workflow_updated(workflow: Workflow) -> Self {
        Self::WorkflowUpdated { workflow }
    }

    pub fn workflow_deleted(workflow_id: String) -> Self {
        Self::WorkflowDeleted { workflow_id }
    }

    // =========================================================================
    // Execution Event Constructors
    // =========================================================================

    pub fn execution_started(execution: ExecutionState) -> Self {
        Self::ExecutionStarted { execution }
    }

    pub fn execution_completed(execution: ExecutionState) -> Self {
        Self::ExecutionCompleted { execution }
    }

    pub fn execution_failed(execution_id: String, error: String) -> Self {
        Self::ExecutionFailed {
            execution_id,
            error,
        }
    }

    pub fn execution_paused(execution_id: String) -> Self {
        Self::ExecutionPaused { execution_id }
    }

    pub fn execution_resumed(execution_id: String) -> Self {
        Self::ExecutionResumed { execution_id }
    }

    pub fn execution_stopped(execution_id: String) -> Self {
        Self::ExecutionStopped { execution_id }
    }

    pub fn node_started(execution_id: String, node_id: String) -> Self {
        Self::NodeStarted {
            execution_id,
            node_id,
        }
    }

    pub fn node_completed(
        execution_id: String,
        node_id: String,
        output: Option<serde_json::Value>,
    ) -> Self {
        Self::NodeCompleted {
            execution_id,
            node_id,
            output,
        }
    }

    pub fn node_failed(execution_id: String, node_id: String, error: String) -> Self {
        Self::NodeFailed {
            execution_id,
            node_id,
            error,
        }
    }

    pub fn execution_progress(
        execution_id: String,
        progress: f32,
        current_node: Option<String>,
        message: Option<String>,
    ) -> Self {
        Self::ExecutionProgress {
            execution_id,
            progress,
            current_node,
            message,
        }
    }

    // =========================================================================
    // Agent Event Constructors
    // =========================================================================

    pub fn agent_spawned(agent: AgentRuntimeState) -> Self {
        Self::AgentSpawned { agent }
    }

    pub fn agent_updated(agent: AgentRuntimeState) -> Self {
        Self::AgentUpdated { agent }
    }

    pub fn agent_removed(agent_id: String) -> Self {
        Self::AgentRemoved { agent_id }
    }

    pub fn agent_task_started(agent_id: String, task_description: String) -> Self {
        Self::AgentTaskStarted {
            agent_id,
            task_description,
        }
    }

    pub fn agent_task_completed(agent_id: String, result: Option<String>) -> Self {
        Self::AgentTaskCompleted { agent_id, result }
    }

    pub fn agent_task_failed(agent_id: String, error: String) -> Self {
        Self::AgentTaskFailed { agent_id, error }
    }

    pub fn agent_step_started(
        agent_id: String,
        step_number: u32,
        step_type: String,
        description: String,
    ) -> Self {
        Self::AgentStepStarted {
            agent_id,
            step_number,
            step_type,
            description,
        }
    }

    pub fn agent_step_completed(
        agent_id: String,
        step_number: u32,
        output: Option<serde_json::Value>,
    ) -> Self {
        Self::AgentStepCompleted {
            agent_id,
            step_number,
            output,
        }
    }

    pub fn agent_stream_chunk(agent_id: String, content: String, is_final: bool) -> Self {
        Self::AgentStreamChunk {
            agent_id,
            content,
            is_final,
        }
    }

    // =========================================================================
    // Approval Event Constructors
    // =========================================================================

    pub fn approval_requested(approval: PendingApproval) -> Self {
        Self::ApprovalRequested { approval }
    }

    pub fn approval_granted(approval_id: String, decision: SupervisorDecision) -> Self {
        Self::ApprovalGranted {
            approval_id,
            decision,
        }
    }

    pub fn approval_denied(approval_id: String, decision: SupervisorDecision) -> Self {
        Self::ApprovalDenied {
            approval_id,
            decision,
        }
    }

    pub fn approval_modified(approval_id: String, decision: SupervisorDecision) -> Self {
        Self::ApprovalModified {
            approval_id,
            decision,
        }
    }

    pub fn approval_timeout(approval_id: String) -> Self {
        Self::ApprovalTimeout { approval_id }
    }

    // =========================================================================
    // System Event Constructors
    // =========================================================================

    pub fn initialized() -> Self {
        Self::Initialized
    }

    pub fn error(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Error {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn error_with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: serde_json::Value,
    ) -> Self {
        Self::Error {
            code: code.into(),
            message: message.into(),
            details: Some(details),
        }
    }

    pub fn warning(message: impl Into<String>) -> Self {
        Self::Warning {
            message: message.into(),
        }
    }

    pub fn info(message: impl Into<String>) -> Self {
        Self::Info {
            message: message.into(),
        }
    }
}
