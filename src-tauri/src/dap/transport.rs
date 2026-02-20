//! DAP Transport layer
//!
//! Handles communication with debug adapters via stdio or TCP.

use std::process::Stdio;

use anyhow::{Context, Result};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader as TokioBufReader};
use tokio::net::TcpStream;
use tokio::process::{
    Child as TokioChild, ChildStdin as TokioChildStdin, ChildStdout as TokioChildStdout,
};

use super::protocol::DapMessage;

/// Transport abstraction for DAP communication
#[allow(clippy::large_enum_variant)]
pub enum Transport {
    Stdio(StdioTransport),
    Tcp(TcpTransport),
}

impl Transport {
    /// Create a new stdio transport by spawning a debug adapter process
    pub async fn spawn_stdio(
        command: &str,
        args: &[String],
        cwd: Option<&str>,
        env: Option<&std::collections::HashMap<String, String>>,
    ) -> Result<Self> {
        let transport = StdioTransport::new(command, args, cwd, env).await?;
        Ok(Self::Stdio(transport))
    }

    /// Create a new TCP transport by connecting to a debug adapter server
    pub async fn connect_tcp(host: &str, port: u16) -> Result<Self> {
        let transport = TcpTransport::new(host, port).await?;
        Ok(Self::Tcp(transport))
    }

    /// Send a DAP message
    pub async fn send(&mut self, message: &DapMessage) -> Result<()> {
        match self {
            Self::Stdio(t) => t.send(message).await,
            Self::Tcp(t) => t.send(message).await,
        }
    }

    /// Receive a DAP message
    pub async fn receive(&mut self) -> Result<DapMessage> {
        match self {
            Self::Stdio(t) => t.receive().await,
            Self::Tcp(t) => t.receive().await,
        }
    }

    /// Kill the transport (process or connection)
    pub async fn kill(&mut self) -> Result<()> {
        match self {
            Self::Stdio(t) => t.kill().await,
            Self::Tcp(t) => t.close().await,
        }
    }

    /// Check if transport is still alive
    pub fn is_alive(&self) -> bool {
        match self {
            Self::Stdio(t) => t.is_alive(),
            Self::Tcp(t) => t.is_connected(),
        }
    }
}

/// Stdio transport for debug adapters launched as child processes
pub struct StdioTransport {
    process: TokioChild,
    stdin: TokioChildStdin,
    stdout: TokioBufReader<TokioChildStdout>,
    read_buffer: String,
}

impl StdioTransport {
    pub async fn new(
        command: &str,
        args: &[String],
        cwd: Option<&str>,
        env: Option<&std::collections::HashMap<String, String>>,
    ) -> Result<Self> {
        let mut cmd = crate::process_utils::async_command(command);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        if let Some(env) = env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        let mut process = cmd
            .spawn()
            .context("Failed to spawn debug adapter process")?;

        let stdin = process
            .stdin
            .take()
            .context("Failed to open stdin of debug adapter")?;
        let stdout = process
            .stdout
            .take()
            .context("Failed to open stdout of debug adapter")?;

        Ok(Self {
            process,
            stdin,
            stdout: TokioBufReader::new(stdout),
            read_buffer: String::new(),
        })
    }

    pub async fn send(&mut self, message: &DapMessage) -> Result<()> {
        let json = serde_json::to_string(message)?;
        let content_length = json.len();

        let header = format!("Content-Length: {}\r\n\r\n", content_length);
        self.stdin.write_all(header.as_bytes()).await?;
        self.stdin.write_all(json.as_bytes()).await?;
        self.stdin.flush().await?;

        tracing::debug!("DAP -> {}", json);
        Ok(())
    }

    pub async fn receive(&mut self) -> Result<DapMessage> {
        // Read headers
        let mut content_length: Option<usize> = None;

        loop {
            self.read_buffer.clear();
            let bytes_read = self.stdout.read_line(&mut self.read_buffer).await?;

            if bytes_read == 0 {
                anyhow::bail!("Debug adapter closed connection");
            }

            let line = self.read_buffer.trim();

            if line.is_empty() {
                break;
            }

            if let Some(length_str) = line.strip_prefix("Content-Length: ") {
                content_length = Some(length_str.parse()?);
            }
        }

        let content_length =
            content_length.context("Missing Content-Length header in DAP message")?;

        // Read content
        let mut content = vec![0u8; content_length];
        self.stdout.read_exact(&mut content).await?;

        let json = String::from_utf8(content)?;
        tracing::debug!("DAP <- {}", json);

        let message: DapMessage = serde_json::from_str(&json)?;
        Ok(message)
    }

    pub async fn kill(&mut self) -> Result<()> {
        self.process.kill().await.ok();
        Ok(())
    }

    pub fn is_alive(&self) -> bool {
        // Check if process is still running
        // For tokio Child, we check if the id() returns Some (process still exists)
        // Note: This doesn't guarantee the process hasn't exited, but it's a reasonable check
        // A full check would require try_wait() which is async
        self.process.id().is_some()
    }
}

/// TCP transport for debug adapters running as servers
pub struct TcpTransport {
    stream: TcpStream,
    read_buffer: String,
}

impl TcpTransport {
    pub async fn new(host: &str, port: u16) -> Result<Self> {
        let addr = format!("{}:{}", host, port);
        let stream = TcpStream::connect(&addr)
            .await
            .context(format!("Failed to connect to debug adapter at {}", addr))?;

        Ok(Self {
            stream,
            read_buffer: String::new(),
        })
    }

    pub async fn send(&mut self, message: &DapMessage) -> Result<()> {
        let json = serde_json::to_string(message)?;
        let content_length = json.len();

        let header = format!("Content-Length: {}\r\n\r\n", content_length);
        self.stream.write_all(header.as_bytes()).await?;
        self.stream.write_all(json.as_bytes()).await?;
        self.stream.flush().await?;

        tracing::debug!("DAP -> {}", json);
        Ok(())
    }

    pub async fn receive(&mut self) -> Result<DapMessage> {
        let mut reader = TokioBufReader::new(&mut self.stream);
        let mut content_length: Option<usize> = None;

        // Read headers
        loop {
            self.read_buffer.clear();
            let bytes_read = reader.read_line(&mut self.read_buffer).await?;

            if bytes_read == 0 {
                anyhow::bail!("Debug adapter closed connection");
            }

            let line = self.read_buffer.trim();

            if line.is_empty() {
                break;
            }

            if let Some(length_str) = line.strip_prefix("Content-Length: ") {
                content_length = Some(length_str.parse()?);
            }
        }

        let content_length =
            content_length.context("Missing Content-Length header in DAP message")?;

        // Read content
        let mut content = vec![0u8; content_length];
        reader.read_exact(&mut content).await?;

        let json = String::from_utf8(content)?;
        tracing::debug!("DAP <- {}", json);

        let message: DapMessage = serde_json::from_str(&json)?;
        Ok(message)
    }

    pub async fn close(&mut self) -> Result<()> {
        self.stream.shutdown().await.ok();
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        // Check if TCP connection is still valid by checking peer address
        self.stream.peer_addr().is_ok()
    }
}
