//! Environment variable manipulation for network blocking in sandbox.
//!
//! This module provides soft network blocking by setting environment variables
//! that common tools respect (HTTP_PROXY, NPM_CONFIG_OFFLINE, etc.).

use std::collections::HashMap;

/// Configuration for network blocking via environment variables.
#[derive(Debug, Clone, Default)]
pub struct NetworkBlockConfig {
    /// Block HTTP/HTTPS via proxy pointing to closed port
    pub block_http: bool,
    /// Block pip package downloads
    pub block_pip: bool,
    /// Block npm package downloads
    pub block_npm: bool,
    /// Block cargo network access
    pub block_cargo: bool,
    /// Block git SSH access
    pub block_git_ssh: bool,
}

impl NetworkBlockConfig {
    /// Create config that blocks all network access.
    pub fn block_all() -> Self {
        Self {
            block_http: true,
            block_pip: true,
            block_npm: true,
            block_cargo: true,
            block_git_ssh: true,
        }
    }
}

/// Get environment variables that block network access.
///
/// These variables configure common tools to either use an invalid proxy
/// or operate in offline mode.
pub fn get_network_blocking_env_vars(config: &NetworkBlockConfig) -> HashMap<String, String> {
    let mut vars = HashMap::new();

    if config.block_http {
        vars.insert("HTTP_PROXY".to_string(), "http://127.0.0.1:9".to_string());
        vars.insert("HTTPS_PROXY".to_string(), "http://127.0.0.1:9".to_string());
        vars.insert("http_proxy".to_string(), "http://127.0.0.1:9".to_string());
        vars.insert("https_proxy".to_string(), "http://127.0.0.1:9".to_string());
        vars.insert("NO_PROXY".to_string(), "".to_string());
        vars.insert("no_proxy".to_string(), "".to_string());
    }

    if config.block_pip {
        vars.insert("PIP_NO_INDEX".to_string(), "1".to_string());
        vars.insert("PIP_DISABLE_PIP_VERSION_CHECK".to_string(), "1".to_string());
    }

    if config.block_npm {
        vars.insert("NPM_CONFIG_OFFLINE".to_string(), "true".to_string());
        vars.insert("YARN_OFFLINE".to_string(), "true".to_string());
    }

    if config.block_cargo {
        vars.insert("CARGO_NET_OFFLINE".to_string(), "true".to_string());
    }

    if config.block_git_ssh {
        #[cfg(windows)]
        vars.insert("GIT_SSH_COMMAND".to_string(), "cmd /c exit 1".to_string());
        #[cfg(not(windows))]
        vars.insert("GIT_SSH_COMMAND".to_string(), "false".to_string());
    }

    vars
}

/// Create stub executables that fail immediately for network tools.
///
/// This creates .bat files that exit with error, placed in a directory
/// that should be prepended to PATH.
#[cfg(windows)]
pub fn create_stub_executables(stub_dir: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(stub_dir)?;

    let stub_content = "@echo off\r\nexit /b 1\r\n";

    let stubs = [
        "ssh.bat", "ssh.cmd", "scp.bat", "scp.cmd", "sftp.bat", "sftp.cmd",
    ];

    for stub in &stubs {
        std::fs::write(stub_dir.join(stub), stub_content)?;
    }

    Ok(())
}

/// Prepend a directory to PATH environment variable.
#[cfg(windows)]
pub fn prepend_to_path(env: &mut HashMap<String, String>, dir: &std::path::Path) {
    let dir_str = dir.to_string_lossy();
    if let Some(existing) = env.get("PATH") {
        env.insert("PATH".to_string(), format!("{};{}", dir_str, existing));
    } else {
        env.insert("PATH".to_string(), dir_str.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_block_config() {
        let config = NetworkBlockConfig::block_all();
        let vars = get_network_blocking_env_vars(&config);

        assert_eq!(
            vars.get("HTTP_PROXY"),
            Some(&"http://127.0.0.1:9".to_string())
        );
        assert_eq!(vars.get("CARGO_NET_OFFLINE"), Some(&"true".to_string()));
    }

    #[test]
    fn test_partial_block() {
        let config = NetworkBlockConfig {
            block_http: true,
            block_cargo: true,
            ..Default::default()
        };
        let vars = get_network_blocking_env_vars(&config);

        assert!(vars.contains_key("HTTP_PROXY"));
        assert!(vars.contains_key("CARGO_NET_OFFLINE"));
        assert!(!vars.contains_key("NPM_CONFIG_OFFLINE"));
    }
}
