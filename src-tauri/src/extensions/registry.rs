//! HTTP-based Cortex Plugin Registry client.
//!
//! This module provides a client for interacting with the Cortex Plugin Registry API,
//! including searching, downloading, installing, and checking for updates to plugins.

use std::collections::HashSet;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

use super::state::ExtensionsState;
use super::types::ExtensionSource;
use super::utils::{extract_zip_package, find_extension_root};

// ============================================================================
// Types
// ============================================================================

/// Sort options for registry search.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SortBy {
    #[default]
    Relevance,
    Downloads,
    Rating,
    RecentlyUpdated,
    Name,
}

impl SortBy {
    fn as_str(&self) -> &'static str {
        match self {
            SortBy::Relevance => "relevance",
            SortBy::Downloads => "downloads",
            SortBy::Rating => "rating",
            SortBy::RecentlyUpdated => "recently_updated",
            SortBy::Name => "name",
        }
    }
}

/// A dependency declaration for a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDependency {
    pub name: String,
    pub version_requirement: String,
}

/// A published version of a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryVersion {
    pub version: String,
    pub download_url: String,
    #[serde(default)]
    pub published_at: String,
    #[serde(default)]
    pub min_engine_version: Option<String>,
}

/// A plugin listing from the registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryPlugin {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub rating: f32,
    #[serde(default)]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub repository_url: Option<String>,
    pub download_url: String,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub readme: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<PluginDependency>,
    #[serde(default)]
    pub versions: Vec<RegistryVersion>,
}

/// Search result page from the registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySearchResult {
    pub plugins: Vec<RegistryPlugin>,
    pub total_count: u64,
    pub page: u32,
    pub page_size: u32,
}

/// Information about an available update for an installed plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryUpdateInfo {
    pub name: String,
    pub current_version: String,
    pub available_version: String,
    pub download_url: String,
}

// ============================================================================
// RegistryClient
// ============================================================================

/// Async HTTP client for the Cortex Plugin Registry.
pub struct RegistryClient {
    client: reqwest::Client,
    base_url: String,
}

const DEFAULT_BASE_URL: &str = "https://registry.cortex.ai/api/v1";

impl RegistryClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: DEFAULT_BASE_URL.to_string(),
        }
    }

    pub fn with_base_url(url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: url.trim_end_matches('/').to_string(),
        }
    }

    /// Search the registry for plugins matching a query.
    pub async fn search(
        &self,
        query: &str,
        category: Option<&str>,
        sort_by: Option<&SortBy>,
        page: Option<u32>,
        page_size: Option<u32>,
    ) -> Result<RegistrySearchResult, String> {
        let mut params = vec![("q", query.to_string())];

        if let Some(cat) = category {
            params.push(("category", cat.to_string()));
        }
        if let Some(sort) = sort_by {
            params.push(("sort_by", sort.as_str().to_string()));
        }
        if let Some(p) = page {
            params.push(("page", p.to_string()));
        }
        if let Some(ps) = page_size {
            params.push(("page_size", ps.to_string()));
        }

        let url = format!("{}/plugins/search", self.base_url);
        info!(query = %query, "Searching plugin registry");

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("Failed to search registry: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Registry search failed with status: {}",
                response.status()
            ));
        }

        response
            .json::<RegistrySearchResult>()
            .await
            .map_err(|e| format!("Failed to parse search results: {}", e))
    }

    /// Fetch details for a single plugin by name.
    pub async fn get_plugin(&self, name: &str) -> Result<RegistryPlugin, String> {
        let url = format!("{}/plugins/{}", self.base_url, urlencoding::encode(name));
        info!(plugin = %name, "Fetching plugin details");

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch plugin '{}': {}", name, e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to get plugin '{}' with status: {}",
                name,
                response.status()
            ));
        }

        response
            .json::<RegistryPlugin>()
            .await
            .map_err(|e| format!("Failed to parse plugin details: {}", e))
    }

    /// Fetch all published versions of a plugin.
    pub async fn get_versions(&self, name: &str) -> Result<Vec<RegistryVersion>, String> {
        let url = format!(
            "{}/plugins/{}/versions",
            self.base_url,
            urlencoding::encode(name)
        );
        info!(plugin = %name, "Fetching plugin versions");

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch versions for '{}': {}", name, e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to get versions for '{}' with status: {}",
                name,
                response.status()
            ));
        }

        response
            .json::<Vec<RegistryVersion>>()
            .await
            .map_err(|e| format!("Failed to parse versions: {}", e))
    }

    /// Resolve a specific version matching a version requirement string.
    ///
    /// Supports `"latest"`, `"*"` (returns the first/latest version), or an
    /// exact version string. Strips leading `^` and `~` for basic compatibility.
    pub async fn resolve_version(
        &self,
        name: &str,
        version_req: &str,
    ) -> Result<RegistryVersion, String> {
        let versions = self.get_versions(name).await?;

        if versions.is_empty() {
            return Err(format!("No versions found for plugin '{}'", name));
        }

        if version_req == "*" || version_req == "latest" {
            return versions
                .into_iter()
                .next()
                .ok_or_else(|| format!("No versions available for plugin '{}'", name));
        }

        let trimmed = version_req.trim_start_matches('^').trim_start_matches('~');

        versions
            .into_iter()
            .find(|v| v.version == trimmed || v.version.starts_with(trimmed))
            .ok_or_else(|| {
                format!(
                    "No version matching '{}' found for plugin '{}'",
                    version_req, name
                )
            })
    }

    /// Resolve all transitive dependencies for a plugin version.
    ///
    /// Performs recursive resolution with cycle detection to collect the full
    /// dependency tree.
    pub async fn resolve_dependencies(
        &self,
        name: &str,
        version: &str,
    ) -> Result<Vec<PluginDependency>, String> {
        let mut resolved: Vec<PluginDependency> = Vec::new();
        let mut visited: HashSet<String> = HashSet::new();

        self.collect_dependencies(name, version, &mut resolved, &mut visited)
            .await?;

        Ok(resolved)
    }

    async fn collect_dependencies(
        &self,
        name: &str,
        _version: &str,
        resolved: &mut Vec<PluginDependency>,
        visited: &mut HashSet<String>,
    ) -> Result<(), String> {
        if visited.contains(name) {
            return Ok(());
        }
        visited.insert(name.to_string());

        let plugin = self.get_plugin(name).await?;

        for dep in &plugin.dependencies {
            if !visited.contains(&dep.name) {
                resolved.push(dep.clone());

                Box::pin(self.collect_dependencies(
                    &dep.name,
                    &dep.version_requirement,
                    resolved,
                    visited,
                ))
                .await?;
            }
        }

        Ok(())
    }

    /// Check for available updates given a list of installed `(name, version)` pairs.
    pub async fn check_updates(
        &self,
        installed: Vec<(String, String)>,
    ) -> Result<Vec<RegistryUpdateInfo>, String> {
        info!(count = installed.len(), "Checking for plugin updates");
        let mut updates = Vec::new();

        for (name, current_version) in &installed {
            match self.get_plugin(name).await {
                Ok(plugin) => {
                    if plugin.version != *current_version {
                        updates.push(RegistryUpdateInfo {
                            name: name.clone(),
                            current_version: current_version.clone(),
                            available_version: plugin.version,
                            download_url: plugin.download_url,
                        });
                    }
                }
                Err(e) => {
                    warn!(
                        plugin = %name,
                        error = %e,
                        "Skipping update check for plugin"
                    );
                }
            }
        }

        Ok(updates)
    }

    /// Download a plugin zip to `target_path`.
    pub async fn download_plugin(
        &self,
        name: &str,
        version: &str,
        target_path: &std::path::Path,
    ) -> Result<(), String> {
        let resolved = self.resolve_version(name, version).await?;
        info!(
            plugin = %name,
            version = %resolved.version,
            "Downloading plugin from registry"
        );

        let response = self
            .client
            .get(&resolved.download_url)
            .send()
            .await
            .map_err(|e| format!("Failed to download plugin '{}': {}", name, e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Download of plugin '{}' failed with status: {}",
                name,
                response.status()
            ));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read download response: {}", e))?;

        let target = target_path.to_path_buf();
        let data = bytes.to_vec();
        tokio::task::spawn_blocking(move || {
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            std::fs::write(&target, &data).map_err(|e| format!("Failed to write plugin zip: {}", e))
        })
        .await
        .map_err(|e| format!("Download write task panicked: {}", e))??;

        info!(plugin = %name, version = %version, "Plugin downloaded successfully");
        Ok(())
    }
}

impl Default for RegistryClient {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// RegistryState
// ============================================================================

/// Thread-safe wrapper for [`RegistryClient`] managed as Tauri state.
#[derive(Clone)]
pub struct RegistryState(pub Arc<RegistryClient>);

impl RegistryState {
    pub fn new() -> Self {
        Self(Arc::new(RegistryClient::new()))
    }
}

impl Default for RegistryState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Search the plugin registry.
#[tauri::command]
pub async fn registry_search(
    app: AppHandle,
    query: String,
    category: Option<String>,
    sort_by: Option<SortBy>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<RegistrySearchResult, String> {
    let state = app.state::<RegistryState>();
    state
        .0
        .search(
            &query,
            category.as_deref(),
            sort_by.as_ref(),
            page,
            page_size,
        )
        .await
}

/// Get details for a specific plugin from the registry.
#[tauri::command]
pub async fn registry_get_plugin(app: AppHandle, name: String) -> Result<RegistryPlugin, String> {
    let state = app.state::<RegistryState>();
    state.0.get_plugin(&name).await
}

/// Install a plugin from the registry.
///
/// Downloads the plugin zip, extracts it, and installs it into the extensions
/// directory. Emits an `extension:installed` event on success.
#[tauri::command]
pub async fn registry_install(
    app: AppHandle,
    name: String,
    version: Option<String>,
) -> Result<(), String> {
    let registry = app.state::<RegistryState>();
    let ver = version.as_deref().unwrap_or("latest");

    info!(plugin = %name, version = %ver, "Installing plugin from registry");

    let temp_dir = {
        let n = name.clone();
        tokio::task::spawn_blocking(move || {
            let dir = std::env::temp_dir().join(format!("cortex_registry_{}", n));
            if dir.exists() {
                std::fs::remove_dir_all(&dir)
                    .map_err(|e| format!("Failed to clean temp directory: {}", e))?;
            }
            std::fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create temp directory: {}", e))?;
            Ok::<std::path::PathBuf, String>(dir)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??
    };

    let download_path = temp_dir.join(format!("{}.zip", name));
    registry
        .0
        .download_plugin(&name, ver, &download_path)
        .await?;

    let extract_dir = temp_dir.join("extracted");
    let dl = download_path.clone();
    let ed = extract_dir.clone();
    tokio::task::spawn_blocking(move || extract_zip_package(&dl, &ed))
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

    let ext_root = find_extension_root(&extract_dir)?;

    let extension = {
        let state = app.state::<ExtensionsState>();
        let mut manager = state.0.lock();
        let mut ext = manager.install_extension(&ext_root)?;
        ext.source = ExtensionSource::Marketplace;
        ext
    };

    let td = temp_dir.clone();
    let _ = tokio::task::spawn_blocking(move || std::fs::remove_dir_all(&td)).await;

    let _ = app.emit("extension:installed", &extension);

    info!(plugin = %name, "Plugin installed from registry");
    Ok(())
}

/// Check for updates for all installed extensions.
#[tauri::command]
pub async fn registry_check_updates(app: AppHandle) -> Result<Vec<RegistryUpdateInfo>, String> {
    let installed = {
        let state = app.state::<ExtensionsState>();
        let manager = state.0.lock();
        manager
            .get_extensions()
            .into_iter()
            .map(|ext| (ext.manifest.name, ext.manifest.version))
            .collect::<Vec<(String, String)>>()
    };

    if installed.is_empty() {
        info!("No installed extensions to check for updates");
        return Ok(Vec::new());
    }

    let registry = app.state::<RegistryState>();
    registry.0.check_updates(installed).await
}

/// Check whether automatic extension update checking is enabled.
///
/// Reads the `extensions.autoCheckUpdates` setting from workspace config.
/// Defaults to `true` if the setting is not present.
#[tauri::command]
pub async fn registry_check_updates_enabled(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<crate::extensions::plugin_api::PluginApiState>();
    let enabled = state
        .get_configuration("extensions.autoCheckUpdates")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    Ok(enabled)
}

/// Set whether automatic extension update checking is enabled.
#[tauri::command]
pub async fn set_auto_update_extensions(app: AppHandle, enabled: bool) -> Result<(), String> {
    let state = app.state::<crate::extensions::plugin_api::PluginApiState>();
    let mut config = state
        .workspace_config
        .lock()
        .map_err(|_| "Failed to acquire workspace config lock".to_string())?;

    if let Some(obj) = config.as_object_mut() {
        let extensions = obj
            .entry("extensions")
            .or_insert_with(|| serde_json::json!({}));
        if let Some(ext_obj) = extensions.as_object_mut() {
            ext_obj.insert(
                "autoCheckUpdates".to_string(),
                serde_json::Value::Bool(enabled),
            );
        }
    }

    tracing::info!(enabled = enabled, "Auto-update extensions setting changed");
    Ok(())
}

/// Resolve all transitive dependencies for a plugin.
#[tauri::command]
pub async fn registry_resolve_dependencies(
    app: AppHandle,
    name: String,
    version: String,
) -> Result<Vec<String>, String> {
    let state = app.state::<RegistryState>();
    let deps = state.0.resolve_dependencies(&name, &version).await?;
    Ok(deps.into_iter().map(|d| d.name).collect())
}
