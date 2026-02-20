//! Workspace Edit Support - Text edit operations for refactoring
//!
//! This module provides support for applying workspace edits, primarily used
//! by refactoring features like Rename Symbol.

use crate::fs::types::TextEdit;

/// Apply a set of text edits to a file
///
/// This command is used by refactoring features (like Rename Symbol) to apply
/// multiple text edits to a file atomically. The edits are applied in reverse
/// order (bottom to top) to maintain correct positions.
#[tauri::command]
pub async fn apply_workspace_edit(uri: String, edits: Vec<TextEdit>) -> Result<(), String> {
    // Convert file:// URI to path
    let file_path = uri.strip_prefix("file://").unwrap_or(&uri);

    tracing::debug!("Applying {} workspace edits to {}", edits.len(), file_path);

    // Read the file content
    let content = tokio::fs::read_to_string(file_path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))?;

    // Split into lines for editing
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();

    // Sort edits in reverse order (bottom to top) to maintain positions
    let mut sorted_edits = edits;
    sorted_edits.sort_by(|a, b| {
        if a.range.start.line != b.range.start.line {
            b.range.start.line.cmp(&a.range.start.line)
        } else {
            b.range.start.character.cmp(&a.range.start.character)
        }
    });

    // Apply each edit
    for edit in sorted_edits {
        let start_line = edit.range.start.line as usize;
        let end_line = edit.range.end.line as usize;
        let start_char = edit.range.start.character as usize;
        let end_char = edit.range.end.character as usize;

        // Ensure line indices are valid
        if start_line >= lines.len() {
            // Edit is past end of file - append new lines if needed
            while lines.len() <= start_line {
                lines.push(String::new());
            }
        }

        if start_line == end_line {
            // Single line edit
            let line = lines
                .get_mut(start_line)
                .ok_or_else(|| format!("Invalid line index: {}", start_line))?;

            let safe_start = start_char.min(line.len());
            let safe_end = end_char.min(line.len());

            let new_line = format!(
                "{}{}{}",
                &line[..safe_start],
                &edit.new_text,
                &line[safe_end..]
            );
            *line = new_line;
        } else {
            // Multi-line edit
            let first_line = lines.get(start_line).cloned().unwrap_or_default();
            let last_line = lines.get(end_line).cloned().unwrap_or_default();

            let safe_start = start_char.min(first_line.len());
            let safe_end = end_char.min(last_line.len());

            let new_content = format!(
                "{}{}{}",
                &first_line[..safe_start],
                &edit.new_text,
                &last_line[safe_end..]
            );

            // Remove the lines in the range and insert the new content
            let range_end = (end_line + 1).min(lines.len());
            lines.drain(start_line..range_end);

            // Insert new lines
            let new_lines: Vec<String> = new_content.lines().map(|s| s.to_string()).collect();
            for (i, line) in new_lines.into_iter().enumerate() {
                lines.insert(start_line + i, line);
            }
        }
    }

    // Join lines and write back
    let new_content = lines.join("\n");

    // Preserve trailing newline if original had one
    let final_content = if content.ends_with('\n') && !new_content.ends_with('\n') {
        format!("{}\n", new_content)
    } else {
        new_content
    };

    tokio::fs::write(file_path, final_content)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", file_path, e))?;

    tracing::info!("Successfully applied workspace edits to {}", file_path);

    Ok(())
}
