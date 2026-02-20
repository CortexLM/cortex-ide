//! Toolchain detection and management for Cortex Desktop
//!
//! This module provides cross-platform detection and management of development toolchains
//! including Node.js, Python, and Rust.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tracing::debug;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ToolchainKind {
    Node,
    Python,
    Rust,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainInfo {
    pub kind: ToolchainKind,
    pub name: String,
    pub version: String,
    pub path: String,
    pub is_default: bool,
    pub extra: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectToolchains {
    pub node: Option<String>,
    pub python: Option<String>,
    pub rust: Option<String>,
}

impl Default for ProjectToolchains {
    fn default() -> Self {
        Self {
            node: None,
            python: None,
            rust: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainDetectionResult {
    pub node_toolchains: Vec<ToolchainInfo>,
    pub python_toolchains: Vec<ToolchainInfo>,
    pub rust_toolchains: Vec<ToolchainInfo>,
}

#[derive(Clone)]
pub struct ToolchainState(pub Arc<Mutex<ToolchainManager>>);

impl ToolchainState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(ToolchainManager::new())))
    }
}

impl Default for ToolchainState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Toolchain Manager
// ============================================================================

pub struct ToolchainManager {
    project_toolchains: HashMap<PathBuf, ProjectToolchains>,
    cached_toolchains: Option<ToolchainDetectionResult>,
}

impl ToolchainManager {
    pub fn new() -> Self {
        Self {
            project_toolchains: HashMap::new(),
            cached_toolchains: None,
        }
    }

    pub fn get_project_toolchains(&self, project_path: &Path) -> ProjectToolchains {
        self.project_toolchains
            .get(project_path)
            .cloned()
            .unwrap_or_default()
    }

    pub fn set_project_toolchain(
        &mut self,
        project_path: PathBuf,
        kind: ToolchainKind,
        toolchain_path: Option<String>,
    ) {
        let entry = self.project_toolchains.entry(project_path).or_default();
        match kind {
            ToolchainKind::Node => entry.node = toolchain_path,
            ToolchainKind::Python => entry.python = toolchain_path,
            ToolchainKind::Rust => entry.rust = toolchain_path,
        }
    }

    pub fn get_cached_toolchains(&self) -> Option<&ToolchainDetectionResult> {
        self.cached_toolchains.as_ref()
    }

    pub fn set_cached_toolchains(&mut self, result: ToolchainDetectionResult) {
        self.cached_toolchains = Some(result);
    }

    pub fn clear_cache(&mut self) {
        self.cached_toolchains = None;
    }
}

impl Default for ToolchainManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Detection Functions
// ============================================================================

fn run_command(cmd: &str, args: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    let output = crate::process_utils::command("cmd")
        .args(["/C", &format!("{} {}", cmd, args.join(" "))])
        .output()
        .ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = crate::process_utils::command(cmd)
        .args(args)
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

fn get_command_path(cmd: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        run_command("where", &[cmd]).map(|s| s.lines().next().unwrap_or(&s).to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        run_command("which", &[cmd])
    }
}

/// Detect all installed Node.js versions
pub fn detect_node_toolchains() -> Vec<ToolchainInfo> {
    let mut toolchains = Vec::new();

    // Detect system Node.js
    if let Some(version) = run_command("node", &["--version"]) {
        let path = get_command_path("node").unwrap_or_else(|| "node".to_string());
        let version = version.trim_start_matches('v').to_string();

        let mut extra = HashMap::new();
        if let Some(npm_version) = run_command("npm", &["--version"]) {
            extra.insert("npm".to_string(), npm_version);
        }

        toolchains.push(ToolchainInfo {
            kind: ToolchainKind::Node,
            name: format!("Node.js {}", &version),
            version,
            path,
            is_default: true,
            extra,
        });
    }

    // Detect nvm managed versions (Unix)
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = dirs::home_dir() {
            let nvm_dir = home.join(".nvm/versions/node");
            if nvm_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(version_name) = path.file_name().and_then(|n| n.to_str()) {
                                let node_path = path.join("bin/node");
                                if node_path.exists() {
                                    let version = version_name.trim_start_matches('v').to_string();
                                    let is_default = toolchains
                                        .iter()
                                        .any(|t| t.is_default && t.version == version);

                                    if !is_default {
                                        toolchains.push(ToolchainInfo {
                                            kind: ToolchainKind::Node,
                                            name: format!("Node.js {} (nvm)", &version),
                                            version,
                                            path: node_path.to_string_lossy().to_string(),
                                            is_default: false,
                                            extra: HashMap::new(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Detect nvm-windows versions
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = dirs::data_local_dir() {
            let nvm_dir = appdata.join("nvm");
            if nvm_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(version_name) = path.file_name().and_then(|n| n.to_str()) {
                                if version_name.starts_with('v')
                                    || version_name
                                        .chars()
                                        .next()
                                        .map(|c| c.is_ascii_digit())
                                        .unwrap_or(false)
                                {
                                    let node_path = path.join("node.exe");
                                    if node_path.exists() {
                                        let version =
                                            version_name.trim_start_matches('v').to_string();
                                        let is_default = toolchains
                                            .iter()
                                            .any(|t| t.is_default && t.version == version);

                                        if !is_default {
                                            toolchains.push(ToolchainInfo {
                                                kind: ToolchainKind::Node,
                                                name: format!("Node.js {} (nvm)", &version),
                                                version,
                                                path: node_path.to_string_lossy().to_string(),
                                                is_default: false,
                                                extra: HashMap::new(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Also check Program Files for standard Node.js installation
        let program_files =
            std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let node_dir = PathBuf::from(&program_files).join("nodejs");
        if node_dir.exists() {
            let node_exe = node_dir.join("node.exe");
            if node_exe.exists()
                && !toolchains
                    .iter()
                    .any(|t| t.path.to_lowercase() == node_exe.to_string_lossy().to_lowercase())
            {
                if let Some(version) = run_command(&node_exe.to_string_lossy(), &["--version"]) {
                    let version = version.trim_start_matches('v').to_string();
                    toolchains.push(ToolchainInfo {
                        kind: ToolchainKind::Node,
                        name: format!("Node.js {} (Program Files)", &version),
                        version,
                        path: node_exe.to_string_lossy().to_string(),
                        is_default: toolchains.is_empty(),
                        extra: HashMap::new(),
                    });
                }
            }
        }
    }

    // Detect fnm managed versions
    if let Some(home) = dirs::home_dir() {
        let fnm_dir = home.join(".fnm/node-versions");
        if fnm_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(version_name) = path.file_name().and_then(|n| n.to_str()) {
                            #[cfg(target_os = "windows")]
                            let node_path = path.join("installation/node.exe");
                            #[cfg(not(target_os = "windows"))]
                            let node_path = path.join("installation/bin/node");

                            if node_path.exists() {
                                let version = version_name.trim_start_matches('v').to_string();
                                let already_exists =
                                    toolchains.iter().any(|t| t.version == version);

                                if !already_exists {
                                    toolchains.push(ToolchainInfo {
                                        kind: ToolchainKind::Node,
                                        name: format!("Node.js {} (fnm)", &version),
                                        version,
                                        path: node_path.to_string_lossy().to_string(),
                                        is_default: false,
                                        extra: HashMap::new(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    debug!("Detected {} Node.js toolchains", toolchains.len());
    toolchains
}

/// Detect all installed Python versions
pub fn detect_python_toolchains() -> Vec<ToolchainInfo> {
    let mut toolchains = Vec::new();

    // Check common Python executables
    let python_cmds = [
        "python3",
        "python",
        "python3.12",
        "python3.11",
        "python3.10",
        "python3.9",
    ];

    for cmd in python_cmds {
        if let Some(version_output) = run_command(cmd, &["--version"]) {
            if let Some(path) = get_command_path(cmd) {
                // Avoid duplicates by checking path
                if toolchains
                    .iter()
                    .any(|t: &ToolchainInfo| t.path.to_lowercase() == path.to_lowercase())
                {
                    continue;
                }

                let version = version_output.replace("Python ", "").trim().to_string();

                let mut extra = HashMap::new();

                // Check for pip
                if run_command(cmd, &["-m", "pip", "--version"]).is_some() {
                    extra.insert("pip".to_string(), "available".to_string());
                }

                // Check for venv
                if run_command(cmd, &["-c", "import venv"]).is_some() {
                    extra.insert("venv".to_string(), "available".to_string());
                }

                toolchains.push(ToolchainInfo {
                    kind: ToolchainKind::Python,
                    name: format!("Python {}", &version),
                    version,
                    path,
                    is_default: toolchains.is_empty(),
                    extra,
                });
            }
        }
    }

    // Detect pyenv versions (Unix)
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = dirs::home_dir() {
            let pyenv_dir = home.join(".pyenv/versions");
            if pyenv_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&pyenv_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(version_name) = path.file_name().and_then(|n| n.to_str()) {
                                // Skip virtual environments
                                if version_name.contains("envs") {
                                    continue;
                                }
                                let python_path = path.join("bin/python");
                                if python_path.exists() {
                                    let already_exists =
                                        toolchains.iter().any(|t| t.version == version_name);
                                    if !already_exists {
                                        toolchains.push(ToolchainInfo {
                                            kind: ToolchainKind::Python,
                                            name: format!("Python {} (pyenv)", version_name),
                                            version: version_name.to_string(),
                                            path: python_path.to_string_lossy().to_string(),
                                            is_default: false,
                                            extra: HashMap::new(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Detect pyenv-win versions
    #[cfg(target_os = "windows")]
    {
        if let Some(home) = dirs::home_dir() {
            let pyenv_dir = home.join(".pyenv/pyenv-win/versions");
            if pyenv_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&pyenv_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(version_name) = path.file_name().and_then(|n| n.to_str()) {
                                let python_path = path.join("python.exe");
                                if python_path.exists() {
                                    let already_exists =
                                        toolchains.iter().any(|t| t.version == version_name);
                                    if !already_exists {
                                        toolchains.push(ToolchainInfo {
                                            kind: ToolchainKind::Python,
                                            name: format!("Python {} (pyenv)", version_name),
                                            version: version_name.to_string(),
                                            path: python_path.to_string_lossy().to_string(),
                                            is_default: false,
                                            extra: HashMap::new(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check common Windows Python locations
        let locations = [
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("Programs/Python")),
            Some(PathBuf::from("C:/Python")),
            Some(PathBuf::from("C:/Program Files/Python")),
        ];

        for loc_opt in locations.into_iter().flatten() {
            if loc_opt.exists() {
                if let Ok(entries) = std::fs::read_dir(&loc_opt) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            let python_exe = path.join("python.exe");
                            if python_exe.exists() {
                                let path_str = python_exe.to_string_lossy().to_string();
                                if !toolchains
                                    .iter()
                                    .any(|t| t.path.to_lowercase() == path_str.to_lowercase())
                                {
                                    if let Some(version) = run_command(&path_str, &["--version"]) {
                                        let version =
                                            version.replace("Python ", "").trim().to_string();
                                        toolchains.push(ToolchainInfo {
                                            kind: ToolchainKind::Python,
                                            name: format!("Python {}", &version),
                                            version,
                                            path: path_str,
                                            is_default: toolchains.is_empty(),
                                            extra: HashMap::new(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Detect conda environments
    if let Some(home) = dirs::home_dir() {
        let conda_dirs = [
            home.join("miniconda3/envs"),
            home.join("anaconda3/envs"),
            home.join(".conda/envs"),
        ];

        for conda_dir in conda_dirs {
            if conda_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&conda_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            if let Some(env_name) = path.file_name().and_then(|n| n.to_str()) {
                                #[cfg(target_os = "windows")]
                                let python_path = path.join("python.exe");
                                #[cfg(not(target_os = "windows"))]
                                let python_path = path.join("bin/python");

                                if python_path.exists() {
                                    if let Some(version_output) =
                                        run_command(&python_path.to_string_lossy(), &["--version"])
                                    {
                                        let version = version_output
                                            .replace("Python ", "")
                                            .trim()
                                            .to_string();

                                        toolchains.push(ToolchainInfo {
                                            kind: ToolchainKind::Python,
                                            name: format!(
                                                "Python {} (conda: {})",
                                                &version, env_name
                                            ),
                                            version,
                                            path: python_path.to_string_lossy().to_string(),
                                            is_default: false,
                                            extra: {
                                                let mut extra = HashMap::new();
                                                extra.insert(
                                                    "conda_env".to_string(),
                                                    env_name.to_string(),
                                                );
                                                extra
                                            },
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    debug!("Detected {} Python toolchains", toolchains.len());
    toolchains
}

/// Detect all installed Rust toolchains
pub fn detect_rust_toolchains() -> Vec<ToolchainInfo> {
    let mut toolchains = Vec::new();

    // Detect using rustup
    if let Some(output) = run_command("rustup", &["toolchain", "list"]) {
        let default_toolchain = run_command("rustup", &["default"]);

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let (name, is_default) = if line.ends_with("(default)") {
                (line.trim_end_matches(" (default)").to_string(), true)
            } else {
                let is_def = default_toolchain
                    .as_ref()
                    .map(|d| d.starts_with(line))
                    .unwrap_or(false);
                (line.to_string(), is_def)
            };

            // Get version for this toolchain
            let version = run_command("rustup", &["run", &name, "rustc", "--version"])
                .map(|v| v.split_whitespace().nth(1).unwrap_or(&name).to_string())
                .unwrap_or_else(|| name.clone());

            // Get rustup home
            let path = if let Some(home) = dirs::home_dir() {
                let rustup_home = std::env::var("RUSTUP_HOME")
                    .map(PathBuf::from)
                    .unwrap_or_else(|_| home.join(".rustup"));
                rustup_home
                    .join("toolchains")
                    .join(&name)
                    .to_string_lossy()
                    .to_string()
            } else {
                name.clone()
            };

            let mut extra = HashMap::new();

            // Check for cargo version
            if let Some(cargo_version) =
                run_command("rustup", &["run", &name, "cargo", "--version"])
            {
                if let Some(ver) = cargo_version.split_whitespace().nth(1) {
                    extra.insert("cargo".to_string(), ver.to_string());
                }
            }

            toolchains.push(ToolchainInfo {
                kind: ToolchainKind::Rust,
                name: format!("Rust {}", &name),
                version,
                path,
                is_default,
                extra,
            });
        }
    } else {
        // No rustup, try detecting standalone rustc
        if let Some(version_output) = run_command("rustc", &["--version"]) {
            let version = version_output
                .split_whitespace()
                .nth(1)
                .unwrap_or("unknown")
                .to_string();

            let path = get_command_path("rustc").unwrap_or_else(|| "rustc".to_string());

            let mut extra = HashMap::new();
            if let Some(cargo_version) = run_command("cargo", &["--version"]) {
                if let Some(ver) = cargo_version.split_whitespace().nth(1) {
                    extra.insert("cargo".to_string(), ver.to_string());
                }
            }

            toolchains.push(ToolchainInfo {
                kind: ToolchainKind::Rust,
                name: format!("Rust {}", &version),
                version,
                path,
                is_default: true,
                extra,
            });
        }
    }

    debug!("Detected {} Rust toolchains", toolchains.len());
    toolchains
}

/// Detect project-local virtual environment
pub fn detect_project_venv(project_path: &Path) -> Option<ToolchainInfo> {
    let venv_paths = [
        project_path.join(".venv"),
        project_path.join("venv"),
        project_path.join("env"),
        project_path.join(".env"),
    ];

    for venv_path in venv_paths {
        if venv_path.exists() {
            #[cfg(target_os = "windows")]
            let python_path = venv_path.join("Scripts/python.exe");
            #[cfg(not(target_os = "windows"))]
            let python_path = venv_path.join("bin/python");

            if python_path.exists() {
                if let Some(version_output) =
                    run_command(&python_path.to_string_lossy(), &["--version"])
                {
                    let version = version_output.replace("Python ", "").trim().to_string();
                    let venv_name = venv_path.file_name()?.to_str()?;

                    return Some(ToolchainInfo {
                        kind: ToolchainKind::Python,
                        name: format!("Python {} ({})", &version, venv_name),
                        version,
                        path: python_path.to_string_lossy().to_string(),
                        is_default: false,
                        extra: {
                            let mut extra = HashMap::new();
                            extra.insert(
                                "venv".to_string(),
                                venv_path.to_string_lossy().to_string(),
                            );
                            extra.insert("is_project_local".to_string(), "true".to_string());
                            extra
                        },
                    });
                }
            }
        }
    }

    None
}

/// Detect project-local Node.js version (from .nvmrc or .node-version)
pub fn detect_project_node_version(project_path: &Path) -> Option<String> {
    let version_files = [".nvmrc", ".node-version", ".tool-versions"];

    for file_name in version_files {
        let file_path = project_path.join(file_name);
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                let content = content.trim();
                if file_name == ".tool-versions" {
                    // Parse asdf format
                    for line in content.lines() {
                        if line.starts_with("nodejs") {
                            if let Some(version) = line.split_whitespace().nth(1) {
                                return Some(version.to_string());
                            }
                        }
                    }
                } else {
                    return Some(content.to_string());
                }
            }
        }
    }

    None
}

/// Detect project-local Rust toolchain (from rust-toolchain.toml or rust-toolchain)
pub fn detect_project_rust_toolchain(project_path: &Path) -> Option<String> {
    let toolchain_files = ["rust-toolchain.toml", "rust-toolchain"];

    for file_name in toolchain_files {
        let file_path = project_path.join(file_name);
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                if file_name == "rust-toolchain.toml" {
                    // Parse TOML format
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("channel") {
                            if let Some(value) = line.split('=').nth(1) {
                                return Some(value.trim().trim_matches('"').to_string());
                            }
                        }
                    }
                } else {
                    return Some(content.trim().to_string());
                }
            }
        }
    }

    None
}

// ============================================================================
// Tauri Commands
// ============================================================================

pub mod commands {
    use super::*;
    use tauri::{AppHandle, Manager};

    #[tauri::command]
    pub async fn toolchain_detect_all(app: AppHandle) -> Result<ToolchainDetectionResult, String> {
        let toolchain_state = app.state::<ToolchainState>();

        // Check cache first
        {
            let manager = toolchain_state.0.lock();
            if let Some(cached) = manager.get_cached_toolchains() {
                return Ok(cached.clone());
            }
        }

        // Run detection in parallel using tokio
        let (node_result, python_result, rust_result) = tokio::join!(
            tokio::task::spawn_blocking(detect_node_toolchains),
            tokio::task::spawn_blocking(detect_python_toolchains),
            tokio::task::spawn_blocking(detect_rust_toolchains),
        );

        let result = ToolchainDetectionResult {
            node_toolchains: node_result.map_err(|e| e.to_string())?,
            python_toolchains: python_result.map_err(|e| e.to_string())?,
            rust_toolchains: rust_result.map_err(|e| e.to_string())?,
        };

        // Cache the result
        {
            let mut manager = toolchain_state.0.lock();
            manager.set_cached_toolchains(result.clone());
        }

        Ok(result)
    }

    #[tauri::command]
    pub async fn toolchain_detect_node() -> Result<Vec<ToolchainInfo>, String> {
        let result = tokio::task::spawn_blocking(detect_node_toolchains)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    #[tauri::command]
    pub async fn toolchain_detect_python() -> Result<Vec<ToolchainInfo>, String> {
        let result = tokio::task::spawn_blocking(detect_python_toolchains)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    #[tauri::command]
    pub async fn toolchain_detect_rust() -> Result<Vec<ToolchainInfo>, String> {
        let result = tokio::task::spawn_blocking(detect_rust_toolchains)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    #[tauri::command]
    pub async fn toolchain_detect_project(
        app: AppHandle,
        project_path: String,
    ) -> Result<ProjectToolchains, String> {
        let path = PathBuf::from(&project_path);

        if !path.exists() {
            return Err("Project path does not exist".to_string());
        }

        let toolchain_state = app.state::<ToolchainState>();

        // First check if we have saved settings
        {
            let manager = toolchain_state.0.lock();
            let saved = manager.get_project_toolchains(&path);
            if saved.node.is_some() || saved.python.is_some() || saved.rust.is_some() {
                return Ok(saved);
            }
        }

        // Detect project-specific settings
        let path_clone = path.clone();
        let project_toolchains = tokio::task::spawn_blocking(move || {
            let mut toolchains = ProjectToolchains::default();

            // Detect project venv
            if let Some(venv) = detect_project_venv(&path_clone) {
                toolchains.python = Some(venv.path);
            }

            // Detect project Node version
            if let Some(version) = detect_project_node_version(&path_clone) {
                toolchains.node = Some(version);
            }

            // Detect project Rust toolchain
            if let Some(toolchain) = detect_project_rust_toolchain(&path_clone) {
                toolchains.rust = Some(toolchain);
            }

            toolchains
        })
        .await
        .map_err(|e| e.to_string())?;

        Ok(project_toolchains)
    }

    #[tauri::command]
    pub async fn toolchain_set_project(
        app: AppHandle,
        project_path: String,
        kind: ToolchainKind,
        toolchain_path: Option<String>,
    ) -> Result<(), String> {
        let toolchain_state = app.state::<ToolchainState>();
        let mut manager = toolchain_state.0.lock();
        manager.set_project_toolchain(PathBuf::from(project_path), kind, toolchain_path);
        Ok(())
    }

    #[tauri::command]
    pub async fn toolchain_get_project(
        app: AppHandle,
        project_path: String,
    ) -> Result<ProjectToolchains, String> {
        let toolchain_state = app.state::<ToolchainState>();
        let manager = toolchain_state.0.lock();
        Ok(manager.get_project_toolchains(&PathBuf::from(project_path)))
    }

    #[tauri::command]
    pub async fn toolchain_clear_cache(app: AppHandle) -> Result<(), String> {
        let toolchain_state = app.state::<ToolchainState>();
        let mut manager = toolchain_state.0.lock();
        manager.clear_cache();
        Ok(())
    }

    #[tauri::command]
    pub async fn toolchain_get_env_for_project(
        app: AppHandle,
        project_path: String,
    ) -> Result<HashMap<String, String>, String> {
        let toolchain_state = app.state::<ToolchainState>();
        let manager = toolchain_state.0.lock();
        let toolchains = manager.get_project_toolchains(&PathBuf::from(&project_path));

        let mut env = HashMap::new();

        // Set up PATH modifications based on selected toolchains
        if let Some(node_path) = &toolchains.node {
            let node_dir = PathBuf::from(node_path)
                .parent()
                .map(|p| p.to_string_lossy().to_string());
            if let Some(dir) = node_dir {
                env.insert("NODE_PATH".to_string(), dir);
            }
        }

        if let Some(python_path) = &toolchains.python {
            let python_dir = PathBuf::from(python_path)
                .parent()
                .map(|p| p.to_string_lossy().to_string());
            if let Some(dir) = python_dir {
                env.insert("PYTHON_PATH".to_string(), dir);
                // Set virtual env if applicable
                if let Some(venv_dir) = PathBuf::from(python_path).parent().and_then(|p| p.parent())
                {
                    env.insert(
                        "VIRTUAL_ENV".to_string(),
                        venv_dir.to_string_lossy().to_string(),
                    );
                }
            }
        }

        if let Some(rust_toolchain) = &toolchains.rust {
            env.insert("RUSTUP_TOOLCHAIN".to_string(), rust_toolchain.clone());
        }

        Ok(env)
    }
}
