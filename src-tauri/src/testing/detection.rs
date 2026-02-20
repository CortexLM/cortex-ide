//! Framework detection functionality

use std::path::{Path, PathBuf};
use tokio::fs;

use super::types::{FrameworkDetection, TestFramework};

/// Detect the test framework used in a project
#[tauri::command]
pub async fn testing_detect_framework(project_path: String) -> Result<FrameworkDetection, String> {
    let path = PathBuf::from(&project_path);

    // Check for package.json (JS/TS projects)
    let package_json_path = path.join("package.json");
    if package_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&package_json_path).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let deps = json
                    .get("dependencies")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                let dev_deps = json
                    .get("devDependencies")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);

                // Check for Vitest
                if dev_deps.get("vitest").is_some() || deps.get("vitest").is_some() {
                    let config = find_config_file(
                        &path,
                        &["vitest.config.ts", "vitest.config.js", "vite.config.ts"],
                    )
                    .await;
                    return Ok(FrameworkDetection {
                        framework: TestFramework::Vitest,
                        config_file: config,
                    });
                }

                // Check for Jest
                if dev_deps.get("jest").is_some() || deps.get("jest").is_some() {
                    let config = find_config_file(
                        &path,
                        &["jest.config.js", "jest.config.ts", "jest.config.json"],
                    )
                    .await;
                    return Ok(FrameworkDetection {
                        framework: TestFramework::Jest,
                        config_file: config,
                    });
                }

                // Check for Mocha
                if dev_deps.get("mocha").is_some() || deps.get("mocha").is_some() {
                    let config =
                        find_config_file(&path, &[".mocharc.json", ".mocharc.js", ".mocharc.yml"])
                            .await;
                    return Ok(FrameworkDetection {
                        framework: TestFramework::Mocha,
                        config_file: config,
                    });
                }
            }
        }
    }

    // Check for Cargo.toml (Rust projects)
    if path.join("Cargo.toml").exists() {
        return Ok(FrameworkDetection {
            framework: TestFramework::Cargo,
            config_file: Some("Cargo.toml".to_string()),
        });
    }

    // Check for pytest (Python projects)
    let pytest_configs = ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"];
    for config in pytest_configs {
        if path.join(config).exists() {
            return Ok(FrameworkDetection {
                framework: TestFramework::Pytest,
                config_file: Some(config.to_string()),
            });
        }
    }

    Ok(FrameworkDetection {
        framework: TestFramework::Unknown,
        config_file: None,
    })
}

/// Find a config file from candidates
pub async fn find_config_file(base_path: &Path, candidates: &[&str]) -> Option<String> {
    for candidate in candidates {
        if base_path.join(candidate).exists() {
            return Some(candidate.to_string());
        }
    }
    None
}

/// Detect framework from file path extension and patterns
pub fn detect_framework_from_path(file_path: &str) -> TestFramework {
    let path_lower = file_path.to_lowercase();

    // Rust tests
    if path_lower.ends_with(".rs") {
        return TestFramework::Cargo;
    }

    // Python tests
    if path_lower.ends_with(".py") {
        return TestFramework::Pytest;
    }

    // Go tests
    if path_lower.ends_with("_test.go") {
        return TestFramework::Unknown; // Go framework - handle specially
    }

    // JavaScript/TypeScript tests - check for vitest/jest indicators
    if path_lower.ends_with(".test.ts")
        || path_lower.ends_with(".test.tsx")
        || path_lower.ends_with(".test.js")
        || path_lower.ends_with(".test.jsx")
        || path_lower.ends_with(".spec.ts")
        || path_lower.ends_with(".spec.tsx")
        || path_lower.ends_with(".spec.js")
        || path_lower.ends_with(".spec.jsx")
    {
        // Default to Vitest, but could be Jest - caller should specify if needed
        return TestFramework::Vitest;
    }

    TestFramework::Unknown
}
