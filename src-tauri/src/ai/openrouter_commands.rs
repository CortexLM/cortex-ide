//! OpenRouter-specific Tauri IPC commands
//!
//! Provides dedicated commands for the OpenRouter frontend provider,
//! routing requests through the backend ProviderManager to bypass CSP restrictions.

use super::AIState;
use super::types::{AIModel, AIProvider, Message, ProviderConfig, StreamChunk};
use crate::settings::secure_store::SecureApiKeyStore;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use tracing::{error, info};

const OPENROUTER_KEY_NAME: &str = "openrouter_api_key";

/// Store the OpenRouter API key securely in the OS keyring.
#[tauri::command]
pub async fn set_openrouter_api_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty".into());
    }
    if api_key.len() > 512 {
        return Err("API key exceeds maximum length".into());
    }
    SecureApiKeyStore::set_api_key(OPENROUTER_KEY_NAME, api_key)?;
    info!("OpenRouter API key stored securely");
    Ok(())
}

/// Check if an OpenRouter API key exists in the OS keyring.
#[tauri::command]
pub async fn get_openrouter_api_key() -> Result<bool, String> {
    SecureApiKeyStore::has_api_key(OPENROUTER_KEY_NAME)
}

/// Ensure the provider manager is configured with the stored OpenRouter API key.
async fn ensure_openrouter_configured(state: &State<'_, AIState>) -> Result<(), String> {
    let has_key = SecureApiKeyStore::has_api_key(OPENROUTER_KEY_NAME)?;
    if !has_key {
        return Err("OpenRouter API key not configured. Use set_openrouter_api_key first.".into());
    }

    let secret = SecureApiKeyStore::get_api_key(OPENROUTER_KEY_NAME)
        .map_err(|e| format!("Failed to retrieve OpenRouter API key: {e}"))?
        .ok_or_else(|| "OpenRouter API key not found".to_string())?;

    use secrecy::ExposeSecret;
    let api_key = secret.expose_secret().to_string();

    let mut manager = state.provider_manager.lock().await;
    if !manager.is_configured(AIProvider::OpenRouter) {
        let config = ProviderConfig::new(AIProvider::OpenRouter).with_api_key(api_key);
        manager.configure(config);
    }

    Ok(())
}

/// List available OpenRouter models.
#[tauri::command]
pub async fn openrouter_list_models(state: State<'_, AIState>) -> Result<Vec<AIModel>, String> {
    ensure_openrouter_configured(&state).await?;
    let manager = state.provider_manager.lock().await;
    let all_models = manager.list_models();
    let openrouter_models: Vec<AIModel> = all_models
        .into_iter()
        .filter(|m| m.provider == AIProvider::OpenRouter)
        .collect();
    Ok(openrouter_models)
}

/// Non-streaming chat completion via OpenRouter.
#[tauri::command]
pub async fn openrouter_chat(
    state: State<'_, AIState>,
    messages: Vec<Message>,
    model: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    tools: Option<serde_json::Value>,
) -> Result<String, String> {
    let _ = (max_tokens, temperature, tools);
    if model.trim().is_empty() {
        return Err("Model identifier cannot be empty".into());
    }
    if messages.is_empty() {
        return Err("Messages list cannot be empty".into());
    }
    ensure_openrouter_configured(&state).await?;
    let manager = state.provider_manager.lock().await;
    manager
        .complete(messages, &model, AIProvider::OpenRouter)
        .await
        .map_err(|e| e.to_string())
}

/// Streaming chat completion via OpenRouter.
///
/// Emits `openrouter:stream` events with `StreamEventPayload` payloads.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn openrouter_stream_chat(
    app: AppHandle,
    state: State<'_, AIState>,
    messages: Vec<Message>,
    model: String,
    thread_id: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    tools: Option<serde_json::Value>,
) -> Result<(), String> {
    let _ = (max_tokens, temperature, tools);
    if model.trim().is_empty() {
        return Err("Model identifier cannot be empty".into());
    }
    if messages.is_empty() {
        return Err("Messages list cannot be empty".into());
    }
    if thread_id.trim().is_empty() {
        return Err("Thread ID cannot be empty".into());
    }
    ensure_openrouter_configured(&state).await?;

    let manager = state.provider_manager.lock().await;
    let (tx, mut rx) = mpsc::channel::<StreamChunk>(100);

    let thread_id_clone = thread_id.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(chunk) = rx.recv().await {
            let event_payload = OpenRouterStreamPayload {
                thread_id: thread_id_clone.clone(),
                chunk,
            };
            if let Err(e) = app_clone.emit("openrouter:stream", &event_payload) {
                error!("Failed to emit openrouter:stream event: {}", e);
            }
        }
    });

    manager
        .stream(messages, &model, AIProvider::OpenRouter, tx)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Payload for OpenRouter stream events
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenRouterStreamPayload {
    thread_id: String,
    chunk: StreamChunk,
}
