use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Deserializer that accepts both a single string and an array of strings,
/// normalizing to `Vec<String>`.
pub(crate) fn deserialize_string_or_array<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrArray {
        Single(String),
        Array(Vec<String>),
    }

    match StringOrArray::deserialize(deserializer)? {
        StringOrArray::Single(s) => Ok(vec![s]),
        StringOrArray::Array(v) => Ok(v),
    }
}

pub(crate) fn deserialize_option_string_or_array<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OptStringOrArray {
        Single(String),
        Array(Vec<String>),
    }

    let opt: Option<OptStringOrArray> = Option::deserialize(deserializer)?;
    Ok(opt.map(|v| match v {
        OptStringOrArray::Single(s) => vec![s],
        OptStringOrArray::Array(a) => a,
    }))
}

pub(crate) fn default_nbformat() -> u32 {
    4
}

/// Top-level .ipynb notebook structure (nbformat v4).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbNotebook {
    #[serde(default = "default_nbformat")]
    pub nbformat: u32,
    #[serde(default)]
    pub nbformat_minor: u32,
    #[serde(default)]
    pub metadata: IpynbMetadata,
    #[serde(default)]
    pub cells: Vec<IpynbCell>,
}

/// Notebook-level metadata.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IpynbMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kernelspec: Option<IpynbKernelspecMeta>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language_info: Option<IpynbLanguageInfo>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Kernel specification embedded in notebook metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbKernelspecMeta {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

/// Language info embedded in notebook metadata.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IpynbLanguageInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mimetype: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_extension: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// A single cell in an ipynb notebook.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbCell {
    pub cell_type: String,
    #[serde(deserialize_with = "deserialize_string_or_array")]
    pub source: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outputs: Option<Vec<IpynbOutput>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_count: Option<u64>,
    #[serde(default)]
    pub metadata: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

/// An output entry in an ipynb cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbOutput {
    pub output_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_string_or_array"
    )]
    pub text: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evalue: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub traceback: Option<Vec<String>>,
}

/// Entry returned by `notebook_list_kernels` combining Jupyter and REPL kernels.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookKernelEntry {
    pub name: String,
    pub display_name: String,
    pub language: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
}

/// Notebook-specific kernel state
pub struct NotebookKernelState {
    /// Mapping from notebook path to kernel ID
    pub notebook_kernels: Mutex<std::collections::HashMap<String, String>>,
}

impl NotebookKernelState {
    pub fn new() -> Self {
        Self {
            notebook_kernels: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

impl Default for NotebookKernelState {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate a simple unique ID using the current system time.
pub(crate) fn uuid_like_id() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}{:x}", duration.as_secs(), duration.subsec_nanos())
}

/// Strip ANSI escape codes from text.
pub(crate) fn strip_ansi_codes(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                // consume until we hit a letter (the command character)
                while let Some(&next) = chars.peek() {
                    chars.next();
                    if next.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Escape HTML special characters.
pub(crate) fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Extract a string value from a JSON value that may be a string or array of strings.
pub(crate) fn json_to_text(val: &serde_json::Value) -> String {
    match val {
        serde_json::Value::Array(arr) => arr
            .iter()
            .filter_map(|v| v.as_str())
            .collect::<Vec<_>>()
            .join(""),
        serde_json::Value::String(s) => s.clone(),
        _ => String::new(),
    }
}

/// Render a single ipynb output entry as HTML, appending to `buf`.
pub(crate) fn render_output_html(buf: &mut String, output: &IpynbOutput) {
    match output.output_type.as_str() {
        "stream" => {
            if let Some(ref text) = output.text {
                let raw = text.join("");
                buf.push_str("<div class=\"output\">\n<pre>");
                buf.push_str(&html_escape(&strip_ansi_codes(&raw)));
                buf.push_str("</pre>\n</div>\n");
            }
        }
        "execute_result" | "display_data" => {
            if let Some(ref data) = output.data {
                // text/html
                if let Some(html_val) = data.get("text/html") {
                    buf.push_str("<div class=\"output\">\n");
                    buf.push_str(&json_to_text(html_val));
                    buf.push_str("\n</div>\n");
                }
                // image/svg+xml
                else if let Some(svg_val) = data.get("image/svg+xml") {
                    buf.push_str("<div class=\"output\">\n");
                    buf.push_str(&json_to_text(svg_val));
                    buf.push_str("\n</div>\n");
                }
                // text/markdown
                else if let Some(md_val) = data.get("text/markdown") {
                    buf.push_str("<div class=\"output markdown-output\">\n<pre>");
                    buf.push_str(&html_escape(&json_to_text(md_val)));
                    buf.push_str("</pre>\n</div>\n");
                }
                // application/json
                else if let Some(json_val) = data.get("application/json") {
                    let formatted = serde_json::to_string_pretty(json_val)
                        .unwrap_or_else(|_| json_val.to_string());
                    buf.push_str("<div class=\"output\">\n<pre>");
                    buf.push_str(&html_escape(&formatted));
                    buf.push_str("</pre>\n</div>\n");
                }
                // text/plain fallback
                else if let Some(text_val) = data.get("text/plain") {
                    let text = json_to_text(text_val);
                    buf.push_str("<div class=\"output\">\n<pre>");
                    buf.push_str(&html_escape(&strip_ansi_codes(&text)));
                    buf.push_str("</pre>\n</div>\n");
                }

                // image/png
                if let Some(png_val) = data.get("image/png") {
                    if let Some(png_data) = png_val.as_str() {
                        buf.push_str("<div class=\"output\">\n<img src=\"data:image/png;base64,");
                        buf.push_str(png_data.trim());
                        buf.push_str("\" />\n</div>\n");
                    }
                }
                // image/jpeg
                if let Some(jpeg_val) = data.get("image/jpeg") {
                    if let Some(jpeg_data) = jpeg_val.as_str() {
                        buf.push_str("<div class=\"output\">\n<img src=\"data:image/jpeg;base64,");
                        buf.push_str(jpeg_data.trim());
                        buf.push_str("\" />\n</div>\n");
                    }
                }
            }
        }
        "error" => {
            buf.push_str("<div class=\"output output-error\">\n<pre>");
            if let Some(ref ename) = output.ename {
                buf.push_str(&html_escape(ename));
                buf.push_str(": ");
            }
            if let Some(ref evalue) = output.evalue {
                buf.push_str(&html_escape(evalue));
            }
            if let Some(ref traceback) = output.traceback {
                buf.push('\n');
                for line in traceback {
                    buf.push_str(&html_escape(&strip_ansi_codes(line)));
                    buf.push('\n');
                }
            }
            buf.push_str("</pre>\n</div>\n");
        }
        _ => {}
    }
}
