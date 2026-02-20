//! Sandbox utilities for Cortex GUI
//!
//! This module provides platform-specific sandboxing capabilities:
//! - **Windows**: Capability SID generation, restricted tokens, ACLs, user management
//! - **Linux**: Landlock LSM filesystem access control
//! - **macOS**: Seatbelt profiles via sandbox-exec
//!
//! Cross-platform features:
//! - Environment variable handling for network blocking
//! - Tauri commands for sandboxed process management

#[cfg(windows)]
mod acl;
#[cfg(windows)]
mod audit;
#[cfg(windows)]
mod cap;
pub mod commands;
#[cfg(windows)]
mod dpapi;
#[cfg(windows)]
mod elevated_impl;
mod env;
#[cfg(windows)]
mod identity;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod process;
#[cfg(windows)]
mod sandbox_users;
#[cfg(windows)]
mod token;
#[cfg(windows)]
mod winutil;

#[cfg(windows)]
pub use acl::*;
#[cfg(windows)]
pub use audit::*;
#[cfg(windows)]
pub use cap::*;
#[cfg(windows)]
pub use dpapi::*;

#[cfg(windows)]
pub use identity::*;
#[cfg(windows)]
pub use process::*;
#[cfg(windows)]
pub use sandbox_users::*;
#[cfg(windows)]
pub use token::*;
#[cfg(windows)]
pub use winutil::*;

use std::collections::HashMap;
use std::path::PathBuf;

/// Cross-platform sandbox configuration for spawning restricted processes.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

/// Cross-platform sandboxed process handle.
///
/// Delegates to platform-specific implementations for actual sandboxing.
pub struct SandboxedProcess {
    #[cfg(target_os = "linux")]
    inner: linux::SandboxedProcess,
    #[cfg(target_os = "macos")]
    inner: macos::SandboxedProcess,
    #[cfg(windows)]
    inner: process::SandboxProcess,
    #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
    _unsupported: std::convert::Infallible,
}

impl SandboxedProcess {
    /// Spawn a new sandboxed process using the platform-specific implementation.
    pub fn spawn(config: &SandboxConfig) -> Result<Self, String> {
        #[cfg(target_os = "linux")]
        {
            let platform_config = linux::SandboxConfig {
                command: config.command.clone(),
                args: config.args.clone(),
                working_dir: config.working_dir.clone(),
                env: config.env.clone(),
                block_network: config.block_network,
                allowed_read_paths: config.allowed_read_paths.clone(),
                allowed_write_paths: config.allowed_write_paths.clone(),
            };
            let inner = linux::SandboxedProcess::spawn(&platform_config)
                .map_err(|e| format!("Linux sandbox spawn failed: {}", e))?;
            Ok(Self { inner })
        }

        #[cfg(target_os = "macos")]
        {
            let platform_config = macos::SandboxConfig {
                command: config.command.clone(),
                args: config.args.clone(),
                working_dir: config.working_dir.clone(),
                env: config.env.clone(),
                block_network: config.block_network,
                allowed_read_paths: config.allowed_read_paths.clone(),
                allowed_write_paths: config.allowed_write_paths.clone(),
            };
            let inner = macos::SandboxedProcess::spawn(&platform_config)
                .map_err(|e| format!("macOS sandbox spawn failed: {}", e))?;
            Ok(Self { inner })
        }

        #[cfg(windows)]
        {
            let platform_config = process::SandboxProcessConfig {
                command: config.command.clone(),
                args: config.args.clone(),
                working_dir: config.working_dir.clone(),
                env: config.env.clone(),
                block_network: config.block_network,
                new_console: false,
            };
            let inner = process::SandboxProcess::spawn(&platform_config)
                .map_err(|e| format!("Windows sandbox spawn failed: {}", e))?;
            Ok(Self { inner })
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
        {
            let _ = config;
            Err("Sandboxing is not supported on this platform".to_string())
        }
    }

    /// Wait for the process to exit and return the exit code.
    pub fn wait(&mut self) -> Result<i32, String> {
        #[cfg(target_os = "linux")]
        {
            self.inner.wait().map_err(|e| format!("Wait failed: {}", e))
        }

        #[cfg(target_os = "macos")]
        {
            self.inner.wait().map_err(|e| format!("Wait failed: {}", e))
        }

        #[cfg(windows)]
        {
            self.inner.wait().map_err(|e| format!("Wait failed: {}", e))
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
        {
            Err("Sandboxing is not supported on this platform".to_string())
        }
    }

    /// Wait for the process with a timeout in milliseconds.
    pub fn wait_timeout(&mut self, timeout_ms: u32) -> Result<Option<i32>, String> {
        #[cfg(target_os = "linux")]
        {
            self.inner
                .wait_timeout(timeout_ms)
                .map_err(|e| format!("Wait timeout failed: {}", e))
        }

        #[cfg(target_os = "macos")]
        {
            self.inner
                .wait_timeout(timeout_ms)
                .map_err(|e| format!("Wait timeout failed: {}", e))
        }

        #[cfg(windows)]
        {
            self.inner
                .wait_timeout(timeout_ms)
                .map_err(|e| format!("Wait timeout failed: {}", e))
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
        {
            let _ = timeout_ms;
            Err("Sandboxing is not supported on this platform".to_string())
        }
    }

    /// Terminate the process.
    pub fn kill(&mut self) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            self.inner.kill().map_err(|e| format!("Kill failed: {}", e))
        }

        #[cfg(target_os = "macos")]
        {
            self.inner.kill().map_err(|e| format!("Kill failed: {}", e))
        }

        #[cfg(windows)]
        {
            self.inner.kill().map_err(|e| format!("Kill failed: {}", e))
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
        {
            Err("Sandboxing is not supported on this platform".to_string())
        }
    }

    /// Check if the process is still running.
    pub fn is_running(&mut self) -> bool {
        #[cfg(target_os = "linux")]
        {
            self.inner.is_running()
        }

        #[cfg(target_os = "macos")]
        {
            self.inner.is_running()
        }

        #[cfg(windows)]
        {
            self.inner.is_running()
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
        {
            false
        }
    }

    /// Get the process ID.
    pub fn id(&self) -> u32 {
        #[cfg(target_os = "linux")]
        {
            self.inner.id()
        }

        #[cfg(target_os = "macos")]
        {
            self.inner.id()
        }

        #[cfg(windows)]
        {
            self.inner.id()
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
        {
            0
        }
    }
}
