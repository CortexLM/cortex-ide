//! Thread Management - Conversation thread CRUD operations
//!
//! Manages AI conversation threads with persistence to JSON files.
//! Provides thread creation, retrieval, search, and filtering capabilities.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use tracing::{debug, info, warn};

use super::types::{AIError, AIProvider, Message, Thread};

/// Thread manager state for Tauri
#[derive(Clone)]
pub struct ThreadManagerState(pub Arc<TokioMutex<ThreadManager>>);

impl ThreadManagerState {
    pub fn new() -> Self {
        Self(Arc::new(TokioMutex::new(ThreadManager::new())))
    }
}

impl Default for ThreadManagerState {
    fn default() -> Self {
        Self::new()
    }
}

/// Manages conversation threads with persistence
pub struct ThreadManager {
    /// In-memory cache of threads
    threads: HashMap<String, Thread>,
    /// Path to the storage directory
    storage_path: Option<PathBuf>,
    /// Whether the manager has been initialized
    initialized: bool,
}

impl ThreadManager {
    /// Create a new thread manager
    pub fn new() -> Self {
        Self {
            threads: HashMap::new(),
            storage_path: None,
            initialized: false,
        }
    }

    /// Initialize the thread manager with a storage path
    pub fn initialize(&mut self, app_data_dir: PathBuf) -> Result<(), AIError> {
        let threads_dir = app_data_dir.join("threads");

        if !threads_dir.exists() {
            fs::create_dir_all(&threads_dir)?;
        }

        self.storage_path = Some(threads_dir);
        self.load_all_threads()?;
        self.initialized = true;

        info!(
            "Thread manager initialized with {} threads",
            self.threads.len()
        );
        Ok(())
    }

    /// Check if the manager is initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Get the storage path for a thread
    fn thread_path(&self, thread_id: &str) -> Option<PathBuf> {
        self.storage_path
            .as_ref()
            .map(|p| p.join(format!("{}.json", thread_id)))
    }

    /// Load all threads from disk
    fn load_all_threads(&mut self) -> Result<(), AIError> {
        let storage_path = match &self.storage_path {
            Some(p) => p.clone(),
            None => return Ok(()),
        };

        let entries = match fs::read_dir(&storage_path) {
            Ok(e) => e,
            Err(e) => {
                warn!("Failed to read threads directory: {}", e);
                return Ok(());
            }
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                match self.load_thread_from_file(&path) {
                    Ok(thread) => {
                        self.threads.insert(thread.id.clone(), thread);
                    }
                    Err(e) => {
                        warn!("Failed to load thread from {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(())
    }

    /// Load a single thread from a file
    fn load_thread_from_file(&self, path: &PathBuf) -> Result<Thread, AIError> {
        let content = fs::read_to_string(path)?;
        let thread: Thread = serde_json::from_str(&content)?;
        Ok(thread)
    }

    /// Save a thread to disk
    fn save_thread(&self, thread: &Thread) -> Result<(), AIError> {
        let path = match self.thread_path(&thread.id) {
            Some(p) => p,
            None => return Ok(()), // No storage configured, skip persistence
        };

        let content = serde_json::to_string_pretty(thread)?;
        fs::write(&path, content)?;
        debug!("Saved thread {} to {:?}", thread.id, path);
        Ok(())
    }

    /// Delete a thread file from disk
    fn delete_thread_file(&self, thread_id: &str) -> Result<(), AIError> {
        let path = match self.thread_path(thread_id) {
            Some(p) => p,
            None => return Ok(()),
        };

        if path.exists() {
            fs::remove_file(&path)?;
            debug!("Deleted thread file: {:?}", path);
        }
        Ok(())
    }

    // =========================================================================
    // CRUD Operations
    // =========================================================================

    /// Create a new thread
    pub fn create_thread(
        &mut self,
        model_id: String,
        provider: AIProvider,
        title: Option<String>,
        system_prompt: Option<String>,
    ) -> Result<Thread, AIError> {
        let mut thread = Thread::new(model_id, provider);

        if let Some(t) = title {
            thread.title = t;
        }
        if let Some(sp) = system_prompt {
            thread.system_prompt = Some(sp);
        }

        self.save_thread(&thread)?;
        self.threads.insert(thread.id.clone(), thread.clone());

        info!("Created thread: {} ({})", thread.title, thread.id);
        Ok(thread)
    }

    /// Get a thread by ID
    pub fn get_thread(&self, thread_id: &str) -> Option<Thread> {
        self.threads.get(thread_id).cloned()
    }

    /// Update a thread
    pub fn update_thread(&mut self, thread: Thread) -> Result<Thread, AIError> {
        if !self.threads.contains_key(&thread.id) {
            return Err(AIError::ThreadNotFound(thread.id.clone()));
        }

        self.save_thread(&thread)?;
        self.threads.insert(thread.id.clone(), thread.clone());

        debug!("Updated thread: {}", thread.id);
        Ok(thread)
    }

    /// Delete a thread
    pub fn delete_thread(&mut self, thread_id: &str) -> Result<(), AIError> {
        if !self.threads.contains_key(thread_id) {
            return Err(AIError::ThreadNotFound(thread_id.to_string()));
        }

        self.delete_thread_file(thread_id)?;
        self.threads.remove(thread_id);

        info!("Deleted thread: {}", thread_id);
        Ok(())
    }

    /// List all threads
    pub fn list_threads(&self) -> Vec<Thread> {
        let mut threads: Vec<Thread> = self.threads.values().cloned().collect();
        // Sort by updated_at descending (most recent first)
        threads.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        threads
    }

    /// List threads with pagination
    pub fn list_threads_paginated(&self, offset: usize, limit: usize) -> (Vec<Thread>, usize) {
        let all_threads = self.list_threads();
        let total = all_threads.len();
        let threads = all_threads.into_iter().skip(offset).take(limit).collect();
        (threads, total)
    }

    // =========================================================================
    // Message Operations
    // =========================================================================

    /// Add a message to a thread
    pub fn add_message(&mut self, thread_id: &str, message: Message) -> Result<Thread, AIError> {
        let thread = self
            .threads
            .get_mut(thread_id)
            .ok_or_else(|| AIError::ThreadNotFound(thread_id.to_string()))?;

        thread.add_message(message);
        let thread_clone = thread.clone();
        self.save_thread(&thread_clone)?;

        Ok(thread_clone)
    }

    /// Get messages from a thread
    pub fn get_messages(&self, thread_id: &str) -> Result<Vec<Message>, AIError> {
        let thread = self
            .threads
            .get(thread_id)
            .ok_or_else(|| AIError::ThreadNotFound(thread_id.to_string()))?;

        Ok(thread.messages.clone())
    }

    /// Clear messages from a thread (keeps system prompt)
    pub fn clear_messages(&mut self, thread_id: &str) -> Result<Thread, AIError> {
        let thread = self
            .threads
            .get_mut(thread_id)
            .ok_or_else(|| AIError::ThreadNotFound(thread_id.to_string()))?;

        thread.messages.clear();
        thread.updated_at = chrono::Utc::now();
        let thread_clone = thread.clone();
        self.save_thread(&thread_clone)?;

        Ok(thread_clone)
    }

    // =========================================================================
    // Search and Filter
    // =========================================================================

    /// Search threads by title or content
    pub fn search_threads(&self, query: &str) -> Vec<Thread> {
        let query_lower = query.to_lowercase();

        self.threads
            .values()
            .filter(|thread| {
                // Check title
                if thread.title.to_lowercase().contains(&query_lower) {
                    return true;
                }

                // Check messages
                for message in &thread.messages {
                    if let Some(text) = message.text_content() {
                        if text.to_lowercase().contains(&query_lower) {
                            return true;
                        }
                    }
                }

                false
            })
            .cloned()
            .collect()
    }

    /// Filter threads by provider
    pub fn filter_by_provider(&self, provider: AIProvider) -> Vec<Thread> {
        self.threads
            .values()
            .filter(|t| t.provider == provider)
            .cloned()
            .collect()
    }

    /// Filter threads by model
    pub fn filter_by_model(&self, model_id: &str) -> Vec<Thread> {
        self.threads
            .values()
            .filter(|t| t.model_id == model_id)
            .cloned()
            .collect()
    }

    /// Get threads created within a date range
    pub fn filter_by_date_range(
        &self,
        from: chrono::DateTime<chrono::Utc>,
        to: chrono::DateTime<chrono::Utc>,
    ) -> Vec<Thread> {
        self.threads
            .values()
            .filter(|t| t.created_at >= from && t.created_at <= to)
            .cloned()
            .collect()
    }

    // =========================================================================
    // Utility
    // =========================================================================

    /// Get thread count
    pub fn thread_count(&self) -> usize {
        self.threads.len()
    }

    /// Duplicate a thread
    pub fn duplicate_thread(&mut self, thread_id: &str) -> Result<Thread, AIError> {
        let original = self
            .threads
            .get(thread_id)
            .ok_or_else(|| AIError::ThreadNotFound(thread_id.to_string()))?
            .clone();

        let mut new_thread = Thread::new(original.model_id.clone(), original.provider);
        new_thread.title = format!("{} (copy)", original.title);
        new_thread.messages = original.messages.clone();
        new_thread.system_prompt = original.system_prompt.clone();
        new_thread.metadata = original.metadata.clone();

        self.save_thread(&new_thread)?;
        self.threads
            .insert(new_thread.id.clone(), new_thread.clone());

        info!("Duplicated thread {} as {}", original.id, new_thread.id);
        Ok(new_thread)
    }

    /// Export a thread to JSON string
    pub fn export_thread(&self, thread_id: &str) -> Result<String, AIError> {
        let thread = self
            .threads
            .get(thread_id)
            .ok_or_else(|| AIError::ThreadNotFound(thread_id.to_string()))?;

        serde_json::to_string_pretty(thread).map_err(AIError::from)
    }

    /// Import a thread from JSON string
    pub fn import_thread(&mut self, json: &str) -> Result<Thread, AIError> {
        let mut thread: Thread = serde_json::from_str(json)?;

        // Generate new ID to avoid conflicts
        thread.id = uuid::Uuid::new_v4().to_string();
        thread.created_at = chrono::Utc::now();
        thread.updated_at = chrono::Utc::now();

        self.save_thread(&thread)?;
        self.threads.insert(thread.id.clone(), thread.clone());

        info!("Imported thread: {}", thread.id);
        Ok(thread)
    }

    /// Get storage directory path
    pub fn get_storage_path(&self) -> Option<PathBuf> {
        self.storage_path.clone()
    }
}

impl Default for ThreadManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Summary of a thread for list views
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadSummary {
    pub id: String,
    pub title: String,
    pub model_id: String,
    pub provider: AIProvider,
    pub message_count: usize,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub preview: Option<String>,
}

impl From<&Thread> for ThreadSummary {
    fn from(thread: &Thread) -> Self {
        // Get preview from last user or assistant message
        let preview = thread
            .messages
            .iter()
            .rev()
            .find(|m| {
                matches!(
                    m.role,
                    super::types::MessageRole::User | super::types::MessageRole::Assistant
                )
            })
            .and_then(|m| m.text_content())
            .map(|s| {
                if s.len() > 100 {
                    format!("{}...", &s[..100])
                } else {
                    s.to_string()
                }
            });

        Self {
            id: thread.id.clone(),
            title: thread.title.clone(),
            model_id: thread.model_id.clone(),
            provider: thread.provider,
            message_count: thread.messages.len(),
            created_at: thread.created_at,
            updated_at: thread.updated_at,
            preview,
        }
    }
}

/// Convert threads to summaries for list views
pub fn threads_to_summaries(threads: &[Thread]) -> Vec<ThreadSummary> {
    threads.iter().map(ThreadSummary::from).collect()
}
