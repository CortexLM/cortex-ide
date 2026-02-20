//! Git command execution utilities with timeout support.

use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};
use tracing::warn;

use crate::process_utils;

// ============================================================================
// Git Command Timeout Configuration
// ============================================================================

/// Default timeout for git operations in seconds
const DEFAULT_GIT_TIMEOUT_SECS: u64 = 30;

/// Get the configured git timeout duration
pub fn get_git_timeout() -> Duration {
    // Allow override via environment variable
    std::env::var("cortex_GIT_TIMEOUT_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or(Duration::from_secs(DEFAULT_GIT_TIMEOUT_SECS))
}

/// Error type for git command timeout
#[derive(Debug)]
pub struct GitTimeoutError {
    pub command: String,
    pub timeout: Duration,
}

impl std::fmt::Display for GitTimeoutError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Git command '{}' timed out after {:?}",
            self.command, self.timeout
        )
    }
}

impl std::error::Error for GitTimeoutError {}

/// Execute a git command with timeout (synchronous version)
/// Returns the output if successful, or an error if the command times out or fails
pub fn run_git_command_with_timeout(
    mut command: Command,
    timeout: Duration,
) -> Result<std::process::Output, String> {
    let cmd_str = format!("{:?}", command);

    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn git command: {}", e))?;

    let start = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process has exited, collect output
                let output = child
                    .wait_with_output()
                    .map_err(|e| format!("Failed to collect git command output: {}", e))?;
                return Ok(output);
            }
            Ok(None) => {
                // Process still running, check timeout
                if start.elapsed() > timeout {
                    // Kill the process
                    if let Err(e) = child.kill() {
                        warn!("Failed to kill timed out git process: {}", e);
                    }
                    // Wait for the process to actually terminate
                    let _ = child.wait();
                    return Err(format!(
                        "Git command timed out after {:?}: {}",
                        timeout, cmd_str
                    ));
                }
                // Sleep briefly before checking again
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                return Err(format!("Error waiting for git command: {}", e));
            }
        }
    }
}

/// Execute a git command with timeout and return output (convenience function)
pub fn git_command_with_timeout(args: &[&str], cwd: &Path) -> Result<std::process::Output, String> {
    let mut cmd = process_utils::command("git");
    cmd.args(args).current_dir(cwd);
    run_git_command_with_timeout(cmd, get_git_timeout())
}

/// Execute a git command with timeout, custom environment, and return output
pub fn git_command_with_timeout_env(
    args: &[&str],
    cwd: &Path,
    env_vars: &[(&str, &str)],
) -> Result<std::process::Output, String> {
    let mut cmd = process_utils::command("git");
    cmd.args(args).current_dir(cwd);
    for (key, value) in env_vars {
        cmd.env(key, value);
    }
    run_git_command_with_timeout(cmd, get_git_timeout())
}

/// Execute a git command with timeout that requires stdin input
pub fn git_command_with_timeout_stdin(
    args: &[&str],
    cwd: &Path,
    stdin_data: &[u8],
) -> Result<std::process::Output, String> {
    use std::io::Write;

    let timeout = get_git_timeout();
    let cmd_str = format!("git {:?}", args);

    let mut child = process_utils::command("git")
        .args(args)
        .current_dir(cwd)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn git command: {}", e))?;

    // Write stdin data
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(stdin_data)
            .map_err(|e| format!("Failed to write to git stdin: {}", e))?;
        // Closing stdin by dropping it
    }

    let start = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                let output = child
                    .wait_with_output()
                    .map_err(|e| format!("Failed to collect git command output: {}", e))?;
                return Ok(output);
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    if let Err(e) = child.kill() {
                        warn!("Failed to kill timed out git process: {}", e);
                    }
                    let _ = child.wait();
                    return Err(format!(
                        "Git command timed out after {:?}: {}",
                        timeout, cmd_str
                    ));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                return Err(format!("Error waiting for git command: {}", e));
            }
        }
    }
}
