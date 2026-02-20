//! VS Code extension manifest (package.json) parser.
//!
//! Parses the `package.json` format used by VS Code extensions, including
//! activation events and the full `contributes` section.  This is separate
//! from the Cortex-native `ExtensionManifest` in `extensions::types` which
//! targets the WASM plugin format.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tracing::warn;

// ============================================================================
// Top-level manifest
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeManifest {
    pub name: String,

    #[serde(default)]
    pub display_name: Option<String>,

    #[serde(default)]
    pub description: Option<String>,

    pub version: String,

    #[serde(default)]
    pub publisher: Option<String>,

    #[serde(default)]
    pub engines: Option<VscodeEngines>,

    #[serde(default)]
    pub main: Option<String>,

    #[serde(default)]
    pub browser: Option<String>,

    #[serde(default)]
    pub activation_events: Vec<String>,

    #[serde(default)]
    pub contributes: Option<VscodeContributes>,

    #[serde(default)]
    pub categories: Vec<String>,

    #[serde(default)]
    pub keywords: Vec<String>,

    #[serde(default)]
    pub icon: Option<String>,

    #[serde(default)]
    pub license: Option<String>,

    #[serde(default)]
    pub repository: Option<serde_json::Value>,

    #[serde(default)]
    pub extension_kind: Option<Vec<String>>,

    #[serde(default)]
    pub extension_dependencies: Vec<String>,

    #[serde(default)]
    pub extension_pack: Vec<String>,

    #[serde(default)]
    pub capabilities: Option<VscodeCapabilities>,
}

impl VscodeManifest {
    pub fn extension_id(&self) -> String {
        match &self.publisher {
            Some(publisher) => format!("{}.{}", publisher, self.name),
            None => self.name.clone(),
        }
    }

    pub fn parsed_activation_events(&self) -> Vec<VscodeActivationEvent> {
        self.activation_events
            .iter()
            .filter_map(|raw| parse_activation_event(raw))
            .collect()
    }
}

// ============================================================================
// Engines
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VscodeEngines {
    #[serde(default)]
    pub vscode: Option<String>,
    #[serde(default)]
    pub node: Option<String>,
}

// ============================================================================
// Capabilities
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeCapabilities {
    #[serde(default)]
    pub virtual_workspaces: Option<serde_json::Value>,
    #[serde(default)]
    pub untrusted_workspaces: Option<serde_json::Value>,
}

// ============================================================================
// Contributes
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VscodeContributes {
    #[serde(default)]
    pub commands: Vec<VscodeCommandContribution>,

    #[serde(default)]
    pub menus: Option<HashMap<String, Vec<VscodeMenuContribution>>>,

    #[serde(default)]
    pub views: Option<HashMap<String, Vec<VscodeViewContribution>>>,

    #[serde(default)]
    pub views_containers: Option<VscodeViewsContainers>,

    #[serde(default)]
    pub configuration: Option<serde_json::Value>,

    #[serde(default)]
    pub languages: Vec<VscodeLanguageContribution>,

    #[serde(default)]
    pub grammars: Vec<VscodeGrammarContribution>,

    #[serde(default)]
    pub themes: Vec<VscodeThemeContribution>,

    #[serde(default)]
    pub icon_themes: Vec<VscodeIconThemeContribution>,

    #[serde(default)]
    pub snippets: Vec<VscodeSnippetContribution>,

    #[serde(default)]
    pub keybindings: Vec<VscodeKeybindingContribution>,

    #[serde(default)]
    pub debuggers: Vec<VscodeDebuggerContribution>,

    #[serde(default)]
    pub task_definitions: Vec<VscodeTaskDefinition>,

    #[serde(default)]
    pub problem_matchers: Vec<serde_json::Value>,

    #[serde(default)]
    pub problem_patterns: Vec<serde_json::Value>,

    #[serde(default)]
    pub colors: Vec<serde_json::Value>,

    #[serde(default)]
    pub terminal_profiles: Vec<serde_json::Value>,

    #[serde(default)]
    pub walkthroughs: Vec<serde_json::Value>,

    #[serde(default)]
    pub custom_editors: Vec<serde_json::Value>,

    #[serde(default)]
    pub notebooks: Vec<serde_json::Value>,

    #[serde(default)]
    pub notebook_renderer: Vec<serde_json::Value>,

    #[serde(default)]
    pub authentication: Vec<serde_json::Value>,
}

// ============================================================================
// Command contribution
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeCommandContribution {
    pub command: String,
    pub title: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub icon: Option<serde_json::Value>,
    #[serde(default)]
    pub enablement: Option<String>,
}

// ============================================================================
// Menu contribution
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeMenuContribution {
    pub command: Option<String>,
    #[serde(default)]
    pub submenu: Option<String>,
    #[serde(default)]
    pub when: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
}

// ============================================================================
// View contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeViewContribution {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub when: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub context_value: Option<String>,
    #[serde(rename = "type", default)]
    pub view_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeViewsContainers {
    #[serde(default)]
    pub activitybar: Vec<VscodeViewContainerContribution>,
    #[serde(default)]
    pub panel: Vec<VscodeViewContainerContribution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeViewContainerContribution {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub icon: Option<String>,
}

// ============================================================================
// Language & grammar contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeLanguageContribution {
    pub id: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub extensions: Vec<String>,
    #[serde(default)]
    pub filenames: Vec<String>,
    #[serde(default)]
    pub filename_patterns: Vec<String>,
    #[serde(default)]
    pub first_line: Option<String>,
    #[serde(default)]
    pub configuration: Option<String>,
    #[serde(default)]
    pub icon: Option<serde_json::Value>,
    #[serde(default)]
    pub mimetypes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeGrammarContribution {
    #[serde(default)]
    pub language: Option<String>,
    pub scope_name: String,
    pub path: String,
    #[serde(default)]
    pub embedded_languages: Option<HashMap<String, String>>,
    #[serde(default)]
    pub token_types: Option<HashMap<String, String>>,
    #[serde(default)]
    pub injection_selector: Option<String>,
}

// ============================================================================
// Theme contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeThemeContribution {
    #[serde(default)]
    pub id: Option<String>,
    pub label: String,
    #[serde(default)]
    pub ui_theme: Option<String>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeIconThemeContribution {
    pub id: String,
    pub label: String,
    pub path: String,
}

// ============================================================================
// Snippet contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeSnippetContribution {
    #[serde(default)]
    pub language: Option<String>,
    pub path: String,
}

// ============================================================================
// Keybinding contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeKeybindingContribution {
    pub command: String,
    pub key: String,
    #[serde(default)]
    pub mac: Option<String>,
    #[serde(default)]
    pub linux: Option<String>,
    #[serde(default)]
    pub win: Option<String>,
    #[serde(default)]
    pub when: Option<String>,
}

// ============================================================================
// Debugger contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeDebuggerContribution {
    #[serde(rename = "type")]
    pub debug_type: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub program: Option<String>,
    #[serde(default)]
    pub runtime: Option<String>,
    #[serde(default)]
    pub languages: Vec<String>,
    #[serde(default)]
    pub configuration_attributes: Option<serde_json::Value>,
    #[serde(default)]
    pub initial_configurations: Vec<serde_json::Value>,
    #[serde(default)]
    pub configuration_snippets: Vec<serde_json::Value>,
}

// ============================================================================
// Task definition contributions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeTaskDefinition {
    #[serde(rename = "type")]
    pub task_type: String,
    #[serde(default)]
    pub required: Vec<String>,
    #[serde(default)]
    pub properties: Option<HashMap<String, serde_json::Value>>,
    #[serde(default)]
    pub when: Option<String>,
}

// ============================================================================
// Activation events
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "value")]
pub enum VscodeActivationEvent {
    OnStartupFinished,
    OnLanguage(String),
    OnCommand(String),
    OnDebug,
    OnDebugAdapterProtocolTracker(String),
    OnDebugInitialConfigurations,
    OnDebugDynamicConfigurations(String),
    OnDebugResolve(String),
    OnFileSystem(String),
    WorkspaceContains(String),
    OnView(String),
    OnUri,
    OnWebviewPanel(String),
    OnCustomEditor(String),
    OnAuthenticationRequest(String),
    OnNotebook(String),
    OnTaskType(String),
    OnWalkthrough(String),
    OnEditSession(String),
    Star,
}

pub fn parse_activation_event(raw: &str) -> Option<VscodeActivationEvent> {
    if raw == "*" {
        return Some(VscodeActivationEvent::Star);
    }
    if raw == "onStartupFinished" {
        return Some(VscodeActivationEvent::OnStartupFinished);
    }
    if raw == "onDebug" {
        return Some(VscodeActivationEvent::OnDebug);
    }
    if raw == "onDebugInitialConfigurations" {
        return Some(VscodeActivationEvent::OnDebugInitialConfigurations);
    }
    if raw == "onUri" {
        return Some(VscodeActivationEvent::OnUri);
    }

    if let Some(val) = raw.strip_prefix("onLanguage:") {
        return Some(VscodeActivationEvent::OnLanguage(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onCommand:") {
        return Some(VscodeActivationEvent::OnCommand(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onDebugAdapterProtocolTracker:") {
        return Some(VscodeActivationEvent::OnDebugAdapterProtocolTracker(
            val.to_string(),
        ));
    }
    if let Some(val) = raw.strip_prefix("onDebugDynamicConfigurations:") {
        return Some(VscodeActivationEvent::OnDebugDynamicConfigurations(
            val.to_string(),
        ));
    }
    if let Some(val) = raw.strip_prefix("onDebugResolve:") {
        return Some(VscodeActivationEvent::OnDebugResolve(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onFileSystem:") {
        return Some(VscodeActivationEvent::OnFileSystem(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("workspaceContains:") {
        return Some(VscodeActivationEvent::WorkspaceContains(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onView:") {
        return Some(VscodeActivationEvent::OnView(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onWebviewPanel:") {
        return Some(VscodeActivationEvent::OnWebviewPanel(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onCustomEditor:") {
        return Some(VscodeActivationEvent::OnCustomEditor(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onAuthenticationRequest:") {
        return Some(VscodeActivationEvent::OnAuthenticationRequest(
            val.to_string(),
        ));
    }
    if let Some(val) = raw.strip_prefix("onNotebook:") {
        return Some(VscodeActivationEvent::OnNotebook(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onTaskType:") {
        return Some(VscodeActivationEvent::OnTaskType(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onWalkthrough:") {
        return Some(VscodeActivationEvent::OnWalkthrough(val.to_string()));
    }
    if let Some(val) = raw.strip_prefix("onEditSession:") {
        return Some(VscodeActivationEvent::OnEditSession(val.to_string()));
    }

    warn!("Unknown VS Code activation event: {}", raw);
    None
}

// ============================================================================
// Parsing
// ============================================================================

pub fn parse_vscode_manifest(json: &str) -> Result<VscodeManifest, String> {
    serde_json::from_str(json).map_err(|e| format!("Failed to parse VS Code manifest: {}", e))
}

pub fn parse_vscode_manifest_file(path: &Path) -> Result<VscodeManifest, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read manifest at {}: {}", path.display(), e))?;
    parse_vscode_manifest(&content)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_activation_events() {
        assert_eq!(
            parse_activation_event("*"),
            Some(VscodeActivationEvent::Star)
        );
        assert_eq!(
            parse_activation_event("onStartupFinished"),
            Some(VscodeActivationEvent::OnStartupFinished)
        );
        assert_eq!(
            parse_activation_event("onLanguage:python"),
            Some(VscodeActivationEvent::OnLanguage("python".to_string()))
        );
        assert_eq!(
            parse_activation_event("onCommand:extension.helloWorld"),
            Some(VscodeActivationEvent::OnCommand(
                "extension.helloWorld".to_string()
            ))
        );
        assert_eq!(
            parse_activation_event("workspaceContains:**/.gitignore"),
            Some(VscodeActivationEvent::WorkspaceContains(
                "**/.gitignore".to_string()
            ))
        );
        assert_eq!(
            parse_activation_event("onView:myTreeView"),
            Some(VscodeActivationEvent::OnView("myTreeView".to_string()))
        );
        assert_eq!(
            parse_activation_event("onDebug"),
            Some(VscodeActivationEvent::OnDebug)
        );
        assert_eq!(
            parse_activation_event("onUri"),
            Some(VscodeActivationEvent::OnUri)
        );
        assert_eq!(parse_activation_event("unknownEvent"), None);
    }

    #[test]
    fn test_parse_minimal_manifest() {
        let json = r#"{
            "name": "test-extension",
            "version": "1.0.0",
            "engines": { "vscode": "^1.80.0" },
            "activationEvents": ["onLanguage:rust"],
            "main": "./out/extension.js",
            "contributes": {
                "commands": [
                    {
                        "command": "test.hello",
                        "title": "Hello World"
                    }
                ]
            }
        }"#;

        let manifest = parse_vscode_manifest(json).unwrap();
        assert_eq!(manifest.name, "test-extension");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.main, Some("./out/extension.js".to_string()));
        assert_eq!(manifest.activation_events, vec!["onLanguage:rust"]);

        let events = manifest.parsed_activation_events();

        let contributes = manifest.contributes.as_ref().unwrap();
        assert_eq!(contributes.commands.len(), 1);
        assert_eq!(contributes.commands[0].command, "test.hello");
        assert_eq!(contributes.commands[0].title, "Hello World");
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0],
            VscodeActivationEvent::OnLanguage("rust".to_string())
        );
    }

    #[test]
    fn test_extension_id() {
        let json = r#"{
            "name": "prettier-vscode",
            "version": "10.0.0",
            "publisher": "esbenp"
        }"#;
        let manifest = parse_vscode_manifest(json).unwrap();
        assert_eq!(manifest.extension_id(), "esbenp.prettier-vscode");
    }
}
