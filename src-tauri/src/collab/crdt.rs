//! CRDT Document Sync Engine
//!
//! Implements a CRDT-based document synchronization engine using `yrs` (Yjs Rust port).
//! Provides conflict-free concurrent text editing across multiple peers.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;
use tracing::info;
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{Doc, GetString, ReadTxn, Text, Transact, Update};

/// A single CRDT document backed by a Yrs Doc
pub struct CrdtDocument {
    doc: Doc,
    file_id: String,
}

impl CrdtDocument {
    /// Create a new empty CRDT document
    pub fn new(file_id: &str) -> Self {
        Self {
            doc: Doc::new(),
            file_id: file_id.to_string(),
        }
    }

    /// Create a new CRDT document with initial text content
    pub fn with_text(file_id: &str, initial_text: &str) -> Self {
        let doc = Doc::new();
        {
            let text = doc.get_or_insert_text("content");
            let mut txn = doc.transact_mut();
            text.insert(&mut txn, 0, initial_text);
        }
        Self {
            doc,
            file_id: file_id.to_string(),
        }
    }

    /// Get the file ID for this document
    pub fn file_id(&self) -> &str {
        &self.file_id
    }

    /// Get the current text content of the document
    pub fn get_text(&self) -> String {
        let text = self.doc.get_or_insert_text("content");
        let txn = self.doc.transact();
        text.get_string(&txn)
    }

    /// Insert text at a given position (character offset)
    pub fn insert_text(&self, offset: u32, content: &str) -> Result<Vec<u8>, String> {
        let text = self.doc.get_or_insert_text("content");
        let mut txn = self.doc.transact_mut();
        text.insert(&mut txn, offset, content);
        let update = txn.encode_update_v1();
        Ok(update)
    }

    /// Delete text at a given position
    pub fn delete_text(&self, offset: u32, length: u32) -> Result<Vec<u8>, String> {
        let text = self.doc.get_or_insert_text("content");
        let mut txn = self.doc.transact_mut();
        text.remove_range(&mut txn, offset, length);
        let update = txn.encode_update_v1();
        Ok(update)
    }

    /// Apply a remote update to this document
    pub fn apply_update(&self, update_data: &[u8]) -> Result<(), String> {
        let update = Update::decode_v1(update_data)
            .map_err(|e| format!("Failed to decode update: {}", e))?;
        let mut txn = self.doc.transact_mut();
        txn.apply_update(update)
            .map_err(|e| format!("Failed to apply update: {}", e))
    }

    /// Encode the full document state as a binary update
    pub fn encode_state(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_state_as_update_v1(&yrs::StateVector::default())
    }

    /// Encode the document's state vector (for sync protocol)
    pub fn encode_state_vector(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }

    /// Compute a diff update from a remote state vector
    pub fn encode_diff(&self, remote_sv: &[u8]) -> Result<Vec<u8>, String> {
        let sv = yrs::StateVector::decode_v1(remote_sv)
            .map_err(|e| format!("Failed to decode state vector: {}", e))?;
        let txn = self.doc.transact();
        Ok(txn.encode_state_as_update_v1(&sv))
    }
}

/// Store managing multiple CRDT documents per session
pub struct DocumentStore {
    documents: HashMap<String, CrdtDocument>,
}

impl DocumentStore {
    pub fn new() -> Self {
        Self {
            documents: HashMap::new(),
        }
    }

    /// Get or create a document for a given file ID
    pub fn get_or_create(&mut self, file_id: &str) -> &CrdtDocument {
        self.documents
            .entry(file_id.to_string())
            .or_insert_with(|| {
                info!("Creating new CRDT document for file: {}", file_id);
                CrdtDocument::new(file_id)
            })
    }

    /// Get or create a document with initial content
    pub fn get_or_create_with_text(&mut self, file_id: &str, text: &str) -> &CrdtDocument {
        self.documents
            .entry(file_id.to_string())
            .or_insert_with(|| {
                info!(
                    "Creating new CRDT document with initial text for file: {}",
                    file_id
                );
                CrdtDocument::with_text(file_id, text)
            })
    }

    /// Get a document by file ID
    pub fn get(&self, file_id: &str) -> Option<&CrdtDocument> {
        self.documents.get(file_id)
    }

    /// Remove a document
    pub fn remove(&mut self, file_id: &str) -> bool {
        self.documents.remove(file_id).is_some()
    }

    /// List all document file IDs
    pub fn file_ids(&self) -> Vec<String> {
        self.documents.keys().cloned().collect()
    }

    /// Apply an update to a specific document, creating it if needed
    pub fn apply_update(&mut self, file_id: &str, update_data: &[u8]) -> Result<(), String> {
        let doc = self.get_or_create(file_id);
        doc.apply_update(update_data)
    }

    /// Get the full state of a document
    pub fn encode_state(&mut self, file_id: &str) -> Vec<u8> {
        let doc = self.get_or_create(file_id);
        doc.encode_state()
    }

    /// Get the state vector of a document
    pub fn encode_state_vector(&mut self, file_id: &str) -> Vec<u8> {
        let doc = self.get_or_create(file_id);
        doc.encode_state_vector()
    }

    /// Compute diff from a remote state vector
    pub fn encode_diff(&mut self, file_id: &str, remote_sv: &[u8]) -> Result<Vec<u8>, String> {
        let doc = self.get_or_create(file_id);
        doc.encode_diff(remote_sv)
    }
}

impl Default for DocumentStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe document store wrapper
#[derive(Clone)]
pub struct SharedDocumentStore(pub Arc<RwLock<DocumentStore>>);

impl SharedDocumentStore {
    pub fn new() -> Self {
        Self(Arc::new(RwLock::new(DocumentStore::new())))
    }

    pub async fn apply_update(&self, file_id: &str, update_data: &[u8]) -> Result<(), String> {
        let mut store = self.0.write().await;
        store.apply_update(file_id, update_data)
    }

    pub async fn encode_state(&self, file_id: &str) -> Vec<u8> {
        let mut store = self.0.write().await;
        store.encode_state(file_id)
    }

    pub async fn encode_state_vector(&self, file_id: &str) -> Vec<u8> {
        let mut store = self.0.write().await;
        store.encode_state_vector(file_id)
    }

    pub async fn encode_diff(&self, file_id: &str, remote_sv: &[u8]) -> Result<Vec<u8>, String> {
        let mut store = self.0.write().await;
        store.encode_diff(file_id, remote_sv)
    }

    pub async fn get_text(&self, file_id: &str) -> Option<String> {
        let store = self.0.read().await;
        store.get(file_id).map(|doc| doc.get_text())
    }

    pub async fn file_ids(&self) -> Vec<String> {
        let store = self.0.read().await;
        store.file_ids()
    }
}

impl Default for SharedDocumentStore {
    fn default() -> Self {
        Self::new()
    }
}
