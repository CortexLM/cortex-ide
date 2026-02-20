//! Folding range computation, breadcrumb path, and sticky scroll lines
//!
//! Provides indentation-based and language-aware folding ranges,
//! breadcrumb navigation segments, and sticky scroll context lines.

use std::path::Path;

use serde::{Deserialize, Serialize};
use tracing::info;

const DEFAULT_TAB_SIZE: u32 = 4;
const MAX_STICKY_SCROLL_LINES: u32 = 5;
const MAX_COLLAPSED_TEXT_LEN: usize = 40;
const MAX_SCOPE_NAME_LEN: usize = 30;

use crate::fs::security::validate_path_for_read;

const MAX_CONTENT_SIZE: usize = 10 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FoldingRangeKind {
    Comment,
    Imports,
    Region,
    Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FoldingRange {
    pub start_line: u32,
    pub end_line: u32,
    pub kind: FoldingRangeKind,
    pub collapsed_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreadcrumbSegment {
    pub name: String,
    pub kind: String,
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickyScrollLine {
    pub line: u32,
    pub text: String,
    pub indent_level: u32,
    pub scope_kind: String,
}

fn get_indent_level(line: &str, tab_size: u32) -> u32 {
    let mut indent = 0u32;
    for ch in line.chars() {
        match ch {
            ' ' => indent += 1,
            '\t' => indent += tab_size,
            _ => break,
        }
    }
    indent / tab_size
}

fn is_comment_line(line: &str, language: &str) -> bool {
    let trimmed = line.trim();
    match language {
        "rust" | "javascript" | "typescript" | "java" | "c" | "cpp" | "go" | "swift" | "kotlin"
        | "csharp" => trimmed.starts_with("//") || trimmed.starts_with("/*"),
        "python" | "ruby" | "shell" | "bash" => trimmed.starts_with('#'),
        "html" | "xml" => trimmed.starts_with("<!--"),
        "css" | "scss" | "less" => trimmed.starts_with("/*"),
        "lua" => trimmed.starts_with("--"),
        _ => trimmed.starts_with("//") || trimmed.starts_with('#'),
    }
}

fn is_block_opener(line: &str, language: &str) -> bool {
    let trimmed = line.trim();
    match language {
        "python" => {
            trimmed.ends_with(':')
                && (trimmed.starts_with("def ")
                    || trimmed.starts_with("class ")
                    || trimmed.starts_with("if ")
                    || trimmed.starts_with("elif ")
                    || trimmed.starts_with("else:")
                    || trimmed.starts_with("for ")
                    || trimmed.starts_with("while ")
                    || trimmed.starts_with("try:")
                    || trimmed.starts_with("except")
                    || trimmed.starts_with("finally:")
                    || trimmed.starts_with("with ")
                    || trimmed.starts_with("async "))
        }
        "ruby" => {
            trimmed.starts_with("def ")
                || trimmed.starts_with("class ")
                || trimmed.starts_with("module ")
                || trimmed.starts_with("do")
                || trimmed.ends_with(" do")
        }
        _ => trimmed.ends_with('{') || trimmed.ends_with("({") || trimmed.ends_with("["),
    }
}

fn is_import_line(line: &str, language: &str) -> bool {
    let trimmed = line.trim();
    match language {
        "python" => trimmed.starts_with("import ") || trimmed.starts_with("from "),
        "rust" => trimmed.starts_with("use "),
        "go" => trimmed.starts_with("import ") || trimmed.starts_with("import ("),
        "java" | "kotlin" => trimmed.starts_with("import "),
        _ => trimmed.starts_with("import ") || trimmed.starts_with("require("),
    }
}

fn is_region_marker(line: &str) -> Option<bool> {
    let trimmed = line.trim();
    if trimmed.contains("#region") || trimmed.contains("// region") || trimmed.contains("// {{{") {
        Some(true)
    } else if trimmed.contains("#endregion")
        || trimmed.contains("// endregion")
        || trimmed.contains("// }}}")
    {
        Some(false)
    } else {
        None
    }
}

fn compute_folding_ranges_sync(content: &str, language: &str) -> Vec<FoldingRange> {
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();
    if line_count == 0 {
        return Vec::new();
    }

    let mut ranges = Vec::new();
    let tab_size = DEFAULT_TAB_SIZE;

    let mut region_stack: Vec<u32> = Vec::new();
    let mut import_start: Option<u32> = None;
    let mut comment_start: Option<u32> = None;

    for (i, line) in lines.iter().enumerate() {
        let line_num = i as u32;

        if let Some(is_start) = is_region_marker(line) {
            if is_start {
                region_stack.push(line_num);
            } else if let Some(start) = region_stack.pop() {
                if line_num > start {
                    ranges.push(FoldingRange {
                        start_line: start,
                        end_line: line_num,
                        kind: FoldingRangeKind::Region,
                        collapsed_text: Some("...".to_string()),
                    });
                }
            }
            continue;
        }

        let is_import = is_import_line(line, language);
        if is_import {
            if import_start.is_none() {
                import_start = Some(line_num);
            }
        } else if let Some(start) = import_start.take() {
            if line_num > start + 1 {
                ranges.push(FoldingRange {
                    start_line: start,
                    end_line: line_num - 1,
                    kind: FoldingRangeKind::Imports,
                    collapsed_text: Some("imports...".to_string()),
                });
            }
        }

        let is_comment = is_comment_line(line, language);
        if is_comment {
            if comment_start.is_none() {
                comment_start = Some(line_num);
            }
        } else if let Some(start) = comment_start.take() {
            if line_num > start + 1 {
                ranges.push(FoldingRange {
                    start_line: start,
                    end_line: line_num - 1,
                    kind: FoldingRangeKind::Comment,
                    collapsed_text: Some("/* ... */".to_string()),
                });
            }
        }
    }

    if let Some(start) = import_start {
        let end = line_count as u32 - 1;
        if end > start {
            ranges.push(FoldingRange {
                start_line: start,
                end_line: end,
                kind: FoldingRangeKind::Imports,
                collapsed_text: Some("imports...".to_string()),
            });
        }
    }

    if let Some(start) = comment_start {
        let end = line_count as u32 - 1;
        if end > start {
            ranges.push(FoldingRange {
                start_line: start,
                end_line: end,
                kind: FoldingRangeKind::Comment,
                collapsed_text: Some("/* ... */".to_string()),
            });
        }
    }

    let indents: Vec<Option<u32>> = lines
        .iter()
        .map(|line| {
            if line.trim().is_empty() {
                None
            } else {
                Some(get_indent_level(line, tab_size))
            }
        })
        .collect();

    for i in 0..line_count {
        let current_indent = match indents[i] {
            Some(ind) => ind,
            None => continue,
        };

        if !is_block_opener(lines[i], language) && !lines[i].trim().ends_with('{') {
            continue;
        }

        let mut end_line = i;
        for j in (i + 1)..line_count {
            match indents[j] {
                Some(ind) if ind <= current_indent => break,
                Some(_) => end_line = j,
                None => {
                    if j + 1 < line_count {
                        if let Some(next_ind) = indents[j + 1] {
                            if next_ind > current_indent {
                                end_line = j;
                            }
                        }
                    }
                }
            }
        }

        if end_line > i {
            let preview = lines[i].trim();
            let collapsed = if preview.len() > MAX_COLLAPSED_TEXT_LEN {
                format!("{}...", &preview[..MAX_COLLAPSED_TEXT_LEN])
            } else {
                preview.to_string()
            };
            ranges.push(FoldingRange {
                start_line: i as u32,
                end_line: end_line as u32,
                kind: FoldingRangeKind::Block,
                collapsed_text: Some(collapsed),
            });
        }
    }

    ranges.sort_by_key(|r| (r.start_line, r.end_line));
    ranges
}

fn get_scope_kind(line: &str, language: &str) -> String {
    let trimmed = line.trim();
    match language {
        "rust" => {
            if trimmed.starts_with("fn ")
                || trimmed.starts_with("pub fn ")
                || trimmed.starts_with("async fn ")
                || trimmed.starts_with("pub async fn ")
            {
                "function".to_string()
            } else if trimmed.starts_with("struct ") || trimmed.starts_with("pub struct ") {
                "struct".to_string()
            } else if trimmed.starts_with("enum ") || trimmed.starts_with("pub enum ") {
                "enum".to_string()
            } else if trimmed.starts_with("impl ") {
                "impl".to_string()
            } else if trimmed.starts_with("mod ") || trimmed.starts_with("pub mod ") {
                "module".to_string()
            } else if trimmed.starts_with("trait ") || trimmed.starts_with("pub trait ") {
                "trait".to_string()
            } else {
                "block".to_string()
            }
        }
        "python" => {
            if trimmed.starts_with("def ") || trimmed.starts_with("async def ") {
                "function".to_string()
            } else if trimmed.starts_with("class ") {
                "class".to_string()
            } else if trimmed.starts_with("if ")
                || trimmed.starts_with("elif ")
                || trimmed == "else:"
            {
                "conditional".to_string()
            } else if trimmed.starts_with("for ") || trimmed.starts_with("while ") {
                "loop".to_string()
            } else {
                "block".to_string()
            }
        }
        "javascript" | "typescript" | "javascriptreact" | "typescriptreact" => {
            if trimmed.starts_with("function ") || trimmed.contains("=> {") {
                "function".to_string()
            } else if trimmed.starts_with("class ") {
                "class".to_string()
            } else if trimmed.starts_with("if ")
                || trimmed.starts_with("else if ")
                || trimmed.starts_with("else {")
            {
                "conditional".to_string()
            } else if trimmed.starts_with("for ") || trimmed.starts_with("while ") {
                "loop".to_string()
            } else {
                "block".to_string()
            }
        }
        _ => "block".to_string(),
    }
}

#[tauri::command]
pub async fn compute_folding_ranges(
    content: String,
    language: String,
) -> Result<Vec<FoldingRange>, String> {
    if content.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Content exceeds maximum size of {} bytes",
            MAX_CONTENT_SIZE
        ));
    }

    let ranges =
        tokio::task::spawn_blocking(move || compute_folding_ranges_sync(&content, &language))
            .await
            .map_err(|e| format!("Folding computation failed: {}", e))?;

    info!("Computed {} folding ranges", ranges.len());
    Ok(ranges)
}

#[tauri::command]
pub async fn get_breadcrumb_path(
    file_path: String,
    line: u32,
    column: u32,
) -> Result<Vec<BreadcrumbSegment>, String> {
    let validated_path = validate_path_for_read(Path::new(&file_path))
        .map_err(|e| format!("Invalid file path: {}", e))?;

    let content = tokio::task::spawn_blocking(move || {
        std::fs::read_to_string(&validated_path).map_err(|e| format!("Failed to read file: {}", e))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))??;

    let language = detect_language_from_content(&content);
    let segments = build_breadcrumb_path(&content, &language, line, column);

    info!(
        "Breadcrumb path at line {} col {}: {} segments",
        line,
        column,
        segments.len()
    );
    Ok(segments)
}

fn detect_language_from_content(content: &str) -> String {
    let first_line = content.lines().next().unwrap_or("");
    if first_line.starts_with("#!") {
        if first_line.contains("python") {
            return "python".to_string();
        }
        if first_line.contains("node") || first_line.contains("deno") {
            return "javascript".to_string();
        }
        if first_line.contains("bash") || first_line.contains("sh") {
            return "shell".to_string();
        }
        if first_line.contains("ruby") {
            return "ruby".to_string();
        }
    }
    "unknown".to_string()
}

fn build_breadcrumb_path(
    content: &str,
    language: &str,
    target_line: u32,
    _column: u32,
) -> Vec<BreadcrumbSegment> {
    let lines: Vec<&str> = content.lines().collect();
    let tab_size = DEFAULT_TAB_SIZE;
    let mut segments = Vec::new();

    let target = target_line as usize;
    if target >= lines.len() {
        return segments;
    }

    let target_indent = if lines[target].trim().is_empty() {
        let mut indent = 0u32;
        for i in (0..target).rev() {
            if !lines[i].trim().is_empty() {
                indent = get_indent_level(lines[i], tab_size) + 1;
                break;
            }
        }
        indent
    } else {
        get_indent_level(lines[target], tab_size)
    };

    let mut current_indent = target_indent;
    let mut line_idx = target;

    loop {
        if line_idx == 0 && lines[0].trim().is_empty() {
            break;
        }

        let line = lines[line_idx];
        if !line.trim().is_empty() {
            let indent = get_indent_level(line, tab_size);
            if indent < current_indent || (line_idx == target && is_block_opener(line, language)) {
                let kind = get_scope_kind(line, language);
                let name = extract_scope_name(line, language);
                segments.push(BreadcrumbSegment {
                    name,
                    kind,
                    line: line_idx as u32,
                    column: indent * tab_size,
                });
                current_indent = indent;
            }
        }

        if line_idx == 0 {
            break;
        }
        line_idx -= 1;
    }

    segments.reverse();
    segments
}

fn extract_scope_name(line: &str, language: &str) -> String {
    let trimmed = line.trim();
    match language {
        "rust" => {
            for prefix in &[
                "pub async fn ",
                "async fn ",
                "pub fn ",
                "fn ",
                "pub struct ",
                "struct ",
                "pub enum ",
                "enum ",
                "impl ",
                "pub trait ",
                "trait ",
                "pub mod ",
                "mod ",
            ] {
                if let Some(rest) = trimmed.strip_prefix(prefix) {
                    let name: String = rest
                        .chars()
                        .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '<')
                        .collect();
                    return name;
                }
            }
        }
        "python" => {
            for prefix in &["async def ", "def ", "class "] {
                if let Some(rest) = trimmed.strip_prefix(prefix) {
                    let name: String = rest
                        .chars()
                        .take_while(|c| c.is_alphanumeric() || *c == '_')
                        .collect();
                    return name;
                }
            }
        }
        "javascript" | "typescript" | "javascriptreact" | "typescriptreact" => {
            for prefix in &[
                "function ",
                "class ",
                "export function ",
                "export default function ",
                "export class ",
            ] {
                if let Some(rest) = trimmed.strip_prefix(prefix) {
                    let name: String = rest
                        .chars()
                        .take_while(|c| c.is_alphanumeric() || *c == '_')
                        .collect();
                    return name;
                }
            }
            if trimmed.contains("const ") || trimmed.contains("let ") || trimmed.contains("var ") {
                for kw in &["const ", "let ", "var ", "export const ", "export let "] {
                    if let Some(rest) = trimmed.strip_prefix(kw) {
                        let name: String = rest
                            .chars()
                            .take_while(|c| c.is_alphanumeric() || *c == '_')
                            .collect();
                        if !name.is_empty() {
                            return name;
                        }
                    }
                }
            }
        }
        _ => {}
    }
    let name: String = trimmed.chars().take(MAX_SCOPE_NAME_LEN).collect();
    name.trim_end().to_string()
}

#[tauri::command]
pub async fn get_sticky_scroll_lines(
    content: String,
    language: String,
    visible_start_line: u32,
) -> Result<Vec<StickyScrollLine>, String> {
    if content.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Content exceeds maximum size of {} bytes",
            MAX_CONTENT_SIZE
        ));
    }

    let lines = tokio::task::spawn_blocking(move || {
        compute_sticky_scroll(&content, &language, visible_start_line)
    })
    .await
    .map_err(|e| format!("Sticky scroll computation failed: {}", e))?;

    Ok(lines)
}

fn compute_sticky_scroll(
    content: &str,
    language: &str,
    visible_start_line: u32,
) -> Vec<StickyScrollLine> {
    let lines: Vec<&str> = content.lines().collect();
    let tab_size = DEFAULT_TAB_SIZE;
    let max_sticky = MAX_STICKY_SCROLL_LINES;
    let target = visible_start_line as usize;

    if target >= lines.len() {
        return Vec::new();
    }

    let target_indent = if lines[target].trim().is_empty() {
        let mut indent = 0u32;
        for i in (0..target).rev() {
            if !lines[i].trim().is_empty() {
                indent = get_indent_level(lines[i], tab_size) + 1;
                break;
            }
        }
        indent
    } else {
        get_indent_level(lines[target], tab_size)
    };

    let mut sticky_lines = Vec::new();
    let mut current_indent = target_indent;
    let mut line_idx = target;

    loop {
        let line = lines[line_idx];
        if !line.trim().is_empty() {
            let indent = get_indent_level(line, tab_size);
            if indent < current_indent {
                let scope_kind = get_scope_kind(line, language);
                sticky_lines.push(StickyScrollLine {
                    line: line_idx as u32,
                    text: line.to_string(),
                    indent_level: indent,
                    scope_kind,
                });
                current_indent = indent;

                if sticky_lines.len() >= max_sticky as usize {
                    break;
                }
            }
        }

        if line_idx == 0 {
            break;
        }
        line_idx -= 1;
    }

    sticky_lines.reverse();
    sticky_lines
}
