//! Git log and history operations.

use git2::BranchType;
use std::collections::HashMap;

use super::command::git_command_with_timeout;
use super::helpers::find_repo;
use super::types::{BranchComparison, CommitComparison, CommitFile, GitCommit};
use super::types::{CommitGraphNode, CommitGraphOptions, CommitGraphResult};
use super::types::{GraphCommitNode, GraphRef};
use std::path::Path;
use tracing::{debug, info};

// ============================================================================
// Log Commands
// ============================================================================

#[tauri::command]
pub async fn git_log(
    path: String,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<Vec<GitCommit>, String> {
    tokio::task::spawn_blocking(move || git_log_sync(&path, max_count, branch))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_log_sync(
    path: &str,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<Vec<GitCommit>, String> {
    let repo = find_repo(path)?;
    let mut commits = Vec::new();

    let max = max_count.unwrap_or(100) as usize;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    // If branch specified, start from that branch's head
    if let Some(ref branch_name) = branch {
        // Try local branch first
        let branch_oid = repo
            .find_branch(branch_name, BranchType::Local)
            .or_else(|_| repo.find_branch(branch_name, BranchType::Remote))
            .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?
            .get()
            .target()
            .ok_or_else(|| format!("Branch '{}' has no target", branch_name))?;

        revwalk
            .push(branch_oid)
            .map_err(|e| format!("Failed to push branch: {}", e))?;
    } else {
        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    }

    for (i, oid_result) in revwalk.enumerate() {
        if i >= max {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let sha = oid.to_string();
        let short_sha = sha[..7.min(sha.len())].to_string();
        let message = commit.message().unwrap_or("").to_string();
        let author = commit.author();

        commits.push(GitCommit {
            sha,
            short_sha,
            message,
            author: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            date: commit.time().seconds(),
        });
    }

    Ok(commits)
}

// ============================================================================
// Refs Commands
// ============================================================================

fn git_get_refs_sync(path: &str) -> Result<HashMap<String, Vec<String>>, String> {
    let repo = find_repo(path)?;
    let mut refs_map: HashMap<String, Vec<String>> = HashMap::new();

    // Get HEAD ref
    if let Ok(head) = repo.head() {
        if let Some(target) = head.target() {
            let sha = target.to_string();
            refs_map.entry(sha).or_default().push("HEAD".to_string());
        }
    }

    // Get all references (branches and tags)
    let references = repo
        .references()
        .map_err(|e| format!("Failed to get references: {}", e))?;

    for reference_result in references {
        let reference = match reference_result {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Get the target commit (resolve if symbolic)
        let target = if reference.is_branch() || reference.is_remote() {
            reference.target()
        } else if reference.is_tag() {
            // For tags, try to peel to commit
            reference
                .peel_to_commit()
                .ok()
                .map(|c| c.id())
                .or_else(|| reference.target())
        } else {
            reference.target()
        };

        if let Some(oid) = target {
            let sha = oid.to_string();
            let ref_name = reference.name().unwrap_or("").to_string();

            // Skip HEAD (already added)
            if ref_name == "HEAD" {
                continue;
            }

            // Format ref name for display
            let display_name = if ref_name.starts_with("refs/heads/") {
                #[allow(clippy::expect_used)]
                ref_name
                    .strip_prefix("refs/heads/")
                    .expect("Prefix was matched, strip should succeed")
                    .to_string()
            } else if ref_name.starts_with("refs/remotes/") {
                #[allow(clippy::expect_used)]
                ref_name
                    .strip_prefix("refs/remotes/")
                    .expect("Prefix was matched, strip should succeed")
                    .to_string()
            } else if ref_name.starts_with("refs/tags/") {
                #[allow(clippy::expect_used)]
                let tag_name = ref_name
                    .strip_prefix("refs/tags/")
                    .expect("Prefix was matched, strip should succeed");
                format!("tag: {}", tag_name)
            } else {
                ref_name
            };

            refs_map.entry(sha).or_default().push(display_name);
        }
    }

    Ok(refs_map)
}

#[tauri::command]
pub async fn git_get_refs(path: String) -> Result<HashMap<String, Vec<String>>, String> {
    tokio::task::spawn_blocking(move || git_get_refs_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Graph Commands
// ============================================================================

#[tauri::command]
pub async fn git_log_graph(
    path: String,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<Vec<GraphCommitNode>, String> {
    tokio::task::spawn_blocking(move || git_log_graph_sync(&path, max_count, branch))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_log_graph_sync(
    path: &str,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<Vec<GraphCommitNode>, String> {
    let repo = find_repo(path)?;
    let max = max_count.unwrap_or(200) as usize;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| format!("Failed to set sorting: {}", e))?;

    if let Some(ref branch_name) = branch {
        let branch_oid = repo
            .find_branch(branch_name, BranchType::Local)
            .or_else(|_| repo.find_branch(branch_name, BranchType::Remote))
            .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?
            .get()
            .target()
            .ok_or_else(|| format!("Branch '{}' has no target", branch_name))?;
        revwalk
            .push(branch_oid)
            .map_err(|e| format!("Failed to push branch: {}", e))?;
    } else {
        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    }

    // Collect refs map for labeling
    let refs_map = git_get_refs_sync(path).unwrap_or_default();

    // Collect commits with parent info
    struct RawCommit {
        sha: String,
        short_sha: String,
        message: String,
        author: String,
        author_email: String,
        date: i64,
        parents: Vec<String>,
    }

    let mut raw_commits = Vec::new();
    for (i, oid_result) in revwalk.enumerate() {
        if i >= max {
            break;
        }
        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;
        let sha = oid.to_string();
        let short_sha = sha[..7.min(sha.len())].to_string();
        let message = commit.message().unwrap_or("").to_string();
        let author_sig = commit.author();
        let parents: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

        raw_commits.push(RawCommit {
            sha,
            short_sha,
            message,
            author: author_sig.name().unwrap_or("").to_string(),
            author_email: author_sig.email().unwrap_or("").to_string(),
            date: commit.time().seconds(),
            parents,
        });
    }

    // Compute graph layout (column assignment)
    let mut column_map: HashMap<String, u32> = HashMap::new();
    let mut active_columns: Vec<Option<String>> = Vec::new();
    let mut nodes = Vec::new();

    let get_next_column = |active: &[Option<String>]| -> u32 {
        active
            .iter()
            .position(|c| c.is_none())
            .unwrap_or(active.len()) as u32
    };

    for (y, raw) in raw_commits.iter().enumerate() {
        let column = if let Some(&col) = column_map.get(&raw.sha) {
            col
        } else {
            let col = get_next_column(&active_columns);
            if (col as usize) >= active_columns.len() {
                active_columns.push(Some(raw.sha.clone()));
            } else {
                active_columns[col as usize] = Some(raw.sha.clone());
            }
            column_map.insert(raw.sha.clone(), col);
            col
        };

        // Assign parent columns
        for (i, parent_sha) in raw.parents.iter().enumerate() {
            if !column_map.contains_key(parent_sha) {
                if i == 0 {
                    column_map.insert(parent_sha.clone(), column);
                    active_columns[column as usize] = Some(parent_sha.clone());
                } else {
                    let parent_col = get_next_column(&active_columns);
                    if (parent_col as usize) >= active_columns.len() {
                        active_columns.push(Some(parent_sha.clone()));
                    } else {
                        active_columns[parent_col as usize] = Some(parent_sha.clone());
                    }
                    column_map.insert(parent_sha.clone(), parent_col);
                }
            }
        }

        // Release column if no parent continues on it
        if (raw.parents.is_empty()
            || !raw
                .parents
                .iter()
                .any(|p| column_map.get(p) == Some(&column)))
            && (column as usize) < active_columns.len()
        {
            active_columns[column as usize] = None;
        }

        // Build refs
        let commit_refs: Vec<GraphRef> = refs_map
            .get(&raw.sha)
            .map(|ref_names| {
                ref_names
                    .iter()
                    .map(|name| {
                        let ref_type = if name == "HEAD" {
                            "head"
                        } else if name.starts_with("tag: ") {
                            "tag"
                        } else if name.contains('/') {
                            "remote"
                        } else {
                            "branch"
                        };
                        GraphRef {
                            name: name.clone(),
                            ref_type: ref_type.to_string(),
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        let is_merge = raw.parents.len() > 1;
        let color_index = column % 12;

        nodes.push(GraphCommitNode {
            sha: raw.sha.clone(),
            short_sha: raw.short_sha.clone(),
            message: raw.message.clone(),
            author: raw.author.clone(),
            author_email: raw.author_email.clone(),
            date: raw.date,
            parents: raw.parents.clone(),
            refs: commit_refs,
            x: column,
            y: y as u32,
            color_index,
            is_merge,
        });
    }

    debug!("git_log_graph: {} nodes computed", nodes.len());
    Ok(nodes)
}

// ============================================================================
// Branch Comparison
// ============================================================================

/// Compare current branch with another branch
#[tauri::command]
pub async fn git_compare_branches(
    path: String,
    base_branch: String,
    compare_branch: Option<String>,
) -> Result<BranchComparison, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = super::helpers::get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Get current branch if compare_branch not specified
        let compare = match compare_branch {
            Some(b) => b,
            None => {
                let output =
                    git_command_with_timeout(&["branch", "--show-current"], repo_root_path)?;
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
        };

        // Get ahead/behind counts
        let rev_list_output = git_command_with_timeout(
            &[
                "rev-list",
                "--left-right",
                "--count",
                &format!("{}...{}", base_branch, compare),
            ],
            repo_root_path,
        )?;

        let counts = String::from_utf8_lossy(&rev_list_output.stdout);
        let parts: Vec<&str> = counts.trim().split('\t').collect();
        let behind = parts
            .first()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        let ahead = parts
            .get(1)
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        // Get commits ahead (commits in compare that are not in base)
        let commits_ahead = get_commits_between(&repo_root, &base_branch, &compare, 20)?;

        // Get commits behind (commits in base that are not in compare)
        let commits_behind = get_commits_between(&repo_root, &compare, &base_branch, 20)?;

        // Check if can fast-forward (behind == 0 means base hasn't diverged)
        let can_fast_forward = behind == 0 && ahead > 0;

        Ok(BranchComparison {
            ahead,
            behind,
            commits_ahead,
            commits_behind,
            can_fast_forward,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Commit Comparison
// ============================================================================

/// Compare two arbitrary commit SHAs and return a diff stat
#[tauri::command]
pub async fn git_compare_commits(
    path: String,
    from_sha: String,
    to_sha: String,
) -> Result<CommitComparison, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = super::helpers::get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        let output = git_command_with_timeout(
            &[
                "diff",
                "--stat",
                "--numstat",
                &format!("{}..{}", from_sha, to_sha),
            ],
            repo_root_path,
        )?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to compare commits: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let files: Vec<CommitFile> = stdout
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let additions = parts[0].parse::<u32>().unwrap_or(0);
                    let deletions = parts[1].parse::<u32>().unwrap_or(0);
                    let file_path = parts[2].to_string();

                    let status = if additions > 0 && deletions > 0 {
                        "modified"
                    } else if additions > 0 {
                        "added"
                    } else {
                        "deleted"
                    };

                    Some(CommitFile {
                        path: file_path,
                        status: status.to_string(),
                        additions,
                        deletions,
                    })
                } else {
                    None
                }
            })
            .collect();

        let total_additions = files.iter().map(|f| f.additions).sum();
        let total_deletions = files.iter().map(|f| f.deletions).sum();
        let files_changed = files.len() as u32;

        Ok(CommitComparison {
            files_changed,
            additions: total_additions,
            deletions: total_deletions,
            files,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get commits that are in branch2 but not in branch1
fn get_commits_between(
    repo_root: &str,
    branch1: &str,
    branch2: &str,
    limit: u32,
) -> Result<Vec<GitCommit>, String> {
    let range = format!("{}..{}", branch1, branch2);
    let limit_str = format!("-{}", limit);

    let output = git_command_with_timeout(
        &["log", &limit_str, "--format=%H|%h|%s|%an|%ae|%ct", &range],
        Path::new(repo_root),
    )?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let commits: Vec<GitCommit> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(6, '|').collect();
            if parts.len() >= 6 {
                Some(GitCommit {
                    sha: parts[0].to_string(),
                    short_sha: parts[1].to_string(),
                    message: parts[2].to_string(),
                    author: parts[3].to_string(),
                    author_email: parts[4].to_string(),
                    date: parts[5].parse::<i64>().unwrap_or(0),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}

// ============================================================================
// Commit Graph
// ============================================================================

const GRAPH_COLORS: &[&str] = &[
    "#4ec9b0", "#569cd6", "#c586c0", "#ce9178", "#dcdcaa", "#9cdcfe", "#d7ba7d", "#608b4e",
    "#d16969", "#b5cea8",
];

/// Get a commit graph with column layout and parent connections.
#[tauri::command]
pub async fn git_commit_graph(
    path: String,
    options: CommitGraphOptions,
) -> Result<CommitGraphResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo_path = options.path.as_deref().unwrap_or(&path);
        let repo_root = super::helpers::get_repo_root(repo_path)?;
        let repo_root_path = Path::new(&repo_root);

        let mut args = vec![
            "log".to_string(),
            format!("--max-count={}", options.max_count + 1),
            format!("--skip={}", options.skip),
            "--format=%H|%h|%s|%an|%ae|%ct|%P|%D".to_string(),
        ];

        if options.all {
            args.push("--all".to_string());
        }
        if options.first_parent {
            args.push("--first-parent".to_string());
        }
        if let Some(ref since) = options.since {
            args.push(format!("--since={}", since));
        }
        if let Some(ref until) = options.until {
            args.push(format!("--until={}", until));
        }
        if let Some(ref author) = options.author {
            args.push(format!("--author={}", author));
        }
        if let Some(ref grep) = options.grep {
            args.push(format!("--grep={}", grep));
        }
        if let Some(ref branch) = options.branch {
            args.push(branch.clone());
        }

        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let output = git_command_with_timeout(&arg_refs, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to get commit graph: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().filter(|l| !l.is_empty()).collect();

        let has_more = lines.len() > options.max_count as usize;
        let lines = if has_more {
            &lines[..options.max_count as usize]
        } else {
            &lines[..]
        };

        let mut branch_columns: HashMap<String, u32> = HashMap::new();
        let mut next_column: u32 = 0;
        let mut nodes: Vec<CommitGraphNode> = Vec::new();

        for line in lines {
            let parts: Vec<&str> = line.splitn(8, '|').collect();
            if parts.len() < 8 {
                continue;
            }

            let hash = parts[0].to_string();
            let short_hash = parts[1].to_string();
            let message = parts[2].to_string();
            let author = parts[3].to_string();
            let author_email = parts[4].to_string();
            let date = parts[5].parse::<i64>().unwrap_or(0);
            let parents: Vec<String> = parts[6]
                .split_whitespace()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect();
            let refs_str = parts[7].trim();
            let refs: Vec<String> = if refs_str.is_empty() {
                Vec::new()
            } else {
                refs_str.split(", ").map(|s| s.trim().to_string()).collect()
            };

            let column = if let Some(&col) = branch_columns.get(&hash) {
                col
            } else {
                let col = next_column;
                next_column += 1;
                branch_columns.insert(hash.clone(), col);
                col
            };

            let color_idx = column as usize % GRAPH_COLORS.len();
            let color = GRAPH_COLORS[color_idx].to_string();

            if let Some(first_parent) = parents.first() {
                if !branch_columns.contains_key(first_parent) {
                    branch_columns.insert(first_parent.clone(), column);
                }
            }
            for parent in parents.iter().skip(1) {
                if !branch_columns.contains_key(parent) {
                    let col = next_column;
                    next_column += 1;
                    branch_columns.insert(parent.clone(), col);
                }
            }

            nodes.push(CommitGraphNode {
                hash,
                short_hash,
                message,
                author,
                author_email,
                date,
                parents,
                refs,
                column,
                color,
            });
        }

        let total_count = (options.skip as usize + nodes.len()) as u32;

        info!(
            node_count = nodes.len(),
            has_more = has_more,
            "Commit graph generated"
        );

        Ok(CommitGraphResult {
            nodes,
            total_count,
            has_more,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
