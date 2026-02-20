#![allow(unsafe_code)]
//! Kernel management and lifecycle

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::sync::mpsc;
use tracing::info;
#[cfg(windows)]
use tracing::warn;

use super::types::*;

/// Manages all REPL kernels
pub struct KernelManager {
    kernels: HashMap<String, RunningKernel>,
    event_sender: mpsc::UnboundedSender<KernelEvent>,
}

struct RunningKernel {
    info: KernelInfo,
    process: Option<Child>,
    stdin: Option<Arc<Mutex<std::process::ChildStdin>>>,
}

impl KernelManager {
    pub fn new(event_sender: mpsc::UnboundedSender<KernelEvent>) -> Self {
        Self {
            kernels: HashMap::new(),
            event_sender,
        }
    }

    /// List available kernel specifications
    pub fn list_kernel_specs(&self) -> Vec<KernelSpec> {
        let mut specs = Vec::new();

        // Check for Python
        if Self::check_executable("python3").is_some() || Self::check_executable("python").is_some()
        {
            specs.push(KernelSpec {
                id: "python3".to_string(),
                name: "python3".to_string(),
                display_name: "Python 3".to_string(),
                language: "python".to_string(),
                kernel_type: KernelType::Python,
                executable: Self::check_executable("python3")
                    .or_else(|| Self::check_executable("python")),
            });
        }

        // Check for Node.js
        if let Some(node_path) = Self::check_executable("node") {
            specs.push(KernelSpec {
                id: "node".to_string(),
                name: "node".to_string(),
                display_name: "Node.js".to_string(),
                language: "javascript".to_string(),
                kernel_type: KernelType::Node,
                executable: Some(node_path),
            });
        }

        specs
    }

    fn check_executable(name: &str) -> Option<String> {
        #[cfg(windows)]
        let check_cmd = crate::process_utils::command("where").arg(name).output();
        #[cfg(not(windows))]
        let check_cmd = crate::process_utils::command("which").arg(name).output();

        match check_cmd {
            Ok(output) if output.status.success() => String::from_utf8(output.stdout)
                .ok()
                .map(|s| s.lines().next().unwrap_or("").trim().to_string())
                .filter(|s| !s.is_empty()),
            _ => None,
        }
    }

    /// Start a new kernel
    pub fn start_kernel(&mut self, spec_id: &str) -> Result<KernelInfo, String> {
        let specs = self.list_kernel_specs();
        let spec = specs
            .iter()
            .find(|s| s.id == spec_id)
            .ok_or_else(|| format!("Kernel spec '{}' not found", spec_id))?
            .clone();

        let kernel_id = format!("{}_{}", spec_id, uuid_simple());

        let (process, stdin) = match spec.kernel_type {
            KernelType::Python => self.start_python_kernel(&spec)?,
            KernelType::Node => self.start_node_kernel(&spec)?,
            KernelType::Jupyter => {
                return Err("Jupyter kernels not yet implemented".to_string());
            }
        };

        let info = KernelInfo {
            id: kernel_id.clone(),
            spec,
            status: KernelStatus::Idle,
            execution_count: 0,
        };

        let kernel = RunningKernel {
            info: info.clone(),
            process: Some(process),
            stdin: Some(Arc::new(Mutex::new(stdin))),
        };

        self.kernels.insert(kernel_id.clone(), kernel);

        // Emit status event
        let _ = self.event_sender.send(KernelEvent::Status {
            kernel_id: kernel_id.clone(),
            status: KernelStatus::Idle,
        });

        info!("Started kernel: {}", kernel_id);
        Ok(info)
    }

    fn start_python_kernel(
        &self,
        spec: &KernelSpec,
    ) -> Result<(Child, std::process::ChildStdin), String> {
        let executable = spec
            .executable
            .as_ref()
            .ok_or("Python executable not found")?;

        let mut child = crate::process_utils::command(executable)
            .args(["-u", "-i", "-q"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Python: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;

        // Set up output readers
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let event_sender = self.event_sender.clone();
        let kernel_id = format!("{}_{}", spec.id, "pending");

        if let Some(stdout) = stdout {
            let sender = event_sender.clone();
            let kid = kernel_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = sender.send(KernelEvent::Output {
                        kernel_id: kid.clone(),
                        cell_id: "".to_string(),
                        output: CellOutput {
                            output_type: OutputType::Stdout,
                            content: OutputContent::Text(line),
                            timestamp: current_timestamp(),
                        },
                    });
                }
            });
        }

        if let Some(stderr) = stderr {
            let sender = event_sender;
            let kid = kernel_id;
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = sender.send(KernelEvent::Output {
                        kernel_id: kid.clone(),
                        cell_id: "".to_string(),
                        output: CellOutput {
                            output_type: OutputType::Stderr,
                            content: OutputContent::Text(line),
                            timestamp: current_timestamp(),
                        },
                    });
                }
            });
        }

        Ok((child, stdin))
    }

    fn start_node_kernel(
        &self,
        spec: &KernelSpec,
    ) -> Result<(Child, std::process::ChildStdin), String> {
        let executable = spec
            .executable
            .as_ref()
            .ok_or("Node executable not found")?;

        let mut child = crate::process_utils::command(executable)
            .args(["--interactive"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Node.js: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let event_sender = self.event_sender.clone();
        let kernel_id = format!("{}_{}", spec.id, "pending");

        if let Some(stdout) = stdout {
            let sender = event_sender.clone();
            let kid = kernel_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    // Filter out the Node.js prompt
                    if line.trim() != ">" && !line.trim().is_empty() {
                        let _ = sender.send(KernelEvent::Output {
                            kernel_id: kid.clone(),
                            cell_id: "".to_string(),
                            output: CellOutput {
                                output_type: OutputType::Stdout,
                                content: OutputContent::Text(line),
                                timestamp: current_timestamp(),
                            },
                        });
                    }
                }
            });
        }

        if let Some(stderr) = stderr {
            let sender = event_sender;
            let kid = kernel_id;
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = sender.send(KernelEvent::Output {
                        kernel_id: kid.clone(),
                        cell_id: "".to_string(),
                        output: CellOutput {
                            output_type: OutputType::Stderr,
                            content: OutputContent::Text(line),
                            timestamp: current_timestamp(),
                        },
                    });
                }
            });
        }

        Ok((child, stdin))
    }

    /// Execute code in a kernel
    pub fn execute(&mut self, kernel_id: &str, code: &str, _cell_id: &str) -> Result<u32, String> {
        let kernel = self
            .kernels
            .get_mut(kernel_id)
            .ok_or_else(|| format!("Kernel '{}' not found", kernel_id))?;

        kernel.info.status = KernelStatus::Busy;
        kernel.info.execution_count += 1;
        let execution_count = kernel.info.execution_count;

        let _ = self.event_sender.send(KernelEvent::Status {
            kernel_id: kernel_id.to_string(),
            status: KernelStatus::Busy,
        });

        let stdin = kernel
            .stdin
            .as_ref()
            .ok_or("Kernel stdin not available")?
            .clone();

        let code_to_send = format!("{}\n", code.trim());

        // Send code to the kernel
        if let Ok(mut stdin_guard) = stdin.lock() {
            stdin_guard
                .write_all(code_to_send.as_bytes())
                .map_err(|e| format!("Failed to write to kernel: {}", e))?;
            stdin_guard
                .flush()
                .map_err(|e| format!("Failed to flush kernel stdin: {}", e))?;
        }

        // Mark kernel as idle after a short delay
        let sender = self.event_sender.clone();
        let kid = kernel_id.to_string();
        thread::spawn(move || {
            thread::sleep(std::time::Duration::from_millis(100));
            let _ = sender.send(KernelEvent::Status {
                kernel_id: kid,
                status: KernelStatus::Idle,
            });
        });

        Ok(execution_count)
    }

    /// Interrupt a running kernel
    #[allow(unsafe_code)]
    pub fn interrupt(&mut self, kernel_id: &str) -> Result<(), String> {
        let kernel = self
            .kernels
            .get_mut(kernel_id)
            .ok_or_else(|| format!("Kernel '{}' not found", kernel_id))?;

        if let Some(ref mut _process) = kernel.process {
            #[cfg(unix)]
            {
                // SAFETY: _process.id() returns a valid PID for a running child process.
                // libc::kill with SIGINT is a standard POSIX signal delivery that is
                // safe to call with any valid PID. The cast from u32 to i32 is safe
                // because valid PIDs are always positive and within i32 range.
                unsafe {
                    libc::kill(_process.id() as i32, libc::SIGINT);
                }
            }
            #[cfg(windows)]
            {
                // On Windows, we can't easily send SIGINT, so we restart the process
                warn!("Interrupt not fully supported on Windows, kernel may be unresponsive");
            }
        }

        Ok(())
    }

    /// Shutdown a kernel
    pub fn shutdown(&mut self, kernel_id: &str) -> Result<(), String> {
        if let Some(mut kernel) = self.kernels.remove(kernel_id) {
            kernel.info.status = KernelStatus::ShuttingDown;

            let _ = self.event_sender.send(KernelEvent::Status {
                kernel_id: kernel_id.to_string(),
                status: KernelStatus::ShuttingDown,
            });

            if let Some(ref mut process) = kernel.process {
                let _ = process.kill();
                let _ = process.wait();
            }

            let _ = self.event_sender.send(KernelEvent::Status {
                kernel_id: kernel_id.to_string(),
                status: KernelStatus::Shutdown,
            });

            info!("Shutdown kernel: {}", kernel_id);
        }

        Ok(())
    }

    /// Restart a kernel
    pub fn restart(&mut self, kernel_id: &str) -> Result<KernelInfo, String> {
        let kernel = self
            .kernels
            .get(kernel_id)
            .ok_or_else(|| format!("Kernel '{}' not found", kernel_id))?;

        let spec_id = kernel.info.spec.id.clone();

        self.shutdown(kernel_id)?;
        self.start_kernel(&spec_id)
    }

    /// Get kernel info
    pub fn get_kernel(&self, kernel_id: &str) -> Option<KernelInfo> {
        self.kernels.get(kernel_id).map(|k| k.info.clone())
    }

    /// List all running kernels
    pub fn list_kernels(&self) -> Vec<KernelInfo> {
        self.kernels.values().map(|k| k.info.clone()).collect()
    }

    /// Shutdown all running kernels
    pub fn shutdown_all(&mut self) {
        let kernel_ids: Vec<String> = self.kernels.keys().cloned().collect();
        for kernel_id in kernel_ids {
            let _ = self.shutdown(&kernel_id);
        }
    }

    /// Get variables from a Python kernel
    pub fn get_variables(&mut self, kernel_id: &str) -> Result<Vec<Variable>, String> {
        let kernel = self
            .kernels
            .get_mut(kernel_id)
            .ok_or_else(|| format!("Kernel '{}' not found", kernel_id))?;

        if kernel.info.spec.kernel_type != KernelType::Python {
            return Ok(Vec::new());
        }

        // For Python, we can use dir() and type() to get variable info
        // This is a simplified implementation
        Ok(Vec::new())
    }
}

impl Drop for KernelManager {
    fn drop(&mut self) {
        let kernel_ids: Vec<String> = self.kernels.keys().cloned().collect();
        for kernel_id in kernel_ids {
            let _ = self.shutdown(&kernel_id);
        }
    }
}

/// Generate a simple UUID-like string
#[allow(clippy::expect_used)]
fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System time should be after UNIX_EPOCH")
        .as_nanos();
    format!("{:x}", now)
}

/// Get current timestamp in milliseconds
#[allow(clippy::expect_used)]
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System time should be after UNIX_EPOCH")
        .as_millis() as u64
}
