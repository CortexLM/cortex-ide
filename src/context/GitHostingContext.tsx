/**
 * Git Hosting Provider Context
 * 
 * Provides access to git hosting provider features throughout the application.
 * Manages provider detection, URL building, and clipboard operations.
 */

import {
  createContext,
  useContext,
  createEffect,
  ParentProps,
  onMount,
} from "solid-js";
import { createStore } from "solid-js/store";
import { getProviderForRemote } from "@/utils/git/registry";
import type {
  IGitHostingProvider,
  ParsedGitRemote,
  GitHostingAuthSettings,
  LineSelection,
  GitHostingAction,
} from "@/utils/git/types";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "../utils/workspace";

const STORAGE_KEY = "cortex_git_hosting_settings";

interface GitRepositoryInfo {
  remoteUrl: string | null;
  branch: string | null;
  sha: string | null;
  provider: IGitHostingProvider | null;
  remote: ParsedGitRemote | null;
}

interface GitHostingState {
  repoInfo: GitRepositoryInfo;
  authSettings: GitHostingAuthSettings;
  isLoading: boolean;
  lastError: string | null;
}

interface GitHostingContextValue {
  state: GitHostingState;
  
  /** Refresh repository information from the current project */
  refreshRepoInfo: () => Promise<void>;
  
  /** Open a file on the remote hosting provider */
  openFileOnRemote: (filePath: string, selection?: LineSelection) => Promise<void>;
  
  /** Copy a permalink to the clipboard */
  copyPermalink: (filePath: string, selection?: LineSelection) => Promise<void>;
  
  /** Copy the current file URL to clipboard */
  copyFileUrl: (filePath: string, selection?: LineSelection) => Promise<void>;
  
  /** Open the PR/MR associated with the current commit (if any) */
  openPullRequest: (commitMessage: string) => Promise<void>;
  
  /** Open blame view for a file on the remote */
  openBlameOnRemote: (filePath: string, selection?: LineSelection) => Promise<void>;
  
  /** Open the gist/snippet creation page */
  openCreateGist: () => Promise<void>;
  
  /** Update authentication settings */
  updateAuthSettings: (settings: Partial<GitHostingAuthSettings>) => void;
  
  /** Check if git hosting features are available */
  isAvailable: () => boolean;
  
  /** Get the current provider name */
  getProviderName: () => string | null;
  
  /** Perform a git hosting action */
  performAction: (action: GitHostingAction, filePath: string, selection?: LineSelection) => Promise<void>;
}

const GitHostingContext = createContext<GitHostingContextValue>();

/** Load settings from localStorage */
function loadSettings(): GitHostingAuthSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[GitHosting] Failed to load settings:", e);
  }
  return {};
}

/** Save settings to localStorage */
function saveSettings(settings: GitHostingAuthSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("[GitHosting] Failed to save settings:", e);
  }
}

/** Get the relative path from project root */
function getRelativePath(filePath: string, projectPath: string): string {
  // Normalize paths for comparison
  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedProject = projectPath.replace(/\\/g, "/");
  
  if (normalizedFile.startsWith(normalizedProject)) {
    return normalizedFile.slice(normalizedProject.length).replace(/^\//, "");
  }
  
  return normalizedFile;
}

export function GitHostingProvider(props: ParentProps) {
  const [state, setState] = createStore<GitHostingState>({
    repoInfo: {
      remoteUrl: null,
      branch: null,
      sha: null,
      provider: null,
      remote: null,
    },
    authSettings: loadSettings(),
    isLoading: false,
    lastError: null,
  });

  /** Refresh repository info from the backend */
  const refreshRepoInfo = async () => {
    setState("isLoading", true);
    setState("lastError", null);

    try {
      const projectPath = getProjectPath();
      if (!projectPath) {
        setState("repoInfo", {
          remoteUrl: null,
          branch: null,
          sha: null,
          provider: null,
          remote: null,
        });
        return;
      }

      // Get git remote URL - using Tauri invoke
      let remoteUrl: string | null = null;
      try {
        const data = await invoke<any>("git_remote", { path: projectPath });
        remoteUrl = data?.url || null;
      } catch (e) {
        console.warn("[GitHosting] Failed to get remote:", e);
      }

      // Get current branch - using Tauri invoke
      let branch: string | null = null;
      try {
        const data = await invoke<any>("git_branch", { path: projectPath });
        branch = data?.branch || null;
      } catch (e) {
        console.warn("[GitHosting] Failed to get branch:", e);
      }

      // Get HEAD commit SHA - using Tauri invoke
      let sha: string | null = null;
      try {
        const data = await invoke<any>("git_head", { path: projectPath });
        sha = data?.sha || null;
      } catch (e) {
        console.warn("[GitHosting] Failed to get SHA:", e);
      }

      // Detect provider
      let provider: IGitHostingProvider | null = null;
      let remote: ParsedGitRemote | null = null;
      
      if (remoteUrl) {
        provider = getProviderForRemote(remoteUrl);
        if (provider) {
          remote = provider.parseRemoteUrl(remoteUrl);
        }
      }

      setState("repoInfo", {
        remoteUrl,
        branch,
        sha,
        provider,
        remote,
      });
    } catch (e) {
      console.error("[GitHosting] Failed to refresh repo info:", e);
      setState("lastError", String(e));
    } finally {
      setState("isLoading", false);
    }
  };

  /** Open a file on the remote */
  const openFileOnRemote = async (filePath: string, selection?: LineSelection) => {
    const { provider, remote, branch } = state.repoInfo;
    if (!provider || !remote || !branch) {
      console.warn("[GitHosting] Cannot open file on remote - missing provider info");
      return;
    }

    const projectPath = getProjectPath();
    const relativePath = getRelativePath(filePath, projectPath);
    
    const url = provider.buildFileUrl(remote, relativePath, branch, selection);
    await open(url);
  };

  /** Copy a permalink to clipboard */
  const copyPermalink = async (filePath: string, selection?: LineSelection) => {
    const { provider, remote, sha } = state.repoInfo;
    if (!provider || !remote || !sha) {
      console.warn("[GitHosting] Cannot copy permalink - missing provider info");
      return;
    }

    const projectPath = getProjectPath();
    const relativePath = getRelativePath(filePath, projectPath);
    
    const url = provider.buildPermalink(remote, { sha, path: relativePath, selection });
    await writeText(url);
  };

  /** Copy file URL to clipboard */
  const copyFileUrl = async (filePath: string, selection?: LineSelection) => {
    const { provider, remote, branch } = state.repoInfo;
    if (!provider || !remote || !branch) {
      console.warn("[GitHosting] Cannot copy file URL - missing provider info");
      return;
    }

    const projectPath = getProjectPath();
    const relativePath = getRelativePath(filePath, projectPath);
    
    const url = provider.buildFileUrl(remote, relativePath, branch, selection);
    await writeText(url);
  };

  /** Open the PR associated with a commit message */
  const openPullRequest = async (commitMessage: string) => {
    const { provider, remote } = state.repoInfo;
    if (!provider || !remote) {
      console.warn("[GitHosting] Cannot open PR - missing provider info");
      return;
    }

    const pr = provider.extractPullRequest(remote, commitMessage);
    if (pr) {
      await open(pr.url);
    }
  };

  /** Open blame view on remote */
  const openBlameOnRemote = async (filePath: string, selection?: LineSelection) => {
    const { provider, remote, branch } = state.repoInfo;
    if (!provider || !remote || !branch) {
      console.warn("[GitHosting] Cannot open blame - missing provider info");
      return;
    }

    const projectPath = getProjectPath();
    const relativePath = getRelativePath(filePath, projectPath);
    
    const url = provider.buildBlameUrl(remote, relativePath, branch, selection);
    await open(url);
  };

  /** Open gist creation page */
  const openCreateGist = async () => {
    const { provider } = state.repoInfo;
    if (!provider) {
      // Fall back to GitHub gist if no provider detected
      await open("https://gist.github.com");
      return;
    }

    const url = provider.buildCreateGistUrl();
    await open(url);
  };

  /** Update auth settings */
  const updateAuthSettings = (settings: Partial<GitHostingAuthSettings>) => {
    setState("authSettings", (prev) => {
      const newSettings = { ...prev, ...settings };
      saveSettings(newSettings);
      return newSettings;
    });
  };

  /** Check if git hosting features are available */
  const isAvailable = () => {
    return !!(state.repoInfo.provider && state.repoInfo.remote);
  };

  /** Get provider name */
  const getProviderName = () => {
    return state.repoInfo.provider?.name || null;
  };

  /** Perform a git hosting action */
  const performAction = async (
    action: GitHostingAction,
    filePath: string,
    selection?: LineSelection
  ) => {
    switch (action) {
      case "open-file-on-remote":
        await openFileOnRemote(filePath, selection);
        break;
      case "copy-permalink":
        await copyPermalink(filePath, selection);
        break;
      case "open-pr":
        // For PR opening, we need the commit message - this would come from elsewhere
        console.warn("[GitHosting] PR opening requires commit message");
        break;
      case "view-blame":
        await openBlameOnRemote(filePath, selection);
        break;
      case "create-gist":
        await openCreateGist();
        break;
    }
  };

  // Refresh repo info on mount
  onMount(() => {
    refreshRepoInfo();
  });

  // Re-fetch when project path changes
  createEffect(() => {
    const projectPath = getProjectPath();
    if (projectPath) {
      refreshRepoInfo();
    }
  });

  return (
    <GitHostingContext.Provider
      value={{
        state,
        refreshRepoInfo,
        openFileOnRemote,
        copyPermalink,
        copyFileUrl,
        openPullRequest,
        openBlameOnRemote,
        openCreateGist,
        updateAuthSettings,
        isAvailable,
        getProviderName,
        performAction,
      }}
    >
      {props.children}
    </GitHostingContext.Provider>
  );
}

export function useGitHosting() {
  const context = useContext(GitHostingContext);
  if (!context) {
    throw new Error("useGitHosting must be used within GitHostingProvider");
  }
  return context;
}
