//! Inline diff computation using the `similar` crate
//!
//! Provides line-level and character-level diff computation for
//! displaying inline differences in the editor.

use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};
use tracing::info;

const MAX_CONTENT_SIZE: usize = 10 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffChangeType {
    Equal,
    Insert,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharChange {
    pub change_type: DiffChangeType,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub change_type: DiffChangeType,
    pub content: String,
    pub old_line_number: Option<u32>,
    pub new_line_number: Option<u32>,
    pub char_changes: Vec<CharChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    pub insertions: u32,
    pub deletions: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InlineDiffResult {
    pub lines: Vec<DiffLine>,
    pub stats: DiffStats,
    pub has_changes: bool,
}

fn compute_char_diff(old_text: &str, new_text: &str) -> Vec<CharChange> {
    let diff = TextDiff::from_chars(old_text, new_text);
    diff.iter_all_changes()
        .map(|change| {
            let change_type = match change.tag() {
                ChangeTag::Equal => DiffChangeType::Equal,
                ChangeTag::Insert => DiffChangeType::Insert,
                ChangeTag::Delete => DiffChangeType::Delete,
            };
            CharChange {
                change_type,
                value: change.value().to_string(),
            }
        })
        .collect()
}

fn compute_diff_sync(original: &str, modified: &str) -> InlineDiffResult {
    let diff = TextDiff::from_lines(original, modified);

    let mut lines = Vec::new();
    let mut insertions = 0u32;
    let mut deletions = 0u32;
    let mut unchanged = 0u32;

    let changes: Vec<_> = diff.iter_all_changes().collect();
    let mut i = 0;

    while i < changes.len() {
        let change = &changes[i];
        let content = change.value().to_string();
        let content_trimmed = content.trim_end_matches('\n').to_string();

        match change.tag() {
            ChangeTag::Equal => {
                unchanged += 1;
                lines.push(DiffLine {
                    change_type: DiffChangeType::Equal,
                    content: content_trimmed,
                    old_line_number: change.old_index().map(|n| n as u32 + 1),
                    new_line_number: change.new_index().map(|n| n as u32 + 1),
                    char_changes: Vec::new(),
                });
                i += 1;
            }
            ChangeTag::Delete => {
                deletions += 1;

                let mut char_changes = Vec::new();
                if i + 1 < changes.len() && changes[i + 1].tag() == ChangeTag::Insert {
                    let insert_content = changes[i + 1].value();
                    char_changes = compute_char_diff(
                        content.trim_end_matches('\n'),
                        insert_content.trim_end_matches('\n'),
                    );
                }

                lines.push(DiffLine {
                    change_type: DiffChangeType::Delete,
                    content: content_trimmed,
                    old_line_number: change.old_index().map(|n| n as u32 + 1),
                    new_line_number: None,
                    char_changes: char_changes.clone(),
                });

                if i + 1 < changes.len() && changes[i + 1].tag() == ChangeTag::Insert {
                    insertions += 1;
                    let insert_change = &changes[i + 1];
                    let insert_content = insert_change.value().trim_end_matches('\n').to_string();

                    lines.push(DiffLine {
                        change_type: DiffChangeType::Insert,
                        content: insert_content,
                        old_line_number: None,
                        new_line_number: insert_change.new_index().map(|n| n as u32 + 1),
                        char_changes,
                    });
                    i += 2;
                } else {
                    i += 1;
                }
            }
            ChangeTag::Insert => {
                insertions += 1;
                lines.push(DiffLine {
                    change_type: DiffChangeType::Insert,
                    content: content_trimmed,
                    old_line_number: None,
                    new_line_number: change.new_index().map(|n| n as u32 + 1),
                    char_changes: Vec::new(),
                });
                i += 1;
            }
        }
    }

    let has_changes = insertions > 0 || deletions > 0;

    InlineDiffResult {
        lines,
        stats: DiffStats {
            insertions,
            deletions,
            unchanged,
        },
        has_changes,
    }
}

#[tauri::command]
pub async fn compute_inline_diff(
    original: String,
    modified: String,
) -> Result<InlineDiffResult, String> {
    if original.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Original content exceeds maximum size of {} bytes",
            MAX_CONTENT_SIZE
        ));
    }
    if modified.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Modified content exceeds maximum size of {} bytes",
            MAX_CONTENT_SIZE
        ));
    }

    let result = tokio::task::spawn_blocking(move || compute_diff_sync(&original, &modified))
        .await
        .map_err(|e| format!("Diff computation failed: {}", e))?;

    info!(
        "Computed inline diff: +{} -{} ={}",
        result.stats.insertions, result.stats.deletions, result.stats.unchanged
    );

    Ok(result)
}
