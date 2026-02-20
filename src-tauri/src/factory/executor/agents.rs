//! Agent-related execution for workflow nodes
//!
//! Contains methods for executing agent nodes, sub-workflows, and approval nodes.

use crate::factory::types::{ExecutionState, ExecutionStatus, WorkflowNode};

use super::WorkflowExecutor;

impl WorkflowExecutor {
    /// Execute an agent node
    pub(super) async fn execute_agent(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let agent_id = node.config.get("agent_id").and_then(|v| v.as_str());
        let prompt = node.config.get("prompt").and_then(|v| v.as_str());

        // In a real implementation, this would spawn and run an agent
        let result_agent_id = agent_id
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("agent_{}", node.id));

        execution.spawned_agents.push(result_agent_id.clone());

        Ok(serde_json::json!({
            "agent_id": result_agent_id,
            "prompt": prompt,
            "status": "spawned"
        }))
    }

    /// Execute a sub-workflow node
    pub(super) async fn execute_sub_workflow(
        &self,
        node: &WorkflowNode,
        _execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let workflow_id = node
            .config
            .get("workflow_id")
            .and_then(|v| v.as_str())
            .ok_or("SubWorkflow node requires 'workflow_id' in config")?;

        // In a real implementation, this would execute the sub-workflow
        Ok(serde_json::json!({
            "sub_workflow_id": workflow_id,
            "status": "executed"
        }))
    }

    /// Execute an approval node
    pub(super) async fn execute_approval(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let approval_id = format!("approval_{}_{}", execution.id, node.id);

        // Add pending approval
        execution.pending_approvals.push(approval_id.clone());

        // Update status to waiting
        execution.status = ExecutionStatus::WaitingApproval;

        Ok(serde_json::json!({
            "approval_id": approval_id,
            "status": "waiting"
        }))
    }
}
