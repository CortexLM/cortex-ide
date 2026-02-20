//! Snippet parsing and expansion engine
//!
//! Parses VSCode-compatible snippet bodies and expands them with
//! variable substitution and tab stop tracking.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tracing::info;

const MAX_SNIPPET_BODY_LINES: usize = 1_000;
const MAX_SNIPPET_VARIABLES: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabStop {
    pub index: u32,
    pub offset: u32,
    pub length: u32,
    pub placeholder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandedSnippet {
    pub text: String,
    pub cursor_offset: u32,
    pub tab_stops: Vec<TabStop>,
}

fn expand_variables(text: &str, variables: &HashMap<String, String>) -> String {
    let mut result = String::with_capacity(text.len());
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if chars[i] == '\\' && i + 1 < len && (chars[i + 1] == '$' || chars[i + 1] == '\\') {
            result.push(chars[i + 1]);
            i += 2;
            continue;
        }

        if chars[i] == '$' {
            if i + 1 < len && chars[i + 1] == '{' {
                if let Some(close) = find_matching_brace(&chars, i + 1) {
                    let inner: String = chars[i + 2..close].iter().collect();

                    if let Some((var_name, default)) = inner.split_once(':') {
                        if let Ok(_idx) = var_name.parse::<u32>() {
                            result.push('$');
                            result.push('{');
                            result.push_str(&inner);
                            result.push('}');
                        } else {
                            let value = variables
                                .get(var_name)
                                .cloned()
                                .unwrap_or_else(|| default.to_string());
                            result.push_str(&value);
                        }
                    } else if let Ok(_idx) = inner.parse::<u32>() {
                        result.push('$');
                        result.push('{');
                        result.push_str(&inner);
                        result.push('}');
                    } else {
                        let value = variables.get(inner.as_str()).cloned().unwrap_or_default();
                        result.push_str(&value);
                    }

                    i = close + 1;
                    continue;
                }
            } else if i + 1 < len && chars[i + 1].is_alphabetic() {
                let var_start = i + 1;
                let mut var_end = var_start;
                while var_end < len && (chars[var_end].is_alphanumeric() || chars[var_end] == '_') {
                    var_end += 1;
                }
                let var_name: String = chars[var_start..var_end].iter().collect();

                if let Some(value) = variables.get(&var_name) {
                    result.push_str(value);
                } else {
                    result.push_str(&var_name);
                }
                i = var_end;
                continue;
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    result
}

fn find_matching_brace(chars: &[char], open_pos: usize) -> Option<usize> {
    let mut depth = 1;
    let mut i = open_pos + 1;
    while i < chars.len() {
        match chars[i] {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            '\\' => {
                i += 1;
            }
            _ => {}
        }
        i += 1;
    }
    None
}

fn parse_tab_stops(text: &str) -> (String, Vec<TabStop>, u32) {
    let mut result = String::with_capacity(text.len());
    let mut tab_stops = Vec::new();
    let mut cursor_offset: Option<u32> = None;

    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if chars[i] == '\\' && i + 1 < len && (chars[i + 1] == '$' || chars[i + 1] == '\\') {
            result.push(chars[i + 1]);
            i += 2;
            continue;
        }

        if chars[i] == '$' {
            if i + 1 < len && chars[i + 1] == '{' {
                if let Some(close) = find_matching_brace(&chars, i + 1) {
                    let inner: String = chars[i + 2..close].iter().collect();

                    if let Some((idx_str, placeholder)) = inner.split_once(':') {
                        if let Ok(idx) = idx_str.parse::<u32>() {
                            let offset = result.len() as u32;
                            let placeholder_str = placeholder.to_string();
                            let placeholder_len = placeholder_str.len() as u32;

                            if idx == 0 {
                                cursor_offset = Some(offset);
                            }

                            tab_stops.push(TabStop {
                                index: idx,
                                offset,
                                length: placeholder_len,
                                placeholder: placeholder_str.clone(),
                            });
                            result.push_str(&placeholder_str);
                            i = close + 1;
                            continue;
                        }
                    } else if let Ok(idx) = inner.parse::<u32>() {
                        let offset = result.len() as u32;

                        if idx == 0 {
                            cursor_offset = Some(offset);
                        }

                        tab_stops.push(TabStop {
                            index: idx,
                            offset,
                            length: 0,
                            placeholder: String::new(),
                        });
                        i = close + 1;
                        continue;
                    }
                }
            } else if i + 1 < len && chars[i + 1].is_ascii_digit() {
                let digit_start = i + 1;
                let mut digit_end = digit_start;
                while digit_end < len && chars[digit_end].is_ascii_digit() {
                    digit_end += 1;
                }
                let idx_str: String = chars[digit_start..digit_end].iter().collect();
                if let Ok(idx) = idx_str.parse::<u32>() {
                    let offset = result.len() as u32;

                    if idx == 0 {
                        cursor_offset = Some(offset);
                    }

                    tab_stops.push(TabStop {
                        index: idx,
                        offset,
                        length: 0,
                        placeholder: String::new(),
                    });
                    i = digit_end;
                    continue;
                }
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    tab_stops.sort_by_key(|t| t.index);

    let final_cursor = cursor_offset.unwrap_or(result.len() as u32);

    (result, tab_stops, final_cursor)
}

#[tauri::command]
pub async fn expand_snippet(
    body: Vec<String>,
    variables: HashMap<String, String>,
) -> Result<ExpandedSnippet, String> {
    if body.len() > MAX_SNIPPET_BODY_LINES {
        return Err(format!(
            "Snippet body exceeds maximum of {} lines",
            MAX_SNIPPET_BODY_LINES
        ));
    }
    if variables.len() > MAX_SNIPPET_VARIABLES {
        return Err(format!(
            "Snippet variables exceed maximum of {} entries",
            MAX_SNIPPET_VARIABLES
        ));
    }

    let result = tokio::task::spawn_blocking(move || {
        let joined = body.join("\n");
        let with_vars = expand_variables(&joined, &variables);
        let (text, tab_stops, cursor_offset) = parse_tab_stops(&with_vars);

        info!(
            "Expanded snippet: {} chars, {} tab stops",
            text.len(),
            tab_stops.len()
        );

        ExpandedSnippet {
            text,
            cursor_offset,
            tab_stops,
        }
    })
    .await
    .map_err(|e| format!("Snippet expansion failed: {}", e))?;

    Ok(result)
}
