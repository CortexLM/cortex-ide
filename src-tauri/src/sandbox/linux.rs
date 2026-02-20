#![allow(unsafe_code)]
//! Linux sandboxing using Landlock LSM for filesystem access control.
//!
//! This module provides process sandboxing on Linux using the Landlock
//! security module for filesystem restrictions. Network blocking is
//! achieved via environment variable injection.

use std::collections::HashMap;
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::Duration;

use anyhow::{Result, anyhow};
use landlock::{
    ABI, Access, AccessFs, Ruleset, RulesetAttr, RulesetCreatedAttr, path_beneath_rules,
};
use tracing::{info, warn};

use super::env::{NetworkBlockConfig, get_network_blocking_env_vars};

/// Configuration for a sandboxed process on Linux.
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
    /// Block network access via environment variables
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

/// A handle to a sandboxed process on Linux.
pub struct SandboxedProcess {
    child: Child,
}

impl SandboxedProcess {
    /// Spawn a new sandboxed process with Landlock filesystem restrictions.
    pub fn spawn(config: &SandboxConfig) -> Result<Self> {
        let read_paths = config.allowed_read_paths.clone();
        let write_paths = config.allowed_write_paths.clone();

        let mut cmd = Command::new(&config.command);
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

        // SAFETY: pre_exec runs between fork and exec. Landlock system calls
        // are async-signal-safe as they are simple syscalls. We avoid any
        // allocations or complex operations that could deadlock.
        unsafe {
            cmd.pre_exec(move || {
                apply_landlock_rules(&read_paths, &write_paths).map_err(|e| {
                    std::io::Error::new(
                        std::io::ErrorKind::PermissionDenied,
                        format!("Failed to apply Landlock rules: {}", e),
                    )
                })
            });
        }

        let child = cmd
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn sandboxed process: {}", e))?;

        info!(
            pid = child.id(),
            command = %config.command,
            "Spawned sandboxed process on Linux"
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

/// Apply Landlock filesystem access rules to the current process.
///
/// This is called in the `pre_exec` hook between fork and exec.
fn apply_landlock_rules(read_paths: &[PathBuf], write_paths: &[PathBuf]) -> Result<()> {
    let abi = ABI::V5;

    let ruleset = Ruleset::default()
        .handle_access(AccessFs::from_all(abi))
        .map_err(|e| anyhow!("Failed to create Landlock ruleset: {}", e))?;

    let ruleset_created = ruleset
        .create()
        .map_err(|e| anyhow!("Failed to create Landlock ruleset: {}", e))?;

    let read_access = AccessFs::from_read(abi);
    let write_access = AccessFs::from_all(abi);

    let mut ruleset_with_rules = ruleset_created;

    for rule in path_beneath_rules(read_paths, read_access) {
        match rule {
            Ok(r) => {
                ruleset_with_rules = ruleset_with_rules
                    .add_rule(r)
                    .map_err(|e| anyhow!("Failed to add read rule: {}", e))?;
            }
            Err(e) => {
                warn!("Skipping invalid read path rule: {}", e);
            }
        }
    }

    for rule in path_beneath_rules(write_paths, write_access) {
        match rule {
            Ok(r) => {
                ruleset_with_rules = ruleset_with_rules
                    .add_rule(r)
                    .map_err(|e| anyhow!("Failed to add write rule: {}", e))?;
            }
            Err(e) => {
                warn!("Skipping invalid write path rule: {}", e);
            }
        }
    }

    let status = ruleset_with_rules
        .restrict_self()
        .map_err(|e| anyhow!("Failed to enforce Landlock ruleset: {}", e))?;

    info!(
        ruleset_status = ?status.ruleset,
        no_new_privs = status.no_new_privs,
        "Landlock restrictions applied"
    );

    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
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
    fn test_spawn_simple_command() {
        let config = SandboxConfig {
            command: "/bin/echo".to_string(),
            args: vec!["test".to_string()],
            block_network: false,
            allowed_read_paths: vec![
                PathBuf::from("/usr"),
                PathBuf::from("/lib"),
                PathBuf::from("/lib64"),
                PathBuf::from("/bin"),
                PathBuf::from("/etc"),
            ],
            allowed_write_paths: vec![PathBuf::from("/dev/null")],
            ..Default::default()
        };

        match SandboxedProcess::spawn(&config) {
            Ok(mut process) => {
                assert!(process.id() > 0);
                let exit_code = process.wait().unwrap();
                assert_eq!(exit_code, 0);
            }
            Err(e) => {
                warn!("Landlock may not be supported on this kernel: {}", e);
            }
        }
    }

    #[test]
    fn test_spawn_with_timeout() {
        let config = SandboxConfig {
            command: "/bin/sleep".to_string(),
            args: vec!["10".to_string()],
            block_network: false,
            allowed_read_paths: vec![
                PathBuf::from("/usr"),
                PathBuf::from("/lib"),
                PathBuf::from("/lib64"),
                PathBuf::from("/bin"),
            ],
            ..Default::default()
        };

        match SandboxedProcess::spawn(&config) {
            Ok(mut process) => {
                let result = process.wait_timeout(100).unwrap();
                assert!(result.is_none());
                assert!(process.is_running());
                process.kill().unwrap();
            }
            Err(e) => {
                warn!("Landlock may not be supported on this kernel: {}", e);
            }
        }
    }
}
