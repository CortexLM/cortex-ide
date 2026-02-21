//! Deep Link Handler for Cortex Desktop
//!
//! This module handles deep link URIs (Cortex://) to enable external applications
//! to interact with Cortex Desktop. Supported URI formats:
//!
//! - `Cortex://file/{path}` - Open a specific file
//! - `Cortex://open?folder={path}` - Open a folder/project
//! - `Cortex://open?folder={path}&new_window=true` - Open folder in new window
//! - `Cortex://goto/{path}?line={line}&column={column}` - Open file at position
//! - `Cortex://diff?left={path1}&right={path2}` - Open diff view
//! - `Cortex://add?folder={path}` - Add folder to workspace
//! - `Cortex://settings/{id}` - Open specific settings section

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};
use url::Url;

/// Represents parsed deep link actions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum DeepLinkAction {
    /// Open a file at the specified path
    OpenFile { path: String },
    /// Open a folder/project at the specified path
    OpenFolder { path: String, new_window: bool },
    /// Open a file at a specific line and optional column
    OpenGoto {
        path: String,
        line: u32,
        column: Option<u32>,
    },
    /// Open a diff view between two files
    OpenDiff { left: String, right: String },
    /// Add a folder to the current workspace
    AddFolder { path: String },
    /// Navigate to a specific settings section
    OpenSettings { section: String },
    /// Unknown or malformed deep link
    Unknown { raw_url: String },
}

/// Parse a deep link URL into a DeepLinkAction
pub fn parse_deep_link(url_str: &str) -> DeepLinkAction {
    info!("Parsing deep link: {}", url_str);

    // Parse the URL
    let url = match Url::parse(url_str) {
        Ok(u) => u,
        Err(e) => {
            warn!("Failed to parse deep link URL: {}", e);
            return DeepLinkAction::Unknown {
                raw_url: url_str.to_string(),
            };
        }
    };

    // Verify the scheme is "Cortex" (URL parsing lowercases the scheme)
    if !url.scheme().eq_ignore_ascii_case("Cortex") {
        warn!("Unexpected URL scheme: {}", url.scheme());
        return DeepLinkAction::Unknown {
            raw_url: url_str.to_string(),
        };
    }

    // Get the host (action type)
    let host = url.host_str().unwrap_or("");
    let path = url.path();

    match host {
        "file" => {
            // Cortex://file/{path}
            // The path includes the leading slash, so we need to handle it
            let file_path = if path.is_empty() || path == "/" {
                warn!("Empty file path in deep link");
                return DeepLinkAction::Unknown {
                    raw_url: url_str.to_string(),
                };
            } else {
                // Remove leading slash and decode URL encoding
                let decoded = urlencoding::decode(&path[1..]).unwrap_or_else(|_| path[1..].into());

                // On Windows, paths might be like /C:/path/to/file
                // We need to handle this case
                #[cfg(target_os = "windows")]
                let decoded = {
                    let s = decoded.to_string();
                    if s.starts_with('/') && s.len() > 2 && s.chars().nth(2) == Some(':') {
                        s[1..].to_string()
                    } else {
                        s
                    }
                };

                #[cfg(not(target_os = "windows"))]
                let decoded = decoded.to_string();

                decoded
            };

            info!("Deep link: Open file at {}", file_path);
            DeepLinkAction::OpenFile { path: file_path }
        }
        "open" => {
            // Cortex://open?folder={path}&new_window={bool}
            let query_pairs: std::collections::HashMap<_, _> = url.query_pairs().collect();

            if let Some(folder) = query_pairs.get("folder") {
                let folder_path = urlencoding::decode(folder).unwrap_or_else(|_| folder.clone());

                // Handle Windows paths
                #[cfg(target_os = "windows")]
                let folder_path = {
                    let s = folder_path.to_string();
                    if s.starts_with('/') && s.len() > 2 && s.chars().nth(2) == Some(':') {
                        s[1..].to_string()
                    } else {
                        s
                    }
                };

                #[cfg(not(target_os = "windows"))]
                let folder_path = folder_path.to_string();

                // Check for new_window parameter
                let new_window = query_pairs
                    .get("new_window")
                    .map(|v| v == "true" || v == "1")
                    .unwrap_or(false);

                info!(
                    "Deep link: Open folder at {} (new_window: {})",
                    folder_path, new_window
                );
                DeepLinkAction::OpenFolder {
                    path: folder_path,
                    new_window,
                }
            } else {
                warn!("Missing 'folder' query parameter in open deep link");
                DeepLinkAction::Unknown {
                    raw_url: url_str.to_string(),
                }
            }
        }
        "goto" => {
            // Cortex://goto/{path}?line={line}&column={column}
            let query_pairs: std::collections::HashMap<_, _> = url.query_pairs().collect();

            let file_path = if path.is_empty() || path == "/" {
                warn!("Empty file path in goto deep link");
                return DeepLinkAction::Unknown {
                    raw_url: url_str.to_string(),
                };
            } else {
                // Remove leading slash and decode URL encoding
                let decoded = urlencoding::decode(&path[1..]).unwrap_or_else(|_| path[1..].into());

                #[cfg(target_os = "windows")]
                let decoded = {
                    let s = decoded.to_string();
                    if s.starts_with('/') && s.len() > 2 && s.chars().nth(2) == Some(':') {
                        s[1..].to_string()
                    } else {
                        s
                    }
                };

                #[cfg(not(target_os = "windows"))]
                let decoded = decoded.to_string();

                decoded
            };

            let line = query_pairs
                .get("line")
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(1);

            let column = query_pairs
                .get("column")
                .and_then(|v| v.parse::<u32>().ok());

            info!(
                "Deep link: Open file {} at line {} column {:?}",
                file_path, line, column
            );
            DeepLinkAction::OpenGoto {
                path: file_path,
                line,
                column,
            }
        }
        "diff" => {
            // Cortex://diff?left={path1}&right={path2}
            let query_pairs: std::collections::HashMap<_, _> = url.query_pairs().collect();

            let decode_path = |p: &str| -> String {
                let decoded = urlencoding::decode(p).unwrap_or_else(|_| p.into());

                #[cfg(target_os = "windows")]
                let decoded = {
                    let s = decoded.to_string();
                    if s.starts_with('/') && s.len() > 2 && s.chars().nth(2) == Some(':') {
                        s[1..].to_string()
                    } else {
                        s
                    }
                };

                #[cfg(not(target_os = "windows"))]
                let decoded = decoded.to_string();

                decoded
            };

            match (query_pairs.get("left"), query_pairs.get("right")) {
                (Some(left), Some(right)) => {
                    let left_path = decode_path(left);
                    let right_path = decode_path(right);
                    info!("Deep link: Diff {} vs {}", left_path, right_path);
                    DeepLinkAction::OpenDiff {
                        left: left_path,
                        right: right_path,
                    }
                }
                _ => {
                    warn!("Missing 'left' or 'right' query parameter in diff deep link");
                    DeepLinkAction::Unknown {
                        raw_url: url_str.to_string(),
                    }
                }
            }
        }
        "add" => {
            // Cortex://add?folder={path}
            let query_pairs: std::collections::HashMap<_, _> = url.query_pairs().collect();

            if let Some(folder) = query_pairs.get("folder") {
                let folder_path = urlencoding::decode(folder).unwrap_or_else(|_| folder.clone());

                #[cfg(target_os = "windows")]
                let folder_path = {
                    let s = folder_path.to_string();
                    if s.starts_with('/') && s.len() > 2 && s.chars().nth(2) == Some(':') {
                        s[1..].to_string()
                    } else {
                        s
                    }
                };

                #[cfg(not(target_os = "windows"))]
                let folder_path = folder_path.to_string();

                info!("Deep link: Add folder to workspace: {}", folder_path);
                DeepLinkAction::AddFolder { path: folder_path }
            } else {
                warn!("Missing 'folder' query parameter in add deep link");
                DeepLinkAction::Unknown {
                    raw_url: url_str.to_string(),
                }
            }
        }
        "settings" => {
            // Cortex://settings/{id}
            let section = if path.is_empty() || path == "/" {
                "general".to_string()
            } else {
                // Remove leading slash
                let decoded = urlencoding::decode(&path[1..]).unwrap_or_else(|_| path[1..].into());
                decoded.to_string()
            };

            info!("Deep link: Open settings section {}", section);
            DeepLinkAction::OpenSettings { section }
        }
        _ => {
            warn!("Unknown deep link action: {}", host);
            DeepLinkAction::Unknown {
                raw_url: url_str.to_string(),
            }
        }
    }
}

/// Handle incoming deep link URLs and emit events to the frontend
pub fn handle_deep_link(app: &AppHandle, urls: Vec<String>) {
    for url in urls {
        let action = parse_deep_link(&url);

        // Emit the parsed action to the frontend
        if let Err(e) = app.emit("deep:link", &action) {
            warn!("Failed to emit deep link event: {}", e);
        }

        // Focus the main window when receiving a deep link
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_file_deep_link() {
        let action = parse_deep_link("Cortex://file/home/user/project/main.rs");
        match action {
            DeepLinkAction::OpenFile { path } => {
                assert!(path.contains("home/user/project/main.rs"));
            }
            _ => panic!("Expected OpenFile action"),
        }
    }

    #[test]
    fn test_parse_folder_deep_link() {
        let action = parse_deep_link("Cortex://open?folder=/home/user/project");
        match action {
            DeepLinkAction::OpenFolder { path, new_window } => {
                assert!(path.contains("home/user/project"));
                assert!(!new_window);
            }
            _ => panic!("Expected OpenFolder action"),
        }
    }

    #[test]
    fn test_parse_folder_new_window_deep_link() {
        let action = parse_deep_link("Cortex://open?folder=/home/user/project&new_window=true");
        match action {
            DeepLinkAction::OpenFolder { path, new_window } => {
                assert!(path.contains("home/user/project"));
                assert!(new_window);
            }
            _ => panic!("Expected OpenFolder action with new_window"),
        }
    }

    #[test]
    fn test_parse_goto_deep_link() {
        let action = parse_deep_link("Cortex://goto/home/user/file.rs?line=42&column=10");
        match action {
            DeepLinkAction::OpenGoto { path, line, column } => {
                assert!(path.contains("home/user/file.rs"));
                assert_eq!(line, 42);
                assert_eq!(column, Some(10));
            }
            _ => panic!("Expected OpenGoto action"),
        }
    }

    #[test]
    fn test_parse_goto_no_column_deep_link() {
        let action = parse_deep_link("Cortex://goto/home/user/file.rs?line=100");
        match action {
            DeepLinkAction::OpenGoto { path, line, column } => {
                assert!(path.contains("home/user/file.rs"));
                assert_eq!(line, 100);
                assert_eq!(column, None);
            }
            _ => panic!("Expected OpenGoto action without column"),
        }
    }

    #[test]
    fn test_parse_diff_deep_link() {
        let action = parse_deep_link("Cortex://diff?left=/home/old.rs&right=/home/new.rs");
        match action {
            DeepLinkAction::OpenDiff { left, right } => {
                assert!(left.contains("old.rs"));
                assert!(right.contains("new.rs"));
            }
            _ => panic!("Expected OpenDiff action"),
        }
    }

    #[test]
    fn test_parse_add_folder_deep_link() {
        let action = parse_deep_link("Cortex://add?folder=/home/user/lib");
        match action {
            DeepLinkAction::AddFolder { path } => {
                assert!(path.contains("home/user/lib"));
            }
            _ => panic!("Expected AddFolder action"),
        }
    }

    #[test]
    fn test_parse_settings_deep_link() {
        let action = parse_deep_link("Cortex://settings/appearance");
        match action {
            DeepLinkAction::OpenSettings { section } => {
                assert_eq!(section, "appearance");
            }
            _ => panic!("Expected OpenSettings action"),
        }
    }

    #[test]
    fn test_parse_unknown_deep_link() {
        let action = parse_deep_link("Cortex://unknown/something");
        match action {
            DeepLinkAction::Unknown { raw_url } => {
                assert_eq!(raw_url, "Cortex://unknown/something");
            }
            _ => panic!("Expected Unknown action"),
        }
    }
}
