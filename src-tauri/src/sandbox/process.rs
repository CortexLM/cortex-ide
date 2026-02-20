#![allow(unsafe_code)]
//! Sandboxed process execution for Windows.
//!
//! This module provides functions to spawn processes with restricted
//! tokens and controlled environment for sandbox isolation.

use anyhow::{Result, anyhow};
use std::collections::HashMap;
use std::ptr;

use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0, WAIT_TIMEOUT};
use windows_sys::Win32::System::Threading::{
    CREATE_NEW_CONSOLE, CREATE_UNICODE_ENVIRONMENT, CreateProcessW, GetExitCodeProcess, INFINITE,
    PROCESS_INFORMATION, STARTUPINFOW, TerminateProcess, WaitForSingleObject,
};

use super::env::{NetworkBlockConfig, get_network_blocking_env_vars};
use super::winutil::{get_last_error, str_to_wide};

/// Configuration for sandboxed process execution.
#[derive(Debug, Clone)]
pub struct SandboxProcessConfig {
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
    /// Create with new console
    pub new_console: bool,
}

impl Default for SandboxProcessConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            working_dir: None,
            env: HashMap::new(),
            block_network: true,
            new_console: false,
        }
    }
}

/// A handle to a sandboxed process.
pub struct SandboxProcess {
    process_handle: HANDLE,
    thread_handle: HANDLE,
    process_id: u32,
}

// SAFETY: Windows HANDLEs are kernel objects that can be safely sent between threads.
// They are not thread-local and can be used from any thread.
unsafe impl Send for SandboxProcess {}
unsafe impl Sync for SandboxProcess {}

impl SandboxProcess {
    /// Spawn a new sandboxed process.
    pub fn spawn(config: &SandboxProcessConfig) -> Result<Self> {
        // Build command line
        let command_line = build_command_line(&config.command, &config.args);
        let wide_command_line = str_to_wide(&command_line);

        // Build environment block
        let env_block = build_environment_block(&config.env, config.block_network)?;

        // Working directory
        let working_dir = config.working_dir.as_ref().map(|d| str_to_wide(d));
        let working_dir_ptr = working_dir
            .as_ref()
            .map(|d| d.as_ptr())
            .unwrap_or(ptr::null());

        // Startup info
        let mut startup_info: STARTUPINFOW = unsafe { std::mem::zeroed() };
        startup_info.cb = std::mem::size_of::<STARTUPINFOW>() as u32;

        // Process info (output)
        let mut process_info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };

        // Creation flags
        let mut flags = CREATE_UNICODE_ENVIRONMENT;
        if config.new_console {
            flags |= CREATE_NEW_CONSOLE;
        }

        // SAFETY: All pointers are valid, wide strings are null-terminated
        let result = unsafe {
            CreateProcessW(
                ptr::null(),                          // application name (use command line)
                wide_command_line.as_ptr() as *mut _, // command line
                ptr::null(),                          // process attributes
                ptr::null(),                          // thread attributes
                0,                                    // inherit handles = false
                flags,
                env_block.as_ptr() as *const _, // environment
                working_dir_ptr,                // current directory
                &startup_info,
                &mut process_info,
            )
        };

        if result == 0 {
            return Err(anyhow!(
                "Failed to create process: error {}",
                get_last_error()
            ));
        }

        Ok(Self {
            process_handle: process_info.hProcess,
            thread_handle: process_info.hThread,
            process_id: process_info.dwProcessId,
        })
    }

    /// Get the process ID.
    pub fn id(&self) -> u32 {
        self.process_id
    }

    /// Wait for the process to exit.
    pub fn wait(&self) -> Result<i32> {
        // SAFETY: process_handle is valid
        let wait_result = unsafe { WaitForSingleObject(self.process_handle, INFINITE) };

        if wait_result != WAIT_OBJECT_0 {
            return Err(anyhow!("Wait failed: {}", get_last_error()));
        }

        let mut exit_code: u32 = 0;
        // SAFETY: process_handle is valid, exit_code is valid output
        let result = unsafe { GetExitCodeProcess(self.process_handle, &mut exit_code) };

        if result == 0 {
            return Err(anyhow!("Failed to get exit code: {}", get_last_error()));
        }

        Ok(exit_code as i32)
    }

    /// Wait for the process with a timeout.
    ///
    /// Returns Ok(Some(exit_code)) if process exited, Ok(None) if timeout.
    pub fn wait_timeout(&self, timeout_ms: u32) -> Result<Option<i32>> {
        // SAFETY: process_handle is valid
        let wait_result = unsafe { WaitForSingleObject(self.process_handle, timeout_ms) };

        match wait_result {
            WAIT_OBJECT_0 => {
                let mut exit_code: u32 = 0;
                // SAFETY: process_handle is valid
                let result = unsafe { GetExitCodeProcess(self.process_handle, &mut exit_code) };
                if result == 0 {
                    return Err(anyhow!("Failed to get exit code: {}", get_last_error()));
                }
                Ok(Some(exit_code as i32))
            }
            WAIT_TIMEOUT => Ok(None),
            _ => Err(anyhow!("Wait failed: {}", get_last_error())),
        }
    }

    /// Terminate the process.
    pub fn kill(&self) -> Result<()> {
        // SAFETY: process_handle is valid
        let result = unsafe { TerminateProcess(self.process_handle, 1) };

        if result == 0 {
            return Err(anyhow!("Failed to terminate process: {}", get_last_error()));
        }

        Ok(())
    }

    /// Check if the process is still running.
    pub fn is_running(&self) -> bool {
        self.wait_timeout(0).ok().flatten().is_none()
    }
}

impl Drop for SandboxProcess {
    fn drop(&mut self) {
        // SAFETY: handles are valid
        unsafe {
            if !self.thread_handle.is_null() {
                CloseHandle(self.thread_handle);
            }
            if !self.process_handle.is_null() {
                CloseHandle(self.process_handle);
            }
        }
    }
}

/// Build a Windows command line from command and arguments.
fn build_command_line(command: &str, args: &[String]) -> String {
    let mut parts = vec![quote_if_needed(command)];
    for arg in args {
        parts.push(quote_if_needed(arg));
    }
    parts.join(" ")
}

/// Quote a string if it contains spaces or special characters.
fn quote_if_needed(s: &str) -> String {
    if s.contains(' ') || s.contains('"') || s.contains('\t') {
        format!("\"{}\"", s.replace('"', "\\\""))
    } else {
        s.to_string()
    }
}

/// Build a Windows environment block (null-separated, double-null terminated).
fn build_environment_block(
    custom_env: &HashMap<String, String>,
    block_network: bool,
) -> Result<Vec<u16>> {
    let mut env = HashMap::new();

    // Copy current environment
    for (key, value) in std::env::vars() {
        env.insert(key, value);
    }

    // Add network blocking vars if requested
    if block_network {
        for (key, value) in get_network_blocking_env_vars(&NetworkBlockConfig::block_all()) {
            env.insert(key, value);
        }
    }

    // Add custom environment variables (override)
    for (key, value) in custom_env {
        env.insert(key.clone(), value.clone());
    }

    // Build the block: KEY=VALUE\0KEY=VALUE\0...\0\0
    let mut block = Vec::new();
    for (key, value) in env {
        let entry = format!("{}={}", key, value);
        block.extend(entry.encode_utf16());
        block.push(0); // null terminator for this entry
    }
    block.push(0); // final null terminator

    Ok(block)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_build_command_line() {
        let cmd = build_command_line(
            "cmd.exe",
            &["/c".to_string(), "echo".to_string(), "hello".to_string()],
        );
        assert_eq!(cmd, "cmd.exe /c echo hello");
    }

    #[test]
    fn test_build_command_line_with_spaces() {
        let cmd = build_command_line(
            "C:\\Program Files\\app.exe",
            &["arg with space".to_string()],
        );
        assert_eq!(cmd, "\"C:\\Program Files\\app.exe\" \"arg with space\"");
    }

    #[test]
    fn test_quote_if_needed() {
        assert_eq!(quote_if_needed("simple"), "simple");
        assert_eq!(quote_if_needed("with space"), "\"with space\"");
        assert_eq!(quote_if_needed("with\"quote"), "\"with\\\"quote\"");
    }

    #[test]
    fn test_spawn_cmd() {
        let config = SandboxProcessConfig {
            command: "cmd.exe".to_string(),
            args: vec!["/c".to_string(), "echo".to_string(), "test".to_string()],
            block_network: false,
            ..Default::default()
        };

        let process = SandboxProcess::spawn(&config).unwrap();
        let exit_code = process.wait().unwrap();
        assert_eq!(exit_code, 0);
    }
}
