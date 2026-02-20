//! Action execution for workflow nodes
//!
//! Contains methods for executing various action types like shell commands,
//! file operations, HTTP requests, AI calls, tool execution, and notifications.

use crate::factory::types::{ActionType, ExecutionState, WorkflowNode};

use super::WorkflowExecutor;
use super::helpers::{
    execute_ai_call, execute_http_request, execute_shell_command, execute_tool, send_notification,
    substitute_variables,
};

impl WorkflowExecutor {
    /// Execute an action node - Real implementations
    pub(super) async fn execute_action(
        &self,
        action_type: &ActionType,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        match action_type {
            ActionType::Shell => self.execute_shell_action(node, execution).await,
            ActionType::ReadFile => self.execute_read_file_action(node, execution).await,
            ActionType::WriteFile => self.execute_write_file_action(node, execution).await,
            ActionType::DeleteFile => self.execute_delete_file_action(node, execution).await,
            ActionType::HttpRequest => self.execute_http_request_action(node, execution).await,
            ActionType::AiCall => self.execute_ai_call_action(node, execution).await,
            ActionType::Tool => self.execute_tool_action(node, execution).await,
            ActionType::Notify => self.execute_notify_action(node, execution).await,
            ActionType::Custom => self.execute_custom_action(node).await,
        }
    }

    /// Execute a shell command action
    async fn execute_shell_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let command = node
            .config
            .get("command")
            .and_then(|v| v.as_str())
            .ok_or("Shell action requires 'command' in config")?;

        let cwd = node.config.get("cwd").and_then(|v| v.as_str());

        let timeout_ms = node
            .config
            .get("timeout")
            .and_then(|v| v.as_u64())
            .unwrap_or(30000);

        // Execute the shell command
        let output = execute_shell_command(command, cwd, timeout_ms).await?;

        // Store output in variables for next nodes
        execution.variables.insert(
            format!("{}_stdout", node.id),
            serde_json::Value::String(output.stdout.clone()),
        );
        execution.variables.insert(
            format!("{}_stderr", node.id),
            serde_json::Value::String(output.stderr.clone()),
        );
        execution.variables.insert(
            format!("{}_exit_code", node.id),
            serde_json::Value::Number(output.exit_code.into()),
        );

        Ok(serde_json::json!({
            "action": "shell",
            "command": command,
            "status": if output.exit_code == 0 { "success" } else { "failed" },
            "exit_code": output.exit_code,
            "stdout": output.stdout,
            "stderr": output.stderr,
            "duration_ms": output.duration_ms
        }))
    }

    /// Execute a read file action
    async fn execute_read_file_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let path = node
            .config
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("ReadFile action requires 'path' in config")?;

        // Substitute variables in path
        let resolved_path = substitute_variables(path, &execution.variables);

        // Read the file
        let content = tokio::fs::read_to_string(&resolved_path)
            .await
            .map_err(|e| format!("Failed to read file '{}': {}", resolved_path, e))?;

        let file_size = content.len();

        // Store content in variables
        execution.variables.insert(
            format!("{}_content", node.id),
            serde_json::Value::String(content.clone()),
        );

        Ok(serde_json::json!({
            "action": "read_file",
            "path": resolved_path,
            "status": "success",
            "content": content,
            "size_bytes": file_size
        }))
    }

    /// Execute a write file action
    async fn execute_write_file_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let path = node
            .config
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("WriteFile action requires 'path' in config")?;

        let content = node
            .config
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Substitute variables
        let resolved_path = substitute_variables(path, &execution.variables);
        let resolved_content = substitute_variables(content, &execution.variables);

        // Create parent directories if needed
        if let Some(parent) = std::path::Path::new(&resolved_path).parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }

        // Write the file
        tokio::fs::write(&resolved_path, &resolved_content)
            .await
            .map_err(|e| format!("Failed to write file '{}': {}", resolved_path, e))?;

        Ok(serde_json::json!({
            "action": "write_file",
            "path": resolved_path,
            "status": "success",
            "bytes_written": resolved_content.len()
        }))
    }

    /// Execute a delete file action
    async fn execute_delete_file_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let path = node
            .config
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("DeleteFile action requires 'path' in config")?;

        let resolved_path = substitute_variables(path, &execution.variables);

        // Check if it's a file or directory
        let metadata = tokio::fs::metadata(&resolved_path)
            .await
            .map_err(|e| format!("Path not found '{}': {}", resolved_path, e))?;

        if metadata.is_dir() {
            tokio::fs::remove_dir_all(&resolved_path)
                .await
                .map_err(|e| format!("Failed to delete directory '{}': {}", resolved_path, e))?;
        } else {
            tokio::fs::remove_file(&resolved_path)
                .await
                .map_err(|e| format!("Failed to delete file '{}': {}", resolved_path, e))?;
        }

        Ok(serde_json::json!({
            "action": "delete_file",
            "path": resolved_path,
            "status": "success",
            "was_directory": metadata.is_dir()
        }))
    }

    /// Execute an HTTP request action
    async fn execute_http_request_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let url = node
            .config
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or("HttpRequest action requires 'url' in config")?;

        let method = node
            .config
            .get("method")
            .and_then(|v| v.as_str())
            .unwrap_or("GET");

        let headers = node
            .config
            .get("headers")
            .cloned()
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        let body = node
            .config
            .get("body")
            .and_then(|v| v.as_str())
            .map(|s| substitute_variables(s, &execution.variables));

        let resolved_url = substitute_variables(url, &execution.variables);

        // Execute HTTP request
        let response =
            execute_http_request(&resolved_url, method, &headers, body.as_deref()).await?;

        // Store response in variables
        execution.variables.insert(
            format!("{}_response_body", node.id),
            serde_json::Value::String(response.body.clone()),
        );
        execution.variables.insert(
            format!("{}_status_code", node.id),
            serde_json::Value::Number(response.status_code.into()),
        );

        Ok(serde_json::json!({
            "action": "http_request",
            "url": resolved_url,
            "method": method,
            "status": if response.status_code >= 200 && response.status_code < 300 { "success" } else { "failed" },
            "status_code": response.status_code,
            "body": response.body,
            "headers": response.headers,
            "duration_ms": response.duration_ms
        }))
    }

    /// Execute an AI call action
    async fn execute_ai_call_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let model = node
            .config
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("gpt-4");

        let prompt = node
            .config
            .get("prompt")
            .and_then(|v| v.as_str())
            .ok_or("AiCall action requires 'prompt' in config")?;

        let system_prompt = node.config.get("system_prompt").and_then(|v| v.as_str());

        let temperature = node
            .config
            .get("temperature")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.7);

        let max_tokens = node
            .config
            .get("max_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(2000) as u32;

        // Substitute variables in prompt
        let resolved_prompt = substitute_variables(prompt, &execution.variables);
        let resolved_system = system_prompt.map(|s| substitute_variables(s, &execution.variables));

        // Execute AI call (uses internal AI provider)
        let response = execute_ai_call(
            model,
            &resolved_prompt,
            resolved_system.as_deref(),
            temperature,
            max_tokens,
        )
        .await?;

        // Store response in variables
        execution.variables.insert(
            format!("{}_response", node.id),
            serde_json::Value::String(response.content.clone()),
        );

        Ok(serde_json::json!({
            "action": "ai_call",
            "model": model,
            "prompt": resolved_prompt,
            "status": "success",
            "response": response.content,
            "tokens_used": response.tokens_used,
            "duration_ms": response.duration_ms
        }))
    }

    /// Execute a tool action
    async fn execute_tool_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let tool_name = node
            .config
            .get("tool_name")
            .and_then(|v| v.as_str())
            .ok_or("Tool action requires 'tool_name' in config")?;

        let tool_input = node
            .config
            .get("input")
            .cloned()
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        // Execute tool (MCP/ACP tools integration)
        let result = execute_tool(tool_name, &tool_input, &execution.variables).await?;

        // Store result in variables
        execution
            .variables
            .insert(format!("{}_result", node.id), result.clone());

        Ok(serde_json::json!({
            "action": "tool",
            "tool_name": tool_name,
            "status": "success",
            "result": result
        }))
    }

    /// Execute a notify action
    async fn execute_notify_action(
        &self,
        node: &WorkflowNode,
        execution: &mut ExecutionState,
    ) -> Result<serde_json::Value, String> {
        let message = node
            .config
            .get("message")
            .and_then(|v| v.as_str())
            .ok_or("Notify action requires 'message' in config")?;

        let title = node
            .config
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Workflow Notification");

        let channel = node
            .config
            .get("channel")
            .and_then(|v| v.as_str())
            .unwrap_or("default");

        let resolved_message = substitute_variables(message, &execution.variables);
        let resolved_title = substitute_variables(title, &execution.variables);

        // Send notification (system notification)
        send_notification(&resolved_title, &resolved_message, channel).await?;

        Ok(serde_json::json!({
            "action": "notify",
            "title": resolved_title,
            "message": resolved_message,
            "channel": channel,
            "status": "sent"
        }))
    }

    /// Execute a custom action
    async fn execute_custom_action(
        &self,
        node: &WorkflowNode,
    ) -> Result<serde_json::Value, String> {
        let custom_type = node
            .config
            .get("custom_type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        let custom_config = node
            .config
            .get("custom_config")
            .cloned()
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        // Custom actions can be extended by plugins
        Ok(serde_json::json!({
            "action": "custom",
            "custom_type": custom_type,
            "config": custom_config,
            "status": "executed"
        }))
    }
}
