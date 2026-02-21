//! ACP (Agent Communication Protocol) Tools Module
//!
//! Implements tool registry and execution for AI agent tools.
//! Supports built-in tools, custom tools, and MCP server tools.

pub mod commands;
pub mod executor;
pub mod types;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex as TokioMutex, RwLock};

use types::{ACPTool, ToolExecutionResult, ToolSandboxConfig};

/// State for managing ACP tools
#[derive(Clone)]
pub struct ACPState(pub Arc<TokioMutex<ACPManager>>);

impl ACPState {
    pub fn new() -> Self {
        let mut manager = ACPManager::new();
        manager.register_builtin_tools();
        Self(Arc::new(TokioMutex::new(manager)))
    }
}

/// Manages ACP tool registry and execution
pub struct ACPManager {
    tools: HashMap<String, ACPTool>,
    executions: HashMap<String, Arc<RwLock<ToolExecutionResult>>>,
    sandbox_config: ToolSandboxConfig,
    next_id: u32,
}

impl ACPManager {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
            executions: HashMap::new(),
            sandbox_config: ToolSandboxConfig::default(),
            next_id: 1,
        }
    }

    /// Register built-in tools
    pub fn register_builtin_tools(&mut self) {
        let builtin_tools = vec![
            ACPTool::new_builtin(
                "read_file",
                "Read the contents of a file from the filesystem",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "name": "path",
                            "type": "string",
                            "description": "The file path to read",
                            "required": true
                        },
                        "encoding": {
                            "name": "encoding",
                            "type": "string",
                            "description": "File encoding (default: utf-8)",
                            "default": "utf-8"
                        }
                    },
                    "required": ["path"]
                }),
                vec!["read".into(), "filesystem".into()],
                Some(types::ToolAnnotations {
                    title: None,
                    read_only_hint: Some(true),
                    destructive_hint: None,
                    idempotent_hint: Some(true),
                    open_world_hint: None,
                }),
                "builtin:read-file",
            ),
            ACPTool::new_builtin(
                "write_file",
                "Write content to a file on the filesystem",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "name": "path",
                            "type": "string",
                            "description": "The file path to write to",
                            "required": true
                        },
                        "content": {
                            "name": "content",
                            "type": "string",
                            "description": "The content to write",
                            "required": true
                        },
                        "encoding": {
                            "name": "encoding",
                            "type": "string",
                            "description": "File encoding (default: utf-8)",
                            "default": "utf-8"
                        }
                    },
                    "required": ["path", "content"]
                }),
                vec!["write".into(), "filesystem".into()],
                Some(types::ToolAnnotations {
                    title: None,
                    read_only_hint: None,
                    destructive_hint: Some(true),
                    idempotent_hint: Some(true),
                    open_world_hint: None,
                }),
                "builtin:write-file",
            ),
            ACPTool::new_builtin(
                "list_directory",
                "List files and directories in a given path",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "name": "path",
                            "type": "string",
                            "description": "The directory path to list",
                            "required": true
                        },
                        "recursive": {
                            "name": "recursive",
                            "type": "boolean",
                            "description": "Whether to list recursively",
                            "default": false
                        }
                    },
                    "required": ["path"]
                }),
                vec!["read".into(), "filesystem".into()],
                Some(types::ToolAnnotations {
                    title: None,
                    read_only_hint: Some(true),
                    destructive_hint: None,
                    idempotent_hint: Some(true),
                    open_world_hint: None,
                }),
                "builtin:list-directory",
            ),
            ACPTool::new_builtin(
                "execute_command",
                "Execute a shell command",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": {
                            "name": "command",
                            "type": "string",
                            "description": "The command to execute",
                            "required": true
                        },
                        "args": {
                            "name": "args",
                            "type": "array",
                            "description": "Command arguments"
                        },
                        "cwd": {
                            "name": "cwd",
                            "type": "string",
                            "description": "Working directory for the command"
                        },
                        "timeout": {
                            "name": "timeout",
                            "type": "number",
                            "description": "Timeout in milliseconds",
                            "default": 30000
                        }
                    },
                    "required": ["command"]
                }),
                vec!["execute".into()],
                Some(types::ToolAnnotations {
                    title: None,
                    read_only_hint: None,
                    destructive_hint: Some(true),
                    idempotent_hint: None,
                    open_world_hint: Some(true),
                }),
                "builtin:execute-command",
            ),
            ACPTool::new_builtin(
                "http_request",
                "Make an HTTP request to a URL",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "url": {
                            "name": "url",
                            "type": "string",
                            "description": "The URL to request",
                            "required": true
                        },
                        "method": {
                            "name": "method",
                            "type": "string",
                            "description": "HTTP method",
                            "default": "GET",
                            "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
                        },
                        "headers": {
                            "name": "headers",
                            "type": "object",
                            "description": "HTTP headers"
                        },
                        "body": {
                            "name": "body",
                            "type": "string",
                            "description": "Request body"
                        }
                    },
                    "required": ["url"]
                }),
                vec!["network".into()],
                Some(types::ToolAnnotations {
                    title: None,
                    read_only_hint: None,
                    destructive_hint: None,
                    idempotent_hint: None,
                    open_world_hint: Some(true),
                }),
                "builtin:http-request",
            ),
            ACPTool::new_builtin(
                "search_files",
                "Search for files matching a pattern",
                serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pattern": {
                            "name": "pattern",
                            "type": "string",
                            "description": "Glob pattern to match files",
                            "required": true
                        },
                        "directory": {
                            "name": "directory",
                            "type": "string",
                            "description": "Base directory to search from"
                        },
                        "maxResults": {
                            "name": "maxResults",
                            "type": "number",
                            "description": "Maximum number of results",
                            "default": 100
                        }
                    },
                    "required": ["pattern"]
                }),
                vec!["read".into(), "filesystem".into()],
                Some(types::ToolAnnotations {
                    title: None,
                    read_only_hint: Some(true),
                    destructive_hint: None,
                    idempotent_hint: Some(true),
                    open_world_hint: None,
                }),
                "builtin:search-files",
            ),
        ];

        for tool in builtin_tools {
            self.tools.insert(tool.id.clone(), tool);
        }
    }

    /// Generate a unique tool ID
    fn generate_id(&mut self, name: &str) -> String {
        let sanitized: String = name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect();
        let id = format!("{}_{}", sanitized, self.next_id);
        self.next_id += 1;
        id
    }

    /// Register a new tool
    pub fn register_tool(&mut self, mut tool: ACPTool) -> String {
        if tool.id.is_empty() {
            tool.id = self.generate_id(&tool.name);
        }
        let id = tool.id.clone();
        self.tools.insert(id.clone(), tool);
        id
    }

    /// Unregister a tool
    pub fn unregister_tool(&mut self, tool_id: &str) -> bool {
        if let Some(tool) = self.tools.get(tool_id) {
            if tool.source == types::ToolSource::Builtin {
                return false; // Cannot unregister builtin tools
            }
        }
        self.tools.remove(tool_id).is_some()
    }

    /// Update a tool
    pub fn update_tool(&mut self, tool_id: &str, updates: types::ToolUpdate) -> Result<(), String> {
        let tool = self.tools.get_mut(tool_id).ok_or("Tool not found")?;

        if let Some(name) = updates.name {
            tool.name = name;
        }
        if let Some(description) = updates.description {
            tool.description = Some(description);
        }
        if let Some(enabled) = updates.enabled {
            tool.enabled = enabled;
        }
        if let Some(permissions) = updates.permissions {
            tool.permissions = permissions;
        }
        if let Some(annotations) = updates.annotations {
            tool.annotations = Some(annotations);
        }

        Ok(())
    }

    /// Get a tool by ID
    pub fn get_tool(&self, tool_id: &str) -> Option<&ACPTool> {
        self.tools.get(tool_id)
    }

    /// Get a tool by name
    pub fn get_tool_by_name(&self, name: &str) -> Option<&ACPTool> {
        self.tools.values().find(|t| t.name == name)
    }

    /// List all tools
    pub fn list_tools(&self) -> Vec<ACPTool> {
        self.tools.values().cloned().collect()
    }

    /// Search tools
    pub fn search_tools(&self, query: &str) -> Vec<ACPTool> {
        let lower_query = query.to_lowercase();
        self.tools
            .values()
            .filter(|t| {
                t.name.to_lowercase().contains(&lower_query)
                    || t.description
                        .as_ref()
                        .is_some_and(|d| d.to_lowercase().contains(&lower_query))
            })
            .cloned()
            .collect()
    }

    /// Get sandbox configuration
    pub fn get_sandbox_config(&self) -> &ToolSandboxConfig {
        &self.sandbox_config
    }

    /// Update sandbox configuration
    pub fn update_sandbox_config(&mut self, config: ToolSandboxConfig) {
        self.sandbox_config = config;
    }

    /// Store execution result
    pub fn store_execution(&mut self, result: ToolExecutionResult) {
        self.executions
            .insert(result.id.clone(), Arc::new(RwLock::new(result)));
    }

    /// Get execution result
    pub fn get_execution(&self, execution_id: &str) -> Option<Arc<RwLock<ToolExecutionResult>>> {
        self.executions.get(execution_id).cloned()
    }
}

impl Default for ACPManager {
    fn default() -> Self {
        Self::new()
    }
}
