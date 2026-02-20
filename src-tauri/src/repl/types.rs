//! REPL types and data structures

use serde::{Deserialize, Serialize};

/// Status of a kernel
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum KernelStatus {
    Starting,
    Idle,
    Busy,
    Restarting,
    ShuttingDown,
    Shutdown,
    Error,
}

impl Default for KernelStatus {
    fn default() -> Self {
        KernelStatus::Idle
    }
}

/// Type of kernel
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum KernelType {
    Python,
    Node,
    Jupyter,
}

/// Kernel specification describing an available kernel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelSpec {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub language: String,
    pub kernel_type: KernelType,
    pub executable: Option<String>,
}

/// Information about a running kernel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelInfo {
    pub id: String,
    pub spec: KernelSpec,
    pub status: KernelStatus,
    pub execution_count: u32,
}

/// A cell in the REPL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub id: String,
    pub input: String,
    pub outputs: Vec<CellOutput>,
    pub execution_count: Option<u32>,
    pub status: CellStatus,
    pub created_at: u64,
    pub executed_at: Option<u64>,
}

/// Status of a cell
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CellStatus {
    Pending,
    Running,
    Success,
    Error,
}

impl Default for CellStatus {
    fn default() -> Self {
        CellStatus::Pending
    }
}

/// Output from a cell execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellOutput {
    pub output_type: OutputType,
    pub content: OutputContent,
    pub timestamp: u64,
}

/// Type of output
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OutputType {
    Stdout,
    Stderr,
    Result,
    Error,
    Display,
}

/// Content of an output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum OutputContent {
    #[serde(rename = "text")]
    Text(String),
    #[serde(rename = "html")]
    Html(String),
    #[serde(rename = "image")]
    Image { mime_type: String, data: String },
    #[serde(rename = "json")]
    Json(serde_json::Value),
    #[serde(rename = "error")]
    Error {
        name: String,
        message: String,
        traceback: Vec<String>,
    },
}

/// Request to execute code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub kernel_id: String,
    pub code: String,
    pub cell_id: String,
}

/// Response from code execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteResponse {
    pub cell_id: String,
    pub execution_count: u32,
    pub status: CellStatus,
    pub outputs: Vec<CellOutput>,
}

/// Variable in the kernel's namespace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub name: String,
    pub value_type: String,
    pub value_repr: String,
    pub is_function: bool,
    pub is_module: bool,
}

/// Kernel event emitted during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum KernelEvent {
    #[serde(rename = "status")]
    Status {
        kernel_id: String,
        status: KernelStatus,
    },
    #[serde(rename = "output")]
    Output {
        kernel_id: String,
        cell_id: String,
        output: CellOutput,
    },
    #[serde(rename = "result")]
    Result {
        kernel_id: String,
        cell_id: String,
        result: ExecuteResponse,
    },
    #[serde(rename = "error")]
    Error {
        kernel_id: String,
        cell_id: Option<String>,
        error: String,
    },
    #[serde(rename = "variables")]
    Variables {
        kernel_id: String,
        variables: Vec<Variable>,
    },
}

/// Notebook export format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookExport {
    pub metadata: NotebookMetadata,
    pub cells: Vec<NotebookCell>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookMetadata {
    pub kernel_spec: KernelSpec,
    pub created_at: u64,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookCell {
    pub cell_type: String,
    pub source: String,
    pub outputs: Vec<serde_json::Value>,
    pub execution_count: Option<u32>,
}
