/**
 * Git Types
 *
 * Centralized type definitions for git-related functionality including
 * status, branches, commits, diffs, and multi-repository management.
 */

// ============================================================================
// Git File Types
// ============================================================================

/**
 * Git file change status types.
 */
export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflict";

/**
 * Git conflict types.
 */
export type GitConflictType =
  | "both-modified"
  | "deleted-by-us"
  | "deleted-by-them"
  | "both-added";

/**
 * Represents a file change in git.
 */
export interface GitFileChange {
  /** File path relative to repository root */
  path: string;
  /** Type of change */
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  /** Original path for renamed files */
  originalPath?: string;
}

/**
 * Git file with staging and conflict information.
 */
export interface GitFile {
  /** File path relative to repository root */
  path: string;
  /** File status */
  status: GitFileStatus;
  /** Whether the file is staged */
  staged: boolean;
  /** Conflict type if file has conflicts */
  conflictType?: GitConflictType;
}

// ============================================================================
// Git Status Types
// ============================================================================

/**
 * Git repository status.
 */
export interface GitStatus {
  /** Staged file changes */
  staged: GitFileChange[];
  /** Unstaged file changes */
  unstaged: GitFileChange[];
  /** Untracked files */
  untracked: string[];
  /** Current branch name */
  branch: string | null;
  /** Upstream branch name */
  upstream: string | null;
  /** Number of commits ahead of upstream */
  ahead: number;
  /** Number of commits behind upstream */
  behind: number;
  /** HEAD commit hash */
  headSha: string | null;
  /** Whether there's a merge in progress */
  isMerging: boolean;
  /** Whether there's a rebase in progress */
  isRebasing: boolean;
}

// ============================================================================
// Git Branch Types
// ============================================================================

/**
 * Git branch information.
 */
export interface GitBranch {
  /** Branch name */
  name: string;
  /** Whether this is the HEAD branch */
  isHead: boolean;
  /** Whether this is a remote branch */
  isRemote: boolean;
  /** Remote name (for remote branches) */
  remote?: string;
  /** Upstream branch reference */
  upstream?: string;
  /** Commits ahead of upstream */
  ahead?: number;
  /** Commits behind upstream */
  behind?: number;
  /** Last commit SHA on this branch */
  lastCommit?: string;
}

/**
 * Extended branch information used in MultiRepoContext.
 */
export interface GitBranchExtended {
  /** Branch name */
  name: string;
  /** Whether this is the current branch */
  current: boolean;
  /** Remote name */
  remote?: string;
  /** Upstream branch reference */
  upstream?: string;
  /** Commits ahead of upstream */
  ahead?: number;
  /** Commits behind upstream */
  behind?: number;
  /** Last commit SHA */
  lastCommit?: string;
}

// ============================================================================
// Git Remote Types
// ============================================================================

/**
 * Git remote information.
 */
export interface GitRemote {
  /** Remote name (e.g., "origin") */
  name: string;
  /** Remote URL */
  url: string;
  /** Fetch URL if different */
  fetchUrl?: string;
  /** Push URL if different */
  pushUrl?: string;
}

// ============================================================================
// Git Commit Types
// ============================================================================

/**
 * Git commit information.
 */
export interface GitCommit {
  /** Full commit hash */
  hash: string;
  /** Short commit hash (7 characters) */
  shortHash: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit timestamp */
  timestamp: number;
  /** Commit message */
  message: string;
  /** Parent commit hashes */
  parents: string[];
}

/**
 * Commit reference (branch, tag, etc.).
 */
export interface CommitRef {
  /** Reference name */
  name: string;
  /** Reference type */
  type: "branch" | "tag" | "remote" | "head";
  /** Whether this is the current ref */
  current?: boolean;
}

/**
 * Commit file information.
 */
export interface CommitFile {
  /** File path */
  path: string;
  /** File change status */
  status: string;
  /** Number of lines added */
  additions?: number;
  /** Number of lines deleted */
  deletions?: number;
}

// ============================================================================
// Git Diff Types
// ============================================================================

/**
 * Git diff hunk.
 */
export interface GitHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Hunk content lines */
  lines: string[];
}

/**
 * Git diff for a file.
 */
export interface GitDiff {
  /** File path */
  path: string;
  /** Diff hunks */
  hunks: GitHunk[];
}

// ============================================================================
// Git Blame Types
// ============================================================================

/**
 * Git blame entry for a line.
 */
export interface GitBlameEntry {
  /** Commit hash */
  hash: string;
  /** Author name */
  author: string;
  /** Author email */
  authorEmail: string;
  /** Commit date as ISO 8601 string */
  date: string;
  /** Commit timestamp (Unix seconds) */
  timestamp: number;
  /** Commit message */
  message: string;
  /** Start line number */
  lineStart: number;
  /** End line number */
  lineEnd: number;
  /** Line content */
  content: string;
}

// ============================================================================
// Git Stash Types
// ============================================================================

/**
 * Git stash entry.
 */
export interface GitStash {
  /** Stash index */
  index: number;
  /** Stash message */
  message: string;
  /** Branch where stash was created */
  branch: string;
  /** Creation timestamp */
  timestamp: number;
}

// ============================================================================
// Git Compare Types
// ============================================================================

/**
 * Git compare commit info.
 */
export interface GitCompareCommit {
  /** Commit hash */
  hash: string;
  /** Short hash */
  shortHash: string;
  /** Author name */
  author: string;
  /** Timestamp */
  timestamp: number;
  /** Commit message */
  message: string;
}

/**
 * Git compare file info.
 */
export interface GitCompareFile {
  /** File path */
  path: string;
  /** Change status */
  status: "added" | "modified" | "deleted" | "renamed";
  /** Additions count */
  additions?: number;
  /** Deletions count */
  deletions?: number;
}

/**
 * Result of comparing two refs.
 */
export interface GitCompareResult {
  /** Commits ahead */
  ahead: number;
  /** Commits behind */
  behind: number;
  /** Commits between refs */
  commits: GitCompareCommit[];
  /** Changed files */
  files: GitCompareFile[];
}

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Repository operation status.
 */
export type RepoStatus = "idle" | "loading" | "error" | "disconnected";

/**
 * Complete repository information for multi-repo context.
 */
export interface RepositoryInfo {
  /** Unique identifier (normalized path) */
  id: string;
  /** Absolute path to the repository root */
  path: string;
  /** Repository display name */
  name: string;
  /** Current branch */
  branch: string | null;
  /** All local and remote branches */
  branches: GitBranchExtended[];
  /** Configured remotes */
  remotes: GitRemote[];
  /** Staged files */
  stagedFiles: GitFile[];
  /** Unstaged/working directory changes */
  unstagedFiles: GitFile[];
  /** Files with merge conflicts */
  conflictFiles: GitFile[];
  /** Stash entries */
  stashes: GitStash[];
  /** Commits ahead of upstream */
  ahead: number;
  /** Commits behind upstream */
  behind: number;
  /** HEAD commit SHA */
  headSha: string | null;
  /** Whether repo is in a merge state */
  isMerging: boolean;
  /** Whether repo is in a rebase state */
  isRebasing: boolean;
  /** Current operation status */
  status: RepoStatus;
  /** Last error message if any */
  lastError: string | null;
  /** Last refresh timestamp */
  lastRefresh: number;
}

// ============================================================================
// Git Hosting Types
// ============================================================================

/**
 * Supported git hosting provider types.
 */
export type GitHostingProviderType = "github" | "gitlab" | "bitbucket";

/**
 * Parsed information from a git remote URL.
 */
export interface GitRemoteInfo {
  /** Provider type */
  provider: GitHostingProviderType;
  /** Repository owner/organization */
  owner: string;
  /** Repository name */
  repo: string;
  /** Full remote URL */
  url: string;
}

/**
 * Git hosting provider configuration.
 */
export interface GitHostingProviderConfig {
  /** Provider type */
  type: GitHostingProviderType;
  /** Display name */
  name: string;
  /** Base URL for web access */
  baseUrl: string;
  /** API base URL */
  apiUrl?: string;
}

/**
 * Git hosting action types.
 */
export type GitHostingAction =
  | "open-file-on-remote"
  | "copy-permalink"
  | "copy-commit-url"
  | "open-blame"
  | "open-history"
  | "open-pull-request"
  | "open-compare";

/**
 * Git context for hosting actions.
 */
export interface GitContext {
  /** Absolute file path */
  filePath: string;
  /** Path relative to repository root */
  relativePath: string;
  /** Current branch */
  branch?: string;
  /** Current commit hash */
  commitHash?: string;
  /** Line number (for permalinks) */
  lineNumber?: number;
  /** End line number (for range permalinks) */
  endLineNumber?: number;
}

// ============================================================================
// Git Settings Types
// ============================================================================

/**
 * Git autofetch and sync settings.
 */
export interface GitSyncSettings {
  /** Enable automatic fetching from remote */
  autofetch: boolean;
  /** Autofetch interval in seconds */
  autofetchPeriod: number;
  /** Confirm before syncing */
  confirmSync: boolean;
  /** Prune deleted remote branches on fetch */
  pruneOnFetch: boolean;
  /** Rebase instead of merge when syncing */
  rebaseWhenSync: boolean;
}

// ============================================================================
// Git Worktree Types
// ============================================================================

/**
 * Git worktree information.
 */
export interface GitWorktree {
  /** Worktree directory path */
  path: string;
  /** Branch checked out (null if detached HEAD) */
  branch: string | null;
  /** Current HEAD commit SHA */
  commit: string;
  /** Is this the main/primary worktree? */
  isMain: boolean;
  /** Is the worktree locked to prevent accidental pruning? */
  isLocked: boolean;
  /** Reason for lock (if locked) */
  lockReason?: string;
  /** Can be pruned (working directory missing or corrupt) */
  prunable: boolean;
  /** Reason for being prunable */
  prunableReason?: string;
}

/**
 * Options for adding a new worktree.
 */
export interface GitWorktreeAddOptions {
  /** Branch to checkout (null creates detached HEAD) */
  branch?: string | null;
  /** Create a new branch with this name */
  createBranch?: boolean;
  /** Start point for new branch or detached HEAD (commit/branch/tag) */
  commitish?: string;
  /** Force creation even if directory exists */
  force?: boolean;
  /** Remote branch to track (for new branches) */
  track?: string;
}