//! AI Tools System - Tool definitions and execution for AI agents

use super::types::{OpenAIFunctionDefinition, OpenAIToolDefinition};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResult {
    pub call_id: String,
    pub success: bool,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ToolResult {
    pub fn success(call_id: String, output: String) -> Self {
        Self {
            call_id,
            success: true,
            output,
            error: None,
        }
    }
    pub fn failure(call_id: String, error: String) -> Self {
        Self {
            call_id,
            success: false,
            output: String::new(),
            error: Some(error),
        }
    }
}

#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    fn definition(&self) -> ToolDefinition;
    async fn execute(&self, args: Value) -> Result<String, String>;
}

pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn with_builtin_tools() -> Self {
        let mut registry = Self::new();
        registry.register_builtin_tools();
        registry
    }

    pub fn register_builtin_tools(&mut self) {
        self.register(Arc::new(ReadFileTool));
        self.register(Arc::new(WriteFileTool));
        self.register(Arc::new(SearchFilesTool));
        self.register(Arc::new(SearchCodeTool));
        self.register(Arc::new(RunCommandTool));
        self.register(Arc::new(ListDirectoryTool));
        self.register(Arc::new(GetFileTreeTool));
        self.register(Arc::new(EditFileTool));
    }

    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        let def = tool.definition();
        self.tools.insert(def.name.clone(), tool);
    }

    pub fn get(&self, name: &str) -> Option<&Arc<dyn Tool>> {
        self.tools.get(name)
    }
    pub fn list_definitions(&self) -> Vec<ToolDefinition> {
        self.tools.values().map(|t| t.definition()).collect()
    }

    pub fn to_openai_tool_definitions(&self) -> Vec<OpenAIToolDefinition> {
        self.tools
            .values()
            .map(|t| {
                let def = t.definition();
                OpenAIToolDefinition {
                    tool_type: "function".to_string(),
                    function: OpenAIFunctionDefinition {
                        name: def.name,
                        description: def.description,
                        parameters: def.parameters,
                    },
                }
            })
            .collect()
    }

    pub async fn execute(&self, call: ToolCall) -> ToolResult {
        match self.tools.get(&call.name) {
            Some(t) => match t.execute(call.arguments).await {
                Ok(output) => ToolResult::success(call.id, output),
                Err(error) => ToolResult::failure(call.id, error),
            },
            None => ToolResult::failure(call.id, format!("Tool '{}' not found", call.name)),
        }
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::with_builtin_tools()
    }
}

pub struct ReadFileTool;
#[async_trait::async_trait]
impl Tool for ReadFileTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "read_file".to_string(),
            description: "Read file contents from the filesystem".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"path":{"type":"string"},"max_lines":{"type":"integer"},"start_line":{"type":"integer","default":1}},"required":["path"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing: path")?;
        let start = args.get("start_line").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
        let max = args
            .get("max_lines")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize);
        let content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
        let lines: Vec<&str> = content.lines().collect();
        let selected: Vec<&str> = match max {
            Some(m) => lines
                .iter()
                .skip(start.saturating_sub(1))
                .take(m)
                .copied()
                .collect(),
            None => lines
                .iter()
                .skip(start.saturating_sub(1))
                .copied()
                .collect(),
        };
        Ok(selected.join("\n"))
    }
}

pub struct WriteFileTool;
#[async_trait::async_trait]
impl Tool for WriteFileTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "write_file".to_string(),
            description: "Write content to a file".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"},"create_dirs":{"type":"boolean","default":true}},"required":["path","content"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing: path")?;
        let content = args
            .get("content")
            .and_then(|v| v.as_str())
            .ok_or("Missing: content")?;
        let p = PathBuf::from(path);
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).await.ok();
        }
        fs::write(&p, content).await.map_err(|e| e.to_string())?;
        Ok(format!("Wrote {} bytes to {}", content.len(), p.display()))
    }
}

pub struct SearchFilesTool;
#[async_trait::async_trait]
impl Tool for SearchFilesTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "search_files".to_string(),
            description: "Search for files matching a glob pattern".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"pattern":{"type":"string"},"directory":{"type":"string","default":"."},"max_results":{"type":"integer","default":100}},"required":["pattern"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let pattern = args
            .get("pattern")
            .and_then(|v| v.as_str())
            .ok_or("Missing: pattern")?;
        let dir = args
            .get("directory")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        let max = args
            .get("max_results")
            .and_then(|v| v.as_u64())
            .unwrap_or(100) as usize;
        let full = format!("{}/{}", dir, pattern);
        let mut matches = Vec::new();
        for entry in glob::glob(&full).map_err(|e| e.to_string())? {
            if matches.len() >= max {
                break;
            }
            if let Ok(p) = entry {
                matches.push(p.display().to_string());
            }
        }
        #[allow(clippy::expect_used)] // Serializing known JSON types
        Ok(
            serde_json::to_string(&serde_json::json!({"matches": matches}))
                .expect("JSON serialization of known types should not fail"),
        )
    }
}

pub struct SearchCodeTool;
#[async_trait::async_trait]
impl Tool for SearchCodeTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "search_code".to_string(),
            description: "Search for a pattern in code files".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"pattern":{"type":"string"},"directory":{"type":"string","default":"."},"file_pattern":{"type":"string"},"max_results":{"type":"integer","default":50}},"required":["pattern"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let pattern = args
            .get("pattern")
            .and_then(|v| v.as_str())
            .ok_or("Missing: pattern")?;
        let dir = args
            .get("directory")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        let file_pat = args.get("file_pattern").and_then(|v| v.as_str());
        let max = args
            .get("max_results")
            .and_then(|v| v.as_u64())
            .unwrap_or(50) as usize;
        let regex = regex::Regex::new(pattern).map_err(|e| e.to_string())?;
        let glob_pat = file_pat
            .map(|fp| format!("{}/{}", dir, fp))
            .unwrap_or_else(|| format!("{}/**/*", dir));
        let mut results = Vec::new();
        for entry in glob::glob(&glob_pat).map_err(|e| e.to_string())? {
            if results.len() >= max {
                break;
            }
            if let Ok(p) = entry {
                if !p.is_file() {
                    continue;
                }
                if let Ok(content) = fs::read_to_string(&p).await {
                    for (i, line) in content.lines().enumerate() {
                        if results.len() >= max {
                            break;
                        }
                        if regex.is_match(line) {
                            results.push(serde_json::json!({"file": p.display().to_string(), "line": i+1, "content": line}));
                        }
                    }
                }
            }
        }
        #[allow(clippy::expect_used)] // Serializing known JSON types
        Ok(
            serde_json::to_string(&serde_json::json!({"results": results}))
                .expect("JSON serialization of known types should not fail"),
        )
    }
}

pub struct RunCommandTool;
#[async_trait::async_trait]
impl Tool for RunCommandTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "run_command".to_string(),
            description: "Execute a shell command".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"command":{"type":"string"},"args":{"type":"array","items":{"type":"string"}},"cwd":{"type":"string"},"timeout_ms":{"type":"integer","default":30000}},"required":["command"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let cmd = args
            .get("command")
            .and_then(|v| v.as_str())
            .ok_or("Missing: command")?;
        let cmd_args: Vec<String> = args
            .get("args")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        let cwd = args.get("cwd").and_then(|v| v.as_str());
        let timeout = args
            .get("timeout_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(30000);
        let mut c = crate::process_utils::async_command(cmd);
        c.args(&cmd_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(d) = cwd {
            c.current_dir(d);
        }
        let output = tokio::time::timeout(std::time::Duration::from_millis(timeout), c.output())
            .await
            .map_err(|_| "Timeout")?
            .map_err(|e| e.to_string())?;
        #[allow(clippy::expect_used)] // Serializing known JSON types
        Ok(serde_json::to_string(&serde_json::json!({"exit_code": output.status.code(), "stdout": String::from_utf8_lossy(&output.stdout), "stderr": String::from_utf8_lossy(&output.stderr)})).expect("JSON serialization of known types should not fail"))
    }
}

pub struct ListDirectoryTool;
#[async_trait::async_trait]
impl Tool for ListDirectoryTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "list_directory".to_string(),
            description: "List files and directories in a path".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"path":{"type":"string"},"include_hidden":{"type":"boolean","default":false}},"required":["path"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing: path")?;
        let hidden = args
            .get("include_hidden")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let mut entries = Vec::new();
        let mut rd = fs::read_dir(path).await.map_err(|e| e.to_string())?;
        while let Some(e) = rd.next_entry().await.map_err(|e| e.to_string())? {
            let name = e.file_name().to_string_lossy().to_string();
            if !hidden && name.starts_with('.') {
                continue;
            }
            let meta = e.metadata().await.ok();
            entries.push(serde_json::json!({"name": name, "path": e.path().display().to_string(), "is_dir": meta.as_ref().map(|m| m.is_dir()).unwrap_or(false)}));
        }
        #[allow(clippy::expect_used)] // Serializing known JSON types
        Ok(
            serde_json::to_string(&serde_json::json!({"entries": entries}))
                .expect("JSON serialization of known types should not fail"),
        )
    }
}

pub struct GetFileTreeTool;
#[async_trait::async_trait]
impl Tool for GetFileTreeTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "get_file_tree".to_string(),
            description: "Get the project directory structure as a tree".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"path":{"type":"string","default":"."},"max_depth":{"type":"integer","default":3},"ignore_patterns":{"type":"array","items":{"type":"string"}}},"required":[]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
        let max_depth = args.get("max_depth").and_then(|v| v.as_u64()).unwrap_or(3) as usize;
        let ignore: Vec<String> = args
            .get("ignore_patterns")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_else(|| vec!["node_modules".into(), "target".into(), ".git".into()]);
        fn build(p: &Path, d: usize, max: usize, ign: &[String]) -> Option<Value> {
            if d > max {
                return None;
            }
            let name = p.file_name()?.to_string_lossy().to_string();
            if name.starts_with('.') || ign.contains(&name) {
                return None;
            }
            if p.is_file() {
                return Some(serde_json::json!({"name": name, "type": "file"}));
            }
            if p.is_dir() {
                let mut children = Vec::new();
                if let Ok(entries) = std::fs::read_dir(p) {
                    for e in entries.filter_map(|e| e.ok()) {
                        if let Some(c) = build(&e.path(), d + 1, max, ign) {
                            children.push(c);
                        }
                    }
                }
                return Some(
                    serde_json::json!({"name": name, "type": "directory", "children": children}),
                );
            }
            None
        }
        let tree = build(&PathBuf::from(path), 0, max_depth, &ignore)
            .unwrap_or_else(|| serde_json::json!({"error": "Failed"}));
        #[allow(clippy::expect_used)] // Serializing known JSON types
        Ok(
            serde_json::to_string(&tree)
                .expect("JSON serialization of known types should not fail"),
        )
    }
}

pub struct EditFileTool;
#[async_trait::async_trait]
impl Tool for EditFileTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "edit_file".to_string(),
            description: "Edit specific lines in a file (replace, insert, or delete)".to_string(),
            parameters: serde_json::json!({"type":"object","properties":{"path":{"type":"string"},"operation":{"type":"string","enum":["replace","insert","delete"]},"start_line":{"type":"integer"},"end_line":{"type":"integer"},"content":{"type":"string"}},"required":["path","operation","start_line"]}),
        }
    }
    async fn execute(&self, args: Value) -> Result<String, String> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing: path")?;
        let op = args
            .get("operation")
            .and_then(|v| v.as_str())
            .ok_or("Missing: operation")?;
        let start = args
            .get("start_line")
            .and_then(|v| v.as_u64())
            .ok_or("Missing: start_line")? as usize;
        let end = args
            .get("end_line")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize);
        let content = args.get("content").and_then(|v| v.as_str());
        let file_content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
        let mut lines: Vec<String> = file_content.lines().map(String::from).collect();
        match op {
            "replace" => {
                let e = end.ok_or("end_line required")?;
                let c = content.ok_or("content required")?;
                lines.splice((start - 1)..e, c.lines().map(String::from));
            }
            "insert" => {
                let c = content.ok_or("content required")?;
                for (i, l) in c.lines().enumerate() {
                    lines.insert(start - 1 + i, l.to_string());
                }
            }
            "delete" => {
                lines.drain((start - 1)..end.unwrap_or(start));
            }
            _ => return Err(format!("Unknown operation: {}", op)),
        }
        fs::write(path, lines.join("\n"))
            .await
            .map_err(|e| e.to_string())?;
        #[allow(clippy::expect_used)] // Serializing known JSON types
        Ok(serde_json::to_string(&serde_json::json!({"success": true}))
            .expect("JSON serialization of known types should not fail"))
    }
}

#[derive(Clone)]
pub struct AIToolsState(pub Arc<RwLock<ToolRegistry>>);
impl AIToolsState {
    pub fn new() -> Self {
        Self(Arc::new(RwLock::new(ToolRegistry::with_builtin_tools())))
    }
}
impl Default for AIToolsState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub async fn tools_list(
    state: tauri::State<'_, AIToolsState>,
) -> Result<Vec<ToolDefinition>, String> {
    Ok(state.0.read().await.list_definitions())
}

#[tauri::command]
pub async fn tools_execute(
    state: tauri::State<'_, AIToolsState>,
    call: ToolCall,
) -> Result<ToolResult, String> {
    Ok(state.0.read().await.execute(call).await)
}

#[tauri::command]
pub async fn tools_execute_batch(
    state: tauri::State<'_, AIToolsState>,
    calls: Vec<ToolCall>,
) -> Result<Vec<ToolResult>, String> {
    let reg = state.0.read().await;
    let mut results = Vec::new();
    for call in calls {
        results.push(reg.execute(call).await);
    }
    Ok(results)
}

#[tauri::command]
pub async fn tools_get(
    state: tauri::State<'_, AIToolsState>,
    name: String,
) -> Result<Option<ToolDefinition>, String> {
    Ok(state.0.read().await.get(&name).map(|t| t.definition()))
}
