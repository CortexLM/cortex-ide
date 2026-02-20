//! Test execution functionality

use std::path::{Component, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use uuid::Uuid;

use crate::fs::security::validate_path_safe;

const MAX_TEST_IDS: usize = 500;
const MAX_TEST_ID_LEN: usize = 512;

fn validate_project_path(project_path: &str) -> Result<PathBuf, String> {
    if project_path.trim().is_empty() {
        return Err("Project path cannot be empty".to_string());
    }
    let path = PathBuf::from(project_path);
    if !path.is_absolute() {
        return Err("Project path must be absolute".to_string());
    }
    validate_path_safe(&path)?;
    if !path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn validate_test_id(test_id: &str) -> Result<(), String> {
    if test_id.is_empty() {
        return Err("Test ID cannot be empty".to_string());
    }
    if test_id.len() > MAX_TEST_ID_LEN {
        return Err(format!(
            "Test ID exceeds maximum length of {} characters",
            MAX_TEST_ID_LEN
        ));
    }
    if test_id.starts_with('-') {
        return Err(format!(
            "Test ID must not start with '-' (potential flag injection): {}",
            test_id
        ));
    }
    if test_id.contains('\0') {
        return Err("Test ID must not contain null bytes".to_string());
    }
    if test_id.chars().any(|c| c.is_ascii_control() && c != ' ') {
        return Err("Test ID must not contain control characters".to_string());
    }
    Ok(())
}

fn validate_test_ids(test_ids: &[String]) -> Result<(), String> {
    if test_ids.len() > MAX_TEST_IDS {
        return Err(format!(
            "Too many test IDs: {} (maximum {})",
            test_ids.len(),
            MAX_TEST_IDS
        ));
    }
    for id in test_ids {
        validate_test_id(id)?;
    }
    Ok(())
}

/// Run tests with the specified framework
#[tauri::command]
pub async fn testing_run(
    project_path: String,
    framework: String,
    test_ids: Vec<String>,
    _coverage: bool,
) -> Result<serde_json::Value, String> {
    let path = validate_project_path(&project_path)?;
    validate_test_ids(&test_ids)?;

    let (command, args) = match framework.to_lowercase().as_str() {
        "jest" => ("npx", vec!["jest".to_string(), "--json".to_string()]),
        "vitest" => (
            "npx",
            vec![
                "vitest".to_string(),
                "run".to_string(),
                "--reporter=json".to_string(),
            ],
        ),
        "mocha" => (
            "npx",
            vec![
                "mocha".to_string(),
                "--reporter".to_string(),
                "json".to_string(),
            ],
        ),
        "pytest" => ("pytest", vec!["--tb=short".to_string(), "-v".to_string()]),
        "cargo" => {
            let mut args = vec!["test".to_string()];
            if !test_ids.is_empty() {
                args.extend(test_ids.iter().cloned());
            }
            args.push("--".to_string());
            args.push("--nocapture".to_string());
            ("cargo", args)
        }
        _ => return Err("Unknown framework".to_string()),
    };

    let output = crate::process_utils::async_command(command)
        .args(&args)
        .current_dir(&path)
        .output()
        .await
        .map_err(|e| format!("Failed to run tests: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(serde_json::json!({
        "success": output.status.success(),
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": output.status.code()
    }))
}

/// Glob files in a directory matching patterns
#[tauri::command]
pub async fn glob_files(
    base_path: String,
    patterns: Vec<String>,
    ignore_patterns: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    if base_path.trim().is_empty() {
        return Err("Base path cannot be empty".to_string());
    }
    let base = PathBuf::from(&base_path);
    if !base.is_absolute() {
        return Err("Base path must be absolute".to_string());
    }
    let canonical_base = validate_path_safe(&base)?;

    let mut results = Vec::new();

    let ignore = ignore_patterns.unwrap_or_default();

    for pattern in &patterns {
        let pattern_path = PathBuf::from(pattern);
        let has_traversal = pattern_path
            .components()
            .any(|c| matches!(c, Component::ParentDir));
        if has_traversal {
            return Err("Glob patterns must not contain '..' path traversal".to_string());
        }
    }

    for pattern in patterns {
        let full_pattern = base.join(&pattern);
        if let Some(pattern_str) = full_pattern.to_str() {
            if let Ok(entries) = glob::glob(pattern_str) {
                for entry in entries.flatten() {
                    let canonical_entry = entry.canonicalize().unwrap_or_else(|_| entry.clone());
                    if !canonical_entry.starts_with(&canonical_base) {
                        continue;
                    }

                    let path_str = entry.to_string_lossy().to_string();

                    let should_ignore = ignore.iter().any(|ig| {
                        path_str.contains(ig)
                            || entry
                                .file_name()
                                .and_then(|n| n.to_str())
                                .map(|n| n.contains(ig))
                                .unwrap_or(false)
                    });

                    if !should_ignore {
                        results.push(path_str);
                    }
                }
            }
        }
    }

    Ok(results)
}

/// Run a single test with streaming output
#[tauri::command]
pub async fn testing_run_streaming(
    project_path: String,
    framework: String,
    test_ids: Vec<String>,
    coverage: bool,
    app: AppHandle,
) -> Result<String, String> {
    let run_id = Uuid::new_v4().to_string();
    let path = validate_project_path(&project_path)?;
    validate_test_ids(&test_ids)?;

    // Build command based on framework
    let (program, mut args) = match framework.to_lowercase().as_str() {
        "jest" => {
            let mut args = vec!["jest".to_string()];
            if coverage {
                args.push("--coverage".to_string());
            }
            args.push("--json".to_string());
            args.push("--outputFile=.test-results.json".to_string());
            ("npx", args)
        }
        "vitest" => {
            let mut args = vec!["vitest".to_string(), "run".to_string()];
            if coverage {
                args.push("--coverage".to_string());
            }
            args.push("--reporter=json".to_string());
            ("npx", args)
        }
        "mocha" => {
            let args = vec![
                "mocha".to_string(),
                "--reporter".to_string(),
                "json".to_string(),
            ];
            ("npx", args)
        }
        "pytest" => {
            let mut args = vec!["--tb=short".to_string(), "-v".to_string()];
            if coverage {
                args.push("--cov".to_string());
            }
            ("pytest", args)
        }
        "cargo" => {
            let mut args = vec!["test".to_string()];
            args.push("--".to_string());
            args.push("--nocapture".to_string());
            ("cargo", args)
        }
        _ => return Err("Unknown framework".to_string()),
    };

    // Add test IDs/patterns
    if !test_ids.is_empty() {
        match framework.to_lowercase().as_str() {
            "jest" | "vitest" => {
                args.push("--testPathPattern".to_string());
                args.push(test_ids.join("|"));
            }
            "pytest" => {
                args.push("-k".to_string());
                args.push(test_ids.join(" or "));
            }
            "cargo" => {
                for id in test_ids {
                    args.push(id);
                }
            }
            _ => {}
        }
    }

    let run_id_clone = run_id.clone();
    let app_clone = app.clone();

    // Spawn test process with streaming output
    tokio::spawn(async move {
        let mut child = match crate::process_utils::async_command(program)
            .args(&args)
            .current_dir(&path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = app_clone.emit(
                    "testing:run-error",
                    serde_json::json!({
                        "run_id": run_id_clone,
                        "error": format!("Failed to spawn test process: {}", e),
                    }),
                );
                return;
            }
        };

        // Emit started event
        let _ = app_clone.emit(
            "testing:run-started",
            serde_json::json!({
                "run_id": run_id_clone,
                "framework": framework,
            }),
        );

        // Stream stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let app_for_stdout = app_clone.clone();
            let run_id_for_stdout = run_id_clone.clone();

            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app_for_stdout.emit(
                        "testing:output",
                        serde_json::json!({
                            "run_id": run_id_for_stdout,
                            "output": line,
                            "stream": "stdout",
                        }),
                    );
                }
            });
        }

        // Stream stderr
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let app_for_stderr = app_clone.clone();
            let run_id_for_stderr = run_id_clone.clone();

            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app_for_stderr.emit(
                        "testing:output",
                        serde_json::json!({
                            "run_id": run_id_for_stderr,
                            "output": line,
                            "stream": "stderr",
                        }),
                    );
                }
            });
        }

        // Wait for process to complete
        let status = child.wait().await;

        let exit_code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);

        let _ = app_clone.emit(
            "testing:run-complete",
            serde_json::json!({
                "run_id": run_id_clone,
                "exit_code": exit_code,
                "success": exit_code == 0,
            }),
        );
    });

    Ok(run_id)
}

/// Stop a running test process by terminal ID
///
/// This command is used by the frontend to stop tests that were
/// launched in a terminal. It sends an interrupt signal (SIGINT)
/// to terminate the test process gracefully.
#[tauri::command]
pub async fn testing_stop(terminal_id: String, app: AppHandle) -> Result<(), String> {
    if terminal_id.trim().is_empty() {
        return Err("Terminal ID cannot be empty".to_string());
    }

    // Use the terminal state to send interrupt to the test process
    let terminal_state = app
        .try_state::<crate::terminal::TerminalState>()
        .ok_or("TerminalState not available")?;

    terminal_state
        .send_interrupt(&terminal_id)
        .map_err(|e| format!("Failed to stop tests: {}", e))?;

    tracing::info!("Sent interrupt to terminal to stop tests");
    Ok(())
}
