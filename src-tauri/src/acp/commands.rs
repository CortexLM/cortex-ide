//! ACP Tauri Commands
//!
//! Tauri command handlers for ACP tool operations.

use tauri::{AppHandle, Emitter, State};

use super::ACPState;
use super::executor::execute_tool;
use super::types::{
    ACPTool, ToolExecutionResult, ToolPermissionRequest, ToolSandboxConfig, ToolUpdate,
};

// =====================
// Tool Registry Commands
// =====================

/// List all registered tools
#[tauri::command]
pub async fn acp_list_tools(state: State<'_, ACPState>) -> Result<Vec<ACPTool>, String> {
    let manager = state.0.lock().await;
    Ok(manager.list_tools())
}

/// Get a specific tool by ID
#[tauri::command]
pub async fn acp_get_tool(
    state: State<'_, ACPState>,
    tool_id: String,
) -> Result<Option<ACPTool>, String> {
    let manager = state.0.lock().await;
    Ok(manager.get_tool(&tool_id).cloned())
}

/// Get a tool by name
#[tauri::command]
pub async fn acp_get_tool_by_name(
    state: State<'_, ACPState>,
    name: String,
) -> Result<Option<ACPTool>, String> {
    let manager = state.0.lock().await;
    Ok(manager.get_tool_by_name(&name).cloned())
}

/// Search tools by query
#[tauri::command]
pub async fn acp_search_tools(
    state: State<'_, ACPState>,
    query: String,
) -> Result<Vec<ACPTool>, String> {
    let manager = state.0.lock().await;
    Ok(manager.search_tools(&query))
}

/// Register a new tool
#[tauri::command]
pub async fn acp_register_tool(
    state: State<'_, ACPState>,
    tool: ACPTool,
) -> Result<String, String> {
    let mut manager = state.0.lock().await;
    Ok(manager.register_tool(tool))
}

/// Unregister a tool
#[tauri::command]
pub async fn acp_unregister_tool(
    state: State<'_, ACPState>,
    tool_id: String,
) -> Result<bool, String> {
    let mut manager = state.0.lock().await;
    Ok(manager.unregister_tool(&tool_id))
}

/// Update a tool
#[tauri::command]
pub async fn acp_update_tool(
    state: State<'_, ACPState>,
    tool_id: String,
    updates: ToolUpdate,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;
    manager.update_tool(&tool_id, updates)
}

// =====================
// Tool Execution Commands
// =====================

/// Execute a tool
#[tauri::command]
pub async fn acp_execute_tool(
    app: AppHandle,
    state: State<'_, ACPState>,
    execution_id: String,
    tool_id: String,
    arguments: serde_json::Value,
    timeout: Option<u64>,
    sandbox_config: Option<ToolSandboxConfig>,
) -> Result<ToolExecutionResult, String> {
    let (tool, config) = {
        let manager = state.0.lock().await;

        let tool = manager
            .get_tool(&tool_id)
            .ok_or_else(|| format!("Tool not found: {}", tool_id))?
            .clone();

        if !tool.enabled {
            return Err(format!("Tool is disabled: {}", tool.name));
        }

        let mut config = sandbox_config.unwrap_or_else(|| manager.get_sandbox_config().clone());
        if let Some(t) = timeout {
            config.timeout = t;
        }

        (tool, config)
    };

    // Execute the tool
    let result = execute_tool(&tool, arguments, &config, &execution_id).await;

    // Store the result
    {
        let mut manager = state.0.lock().await;
        manager.store_execution(result.clone());
    }

    // Emit completion event
    let _ = app.emit(
        "acp:execution_complete",
        &serde_json::json!({
            "executionId": execution_id,
            "result": result
        }),
    );

    Ok(result)
}

/// Cancel a running execution
#[tauri::command]
pub async fn acp_cancel_execution(
    state: State<'_, ACPState>,
    execution_id: String,
) -> Result<bool, String> {
    let manager = state.0.lock().await;

    if let Some(execution_lock) = manager.get_execution(&execution_id) {
        let mut execution = execution_lock.write().await;
        if execution.status == super::types::ToolExecutionStatus::Running {
            *execution = execution.clone().cancelled();
            return Ok(true);
        }
    }

    Ok(false)
}

/// Get an execution result
#[tauri::command]
pub async fn acp_get_execution(
    state: State<'_, ACPState>,
    execution_id: String,
) -> Result<Option<ToolExecutionResult>, String> {
    let manager = state.0.lock().await;

    if let Some(execution_lock) = manager.get_execution(&execution_id) {
        let execution = execution_lock.read().await;
        return Ok(Some(execution.clone()));
    }

    Ok(None)
}

// =====================
// Permission Commands
// =====================

/// Request permission for a tool
#[tauri::command]
pub async fn acp_request_permission(
    app: AppHandle,
    request: ToolPermissionRequest,
) -> Result<bool, String> {
    // Emit permission request event for UI to handle
    let _ = app.emit("acp:permission_request", &request);

    // In a real implementation, this would wait for user response
    // For now, we'll auto-approve read permissions
    let auto_approve = request
        .permissions
        .iter()
        .all(|p| matches!(p, super::types::ToolPermission::Read));

    Ok(auto_approve)
}

// =====================
// Sandbox Configuration Commands
// =====================

/// Get sandbox configuration
#[tauri::command]
pub async fn acp_get_sandbox_config(
    state: State<'_, ACPState>,
) -> Result<ToolSandboxConfig, String> {
    let manager = state.0.lock().await;
    Ok(manager.get_sandbox_config().clone())
}

/// Update sandbox configuration
#[tauri::command]
pub async fn acp_update_sandbox_config(
    state: State<'_, ACPState>,
    config: ToolSandboxConfig,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;
    manager.update_sandbox_config(config);
    Ok(())
}

// =====================
// AI Integration Commands
// =====================

/// Get tools formatted for AI consumption
#[tauri::command]
pub async fn acp_get_tools_for_ai(
    state: State<'_, ACPState>,
) -> Result<Vec<serde_json::Value>, String> {
    let manager = state.0.lock().await;

    let tools: Vec<serde_json::Value> = manager
        .list_tools()
        .into_iter()
        .filter(|t| t.enabled)
        .map(|t| {
            serde_json::json!({
                "name": t.name,
                "description": t.description.unwrap_or_else(|| format!("Execute the {} tool", t.name)),
                "parameters": t.input_schema
            })
        })
        .collect();

    Ok(tools)
}

/// Handle an AI tool call
#[tauri::command]
pub async fn acp_handle_ai_tool_call(
    app: AppHandle,
    state: State<'_, ACPState>,
    name: String,
    arguments: serde_json::Value,
) -> Result<String, String> {
    // Find tool by name
    let tool = {
        let manager = state.0.lock().await;
        manager.get_tool_by_name(&name).cloned()
    };

    let tool = match tool {
        Some(t) => t,
        None => {
            return Ok(
                serde_json::json!({ "error": format!("Unknown tool: {}", name) }).to_string(),
            );
        }
    };

    // Generate execution ID
    let execution_id = format!(
        "ai_{}_{}_{}",
        name,
        chrono::Utc::now().timestamp_millis(),
        rand::random::<u32>()
    );

    // Execute tool
    let result = acp_execute_tool(app, state, execution_id, tool.id, arguments, None, None).await?;

    // Format result for AI
    if result.is_error {
        let error_msg = result
            .content
            .iter()
            .find_map(|c| {
                if let super::types::ToolResultContent::Error { message, .. } = c {
                    Some(message.clone())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| "Tool execution failed".to_string());

        Ok(serde_json::json!({ "error": error_msg }).to_string())
    } else {
        let text_content: String = result
            .content
            .iter()
            .filter_map(|c| match c {
                super::types::ToolResultContent::Text { text } => Some(text.clone()),
                super::types::ToolResultContent::Json { data } => {
                    serde_json::to_string_pretty(data).ok()
                }
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n");

        if text_content.is_empty() {
            Ok(serde_json::json!({ "success": true }).to_string())
        } else {
            Ok(text_content)
        }
    }
}
