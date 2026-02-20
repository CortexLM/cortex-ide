//! Terminal link detection
//!
//! Detects clickable links in terminal output including URLs and file paths
//! with optional line numbers. All string handling uses safe UTF-8 conversion.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

/// A detected link in terminal output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalLink {
    pub start_index: usize,
    pub end_index: usize,
    pub text: String,
    pub link_type: TerminalLinkType,
    pub uri: Option<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

/// Type of terminal link
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TerminalLinkType {
    Url,
    FilePath,
    FilePathWithLine,
}

static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    // SAFETY: This regex pattern is a compile-time constant and is always valid.
    #[allow(clippy::expect_used)]
    Regex::new(r#"https?://[^\s\])<>"'`]+"#).expect("URL regex is valid")
});

static FILE_PATH_LINE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    // SAFETY: This regex pattern is a compile-time constant and is always valid.
    #[allow(clippy::expect_used)]
    Regex::new(r"(?:(?:[a-zA-Z]:)?(?:[/\\][\w.\-@]+)+)(?::(\d+))?(?::(\d+))?")
        .expect("File path regex is valid")
});

/// Detect links in a line of terminal output
pub fn detect_links(text: &str) -> Vec<TerminalLink> {
    let mut links = Vec::new();

    for m in URL_REGEX.find_iter(text) {
        let url_text = m.as_str();
        let trimmed = url_text.trim_end_matches(['.', ',', ';', ':', ')', ']']);
        links.push(TerminalLink {
            start_index: m.start(),
            end_index: m.start() + trimmed.len(),
            text: trimmed.to_string(),
            link_type: TerminalLinkType::Url,
            uri: Some(trimmed.to_string()),
            line: None,
            column: None,
        });
    }

    for caps in FILE_PATH_LINE_REGEX.captures_iter(text) {
        let Some(full_match) = caps.get(0) else {
            continue;
        };
        let path_text = full_match.as_str();

        if path_text.starts_with("http") {
            continue;
        }

        let line = caps.get(1).and_then(|m| m.as_str().parse::<u32>().ok());
        let column = caps.get(2).and_then(|m| m.as_str().parse::<u32>().ok());

        let link_type = if line.is_some() {
            TerminalLinkType::FilePathWithLine
        } else {
            TerminalLinkType::FilePath
        };

        let path_end = if let Some(line_match) = caps.get(1) {
            line_match.start() - 1
        } else {
            full_match.end()
        };
        let clean_path = &text[full_match.start()..path_end];

        let already_covered = links
            .iter()
            .any(|l| full_match.start() >= l.start_index && full_match.start() < l.end_index);
        if already_covered {
            continue;
        }

        links.push(TerminalLink {
            start_index: full_match.start(),
            end_index: full_match.end(),
            text: path_text.to_string(),
            link_type,
            uri: Some(clean_path.to_string()),
            line,
            column,
        });
    }

    links.sort_by_key(|l| l.start_index);
    links
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_url() {
        let links = detect_links("Visit https://example.com/path for info");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].link_type, TerminalLinkType::Url);
        assert_eq!(links[0].uri.as_deref(), Some("https://example.com/path"));
    }

    #[test]
    fn test_detect_file_path_with_line() {
        let links = detect_links("error at /src/main.rs:42:10");
        assert!(
            links
                .iter()
                .any(|l| l.link_type == TerminalLinkType::FilePathWithLine)
        );
        let file_link = links
            .iter()
            .find(|l| l.link_type == TerminalLinkType::FilePathWithLine)
            .unwrap();
        assert_eq!(file_link.line, Some(42));
        assert_eq!(file_link.column, Some(10));
    }

    #[test]
    fn test_detect_url_trimming() {
        let links = detect_links("see https://example.com/page.");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].uri.as_deref(), Some("https://example.com/page"));
    }

    #[test]
    fn test_empty_string() {
        let links = detect_links("");
        assert!(links.is_empty());
    }

    #[test]
    fn test_no_links() {
        let links = detect_links("just some regular text");
        assert!(links.is_empty());
    }
}
