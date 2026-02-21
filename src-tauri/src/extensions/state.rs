//! Extension state management.
//!
//! This module contains the ExtensionsState and ExtensionsManager types
//! that handle the runtime state of all loaded extensions.

use parking_lot::Mutex;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{info, warn};

use super::types::{Extension, ExtensionManifest, ExtensionSource};
use super::utils::{copy_dir_recursive, extensions_directory_path};
#[cfg(feature = "wasm-extensions")]
use super::wasm::WasmRuntime;

/// State for managing extensions
#[derive(Clone)]
pub struct ExtensionsState(pub Arc<Mutex<ExtensionsManager>>);

/// Extension manager implementation
pub struct ExtensionsManager {
    /// Loaded extensions
    pub extensions: HashMap<String, Extension>,
    /// Extensions directory path
    pub extensions_dir: PathBuf,
    /// Enabled extensions (persisted)
    pub enabled_extensions: HashMap<String, bool>,
    #[cfg(feature = "wasm-extensions")]
    pub wasm_runtime: WasmRuntime,
}

impl Default for ExtensionsManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ExtensionsManager {
    /// Create a new extensions manager
    pub fn new() -> Self {
        let extensions_dir = extensions_directory_path();
        Self {
            extensions: HashMap::new(),
            extensions_dir,
            enabled_extensions: HashMap::new(),
            #[cfg(feature = "wasm-extensions")]
            wasm_runtime: WasmRuntime::new(),
        }
    }

    /// Load all extensions from the extensions directory
    pub fn load_extensions(&mut self) -> Result<Vec<Extension>, String> {
        // Ensure extensions directory exists
        if !self.extensions_dir.exists() {
            fs::create_dir_all(&self.extensions_dir)
                .map_err(|e| format!("Failed to create extensions directory: {}", e))?;
        }

        // Load enabled state from config
        self.load_enabled_state();

        let mut loaded = Vec::new();

        // Read extensions directory
        let entries = fs::read_dir(&self.extensions_dir)
            .map_err(|e| format!("Failed to read extensions directory: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                match self.load_extension(&path) {
                    Ok(ext) => {
                        info!(
                            "Loaded extension: {} v{}",
                            ext.manifest.name, ext.manifest.version
                        );
                        loaded.push(ext);
                    }
                    Err(e) => {
                        warn!("Failed to load extension from {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(loaded)
    }

    /// Load a single extension from a directory
    pub fn load_extension(&mut self, path: &PathBuf) -> Result<Extension, String> {
        let manifest_path = path.join("extension.json");

        if !manifest_path.exists() {
            return Err(format!("No extension.json found in {:?}", path));
        }

        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read extension.json: {}", e))?;

        let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse extension.json: {}", e))?;

        let enabled = self
            .enabled_extensions
            .get(&manifest.name)
            .copied()
            .unwrap_or(true);

        let extension = Extension {
            manifest: manifest.clone(),
            path: path.clone(),
            enabled,
            source: ExtensionSource::Local,
        };

        self.extensions
            .insert(manifest.name.clone(), extension.clone());

        Ok(extension)
    }

    /// Enable an extension
    pub fn enable_extension(&mut self, name: &str) -> Result<(), String> {
        if let Some(ext) = self.extensions.get_mut(name) {
            ext.enabled = true;
            self.enabled_extensions.insert(name.to_string(), true);
            self.save_enabled_state();
            info!("Enabled extension: {}", name);
            Ok(())
        } else {
            Err(format!("Extension not found: {}", name))
        }
    }

    /// Disable an extension
    pub fn disable_extension(&mut self, name: &str) -> Result<(), String> {
        if let Some(ext) = self.extensions.get_mut(name) {
            ext.enabled = false;
            self.enabled_extensions.insert(name.to_string(), false);
            self.save_enabled_state();
            info!("Disabled extension: {}", name);
            Ok(())
        } else {
            Err(format!("Extension not found: {}", name))
        }
    }

    /// Uninstall an extension
    pub fn uninstall_extension(&mut self, name: &str) -> Result<(), String> {
        #[cfg(feature = "wasm-extensions")]
        {
            let _ = self.wasm_runtime.unload_extension(name);
        }

        if let Some(ext) = self.extensions.remove(name) {
            fs::remove_dir_all(&ext.path)
                .map_err(|e| format!("Failed to remove extension directory: {}", e))?;
            self.enabled_extensions.remove(name);
            self.save_enabled_state();
            info!("Uninstalled extension: {}", name);
            Ok(())
        } else {
            Err(format!("Extension not found: {}", name))
        }
    }

    /// Install an extension from a path (copy to extensions directory)
    pub fn install_extension(&mut self, source_path: &PathBuf) -> Result<Extension, String> {
        // Read the manifest to get the extension name
        let manifest_path = source_path.join("extension.json");
        if !manifest_path.exists() {
            return Err("No extension.json found in source".to_string());
        }

        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read extension.json: {}", e))?;

        let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse extension.json: {}", e))?;

        let target_dir = self.extensions_dir.join(&manifest.name);

        // Remove existing installation if present
        if target_dir.exists() {
            fs::remove_dir_all(&target_dir)
                .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
        }

        // Copy extension to extensions directory
        copy_dir_recursive(source_path, &target_dir)
            .map_err(|e| format!("Failed to copy extension: {}", e))?;

        // Load the newly installed extension
        self.load_extension(&target_dir)
    }

    /// Get all extensions
    pub fn get_extensions(&self) -> Vec<Extension> {
        self.extensions.values().cloned().collect()
    }

    /// Get enabled extensions only
    pub fn get_enabled_extensions(&self) -> Vec<Extension> {
        self.extensions
            .values()
            .filter(|e| e.enabled)
            .cloned()
            .collect()
    }

    /// Get extension by name
    pub fn get_extension(&self, name: &str) -> Option<Extension> {
        self.extensions.get(name).cloned()
    }

    /// Load enabled state from config file
    fn load_enabled_state(&mut self) {
        let config_path = self.extensions_dir.join(".enabled.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(enabled) = serde_json::from_str::<HashMap<String, bool>>(&content) {
                    self.enabled_extensions = enabled;
                }
            }
        }
    }

    /// Save enabled state to config file
    fn save_enabled_state(&self) {
        let config_path = self.extensions_dir.join(".enabled.json");
        if let Ok(content) = serde_json::to_string_pretty(&self.enabled_extensions) {
            let _ = fs::write(&config_path, content);
        }
    }
}
