//! Extension type definitions and manifest schemas.
//!
//! This module contains all the data structures used to represent extensions,
//! their manifests, and their contributions.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Extension manifest schema - defines the structure of extension.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    /// Unique identifier for the extension
    pub name: String,
    /// Semantic version string
    pub version: String,
    /// Human-readable description
    pub description: String,
    /// Extension author
    pub author: String,
    /// Main entry point (JavaScript file for legacy extensions)
    #[serde(default)]
    pub main: Option<String>,
    /// WASM entry point (compiled .wasm file)
    #[serde(default)]
    pub wasm: Option<String>,
    /// WIT world name for the WASM module
    #[serde(default)]
    pub wit_world: Option<String>,
    /// Extension contributions
    #[serde(default)]
    pub contributes: ExtensionContributes,
    /// Extension icon path (relative to extension directory)
    #[serde(default)]
    pub icon: Option<String>,
    /// Extension repository URL
    #[serde(default)]
    pub repository: Option<String>,
    /// Minimum Cortex Desktop version required
    #[serde(default)]
    pub engines: Option<EngineRequirements>,
    /// Extension keywords for search
    #[serde(default)]
    pub keywords: Vec<String>,
    /// Extension license
    #[serde(default)]
    pub license: Option<String>,
    /// Activation events that trigger extension loading
    #[serde(default, rename = "activationEvents")]
    pub activation_events: Vec<String>,
    /// Extension dependencies (name -> version requirement)
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    /// Declared permissions the extension requires
    #[serde(default)]
    pub permissions: Vec<String>,
}

/// Engine requirements for compatibility checking
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[allow(non_snake_case)]
pub struct EngineRequirements {
    /// Minimum Cortex Desktop version
    #[serde(default)]
    pub Cortex: Option<String>,
}

/// Extension contributions - what the extension provides
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtensionContributes {
    /// Theme contributions
    #[serde(default)]
    pub themes: Vec<ThemeContribution>,
    /// Language contributions (syntax highlighting)
    #[serde(default)]
    pub languages: Vec<LanguageContribution>,
    /// Command contributions
    #[serde(default)]
    pub commands: Vec<CommandContribution>,
    /// Panel contributions
    #[serde(default)]
    pub panels: Vec<PanelContribution>,
    /// Settings contributions
    #[serde(default)]
    pub settings: Vec<SettingsContribution>,
    /// Keybinding contributions
    #[serde(default)]
    pub keybindings: Vec<KeybindingContribution>,
    /// Snippet contributions
    #[serde(default)]
    pub snippets: Vec<SnippetContribution>,
    /// Debugger contributions
    #[serde(default)]
    pub debuggers: Vec<DebuggerContribution>,
    /// Tree view contributions
    #[serde(default, rename = "treeViews")]
    pub tree_views: Vec<TreeViewContribution>,
    /// Status bar item contributions
    #[serde(default, rename = "statusBarItems")]
    pub status_bar_items: Vec<StatusBarItemContribution>,
    /// Menu contributions
    #[serde(default)]
    pub menus: Vec<MenuContribution>,
    /// View container contributions
    #[serde(default, rename = "viewsContainers")]
    pub views_containers: Vec<ViewContainerContribution>,
    /// View contributions
    #[serde(default)]
    pub views: Vec<ViewContribution>,
    /// Configuration contributions
    #[serde(default)]
    pub configuration: Vec<ConfigurationContribution>,
    /// Grammar contributions
    #[serde(default)]
    pub grammars: Vec<GrammarContribution>,
}

/// Theme contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
    /// Theme identifier
    pub id: String,
    /// Display label
    pub label: String,
    /// Path to theme JSON file
    pub path: String,
    /// UI theme type: "dark" or "light"
    #[serde(rename = "uiTheme", default = "default_ui_theme")]
    pub ui_theme: String,
}

fn default_ui_theme() -> String {
    "dark".to_string()
}

/// Language contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageContribution {
    /// Language identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// File extensions associated with this language
    #[serde(default)]
    pub extensions: Vec<String>,
    /// File aliases
    #[serde(default)]
    pub aliases: Vec<String>,
    /// Path to TextMate grammar file
    #[serde(default)]
    pub grammar: Option<String>,
    /// Path to language configuration file
    #[serde(default)]
    pub configuration: Option<String>,
    /// MIME types
    #[serde(rename = "mimetypes", default)]
    pub mime_types: Vec<String>,
}

/// Command contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    /// Command identifier
    pub command: String,
    /// Display title
    pub title: String,
    /// Category for grouping
    #[serde(default)]
    pub category: Option<String>,
    /// Icon path or icon identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Enablement condition
    #[serde(default)]
    pub enablement: Option<String>,
}

/// Panel contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelContribution {
    /// Panel identifier
    pub id: String,
    /// Display title
    pub title: String,
    /// Icon path or identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Panel location: "left", "right", "bottom"
    #[serde(default = "default_panel_location")]
    pub location: String,
    /// Path to panel component
    #[serde(default)]
    pub component: Option<String>,
}

fn default_panel_location() -> String {
    "left".to_string()
}

/// Settings contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsContribution {
    /// Settings group title
    pub title: String,
    /// Settings properties
    pub properties: HashMap<String, SettingsProperty>,
}

/// Individual setting property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsProperty {
    /// Setting type: "string", "boolean", "number", "array", "object"
    #[serde(rename = "type")]
    pub property_type: String,
    /// Default value
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    /// Setting description
    #[serde(default)]
    pub description: Option<String>,
    /// Enum values (for dropdown)
    #[serde(rename = "enum", default)]
    pub enum_values: Option<Vec<serde_json::Value>>,
    /// Enum descriptions
    #[serde(rename = "enumDescriptions", default)]
    pub enum_descriptions: Option<Vec<String>>,
}

/// Keybinding contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
    /// Associated command
    pub command: String,
    /// Key combination
    pub key: String,
    /// macOS key combination override
    #[serde(default)]
    pub mac: Option<String>,
    /// When condition
    #[serde(default)]
    pub when: Option<String>,
}

/// Snippet contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetContribution {
    /// Language scope
    pub language: String,
    /// Path to snippets file
    pub path: String,
}

/// Debugger contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebuggerContribution {
    /// Debugger type identifier
    #[serde(rename = "type")]
    pub type_name: String,
    /// Display label
    pub label: String,
    /// Path to debug adapter program
    #[serde(default)]
    pub program: Option<String>,
    /// Runtime for the debug adapter (e.g. "node")
    #[serde(default)]
    pub runtime: Option<String>,
    /// Languages supported by this debugger
    #[serde(default)]
    pub languages: Vec<String>,
}

/// Tree view contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeViewContribution {
    /// Tree view identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Icon path or identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Tree view location: "left", "right", "bottom"
    #[serde(default = "default_tree_view_location")]
    pub location: String,
    /// Visibility condition
    #[serde(default)]
    pub when: Option<String>,
}

fn default_tree_view_location() -> String {
    "left".to_string()
}

/// Status bar item contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusBarItemContribution {
    /// Status bar item identifier
    pub id: String,
    /// Display text
    pub text: String,
    /// Alignment: "left" or "right"
    #[serde(default = "default_status_bar_alignment")]
    pub alignment: String,
    /// Sort priority
    #[serde(default)]
    pub priority: Option<u32>,
    /// Command to execute on click
    #[serde(default)]
    pub command: Option<String>,
    /// Tooltip text
    #[serde(default)]
    pub tooltip: Option<String>,
}

fn default_status_bar_alignment() -> String {
    "left".to_string()
}

/// Menu contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuContribution {
    /// Associated command
    pub command: String,
    /// Menu group for ordering
    #[serde(default)]
    pub group: Option<String>,
    /// When condition for visibility
    #[serde(default)]
    pub when: Option<String>,
    /// Menu context (e.g. "editor/context", "editor/title", "explorer/context")
    pub context: String,
}

/// View container contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewContainerContribution {
    /// View container identifier
    pub id: String,
    /// Display title
    pub title: String,
    /// Icon path or identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Container location: "activitybar" or "panel"
    #[serde(default = "default_view_container_location")]
    pub location: String,
}

fn default_view_container_location() -> String {
    "activitybar".to_string()
}

/// View contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewContribution {
    /// View identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Parent view container identifier
    #[serde(rename = "container")]
    pub container_id: String,
    /// When condition for visibility
    #[serde(default)]
    pub when: Option<String>,
    /// Icon path or identifier
    #[serde(default)]
    pub icon: Option<String>,
}

/// Configuration contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationContribution {
    /// Configuration section title
    pub title: String,
    /// Configuration properties
    pub properties: HashMap<String, ConfigurationProperty>,
}

/// Individual configuration property definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationProperty {
    /// Property type: "string", "boolean", "number", "integer", "array", "object"
    #[serde(rename = "type")]
    pub property_type: String,
    /// Default value
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    /// Property description
    #[serde(default)]
    pub description: Option<String>,
    /// Property scope: "window", "resource", "language-overridable"
    #[serde(default)]
    pub scope: Option<String>,
    /// Enum values (for dropdown)
    #[serde(rename = "enum", default)]
    pub enum_values: Option<Vec<serde_json::Value>>,
    /// Enum descriptions
    #[serde(rename = "enumDescriptions", default)]
    pub enum_descriptions: Option<Vec<String>>,
    /// Minimum value for numeric properties
    #[serde(default)]
    pub minimum: Option<f64>,
    /// Maximum value for numeric properties
    #[serde(default)]
    pub maximum: Option<f64>,
    /// Validation pattern for string properties
    #[serde(default)]
    pub pattern: Option<String>,
}

/// Grammar contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarContribution {
    /// Language identifier this grammar applies to
    pub language: String,
    /// TextMate scope name
    #[serde(rename = "scopeName")]
    pub scope_name: String,
    /// Path to grammar file
    pub path: String,
    /// Embedded language mappings (scope -> language id)
    #[serde(rename = "embeddedLanguages", default)]
    pub embedded_languages: Option<HashMap<String, String>>,
    /// Token type mappings
    #[serde(rename = "tokenTypes", default)]
    pub token_types: Option<HashMap<String, String>>,
}

/// Extension runtime state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extension {
    /// Extension manifest
    pub manifest: ExtensionManifest,
    /// Path to extension directory
    pub path: PathBuf,
    /// Whether the extension is enabled
    pub enabled: bool,
    /// Installation source
    #[serde(default)]
    pub source: ExtensionSource,
}

/// Extension installation source
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ExtensionSource {
    #[default]
    Local,
    Marketplace,
    Git,
}

/// Theme definition loaded from extension
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionTheme {
    /// Theme identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Extension that provides this theme
    pub extension_name: String,
    /// Theme type
    pub ui_theme: String,
    /// Theme colors and tokens
    pub colors: serde_json::Value,
}

/// Marketplace extension listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceExtension {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub rating: f32,
    pub icon_url: Option<String>,
    pub repository_url: Option<String>,
    pub download_url: String,
    pub categories: Vec<String>,
    pub updated_at: String,
}

/// Activation event definition for typed event handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivationEventDef {
    OnStartupFinished,
    OnLanguage { language: String },
    OnCommand { command: String },
    OnFileSystem { scheme: String },
    OnFileOpen { pattern: String },
    WorkspaceContains { pattern: String },
    OnView { view_id: String },
    OnDebug,
    OnUri { scheme: String },
    Star,
}

/// Validation error for manifest fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestValidationError {
    pub field: String,
    pub message: String,
}

/// Validates an extension manifest and returns collected errors.
///
/// Checks required fields, format constraints, and contribution validity.
pub fn validate_manifest(manifest: &ExtensionManifest) -> Result<(), Vec<ManifestValidationError>> {
    let mut errors: Vec<ManifestValidationError> = Vec::new();

    #[allow(clippy::unwrap_used)]
    let name_re = Regex::new(r"^[a-zA-Z0-9._-]+$").unwrap();
    if manifest.name.is_empty() {
        errors.push(ManifestValidationError {
            field: "name".to_string(),
            message: "name must not be empty".to_string(),
        });
    } else if !name_re.is_match(&manifest.name) {
        errors.push(ManifestValidationError {
            field: "name".to_string(),
            message: "name must contain only alphanumeric characters, dashes, underscores, or dots"
                .to_string(),
        });
    }

    #[allow(clippy::unwrap_used)]
    let version_re = Regex::new(r"^\d+\.\d+\.\d+$").unwrap();
    if !version_re.is_match(&manifest.version) {
        errors.push(ManifestValidationError {
            field: "version".to_string(),
            message: "version must match semver format X.Y.Z".to_string(),
        });
    }

    if manifest.description.is_empty() {
        errors.push(ManifestValidationError {
            field: "description".to_string(),
            message: "description must not be empty".to_string(),
        });
    }

    if manifest.author.is_empty() {
        errors.push(ManifestValidationError {
            field: "author".to_string(),
            message: "author must not be empty".to_string(),
        });
    }

    let valid_prefixes = [
        "onStartupFinished",
        "onLanguage:",
        "onCommand:",
        "onFileSystem:",
        "onFileOpen:",
        "workspaceContains:",
        "onView:",
        "onDebug",
        "onDebug:",
        "onUri:",
        "*",
    ];
    for (i, event) in manifest.activation_events.iter().enumerate() {
        let is_valid = valid_prefixes.iter().any(|prefix| {
            if *prefix == "*" {
                event == "*"
            } else if prefix.ends_with(':') {
                event.starts_with(prefix)
            } else {
                event == *prefix
            }
        });
        if !is_valid {
            errors.push(ManifestValidationError {
                field: format!("activationEvents[{}]", i),
                message: format!("invalid activation event: {}", event),
            });
        }
    }

    if let Some(ref wasm_path) = manifest.wasm {
        if !wasm_path.ends_with(".wasm") {
            errors.push(ManifestValidationError {
                field: "wasm".to_string(),
                message: "wasm entry point must end with .wasm".to_string(),
            });
        }
    }

    for (i, cmd) in manifest.contributes.commands.iter().enumerate() {
        if cmd.command.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.commands[{}].command", i),
                message: "command identifier must not be empty".to_string(),
            });
        }
        if cmd.title.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.commands[{}].title", i),
                message: "command title must not be empty".to_string(),
            });
        }
    }

    for (i, panel) in manifest.contributes.panels.iter().enumerate() {
        if panel.id.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.panels[{}].id", i),
                message: "panel id must not be empty".to_string(),
            });
        }
        if panel.title.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.panels[{}].title", i),
                message: "panel title must not be empty".to_string(),
            });
        }
    }

    for (i, debugger) in manifest.contributes.debuggers.iter().enumerate() {
        if debugger.type_name.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.debuggers[{}].type", i),
                message: "debugger type must not be empty".to_string(),
            });
        }
        if debugger.label.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.debuggers[{}].label", i),
                message: "debugger label must not be empty".to_string(),
            });
        }
    }

    for (i, tree_view) in manifest.contributes.tree_views.iter().enumerate() {
        if tree_view.id.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.treeViews[{}].id", i),
                message: "tree view id must not be empty".to_string(),
            });
        }
        if tree_view.name.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.treeViews[{}].name", i),
                message: "tree view name must not be empty".to_string(),
            });
        }
    }

    for (i, item) in manifest.contributes.status_bar_items.iter().enumerate() {
        if item.id.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.statusBarItems[{}].id", i),
                message: "status bar item id must not be empty".to_string(),
            });
        }
        if item.text.is_empty() {
            errors.push(ManifestValidationError {
                field: format!("contributes.statusBarItems[{}].text", i),
                message: "status bar item text must not be empty".to_string(),
            });
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Parses a raw activation event string into a typed `ActivationEventDef`.
///
/// Returns `None` if the string does not match any known event format.
pub fn parse_activation_event(raw: &str) -> Option<ActivationEventDef> {
    if raw == "onStartupFinished" {
        Some(ActivationEventDef::OnStartupFinished)
    } else if let Some(lang) = raw.strip_prefix("onLanguage:") {
        Some(ActivationEventDef::OnLanguage {
            language: lang.to_string(),
        })
    } else if let Some(cmd) = raw.strip_prefix("onCommand:") {
        Some(ActivationEventDef::OnCommand {
            command: cmd.to_string(),
        })
    } else if let Some(pattern) = raw.strip_prefix("onFileOpen:") {
        Some(ActivationEventDef::OnFileOpen {
            pattern: pattern.to_string(),
        })
    } else if let Some(pattern) = raw.strip_prefix("workspaceContains:") {
        Some(ActivationEventDef::WorkspaceContains {
            pattern: pattern.to_string(),
        })
    } else if let Some(view) = raw.strip_prefix("onView:") {
        Some(ActivationEventDef::OnView {
            view_id: view.to_string(),
        })
    } else if let Some(scheme) = raw.strip_prefix("onFileSystem:") {
        Some(ActivationEventDef::OnFileSystem {
            scheme: scheme.to_string(),
        })
    } else if let Some(scheme) = raw.strip_prefix("onUri:") {
        Some(ActivationEventDef::OnUri {
            scheme: scheme.to_string(),
        })
    } else if raw == "onDebug" {
        Some(ActivationEventDef::OnDebug)
    } else if raw == "*" {
        Some(ActivationEventDef::Star)
    } else {
        None
    }
}
