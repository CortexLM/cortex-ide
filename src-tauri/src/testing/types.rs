//! Core types for the testing module

use serde::{Deserialize, Serialize};

/// Test framework types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TestFramework {
    Jest,
    Vitest,
    Mocha,
    Pytest,
    Cargo,
    Unknown,
}

/// A discovered test item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestItem {
    pub id: String,
    pub label: String,
    pub file_path: Option<String>,
    pub line: Option<u32>,
    pub children: Vec<TestItem>,
    pub kind: TestItemKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestItemKind {
    File,
    Suite,
    Test,
}

/// Test run result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestRunResult {
    pub test_id: String,
    pub status: TestStatus,
    pub duration_ms: Option<u64>,
    pub message: Option<String>,
    pub stack_trace: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
    Running,
    Pending,
}

/// Framework detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkDetection {
    pub framework: TestFramework,
    pub config_file: Option<String>,
}

/// Result from running a single test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub test_name: String,
    pub file_path: String,
    pub status: TestStatus,
    pub duration_ms: Option<u64>,
    pub output: String,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
}
