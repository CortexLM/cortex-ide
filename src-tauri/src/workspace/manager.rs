//! Workspace manager for stateful folder and configuration management.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use tracing::{info, warn};

use super::core::strip_jsonc_comments;
use super::types::{
    ExtensionRecommendations, LaunchConfigurations, WorkspaceConfig, WorkspaceFolder,
};

pub struct WorkspaceManager {
    folders: Vec<WorkspaceFolder>,
    config_path: Option<PathBuf>,
    settings: serde_json::Value,
    launch: Option<LaunchConfigurations>,
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            folders: Vec::new(),
            config_path: None,
            settings: serde_json::Value::Object(Default::default()),
            launch: None,
        }
    }

    pub fn add_folder(&mut self, uri: String, name: Option<String>) {
        if self.folders.iter().any(|f| f.uri == uri) {
            warn!("[WorkspaceManager] Folder already exists: {}", uri);
            return;
        }
        let index = self.folders.len() as u32;
        self.folders.push(WorkspaceFolder { uri, name, index });
        self.reindex();
        info!(
            "[WorkspaceManager] Added folder (total: {})",
            self.folders.len()
        );
    }

    pub fn remove_folder(&mut self, uri: &str) -> bool {
        let before = self.folders.len();
        self.folders.retain(|f| f.uri != uri);
        if self.folders.len() < before {
            self.reindex();
            info!("[WorkspaceManager] Removed folder: {}", uri);
            true
        } else {
            warn!("[WorkspaceManager] Folder not found: {}", uri);
            false
        }
    }

    pub fn get_folders(&self) -> Vec<WorkspaceFolder> {
        self.folders.clone()
    }

    pub fn get_settings(&self) -> serde_json::Value {
        self.settings.clone()
    }

    pub fn get_launch(&self) -> Option<LaunchConfigurations> {
        self.launch.clone()
    }

    pub fn load_parsed(&mut self, config: WorkspaceConfig, path: Option<PathBuf>) {
        self.folders = config.folders;
        self.settings = config.settings;
        self.launch = config.launch;
        self.config_path = path;
    }

    pub async fn load_from_file(&mut self, path: &Path) -> Result<WorkspaceConfig, String> {
        let raw = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| format!("Failed to read workspace file '{}': {}", path.display(), e))?;

        let config = if path.extension().is_some_and(|ext| ext == "code-workspace") {
            self.parse_code_workspace(&raw)?
        } else {
            serde_json::from_str::<WorkspaceConfig>(&raw).map_err(|e| {
                format!("Failed to parse workspace file '{}': {}", path.display(), e)
            })?
        };

        self.folders = config.folders.clone();
        self.settings = config.settings.clone();
        self.launch = config.launch.clone();
        self.config_path = Some(path.to_path_buf());

        info!(
            "[WorkspaceManager] Loaded workspace from {} ({} folders)",
            path.display(),
            self.folders.len()
        );

        Ok(config)
    }

    pub async fn save_to_file(&self, path: &Path) -> Result<(), String> {
        let config = WorkspaceConfig {
            folders: self.folders.clone(),
            settings: self.settings.clone(),
            launch: self.launch.clone(),
            extensions: None,
        };

        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize workspace config: {}", e))?;

        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        let tmp_path = PathBuf::from(format!("{}.tmp", path.display()));
        tokio::fs::write(&tmp_path, &content)
            .await
            .map_err(|e| format!("Failed to write temporary file: {}", e))?;

        tokio::fs::rename(&tmp_path, path)
            .await
            .map_err(|e| format!("Failed to rename temporary file: {}", e))?;

        info!("[WorkspaceManager] Saved workspace to {}", path.display());
        Ok(())
    }

    pub fn parse_code_workspace(&self, content: &str) -> Result<WorkspaceConfig, String> {
        let stripped = strip_jsonc_comments(content);
        let parsed: serde_json::Value = serde_json::from_str(&stripped)
            .map_err(|e| format!("Failed to parse code-workspace JSON: {}", e))?;

        let raw_folders = parsed
            .get("folders")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let folders: Vec<WorkspaceFolder> = raw_folders
            .iter()
            .enumerate()
            .map(|(i, entry)| {
                let uri = entry
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or(".")
                    .to_string();
                let name = entry.get("name").and_then(|v| v.as_str()).map(String::from);
                WorkspaceFolder {
                    uri,
                    name,
                    index: i as u32,
                }
            })
            .collect();

        let settings = parsed
            .get("settings")
            .cloned()
            .unwrap_or(serde_json::Value::Object(Default::default()));

        let launch: Option<LaunchConfigurations> = parsed
            .get("launch")
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        let extensions: Option<ExtensionRecommendations> = parsed
            .get("extensions")
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        Ok(WorkspaceConfig {
            folders,
            settings,
            launch,
            extensions,
        })
    }

    fn reindex(&mut self) {
        for (i, folder) in self.folders.iter_mut().enumerate() {
            folder.index = i as u32;
        }
    }
}

impl Default for WorkspaceManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone)]
pub struct WorkspaceManagerState(pub Arc<Mutex<WorkspaceManager>>);

impl WorkspaceManagerState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(WorkspaceManager::new())))
    }
}

impl Default for WorkspaceManagerState {
    fn default() -> Self {
        Self::new()
    }
}
