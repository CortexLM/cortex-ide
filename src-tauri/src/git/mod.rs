//! Git operations module.
//!
//! This module provides comprehensive Git functionality for the Cortex GUI application,
//! including repository status, staging, commits, branches, remotes, rebasing, cherry-picking,
//! bisecting, LFS support, worktrees, and more.

pub mod bisect;
pub mod blame;
pub mod branch;
pub(crate) mod cache;
pub mod cherry_pick;
pub mod clone;
pub(crate) mod command;
pub mod diff;
pub mod forge;
pub mod graph;
pub(crate) mod helpers;
pub mod hunk;
pub mod lfs;
pub mod lines;
pub mod log;
pub mod merge;
pub mod merge_editor;
pub mod pull_request;
pub mod rebase;
pub mod remote;
pub mod staging;
pub mod stash;
pub mod status;
pub mod submodule;
pub mod tag;
pub mod types;
pub mod watcher;
pub mod worktree;

// ============================================================================
// SCM Provider Abstraction
// ============================================================================

/// Trait for SCM provider abstraction (Git, SVN, Perforce, etc.)
/// This provides a common interface for future SCM backend support.
#[allow(dead_code)]
pub trait ScmProvider: Send + Sync {
    fn name(&self) -> &str;
    fn is_repo(&self, path: &str) -> bool;
    fn status(&self, path: &str) -> Result<Vec<types::GitFile>, String>;
    fn stage(&self, path: &str, file: &str) -> Result<(), String>;
    fn unstage(&self, path: &str, file: &str) -> Result<(), String>;
    fn commit(&self, path: &str, message: &str) -> Result<String, String>;
    fn diff(&self, path: &str, file: Option<&str>) -> Result<String, String>;
    fn log(&self, path: &str, max_count: u32) -> Result<Vec<types::GitCommit>, String>;
    fn blame(&self, path: &str, file: &str) -> Result<Vec<blame::BlameEntry>, String>;
}
