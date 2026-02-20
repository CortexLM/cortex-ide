//! Single test execution functionality

use std::path::{Path, PathBuf};

use super::detection::detect_framework_from_path;
use super::types::{TestFramework, TestResult, TestStatus};

/// Run a single test by name
#[tauri::command]
pub async fn testing_run_single_test(
    file_path: String,
    test_name: String,
    line_number: u32,
    debug: bool,
) -> Result<TestResult, String> {
    let path = PathBuf::from(&file_path);

    // Get the project directory (parent of the test file, or search for project root)
    let project_dir =
        find_project_root(&path).unwrap_or_else(|| path.parent().unwrap_or(&path).to_path_buf());

    // Detect framework from file path
    let framework = detect_framework_from_path(&file_path);

    // Build command based on framework
    let (program, args) = match framework {
        TestFramework::Jest => build_jest_command(&file_path, &test_name, debug),
        TestFramework::Vitest => build_vitest_command(&file_path, &test_name, debug),
        TestFramework::Pytest => build_pytest_command(&file_path, &test_name, line_number, debug),
        TestFramework::Cargo => build_cargo_command(&test_name, debug),
        TestFramework::Mocha => build_mocha_command(&file_path, &test_name, debug),
        TestFramework::Unknown => {
            // Try to detect Go tests
            if file_path.ends_with("_test.go") {
                build_go_command(&file_path, &test_name, debug)
            } else {
                return Err(format!(
                    "Could not detect test framework for file: {}",
                    file_path
                ));
            }
        }
    };

    let start_time = std::time::Instant::now();

    // Execute the command
    let output = crate::process_utils::async_command(&program)
        .args(&args)
        .current_dir(&project_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to run test command '{}': {}", program, e))?;

    let duration_ms = start_time.elapsed().as_millis() as u64;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Combine output
    let combined_output = if stderr.is_empty() {
        stdout.clone()
    } else if stdout.is_empty() {
        stderr.clone()
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    // Parse the result
    let (status, error_message, stack_trace) =
        parse_test_output(&framework, output.status.success(), &stdout, &stderr);

    Ok(TestResult {
        test_name,
        file_path,
        status,
        duration_ms: Some(duration_ms),
        output: combined_output,
        error_message,
        stack_trace,
    })
}

/// Find the project root by looking for common project files
fn find_project_root(start_path: &Path) -> Option<PathBuf> {
    let mut current = if start_path.is_file() {
        start_path.parent()?.to_path_buf()
    } else {
        start_path.to_path_buf()
    };

    let project_markers = [
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "setup.py",
        "go.mod",
        ".git",
    ];

    loop {
        for marker in &project_markers {
            if current.join(marker).exists() {
                return Some(current);
            }
        }

        if !current.pop() {
            break;
        }
    }

    None
}

/// Build Jest command for running a single test
fn build_jest_command(file_path: &str, test_name: &str, debug: bool) -> (String, Vec<String>) {
    let mut args = vec![
        "jest".to_string(),
        file_path.to_string(),
        "--testNamePattern".to_string(),
        format!("^{}$", regex::escape(test_name)),
        "--no-coverage".to_string(),
    ];

    if debug {
        args.insert(0, "--inspect-brk".to_string());
    }

    ("npx".to_string(), args)
}

/// Build Vitest command for running a single test
fn build_vitest_command(file_path: &str, test_name: &str, debug: bool) -> (String, Vec<String>) {
    let mut args = vec![
        "vitest".to_string(),
        "run".to_string(),
        file_path.to_string(),
        "--testNamePattern".to_string(),
        format!("^{}$", regex::escape(test_name)),
    ];

    if debug {
        args.insert(0, "--inspect-brk".to_string());
    }

    ("npx".to_string(), args)
}

/// Build Pytest command for running a single test
fn build_pytest_command(
    file_path: &str,
    test_name: &str,
    _line_number: u32,
    debug: bool,
) -> (String, Vec<String>) {
    // Pytest can run specific tests with file::test_name or -k pattern
    let mut args = vec![
        format!("{}::{}", file_path, test_name),
        "-v".to_string(),
        "--tb=short".to_string(),
    ];

    if debug {
        // Use pytest with debugger
        args.insert(0, "--pdb".to_string());
    }

    ("pytest".to_string(), args)
}

/// Build Cargo test command for running a single test
fn build_cargo_command(test_name: &str, debug: bool) -> (String, Vec<String>) {
    let mut args = vec![
        "test".to_string(),
        test_name.to_string(),
        "--".to_string(),
        "--exact".to_string(),
        "--nocapture".to_string(),
    ];

    if debug {
        // For Rust debugging, we'd typically need to compile with debug symbols
        // and attach a debugger separately. Add test-threads=1 for easier debugging.
        args.push("--test-threads=1".to_string());
    }

    ("cargo".to_string(), args)
}

/// Build Mocha command for running a single test
fn build_mocha_command(file_path: &str, test_name: &str, debug: bool) -> (String, Vec<String>) {
    let mut args = vec![
        "mocha".to_string(),
        file_path.to_string(),
        "--grep".to_string(),
        format!("^{}$", regex::escape(test_name)),
    ];

    if debug {
        args.insert(0, "--inspect-brk".to_string());
    }

    ("npx".to_string(), args)
}

/// Build Go test command for running a single test
fn build_go_command(file_path: &str, test_name: &str, debug: bool) -> (String, Vec<String>) {
    let path = PathBuf::from(file_path);
    let package_dir = path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());

    let args = vec![
        "test".to_string(),
        "-v".to_string(),
        "-run".to_string(),
        format!("^{}$", test_name),
        format!("./{}", package_dir),
    ];

    if debug {
        // Use delve for Go debugging
        return (
            "dlv".to_string(),
            vec![
                "test".to_string(),
                format!("./{}", package_dir),
                "--".to_string(),
                "-test.run".to_string(),
                format!("^{}$", test_name),
            ],
        );
    }

    ("go".to_string(), args)
}

/// Parse test output to determine status and extract error information
fn parse_test_output(
    framework: &TestFramework,
    success: bool,
    stdout: &str,
    stderr: &str,
) -> (TestStatus, Option<String>, Option<String>) {
    if success {
        return (TestStatus::Passed, None, None);
    }

    let combined = format!("{}\n{}", stdout, stderr);

    // Try to extract error message and stack trace based on framework
    let (error_message, stack_trace) = match framework {
        TestFramework::Jest | TestFramework::Vitest | TestFramework::Mocha => {
            parse_js_test_error(&combined)
        }
        TestFramework::Pytest => parse_pytest_error(&combined),
        TestFramework::Cargo => parse_cargo_test_error(&combined),
        TestFramework::Unknown => {
            // Generic parsing - look for common patterns
            parse_generic_error(&combined)
        }
    };

    // Check if test was skipped
    let status = if combined.contains("skipped")
        || combined.contains("pending")
        || combined.contains("todo")
    {
        TestStatus::Skipped
    } else {
        TestStatus::Failed
    };

    (status, error_message, stack_trace)
}

/// Parse JavaScript test framework error output
fn parse_js_test_error(output: &str) -> (Option<String>, Option<String>) {
    let mut error_message = None;
    let mut stack_trace = None;

    // Look for assertion error patterns
    for line in output.lines() {
        let trimmed = line.trim();

        // Jest/Vitest error patterns
        if (trimmed.starts_with("Expected:")
            || trimmed.starts_with("Received:")
            || trimmed.starts_with("expect(")
            || trimmed.contains("AssertionError")
            || trimmed.contains("Error:"))
            && error_message.is_none()
        {
            error_message = Some(trimmed.to_string());
        }

        // Stack trace starts with "at "
        if trimmed.starts_with("at ") {
            if stack_trace.is_none() {
                stack_trace = Some(String::new());
            }
            if let Some(ref mut trace) = stack_trace {
                trace.push_str(trimmed);
                trace.push('\n');
            }
        }
    }

    (error_message, stack_trace)
}

/// Parse Pytest error output
fn parse_pytest_error(output: &str) -> (Option<String>, Option<String>) {
    let mut error_message = None;
    let mut stack_trace = None;
    let mut in_traceback = false;

    for line in output.lines() {
        let trimmed = line.trim();

        // Pytest assertion patterns
        if (trimmed.starts_with("AssertionError")
            || trimmed.starts_with("E       ")
            || trimmed.contains("assert "))
            && error_message.is_none()
        {
            error_message = Some(trimmed.trim_start_matches("E       ").to_string());
        }

        // Traceback
        if trimmed.starts_with("Traceback") || trimmed.starts_with(">") || in_traceback {
            in_traceback = true;
            if stack_trace.is_none() {
                stack_trace = Some(String::new());
            }
            if let Some(ref mut trace) = stack_trace {
                trace.push_str(line);
                trace.push('\n');
            }
        }
    }

    (error_message, stack_trace)
}

/// Parse Cargo test error output
fn parse_cargo_test_error(output: &str) -> (Option<String>, Option<String>) {
    let mut error_message = None;
    let mut stack_trace = None;
    let mut in_panic = false;

    for line in output.lines() {
        let trimmed = line.trim();

        // Rust panic/assertion patterns
        if trimmed.starts_with("thread '") && trimmed.contains("panicked at") {
            error_message = Some(trimmed.to_string());
            in_panic = true;
        } else if (trimmed.starts_with("assertion")
            || trimmed.contains("left:")
            || trimmed.contains("right:"))
            && error_message.is_none()
        {
            error_message = Some(trimmed.to_string());
        }

        // Stack backtrace
        if in_panic
            && (trimmed.contains("stack backtrace:")
                || trimmed.starts_with("   ") && trimmed.contains("at "))
        {
            if stack_trace.is_none() {
                stack_trace = Some(String::new());
            }
            if let Some(ref mut trace) = stack_trace {
                trace.push_str(line);
                trace.push('\n');
            }
        }
    }

    (error_message, stack_trace)
}

/// Generic error parsing for unknown frameworks
fn parse_generic_error(output: &str) -> (Option<String>, Option<String>) {
    let mut error_message = None;

    for line in output.lines() {
        let trimmed = line.trim();

        // Common error patterns
        if trimmed.contains("FAIL")
            || trimmed.contains("Error")
            || trimmed.contains("error")
            || trimmed.contains("failed")
        {
            if error_message.is_none() {
                error_message = Some(trimmed.to_string());
            }
            break;
        }
    }

    (error_message, None)
}
