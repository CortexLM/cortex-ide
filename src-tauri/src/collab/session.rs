//! Session / Room Management
//!
//! Manages collaboration sessions (rooms) with participant tracking,
//! cursor positions, selections, and document associations.

use std::collections::HashMap;

use tracing::info;

use crate::collab::awareness::AwarenessState;
use crate::collab::crdt::SharedDocumentStore;
use crate::collab::types::{
    CollabParticipant, CollabPermission, CollabSession, CollabSessionInfo, CursorPosition,
    SelectionRange, color_for_index,
};

/// Manages all active collaboration sessions
pub struct SessionManager {
    sessions: HashMap<String, CollabSession>,
    awareness: HashMap<String, AwarenessState>,
    document_stores: HashMap<String, SharedDocumentStore>,
    server_port: u16,
}

impl SessionManager {
    pub fn new(server_port: u16) -> Self {
        Self {
            sessions: HashMap::new(),
            awareness: HashMap::new(),
            document_stores: HashMap::new(),
            server_port,
        }
    }

    /// Create a new collaboration session
    pub fn create_session(
        &mut self,
        session_id: &str,
        name: &str,
        host_id: &str,
        host_name: &str,
    ) -> CollabSessionInfo {
        let now = now_millis();

        let host = CollabParticipant {
            id: host_id.to_string(),
            name: host_name.to_string(),
            color: color_for_index(0),
            permission: CollabPermission::Owner,
            cursor: None,
            selection: None,
            joined_at: now,
        };

        let mut participants = HashMap::new();
        participants.insert(host_id.to_string(), host.clone());

        let session = CollabSession {
            id: session_id.to_string(),
            name: name.to_string(),
            host_id: host_id.to_string(),
            created_at: now,
            participants,
            document_ids: Vec::new(),
        };

        let mut awareness = AwarenessState::new();
        awareness.set_entry(
            host_id,
            crate::collab::types::AwarenessEntry {
                user_id: host_id.to_string(),
                user_name: host_name.to_string(),
                user_color: color_for_index(0),
                cursor: None,
                selection: None,
                active_file: None,
                timestamp: now,
            },
        );

        let info = session.to_info(self.server_port);

        self.sessions.insert(session_id.to_string(), session);
        self.awareness.insert(session_id.to_string(), awareness);
        self.document_stores
            .insert(session_id.to_string(), SharedDocumentStore::new());

        info!(
            "Created collaboration session '{}' (id: {}) hosted by '{}'",
            name, session_id, host_name
        );

        info
    }

    /// Join an existing session
    pub fn join_session(
        &mut self,
        session_id: &str,
        user_id: &str,
        user_name: &str,
    ) -> Result<CollabSessionInfo, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        if session.participants.contains_key(user_id) {
            return Ok(session.to_info(self.server_port));
        }

        let color_index = session.participants.len();
        let participant = CollabParticipant {
            id: user_id.to_string(),
            name: user_name.to_string(),
            color: color_for_index(color_index),
            permission: CollabPermission::Editor,
            cursor: None,
            selection: None,
            joined_at: now_millis(),
        };

        session
            .participants
            .insert(user_id.to_string(), participant);

        if let Some(awareness) = self.awareness.get_mut(session_id) {
            awareness.set_entry(
                user_id,
                crate::collab::types::AwarenessEntry {
                    user_id: user_id.to_string(),
                    user_name: user_name.to_string(),
                    user_color: color_for_index(color_index),
                    cursor: None,
                    selection: None,
                    active_file: None,
                    timestamp: now_millis(),
                },
            );
        }

        info!(
            "User '{}' (id: {}) joined session '{}'",
            user_name, user_id, session_id
        );

        Ok(session.to_info(self.server_port))
    }

    /// Leave a session
    pub fn leave_session(&mut self, session_id: &str, user_id: &str) -> Result<bool, String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        session.participants.remove(user_id);

        if let Some(awareness) = self.awareness.get_mut(session_id) {
            awareness.remove_user(user_id);
        }

        info!("User '{}' left session '{}'", user_id, session_id);

        // Clean up empty sessions
        if session.participants.is_empty() {
            self.sessions.remove(session_id);
            self.awareness.remove(session_id);
            self.document_stores.remove(session_id);
            info!("Session '{}' removed (all participants left)", session_id);
            return Ok(true);
        }

        Ok(false)
    }

    /// Get session info
    pub fn get_session(&self, session_id: &str) -> Option<CollabSessionInfo> {
        self.sessions
            .get(session_id)
            .map(|s| s.to_info(self.server_port))
    }

    /// List all active sessions
    pub fn list_sessions(&self) -> Vec<CollabSessionInfo> {
        self.sessions
            .values()
            .map(|s| s.to_info(self.server_port))
            .collect()
    }

    /// Update cursor position for a participant
    pub fn update_cursor(
        &mut self,
        session_id: &str,
        user_id: &str,
        cursor: CursorPosition,
    ) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        if let Some(participant) = session.participants.get_mut(user_id) {
            participant.cursor = Some(cursor.clone());
        } else {
            return Err(format!(
                "User '{}' not found in session '{}'",
                user_id, session_id
            ));
        }

        if let Some(awareness) = self.awareness.get_mut(session_id) {
            awareness.update_cursor(user_id, cursor);
        }

        Ok(())
    }

    /// Update selection for a participant
    pub fn update_selection(
        &mut self,
        session_id: &str,
        user_id: &str,
        selection: SelectionRange,
    ) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        if let Some(participant) = session.participants.get_mut(user_id) {
            participant.selection = Some(selection.clone());
        } else {
            return Err(format!(
                "User '{}' not found in session '{}'",
                user_id, session_id
            ));
        }

        if let Some(awareness) = self.awareness.get_mut(session_id) {
            awareness.update_selection(user_id, selection);
        }

        Ok(())
    }

    /// Get the document store for a session
    pub fn get_document_store(&self, session_id: &str) -> Option<&SharedDocumentStore> {
        self.document_stores.get(session_id)
    }

    /// Get the awareness state for a session
    pub fn get_awareness(&self, session_id: &str) -> Option<&AwarenessState> {
        self.awareness.get(session_id)
    }

    /// Get participant list for a session
    pub fn get_participants(&self, session_id: &str) -> Vec<CollabParticipant> {
        self.sessions
            .get(session_id)
            .map(|s| s.participants.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Check if a session exists
    pub fn session_exists(&self, session_id: &str) -> bool {
        self.sessions.contains_key(session_id)
    }

    /// Get the number of active sessions
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new(4097)
    }
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
