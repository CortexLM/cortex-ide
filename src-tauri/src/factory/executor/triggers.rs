//! Trigger execution for workflow nodes
//!
//! Contains methods for executing various trigger types like manual,
//! schedule, webhook, file watch, git events, and custom events.

use crate::factory::types::{ExecutionState, TriggerType, WorkflowNode};

use super::WorkflowExecutor;
use super::helpers::now_ms;

impl WorkflowExecutor {
    /// Execute a trigger node
    pub(super) async fn execute_trigger(
        &self,
        trigger_type: &TriggerType,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        match trigger_type {
            TriggerType::Manual => {
                // Manual triggers just pass through
                Ok(serde_json::json!({
                    "triggered": true,
                    "type": "manual",
                    "timestamp": now_ms()
                }))
            }
            TriggerType::Schedule => {
                // For scheduled triggers, we record the schedule
                let schedule = node.config.get("schedule").cloned();
                Ok(serde_json::json!({
                    "triggered": true,
                    "type": "schedule",
                    "schedule": schedule,
                    "timestamp": now_ms()
                }))
            }
            TriggerType::Webhook => {
                // Webhook triggers pass through the payload
                let payload = execution.variables.get("webhook_payload").cloned();
                Ok(serde_json::json!({
                    "triggered": true,
                    "type": "webhook",
                    "payload": payload,
                    "timestamp": now_ms()
                }))
            }
            TriggerType::FileWatch => {
                let path = node.config.get("path").cloned();
                Ok(serde_json::json!({
                    "triggered": true,
                    "type": "file_watch",
                    "path": path,
                    "timestamp": now_ms()
                }))
            }
            TriggerType::GitEvent => {
                let event = node.config.get("event").cloned();
                Ok(serde_json::json!({
                    "triggered": true,
                    "type": "git_event",
                    "event": event,
                    "timestamp": now_ms()
                }))
            }
            TriggerType::Event => {
                let event_name = node.config.get("event_name").cloned();
                Ok(serde_json::json!({
                    "triggered": true,
                    "type": "event",
                    "event_name": event_name,
                    "timestamp": now_ms()
                }))
            }
        }
    }
}
