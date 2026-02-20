//! Terminal state management
//!
//! Contains the core terminal state and instance management logic,
//! including PTY creation, I/O handling, and lifecycle management.

use std::collections::HashMap;
use std::io::{BufReader, BufWriter, Read, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use portable_pty::{CommandBuilder, MasterPty, PtyPair, PtySize, native_pty_system};
use tauri::{AppHandle, Emitter};
use tracing::{error, info, warn};
use uuid::Uuid;

use super::constants::{DANGEROUS_ENV_VARS, OUTPUT_BUFFER_MAX_SIZE, PTY_READ_BUFFER_SIZE};
use super::flow_control::{FlowController, OutputBatcher};
use super::process::kill_process_tree;
use super::shell_integration::{SHELL_INTEGRATION_PWSH, inject_shell_integration};
use super::types::{CreateTerminalOptions, TerminalInfo, TerminalStatus, UpdateTerminalOptions};

/// Terminal state stored in Tauri app state
#[derive(Clone)]
pub struct TerminalState {
    terminals: Arc<Mutex<HashMap<String, TerminalInstance>>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self::new()
    }
}

/// Internal terminal instance with PTY
pub(super) struct TerminalInstance {
    pub info: TerminalInfo,
    pub writer: Arc<Mutex<BufWriter<Box<dyn Write + Send>>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub _reader_handle: thread::JoinHandle<()>,
    pub running: Arc<AtomicBool>,
    pub flow_controller: Arc<FlowController>,
    /// Process ID for cleanup on close
    pub child_pid: Option<u32>,
}

impl TerminalState {
    /// Get the default shell for the current platform
    pub fn get_default_shell() -> String {
        #[cfg(target_os = "windows")]
        {
            // Try PowerShell first, fall back to cmd.exe
            if std::env::var("COMSPEC").is_ok() {
                // Check if PowerShell exists
                let pwsh_paths = [
                    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
                    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                ];
                for path in pwsh_paths {
                    if std::path::Path::new(path).exists() {
                        return path.to_string();
                    }
                }
            }
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }

        #[cfg(target_os = "macos")]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
        }

        #[cfg(target_os = "linux")]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        }
    }

    /// Get the default working directory
    fn get_default_cwd() -> String {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| {
                dirs::home_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| ".".to_string())
            })
    }

    /// Create a new terminal
    pub fn create_terminal(
        &self,
        app_handle: &AppHandle,
        options: CreateTerminalOptions,
    ) -> Result<TerminalInfo, String> {
        let terminal_id = Uuid::new_v4().to_string();
        let shell = options.shell.unwrap_or_else(Self::get_default_shell);
        let cwd = options.cwd.unwrap_or_else(Self::get_default_cwd);
        let name = options.name.unwrap_or_else(|| {
            format!("Terminal {}", terminal_id.split('-').next().unwrap_or("1"))
        });
        let cols = options.cols.unwrap_or(120);
        let rows = options.rows.unwrap_or(30);

        // Create PTY
        let pty_system = native_pty_system();
        let pair: PtyPair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Build command - for PowerShell, inject shell integration via command line args (like VS Code)
        let shell_lower = shell.to_lowercase();
        let should_inject = options.shell_integration.unwrap_or(true);
        let is_powershell = shell_lower.contains("pwsh") || shell_lower.contains("powershell");

        let mut cmd = if is_powershell && should_inject {
            // For PowerShell: use -NoExit -Command to source the integration script
            // This avoids the script being echoed to the terminal (like VS Code does)
            let mut c = CommandBuilder::new(&shell);
            c.arg("-NoLogo");
            c.arg("-NoExit");
            c.arg("-Command");
            // Inline the shell integration script as a command
            // Using try/catch to suppress errors silently
            let script = SHELL_INTEGRATION_PWSH
                .lines()
                .filter(|l| !l.trim().starts_with('#') && !l.trim().is_empty())
                .collect::<Vec<_>>()
                .join("; ");
            c.arg(format!("try {{ {} }} catch {{}}", script));
            c
        } else {
            CommandBuilder::new(&shell)
        };

        // Set working directory
        cmd.cwd(&cwd);

        // Add environment variables (with security filtering)
        if let Some(env) = &options.env {
            for (key, value) in env {
                let key_upper = key.to_uppercase();
                if DANGEROUS_ENV_VARS
                    .iter()
                    .any(|&blocked| key_upper == blocked)
                {
                    tracing::warn!("Blocked potentially dangerous env var: {}", key);
                    continue;
                }
                cmd.env(key, value);
            }
        }

        // Set common terminal environment variables
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "CortexDesktop");
        cmd.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"));

        #[cfg(target_os = "windows")]
        {
            // Force UTF-8 on Windows
            cmd.env("PYTHONIOENCODING", "utf-8");
        }

        // Spawn the child process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell process: {}", e))?;

        // Store PID for cleanup on close
        let child_pid = child.process_id();

        info!(
            "Terminal {} created with shell: {}, cwd: {}, pid: {:?}",
            terminal_id, shell, cwd, child_pid
        );

        // Store the master PTY for resize operations
        let master_pty = pair.master;

        // Get writer from master with buffering
        let raw_writer = master_pty
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;
        let writer = Arc::new(Mutex::new(BufWriter::with_capacity(
            OUTPUT_BUFFER_MAX_SIZE,
            raw_writer,
        )));

        // Get reader from master with buffering
        let raw_reader = master_pty
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;
        let mut reader = BufReader::with_capacity(PTY_READ_BUFFER_SIZE, raw_reader);

        // Wrap master PTY in Arc<Mutex<>> for thread-safe resize access
        let master = Arc::new(Mutex::new(master_pty));

        // Create terminal info
        let info = TerminalInfo {
            id: terminal_id.clone(),
            name,
            cwd,
            shell,
            cols,
            rows,
            status: "running".to_string(),
            created_at: chrono::Utc::now().timestamp_millis(),
            last_command: None,
            last_exit_code: None,
            command_running: false,
        };

        // Emit terminal created event
        let _ = app_handle.emit("terminal:created", &info);

        // Create running flag using AtomicBool for lock-free checking
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        // Create flow controller for backpressure management
        let flow_controller = Arc::new(FlowController::new());
        let flow_controller_clone = flow_controller.clone();

        // Spawn reader thread with batched output
        let app_handle_clone = app_handle.clone();
        let terminal_id_clone = terminal_id.clone();

        let reader_handle = thread::spawn(move || {
            let mut child = child;
            let mut buf = [0u8; PTY_READ_BUFFER_SIZE];
            let mut leftover = Vec::new();
            let mut batcher =
                OutputBatcher::new(terminal_id_clone.clone(), app_handle_clone.clone())
                    .with_flow_controller(flow_controller_clone.clone());

            loop {
                // Check if we should stop (lock-free read)
                if !running_clone.load(Ordering::Relaxed) {
                    if !leftover.is_empty() {
                        let data = String::from_utf8_lossy(&leftover);
                        batcher.push(&data);
                    }
                    batcher.flush();
                    break;
                }

                // Check for backpressure - wait if too many pending bytes
                // Use minimal sleep to avoid blocking TUI apps
                if flow_controller_clone.should_pause() {
                    thread::sleep(Duration::from_millis(1));
                    continue;
                }

                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - process ended
                        if !leftover.is_empty() {
                            let data = String::from_utf8_lossy(&leftover);
                            batcher.push(&data);
                        }
                        batcher.flush();
                        break;
                    }
                    Ok(n) => {
                        leftover.extend_from_slice(&buf[..n]);

                        // Process available valid UTF-8
                        match std::str::from_utf8(&leftover) {
                            Ok(s) => {
                                batcher.push(s);
                                leftover.clear();
                            }
                            Err(e) => {
                                let valid_up_to = e.valid_up_to();
                                if valid_up_to > 0 {
                                    let s = std::str::from_utf8(&leftover[..valid_up_to])
                                        .unwrap_or_default();
                                    batcher.push(s);
                                }

                                if let Some(error_len) = e.error_len() {
                                    // Skip truly invalid sequence
                                    let s = String::from_utf8_lossy(
                                        &leftover[valid_up_to..valid_up_to + error_len],
                                    );
                                    batcher.push(&s);
                                    leftover = leftover[valid_up_to + error_len..].to_vec();
                                } else {
                                    // Keep incomplete sequence for next read
                                    leftover = leftover[valid_up_to..].to_vec();
                                }
                            }
                        }
                    }
                    Err(e) => {
                        // Check if it's a would-block error (non-blocking read)
                        if e.kind() != std::io::ErrorKind::WouldBlock {
                            error!("Error reading from PTY: {}", e);
                            batcher.flush();
                            break;
                        }
                        // On WouldBlock, flush any pending output and sleep briefly
                        batcher.flush();
                        thread::sleep(Duration::from_millis(1));
                    }
                }
            }

            // Try to get exit status
            let exit_code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(_) => -1,
            };

            let status_event = TerminalStatus {
                terminal_id: terminal_id_clone.clone(),
                status: "exited".to_string(),
                exit_code: Some(exit_code),
            };

            info!(
                "Terminal {} exited with code: {}",
                terminal_id_clone, exit_code
            );

            let _ = app_handle_clone.emit("terminal:status", &status_event);
        });

        // Store terminal instance
        let writer_clone = writer.clone();
        let shell_for_injection = info.shell.clone();
        let should_inject = options.shell_integration.unwrap_or(true);

        let instance = TerminalInstance {
            info: info.clone(),
            writer,
            master,
            _reader_handle: reader_handle,
            running,
            flow_controller,
            child_pid,
        };

        {
            let mut terminals = self.terminals.lock();
            terminals.insert(terminal_id, instance);
        }

        // Inject shell integration scripts if enabled
        // This is done after the terminal is stored to ensure the reader thread is running
        // and can receive the output from the injection
        if should_inject {
            // Small delay to allow the shell to initialize
            std::thread::sleep(Duration::from_millis(100));

            if let Err(e) = inject_shell_integration(&shell_for_injection, &writer_clone) {
                warn!("Failed to inject shell integration: {}", e);
                // Don't fail terminal creation if injection fails
            }
        }

        Ok(info)
    }

    /// Write data to a terminal
    pub fn write_terminal(&self, terminal_id: &str, data: &str) -> Result<(), String> {
        let terminals = self.terminals.lock();

        let terminal = terminals
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        let mut writer = terminal.writer.lock();

        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to terminal: {}", e))?;

        writer
            .flush()
            .map_err(|e| format!("Failed to flush terminal: {}", e))?;

        Ok(())
    }

    /// Update terminal information
    pub fn update_terminal(
        &self,
        terminal_id: &str,
        options: UpdateTerminalOptions,
    ) -> Result<TerminalInfo, String> {
        let mut terminals = self.terminals.lock();

        let terminal = terminals
            .get_mut(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        if let Some(cwd) = options.cwd {
            terminal.info.cwd = cwd;
        }

        if let Some(last_command) = options.last_command {
            terminal.info.last_command = Some(last_command);
        }

        if let Some(last_exit_code) = options.last_exit_code {
            terminal.info.last_exit_code = Some(last_exit_code);
        }

        if let Some(command_running) = options.command_running {
            terminal.info.command_running = command_running;
        }

        Ok(terminal.info.clone())
    }

    /// Resize a terminal
    pub fn resize_terminal(&self, terminal_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut terminals = self.terminals.lock();

        let terminal = terminals
            .get_mut(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        // Update stored dimensions
        terminal.info.cols = cols;
        terminal.info.rows = rows;

        // Actually resize the PTY
        let master = terminal.master.lock();
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        info!("Terminal {} resized to {}x{}", terminal_id, cols, rows);

        Ok(())
    }

    /// Close a terminal
    pub fn close_terminal(&self, app_handle: &AppHandle, terminal_id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock();

        if let Some(terminal) = terminals.remove(terminal_id) {
            // Set running to false to stop the reader thread (lock-free write)
            terminal.running.store(false, Ordering::Relaxed);

            // Kill the child process if we have its PID
            if let Some(pid) = terminal.child_pid {
                info!("Killing terminal {} process (PID: {})", terminal_id, pid);
                if let Err(e) = kill_process_tree(pid) {
                    warn!("Failed to kill terminal process {}: {}", pid, e);
                }
            }

            // Emit closed event
            let status_event = TerminalStatus {
                terminal_id: terminal_id.to_string(),
                status: "closed".to_string(),
                exit_code: None,
            };
            let _ = app_handle.emit("terminal:status", &status_event);

            info!("Terminal {} closed", terminal_id);
            Ok(())
        } else {
            Err(format!("Terminal {} not found", terminal_id))
        }
    }

    /// List all terminals
    pub fn list_terminals(&self) -> Result<Vec<TerminalInfo>, String> {
        let terminals = self.terminals.lock();
        Ok(terminals.values().map(|t| t.info.clone()).collect())
    }

    /// Get info for a specific terminal
    pub fn get_terminal(&self, terminal_id: &str) -> Result<Option<TerminalInfo>, String> {
        let terminals = self.terminals.lock();
        Ok(terminals.get(terminal_id).map(|t| t.info.clone()))
    }

    /// Send interrupt signal (Ctrl+C) to terminal
    pub fn send_interrupt(&self, terminal_id: &str) -> Result<(), String> {
        // Send Ctrl+C character (0x03)
        self.write_terminal(terminal_id, "\x03")
    }

    /// Send EOF signal (Ctrl+D) to terminal
    pub fn send_eof(&self, terminal_id: &str) -> Result<(), String> {
        // Send Ctrl+D character (0x04)
        self.write_terminal(terminal_id, "\x04")
    }

    /// Acknowledge processed bytes for flow control
    ///
    /// The frontend should call this after processing terminal output
    /// to release backpressure and allow more output to flow.
    pub fn acknowledge_output(&self, terminal_id: &str, bytes: usize) -> Result<(), String> {
        let terminals = self.terminals.lock();

        let terminal = terminals
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        terminal.flow_controller.acknowledge(bytes);

        Ok(())
    }

    /// Close all terminals
    pub fn close_all(&self, app_handle: &AppHandle) -> Result<(), String> {
        let terminal_ids: Vec<String> = {
            let terminals = self.terminals.lock();
            terminals.keys().cloned().collect()
        };

        for id in terminal_ids {
            let _ = self.close_terminal(app_handle, &id);
        }

        Ok(())
    }
}
