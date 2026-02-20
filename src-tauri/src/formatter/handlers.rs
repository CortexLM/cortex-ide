//! Format handlers for various formatters
//!
//! This module contains the implementation for each supported formatter.

use std::path::Path;
use std::process::Stdio;

use crate::process_utils;

use super::types::{FormatResult, FormatterType};

/// Format content using rustfmt
pub async fn format_with_rustfmt(content: &str, _file_path: &Path) -> Result<FormatResult, String> {
    let mut child = process_utils::async_command("rustfmt")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn rustfmt: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to rustfmt stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for rustfmt: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("rustfmt failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in rustfmt output: {}", e))?;

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::Rustfmt,
        warnings: vec![],
    })
}

/// Format content using black (Python)
pub async fn format_with_black(content: &str, _file_path: &Path) -> Result<FormatResult, String> {
    let mut child = process_utils::async_command("black")
        .args(["-", "--quiet"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn black: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to black stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for black: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("black failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in black output: {}", e))?;

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::Black,
        warnings: vec![],
    })
}

/// Format content using gofmt
pub async fn format_with_gofmt(content: &str, _file_path: &Path) -> Result<FormatResult, String> {
    let mut child = process_utils::async_command("gofmt")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn gofmt: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to gofmt stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for gofmt: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gofmt failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in gofmt output: {}", e))?;

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::Gofmt,
        warnings: vec![],
    })
}

/// Format content using clang-format (C/C++/ObjC)
pub async fn format_with_clang_format(
    content: &str,
    file_path: &Path,
) -> Result<FormatResult, String> {
    let mut child = process_utils::async_command("clang-format")
        .args(["--style=file", "--fallback-style=LLVM", "--assume-filename"])
        .arg(file_path.to_string_lossy().to_string())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn clang-format (is it installed?): {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to clang-format stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for clang-format: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("clang-format failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in clang-format output: {}", e))?;

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::ClangFormat,
        warnings: vec![],
    })
}

/// Format content using Biome (JavaScript/TypeScript/JSON)
pub async fn format_with_biome(
    content: &str,
    file_path: &Path,
    working_dir: Option<&Path>,
) -> Result<FormatResult, String> {
    let work_dir = working_dir.unwrap_or(Path::new("."));

    let mut child = process_utils::async_command(if cfg!(windows) { "npx.cmd" } else { "npx" })
        .args([
            "@biomejs/biome",
            "format",
            "--stdin-file-path",
            &file_path.to_string_lossy(),
        ])
        .current_dir(work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn biome (is it installed?): {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to biome stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for biome: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("biome failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in biome output: {}", e))?;

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::Biome,
        warnings: vec![],
    })
}

/// Format content using Deno (JavaScript/TypeScript/Markdown/JSON)
pub async fn format_with_deno(content: &str, file_path: &Path) -> Result<FormatResult, String> {
    let mut child = process_utils::async_command("deno")
        .args(["fmt", "-", "--ext"])
        .arg(
            file_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("ts"),
        )
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn deno (is it installed?): {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to deno stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for deno: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("deno fmt failed: {}", stderr));
    }

    let formatted = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in deno output: {}", e))?;

    let changed = formatted != content;

    Ok(FormatResult {
        content: formatted,
        changed,
        formatter: FormatterType::Deno,
        warnings: vec![],
    })
}
