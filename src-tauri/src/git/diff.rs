//! Git diff operations.

use super::helpers::{find_repo, get_repo_root};
use super::types::{DiffHunk, DiffHunkLine, DiffHunksResult};
use super::types::{
    DiffHunkData, DiffLine, DiffLineType, StructuredDiff, WordDiffLine, WordDiffResult,
    WordDiffSegment, WordDiffSegmentType,
};

// ============================================================================
// Diff Commands
// ============================================================================

#[tauri::command]
pub async fn git_diff(path: String, file_path: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
            diff_opts.pathspec(fp);
        }

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        let mut diff_text = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let prefix = match line.origin() {
                '+' => "+",
                '-' => "-",
                ' ' => " ",
                '>' => ">",
                '<' => "<",
                'H' => "",
                _ => "",
            };
            if let Ok(content) = std::str::from_utf8(line.content()) {
                diff_text.push_str(prefix);
                diff_text.push_str(content);
            }
            true
        })
        .map_err(|e| format!("Failed to format diff: {}", e))?;

        Ok(diff_text)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_staged(
    path: String,
    file_path: Option<String>,
) -> Result<Vec<StructuredDiff>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_tree = head
            .peel_to_tree()
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
            diff_opts.pathspec(fp);
        }
        let diff = repo
            .diff_tree_to_index(Some(&head_tree), None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?;
        parse_diff_to_structured(&diff)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_word_level(
    path: String,
    file_path: Option<String>,
) -> Result<Vec<WordDiffResult>, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_path = std::path::Path::new(&repo_root);
        let mut args = vec!["diff", "--word-diff=porcelain"];
        let fp_owned: String;
        if let Some(ref fp) = file_path {
            fp_owned = fp.clone();
            args.push("--");
            args.push(&fp_owned);
        }
        let output = super::command::git_command_with_timeout(&args, repo_path)?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to get word diff: {}", stderr));
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        parse_word_diff_porcelain(&stdout, file_path.as_deref())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_between_commits(
    path: String,
    from_sha: String,
    to_sha: String,
    file_path: Option<String>,
) -> Result<Vec<StructuredDiff>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let from_commit = repo
            .find_commit(
                git2::Oid::from_str(&from_sha).map_err(|e| format!("Invalid from SHA: {}", e))?,
            )
            .map_err(|e| format!("Failed to find from commit: {}", e))?;
        let to_commit = repo
            .find_commit(
                git2::Oid::from_str(&to_sha).map_err(|e| format!("Invalid to SHA: {}", e))?,
            )
            .map_err(|e| format!("Failed to find to commit: {}", e))?;
        let from_tree = from_commit
            .tree()
            .map_err(|e| format!("Failed to get from tree: {}", e))?;
        let to_tree = to_commit
            .tree()
            .map_err(|e| format!("Failed to get to tree: {}", e))?;
        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
            diff_opts.pathspec(fp);
        }
        let diff = repo
            .diff_tree_to_tree(Some(&from_tree), Some(&to_tree), Some(&mut diff_opts))
            .map_err(|e| format!("Failed to diff commits: {}", e))?;
        parse_diff_to_structured(&diff)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_diff_to_structured(diff: &git2::Diff) -> Result<Vec<StructuredDiff>, String> {
    use std::cell::RefCell;

    let results: RefCell<Vec<StructuredDiff>> = RefCell::new(Vec::new());
    let current_hunks: RefCell<Vec<DiffHunkData>> = RefCell::new(Vec::new());
    let current_lines: RefCell<Vec<DiffLine>> = RefCell::new(Vec::new());
    type HunkHeader = (u32, u32, u32, u32, String);
    let current_hunk_header: RefCell<Option<HunkHeader>> = RefCell::new(None);
    let additions: RefCell<u32> = RefCell::new(0);
    let deletions: RefCell<u32> = RefCell::new(0);

    diff.foreach(
        &mut |delta, _progress| {
            {
                let mut hunk_header = current_hunk_header.borrow_mut();
                if let Some((old_start, old_lines, new_start, new_lines, header)) =
                    hunk_header.take()
                {
                    let lines = current_lines.borrow_mut().drain(..).collect();
                    current_hunks.borrow_mut().push(DiffHunkData {
                        old_start,
                        old_lines,
                        new_start,
                        new_lines,
                        header,
                        lines,
                    });
                }
            }

            {
                let hunks: Vec<DiffHunkData> = current_hunks.borrow_mut().drain(..).collect();
                if !hunks.is_empty() {
                    let mut res = results.borrow_mut();
                    if let Some(last) = res.last_mut() {
                        last.hunks = hunks;
                        last.additions = *additions.borrow();
                        last.deletions = *deletions.borrow();
                    }
                }
            }

            *additions.borrow_mut() = 0;
            *deletions.borrow_mut() = 0;

            let file_path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            results.borrow_mut().push(StructuredDiff {
                file_path,
                hunks: Vec::new(),
                additions: 0,
                deletions: 0,
            });

            true
        },
        None,
        Some(&mut |_delta, hunk| {
            {
                let mut hunk_header = current_hunk_header.borrow_mut();
                if let Some((old_start, old_lines, new_start, new_lines, header)) =
                    hunk_header.take()
                {
                    let lines = current_lines.borrow_mut().drain(..).collect();
                    current_hunks.borrow_mut().push(DiffHunkData {
                        old_start,
                        old_lines,
                        new_start,
                        new_lines,
                        header,
                        lines,
                    });
                }
            }

            *current_hunk_header.borrow_mut() = Some((
                hunk.old_start(),
                hunk.old_lines(),
                hunk.new_start(),
                hunk.new_lines(),
                String::from_utf8_lossy(hunk.header()).to_string(),
            ));

            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let change_type = match line.origin() {
                '+' => {
                    *additions.borrow_mut() += 1;
                    DiffLineType::Addition
                }
                '-' => {
                    *deletions.borrow_mut() += 1;
                    DiffLineType::Deletion
                }
                ' ' => DiffLineType::Context,
                _ => DiffLineType::Header,
            };

            current_lines.borrow_mut().push(DiffLine {
                change_type,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
                content: String::from_utf8_lossy(line.content()).to_string(),
            });

            true
        }),
    )
    .map_err(|e| format!("Failed to iterate diff: {}", e))?;

    {
        let mut hunk_header = current_hunk_header.borrow_mut();
        if let Some((old_start, old_lines, new_start, new_lines, header)) = hunk_header.take() {
            let lines = current_lines.borrow_mut().drain(..).collect();
            current_hunks.borrow_mut().push(DiffHunkData {
                old_start,
                old_lines,
                new_start,
                new_lines,
                header,
                lines,
            });
        }
    }

    {
        let hunks: Vec<DiffHunkData> = current_hunks.borrow_mut().drain(..).collect();
        if !hunks.is_empty() {
            let mut res = results.borrow_mut();
            if let Some(last) = res.last_mut() {
                last.hunks = hunks;
                last.additions = *additions.borrow();
                last.deletions = *deletions.borrow();
            }
        }
    }

    Ok(results.into_inner())
}

fn parse_word_diff_porcelain(
    output: &str,
    file_path: Option<&str>,
) -> Result<Vec<WordDiffResult>, String> {
    let mut results: Vec<WordDiffResult> = Vec::new();
    let mut current_file: Option<String> = file_path.map(|s| s.to_string());
    let mut current_lines: Vec<WordDiffLine> = Vec::new();
    let mut current_segments: Vec<WordDiffSegment> = Vec::new();
    let mut old_line_no: u32 = 0;
    let mut new_line_no: u32 = 0;
    let mut in_diff_content = false;

    for line in output.lines() {
        if line.starts_with("diff --git ") {
            if !current_segments.is_empty() {
                current_lines.push(WordDiffLine {
                    old_line_no: Some(old_line_no),
                    new_line_no: Some(new_line_no),
                    segments: std::mem::take(&mut current_segments),
                });
            }

            if let Some(file) = current_file.take() {
                if !current_lines.is_empty() {
                    results.push(WordDiffResult {
                        file_path: file,
                        lines: std::mem::take(&mut current_lines),
                    });
                }
            }

            let parts: Vec<&str> = line.split(' ').collect();
            if parts.len() >= 4 {
                current_file = Some(parts[3].strip_prefix("b/").unwrap_or(parts[3]).to_string());
            }
            in_diff_content = false;
            continue;
        }

        if line.starts_with("@@ ") {
            if !current_segments.is_empty() {
                current_lines.push(WordDiffLine {
                    old_line_no: Some(old_line_no),
                    new_line_no: Some(new_line_no),
                    segments: std::mem::take(&mut current_segments),
                });
            }

            if let Some((old_start, new_start)) = parse_hunk_header(line) {
                old_line_no = old_start;
                new_line_no = new_start;
            }
            in_diff_content = true;
            continue;
        }

        if !in_diff_content {
            continue;
        }

        if line == "~" {
            if !current_segments.is_empty() {
                current_lines.push(WordDiffLine {
                    old_line_no: Some(old_line_no),
                    new_line_no: Some(new_line_no),
                    segments: std::mem::take(&mut current_segments),
                });
            }
            old_line_no += 1;
            new_line_no += 1;
        } else if let Some(content) = line.strip_prefix('+') {
            current_segments.push(WordDiffSegment {
                segment_type: WordDiffSegmentType::Added,
                content: content.to_string(),
            });
        } else if let Some(content) = line.strip_prefix('-') {
            current_segments.push(WordDiffSegment {
                segment_type: WordDiffSegmentType::Removed,
                content: content.to_string(),
            });
        } else if let Some(content) = line.strip_prefix(' ') {
            current_segments.push(WordDiffSegment {
                segment_type: WordDiffSegmentType::Equal,
                content: content.to_string(),
            });
        }
    }

    if !current_segments.is_empty() {
        current_lines.push(WordDiffLine {
            old_line_no: Some(old_line_no),
            new_line_no: Some(new_line_no),
            segments: std::mem::take(&mut current_segments),
        });
    }

    if let Some(file) = current_file.take() {
        if !current_lines.is_empty() {
            results.push(WordDiffResult {
                file_path: file,
                lines: std::mem::take(&mut current_lines),
            });
        }
    }

    Ok(results)
}

fn parse_hunk_header(header: &str) -> Option<(u32, u32)> {
    let header = header.strip_prefix("@@ ")?;
    let parts: Vec<&str> = header.splitn(3, ' ').collect();
    if parts.len() < 2 {
        return None;
    }

    let old_part = parts[0].strip_prefix('-')?;
    let new_part = parts[1].strip_prefix('+')?;

    let old_start = old_part.split(',').next()?.parse::<u32>().ok()?;
    let new_start = new_part.split(',').next()?.parse::<u32>().ok()?;

    Some((old_start, new_start))
}

/// Get structured diff hunks with line numbers for both sides.
#[tauri::command]
pub async fn git_diff_hunks(
    path: String,
    file_path: Option<String>,
) -> Result<Vec<DiffHunksResult>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
            diff_opts.pathspec(fp);
        }

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        use std::cell::RefCell;
        use std::collections::HashMap;

        struct FileHunks {
            path: String,
            hunks: Vec<DiffHunk>,
            current_hunk: Option<DiffHunk>,
        }

        let files: RefCell<HashMap<String, FileHunks>> = RefCell::new(HashMap::new());
        let current_path: RefCell<String> = RefCell::new(String::new());

        diff.foreach(
            &mut |delta, _progress| {
                let file_path = delta
                    .new_file()
                    .path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                *current_path.borrow_mut() = file_path.clone();
                files
                    .borrow_mut()
                    .entry(file_path.clone())
                    .or_insert_with(|| FileHunks {
                        path: file_path,
                        hunks: Vec::new(),
                        current_hunk: None,
                    });
                true
            },
            None,
            Some(&mut |_delta, hunk| {
                let cp = current_path.borrow().clone();
                let mut files_map = files.borrow_mut();
                if let Some(file_hunks) = files_map.get_mut(&cp) {
                    if let Some(prev_hunk) = file_hunks.current_hunk.take() {
                        file_hunks.hunks.push(prev_hunk);
                    }
                    let header = String::from_utf8_lossy(hunk.header()).trim().to_string();
                    file_hunks.current_hunk = Some(DiffHunk {
                        old_start: hunk.old_start(),
                        old_lines: hunk.old_lines(),
                        new_start: hunk.new_start(),
                        new_lines: hunk.new_lines(),
                        header,
                        lines: Vec::new(),
                    });
                }
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                let cp = current_path.borrow().clone();
                let mut files_map = files.borrow_mut();
                if let Some(file_hunks) = files_map.get_mut(&cp) {
                    if let Some(ref mut current_hunk) = file_hunks.current_hunk {
                        let origin = match line.origin() {
                            '+' => "addition",
                            '-' => "deletion",
                            ' ' => "context",
                            _ => "context",
                        };
                        let content = String::from_utf8_lossy(line.content()).to_string();
                        current_hunk.lines.push(DiffHunkLine {
                            origin: origin.to_string(),
                            content,
                            old_lineno: line.old_lineno(),
                            new_lineno: line.new_lineno(),
                        });
                    }
                }
                true
            }),
        )
        .map_err(|e| format!("Failed to iterate diff: {}", e))?;

        let mut files_map = files.into_inner();
        let mut results: Vec<DiffHunksResult> = Vec::new();
        for (_path, mut file_hunks) in files_map.drain() {
            if let Some(last_hunk) = file_hunks.current_hunk.take() {
                file_hunks.hunks.push(last_hunk);
            }
            results.push(DiffHunksResult {
                path: file_hunks.path,
                hunks: file_hunks.hunks,
            });
        }

        Ok(results)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn create_repo_with_file(
        dir: &std::path::Path,
        filename: &str,
        content: &str,
    ) -> git2::Repository {
        let repo = git2::Repository::init(dir).unwrap();
        std::fs::write(dir.join(filename), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(filename)).unwrap();
        index.write().unwrap();
        let sig = git2::Signature::now("Test User", "test@example.com").unwrap();
        let tree_id = index.write_tree().unwrap();
        {
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
                .unwrap();
        }
        repo
    }

    #[test]
    fn test_structured_diff_construction() {
        let diff = StructuredDiff {
            file_path: "src/main.rs".to_string(),
            hunks: vec![DiffHunkData {
                old_start: 1,
                old_lines: 3,
                new_start: 1,
                new_lines: 4,
                header: "@@ -1,3 +1,4 @@".to_string(),
                lines: vec![DiffLine {
                    change_type: DiffLineType::Addition,
                    old_line_no: None,
                    new_line_no: Some(1),
                    content: "new line".to_string(),
                }],
            }],
            additions: 1,
            deletions: 0,
        };
        let json = serde_json::to_string(&diff).unwrap();
        assert!(json.contains("\"filePath\":\"src/main.rs\""));
        assert!(json.contains("\"additions\":1"));
        assert!(json.contains("\"deletions\":0"));
    }

    #[test]
    fn test_diff_hunk_data_construction() {
        let hunk = DiffHunkData {
            old_start: 10,
            old_lines: 5,
            new_start: 10,
            new_lines: 7,
            header: "@@ -10,5 +10,7 @@ fn example()".to_string(),
            lines: vec![],
        };
        assert_eq!(hunk.old_start, 10);
        assert_eq!(hunk.old_lines, 5);
        assert_eq!(hunk.new_start, 10);
        assert_eq!(hunk.new_lines, 7);
        assert!(hunk.header.contains("fn example()"));
        assert!(hunk.lines.is_empty());
    }

    #[test]
    fn test_diff_line_construction() {
        let context = DiffLine {
            change_type: DiffLineType::Context,
            old_line_no: Some(5),
            new_line_no: Some(5),
            content: "unchanged line".to_string(),
        };
        let json = serde_json::to_string(&context).unwrap();
        assert!(json.contains("\"Context\""));

        let addition = DiffLine {
            change_type: DiffLineType::Addition,
            old_line_no: None,
            new_line_no: Some(6),
            content: "added line".to_string(),
        };
        let json = serde_json::to_string(&addition).unwrap();
        assert!(json.contains("\"Addition\""));

        let deletion = DiffLine {
            change_type: DiffLineType::Deletion,
            old_line_no: Some(6),
            new_line_no: None,
            content: "removed line".to_string(),
        };
        let json = serde_json::to_string(&deletion).unwrap();
        assert!(json.contains("\"Deletion\""));

        let header = DiffLine {
            change_type: DiffLineType::Header,
            old_line_no: None,
            new_line_no: None,
            content: "diff header".to_string(),
        };
        let json = serde_json::to_string(&header).unwrap();
        assert!(json.contains("\"Header\""));
    }

    #[test]
    fn test_word_diff_segment_construction() {
        let equal = WordDiffSegment {
            segment_type: WordDiffSegmentType::Equal,
            content: "same text".to_string(),
        };
        let json = serde_json::to_string(&equal).unwrap();
        assert!(json.contains("\"Equal\""));
        assert!(json.contains("same text"));

        let added = WordDiffSegment {
            segment_type: WordDiffSegmentType::Added,
            content: "new text".to_string(),
        };
        let json = serde_json::to_string(&added).unwrap();
        assert!(json.contains("\"Added\""));

        let removed = WordDiffSegment {
            segment_type: WordDiffSegmentType::Removed,
            content: "old text".to_string(),
        };
        let json = serde_json::to_string(&removed).unwrap();
        assert!(json.contains("\"Removed\""));
    }

    #[test]
    fn test_diff_line_type_variants() {
        let variants = vec![
            DiffLineType::Context,
            DiffLineType::Addition,
            DiffLineType::Deletion,
            DiffLineType::Header,
        ];
        for variant in variants {
            let json = serde_json::to_string(&variant).unwrap();
            assert!(!json.is_empty());
        }
    }

    #[test]
    fn test_parse_hunk_header_valid() {
        let result = parse_hunk_header("@@ -1,3 +1,4 @@ fn main()");
        assert_eq!(result, Some((1, 1)));

        let result = parse_hunk_header("@@ -10,5 +12,7 @@");
        assert_eq!(result, Some((10, 12)));

        let result = parse_hunk_header("@@ -100 +200 @@");
        assert_eq!(result, Some((100, 200)));
    }

    #[test]
    fn test_parse_hunk_header_invalid() {
        assert_eq!(parse_hunk_header("not a hunk header"), None);
        assert_eq!(parse_hunk_header("@@ invalid"), None);
        assert_eq!(parse_hunk_header(""), None);
        assert_eq!(parse_hunk_header("@@ -abc +def @@"), None);
    }

    #[test]
    fn test_parse_word_diff_porcelain_empty() {
        let result = parse_word_diff_porcelain("", None).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_word_diff_porcelain_with_content() {
        let input = "diff --git a/file.txt b/file.txt\n\
                     index abc..def 100644\n\
                     --- a/file.txt\n\
                     +++ b/file.txt\n\
                     @@ -1,1 +1,1 @@\n\
                     -old word\n\
                     +new word\n\
                     ~\n";
        let result = parse_word_diff_porcelain(input, None).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].file_path, "file.txt");
        assert!(!result[0].lines.is_empty());
    }

    #[test]
    fn test_parse_word_diff_porcelain_with_file_path() {
        let input = "@@ -1,1 +1,1 @@\n\
                      old\n\
                     +new\n\
                     ~\n";
        let result = parse_word_diff_porcelain(input, Some("specific.txt")).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].file_path, "specific.txt");
    }

    #[test]
    fn test_parse_word_diff_porcelain_equal_segment() {
        let input = "@@ -1,1 +1,1 @@\n unchanged\n~\n";
        let result = parse_word_diff_porcelain(input, Some("test.txt")).unwrap();
        assert_eq!(result.len(), 1);
        let line = &result[0].lines[0];
        assert_eq!(line.segments.len(), 1);
        assert!(matches!(
            line.segments[0].segment_type,
            WordDiffSegmentType::Equal
        ));
        assert_eq!(line.segments[0].content, "unchanged");
    }

    #[test]
    fn test_diff_with_temp_repo() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_file(dir.path(), "test.txt", "line1\nline2\nline3\n");

        std::fs::write(dir.path().join("test.txt"), "line1\nmodified\nline3\n").unwrap();

        let mut diff_opts = git2::DiffOptions::new();
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let result = parse_diff_to_structured(&diff).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].file_path, "test.txt");
        assert!(!result[0].hunks.is_empty());
        assert!(result[0].additions > 0 || result[0].deletions > 0);
    }

    #[test]
    fn test_diff_empty_repo_no_changes() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_file(dir.path(), "test.txt", "content\n");

        let mut diff_opts = git2::DiffOptions::new();
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let result = parse_diff_to_structured(&diff).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_diff_multiple_files() {
        let dir = tempfile::tempdir().unwrap();
        let repo = create_repo_with_file(dir.path(), "a.txt", "aaa\n");

        std::fs::write(dir.path().join("b.txt"), "bbb\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("b.txt")).unwrap();
        index.write().unwrap();
        let sig = git2::Signature::now("Test", "test@example.com").unwrap();
        let head = repo.head().unwrap().target().unwrap();
        let parent = repo.find_commit(head).unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add b.txt", &tree, &[&parent])
            .unwrap();

        std::fs::write(dir.path().join("a.txt"), "modified a\n").unwrap();
        std::fs::write(dir.path().join("b.txt"), "modified b\n").unwrap();

        let mut diff_opts = git2::DiffOptions::new();
        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .unwrap();

        let result = parse_diff_to_structured(&diff).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_structured_diff_serialization_roundtrip() {
        let diff = StructuredDiff {
            file_path: "test.rs".to_string(),
            hunks: vec![],
            additions: 5,
            deletions: 3,
        };
        let json = serde_json::to_string(&diff).unwrap();
        let deserialized: StructuredDiff = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_path, "test.rs");
        assert_eq!(deserialized.additions, 5);
        assert_eq!(deserialized.deletions, 3);
    }
}
