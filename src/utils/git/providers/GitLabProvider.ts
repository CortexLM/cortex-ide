/**
 * GitLab Hosting Provider
 * 
 * Implements git hosting provider interface for GitLab (both public and self-hosted).
 */

import type {
  IGitHostingProvider,
  ParsedGitRemote,
  BuildPermalinkParams,
  BuildCommitPermalinkParams,
  LineSelection,
  PullRequest,
} from "../types";

/** Get host from a git remote URL */
function getHostFromRemoteUrl(remoteUrl: string): string | null {
  // Handle SSH URLs: git@gitlab.com:owner/repo.git
  if (remoteUrl.startsWith("git@")) {
    const match = remoteUrl.match(/^git@([^:]+):/);
    return match ? match[1] : null;
  }
  
  // Handle HTTPS URLs
  try {
    const url = new URL(remoteUrl);
    return url.hostname;
  } catch {
    return null;
  }
}

export class GitLabProvider implements IGitHostingProvider {
  readonly type = "gitlab" as const;
  readonly name: string;
  readonly baseUrl: string;
  readonly isSelfHosted: boolean;

  constructor(name: string, baseUrl: string, isSelfHosted = false) {
    this.name = name;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.isSelfHosted = isSelfHosted;
  }

  /** Create a public GitLab.com instance */
  static publicInstance(): GitLabProvider {
    return new GitLabProvider("GitLab", "https://gitlab.com", false);
  }

  /** Create a provider from a remote URL (for self-hosted detection) */
  static fromRemoteUrl(remoteUrl: string): GitLabProvider | null {
    const host = getHostFromRemoteUrl(remoteUrl);
    if (!host) return null;

    // Public GitLab - don't create a self-hosted instance
    if (host === "gitlab.com") {
      return null;
    }

    // Check if it looks like a GitLab instance
    if (!host.includes("gitlab")) {
      return null;
    }

    return new GitLabProvider(
      "GitLab Self-Hosted",
      `https://${host}`,
      true
    );
  }

  matchesRemoteUrl(url: string): boolean {
    const host = getHostFromRemoteUrl(url);
    if (!host) return false;
    
    try {
      const baseHost = new URL(this.baseUrl).hostname;
      return host === baseHost;
    } catch {
      return false;
    }
  }

  parseRemoteUrl(url: string): ParsedGitRemote | null {
    if (!this.matchesRemoteUrl(url)) return null;

    // Handle SSH URLs: git@gitlab.com:group/subgroup/repo.git
    if (url.startsWith("git@")) {
      const match = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
      if (match) {
        const pathParts = match[1].split("/");
        if (pathParts.length >= 2) {
          const repo = pathParts.pop()!.replace(/\.git$/, "");
          const owner = pathParts.join("/");
          return { owner, repo };
        }
      }
      return null;
    }

    // Handle HTTPS URLs
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      
      if (pathParts.length >= 2) {
        const repo = pathParts.pop()!.replace(/\.git$/, "");
        const owner = pathParts.join("/");
        return { owner, repo };
      }
    } catch {
      // Invalid URL
    }

    return null;
  }

  formatLineNumber(line: number): string {
    return `L${line}`;
  }

  formatLineRange(startLine: number, endLine: number): string {
    if (startLine === endLine) {
      return this.formatLineNumber(startLine);
    }
    // GitLab uses L{start}-{end} format (without second L)
    return `L${startLine}-${endLine}`;
  }

  private buildLineFragment(selection?: LineSelection): string {
    if (!selection) return "";
    // Convert from 0-indexed to 1-indexed for URL
    const startLine = selection.startLine + 1;
    const endLine = selection.endLine + 1;
    return this.formatLineRange(startLine, endLine);
  }

  buildPermalink(remote: ParsedGitRemote, params: BuildPermalinkParams): string {
    const { sha, path, selection } = params;
    const { owner, repo } = remote;
    
    // Encode path components but preserve slashes
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    
    // GitLab uses /-/ in URLs
    let permalink = `${this.baseUrl}/${owner}/${repo}/-/blob/${sha}/${encodedPath}`;
    
    // Add plain=1 query for markdown files
    if (path.endsWith(".md")) {
      permalink += "?plain=1";
    }
    
    const fragment = this.buildLineFragment(selection);
    if (fragment) {
      permalink += `#${fragment}`;
    }
    
    return permalink;
  }

  buildCommitPermalink(remote: ParsedGitRemote, params: BuildCommitPermalinkParams): string {
    const { sha } = params;
    const { owner, repo } = remote;
    return `${this.baseUrl}/${owner}/${repo}/-/commit/${sha}`;
  }

  buildFileUrl(
    remote: ParsedGitRemote,
    path: string,
    branch: string,
    selection?: LineSelection
  ): string {
    const { owner, repo } = remote;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    
    let url = `${this.baseUrl}/${owner}/${repo}/-/blob/${encodeURIComponent(branch)}/${encodedPath}`;
    
    if (path.endsWith(".md")) {
      url += "?plain=1";
    }
    
    const fragment = this.buildLineFragment(selection);
    if (fragment) {
      url += `#${fragment}`;
    }
    
    return url;
  }

  buildBlameUrl(
    remote: ParsedGitRemote,
    path: string,
    branch: string,
    selection?: LineSelection
  ): string {
    const { owner, repo } = remote;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    
    let url = `${this.baseUrl}/${owner}/${repo}/-/blame/${encodeURIComponent(branch)}/${encodedPath}`;
    
    const fragment = this.buildLineFragment(selection);
    if (fragment) {
      url += `#${fragment}`;
    }
    
    return url;
  }

  extractPullRequest(remote: ParsedGitRemote, message: string): PullRequest | null {
    // GitLab merge requests use "See merge request !{number}" or "Merge branch '...' into '...'"
    const firstLine = message.split("\n")[0];
    if (!firstLine) return null;

    // Try to match "See merge request owner/repo!{number}" pattern
    const mrMatch = firstLine.match(/See merge request [\w\-_./]+!(\d+)/);
    if (mrMatch) {
      const number = parseInt(mrMatch[1], 10);
      if (!isNaN(number)) {
        const { owner, repo } = remote;
        const url = `${this.baseUrl}/${owner}/${repo}/-/merge_requests/${number}`;
        return { number, url };
      }
    }

    // Also check for (!{number}) pattern at end of line
    const parenthesesMatch = firstLine.match(/\(!(\d+)\)$/);
    if (parenthesesMatch) {
      const number = parseInt(parenthesesMatch[1], 10);
      if (!isNaN(number)) {
        const { owner, repo } = remote;
        const url = `${this.baseUrl}/${owner}/${repo}/-/merge_requests/${number}`;
        return { number, url };
      }
    }

    return null;
  }

  buildCreateGistUrl(): string {
    // GitLab calls them "snippets"
    return `${this.baseUrl}/-/snippets/new`;
  }
}
