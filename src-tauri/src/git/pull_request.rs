//! Pull request and code review data types for git forge integration.

use serde::{Deserialize, Serialize};

// ============================================================================
// Forge Provider Types
// ============================================================================

/// Supported git forge providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ForgeProvider {
    GitHub,
    GitLab,
    Bitbucket,
}

// ============================================================================
// Pull Request State Types
// ============================================================================

/// State of a pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PullRequestState {
    Open,
    Closed,
    Merged,
}

// ============================================================================
// Review Types
// ============================================================================

/// State of a pull request review.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewState {
    Approved,
    ChangesRequested,
    Commented,
    Pending,
    Dismissed,
}

// ============================================================================
// CI Check Types
// ============================================================================

/// Status of a CI check run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Queued,
    InProgress,
    Success,
    Failure,
    Neutral,
    Cancelled,
    TimedOut,
    ActionRequired,
}

/// Conclusion of a completed CI check run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckConclusion {
    Queued,
    InProgress,
    Success,
    Failure,
    Neutral,
    Cancelled,
    TimedOut,
    ActionRequired,
}

// ============================================================================
// Pull Request Data Types
// ============================================================================

/// A user associated with a pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestUser {
    pub id: u64,
    pub login: String,
    pub avatar_url: String,
    pub html_url: String,
}

/// A label on a pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestLabel {
    pub id: u64,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

/// Branch reference in a pull request (head or base).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestBranch {
    pub label: String,
    #[serde(rename = "ref")]
    pub ref_name: String,
    pub sha: String,
    pub repo_full_name: Option<String>,
}

/// A pull request from a git forge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub body: Option<String>,
    pub state: PullRequestState,
    pub html_url: String,
    pub user: PullRequestUser,
    pub head: PullRequestBranch,
    pub base: PullRequestBranch,
    pub created_at: String,
    pub updated_at: String,
    pub merged_at: Option<String>,
    pub closed_at: Option<String>,
    pub labels: Vec<PullRequestLabel>,
    pub draft: bool,
    pub mergeable: Option<bool>,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
    pub changed_files: Option<u32>,
    pub review_comments: Option<u32>,
    pub commits: Option<u32>,
}

// ============================================================================
// Pull Request Create Types
// ============================================================================

/// Parameters for creating a new pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestCreate {
    pub title: String,
    pub body: Option<String>,
    pub head: String,
    pub base: String,
    pub draft: Option<bool>,
    pub labels: Option<Vec<String>>,
}

// ============================================================================
// Pull Request Review Types
// ============================================================================

/// A review on a pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestReview {
    pub id: u64,
    pub user: PullRequestUser,
    pub state: ReviewState,
    pub body: Option<String>,
    pub submitted_at: Option<String>,
}

/// A CI check run associated with a commit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CICheck {
    pub id: u64,
    pub name: String,
    pub status: CheckStatus,
    pub conclusion: Option<CheckConclusion>,
    pub html_url: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub output_title: Option<String>,
    pub output_summary: Option<String>,
}

// ============================================================================
// Merge Types
// ============================================================================

/// Method used to merge a pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MergeMethod {
    Merge,
    Squash,
    Rebase,
}

/// Parameters for merging a pull request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub commit_title: Option<String>,
    pub commit_message: Option<String>,
    pub merge_method: MergeMethod,
}
