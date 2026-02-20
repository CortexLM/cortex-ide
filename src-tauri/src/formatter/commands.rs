//! Tauri commands for formatter functionality

use std::path::Path;
use std::process::Stdio;
use tracing::info;

use crate::process_utils;

use super::handlers::{
    format_with_biome, format_with_black, format_with_clang_format, format_with_deno,
    format_with_gofmt, format_with_rustfmt,
};
use super::prettier::{
    check_prettier_available, find_prettier_config, find_prettier_ignore, format_with_prettier,
    get_parser_for_extension,
};
use super::types::{ConfigInfo, FormatRequest, FormatResult, FormatterInfo, FormatterType};

/// Get available formatters for a file type
fn get_formatters_for_language(language: &str) -> Vec<FormatterType> {
    match language {
        "typescript" | "javascript" | "typescriptreact" | "javascriptreact" => {
            vec![
                FormatterType::Prettier,
                FormatterType::Biome,
                FormatterType::Deno,
            ]
        }
        "json" | "jsonc" => {
            vec![
                FormatterType::Prettier,
                FormatterType::Biome,
                FormatterType::Deno,
            ]
        }
        "html" | "css" | "scss" | "less" => {
            vec![FormatterType::Prettier]
        }
        "markdown" | "mdx" => {
            vec![FormatterType::Prettier, FormatterType::Deno]
        }
        "yaml" => {
            vec![FormatterType::Prettier]
        }
        "rust" => {
            vec![FormatterType::Rustfmt]
        }
        "python" => {
            vec![FormatterType::Black]
        }
        "go" => {
            vec![FormatterType::Gofmt]
        }
        "c" | "cpp" | "objc" | "objcpp" => {
            vec![FormatterType::ClangFormat]
        }
        _ => vec![],
    }
}

/// Format content with the appropriate formatter
#[tauri::command]
pub async fn formatter_format(request: FormatRequest) -> Result<FormatResult, String> {
    info!("Format request for: {}", request.file_path);

    let file_path = Path::new(&request.file_path);
    let working_dir = request.working_directory.as_ref().map(Path::new);

    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");

    // Determine formatter based on file extension
    let formatter_type = match ext.to_lowercase().as_str() {
        "rs" => FormatterType::Rustfmt,
        "py" | "pyw" | "pyi" => FormatterType::Black,
        "go" => FormatterType::Gofmt,
        "c" | "h" | "cpp" | "cc" | "cxx" | "hpp" | "hxx" | "m" | "mm" => FormatterType::ClangFormat,
        _ => FormatterType::Prettier,
    };

    match formatter_type {
        FormatterType::Prettier => {
            format_with_prettier(
                &request.content,
                file_path,
                working_dir,
                request.parser.as_deref(),
                request.range.as_ref(),
                request.options.as_ref(),
            )
            .await
        }
        FormatterType::Rustfmt => format_with_rustfmt(&request.content, file_path).await,
        FormatterType::Black => format_with_black(&request.content, file_path).await,
        FormatterType::Gofmt => format_with_gofmt(&request.content, file_path).await,
        FormatterType::ClangFormat => format_with_clang_format(&request.content, file_path).await,
        FormatterType::Biome => format_with_biome(&request.content, file_path, working_dir).await,
        FormatterType::Deno => format_with_deno(&request.content, file_path).await,
    }
}

/// Format content using a specific formatter
#[tauri::command]
pub async fn formatter_format_with(
    request: FormatRequest,
    formatter: FormatterType,
) -> Result<FormatResult, String> {
    info!(
        "Format request for: {} with {:?}",
        request.file_path, formatter
    );

    let file_path = Path::new(&request.file_path);
    let working_dir = request.working_directory.as_ref().map(Path::new);

    match formatter {
        FormatterType::Prettier => {
            format_with_prettier(
                &request.content,
                file_path,
                working_dir,
                request.parser.as_deref(),
                request.range.as_ref(),
                request.options.as_ref(),
            )
            .await
        }
        FormatterType::Rustfmt => format_with_rustfmt(&request.content, file_path).await,
        FormatterType::Black => format_with_black(&request.content, file_path).await,
        FormatterType::Gofmt => format_with_gofmt(&request.content, file_path).await,
        FormatterType::ClangFormat => format_with_clang_format(&request.content, file_path).await,
        FormatterType::Biome => format_with_biome(&request.content, file_path, working_dir).await,
        FormatterType::Deno => format_with_deno(&request.content, file_path).await,
    }
}

/// Detect formatter configuration for a file
#[tauri::command]
pub async fn formatter_detect_config(
    file_path: String,
    working_directory: Option<String>,
) -> Result<ConfigInfo, String> {
    let path = Path::new(&file_path);
    let work_dir = working_directory.as_ref().map(Path::new);

    // Check prettier availability
    let (prettier_available, prettier_version, _) = check_prettier_available(work_dir).await;

    // Find prettier config
    let config_path = find_prettier_config(path).map(|p| p.to_string_lossy().to_string());

    // Find prettier ignore
    let ignore_path = find_prettier_ignore(path);
    let has_ignore_file = ignore_path.is_some();
    let ignore_path_str = ignore_path.map(|p| p.to_string_lossy().to_string());

    // Get available formatters for this file type
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    let language = match ext.to_lowercase().as_str() {
        "ts" | "tsx" | "mts" | "cts" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "rs" => "rust",
        "py" | "pyw" | "pyi" => "python",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" => "cpp",
        "json" | "jsonc" => "json",
        "html" | "htm" => "html",
        "css" => "css",
        "scss" => "scss",
        "less" => "less",
        "md" | "mdx" => "markdown",
        "yaml" | "yml" => "yaml",
        _ => "unknown",
    };

    let available_formatters = get_formatters_for_language(language);

    Ok(ConfigInfo {
        config_path,
        prettier_available,
        prettier_version,
        available_formatters,
        has_ignore_file,
        ignore_path: ignore_path_str,
    })
}

/// Check which formatters are available
#[tauri::command]
pub async fn formatter_check_available(
    working_directory: Option<String>,
) -> Result<Vec<FormatterInfo>, String> {
    let work_dir = working_directory.as_ref().map(Path::new);
    let mut results = Vec::new();

    // Check Prettier
    let (prettier_avail, prettier_ver, prettier_path) = check_prettier_available(work_dir).await;
    results.push(FormatterInfo {
        formatter: FormatterType::Prettier,
        available: prettier_avail,
        version: prettier_ver,
        path: prettier_path,
    });

    // Check rustfmt
    let rustfmt_result = process_utils::async_command("rustfmt")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    if let Ok(output) = rustfmt_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            results.push(FormatterInfo {
                formatter: FormatterType::Rustfmt,
                available: true,
                version: Some(version),
                path: Some("rustfmt".to_string()),
            });
        } else {
            results.push(FormatterInfo {
                formatter: FormatterType::Rustfmt,
                available: false,
                version: None,
                path: None,
            });
        }
    } else {
        results.push(FormatterInfo {
            formatter: FormatterType::Rustfmt,
            available: false,
            version: None,
            path: None,
        });
    }

    // Check black
    let black_result = process_utils::async_command("black")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    if let Ok(output) = black_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            results.push(FormatterInfo {
                formatter: FormatterType::Black,
                available: true,
                version: Some(version),
                path: Some("black".to_string()),
            });
        } else {
            results.push(FormatterInfo {
                formatter: FormatterType::Black,
                available: false,
                version: None,
                path: None,
            });
        }
    } else {
        results.push(FormatterInfo {
            formatter: FormatterType::Black,
            available: false,
            version: None,
            path: None,
        });
    }

    // Check gofmt
    let gofmt_result = process_utils::async_command("gofmt")
        .arg("-h") // gofmt doesn't have --version, use -h
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()
        .await;

    let gofmt_available = gofmt_result.is_ok();
    results.push(FormatterInfo {
        formatter: FormatterType::Gofmt,
        available: gofmt_available,
        version: None, // gofmt doesn't report version
        path: if gofmt_available {
            Some("gofmt".to_string())
        } else {
            None
        },
    });

    // Check biome
    let biome_result = process_utils::async_command(if cfg!(windows) { "npx.cmd" } else { "npx" })
        .args(["@biomejs/biome", "--version"])
        .current_dir(work_dir.unwrap_or(Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    if let Ok(output) = biome_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            results.push(FormatterInfo {
                formatter: FormatterType::Biome,
                available: true,
                version: Some(version),
                path: Some("npx @biomejs/biome".to_string()),
            });
        } else {
            results.push(FormatterInfo {
                formatter: FormatterType::Biome,
                available: false,
                version: None,
                path: None,
            });
        }
    } else {
        results.push(FormatterInfo {
            formatter: FormatterType::Biome,
            available: false,
            version: None,
            path: None,
        });
    }

    // Check clang-format
    let clang_format_result = process_utils::async_command("clang-format")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    if let Ok(output) = clang_format_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            results.push(FormatterInfo {
                formatter: FormatterType::ClangFormat,
                available: true,
                version: Some(version),
                path: Some("clang-format".to_string()),
            });
        } else {
            results.push(FormatterInfo {
                formatter: FormatterType::ClangFormat,
                available: false,
                version: None,
                path: None,
            });
        }
    } else {
        results.push(FormatterInfo {
            formatter: FormatterType::ClangFormat,
            available: false,
            version: None,
            path: None,
        });
    }

    // Check deno
    let deno_result = process_utils::async_command("deno")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    if let Ok(output) = deno_result {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            results.push(FormatterInfo {
                formatter: FormatterType::Deno,
                available: true,
                version: Some(version),
                path: Some("deno".to_string()),
            });
        } else {
            results.push(FormatterInfo {
                formatter: FormatterType::Deno,
                available: false,
                version: None,
                path: None,
            });
        }
    } else {
        results.push(FormatterInfo {
            formatter: FormatterType::Deno,
            available: false,
            version: None,
            path: None,
        });
    }

    Ok(results)
}

/// Get the parser for a file extension
#[tauri::command]
pub fn formatter_get_parser(file_path: String) -> Option<String> {
    let path = Path::new(&file_path);
    let ext = path.extension().and_then(|e| e.to_str())?;
    get_parser_for_extension(ext).map(|s| s.to_string())
}
