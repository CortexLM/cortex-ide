//! WSL (Windows Subsystem for Linux) integration for Cortex Desktop
//!
//! This module provides WSL support including:
//! - Detection of installed WSL distributions
//! - Connection management for WSL environments
//! - Command execution in WSL distributions
//! - Terminal integration with WSL shells
//!
//! SECURITY: All user-provided paths are properly escaped before being passed
//! to shell commands to prevent command injection attacks.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::info;

/// Shell-escape a path for safe use in shell commands.
/// Uses single quotes and escapes any embedded single quotes.
///
/// SECURITY: This function ensures that paths containing special characters
/// cannot be used for command injection.
fn shell_escape_path(path: &str) -> String {
    // Use single quotes and escape any single quotes within the string
    // This is the safest method for POSIX shells
    format!("'{}'", path.replace('\'', "'\\''"))
}

/// Errors that can occur during WSL operations
#[derive(Error, Debug)]
pub enum WSLError {
    #[error("WSL is not available on this system")]
    NotAvailable,
    #[error("WSL distribution not found: {0}")]
    DistroNotFound(String),
    #[error("Failed to execute WSL command: {0}")]
    ExecutionFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("WSL operation failed: {0}")]
    OperationFailed(String),
}

impl From<WSLError> for String {
    fn from(e: WSLError) -> String {
        e.to_string()
    }
}

/// WSL distribution version
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum WSLVersion {
    WSL1 = 1,
    WSL2 = 2,
}

/// Status of a WSL connection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WSLConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

/// Information about a WSL distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSLDistro {
    pub name: String,
    pub version: u8,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    pub status: WSLConnectionStatus,
    pub error: Option<String>,
    #[serde(rename = "basePath")]
    pub base_path: Option<String>,
}

/// Result of WSL detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSLDetectionResult {
    pub available: bool,
    pub distros: Vec<WSLDistro>,
}

/// Result of WSL connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSLConnectionResult {
    pub base_path: String,
}

/// Result of WSL command execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSLCommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// WSL Manager state
pub struct WSLManager {
    /// Connected distributions with their base paths
    connections: RwLock<HashMap<String, String>>,
}

impl WSLManager {
    pub fn new() -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
        }
    }

    /// Check if WSL is available on the system
    pub fn is_available() -> bool {
        #[cfg(target_os = "windows")]
        {
            crate::process_utils::command("wsl")
                .arg("--status")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
        #[cfg(not(target_os = "windows"))]
        {
            false
        }
    }

    /// Detect installed WSL distributions
    pub fn detect_distributions() -> Result<WSLDetectionResult, WSLError> {
        #[cfg(target_os = "windows")]
        {
            if !Self::is_available() {
                return Ok(WSLDetectionResult {
                    available: false,
                    distros: Vec::new(),
                });
            }

            // Run wsl --list --quiet to get distribution names
            let output = crate::process_utils::command("wsl")
                .args(["--list", "--quiet"])
                .output()
                .map_err(|e| WSLError::ExecutionFailed(e.to_string()))?;

            if !output.status.success() {
                return Ok(WSLDetectionResult {
                    available: true,
                    distros: Vec::new(),
                });
            }

            // Parse output - WSL outputs in UTF-16LE on Windows
            let stdout = String::from_utf16_lossy(
                &output
                    .stdout
                    .chunks(2)
                    .filter_map(|chunk| {
                        if chunk.len() == 2 {
                            Some(u16::from_le_bytes([chunk[0], chunk[1]]))
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<u16>>(),
            );

            // Get default distro
            let default_output = crate::process_utils::command("wsl")
                .args(["--list", "--verbose"])
                .output()
                .ok();

            let default_distro = default_output.as_ref().and_then(|out| {
                let verbose = String::from_utf16_lossy(
                    &out.stdout
                        .chunks(2)
                        .filter_map(|chunk| {
                            if chunk.len() == 2 {
                                Some(u16::from_le_bytes([chunk[0], chunk[1]]))
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<u16>>(),
                );
                // Find line with '*' which indicates default
                verbose.lines().find_map(|line| {
                    if line.contains('*') {
                        // Extract distro name from line like "* Ubuntu    Running    2"
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        parts.get(1).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
            });

            // Parse distro versions from verbose output
            let versions: HashMap<String, u8> = default_output
                .map(|out| {
                    let verbose = String::from_utf16_lossy(
                        &out.stdout
                            .chunks(2)
                            .filter_map(|chunk| {
                                if chunk.len() == 2 {
                                    Some(u16::from_le_bytes([chunk[0], chunk[1]]))
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<u16>>(),
                    );
                    let mut map = HashMap::new();
                    for line in verbose.lines().skip(1) {
                        // Skip header
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            let name = if parts[0] == "*" {
                                parts.get(1)
                            } else {
                                parts.first()
                            };
                            // Version is typically the last number
                            let version = parts.last().and_then(|v| v.parse::<u8>().ok());
                            if let (Some(n), Some(v)) = (name, version) {
                                map.insert(n.to_string(), v);
                            }
                        }
                    }
                    map
                })
                .unwrap_or_default();

            let distros: Vec<WSLDistro> = stdout
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|name| {
                    let name = name.trim().to_string();
                    let is_default = default_distro.as_ref() == Some(&name);
                    let version = versions.get(&name).copied().unwrap_or(2);
                    WSLDistro {
                        name: name.clone(),
                        version,
                        is_default,
                        status: WSLConnectionStatus::Disconnected,
                        error: None,
                        base_path: None,
                    }
                })
                .collect();

            info!("Detected {} WSL distributions", distros.len());
            Ok(WSLDetectionResult {
                available: true,
                distros,
            })
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(WSLDetectionResult {
                available: false,
                distros: Vec::new(),
            })
        }
    }

    /// Connect to a WSL distribution
    pub async fn connect(&self, _distro_name: &str) -> Result<WSLConnectionResult, WSLError> {
        #[cfg(target_os = "windows")]
        {
            // Verify the distro exists
            let detection = Self::detect_distributions()?;
            if !detection.distros.iter().any(|d| d.name == _distro_name) {
                return Err(WSLError::DistroNotFound(_distro_name.to_string()));
            }

            // Get the home directory in WSL
            let output = crate::process_utils::command("wsl")
                .args(["-d", _distro_name, "--", "echo", "$HOME"])
                .output()
                .map_err(|e| WSLError::ExecutionFailed(e.to_string()))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(WSLError::ExecutionFailed(stderr.to_string()));
            }

            let home_path = String::from_utf8_lossy(&output.stdout).trim().to_string();

            // Convert to Windows path for cross-platform access
            let wsl_path = format!(
                "\\\\wsl$\\{}\\{}",
                _distro_name,
                home_path.trim_start_matches('/')
            );

            // Store connection
            {
                let mut connections = self.connections.write().await;
                connections.insert(_distro_name.to_string(), wsl_path.clone());
            }

            info!("Connected to WSL distribution: {}", _distro_name);
            Ok(WSLConnectionResult {
                base_path: wsl_path,
            })
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err(WSLError::NotAvailable)
        }
    }

    /// Disconnect from a WSL distribution
    pub async fn disconnect(&self, distro_name: &str) -> Result<(), WSLError> {
        let mut connections = self.connections.write().await;
        connections.remove(distro_name);
        info!("Disconnected from WSL distribution: {}", distro_name);
        Ok(())
    }

    /// Execute a command in a WSL distribution
    pub fn execute(
        _distro_name: &str,
        _command: &str,
        _working_dir: Option<&str>,
    ) -> Result<WSLCommandResult, WSLError> {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = crate::process_utils::command("wsl");
            cmd.args(["-d", _distro_name, "--"]);

            if let Some(cwd) = _working_dir {
                // SECURITY: Escape the working directory path to prevent command injection
                let escaped_cwd = shell_escape_path(cwd);
                // NOTE: The command itself is passed as-is because it's intentionally
                // user-provided shell code. Only the working directory is escaped.
                cmd.args(["sh", "-c", &format!("cd {} && {}", escaped_cwd, _command)]);
            } else {
                cmd.args(["sh", "-c", _command]);
            }

            let output = cmd
                .output()
                .map_err(|e| WSLError::ExecutionFailed(e.to_string()))?;

            Ok(WSLCommandResult {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                exit_code: output.status.code().unwrap_or(-1),
            })
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err(WSLError::NotAvailable)
        }
    }

    /// Open a folder in WSL
    pub fn open_folder(_distro_name: &str, _folder_path: &str) -> Result<(), WSLError> {
        #[cfg(target_os = "windows")]
        {
            // Convert WSL path to Windows UNC path if needed
            let windows_path = if _folder_path.starts_with('/') {
                format!(
                    "\\\\wsl$\\{}{}",
                    _distro_name,
                    _folder_path.replace('/', "\\")
                )
            } else {
                _folder_path.to_string()
            };

            // Use explorer to open the folder
            crate::process_utils::command("explorer")
                .arg(&windows_path)
                .spawn()
                .map_err(|e| WSLError::ExecutionFailed(e.to_string()))?;

            info!("Opened folder in WSL: {} -> {}", _folder_path, windows_path);
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err(WSLError::NotAvailable)
        }
    }

    /// Get WSL shell paths for terminal profile detection
    pub fn get_wsl_shells() -> Vec<WSLShellInfo> {
        #[cfg(target_os = "windows")]
        {
            let mut shells = Vec::new();

            if let Ok(detection) = Self::detect_distributions() {
                for distro in detection.distros {
                    // Add bash shell for each distro
                    shells.push(WSLShellInfo {
                        name: format!("{} (WSL)", distro.name),
                        path: format!("wsl.exe -d {} -- bash", distro.name),
                        distro: distro.name.clone(),
                        shell: "bash".to_string(),
                        icon: detect_distro_icon(&distro.name),
                    });

                    // Try to detect if zsh is available
                    if let Ok(result) = Self::execute(&distro.name, "which zsh", None) {
                        if result.exit_code == 0 && !result.stdout.trim().is_empty() {
                            shells.push(WSLShellInfo {
                                name: format!("{} - Zsh (WSL)", distro.name),
                                path: format!("wsl.exe -d {} -- zsh", distro.name),
                                distro: distro.name.clone(),
                                shell: "zsh".to_string(),
                                icon: detect_distro_icon(&distro.name),
                            });
                        }
                    }

                    // Try to detect if fish is available
                    if let Ok(result) = Self::execute(&distro.name, "which fish", None) {
                        if result.exit_code == 0 && !result.stdout.trim().is_empty() {
                            shells.push(WSLShellInfo {
                                name: format!("{} - Fish (WSL)", distro.name),
                                path: format!("wsl.exe -d {} -- fish", distro.name),
                                distro: distro.name.clone(),
                                shell: "fish".to_string(),
                                icon: detect_distro_icon(&distro.name),
                            });
                        }
                    }
                }
            }

            shells
        }

        #[cfg(not(target_os = "windows"))]
        {
            Vec::new()
        }
    }
}

/// Information about a WSL shell for terminal profiles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSLShellInfo {
    pub name: String,
    pub path: String,
    pub distro: String,
    pub shell: String,
    pub icon: String,
}

/// Detect icon based on distro name
fn detect_distro_icon(distro_name: &str) -> String {
    let lower = distro_name.to_lowercase();
    if lower.contains("ubuntu") {
        "ubuntu".to_string()
    } else if lower.contains("debian") {
        "debian".to_string()
    } else if lower.contains("fedora") {
        "fedora".to_string()
    } else if lower.contains("arch") {
        "arch".to_string()
    } else if lower.contains("opensuse") || lower.contains("suse") {
        "suse".to_string()
    } else if lower.contains("alpine") {
        "alpine".to_string()
    } else if lower.contains("kali") {
        "kali".to_string()
    } else {
        "linux".to_string()
    }
}

/// WSL state stored in Tauri app state
#[derive(Clone)]
pub struct WSLState {
    manager: Arc<WSLManager>,
    /// Cached detection result (avoids re-running wsl --list for every new window)
    cached_detection: Arc<RwLock<Option<WSLDetectionResult>>>,
}

impl WSLState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(WSLManager::new()),
            cached_detection: Arc::new(RwLock::new(None)),
        }
    }

    /// Get cached detection result or detect and cache
    pub async fn detect_cached(&self) -> Result<WSLDetectionResult, WSLError> {
        // Fast path: return cached result
        {
            let cache = self.cached_detection.read().await;
            if let Some(ref result) = *cache {
                return Ok(result.clone());
            }
        }

        // Slow path: detect and cache
        let result = WSLManager::detect_distributions()?;
        {
            let mut cache = self.cached_detection.write().await;
            *cache = Some(result.clone());
        }
        Ok(result)
    }
}

// ===== Tauri Commands =====

/// Detect WSL availability and list distributions (uses cache for subsequent calls)
#[tauri::command]
pub async fn wsl_detect(state: tauri::State<'_, WSLState>) -> Result<WSLDetectionResult, String> {
    state.detect_cached().await.map_err(|e| e.to_string())
}

/// Connect to a WSL distribution
#[tauri::command]
pub async fn wsl_connect(
    distro_name: String,
    state: tauri::State<'_, WSLState>,
) -> Result<WSLConnectionResult, String> {
    state
        .manager
        .connect(&distro_name)
        .await
        .map_err(|e| e.to_string())
}

/// Disconnect from a WSL distribution
#[tauri::command]
pub async fn wsl_disconnect(
    distro_name: String,
    state: tauri::State<'_, WSLState>,
) -> Result<(), String> {
    state
        .manager
        .disconnect(&distro_name)
        .await
        .map_err(|e| e.to_string())
}

/// Execute a command in a WSL distribution
#[tauri::command]
pub async fn wsl_execute(
    distro_name: String,
    command: String,
    working_dir: Option<String>,
) -> Result<WSLCommandResult, String> {
    WSLManager::execute(&distro_name, &command, working_dir.as_deref()).map_err(|e| e.to_string())
}

/// Open a folder in a WSL distribution
#[tauri::command]
pub async fn wsl_open_folder(distro_name: String, folder_path: String) -> Result<(), String> {
    WSLManager::open_folder(&distro_name, &folder_path).map_err(|e| e.to_string())
}

/// Open a terminal in a WSL distribution
#[tauri::command]
pub async fn wsl_open_terminal(
    app: AppHandle,
    distro_name: String,
    cwd: Option<String>,
) -> Result<(), String> {
    use crate::terminal::{CreateTerminalOptions, TerminalState};

    let terminal_state = app.state::<TerminalState>();

    // Create terminal with WSL shell
    let shell = format!("wsl.exe -d {}", distro_name);

    let options = CreateTerminalOptions {
        name: Some(format!("{} (WSL)", distro_name)),
        cwd,
        shell: Some(shell),
        env: None,
        cols: None,
        rows: None,
        shell_integration: Some(true),
    };

    terminal_state
        .create_terminal(&app, options)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Get available WSL shells for terminal profiles
#[tauri::command]
pub async fn wsl_get_shells() -> Result<Vec<WSLShellInfo>, String> {
    Ok(WSLManager::get_wsl_shells())
}

/// List WSL distributions (alias for wsl_detect for convenience)
#[tauri::command]
pub async fn wsl_list_distributions() -> Result<Vec<WSLDistro>, String> {
    let result = WSLManager::detect_distributions().map_err(|e| e.to_string())?;
    Ok(result.distros)
}
