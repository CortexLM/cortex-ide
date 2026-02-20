//! LSP state management
//!
//! This module contains the LspState struct which manages all LSP clients
//! with multi-provider support.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::Local;
use parking_lot::Mutex;
use tokio::sync::mpsc;

use crate::lsp::client::LspClient;
use crate::lsp::types::DiagnosticsEvent;

/// Maximum number of log entries to keep per server
const MAX_LOG_ENTRIES: usize = 1000;

/// State for managing LSP clients with multi-provider support
pub struct LspState {
    /// Map: server_id -> LspClient
    pub(crate) clients: Mutex<HashMap<String, Arc<LspClient>>>,
    /// Map: language_id -> Vec<server_id> (for multi-provider support)
    pub(crate) language_clients: Mutex<HashMap<String, Vec<String>>>,
    /// Map: server_id -> Vec<log_entry> (for storing server logs)
    server_logs: Mutex<HashMap<String, Vec<String>>>,
    pub(crate) diagnostics_tx: mpsc::UnboundedSender<DiagnosticsEvent>,
    diagnostics_rx: Mutex<Option<mpsc::UnboundedReceiver<DiagnosticsEvent>>>,
}

impl LspState {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            clients: Mutex::new(HashMap::new()),
            language_clients: Mutex::new(HashMap::new()),
            server_logs: Mutex::new(HashMap::new()),
            diagnostics_tx: tx,
            diagnostics_rx: Mutex::new(Some(rx)),
        }
    }

    /// Add a log entry for a server
    pub fn add_log(&self, server_id: &str, message: String) {
        let mut logs = self.server_logs.lock();
        let entries = logs.entry(server_id.to_string()).or_default();
        entries.push(format!("[{}] {}", Local::now().format("%H:%M:%S"), message));
        // Keep only the last MAX_LOG_ENTRIES
        if entries.len() > MAX_LOG_ENTRIES {
            entries.drain(0..entries.len() - MAX_LOG_ENTRIES);
        }
    }

    /// Get logs for a server
    pub fn get_logs(&self, server_id: &str) -> Vec<String> {
        self.server_logs
            .lock()
            .get(server_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Clear logs for a server
    pub fn clear_logs(&self, server_id: &str) {
        self.server_logs.lock().remove(server_id);
    }

    /// Take the diagnostics receiver (can only be done once)
    pub fn take_diagnostics_receiver(&self) -> Option<mpsc::UnboundedReceiver<DiagnosticsEvent>> {
        self.diagnostics_rx.lock().take()
    }

    /// Stop all language servers synchronously (for cleanup on exit)
    pub fn stop_all_servers(&self) -> Result<(), String> {
        // Clear language mapping
        self.language_clients.lock().clear();

        // Get all clients and trigger shutdown
        let clients: Vec<_> = self.clients.lock().drain().collect();

        for (server_id, client) in clients {
            // Use blocking spawn to wait for shutdown
            let _ = std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build();
                if let Ok(rt) = rt {
                    let _ = rt.block_on(client.shutdown());
                }
            })
            .join();
            tracing::info!("LSP server {} stopped", server_id);
        }

        Ok(())
    }

    /// Get all clients for a specific language
    pub fn get_clients_for_language(&self, language: &str) -> Vec<Arc<LspClient>> {
        let language_clients = self.language_clients.lock();
        let clients = self.clients.lock();

        language_clients
            .get(language)
            .map(|server_ids| {
                server_ids
                    .iter()
                    .filter_map(|id| clients.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Register a client for a language
    pub(crate) fn register_client_for_language(&self, language: &str, server_id: &str) {
        let mut language_clients = self.language_clients.lock();
        language_clients
            .entry(language.to_string())
            .or_default()
            .push(server_id.to_string());
    }

    /// Unregister a client from all languages
    pub(crate) fn unregister_client(&self, server_id: &str) {
        let mut language_clients = self.language_clients.lock();
        for server_ids in language_clients.values_mut() {
            server_ids.retain(|id| id != server_id);
        }
        // Clean up empty language entries
        language_clients.retain(|_, ids| !ids.is_empty());
    }
}

impl Default for LspState {
    fn default() -> Self {
        Self::new()
    }
}
