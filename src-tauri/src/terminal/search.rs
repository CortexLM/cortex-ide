//! Terminal buffer search
//!
//! Provides search functionality within terminal output buffer.
//! All string handling uses safe UTF-8 conversion.

use serde::{Deserialize, Serialize};

/// A search match in the terminal buffer
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSearchMatch {
    pub line_index: usize,
    pub start_column: usize,
    pub end_column: usize,
    pub line_text: String,
}

/// Search result summary
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSearchResult {
    pub matches: Vec<TerminalSearchMatch>,
    pub total_count: usize,
    pub query: String,
}

/// Search within terminal buffer lines
pub fn search_buffer(
    lines: &[String],
    query: &str,
    case_sensitive: bool,
    max_results: Option<usize>,
) -> TerminalSearchResult {
    let max = max_results.unwrap_or(1000);
    let mut matches = Vec::new();

    if query.is_empty() {
        return TerminalSearchResult {
            matches,
            total_count: 0,
            query: query.to_string(),
        };
    }

    let query_normalized = if case_sensitive {
        query.to_string()
    } else {
        query.to_lowercase()
    };

    for (line_idx, line) in lines.iter().enumerate() {
        if matches.len() >= max {
            break;
        }

        let search_line = if case_sensitive {
            line.clone()
        } else {
            line.to_lowercase()
        };

        let mut search_start = 0;
        while let Some(pos) = search_line[search_start..].find(&query_normalized) {
            if matches.len() >= max {
                break;
            }

            let absolute_pos = search_start + pos;
            matches.push(TerminalSearchMatch {
                line_index: line_idx,
                start_column: absolute_pos,
                end_column: absolute_pos + query.len(),
                line_text: line.clone(),
            });

            search_start = absolute_pos + 1;
        }
    }

    let total_count = matches.len();
    TerminalSearchResult {
        matches,
        total_count,
        query: query.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_basic() {
        let lines = vec![
            "hello world".to_string(),
            "foo bar".to_string(),
            "hello again".to_string(),
        ];
        let result = search_buffer(&lines, "hello", false, None);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.matches[0].line_index, 0);
        assert_eq!(result.matches[1].line_index, 2);
    }

    #[test]
    fn test_search_case_insensitive() {
        let lines = vec!["Hello World".to_string(), "HELLO".to_string()];
        let result = search_buffer(&lines, "hello", false, None);
        assert_eq!(result.total_count, 2);
    }

    #[test]
    fn test_search_case_sensitive() {
        let lines = vec!["Hello World".to_string(), "hello".to_string()];
        let result = search_buffer(&lines, "Hello", true, None);
        assert_eq!(result.total_count, 1);
        assert_eq!(result.matches[0].line_index, 0);
    }

    #[test]
    fn test_search_empty_query() {
        let lines = vec!["hello".to_string()];
        let result = search_buffer(&lines, "", false, None);
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_search_max_results() {
        let lines = vec!["aaa".to_string(); 100];
        let result = search_buffer(&lines, "a", false, Some(5));
        assert_eq!(result.total_count, 5);
    }

    #[test]
    fn test_search_multiple_matches_per_line() {
        let lines = vec!["ab ab ab".to_string()];
        let result = search_buffer(&lines, "ab", false, None);
        assert_eq!(result.total_count, 3);
    }
}
