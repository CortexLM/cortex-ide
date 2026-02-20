//! SQLite-backed vector store for codebase semantic indexing.
//!
//! Stores code chunks with their embedding vectors and supports
//! cosine-similarity search for RAG context retrieval.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A semantic code chunk stored in the vector index.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeChunk {
    /// Unique chunk identifier.
    pub id: String,
    /// Absolute file path.
    pub file_path: String,
    /// The source code content of this chunk.
    pub content: String,
    /// Semantic type: "function", "class", "block", "import", "module".
    pub chunk_type: String,
    /// 1-based start line in the original file.
    pub start_line: u32,
    /// 1-based end line in the original file.
    pub end_line: u32,
    /// Language identifier.
    pub language: String,
    /// Relevance score (populated during search, 0.0 otherwise).
    #[serde(default)]
    pub score: f64,
}

/// Search result from the vector store.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub chunk: CodeChunk,
    pub score: f64,
}

// ---------------------------------------------------------------------------
// Embedding helpers
// ---------------------------------------------------------------------------

/// Embedding dimension for our simple hash-based embeddings.
const EMBEDDING_DIM: usize = 64;

/// Generate a simple hash-based embedding vector for a code snippet.
///
/// This is a lightweight local embedding that captures token frequency
/// patterns. For production use, replace with a proper embedding model
/// (e.g., OpenAI `text-embedding-3-small` or a local ONNX model).
pub fn generate_embedding(text: &str) -> Vec<f32> {
    let mut embedding = vec![0.0f32; EMBEDDING_DIM];
    let tokens: Vec<&str> = text.split_whitespace().collect();
    if tokens.is_empty() {
        return embedding;
    }

    for token in &tokens {
        let hash = simple_hash(token);
        let idx = (hash as usize) % EMBEDDING_DIM;
        embedding[idx] += 1.0;

        // Bigram features in upper half
        let bigram_idx = ((hash >> 8) as usize) % (EMBEDDING_DIM / 2) + (EMBEDDING_DIM / 2);
        embedding[bigram_idx] += 0.5;
    }

    // L2 normalize
    let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in &mut embedding {
            *v /= norm;
        }
    }

    embedding
}

fn simple_hash(s: &str) -> u64 {
    let mut h: u64 = 5381;
    for b in s.bytes() {
        h = h.wrapping_mul(33).wrapping_add(b as u64);
    }
    h
}

/// Cosine similarity between two embedding vectors.
fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f64;
    let mut norm_a = 0.0f64;
    let mut norm_b = 0.0f64;
    for (x, y) in a.iter().zip(b.iter()) {
        let xf = *x as f64;
        let yf = *y as f64;
        dot += xf * yf;
        norm_a += xf * xf;
        norm_b += yf * yf;
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

/// Serialize an embedding vector to bytes for SQLite BLOB storage.
fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(embedding.len() * 4);
    for &v in embedding {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}

/// Deserialize an embedding vector from SQLite BLOB bytes.
fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| {
            let arr: [u8; 4] = [chunk[0], chunk[1], chunk[2], chunk[3]];
            f32::from_le_bytes(arr)
        })
        .collect()
}

// ---------------------------------------------------------------------------
// VectorStore
// ---------------------------------------------------------------------------

/// SQLite-backed vector store for code chunk embeddings.
pub struct VectorStore {
    conn: Connection,
}

impl VectorStore {
    /// Open (or create) a vector store database at the given path.
    pub fn open(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create vector store directory: {}", e))?;
        }

        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open vector store: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        let store = Self { conn };
        store.init_tables()?;
        Ok(store)
    }

    /// Create tables if they don't exist.
    fn init_tables(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS code_chunks (
                    id TEXT PRIMARY KEY,
                    file_path TEXT NOT NULL,
                    content TEXT NOT NULL,
                    chunk_type TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL,
                    language TEXT NOT NULL,
                    embedding BLOB,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_chunks_file ON code_chunks(file_path);
                CREATE INDEX IF NOT EXISTS idx_chunks_language ON code_chunks(language);",
            )
            .map_err(|e| format!("Failed to create tables: {}", e))?;
        Ok(())
    }

    /// Insert or update a code chunk with its embedding.
    pub fn upsert_chunk(&self, chunk: &CodeChunk, embedding: &[f32]) -> Result<(), String> {
        let embedding_bytes = embedding_to_bytes(embedding);
        self.conn
            .execute(
                "INSERT INTO code_chunks (id, file_path, content, chunk_type, start_line, end_line, language, embedding, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                    content = excluded.content,
                    chunk_type = excluded.chunk_type,
                    start_line = excluded.start_line,
                    end_line = excluded.end_line,
                    embedding = excluded.embedding,
                    updated_at = datetime('now')",
                params![
                    chunk.id,
                    chunk.file_path,
                    chunk.content,
                    chunk.chunk_type,
                    chunk.start_line,
                    chunk.end_line,
                    chunk.language,
                    embedding_bytes,
                ],
            )
            .map_err(|e| format!("Failed to upsert chunk: {}", e))?;
        Ok(())
    }

    /// Delete all chunks for a given file.
    pub fn delete_file_chunks(&self, file_path: &str) -> Result<usize, String> {
        let count = self
            .conn
            .execute(
                "DELETE FROM code_chunks WHERE file_path = ?1",
                params![file_path],
            )
            .map_err(|e| format!("Failed to delete chunks: {}", e))?;
        Ok(count)
    }

    /// Search for the top-K most similar chunks to the query embedding.
    pub fn search_similar(
        &self,
        query_embedding: &[f32],
        top_k: usize,
        language_filter: Option<&str>,
    ) -> Result<Vec<SearchResult>, String> {
        let sql = if language_filter.is_some() {
            "SELECT id, file_path, content, chunk_type, start_line, end_line, language, embedding
             FROM code_chunks WHERE language = ?1"
        } else {
            "SELECT id, file_path, content, chunk_type, start_line, end_line, language, embedding
             FROM code_chunks"
        };

        let mut stmt = self
            .conn
            .prepare(sql)
            .map_err(|e| format!("Failed to prepare search query: {}", e))?;

        type RowTuple = (String, String, String, String, u32, u32, String, Vec<u8>);

        let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<RowTuple> {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, u32>(4)?,
                row.get::<_, u32>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Vec<u8>>(7)?,
            ))
        };

        let collected: Vec<rusqlite::Result<RowTuple>> = if let Some(lang) = language_filter {
            stmt.query_map(params![lang], map_row)
                .map_err(|e| format!("Failed to execute search: {}", e))?
                .collect()
        } else {
            stmt.query_map([], map_row)
                .map_err(|e| format!("Failed to execute search: {}", e))?
                .collect()
        };

        let mut results: Vec<SearchResult> = Vec::new();

        for row in collected {
            let (id, file_path, content, chunk_type, start_line, end_line, language, emb_bytes) =
                row.map_err(|e| format!("Failed to read row: {}", e))?;

            let stored_embedding = bytes_to_embedding(&emb_bytes);
            let score = cosine_similarity(query_embedding, &stored_embedding);

            results.push(SearchResult {
                chunk: CodeChunk {
                    id,
                    file_path,
                    content,
                    chunk_type,
                    start_line,
                    end_line,
                    language,
                    score,
                },
                score,
            });
        }

        // Sort by score descending and take top-K
        results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(top_k);

        Ok(results)
    }

    /// Get total number of indexed chunks.
    pub fn chunk_count(&self) -> Result<usize, String> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM code_chunks", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count chunks: {}", e))?;
        Ok(count as usize)
    }

    /// Get number of indexed files.
    pub fn file_count(&self) -> Result<usize, String> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(DISTINCT file_path) FROM code_chunks",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to count files: {}", e))?;
        Ok(count as usize)
    }

    /// Clear all data from the store.
    pub fn clear(&self) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM code_chunks", [])
            .map_err(|e| format!("Failed to clear store: {}", e))?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Thread-safe wrapper
// ---------------------------------------------------------------------------

/// Thread-safe vector store state managed by Tauri.
pub struct VectorStoreState {
    pub store: Arc<Mutex<Option<VectorStore>>>,
    db_path: Arc<Mutex<Option<PathBuf>>>,
}

impl VectorStoreState {
    pub fn new() -> Self {
        Self {
            store: Arc::new(Mutex::new(None)),
            db_path: Arc::new(Mutex::new(None)),
        }
    }

    /// Initialize the vector store for a workspace.
    pub async fn init(&self, workspace_path: &Path) -> Result<(), String> {
        let db_path = workspace_path.join(".cortex").join("vector_index.db");
        let store = tokio::task::spawn_blocking({
            let db_path = db_path.clone();
            move || VectorStore::open(&db_path)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        *self.store.lock().await = Some(store);
        *self.db_path.lock().await = Some(db_path);

        info!(
            "Vector store initialized for workspace: {}",
            workspace_path.display()
        );
        Ok(())
    }

    /// Get a reference to the store, initializing if needed.
    pub async fn get_store(&self) -> Result<Arc<Mutex<Option<VectorStore>>>, String> {
        Ok(Arc::clone(&self.store))
    }

    /// Execute an operation on the store.
    pub async fn with_store<F, R>(&self, op: F) -> Result<R, String>
    where
        F: FnOnce(&VectorStore) -> Result<R, String> + Send + 'static,
        R: Send + 'static,
    {
        let store = self.store.lock().await;
        match store.as_ref() {
            Some(s) => op(s),
            None => Err("Vector store not initialized".to_string()),
        }
    }
}

impl Default for VectorStoreState {
    fn default() -> Self {
        Self::new()
    }
}
