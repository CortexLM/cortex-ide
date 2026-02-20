//! Debug adapter auto-detection
//!
//! Detects installed debug adapters for common languages.

use serde::{Deserialize, Serialize};
use tracing::info;

/// Result of auto-detecting a debug adapter
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugAdapterInfo {
    pub language: String,
    pub adapter_name: String,
    pub adapter_type: String,
    pub command: String,
    pub args: Vec<String>,
    pub installed: bool,
}

fn command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

fn detect_adapters() -> Vec<DebugAdapterInfo> {
    vec![
        // Node.js debug adapter (built-in)
        DebugAdapterInfo {
            language: "javascript".to_string(),
            adapter_name: "Node.js Debugger".to_string(),
            adapter_type: "node".to_string(),
            command: "node".to_string(),
            args: vec!["--inspect-brk".to_string()],
            installed: command_exists("node"),
        },
        // Python - debugpy
        DebugAdapterInfo {
            language: "python".to_string(),
            adapter_name: "debugpy".to_string(),
            adapter_type: "debugpy".to_string(),
            command: "python".to_string(),
            args: vec!["-m".to_string(), "debugpy.adapter".to_string()],
            installed: command_exists("python") || command_exists("python3"),
        },
        // Rust/C/C++ - codelldb
        DebugAdapterInfo {
            language: "rust".to_string(),
            adapter_name: "CodeLLDB".to_string(),
            adapter_type: "lldb".to_string(),
            command: "codelldb".to_string(),
            args: vec!["--port".to_string(), "0".to_string()],
            installed: command_exists("codelldb"),
        },
        // C/C++ - cppdbg (GDB/LLDB via cpptools)
        DebugAdapterInfo {
            language: "cpp".to_string(),
            adapter_name: "C/C++ (GDB/LLDB)".to_string(),
            adapter_type: "cppdbg".to_string(),
            command: "gdb".to_string(),
            args: vec![],
            installed: command_exists("gdb") || command_exists("lldb"),
        },
        // Go - Delve
        DebugAdapterInfo {
            language: "go".to_string(),
            adapter_name: "Delve".to_string(),
            adapter_type: "go".to_string(),
            command: "dlv".to_string(),
            args: vec!["dap".to_string()],
            installed: command_exists("dlv"),
        },
    ]
}

/// Detect available debug adapters on the system
#[tauri::command]
pub async fn debug_detect_adapters() -> Result<Vec<DebugAdapterInfo>, String> {
    let results = tokio::task::spawn_blocking(detect_adapters)
        .await
        .map_err(|e| format!("Detection task failed: {}", e))?;

    let installed_count = results.iter().filter(|r| r.installed).count();
    info!(
        "Detected {} installed debug adapters out of {} checked",
        installed_count,
        results.len()
    );

    Ok(results)
}

/// Get only installed debug adapters
#[tauri::command]
pub async fn debug_get_installed_adapters() -> Result<Vec<DebugAdapterInfo>, String> {
    let results = tokio::task::spawn_blocking(detect_adapters)
        .await
        .map_err(|e| format!("Detection task failed: {}", e))?;

    Ok(results.into_iter().filter(|r| r.installed).collect())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_adapters_returns_expected_languages() {
        let results = detect_adapters();
        let languages: Vec<&str> = results.iter().map(|r| r.language.as_str()).collect();
        assert!(languages.contains(&"javascript"));
        assert!(languages.contains(&"python"));
        assert!(languages.contains(&"rust"));
        assert!(languages.contains(&"cpp"));
        assert!(languages.contains(&"go"));
    }

    #[test]
    fn test_adapter_configs_have_valid_data() {
        let results = detect_adapters();
        for result in &results {
            assert!(!result.language.is_empty());
            assert!(!result.adapter_name.is_empty());
            assert!(!result.adapter_type.is_empty());
            assert!(!result.command.is_empty());
        }
    }

    #[test]
    fn test_debug_adapter_info_serialization() {
        let info = DebugAdapterInfo {
            language: "python".to_string(),
            adapter_name: "debugpy".to_string(),
            adapter_type: "debugpy".to_string(),
            command: "python".to_string(),
            args: vec!["-m".to_string(), "debugpy.adapter".to_string()],
            installed: true,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: DebugAdapterInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.adapter_type, "debugpy");
    }
}
