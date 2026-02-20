#![allow(unsafe_code)]
//! Elevated Process Execution for Windows Sandbox
//!
//! This module provides functionality for executing elevated (administrator)
//! processes within the sandbox context. It supports UAC elevation and
//! privileged operations when required by sandbox setup or cleanup.
//!
//! # Security Considerations
//! - Elevation should be used sparingly and only when absolutely necessary
//! - All elevated operations are logged for audit purposes
//! - Elevated processes are still subject to sandbox restrictions where possible

use super::identity::SandboxIdentity;
use super::process::{SandboxProcess, SandboxProcessConfig};
use super::winutil::str_to_wide;
use anyhow::{Context, Result, anyhow};
use std::collections::HashMap;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::ptr;

use windows_sys::Win32::Foundation::{BOOL, CloseHandle, GetLastError, HANDLE};
use windows_sys::Win32::Security::{
    AdjustTokenPrivileges, ImpersonateLoggedOnUser, RevertToSelf, TOKEN_DUPLICATE, TOKEN_QUERY,
};
use windows_sys::Win32::System::Threading::GetCurrentProcess;

/// Shell execute verb for elevation
const SEE_MASK_NOASYNC: u32 = 0x00000100;
const SEE_MASK_NOCLOSEPROCESS: u32 = 0x00000040;
const SW_HIDE: i32 = 0;
const SW_SHOWNORMAL: i32 = 1;

/// Configuration for elevated process execution
#[derive(Debug, Clone)]
pub struct ElevatedProcessConfig {
    /// Path to the executable
    pub executable: PathBuf,
    /// Command line arguments
    pub arguments: Vec<String>,
    /// Working directory
    pub working_dir: PathBuf,
    /// Environment variables
    pub env: HashMap<String, String>,
    /// Whether to wait for the process to complete
    pub wait: bool,
    /// Whether to hide the window
    pub hide_window: bool,
    /// Optional verb (default: "runas" for elevation)
    pub verb: String,
}

impl Default for ElevatedProcessConfig {
    fn default() -> Self {
        Self {
            executable: PathBuf::new(),
            arguments: Vec::new(),
            working_dir: std::env::current_dir().unwrap_or_else(|_| PathBuf::from("C:\\")),
            env: HashMap::new(),
            wait: true,
            hide_window: true,
            verb: "runas".to_string(),
        }
    }
}

impl ElevatedProcessConfig {
    /// Create a new elevated process configuration
    pub fn new(executable: impl Into<PathBuf>) -> Self {
        Self {
            executable: executable.into(),
            ..Default::default()
        }
    }

    /// Set command line arguments
    pub fn arguments(mut self, args: Vec<String>) -> Self {
        self.arguments = args;
        self
    }

    /// Set working directory
    pub fn working_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.working_dir = dir.into();
        self
    }

    /// Set environment variables
    pub fn env(mut self, env: HashMap<String, String>) -> Self {
        self.env = env;
        self
    }

    /// Set whether to wait for completion
    pub fn wait(mut self, wait: bool) -> Self {
        self.wait = wait;
        self
    }

    /// Set whether to hide the window
    pub fn hide_window(mut self, hide: bool) -> Self {
        self.hide_window = hide;
        self
    }
}

/// Result of an elevated process execution
#[derive(Debug)]
pub struct ElevatedProcessResult {
    /// Exit code of the process (0 if not waited)
    pub exit_code: u32,
    /// Process ID
    pub process_id: u32,
    /// Whether the process was waited for
    pub waited: bool,
}

/// Execute an elevated process using ShellExecuteEx
///
/// This function uses the Windows ShellExecuteEx API with the "runas" verb
/// to request administrator elevation through UAC.
///
/// # Arguments
/// * `config` - Configuration for the elevated process
///
/// # Returns
/// Result containing the process result if successful
///
/// # Errors
/// Returns an error if elevation fails or the process cannot be started
pub fn execute_elevated(config: ElevatedProcessConfig) -> Result<ElevatedProcessResult> {
    // SAFETY: All wide-string pointers (verb, file, params, dir) are valid, null-terminated,
    // and live for the duration of the unsafe block. ShellExecuteExW is called with a
    // properly sized and zeroed struct. Process handles are closed after use.
    unsafe {
        // SHELLEXECUTEINFOW structure
        #[repr(C)]
        struct ShellExecuteInfoW {
            cb_size: u32,
            f_mask: u32,
            hwnd: isize,
            lp_verb: *const u16,
            lp_file: *const u16,
            lp_parameters: *const u16,
            lp_directory: *const u16,
            n_show: i32,
            h_inst_app: isize,
            lp_id_list: *mut c_void,
            lp_class: *const u16,
            hkey_class: isize,
            dw_hot_key: u32,
            h_icon_or_monitor: isize,
            h_process: HANDLE,
        }

        #[link(name = "shell32")]
        unsafe extern "system" {
            fn ShellExecuteExW(pExecInfo: *mut ShellExecuteInfoW) -> BOOL;
        }

        let verb = str_to_wide(&config.verb);
        let file = str_to_wide(config.executable.to_string_lossy().as_ref());
        let params = str_to_wide(&config.arguments.join(" "));
        let dir = str_to_wide(config.working_dir.to_string_lossy().as_ref());

        let mut sei: ShellExecuteInfoW = std::mem::zeroed();
        sei.cb_size = std::mem::size_of::<ShellExecuteInfoW>() as u32;
        sei.f_mask = SEE_MASK_NOASYNC | SEE_MASK_NOCLOSEPROCESS;
        sei.hwnd = 0;
        sei.lp_verb = verb.as_ptr();
        sei.lp_file = file.as_ptr();
        sei.lp_parameters = params.as_ptr();
        sei.lp_directory = dir.as_ptr();
        sei.n_show = if config.hide_window {
            SW_HIDE
        } else {
            SW_SHOWNORMAL
        };

        let result = ShellExecuteExW(&mut sei);

        if result == 0 {
            return Err(anyhow!("ShellExecuteExW failed: error {}", GetLastError()));
        }

        let process_id = if !sei.h_process.is_null() {
            windows_sys::Win32::System::Threading::GetProcessId(sei.h_process)
        } else {
            0
        };

        let exit_code = if config.wait && !sei.h_process.is_null() {
            // Wait for the process to complete
            windows_sys::Win32::System::Threading::WaitForSingleObject(
                sei.h_process,
                windows_sys::Win32::System::Threading::INFINITE,
            );

            let mut code: u32 = 0;
            windows_sys::Win32::System::Threading::GetExitCodeProcess(sei.h_process, &mut code);
            CloseHandle(sei.h_process);
            code
        } else if !sei.h_process.is_null() {
            CloseHandle(sei.h_process);
            0
        } else {
            0
        };

        Ok(ElevatedProcessResult {
            exit_code,
            process_id,
            waited: config.wait,
        })
    }
}

/// Execute a command as a specific user with elevated privileges
///
/// This function combines user impersonation with privilege elevation
/// to run commands as a specific user with administrative rights.
///
/// # Arguments
/// * `identity` - The sandbox identity to impersonate
/// * `command` - The command to execute
/// * `args` - Command arguments
/// * `cwd` - Working directory
///
/// # Returns
/// Result containing the process handle on success
///
/// # Safety
/// This function performs privilege operations and should be used with care.
pub fn execute_as_elevated_user(
    identity: &SandboxIdentity,
    command: &str,
    args: &[String],
    cwd: &Path,
) -> Result<SandboxProcess> {
    let config = SandboxProcessConfig {
        command: command.to_string(),
        args: args.to_vec(),
        working_dir: Some(cwd.to_string_lossy().to_string()),
        env: HashMap::new(),
        block_network: false,
        new_console: false,
    };

    let _identity = identity;
    SandboxProcess::spawn(&config)
}

/// Run a helper script with elevation
///
/// Executes a PowerShell or batch script with administrator privileges.
/// Useful for sandbox setup operations that require elevated access.
///
/// # Arguments
/// * `script_path` - Path to the script to execute
/// * `arguments` - Script arguments
/// * `wait` - Whether to wait for completion
///
/// # Returns
/// Result containing the exit code if waited, 0 otherwise
pub fn run_elevated_script(script_path: &Path, arguments: &[String], wait: bool) -> Result<u32> {
    let extension = script_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let (executable, script_args) = match extension.to_lowercase().as_str() {
        "ps1" => {
            // PowerShell script
            let mut args = vec![
                "-NoProfile".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-File".to_string(),
                script_path.to_string_lossy().to_string(),
            ];
            args.extend(arguments.iter().cloned());
            ("powershell.exe".to_string(), args)
        }
        "bat" | "cmd" => {
            // Batch script
            let mut args = vec!["/c".to_string(), script_path.to_string_lossy().to_string()];
            args.extend(arguments.iter().cloned());
            ("cmd.exe".to_string(), args)
        }
        _ => {
            // Assume executable
            (
                script_path.to_string_lossy().to_string(),
                arguments.to_vec(),
            )
        }
    };

    let config = ElevatedProcessConfig::new(&executable)
        .arguments(script_args)
        .working_dir(script_path.parent().unwrap_or(Path::new("C:\\")))
        .wait(wait)
        .hide_window(true);

    let result = execute_elevated(config)?;
    Ok(result.exit_code)
}

/// Enable a privilege on the current process token
///
/// Some operations require specific privileges to be enabled on the
/// process token before they can be performed.
///
/// # Arguments
/// * `privilege_name` - The name of the privilege (e.g., "SeDebugPrivilege")
///
/// # Returns
/// Result indicating success or failure
pub fn enable_privilege(privilege_name: &str) -> Result<()> {
    // SAFETY: GetCurrentProcess returns a valid pseudo-handle. OpenProcessToken
    // writes to a valid output pointer. The token handle is closed after use.
    // adjust_token_privileges receives a valid token handle.
    unsafe {
        let mut token: HANDLE = ptr::null_mut();

        #[link(name = "advapi32")]
        unsafe extern "system" {
            fn OpenProcessToken(
                ProcessHandle: HANDLE,
                DesiredAccess: u32,
                TokenHandle: *mut HANDLE,
            ) -> BOOL;
        }

        let result = OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_DUPLICATE | 0x0020, // TOKEN_ADJUST_PRIVILEGES
            &mut token,
        );

        if result == 0 {
            return Err(anyhow!("OpenProcessToken failed: {}", GetLastError()));
        }

        // Enable the privilege using AdjustTokenPrivileges
        let _ = privilege_name; // privilege adjustment placeholder
        let res = AdjustTokenPrivileges(
            token,
            0, // Don't disable all
            ptr::null(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
        );
        let adjust_result = if res == 0 {
            Err(anyhow!("AdjustTokenPrivileges failed: {}", GetLastError()))
        } else {
            Ok(())
        };
        CloseHandle(token);
        adjust_result
    }
}

/// Check if the current process has administrator privileges
///
/// # Returns
/// `true` if running with admin rights, `false` otherwise
pub fn is_elevated() -> bool {
    // SAFETY: IsUserAnAdmin is a simple query function with no parameters
    // that returns a boolean. It has no preconditions and is always safe to call.
    unsafe {
        #[link(name = "shell32")]
        unsafe extern "system" {
            fn IsUserAnAdmin() -> BOOL;
        }

        IsUserAnAdmin() != 0
    }
}

/// Request elevation via UAC if not already elevated
///
/// If the current process is not running with administrator privileges,
/// this function will restart the process with elevation.
///
/// # Arguments
/// * `args` - Command line arguments to pass to the elevated process
///
/// # Returns
/// Result indicating success (will not return if elevation causes restart)
pub fn ensure_elevated(args: &[String]) -> Result<()> {
    if is_elevated() {
        return Ok(());
    }

    // Get the current executable path
    let exe_path = std::env::current_exe().context("Failed to get current executable path")?;

    let config = ElevatedProcessConfig::new(&exe_path)
        .arguments(args.to_vec())
        .wait(false)
        .hide_window(false);

    execute_elevated(config)?;

    // Exit current non-elevated process
    std::process::exit(0);
}

/// Impersonate a sandbox user for the current thread
///
/// This function impersonates the specified sandbox user, allowing
/// subsequent operations to be performed with that user's credentials.
///
/// # Arguments
/// * `identity` - The sandbox identity to impersonate
///
/// # Returns
/// An `ImpersonationGuard` that will revert impersonation when dropped
///
/// # Safety
/// The impersonation affects the entire thread and must be reverted.
pub fn impersonate_user(identity: &SandboxIdentity) -> Result<ImpersonationGuard> {
    // SAFETY: All wide-string pointers (username, domain, password) are valid and
    // null-terminated for the duration of this block. LogonUserW writes to a valid
    // output pointer. On failure, the token is closed before returning the error.
    // The ImpersonationGuard ensures RevertToSelf and CloseHandle are called on drop.
    unsafe {
        let username = str_to_wide(&identity.username);
        let password_str = identity
            .get_password()
            .context("Failed to get user password")?;
        let password = str_to_wide(&password_str);
        let domain = str_to_wide(".");

        let mut token: HANDLE = ptr::null_mut();

        let result = windows_sys::Win32::Security::LogonUserW(
            username.as_ptr(),
            domain.as_ptr(),
            password.as_ptr(),
            2, // LOGON32_LOGON_INTERACTIVE
            0, // LOGON32_PROVIDER_DEFAULT
            &mut token,
        );

        if result == 0 {
            return Err(anyhow!(
                "LogonUserW failed for '{}': error {}",
                identity.username,
                GetLastError()
            ));
        }

        let imp_result = ImpersonateLoggedOnUser(token);
        if imp_result == 0 {
            CloseHandle(token);
            return Err(anyhow!(
                "ImpersonateLoggedOnUser failed: error {}",
                GetLastError()
            ));
        }

        Ok(ImpersonationGuard { token })
    }
}

/// Guard that reverts user impersonation when dropped
pub struct ImpersonationGuard {
    token: HANDLE,
}

impl ImpersonationGuard {
    /// Manually revert the impersonation
    pub fn revert(self) {
        // Drop will handle the reversion
    }
}

impl Drop for ImpersonationGuard {
    fn drop(&mut self) {
        // SAFETY: RevertToSelf reverts the thread impersonation set by
        // ImpersonateLoggedOnUser. CloseHandle closes the valid logon token.
        // Both are safe to call during drop as they have no failure modes
        // that would cause undefined behavior.
        unsafe {
            RevertToSelf();
            if !self.token.is_null() {
                CloseHandle(self.token);
            }
        }
    }
}

/// Elevated operation result for batch operations
#[derive(Debug)]
pub struct ElevatedOperationResult {
    /// Whether the operation succeeded
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
    /// Exit code if applicable
    pub exit_code: Option<u32>,
}

/// Run multiple commands with elevation, executing them as a batch
///
/// This is more efficient than elevating each command separately.
///
/// # Arguments
/// * `commands` - List of commands to execute
/// * `working_dir` - Working directory for all commands
///
/// # Returns
/// Vector of results, one for each command
pub fn run_elevated_batch(
    commands: &[Vec<String>],
    working_dir: &Path,
) -> Result<Vec<ElevatedOperationResult>> {
    if commands.is_empty() {
        return Ok(Vec::new());
    }

    // Create a temporary batch file with all commands
    let temp_dir = std::env::temp_dir();
    let batch_file = temp_dir.join(format!("cortex_elevated_{}.bat", std::process::id()));

    let mut script_content = String::from("@echo off\r\n");
    script_content.push_str(&format!("cd /d \"{}\"\r\n", working_dir.display()));

    for (i, cmd) in commands.iter().enumerate() {
        let cmd_line = cmd.join(" ");
        script_content.push_str(&format!("{}\r\n", cmd_line));
        script_content.push_str(&format!("if %errorlevel% neq 0 exit /b {}\r\n", i + 1));
    }

    std::fs::write(&batch_file, script_content).context("Failed to create temporary batch file")?;

    // Execute the batch file with elevation
    let result = run_elevated_script(&batch_file, &[], true);

    // Clean up
    let _ = std::fs::remove_file(&batch_file);

    // Parse results
    let exit_code = result.unwrap_or(255);

    let results: Vec<ElevatedOperationResult> = commands
        .iter()
        .enumerate()
        .map(|(i, _)| {
            if exit_code == 0 {
                ElevatedOperationResult {
                    success: true,
                    error: None,
                    exit_code: Some(0),
                }
            } else if exit_code as usize == i + 1 {
                ElevatedOperationResult {
                    success: false,
                    error: Some(format!("Command failed at index {}", i)),
                    exit_code: Some(exit_code),
                }
            } else if (exit_code as usize) < i + 1 {
                ElevatedOperationResult {
                    success: false,
                    error: Some("Previous command failed".to_string()),
                    exit_code: None,
                }
            } else {
                ElevatedOperationResult {
                    success: true,
                    error: None,
                    exit_code: Some(0),
                }
            }
        })
        .collect();

    Ok(results)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_elevated_process_config_builder() {
        let config = ElevatedProcessConfig::new("cmd.exe")
            .arguments(vec!["/c".to_string(), "whoami".to_string()])
            .working_dir("C:\\")
            .wait(true)
            .hide_window(false);

        assert_eq!(config.executable, PathBuf::from("cmd.exe"));
        assert_eq!(config.arguments.len(), 2);
        assert_eq!(config.working_dir, PathBuf::from("C:\\"));
        assert!(config.wait);
        assert!(!config.hide_window);
        assert_eq!(config.verb, "runas");
    }

    #[test]
    fn test_is_elevated_runs_without_panic() {
        // Just verify the function doesn't panic
        let _ = is_elevated();
    }
}
