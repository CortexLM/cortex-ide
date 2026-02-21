//! SSH Terminal PTY Module for Cortex
//!
//! Provides SSH-based pseudo-terminal support for remote shell sessions.
//! Uses the ssh2 crate for SSH connections and PTY channel management.
//!
//! Features:
//! - SSH connection with password, key, and agent authentication
//! - PTY channel creation for interactive shell sessions
//! - Real-time data streaming with flow control
//! - Terminal resize support
//! - Connection health monitoring

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use ssh2::{Channel, Session};
use std::net::TcpStream;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::remote::{AuthMethod, SecureAuthCredentials};

/// Output batching interval in milliseconds
const OUTPUT_BATCH_INTERVAL_MS: u64 = 16;

/// Read buffer size for SSH PTY output
const SSH_READ_BUFFER_SIZE: usize = 8192;

/// Maximum pending bytes before pausing output (backpressure)
const FLOW_CONTROL_MAX_PENDING: usize = 100_000;

/// Reconnection attempt interval
const RECONNECT_INTERVAL_MS: u64 = 5000;

/// Connection timeout in seconds
const CONNECTION_TIMEOUT_SECS: u64 = 30;

/// SSH connection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    /// Profile ID for credential lookup
    pub profile_id: Option<String>,
    /// Initial working directory on remote
    pub initial_cwd: Option<String>,
    /// Environment variables to set on remote
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// SSH terminal session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHTerminalInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub cols: u16,
    pub rows: u16,
    pub status: SSHConnectionStatus,
    pub created_at: i64,
    pub connected_at: Option<i64>,
    pub remote_platform: Option<String>,
    pub remote_home: Option<String>,
    pub cwd: Option<String>,
}

/// SSH connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SSHConnectionStatus {
    Connecting,
    Connected,
    Disconnected,
    Reconnecting,
    Error { message: String },
}

/// SSH terminal output event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHTerminalOutput {
    pub session_id: String,
    pub data: String,
}

/// SSH terminal status event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHTerminalStatus {
    pub session_id: String,
    pub status: SSHConnectionStatus,
}

/// Flow controller for SSH terminal output backpressure
struct FlowController {
    pending_bytes: AtomicUsize,
    max_pending: usize,
}

impl FlowController {
    fn new() -> Self {
        Self {
            pending_bytes: AtomicUsize::new(0),
            max_pending: FLOW_CONTROL_MAX_PENDING,
        }
    }

    fn should_pause(&self) -> bool {
        self.pending_bytes.load(Ordering::Relaxed) > self.max_pending
    }

    fn add_pending(&self, bytes: usize) {
        self.pending_bytes.fetch_add(bytes, Ordering::Relaxed);
    }

    fn acknowledge(&self, bytes: usize) {
        let current = self.pending_bytes.load(Ordering::Relaxed);
        let new_value = current.saturating_sub(bytes);
        self.pending_bytes.store(new_value, Ordering::Relaxed);
    }
}

/// Internal SSH terminal session
struct SSHSession {
    info: SSHTerminalInfo,
    config: SSHConfig,
    session: Session,
    channel: Arc<Mutex<Channel>>,
    running: Arc<AtomicBool>,
    flow_controller: Arc<FlowController>,
    _reader_handle: Option<thread::JoinHandle<()>>,
}

/// SSH Terminal state manager
#[derive(Clone)]
pub struct SSHTerminalState {
    sessions: Arc<Mutex<HashMap<String, Arc<Mutex<SSHSession>>>>>,
}

impl SSHTerminalState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Establish SSH connection and create session
    pub fn connect(
        &self,
        app_handle: &AppHandle,
        config: SSHConfig,
        cols: u16,
        rows: u16,
    ) -> Result<SSHTerminalInfo, String> {
        let session_id = Uuid::new_v4().to_string();

        info!(
            "SSH connecting to {}@{}:{}",
            config.username, config.host, config.port
        );

        // Create TCP connection
        let addr = format!("{}:{}", config.host, config.port);
        let tcp = TcpStream::connect(&addr).map_err(|e| format!("TCP connection failed: {}", e))?;

        tcp.set_read_timeout(Some(Duration::from_secs(CONNECTION_TIMEOUT_SECS)))
            .map_err(|e| format!("Failed to set read timeout: {}", e))?;
        tcp.set_write_timeout(Some(Duration::from_secs(CONNECTION_TIMEOUT_SECS)))
            .map_err(|e| format!("Failed to set write timeout: {}", e))?;

        // Create SSH session
        let mut session =
            Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;

        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        let profile_id = config.profile_id.as_deref().unwrap_or(&session_id);
        let credentials = SecureAuthCredentials::load_from_keyring(profile_id, &config.auth_method)
            .map_err(|e| format!("Failed to load credentials: {}", e))?;

        match &config.auth_method {
            AuthMethod::Password { .. } => {
                let password = credentials
                    .password()
                    .ok_or_else(|| "Password not found".to_string())?;
                session
                    .userauth_password(&config.username, password)
                    .map_err(|e| format!("Password auth failed: {}", e))?;
            }
            AuthMethod::Key {
                private_key_path, ..
            } => {
                let key_path = std::path::PathBuf::from(private_key_path);
                if !key_path.exists() {
                    return Err(format!("Private key not found: {}", private_key_path));
                }
                session
                    .userauth_pubkey_file(
                        &config.username,
                        None,
                        &key_path,
                        credentials.passphrase(),
                    )
                    .map_err(|e| format!("Key auth failed: {}", e))?;
            }
            AuthMethod::Agent => {
                let mut agent = session
                    .agent()
                    .map_err(|e| format!("Agent connection failed: {}", e))?;
                agent
                    .connect()
                    .map_err(|e| format!("Agent connect failed: {}", e))?;
                agent
                    .list_identities()
                    .map_err(|e| format!("Agent list identities failed: {}", e))?;

                let identities = agent
                    .identities()
                    .map_err(|e| format!("Failed to get identities: {}", e))?;

                let mut authenticated = false;
                for identity in identities.iter() {
                    if agent.userauth(&config.username, identity).is_ok() {
                        authenticated = true;
                        break;
                    }
                }

                if !authenticated {
                    return Err("No valid SSH key found in agent".to_string());
                }
            }
        }

        if !session.authenticated() {
            return Err("Authentication failed".to_string());
        }

        info!("SSH authenticated to {}@{}", config.username, config.host);

        // Get remote platform and home directory
        let (remote_platform, remote_home) = self.get_remote_info(&session)?;

        // Create PTY channel
        let mut channel = session
            .channel_session()
            .map_err(|e| format!("Failed to create channel: {}", e))?;

        // Request PTY with xterm-256color
        channel
            .request_pty(
                "xterm-256color",
                None,
                Some((cols as u32, rows as u32, 0, 0)),
            )
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        // Set environment variables
        for (key, value) in &config.env {
            let _ = channel.setenv(key, value);
        }

        // Start shell
        channel
            .shell()
            .map_err(|e| format!("Failed to start shell: {}", e))?;

        // Make channel non-blocking for reading
        session.set_blocking(false);

        let info = SSHTerminalInfo {
            id: session_id.clone(),
            name: format!("{}@{}", config.username, config.host),
            host: config.host.clone(),
            port: config.port,
            username: config.username.clone(),
            cols,
            rows,
            status: SSHConnectionStatus::Connected,
            created_at: chrono::Utc::now().timestamp_millis(),
            connected_at: Some(chrono::Utc::now().timestamp_millis()),
            remote_platform: Some(remote_platform),
            remote_home: Some(remote_home.clone()),
            cwd: config.initial_cwd.clone().or(Some(remote_home)),
        };

        // Emit connected event
        let _ = app_handle.emit("ssh-terminal:connected", &info);

        // Create flow controller
        let flow_controller = Arc::new(FlowController::new());
        let flow_controller_clone = flow_controller.clone();

        // Create running flag
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        // Wrap channel in Arc<Mutex> for shared access between reader thread and write operations
        let channel = Arc::new(Mutex::new(channel));
        let channel_for_read = channel.clone();

        // Start reader thread
        let app_handle_clone = app_handle.clone();
        let session_id_clone = session_id.clone();

        let reader_handle = thread::spawn(move || {
            Self::reader_loop_shared(
                channel_for_read,
                session_id_clone,
                app_handle_clone,
                running_clone,
                flow_controller_clone,
            );
        });

        // Store session
        let ssh_session = SSHSession {
            info,
            config,
            session,
            channel,
            running,
            flow_controller,
            _reader_handle: Some(reader_handle),
        };

        let info_clone = ssh_session.info.clone();

        {
            let mut sessions = self.sessions.lock();
            sessions.insert(session_id, Arc::new(Mutex::new(ssh_session)));
        }

        Ok(info_clone)
    }

    /// Reader loop for SSH channel output using shared Arc<Mutex<Channel>>
    fn reader_loop_shared(
        channel: Arc<Mutex<Channel>>,
        session_id: String,
        app_handle: AppHandle,
        running: Arc<AtomicBool>,
        flow_controller: Arc<FlowController>,
    ) {
        let mut buf = [0u8; SSH_READ_BUFFER_SIZE];
        let mut leftover = Vec::new();

        loop {
            if !running.load(Ordering::Relaxed) {
                break;
            }

            // Check for backpressure
            if flow_controller.should_pause() {
                thread::sleep(Duration::from_millis(1));
                continue;
            }

            // Lock channel only for the read operation
            let read_result = {
                let mut channel_guard = channel.lock();
                channel_guard.read(&mut buf)
            };

            match read_result {
                Ok(0) => {
                    // EOF - channel closed
                    break;
                }
                Ok(n) => {
                    leftover.extend_from_slice(&buf[..n]);

                    // Process valid UTF-8
                    match std::str::from_utf8(&leftover) {
                        Ok(s) => {
                            Self::emit_output(&app_handle, &session_id, s, &flow_controller);
                            leftover.clear();
                        }
                        Err(e) => {
                            let valid_up_to = e.valid_up_to();
                            if valid_up_to > 0 {
                                let s = std::str::from_utf8(&leftover[..valid_up_to])
                                    .unwrap_or_default();
                                Self::emit_output(&app_handle, &session_id, s, &flow_controller);
                            }

                            if let Some(error_len) = e.error_len() {
                                let s = String::from_utf8_lossy(
                                    &leftover[valid_up_to..valid_up_to + error_len],
                                );
                                Self::emit_output(&app_handle, &session_id, &s, &flow_controller);
                                leftover = leftover[valid_up_to + error_len..].to_vec();
                            } else {
                                leftover = leftover[valid_up_to..].to_vec();
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No data available, sleep briefly
                    thread::sleep(Duration::from_millis(OUTPUT_BATCH_INTERVAL_MS));
                }
                Err(e) => {
                    error!("SSH read error: {}", e);
                    break;
                }
            }
        }

        // Emit disconnected status
        let status = SSHTerminalStatus {
            session_id: session_id.clone(),
            status: SSHConnectionStatus::Disconnected,
        };
        let _ = app_handle.emit("ssh-terminal:status", &status);

        info!("SSH reader loop ended for session {}", session_id);
    }

    fn emit_output(
        app_handle: &AppHandle,
        session_id: &str,
        data: &str,
        flow_controller: &FlowController,
    ) {
        let output = SSHTerminalOutput {
            session_id: session_id.to_string(),
            data: data.to_string(),
        };

        if let Err(e) = app_handle.emit("ssh-terminal:output", &output) {
            warn!("Failed to emit SSH output: {}", e);
        } else {
            flow_controller.add_pending(data.len());
        }
    }

    fn get_remote_info(&self, session: &Session) -> Result<(String, String), String> {
        let mut channel = session
            .channel_session()
            .map_err(|e| format!("Failed to create info channel: {}", e))?;

        // Get platform
        channel
            .exec("uname -s 2>/dev/null || echo Windows")
            .map_err(|e| format!("Failed to exec uname: {}", e))?;

        let mut platform = String::new();
        channel
            .read_to_string(&mut platform)
            .map_err(|e| format!("Failed to read platform: {}", e))?;
        let platform = platform.trim().to_string();
        channel.wait_close().ok();

        // Get home directory
        let mut channel = session
            .channel_session()
            .map_err(|e| format!("Failed to create home channel: {}", e))?;

        channel
            .exec("echo $HOME")
            .map_err(|e| format!("Failed to exec echo: {}", e))?;

        let mut home = String::new();
        channel
            .read_to_string(&mut home)
            .map_err(|e| format!("Failed to read home: {}", e))?;
        let home = home.trim().to_string();
        channel.wait_close().ok();

        Ok((platform, home))
    }

    /// Write data to SSH PTY
    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let session = session.lock();
        let channel = session.channel.clone();
        drop(session); // Release session lock before acquiring channel lock

        let mut channel_guard = channel.lock();
        channel_guard
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to SSH: {}", e))?;
        channel_guard
            .flush()
            .map_err(|e| format!("Failed to flush SSH: {}", e))?;

        Ok(())
    }

    /// Resize SSH PTY
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let session = session.lock();
        {
            let channel = session.channel.clone();
            drop(session); // Release session lock temporarily
            let mut channel_guard = channel.lock();
            channel_guard
                .request_pty_size(cols as u32, rows as u32, None, None)
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            drop(channel_guard);
            // Re-acquire session lock to update info
            let sessions = self.sessions.lock();
            let session = sessions
                .get(session_id)
                .ok_or_else(|| format!("Session {} not found", session_id))?;
            let mut session = session.lock();
            session.info.cols = cols;
            session.info.rows = rows;
        }

        info!(
            "SSH PTY resized to {}x{} for session {}",
            cols, rows, session_id
        );
        Ok(())
    }

    /// Acknowledge processed output bytes
    pub fn acknowledge(&self, session_id: &str, bytes: usize) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let session = session.lock();
        session.flow_controller.acknowledge(bytes);
        Ok(())
    }

    /// Disconnect SSH session
    pub fn disconnect(&self, app_handle: &AppHandle, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();

        if let Some(session) = sessions.remove(session_id) {
            let session = session.lock();

            // Signal reader thread to stop
            session.running.store(false, Ordering::Relaxed);

            // Close channel
            {
                let mut channel_guard = session.channel.lock();
                let _ = channel_guard.send_eof();
                let _ = channel_guard.close();
            }

            // Emit disconnected event
            let status = SSHTerminalStatus {
                session_id: session_id.to_string(),
                status: SSHConnectionStatus::Disconnected,
            };
            let _ = app_handle.emit("ssh-terminal:status", &status);

            info!("SSH session {} disconnected", session_id);
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    /// Get session info
    pub fn get_session(&self, session_id: &str) -> Result<Option<SSHTerminalInfo>, String> {
        let sessions = self.sessions.lock();
        Ok(sessions.get(session_id).map(|s| s.lock().info.clone()))
    }

    /// List all SSH terminal sessions
    pub fn list_sessions(&self) -> Result<Vec<SSHTerminalInfo>, String> {
        let sessions = self.sessions.lock();
        Ok(sessions.values().map(|s| s.lock().info.clone()).collect())
    }

    /// Execute a command on SSH connection (non-PTY)
    pub fn exec_command(&self, session_id: &str, command: &str) -> Result<String, String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let session = session.lock();

        let mut channel = session
            .session
            .channel_session()
            .map_err(|e| format!("Failed to create exec channel: {}", e))?;

        channel
            .exec(command)
            .map_err(|e| format!("Failed to exec command: {}", e))?;

        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| format!("Failed to read output: {}", e))?;

        channel.wait_close().ok();

        Ok(output)
    }

    /// Close all SSH sessions
    pub fn close_all(&self, app_handle: &AppHandle) -> Result<(), String> {
        let session_ids: Vec<String> = {
            let sessions = self.sessions.lock();
            sessions.keys().cloned().collect()
        };

        for id in session_ids {
            let _ = self.disconnect(app_handle, &id);
        }

        Ok(())
    }
}

// ===== Tauri Commands =====

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    config: SSHConfig,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<SSHTerminalInfo, String> {
    let state = app.state::<SSHTerminalState>();
    state.connect(&app, config, cols.unwrap_or(120), rows.unwrap_or(30))
}

#[tauri::command]
pub async fn ssh_pty_write(app: AppHandle, session_id: String, data: String) -> Result<(), String> {
    let state = app.state::<SSHTerminalState>();
    state.write(&session_id, &data)
}

#[tauri::command]
pub async fn ssh_pty_resize(
    app: AppHandle,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let state = app.state::<SSHTerminalState>();
    state.resize(&session_id, cols, rows)
}

#[tauri::command]
pub async fn ssh_pty_ack(app: AppHandle, session_id: String, bytes: usize) -> Result<(), String> {
    let state = app.state::<SSHTerminalState>();
    state.acknowledge(&session_id, bytes)
}

#[tauri::command]
pub async fn ssh_disconnect(app: AppHandle, session_id: String) -> Result<(), String> {
    let state = app.state::<SSHTerminalState>();
    state.disconnect(&app, &session_id)
}

#[tauri::command]
pub async fn ssh_get_session(
    app: AppHandle,
    session_id: String,
) -> Result<Option<SSHTerminalInfo>, String> {
    let state = app.state::<SSHTerminalState>();
    state.get_session(&session_id)
}

#[tauri::command]
pub async fn ssh_list_sessions(app: AppHandle) -> Result<Vec<SSHTerminalInfo>, String> {
    let state = app.state::<SSHTerminalState>();
    state.list_sessions()
}

#[tauri::command]
pub async fn ssh_exec(
    app: AppHandle,
    session_id: String,
    command: String,
) -> Result<String, String> {
    let state = app.state::<SSHTerminalState>();
    state.exec_command(&session_id, &command)
}

#[tauri::command]
pub async fn ssh_close_all(app: AppHandle) -> Result<(), String> {
    let state = app.state::<SSHTerminalState>();
    state.close_all(&app)
}

// ============================================================================
// SSH Profile Management Commands
// ============================================================================

/// SSH Profile structure for persistence
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(default)]
    pub use_agent: bool,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

fn get_ssh_profiles_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;
    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    path.push("ssh_profiles.json");
    Ok(path)
}

fn load_ssh_profiles(app: &AppHandle) -> Result<Vec<SSHProfile>, String> {
    let path = get_ssh_profiles_path(app)?;
    if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read SSH profiles: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse SSH profiles: {}", e))
    } else {
        Ok(Vec::new())
    }
}

fn save_ssh_profiles(app: &AppHandle, profiles: &[SSHProfile]) -> Result<(), String> {
    let path = get_ssh_profiles_path(app)?;
    let content = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize SSH profiles: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write SSH profiles: {}", e))
}

/// Save or update an SSH profile
#[tauri::command]
pub async fn ssh_save_profile(app: AppHandle, profile: SSHProfile) -> Result<(), String> {
    let mut profiles = load_ssh_profiles(&app)?;

    // Update if exists, otherwise add
    if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }

    save_ssh_profiles(&app, &profiles)?;
    tracing::info!("SSH profile saved");
    Ok(())
}

/// Delete an SSH profile
#[tauri::command]
pub async fn ssh_delete_profile(app: AppHandle, profile_id: String) -> Result<(), String> {
    let mut profiles = load_ssh_profiles(&app)?;
    profiles.retain(|p| p.id != profile_id);
    save_ssh_profiles(&app, &profiles)?;
    tracing::info!("SSH profile deleted: {}", profile_id);
    Ok(())
}

/// Generate a unique profile ID
#[tauri::command]
pub fn ssh_generate_profile_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// List all SSH profiles
#[tauri::command]
pub async fn ssh_list_profiles(app: AppHandle) -> Result<Vec<SSHProfile>, String> {
    load_ssh_profiles(&app)
}
