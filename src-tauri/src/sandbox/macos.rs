//! macOS sandboxing using sandbox-exec with Seatbelt profiles.
//!
//! This module provides process sandboxing on macOS using Apple's
//! `sandbox-exec` command with dynamically generated Seatbelt profiles.
//! Network blocking is achieved via both Seatbelt deny rules and
//! environment variable injection.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::Duration;

use anyhow::{Result, anyhow};
use tracing::{info, warn};

use super::env::{NetworkBlockConfig, get_network_blocking_env_vars};

/// Configuration for a sandboxed process on macOS.
#[derive(Debug, Clone)]
pub struct SandboxConfig {
    /// Command to execute
    pub command: String,
    /// Arguments for the command
    pub args: Vec<String>,
    /// Working directory
    pub working_dir: Option<String>,
    /// Additional environment variables
    pub env: HashMap<String, String>,
    /// Block network access
    pub block_network: bool,
    /// Paths allowed for read-only access
    pub allowed_read_paths: Vec<PathBuf>,
    /// Paths allowed for read-write access
    pub allowed_write_paths: Vec<PathBuf>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            working_dir: None,
            env: HashMap::new(),
            block_network: true,
            allowed_read_paths: Vec::new(),
            allowed_write_paths: Vec::new(),
        }
    }
}

/// A handle to a sandboxed process on macOS.
pub struct SandboxedProcess {
    child: Child,
}

impl SandboxedProcess {
    /// Spawn a new sandboxed process using sandbox-exec with a Seatbelt profile.
    pub fn spawn(config: &SandboxConfig) -> Result<Self> {
        let profile = generate_seatbelt_profile(config);

        let mut cmd = Command::new("sandbox-exec");
        cmd.arg("-p").arg(&profile);
        cmd.arg(&config.command);
        cmd.args(&config.args);

        if let Some(ref dir) = config.working_dir {
            cmd.current_dir(dir);
        }

        cmd.env_clear();
        for (key, value) in std::env::vars() {
            cmd.env(&key, &value);
        }

        if config.block_network {
            let net_vars = get_network_blocking_env_vars(&NetworkBlockConfig::block_all());
            for (key, value) in &net_vars {
                cmd.env(key, value);
            }
        }

        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        let child = cmd
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn sandboxed process via sandbox-exec: {}", e))?;

        info!(
            pid = child.id(),
            command = %config.command,
            "Spawned sandboxed process on macOS"
        );

        Ok(Self { child })
    }

    /// Wait for the process to exit and return the exit code.
    pub fn wait(&mut self) -> Result<i32> {
        let status = self
            .child
            .wait()
            .map_err(|e| anyhow!("Failed to wait for process: {}", e))?;
        Ok(status.code().unwrap_or(-1))
    }

    /// Wait for the process with a timeout in milliseconds.
    ///
    /// Returns `Ok(Some(exit_code))` if the process exited within the timeout,
    /// `Ok(None)` if the timeout expired.
    pub fn wait_timeout(&mut self, timeout_ms: u32) -> Result<Option<i32>> {
        let duration = Duration::from_millis(timeout_ms as u64);
        let start = std::time::Instant::now();

        loop {
            match self.child.try_wait() {
                Ok(Some(status)) => return Ok(Some(status.code().unwrap_or(-1))),
                Ok(None) => {
                    if start.elapsed() >= duration {
                        return Ok(None);
                    }
                    std::thread::sleep(Duration::from_millis(10));
                }
                Err(e) => return Err(anyhow!("Failed to check process status: {}", e)),
            }
        }
    }

    /// Terminate the process.
    pub fn kill(&mut self) -> Result<()> {
        self.child
            .kill()
            .map_err(|e| anyhow!("Failed to kill process: {}", e))
    }

    /// Check if the process is still running.
    pub fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    /// Get the process ID.
    pub fn id(&self) -> u32 {
        self.child.id()
    }
}

/// Generate a Seatbelt profile string for sandbox-exec.
///
/// The profile denies all operations by default, then selectively allows
/// read and write access to specified paths. Network access is denied
/// if `block_network` is set.
fn generate_seatbelt_profile(config: &SandboxConfig) -> String {
    let mut profile = String::new();

    profile.push_str("(version 1)\n");
    profile.push_str("(deny default)\n");
    profile.push_str("(allow process-exec)\n");
    profile.push_str("(allow process-fork)\n");
    profile.push_str("(allow sysctl-read)\n");
    profile.push_str("(allow mach-lookup)\n");
    profile.push_str("(allow signal)\n");

    for path in &config.allowed_read_paths {
        let path_str = path.to_string_lossy();
        let escaped = escape_seatbelt_string(&path_str);
        profile.push_str(&format!("(allow file-read* (subpath \"{}\"))\n", escaped));
    }

    for path in &config.allowed_write_paths {
        let path_str = path.to_string_lossy();
        let escaped = escape_seatbelt_string(&path_str);
        profile.push_str(&format!("(allow file-read* (subpath \"{}\"))\n", escaped));
        profile.push_str(&format!("(allow file-write* (subpath \"{}\"))\n", escaped));
    }

    if config.block_network {
        profile.push_str("(deny network*)\n");
    } else {
        profile.push_str("(allow network*)\n");
    }

    profile
}

/// Escape a string for use in a Seatbelt profile.
fn escape_seatbelt_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_sandbox_config_default() {
        let config = SandboxConfig::default();
        assert!(config.command.is_empty());
        assert!(config.args.is_empty());
        assert!(config.working_dir.is_none());
        assert!(config.env.is_empty());
        assert!(config.block_network);
        assert!(config.allowed_read_paths.is_empty());
        assert!(config.allowed_write_paths.is_empty());
    }

    #[test]
    fn test_sandbox_config_creation() {
        let config = SandboxConfig {
            command: "/bin/echo".to_string(),
            args: vec!["hello".to_string()],
            working_dir: Some("/tmp".to_string()),
            env: HashMap::from([("KEY".to_string(), "VALUE".to_string())]),
            block_network: false,
            allowed_read_paths: vec![PathBuf::from("/usr"), PathBuf::from("/lib")],
            allowed_write_paths: vec![PathBuf::from("/tmp")],
        };

        assert_eq!(config.command, "/bin/echo");
        assert_eq!(config.args.len(), 1);
        assert_eq!(config.allowed_read_paths.len(), 2);
        assert_eq!(config.allowed_write_paths.len(), 1);
    }

    #[test]
    fn test_seatbelt_profile_generation() {
        let config = SandboxConfig {
            command: "/bin/echo".to_string(),
            args: vec!["test".to_string()],
            block_network: true,
            allowed_read_paths: vec![PathBuf::from("/usr"), PathBuf::from("/lib")],
            allowed_write_paths: vec![PathBuf::from("/tmp")],
            ..Default::default()
        };

        let profile = generate_seatbelt_profile(&config);

        assert!(profile.contains("(version 1)"));
        assert!(profile.contains("(deny default)"));
        assert!(profile.contains("(allow file-read* (subpath \"/usr\"))"));
        assert!(profile.contains("(allow file-read* (subpath \"/lib\"))"));
        assert!(profile.contains("(allow file-read* (subpath \"/tmp\"))"));
        assert!(profile.contains("(allow file-write* (subpath \"/tmp\"))"));
        assert!(profile.contains("(deny network*)"));
    }

    #[test]
    fn test_seatbelt_profile_network_allowed() {
        let config = SandboxConfig {
            command: "/bin/echo".to_string(),
            block_network: false,
            ..Default::default()
        };

        let profile = generate_seatbelt_profile(&config);

        assert!(profile.contains("(allow network*)"));
        assert!(!profile.contains("(deny network*)"));
    }

    #[test]
    fn test_escape_seatbelt_string() {
        assert_eq!(escape_seatbelt_string("/simple/path"), "/simple/path");
        assert_eq!(
            escape_seatbelt_string("/path/with \"quotes\""),
            "/path/with \\\"quotes\\\""
        );
        assert_eq!(
            escape_seatbelt_string("/path\\with\\backslashes"),
            "/path\\\\with\\\\backslashes"
        );
    }
}
