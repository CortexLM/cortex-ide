//! Workflow Execution Engine
//!
//! Handles the execution of workflow nodes and manages execution state.
//! Provides real implementations for shell commands, file operations, HTTP requests, and AI calls.

mod actions;
mod agents;
mod control_flow;
pub mod helpers;
mod triggers;
pub mod types;

use std::collections::HashMap;

use crate::factory::types::{
    ExecutionState, ExecutionStatus, NodeExecutionResult, NodeType, Workflow, WorkflowNode,
};

use helpers::now_ms;

/// Workflow execution engine
pub struct WorkflowExecutor {
    /// Active cancellation tokens by execution ID
    cancellation_tokens: HashMap<String, tokio::sync::watch::Sender<bool>>,
}

impl WorkflowExecutor {
    pub fn new() -> Self {
        Self {
            cancellation_tokens: HashMap::new(),
        }
    }

    /// Execute a workflow
    pub async fn execute(
        &mut self,
        workflow: &Workflow,
        execution: &mut ExecutionState,
    ) -> Result<(), String> {
        // Create cancellation token
        let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
        self.cancellation_tokens
            .insert(execution.id.clone(), cancel_tx);

        // Find start nodes (triggers)
        let start_nodes = self.find_start_nodes(workflow);
        if start_nodes.is_empty() {
            return Err("No start node found in workflow".to_string());
        }

        // Execute nodes starting from triggers
        for start_node in start_nodes {
            if *cancel_rx.borrow() {
                execution.status = ExecutionStatus::Cancelled;
                return Ok(());
            }

            self.execute_node(workflow, &start_node, execution, cancel_rx.clone())
                .await?;
        }

        // Clean up
        self.cancellation_tokens.remove(&execution.id);

        // Update final status
        if execution.status == ExecutionStatus::Running {
            execution.status = ExecutionStatus::Completed;
            execution.completed_at = Some(now_ms());
        }

        Ok(())
    }

    /// Cancel an execution
    pub fn cancel(&mut self, execution_id: &str) -> bool {
        if let Some(tx) = self.cancellation_tokens.get(execution_id) {
            let _ = tx.send(true);
            true
        } else {
            false
        }
    }

    /// Find start nodes (triggers) in a workflow
    fn find_start_nodes(&self, workflow: &Workflow) -> Vec<WorkflowNode> {
        workflow
            .nodes
            .iter()
            .filter(|n| matches!(n.node_type, NodeType::Trigger(_)))
            .cloned()
            .collect()
    }

    /// Find nodes connected to the output of a given node
    pub(crate) fn find_next_nodes(&self, workflow: &Workflow, node_id: &str) -> Vec<WorkflowNode> {
        let outgoing_edges: Vec<_> = workflow
            .edges
            .iter()
            .filter(|e| e.source == node_id)
            .collect();

        outgoing_edges
            .iter()
            .filter_map(|e| workflow.nodes.iter().find(|n| n.id == e.target))
            .cloned()
            .collect()
    }

    /// Execute a single node
    fn execute_node<'a>(
        &'a mut self,
        workflow: &'a Workflow,
        node: &'a WorkflowNode,
        execution: &'a mut ExecutionState,
        cancel_rx: tokio::sync::watch::Receiver<bool>,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<serde_json::Value, String>> + Send + 'a>,
    > {
        Box::pin(async move {
            // Check for cancellation
            if *cancel_rx.borrow() {
                execution.status = ExecutionStatus::Cancelled;
                return Err("Execution cancelled".to_string());
            }

            // Skip disabled nodes
            if node.disabled {
                return Ok(serde_json::Value::Null);
            }

            // Update current node
            execution.current_node = Some(node.id.clone());

            // Create node execution result
            let mut node_result = NodeExecutionResult {
                node_id: node.id.clone(),
                status: ExecutionStatus::Running,
                started_at: now_ms(),
                completed_at: None,
                output: None,
                error: None,
                retries: 0,
            };

            // Execute based on node type
            let result = match &node.node_type {
                NodeType::Trigger(trigger_type) => {
                    self.execute_trigger(trigger_type, node, execution).await
                }
                NodeType::Action(action_type) => {
                    self.execute_action(action_type, node, execution).await
                }
                NodeType::Condition => self.execute_condition(node, execution).await,
                NodeType::ParallelSplit => {
                    self.execute_parallel_split(workflow, node, execution, cancel_rx.clone())
                        .await
                }
                NodeType::ParallelJoin => Ok(serde_json::Value::Null), // Handled by parallel split
                NodeType::Loop => {
                    self.execute_loop(workflow, node, execution, cancel_rx.clone())
                        .await
                }
                NodeType::Delay => self.execute_delay(node).await,
                NodeType::Transform => self.execute_transform(node, execution).await,
                NodeType::Agent => self.execute_agent(node, execution).await,
                NodeType::SubWorkflow => self.execute_sub_workflow(node, execution).await,
                NodeType::Approval => self.execute_approval(node, execution).await,
                NodeType::End => Ok(serde_json::Value::Null),
                NodeType::Note => Ok(serde_json::Value::Null),
            };

            // Update node result
            match &result {
                Ok(output) => {
                    node_result.status = ExecutionStatus::Completed;
                    node_result.output = Some(output.clone());
                }
                Err(e) => {
                    node_result.status = ExecutionStatus::Failed;
                    node_result.error = Some(e.clone());
                }
            }
            node_result.completed_at = Some(now_ms());

            execution.executed_nodes.push(node_result);

            // If successful and not an end node, continue to next nodes
            if result.is_ok() && !matches!(node.node_type, NodeType::End) {
                let next_nodes = self.find_next_nodes(workflow, &node.id);
                for next_node in next_nodes {
                    self.execute_node(workflow, &next_node, execution, cancel_rx.clone())
                        .await?;
                }
            }

            result
        })
    }
}

impl Default for WorkflowExecutor {
    fn default() -> Self {
        Self::new()
    }
}
