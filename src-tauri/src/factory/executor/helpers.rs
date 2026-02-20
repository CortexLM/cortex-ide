//! Helper functions for workflow execution
//!
//! Contains utility functions for variable substitution, expression evaluation,
//! shell command execution, HTTP requests, AI calls, tool execution, and notifications.

use std::collections::HashMap;

use super::types::{AiResponse, HttpResponse, ShellOutput};

/// Substitute variables in a string using {{variable_name}} syntax
pub fn substitute_variables(
    template: &str,
    variables: &HashMap<String, serde_json::Value>,
) -> String {
    let mut result = template.to_string();

    // Find all {{variable}} patterns
    #[allow(clippy::expect_used)]
    let re = regex::Regex::new(r"\{\{([^}]+)\}\}").expect("Invalid regex pattern");

    for cap in re.captures_iter(template) {
        let full_match = &cap[0];
        let var_name = cap[1].trim();

        if let Some(value) = variables.get(var_name) {
            let replacement = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "null".to_string(),
                _ => value.to_string(),
            };
            result = result.replace(full_match, &replacement);
        }
    }

    result
}

/// Evaluate a simple expression against variables
pub fn evaluate_expression(
    expression: &str,
    variables: &HashMap<String, serde_json::Value>,
) -> bool {
    // Very simple expression evaluation
    // Just check if a variable exists and is truthy
    if let Some(value) = variables.get(expression.trim()) {
        match value {
            serde_json::Value::Bool(b) => *b,
            serde_json::Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
            serde_json::Value::String(s) => !s.is_empty(),
            serde_json::Value::Array(a) => !a.is_empty(),
            serde_json::Value::Object(o) => !o.is_empty(),
            serde_json::Value::Null => false,
        }
    } else {
        // Try to parse as a simple comparison
        expression.to_lowercase() == "true"
    }
}

/// Execute a shell command with timeout
pub async fn execute_shell_command(
    command: &str,
    cwd: Option<&str>,
    timeout_ms: u64,
) -> Result<ShellOutput, String> {
    use std::process::Stdio;

    let start = std::time::Instant::now();

    // Determine shell based on OS
    #[cfg(target_os = "windows")]
    let (shell, flag) = ("cmd", "/C");
    #[cfg(not(target_os = "windows"))]
    let (shell, flag) = ("sh", "-c");

    let mut cmd = crate::process_utils::async_command(shell);
    cmd.arg(flag).arg(command);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Wait with timeout
    let timeout = tokio::time::Duration::from_millis(timeout_ms);
    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| format!("Command timed out after {}ms", timeout_ms))?
        .map_err(|e| format!("Command execution failed: {}", e))?;

    let duration = start.elapsed().as_millis() as u64;

    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        duration_ms: duration,
    })
}

/// Execute an HTTP request
pub async fn execute_http_request(
    url: &str,
    method: &str,
    headers: &serde_json::Value,
    body: Option<&str>,
) -> Result<HttpResponse, String> {
    let start = std::time::Instant::now();

    let client = reqwest::Client::new();

    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        "PUT" => client.put(url),
        "DELETE" => client.delete(url),
        "PATCH" => client.patch(url),
        "HEAD" => client.head(url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    // Add headers
    if let serde_json::Value::Object(map) = headers {
        for (key, value) in map {
            if let serde_json::Value::String(v) = value {
                request = request.header(key.as_str(), v.as_str());
            }
        }
    }

    // Add body
    if let Some(b) = body {
        request = request.body(b.to_string());
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status_code = response.status().as_u16();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let duration = start.elapsed().as_millis() as u64;

    Ok(HttpResponse {
        status_code,
        body,
        headers: response_headers,
        duration_ms: duration,
    })
}

/// Execute an AI call
pub async fn execute_ai_call(
    model: &str,
    prompt: &str,
    system_prompt: Option<&str>,
    temperature: f64,
    max_tokens: u32,
) -> Result<AiResponse, String> {
    let start = std::time::Instant::now();

    // Build messages
    let mut messages = Vec::new();

    if let Some(system) = system_prompt {
        messages.push(serde_json::json!({
            "role": "system",
            "content": system
        }));
    }

    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));

    // Try to call OpenAI-compatible API
    // This uses the AI service configuration from the app
    let api_key = std::env::var("OPENAI_API_KEY")
        .or_else(|_| std::env::var("ANTHROPIC_API_KEY"))
        .unwrap_or_default();

    if api_key.is_empty() {
        // Fallback to simple response generation for testing
        let duration = start.elapsed().as_millis() as u64;
        return Ok(AiResponse {
            content: format!(
                "AI response placeholder for model '{}'. Prompt: {}... (No API key configured)",
                model,
                &prompt[..prompt.len().min(50)]
            ),
            tokens_used: 0,
            duration_ms: duration,
        });
    }

    // Determine API endpoint based on model
    let (api_url, is_anthropic) = if model.starts_with("claude") {
        ("https://api.anthropic.com/v1/messages", true)
    } else {
        ("https://api.openai.com/v1/chat/completions", false)
    };

    let client = reqwest::Client::new();

    let request_body = if is_anthropic {
        serde_json::json!({
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
        })
    } else {
        serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        })
    };

    let mut req = client.post(api_url).json(&request_body);

    if is_anthropic {
        req = req
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01");
    } else {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("AI API request failed: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read AI response: {}", e))?;

    if !status.is_success() {
        return Err(format!("AI API error ({}): {}", status, response_text));
    }

    let json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    // Extract content based on API type
    let content = if is_anthropic {
        json["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string()
    } else {
        json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string()
    };

    let tokens_used = if is_anthropic {
        json["usage"]["input_tokens"].as_u64().unwrap_or(0)
            + json["usage"]["output_tokens"].as_u64().unwrap_or(0)
    } else {
        json["usage"]["total_tokens"].as_u64().unwrap_or(0)
    } as u32;

    let duration = start.elapsed().as_millis() as u64;

    Ok(AiResponse {
        content,
        tokens_used,
        duration_ms: duration,
    })
}

/// Execute a tool (MCP/ACP integration)
pub async fn execute_tool(
    tool_name: &str,
    input: &serde_json::Value,
    _variables: &HashMap<String, serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Built-in tools
    match tool_name {
        "json_parse" => {
            let text = input
                .get("text")
                .and_then(|v| v.as_str())
                .ok_or("json_parse requires 'text' input")?;
            serde_json::from_str(text).map_err(|e| format!("JSON parse error: {}", e))
        }
        "json_stringify" => {
            let data = input
                .get("data")
                .ok_or("json_stringify requires 'data' input")?;
            let pretty = input
                .get("pretty")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if pretty {
                Ok(serde_json::Value::String(
                    serde_json::to_string_pretty(data)
                        .map_err(|e| format!("JSON stringify error: {}", e))?,
                ))
            } else {
                Ok(serde_json::Value::String(
                    serde_json::to_string(data)
                        .map_err(|e| format!("JSON stringify error: {}", e))?,
                ))
            }
        }
        "regex_match" => {
            let text = input
                .get("text")
                .and_then(|v| v.as_str())
                .ok_or("regex_match requires 'text' input")?;
            let pattern = input
                .get("pattern")
                .and_then(|v| v.as_str())
                .ok_or("regex_match requires 'pattern' input")?;
            let re = regex::Regex::new(pattern).map_err(|e| format!("Invalid regex: {}", e))?;
            let matches: Vec<String> = re.find_iter(text).map(|m| m.as_str().to_string()).collect();
            Ok(serde_json::json!({ "matches": matches }))
        }
        "env_get" => {
            let key = input
                .get("key")
                .and_then(|v| v.as_str())
                .ok_or("env_get requires 'key' input")?;
            let value = std::env::var(key).ok();
            Ok(serde_json::json!({ "value": value }))
        }
        "timestamp" => {
            let format = input
                .get("format")
                .and_then(|v| v.as_str())
                .unwrap_or("iso");
            let now = chrono::Utc::now();
            let formatted = match format {
                "iso" => now.to_rfc3339(),
                "unix" => now.timestamp().to_string(),
                "unix_ms" => now.timestamp_millis().to_string(),
                custom => now.format(custom).to_string(),
            };
            Ok(serde_json::Value::String(formatted))
        }
        "uuid" => Ok(serde_json::Value::String(uuid::Uuid::new_v4().to_string())),
        _ => {
            // Unknown tool - could be extended via MCP servers
            Err(format!("Unknown tool: {}", tool_name))
        }
    }
}

/// Send a notification
pub async fn send_notification(title: &str, message: &str, channel: &str) -> Result<(), String> {
    // Use tauri notification plugin if available
    // For now, just log the notification
    tracing::info!(target: "factory",
        "Notification [{}]: {} - {}",
        channel, title, message
    );
    Ok(())
}

/// Get current timestamp in milliseconds
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
