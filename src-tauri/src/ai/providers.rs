//! AI Providers - LLM provider integrations
//!
//! Implements unified interface for multiple LLM providers including OpenAI,
//! Anthropic, and others. Uses reqwest for HTTP calls with streaming support.

use super::types::{
    AIError, AIModel, AIProvider, CacheControl, Message, MessageContent, MessageRole,
    OpenAIToolDefinition, ProviderConfig, StreamChunk, TokenUsage, ToolCallChunk, ToolCallFunction,
};
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::info;

/// Provider manager that handles multiple provider configurations
pub struct ProviderManager {
    client: Client,
    configs: HashMap<AIProvider, ProviderConfig>,
}

impl ProviderManager {
    /// Create a new provider manager
    ///
    /// # Errors
    /// Returns an error if the HTTP client cannot be created
    pub fn new() -> Result<Self, AIError> {
        Ok(Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .map_err(|e| {
                    AIError::InvalidConfig(format!("Failed to create HTTP client: {}", e))
                })?,
            configs: HashMap::new(),
        })
    }

    /// Create a new provider manager, panicking on failure
    ///
    /// Use this only during application initialization where failure is unrecoverable
    #[allow(clippy::expect_used)] // Intentional panic for unrecoverable init failure
    pub fn new_or_panic() -> Self {
        Self::new().expect("Failed to create ProviderManager")
    }

    /// Configure a provider
    pub fn configure(&mut self, config: ProviderConfig) {
        self.configs.insert(config.provider, config);
    }

    /// Remove a provider configuration
    pub fn remove(&mut self, provider: AIProvider) {
        self.configs.remove(&provider);
    }

    /// Get a provider configuration
    pub fn get_config(&self, provider: AIProvider) -> Option<&ProviderConfig> {
        self.configs.get(&provider)
    }

    /// Check if a provider is configured
    pub fn is_configured(&self, provider: AIProvider) -> bool {
        self.configs.contains_key(&provider)
    }

    /// List all available models across configured providers
    pub fn list_models(&self) -> Vec<AIModel> {
        let mut models = Vec::new();

        for provider in self.configs.keys() {
            models.extend(get_provider_models(*provider));
        }

        models
    }

    /// Complete a conversation (non-streaming)
    pub async fn complete(
        &self,
        messages: Vec<Message>,
        model: &str,
        provider: AIProvider,
    ) -> Result<String, AIError> {
        let config = self
            .configs
            .get(&provider)
            .ok_or(AIError::ProviderNotConfigured(provider))?;

        match provider {
            AIProvider::OpenAI
            | AIProvider::OpenRouter
            | AIProvider::Groq
            | AIProvider::DeepSeek
            | AIProvider::Local
            | AIProvider::Mistral => {
                self.complete_openai_compatible(messages, model, config)
                    .await
            }
            AIProvider::Anthropic => self.complete_anthropic(messages, model, config).await,
        }
    }

    /// Stream a conversation response
    pub async fn stream(
        &self,
        messages: Vec<Message>,
        model: &str,
        provider: AIProvider,
        tx: mpsc::Sender<StreamChunk>,
    ) -> Result<(), AIError> {
        let config = self
            .configs
            .get(&provider)
            .ok_or(AIError::ProviderNotConfigured(provider))?;

        match provider {
            AIProvider::OpenAI
            | AIProvider::OpenRouter
            | AIProvider::Groq
            | AIProvider::DeepSeek
            | AIProvider::Local
            | AIProvider::Mistral => {
                self.stream_openai_compatible(messages, model, config, tx)
                    .await
            }
            AIProvider::Anthropic => self.stream_anthropic(messages, model, config, tx).await,
        }
    }

    // =========================================================================
    // OpenAI-Compatible API (OpenAI, OpenRouter, Groq, DeepSeek, Local, Mistral)
    // =========================================================================

    async fn complete_openai_compatible(
        &self,
        messages: Vec<Message>,
        model: &str,
        config: &ProviderConfig,
    ) -> Result<String, AIError> {
        let base_url = config.effective_base_url();
        let url = format!("{}/chat/completions", base_url);

        let openai_messages = convert_to_openai_messages(&messages);
        let request_body = OpenAIRequest {
            model: model.to_string(),
            messages: openai_messages,
            stream: false,
            max_tokens: None,
            temperature: None,
            tools: None,
            tool_choice: None,
            parallel_tool_calls: None,
        };

        let mut req = self.client.post(&url).json(&request_body);

        if let Some(ref api_key) = config.api_key {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }

        if let Some(ref org_id) = config.organization_id {
            req = req.header("OpenAI-Organization", org_id);
        }

        if config.provider == AIProvider::OpenRouter {
            req = req
                .header("HTTP-Referer", "https://cortex.ai")
                .header("X-Title", "Cortex Desktop");
        }

        let response = req.send().await?;
        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AIError::ApiError {
                provider: config.provider,
                message: error_text,
                status_code: Some(status.as_u16()),
            });
        }

        let response_body: OpenAIResponse = response.json().await?;

        response_body
            .choices
            .first()
            .and_then(|c| c.message.content.clone())
            .ok_or_else(|| AIError::ApiError {
                provider: config.provider,
                message: "No response content".to_string(),
                status_code: None,
            })
    }

    async fn stream_openai_compatible(
        &self,
        messages: Vec<Message>,
        model: &str,
        config: &ProviderConfig,
        tx: mpsc::Sender<StreamChunk>,
    ) -> Result<(), AIError> {
        let base_url = config.effective_base_url();
        let url = format!("{}/chat/completions", base_url);

        let openai_messages = convert_to_openai_messages(&messages);
        let request_body = OpenAIRequest {
            model: model.to_string(),
            messages: openai_messages,
            stream: true,
            max_tokens: None,
            temperature: None,
            tools: None,
            tool_choice: None,
            parallel_tool_calls: None,
        };

        let mut req = self.client.post(&url).json(&request_body);

        if let Some(ref api_key) = config.api_key {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }

        if let Some(ref org_id) = config.organization_id {
            req = req.header("OpenAI-Organization", org_id);
        }

        if config.provider == AIProvider::OpenRouter {
            req = req
                .header("HTTP-Referer", "https://cortex.ai")
                .header("X-Title", "Cortex Desktop");
        }

        let response = req.send().await?;
        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AIError::ApiError {
                provider: config.provider,
                message: error_text,
                status_code: Some(status.as_u16()),
            });
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut tool_call_accumulator: HashMap<
            usize,
            (Option<String>, Option<String>, String, String),
        > = HashMap::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer = buffer[line_end + 1..].to_string();

                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(sse_response) = serde_json::from_str::<OpenAIStreamResponse>(data) {
                        if let Some(choice) = sse_response.choices.first() {
                            if let Some(ref content) = choice.delta.content {
                                if !content.is_empty() {
                                    let chunk = StreamChunk::content(content);
                                    if tx.send(chunk).await.is_err() {
                                        return Err(AIError::ChannelError(
                                            "Receiver dropped".to_string(),
                                        ));
                                    }
                                }
                            }

                            if let Some(ref tc_deltas) = choice.delta.tool_calls {
                                for tc_delta in tc_deltas {
                                    let entry =
                                        tool_call_accumulator.entry(tc_delta.index).or_insert_with(
                                            || (None, None, String::new(), String::new()),
                                        );

                                    if let Some(ref id) = tc_delta.id {
                                        entry.0 = Some(id.clone());
                                    }
                                    if let Some(ref ct) = tc_delta.call_type {
                                        entry.1 = Some(ct.clone());
                                    }
                                    if let Some(ref func) = tc_delta.function {
                                        if let Some(ref name) = func.name {
                                            entry.2.push_str(name);
                                        }
                                        if let Some(ref args) = func.arguments {
                                            entry.3.push_str(args);
                                        }
                                    }
                                }
                            }

                            if choice.finish_reason.is_some() {
                                let mut accumulated_tool_calls: Option<Vec<ToolCallChunk>> = None;
                                if !tool_call_accumulator.is_empty() {
                                    let mut calls: Vec<(usize, ToolCallChunk)> =
                                        tool_call_accumulator
                                            .drain()
                                            .map(|(idx, (id, ct, name, args))| {
                                                (
                                                    idx,
                                                    ToolCallChunk {
                                                        id,
                                                        call_type: ct,
                                                        function: ToolCallFunction {
                                                            name,
                                                            arguments: args,
                                                        },
                                                    },
                                                )
                                            })
                                            .collect();
                                    calls.sort_by_key(|(idx, _)| *idx);
                                    let sorted_calls: Vec<ToolCallChunk> =
                                        calls.into_iter().map(|(_, c)| c).collect();
                                    info!(
                                        count = sorted_calls.len(),
                                        "Tool calls detected in stream response"
                                    );
                                    accumulated_tool_calls = Some(sorted_calls);
                                }

                                if let Some(ref tc) = accumulated_tool_calls {
                                    let tc_chunk = StreamChunk::tool_calls(tc.clone());
                                    if tx.send(tc_chunk).await.is_err() {
                                        return Err(AIError::ChannelError(
                                            "Receiver dropped".to_string(),
                                        ));
                                    }
                                }

                                let usage = sse_response.usage.map(|u| TokenUsage {
                                    prompt_tokens: u.prompt_tokens,
                                    completion_tokens: u.completion_tokens,
                                    total_tokens: u.total_tokens,
                                });
                                let done_chunk =
                                    StreamChunk::done(usage, choice.finish_reason.clone());
                                let _ = tx.send(done_chunk).await;
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    // =========================================================================
    // Anthropic API
    // =========================================================================

    async fn complete_anthropic(
        &self,
        messages: Vec<Message>,
        model: &str,
        config: &ProviderConfig,
    ) -> Result<String, AIError> {
        let base_url = config.effective_base_url();
        let url = format!("{}/messages", base_url);

        let (system_prompt, anthropic_messages) = convert_to_anthropic_messages(&messages);
        let request_body = AnthropicRequest {
            model: model.to_string(),
            messages: anthropic_messages,
            system: system_prompt,
            max_tokens: 4096,
            stream: false,
        };

        let api_key = config
            .api_key
            .as_ref()
            .ok_or(AIError::ApiKeyRequired(AIProvider::Anthropic))?;

        let response = self
            .client
            .post(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AIError::ApiError {
                provider: AIProvider::Anthropic,
                message: error_text,
                status_code: Some(status.as_u16()),
            });
        }

        let response_body: AnthropicResponse = response.json().await?;

        response_body
            .content
            .first()
            .and_then(|c| {
                if c.content_type == "text" {
                    Some(c.text.clone())
                } else {
                    None
                }
            })
            .ok_or_else(|| AIError::ApiError {
                provider: AIProvider::Anthropic,
                message: "No response content".to_string(),
                status_code: None,
            })
    }

    async fn stream_anthropic(
        &self,
        messages: Vec<Message>,
        model: &str,
        config: &ProviderConfig,
        tx: mpsc::Sender<StreamChunk>,
    ) -> Result<(), AIError> {
        let base_url = config.effective_base_url();
        let url = format!("{}/messages", base_url);

        let (system_prompt, anthropic_messages) = convert_to_anthropic_messages(&messages);
        let request_body = AnthropicRequest {
            model: model.to_string(),
            messages: anthropic_messages,
            system: system_prompt,
            max_tokens: 4096,
            stream: true,
        };

        let api_key = config
            .api_key
            .as_ref()
            .ok_or(AIError::ApiKeyRequired(AIProvider::Anthropic))?;

        let response = self
            .client
            .post(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AIError::ApiError {
                provider: AIProvider::Anthropic,
                message: error_text,
                status_code: Some(status.as_u16()),
            });
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut usage: Option<TokenUsage> = None;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer = buffer[line_end + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(event) = serde_json::from_str::<AnthropicStreamEvent>(data) {
                        match event.event_type.as_str() {
                            "content_block_delta" => {
                                if let Some(delta) = event.delta {
                                    if let Some(text) = delta.text {
                                        let chunk = StreamChunk::content(text);
                                        if tx.send(chunk).await.is_err() {
                                            return Err(AIError::ChannelError(
                                                "Receiver dropped".to_string(),
                                            ));
                                        }
                                    }
                                }
                            }
                            "message_delta" => {
                                if let Some(msg_usage) = event.usage {
                                    usage = Some(TokenUsage {
                                        prompt_tokens: msg_usage.input_tokens.unwrap_or(0),
                                        completion_tokens: msg_usage.output_tokens.unwrap_or(0),
                                        total_tokens: msg_usage.input_tokens.unwrap_or(0)
                                            + msg_usage.output_tokens.unwrap_or(0),
                                    });
                                }
                            }
                            "message_stop" => {
                                let done_chunk =
                                    StreamChunk::done(usage.take(), Some("stop".to_string()));
                                let _ = tx.send(done_chunk).await;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

impl Default for ProviderManager {
    fn default() -> Self {
        Self::new_or_panic()
    }
}

// =============================================================================
// OpenAI API Types
// =============================================================================

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<OpenAIToolDefinition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parallel_tool_calls: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<ToolCallChunk>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_control: Option<CacheControl>,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessageResponse,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessageResponse {
    content: Option<String>,
    tool_calls: Option<Vec<ToolCallChunk>>,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamResponse {
    choices: Vec<OpenAIStreamChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIDelta {
    content: Option<String>,
    tool_calls: Option<Vec<OpenAIStreamToolCallDelta>>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamToolCallDelta {
    index: usize,
    id: Option<String>,
    #[serde(rename = "type")]
    call_type: Option<String>,
    function: Option<OpenAIStreamFunctionDelta>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamFunctionDelta {
    name: Option<String>,
    arguments: Option<String>,
}

// =============================================================================
// Anthropic API Types
// =============================================================================

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    max_tokens: u32,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    delta: Option<AnthropicDelta>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicDelta {
    text: Option<String>,
}

// =============================================================================
// Message Conversion Helpers
// =============================================================================

fn convert_to_openai_messages(messages: &[Message]) -> Vec<OpenAIMessage> {
    let mut result = Vec::new();

    for msg in messages {
        match msg.role {
            MessageRole::System => {
                if let Some(text) = msg.text_content() {
                    result.push(OpenAIMessage {
                        role: "system".to_string(),
                        content: Some(text.to_string()),
                        tool_calls: None,
                        tool_call_id: None,
                        name: msg.name.clone(),
                        cache_control: Some(CacheControl {
                            cache_type: "ephemeral".to_string(),
                        }),
                    });
                }
            }
            MessageRole::User => {
                if let Some(text) = msg.text_content() {
                    result.push(OpenAIMessage {
                        role: "user".to_string(),
                        content: Some(text.to_string()),
                        tool_calls: None,
                        tool_call_id: None,
                        name: msg.name.clone(),
                        cache_control: None,
                    });
                }
            }
            MessageRole::Assistant => {
                let text_content: Option<String> = msg.text_content().map(|t| t.to_string());
                let mut tool_calls_vec: Vec<ToolCallChunk> = Vec::new();

                for content_item in &msg.content {
                    if let MessageContent::ToolCall {
                        id,
                        name,
                        arguments,
                    } = content_item
                    {
                        tool_calls_vec.push(ToolCallChunk {
                            id: Some(id.clone()),
                            call_type: Some("function".to_string()),
                            function: ToolCallFunction {
                                name: name.clone(),
                                arguments: arguments.clone(),
                            },
                        });
                    }
                }

                let tool_calls = if tool_calls_vec.is_empty() {
                    None
                } else {
                    Some(tool_calls_vec)
                };

                result.push(OpenAIMessage {
                    role: "assistant".to_string(),
                    content: text_content,
                    tool_calls,
                    tool_call_id: None,
                    name: msg.name.clone(),
                    cache_control: None,
                });
            }
            MessageRole::Tool => {
                for content_item in &msg.content {
                    if let MessageContent::ToolResult {
                        tool_call_id,
                        content,
                    } = content_item
                    {
                        result.push(OpenAIMessage {
                            role: "tool".to_string(),
                            content: Some(content.clone()),
                            tool_calls: None,
                            tool_call_id: Some(tool_call_id.clone()),
                            name: msg.name.clone(),
                            cache_control: None,
                        });
                    }
                }
            }
        }
    }

    result
}

fn convert_to_anthropic_messages(messages: &[Message]) -> (Option<String>, Vec<AnthropicMessage>) {
    let mut system_prompt = None;
    let mut anthropic_messages = Vec::new();

    for msg in messages {
        match msg.role {
            MessageRole::System => {
                if let Some(text) = msg.text_content() {
                    system_prompt = Some(text.to_string());
                }
            }
            MessageRole::User => {
                if let Some(text) = msg.text_content() {
                    anthropic_messages.push(AnthropicMessage {
                        role: "user".to_string(),
                        content: text.to_string(),
                    });
                }
            }
            MessageRole::Assistant => {
                if let Some(text) = msg.text_content() {
                    anthropic_messages.push(AnthropicMessage {
                        role: "assistant".to_string(),
                        content: text.to_string(),
                    });
                }
            }
            MessageRole::Tool => {}
        }
    }

    (system_prompt, anthropic_messages)
}

// =============================================================================
// Provider Models
// =============================================================================

/// Get the default models for a provider
pub fn get_provider_models(provider: AIProvider) -> Vec<AIModel> {
    match provider {
        AIProvider::OpenAI => vec![
            AIModel::new("gpt-4o", "GPT-4o", AIProvider::OpenAI)
                .with_context_window(128000)
                .with_max_output(16384)
                .with_vision()
                .with_functions(),
            AIModel::new("gpt-4o-mini", "GPT-4o Mini", AIProvider::OpenAI)
                .with_context_window(128000)
                .with_max_output(16384)
                .with_vision()
                .with_functions(),
            AIModel::new("gpt-4-turbo", "GPT-4 Turbo", AIProvider::OpenAI)
                .with_context_window(128000)
                .with_max_output(4096)
                .with_vision()
                .with_functions(),
            AIModel::new("gpt-3.5-turbo", "GPT-3.5 Turbo", AIProvider::OpenAI)
                .with_context_window(16385)
                .with_max_output(4096)
                .with_functions(),
            AIModel::new("o1", "o1", AIProvider::OpenAI)
                .with_context_window(200000)
                .with_max_output(100000),
            AIModel::new("o1-mini", "o1-mini", AIProvider::OpenAI)
                .with_context_window(128000)
                .with_max_output(65536),
        ],
        AIProvider::Anthropic => vec![
            AIModel::new(
                "claude-sonnet-4-20250514",
                "Claude Sonnet 4",
                AIProvider::Anthropic,
            )
            .with_context_window(200000)
            .with_max_output(8192)
            .with_vision(),
            AIModel::new(
                "claude-3-5-sonnet-20241022",
                "Claude 3.5 Sonnet",
                AIProvider::Anthropic,
            )
            .with_context_window(200000)
            .with_max_output(8192)
            .with_vision(),
            AIModel::new(
                "claude-3-5-haiku-20241022",
                "Claude 3.5 Haiku",
                AIProvider::Anthropic,
            )
            .with_context_window(200000)
            .with_max_output(8192)
            .with_vision(),
            AIModel::new(
                "claude-3-opus-20240229",
                "Claude 3 Opus",
                AIProvider::Anthropic,
            )
            .with_context_window(200000)
            .with_max_output(4096)
            .with_vision(),
        ],

        AIProvider::Groq => vec![
            AIModel::new("llama-3.3-70b-versatile", "Llama 3.3 70B", AIProvider::Groq)
                .with_context_window(131072)
                .with_max_output(32768),
            AIModel::new("llama-3.1-8b-instant", "Llama 3.1 8B", AIProvider::Groq)
                .with_context_window(131072)
                .with_max_output(8192),
            AIModel::new("mixtral-8x7b-32768", "Mixtral 8x7B", AIProvider::Groq)
                .with_context_window(32768)
                .with_max_output(32768),
        ],
        AIProvider::DeepSeek => vec![
            AIModel::new("deepseek-chat", "DeepSeek Chat", AIProvider::DeepSeek)
                .with_context_window(64000)
                .with_max_output(8192),
            AIModel::new("deepseek-coder", "DeepSeek Coder", AIProvider::DeepSeek)
                .with_context_window(64000)
                .with_max_output(8192),
        ],
        AIProvider::Mistral => vec![
            AIModel::new("mistral-large-latest", "Mistral Large", AIProvider::Mistral)
                .with_context_window(131072)
                .with_functions(),
            AIModel::new(
                "mistral-medium-latest",
                "Mistral Medium",
                AIProvider::Mistral,
            )
            .with_context_window(32768)
            .with_functions(),
            AIModel::new("mistral-small-latest", "Mistral Small", AIProvider::Mistral)
                .with_context_window(32768)
                .with_functions(),
            AIModel::new("codestral-latest", "Codestral", AIProvider::Mistral)
                .with_context_window(32768),
        ],
        AIProvider::OpenRouter => vec![
            AIModel::new(
                "openai/gpt-4o",
                "GPT-4o (via OpenRouter)",
                AIProvider::OpenRouter,
            )
            .with_context_window(128000)
            .with_vision()
            .with_functions(),
            AIModel::new(
                "anthropic/claude-3.5-sonnet",
                "Claude 3.5 Sonnet (via OpenRouter)",
                AIProvider::OpenRouter,
            )
            .with_context_window(200000)
            .with_vision(),
            AIModel::new(
                "google/gemini-pro-1.5",
                "Gemini Pro 1.5 (via OpenRouter)",
                AIProvider::OpenRouter,
            )
            .with_context_window(1000000)
            .with_vision(),
        ],
        AIProvider::Local => vec![
            AIModel::new("local-model", "Local Model", AIProvider::Local).with_context_window(8192),
        ],
    }
}

/// Thread-safe wrapper for ProviderManager
pub type SharedProviderManager = Arc<tokio::sync::Mutex<ProviderManager>>;

/// Create a new shared provider manager
pub fn create_shared_provider_manager() -> SharedProviderManager {
    Arc::new(tokio::sync::Mutex::new(ProviderManager::new_or_panic()))
}
