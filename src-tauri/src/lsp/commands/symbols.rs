//! Document symbols commands
//!
//! Commands for document symbol operations with regex fallback for
//! when LSP servers don't provide symbol information.
#![allow(clippy::expect_used)]

use tauri::State;
use tracing::info;

use crate::lsp::types::SymbolInformation;

use super::state::LspState;

/// LSP Symbol Kind (matches LSP specification)
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(u8)]
enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26,
}

/// Document symbol structure matching LSP DocumentSymbol
#[derive(Debug, Clone, serde::Serialize)]
struct DocumentSymbol {
    name: String,
    detail: Option<String>,
    kind: u8,
    range: LspRange,
    #[serde(rename = "selectionRange")]
    selection_range: LspRange,
    children: Vec<DocumentSymbol>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct LspRange {
    start: LspPosition,
    end: LspPosition,
}

#[derive(Debug, Clone, serde::Serialize)]
struct LspPosition {
    line: u32,
    character: u32,
}

/// Pattern definition for symbol extraction
struct SymbolPattern {
    pattern: regex::Regex,
    kind: SymbolKind,
    name_group: usize,
}

/// Get document symbols - tries real LSP first, falls back to regex parsing
#[tauri::command]
pub async fn lsp_document_symbols(
    state: State<'_, LspState>,
    file_path: Option<String>,
    content: String,
    language: String,
    server_id: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    // Try to use real LSP if we have a server_id and file_path
    if let (Some(sid), Some(fp)) = (&server_id, &file_path) {
        let client = {
            let clients = state.clients.lock();
            clients.get(sid).cloned()
        };

        if let Some(client) = client {
            // Build the file URI
            let uri = format!("file://{}", fp.replace('\\', "/"));

            match client.document_symbols(&uri).await {
                Ok(symbols) if !symbols.is_empty() => {
                    info!("Got {} symbols from LSP for {}", symbols.len(), fp);
                    return Ok(symbols);
                }
                Ok(_) => {
                    // Empty result from LSP, fall back to regex
                    info!(
                        "LSP returned empty symbols for {}, falling back to regex",
                        fp
                    );
                }
                Err(e) => {
                    // LSP failed, fall back to regex
                    info!(
                        "LSP document symbols failed for {}: {}, falling back to regex",
                        fp, e
                    );
                }
            }
        }
    }

    // Fallback to regex-based parsing
    let symbols = parse_document_symbols(&content, &language);

    // Convert to JSON values
    let json_symbols: Vec<serde_json::Value> = symbols
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap_or_default())
        .collect();

    Ok(json_symbols)
}

/// Parse document symbols from content based on language
fn parse_document_symbols(content: &str, language: &str) -> Vec<DocumentSymbol> {
    let patterns = get_patterns_for_language(language);
    let lines: Vec<&str> = content.lines().collect();
    let mut symbols = Vec::new();

    for (line_idx, line) in lines.iter().enumerate() {
        for pattern_def in &patterns {
            if let Some(captures) = pattern_def.pattern.captures(line) {
                if let Some(name_match) = captures.get(pattern_def.name_group) {
                    let name = name_match.as_str().to_string();
                    let start_col = name_match.start() as u32;
                    let end_col = name_match.end() as u32;

                    let symbol = DocumentSymbol {
                        name,
                        detail: None,
                        kind: pattern_def.kind as u8,
                        range: LspRange {
                            start: LspPosition {
                                line: line_idx as u32,
                                character: 0,
                            },
                            end: LspPosition {
                                line: line_idx as u32,
                                character: line.len() as u32,
                            },
                        },
                        selection_range: LspRange {
                            start: LspPosition {
                                line: line_idx as u32,
                                character: start_col,
                            },
                            end: LspPosition {
                                line: line_idx as u32,
                                character: end_col,
                            },
                        },
                        children: vec![],
                    };
                    symbols.push(symbol);
                    break; // Only match once per line
                }
            }
        }
    }

    symbols
}

/// Get regex patterns for a specific language
fn get_patterns_for_language(language: &str) -> Vec<SymbolPattern> {
    match language {
        "typescript" | "typescriptreact" | "tsx" => get_typescript_patterns(),
        "javascript" | "javascriptreact" | "jsx" => get_javascript_patterns(),
        "python" => get_python_patterns(),
        "rust" => get_rust_patterns(),
        "go" => get_go_patterns(),
        "java" => get_java_patterns(),
        "c" | "cpp" | "c++" => get_cpp_patterns(),
        "csharp" | "cs" => get_csharp_patterns(),
        "ruby" => get_ruby_patterns(),
        "php" => get_php_patterns(),
        _ => get_generic_patterns(),
    }
}

fn get_typescript_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?interface\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?type\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::TypeParameter,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?enum\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(
                r"^\s+(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\(",
            )
            .expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(
                r"^\s+(?:public|private|protected)?\s*(?:static\s+)?(?:readonly\s+)?(\w+)\s*[=:;]",
            )
            .expect("Static regex pattern is valid"),
            kind: SymbolKind::Property,
            name_group: 1,
        },
    ]
}

fn get_javascript_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s+(?:async\s+)?(\w+)\s*\(")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
    ]
}

fn get_python_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^class\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^(?:async\s+)?def\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s+(?:async\s+)?def\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^(\w+)\s*=").expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
    ]
}

fn get_rust_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?struct\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Struct,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?enum\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?trait\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*impl(?:\s+<[^>]+>)?\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?mod\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Module,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?const\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Constant,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?static\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:pub\s+)?type\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::TypeParameter,
            name_group: 1,
        },
    ]
}

fn get_go_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^type\s+(\w+)\s+struct")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Struct,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^type\s+(\w+)\s+interface")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^func\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^func\s+\([^)]+\)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^package\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Package,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*const\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Constant,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*var\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Variable,
            name_group: 1,
        },
    ]
}

fn get_java_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?class\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected)?\s*interface\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected)?\s*enum\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(").expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^package\s+([\w.]+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Package,
            name_group: 1,
        },
    ]
}

fn get_cpp_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:class|struct)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*enum\s+(?:class\s+)?(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*namespace\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Namespace,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(
                r"^\s*(?:virtual\s+)?(?:\w+(?:<[^>]+>)?(?:\s*[*&])?)\s+(\w+)\s*\(",
            )
            .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^#define\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Constant,
            name_group: 1,
        },
    ]
}

fn get_csharp_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:partial\s+)?class\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected|internal)?\s*interface\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected|internal)?\s*enum\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected|internal)?\s*struct\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Struct,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(").expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^namespace\s+([\w.]+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Namespace,
            name_group: 1,
        },
    ]
}

fn get_ruby_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*class\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*module\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Module,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*def\s+(\w+)").expect("Static regex pattern is valid"),
            kind: SymbolKind::Method,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*attr_(?:reader|writer|accessor)\s+:(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Property,
            name_group: 1,
        },
    ]
}

fn get_php_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:abstract\s+)?class\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*interface\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*trait\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(
                r"^\s*(?:public|private|protected)?\s*(?:static\s+)?function\s+(\w+)",
            )
            .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^namespace\s+([\w\\]+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Namespace,
            name_group: 1,
        },
    ]
}

fn get_generic_patterns() -> Vec<SymbolPattern> {
    vec![
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:class|struct)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Class,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:function|func|fn|def)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Function,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:interface)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Interface,
            name_group: 1,
        },
        SymbolPattern {
            pattern: regex::Regex::new(r"^\s*(?:enum)\s+(\w+)")
                .expect("Static regex pattern is valid"),
            kind: SymbolKind::Enum,
            name_group: 1,
        },
    ]
}

/// Search workspace symbols across all files
#[tauri::command]
pub async fn lsp_workspace_symbols(
    state: State<'_, LspState>,
    server_id: String,
    query: String,
) -> Result<Vec<SymbolInformation>, String> {
    let client = {
        let clients = state.clients.lock();
        clients.get(&server_id).cloned()
    };

    let client = client.ok_or_else(|| format!("Server not found: {}", server_id))?;

    client
        .workspace_symbol(&query)
        .await
        .map_err(|e| format!("Workspace symbol request failed: {}", e))
}
