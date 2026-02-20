//! Git forge (GitHub/GitLab/Bitbucket) integration for pull request management.

use std::sync::Arc;
use tokio::sync::Mutex;

use once_cell::sync::Lazy;
use regex::Regex;
use serde::Deserialize;
use tracing::{error, info, warn};

use super::pull_request::{
    CICheck, CheckConclusion, CheckStatus, ForgeProvider, MergeRequest, PullRequest,
    PullRequestBranch, PullRequestCreate, PullRequestLabel, PullRequestReview, PullRequestState,
    PullRequestUser, ReviewState,
};

const KEYRING_SERVICE: &str = "Cortex-desktop-forge";

/// Default GitHub REST API base URL. Used when no custom API endpoint is configured.
const GITHUB_API_BASE: &str = "https://api.github.com";

const MAX_TOKEN_LENGTH: usize = 500;

const MAX_PER_PAGE: u32 = 100;

const MAX_ERROR_BODY_LENGTH: usize = 200;

// ============================================================================
// Input Validation
// ============================================================================

static REPO_IDENTIFIER_RE: Lazy<Regex> = Lazy::new(|| {
    // SAFETY: This regex pattern is a compile-time constant and is always valid.
    #[allow(clippy::expect_used)]
    Regex::new(r"^[a-zA-Z0-9._-]+$").expect("Invalid regex")
});

static GIT_REF_RE: Lazy<Regex> = Lazy::new(|| {
    // SAFETY: This regex pattern is a compile-time constant and is always valid.
    #[allow(clippy::expect_used)]
    Regex::new(r"^[0-9a-fA-F]{4,40}$").expect("Invalid regex")
});

fn validate_repo_identifier(value: &str, field_name: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{} cannot be empty", field_name));
    }
    if value.len() > 100 {
        return Err(format!(
            "{} exceeds maximum length of 100 characters",
            field_name
        ));
    }
    if !REPO_IDENTIFIER_RE.is_match(value) {
        return Err(format!(
            "{} contains invalid characters (only alphanumeric, '.', '-', '_' allowed)",
            field_name
        ));
    }
    Ok(())
}

fn validate_git_ref(ref_sha: &str) -> Result<(), String> {
    if ref_sha.is_empty() {
        return Err("Git ref cannot be empty".to_string());
    }
    if !GIT_REF_RE.is_match(ref_sha) {
        return Err("Git ref must be a valid hex SHA (4-40 hex characters)".to_string());
    }
    Ok(())
}

fn validate_token(token: &str) -> Result<(), String> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err("Token cannot be empty".to_string());
    }
    if trimmed.len() > MAX_TOKEN_LENGTH {
        return Err(format!(
            "Token exceeds maximum length of {} characters",
            MAX_TOKEN_LENGTH
        ));
    }
    Ok(())
}

fn sanitize_error_body(body: &str) -> String {
    if body.len() <= MAX_ERROR_BODY_LENGTH {
        body.to_string()
    } else {
        format!("{}...[truncated]", &body[..MAX_ERROR_BODY_LENGTH])
    }
}

// ============================================================================
// Credential Storage
// ============================================================================

struct ForgeCredentials;

impl ForgeCredentials {
    fn get_entry(provider: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYRING_SERVICE, provider)
            .map_err(|e| format!("Failed to access keyring: {}", e))
    }

    fn store_token(provider: &str, token: &str) -> Result<(), String> {
        let entry = Self::get_entry(provider)?;
        entry
            .set_password(token)
            .map_err(|e| format!("Failed to store forge token: {}", e))
    }

    fn get_token(provider: &str) -> Result<Option<String>, String> {
        let entry = Self::get_entry(provider)?;
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to retrieve forge token: {}", e)),
        }
    }

    #[allow(dead_code)]
    fn delete_token(provider: &str) -> Result<(), String> {
        let entry = Self::get_entry(provider)?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete forge token: {}", e)),
        }
    }

    #[allow(dead_code)]
    fn has_token(provider: &str) -> bool {
        Self::get_entry(provider)
            .and_then(|entry| match entry.get_password() {
                Ok(_) => Ok(true),
                Err(keyring::Error::NoEntry) => Ok(false),
                Err(e) => Err(format!("Failed to check forge token: {}", e)),
            })
            .unwrap_or(false)
    }
}

// ============================================================================
// GitHub API Response Types (internal deserialization)
// ============================================================================

#[derive(Deserialize)]
struct GitHubRepo {
    full_name: String,
}

#[derive(Deserialize)]
struct GitHubBranch {
    label: String,
    #[serde(rename = "ref")]
    ref_name: String,
    sha: String,
    repo: Option<GitHubRepo>,
}

impl From<GitHubBranch> for PullRequestBranch {
    fn from(b: GitHubBranch) -> Self {
        Self {
            label: b.label,
            ref_name: b.ref_name,
            sha: b.sha,
            repo_full_name: b.repo.map(|r| r.full_name),
        }
    }
}

#[derive(Deserialize)]
struct GitHubPullRequest {
    id: u64,
    number: u32,
    title: String,
    body: Option<String>,
    state: String,
    html_url: String,
    user: PullRequestUser,
    head: GitHubBranch,
    base: GitHubBranch,
    created_at: String,
    updated_at: String,
    merged_at: Option<String>,
    closed_at: Option<String>,
    labels: Vec<PullRequestLabel>,
    draft: bool,
    mergeable: Option<bool>,
    additions: Option<u32>,
    deletions: Option<u32>,
    changed_files: Option<u32>,
    review_comments: Option<u32>,
    commits: Option<u32>,
}

impl From<GitHubPullRequest> for PullRequest {
    fn from(pr: GitHubPullRequest) -> Self {
        let state = match pr.state.as_str() {
            "open" => PullRequestState::Open,
            "closed" => {
                if pr.merged_at.is_some() {
                    PullRequestState::Merged
                } else {
                    PullRequestState::Closed
                }
            }
            _ => PullRequestState::Open,
        };

        Self {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state,
            html_url: pr.html_url,
            user: pr.user,
            head: pr.head.into(),
            base: pr.base.into(),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            merged_at: pr.merged_at,
            closed_at: pr.closed_at,
            labels: pr.labels,
            draft: pr.draft,
            mergeable: pr.mergeable,
            additions: pr.additions,
            deletions: pr.deletions,
            changed_files: pr.changed_files,
            review_comments: pr.review_comments,
            commits: pr.commits,
        }
    }
}

#[derive(Deserialize)]
struct GitHubCheckOutput {
    title: Option<String>,
    summary: Option<String>,
}

#[derive(Deserialize)]
struct GitHubCheckRun {
    id: u64,
    name: String,
    status: String,
    conclusion: Option<String>,
    html_url: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
    output: Option<GitHubCheckOutput>,
}

#[derive(Deserialize)]
struct GitHubCheckRunsResponse {
    check_runs: Vec<GitHubCheckRun>,
}

/// Maps GitHub check run status strings to our `CheckStatus` enum.
/// Note: GitHub's "completed" status is mapped to `Success` here because
/// the actual outcome is determined by the separate `conclusion` field.
fn parse_check_status(s: &str) -> CheckStatus {
    match s {
        "queued" => CheckStatus::Queued,
        "in_progress" => CheckStatus::InProgress,
        "completed" => CheckStatus::Success,
        _ => CheckStatus::Queued,
    }
}

fn parse_check_conclusion(s: &str) -> CheckConclusion {
    match s {
        "success" => CheckConclusion::Success,
        "failure" => CheckConclusion::Failure,
        "neutral" => CheckConclusion::Neutral,
        "cancelled" => CheckConclusion::Cancelled,
        "timed_out" => CheckConclusion::TimedOut,
        "action_required" => CheckConclusion::ActionRequired,
        "in_progress" => CheckConclusion::InProgress,
        "queued" => CheckConclusion::Queued,
        _ => CheckConclusion::Neutral,
    }
}

impl From<GitHubCheckRun> for CICheck {
    fn from(cr: GitHubCheckRun) -> Self {
        Self {
            id: cr.id,
            name: cr.name,
            status: parse_check_status(&cr.status),
            conclusion: cr.conclusion.as_deref().map(parse_check_conclusion),
            html_url: cr.html_url,
            started_at: cr.started_at,
            completed_at: cr.completed_at,
            output_title: cr.output.as_ref().and_then(|o| o.title.clone()),
            output_summary: cr.output.as_ref().and_then(|o| o.summary.clone()),
        }
    }
}

#[derive(Deserialize)]
struct GitHubReview {
    id: u64,
    user: PullRequestUser,
    state: String,
    body: Option<String>,
    submitted_at: Option<String>,
}

fn parse_review_state(s: &str) -> ReviewState {
    match s {
        "APPROVED" => ReviewState::Approved,
        "CHANGES_REQUESTED" => ReviewState::ChangesRequested,
        "COMMENTED" => ReviewState::Commented,
        "PENDING" => ReviewState::Pending,
        "DISMISSED" => ReviewState::Dismissed,
        _ => ReviewState::Commented,
    }
}

impl From<GitHubReview> for PullRequestReview {
    fn from(r: GitHubReview) -> Self {
        Self {
            id: r.id,
            user: r.user,
            state: parse_review_state(&r.state),
            body: r.body,
            submitted_at: r.submitted_at,
        }
    }
}

// ============================================================================
// Forge Client
// ============================================================================

pub struct ForgeClient {
    client: reqwest::Client,
    token: Option<String>,
    api_base: String,
    provider: ForgeProvider,
}

impl ForgeClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            token: None,
            api_base: GITHUB_API_BASE.to_string(),
            provider: ForgeProvider::GitHub,
        }
    }

    #[allow(dead_code)]
    pub fn with_token(token: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            token: Some(token),
            api_base: GITHUB_API_BASE.to_string(),
            provider: ForgeProvider::GitHub,
        }
    }

    fn ensure_authenticated(&self) -> Result<(), String> {
        if self.token.is_none() {
            return Err(
                "Authentication required. Please authenticate with git_forge_authenticate first."
                    .to_string(),
            );
        }
        Ok(())
    }

    fn auth_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();

        if let Some(ref token) = self.token {
            if let Ok(val) = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token)) {
                headers.insert(reqwest::header::AUTHORIZATION, val);
            }
        }

        headers.insert(
            reqwest::header::ACCEPT,
            reqwest::header::HeaderValue::from_static("application/vnd.github+json"),
        );
        headers.insert(
            reqwest::header::USER_AGENT,
            reqwest::header::HeaderValue::from_static("Cortex-Desktop"),
        );
        headers.insert(
            "X-GitHub-Api-Version",
            reqwest::header::HeaderValue::from_static("2022-11-28"),
        );

        headers
    }

    pub async fn list_prs(
        &self,
        owner: &str,
        repo: &str,
        state: Option<&str>,
        per_page: Option<u32>,
    ) -> Result<Vec<PullRequest>, String> {
        let url = format!("{}/repos/{}/{}/pulls", self.api_base, owner, repo);

        let mut request = self.client.get(&url).headers(self.auth_headers());

        if let Some(state) = state {
            request = request.query(&[("state", state)]);
        }
        let clamped_per_page = per_page.map(|p| p.min(MAX_PER_PAGE));
        if let Some(per_page) = clamped_per_page {
            request = request.query(&[("per_page", per_page.to_string())]);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Failed to fetch pull requests: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let sanitized = sanitize_error_body(&body);
            error!("GitHub API error listing PRs: {} {}", status, sanitized);
            return Err(format!("GitHub API error: {}", status));
        }

        let github_prs: Vec<GitHubPullRequest> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse pull requests response: {}", e))?;

        info!(
            "Fetched {} pull requests for {}/{}",
            github_prs.len(),
            owner,
            repo
        );
        Ok(github_prs.into_iter().map(Into::into).collect())
    }

    pub async fn get_pr(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<PullRequest, String> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}",
            self.api_base, owner, repo, number
        );

        let response = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| format!("Failed to fetch pull request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let sanitized = sanitize_error_body(&body);
            error!(
                "GitHub API error getting PR #{}: {} {}",
                number, status, sanitized
            );
            return Err(format!("GitHub API error: {}", status));
        }

        let github_pr: GitHubPullRequest = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse pull request response: {}", e))?;

        info!("Fetched PR #{} for {}/{}", number, owner, repo);
        Ok(github_pr.into())
    }

    pub async fn create_pr(
        &self,
        owner: &str,
        repo: &str,
        create: PullRequestCreate,
    ) -> Result<PullRequest, String> {
        self.ensure_authenticated()?;

        let url = format!("{}/repos/{}/{}/pulls", self.api_base, owner, repo);

        let response = self
            .client
            .post(&url)
            .headers(self.auth_headers())
            .json(&create)
            .send()
            .await
            .map_err(|e| format!("Failed to create pull request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let sanitized = sanitize_error_body(&body);
            error!("GitHub API error creating PR: {} {}", status, sanitized);
            return Err(format!("GitHub API error: {}", status));
        }

        let github_pr: GitHubPullRequest = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse create PR response: {}", e))?;

        info!("Created PR #{} for {}/{}", github_pr.number, owner, repo);
        Ok(github_pr.into())
    }

    pub async fn merge_pr(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
        merge: MergeRequest,
    ) -> Result<(), String> {
        self.ensure_authenticated()?;

        let url = format!(
            "{}/repos/{}/{}/pulls/{}/merge",
            self.api_base, owner, repo, number
        );

        let response = self
            .client
            .put(&url)
            .headers(self.auth_headers())
            .json(&merge)
            .send()
            .await
            .map_err(|e| format!("Failed to merge pull request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let sanitized = sanitize_error_body(&body);
            error!(
                "GitHub API error merging PR #{}: {} {}",
                number, status, sanitized
            );
            return Err(format!("GitHub API error: {}", status));
        }

        info!("Merged PR #{} for {}/{}", number, owner, repo);
        Ok(())
    }

    pub async fn get_pr_checks(
        &self,
        owner: &str,
        repo: &str,
        ref_sha: &str,
    ) -> Result<Vec<CICheck>, String> {
        let url = format!(
            "{}/repos/{}/{}/commits/{}/check-runs",
            self.api_base, owner, repo, ref_sha
        );

        let response = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| format!("Failed to fetch check runs: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let sanitized = sanitize_error_body(&body);
            error!("GitHub API error fetching checks: {} {}", status, sanitized);
            return Err(format!("GitHub API error: {}", status));
        }

        let check_response: GitHubCheckRunsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse check runs response: {}", e))?;

        info!(
            "Fetched {} check runs for {}/{} ref {}",
            check_response.check_runs.len(),
            owner,
            repo,
            ref_sha
        );
        Ok(check_response
            .check_runs
            .into_iter()
            .map(Into::into)
            .collect())
    }

    pub async fn get_pr_reviews(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<Vec<PullRequestReview>, String> {
        let url = format!(
            "{}/repos/{}/{}/pulls/{}/reviews",
            self.api_base, owner, repo, number
        );

        let response = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| format!("Failed to fetch PR reviews: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let sanitized = sanitize_error_body(&body);
            error!(
                "GitHub API error fetching reviews for PR #{}: {} {}",
                number, status, sanitized
            );
            return Err(format!("GitHub API error: {}", status));
        }

        let github_reviews: Vec<GitHubReview> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse reviews response: {}", e))?;

        info!(
            "Fetched {} reviews for PR #{} in {}/{}",
            github_reviews.len(),
            number,
            owner,
            repo
        );
        Ok(github_reviews.into_iter().map(Into::into).collect())
    }
}

// ============================================================================
// Forge State
// ============================================================================

#[derive(Clone)]
pub struct ForgeState(pub Arc<Mutex<ForgeClient>>);

impl ForgeState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(ForgeClient::new())))
    }
}

// ============================================================================
// Standalone Functions
// ============================================================================

pub async fn authenticate(token: String, provider: &str) -> Result<(), String> {
    validate_token(&token)?;
    let trimmed = token.trim().to_string();
    ForgeCredentials::store_token(provider, &trimmed)?;
    info!("Stored forge token for provider: {}", provider);
    Ok(())
}

#[allow(dead_code)]
pub fn load_token(provider: &str) -> Result<Option<String>, String> {
    let token = ForgeCredentials::get_token(provider)?;
    if token.is_some() {
        info!("Loaded forge token for provider: {}", provider);
    } else {
        warn!("No forge token found for provider: {}", provider);
    }
    Ok(token)
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn git_forge_list_prs(
    owner: String,
    repo: String,
    state: Option<String>,
    per_page: Option<u32>,
    forge_state: tauri::State<'_, ForgeState>,
) -> Result<Vec<PullRequest>, String> {
    validate_repo_identifier(&owner, "owner")?;
    validate_repo_identifier(&repo, "repo")?;
    let client = forge_state.0.lock().await;
    client
        .list_prs(&owner, &repo, state.as_deref(), per_page)
        .await
}

#[tauri::command]
pub async fn git_forge_get_pr(
    owner: String,
    repo: String,
    number: u32,
    forge_state: tauri::State<'_, ForgeState>,
) -> Result<PullRequest, String> {
    validate_repo_identifier(&owner, "owner")?;
    validate_repo_identifier(&repo, "repo")?;
    let client = forge_state.0.lock().await;
    client.get_pr(&owner, &repo, number).await
}

#[tauri::command]
pub async fn git_forge_create_pr(
    owner: String,
    repo: String,
    create: PullRequestCreate,
    forge_state: tauri::State<'_, ForgeState>,
) -> Result<PullRequest, String> {
    validate_repo_identifier(&owner, "owner")?;
    validate_repo_identifier(&repo, "repo")?;
    let client = forge_state.0.lock().await;
    client.create_pr(&owner, &repo, create).await
}

#[tauri::command]
pub async fn git_forge_merge_pr(
    owner: String,
    repo: String,
    number: u32,
    merge: MergeRequest,
    forge_state: tauri::State<'_, ForgeState>,
) -> Result<(), String> {
    validate_repo_identifier(&owner, "owner")?;
    validate_repo_identifier(&repo, "repo")?;
    let client = forge_state.0.lock().await;
    client.merge_pr(&owner, &repo, number, merge).await
}

#[tauri::command]
pub async fn git_forge_pr_checks(
    owner: String,
    repo: String,
    ref_sha: String,
    forge_state: tauri::State<'_, ForgeState>,
) -> Result<Vec<CICheck>, String> {
    validate_repo_identifier(&owner, "owner")?;
    validate_repo_identifier(&repo, "repo")?;
    validate_git_ref(&ref_sha)?;
    let client = forge_state.0.lock().await;
    client.get_pr_checks(&owner, &repo, &ref_sha).await
}

#[tauri::command]
pub async fn git_forge_get_pr_reviews(
    owner: String,
    repo: String,
    number: u32,
    forge_state: tauri::State<'_, ForgeState>,
) -> Result<Vec<PullRequestReview>, String> {
    validate_repo_identifier(&owner, "owner")?;
    validate_repo_identifier(&repo, "repo")?;
    let client = forge_state.0.lock().await;
    client.get_pr_reviews(&owner, &repo, number).await
}

#[tauri::command]
pub async fn git_forge_authenticate(token: String, provider: String) -> Result<(), String> {
    validate_repo_identifier(&provider, "provider")?;
    authenticate(token, &provider).await
}
