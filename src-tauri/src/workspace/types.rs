//! Workspace types for folder management, launch configurations, and extensions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFolder {
    pub uri: String,
    pub name: Option<String>,
    pub index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub config_type: String,
    pub request: String,
    pub program: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfigurations {
    pub version: String,
    pub configurations: Vec<LaunchConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRecommendations {
    pub recommendations: Vec<String>,
    pub unwanted_recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub folders: Vec<WorkspaceFolder>,
    pub settings: serde_json::Value,
    pub launch: Option<LaunchConfigurations>,
    pub extensions: Option<ExtensionRecommendations>,
}
