//! LSP server auto-detection
//!
//! Detects installed language servers for common languages and provides
//! configuration for starting them.

use serde::{Deserialize, Serialize};
use tracing::info;

/// Result of auto-detecting an LSP server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerAutodetectResult {
    pub language: String,
    pub server_name: String,
    pub command: String,
    pub args: Vec<String>,
    pub file_extensions: Vec<String>,
    pub installed: bool,
}

/// Check if a command exists on PATH
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

/// Detect available LSP servers for common languages
fn detect_servers() -> Vec<LspServerAutodetectResult> {
    let mut results = Vec::new();

    let ts_servers = [
        ("typescript-language-server", vec!["--stdio"]),
        ("vtsls", vec!["--stdio"]),
    ];
    for (cmd, args) in &ts_servers {
        results.push(LspServerAutodetectResult {
            language: "typescript".to_string(),
            server_name: cmd.to_string(),
            command: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            file_extensions: vec!["ts".into(), "tsx".into(), "js".into(), "jsx".into()],
            installed: command_exists(cmd),
        });
    }

    let py_servers = [
        ("pylsp", vec![]),
        ("pyright-langserver", vec!["--stdio"]),
        ("python-lsp-server", vec![]),
    ];
    for (cmd, args) in &py_servers {
        results.push(LspServerAutodetectResult {
            language: "python".to_string(),
            server_name: cmd.to_string(),
            command: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            file_extensions: vec!["py".into(), "pyi".into()],
            installed: command_exists(cmd),
        });
    }

    results.push(LspServerAutodetectResult {
        language: "rust".to_string(),
        server_name: "rust-analyzer".to_string(),
        command: "rust-analyzer".to_string(),
        args: vec![],
        file_extensions: vec!["rs".into()],
        installed: command_exists("rust-analyzer"),
    });

    results.push(LspServerAutodetectResult {
        language: "go".to_string(),
        server_name: "gopls".to_string(),
        command: "gopls".to_string(),
        args: vec!["serve".to_string()],
        file_extensions: vec!["go".into()],
        installed: command_exists("gopls"),
    });

    results.push(LspServerAutodetectResult {
        language: "java".to_string(),
        server_name: "jdtls".to_string(),
        command: "jdtls".to_string(),
        args: vec![],
        file_extensions: vec!["java".into()],
        installed: command_exists("jdtls"),
    });

    let cpp_servers: [(&str, Vec<&str>); 2] = [("clangd", vec![]), ("ccls", vec![])];
    for (cmd, args) in &cpp_servers {
        results.push(LspServerAutodetectResult {
            language: "cpp".to_string(),
            server_name: cmd.to_string(),
            command: cmd.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            file_extensions: vec![
                "c".into(),
                "cpp".into(),
                "h".into(),
                "hpp".into(),
                "cc".into(),
            ],
            installed: command_exists(cmd),
        });
    }

    results
}

/// Detect available LSP servers on the system
#[tauri::command]
pub async fn lsp_detect_servers() -> Result<Vec<LspServerAutodetectResult>, String> {
    let results = tokio::task::spawn_blocking(detect_servers)
        .await
        .map_err(|e| format!("Detection task failed: {}", e))?;

    let installed_count = results.iter().filter(|r| r.installed).count();
    info!(
        "Detected {} installed LSP servers out of {} checked",
        installed_count,
        results.len()
    );

    Ok(results)
}

/// Get auto-detected LSP servers that are installed and ready to use
#[tauri::command]
pub async fn lsp_get_installed_servers() -> Result<Vec<LspServerAutodetectResult>, String> {
    let results = tokio::task::spawn_blocking(detect_servers)
        .await
        .map_err(|e| format!("Detection task failed: {}", e))?;

    Ok(results.into_iter().filter(|r| r.installed).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_servers_returns_expected_languages() {
        let results = detect_servers();
        let languages: Vec<&str> = results.iter().map(|r| r.language.as_str()).collect();
        assert!(languages.contains(&"typescript"));
        assert!(languages.contains(&"python"));
        assert!(languages.contains(&"rust"));
        assert!(languages.contains(&"go"));
        assert!(languages.contains(&"java"));
        assert!(languages.contains(&"cpp"));
    }

    #[test]
    fn test_server_configs_have_valid_data() {
        let results = detect_servers();
        for result in &results {
            assert!(!result.language.is_empty());
            assert!(!result.server_name.is_empty());
            assert!(!result.command.is_empty());
            assert!(!result.file_extensions.is_empty());
        }
    }
}
