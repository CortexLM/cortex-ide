//! Git data structures and type definitions.

use serde::{Deserialize, Serialize};

// ============================================================================
// Basic Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFile {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRemote {
    pub name: String,
    pub url: Option<String>,
    pub fetch_url: Option<String>,
    pub push_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStash {
    pub index: usize,
    pub message: String,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: i64,
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct IsRepoResponse {
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
}

#[derive(Debug, Serialize)]
pub struct RootResponse {
    pub root: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusResponse {
    pub branch: String,
    pub staged: Vec<GitFile>,
    pub unstaged: Vec<GitFile>,
    pub conflicts: Vec<GitFile>,
    pub ahead: u32,
    pub behind: u32,
    #[serde(rename = "headSha")]
    pub head_sha: Option<String>,
    #[serde(rename = "isMerging")]
    pub is_merging: bool,
    #[serde(rename = "isRebasing")]
    pub is_rebasing: bool,
    /// Indicates if the file list was truncated due to size limits
    #[serde(rename = "truncated", skip_serializing_if = "Option::is_none")]
    pub truncated: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct BranchesResponse {
    pub branches: Vec<GitBranch>,
}

#[derive(Debug, Serialize)]
pub struct RemotesResponse {
    pub remotes: Vec<GitRemote>,
}

#[derive(Debug, Serialize)]
pub struct GitRemoteResponse {
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitBranchResponse {
    pub branch: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitHeadResponse {
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct StashesResponse {
    pub stashes: Vec<GitStash>,
}

// ============================================================================
// Cherry-pick Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitFile {
    pub path: String,
    pub status: String, // "added", "modified", "deleted"
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CherryPickStatus {
    pub in_progress: bool,
    pub current_commit: Option<String>,
    pub has_conflicts: bool,
}

// ============================================================================
// Rebase Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseAction {
    pub hash: String,
    pub action: String, // "pick", "reword", "edit", "squash", "fixup", "drop"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseStatus {
    pub in_progress: bool,
    pub current_commit: Option<String>,
    pub remaining: u32,
    pub total: u32,
    pub has_conflicts: bool,
    pub conflict_files: Vec<String>,
    pub paused_commit: Option<RebaseCommit>,
}

// ============================================================================
// Bisect Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BisectStatus {
    pub in_progress: bool,
    pub current_commit: Option<String>,
    pub good_commits: Vec<String>,
    pub bad_commits: Vec<String>,
    pub remaining_steps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BisectResult {
    pub current_commit: String,
    pub remaining_steps: u32,
    pub found_culprit: bool,
    pub culprit_commit: Option<String>,
}

// ============================================================================
// Stash Types
// ============================================================================

/// Stash entry with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: u32,
    pub message: String,
    pub date: String,
    pub branch: Option<String>,
}

/// Stash diff information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashDiff {
    pub index: usize,
    pub message: String,
    pub diff: String,
    pub files: Vec<StashDiffFile>,
}

/// File changed in a stash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashDiffFile {
    pub path: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
}

// ============================================================================
// Submodule Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmoduleInfo {
    pub name: String,
    pub path: String,
    pub url: String,
    pub branch: Option<String>,
    pub head_id: Option<String>,
    pub status: String, // "uninitialized", "initialized", "modified"
}

// ============================================================================
// Tag Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitTag {
    pub name: String,
    pub message: Option<String>,
    pub tagger: Option<String>,
    pub date: Option<String>,
    pub commit_sha: String,
    pub is_annotated: bool,
}

// ============================================================================
// Worktree Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub head: Option<String>,
    pub branch: Option<String>,
    pub is_bare: bool,
    pub is_detached: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
    pub prunable: bool,
}

// ============================================================================
// LFS Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSStatus {
    pub installed: bool,
    pub initialized: bool,
    pub version: Option<String>,
    pub tracked_patterns: Vec<String>,
    pub files_count: u32,
    pub files_size: u64,
    pub lfs_files: Vec<LFSFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSFileEntry {
    pub path: String,
    pub size: u64,
    pub oid: Option<String>,
    pub downloaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSFileInfo {
    pub path: String,
    pub is_lfs: bool,
    pub size: u64,
    pub oid: Option<String>,
    pub downloaded: bool,
    pub pointer_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSDirSummary {
    pub total_files: u32,
    pub lfs_files: u32,
    pub total_size: u64,
    pub lfs_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSLock {
    pub id: String,
    pub path: String,
    pub owner: String,
    pub locked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSTrackPreviewFile {
    pub path: String,
    pub size: u64,
    pub would_track: bool,
}

// ============================================================================
// Clone Types
// ============================================================================

/// Progress information for git clone operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneProgress {
    pub stage: String, // "counting", "compressing", "receiving", "resolving", "checking_out"
    pub current: u32,
    pub total: u32,
    pub bytes_received: Option<u64>,
    pub message: Option<String>,
}

// ============================================================================
// Merge Types
// ============================================================================

/// Result of a merge operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub success: bool,
    pub fast_forward: bool,
    pub conflicts: Vec<String>,
    pub message: Option<String>,
}

// ============================================================================
// Branch Comparison Types
// ============================================================================

/// Get comparison information between two branches
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchComparison {
    pub ahead: u32,
    pub behind: u32,
    pub commits_ahead: Vec<GitCommit>,
    pub commits_behind: Vec<GitCommit>,
    pub can_fast_forward: bool,
}

// ============================================================================
// Commit Details Types (for git-graph SDK)
// ============================================================================

/// Detailed information about a single commit, including file changes and diff stats.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub body: String,
    pub author: CommitPerson,
    pub committer: CommitPerson,
    pub parents: Vec<String>,
    pub refs: Vec<CommitDetailRef>,
    pub stats: Option<CommitDiffStat>,
    pub files: Vec<CommitDetailFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitPerson {
    pub name: String,
    pub email: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetailRef {
    pub name: String,
    #[serde(rename = "type")]
    pub ref_type: String,
    pub is_head: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDiffStat {
    pub insertions: u32,
    pub deletions: u32,
    pub files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetailFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub insertions: u32,
    pub deletions: u32,
}

// ============================================================================
// Commit Comparison Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitComparison {
    pub files_changed: u32,
    pub additions: u32,
    pub deletions: u32,
    pub files: Vec<CommitFile>,
}

// ============================================================================
// Line Staging Types
// ============================================================================

/// Line range for staging/unstaging specific lines
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

// ============================================================================
// Structured Diff Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiffLineType {
    Context,
    Addition,
    Deletion,
    Header,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub change_type: DiffLineType,
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkData {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredDiff {
    pub file_path: String,
    pub hunks: Vec<DiffHunkData>,
    pub additions: u32,
    pub deletions: u32,
}

// ============================================================================
// Word Diff Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordDiffAnnotation {
    pub value: String,
    pub added: bool,
    pub removed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WordDiffSegmentType {
    Equal,
    Added,
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordDiffSegment {
    pub segment_type: WordDiffSegmentType,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordDiffLine {
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
    pub segments: Vec<WordDiffSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordDiffResult {
    pub file_path: String,
    pub lines: Vec<WordDiffLine>,
}

// ============================================================================
// Blame Heatmap Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct BlameHeatmapEntry {
    pub hash: String,
    pub author: String,
    #[serde(rename = "authorEmail")]
    pub author_email: String,
    pub date: String,
    #[serde(rename = "lineStart")]
    pub line_start: u32,
    #[serde(rename = "lineEnd")]
    pub line_end: u32,
    pub content: String,
    pub message: String,
    pub timestamp: i64,
    #[serde(rename = "heatScore")]
    pub heat_score: f64,
}

// ============================================================================
// Graph Commit Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRef {
    pub name: String,
    pub ref_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub from_hash: String,
    pub to_hash: String,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphCommitNode {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: i64,
    pub parents: Vec<String>,
    pub refs: Vec<GraphRef>,
    pub x: u32,
    pub y: u32,
    pub color_index: u32,
    pub is_merge: bool,
}

// ============================================================================
// Hunk Info Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HunkInfo {
    pub index: u32,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub additions: u32,
    pub deletions: u32,
    pub content_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HunkNavigationData {
    pub hunks: Vec<HunkInfo>,
    pub total_additions: u32,
    pub total_deletions: u32,
}

// ============================================================================
// Hunk Navigation Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HunkPosition {
    pub index: u32,
    #[serde(rename = "startLine")]
    pub start_line: u32,
    #[serde(rename = "endLine")]
    pub end_line: u32,
    pub header: String,
}

// ============================================================================
// Force Push Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForcePushInfo {
    pub needed: bool,
    #[serde(rename = "commitsToOverwrite")]
    pub commits_to_overwrite: Vec<GitCommit>,
    #[serde(rename = "remoteBranch")]
    pub remote_branch: String,
    #[serde(rename = "localBranch")]
    pub local_branch: String,
    #[serde(rename = "localAhead")]
    pub local_ahead: u32,
    #[serde(rename = "remotAhead")]
    pub remote_ahead: u32,
}

// ============================================================================
// Structured Diff Hunk Types
// ============================================================================

/// A single line within a diff hunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunkLine {
    pub origin: String,
    pub content: String,
    #[serde(rename = "oldLineno", skip_serializing_if = "Option::is_none")]
    pub old_lineno: Option<u32>,
    #[serde(rename = "newLineno", skip_serializing_if = "Option::is_none")]
    pub new_lineno: Option<u32>,
}

/// A structured diff hunk with line-level detail.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    #[serde(rename = "oldStart")]
    pub old_start: u32,
    #[serde(rename = "oldLines")]
    pub old_lines: u32,
    #[serde(rename = "newStart")]
    pub new_start: u32,
    #[serde(rename = "newLines")]
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffHunkLine>,
}

/// Structured diff result for a single file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunksResult {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
}

// ============================================================================
// Commit Graph Types
// ============================================================================

/// Options for querying the commit graph.
#[derive(Debug, Clone, Deserialize)]
pub struct CommitGraphOptions {
    pub path: Option<String>,
    #[serde(default = "default_max_count")]
    pub max_count: u32,
    #[serde(default)]
    pub skip: u32,
    pub branch: Option<String>,
    #[serde(default = "default_true")]
    pub all: bool,
    #[serde(default)]
    pub first_parent: bool,
    pub since: Option<String>,
    pub until: Option<String>,
    pub author: Option<String>,
    pub grep: Option<String>,
}

fn default_max_count() -> u32 {
    100
}

fn default_true() -> bool {
    true
}

/// A node in the commit graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitGraphNode {
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    pub message: String,
    pub author: String,
    #[serde(rename = "authorEmail")]
    pub author_email: String,
    pub date: i64,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
    pub column: u32,
    pub color: String,
}

/// Result of a commit graph query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitGraphResult {
    pub nodes: Vec<CommitGraphNode>,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}

// ============================================================================
// Rebase Todo Types
// ============================================================================

/// A single entry in the interactive rebase todo list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseTodoEntry {
    pub action: String,
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    pub message: String,
}

// ============================================================================
// Enhanced Graph Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphOptions {
    #[serde(default = "default_graph_max")]
    pub max_count: u32,
    #[serde(default)]
    pub skip: u32,
    pub branch: Option<String>,
    #[serde(default = "default_true_graph")]
    pub all: bool,
    #[serde(default)]
    pub first_parent: bool,
    pub since: Option<String>,
    pub until: Option<String>,
    pub author: Option<String>,
    pub grep: Option<String>,
}

fn default_graph_max() -> u32 {
    150
}

fn default_true_graph() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeRef {
    pub name: String,
    pub ref_type: String,
    pub is_head: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: i64,
    pub parents: Vec<String>,
    pub refs: Vec<GraphNodeRef>,
    pub column: u32,
    pub color_index: u32,
    pub is_merge: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeData {
    pub from_hash: String,
    pub to_hash: String,
    pub from_column: u32,
    pub to_column: u32,
    pub color_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitGraphFullResult {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdgeData>,
    pub total_count: u32,
    pub has_more: bool,
    pub max_column: u32,
}

// ============================================================================
// Merge Editor Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeConflictFile {
    pub path: String,
    pub conflict_count: u32,
    pub has_base_content: bool,
    pub ours_label: String,
    pub theirs_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeConflictRegion {
    pub id: String,
    pub index: u32,
    pub start_line: u32,
    pub end_line: u32,
    pub separator_line: u32,
    pub base_marker_line: Option<u32>,
    pub ours_content: Vec<String>,
    pub theirs_content: Vec<String>,
    pub base_content: Option<Vec<String>>,
    pub ours_label: String,
    pub theirs_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreeWayDiffResult {
    pub file_path: String,
    pub conflicts: Vec<MergeConflictRegion>,
    pub ours_full_content: String,
    pub theirs_full_content: String,
    pub base_full_content: Option<String>,
    pub has_base_content: bool,
    pub raw_content: String,
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn git_file_serde_roundtrip() {
        let file = GitFile {
            path: "src/main.rs".to_string(),
            status: "modified".to_string(),
            staged: true,
        };
        let json = serde_json::to_string(&file).unwrap();
        let deserialized: GitFile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, "src/main.rs");
        assert_eq!(deserialized.status, "modified");
        assert!(deserialized.staged);
    }

    #[test]
    fn git_branch_serde_roundtrip() {
        let branch = GitBranch {
            name: "main".to_string(),
            is_head: true,
            is_remote: false,
            upstream: Some("origin/main".to_string()),
            ahead: Some(2),
            behind: Some(1),
        };
        let json = serde_json::to_string(&branch).unwrap();
        let deserialized: GitBranch = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "main");
        assert!(deserialized.is_head);
        assert!(!deserialized.is_remote);
        assert_eq!(deserialized.upstream.as_deref(), Some("origin/main"));
        assert_eq!(deserialized.ahead, Some(2));
        assert_eq!(deserialized.behind, Some(1));
    }

    #[test]
    fn git_branch_optional_fields() {
        let branch = GitBranch {
            name: "feature".to_string(),
            is_head: false,
            is_remote: true,
            upstream: None,
            ahead: None,
            behind: None,
        };
        let json = serde_json::to_string(&branch).unwrap();
        let deserialized: GitBranch = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "feature");
        assert!(!deserialized.is_head);
        assert!(deserialized.is_remote);
        assert!(deserialized.upstream.is_none());
        assert!(deserialized.ahead.is_none());
        assert!(deserialized.behind.is_none());
    }

    #[test]
    fn git_remote_serde_roundtrip() {
        let remote = GitRemote {
            name: "origin".to_string(),
            url: Some("https://github.com/user/repo.git".to_string()),
            fetch_url: Some("https://github.com/user/repo.git".to_string()),
            push_url: None,
        };
        let json = serde_json::to_string(&remote).unwrap();
        let deserialized: GitRemote = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "origin");
        assert_eq!(
            deserialized.url.as_deref(),
            Some("https://github.com/user/repo.git")
        );
        assert!(deserialized.push_url.is_none());
    }

    #[test]
    fn git_stash_serde_roundtrip() {
        let stash = GitStash {
            index: 0,
            message: "WIP on main".to_string(),
            branch: Some("main".to_string()),
        };
        let json = serde_json::to_string(&stash).unwrap();
        let deserialized: GitStash = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.index, 0);
        assert_eq!(deserialized.message, "WIP on main");
        assert_eq!(deserialized.branch.as_deref(), Some("main"));
    }

    #[test]
    fn git_commit_serde_roundtrip() {
        let commit = GitCommit {
            sha: "abc123def456".to_string(),
            short_sha: "abc123d".to_string(),
            message: "Initial commit".to_string(),
            author: "Test User".to_string(),
            author_email: "test@example.com".to_string(),
            date: 1_700_000_000,
        };
        let json = serde_json::to_string(&commit).unwrap();
        let deserialized: GitCommit = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.sha, "abc123def456");
        assert_eq!(deserialized.short_sha, "abc123d");
        assert_eq!(deserialized.message, "Initial commit");
        assert_eq!(deserialized.author, "Test User");
        assert_eq!(deserialized.author_email, "test@example.com");
        assert_eq!(deserialized.date, 1_700_000_000);
    }

    #[test]
    fn is_repo_response_serde() {
        let resp = IsRepoResponse { is_repo: true };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"isRepo\""));
        assert!(!json.contains("\"is_repo\""));
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["isRepo"], true);
    }

    #[test]
    fn status_response_serde() {
        let resp = StatusResponse {
            branch: "main".to_string(),
            staged: vec![],
            unstaged: vec![],
            conflicts: vec![],
            ahead: 1,
            behind: 0,
            head_sha: Some("abc123".to_string()),
            is_merging: false,
            is_rebasing: true,
            truncated: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"headSha\""));
        assert!(json.contains("\"isMerging\""));
        assert!(json.contains("\"isRebasing\""));
        assert!(!json.contains("\"head_sha\""));
        assert!(!json.contains("\"is_merging\""));
        assert!(!json.contains("\"is_rebasing\""));
        assert!(!json.contains("\"truncated\""));
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["branch"], "main");
        assert_eq!(value["headSha"], "abc123");
        assert_eq!(value["isMerging"], false);
        assert_eq!(value["isRebasing"], true);
        assert_eq!(value["ahead"], 1);
    }

    #[test]
    fn cherry_pick_status_serde() {
        let status = CherryPickStatus {
            in_progress: true,
            current_commit: Some("abc123".to_string()),
            has_conflicts: false,
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: CherryPickStatus = serde_json::from_str(&json).unwrap();
        assert!(deserialized.in_progress);
        assert_eq!(deserialized.current_commit.as_deref(), Some("abc123"));
        assert!(!deserialized.has_conflicts);
    }

    #[test]
    fn rebase_status_serde() {
        let status = RebaseStatus {
            in_progress: true,
            current_commit: Some("def456".to_string()),
            remaining: 3,
            total: 5,
            has_conflicts: true,
            conflict_files: vec!["src/lib.rs".to_string()],
            paused_commit: None,
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: RebaseStatus = serde_json::from_str(&json).unwrap();
        assert!(deserialized.in_progress);
        assert_eq!(deserialized.current_commit.as_deref(), Some("def456"));
        assert_eq!(deserialized.remaining, 3);
        assert_eq!(deserialized.total, 5);
        assert!(deserialized.has_conflicts);
        assert_eq!(deserialized.conflict_files, vec!["src/lib.rs"]);
        assert!(deserialized.paused_commit.is_none());
    }

    #[test]
    fn bisect_status_serde() {
        let status = BisectStatus {
            in_progress: true,
            current_commit: Some("aaa111".to_string()),
            good_commits: vec!["good1".to_string(), "good2".to_string()],
            bad_commits: vec!["bad1".to_string()],
            remaining_steps: 4,
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: BisectStatus = serde_json::from_str(&json).unwrap();
        assert!(deserialized.in_progress);
        assert_eq!(deserialized.current_commit.as_deref(), Some("aaa111"));
        assert_eq!(deserialized.good_commits.len(), 2);
        assert_eq!(deserialized.bad_commits.len(), 1);
        assert_eq!(deserialized.remaining_steps, 4);
    }

    #[test]
    fn stash_entry_serde() {
        let entry = StashEntry {
            index: 2,
            message: "WIP: feature work".to_string(),
            date: "2024-01-15T10:30:00Z".to_string(),
            branch: Some("feature-branch".to_string()),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: StashEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.index, 2);
        assert_eq!(deserialized.message, "WIP: feature work");
        assert_eq!(deserialized.date, "2024-01-15T10:30:00Z");
        assert_eq!(deserialized.branch.as_deref(), Some("feature-branch"));
    }

    #[test]
    fn submodule_info_serde() {
        let info = SubmoduleInfo {
            name: "lib/external".to_string(),
            path: "lib/external".to_string(),
            url: "https://github.com/ext/lib.git".to_string(),
            branch: Some("main".to_string()),
            head_id: Some("fff999".to_string()),
            status: "initialized".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        let deserialized: SubmoduleInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "lib/external");
        assert_eq!(deserialized.path, "lib/external");
        assert_eq!(deserialized.url, "https://github.com/ext/lib.git");
        assert_eq!(deserialized.branch.as_deref(), Some("main"));
        assert_eq!(deserialized.head_id.as_deref(), Some("fff999"));
        assert_eq!(deserialized.status, "initialized");
    }

    #[test]
    fn git_tag_serde() {
        let tag = GitTag {
            name: "v1.0.0".to_string(),
            message: Some("Release 1.0.0".to_string()),
            tagger: Some("Tagger Name".to_string()),
            date: Some("2024-06-01T00:00:00Z".to_string()),
            commit_sha: "abc123".to_string(),
            is_annotated: true,
        };
        let json = serde_json::to_string(&tag).unwrap();
        let deserialized: GitTag = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "v1.0.0");
        assert_eq!(deserialized.message.as_deref(), Some("Release 1.0.0"));
        assert_eq!(deserialized.tagger.as_deref(), Some("Tagger Name"));
        assert_eq!(deserialized.commit_sha, "abc123");
        assert!(deserialized.is_annotated);
    }

    #[test]
    fn worktree_info_serde() {
        let info = WorktreeInfo {
            path: "/tmp/worktree".to_string(),
            head: Some("abc123".to_string()),
            branch: Some("feature".to_string()),
            is_bare: false,
            is_detached: false,
            is_locked: true,
            lock_reason: Some("in use".to_string()),
            prunable: false,
        };
        let json = serde_json::to_string(&info).unwrap();
        let deserialized: WorktreeInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, "/tmp/worktree");
        assert_eq!(deserialized.head.as_deref(), Some("abc123"));
        assert_eq!(deserialized.branch.as_deref(), Some("feature"));
        assert!(!deserialized.is_bare);
        assert!(!deserialized.is_detached);
        assert!(deserialized.is_locked);
        assert_eq!(deserialized.lock_reason.as_deref(), Some("in use"));
        assert!(!deserialized.prunable);
    }

    #[test]
    fn lfs_status_serde() {
        let status = LFSStatus {
            installed: true,
            initialized: true,
            version: Some("3.4.0".to_string()),
            tracked_patterns: vec!["*.bin".to_string(), "*.dat".to_string()],
            files_count: 5,
            files_size: 1_048_576,
            lfs_files: vec![LFSFileEntry {
                path: "data/large.bin".to_string(),
                size: 524_288,
                oid: Some("sha256:abcdef".to_string()),
                downloaded: true,
            }],
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: LFSStatus = serde_json::from_str(&json).unwrap();
        assert!(deserialized.installed);
        assert!(deserialized.initialized);
        assert_eq!(deserialized.version.as_deref(), Some("3.4.0"));
        assert_eq!(deserialized.tracked_patterns.len(), 2);
        assert_eq!(deserialized.files_count, 5);
        assert_eq!(deserialized.files_size, 1_048_576);
        assert_eq!(deserialized.lfs_files.len(), 1);
        assert_eq!(deserialized.lfs_files[0].path, "data/large.bin");
        assert_eq!(deserialized.lfs_files[0].size, 524_288);
        assert!(deserialized.lfs_files[0].downloaded);
    }
}
