//! Agent Factory Tauri Commands
//!
//! Tauri command handlers for the Agent Factory system.

use tauri::{AppHandle, Emitter, State};

use super::FactoryState;
use super::events::FactoryEvent;
use super::types::{
    AgentRuntimeState, AuditEntry, AuditFilter, DecisionAction, ExecutionState, PendingApproval,
    SupervisorDecision, Workflow, WorkflowExport,
};

// =============================================================================
// Workflow Management Commands
// =============================================================================

/// Create a new workflow
#[tauri::command]
pub async fn factory_create_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    workflow: Workflow,
) -> Result<Workflow, String> {
    let mut manager = state.0.lock().await;
    let id = manager.create_workflow(workflow.clone());

    let created = manager
        .get_workflow(&id)
        .cloned()
        .ok_or("Failed to create workflow")?;

    // Log audit entry
    manager.audit_mut().log(
        "workflow_created",
        "system",
        Some(&id),
        &format!("Created workflow: {}", created.name),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::workflow_created(created.clone()),
    );

    Ok(created)
}

/// Update an existing workflow
#[tauri::command]
pub async fn factory_update_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    workflow: Workflow,
) -> Result<Workflow, String> {
    let mut manager = state.0.lock().await;
    let id = workflow.id.clone();

    manager.update_workflow(workflow)?;

    let updated = manager
        .get_workflow(&id)
        .cloned()
        .ok_or("Failed to get updated workflow")?;

    // Log audit entry
    manager.audit_mut().log(
        "workflow_updated",
        "system",
        Some(&id),
        &format!("Updated workflow: {}", updated.name),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::workflow_updated(updated.clone()),
    );

    Ok(updated)
}

/// Delete a workflow
#[tauri::command]
pub async fn factory_delete_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    workflow_id: String,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;
    let workflow = manager.delete_workflow(&workflow_id)?;

    // Log audit entry
    manager.audit_mut().log(
        "workflow_deleted",
        "system",
        Some(&workflow_id),
        &format!("Deleted workflow: {}", workflow.name),
        None,
    );

    // Emit event
    let _ = app.emit("factory:event", FactoryEvent::workflow_deleted(workflow_id));

    Ok(())
}

/// List all workflows
#[tauri::command]
pub async fn factory_list_workflows(
    state: State<'_, FactoryState>,
) -> Result<Vec<Workflow>, String> {
    let manager = state.0.lock().await;
    Ok(manager.list_workflows().into_iter().cloned().collect())
}

/// Get a specific workflow by ID
#[tauri::command]
pub async fn factory_get_workflow(
    state: State<'_, FactoryState>,
    workflow_id: String,
) -> Result<Option<Workflow>, String> {
    let manager = state.0.lock().await;
    Ok(manager.get_workflow(&workflow_id).cloned())
}

/// Export a workflow to JSON
#[tauri::command]
pub async fn factory_export_workflow(
    state: State<'_, FactoryState>,
    workflow_id: String,
) -> Result<WorkflowExport, String> {
    let manager = state.0.lock().await;
    let workflow = manager
        .get_workflow(&workflow_id)
        .cloned()
        .ok_or_else(|| format!("Workflow not found: {}", workflow_id))?;

    let export = WorkflowExport::new(workflow);
    Ok(export)
}

/// Import a workflow from JSON
#[tauri::command]
pub async fn factory_import_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    export: WorkflowExport,
) -> Result<Workflow, String> {
    let mut manager = state.0.lock().await;

    // Create a new workflow from the export
    let mut workflow = export.workflow;
    workflow.id = String::new(); // Clear ID to generate a new one
    let id = manager.create_workflow(workflow);

    let created = manager
        .get_workflow(&id)
        .cloned()
        .ok_or("Failed to import workflow")?;

    // Log audit entry
    manager.audit_mut().log(
        "workflow_imported",
        "system",
        Some(&id),
        &format!("Imported workflow: {}", created.name),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::workflow_created(created.clone()),
    );

    Ok(created)
}

// =============================================================================
// Workflow Execution Commands
// =============================================================================

/// Start executing a workflow
#[tauri::command]
pub async fn factory_start_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    workflow_id: String,
    variables: Option<std::collections::HashMap<String, serde_json::Value>>,
) -> Result<ExecutionState, String> {
    let mut manager = state.0.lock().await;

    // Get the workflow
    let workflow = manager
        .get_workflow(&workflow_id)
        .cloned()
        .ok_or_else(|| format!("Workflow not found: {}", workflow_id))?;

    // Create execution state
    let execution_id = manager.generate_id("exec");
    let execution = ExecutionState {
        id: execution_id.clone(),
        workflow_id: workflow_id.clone(),
        status: super::types::ExecutionStatus::Running,
        started_at: now_ms(),
        completed_at: None,
        current_node: None,
        executed_nodes: Vec::new(),
        variables: variables.unwrap_or_default(),
        error: None,
        spawned_agents: Vec::new(),
        pending_approvals: Vec::new(),
    };

    manager.store_execution(execution.clone());

    // Log audit entry
    manager.audit_mut().log(
        "workflow_started",
        "system",
        Some(&workflow_id),
        &format!(
            "Started workflow: {} (execution: {})",
            workflow.name, execution_id
        ),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::execution_started(execution.clone()),
    );

    Ok(execution)
}

/// Stop a running workflow execution
#[tauri::command]
pub async fn factory_stop_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    execution_id: String,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;

    let execution_arc = manager
        .get_execution(&execution_id)
        .ok_or_else(|| format!("Execution not found: {}", execution_id))?;

    {
        let mut execution = execution_arc.write().await;
        execution.status = super::types::ExecutionStatus::Cancelled;
        execution.completed_at = Some(now_ms());
    }

    // Log audit entry
    manager.audit_mut().log(
        "workflow_stopped",
        "system",
        Some(&execution_id),
        &format!("Stopped workflow execution: {}", execution_id),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::execution_stopped(execution_id),
    );

    Ok(())
}

/// Pause a running workflow execution
#[tauri::command]
pub async fn factory_pause_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    execution_id: String,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;

    let execution_arc = manager
        .get_execution(&execution_id)
        .ok_or_else(|| format!("Execution not found: {}", execution_id))?;

    {
        let mut execution = execution_arc.write().await;
        if execution.status != super::types::ExecutionStatus::Running {
            return Err("Workflow is not running".to_string());
        }
        execution.status = super::types::ExecutionStatus::Paused;
    }

    // Log audit entry
    manager.audit_mut().log(
        "workflow_paused",
        "system",
        Some(&execution_id),
        &format!("Paused workflow execution: {}", execution_id),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::execution_paused(execution_id),
    );

    Ok(())
}

/// Resume a paused workflow execution
#[tauri::command]
pub async fn factory_resume_workflow(
    app: AppHandle,
    state: State<'_, FactoryState>,
    execution_id: String,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;

    let execution_arc = manager
        .get_execution(&execution_id)
        .ok_or_else(|| format!("Execution not found: {}", execution_id))?;

    {
        let mut execution = execution_arc.write().await;
        if execution.status != super::types::ExecutionStatus::Paused {
            return Err("Workflow is not paused".to_string());
        }
        execution.status = super::types::ExecutionStatus::Running;
    }

    // Log audit entry
    manager.audit_mut().log(
        "workflow_resumed",
        "system",
        Some(&execution_id),
        &format!("Resumed workflow execution: {}", execution_id),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::execution_resumed(execution_id),
    );

    Ok(())
}

/// Get the current state of an execution
#[tauri::command]
pub async fn factory_get_execution_state(
    state: State<'_, FactoryState>,
    execution_id: String,
) -> Result<Option<ExecutionState>, String> {
    let manager = state.0.lock().await;

    if let Some(execution_arc) = manager.get_execution(&execution_id) {
        let execution = execution_arc.read().await;
        return Ok(Some(execution.clone()));
    }

    Ok(None)
}

// =============================================================================
// Agent Management Commands
// =============================================================================

/// List all agents
#[tauri::command]
pub async fn factory_list_agents(
    state: State<'_, FactoryState>,
) -> Result<Vec<AgentRuntimeState>, String> {
    let manager = state.0.lock().await;
    Ok(manager.list_agents().into_iter().cloned().collect())
}

/// Create a new agent
#[tauri::command]
pub async fn factory_create_agent(
    app: AppHandle,
    state: State<'_, FactoryState>,
    agent: AgentRuntimeState,
) -> Result<AgentRuntimeState, String> {
    let mut manager = state.0.lock().await;
    let id = manager.create_agent(agent);

    let created = manager
        .get_agent(&id)
        .cloned()
        .ok_or("Failed to create agent")?;

    // Log audit entry
    manager.audit_mut().log(
        "agent_created",
        "system",
        Some(&id),
        &format!("Created agent: {}", created.name),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::agent_spawned(created.clone()),
    );

    Ok(created)
}

/// Update an existing agent
#[tauri::command]
pub async fn factory_update_agent(
    app: AppHandle,
    state: State<'_, FactoryState>,
    agent: AgentRuntimeState,
) -> Result<AgentRuntimeState, String> {
    let mut manager = state.0.lock().await;
    let id = agent.id.clone();

    manager.update_agent(agent)?;

    let updated = manager
        .get_agent(&id)
        .cloned()
        .ok_or("Failed to get updated agent")?;

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::agent_updated(updated.clone()),
    );

    Ok(updated)
}

/// Delete an agent
#[tauri::command]
pub async fn factory_delete_agent(
    app: AppHandle,
    state: State<'_, FactoryState>,
    agent_id: String,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;
    let agent = manager.delete_agent(&agent_id)?;

    // Log audit entry
    manager.audit_mut().log(
        "agent_deleted",
        "system",
        Some(&agent_id),
        &format!("Deleted agent: {}", agent.name),
        None,
    );

    // Emit event
    let _ = app.emit("factory:event", FactoryEvent::agent_removed(agent_id));

    Ok(())
}

/// Get the current state of an agent
#[tauri::command]
pub async fn factory_get_agent_state(
    state: State<'_, FactoryState>,
    agent_id: String,
) -> Result<Option<AgentRuntimeState>, String> {
    let manager = state.0.lock().await;
    Ok(manager.get_agent(&agent_id).cloned())
}

// =============================================================================
// Approval Management Commands
// =============================================================================

/// List all pending approvals
#[tauri::command]
pub async fn factory_list_pending_approvals(
    state: State<'_, FactoryState>,
) -> Result<Vec<PendingApproval>, String> {
    let manager = state.0.lock().await;
    Ok(manager
        .list_pending_approvals()
        .into_iter()
        .cloned()
        .collect())
}

/// Approve a pending action
#[tauri::command]
pub async fn factory_approve_action(
    app: AppHandle,
    state: State<'_, FactoryState>,
    approval_id: String,
    reason: Option<String>,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;

    let approval = manager
        .get_pending_approval(&approval_id)
        .cloned()
        .ok_or_else(|| format!("Approval not found: {}", approval_id))?;

    // Create decision
    let decision = SupervisorDecision {
        id: manager.generate_id("decision"),
        approval_id: approval_id.clone(),
        action: DecisionAction::Approve,
        reason,
        modified_params: None,
        decided_at: now_ms(),
        decided_by: "user".to_string(),
    };

    // Remove approval and update its status
    manager.remove_pending_approval(&approval_id);

    // Log audit entry
    manager.audit_mut().log(
        "approval_granted",
        "user",
        Some(&approval_id),
        &format!("Approved action: {}", approval.description),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::approval_granted(approval_id, decision),
    );

    Ok(())
}

/// Deny a pending action
#[tauri::command]
pub async fn factory_deny_action(
    app: AppHandle,
    state: State<'_, FactoryState>,
    approval_id: String,
    reason: Option<String>,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;

    let approval = manager
        .get_pending_approval(&approval_id)
        .cloned()
        .ok_or_else(|| format!("Approval not found: {}", approval_id))?;

    // Create decision
    let decision = SupervisorDecision {
        id: manager.generate_id("decision"),
        approval_id: approval_id.clone(),
        action: DecisionAction::Deny,
        reason,
        modified_params: None,
        decided_at: now_ms(),
        decided_by: "user".to_string(),
    };

    // Remove approval
    manager.remove_pending_approval(&approval_id);

    // Log audit entry
    manager.audit_mut().log(
        "approval_denied",
        "user",
        Some(&approval_id),
        &format!("Denied action: {}", approval.description),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::approval_denied(approval_id, decision),
    );

    Ok(())
}

/// Modify and approve a pending action
#[tauri::command]
pub async fn factory_modify_action(
    app: AppHandle,
    state: State<'_, FactoryState>,
    approval_id: String,
    modified_params: serde_json::Value,
    reason: Option<String>,
) -> Result<(), String> {
    let mut manager = state.0.lock().await;

    let approval = manager
        .get_pending_approval(&approval_id)
        .cloned()
        .ok_or_else(|| format!("Approval not found: {}", approval_id))?;

    // Create decision
    let decision = SupervisorDecision {
        id: manager.generate_id("decision"),
        approval_id: approval_id.clone(),
        action: DecisionAction::Modify,
        reason,
        modified_params: Some(modified_params),
        decided_at: now_ms(),
        decided_by: "user".to_string(),
    };

    // Remove approval
    manager.remove_pending_approval(&approval_id);

    // Log audit entry
    manager.audit_mut().log(
        "approval_modified",
        "user",
        Some(&approval_id),
        &format!("Modified and approved action: {}", approval.description),
        None,
    );

    // Emit event
    let _ = app.emit(
        "factory:event",
        FactoryEvent::approval_modified(approval_id, decision),
    );

    Ok(())
}

// =============================================================================
// Audit Log Commands
// =============================================================================

/// Get audit log entries with optional filtering
#[tauri::command]
pub async fn factory_get_audit_log(
    state: State<'_, FactoryState>,
    filter: Option<AuditFilter>,
) -> Result<Vec<AuditEntry>, String> {
    let manager = state.0.lock().await;
    Ok(manager.audit().query(filter.unwrap_or_default()))
}

/// Export audit log to a file
#[tauri::command]
pub async fn factory_export_audit_log(
    state: State<'_, FactoryState>,
    path: String,
    filter: Option<AuditFilter>,
) -> Result<usize, String> {
    let manager = state.0.lock().await;
    manager.audit().export_to_file(&path, filter)
}

/// Get a specific audit entry by ID
#[tauri::command]
pub async fn factory_get_audit_entry(
    state: State<'_, FactoryState>,
    entry_id: String,
) -> Result<Option<AuditEntry>, String> {
    let manager = state.0.lock().await;
    Ok(manager.audit().get_entry(&entry_id).cloned())
}

// =============================================================================
// Utilities
// =============================================================================

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
