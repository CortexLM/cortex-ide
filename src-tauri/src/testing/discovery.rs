//! Test discovery functionality

use std::path::PathBuf;

use super::types::{TestFramework, TestItem, TestItemKind};

/// Discover tests in a project
#[tauri::command]
pub async fn testing_discover(
    project_path: String,
    framework: String,
    patterns: Vec<String>,
) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(&project_path);
    let framework = match framework.to_lowercase().as_str() {
        "jest" => TestFramework::Jest,
        "vitest" => TestFramework::Vitest,
        "mocha" => TestFramework::Mocha,
        "pytest" => TestFramework::Pytest,
        "cargo" => TestFramework::Cargo,
        _ => TestFramework::Unknown,
    };

    let tests = match framework {
        TestFramework::Jest | TestFramework::Vitest => discover_js_tests(&path, &patterns).await?,
        TestFramework::Cargo => discover_cargo_tests(&path).await?,
        TestFramework::Pytest => discover_pytest_tests(&path).await?,
        _ => vec![],
    };

    Ok(serde_json::json!({ "tests": tests }))
}

/// Discover JavaScript/TypeScript tests by scanning files
async fn discover_js_tests(path: &PathBuf, patterns: &[String]) -> Result<Vec<TestItem>, String> {
    let mut tests = Vec::new();

    // Default patterns if none provided
    let default_patterns = vec![
        "**/*.test.ts".to_string(),
        "**/*.test.tsx".to_string(),
        "**/*.test.js".to_string(),
        "**/*.test.jsx".to_string(),
        "**/*.spec.ts".to_string(),
        "**/*.spec.tsx".to_string(),
        "**/*.spec.js".to_string(),
        "**/*.spec.jsx".to_string(),
    ];

    let patterns_to_use = if patterns.is_empty() {
        &default_patterns
    } else {
        patterns
    };

    // Use glob to find test files
    for pattern in patterns_to_use {
        let full_pattern = path.join(pattern);
        if let Some(pattern_str) = full_pattern.to_str() {
            if let Ok(entries) = glob::glob(pattern_str) {
                for entry in entries.flatten() {
                    let relative_path = entry.strip_prefix(path).unwrap_or(&entry);
                    let file_name = entry
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown");

                    tests.push(TestItem {
                        id: relative_path.to_string_lossy().to_string(),
                        label: file_name.to_string(),
                        file_path: Some(entry.to_string_lossy().to_string()),
                        line: None,
                        children: vec![],
                        kind: TestItemKind::File,
                    });
                }
            }
        }
    }

    Ok(tests)
}

/// Discover Rust tests using cargo test --list
async fn discover_cargo_tests(path: &PathBuf) -> Result<Vec<TestItem>, String> {
    let output = crate::process_utils::async_command("cargo")
        .args(["test", "--", "--list"])
        .current_dir(path)
        .output()
        .await
        .map_err(|e| format!("Failed to run cargo test --list: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tests = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.ends_with(": test") {
            let test_name = line.trim_end_matches(": test").to_string();
            tests.push(TestItem {
                id: test_name.clone(),
                label: test_name
                    .split("::")
                    .last()
                    .unwrap_or(&test_name)
                    .to_string(),
                file_path: None,
                line: None,
                children: vec![],
                kind: TestItemKind::Test,
            });
        }
    }

    Ok(tests)
}

/// Discover Python tests using pytest --collect-only
async fn discover_pytest_tests(path: &PathBuf) -> Result<Vec<TestItem>, String> {
    let output = crate::process_utils::async_command("pytest")
        .args(["--collect-only", "-q"])
        .current_dir(path)
        .output()
        .await
        .map_err(|e| format!("Failed to run pytest --collect-only: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tests = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.contains("::") && !line.starts_with("=") && !line.starts_with("-") {
            tests.push(TestItem {
                id: line.to_string(),
                label: line.split("::").last().unwrap_or(line).to_string(),
                file_path: line.split("::").next().map(|s| s.to_string()),
                line: None,
                children: vec![],
                kind: TestItemKind::Test,
            });
        }
    }

    Ok(tests)
}
