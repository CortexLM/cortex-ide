//! AI Types - Shared types for AI operations
//!
//! Defines the core data structures used across the AI module including
//! providers, models, messages, threads, and error types.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Supported AI providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AIProvider {
    OpenAI,
    Anthropic,
    Local,
    OpenRouter,
    Groq,
    Mistral,
    DeepSeek,
}

impl AIProvider {
    /// Get the default base URL for this provider
    pub fn default_base_url(&self) -> &'static str {
        match self {
            AIProvider::OpenAI => "https://api.openai.com/v1",
            AIProvider::Anthropic => "https://api.anthropic.com/v1",
            AIProvider::Local => "http://localhost:8080/v1",
            AIProvider::OpenRouter => "https://openrouter.ai/api/v1",
            AIProvider::Groq => "https://api.groq.com/openai/v1",
            AIProvider::Mistral => "https://api.mistral.ai/v1",
            AIProvider::DeepSeek => "https://api.deepseek.com/v1",
        }
    }

    /// Check if this provider requires an API key
    pub fn requires_api_key(&self) -> bool {
        !matches!(self, AIProvider::Local)
    }
}

impl std::fmt::Display for AIProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AIProvider::OpenAI => write!(f, "OpenAI"),
            AIProvider::Anthropic => write!(f, "Anthropic"),
            AIProvider::Local => write!(f, "Local"),
            AIProvider::OpenRouter => write!(f, "OpenRouter"),
            AIProvider::Groq => write!(f, "Groq"),
            AIProvider::Mistral => write!(f, "Mistral"),
            AIProvider::DeepSeek => write!(f, "DeepSeek"),
        }
    }
}

/// AI model information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIModel {
    /// Model identifier (e.g., "gpt-4", "claude-3-opus")
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Provider that offers this model
    pub provider: AIProvider,
    /// Maximum context window in tokens
    pub context_window: u32,
    /// Maximum output tokens (if different from context)
    pub max_output_tokens: Option<u32>,
    /// Whether the model supports vision/images
    pub supports_vision: bool,
    /// Whether the model supports function calling
    pub supports_functions: bool,
    /// Whether the model supports streaming
    pub supports_streaming: bool,
    /// Cost per 1K input tokens in USD (if known)
    pub input_cost_per_1k: Option<f64>,
    /// Cost per 1K output tokens in USD (if known)
    pub output_cost_per_1k: Option<f64>,
}

impl AIModel {
    /// Create a new AIModel with default capabilities
    pub fn new(id: impl Into<String>, name: impl Into<String>, provider: AIProvider) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            provider,
            context_window: 8192,
            max_output_tokens: None,
            supports_vision: false,
            supports_functions: false,
            supports_streaming: true,
            input_cost_per_1k: None,
            output_cost_per_1k: None,
        }
    }

    /// Builder method for context window
    pub fn with_context_window(mut self, tokens: u32) -> Self {
        self.context_window = tokens;
        self
    }

    /// Builder method for max output tokens
    pub fn with_max_output(mut self, tokens: u32) -> Self {
        self.max_output_tokens = Some(tokens);
        self
    }

    /// Builder method for vision support
    pub fn with_vision(mut self) -> Self {
        self.supports_vision = true;
        self
    }

    /// Builder method for function calling support
    pub fn with_functions(mut self) -> Self {
        self.supports_functions = true;
        self
    }
}

/// Message role in a conversation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

/// Function details within a tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

/// A tool call chunk for streaming (OpenAI-compatible format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallChunk {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub call_type: Option<String>,
    pub function: ToolCallFunction,
}

/// OpenAI-compatible tool definition for function calling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: OpenAIFunctionDefinition,
}

/// Function definition within an OpenAI tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIFunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Cache control directive for OpenRouter prompt caching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheControl {
    #[serde(rename = "type")]
    pub cache_type: String,
}

/// Content type for multimodal messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessageContent {
    Text {
        text: String,
    },
    Image {
        url: String,
        detail: Option<String>,
    },
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
    ToolResult {
        tool_call_id: String,
        content: String,
    },
}

/// A single message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    /// Unique message identifier
    pub id: String,
    /// Role of the message sender
    pub role: MessageRole,
    /// Message content (can be text or multimodal)
    pub content: Vec<MessageContent>,
    /// Optional name for the sender
    pub name: Option<String>,
    /// Timestamp when message was created
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Message {
    /// Create a new text message
    pub fn text(role: MessageRole, content: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            role,
            content: vec![MessageContent::Text {
                text: content.into(),
            }],
            name: None,
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
        }
    }

    /// Create a system message
    pub fn system(content: impl Into<String>) -> Self {
        Self::text(MessageRole::System, content)
    }

    /// Create a user message
    pub fn user(content: impl Into<String>) -> Self {
        Self::text(MessageRole::User, content)
    }

    /// Create an assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self::text(MessageRole::Assistant, content)
    }

    /// Get the text content of this message (if single text content)
    pub fn text_content(&self) -> Option<&str> {
        if let Some(MessageContent::Text { text }) = self.content.first() {
            Some(text)
        } else {
            None
        }
    }
}

/// A conversation thread
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Thread {
    /// Unique thread identifier
    pub id: String,
    /// Human-readable title
    pub title: String,
    /// Messages in this thread
    pub messages: Vec<Message>,
    /// Model used for this thread
    pub model_id: String,
    /// Provider for the model
    pub provider: AIProvider,
    /// System prompt for this thread
    pub system_prompt: Option<String>,
    /// Thread creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Last update timestamp
    pub updated_at: chrono::DateTime<chrono::Utc>,
    /// Additional metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Thread {
    /// Create a new empty thread
    pub fn new(model_id: impl Into<String>, provider: AIProvider) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title: "New Chat".to_string(),
            messages: Vec::new(),
            model_id: model_id.into(),
            provider,
            system_prompt: None,
            created_at: now,
            updated_at: now,
            metadata: HashMap::new(),
        }
    }

    /// Add a message to the thread
    pub fn add_message(&mut self, message: Message) {
        self.messages.push(message);
        self.updated_at = chrono::Utc::now();
    }

    /// Set the thread title
    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = title.into();
        self
    }

    /// Set the system prompt
    pub fn with_system_prompt(mut self, prompt: impl Into<String>) -> Self {
        self.system_prompt = Some(prompt.into());
        self
    }
}

/// A chunk of streaming response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunk {
    /// The content delta for this chunk
    pub content: String,
    /// Whether this is the final chunk
    pub done: bool,
    /// Token usage statistics (only on final chunk)
    pub usage: Option<TokenUsage>,
    /// Optional finish reason
    pub finish_reason: Option<String>,
    /// Tool calls received in this chunk (for function calling)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallChunk>>,
}

impl StreamChunk {
    /// Create a content chunk
    pub fn content(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            done: false,
            usage: None,
            finish_reason: None,
            tool_calls: None,
        }
    }

    /// Create a chunk containing tool call deltas
    pub fn tool_calls(tool_calls: Vec<ToolCallChunk>) -> Self {
        Self {
            content: String::new(),
            done: false,
            usage: None,
            finish_reason: None,
            tool_calls: Some(tool_calls),
        }
    }

    /// Create a final chunk with usage
    pub fn done(usage: Option<TokenUsage>, finish_reason: Option<String>) -> Self {
        Self {
            content: String::new(),
            done: true,
            usage,
            finish_reason,
            tool_calls: None,
        }
    }
}

/// Token usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    /// Number of input/prompt tokens
    pub prompt_tokens: u32,
    /// Number of output/completion tokens
    pub completion_tokens: u32,
    /// Total tokens used
    pub total_tokens: u32,
}

/// Configuration for a provider instance
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    /// Provider type
    pub provider: AIProvider,
    /// API key (if required)
    pub api_key: Option<String>,
    /// Custom base URL (overrides default)
    pub base_url: Option<String>,
    /// Organization ID (for OpenAI)
    pub organization_id: Option<String>,
    /// Default model to use
    pub default_model: Option<String>,
    /// Request timeout in seconds
    pub timeout_secs: Option<u64>,
    /// Maximum retries on failure
    pub max_retries: Option<u32>,
}

impl ProviderConfig {
    /// Create a new provider configuration
    pub fn new(provider: AIProvider) -> Self {
        Self {
            provider,
            api_key: None,
            base_url: None,
            organization_id: None,
            default_model: None,
            timeout_secs: Some(120),
            max_retries: Some(3),
        }
    }

    /// Set the API key
    pub fn with_api_key(mut self, key: impl Into<String>) -> Self {
        self.api_key = Some(key.into());
        self
    }

    /// Set a custom base URL
    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    /// Get the effective base URL
    pub fn effective_base_url(&self) -> &str {
        self.base_url
            .as_deref()
            .unwrap_or_else(|| self.provider.default_base_url())
    }
}

/// AI module errors
#[derive(Debug, Error)]
pub enum AIError {
    #[error("Provider not configured: {0}")]
    ProviderNotConfigured(AIProvider),

    #[error("API key required for provider: {0}")]
    ApiKeyRequired(AIProvider),

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Thread not found: {0}")]
    ThreadNotFound(String),

    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("API error from {provider}: {message}")]
    ApiError {
        provider: AIProvider,
        message: String,
        status_code: Option<u16>,
    },

    #[error("Rate limited by {0}, retry after {1:?} seconds")]
    RateLimited(AIProvider, Option<u64>),

    #[error("Context length exceeded: {0} tokens (max: {1})")]
    ContextLengthExceeded(u32, u32),

    #[error("Stream interrupted: {0}")]
    StreamInterrupted(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Channel send error: {0}")]
    ChannelError(String),
}

impl Serialize for AIError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
