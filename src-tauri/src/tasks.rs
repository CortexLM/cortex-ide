//! Tasks module for running VS Code-style task definitions
//!
//! This module provides functionality to run tasks defined in tasks.json files,
//! commonly used for pre/post debug tasks and build tasks.

use dashmap::DashMap;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

// ============== Global Running Tasks State ==============

static RUNNING_TASKS: Lazy<Mutex<HashMap<String, RunningTask>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static TASK_PROBLEMS: Lazy<Mutex<Vec<TaskDiagnosticEvent>>> = Lazy::new(|| Mutex::new(Vec::new()));

static PROBLEMS_MAP: Lazy<DashMap<String, Vec<TaskDiagnosticEvent>>> = Lazy::new(DashMap::new);

pub fn store_problem(diagnostic: &TaskDiagnosticEvent) {
    TASK_PROBLEMS.lock().push(diagnostic.clone());
    PROBLEMS_MAP
        .entry(diagnostic.file.clone())
        .or_default()
        .push(diagnostic.clone());
}

struct RunningTask {
    abort_handle: tokio::task::AbortHandle,
}

// ============== Event Payloads ==============

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskOutputEvent {
    task_id: String,
    line: String,
    is_stderr: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskStatusEvent {
    task_id: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDiagnosticEvent {
    pub task_id: String,
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub severity: String,
    pub message: String,
    pub code: Option<String>,
    pub source: String,
}

// ============== Task Structs ==============

/// Task definition from tasks.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDefinition {
    pub label: String,
    #[serde(rename = "type")]
    pub task_type: String,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub options: TaskOptions,
    #[serde(default)]
    pub group: Option<TaskGroup>,
    #[serde(default)]
    pub problem_matcher: Option<serde_json::Value>,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub depends_order: Option<String>,
    #[serde(default)]
    pub is_background: bool,
    #[serde(default)]
    pub presentation: TaskPresentation,
}

/// Task options
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskOptions {
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub shell: Option<TaskShell>,
}

/// Task shell configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskShell {
    pub executable: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
}

/// Task group
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TaskGroup {
    Simple(String),
    Extended {
        kind: String,
        #[serde(default)]
        is_default: bool,
    },
}

/// Task presentation options
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPresentation {
    #[serde(default = "default_reveal")]
    pub reveal: String,
    #[serde(default)]
    pub echo: bool,
    #[serde(default)]
    pub focus: bool,
    #[serde(default = "default_panel")]
    pub panel: String,
    #[serde(default)]
    pub show_reuse_message: bool,
    #[serde(default)]
    pub clear: bool,
}

fn default_reveal() -> String {
    "always".to_string()
}

fn default_panel() -> String {
    "shared".to_string()
}

/// Tasks configuration from tasks.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksConfig {
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub tasks: Vec<TaskDefinition>,
    #[serde(default)]
    pub inputs: Vec<serde_json::Value>,
}

fn default_version() -> String {
    "2.0.0".to_string()
}

impl Default for TasksConfig {
    fn default() -> Self {
        Self {
            version: default_version(),
            tasks: Vec::new(),
            inputs: Vec::new(),
        }
    }
}

/// Result of running a task
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskResult {
    pub task_name: String,
    pub success: bool,
    pub exit_code: Option<i32>,
    pub output: String,
    pub error: Option<String>,
}

// ============== Problem Matcher ==============

struct ProblemMatcher {
    name: String,
    pattern: Regex,
    file_group: usize,
    line_group: usize,
    column_group: usize,
    severity_group: Option<usize>,
    message_group: usize,
    code_group: Option<usize>,
}

fn get_builtin_problem_matcher(name: &str) -> Option<ProblemMatcher> {
    match name {
        "$tsc" => {
            // TypeScript: src/file.ts(10,5): error TS2304: Cannot find name 'x'.
            Regex::new(r"^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "tsc".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: Some(4),
                    message_group: 6,
                    code_group: Some(5),
                })
        }
        "$eslint-stylish" => {
            // /path/to/file.js
            //   10:5  error  some message  rule-name
            // We match the detail line; file tracking is multi-line. Simplified single-line:
            Regex::new(r"^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "eslint-stylish".to_string(),
                    pattern,
                    file_group: 0, // handled specially
                    line_group: 1,
                    column_group: 2,
                    severity_group: Some(3),
                    message_group: 4,
                    code_group: Some(5),
                })
        }
        "$gcc" => {
            // file.c:10:5: error: undeclared identifier
            Regex::new(r"^(.+):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "gcc".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: Some(4),
                    message_group: 5,
                    code_group: None,
                })
        }
        "$rustc" => {
            // error[E0425]: cannot find value `x` in this scope
            //  --> src/main.rs:10:5
            // We match the location line:
            Regex::new(r"^\s*-->\s+(.+):(\d+):(\d+)\s*$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "rustc".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: None,
                    message_group: 0, // handled via context
                    code_group: None,
                })
        }
        "$go" => {
            // file.go:10:5: error message
            Regex::new(r"^(.+\.go):(\d+):(\d+):\s+(.+)$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "go".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: None,
                    message_group: 4,
                    code_group: None,
                })
        }
        "$python" => {
            // File "file.py", line 10
            Regex::new(r#"^\s*File "(.+)", line (\d+)"#)
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "python".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 0,
                    severity_group: None,
                    message_group: 0,
                    code_group: None,
                })
        }
        _ => None,
    }
}

fn get_problem_matchers(problem_matcher: &Option<serde_json::Value>) -> Vec<ProblemMatcher> {
    let Some(value) = problem_matcher else {
        return Vec::new();
    };

    let mut matchers = Vec::new();

    match value {
        serde_json::Value::String(name) => {
            if let Some(m) = get_builtin_problem_matcher(name) {
                matchers.push(m);
            } else {
                debug!("Unknown problem matcher: {}", name);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                if let Some(name) = item.as_str() {
                    if let Some(m) = get_builtin_problem_matcher(name) {
                        matchers.push(m);
                    }
                }
            }
        }
        _ => {
            debug!("Unsupported problem matcher format");
        }
    }

    matchers
}

fn apply_problem_matchers(
    line: &str,
    matchers: &[ProblemMatcher],
    task_id: &str,
    app_handle: &AppHandle,
    last_rustc_message: &Option<(String, String)>,
) {
    for matcher in matchers {
        if let Some(caps) = matcher.pattern.captures(line) {
            let file = if matcher.file_group > 0 {
                caps.get(matcher.file_group)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let line_num: u32 = if matcher.line_group > 0 {
                caps.get(matcher.line_group)
                    .and_then(|m| m.as_str().parse().ok())
                    .unwrap_or(0)
            } else {
                0
            };

            let column: u32 = if matcher.column_group > 0 {
                caps.get(matcher.column_group)
                    .and_then(|m| m.as_str().parse().ok())
                    .unwrap_or(0)
            } else {
                0
            };

            let severity = matcher
                .severity_group
                .and_then(|g| caps.get(g))
                .map(|m| m.as_str().to_string())
                .or_else(|| last_rustc_message.as_ref().map(|(sev, _)| sev.clone()))
                .unwrap_or_else(|| "error".to_string());

            let message = if matcher.message_group > 0 {
                caps.get(matcher.message_group)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default()
            } else {
                last_rustc_message
                    .as_ref()
                    .map(|(_, msg)| msg.clone())
                    .unwrap_or_default()
            };

            let code = matcher
                .code_group
                .and_then(|g| caps.get(g))
                .map(|m| m.as_str().to_string());

            let event = TaskDiagnosticEvent {
                task_id: task_id.to_string(),
                file,
                line: line_num,
                column,
                severity,
                message,
                code,
                source: matcher.name.clone(),
            };

            store_problem(&event);

            if let Err(e) = app_handle.emit("task:diagnostic", &event) {
                warn!("Failed to emit task:diagnostic event: {}", e);
            }

            break;
        }
    }
}

// ============== Variable Substitution ==============

fn substitute_variables(
    input: &str,
    workspace_path: &str,
    file_path: Option<&str>,
    line_number: Option<u32>,
    selected_text: Option<&str>,
) -> String {
    #[allow(clippy::expect_used)]
    static VAR_RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\$\{([^}]+)\}").expect("Invalid variable substitution regex"));

    let workspace = Path::new(workspace_path);

    VAR_RE
        .replace_all(input, |caps: &regex::Captures| {
            let var_name = &caps[1];
            match var_name {
                "workspaceFolder" => workspace_path.to_string(),
                "workspaceFolderBasename" => workspace
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string(),
                "cwd" => std::env::current_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| ".".to_string()),
                "file" => file_path.unwrap_or("").to_string(),
                "fileBasename" => file_path
                    .map(|f| {
                        Path::new(f)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string()
                    })
                    .unwrap_or_default(),
                "fileDirname" => file_path
                    .map(|f| {
                        Path::new(f)
                            .parent()
                            .and_then(|p| p.to_str())
                            .unwrap_or("")
                            .to_string()
                    })
                    .unwrap_or_default(),
                "fileExtname" => file_path
                    .map(|f| {
                        Path::new(f)
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|e| format!(".{}", e))
                            .unwrap_or_default()
                    })
                    .unwrap_or_default(),
                "fileBasenameNoExtension" => file_path
                    .map(|f| {
                        Path::new(f)
                            .file_stem()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string()
                    })
                    .unwrap_or_default(),
                "lineNumber" => line_number.map(|n| n.to_string()).unwrap_or_default(),
                "selectedText" => selected_text.unwrap_or("").to_string(),
                "relativeFile" => file_path
                    .map(|f| {
                        let ws = std::path::Path::new(workspace_path);
                        std::path::Path::new(f)
                            .strip_prefix(ws)
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_else(|_| f.to_string())
                    })
                    .unwrap_or_default(),
                "relativeFileDirname" => file_path
                    .map(|f| {
                        let ws = std::path::Path::new(workspace_path);
                        std::path::Path::new(f)
                            .parent()
                            .and_then(|p| p.strip_prefix(ws).ok())
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default()
                    })
                    .unwrap_or_default(),
                "execPath" => std::env::current_exe()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
                "pathSeparator" => std::path::MAIN_SEPARATOR.to_string(),
                other if other.starts_with("env:") => {
                    let env_var = &other[4..];
                    std::env::var(env_var).unwrap_or_default()
                }
                _ => caps[0].to_string(),
            }
        })
        .to_string()
}

// ============== Command Building ==============

fn build_command(task: &TaskDefinition, workspace_path: &str) -> tokio::process::Command {
    let command_str = task
        .command
        .as_deref()
        .map(|c| substitute_variables(c, workspace_path, None, None, None))
        .unwrap_or_default();

    let args: Vec<String> = task
        .args
        .iter()
        .map(|a| substitute_variables(a, workspace_path, None, None, None))
        .collect();

    let cwd = task
        .options
        .cwd
        .as_ref()
        .map(|c| {
            let substituted = substitute_variables(c, workspace_path, None, None, None);
            let p = PathBuf::from(&substituted);
            if p.is_absolute() {
                p
            } else {
                PathBuf::from(workspace_path).join(p)
            }
        })
        .unwrap_or_else(|| PathBuf::from(workspace_path));

    let mut cmd = if task.task_type == "process" {
        let mut c = crate::process_utils::async_command(&command_str);
        for arg in &args {
            c.arg(arg);
        }
        c
    } else {
        let full_command = if args.is_empty() {
            command_str
        } else {
            format!("{} {}", command_str, shell_join_args(&args))
        };

        if let Some(ref custom_shell) = task.options.shell {
            let shell_exec = custom_shell
                .executable
                .as_deref()
                .unwrap_or(default_shell_executable());
            let mut c = crate::process_utils::async_command(shell_exec);
            if custom_shell.args.is_empty() {
                for arg in default_shell_args() {
                    c.arg(arg);
                }
            } else {
                for arg in &custom_shell.args {
                    c.arg(arg);
                }
            }
            c.arg(&full_command);
            c
        } else {
            let mut c = crate::process_utils::async_command(default_shell_executable());
            for arg in default_shell_args() {
                c.arg(arg);
            }
            c.arg(&full_command);
            c
        }
    };

    cmd.current_dir(&cwd);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    for (key, value) in &task.options.env {
        let substituted_value = substitute_variables(value, workspace_path, None, None, None);
        cmd.env(key, substituted_value);
    }

    cmd
}

fn default_shell_executable() -> &'static str {
    if cfg!(target_os = "windows") {
        "cmd"
    } else {
        "sh"
    }
}

fn default_shell_args() -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        &["/C"]
    } else {
        &["-c"]
    }
}

fn shell_join_args(args: &[String]) -> String {
    args.iter()
        .map(|a| {
            if a.contains(' ') || a.contains('"') || a.contains('\'') {
                format!("\"{}\"", a.replace('"', "\\\""))
            } else {
                a.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// ============== Rustc Context Tracking ==============

#[allow(clippy::expect_used)]
static RUSTC_HEADER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(error|warning)(?:\[([A-Z]\d+)\])?:\s+(.+)$").expect("Invalid rustc header regex")
});

fn parse_rustc_header(line: &str) -> Option<(String, String)> {
    RUSTC_HEADER_RE.captures(line).map(|caps| {
        let severity = caps[1].to_string();
        let message = caps[3].to_string();
        (severity, message)
    })
}

// ============== Core Execution ==============

/// Load tasks.json from the workspace
fn load_tasks_config(workspace_path: &str) -> Result<TasksConfig, String> {
    let vscode_path = PathBuf::from(workspace_path)
        .join(".vscode")
        .join("tasks.json");

    if vscode_path.exists() {
        let content = std::fs::read_to_string(&vscode_path)
            .map_err(|e| format!("Failed to read tasks.json: {}", e))?;

        // Remove comments (VS Code allows JSON with comments)
        let content = remove_json_comments(&content);

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse tasks.json: {}", e))
    } else {
        Ok(TasksConfig::default())
    }
}

/// Remove single-line and multi-line comments from JSON content
fn remove_json_comments(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let mut chars = content.chars().peekable();
    let mut in_string = false;

    while let Some(c) = chars.next() {
        if in_string {
            result.push(c);
            if c == '\\' {
                if let Some(&next) = chars.peek() {
                    result.push(next);
                    chars.next();
                }
            } else if c == '"' {
                in_string = false;
            }
        } else if c == '"' {
            in_string = true;
            result.push(c);
        } else if c == '/' {
            if let Some(&next) = chars.peek() {
                if next == '/' {
                    // Single-line comment - skip to end of line
                    chars.next();
                    while let Some(&ch) = chars.peek() {
                        if ch == '\n' {
                            break;
                        }
                        chars.next();
                    }
                } else if next == '*' {
                    // Multi-line comment - skip until */
                    chars.next();
                    while let Some(ch) = chars.next() {
                        if ch == '*' {
                            if let Some(&next) = chars.peek() {
                                if next == '/' {
                                    chars.next();
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    result.push(c);
                }
            } else {
                result.push(c);
            }
        } else {
            result.push(c);
        }
    }

    result
}

/// Find a task by name
fn find_task<'a>(config: &'a TasksConfig, task_name: &str) -> Option<&'a TaskDefinition> {
    config.tasks.iter().find(|t| t.label == task_name)
}

/// Run a single task (legacy - collects all output at once)
async fn run_single_task(
    task: &TaskDefinition,
    workspace_path: &str,
) -> Result<TaskResult, String> {
    let command = task.command.as_ref().ok_or("Task has no command")?;

    // Determine working directory
    let cwd = task
        .options
        .cwd
        .as_ref()
        .map(|c| PathBuf::from(workspace_path).join(c))
        .unwrap_or_else(|| PathBuf::from(workspace_path));

    // Build the command
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = crate::process_utils::async_command("cmd");
        c.arg("/C")
            .arg(format!("{} {}", command, task.args.join(" ")));
        c
    } else {
        let mut c = crate::process_utils::async_command("sh");
        c.arg("-c")
            .arg(format!("{} {}", command, task.args.join(" ")));
        c
    };

    cmd.current_dir(&cwd);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Set environment variables
    for (key, value) in &task.options.env {
        cmd.env(key, value);
    }

    // Run the command
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute task: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(TaskResult {
        task_name: task.label.clone(),
        success: output.status.success(),
        exit_code: output.status.code(),
        output: format!("{}{}", stdout, stderr),
        error: if output.status.success() {
            None
        } else {
            Some(stderr)
        },
    })
}

/// Execute a task with streaming output, problem matchers, and background support
async fn execute_task_streaming(
    task: TaskDefinition,
    workspace_path: String,
    app_handle: AppHandle,
    task_id: String,
) -> anyhow::Result<TaskResult> {
    let command_str = task.command.as_deref().unwrap_or_default();
    if command_str.is_empty() {
        anyhow::bail!("Task '{}' has no command", task.label);
    }

    info!("Executing task '{}' (id: {})", task.label, task_id);

    let _ = app_handle.emit(
        "task:status",
        &TaskStatusEvent {
            task_id: task_id.clone(),
            status: "started".to_string(),
        },
    );

    let mut child = build_command(&task, &workspace_path)
        .spawn()
        .map_err(|e| anyhow::anyhow!("Failed to spawn task '{}': {}", task.label, e))?;

    let matchers = get_problem_matchers(&task.problem_matcher);
    let has_rustc_matcher = matchers.iter().any(|m| m.name == "rustc");

    let stdout_handle = if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let app = app_handle.clone();
        let tid = task_id.clone();
        let matchers_for_stdout: Vec<_> = matchers
            .iter()
            .map(|m| ProblemMatcher {
                name: m.name.clone(),
                pattern: m.pattern.clone(),
                file_group: m.file_group,
                line_group: m.line_group,
                column_group: m.column_group,
                severity_group: m.severity_group,
                message_group: m.message_group,
                code_group: m.code_group,
            })
            .collect();
        let track_rustc = has_rustc_matcher;

        Some(tokio::spawn(async move {
            let mut lines = reader.lines();
            let mut last_rustc_ctx: Option<(String, String)> = None;

            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit(
                    "task:output",
                    &TaskOutputEvent {
                        task_id: tid.clone(),
                        line: line.clone(),
                        is_stderr: false,
                    },
                );

                if track_rustc {
                    if let Some(ctx) = parse_rustc_header(&line) {
                        last_rustc_ctx = Some(ctx);
                    }
                }

                apply_problem_matchers(&line, &matchers_for_stdout, &tid, &app, &last_rustc_ctx);
            }
        }))
    } else {
        None
    };

    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let app = app_handle.clone();
        let tid = task_id.clone();
        let matchers_for_stderr: Vec<_> = matchers
            .iter()
            .map(|m| ProblemMatcher {
                name: m.name.clone(),
                pattern: m.pattern.clone(),
                file_group: m.file_group,
                line_group: m.line_group,
                column_group: m.column_group,
                severity_group: m.severity_group,
                message_group: m.message_group,
                code_group: m.code_group,
            })
            .collect();
        let track_rustc = has_rustc_matcher;

        Some(tokio::spawn(async move {
            let mut lines = reader.lines();
            let mut last_rustc_ctx: Option<(String, String)> = None;

            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit(
                    "task:output",
                    &TaskOutputEvent {
                        task_id: tid.clone(),
                        line: line.clone(),
                        is_stderr: true,
                    },
                );

                if track_rustc {
                    if let Some(ctx) = parse_rustc_header(&line) {
                        last_rustc_ctx = Some(ctx);
                    }
                }

                apply_problem_matchers(&line, &matchers_for_stderr, &tid, &app, &last_rustc_ctx);
            }
        }))
    } else {
        None
    };

    if task.is_background {
        let _ = app_handle.emit(
            "task:status",
            &TaskStatusEvent {
                task_id: task_id.clone(),
                status: "running".to_string(),
            },
        );

        info!(
            "Background task '{}' (id: {}) is running",
            task.label, task_id
        );

        let task_label = task.label.clone();
        let app_for_bg = app_handle.clone();
        let tid_for_bg = task_id.clone();

        tokio::spawn(async move {
            let status = child.wait().await;
            let exit_code = status.map(|s| s.code().unwrap_or(-1)).ok();

            if let Some(h) = stdout_handle {
                let _ = h.await;
            }
            if let Some(h) = stderr_handle {
                let _ = h.await;
            }

            RUNNING_TASKS.lock().remove(&tid_for_bg);

            let final_status = if exit_code == Some(0) {
                "completed"
            } else {
                "failed"
            };

            let _ = app_for_bg.emit(
                "task:status",
                &TaskStatusEvent {
                    task_id: tid_for_bg.clone(),
                    status: final_status.to_string(),
                },
            );

            info!(
                "Background task '{}' (id: {}) finished with status: {}",
                task_label, tid_for_bg, final_status
            );
        });

        return Ok(TaskResult {
            task_name: task.label.clone(),
            success: true,
            exit_code: None,
            output: String::new(),
            error: None,
        });
    }

    let status = child.wait().await?;

    if let Some(h) = stdout_handle {
        let _ = h.await;
    }
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    RUNNING_TASKS.lock().remove(&task_id);

    let exit_code = status.code();
    let success = status.success();

    let final_status = if success { "completed" } else { "failed" };

    let _ = app_handle.emit(
        "task:status",
        &TaskStatusEvent {
            task_id: task_id.clone(),
            status: final_status.to_string(),
        },
    );

    info!(
        "Task '{}' (id: {}) finished with status: {}",
        task.label, task_id, final_status
    );

    Ok(TaskResult {
        task_name: task.label,
        success,
        exit_code,
        output: String::new(),
        error: if success {
            None
        } else {
            Some(format!("Task exited with code {:?}", exit_code))
        },
    })
}

/// Run dependency tasks before the main task
async fn run_dependencies(
    depends_on: &[String],
    depends_order: Option<&str>,
    workspace_path: &str,
    app_handle: &AppHandle,
) -> Result<(), String> {
    if depends_on.is_empty() {
        return Ok(());
    }

    let config = load_tasks_config(workspace_path)?;

    if depends_order == Some("parallel") {
        let mut handles = Vec::new();

        for dep_name in depends_on {
            let dep_task = find_task(&config, dep_name)
                .ok_or_else(|| format!("Dependency task '{}' not found", dep_name))?
                .clone();

            let ws = workspace_path.to_string();
            let app = app_handle.clone();
            let dep_id = Uuid::new_v4().to_string();

            debug!(
                "Starting parallel dependency task '{}' (id: {})",
                dep_name, dep_id
            );

            handles.push(tokio::spawn(async move {
                execute_task_streaming(dep_task, ws, app, dep_id).await
            }));
        }

        for handle in handles {
            let result = handle
                .await
                .map_err(|e| format!("Dependency task join error: {}", e))?
                .map_err(|e| format!("Dependency task failed: {}", e))?;

            if !result.success {
                return Err(format!("Dependency task '{}' failed", result.task_name));
            }
        }
    } else {
        for dep_name in depends_on {
            let dep_task = find_task(&config, dep_name)
                .ok_or_else(|| format!("Dependency task '{}' not found", dep_name))?
                .clone();

            let dep_id = Uuid::new_v4().to_string();
            debug!(
                "Starting sequential dependency task '{}' (id: {})",
                dep_name, dep_id
            );

            let result = execute_task_streaming(
                dep_task,
                workspace_path.to_string(),
                app_handle.clone(),
                dep_id,
            )
            .await
            .map_err(|e| format!("Dependency task '{}' failed: {}", dep_name, e))?;

            if !result.success {
                return Err(format!("Dependency task '{}' failed", dep_name));
            }
        }
    }

    Ok(())
}

// ============== Tauri Commands ==============

/// Run a task by name
#[tauri::command]
pub async fn tasks_run_task(
    task_name: String,
    workspace_path: Option<String>,
) -> Result<TaskResult, String> {
    // Get workspace path from argument or use current directory
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    // Load tasks configuration
    let config = load_tasks_config(&workspace)?;

    // Find the task
    let task = find_task(&config, &task_name)
        .ok_or_else(|| format!("Task '{}' not found in tasks.json", task_name))?;

    // Handle task dependencies
    for dep in &task.depends_on {
        if let Some(dep_task) = find_task(&config, dep) {
            let dep_result = run_single_task(dep_task, &workspace).await?;
            if !dep_result.success {
                return Err(format!("Dependency task '{}' failed", dep));
            }
        }
    }

    // Run the main task
    run_single_task(task, &workspace).await
}

/// List all available tasks
#[tauri::command]
pub async fn tasks_list(workspace_path: Option<String>) -> Result<Vec<String>, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    let config = load_tasks_config(&workspace)?;
    Ok(config.tasks.iter().map(|t| t.label.clone()).collect())
}

/// Get task configuration
#[tauri::command]
pub async fn tasks_get_config(workspace_path: Option<String>) -> Result<TasksConfig, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    load_tasks_config(&workspace)
}

/// Execute a task with streaming output, problem matchers, and dependency support
#[tauri::command]
pub async fn tasks_execute_task(
    task: TaskDefinition,
    workspace_path: Option<String>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    let task_id = Uuid::new_v4().to_string();
    info!("Scheduling task '{}' (id: {})", task.label, task_id);

    let depends_on = task.depends_on.clone();
    let depends_order = task.depends_order.clone();

    if !depends_on.is_empty() {
        run_dependencies(
            &depends_on,
            depends_order.as_deref(),
            &workspace,
            &app_handle,
        )
        .await?;
    }

    let task_id_clone = task_id.clone();
    let app_clone = app_handle.clone();
    let ws = workspace.clone();

    let join_handle = tokio::spawn(async move {
        match execute_task_streaming(task, ws, app_clone.clone(), task_id_clone.clone()).await {
            Ok(result) => {
                debug!(
                    "Task {} completed: success={}",
                    task_id_clone, result.success
                );
            }
            Err(e) => {
                error!("Task {} failed: {}", task_id_clone, e);
                let _ = app_clone.emit(
                    "task:status",
                    &TaskStatusEvent {
                        task_id: task_id_clone.clone(),
                        status: "failed".to_string(),
                    },
                );
                RUNNING_TASKS.lock().remove(&task_id_clone);
            }
        }
    });

    RUNNING_TASKS.lock().insert(
        task_id.clone(),
        RunningTask {
            abort_handle: join_handle.abort_handle(),
        },
    );

    Ok(task_id)
}

/// Cancel a running task
#[tauri::command]
pub async fn tasks_cancel_task(task_id: String) -> Result<(), String> {
    let running_task = RUNNING_TASKS.lock().remove(&task_id);

    match running_task {
        Some(task) => {
            info!("Cancelling task {}", task_id);
            task.abort_handle.abort();
            Ok(())
        }
        None => Err(format!("Task '{}' not found or already completed", task_id)),
    }
}

/// Get all accumulated task problems/diagnostics
#[tauri::command]
pub async fn tasks_get_problems() -> Result<Vec<TaskDiagnosticEvent>, String> {
    Ok(TASK_PROBLEMS.lock().clone())
}

/// Clear accumulated task problems, optionally filtered by task_id
#[tauri::command]
pub async fn tasks_clear_problems(task_id: Option<String>) -> Result<(), String> {
    let mut problems = TASK_PROBLEMS.lock();
    if let Some(id) = task_id {
        problems.retain(|p| p.task_id != id);
    } else {
        problems.clear();
    }
    Ok(())
}

/// Filter problems by severity and/or file path
#[tauri::command]
pub async fn tasks_filter_problems(
    severity: Option<String>,
    file_path: Option<String>,
) -> Result<Vec<TaskDiagnosticEvent>, String> {
    let problems = TASK_PROBLEMS.lock().clone();
    let filtered = problems
        .into_iter()
        .filter(|p| {
            if let Some(ref sev) = severity {
                if p.severity != *sev {
                    return false;
                }
            }
            if let Some(ref fp) = file_path {
                if !p.file.contains(fp.as_str()) {
                    return false;
                }
            }
            true
        })
        .collect();
    Ok(filtered)
}

/// Run a task with full dependency graph resolution
#[tauri::command]
pub async fn tasks_run_with_dependencies(
    task_name: String,
    workspace_path: Option<String>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    let config = load_tasks_config(&workspace)?;
    let task = find_task(&config, &task_name)
        .ok_or_else(|| format!("Task '{}' not found in tasks.json", task_name))?
        .clone();

    // Resolve full dependency graph (detect cycles)
    let mut visited = std::collections::HashSet::new();
    let mut order = Vec::new();
    resolve_dependency_order(&config, &task_name, &mut visited, &mut order)?;

    info!(
        "Task '{}' dependency order: {:?}",
        task_name,
        order.iter().map(|t| &t.label).collect::<Vec<_>>()
    );

    // Execute dependencies first
    let depends_on = task.depends_on.clone();
    let depends_order = task.depends_order.clone();

    if !depends_on.is_empty() {
        run_dependencies(
            &depends_on,
            depends_order.as_deref(),
            &workspace,
            &app_handle,
        )
        .await?;
    }

    // Execute main task
    let task_id = Uuid::new_v4().to_string();
    let task_id_clone = task_id.clone();
    let app_clone = app_handle.clone();
    let ws = workspace.clone();

    let join_handle = tokio::spawn(async move {
        match execute_task_streaming(task, ws, app_clone.clone(), task_id_clone.clone()).await {
            Ok(result) => {
                debug!(
                    "Task {} completed: success={}",
                    task_id_clone, result.success
                );
            }
            Err(e) => {
                error!("Task {} failed: {}", task_id_clone, e);
                let _ = app_clone.emit(
                    "task:status",
                    &TaskStatusEvent {
                        task_id: task_id_clone.clone(),
                        status: "failed".to_string(),
                    },
                );
                RUNNING_TASKS.lock().remove(&task_id_clone);
            }
        }
    });

    RUNNING_TASKS.lock().insert(
        task_id.clone(),
        RunningTask {
            abort_handle: join_handle.abort_handle(),
        },
    );

    Ok(task_id)
}

/// Resolve dependency order with cycle detection
fn resolve_dependency_order(
    config: &TasksConfig,
    task_name: &str,
    visited: &mut std::collections::HashSet<String>,
    order: &mut Vec<TaskDefinition>,
) -> Result<(), String> {
    if visited.contains(task_name) {
        return Err(format!(
            "Circular dependency detected involving task '{}'",
            task_name
        ));
    }
    visited.insert(task_name.to_string());

    let task =
        find_task(config, task_name).ok_or_else(|| format!("Task '{}' not found", task_name))?;

    for dep in &task.depends_on {
        resolve_dependency_order(config, dep, visited, order)?;
    }

    if !order.iter().any(|t| t.label == task_name) {
        order.push(task.clone());
    }

    Ok(())
}

/// Resolve a task input variable (for prompts and pick strings)
#[tauri::command]
pub async fn tasks_resolve_input(
    input_id: String,
    workspace_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    let config = load_tasks_config(&workspace)?;

    let input_def = config
        .inputs
        .iter()
        .find(|i| i.get("id").and_then(|v| v.as_str()) == Some(&input_id))
        .ok_or_else(|| format!("Input '{}' not found in tasks.json", input_id))?;

    Ok(input_def.clone())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    // ---- substitute_variables ----

    #[test]
    fn substitute_workspace_folder() {
        let result = substitute_variables(
            "${workspaceFolder}/src",
            "/home/user/project",
            None,
            None,
            None,
        );
        assert_eq!(result, "/home/user/project/src");
    }

    #[test]
    fn substitute_workspace_folder_basename() {
        let result = substitute_variables(
            "${workspaceFolderBasename}",
            "/home/user/project",
            None,
            None,
            None,
        );
        assert_eq!(result, "project");
    }

    #[test]
    fn substitute_file_variables() {
        let result = substitute_variables(
            "${file} ${fileBasename} ${fileDirname} ${fileExtname} ${fileBasenameNoExtension}",
            "/workspace",
            Some("/workspace/src/main.rs"),
            None,
            None,
        );
        assert!(result.contains("/workspace/src/main.rs"));
        assert!(result.contains("main.rs"));
        assert!(result.contains("/workspace/src"));
        assert!(result.contains(".rs"));
        assert!(result.contains("main"));
    }

    #[test]
    fn substitute_line_number() {
        let result = substitute_variables("line: ${lineNumber}", "/ws", None, Some(42), None);
        assert_eq!(result, "line: 42");
    }

    #[test]
    fn substitute_selected_text() {
        let result = substitute_variables("sel: ${selectedText}", "/ws", None, None, Some("hello"));
        assert_eq!(result, "sel: hello");
    }

    #[test]
    fn substitute_relative_file() {
        let result = substitute_variables(
            "${relativeFile}",
            "/workspace",
            Some("/workspace/src/main.rs"),
            None,
            None,
        );
        assert_eq!(result, "src/main.rs");
    }

    #[test]
    fn substitute_relative_file_dirname() {
        let result = substitute_variables(
            "${relativeFileDirname}",
            "/workspace",
            Some("/workspace/src/main.rs"),
            None,
            None,
        );
        assert_eq!(result, "src");
    }

    #[test]
    fn substitute_path_separator() {
        let result = substitute_variables("${pathSeparator}", "/ws", None, None, None);
        assert_eq!(result, std::path::MAIN_SEPARATOR.to_string());
    }

    #[test]
    fn substitute_env_variable_missing() {
        let result =
            substitute_variables("${env:CORTEX_NONEXISTENT_VAR_XYZ}", "/ws", None, None, None);
        assert_eq!(result, "");
    }

    #[test]
    fn substitute_unknown_variable_preserved() {
        let result = substitute_variables("${unknownVar}", "/ws", None, None, None);
        assert_eq!(result, "${unknownVar}");
    }

    #[test]
    fn substitute_no_variables() {
        let result = substitute_variables("plain text", "/ws", None, None, None);
        assert_eq!(result, "plain text");
    }

    #[test]
    fn substitute_multiple_variables() {
        let result = substitute_variables(
            "${workspaceFolder} ${lineNumber}",
            "/proj",
            None,
            Some(10),
            None,
        );
        assert_eq!(result, "/proj 10");
    }

    #[test]
    fn substitute_missing_file_returns_empty() {
        let result = substitute_variables("${file}", "/ws", None, None, None);
        assert_eq!(result, "");
    }

    #[test]
    fn substitute_missing_line_number_returns_empty() {
        let result = substitute_variables("${lineNumber}", "/ws", None, None, None);
        assert_eq!(result, "");
    }

    // ---- Problem Matchers ----

    #[test]
    fn builtin_matcher_tsc() {
        let matcher = get_builtin_problem_matcher("$tsc");
        assert!(matcher.is_some());
        let matcher = matcher.unwrap();
        assert_eq!(matcher.name, "tsc");

        let caps = matcher
            .pattern
            .captures("src/file.ts(10,5): error TS2304: Cannot find name 'x'.");
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[1], "src/file.ts");
        assert_eq!(&caps[2], "10");
        assert_eq!(&caps[3], "5");
        assert_eq!(&caps[4], "error");
        assert_eq!(&caps[5], "TS2304");
    }

    #[test]
    fn builtin_matcher_gcc() {
        let matcher = get_builtin_problem_matcher("$gcc");
        assert!(matcher.is_some());
        let matcher = matcher.unwrap();
        assert_eq!(matcher.name, "gcc");

        let caps = matcher
            .pattern
            .captures("file.c:10:5: error: undeclared identifier");
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[1], "file.c");
        assert_eq!(&caps[2], "10");
        assert_eq!(&caps[3], "5");
        assert_eq!(&caps[4], "error");
        assert_eq!(&caps[5], "undeclared identifier");
    }

    #[test]
    fn builtin_matcher_rustc() {
        let matcher = get_builtin_problem_matcher("$rustc");
        assert!(matcher.is_some());
        let matcher = matcher.unwrap();
        assert_eq!(matcher.name, "rustc");

        let caps = matcher.pattern.captures(" --> src/main.rs:10:5");
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[1], "src/main.rs");
        assert_eq!(&caps[2], "10");
        assert_eq!(&caps[3], "5");
    }

    #[test]
    fn builtin_matcher_go() {
        let matcher = get_builtin_problem_matcher("$go");
        assert!(matcher.is_some());
        let matcher = matcher.unwrap();
        assert_eq!(matcher.name, "go");

        let caps = matcher.pattern.captures("main.go:15:3: undefined: foo");
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[1], "main.go");
        assert_eq!(&caps[2], "15");
        assert_eq!(&caps[3], "3");
        assert_eq!(&caps[4], "undefined: foo");
    }

    #[test]
    fn builtin_matcher_python() {
        let matcher = get_builtin_problem_matcher("$python");
        assert!(matcher.is_some());
        let matcher = matcher.unwrap();
        assert_eq!(matcher.name, "python");

        let caps = matcher.pattern.captures(r#"  File "test.py", line 10"#);
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[1], "test.py");
        assert_eq!(&caps[2], "10");
    }

    #[test]
    fn builtin_matcher_unknown_returns_none() {
        assert!(get_builtin_problem_matcher("$unknown").is_none());
        assert!(get_builtin_problem_matcher("").is_none());
    }

    #[test]
    fn get_problem_matchers_none() {
        let matchers = get_problem_matchers(&None);
        assert!(matchers.is_empty());
    }

    #[test]
    fn get_problem_matchers_string() {
        let val = Some(serde_json::Value::String("$gcc".to_string()));
        let matchers = get_problem_matchers(&val);
        assert_eq!(matchers.len(), 1);
        assert_eq!(matchers[0].name, "gcc");
    }

    #[test]
    fn get_problem_matchers_array() {
        let val = Some(serde_json::json!(["$gcc", "$tsc"]));
        let matchers = get_problem_matchers(&val);
        assert_eq!(matchers.len(), 2);
    }

    #[test]
    fn get_problem_matchers_unknown_string() {
        let val = Some(serde_json::Value::String("$nonexistent".to_string()));
        let matchers = get_problem_matchers(&val);
        assert!(matchers.is_empty());
    }

    #[test]
    fn get_problem_matchers_object_unsupported() {
        let val = Some(serde_json::json!({"custom": true}));
        let matchers = get_problem_matchers(&val);
        assert!(matchers.is_empty());
    }

    // ---- parse_rustc_header ----

    #[test]
    fn parse_rustc_header_error() {
        let result = parse_rustc_header("error[E0425]: cannot find value `x` in this scope");
        assert!(result.is_some());
        let (sev, msg) = result.unwrap();
        assert_eq!(sev, "error");
        assert_eq!(msg, "cannot find value `x` in this scope");
    }

    #[test]
    fn parse_rustc_header_warning() {
        let result = parse_rustc_header("warning: unused variable: `x`");
        assert!(result.is_some());
        let (sev, msg) = result.unwrap();
        assert_eq!(sev, "warning");
        assert_eq!(msg, "unused variable: `x`");
    }

    #[test]
    fn parse_rustc_header_non_matching() {
        assert!(parse_rustc_header("   --> src/main.rs:10:5").is_none());
        assert!(parse_rustc_header("regular output line").is_none());
        assert!(parse_rustc_header("").is_none());
    }

    // ---- remove_json_comments ----

    #[test]
    fn remove_single_line_comments() {
        let input = r#"{ "key": "value" // comment
}"#;
        let result = remove_json_comments(input);
        assert!(result.contains(r#""key": "value""#));
        assert!(!result.contains("comment"));
    }

    #[test]
    fn remove_multi_line_comments() {
        let input = r#"{ /* multi
line
comment */ "key": "value" }"#;
        let result = remove_json_comments(input);
        assert!(result.contains(r#""key": "value""#));
        assert!(!result.contains("multi"));
    }

    #[test]
    fn preserve_strings_with_slashes() {
        let input = r#"{ "url": "http://example.com" }"#;
        let result = remove_json_comments(input);
        assert!(result.contains("http://example.com"));
    }

    #[test]
    fn no_comments_unchanged() {
        let input = r#"{"key": "value"}"#;
        let result = remove_json_comments(input);
        assert_eq!(result, input);
    }

    #[test]
    fn empty_input() {
        assert_eq!(remove_json_comments(""), "");
    }

    // ---- shell_join_args ----

    #[test]
    fn shell_join_simple_args() {
        let args = vec!["--flag".to_string(), "value".to_string()];
        assert_eq!(shell_join_args(&args), "--flag value");
    }

    #[test]
    fn shell_join_args_with_spaces() {
        let args = vec!["hello world".to_string(), "foo".to_string()];
        let result = shell_join_args(&args);
        assert_eq!(result, r#""hello world" foo"#);
    }

    #[test]
    fn shell_join_args_with_quotes() {
        let args = vec![r#"say "hi""#.to_string()];
        let result = shell_join_args(&args);
        assert_eq!(result, r#""say \"hi\"""#);
    }

    #[test]
    fn shell_join_empty_args() {
        let args: Vec<String> = vec![];
        assert_eq!(shell_join_args(&args), "");
    }

    // ---- TaskDefinition / TasksConfig serialization ----

    #[test]
    fn task_definition_roundtrip() {
        let task = TaskDefinition {
            label: "build".to_string(),
            task_type: "shell".to_string(),
            command: Some("cargo build".to_string()),
            args: vec!["--release".to_string()],
            options: TaskOptions::default(),
            group: Some(TaskGroup::Simple("build".to_string())),
            problem_matcher: None,
            depends_on: vec![],
            depends_order: None,
            is_background: false,
            presentation: TaskPresentation::default(),
        };
        let json = serde_json::to_string(&task).unwrap();
        let deserialized: TaskDefinition = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.label, "build");
        assert_eq!(deserialized.task_type, "shell");
        assert_eq!(deserialized.command, Some("cargo build".to_string()));
        assert_eq!(deserialized.args, vec!["--release"]);
    }

    #[test]
    fn tasks_config_default() {
        let config = TasksConfig::default();
        assert_eq!(config.version, "2.0.0");
        assert!(config.tasks.is_empty());
        assert!(config.inputs.is_empty());
    }

    #[test]
    fn tasks_config_roundtrip() {
        let config = TasksConfig {
            version: "2.0.0".to_string(),
            tasks: vec![TaskDefinition {
                label: "test".to_string(),
                task_type: "shell".to_string(),
                command: Some("cargo test".to_string()),
                args: vec![],
                options: TaskOptions::default(),
                group: None,
                problem_matcher: None,
                depends_on: vec![],
                depends_order: None,
                is_background: false,
                presentation: TaskPresentation::default(),
            }],
            inputs: vec![],
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: TasksConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.tasks.len(), 1);
        assert_eq!(deserialized.tasks[0].label, "test");
    }

    #[test]
    fn task_group_simple_roundtrip() {
        let group = TaskGroup::Simple("build".to_string());
        let json = serde_json::to_string(&group).unwrap();
        let deserialized: TaskGroup = serde_json::from_str(&json).unwrap();
        match deserialized {
            TaskGroup::Simple(kind) => assert_eq!(kind, "build"),
            _ => panic!("Expected Simple variant"),
        }
    }

    #[test]
    fn task_group_extended_roundtrip() {
        let group = TaskGroup::Extended {
            kind: "build".to_string(),
            is_default: true,
        };
        let json = serde_json::to_string(&group).unwrap();
        let deserialized: TaskGroup = serde_json::from_str(&json).unwrap();
        match deserialized {
            TaskGroup::Extended { kind, is_default } => {
                assert_eq!(kind, "build");
                assert!(is_default);
            }
            _ => panic!("Expected Extended variant"),
        }
    }

    #[test]
    fn task_presentation_serde_defaults() {
        let json = r#"{}"#;
        let pres: TaskPresentation = serde_json::from_str(json).unwrap();
        assert_eq!(pres.reveal, "always");
        assert_eq!(pres.panel, "shared");
        assert!(!pres.echo);
        assert!(!pres.focus);
    }

    // ---- find_task ----

    #[test]
    fn find_task_existing() {
        let config = TasksConfig {
            version: "2.0.0".to_string(),
            tasks: vec![TaskDefinition {
                label: "build".to_string(),
                task_type: "shell".to_string(),
                command: Some("make".to_string()),
                args: vec![],
                options: TaskOptions::default(),
                group: None,
                problem_matcher: None,
                depends_on: vec![],
                depends_order: None,
                is_background: false,
                presentation: TaskPresentation::default(),
            }],
            inputs: vec![],
        };
        assert!(find_task(&config, "build").is_some());
        assert_eq!(find_task(&config, "build").unwrap().label, "build");
    }

    #[test]
    fn find_task_missing() {
        let config = TasksConfig::default();
        assert!(find_task(&config, "nonexistent").is_none());
    }

    // ---- resolve_dependency_order ----

    #[test]
    fn resolve_dependency_order_no_deps() {
        let config = TasksConfig {
            version: "2.0.0".to_string(),
            tasks: vec![TaskDefinition {
                label: "build".to_string(),
                task_type: "shell".to_string(),
                command: Some("make".to_string()),
                args: vec![],
                options: TaskOptions::default(),
                group: None,
                problem_matcher: None,
                depends_on: vec![],
                depends_order: None,
                is_background: false,
                presentation: TaskPresentation::default(),
            }],
            inputs: vec![],
        };
        let mut visited = std::collections::HashSet::new();
        let mut order = Vec::new();
        let result = resolve_dependency_order(&config, "build", &mut visited, &mut order);
        assert!(result.is_ok());
        assert_eq!(order.len(), 1);
        assert_eq!(order[0].label, "build");
    }

    #[test]
    fn resolve_dependency_order_with_deps() {
        let config = TasksConfig {
            version: "2.0.0".to_string(),
            tasks: vec![
                TaskDefinition {
                    label: "compile".to_string(),
                    task_type: "shell".to_string(),
                    command: Some("gcc".to_string()),
                    args: vec![],
                    options: TaskOptions::default(),
                    group: None,
                    problem_matcher: None,
                    depends_on: vec![],
                    depends_order: None,
                    is_background: false,
                    presentation: TaskPresentation::default(),
                },
                TaskDefinition {
                    label: "build".to_string(),
                    task_type: "shell".to_string(),
                    command: Some("make".to_string()),
                    args: vec![],
                    options: TaskOptions::default(),
                    group: None,
                    problem_matcher: None,
                    depends_on: vec!["compile".to_string()],
                    depends_order: None,
                    is_background: false,
                    presentation: TaskPresentation::default(),
                },
            ],
            inputs: vec![],
        };
        let mut visited = std::collections::HashSet::new();
        let mut order = Vec::new();
        let result = resolve_dependency_order(&config, "build", &mut visited, &mut order);
        assert!(result.is_ok());
        assert_eq!(order.len(), 2);
        assert_eq!(order[0].label, "compile");
        assert_eq!(order[1].label, "build");
    }

    #[test]
    fn resolve_dependency_order_cycle_detection() {
        let config = TasksConfig {
            version: "2.0.0".to_string(),
            tasks: vec![
                TaskDefinition {
                    label: "a".to_string(),
                    task_type: "shell".to_string(),
                    command: Some("echo a".to_string()),
                    args: vec![],
                    options: TaskOptions::default(),
                    group: None,
                    problem_matcher: None,
                    depends_on: vec!["b".to_string()],
                    depends_order: None,
                    is_background: false,
                    presentation: TaskPresentation::default(),
                },
                TaskDefinition {
                    label: "b".to_string(),
                    task_type: "shell".to_string(),
                    command: Some("echo b".to_string()),
                    args: vec![],
                    options: TaskOptions::default(),
                    group: None,
                    problem_matcher: None,
                    depends_on: vec!["a".to_string()],
                    depends_order: None,
                    is_background: false,
                    presentation: TaskPresentation::default(),
                },
            ],
            inputs: vec![],
        };
        let mut visited = std::collections::HashSet::new();
        let mut order = Vec::new();
        let result = resolve_dependency_order(&config, "a", &mut visited, &mut order);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Circular dependency"));
    }

    #[test]
    fn resolve_dependency_order_missing_task() {
        let config = TasksConfig::default();
        let mut visited = std::collections::HashSet::new();
        let mut order = Vec::new();
        let result = resolve_dependency_order(&config, "missing", &mut visited, &mut order);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    // ---- load_tasks_config ----

    #[test]
    fn load_tasks_config_no_file_returns_default() {
        let dir = std::env::temp_dir().join("cortex_test_tasks_no_file");
        let _ = std::fs::create_dir_all(&dir);
        let result = load_tasks_config(dir.to_str().unwrap());
        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(config.version, "2.0.0");
        assert!(config.tasks.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_tasks_config_valid_file() {
        let dir = std::env::temp_dir().join("cortex_test_tasks_valid");
        let vscode_dir = dir.join(".vscode");
        let _ = std::fs::create_dir_all(&vscode_dir);
        let tasks_json = r#"{
            "version": "2.0.0",
            "tasks": [
                {
                    "label": "build",
                    "type": "shell",
                    "command": "make"
                }
            ]
        }"#;
        std::fs::write(vscode_dir.join("tasks.json"), tasks_json).unwrap();
        let result = load_tasks_config(dir.to_str().unwrap());
        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(config.tasks.len(), 1);
        assert_eq!(config.tasks[0].label, "build");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_tasks_config_with_comments() {
        let dir = std::env::temp_dir().join("cortex_test_tasks_comments");
        let vscode_dir = dir.join(".vscode");
        let _ = std::fs::create_dir_all(&vscode_dir);
        let tasks_json = r#"{
            // This is a comment
            "version": "2.0.0",
            "tasks": [] /* inline comment */
        }"#;
        std::fs::write(vscode_dir.join("tasks.json"), tasks_json).unwrap();
        let result = load_tasks_config(dir.to_str().unwrap());
        assert!(result.is_ok());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---- TaskResult serialization ----

    #[test]
    fn task_result_roundtrip() {
        let result = TaskResult {
            task_name: "build".to_string(),
            success: true,
            exit_code: Some(0),
            output: "done".to_string(),
            error: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: TaskResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.task_name, "build");
        assert!(deserialized.success);
        assert_eq!(deserialized.exit_code, Some(0));
        assert!(deserialized.error.is_none());
    }

    // ---- TaskDiagnosticEvent ----

    #[test]
    fn task_diagnostic_event_roundtrip() {
        let event = TaskDiagnosticEvent {
            task_id: "t1".to_string(),
            file: "src/main.rs".to_string(),
            line: 10,
            column: 5,
            severity: "error".to_string(),
            message: "undeclared".to_string(),
            code: Some("E0425".to_string()),
            source: "rustc".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: TaskDiagnosticEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.task_id, "t1");
        assert_eq!(deserialized.file, "src/main.rs");
        assert_eq!(deserialized.line, 10);
        assert_eq!(deserialized.code, Some("E0425".to_string()));
    }

    // ---- Problem matcher regex against real output ----

    #[test]
    fn tsc_matcher_warning() {
        let matcher = get_builtin_problem_matcher("$tsc").unwrap();
        let caps = matcher.pattern.captures(
            "src/app.ts(25,10): warning TS6133: 'x' is declared but its value is never read.",
        );
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[4], "warning");
    }

    #[test]
    fn gcc_matcher_note() {
        let matcher = get_builtin_problem_matcher("$gcc").unwrap();
        let caps = matcher.pattern.captures("main.c:5:1: note: declared here");
        assert!(caps.is_some());
        let caps = caps.unwrap();
        assert_eq!(&caps[4], "note");
    }

    #[test]
    fn gcc_matcher_no_match_on_garbage() {
        let matcher = get_builtin_problem_matcher("$gcc").unwrap();
        assert!(matcher.pattern.captures("random output").is_none());
    }

    #[test]
    fn rustc_matcher_with_extra_spaces() {
        let matcher = get_builtin_problem_matcher("$rustc").unwrap();
        let caps = matcher.pattern.captures("  --> lib/foo.rs:100:20  ");
        assert!(caps.is_some());
    }

    #[test]
    fn eslint_stylish_matcher_exists() {
        let matcher = get_builtin_problem_matcher("$eslint-stylish");
        assert!(matcher.is_some());
        assert_eq!(matcher.unwrap().name, "eslint-stylish");
    }
}
