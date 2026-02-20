//! Real-Time Collaboration Module
//!
//! Provides a complete collaboration system with:
//! - CRDT-based document synchronization (via `yrs`, the Yjs Rust port)
//! - WebSocket server for peer connections (via `tokio-tungstenite`)
//! - Session/room management with participant tracking
//! - Awareness protocol for cursor/selection broadcasting
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────────────────────────────────────┐
//! │  CollabState (Tauri managed state)           │
//! │  └── CollabManager                           │
//! │      ├── SessionManager (rooms, participants)│
//! │      ├── CollabServer (WebSocket server)     │
//! │      └── SharedDocumentStore (CRDT docs)     │
//! └──────────────────────────────────────────────┘
//! ```

pub mod awareness;
pub mod commands;
pub mod crdt;
pub mod server;
pub mod session;
pub mod types;

use std::sync::Arc;

use tokio::sync::Mutex as TokioMutex;
use tracing::info;

use server::CollabServer;
use session::SessionManager;

/// Default port for the collaboration WebSocket server
const DEFAULT_COLLAB_PORT: u16 = 4097;

/// Manages all collaboration state
pub struct CollabManager {
    pub session_manager: SessionManager,
    server: CollabServer,
}

impl CollabManager {
    pub fn new() -> Self {
        Self {
            session_manager: SessionManager::new(DEFAULT_COLLAB_PORT),
            server: CollabServer::new(DEFAULT_COLLAB_PORT),
        }
    }

    /// Ensure the WebSocket server is running, starting it if needed
    pub async fn ensure_server_running(&mut self) -> Result<u16, String> {
        if self.server.is_running() {
            return Ok(self.server.port());
        }

        let port = self.server.start().await?;
        info!("Collaboration server started on port {}", port);
        Ok(port)
    }

    /// Stop the WebSocket server
    pub fn stop_server(&mut self) {
        self.server.stop();
    }

    /// Check if the server is running
    pub fn is_server_running(&self) -> bool {
        self.server.is_running()
    }

    /// Get the server port
    pub fn server_port(&self) -> u16 {
        self.server.port()
    }
}

impl Default for CollabManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe collaboration state managed by Tauri
#[derive(Clone)]
pub struct CollabState(pub Arc<TokioMutex<CollabManager>>);

impl CollabState {
    pub fn new() -> Self {
        Self(Arc::new(TokioMutex::new(CollabManager::new())))
    }
}

impl Default for CollabState {
    fn default() -> Self {
        Self::new()
    }
}
