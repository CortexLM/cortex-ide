//! Sidecar lifecycle management for the Node.js extension host process.
//!
//! Spawns `node <sidecar>/main.js` with stdin/stdout piped for JSON-RPC
//! communication.  Incoming messages from the process are forwarded as
//! Tauri events so the frontend can react to extension-driven UI calls.

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use super::protocol::NodeHostMessage;

pub struct NodeHostProcess {
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    child: Arc<Mutex<tokio::process::Child>>,
    reader_handle: tokio::task::JoinHandle<()>,
}

impl NodeHostProcess {
    pub async fn start(app: AppHandle) -> Result<Self, String> {
        let sidecar_dir = Self::sidecar_dir();
        let main_js = sidecar_dir.join("main.js");

        if !main_js.exists() {
            return Err(format!(
                "Extension host entry point not found: {}",
                main_js.display()
            ));
        }

        let mut cmd = crate::process_utils::async_command("node");
        cmd.arg(&main_js)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .current_dir(&sidecar_dir);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn Node.js extension host: {}", e))?;

        let stdin = child
            .stdin
            .take()
            .ok_or("Failed to open stdin for extension host")?;
        let stdout = child
            .stdout
            .take()
            .ok_or("Failed to open stdout for extension host")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("Failed to open stderr for extension host")?;

        let child = Arc::new(Mutex::new(child));
        let stdin = Arc::new(Mutex::new(stdin));

        let app_clone = app.clone();
        let reader_handle = tokio::spawn(async move {
            let mut stdout_reader = BufReader::new(stdout).lines();
            let mut stderr_reader = BufReader::new(stderr).lines();

            loop {
                tokio::select! {
                    line = stdout_reader.next_line() => {
                        match line {
                            Ok(Some(text)) => {
                                Self::handle_stdout_line(&app_clone, &text);
                            }
                            Ok(None) => {
                                info!("Extension host stdout closed");
                                break;
                            }
                            Err(e) => {
                                error!("Error reading extension host stdout: {}", e);
                                break;
                            }
                        }
                    }
                    line = stderr_reader.next_line() => {
                        match line {
                            Ok(Some(text)) => {
                                info!("[ext-host stderr] {}", text);
                            }
                            Ok(None) => {}
                            Err(e) => {
                                warn!("Error reading extension host stderr: {}", e);
                            }
                        }
                    }
                }
            }
        });

        info!("Node.js extension host started");

        Ok(Self {
            stdin,
            child,
            reader_handle,
        })
    }

    pub async fn send(&self, message: &str) -> Result<(), String> {
        let mut stdin = self.stdin.lock().await;
        let line = format!("{}\n", message);
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to extension host stdin: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush extension host stdin: {}", e))?;
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut child = self.child.lock().await;
        child
            .kill()
            .await
            .map_err(|e| format!("Failed to kill extension host: {}", e))?;
        info!("Node.js extension host stopped");
        Ok(())
    }

    fn sidecar_dir() -> PathBuf {
        let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        dir.push("sidecar");
        dir.push("extension-host");
        dir
    }

    fn handle_stdout_line(app: &AppHandle, line: &str) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }

        match serde_json::from_str::<NodeHostMessage>(trimmed) {
            Ok(msg) => {
                let _ = app.emit("extension-host:message", &msg);
            }
            Err(e) => {
                warn!("Non-JSON output from extension host ({}): {}", e, trimmed);
            }
        }
    }
}

impl Drop for NodeHostProcess {
    fn drop(&mut self) {
        self.reader_handle.abort();
    }
}
