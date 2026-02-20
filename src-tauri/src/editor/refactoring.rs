//! Refactoring operations for the editor
//!
//! Provides rename across files, extract variable, and extract method
//! refactoring capabilities with text-based transformations.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{info, warn};
use walkdir::WalkDir;

use crate::fs::security::{validate_path_for_read, validate_path_for_write};

const MAX_CONTENT_SIZE: usize = 10 * 1024 * 1024;
const MAX_IDENTIFIER_LENGTH: usize = 500;
const MAX_FILE_PATHS: usize = 10_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub file_path: String,
    pub original_content: String,
    pub new_content: String,
    pub occurrences: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    pub files_changed: u32,
    pub total_occurrences: u32,
    pub changes: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractResult {
    pub new_content: String,
    pub extracted_text: String,
    pub inserted_at_line: u32,
}

fn is_text_file_ext(ext: &str) -> bool {
    matches!(
        ext,
        "rs" | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "py"
            | "java"
            | "kt"
            | "go"
            | "c"
            | "cpp"
            | "h"
            | "hpp"
            | "cs"
            | "rb"
            | "swift"
            | "lua"
            | "zig"
            | "toml"
            | "yaml"
            | "yml"
            | "json"
            | "md"
            | "txt"
            | "css"
            | "scss"
            | "html"
            | "xml"
            | "sql"
    )
}

#[tauri::command]
pub async fn rename_across_files(
    workspace_path: String,
    old_name: String,
    new_name: String,
    file_paths: Vec<String>,
) -> Result<RenameResult, String> {
    if old_name.is_empty() {
        return Err("Old name cannot be empty".to_string());
    }
    if new_name.is_empty() {
        return Err("New name cannot be empty".to_string());
    }
    if old_name == new_name {
        return Err("Old and new names are identical".to_string());
    }
    if old_name.len() > MAX_IDENTIFIER_LENGTH {
        return Err(format!(
            "Old name exceeds maximum length of {} characters",
            MAX_IDENTIFIER_LENGTH
        ));
    }
    if new_name.len() > MAX_IDENTIFIER_LENGTH {
        return Err(format!(
            "New name exceeds maximum length of {} characters",
            MAX_IDENTIFIER_LENGTH
        ));
    }
    if file_paths.len() > MAX_FILE_PATHS {
        return Err(format!(
            "File paths list exceeds maximum of {} entries",
            MAX_FILE_PATHS
        ));
    }

    let validated_workspace = validate_path_for_read(Path::new(&workspace_path))
        .map_err(|e| format!("Invalid workspace path: {}", e))?;

    let validated_file_paths: Vec<String> = if !file_paths.is_empty() {
        let mut validated = Vec::with_capacity(file_paths.len());
        for fp in &file_paths {
            let vp = validate_path_for_write(Path::new(fp))
                .map_err(|e| format!("Invalid file path '{}': {}", fp, e))?;
            validated.push(vp.to_string_lossy().to_string());
        }
        validated
    } else {
        Vec::new()
    };

    let result = tokio::task::spawn_blocking(move || {
        let pattern = format!(r"\b{}\b", regex::escape(&old_name));
        let re = Regex::new(&pattern).map_err(|e| format!("Invalid identifier pattern: {}", e))?;

        let files_to_process: Vec<String> = if validated_file_paths.is_empty() {
            let workspace = &validated_workspace;
            if !workspace.is_dir() {
                return Err("Workspace path is not a directory".to_string());
            }

            WalkDir::new(workspace)
                .follow_links(false)
                .into_iter()
                .filter_entry(|e| {
                    if e.file_type().is_dir() {
                        let name = e.file_name().to_string_lossy();
                        return !matches!(
                            name.as_ref(),
                            "node_modules" | ".git" | "target" | "dist" | "build" | "__pycache__"
                        );
                    }
                    true
                })
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.file_type().is_file()
                        && e.path()
                            .extension()
                            .and_then(|ext| ext.to_str())
                            .is_some_and(is_text_file_ext)
                })
                .map(|e| e.path().to_string_lossy().to_string())
                .collect()
        } else {
            validated_file_paths
        };

        info!("Renaming across {} files", files_to_process.len());

        let mut changes = Vec::new();
        let mut total_occurrences = 0u32;

        for file_path in &files_to_process {
            let content = match std::fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to read file: {}", e);
                    continue;
                }
            };

            let count = re.find_iter(&content).count() as u32;
            if count == 0 {
                continue;
            }

            let new_content = re.replace_all(&content, new_name.as_str()).to_string();

            std::fs::write(file_path, &new_content)
                .map_err(|e| format!("Failed to write file: {}", e))?;

            total_occurrences += count;
            changes.push(FileChange {
                file_path: file_path.clone(),
                original_content: content,
                new_content,
                occurrences: count,
            });
        }

        info!(
            "Rename complete: {} occurrences in {} files",
            total_occurrences,
            changes.len()
        );

        Ok(RenameResult {
            files_changed: changes.len() as u32,
            total_occurrences,
            changes,
        })
    })
    .await
    .map_err(|e| format!("Rename operation failed: {}", e))??;

    Ok(result)
}

#[tauri::command]
pub async fn extract_variable(
    content: String,
    start_line: u32,
    start_column: u32,
    end_line: u32,
    end_column: u32,
    variable_name: String,
) -> Result<ExtractResult, String> {
    if variable_name.is_empty() {
        return Err("Variable name cannot be empty".to_string());
    }
    if variable_name.len() > MAX_IDENTIFIER_LENGTH {
        return Err(format!(
            "Variable name exceeds maximum length of {} characters",
            MAX_IDENTIFIER_LENGTH
        ));
    }
    if content.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Content exceeds maximum size of {} bytes",
            MAX_CONTENT_SIZE
        ));
    }

    let result = tokio::task::spawn_blocking(move || {
        let lines: Vec<&str> = content.lines().collect();

        if start_line as usize >= lines.len() || end_line as usize >= lines.len() {
            return Err("Selection range is out of bounds".to_string());
        }

        let selected_text = extract_text_range(
            &lines,
            start_line as usize,
            start_column as usize,
            end_line as usize,
            end_column as usize,
        );

        if selected_text.trim().is_empty() {
            return Err("Selected text is empty".to_string());
        }

        let indent = get_line_indent(lines[start_line as usize]);
        let declaration = format!(
            "{}const {} = {};\n",
            indent,
            variable_name,
            selected_text.trim()
        );

        let mut new_lines: Vec<String> = lines.iter().map(|l| l.to_string()).collect();

        replace_text_range(
            &mut new_lines,
            start_line as usize,
            start_column as usize,
            end_line as usize,
            end_column as usize,
            &variable_name,
        );

        new_lines.insert(start_line as usize, declaration.trim_end().to_string());

        let new_content = new_lines.join("\n");

        info!(
            "Extracted variable '{}' from lines {}-{}",
            variable_name, start_line, end_line
        );

        Ok(ExtractResult {
            new_content,
            extracted_text: selected_text,
            inserted_at_line: start_line,
        })
    })
    .await
    .map_err(|e| format!("Extract variable failed: {}", e))??;

    Ok(result)
}

#[tauri::command]
pub async fn extract_method(
    content: String,
    start_line: u32,
    start_column: u32,
    end_line: u32,
    end_column: u32,
    method_name: String,
) -> Result<ExtractResult, String> {
    if method_name.is_empty() {
        return Err("Method name cannot be empty".to_string());
    }
    if method_name.len() > MAX_IDENTIFIER_LENGTH {
        return Err(format!(
            "Method name exceeds maximum length of {} characters",
            MAX_IDENTIFIER_LENGTH
        ));
    }
    if content.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Content exceeds maximum size of {} bytes",
            MAX_CONTENT_SIZE
        ));
    }

    let result = tokio::task::spawn_blocking(move || {
        let lines: Vec<&str> = content.lines().collect();

        if start_line as usize >= lines.len() || end_line as usize >= lines.len() {
            return Err("Selection range is out of bounds".to_string());
        }

        let selected_text = extract_text_range(
            &lines,
            start_line as usize,
            start_column as usize,
            end_line as usize,
            end_column as usize,
        );

        if selected_text.trim().is_empty() {
            return Err("Selected text is empty".to_string());
        }

        let indent = get_line_indent(lines[start_line as usize]);
        let method_body = build_method_body(&method_name, &selected_text, &indent);
        let call_statement = format!("{}{}();", indent, method_name);

        let mut new_lines: Vec<String> = lines.iter().map(|l| l.to_string()).collect();

        let remove_start = start_line as usize;
        let remove_end = (end_line as usize).min(new_lines.len() - 1);
        new_lines.drain(remove_start..=remove_end);
        new_lines.insert(remove_start, call_statement);

        let insert_position = find_method_insert_position(&new_lines, remove_start);
        let method_lines: Vec<String> = method_body.lines().map(|l| l.to_string()).collect();
        for (offset, line) in method_lines.iter().enumerate() {
            new_lines.insert(insert_position + offset, line.clone());
        }

        let new_content = new_lines.join("\n");

        info!(
            "Extracted method '{}' from lines {}-{}",
            method_name, start_line, end_line
        );

        Ok(ExtractResult {
            new_content,
            extracted_text: selected_text,
            inserted_at_line: insert_position as u32,
        })
    })
    .await
    .map_err(|e| format!("Extract method failed: {}", e))??;

    Ok(result)
}

fn extract_text_range(
    lines: &[&str],
    start_line: usize,
    start_col: usize,
    end_line: usize,
    end_col: usize,
) -> String {
    if start_line == end_line {
        let line = lines[start_line];
        let start = start_col.min(line.len());
        let end = end_col.min(line.len());
        return line[start..end].to_string();
    }

    let mut result = String::new();

    let first_line = lines[start_line];
    let start = start_col.min(first_line.len());
    result.push_str(&first_line[start..]);

    for line in lines.iter().take(end_line).skip(start_line + 1) {
        result.push('\n');
        result.push_str(line);
    }

    result.push('\n');
    let last_line = lines[end_line];
    let end = end_col.min(last_line.len());
    result.push_str(&last_line[..end]);

    result
}

fn replace_text_range(
    lines: &mut Vec<String>,
    start_line: usize,
    start_col: usize,
    end_line: usize,
    end_col: usize,
    replacement: &str,
) {
    if start_line == end_line {
        let line = &lines[start_line];
        let start = start_col.min(line.len());
        let end = end_col.min(line.len());
        let new_line = format!("{}{}{}", &line[..start], replacement, &line[end..]);
        lines[start_line] = new_line;
        return;
    }

    let first_line = &lines[start_line];
    let start = start_col.min(first_line.len());
    let last_line = &lines[end_line];
    let end = end_col.min(last_line.len());

    let new_line = format!(
        "{}{}{}",
        &first_line[..start],
        replacement,
        &last_line[end..]
    );

    lines.drain((start_line + 1)..=end_line);
    lines[start_line] = new_line;
}

fn get_line_indent(line: &str) -> String {
    let indent_len = line.len() - line.trim_start().len();
    line[..indent_len].to_string()
}

fn build_method_body(name: &str, body: &str, base_indent: &str) -> String {
    let inner_indent = format!("{}    ", base_indent);
    let body_lines: Vec<&str> = body.lines().collect();
    let indented_body: Vec<String> = body_lines
        .iter()
        .map(|line| {
            if line.trim().is_empty() {
                String::new()
            } else {
                format!("{}{}", inner_indent, line.trim())
            }
        })
        .collect();

    format!(
        "\n{}function {}() {{\n{}\n{}}}\n",
        base_indent,
        name,
        indented_body.join("\n"),
        base_indent
    )
}

fn find_method_insert_position(lines: &[String], reference_line: usize) -> usize {
    let mut brace_depth = 0i32;
    let mut found_enclosing = false;

    for (i, line) in lines.iter().enumerate().skip(reference_line) {
        let trimmed = line.trim();
        for ch in trimmed.chars() {
            match ch {
                '{' => {
                    brace_depth += 1;
                    found_enclosing = true;
                }
                '}' => {
                    brace_depth -= 1;
                    if found_enclosing && brace_depth <= 0 {
                        return i + 1;
                    }
                }
                _ => {}
            }
        }
    }

    lines.len()
}
