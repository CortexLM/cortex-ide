/**
 * SCM Provider Abstraction
 *
 * Generic interface for source control management providers. Wraps the
 * built-in Git backend and supports extension-contributed providers
 * registered via the plugin API.
 */

import { invoke } from "@tauri-apps/api/core";
export interface SCMProviderInfo {
  id: string;
  extensionId: string;
  label: string;
  rootUri?: string;
  icon?: string;
  count?: number;
  commitTemplate?: string;
}

export interface SCMResourceGroupData {
  id: string;
  label: string;
  hideWhenEmpty: boolean;
  resources: SCMResourceData[];
}

export interface SCMResourceData {
  uri: string;
  status: string;
  decorations?: {
    strikeThrough?: boolean;
    faded?: boolean;
    tooltip?: string;
  };
}

export interface SCMProvider {
  readonly info: SCMProviderInfo;
  getResourceGroups(): Promise<SCMResourceGroupData[]>;
  getInputBox(): SCMProviderInputBox;
  acceptInput(message: string): Promise<void>;
  dispose(): void;
}

export interface SCMProviderInputBox {
  value: string;
  placeholder: string;
  visible: boolean;
  enabled: boolean;
}

export class SCMProviderRegistry {
  private providers = new Map<string, SCMProvider>();
  private listeners = new Set<() => void>();

  register(provider: SCMProvider): void {
    this.providers.set(provider.info.id, provider);
    this.notifyListeners();
  }

  unregister(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.dispose();
      this.providers.delete(providerId);
      this.notifyListeners();
    }
  }

  get(providerId: string): SCMProvider | undefined {
    return this.providers.get(providerId);
  }

  getAll(): SCMProvider[] {
    return Array.from(this.providers.values());
  }

  getByExtension(extensionId: string): SCMProvider[] {
    return this.getAll().filter((p) => p.info.extensionId === extensionId);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
    this.listeners.clear();
  }
}

export function createGitSCMProvider(
  repoPath: string,
  label?: string,
): SCMProvider {
  const info: SCMProviderInfo = {
    id: `git:${repoPath}`,
    extensionId: "builtin.git",
    label: label ?? "Git",
    rootUri: repoPath,
    icon: "git-branch",
  };

  const inputBox: SCMProviderInputBox = {
    value: "",
    placeholder: "Commit message",
    visible: true,
    enabled: true,
  };

  return {
    info,

    async getResourceGroups(): Promise<SCMResourceGroupData[]> {
      try {
        const status = await invoke<{
          staged: Array<{ path: string; status: string }>;
          unstaged: Array<{ path: string; status: string }>;
          conflicts: Array<{ path: string; status: string }>;
        }>("git_status", { path: repoPath });

        const groups: SCMResourceGroupData[] = [];

        if (status.conflicts.length > 0) {
          groups.push({
            id: "merge-conflicts",
            label: "Merge Conflicts",
            hideWhenEmpty: true,
            resources: status.conflicts.map((f) => ({
              uri: f.path,
              status: "conflict",
              decorations: { tooltip: "Merge conflict" },
            })),
          });
        }

        groups.push({
          id: "staged",
          label: "Staged Changes",
          hideWhenEmpty: true,
          resources: status.staged.map((f) => ({
            uri: f.path,
            status: f.status,
          })),
        });

        groups.push({
          id: "changes",
          label: "Changes",
          hideWhenEmpty: false,
          resources: status.unstaged.map((f) => ({
            uri: f.path,
            status: f.status,
          })),
        });

        return groups;
      } catch {
        return [];
      }
    },

    getInputBox(): SCMProviderInputBox {
      return inputBox;
    },

    async acceptInput(message: string): Promise<void> {
      await invoke("git_commit", { path: repoPath, message });
    },

    dispose(): void {
      // No cleanup needed for built-in Git provider
    },
  };
}

export const scmRegistry = new SCMProviderRegistry();
