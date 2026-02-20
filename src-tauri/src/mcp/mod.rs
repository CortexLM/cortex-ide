//! MCP (Model Context Protocol) support for Cortex Desktop
//!
//! This module provides MCP server functionality that allows AI agents
//! (like Cursor, Claude Code, etc.) to interact with the Cortex Desktop
//! application for debugging and automation.
//!
//! Features:
//! - Screenshot capture
//! - DOM access
//! - Window management
//! - Input simulation (keyboard/mouse)
//! - JavaScript execution
//! - LocalStorage management

pub mod commands;
mod socket_server;
mod tools;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime};
use tracing::{error, info};

pub use socket_server::SocketServer;

/// Socket connection type for MCP
#[derive(Clone, Debug)]
pub enum SocketType {
    /// Use IPC (Unix domain socket or Windows named pipe)
    Ipc {
        /// Path to the socket file. If None, a default path will be used.
        path: Option<PathBuf>,
    },
    /// Use TCP socket
    Tcp {
        /// Host to bind to (e.g., "127.0.0.1")
        host: String,
        /// Port to bind to
        port: u16,
    },
}

impl Default for SocketType {
    fn default() -> Self {
        SocketType::Ipc { path: None }
    }
}

/// MCP Plugin configuration
#[derive(Clone)]
pub struct McpConfig {
    /// Application name (used for window identification)
    pub application_name: String,
    /// Socket configuration
    pub socket_type: SocketType,
    /// Whether to start the socket server automatically
    pub auto_start: bool,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            application_name: "Cortex Desktop".to_string(),
            socket_type: SocketType::default(),
            auto_start: true,
        }
    }
}

impl McpConfig {
    pub fn new(application_name: impl Into<String>) -> Self {
        Self {
            application_name: application_name.into(),
            ..Default::default()
        }
    }

    pub fn socket_path(mut self, path: impl Into<PathBuf>) -> Self {
        self.socket_type = SocketType::Ipc {
            path: Some(path.into()),
        };
        self
    }

    pub fn tcp(mut self, host: impl Into<String>, port: u16) -> Self {
        self.socket_type = SocketType::Tcp {
            host: host.into(),
            port,
        };
        self
    }

    pub fn auto_start(mut self, auto_start: bool) -> Self {
        self.auto_start = auto_start;
        self
    }
}

/// MCP State managed by Tauri
pub struct McpState<R: Runtime> {
    pub socket_server: Arc<Mutex<Option<SocketServer<R>>>>,
    pub config: McpConfig,
}

impl<R: Runtime> McpState<R> {
    pub fn new(config: McpConfig) -> Self {
        Self {
            socket_server: Arc::new(Mutex::new(None)),
            config,
        }
    }

    /// Start the MCP socket server
    pub fn start(&self, app: &AppHandle<R>) -> Result<(), String> {
        let mut guard = self.socket_server.lock().map_err(|e| e.to_string())?;

        if guard.is_some() {
            return Ok(()); // Already started
        }

        let mut server = SocketServer::new(app.clone(), self.config.clone());
        server.start().map_err(|e| e.to_string())?;

        *guard = Some(server);
        info!("[MCP] Socket server started");
        Ok(())
    }

    /// Stop the MCP socket server
    pub fn stop(&self) -> Result<(), String> {
        let mut guard = self.socket_server.lock().map_err(|e| e.to_string())?;

        if let Some(server) = guard.take() {
            server.stop().map_err(|e| e.to_string())?;
            info!("[MCP] Socket server stopped");
        }

        Ok(())
    }

    /// Check if the server is running
    pub fn is_running(&self) -> bool {
        self.socket_server
            .lock()
            .map(|g| g.is_some())
            .unwrap_or(false)
    }
}

/// Initialize MCP for the application
pub fn init_mcp<R: Runtime>(app: &AppHandle<R>, config: McpConfig) {
    let state: McpState<R> = McpState::new(config.clone());

    // Only start in debug mode by default
    #[cfg(debug_assertions)]
    if config.auto_start {
        if let Err(e) = state.start(app) {
            error!("[MCP] Failed to start socket server: {}", e);
        }
    }

    app.manage(state);
}

/// Get default socket path based on platform
pub fn get_default_socket_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Windows named pipe
        PathBuf::from(r"\\.\pipe\Cortex-desktop-mcp")
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::temp_dir().join("Cortex-desktop-mcp.sock")
    }
}
