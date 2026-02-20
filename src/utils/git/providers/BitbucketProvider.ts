/**
 * Bitbucket Hosting Provider
 * 
 * Implements git hosting provider interface for Bitbucket (both cloud and self-hosted/server).
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
const PULL_REQUEST_REGEX = /\(pull request #(\d+)\)/;

/** Get host from a git remote URL */
function getHostFromRemoteUrl(remoteUrl: string): string | null {
  // Handle SSH URLs: git@bitbucket.org:owner/repo.git
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

export class BitbucketProvider implements IGitHostingProvider {
  readonly type = "bitbucket" as const;
  readonly name: string;
  readonly baseUrl: string;
  readonly isSelfHosted: boolean;

  constructor(name: string, baseUrl: string, isSelfHosted = false) {
    this.name = name;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.isSelfHosted = isSelfHosted;
  }

  /** Create a public Bitbucket.org instance */
  static publicInstance(): BitbucketProvider {
    return new BitbucketProvider("Bitbucket", "https://bitbucket.org", false);
  }

  /** Create a provider from a remote URL (for self-hosted detection) */
  static fromRemoteUrl(remoteUrl: string): BitbucketProvider | null {
    const host = getHostFromRemoteUrl(remoteUrl);
    if (!host) return null;

    // Public Bitbucket - don't create a self-hosted instance
    if (host === "bitbucket.org") {
      return null;
    }

    // Check if it looks like a Bitbucket instance
    if (!host.includes("bitbucket")) {
      return null;
    }

    return new BitbucketProvider(
      "Bitbucket Server",
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

    // Handle SSH URLs: git@bitbucket.org:owner/repo.git
    if (url.startsWith("git@")) {
      const match = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
      if (match) {
        const pathParts = match[1].split("/");
        if (pathParts.length >= 2) {
          const repo = pathParts.pop()!.replace(/\.git$/, "");
          // Handle "scm" segment in self-hosted Bitbucket Server URLs
          let owner = pathParts.join("/");
          if (pathParts[0] === "scm" && pathParts.length > 1) {
            owner = pathParts.slice(1).join("/");
          }
          return { owner, repo };
        }
      }
      return null;
    }

    // Handle HTTPS URLs
    try {
      const urlObj = new URL(url);
      let pathParts = urlObj.pathname.split("/").filter(Boolean);
      
      // Handle "scm" segment in self-hosted Bitbucket Server URLs
      if (pathParts[0] === "scm" && pathParts.length > 2) {
        pathParts = pathParts.slice(1);
      }
      
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
    if (this.isSelfHosted) {
      return `${line}`;
    }
    return `lines-${line}`;
  }

  formatLineRange(startLine: number, endLine: number): string {
    if (startLine === endLine) {
      return this.formatLineNumber(startLine);
    }
    if (this.isSelfHosted) {
      return `${startLine}-${endLine}`;
    }
    return `lines-${startLine}:${endLine}`;
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
    
    let permalink: string;
    
    if (this.isSelfHosted) {
      // Bitbucket Server uses different URL structure
      permalink = `${this.baseUrl}/projects/${owner}/repos/${repo}/browse/${encodedPath}?at=${sha}`;
    } else {
      // Bitbucket Cloud
      permalink = `${this.baseUrl}/${owner}/${repo}/src/${sha}/${encodedPath}`;
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
    
    if (this.isSelfHosted) {
      return `${this.baseUrl}/projects/${owner}/repos/${repo}/commits/${sha}`;
    }
    return `${this.baseUrl}/${owner}/${repo}/commits/${sha}`;
  }

  buildFileUrl(
    remote: ParsedGitRemote,
    path: string,
    branch: string,
    selection?: LineSelection
  ): string {
    const { owner, repo } = remote;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const encodedBranch = encodeURIComponent(branch);
    
    let url: string;
    
    if (this.isSelfHosted) {
      url = `${this.baseUrl}/projects/${owner}/repos/${repo}/browse/${encodedPath}?at=refs/heads/${encodedBranch}`;
    } else {
      url = `${this.baseUrl}/${owner}/${repo}/src/${encodedBranch}/${encodedPath}`;
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
    const encodedBranch = encodeURIComponent(branch);
    
    let url: string;
    
    if (this.isSelfHosted) {
      // Bitbucket Server annotate (blame) view
      url = `${this.baseUrl}/projects/${owner}/repos/${repo}/browse/${encodedPath}?at=refs/heads/${encodedBranch}&blame=true`;
    } else {
      // Bitbucket Cloud annotate view
      url = `${this.baseUrl}/${owner}/${repo}/annotate/${encodedBranch}/${encodedPath}`;
    }
    
    const fragment = this.buildLineFragment(selection);
    if (fragment) {
      url += `#${fragment}`;
    }
    
    return url;
  }

  extractPullRequest(remote: ParsedGitRemote, message: string): PullRequest | null {
    const firstLine = message.split("\n")[0];
    if (!firstLine) return null;

    const match = firstLine.match(PULL_REQUEST_REGEX);
    if (!match) return null;

    const number = parseInt(match[1], 10);
    if (isNaN(number)) return null;

    const { owner, repo } = remote;
    
    let url: string;
    if (this.isSelfHosted) {
      url = `${this.baseUrl}/projects/${owner}/repos/${repo}/pull-requests/${number}`;
    } else {
      url = `${this.baseUrl}/${owner}/${repo}/pull-requests/${number}`;
    }

    return { number, url };
  }

  buildCreateGistUrl(): string {
    // Bitbucket Cloud uses "snippets"
    if (this.isSelfHosted) {
      // Bitbucket Server doesn't have a direct snippets feature
      // Return the repository page as a fallback
      return this.baseUrl;
    }
    return "https://bitbucket.org/snippets/new";
  }
}
