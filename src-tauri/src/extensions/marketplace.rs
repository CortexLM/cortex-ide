//! Extension marketplace integration.
//!
//! This module handles marketplace operations including searching,
//! downloading, and installing extensions from the marketplace.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::io::Write;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

use super::state::ExtensionsState;
use super::types::{Extension, ExtensionSource, MarketplaceExtension};
use super::utils::{extract_zip_package, find_extension_root};

/// Configurable marketplace state holding the registry URL.
#[derive(Clone)]
pub struct MarketplaceState {
    pub registry_url: String,
}

impl Default for MarketplaceState {
    fn default() -> Self {
        Self {
            registry_url: "https://marketplace.cortex.ai/api/v1".to_string(),
        }
    }
}

impl MarketplaceState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_url(url: String) -> Self {
        Self { registry_url: url }
    }
}

/// Result of checking for an extension update.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionUpdateResult {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
}

/// Detailed marketplace extension metadata including dependencies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceExtensionDetail {
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
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub readme: Option<String>,
    #[serde(default)]
    pub changelog: Option<String>,
}

/// Search marketplace extensions via the registry API.
#[tauri::command]
pub async fn search_marketplace(
    app: AppHandle,
    query: String,
    category: Option<String>,
) -> Result<Vec<MarketplaceExtension>, String> {
    let state = app.state::<MarketplaceState>();
    let client = reqwest::Client::new();

    let url = format!("{}/extensions/search", state.registry_url);
    let mut params = vec![("q", query)];
    if let Some(cat) = category {
        params.push(("category", cat));
    }

    let response = client
        .get(&url)
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to search marketplace: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Marketplace search failed with status: {}",
            response.status()
        ));
    }

    response
        .json::<Vec<MarketplaceExtension>>()
        .await
        .map_err(|e| format!("Failed to parse marketplace results: {}", e))
}

/// Get featured marketplace extensions from the registry API.
#[tauri::command]
pub async fn get_featured_extensions(app: AppHandle) -> Result<Vec<MarketplaceExtension>, String> {
    let state = app.state::<MarketplaceState>();
    let client = reqwest::Client::new();

    let url = format!("{}/extensions/featured", state.registry_url);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch featured extensions: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch featured extensions with status: {}",
            response.status()
        ));
    }

    response
        .json::<Vec<MarketplaceExtension>>()
        .await
        .map_err(|e| format!("Failed to parse featured extensions: {}", e))
}

/// Check for available updates for all installed extensions.
#[tauri::command]
pub async fn check_extension_updates(app: AppHandle) -> Result<Vec<ExtensionUpdateResult>, String> {
    let installed = {
        let state = app.state::<ExtensionsState>();
        let manager = state.0.lock();
        manager
            .get_extensions()
            .into_iter()
            .map(|ext| (ext.manifest.name.clone(), ext.manifest.version.clone()))
            .collect::<Vec<(String, String)>>()
    };

    if installed.is_empty() {
        return Ok(Vec::new());
    }

    let marketplace = app.state::<MarketplaceState>();
    let client = reqwest::Client::new();
    let mut updates = Vec::new();

    for (name, current_version) in &installed {
        let url = format!(
            "{}/extensions/{}/latest",
            marketplace.registry_url,
            urlencoding::encode(name)
        );
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                if let Ok(ext) = response.json::<MarketplaceExtension>().await {
                    if ext.version != *current_version {
                        updates.push(ExtensionUpdateResult {
                            name: name.clone(),
                            current_version: current_version.clone(),
                            latest_version: ext.version,
                            download_url: ext.download_url,
                        });
                    }
                }
            }
            Ok(response) => {
                warn!(extension = %name, status = %response.status(), "Failed to check update");
            }
            Err(e) => {
                warn!(extension = %name, error = %e, "Failed to check update");
            }
        }
    }

    info!(count = updates.len(), "Extension update check complete");
    Ok(updates)
}

/// Get available marketplace categories.
#[tauri::command]
pub async fn get_marketplace_categories(app: AppHandle) -> Result<Vec<String>, String> {
    let state = app.state::<MarketplaceState>();
    let client = reqwest::Client::new();
    let url = format!("{}/categories", state.registry_url);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch categories: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch categories with status: {}",
            response.status()
        ));
    }

    response
        .json::<Vec<String>>()
        .await
        .map_err(|e| format!("Failed to parse categories: {}", e))
}

/// Install extension from marketplace
///
/// This downloads the extension from the marketplace, extracts it, and installs it.
/// Supports both .zip packages and direct git repository clones.
#[tauri::command]
pub async fn install_from_marketplace(
    app: AppHandle,
    extension_name: String,
) -> Result<Extension, String> {
    info!("Installing extension from marketplace: {}", extension_name);

    let marketplace = app.state::<MarketplaceState>();
    let client = reqwest::Client::new();
    let url = format!(
        "{}/extensions/{}",
        marketplace.registry_url,
        urlencoding::encode(&extension_name)
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch extension '{}': {}", extension_name, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Extension '{}' not found in marketplace",
            extension_name
        ));
    }

    let ext_info: MarketplaceExtension = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse extension info: {}", e))?;

    // Create a temp directory for download (blocking operation)
    let extension_name_clone = extension_name.clone();
    let temp_dir = tokio::task::spawn_blocking(move || {
        let temp_dir = std::env::temp_dir().join(format!("cortex_ext_{}", extension_name_clone));
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir)
                .map_err(|e| format!("Failed to clean temp directory: {}", e))?;
        }
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
        Ok::<_, String>(temp_dir)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Try to download from repository URL if available (git clone)
    if let Some(repo_url) = &ext_info.repository_url {
        if repo_url.contains("github.com") || repo_url.ends_with(".git") {
            match clone_extension_from_git(repo_url, &temp_dir).await {
                Ok(_) => {
                    info!("Successfully cloned extension from git");
                    // Install from the cloned directory (lock scope limited to avoid holding across await)
                    let extension = {
                        let state = app.state::<ExtensionsState>();
                        let mut manager = state.0.lock();
                        let mut ext = manager.install_extension(&temp_dir)?;
                        ext.source = ExtensionSource::Marketplace;
                        ext
                    };

                    // Clean up temp dir (blocking operation) - lock is released here
                    let temp_dir_clone = temp_dir.clone();
                    let _ =
                        tokio::task::spawn_blocking(move || fs::remove_dir_all(&temp_dir_clone))
                            .await;

                    // Emit event
                    let _ = app.emit("extension:installed", &extension);
                    return Ok(extension);
                }
                Err(e) => {
                    warn!("Git clone failed, trying download URL: {}", e);
                }
            }
        }
    }

    // Fall back to download URL (zip package)
    let download_path = temp_dir.join(format!("{}.zip", extension_name));
    download_extension_package(&ext_info.download_url, &download_path).await?;

    // Extract the zip package
    let extract_dir = temp_dir.join("extracted");
    extract_zip_package(&download_path, &extract_dir)?;

    // Find the extension root (may be in a subdirectory)
    let ext_root = find_extension_root(&extract_dir)?;

    // Install the extension (lock scope limited to avoid holding across await)
    let extension = {
        let state = app.state::<ExtensionsState>();
        let mut manager = state.0.lock();
        let mut ext = manager.install_extension(&ext_root)?;
        ext.source = ExtensionSource::Marketplace;
        ext
    };

    // Clean up temp dir (blocking operation) - lock is released here
    let temp_dir_clone = temp_dir.clone();
    let _ = tokio::task::spawn_blocking(move || fs::remove_dir_all(&temp_dir_clone)).await;

    // Emit event
    let _ = app.emit("extension:installed", &extension);

    info!("Successfully installed extension: {}", extension_name);
    Ok(extension)
}

/// Resolve extension dependencies using topological sort.
///
/// Returns an ordered list of extension names that should be installed
/// before the target extension, with dependencies first.
pub async fn resolve_extension_dependencies(
    app: &AppHandle,
    extension_name: &str,
) -> Result<Vec<String>, String> {
    let state = app.state::<MarketplaceState>();
    let client = reqwest::Client::new();

    let mut graph: HashMap<String, Vec<String>> = HashMap::new();
    let mut to_visit = vec![extension_name.to_string()];
    let mut visited = HashSet::new();

    while let Some(name) = to_visit.pop() {
        if visited.contains(&name) {
            continue;
        }
        visited.insert(name.clone());

        let url = format!(
            "{}/extensions/{}",
            state.registry_url,
            urlencoding::encode(&name)
        );
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch extension '{}': {}", name, e))?;

        if !response.status().is_success() {
            return Err(format!("Extension '{}' not found in marketplace", name));
        }

        let ext = response
            .json::<MarketplaceExtensionDetail>()
            .await
            .map_err(|e| format!("Failed to parse extension '{}': {}", name, e))?;

        let deps: Vec<String> = ext.dependencies.to_vec();
        for dep in &deps {
            if !visited.contains(dep) {
                to_visit.push(dep.clone());
            }
        }
        graph.insert(name, deps);
    }

    // Topological sort (Kahn's algorithm)
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    for node in graph.keys() {
        in_degree.entry(node.clone()).or_insert(0);
    }
    for deps in graph.values() {
        for dep in deps {
            *in_degree.entry(dep.clone()).or_insert(0) += 1;
        }
    }

    let mut queue: VecDeque<String> = in_degree
        .iter()
        .filter(|(_, deg)| **deg == 0)
        .map(|(name, _)| name.clone())
        .collect();

    let mut sorted = Vec::new();
    while let Some(node) = queue.pop_front() {
        sorted.push(node.clone());
        if let Some(deps) = graph.get(&node) {
            for dep in deps {
                if let Some(deg) = in_degree.get_mut(dep) {
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push_back(dep.clone());
                    }
                }
            }
        }
    }

    if sorted.len() != graph.len() {
        return Err("Circular dependency detected in extension dependencies".to_string());
    }

    // Reverse so dependencies come first, remove the target extension itself
    sorted.reverse();
    sorted.retain(|n| n != extension_name);
    Ok(sorted)
}

/// Clone an extension from a git repository
async fn clone_extension_from_git(
    repo_url: &str,
    target_dir: &std::path::Path,
) -> Result<(), String> {
    let repo_url = repo_url.to_string();
    let target_dir = target_dir.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let output = crate::process_utils::command("git")
            .args([
                "clone",
                "--depth",
                "1",
                &repo_url,
                &target_dir.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git clone failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Download an extension package from a URL
async fn download_extension_package(
    url: &str,
    target_path: &std::path::Path,
) -> Result<(), String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to download extension: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let mut file =
        fs::File::create(target_path).map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Parsed metadata from a VSIX package.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VsixManifest {
    pub id: String,
    pub version: String,
    pub display_name: String,
    pub description: String,
    pub publisher: String,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub icon_path: Option<String>,
}

/// Parse the package.json from a VSIX zip file to extract extension metadata.
///
/// VSIX files are zip archives containing an `extension/package.json` manifest.
/// This function reads the zip, finds the package.json, and extracts key fields.
fn parse_vsix_manifest(vsix_path: &std::path::Path) -> Result<VsixManifest, String> {
    let file = fs::File::open(vsix_path).map_err(|e| format!("Failed to open VSIX file: {}", e))?;

    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read VSIX archive: {}", e))?;

    // Look for extension/package.json or package.json
    let package_json_name = (0..archive.len())
        .filter_map(|i| {
            let entry = archive.by_index(i).ok()?;
            let name = entry.name().to_string();
            if name.ends_with("package.json")
                && (name == "package.json"
                    || name == "extension/package.json"
                    || name.ends_with("/package.json"))
            {
                Some(name)
            } else {
                None
            }
        })
        .min_by_key(|name| name.matches('/').count())
        .ok_or_else(|| "No package.json found in VSIX archive".to_string())?;

    let mut entry = archive
        .by_name(&package_json_name)
        .map_err(|e| format!("Failed to read package.json from VSIX: {}", e))?;

    let mut content = String::new();
    std::io::Read::read_to_string(&mut entry, &mut content)
        .map_err(|e| format!("Failed to read package.json content: {}", e))?;

    let pkg: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse package.json: {}", e))?;

    let publisher = pkg
        .get("publisher")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let name = pkg
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let id = format!("{}.{}", publisher, name);

    Ok(VsixManifest {
        id,
        version: pkg
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("0.0.0")
            .to_string(),
        display_name: pkg
            .get("displayName")
            .and_then(|v| v.as_str())
            .unwrap_or(&name)
            .to_string(),
        description: pkg
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        publisher,
        categories: pkg
            .get("categories")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default(),
        icon_path: pkg.get("icon").and_then(|v| v.as_str()).map(String::from),
    })
}

/// Install an extension from a local VSIX file.
///
/// VSIX files are VS Code extension packages (zip archives). This command
/// extracts the package, parses its manifest, and installs it into the
/// extensions directory.
#[tauri::command]
pub async fn install_from_vsix(app: AppHandle, vsix_path: String) -> Result<Extension, String> {
    info!("Installing extension from VSIX: {}", vsix_path);

    let path = std::path::PathBuf::from(&vsix_path);
    if !path.exists() {
        return Err(format!("VSIX file not found: {}", vsix_path));
    }

    // Parse manifest first to validate
    let vsix_manifest = {
        let p = path.clone();
        tokio::task::spawn_blocking(move || parse_vsix_manifest(&p))
            .await
            .map_err(|e| format!("Task join error: {}", e))??
    };

    info!(
        "VSIX manifest parsed: {} v{}",
        vsix_manifest.display_name, vsix_manifest.version
    );

    // Create temp directory for extraction
    let temp_dir = {
        let id = vsix_manifest.id.clone();
        tokio::task::spawn_blocking(move || {
            let dir = std::env::temp_dir().join(format!("cortex_vsix_{}", id));
            if dir.exists() {
                fs::remove_dir_all(&dir)
                    .map_err(|e| format!("Failed to clean temp directory: {}", e))?;
            }
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create temp directory: {}", e))?;
            Ok::<_, String>(dir)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??
    };

    // Extract the VSIX
    let extract_dir = temp_dir.join("extracted");
    {
        let vp = path.clone();
        let ed = extract_dir.clone();
        tokio::task::spawn_blocking(move || super::utils::extract_zip_package(&vp, &ed))
            .await
            .map_err(|e| format!("Task join error: {}", e))??;
    }

    // Find the extension root (VSIX typically has extension/ subdirectory)
    let ext_root = {
        let ed = extract_dir.clone();
        tokio::task::spawn_blocking(move || {
            // Check for extension/ subdirectory first (standard VSIX layout)
            let extension_subdir = ed.join("extension");
            if extension_subdir.join("extension.json").exists() {
                return Ok(extension_subdir);
            }
            if extension_subdir.join("package.json").exists() {
                return Ok(extension_subdir);
            }
            super::utils::find_extension_root(&ed)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??
    };

    // If only package.json exists (no extension.json), create extension.json from it
    if !ext_root.join("extension.json").exists() && ext_root.join("package.json").exists() {
        let root = ext_root.clone();
        tokio::task::spawn_blocking(move || {
            let pkg_content = fs::read_to_string(root.join("package.json"))
                .map_err(|e| format!("Failed to read package.json: {}", e))?;
            let pkg: serde_json::Value = serde_json::from_str(&pkg_content)
                .map_err(|e| format!("Failed to parse package.json: {}", e))?;

            let manifest = serde_json::json!({
                "name": pkg.get("name").and_then(|v| v.as_str()).unwrap_or("unknown"),
                "version": pkg.get("version").and_then(|v| v.as_str()).unwrap_or("0.0.0"),
                "description": pkg.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                "author": pkg.get("publisher").and_then(|v| v.as_str()).unwrap_or("unknown"),
                "main": pkg.get("main"),
                "activationEvents": pkg.get("activationEvents").unwrap_or(&serde_json::json!([])),
                "contributes": pkg.get("contributes").unwrap_or(&serde_json::json!({})),
            });

            fs::write(
                root.join("extension.json"),
                serde_json::to_string_pretty(&manifest)
                    .map_err(|e| format!("Failed to serialize manifest: {}", e))?,
            )
            .map_err(|e| format!("Failed to write extension.json: {}", e))
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;
    }

    // Install the extension
    let extension = {
        let state = app.state::<ExtensionsState>();
        let mut manager = state.0.lock();
        let mut ext = manager.install_extension(&ext_root)?;
        ext.source = ExtensionSource::Marketplace;
        ext
    };

    // Clean up temp dir
    let td = temp_dir.clone();
    let _ = tokio::task::spawn_blocking(move || fs::remove_dir_all(&td)).await;

    // Emit event
    let _ = app.emit("extension:installed", &extension);

    info!(
        "Successfully installed VSIX extension: {}",
        vsix_manifest.display_name
    );
    Ok(extension)
}

// ============================================================================
// Registry Types
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
