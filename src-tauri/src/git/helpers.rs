//! Git helper functions and utilities.

use git2::Repository;

/// Convert git2 status to human-readable string
pub fn status_to_string(status: git2::Status) -> String {
    if status.is_index_new() || status.is_wt_new() {
        "added".to_string()
    } else if status.is_index_modified() || status.is_wt_modified() {
        "modified".to_string()
    } else if status.is_index_deleted() || status.is_wt_deleted() {
        "deleted".to_string()
    } else if status.is_index_renamed() || status.is_wt_renamed() {
        "renamed".to_string()
    } else if status.is_index_typechange() || status.is_wt_typechange() {
        "typechange".to_string()
    } else if status.is_conflicted() {
        "conflict".to_string()
    } else {
        "unknown".to_string()
    }
}

/// Find and open a git repository starting from the given path
pub fn find_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| format!("Not a git repository: {}", e))
}

/// Get the root directory of a git repository
pub fn get_repo_root(path: &str) -> Result<String, String> {
    let repo = find_repo(path)?;
    repo.workdir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine repository root".to_string())
}

/// Parse branch name from stash message
pub fn parse_stash_branch(message: &str) -> Option<String> {
    // Common formats:
    // "WIP on branch-name: commit message"
    // "On branch-name: commit message"
    if let Some(rest) = message
        .strip_prefix("WIP on ")
        .or_else(|| message.strip_prefix("On "))
    {
        if let Some(colon_pos) = rest.find(':') {
            return Some(rest[..colon_pos].to_string());
        }
    }
    None
}
