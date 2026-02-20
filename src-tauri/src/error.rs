use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum CortexError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("LSP error: {0}")]
    Lsp(String),

    #[error("DAP error: {0}")]
    Dap(String),

    #[error("Extension error: {0}")]
    Extension(String),

    #[error("Terminal error: {0}")]
    Terminal(String),

    #[error("AI error: {0}")]
    Ai(String),

    #[error("Settings error: {0}")]
    Settings(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("{0}")]
    Custom(String),
}

impl Serialize for CortexError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<String> for CortexError {
    fn from(s: String) -> Self {
        CortexError::Custom(s)
    }
}

impl From<&str> for CortexError {
    fn from(s: &str) -> Self {
        CortexError::Custom(s.to_string())
    }
}

impl From<anyhow::Error> for CortexError {
    fn from(e: anyhow::Error) -> Self {
        CortexError::Custom(e.to_string())
    }
}

pub type CortexResult<T> = Result<T, CortexError>;
