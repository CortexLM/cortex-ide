//! ACP Tool Executor
//!
//! Executes tools with sandbox restrictions and timeout handling.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::time::timeout;

use super::types::{
    ACPTool, ToolExecutionResult, ToolPermission, ToolResultContent, ToolSandboxConfig,
};

/// Execute a tool with the given arguments
pub async fn execute_tool(
    tool: &ACPTool,
    arguments: serde_json::Value,
    sandbox_config: &ToolSandboxConfig,
    execution_id: &str,
) -> ToolExecutionResult {
    let result = ToolExecutionResult::new(execution_id.to_string(), tool.id.clone());

    // Check permissions against sandbox config
    if let Err(e) = check_permissions(tool, sandbox_config) {
        return result.error(e, Some("PERMISSION_DENIED".into()));
    }

    // Get handler and execute
    let handler = match &tool.handler {
        Some(h) => h,
        None => return result.error("Tool has no handler defined", Some("NO_HANDLER".into())),
    };

    let timeout_duration = Duration::from_millis(sandbox_config.timeout);

    match timeout(
        timeout_duration,
        execute_handler(handler, &arguments, sandbox_config),
    )
    .await
    {
        Ok(Ok(content)) => result.completed(content),
        Ok(Err(e)) => result.error(e, Some("EXECUTION_ERROR".into())),
        Err(_) => result.error(
            format!("Execution timed out after {}ms", sandbox_config.timeout),
            Some("TIMEOUT".into()),
        ),
    }
}

/// Check tool permissions against sandbox configuration
fn check_permissions(tool: &ACPTool, sandbox: &ToolSandboxConfig) -> Result<(), String> {
    for permission in &tool.permissions {
        match permission {
            ToolPermission::Network if !sandbox.allow_network => {
                return Err("Network access is not allowed in sandbox".into());
            }
            ToolPermission::Filesystem if !sandbox.allow_filesystem => {
                return Err("Filesystem access is not allowed in sandbox".into());
            }
            ToolPermission::Execute if !sandbox.allow_execution => {
                return Err("Command execution is not allowed in sandbox".into());
            }
            _ => {}
        }
    }
    Ok(())
}

/// Execute a tool handler
async fn execute_handler(
    handler: &str,
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if handler.starts_with("builtin:") {
        execute_builtin(handler, arguments, sandbox).await
    } else if handler.starts_with("command:") {
        execute_command(handler, arguments, sandbox).await
    } else {
        Err(format!("Unknown handler type: {}", handler))
    }
}

/// Execute a built-in tool handler
async fn execute_builtin(
    handler: &str,
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    let tool_name = handler.strip_prefix("builtin:").unwrap_or(handler);

    match tool_name {
        "read-file" => execute_read_file(arguments, sandbox).await,
        "write-file" => execute_write_file(arguments, sandbox).await,
        "list-directory" => execute_list_directory(arguments, sandbox).await,
        "execute-command" => execute_shell_command(arguments, sandbox).await,
        "http-request" => execute_http_request(arguments, sandbox).await,
        "search-files" => execute_search_files(arguments, sandbox).await,
        _ => Err(format!("Unknown builtin tool: {}", tool_name)),
    }
}

/// Execute a command-based handler
async fn execute_command(
    handler: &str,
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    let command_str = handler.strip_prefix("command:").unwrap_or(handler);
    let parts: Vec<&str> = command_str.split_whitespace().collect();

    if parts.is_empty() {
        return Err("Empty command".into());
    }

    let program = parts[0];
    let args: Vec<&str> = parts[1..].to_vec();

    let mut cmd = crate::process_utils::async_command(program);
    cmd.args(&args);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    if let Some(cwd) = &sandbox.working_directory {
        cmd.current_dir(cwd);
    }

    if let Some(env) = &sandbox.environment {
        for (key, value) in env {
            cmd.env(key, value);
        }
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Write arguments as JSON to stdin
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let json = serde_json::to_string(arguments).unwrap_or_default();
        let _ = stdin.write_all(json.as_bytes()).await;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        let mut content = vec![ToolResultContent::text(stdout)];
        if !stderr.is_empty() {
            content.push(ToolResultContent::text(format!("stderr: {}", stderr)));
        }
        Ok(content)
    } else {
        Err(format!(
            "Command failed with exit code {:?}: {}",
            output.status.code(),
            stderr
        ))
    }
}

// =====================
// Builtin Tool Implementations
// =====================

async fn execute_read_file(
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if !sandbox.allow_filesystem {
        return Err("Filesystem access not allowed".into());
    }

    let path = arguments
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: path")?;

    let path = resolve_path(path, sandbox)?;

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Check output size
    if content.len() > sandbox.max_output_size {
        return Err(format!(
            "Output exceeds maximum size ({} > {})",
            content.len(),
            sandbox.max_output_size
        ));
    }

    Ok(vec![ToolResultContent::text(content)])
}

async fn execute_write_file(
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if !sandbox.allow_filesystem {
        return Err("Filesystem access not allowed".into());
    }

    let path = arguments
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: path")?;

    let content = arguments
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: content")?;

    let path = resolve_path(path, sandbox)?;

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(vec![ToolResultContent::text(format!(
        "Successfully wrote {} bytes to {}",
        content.len(),
        path.display()
    ))])
}

async fn execute_list_directory(
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if !sandbox.allow_filesystem {
        return Err("Filesystem access not allowed".into());
    }

    let path = arguments
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: path")?;

    let recursive = arguments
        .get("recursive")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let path = resolve_path(path, sandbox)?;

    let entries = if recursive {
        list_directory_recursive(&path, sandbox.max_output_size / 100).await?
    } else {
        list_directory_flat(&path).await?
    };

    Ok(vec![ToolResultContent::json(serde_json::json!({
        "path": path.display().to_string(),
        "entries": entries
    }))])
}

async fn list_directory_flat(path: &PathBuf) -> Result<Vec<serde_json::Value>, String> {
    let mut entries = Vec::new();
    let mut read_dir = tokio::fs::read_dir(path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let metadata = entry.metadata().await.ok();
        entries.push(serde_json::json!({
            "name": entry.file_name().to_string_lossy(),
            "path": entry.path().display().to_string(),
            "isDirectory": metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            "size": metadata.as_ref().map(|m| m.len()).unwrap_or(0),
        }));
    }

    Ok(entries)
}

async fn list_directory_recursive(
    path: &Path,
    max_entries: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let mut entries = Vec::new();
    let mut stack = vec![path.to_path_buf()];

    while let Some(current) = stack.pop() {
        if entries.len() >= max_entries {
            break;
        }

        let mut read_dir = match tokio::fs::read_dir(&current).await {
            Ok(rd) => rd,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = read_dir.next_entry().await {
            if entries.len() >= max_entries {
                break;
            }

            let metadata = entry.metadata().await.ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);

            entries.push(serde_json::json!({
                "name": entry.file_name().to_string_lossy(),
                "path": entry.path().display().to_string(),
                "isDirectory": is_dir,
                "size": metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            }));

            if is_dir {
                stack.push(entry.path());
            }
        }
    }

    Ok(entries)
}

async fn execute_shell_command(
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if !sandbox.allow_execution {
        return Err("Command execution not allowed".into());
    }

    let command = arguments
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: command")?;

    let args: Vec<String> = arguments
        .get("args")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let cwd = arguments
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or_else(|| sandbox.working_directory.clone());

    let mut cmd = crate::process_utils::async_command(command);
    cmd.args(&args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    if let Some(cwd) = cwd {
        cmd.current_dir(cwd);
    }

    if let Some(env) = &sandbox.environment {
        for (key, value) in env {
            cmd.env(key, value);
        }
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Truncate if too large
    let stdout = if stdout.len() > sandbox.max_output_size {
        format!(
            "{}... (truncated)",
            &stdout[..sandbox.max_output_size.min(stdout.len())]
        )
    } else {
        stdout
    };

    Ok(vec![ToolResultContent::json(serde_json::json!({
        "exitCode": output.status.code(),
        "stdout": stdout,
        "stderr": stderr,
        "success": output.status.success()
    }))])
}

async fn execute_http_request(
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if !sandbox.allow_network {
        return Err("Network access not allowed".into());
    }

    let url = arguments
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: url")?;

    let method = arguments
        .get("method")
        .and_then(|v| v.as_str())
        .unwrap_or("GET")
        .to_uppercase();

    let headers: HashMap<String, String> = arguments
        .get("headers")
        .and_then(|v| v.as_object())
        .map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();

    let body = arguments.get("body").and_then(|v| v.as_str());

    let client = reqwest::Client::new();

    let mut request = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        "PUT" => client.put(url),
        "DELETE" => client.delete(url),
        "PATCH" => client.patch(url),
        "HEAD" => client.head(url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    for (key, value) in headers {
        request = request.header(&key, &value);
    }

    if let Some(body_str) = body {
        request = request.body(body_str.to_string());
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = response.status().as_u16();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Truncate if too large
    let body_text = if body_text.len() > sandbox.max_output_size {
        format!(
            "{}... (truncated)",
            &body_text[..sandbox.max_output_size.min(body_text.len())]
        )
    } else {
        body_text
    };

    Ok(vec![ToolResultContent::json(serde_json::json!({
        "status": status,
        "headers": response_headers,
        "body": body_text
    }))])
}

async fn execute_search_files(
    arguments: &serde_json::Value,
    sandbox: &ToolSandboxConfig,
) -> Result<Vec<ToolResultContent>, String> {
    if !sandbox.allow_filesystem {
        return Err("Filesystem access not allowed".into());
    }

    let pattern = arguments
        .get("pattern")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: pattern")?;

    let directory = arguments
        .get("directory")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or_else(|| sandbox.working_directory.clone())
        .unwrap_or_else(|| ".".to_string());

    let max_results = arguments
        .get("maxResults")
        .and_then(|v| v.as_u64())
        .unwrap_or(100) as usize;

    let directory = resolve_path(&directory, sandbox)?;

    let glob_pattern = format!("{}/{}", directory.display(), pattern);
    let mut matches = Vec::new();

    for entry in glob::glob(&glob_pattern).map_err(|e| format!("Invalid glob pattern: {}", e))? {
        if matches.len() >= max_results {
            break;
        }

        if let Ok(path) = entry {
            let metadata = tokio::fs::metadata(&path).await.ok();
            matches.push(serde_json::json!({
                "path": path.display().to_string(),
                "isDirectory": metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                "size": metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            }));
        }
    }

    Ok(vec![ToolResultContent::json(serde_json::json!({
        "pattern": pattern,
        "directory": directory.display().to_string(),
        "matches": matches,
        "totalFound": matches.len()
    }))])
}

/// Resolve and validate a file path
fn resolve_path(path: &str, sandbox: &ToolSandboxConfig) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);

    // If path is relative, resolve against working directory
    let resolved = if path.is_relative() {
        if let Some(cwd) = &sandbox.working_directory {
            PathBuf::from(cwd).join(&path)
        } else {
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
                .join(&path)
        }
    } else {
        path
    };

    // Canonicalize to resolve symlinks and .. components
    let canonical = resolved
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path '{}': {}", resolved.display(), e))?;

    // Security: Validate path is within allowed directories
    let is_allowed = if let Some(cwd) = &sandbox.working_directory {
        let cwd_canonical = PathBuf::from(cwd)
            .canonicalize()
            .map_err(|e| format!("Failed to resolve working directory: {}", e))?;
        canonical.starts_with(&cwd_canonical)
    } else {
        // If no working directory set, allow current directory and subdirs
        let current = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        let current_canonical = current
            .canonicalize()
            .map_err(|e| format!("Failed to resolve current directory: {}", e))?;
        canonical.starts_with(&current_canonical)
    };

    if !is_allowed {
        return Err(format!(
            "Path traversal detected: '{}' is outside allowed directory",
            canonical.display()
        ));
    }

    Ok(canonical)
}
