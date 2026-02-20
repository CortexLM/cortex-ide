//! Control flow execution for workflow nodes
//!
//! Contains methods for executing control flow nodes like conditions,
//! parallel splits, loops, delays, and transforms.

use crate::factory::types::{ExecutionState, Workflow, WorkflowNode};

use super::WorkflowExecutor;
use super::helpers::evaluate_expression;

impl WorkflowExecutor {
    /// Execute a condition node
    pub(super) async fn execute_condition(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        // Get the condition expression
        let expression = node
            .config
            .get("expression")
            .and_then(|v| v.as_str())
            .ok_or("Condition node requires 'expression' in config")?;

        // Simple variable substitution and evaluation
        // In a real implementation, this would use a proper expression evaluator
        let result = evaluate_expression(expression, &execution.variables);

        Ok(serde_json::json!({
            "condition": expression,
            "result": result
        }))
    }

    /// Execute a parallel split node
    pub(super) async fn execute_parallel_split(
        &mut self,
        workflow: &Workflow,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
        cancel_rx: tokio::sync::watch::Receiver<bool>,
    ) -> Result<serde_json::Value, String> {
        let next_nodes = self.find_next_nodes(workflow, &node.id);

        // Execute branches in parallel (simplified - in a real impl, use tokio::join!)
        let mut results = Vec::new();
        for next_node in next_nodes {
            let result = self
                .execute_node(workflow, &next_node, execution, cancel_rx.clone())
                .await;
            results.push(result);
        }

        Ok(serde_json::json!({
            "parallel_results": results.len()
        }))
    }

    /// Execute a loop node
    pub(super) async fn execute_loop(
        &mut self,
        workflow: &Workflow,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
        cancel_rx: tokio::sync::watch::Receiver<bool>,
    ) -> Result<serde_json::Value, String> {
        let max_iterations = node
            .config
            .get("max_iterations")
            .and_then(|v| v.as_u64())
            .unwrap_or(100) as usize;

        let mut iteration = 0;
        let next_nodes = self.find_next_nodes(workflow, &node.id);

        while iteration < max_iterations {
            if *cancel_rx.borrow() {
                break;
            }

            // Check loop condition if specified
            if let Some(condition) = node.config.get("condition").and_then(|v| v.as_str()) {
                if !evaluate_expression(condition, &execution.variables) {
                    break;
                }
            }

            // Execute loop body
            for next_node in &next_nodes {
                self.execute_node(workflow, next_node, execution, cancel_rx.clone())
                    .await?;
            }

            iteration += 1;
        }

        Ok(serde_json::json!({
            "iterations": iteration
        }))
    }

    /// Execute a delay node
    pub(super) async fn execute_delay(
        &self,
        node: &WorkflowNode,
    ) -> Result<serde_json::Value, String> {
        let delay_ms = node
            .config
            .get("delay_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(1000);

        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;

        Ok(serde_json::json!({
            "delayed_ms": delay_ms
        }))
    }

    /// Execute a transform node
    pub(super) async fn execute_transform(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        // Get transform configuration
        let input_var = node.config.get("input").and_then(|v| v.as_str());
        let output_var = node.config.get("output").and_then(|v| v.as_str());
        let transform = node.config.get("transform").cloned();

        let input_value = input_var
            .and_then(|v| execution.variables.get(v))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        // Apply transform (simplified)
        let output_value = transform.unwrap_or(input_value.clone());

        // Store output
        if let Some(out_var) = output_var {
            execution
                .variables
                .insert(out_var.to_string(), output_value.clone());
        }

        Ok(serde_json::json!({
            "transformed": true,
            "output": output_value
        }))
    }
}
