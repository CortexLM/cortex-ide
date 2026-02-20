//! Settings Sync - synchronize settings across devices via GitHub Gists
//!
//! This module provides the backend for settings synchronization:
//! - `types`: Data structures for sync profiles, items, and conflicts
//! - `storage`: Serialize/deserialize settings, keybindings, snippets, extensions
//! - `github_gist`: GitHub Gists API integration via reqwest
//! - `commands`: Tauri command handlers for sync operations

pub mod commands;
pub mod github_gist;
pub mod storage;
pub mod types;

use std::sync::{Arc, Mutex};

use types::SyncState;

/// Managed state for settings sync
#[derive(Clone)]
pub struct SettingsSyncState(pub Arc<Mutex<SyncState>>);

impl SettingsSyncState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(SyncState::default())))
    }
}

impl Default for SettingsSyncState {
    fn default() -> Self {
        Self::new()
    }
}
