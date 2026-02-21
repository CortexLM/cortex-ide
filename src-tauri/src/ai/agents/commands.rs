//! Runtime agent Tauri commands

use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

use super::orchestrator::AgentState;
use super::types::{
    AgentStatus, AgentStreamChunk, AgentTask, AgentType, OrchestratorStats, SubAgent,
};

#[tauri::command]
pub async fn agent_spawn(
    app: AppHandle,
    state: State<'_, AgentState>,
    name: String,
    system_prompt: String,
    model: Option<String>,
    parent_id: Option<String>,
    agent_type: Option<String>,
) -> Result<SubAgent, String> {
    let mut o = state.0.lock().await;
    let id = if let Some(t) = agent_type {
        let at = match t.to_lowercase().as_str() {
            "code" => AgentType::Code,
            "research" => AgentType::Research,
            "test" => AgentType::Test,
            "review" => AgentType::Review,
            _ => AgentType::Custom,
        };
        if at == AgentType::Custom {
            o.spawn_agent(
                &name,
                &system_prompt,
                model.as_deref().unwrap_or("gpt-4"),
                parent_id.as_deref(),
            )
        } else {
            o.spawn_specialized_agent(at, model.as_deref(), parent_id.as_deref())
        }
    } else {
        o.spawn_agent(
            &name,
            &system_prompt,
            model.as_deref().unwrap_or("gpt-4"),
            parent_id.as_deref(),
        )
    }
    .map_err(|e| e.to_string())?;
    let a = o.get_agent(&id).cloned().ok_or("Not found")?;
    let _ = app.emit("agent:spawned", serde_json::json!({ "agent": a }));
    Ok(a)
}

#[tauri::command]
pub async fn agent_run_task(
    app: AppHandle,
    state: State<'_, AgentState>,
    agent_id: String,
    prompt: String,
    context: Option<Vec<String>>,
) -> Result<AgentTask, String> {
    let (tx, mut rx) = mpsc::channel::<AgentStreamChunk>(100);
    let ac = app.clone();
    let recv = tokio::spawn(async move {
        while let Some(c) = rx.recv().await {
            let _ = ac.emit("agent:task-progress", &c);
        }
    });
    let _ = app.emit(
        "agent:task-started",
        serde_json::json!({ "agentId": agent_id, "prompt": prompt }),
    );
    let r = {
        let mut o = state.0.lock().await;
        o.run_task(&agent_id, &prompt, context.unwrap_or_default(), tx)
            .await
    };
    let _ = recv.await;
    match r {
        Ok(tid) => {
            let o = state.0.lock().await;
            let t = o.get_task(&tid).cloned().ok_or("Not found")?;
            let _ = app.emit("agent:task-completed", serde_json::json!({ "task": t }));
            Ok(t)
        }
        Err(e) => {
            let _ = app.emit(
                "agent:task-failed",
                serde_json::json!({ "agentId": agent_id, "error": e.to_string() }),
            );
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn agent_cancel_task(
    app: AppHandle,
    state: State<'_, AgentState>,
    task_id: String,
) -> Result<(), String> {
    let mut o = state.0.lock().await;
    o.cancel_task(&task_id).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "agent:task-cancelled",
        serde_json::json!({ "taskId": task_id }),
    );
    Ok(())
}

#[tauri::command]
pub async fn agent_list(
    state: State<'_, AgentState>,
    status: Option<String>,
) -> Result<Vec<SubAgent>, String> {
    let o = state.0.lock().await;
    Ok(if let Some(s) = status {
        let st = match s.to_lowercase().as_str() {
            "idle" => AgentStatus::Idle,
            "running" => AgentStatus::Running,
            "completed" => AgentStatus::Completed,
            "failed" => AgentStatus::Failed,
            "cancelled" => AgentStatus::Cancelled,
            _ => return Err(format!("Invalid: {}", s)),
        };
        o.list_agents_by_status(st).into_iter().cloned().collect()
    } else {
        o.list_agents().into_iter().cloned().collect()
    })
}

#[tauri::command]
pub async fn agent_get_status(
    state: State<'_, AgentState>,
    agent_id: String,
) -> Result<SubAgent, String> {
    let o = state.0.lock().await;
    o.get_agent(&agent_id)
        .cloned()
        .ok_or_else(|| format!("Not found: {}", agent_id))
}

#[tauri::command]
pub async fn agent_get_task(
    state: State<'_, AgentState>,
    task_id: String,
) -> Result<AgentTask, String> {
    let o = state.0.lock().await;
    o.get_task(&task_id)
        .cloned()
        .ok_or_else(|| format!("Not found: {}", task_id))
}

#[tauri::command]
pub async fn agent_list_tasks(
    state: State<'_, AgentState>,
    agent_id: Option<String>,
    status: Option<String>,
) -> Result<Vec<AgentTask>, String> {
    let o = state.0.lock().await;
    Ok(if let Some(s) = status {
        let st = match s.to_lowercase().as_str() {
            "idle" => AgentStatus::Idle,
            "running" => AgentStatus::Running,
            "completed" => AgentStatus::Completed,
            "failed" => AgentStatus::Failed,
            "cancelled" => AgentStatus::Cancelled,
            _ => return Err(format!("Invalid: {}", s)),
        };
        o.list_tasks_by_status(st)
            .into_iter()
            .filter(|t| agent_id.as_ref().is_none_or(|a| &t.agent_id == a))
            .cloned()
            .collect()
    } else {
        o.list_tasks(agent_id.as_deref())
            .into_iter()
            .cloned()
            .collect()
    })
}

#[tauri::command]
pub async fn agent_remove(
    app: AppHandle,
    state: State<'_, AgentState>,
    agent_id: String,
) -> Result<(), String> {
    let mut o = state.0.lock().await;
    o.remove_agent(&agent_id).map_err(|e| e.to_string())?;
    let _ = app.emit("agent:removed", serde_json::json!({ "agentId": agent_id }));
    Ok(())
}

#[tauri::command]
pub async fn agent_get_stats(state: State<'_, AgentState>) -> Result<OrchestratorStats, String> {
    let o = state.0.lock().await;
    Ok(o.get_stats())
}

#[tauri::command]
pub async fn agent_cleanup(state: State<'_, AgentState>) -> Result<(), String> {
    let mut o = state.0.lock().await;
    o.archive_completed_tasks();
    Ok(())
}

#[tauri::command]
pub async fn agent_get_history(state: State<'_, AgentState>) -> Result<Vec<AgentTask>, String> {
    let o = state.0.lock().await;
    Ok(o.get_task_history().to_vec())
}
