/**
 * Git Hosting Providers - Type Definitions
 * 
 * Core types and interfaces for git hosting provider integration.
 */

/** Supported git hosting provider types */
export type GitHostingProviderType = "github" | "gitlab" | "bitbucket";

/** Parsed information from a git remote URL */
export interface ParsedGitRemote {
  owner: string;
  repo: string;
}

/** Parameters for building a file permalink */
export interface BuildPermalinkParams {
  sha: string;
  path: string;
  selection?: LineSelection;
}

/** Parameters for building a commit permalink */
export interface BuildCommitPermalinkParams {
  sha: string;
}

/** Line selection range (0-indexed) */
export interface LineSelection {
  startLine: number;
  endLine: number;
}

/** Pull/Merge request information */
export interface PullRequest {
  number: number;
  url: string;
}

/** Configuration for a git hosting provider instance */
export interface GitHostingProviderConfig {
  type: GitHostingProviderType;
  name: string;
  baseUrl: string;
  token?: string;
}

/** Git hosting provider authentication settings */
export interface GitHostingAuthSettings {
  github?: {
    token?: string;
  };
  gitlab?: {
    token?: string;
  };
  bitbucket?: {
    token?: string;
    username?: string;
  };
}

/** Result of detecting a provider from a remote URL */
export interface ProviderDetectionResult {
  provider: GitHostingProviderType;
  remote: ParsedGitRemote;
  baseUrl: string;
  isSelfHosted: boolean;
}

/** Context menu action types */
export type GitHostingAction =
  | "open-file-on-remote"
  | "copy-permalink"
  | "open-pr"
  | "view-blame"
  | "create-gist";

/** Git context information for actions */
export interface GitContext {
  filePath: string;
  relativePath: string;
  selection?: LineSelection;
  branch?: string;
  sha?: string;
  remoteUrl?: string;
}

/** Git hosting provider interface */
export interface IGitHostingProvider {
  /** Provider type identifier */
  readonly type: GitHostingProviderType;
  
  /** Human-readable provider name */
  readonly name: string;
  
  /** Base URL for this provider instance */
  readonly baseUrl: string;
  
  /** Whether this is a self-hosted instance */
  readonly isSelfHosted: boolean;
  
  /** Parse a remote URL to extract owner and repo */
  parseRemoteUrl(url: string): ParsedGitRemote | null;
  
  /** Check if this provider matches the given remote URL */
  matchesRemoteUrl(url: string): boolean;
  
  /** Build a permalink to a file at a specific commit */
  buildPermalink(remote: ParsedGitRemote, params: BuildPermalinkParams): string;
  
  /** Build a permalink to a specific commit */
  buildCommitPermalink(remote: ParsedGitRemote, params: BuildCommitPermalinkParams): string;
  
  /** Build a URL to view a file on the remote (current branch) */
  buildFileUrl(remote: ParsedGitRemote, path: string, branch: string, selection?: LineSelection): string;
  
  /** Build a URL to view blame for a file */
  buildBlameUrl(remote: ParsedGitRemote, path: string, branch: string, selection?: LineSelection): string;
  
  /** Extract pull request info from a commit message */
  extractPullRequest(remote: ParsedGitRemote, message: string): PullRequest | null;
  
  /** Build the URL for creating a new gist/snippet */
  buildCreateGistUrl(): string;
  
  /** Format a single line number for URL fragment */
  formatLineNumber(line: number): string;
  
  /** Format a line range for URL fragment */
  formatLineRange(startLine: number, endLine: number): string;
}
