//! GitHub Gists API integration for settings sync
//!
//! Uses reqwest (async) to create, update, fetch, and delete
//! GitHub Gists for storing settings sync data.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use super::types::SyncBundle;

const GIST_FILENAME: &str = "cortex-settings-sync.json";
const GITHUB_API_URL: &str = "https://api.github.com";

#[derive(Debug, Serialize)]
struct CreateGistRequest {
    description: String,
    public: bool,
    files: std::collections::HashMap<String, GistFileContent>,
}

#[derive(Debug, Serialize)]
struct UpdateGistRequest {
    files: std::collections::HashMap<String, GistFileContent>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GistFileContent {
    content: String,
}

#[derive(Debug, Deserialize)]
struct GistResponse {
    id: String,
    files: std::collections::HashMap<String, GistFileResponse>,
}

#[derive(Debug, Deserialize)]
struct GistFileResponse {
    content: String,
}

/// Create a new private GitHub Gist with the sync data
pub async fn create_gist(token: &str, bundle: &SyncBundle) -> Result<String, String> {
    let client = Client::new();
    let content = serde_json::to_string_pretty(bundle)
        .map_err(|e| format!("Failed to serialize bundle: {}", e))?;

    let mut files = std::collections::HashMap::new();
    files.insert(GIST_FILENAME.to_string(), GistFileContent { content });

    let request = CreateGistRequest {
        description: "Cortex IDE Settings Sync".to_string(),
        public: false,
        files,
    };

    let response = client
        .post(format!("{}/gists", GITHUB_API_URL))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "cortex-desktop")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to create gist: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to create gist: {} {}", status, body));
    }

    let gist: GistResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse gist response: {}", e))?;

    info!("Created gist: {}", gist.id);
    Ok(gist.id)
}

/// Update an existing GitHub Gist with new sync data
pub async fn update_gist(token: &str, gist_id: &str, bundle: &SyncBundle) -> Result<(), String> {
    let client = Client::new();
    let content = serde_json::to_string_pretty(bundle)
        .map_err(|e| format!("Failed to serialize bundle: {}", e))?;

    let mut files = std::collections::HashMap::new();
    files.insert(GIST_FILENAME.to_string(), GistFileContent { content });

    let request = UpdateGistRequest { files };

    let response = client
        .patch(format!("{}/gists/{}", GITHUB_API_URL, gist_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "cortex-desktop")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to update gist: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to update gist: {} {}", status, body));
    }

    info!("Updated gist: {}", gist_id);
    Ok(())
}

/// Fetch sync data from a GitHub Gist
pub async fn fetch_gist(token: &str, gist_id: &str) -> Result<Option<SyncBundle>, String> {
    let client = Client::new();

    let response = client
        .get(format!("{}/gists/{}", GITHUB_API_URL, gist_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "cortex-desktop")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch gist: {}", e))?;

    if response.status().as_u16() == 404 {
        warn!("Gist not found: {}", gist_id);
        return Ok(None);
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to fetch gist: {} {}", status, body));
    }

    let gist: GistResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse gist response: {}", e))?;

    let file = match gist.files.get(GIST_FILENAME) {
        Some(f) => f,
        None => {
            warn!("Gist {} does not contain {}", gist_id, GIST_FILENAME);
            return Ok(None);
        }
    };

    let bundle: SyncBundle = serde_json::from_str(&file.content)
        .map_err(|e| format!("Failed to parse sync bundle: {}", e))?;

    Ok(Some(bundle))
}

/// Delete a GitHub Gist
pub async fn delete_gist(token: &str, gist_id: &str) -> Result<(), String> {
    let client = Client::new();

    let response = client
        .delete(format!("{}/gists/{}", GITHUB_API_URL, gist_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "cortex-desktop")
        .send()
        .await
        .map_err(|e| format!("Failed to delete gist: {}", e))?;

    if !response.status().is_success() && response.status().as_u16() != 404 {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to delete gist: {} {}", status, body));
    }

    info!("Deleted gist: {}", gist_id);
    Ok(())
}

/// Validate a GitHub token by fetching user info
pub async fn validate_token(token: &str) -> Result<String, String> {
    let client = Client::new();

    let response = client
        .get(format!("{}/user", GITHUB_API_URL))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "cortex-desktop")
        .send()
        .await
        .map_err(|e| format!("Failed to validate token: {}", e))?;

    if !response.status().is_success() {
        return Err("Invalid GitHub token".to_string());
    }

    #[derive(Deserialize)]
    struct UserResponse {
        login: String,
    }

    let user: UserResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse user response: {}", e))?;

    Ok(user.login)
}
