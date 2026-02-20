//! Persistent agent storage and OS-specific directory handling

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

use super::storage_types::{AgentHistoryEntry, AgentStoreData, CortexAgentMetadata, StoredAgent};
use super::types::{AgentStatus, AgentType, ts};

// ============================================================================
// OS-Specific Agents Directory
// ============================================================================

/// Get the OS-specific agents directory for Cortex integration.
///
/// Returns:
/// - Windows: `%APPDATA%\Cortex\agents` (e.g., `C:\Users\<user>\AppData\Roaming\Cortex\agents`)
/// - macOS: `~/Library/Application Support/Cortex/agents`
/// - Linux: `~/.local/share/Cortex/agents`
pub fn get_os_agents_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        dirs::data_dir().map(|p| p.join("Cortex").join("agents"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::data_dir().map(|p| p.join("Cortex").join("agents"))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        dirs::data_local_dir().map(|p| p.join("Cortex").join("agents"))
    }
}

/// Get the OS-specific Cortex data directory (parent of agents dir).
pub fn get_os_cortex_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        dirs::data_dir().map(|p| p.join("Cortex"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::data_dir().map(|p| p.join("Cortex"))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        dirs::data_local_dir().map(|p| p.join("Cortex"))
    }
}

// ============================================================================
// Agent Store State
// ============================================================================

/// State for the agent store
pub struct AgentStoreState {
    data: Mutex<AgentStoreData>,
    storage_path: Mutex<Option<PathBuf>>,
}

impl AgentStoreState {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(AgentStoreData {
                version: "1.0".to_string(),
                agents: Vec::new(),
                history: Vec::new(),
            }),
            storage_path: Mutex::new(None),
        }
    }

    /// Get the legacy storage path (for history and migration)
    fn get_legacy_storage_path(&self, app: &AppHandle) -> Result<PathBuf, String> {
        let mut path_guard = self
            .storage_path
            .lock()
            .map_err(|_| "Failed to acquire storage path lock")?;
        if path_guard.is_none() {
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
                dirs::config_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("Cortex-desktop")
            });
            let agents_path = app_data_dir.join("agents.json");
            *path_guard = Some(agents_path);
        }
        path_guard
            .clone()
            .ok_or_else(|| "Storage path not initialized".to_string())
    }

    /// Get the OS-specific agents directory
    fn get_agents_dir() -> Result<PathBuf, String> {
        get_os_agents_dir().ok_or_else(|| "Could not determine OS agents directory".to_string())
    }

    /// Load history from legacy file
    pub fn load_history(&self, app: &AppHandle) -> Result<Vec<AgentHistoryEntry>, String> {
        let path = self.get_legacy_storage_path(app)?;
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read history file: {}", e))?;

        let data: AgentStoreData = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse history file: {}", e))?;

        Ok(data.history)
    }

    /// Save history to legacy file
    pub fn save_history(
        &self,
        app: &AppHandle,
        history: &[AgentHistoryEntry],
    ) -> Result<(), String> {
        let path = self.get_legacy_storage_path(app)?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let data = AgentStoreData {
            version: "1.0".to_string(),
            agents: Vec::new(), // Agents are now stored in OS-specific dirs
            history: history.to_vec(),
        };

        let content = serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Failed to serialize history: {}", e))?;

        std::fs::write(&path, content).map_err(|e| format!("Failed to write history: {}", e))
    }

    /// Load agents from OS-specific directory (individual agent.json files)
    pub fn load_agents_from_os_dir() -> Result<Vec<StoredAgent>, String> {
        let agents_dir = Self::get_agents_dir()?;

        if !agents_dir.exists() {
            return Ok(Vec::new());
        }

        let mut agents = Vec::new();

        for entry in std::fs::read_dir(&agents_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            if path.is_dir() {
                let agent_json_path = path.join("agent.json");
                if agent_json_path.exists() {
                    match std::fs::read_to_string(&agent_json_path) {
                        Ok(content) => {
                            match serde_json::from_str::<CortexAgentMetadata>(&content) {
                                Ok(metadata) => {
                                    agents.push(StoredAgent {
                                        id: metadata.name.clone(),
                                        name: metadata.name.clone(),
                                        description: metadata.description.clone(),
                                        system_prompt: metadata
                                            .system_prompt
                                            .clone()
                                            .unwrap_or_default(),
                                        model: metadata
                                            .model
                                            .clone()
                                            .unwrap_or_else(|| "gpt-4".to_string()),
                                        agent_type: AgentType::Custom,
                                        status: AgentStatus::Idle,
                                        is_built_in: false,
                                        created_at: ts(),
                                        updated_at: ts(),
                                        tokens_used: 0,
                                        cost_usd: 0.0,
                                        tasks_completed: 0,
                                        tasks_failed: 0,
                                        last_active_at: None,
                                        enabled: metadata.enabled,
                                        allowed_tools: metadata.allowed_tools,
                                        denied_tools: metadata.denied_tools,
                                        tags: metadata.tags,
                                    });
                                }
                                Err(e) => {
                                    tracing::warn!(
                                        path = ?agent_json_path,
                                        error = %e,
                                        "Failed to parse agent.json"
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!(
                                path = ?agent_json_path,
                                error = %e,
                                "Failed to read agent.json"
                            );
                        }
                    }
                }
            }
        }

        tracing::info!(count = agents.len(), dir = ?agents_dir, "Loaded agents from OS directory");
        Ok(agents)
    }

    /// Save a single agent to OS-specific directory
    pub fn save_agent_to_os_dir(agent: &StoredAgent) -> Result<(), String> {
        if agent.is_built_in {
            return Ok(()); // Don't save built-in agents
        }

        let agents_dir = Self::get_agents_dir()?;
        let agent_dir = agents_dir.join(&agent.name);

        // Create agent directory
        std::fs::create_dir_all(&agent_dir)
            .map_err(|e| format!("Failed to create agent directory: {}", e))?;

        // Create CortexAgentMetadata for agent.json
        let metadata = CortexAgentMetadata {
            name: agent.name.clone(),
            description: agent.description.clone(),
            model: Some(agent.model.clone()),
            temperature: None,
            max_tokens: None,
            allowed_tools: agent.allowed_tools.clone(),
            denied_tools: agent.denied_tools.clone(),
            system_prompt: Some(agent.system_prompt.clone()),
            tags: agent.tags.clone(),
            can_delegate: true,
            max_turns: Some(20),
            enabled: agent.enabled,
        };

        let agent_json_path = agent_dir.join("agent.json");
        let content = serde_json::to_string_pretty(&metadata)
            .map_err(|e| format!("Failed to serialize agent: {}", e))?;

        std::fs::write(&agent_json_path, content)
            .map_err(|e| format!("Failed to write agent.json: {}", e))?;

        tracing::info!(agent = %agent.name, path = ?agent_json_path, "Saved agent to OS directory");
        Ok(())
    }

    /// Delete an agent from OS-specific directory
    fn delete_agent_from_os_dir(agent_name: &str) -> Result<(), String> {
        let agents_dir = Self::get_agents_dir()?;
        let agent_dir = agents_dir.join(agent_name);

        if agent_dir.exists() {
            std::fs::remove_dir_all(&agent_dir)
                .map_err(|e| format!("Failed to delete agent directory: {}", e))?;
            tracing::info!(agent = %agent_name, "Deleted agent from OS directory");
        }

        Ok(())
    }
}

impl Default for AgentStoreState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Load agents from storage (OS-specific directory + history from legacy)
#[tauri::command]
pub async fn agent_store_load(
    app: AppHandle,
    state: State<'_, AgentStoreState>,
) -> Result<AgentStoreData, String> {
    // Load agents from OS-specific directory
    let agents = AgentStoreState::load_agents_from_os_dir()?;

    // Load history from legacy storage
    let history = state.load_history(&app)?;

    let data = AgentStoreData {
        version: "1.0".to_string(),
        agents,
        history,
    };

    // Update in-memory state
    let mut state_data = state.data.lock().map_err(|e| e.to_string())?;
    *state_data = data.clone();

    tracing::info!(
        agent_count = data.agents.len(),
        history_count = data.history.len(),
        agents_dir = ?get_os_agents_dir(),
        "Loaded agents from OS directory"
    );

    Ok(data)
}

/// Save agents to storage (OS-specific directory + history to legacy)
#[tauri::command]
pub async fn agent_store_save(
    app: AppHandle,
    state: State<'_, AgentStoreState>,
    agents: Vec<StoredAgent>,
    history: Vec<AgentHistoryEntry>,
) -> Result<(), String> {
    // Ensure OS agents directory exists
    if let Some(agents_dir) = get_os_agents_dir() {
        std::fs::create_dir_all(&agents_dir)
            .map_err(|e| format!("Failed to create agents directory: {}", e))?;
    }

    // Get existing agent names from OS directory
    let existing_agents = AgentStoreState::load_agents_from_os_dir()?;
    let existing_names: HashSet<_> = existing_agents.iter().map(|a| a.name.clone()).collect();

    // Save each non-built-in agent to OS directory
    for agent in &agents {
        if !agent.is_built_in {
            AgentStoreState::save_agent_to_os_dir(agent)?;
        }
    }

    // Delete agents that were removed (no longer in the list)
    let new_names: HashSet<_> = agents
        .iter()
        .filter(|a| !a.is_built_in)
        .map(|a| a.name.clone())
        .collect();

    for name in &existing_names {
        if !new_names.contains(name) {
            AgentStoreState::delete_agent_from_os_dir(name)?;
        }
    }

    // Save history to legacy storage
    state.save_history(&app, &history)?;

    // Update in-memory state
    let data = AgentStoreData {
        version: "1.0".to_string(),
        agents,
        history,
    };
    let mut state_data = state.data.lock().map_err(|e| e.to_string())?;
    *state_data = data;

    tracing::info!(agents_dir = ?get_os_agents_dir(), "Saved agents to OS directory");

    Ok(())
}

/// Update agent statistics (tokens, cost)
#[tauri::command]
pub async fn agent_store_update_stats(
    _app: AppHandle,
    state: State<'_, AgentStoreState>,
    agent_id: String,
    tokens_used: u64,
    cost_usd: f64,
    task_completed: bool,
) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    if let Some(agent) = data.agents.iter_mut().find(|a| a.id == agent_id) {
        agent.tokens_used += tokens_used;
        agent.cost_usd += cost_usd;
        agent.last_active_at = Some(ts());
        if task_completed {
            agent.tasks_completed += 1;
        } else {
            agent.tasks_failed += 1;
        }
        agent.updated_at = ts();

        // Save the updated agent to OS directory
        let agent_clone = agent.clone();
        drop(data);
        AgentStoreState::save_agent_to_os_dir(&agent_clone)?;
    }

    Ok(())
}

/// Add history entry
#[tauri::command]
pub async fn agent_store_add_history(
    app: AppHandle,
    state: State<'_, AgentStoreState>,
    entry: AgentHistoryEntry,
) -> Result<(), String> {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    data.history.push(entry);

    // Keep only last 100 entries
    if data.history.len() > 100 {
        data.history.remove(0);
    }

    let history_clone = data.history.clone();
    drop(data);

    // Save history to legacy file
    state.save_history(&app, &history_clone)?;

    Ok(())
}
