//! Context Server Module
//!
//! Implements MCP (Model Context Protocol) support for connecting to
//! external context providers like databases, APIs, and documentation sources.

pub mod commands;
pub mod protocol;
pub mod transport;
pub mod types;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

use crate::context_server::protocol::McpClient;

/// State for managing context servers
#[derive(Clone)]
pub struct ContextServerState(pub Arc<TokioMutex<ContextServerManager>>);

impl ContextServerState {
    pub fn new() -> Self {
        Self(Arc::new(TokioMutex::new(ContextServerManager::new())))
    }

    /// Disconnect all context servers synchronously (for cleanup on exit)
    pub fn disconnect_all(&self) {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();

        if let Ok(rt) = rt {
            rt.block_on(async {
                let mut manager = self.0.lock().await;
                manager.disconnect_all().await;
            });
        }
    }
}

/// Manages multiple MCP context server connections
pub struct ContextServerManager {
    servers: HashMap<String, ContextServer>,
    next_id: u32,
}

impl ContextServerManager {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
            next_id: 1,
        }
    }

    /// Add a new context server
    pub fn add_server(&mut self, config: types::ContextServerConfig) -> String {
        let id = format!("mcp-{}", self.next_id);
        self.next_id += 1;

        let server = ContextServer {
            id: id.clone(),
            config,
            client: None,
            status: types::ServerStatus::Disconnected,
        };

        self.servers.insert(id.clone(), server);
        id
    }

    /// Get a server by ID
    pub fn get_server(&self, id: &str) -> Option<&ContextServer> {
        self.servers.get(id)
    }

    /// Get a mutable server reference
    pub fn get_server_mut(&mut self, id: &str) -> Option<&mut ContextServer> {
        self.servers.get_mut(id)
    }

    /// Remove a server
    pub fn remove_server(&mut self, id: &str) -> bool {
        self.servers.remove(id).is_some()
    }

    /// List all servers
    pub fn list_servers(&self) -> Vec<types::ContextServerInfo> {
        self.servers.values().map(|s| s.to_info()).collect()
    }

    /// Disconnect all servers
    pub async fn disconnect_all(&mut self) {
        for (id, server) in self.servers.iter_mut() {
            if server.client.is_some() {
                server.client = None;
                server.status = types::ServerStatus::Disconnected;
                tracing::info!("Context server {} disconnected", id);
            }
        }
    }
}

/// Represents a single context server connection
pub struct ContextServer {
    pub id: String,
    pub config: types::ContextServerConfig,
    pub client: Option<Arc<TokioMutex<McpClient>>>,
    pub status: types::ServerStatus,
}

impl ContextServer {
    pub fn to_info(&self) -> types::ContextServerInfo {
        types::ContextServerInfo {
            id: self.id.clone(),
            name: self.config.name.clone(),
            server_type: self.config.server_type.clone(),
            status: self.status.clone(),
            capabilities: None, // Capabilities loaded asynchronously when connecting
        }
    }
}
