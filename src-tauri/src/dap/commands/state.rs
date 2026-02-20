//! Debugger state management
//!
//! This module contains the global state for managing debug sessions.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{RwLock, mpsc};

use super::super::{DebugSession, DebugSessionEvent};

/// Global state for managing debug sessions
pub struct DebuggerState {
    /// Active debug sessions by ID
    pub(crate) sessions: RwLock<HashMap<String, Arc<RwLock<DebugSession>>>>,
    /// Event channel for broadcasting debug events
    pub(crate) event_tx: RwLock<Option<mpsc::UnboundedSender<DebugSessionEvent>>>,
}

impl DebuggerState {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            event_tx: RwLock::new(None),
        }
    }

    /// Stop all debug sessions synchronously (for cleanup on exit)
    pub fn stop_all_sessions(&self) {
        // Use blocking to wait for the async lock
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();

        if let Ok(rt) = rt {
            rt.block_on(async {
                let mut sessions = self.sessions.write().await;
                for (session_id, session) in sessions.drain() {
                    let session_guard = session.write().await;
                    if let Err(e) = session_guard.stop(true).await {
                        tracing::warn!("Failed to stop debug session {}: {}", session_id, e);
                    } else {
                        tracing::info!("Debug session {} stopped", session_id);
                    }
                }
            });
        }
    }
}

impl Default for DebuggerState {
    fn default() -> Self {
        Self::new()
    }
}
