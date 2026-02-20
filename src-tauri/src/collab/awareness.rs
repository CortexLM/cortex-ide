//! Awareness Protocol
//!
//! Tracks cursor positions, selections, and active file state for all
//! participants in a collaboration session. Broadcasts awareness changes
//! to all connected peers.

use std::collections::HashMap;

use crate::collab::types::{AwarenessEntry, CursorPosition, SelectionRange};

/// Manages awareness state for all users in a session
#[derive(Debug, Clone)]
pub struct AwarenessState {
    states: HashMap<String, AwarenessEntry>,
}

impl AwarenessState {
    pub fn new() -> Self {
        Self {
            states: HashMap::new(),
        }
    }

    /// Add or update a user's awareness entry
    pub fn set_entry(&mut self, user_id: &str, entry: AwarenessEntry) {
        self.states.insert(user_id.to_string(), entry);
    }

    /// Update a user's cursor position
    pub fn update_cursor(&mut self, user_id: &str, cursor: CursorPosition) {
        if let Some(entry) = self.states.get_mut(user_id) {
            entry.cursor = Some(cursor);
            entry.timestamp = now_millis();
        }
    }

    /// Update a user's selection range
    pub fn update_selection(&mut self, user_id: &str, selection: SelectionRange) {
        if let Some(entry) = self.states.get_mut(user_id) {
            entry.selection = Some(selection);
            entry.timestamp = now_millis();
        }
    }

    /// Update a user's active file
    pub fn update_active_file(&mut self, user_id: &str, file_id: Option<String>) {
        if let Some(entry) = self.states.get_mut(user_id) {
            entry.active_file = file_id;
            entry.timestamp = now_millis();
        }
    }

    /// Remove a user from awareness tracking
    pub fn remove_user(&mut self, user_id: &str) {
        self.states.remove(user_id);
    }

    /// Get all current awareness states
    pub fn get_states(&self) -> &HashMap<String, AwarenessEntry> {
        &self.states
    }

    /// Get a specific user's awareness entry
    pub fn get_entry(&self, user_id: &str) -> Option<&AwarenessEntry> {
        self.states.get(user_id)
    }

    /// Get all users with cursors in a specific file
    pub fn users_in_file(&self, file_id: &str) -> Vec<&AwarenessEntry> {
        self.states
            .values()
            .filter(|entry| entry.cursor.as_ref().is_some_and(|c| c.file_id == file_id))
            .collect()
    }

    /// Encode all awareness states for network transmission
    pub fn encode(&self) -> HashMap<String, AwarenessEntry> {
        self.states.clone()
    }

    /// Apply a remote awareness update
    pub fn apply_update(&mut self, remote_states: HashMap<String, AwarenessEntry>) {
        for (user_id, entry) in remote_states {
            let should_update = self
                .states
                .get(&user_id)
                .map(|existing| entry.timestamp > existing.timestamp)
                .unwrap_or(true);

            if should_update {
                self.states.insert(user_id, entry);
            }
        }
    }
}

impl Default for AwarenessState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get current time in milliseconds
fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
