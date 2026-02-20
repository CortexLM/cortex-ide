//! Persistence Manager
//!
//! Handles saving and loading workflows, agents, and configurations
//! to the `.cortex/factory/` directory.

use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::PathBuf;

use super::types::{AgentRuntimeState, InterceptionRule, Workflow, WorkflowExport};

/// Default factory directory name
const FACTORY_DIR: &str = ".cortex/factory";
const WORKFLOWS_DIR: &str = "workflows";
const AGENTS_DIR: &str = "agents";
const RULES_DIR: &str = "rules";
const CONFIG_FILE: &str = "config.json";

/// Persistence manager for the factory system
pub struct PersistenceManager {
    /// Base directory for factory data
    base_dir: Option<PathBuf>,
    /// Whether to auto-save changes
    auto_save: bool,
}

impl PersistenceManager {
    pub fn new() -> Self {
        Self {
            base_dir: None,
            auto_save: true,
        }
    }

    /// Set the base directory (project root)
    pub fn set_base_dir(&mut self, path: PathBuf) -> Result<(), String> {
        let factory_dir = path.join(FACTORY_DIR);

        // Create directory structure
        fs::create_dir_all(factory_dir.join(WORKFLOWS_DIR))
            .map_err(|e| format!("Failed to create workflows directory: {}", e))?;
        fs::create_dir_all(factory_dir.join(AGENTS_DIR))
            .map_err(|e| format!("Failed to create agents directory: {}", e))?;
        fs::create_dir_all(factory_dir.join(RULES_DIR))
            .map_err(|e| format!("Failed to create rules directory: {}", e))?;

        self.base_dir = Some(path);
        Ok(())
    }

    /// Get the factory directory path
    fn factory_dir(&self) -> Option<PathBuf> {
        self.base_dir.as_ref().map(|p| p.join(FACTORY_DIR))
    }

    // =========================================================================
    // Workflow Persistence
    // =========================================================================

    /// Save a workflow to disk
    pub fn save_workflow(&self, workflow: &Workflow) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let workflows_dir = factory_dir.join(WORKFLOWS_DIR);
        let file_path = workflows_dir.join(format!("{}.json", workflow.id));

        let file = File::create(&file_path)
            .map_err(|e| format!("Failed to create workflow file: {}", e))?;

        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, workflow)
            .map_err(|e| format!("Failed to serialize workflow: {}", e))?;

        Ok(())
    }

    /// Load a workflow from disk
    pub fn load_workflow(&self, workflow_id: &str) -> Result<Workflow, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir
            .join(WORKFLOWS_DIR)
            .join(format!("{}.json", workflow_id));

        let file =
            File::open(&file_path).map_err(|e| format!("Failed to open workflow file: {}", e))?;

        let reader = BufReader::new(file);
        serde_json::from_reader(reader).map_err(|e| format!("Failed to parse workflow: {}", e))
    }

    /// Delete a workflow from disk
    pub fn delete_workflow(&self, workflow_id: &str) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir
            .join(WORKFLOWS_DIR)
            .join(format!("{}.json", workflow_id));

        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete workflow file: {}", e))?;
        }

        Ok(())
    }

    /// List all workflows on disk
    pub fn list_workflows(&self) -> Result<Vec<Workflow>, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let workflows_dir = factory_dir.join(WORKFLOWS_DIR);

        if !workflows_dir.exists() {
            return Ok(Vec::new());
        }

        let mut workflows = Vec::new();

        for entry in fs::read_dir(&workflows_dir)
            .map_err(|e| format!("Failed to read workflows directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().is_some_and(|ext| ext == "json") {
                if let Ok(file) = File::open(&path) {
                    let reader = BufReader::new(file);
                    if let Ok(workflow) = serde_json::from_reader::<_, Workflow>(reader) {
                        workflows.push(workflow);
                    }
                }
            }
        }

        Ok(workflows)
    }

    /// Export a workflow
    pub fn export_workflow(&self, workflow: &Workflow, path: &str) -> Result<(), String> {
        let export = WorkflowExport::new(workflow.clone());

        let file =
            File::create(path).map_err(|e| format!("Failed to create export file: {}", e))?;

        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, &export)
            .map_err(|e| format!("Failed to serialize export: {}", e))?;

        Ok(())
    }

    /// Import a workflow
    pub fn import_workflow(&self, path: &str) -> Result<WorkflowExport, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open import file: {}", e))?;

        let reader = BufReader::new(file);
        serde_json::from_reader(reader).map_err(|e| format!("Failed to parse import: {}", e))
    }

    // =========================================================================
    // Agent Persistence
    // =========================================================================

    /// Save an agent state to disk
    pub fn save_agent(&self, agent: &AgentRuntimeState) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let agents_dir = factory_dir.join(AGENTS_DIR);
        let file_path = agents_dir.join(format!("{}.json", agent.id));

        let file =
            File::create(&file_path).map_err(|e| format!("Failed to create agent file: {}", e))?;

        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, agent)
            .map_err(|e| format!("Failed to serialize agent: {}", e))?;

        Ok(())
    }

    /// Load an agent state from disk
    pub fn load_agent(&self, agent_id: &str) -> Result<AgentRuntimeState, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir
            .join(AGENTS_DIR)
            .join(format!("{}.json", agent_id));

        let file =
            File::open(&file_path).map_err(|e| format!("Failed to open agent file: {}", e))?;

        let reader = BufReader::new(file);
        serde_json::from_reader(reader).map_err(|e| format!("Failed to parse agent: {}", e))
    }

    /// Delete an agent from disk
    pub fn delete_agent(&self, agent_id: &str) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir
            .join(AGENTS_DIR)
            .join(format!("{}.json", agent_id));

        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete agent file: {}", e))?;
        }

        Ok(())
    }

    /// List all agents on disk
    pub fn list_agents(&self) -> Result<Vec<AgentRuntimeState>, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let agents_dir = factory_dir.join(AGENTS_DIR);

        if !agents_dir.exists() {
            return Ok(Vec::new());
        }

        let mut agents = Vec::new();

        for entry in fs::read_dir(&agents_dir)
            .map_err(|e| format!("Failed to read agents directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().is_some_and(|ext| ext == "json") {
                if let Ok(file) = File::open(&path) {
                    let reader = BufReader::new(file);
                    if let Ok(agent) = serde_json::from_reader::<_, AgentRuntimeState>(reader) {
                        agents.push(agent);
                    }
                }
            }
        }

        Ok(agents)
    }

    // =========================================================================
    // Rule Persistence
    // =========================================================================

    /// Save an interception rule to disk
    pub fn save_rule(&self, rule: &InterceptionRule) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let rules_dir = factory_dir.join(RULES_DIR);
        let file_path = rules_dir.join(format!("{}.json", rule.id));

        let file =
            File::create(&file_path).map_err(|e| format!("Failed to create rule file: {}", e))?;

        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, rule)
            .map_err(|e| format!("Failed to serialize rule: {}", e))?;

        Ok(())
    }

    /// Load an interception rule from disk
    pub fn load_rule(&self, rule_id: &str) -> Result<InterceptionRule, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir
            .join(RULES_DIR)
            .join(format!("{}.json", rule_id));

        let file =
            File::open(&file_path).map_err(|e| format!("Failed to open rule file: {}", e))?;

        let reader = BufReader::new(file);
        serde_json::from_reader(reader).map_err(|e| format!("Failed to parse rule: {}", e))
    }

    /// Delete a rule from disk
    pub fn delete_rule(&self, rule_id: &str) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir
            .join(RULES_DIR)
            .join(format!("{}.json", rule_id));

        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete rule file: {}", e))?;
        }

        Ok(())
    }

    /// List all rules on disk
    pub fn list_rules(&self) -> Result<Vec<InterceptionRule>, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let rules_dir = factory_dir.join(RULES_DIR);

        if !rules_dir.exists() {
            return Ok(Vec::new());
        }

        let mut rules = Vec::new();

        for entry in fs::read_dir(&rules_dir)
            .map_err(|e| format!("Failed to read rules directory: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().is_some_and(|ext| ext == "json") {
                if let Ok(file) = File::open(&path) {
                    let reader = BufReader::new(file);
                    if let Ok(rule) = serde_json::from_reader::<_, InterceptionRule>(reader) {
                        rules.push(rule);
                    }
                }
            }
        }

        Ok(rules)
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /// Save the factory configuration
    pub fn save_config(&self, config: &FactoryConfig) -> Result<(), String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir.join(CONFIG_FILE);

        let file =
            File::create(&file_path).map_err(|e| format!("Failed to create config file: {}", e))?;

        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        Ok(())
    }

    /// Load the factory configuration
    pub fn load_config(&self) -> Result<FactoryConfig, String> {
        let factory_dir = self.factory_dir().ok_or("Base directory not set")?;

        let file_path = factory_dir.join(CONFIG_FILE);

        if !file_path.exists() {
            return Ok(FactoryConfig::default());
        }

        let file =
            File::open(&file_path).map_err(|e| format!("Failed to open config file: {}", e))?;

        let reader = BufReader::new(file);
        serde_json::from_reader(reader).map_err(|e| format!("Failed to parse config: {}", e))
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    /// Check if the factory directory exists
    pub fn is_initialized(&self) -> bool {
        self.factory_dir().is_some_and(|p| p.exists())
    }

    /// Get the factory directory path as a string
    pub fn get_factory_path(&self) -> Option<String> {
        self.factory_dir().map(|p| p.to_string_lossy().to_string())
    }
}

impl Default for PersistenceManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Factory configuration
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryConfig {
    /// Version of the factory format
    pub version: String,
    /// Default workflow settings
    #[serde(default)]
    pub default_settings: serde_json::Value,
    /// List of enabled workflow IDs
    #[serde(default)]
    pub enabled_workflows: Vec<String>,
    /// Auto-start workflows on load
    #[serde(default)]
    pub auto_start: bool,
}
