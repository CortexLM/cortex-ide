//! Languages API for extension plugins.
//!
//! Provides Tauri IPC commands for extensions to register language feature
//! providers (completion, hover, definition, references, symbols, code actions,
//! code lens, formatting, rename, semantic tokens) and publish diagnostics.

use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

// ============================================================================
// Types
// ============================================================================

/// Registration metadata for a completion provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
    #[serde(default)]
    pub trigger_characters: Vec<String>,
}

/// Registration metadata for a hover provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for a definition provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefinitionProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for a reference provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for a document symbol provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSymbolProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for a workspace symbol provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSymbolProviderRegistration {
    pub id: String,
    pub extension_id: String,
}

/// Registration metadata for a code actions provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeActionsProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for a code lens provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeLensProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for a document formatting edit provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentFormattingEditProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Registration metadata for an on-type formatting edit provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnTypeFormattingEditProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
    pub first_trigger_character: String,
    #[serde(default)]
    pub more_trigger_characters: Vec<String>,
}

/// Registration metadata for a rename provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
}

/// Legend describing the token types and modifiers for semantic tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTokensLegend {
    pub token_types: Vec<String>,
    pub token_modifiers: Vec<String>,
}

/// Registration metadata for a document semantic tokens provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSemanticTokensProviderRegistration {
    pub id: String,
    pub extension_id: String,
    pub language_id: String,
    pub legend: SemanticTokensLegend,
}

/// A single diagnostic entry published by an extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticEntry {
    pub uri: String,
    pub range_start_line: u32,
    pub range_start_character: u32,
    pub range_end_line: u32,
    pub range_end_character: u32,
    pub severity: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// Payload emitted when an extension publishes diagnostics for a file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsPayload {
    pub extension_id: String,
    pub uri: String,
    pub diagnostics: Vec<DiagnosticEntry>,
}

/// Metadata for a diagnostic collection created by an extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticCollectionInfo {
    pub collection_id: String,
    pub extension_id: String,
    pub name: String,
}

// ============================================================================
// State
// ============================================================================

/// Shared state for language feature provider registrations.
#[derive(Clone)]
pub struct LanguagesApiState {
    pub completion_providers: Arc<DashMap<String, CompletionProviderRegistration>>,
    pub hover_providers: Arc<DashMap<String, HoverProviderRegistration>>,
    pub definition_providers: Arc<DashMap<String, DefinitionProviderRegistration>>,
    pub reference_providers: Arc<DashMap<String, ReferenceProviderRegistration>>,
    pub document_symbol_providers: Arc<DashMap<String, DocumentSymbolProviderRegistration>>,
    pub workspace_symbol_providers: Arc<DashMap<String, WorkspaceSymbolProviderRegistration>>,
    pub code_actions_providers: Arc<DashMap<String, CodeActionsProviderRegistration>>,
    pub code_lens_providers: Arc<DashMap<String, CodeLensProviderRegistration>>,
    pub document_formatting_providers:
        Arc<DashMap<String, DocumentFormattingEditProviderRegistration>>,
    pub on_type_formatting_providers:
        Arc<DashMap<String, OnTypeFormattingEditProviderRegistration>>,
    pub rename_providers: Arc<DashMap<String, RenameProviderRegistration>>,
    pub semantic_tokens_providers: Arc<DashMap<String, DocumentSemanticTokensProviderRegistration>>,
    pub diagnostic_collections: Arc<DashMap<String, DiagnosticCollectionInfo>>,
}

impl Default for LanguagesApiState {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguagesApiState {
    pub fn new() -> Self {
        Self {
            completion_providers: Arc::new(DashMap::new()),
            hover_providers: Arc::new(DashMap::new()),
            definition_providers: Arc::new(DashMap::new()),
            reference_providers: Arc::new(DashMap::new()),
            document_symbol_providers: Arc::new(DashMap::new()),
            workspace_symbol_providers: Arc::new(DashMap::new()),
            code_actions_providers: Arc::new(DashMap::new()),
            code_lens_providers: Arc::new(DashMap::new()),
            document_formatting_providers: Arc::new(DashMap::new()),
            on_type_formatting_providers: Arc::new(DashMap::new()),
            rename_providers: Arc::new(DashMap::new()),
            semantic_tokens_providers: Arc::new(DashMap::new()),
            diagnostic_collections: Arc::new(DashMap::new()),
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Register a completion provider for a language.
#[tauri::command]
pub async fn plugin_register_completion_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
    trigger_characters: Option<Vec<String>>,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = CompletionProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
        trigger_characters: trigger_characters.unwrap_or_default(),
    };

    state
        .completion_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:completion-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit completion-provider-registered event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Completion provider registered"
    );

    Ok(id)
}

/// Register a hover provider for a language.
#[tauri::command]
pub async fn plugin_register_hover_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = HoverProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .hover_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:hover-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit hover-provider-registered event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Hover provider registered"
    );

    Ok(id)
}

/// Register a definition provider for a language.
#[tauri::command]
pub async fn plugin_register_definition_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = DefinitionProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .definition_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:definition-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit definition-provider-registered event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Definition provider registered"
    );

    Ok(id)
}

/// Publish diagnostics for a file from an extension.
///
/// Emits `plugin:diagnostics-published` so the frontend can display them
/// in the editor and problems panel.
#[tauri::command]
pub async fn plugin_register_diagnostics(
    app: AppHandle,
    extension_id: String,
    uri: String,
    diagnostics: Vec<DiagnosticEntry>,
) -> Result<(), String> {
    let payload = DiagnosticsPayload {
        extension_id: extension_id.clone(),
        uri: uri.clone(),
        diagnostics,
    };

    app.emit("plugin:diagnostics-published", &payload)
        .map_err(|e| format!("Failed to emit diagnostics-published event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        uri = %uri,
        "Diagnostics published"
    );

    Ok(())
}

/// Register a reference provider for a language.
#[tauri::command]
pub async fn plugin_register_reference_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = ReferenceProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .reference_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:reference-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit reference-provider-registered event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Reference provider registered"
    );

    Ok(id)
}

/// Unregister a reference provider.
#[tauri::command]
pub async fn plugin_unregister_reference_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state.reference_providers.remove(&provider_id).is_some() {
        tracing::info!(provider_id = %provider_id, "Reference provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown reference provider");
    }

    app.emit(
        "plugin:reference-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit reference-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register a document symbol provider for a language.
#[tauri::command]
pub async fn plugin_register_document_symbol_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = DocumentSymbolProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .document_symbol_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:document-symbol-provider-registered", &registration)
        .map_err(|e| {
            format!(
                "Failed to emit document-symbol-provider-registered event: {}",
                e
            )
        })?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Document symbol provider registered"
    );

    Ok(id)
}

/// Unregister a document symbol provider.
#[tauri::command]
pub async fn plugin_unregister_document_symbol_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state
        .document_symbol_providers
        .remove(&provider_id)
        .is_some()
    {
        tracing::info!(provider_id = %provider_id, "Document symbol provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown document symbol provider");
    }

    app.emit(
        "plugin:document-symbol-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit document-symbol-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register a workspace symbol provider.
#[tauri::command]
pub async fn plugin_register_workspace_symbol_provider(
    app: AppHandle,
    extension_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = WorkspaceSymbolProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
    };

    state
        .workspace_symbol_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:workspace-symbol-provider-registered", &registration)
        .map_err(|e| {
            format!(
                "Failed to emit workspace-symbol-provider-registered event: {}",
                e
            )
        })?;

    tracing::info!(
        extension_id = %extension_id,
        provider_id = %id,
        "Workspace symbol provider registered"
    );

    Ok(id)
}

/// Unregister a workspace symbol provider.
#[tauri::command]
pub async fn plugin_unregister_workspace_symbol_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state
        .workspace_symbol_providers
        .remove(&provider_id)
        .is_some()
    {
        tracing::info!(provider_id = %provider_id, "Workspace symbol provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown workspace symbol provider");
    }

    app.emit(
        "plugin:workspace-symbol-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit workspace-symbol-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register a code actions provider for a language.
#[tauri::command]
pub async fn plugin_register_code_actions_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = CodeActionsProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .code_actions_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:code-actions-provider-registered", &registration)
        .map_err(|e| {
            format!(
                "Failed to emit code-actions-provider-registered event: {}",
                e
            )
        })?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Code actions provider registered"
    );

    Ok(id)
}

/// Unregister a code actions provider.
#[tauri::command]
pub async fn plugin_unregister_code_actions_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state.code_actions_providers.remove(&provider_id).is_some() {
        tracing::info!(provider_id = %provider_id, "Code actions provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown code actions provider");
    }

    app.emit(
        "plugin:code-actions-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit code-actions-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register a code lens provider for a language.
#[tauri::command]
pub async fn plugin_register_code_lens_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = CodeLensProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .code_lens_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:code-lens-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit code-lens-provider-registered event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Code lens provider registered"
    );

    Ok(id)
}

/// Unregister a code lens provider.
#[tauri::command]
pub async fn plugin_unregister_code_lens_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state.code_lens_providers.remove(&provider_id).is_some() {
        tracing::info!(provider_id = %provider_id, "Code lens provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown code lens provider");
    }

    app.emit(
        "plugin:code-lens-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit code-lens-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register a document formatting edit provider for a language.
#[tauri::command]
pub async fn plugin_register_document_formatting_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = DocumentFormattingEditProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .document_formatting_providers
        .insert(id.clone(), registration.clone());

    app.emit(
        "plugin:document-formatting-provider-registered",
        &registration,
    )
    .map_err(|e| {
        format!(
            "Failed to emit document-formatting-provider-registered event: {}",
            e
        )
    })?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Document formatting provider registered"
    );

    Ok(id)
}

/// Unregister a document formatting edit provider.
#[tauri::command]
pub async fn plugin_unregister_document_formatting_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state
        .document_formatting_providers
        .remove(&provider_id)
        .is_some()
    {
        tracing::info!(provider_id = %provider_id, "Document formatting provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown document formatting provider");
    }

    app.emit(
        "plugin:document-formatting-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit document-formatting-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register an on-type formatting edit provider for a language.
#[tauri::command]
pub async fn plugin_register_on_type_formatting_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
    first_trigger_character: String,
    more_trigger_characters: Option<Vec<String>>,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = OnTypeFormattingEditProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
        first_trigger_character: first_trigger_character.clone(),
        more_trigger_characters: more_trigger_characters.unwrap_or_default(),
    };

    state
        .on_type_formatting_providers
        .insert(id.clone(), registration.clone());

    app.emit(
        "plugin:on-type-formatting-provider-registered",
        &registration,
    )
    .map_err(|e| {
        format!(
            "Failed to emit on-type-formatting-provider-registered event: {}",
            e
        )
    })?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "On-type formatting provider registered"
    );

    Ok(id)
}

/// Unregister an on-type formatting edit provider.
#[tauri::command]
pub async fn plugin_unregister_on_type_formatting_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state
        .on_type_formatting_providers
        .remove(&provider_id)
        .is_some()
    {
        tracing::info!(provider_id = %provider_id, "On-type formatting provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown on-type formatting provider");
    }

    app.emit(
        "plugin:on-type-formatting-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit on-type-formatting-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Register a rename provider for a language.
#[tauri::command]
pub async fn plugin_register_rename_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = RenameProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
    };

    state
        .rename_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:rename-provider-registered", &registration)
        .map_err(|e| format!("Failed to emit rename-provider-registered event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Rename provider registered"
    );

    Ok(id)
}

/// Unregister a rename provider.
#[tauri::command]
pub async fn plugin_unregister_rename_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state.rename_providers.remove(&provider_id).is_some() {
        tracing::info!(provider_id = %provider_id, "Rename provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown rename provider");
    }

    app.emit(
        "plugin:rename-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| format!("Failed to emit rename-provider-unregistered event: {}", e))?;

    Ok(())
}

/// Register a document semantic tokens provider for a language.
#[tauri::command]
pub async fn plugin_register_semantic_tokens_provider(
    app: AppHandle,
    extension_id: String,
    language_id: String,
    token_types: Vec<String>,
    token_modifiers: Vec<String>,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let id = uuid::Uuid::new_v4().to_string();

    let registration = DocumentSemanticTokensProviderRegistration {
        id: id.clone(),
        extension_id: extension_id.clone(),
        language_id: language_id.clone(),
        legend: SemanticTokensLegend {
            token_types,
            token_modifiers,
        },
    };

    state
        .semantic_tokens_providers
        .insert(id.clone(), registration.clone());

    app.emit("plugin:semantic-tokens-provider-registered", &registration)
        .map_err(|e| {
            format!(
                "Failed to emit semantic-tokens-provider-registered event: {}",
                e
            )
        })?;

    tracing::info!(
        extension_id = %extension_id,
        language_id = %language_id,
        provider_id = %id,
        "Semantic tokens provider registered"
    );

    Ok(id)
}

/// Unregister a document semantic tokens provider.
#[tauri::command]
pub async fn plugin_unregister_semantic_tokens_provider(
    app: AppHandle,
    provider_id: String,
) -> Result<(), String> {
    let state = app.state::<LanguagesApiState>();

    if state
        .semantic_tokens_providers
        .remove(&provider_id)
        .is_some()
    {
        tracing::info!(provider_id = %provider_id, "Semantic tokens provider unregistered");
    } else {
        tracing::warn!(provider_id = %provider_id, "Attempted to unregister unknown semantic tokens provider");
    }

    app.emit(
        "plugin:semantic-tokens-provider-unregistered",
        serde_json::json!({ "id": provider_id }),
    )
    .map_err(|e| {
        format!(
            "Failed to emit semantic-tokens-provider-unregistered event: {}",
            e
        )
    })?;

    Ok(())
}

/// Create a named diagnostic collection for an extension.
///
/// Returns the generated `collection_id`. The frontend is notified via
/// `plugin:diagnostic-collection-created` so it can track diagnostics
/// from this collection.
#[tauri::command]
pub async fn plugin_create_diagnostic_collection(
    app: AppHandle,
    extension_id: String,
    name: String,
) -> Result<String, String> {
    let state = app.state::<LanguagesApiState>();
    let collection_id = uuid::Uuid::new_v4().to_string();

    let info = DiagnosticCollectionInfo {
        collection_id: collection_id.clone(),
        extension_id: extension_id.clone(),
        name: name.clone(),
    };

    state
        .diagnostic_collections
        .insert(collection_id.clone(), info.clone());

    app.emit("plugin:diagnostic-collection-created", &info)
        .map_err(|e| format!("Failed to emit diagnostic-collection-created event: {}", e))?;

    tracing::info!(
        extension_id = %extension_id,
        collection_id = %collection_id,
        name = %name,
        "Diagnostic collection created"
    );

    Ok(collection_id)
}
