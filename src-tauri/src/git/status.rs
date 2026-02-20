//! Git status operations.

use git2::{BranchType, StatusOptions};
use tracing::info;

use super::cache::{MAX_STATUS_FILES, cache_status, get_cached_status};
use super::helpers::{find_repo, status_to_string};
use super::types::{
    BranchesResponse, GitBranch, GitBranchResponse, GitFile, GitHeadResponse, GitRemote,
    GitRemoteResponse, IsRepoResponse, RemotesResponse, RootResponse, StatusResponse,
};

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn git_is_repo(path: String) -> Result<IsRepoResponse, String> {
    tokio::task::spawn_blocking(move || {
        let is_repo = git2::Repository::discover(&path).is_ok();
        Ok(IsRepoResponse { is_repo })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_init(path: String, default_branch: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_path = std::path::Path::new(&path);

        // Initialize a new repository
        let repo = git2::Repository::init(repo_path)
            .map_err(|e| format!("Failed to initialize repository: {}", e))?;

        // Set the default branch name if specified
        if let Some(branch_name) = default_branch {
            // Create initial commit to establish the branch
            // First, we need to configure the repo to use the specified default branch
            let mut config = repo
                .config()
                .map_err(|e| format!("Failed to get repo config: {}", e))?;

            config
                .set_str("init.defaultBranch", &branch_name)
                .map_err(|e| format!("Failed to set default branch: {}", e))?;
        }

        info!("Initialized git repository at: {}", path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_root(path: String) -> Result<RootResponse, String> {
    tokio::task::spawn_blocking(move || match git2::Repository::discover(&path) {
        Ok(repo) => {
            let root = repo.workdir().map(|p| p.to_string_lossy().to_string());
            Ok(RootResponse { root })
        }
        Err(_) => Ok(RootResponse { root: None }),
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_status(path: String) -> Result<StatusResponse, String> {
    // Run the blocking git operations in a separate thread to avoid blocking the main thread
    tokio::task::spawn_blocking(move || git_status_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

pub fn git_status_sync(path: &str) -> Result<StatusResponse, String> {
    let repo = find_repo(path)?;

    // Quick HEAD sha check for cache validation
    let head_sha = repo
        .head()
        .ok()
        .and_then(|h| h.target())
        .map(|oid| oid.to_string());

    // Check cache first - return early if valid
    if let Some(cached) = get_cached_status(path, &head_sha) {
        return Ok(cached);
    }

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut conflicts = Vec::new();
    let mut truncated = false;
    let mut total_files = 0usize;

    // Get status with optimized options for large repos
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        // Performance optimizations for large repos
        .disable_pathspec_match(true)
        .exclude_submodules(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    for entry in statuses.iter() {
        total_files += 1;

        // Limit total files processed for very large repos
        if total_files > MAX_STATUS_FILES {
            truncated = true;
            break;
        }

        let file_path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        if status.is_conflicted() {
            conflicts.push(GitFile {
                path: file_path.clone(),
                status: "conflict".to_string(),
                staged: false,
            });
        }

        // Check index (staged) changes
        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_index_renamed()
            || status.is_index_typechange()
        {
            staged.push(GitFile {
                path: file_path.clone(),
                status: status_to_string(status),
                staged: true,
            });
        }

        // Check working tree (unstaged) changes
        if status.is_wt_new()
            || status.is_wt_modified()
            || status.is_wt_deleted()
            || status.is_wt_renamed()
            || status.is_wt_typechange()
        {
            unstaged.push(GitFile {
                path: file_path.clone(),
                status: status_to_string(status),
                staged: false,
            });
        }
    }

    // Get current branch
    let branch = match repo.head() {
        Ok(head) => {
            if head.is_branch() {
                head.shorthand().unwrap_or("HEAD").to_string()
            } else {
                // Detached HEAD
                head.target()
                    .map(|oid| oid.to_string()[..7].to_string())
                    .unwrap_or_else(|| "HEAD".to_string())
            }
        }
        Err(_) => "main".to_string(), // New repo with no commits
    };

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo).unwrap_or((0, 0));

    // Check merge/rebase state
    let is_merging = repo.state() == git2::RepositoryState::Merge;
    let is_rebasing = matches!(
        repo.state(),
        git2::RepositoryState::Rebase
            | git2::RepositoryState::RebaseInteractive
            | git2::RepositoryState::RebaseMerge
    );

    let response = StatusResponse {
        branch,
        staged,
        unstaged,
        conflicts,
        ahead,
        behind,
        head_sha: head_sha.clone(),
        is_merging,
        is_rebasing,
        truncated: if truncated { Some(true) } else { None },
    };

    // Cache the result
    cache_status(path, response.clone(), head_sha);

    Ok(response)
}

fn get_ahead_behind(repo: &git2::Repository) -> Result<(u32, u32), git2::Error> {
    let head = repo.head()?;
    if !head.is_branch() {
        return Ok((0, 0));
    }

    let local_oid = head
        .target()
        .ok_or_else(|| git2::Error::from_str("No target for HEAD"))?;

    let branch = repo.find_branch(head.shorthand().unwrap_or(""), BranchType::Local)?;

    if let Ok(upstream) = branch.upstream() {
        if let Some(upstream_oid) = upstream.get().target() {
            let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
            return Ok((ahead as u32, behind as u32));
        }
    }

    Ok((0, 0))
}

#[tauri::command]
pub async fn git_branches(path: String) -> Result<BranchesResponse, String> {
    tokio::task::spawn_blocking(move || git_branches_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_branches_sync(path: &str) -> Result<BranchesResponse, String> {
    let repo = find_repo(path)?;
    let mut branches = Vec::new();

    // Get local branches
    let local_branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| format!("Failed to get branches: {}", e))?;

    for branch_result in local_branches {
        let (branch, _) = branch_result.map_err(|e| format!("Branch error: {}", e))?;
        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("")
            .to_string();

        let is_head = branch.is_head();

        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        let (ahead, behind) = if let Ok(reference) = branch.get().resolve() {
            if let Some(local_oid) = reference.target() {
                if let Ok(upstream_branch) = branch.upstream() {
                    if let Some(upstream_oid) = upstream_branch.get().target() {
                        repo.graph_ahead_behind(local_oid, upstream_oid)
                            .map(|(a, b)| (Some(a as u32), Some(b as u32)))
                            .unwrap_or((None, None))
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        branches.push(GitBranch {
            name,
            is_head,
            is_remote: false,
            upstream,
            ahead,
            behind,
        });
    }

    // Get remote branches
    let remote_branches = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| format!("Failed to get remote branches: {}", e))?;

    for branch_result in remote_branches {
        let (branch, _) = branch_result.map_err(|e| format!("Branch error: {}", e))?;
        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("")
            .to_string();

        branches.push(GitBranch {
            name,
            is_head: false,
            is_remote: true,
            upstream: None,
            ahead: None,
            behind: None,
        });
    }

    Ok(BranchesResponse { branches })
}

#[tauri::command]
pub async fn git_remotes(path: String) -> Result<RemotesResponse, String> {
    tokio::task::spawn_blocking(move || git_remotes_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_remotes_sync(path: &str) -> Result<RemotesResponse, String> {
    let repo = find_repo(path)?;
    let mut remotes = Vec::new();

    let remote_names = repo
        .remotes()
        .map_err(|e| format!("Failed to get remotes: {}", e))?;

    for name in remote_names.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            remotes.push(GitRemote {
                name: name.to_string(),
                url: remote.url().map(|s| s.to_string()),
                fetch_url: remote.url().map(|s| s.to_string()),
                push_url: remote.pushurl().map(|s| s.to_string()),
            });
        }
    }

    Ok(RemotesResponse { remotes })
}

/// Get the primary remote URL (origin or first remote)
#[tauri::command]
pub async fn git_remote(path: String) -> Result<GitRemoteResponse, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let remotes = repo
            .remotes()
            .map_err(|e| format!("Failed to get remotes: {}", e))?;

        // Collect remote names to avoid borrowing issues
        let remote_names: Vec<String> = remotes.iter().flatten().map(|s| s.to_string()).collect();

        // Try to get "origin" first, then fall back to first remote
        let remote_name = remote_names
            .iter()
            .find(|n| *n == "origin")
            .or_else(|| remote_names.first())
            .cloned();

        if let Some(name) = remote_name {
            if let Ok(remote) = repo.find_remote(&name) {
                return Ok(GitRemoteResponse {
                    url: remote.url().map(|s| s.to_string()),
                });
            }
        }

        Ok(GitRemoteResponse { url: None })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get current branch name
#[tauri::command]
pub async fn git_branch(path: String) -> Result<GitBranchResponse, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let result = match repo.head() {
            Ok(head) => {
                if head.is_branch() {
                    GitBranchResponse {
                        branch: head.shorthand().map(|s| s.to_string()),
                    }
                } else {
                    // Detached HEAD
                    GitBranchResponse { branch: None }
                }
            }
            Err(e) => {
                // Check if this is an unborn branch (no commits yet)
                if e.code() == git2::ErrorCode::UnbornBranch {
                    // Try to get the configured default branch name
                    let default_branch = repo
                        .config()
                        .ok()
                        .and_then(|c| c.get_string("init.defaultBranch").ok())
                        .unwrap_or_else(|| "main".to_string());
                    GitBranchResponse {
                        branch: Some(default_branch),
                    }
                } else {
                    return Err(format!("Failed to get HEAD: {}", e));
                }
            }
        };
        Ok(result)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get current HEAD commit SHA
#[tauri::command]
pub async fn git_head(path: String) -> Result<GitHeadResponse, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let result = match repo.head() {
            Ok(head) => {
                let oid = head.target().ok_or("HEAD has no target")?;
                GitHeadResponse {
                    sha: oid.to_string(),
                }
            }
            Err(e) => {
                if e.code() == git2::ErrorCode::UnbornBranch {
                    // Return empty sha for unborn branch - this is expected
                    GitHeadResponse { sha: String::new() }
                } else {
                    return Err(format!("Failed to get HEAD: {}", e));
                }
            }
        };
        Ok(result)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn create_initial_commit(repo: &git2::Repository) -> git2::Oid {
        let sig = git2::Signature::now("Test User", "test@example.com").unwrap();
        let tree_id = repo.index().unwrap().write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .unwrap()
    }

    #[test]
    fn test_is_repo_response_construction() {
        let resp = IsRepoResponse { is_repo: true };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"isRepo\":true"));

        let resp_false = IsRepoResponse { is_repo: false };
        let json_false = serde_json::to_string(&resp_false).unwrap();
        assert!(json_false.contains("\"isRepo\":false"));
    }

    #[test]
    fn test_status_response_construction() {
        let resp = StatusResponse {
            branch: "main".to_string(),
            staged: vec![GitFile {
                path: "staged.txt".to_string(),
                status: "added".to_string(),
                staged: true,
            }],
            unstaged: vec![],
            conflicts: vec![],
            ahead: 2,
            behind: 1,
            head_sha: Some("abc123".to_string()),
            is_merging: false,
            is_rebasing: false,
            truncated: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"branch\":\"main\""));
        assert!(json.contains("\"headSha\":\"abc123\""));
        assert!(json.contains("\"isMerging\":false"));
        assert!(json.contains("\"isRebasing\":false"));
        assert!(!json.contains("truncated"));
    }

    #[test]
    fn test_status_response_with_truncated() {
        let resp = StatusResponse {
            branch: "main".to_string(),
            staged: vec![],
            unstaged: vec![],
            conflicts: vec![],
            ahead: 0,
            behind: 0,
            head_sha: None,
            is_merging: false,
            is_rebasing: false,
            truncated: Some(true),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"truncated\":true"));
    }

    #[test]
    fn test_git_file_construction() {
        let file = GitFile {
            path: "src/main.rs".to_string(),
            status: "modified".to_string(),
            staged: false,
        };
        let json = serde_json::to_string(&file).unwrap();
        assert!(json.contains("\"path\":\"src/main.rs\""));
        assert!(json.contains("\"status\":\"modified\""));
        assert!(json.contains("\"staged\":false"));
    }

    #[test]
    fn test_git_is_repo_with_git_repo() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        let is_repo = git2::Repository::discover(dir.path()).is_ok();
        assert!(is_repo);
    }

    #[test]
    fn test_git_is_repo_with_non_repo() {
        let dir = tempfile::tempdir().unwrap();
        let is_repo = git2::Repository::discover(dir.path()).is_ok();
        assert!(!is_repo);
    }

    #[test]
    fn test_git_status_sync_empty_repo() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        let path = dir.path().to_str().unwrap();
        let result = git_status_sync(path).unwrap();
        assert!(result.staged.is_empty());
        assert!(result.unstaged.is_empty());
        assert!(result.conflicts.is_empty());
        assert_eq!(result.ahead, 0);
        assert_eq!(result.behind, 0);
        assert!(!result.is_merging);
        assert!(!result.is_rebasing);
    }

    #[test]
    fn test_git_status_sync_with_new_file() {
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        std::fs::write(dir.path().join("new_file.txt"), "hello").unwrap();
        let path = dir.path().to_str().unwrap();
        let result = git_status_sync(path).unwrap();
        assert!(result.staged.is_empty());
        assert!(!result.unstaged.is_empty());
        let untracked = result
            .unstaged
            .iter()
            .find(|f| f.path == "new_file.txt")
            .expect("Should find new_file.txt in unstaged");
        assert_eq!(untracked.status, "added");
        assert!(!untracked.staged);
    }

    #[test]
    fn test_git_status_sync_with_staged_file() {
        let dir = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();
        std::fs::write(dir.path().join("staged.txt"), "content").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("staged.txt")).unwrap();
        index.write().unwrap();
        let path = dir.path().to_str().unwrap();
        let result = git_status_sync(path).unwrap();
        assert!(!result.staged.is_empty());
        let staged_file = result
            .staged
            .iter()
            .find(|f| f.path == "staged.txt")
            .expect("Should find staged.txt in staged");
        assert_eq!(staged_file.status, "added");
        assert!(staged_file.staged);
    }

    #[test]
    fn test_git_status_sync_with_modified_file() {
        let dir = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();
        std::fs::write(dir.path().join("file.txt"), "original").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file.txt")).unwrap();
        index.write().unwrap();
        create_initial_commit(&repo);

        std::fs::write(dir.path().join("file.txt"), "modified content").unwrap();
        let path = dir.path().to_str().unwrap();
        let result = git_status_sync(path).unwrap();
        assert!(!result.unstaged.is_empty());
        let modified = result
            .unstaged
            .iter()
            .find(|f| f.path == "file.txt")
            .expect("Should find file.txt in unstaged");
        assert_eq!(modified.status, "modified");
    }

    #[test]
    fn test_git_status_sync_invalid_path() {
        let result = git_status_sync("/nonexistent/path/to/repo");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a git repository"));
    }

    #[test]
    fn test_git_status_sync_branch_name_after_commit() {
        let dir = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();
        std::fs::write(dir.path().join("file.txt"), "data").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file.txt")).unwrap();
        index.write().unwrap();
        create_initial_commit(&repo);

        let path = dir.path().to_str().unwrap();
        let result = git_status_sync(path).unwrap();
        assert!(!result.branch.is_empty());
        assert!(result.head_sha.is_some());
    }
}
