//! Formatter types and data structures

use serde::{Deserialize, Serialize};

/// Supported formatter types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum FormatterType {
    Prettier,
    Rustfmt,
    Black,
    Gofmt,
    ClangFormat,
    Biome,
    Deno,
}

impl std::fmt::Display for FormatterType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FormatterType::Prettier => write!(f, "prettier"),
            FormatterType::Rustfmt => write!(f, "rustfmt"),
            FormatterType::Black => write!(f, "black"),
            FormatterType::Gofmt => write!(f, "gofmt"),
            FormatterType::ClangFormat => write!(f, "clang-format"),
            FormatterType::Biome => write!(f, "biome"),
            FormatterType::Deno => write!(f, "deno"),
        }
    }
}

/// Request to format content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatRequest {
    /// The content to format
    pub content: String,
    /// File path (used for language detection and config lookup)
    pub file_path: String,
    /// Working directory for the formatter
    pub working_directory: Option<String>,
    /// Optional parser override
    pub parser: Option<String>,
    /// Format only selection (start, end)
    pub range: Option<FormatRange>,
    /// Formatter options
    pub options: Option<FormatterOptions>,
}

/// Range for partial formatting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatRange {
    pub start_line: u32,
    pub end_line: u32,
}

/// Formatter options that can be passed
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FormatterOptions {
    pub tab_width: Option<u32>,
    pub use_tabs: Option<bool>,
    pub print_width: Option<u32>,
    pub single_quote: Option<bool>,
    pub trailing_comma: Option<String>,
    pub bracket_spacing: Option<bool>,
    pub semi: Option<bool>,
    pub jsx_single_quote: Option<bool>,
    pub arrow_parens: Option<String>,
    pub prose_wrap: Option<String>,
    pub end_of_line: Option<String>,
}

/// Result of a format operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    /// Formatted content
    pub content: String,
    /// Whether the content was changed
    pub changed: bool,
    /// Formatter that was used
    pub formatter: FormatterType,
    /// Any warnings during formatting
    pub warnings: Vec<String>,
}

/// Detected configuration information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInfo {
    /// Path to the detected config file (if any)
    pub config_path: Option<String>,
    /// Whether prettier is available
    pub prettier_available: bool,
    /// Detected prettier version
    pub prettier_version: Option<String>,
    /// List of available formatters for the file type
    pub available_formatters: Vec<FormatterType>,
    /// Whether an ignore file exists
    pub has_ignore_file: bool,
    /// Ignore file path
    pub ignore_path: Option<String>,
}

/// Information about formatter availability
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatterInfo {
    pub formatter: FormatterType,
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}
