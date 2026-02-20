//! Enhanced commit graph with column layout and edge data.

use git2::BranchType;
use std::collections::HashMap;

use super::helpers::find_repo;
use super::types::{CommitGraphFullResult, GraphEdgeData, GraphNode, GraphNodeRef, GraphOptions};
use tracing::{debug, info};

#[tauri::command]
pub async fn git_get_commit_graph(
    path: String,
    options: GraphOptions,
) -> Result<CommitGraphFullResult, String> {
    tokio::task::spawn_blocking(move || git_get_commit_graph_sync(&path, &options))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_get_commit_graph_sync(
    path: &str,
    options: &GraphOptions,
) -> Result<CommitGraphFullResult, String> {
    let repo = find_repo(path)?;

    // Build ref map: commit SHA -> Vec<GraphNodeRef>
    let refs_map = build_refs_map(&repo)?;

    // Set up revwalk
    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| format!("Failed to set sorting: {}", e))?;

    if let Some(ref branch_name) = options.branch {
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
    } else if options.all {
        revwalk
            .push_glob("refs/*")
            .map_err(|e| format!("Failed to push all refs: {}", e))?;
    } else {
        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    }

    // Parse optional date filters
    let since_ts = options
        .since
        .as_ref()
        .and_then(|s| parse_date_to_timestamp(s));
    let until_ts = options
        .until
        .as_ref()
        .and_then(|s| parse_date_to_timestamp(s));

    // Collect raw commits with filtering
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
    let mut skipped = 0u32;
    let target_count = options.max_count as usize + 1; // +1 to detect has_more

    for oid_result in &mut revwalk {
        if raw_commits.len() >= target_count {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let timestamp = commit.time().seconds();

        // Date filters
        if let Some(since) = since_ts {
            if timestamp < since {
                continue;
            }
        }
        if let Some(until) = until_ts {
            if timestamp > until {
                continue;
            }
        }

        let author_sig = commit.author();
        let author_name = author_sig.name().unwrap_or("").to_string();
        let author_email = author_sig.email().unwrap_or("").to_string();
        let message = commit.message().unwrap_or("").to_string();

        // Author filter
        if let Some(ref author_filter) = options.author {
            let filter_lower = author_filter.to_lowercase();
            if !author_name.to_lowercase().contains(&filter_lower)
                && !author_email.to_lowercase().contains(&filter_lower)
            {
                continue;
            }
        }

        // Grep message filter
        if let Some(ref grep_filter) = options.grep {
            let filter_lower = grep_filter.to_lowercase();
            if !message.to_lowercase().contains(&filter_lower) {
                continue;
            }
        }

        // Skip pagination
        if skipped < options.skip {
            skipped += 1;
            continue;
        }

        let sha = oid.to_string();
        let short_sha = sha[..7.min(sha.len())].to_string();
        let parents: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

        raw_commits.push(RawCommit {
            sha,
            short_sha,
            message,
            author: author_name,
            author_email,
            date: timestamp,
            parents,
        });
    }

    let has_more = raw_commits.len() > options.max_count as usize;
    if has_more {
        raw_commits.truncate(options.max_count as usize);
    }

    // Compute graph layout (column assignment)
    let mut column_map: HashMap<String, u32> = HashMap::new();
    let mut active_columns: Vec<Option<String>> = Vec::new();
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut max_column: u32 = 0;

    let get_next_column = |active: &[Option<String>]| -> u32 {
        active
            .iter()
            .position(|c| c.is_none())
            .unwrap_or(active.len()) as u32
    };

    for raw in &raw_commits {
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

        if column > max_column {
            max_column = column;
        }

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
                    if parent_col > max_column {
                        max_column = parent_col;
                    }
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

        // Build edges
        for parent_sha in &raw.parents {
            let to_column = column_map.get(parent_sha).copied().unwrap_or(column);
            edges.push(GraphEdgeData {
                from_hash: raw.sha.clone(),
                to_hash: parent_sha.clone(),
                from_column: column,
                to_column,
                color_index: column % 12,
            });
        }

        // Build refs
        let commit_refs: Vec<GraphNodeRef> = refs_map.get(&raw.sha).cloned().unwrap_or_default();

        let is_merge = raw.parents.len() > 1;
        let color_index = column % 12;

        nodes.push(GraphNode {
            hash: raw.sha.clone(),
            short_hash: raw.short_sha.clone(),
            message: raw.message.clone(),
            author: raw.author.clone(),
            author_email: raw.author_email.clone(),
            date: raw.date,
            parents: raw.parents.clone(),
            refs: commit_refs,
            column,
            color_index,
            is_merge,
        });
    }

    let total_count = (options.skip as usize + nodes.len()) as u32;

    info!(
        node_count = nodes.len(),
        edge_count = edges.len(),
        has_more = has_more,
        "Enhanced commit graph generated"
    );
    debug!(
        max_column = max_column,
        total_count = total_count,
        "Graph layout computed"
    );

    Ok(CommitGraphFullResult {
        nodes,
        edges,
        total_count,
        has_more,
        max_column,
    })
}

fn build_refs_map(repo: &git2::Repository) -> Result<HashMap<String, Vec<GraphNodeRef>>, String> {
    let mut refs_map: HashMap<String, Vec<GraphNodeRef>> = HashMap::new();

    // Get HEAD target
    let head_target = repo.head().ok().and_then(|h| h.target());
    let head_branch_name = repo.head().ok().and_then(|h| {
        if h.is_branch() {
            h.shorthand().map(|s| s.to_string())
        } else {
            None
        }
    });

    if let Some(target) = head_target {
        let sha = target.to_string();
        refs_map.entry(sha).or_default().push(GraphNodeRef {
            name: "HEAD".to_string(),
            ref_type: "head".to_string(),
            is_head: true,
        });
    }

    let references = repo
        .references()
        .map_err(|e| format!("Failed to get references: {}", e))?;

    for reference_result in references {
        let reference = match reference_result {
            Ok(r) => r,
            Err(_) => continue,
        };

        let target = if reference.is_branch() || reference.is_remote() {
            reference.target()
        } else if reference.is_tag() {
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

            if ref_name == "HEAD" {
                continue;
            }

            let (display_name, ref_type) = if let Some(name) = ref_name.strip_prefix("refs/heads/")
            {
                (name.to_string(), "branch")
            } else if let Some(name) = ref_name.strip_prefix("refs/remotes/") {
                (name.to_string(), "remote")
            } else if let Some(name) = ref_name.strip_prefix("refs/tags/") {
                (name.to_string(), "tag")
            } else {
                (ref_name.clone(), "branch")
            };

            let is_head = head_branch_name
                .as_ref()
                .map(|hb| ref_type == "branch" && display_name == *hb)
                .unwrap_or(false);

            refs_map.entry(sha).or_default().push(GraphNodeRef {
                name: display_name,
                ref_type: ref_type.to_string(),
                is_head,
            });
        }
    }

    Ok(refs_map)
}

fn parse_date_to_timestamp(date_str: &str) -> Option<i64> {
    // Try parsing as Unix timestamp first
    if let Ok(ts) = date_str.parse::<i64>() {
        return Some(ts);
    }

    // Try ISO 8601 / RFC 3339 format (e.g. "2024-01-15T00:00:00Z" or "2024-01-15")
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.timestamp());
    }

    // Try date-only format "YYYY-MM-DD"
    if let Ok(nd) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let dt = nd.and_hms_opt(0, 0, 0)?;
        return Some(dt.and_utc().timestamp());
    }

    None
}
