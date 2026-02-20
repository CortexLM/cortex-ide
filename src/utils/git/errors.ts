/**
 * Git Error Classification (VS Code Pattern)
 * 
 * Provides semantic error codes, parsing from stderr,
 * and user-friendly error messages.
 */

/**
 * Semantic Git error codes
 */
export enum GitErrorCode {
  // Lock errors (retryable)
  RepositoryIsLocked = "RepositoryIsLocked",
  CantLockRef = "CantLockRef",
  
  // Authentication errors
  AuthenticationFailed = "AuthenticationFailed",
  
  // Repository errors
  NotAGitRepository = "NotAGitRepository",
  BadConfigFile = "BadConfigFile",
  
  // Push/Pull errors
  PushRejected = "PushRejected",
  RemoteConnectionError = "RemoteConnectionError",
  RemoteNotFound = "RemoteNotFound",
  
  // Merge/Rebase errors
  ConflictError = "ConflictError",
  RebaseConflict = "RebaseConflict",
  MergeConflict = "MergeConflict",
  UnmergedChanges = "UnmergedChanges",
  
  // Working tree errors
  DirtyWorkTree = "DirtyWorkTree",
  LocalChangesOverwritten = "LocalChangesOverwritten",
  
  // Branch errors
  BranchNotFound = "BranchNotFound",
  BranchAlreadyExists = "BranchAlreadyExists",
  InvalidBranchName = "InvalidBranchName",
  CantDeleteCurrentBranch = "CantDeleteCurrentBranch",
  
  // Commit errors
  EmptyCommitMessage = "EmptyCommitMessage",
  NoChangesToCommit = "NoChangesToCommit",
  
  // Stash errors
  StashConflict = "StashConflict",
  NoStashFound = "NoStashFound",
  
  // Tag errors
  TagAlreadyExists = "TagAlreadyExists",
  TagNotFound = "TagNotFound",
  
  // Worktree errors
  WorktreeAlreadyExists = "WorktreeAlreadyExists",
  
  // Network errors
  NetworkError = "NetworkError",
  SSHError = "SSHError",
  
  // Permission errors
  PermissionDenied = "PermissionDenied",
  
  // Generic
  Unknown = "Unknown",
}

/**
 * Extended Error interface for Git errors
 */
export interface GitError extends Error {
  gitErrorCode?: GitErrorCode;
  stderr?: string;
  stdout?: string;
  exitCode?: number;
  command?: string;
  args?: string[];
}

/**
 * Create a GitError from an error object
 */
export function createGitError(
  message: string,
  options: {
    stderr?: string;
    stdout?: string;
    exitCode?: number;
    command?: string;
    args?: string[];
  } = {}
): GitError {
  const error = new Error(message) as GitError;
  error.stderr = options.stderr;
  error.stdout = options.stdout;
  error.exitCode = options.exitCode;
  error.command = options.command;
  error.args = options.args;
  
  // Parse error code from stderr if available
  if (options.stderr) {
    error.gitErrorCode = parseGitErrorCode(options.stderr, options.exitCode);
  } else {
    error.gitErrorCode = GitErrorCode.Unknown;
  }
  
  return error;
}

/**
 * Parse stderr output to determine the semantic error code
 */
export function parseGitErrorCode(stderr: string, _exitCode?: number): GitErrorCode {
  const lowerStderr = stderr.toLowerCase();
  
  // Lock errors (retryable)
  if (/another git process seems to be running/.test(lowerStderr)) {
    return GitErrorCode.RepositoryIsLocked;
  }
  if (/cannot lock ref/.test(lowerStderr)) {
    return GitErrorCode.CantLockRef;
  }
  
  // Authentication errors
  if (/authentication failed/i.test(stderr) || /invalid credentials/i.test(stderr)) {
    return GitErrorCode.AuthenticationFailed;
  }
  if (/permission denied \(publickey\)/i.test(stderr)) {
    return GitErrorCode.SSHError;
  }
  
  // Repository errors
  if (/not a git repository/i.test(stderr) || /fatal: not a git repository/i.test(stderr)) {
    return GitErrorCode.NotAGitRepository;
  }
  if (/bad config/i.test(stderr)) {
    return GitErrorCode.BadConfigFile;
  }
  
  // Push errors
  if (/rejected.*non-fast-forward/i.test(stderr) || /\[rejected\]/i.test(stderr)) {
    return GitErrorCode.PushRejected;
  }
  if (/could not read from remote/i.test(stderr) || /connection refused/i.test(stderr)) {
    return GitErrorCode.RemoteConnectionError;
  }
  if (/remote.*not found/i.test(stderr) || /does not appear to be a git repository/i.test(stderr)) {
    return GitErrorCode.RemoteNotFound;
  }
  
  // Merge/Rebase conflicts
  if (/conflict/i.test(stderr) && /merge/i.test(stderr)) {
    return GitErrorCode.MergeConflict;
  }
  if (/conflict/i.test(stderr) && /rebase/i.test(stderr)) {
    return GitErrorCode.RebaseConflict;
  }
  if (/conflict|automatic merge failed/i.test(stderr)) {
    return GitErrorCode.ConflictError;
  }
  if (/unmerged files/i.test(stderr) || /you have unmerged paths/i.test(stderr)) {
    return GitErrorCode.UnmergedChanges;
  }
  
  // Working tree errors
  if (/your local changes.*would be overwritten/i.test(stderr)) {
    return GitErrorCode.LocalChangesOverwritten;
  }
  if (/please commit.*or stash.*before/i.test(stderr)) {
    return GitErrorCode.DirtyWorkTree;
  }
  
  // Branch errors
  if (/branch.*not found/i.test(stderr) || /pathspec.*did not match/i.test(stderr)) {
    return GitErrorCode.BranchNotFound;
  }
  if (/branch.*already exists/i.test(stderr) || /a branch named.*already exists/i.test(stderr)) {
    return GitErrorCode.BranchAlreadyExists;
  }
  if (/invalid branch name/i.test(stderr) || /is not a valid branch name/i.test(stderr)) {
    return GitErrorCode.InvalidBranchName;
  }
  if (/cannot delete.*checked out/i.test(stderr)) {
    return GitErrorCode.CantDeleteCurrentBranch;
  }
  
  // Commit errors
  if (/aborting commit due to empty commit message/i.test(stderr)) {
    return GitErrorCode.EmptyCommitMessage;
  }
  if (/nothing to commit/i.test(stderr) || /no changes added to commit/i.test(stderr)) {
    return GitErrorCode.NoChangesToCommit;
  }
  
  // Stash errors
  if (/conflict.*stash/i.test(stderr)) {
    return GitErrorCode.StashConflict;
  }
  if (/no stash entries found/i.test(stderr) || /no stash found/i.test(stderr)) {
    return GitErrorCode.NoStashFound;
  }
  
  // Tag errors
  if (/tag.*already exists/i.test(stderr)) {
    return GitErrorCode.TagAlreadyExists;
  }
  if (/tag.*not found/i.test(stderr)) {
    return GitErrorCode.TagNotFound;
  }
  
  // Worktree errors
  if (/worktree.*already exists/i.test(stderr)) {
    return GitErrorCode.WorktreeAlreadyExists;
  }
  
  // Network errors
  if (/could not resolve host/i.test(stderr) || /network is unreachable/i.test(stderr)) {
    return GitErrorCode.NetworkError;
  }
  
  // Permission errors
  if (/permission denied/i.test(stderr) && !/publickey/i.test(stderr)) {
    return GitErrorCode.PermissionDenied;
  }
  
  return GitErrorCode.Unknown;
}

/**
 * User-friendly error messages for each error code
 */
export function getGitErrorMessage(code: GitErrorCode): string {
  const messages: Record<GitErrorCode, string> = {
    [GitErrorCode.RepositoryIsLocked]: "Another Git process is running. Please wait and try again.",
    [GitErrorCode.CantLockRef]: "Unable to lock the reference. Please try again.",
    [GitErrorCode.AuthenticationFailed]: "Authentication failed. Please check your credentials.",
    [GitErrorCode.NotAGitRepository]: "This folder is not a Git repository.",
    [GitErrorCode.BadConfigFile]: "Git configuration file is invalid.",
    [GitErrorCode.PushRejected]: "Push rejected. Try pulling first to get the latest changes.",
    [GitErrorCode.RemoteConnectionError]: "Cannot connect to remote repository. Check your network connection.",
    [GitErrorCode.RemoteNotFound]: "Remote repository not found.",
    [GitErrorCode.ConflictError]: "Merge conflicts detected. Please resolve them before continuing.",
    [GitErrorCode.RebaseConflict]: "Rebase conflict detected. Resolve conflicts or abort the rebase.",
    [GitErrorCode.MergeConflict]: "Merge conflict detected. Resolve conflicts before committing.",
    [GitErrorCode.UnmergedChanges]: "You have unmerged files. Resolve them before continuing.",
    [GitErrorCode.DirtyWorkTree]: "You have uncommitted changes. Commit or stash them first.",
    [GitErrorCode.LocalChangesOverwritten]: "Your local changes would be overwritten. Commit or stash them first.",
    [GitErrorCode.BranchNotFound]: "Branch not found.",
    [GitErrorCode.BranchAlreadyExists]: "A branch with this name already exists.",
    [GitErrorCode.InvalidBranchName]: "Invalid branch name.",
    [GitErrorCode.CantDeleteCurrentBranch]: "Cannot delete the currently checked out branch.",
    [GitErrorCode.EmptyCommitMessage]: "Commit message cannot be empty.",
    [GitErrorCode.NoChangesToCommit]: "No changes to commit.",
    [GitErrorCode.StashConflict]: "Stash apply resulted in conflicts. Resolve them manually.",
    [GitErrorCode.NoStashFound]: "No stash entries found.",
    [GitErrorCode.TagAlreadyExists]: "A tag with this name already exists.",
    [GitErrorCode.TagNotFound]: "Tag not found.",
    [GitErrorCode.WorktreeAlreadyExists]: "A worktree already exists at this location.",
    [GitErrorCode.NetworkError]: "Network error. Check your internet connection.",
    [GitErrorCode.SSHError]: "SSH authentication failed. Check your SSH keys.",
    [GitErrorCode.PermissionDenied]: "Permission denied.",
    [GitErrorCode.Unknown]: "A Git error occurred.",
  };
  
  return messages[code] ?? messages[GitErrorCode.Unknown];
}

/**
 * Check if an error code is retryable
 */
export function isRetryableError(code: GitErrorCode): boolean {
  return [
    GitErrorCode.RepositoryIsLocked,
    GitErrorCode.CantLockRef,
  ].includes(code);
}

/**
 * Get severity level for an error code
 */
export function getGitErrorSeverity(code: GitErrorCode): "error" | "warning" | "info" {
  const warnings: GitErrorCode[] = [
    GitErrorCode.ConflictError,
    GitErrorCode.MergeConflict,
    GitErrorCode.RebaseConflict,
    GitErrorCode.DirtyWorkTree,
    GitErrorCode.StashConflict,
  ];
  
  const info: GitErrorCode[] = [
    GitErrorCode.NoChangesToCommit,
    GitErrorCode.NoStashFound,
  ];
  
  if (warnings.includes(code)) return "warning";
  if (info.includes(code)) return "info";
  return "error";
}
