//! MCP Socket Server
//!
//! Handles IPC and TCP socket communication for MCP protocol.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tracing::{error, info};

use super::tools;
use super::{McpConfig, SocketType, get_default_socket_path};

#[cfg(not(target_os = "windows"))]
use interprocess::local_socket::{
    GenericFilePath, Listener as IpcListener, ListenerOptions, Stream as IpcStream, ToFsName,
    prelude::*,
};

#[cfg(target_os = "windows")]
use interprocess::local_socket::{
    GenericNamespaced, Listener as IpcListener, ListenerOptions, Stream as IpcStream, ToNsName,
    prelude::*,
};

/// Request format from MCP clients
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SocketRequest {
    pub command: String,
    pub payload: Value,
}

/// Response format to MCP clients
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocketResponse {
    pub success: bool,
    pub data: Option<Value>,
    pub error: Option<String>,
}

impl SocketResponse {
    pub fn success(data: impl Serialize) -> Self {
        Self {
            success: true,
            data: Some(serde_json::to_value(data).unwrap_or(Value::Null)),
            error: None,
        }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.into()),
        }
    }
}

/// Unified stream type for IPC and TCP
enum UnifiedStream {
    #[cfg(not(target_os = "windows"))]
    Ipc(IpcStream),
    #[cfg(target_os = "windows")]
    Ipc(IpcStream),
    Tcp(TcpStream),
}

impl Read for UnifiedStream {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        match self {
            UnifiedStream::Ipc(stream) => stream.read(buf),
            UnifiedStream::Tcp(stream) => stream.read(buf),
        }
    }
}

impl Write for UnifiedStream {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        match self {
            UnifiedStream::Ipc(stream) => stream.write(buf),
            UnifiedStream::Tcp(stream) => stream.write(buf),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            UnifiedStream::Ipc(stream) => stream.flush(),
            UnifiedStream::Tcp(stream) => stream.flush(),
        }
    }
}

impl UnifiedStream {
    fn try_clone(&self) -> std::io::Result<Self> {
        match self {
            UnifiedStream::Ipc(stream) => {
                use interprocess::TryClone;
                Ok(UnifiedStream::Ipc(stream.try_clone()?))
            }
            UnifiedStream::Tcp(stream) => Ok(UnifiedStream::Tcp(stream.try_clone()?)),
        }
    }
}

/// Unified listener type
enum UnifiedListener {
    Ipc(IpcListener),
    Tcp(TcpListener),
}

/// MCP Socket Server
pub struct SocketServer<R: Runtime> {
    app: AppHandle<R>,
    config: McpConfig,
    running: Arc<Mutex<bool>>,
}

impl<R: Runtime> SocketServer<R> {
    pub fn new(app: AppHandle<R>, config: McpConfig) -> Self {
        Self {
            app,
            config,
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        info!("[MCP] Starting socket server...");

        let listener = match &self.config.socket_type {
            SocketType::Ipc { path } => {
                let socket_path = path.clone().unwrap_or_else(get_default_socket_path);

                // Remove existing socket file on Unix
                #[cfg(not(target_os = "windows"))]
                {
                    if socket_path.exists() {
                        let _ = std::fs::remove_file(&socket_path);
                    }
                }

                info!("[MCP] Creating IPC socket at: {}", socket_path.display());

                #[cfg(not(target_os = "windows"))]
                let name = socket_path
                    .to_string_lossy()
                    .to_string()
                    .to_fs_name::<GenericFilePath>()
                    .map_err(|e| format!("Failed to create socket name: {}", e))?;

                #[cfg(target_os = "windows")]
                let name = socket_path
                    .to_string_lossy()
                    .to_string()
                    .to_ns_name::<GenericNamespaced>()
                    .map_err(|e| format!("Failed to create pipe name: {}", e))?;

                let opts = ListenerOptions::new().name(name);
                let ipc_listener = opts
                    .create_sync()
                    .map_err(|e| format!("Failed to create IPC socket: {}", e))?;

                UnifiedListener::Ipc(ipc_listener)
            }
            SocketType::Tcp { host, port } => {
                let addr = format!("{}:{}", host, port);
                info!("[MCP] Creating TCP socket at: {}", addr);

                let tcp_listener = TcpListener::bind(&addr)
                    .map_err(|e| format!("Failed to bind TCP socket: {}", e))?;

                UnifiedListener::Tcp(tcp_listener)
            }
        };

        *self
            .running
            .lock()
            .map_err(|_| "Failed to acquire running lock")? = true;

        let app = self.app.clone();
        let running = self.running.clone();
        let config = self.config.clone();

        thread::spawn(move || {
            Self::run_server(listener, app, running, config);
        });

        info!("[MCP] Socket server started successfully");
        Ok(())
    }

    fn run_server(
        listener: UnifiedListener,
        app: AppHandle<R>,
        running: Arc<Mutex<bool>>,
        _config: McpConfig,
    ) {
        match listener {
            UnifiedListener::Ipc(ipc_listener) => {
                info!("[MCP] IPC listener thread started");
                for conn in ipc_listener.incoming() {
                    if !*running.lock().unwrap_or_else(|e| e.into_inner()) {
                        break;
                    }

                    match conn {
                        Ok(stream) => {
                            info!("[MCP] Accepted new IPC connection");
                            let app_clone = app.clone();
                            let stream = UnifiedStream::Ipc(stream);

                            thread::spawn(move || {
                                if let Err(e) = Self::handle_client(stream, app_clone) {
                                    if !e.contains("pipe") && !e.contains("broken") {
                                        error!("[MCP] Client error: {}", e);
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            error!("[MCP] IPC accept error: {}", e);
                            thread::sleep(Duration::from_millis(100));
                        }
                    }
                }
            }
            UnifiedListener::Tcp(tcp_listener) => {
                info!("[MCP] TCP listener thread started");
                tcp_listener.set_nonblocking(true).ok();

                loop {
                    if !*running.lock().unwrap_or_else(|e| e.into_inner()) {
                        break;
                    }

                    match tcp_listener.accept() {
                        Ok((stream, addr)) => {
                            info!("[MCP] Accepted TCP connection from: {}", addr);
                            stream.set_nonblocking(false).ok();
                            let app_clone = app.clone();
                            let stream = UnifiedStream::Tcp(stream);

                            thread::spawn(move || {
                                if let Err(e) = Self::handle_client(stream, app_clone) {
                                    error!("[MCP] TCP client error: {}", e);
                                }
                            });
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(100));
                        }
                        Err(e) => {
                            error!("[MCP] TCP accept error: {}", e);
                            thread::sleep(Duration::from_millis(100));
                        }
                    }
                }
            }
        }

        info!("[MCP] Listener thread ended");
    }

    fn handle_client(stream: UnifiedStream, app: AppHandle<R>) -> Result<(), String> {
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| format!("Failed to create runtime: {}", e))?;

        rt.block_on(async {
            let stream_clone = stream
                .try_clone()
                .map_err(|e| format!("Failed to clone stream: {}", e))?;

            let mut reader = BufReader::new(stream_clone);
            let mut writer = stream;

            loop {
                let mut line = String::new();
                match reader.read_line(&mut line) {
                    Ok(0) => {
                        info!("[MCP] Client disconnected");
                        return Ok(());
                    }
                    Ok(_) => {}
                    Err(e) => {
                        if e.kind() == std::io::ErrorKind::BrokenPipe {
                            return Ok(());
                        }
                        return Err(format!("Read error: {}", e));
                    }
                }

                let request: SocketRequest = match serde_json::from_str(&line) {
                    Ok(req) => req,
                    Err(e) => {
                        let response = SocketResponse::error(format!("Invalid request: {}", e));
                        let json = match serde_json::to_string(&response) {
                            Ok(s) => s + "\n",
                            Err(ser_err) => {
                                tracing::error!("Failed to serialize error response: {}", ser_err);
                                continue;
                            }
                        };
                        writer.write_all(json.as_bytes()).ok();
                        writer.flush().ok();
                        continue;
                    }
                };

                info!("[MCP] Command: {}", request.command);

                let response = tools::handle_command(&app, &request.command, request.payload).await;

                let json = serde_json::to_string(&response).unwrap_or_else(|_| {
                    r#"{"success":false,"error":"Serialization failed"}"#.to_string()
                }) + "\n";

                if let Err(e) = writer.write_all(json.as_bytes()) {
                    if e.kind() == std::io::ErrorKind::BrokenPipe {
                        return Ok(());
                    }
                    return Err(format!("Write error: {}", e));
                }
                writer.flush().ok();
            }
        })
    }

    pub fn stop(&self) -> Result<(), String> {
        *self
            .running
            .lock()
            .map_err(|_| "Failed to acquire running lock")? = false;
        info!("[MCP] Socket server stop requested");
        Ok(())
    }
}
