/**
 * GitHub Hosting Provider
 * 
 * Implements git hosting provider interface for GitHub (both public and self-hosted).
 */

import type {
  IGitHostingProvider,
  ParsedGitRemote,
  BuildPermalinkParams,
  BuildCommitPermalinkParams,
  LineSelection,
  PullRequest,
} from "../types";

/** Regular expression to extract PR number from commit message */
const PULL_REQUEST_NUMBER_REGEX = /\(#(\d+)\)$/;

/** Get host from a git remote URL */
function getHostFromRemoteUrl(remoteUrl: string): string | null {
  // Handle SSH URLs: git@github.com:owner/repo.git
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

export class GitHubProvider implements IGitHostingProvider {
  readonly type = "github" as const;
  readonly name: string;
  readonly baseUrl: string;
  readonly isSelfHosted: boolean;

  constructor(name: string, baseUrl: string, isSelfHosted = false) {
    this.name = name;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.isSelfHosted = isSelfHosted;
  }

  /** Create a public GitHub.com instance */
  static publicInstance(): GitHubProvider {
    return new GitHubProvider("GitHub", "https://github.com", false);
  }

  /** Create a provider from a remote URL (for self-hosted detection) */
  static fromRemoteUrl(remoteUrl: string): GitHubProvider | null {
    const host = getHostFromRemoteUrl(remoteUrl);
    if (!host) return null;

    // Public GitHub - don't create a self-hosted instance
    if (host === "github.com") {
      return null;
    }

    // Check if it looks like a GitHub instance
    if (!host.includes("github")) {
      return null;
    }

    return new GitHubProvider(
      "GitHub Enterprise",
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

    // Handle SSH URLs: git@github.com:owner/repo.git
    if (url.startsWith("git@")) {
      const match = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
      if (match) {
        const parts = match[1].split("/");
        if (parts.length >= 2) {
          // Handle leading slash edge case
          const owner = parts[0] === "" ? parts[1] : parts[0];
          const repo = parts[0] === "" ? parts[2] : parts[1];
          return { owner, repo: repo.replace(/\.git$/, "") };
        }
      }
      return null;
    }

    // Handle HTTPS URLs
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      
      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repo = pathParts[1].replace(/\.git$/, "");
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
    return `L${startLine}-L${endLine}`;
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
    
    let permalink = `${this.baseUrl}/${owner}/${repo}/blob/${sha}/${encodedPath}`;
    
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
    return `${this.baseUrl}/${owner}/${repo}/commit/${sha}`;
  }

  buildFileUrl(
    remote: ParsedGitRemote,
    path: string,
    branch: string,
    selection?: LineSelection
  ): string {
    const { owner, repo } = remote;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    
    let url = `${this.baseUrl}/${owner}/${repo}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
    
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
    
    let url = `${this.baseUrl}/${owner}/${repo}/blame/${encodeURIComponent(branch)}/${encodedPath}`;
    
    const fragment = this.buildLineFragment(selection);
    if (fragment) {
      url += `#${fragment}`;
    }
    
    return url;
  }

  extractPullRequest(remote: ParsedGitRemote, message: string): PullRequest | null {
    const firstLine = message.split("\n")[0];
    if (!firstLine) return null;

    const match = firstLine.match(PULL_REQUEST_NUMBER_REGEX);
    if (!match) return null;

    const number = parseInt(match[1], 10);
    if (isNaN(number)) return null;

    const { owner, repo } = remote;
    const url = `${this.baseUrl}/${owner}/${repo}/pull/${number}`;

    return { number, url };
  }

  buildCreateGistUrl(): string {
    if (this.isSelfHosted) {
      return `${this.baseUrl}/gist`;
    }
    return "https://gist.github.com";
  }
}
