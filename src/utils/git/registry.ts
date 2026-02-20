/**
 * Git Hosting Provider Registry
 * 
 * Manages registered providers and handles provider detection from remote URLs.
 */

import type { IGitHostingProvider, ParsedGitRemote, ProviderDetectionResult } from "./types";
import { GitHubProvider } from "./providers/GitHubProvider";
import { GitLabProvider } from "./providers/GitLabProvider";
import { BitbucketProvider } from "./providers/BitbucketProvider";

/** Singleton instance of the provider registry */
let registryInstance: GitHostingProviderRegistry | null = null;

/**
 * Registry for git hosting providers.
 * 
 * Maintains a list of registered providers (both public instances and
 * self-hosted) and provides methods for provider detection and lookup.
 */
export class GitHostingProviderRegistry {
  private providers: IGitHostingProvider[] = [];
  private selfHostedProviders: IGitHostingProvider[] = [];

  constructor() {
    // Register public instances by default
    this.registerProvider(GitHubProvider.publicInstance());
    this.registerProvider(GitLabProvider.publicInstance());
    this.registerProvider(BitbucketProvider.publicInstance());
  }

  /** Get the global registry instance */
  static global(): GitHostingProviderRegistry {
    if (!registryInstance) {
      registryInstance = new GitHostingProviderRegistry();
    }
    return registryInstance;
  }

  /** Register a new provider */
  registerProvider(provider: IGitHostingProvider): void {
    // Avoid duplicates
    const existing = this.providers.find(
      (p) => p.type === provider.type && p.baseUrl === provider.baseUrl
    );
    if (existing) return;

    if (provider.isSelfHosted) {
      this.selfHostedProviders.push(provider);
    } else {
      this.providers.push(provider);
    }
  }

  /** Get all registered providers (both public and self-hosted) */
  getAllProviders(): IGitHostingProvider[] {
    return [...this.providers, ...this.selfHostedProviders];
  }

  /** Get all public providers */
  getPublicProviders(): IGitHostingProvider[] {
    return [...this.providers];
  }

  /** Get all self-hosted providers */
  getSelfHostedProviders(): IGitHostingProvider[] {
    return [...this.selfHostedProviders];
  }

  /**
   * Detect the provider from a remote URL.
   * 
   * First tries to match against registered providers, then attempts
   * to detect and register self-hosted instances.
   */
  detectProvider(remoteUrl: string): ProviderDetectionResult | null {
    // First, try registered providers
    for (const provider of this.getAllProviders()) {
      const remote = provider.parseRemoteUrl(remoteUrl);
      if (remote) {
        return {
          provider: provider.type,
          remote,
          baseUrl: provider.baseUrl,
          isSelfHosted: provider.isSelfHosted,
        };
      }
    }

    // Try to detect and register self-hosted instances
    const selfHosted = this.detectAndRegisterSelfHosted(remoteUrl);
    if (selfHosted) {
      const remote = selfHosted.parseRemoteUrl(remoteUrl);
      if (remote) {
        return {
          provider: selfHosted.type,
          remote,
          baseUrl: selfHosted.baseUrl,
          isSelfHosted: true,
        };
      }
    }

    return null;
  }

  /**
   * Get a provider that can handle the given remote URL.
   */
  getProviderForRemote(remoteUrl: string): IGitHostingProvider | null {
    // First, try registered providers
    for (const provider of this.getAllProviders()) {
      if (provider.matchesRemoteUrl(remoteUrl)) {
        return provider;
      }
    }

    // Try to detect and register self-hosted instances
    return this.detectAndRegisterSelfHosted(remoteUrl);
  }

  /**
   * Try to detect a self-hosted instance from the remote URL.
   * If detected, registers it and returns the provider.
   */
  private detectAndRegisterSelfHosted(remoteUrl: string): IGitHostingProvider | null {
    // Try GitHub Enterprise
    const github = GitHubProvider.fromRemoteUrl(remoteUrl);
    if (github) {
      this.registerProvider(github);
      return github;
    }

    // Try GitLab self-hosted
    const gitlab = GitLabProvider.fromRemoteUrl(remoteUrl);
    if (gitlab) {
      this.registerProvider(gitlab);
      return gitlab;
    }

    // Try Bitbucket Server
    const bitbucket = BitbucketProvider.fromRemoteUrl(remoteUrl);
    if (bitbucket) {
      this.registerProvider(bitbucket);
      return bitbucket;
    }

    return null;
  }

  /** Clear self-hosted providers (useful for testing or when switching projects) */
  clearSelfHostedProviders(): void {
    this.selfHostedProviders = [];
  }

  /** Get a provider by type and base URL */
  getProvider(type: string, baseUrl?: string): IGitHostingProvider | null {
    const allProviders = this.getAllProviders();
    
    if (baseUrl) {
      return allProviders.find(
        (p) => p.type === type && p.baseUrl === baseUrl
      ) || null;
    }
    
    // Return the first matching provider (prefer public over self-hosted)
    return this.providers.find((p) => p.type === type)
      || this.selfHostedProviders.find((p) => p.type === type)
      || null;
  }
}

/**
 * Parse owner and repo from a remote URL.
 * 
 * Convenience function that uses the global registry.
 */
export function parseRemoteUrl(remoteUrl: string): ParsedGitRemote | null {
  const registry = GitHostingProviderRegistry.global();
  const result = registry.detectProvider(remoteUrl);
  return result?.remote || null;
}

/**
 * Get the provider for a remote URL.
 * 
 * Convenience function that uses the global registry.
 */
export function getProviderForRemote(remoteUrl: string): IGitHostingProvider | null {
  const registry = GitHostingProviderRegistry.global();
  return registry.getProviderForRemote(remoteUrl);
}

/**
 * Get host from a git remote URL.
 */
export function getHostFromRemoteUrl(remoteUrl: string): string | null {
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
