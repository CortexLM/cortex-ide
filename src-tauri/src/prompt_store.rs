//! Prompt Store - Persistent storage for AI prompt templates
//!
//! Provides Tauri commands for CRUD operations on saved prompts with
//! file-based JSON storage in the user's config directory.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tracing::info;

// ============================================================================
// Types
// ============================================================================

/// A saved prompt template
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPrompt {
    pub id: String,
    pub title: String,
    pub content: String,
    pub description: String,
    pub tags: Vec<String>,
    pub category: String,
    pub is_favorite: bool,
    pub usage_count: u32,
    pub created_at: String,
    pub updated_at: String,
}

/// A prompt category for organization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptCategory {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub prompt_count: u32,
}

/// Data structure for storing prompts
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PromptStoreData {
    pub version: String,
    pub prompts: Vec<SavedPrompt>,
    pub categories: Vec<PromptCategory>,
}

/// State for the prompt store
pub struct PromptStoreState {
    data: Mutex<PromptStoreData>,
    storage_path: Mutex<Option<PathBuf>>,
}

impl PromptStoreState {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(PromptStoreData {
                version: "1.0".to_string(),
                prompts: Vec::new(),
                categories: get_default_categories(),
            }),
            storage_path: Mutex::new(None),
        }
    }

    fn get_storage_path(&self, app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let mut path_guard = self
            .storage_path
            .lock()
            .map_err(|_| "Failed to acquire storage path lock")?;
        if path_guard.is_none() {
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
                dirs::config_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("Cortex-desktop")
            });
            let prompts_path = app_data_dir.join("prompts.json");
            *path_guard = Some(prompts_path);
        }
        path_guard
            .clone()
            .ok_or_else(|| "Storage path not initialized".to_string())
    }

    fn load_from_file(&self, path: &PathBuf) -> Result<PromptStoreData, String> {
        if !path.exists() {
            return Ok(PromptStoreData {
                version: "1.0".to_string(),
                prompts: get_default_prompts(),
                categories: get_default_categories(),
            });
        }

        let content =
            fs::read_to_string(path).map_err(|e| format!("Failed to read prompts file: {}", e))?;

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse prompts file: {}", e))
    }

    fn save_to_file(&self, path: &PathBuf, data: &PromptStoreData) -> Result<(), String> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create prompts directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize prompts: {}", e))?;

        fs::write(path, content).map_err(|e| format!("Failed to write prompts file: {}", e))
    }
}

impl Default for PromptStoreState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Default Data
// ============================================================================

fn get_default_categories() -> Vec<PromptCategory> {
    vec![
        PromptCategory {
            id: "coding".to_string(),
            name: "Coding".to_string(),
            color: "#8b5cf6".to_string(),
            icon: "code".to_string(),
            prompt_count: 0,
        },
        PromptCategory {
            id: "writing".to_string(),
            name: "Writing".to_string(),
            color: "#3b82f6".to_string(),
            icon: "pencil".to_string(),
            prompt_count: 0,
        },
        PromptCategory {
            id: "analysis".to_string(),
            name: "Analysis".to_string(),
            color: "#22c55e".to_string(),
            icon: "chart".to_string(),
            prompt_count: 0,
        },
        PromptCategory {
            id: "creative".to_string(),
            name: "Creative".to_string(),
            color: "#f59e0b".to_string(),
            icon: "lightbulb".to_string(),
            prompt_count: 0,
        },
        PromptCategory {
            id: "general".to_string(),
            name: "General".to_string(),
            color: "#6b7280".to_string(),
            icon: "folder".to_string(),
            prompt_count: 0,
        },
    ]
}

fn get_default_prompts() -> Vec<SavedPrompt> {
    let now = chrono::Utc::now().to_rfc3339();
    vec![
        SavedPrompt {
            id: "code-review".to_string(),
            title: "Code Review".to_string(),
            content: "Please review the following code and provide feedback on:\n1. Code quality and best practices\n2. Potential bugs or issues\n3. Performance considerations\n4. Security concerns\n5. Suggestions for improvement\n\n```\n{{code}}\n```".to_string(),
            description: "Comprehensive code review prompt".to_string(),
            tags: vec!["code".to_string(), "review".to_string(), "quality".to_string()],
            category: "coding".to_string(),
            is_favorite: true,
            usage_count: 0,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SavedPrompt {
            id: "explain-code".to_string(),
            title: "Explain Code".to_string(),
            content: "Please explain the following code in detail:\n\n1. What does this code do?\n2. How does it work step by step?\n3. What are the key concepts used?\n4. Are there any edge cases to consider?\n\n```\n{{code}}\n```".to_string(),
            description: "Get a detailed explanation of code".to_string(),
            tags: vec!["code".to_string(), "explain".to_string(), "learning".to_string()],
            category: "coding".to_string(),
            is_favorite: false,
            usage_count: 0,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SavedPrompt {
            id: "write-tests".to_string(),
            title: "Write Unit Tests".to_string(),
            content: "Write comprehensive unit tests for the following code. Include:\n1. Happy path tests\n2. Edge cases\n3. Error handling tests\n4. Mock dependencies where appropriate\n\nUse {{framework}} testing framework.\n\n```\n{{code}}\n```".to_string(),
            description: "Generate unit tests for code".to_string(),
            tags: vec!["code".to_string(), "testing".to_string(), "unit-tests".to_string()],
            category: "coding".to_string(),
            is_favorite: true,
            usage_count: 0,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SavedPrompt {
            id: "debug-error".to_string(),
            title: "Debug Error".to_string(),
            content: "I'm getting the following error:\n\n```\n{{error}}\n```\n\nIn this code:\n\n```\n{{code}}\n```\n\nPlease help me:\n1. Understand what's causing the error\n2. Provide a solution\n3. Explain how to prevent this in the future".to_string(),
            description: "Debug an error message".to_string(),
            tags: vec!["code".to_string(), "debug".to_string(), "error".to_string()],
            category: "coding".to_string(),
            is_favorite: true,
            usage_count: 0,
            created_at: now.clone(),
            updated_at: now,
        },
    ]
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Load prompts from storage (uses cache if already loaded)
#[tauri::command]
pub async fn prompt_store_load(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
) -> Result<PromptStoreData, String> {
    // Check if already loaded in memory (fast path for new windows)
    {
        let state_data = state.data.lock().map_err(|e| e.to_string())?;
        if !state_data.prompts.is_empty() {
            // Already loaded, return cached data
            return Ok(state_data.clone());
        }
    }

    // Not loaded yet, read from file
    let path = state.get_storage_path(&app)?;
    let data = state.load_from_file(&path)?;

    // Update in-memory state
    let mut state_data = state.data.lock().map_err(|e| e.to_string())?;
    *state_data = data.clone();

    info!("Loaded {} prompts from {:?}", data.prompts.len(), path);

    Ok(data)
}

/// Save prompts to storage
#[tauri::command]
pub async fn prompt_store_save(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
    prompts: Vec<SavedPrompt>,
    categories: Vec<PromptCategory>,
) -> Result<(), String> {
    let path = state.get_storage_path(&app)?;

    let data = PromptStoreData {
        version: "1.0".to_string(),
        prompts,
        categories,
    };

    state.save_to_file(&path, &data)?;

    // Update in-memory state
    let mut state_data = state.data.lock().map_err(|e| e.to_string())?;
    *state_data = data;

    info!("Saved prompts to {:?}", path);

    Ok(())
}

/// Get a single prompt by ID
#[tauri::command]
pub async fn prompt_store_get(
    state: tauri::State<'_, PromptStoreState>,
    id: String,
) -> Result<Option<SavedPrompt>, String> {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    Ok(data.prompts.iter().find(|p| p.id == id).cloned())
}

/// Create a new prompt
#[tauri::command]
pub async fn prompt_store_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
    prompt: SavedPrompt,
) -> Result<SavedPrompt, String> {
    let path = state.get_storage_path(&app)?;

    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    // Check for duplicate ID
    if data.prompts.iter().any(|p| p.id == prompt.id) {
        return Err("Prompt with this ID already exists".to_string());
    }

    data.prompts.push(prompt.clone());

    // Save to file
    drop(data);
    let data = state.data.lock().map_err(|e| e.to_string())?;
    state.save_to_file(&path, &data)?;

    info!("Created prompt: {}", prompt.title);

    Ok(prompt)
}

/// Update an existing prompt
#[tauri::command]
pub async fn prompt_store_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
    id: String,
    updates: SavedPrompt,
) -> Result<SavedPrompt, String> {
    let path = state.get_storage_path(&app)?;

    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    let prompt = data
        .prompts
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "Prompt not found".to_string())?;

    *prompt = updates.clone();

    // Save to file
    let data_clone = data.clone();
    drop(data);
    state.save_to_file(&path, &data_clone)?;

    info!("Updated prompt: {}", updates.title);

    Ok(updates)
}

/// Delete a prompt
#[tauri::command]
pub async fn prompt_store_delete(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
    id: String,
) -> Result<(), String> {
    let path = state.get_storage_path(&app)?;

    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    let len_before = data.prompts.len();
    data.prompts.retain(|p| p.id != id);

    if data.prompts.len() == len_before {
        return Err("Prompt not found".to_string());
    }

    // Save to file
    let data_clone = data.clone();
    drop(data);
    state.save_to_file(&path, &data_clone)?;

    info!("Deleted prompt: {}", id);

    Ok(())
}

/// Export prompts to JSON string
#[tauri::command]
pub async fn prompt_store_export(
    state: tauri::State<'_, PromptStoreState>,
    prompt_ids: Option<Vec<String>>,
) -> Result<String, String> {
    let data = state.data.lock().map_err(|e| e.to_string())?;

    let prompts_to_export: Vec<SavedPrompt> = if let Some(ids) = prompt_ids {
        data.prompts
            .iter()
            .filter(|p| ids.contains(&p.id))
            .cloned()
            .collect()
    } else {
        data.prompts.clone()
    };

    let export_data = PromptStoreData {
        version: "1.0".to_string(),
        prompts: prompts_to_export,
        categories: data.categories.clone(),
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize prompts: {}", e))
}

/// Import prompts from JSON string
#[tauri::command]
pub async fn prompt_store_import(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
    json_data: String,
    merge: bool,
) -> Result<u32, String> {
    let path = state.get_storage_path(&app)?;

    let import_data: PromptStoreData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    let mut data = state.data.lock().map_err(|e| e.to_string())?;

    let mut imported_count = 0u32;

    if merge {
        // Merge mode: add new prompts, skip existing
        for prompt in import_data.prompts {
            if !data.prompts.iter().any(|p| p.id == prompt.id) {
                data.prompts.push(prompt);
                imported_count += 1;
            }
        }

        // Merge categories
        for category in import_data.categories {
            if !data.categories.iter().any(|c| c.id == category.id) {
                data.categories.push(category);
            }
        }
    } else {
        // Replace mode: clear and replace all
        data.prompts = import_data.prompts;
        data.categories = import_data.categories;
        imported_count = data.prompts.len() as u32;
    }

    // Save to file
    let data_clone = data.clone();
    drop(data);
    state.save_to_file(&path, &data_clone)?;

    info!("Imported {} prompts", imported_count);

    Ok(imported_count)
}

/// Get storage path for prompts
#[tauri::command]
pub async fn prompt_store_get_path(
    app: tauri::AppHandle,
    state: tauri::State<'_, PromptStoreState>,
) -> Result<String, String> {
    let path = state.get_storage_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}
