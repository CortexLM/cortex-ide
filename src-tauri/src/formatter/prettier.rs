//! Prettier formatter support
//!
//! This module handles Prettier configuration detection and formatting.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use tracing::{debug, error};

use crate::process_utils;

use super::types::{FormatRange, FormatResult, FormatterOptions, FormatterType};

/// Prettier configuration file names (in order of precedence)
pub const PRETTIER_CONFIG_FILES: &[&str] = &[
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.json5",
    ".prettierrc.yaml",
    ".prettierrc.yml",
    ".prettierrc.toml",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    ".prettierrc.ts",
    ".prettierrc.cts",
    ".prettierrc.mts",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
    "prettier.config.ts",
    "prettier.config.cts",
    "prettier.config.mts",
];

/// Get the appropriate parser for a file extension
pub fn get_parser_for_extension(ext: &str) -> Option<&'static str> {
    match ext.to_lowercase().as_str() {
        "js" | "jsx" | "mjs" | "cjs" => Some("babel"),
        "ts" | "tsx" | "mts" | "cts" => Some("typescript"),
        "json" | "jsonc" => Some("json"),
        "json5" => Some("json5"),
        "css" => Some("css"),
        "scss" => Some("scss"),
        "less" => Some("less"),
        "html" | "htm" => Some("html"),
        "vue" => Some("vue"),
        "svelte" => Some("svelte"),
        "md" | "mdx" | "markdown" => Some("markdown"),
        "yaml" | "yml" => Some("yaml"),
        "xml" | "svg" => Some("html"),
        "graphql" | "gql" => Some("graphql"),
        "php" => Some("php"),
        _ => None,
    }
}

/// Check if prettier is available in the system or project
pub async fn check_prettier_available(
    working_dir: Option<&Path>,
) -> (bool, Option<String>, Option<String>) {
    // Try npx prettier first (project-local)
    let npx_result = process_utils::async_command(if cfg!(windows) { "npx.cmd" } else { "npx" })
        .args(["prettier", "--version"])
        .current_dir(working_dir.unwrap_or(Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    if let Ok(output) = npx_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return (true, Some(version), Some("npx".to_string()));
        }
    }

    // Try global prettier
    let global_result = process_utils::async_command(if cfg!(windows) {
        "prettier.cmd"
    } else {
        "prettier"
    })
    .arg("--version")
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .output()
    .await;

    if let Ok(output) = global_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return (true, Some(version), Some("global".to_string()));
        }
    }

    (false, None, None)
}

/// Find prettier config file in directory hierarchy
pub fn find_prettier_config(start_path: &Path) -> Option<PathBuf> {
    let mut current = if start_path.is_file() {
        start_path.parent()?.to_path_buf()
    } else {
        start_path.to_path_buf()
    };

    loop {
        for config_name in PRETTIER_CONFIG_FILES {
            let config_path = current.join(config_name);
            if config_path.exists() {
                return Some(config_path);
            }
        }

        // Check package.json for prettier key
        let package_json = current.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if json.get("prettier").is_some() {
                        return Some(package_json);
                    }
                }
            }
        }

        if !current.pop() {
            break;
        }
    }

    None
}

/// Find .prettierignore file
pub fn find_prettier_ignore(start_path: &Path) -> Option<PathBuf> {
    let mut current = if start_path.is_file() {
        start_path.parent()?.to_path_buf()
    } else {
        start_path.to_path_buf()
    };

    loop {
        let ignore_path = current.join(".prettierignore");
        if ignore_path.exists() {
            return Some(ignore_path);
        }

        if !current.pop() {
            break;
        }
    }

    None
}

/// Format content using Prettier
pub async fn format_with_prettier(
    content: &str,
    file_path: &Path,
    working_dir: Option<&Path>,
    parser: Option<&str>,
    range: Option<&FormatRange>,
    options: Option<&FormatterOptions>,
) -> Result<FormatResult, String> {
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");

    let parser = parser
        .map(|p| p.to_string())
        .or_else(|| get_parser_for_extension(ext).map(|p| p.to_string()));

    let work_dir = working_dir.unwrap_or(Path::new("."));

    // Build prettier command arguments
    let mut args: Vec<String> = vec!["prettier".to_string(), "--stdin-filepath".to_string()];
    args.push(file_path.to_string_lossy().to_string());

    if let Some(p) = &parser {
        args.push("--parser".to_string());
        args.push(p.clone());
    }

    // Add range arguments if specified
    if let Some(r) = range {
        args.push("--range-start".to_string());
        args.push(format!("{}", r.start_line));
        args.push("--range-end".to_string());
        args.push(format!("{}", r.end_line));
    }

    // Add options
    if let Some(opts) = options {
        if let Some(tw) = opts.tab_width {
            args.push("--tab-width".to_string());
            args.push(tw.to_string());
        }
        if let Some(ut) = opts.use_tabs {
            if ut {
                args.push("--use-tabs".to_string());
            }
        }
        if let Some(pw) = opts.print_width {
            args.push("--print-width".to_string());
            args.push(pw.to_string());
        }
        if let Some(sq) = opts.single_quote {
            if sq {
                args.push("--single-quote".to_string());
            }
        }
        if let Some(ref tc) = opts.trailing_comma {
            args.push("--trailing-comma".to_string());
            args.push(tc.clone());
        }
        if let Some(bs) = opts.bracket_spacing {
            if !bs {
                args.push("--no-bracket-spacing".to_string());
            }
        }
        if let Some(semi) = opts.semi {
            if !semi {
                args.push("--no-semi".to_string());
            }
        }
        if let Some(ref eol) = opts.end_of_line {
            args.push("--end-of-line".to_string());
            args.push(eol.clone());
        }
    }

    debug!("Running prettier with args: {:?}", args);

    // Run prettier via npx
    let mut child = process_utils::async_command(if cfg!(windows) { "npx.cmd" } else { "npx" })
        .args(&args)
        .current_dir(work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn prettier: {}", e))?;

    // Write content to stdin
    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to prettier stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for prettier: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Prettier failed: {}", stderr);
        return Err(format!("Prettier failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in prettier output: {}", e))?;

    let warnings: Vec<String> = if !output.stderr.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        stderr
            .lines()
            .filter(|line| !line.is_empty())
            .map(|s| s.to_string())
            .collect()
    } else {
        vec![]
    };

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::Prettier,
        warnings,
    })
}
