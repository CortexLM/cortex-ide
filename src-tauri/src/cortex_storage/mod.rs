use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Home directory not found")]
    HomeDirNotFound,
}

type Result<T> = std::result::Result<T, StorageError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToolCall {
    pub id: String,
    pub name: String,
    pub input: serde_json::Value,
    pub output: Option<String>,
    pub success: bool,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    #[serde(default)]
    pub tool_calls: Vec<StoredToolCall>,
}

impl StoredMessage {
    pub fn user(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            role: "user".to_string(),
            content,
            timestamp: Utc::now().timestamp(),
            tool_calls: Vec::new(),
        }
    }

    pub fn assistant(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            role: "assistant".to_string(),
            content,
            timestamp: Utc::now().timestamp(),
            tool_calls: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSession {
    pub id: String,
    pub model: String,
    pub cwd: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub title: Option<String>,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub share_info: Option<serde_json::Value>,
}

impl StoredSession {
    pub fn with_id(id: String, model: String, cwd: String) -> Self {
        let now = Utc::now().timestamp();
        Self {
            id,
            model,
            cwd,
            created_at: now,
            updated_at: now,
            title: None,
            is_favorite: false,
            tags: Vec::new(),
            share_info: None,
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = Utc::now().timestamp();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub title: Option<String>,
    pub model: String,
    pub cwd: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_favorite: bool,
    pub tags: Vec<String>,
    pub is_shared: bool,
}

impl From<StoredSession> for SessionSummary {
    fn from(s: StoredSession) -> Self {
        Self {
            id: s.id,
            title: s.title,
            model: s.model,
            cwd: s.cwd,
            created_at: s.created_at,
            updated_at: s.updated_at,
            is_favorite: s.is_favorite,
            tags: s.tags,
            is_shared: s.share_info.is_some(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SessionStorage {
    base_dir: PathBuf,
    sessions_dir: PathBuf,
    history_dir: PathBuf,
}

impl SessionStorage {
    pub fn new() -> Result<Self> {
        let base_dir = match std::env::var("CORTEX_DATA_DIR") {
            Ok(dir) => PathBuf::from(dir),
            Err(_) => {
                let data_dir = dirs::data_dir().ok_or(StorageError::HomeDirNotFound)?;
                data_dir.join("Cortex")
            }
        };

        let sessions_dir = base_dir.join("sessions");
        let history_dir = base_dir.join("history");

        Ok(Self {
            base_dir,
            sessions_dir,
            history_dir,
        })
    }

    pub fn init_sync(&self) -> Result<()> {
        fs::create_dir_all(&self.sessions_dir)?;
        fs::create_dir_all(&self.history_dir)?;
        info!("Session storage initialized at {:?}", self.base_dir);
        Ok(())
    }

    pub fn save_session_sync(&self, session: &StoredSession) -> Result<()> {
        let path = self.session_path(&session.id);
        let file = fs::File::create(&path)?;
        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, session)?;
        debug!("Saved session {} to {:?}", session.id, path);
        Ok(())
    }

    pub fn get_session_sync(&self, id: &str) -> Result<StoredSession> {
        let path = self.session_path(id);
        if !path.exists() {
            return Err(StorageError::SessionNotFound(id.to_string()));
        }
        let file = fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let session: StoredSession = serde_json::from_reader(reader)?;
        Ok(session)
    }

    pub fn delete_session_sync(&self, id: &str) -> Result<()> {
        let session_path = self.session_path(id);
        if session_path.exists() {
            fs::remove_file(&session_path)?;
        }

        let history_path = self.history_path(id);
        if history_path.exists() {
            fs::remove_file(&history_path)?;
        }

        info!("Deleted session {}", id);
        Ok(())
    }

    pub fn list_sessions_sync(&self) -> Result<Vec<SessionSummary>> {
        let mut summaries = Vec::new();

        if !self.sessions_dir.exists() {
            return Ok(summaries);
        }

        for entry in fs::read_dir(&self.sessions_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().is_some_and(|e| e == "json") {
                match self.load_session_from_path(&path) {
                    Ok(session) => summaries.push(SessionSummary::from(session)),
                    Err(e) => warn!("Failed to load session from {:?}: {}", path, e),
                }
            }
        }

        summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(summaries)
    }

    pub fn get_history_sync(&self, session_id: &str) -> Result<Vec<StoredMessage>> {
        let path = self.history_path(session_id);

        if !path.exists() {
            return Ok(Vec::new());
        }

        let file = fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let mut messages = Vec::new();

        for line in reader.lines() {
            let line = line?;
            if !line.trim().is_empty() {
                match serde_json::from_str::<StoredMessage>(&line) {
                    Ok(msg) => messages.push(msg),
                    Err(e) => warn!("Failed to parse message line: {}", e),
                }
            }
        }

        Ok(messages)
    }

    pub fn append_message_sync(&self, session_id: &str, message: &StoredMessage) -> Result<()> {
        let path = self.history_path(session_id);
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;

        let json = serde_json::to_string(message)?;
        writeln!(file, "{}", json)?;

        debug!("Appended message to session {} history", session_id);
        Ok(())
    }

    pub async fn append_message(&self, session_id: &str, message: &StoredMessage) -> Result<()> {
        let storage = self.clone();
        let session_id = session_id.to_string();
        let message = message.clone();
        tokio::task::spawn_blocking(move || storage.append_message_sync(&session_id, &message))
            .await
            .map_err(|e| StorageError::Io(std::io::Error::other(e)))?
    }

    pub async fn touch_session(&self, session_id: &str) -> Result<()> {
        let storage = self.clone();
        let session_id = session_id.to_string();
        tokio::task::spawn_blocking(move || {
            if let Ok(mut session) = storage.get_session_sync(&session_id) {
                session.touch();
                storage.save_session_sync(&session)?;
            }
            Ok(())
        })
        .await
        .map_err(|e| StorageError::Io(std::io::Error::other(e)))?
    }

    fn session_path(&self, id: &str) -> PathBuf {
        self.sessions_dir.join(format!("{}.json", id))
    }

    fn history_path(&self, id: &str) -> PathBuf {
        self.history_dir.join(format!("{}.jsonl", id))
    }

    fn load_session_from_path(&self, path: &Path) -> Result<StoredSession> {
        let file = fs::File::open(path)?;
        let reader = BufReader::new(file);
        let session: StoredSession = serde_json::from_reader(reader)?;
        Ok(session)
    }
}
