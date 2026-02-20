/**
 * Multi-Repository Git Context
 * 
 * Manages multiple git repositories within the workspace, providing
 * per-repo status, branches, remotes, and cross-repo operations.
 */

import {
  createContext,
  useContext,
  ParentProps,
  onMount,
  onCleanup,
  createEffect,
  createMemo,
  batch,
  on,
  createSignal,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "./WorkspaceContext";
import { gitLogger } from "../utils/logger";
import { debounce } from "../utils/decorators";
import { GitErrorCode, parseGitErrorCode, getGitErrorMessage } from "../utils/git/errors";
import { withRetry } from "../utils/retry";

// Debounce detection to prevent duplicate calls
let detectionPending = false;
let detectionInProgress = false;

// ============================================================================
// Types
// ============================================================================

/** Git file status types */
export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflict";

/** Git conflict types */
export type GitConflictType = "both-modified" | "deleted-by-us" | "deleted-by-them" | "both-added";

/** Git file with change information */
export interface GitFile {
  path: string;
  status: GitFileStatus;
  staged: boolean;
  conflictType?: GitConflictType;
}

/** Git branch information */
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  lastCommit?: string;
}

/** Git remote information */
export interface GitRemote {
  name: string;
  url: string;
  fetchUrl?: string;
  pushUrl?: string;
}

/** Git stash entry */
export interface GitStash {
  index: number;
  message: string;
  branch: string;
  timestamp: number;
}

/** Repository status */
export type RepoStatus = "idle" | "loading" | "error" | "disconnected";

/** Complete repository information */
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
  branches: GitBranch[];
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

/** Multi-repo context state */
export interface MultiRepoState {
  /** All tracked repositories */
  repositories: RepositoryInfo[];
  /** Currently active repository ID */
  activeRepositoryId: string | null;
  /** Whether auto-detection is enabled */
  autoDetectEnabled: boolean;
  /** Global loading state */
  isLoading: boolean;
  /** Global error state */
  globalError: string | null;
}

/** Cross-repo operation types */
export type CrossRepoOperation = "fetch-all" | "pull-all" | "push-all" | "sync-all";

/** Multi-repo context value */
export interface MultiRepoContextValue {
  /** Current state */
  state: MultiRepoState;
  
  /** All repositories */
  repositories: () => RepositoryInfo[];
  
  /** Currently active repository */
  activeRepository: () => RepositoryInfo | null;
  
  /** Add a repository by path */
  addRepository: (path: string) => Promise<boolean>;
  
  /** Remove a repository */
  removeRepository: (id: string) => void;
  
  /** Set the active repository */
  setActiveRepository: (id: string | null) => void;
  
  /** Refresh status for a specific repository */
  refreshRepository: (id: string) => Promise<void>;
  
  /** Refresh all repositories */
  refreshAllRepositories: () => Promise<void>;
  
  /** Auto-detect repositories in workspace folders */
  detectRepositories: () => Promise<void>;
  
  /** Enable/disable auto-detection */
  setAutoDetectEnabled: (enabled: boolean) => void;
  
  /** Get repository by ID */
  getRepositoryById: (id: string) => RepositoryInfo | undefined;
  
  /** Get repository by path */
  getRepositoryByPath: (path: string) => RepositoryInfo | undefined;
  
  /** Get repository for a file path */
  getRepositoryForFile: (filePath: string) => RepositoryInfo | undefined;
  
  /** Stage files in a repository */
  stageFiles: (repoId: string, files: string[]) => Promise<void>;
  
  /** Unstage files in a repository */
  unstageFiles: (repoId: string, files: string[]) => Promise<void>;
  
  /** Stage all files in a repository */
  stageAll: (repoId: string) => Promise<void>;
  
  /** Unstage all files in a repository */
  unstageAll: (repoId: string) => Promise<void>;
  
  /** Discard changes in files */
  discardChanges: (repoId: string, files: string[]) => Promise<void>;
  
  /** Commit changes */
  commit: (repoId: string, message: string, sign?: boolean) => Promise<boolean>;
  
  /** Checkout a branch */
  checkout: (repoId: string, branch: string) => Promise<void>;
  
  /** Create a new branch */
  createBranch: (repoId: string, name: string, checkout?: boolean) => Promise<void>;
  
  /** Delete a branch */
  deleteBranch: (repoId: string, name: string, force?: boolean) => Promise<void>;
  
  /** Merge a branch into current */
  mergeBranch: (repoId: string, branch: string) => Promise<{ hasConflicts: boolean }>;
  
  /** Push to remote */
  push: (repoId: string, remote?: string, branch?: string) => Promise<void>;
  
  /** Pull from remote */
  pull: (repoId: string, remote?: string, branch?: string) => Promise<void>;
  
  /** Fetch from remote */
  fetch: (repoId: string, remote?: string) => Promise<void>;
  
  /** Execute cross-repo operation */
  executeCrossRepoOperation: (operation: CrossRepoOperation) => Promise<void>;
  
  /** Get summary statistics across all repos */
  getSummary: () => {
    totalRepos: number;
    reposWithChanges: number;
    totalStagedFiles: number;
    totalUnstagedFiles: number;
    totalConflicts: number;
  };
  
  /** Git sync settings (autofetch, rebase) */
  gitSyncSettings: () => GitSyncSettings;
  
  /** Update git sync settings */
  updateGitSyncSettings: (settings: Partial<GitSyncSettings>) => void;
  
  /** Pull from remote with optional rebase */
  pullWithRebase: (repoId: string, remote?: string, branch?: string, rebase?: boolean) => Promise<void>;
  
  /** Initialize a new git repository at path */
  gitInit: (path: string) => Promise<boolean>;
  
  /** Undo the last commit (soft reset HEAD~1) */
  undoLastCommit: (repoId: string) => Promise<void>;
  
  /** Rename a branch */
  renameBranch: (repoId: string, oldName: string, newName: string) => Promise<void>;
  
  /** Stage specific lines from a file */
  stageSelectedLines: (repoId: string, uri: string, ranges: Array<{ start: number; end: number }>) => Promise<void>;
  
  /** Unstage specific lines from a file */
  unstageSelectedLines: (repoId: string, uri: string, ranges: Array<{ start: number; end: number }>) => Promise<void>;
  
  /** Remove untracked files (git clean) */
  gitClean: (repoId: string, paths?: string[]) => Promise<void>;
  
  /** Add a remote */
  addRemote: (repoId: string, name: string, url: string) => Promise<void>;
  
  /** Remove a remote */
  removeRemote: (repoId: string, name: string) => Promise<void>;
  
  /** Rename a remote */
  renameRemote: (repoId: string, oldName: string, newName: string) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "cortex_multi_repo_state";
const GIT_SETTINGS_KEY = "cortex_git_settings";
const _REFRESH_INTERVAL = 30000; // 30 seconds - deprecated, kept for reference only

// Default git settings for autofetch, rebase, prune, and tags
const DEFAULT_GIT_SETTINGS = {
  autofetch: true,
  autofetchPeriod: 180, // seconds
  rebaseWhenSync: false,
  pruneOnFetch: false,
  fetchTags: true,
  followTagsWhenSync: false,
};

/** Git autofetch and sync settings */
export interface GitSyncSettings {
  /** Enable automatic fetching from remote */
  autofetch: boolean;
  /** Period in seconds between automatic fetches (default: 180) */
  autofetchPeriod: number;
  /** Use rebase instead of merge when syncing (pulling) */
  rebaseWhenSync: boolean;
  /** Prune deleted remote-tracking branches when fetching */
  pruneOnFetch: boolean;
  /** Fetch all tags from remotes */
  fetchTags: boolean;
  /** Push annotated tags when syncing/pushing */
  followTagsWhenSync: boolean;
}

/** Load git settings from localStorage */
function loadGitSettings(): GitSyncSettings {
  try {
    const stored = localStorage.getItem(GIT_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_GIT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.debug("[MultiRepo] Parse settings failed:", err);
  }
  return { ...DEFAULT_GIT_SETTINGS };
}

/** Save git settings to localStorage */
function saveGitSettings(settings: GitSyncSettings): void {
  localStorage.setItem(GIT_SETTINGS_KEY, JSON.stringify(settings));
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function extractRepoName(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || "Repository";
}

function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(parent) + "/";
  const normalizedChild = normalizePath(child);
  return normalizedChild.startsWith(normalizedParent) || normalizedChild === normalizePath(parent);
}

function createEmptyRepository(path: string): RepositoryInfo {
  const normalizedPath = normalizePath(path);
  return {
    id: normalizedPath,
    path: normalizedPath,
    name: extractRepoName(normalizedPath),
    branch: null,
    branches: [],
    remotes: [],
    stagedFiles: [],
    unstagedFiles: [],
    conflictFiles: [],
    stashes: [],
    ahead: 0,
    behind: 0,
    headSha: null,
    isMerging: false,
    isRebasing: false,
    status: "idle",
    lastError: null,
    lastRefresh: 0,
  };
}

// ============================================================================
// Context
// ============================================================================

const MultiRepoContext = createContext<MultiRepoContextValue>();

export function MultiRepoProvider(props: ParentProps) {
  const workspace = useWorkspace();
  
  const [state, setState] = createStore<MultiRepoState>({
    repositories: [],
    activeRepositoryId: null,
    autoDetectEnabled: true,
    isLoading: false,
    globalError: null,
  });
  
  // Git sync settings (autofetch, rebase)
  const [gitSettings, setGitSettings] = createStore<GitSyncSettings>(loadGitSettings());
  
  // Track operations in progress for idle detection (VS Code pattern)
  const [operationsInProgress, setOperationsInProgress] = createSignal<Set<string>>(new Set());
  
  // Check if no write operations are in progress
  const isIdle = () => operationsInProgress().size === 0;
  
  // Wait until system is idle AND window is focused (VS Code pattern)
  const whenIdleAndFocused = async (): Promise<void> => {
    while (true) {
      if (!isIdle()) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }
      if (typeof document !== 'undefined' && !document.hasFocus()) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return;
    }
  };
  
  // Refresh only the active repository (not all repos)
  const refreshActiveRepository = async () => {
    const activeId = state.activeRepositoryId;
    if (activeId) {
      await refreshRepository(activeId);
    }
  };
  
  // Debounced update with idle wait (VS Code pattern: 1000ms debounce)
  const _eventuallyUpdateWhenIdleAndWait = debounce(async () => {
    await whenIdleAndFocused();
    await refreshActiveRepository();
  }, 1000);
  
  // Track and execute git operations with retry and error handling
  const _executeGitOperation = async <T,>(
    operationName: string,
    operation: () => Promise<T>,
    options: { retry?: boolean; silent?: boolean } = {}
  ): Promise<T> => {
    const { retry = true, silent = false } = options;
    
    // Track operation start
    setOperationsInProgress(prev => {
      const next = new Set(prev);
      next.add(operationName);
      return next;
    });
    
    try {
      if (retry) {
        return await withRetry(operation, {
          maxAttempts: 10,
          onRetry: (attempt, _error, delay) => {
            gitLogger.debug(`Retrying ${operationName} (attempt ${attempt}, delay ${delay}ms)`);
          }
        });
      }
      return await operation();
    } catch (err: any) {
      // Parse and classify the error
      if (err.stderr && !err.gitErrorCode) {
        err.gitErrorCode = parseGitErrorCode(err.stderr, err.exitCode);
      }
      
      gitLogger.error(`Git operation ${operationName} failed:`, err);
      
      // Dispatch error event for UI notification (unless silent)
      if (!silent) {
        const errorCode = err.gitErrorCode || GitErrorCode.Unknown;
        window.dispatchEvent(new CustomEvent("git:error", {
          detail: {
            operation: operationName,
            code: errorCode,
            message: getGitErrorMessage(errorCode),
            details: err.message || String(err),
          }
        }));
      }
      
      throw err;
    } finally {
      // Track operation end
      setOperationsInProgress(prev => {
        const next = new Set(prev);
        next.delete(operationName);
        return next;
      });
    }
  };
  
  // Track autofetch interval ID
  let autofetchIntervalId: ReturnType<typeof setInterval> | null = null;

  // Function to perform autofetch for all repositories
  const performAutofetch = async () => {
    if (state.repositories.length === 0) return;
    
    gitLogger.debug("Performing autofetch for all repositories");
    try {
      // Fetch from all remotes for all repositories IN PARALLEL
      await Promise.all(
        state.repositories.map(repo =>
          invoke("git_fetch", { path: repo.path }).catch(err => {
            // Log but don't fail the whole operation
            gitLogger.warn(`Autofetch failed for ${repo.name}:`, err);
          })
        )
      );
      // Refresh status to reflect any changes
      await refreshAllRepositories();
    } catch (err) {
      gitLogger.error("Autofetch error:", err);
    }
  };
  
  // Setup/cleanup autofetch interval based on settings
  const setupAutofetchInterval = () => {
    // Clear existing interval if any
    if (autofetchIntervalId !== null) {
      clearInterval(autofetchIntervalId);
      autofetchIntervalId = null;
    }
    
    // Set up new interval if autofetch is enabled
    if (gitSettings.autofetch && gitSettings.autofetchPeriod > 0) {
      const periodMs = gitSettings.autofetchPeriod * 1000;
      gitLogger.debug(`Autofetch enabled, period: ${gitSettings.autofetchPeriod}s`);
      autofetchIntervalId = setInterval(performAutofetch, periodMs);
    } else {
      gitLogger.debug("Autofetch disabled");
    }
  };

  // Track if initial detection has been done
  let initialDetectionDone = false;
  
  // Load persisted state
  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<MultiRepoState>;
        batch(() => {
          if (parsed.activeRepositoryId) {
            setState("activeRepositoryId", parsed.activeRepositoryId);
          }
          if (typeof parsed.autoDetectEnabled === "boolean") {
            setState("autoDetectEnabled", parsed.autoDetectEnabled);
          }
        });
      } catch (err) {
        console.debug("[MultiRepo] Parse settings failed:", err);
      }
    }
    
    // Initial detection (deferred to avoid blocking startup)
    setTimeout(() => {
      detectRepositories();
      initialDetectionDone = true;
    }, 50);
    
    // Set up autofetch interval based on settings
    setupAutofetchInterval();
    
    // Refresh is now triggered by:
    // - File watcher events (git:repository-changed)
    // - User actions
    // - The eventuallyUpdateWhenIdleAndWait function
    
    onCleanup(() => {
      if (autofetchIntervalId !== null) {
        clearInterval(autofetchIntervalId);
      }
    });
  });
  
  // React to git settings changes (skip initial run)
  createEffect(on(
    () => [gitSettings.autofetch, gitSettings.autofetchPeriod] as const,
    ([enabled, period]) => {
      // Re-setup interval when settings change
      setupAutofetchInterval();
      gitLogger.debug(`Git settings changed: autofetch=${enabled}, period=${period}s`);
    },
    { defer: true }
  ));

  // Persist state changes
  createEffect(() => {
    const persistedState = {
      activeRepositoryId: state.activeRepositoryId,
      autoDetectEnabled: state.autoDetectEnabled,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  });

  // Re-detect when workspace folders change (skip initial, wait for onMount detection)
  createEffect(on(
    () => workspace.folders(),
    (folders) => {
      // Only re-detect if initial detection is done and folders changed
      if (initialDetectionDone && state.autoDetectEnabled && folders.length > 0) {
        detectRepositories();
      }
    },
    { defer: true }
  ));

  // Derived state accessors
  const repositories = () => state.repositories;
  
  const activeRepository = createMemo(() => {
    if (!state.activeRepositoryId) return null;
    return state.repositories.find(r => r.id === state.activeRepositoryId) || null;
  });

  // Helper to make API calls - using Tauri invoke for direct communication
  async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    try {
      const cmdParts = endpoint.split('?');
      const action = cmdParts[0].substring(1).replace(/-/g, '_');
      const params = new URLSearchParams(cmdParts[1] || "");
      
      // Build invoke parameters
      let invokeParams: Record<string, unknown> = {};
      
      // Extract query params
      params.forEach((value, key) => {
        invokeParams[key] = value;
      });
      
      // Parse POST body if present
      if (options?.body) {
        try {
          const bodyData = JSON.parse(options.body as string);
          invokeParams = { ...invokeParams, ...bodyData };
        } catch (e) {
          gitLogger.error('Failed to parse request body:', e);
        }
      }

      gitLogger.debug(`apiCall git_${action}(${JSON.stringify(invokeParams).substring(0, 100)}) =>`, invokeParams);
      const result = await invoke<T>(`git_${action}`, invokeParams);
      return result;
    } catch (error) {
      gitLogger.error(`apiCall error:`, error);
      return null;
    }
  }

  // Check if a path is a git repository
  async function isGitRepository(path: string): Promise<boolean> {
    const data = await apiCall<{ isRepo: boolean }>(`/is-repo?path=${encodeURIComponent(path)}`);
    return data?.isRepo ?? false;
  }

  // Find git root for a path
  async function findGitRoot(path: string): Promise<string | null> {
    const data = await apiCall<{ root: string | null }>(`/root?path=${encodeURIComponent(path)}`);
    return data?.root ?? null;
  }

  // Fetch repository status
  async function fetchRepositoryStatus(repoPath: string): Promise<Partial<RepositoryInfo>> {
    const encodedPath = encodeURIComponent(repoPath);
    
    const [statusData, branchesData, remotesData, stashesData] = await Promise.all([
      apiCall<{
        branch: string;
        staged: GitFile[];
        unstaged: GitFile[];
        conflicts: GitFile[];
        ahead?: number;
        behind?: number;
        headSha?: string;
        isMerging?: boolean;
        isRebasing?: boolean;
      }>(`/status?path=${encodedPath}`),
      apiCall<{ branches: GitBranch[] }>(`/branches?path=${encodedPath}`),
      apiCall<{ remotes: GitRemote[] }>(`/remotes?path=${encodedPath}`),
      apiCall<{ stashes: GitStash[] }>(`/stashes?path=${encodedPath}`),
    ]);

    const result: Partial<RepositoryInfo> = {
      lastRefresh: Date.now(),
      status: "idle",
      lastError: null,
    };

    if (statusData) {
      result.branch = statusData.branch;
      result.stagedFiles = statusData.staged || [];
      result.unstagedFiles = statusData.unstaged || [];
      result.conflictFiles = statusData.conflicts || [];
      result.ahead = statusData.ahead ?? 0;
      result.behind = statusData.behind ?? 0;
      result.headSha = statusData.headSha ?? null;
      result.isMerging = statusData.isMerging ?? false;
      result.isRebasing = statusData.isRebasing ?? false;
    }

    if (branchesData) {
      result.branches = branchesData.branches || [];
    }

    if (remotesData) {
      result.remotes = remotesData.remotes || [];
    }

    if (stashesData) {
      result.stashes = stashesData.stashes || [];
    }

    return result;
  }

  // Add a repository
  const addRepository = async (path: string): Promise<boolean> => {
    const normalizedPath = normalizePath(path);
    
    // Check if already tracked
    if (state.repositories.some(r => r.id === normalizedPath)) {
      return true;
    }

    // Verify it's a git repository
    const gitRoot = await findGitRoot(normalizedPath);
    if (!gitRoot) {
      const isRepo = await isGitRepository(normalizedPath);
      if (!isRepo) {
        console.warn(`[MultiRepo] Path is not a git repository: ${normalizedPath}`);
        return false;
      }
    }

    const repoPath = gitRoot || normalizedPath;
    const normalizedRepoPath = normalizePath(repoPath);

    // Check again with resolved root
    if (state.repositories.some(r => r.id === normalizedRepoPath)) {
      return true;
    }

    // Create new repository entry
    const newRepo = createEmptyRepository(normalizedRepoPath);
    newRepo.status = "loading";

    setState(
      produce((s) => {
        s.repositories.push(newRepo);
        if (!s.activeRepositoryId) {
          s.activeRepositoryId = normalizedRepoPath;
        }
      })
    );

    // Fetch initial status
    await refreshRepository(normalizedRepoPath);

    // Dispatch event
    window.dispatchEvent(new CustomEvent("multirepo:repository-added", {
      detail: { id: normalizedRepoPath },
    }));

    return true;
  };

  // Remove a repository
  const removeRepository = (id: string) => {
    setState(
      produce((s) => {
        const index = s.repositories.findIndex(r => r.id === id);
        if (index !== -1) {
          s.repositories.splice(index, 1);
        }
        if (s.activeRepositoryId === id) {
          s.activeRepositoryId = s.repositories.length > 0 ? s.repositories[0].id : null;
        }
      })
    );

    window.dispatchEvent(new CustomEvent("multirepo:repository-removed", {
      detail: { id },
    }));
  };

  // Set active repository
  const setActiveRepository = (id: string | null) => {
    if (id === null || state.repositories.some(r => r.id === id)) {
      setState("activeRepositoryId", id);
      
      // Update legacy storage for compatibility
      if (id) {
        localStorage.setItem("projectPath", id);
      }

      window.dispatchEvent(new CustomEvent("multirepo:active-changed", {
        detail: { id },
      }));
    }
  };

  // Refresh a specific repository
  const refreshRepository = async (id: string) => {
    const repoIndex = state.repositories.findIndex(r => r.id === id);
    if (repoIndex === -1) return;

    setState("repositories", repoIndex, "status", "loading");

    try {
      const updates = await fetchRepositoryStatus(id);
      setState("repositories", repoIndex, produce((repo) => {
        Object.assign(repo, updates);
        repo.status = "idle";
      }));
    } catch (err) {
      console.error(`[MultiRepo] Failed to refresh repository: ${id}`, err);
      setState("repositories", repoIndex, produce((repo) => {
        repo.status = "error";
        repo.lastError = String(err);
      }));
    }
  };

  // Refresh all repositories
  const refreshAllRepositories = async () => {
    setState("isLoading", true);
    
    try {
      await Promise.all(state.repositories.map(repo => refreshRepository(repo.id)));
    } finally {
      setState("isLoading", false);
    }
  };

  // Detect repositories in workspace (debounced to prevent duplicate calls)
  const detectRepositories = async () => {
    if (!state.autoDetectEnabled) {
      gitLogger.debug("Auto-detect disabled, skipping");
      return;
    }

    // Prevent concurrent detection calls
    if (detectionInProgress) {
      gitLogger.debug("Detection already in progress, scheduling retry");
      detectionPending = true;
      return;
    }

    detectionInProgress = true;
    detectionPending = false;
    setState("isLoading", true);
    setState("globalError", null);

    try {
      const folders = workspace.folders();
      gitLogger.debug("Detecting repos in folders:", folders.map(f => f.path));
      
      // Detect git roots IN PARALLEL for all folders
      const gitRootResults = await Promise.all(
        folders.map(async folder => {
          const gitRoot = await findGitRoot(folder.path);
          return gitRoot ? normalizePath(gitRoot) : null;
        })
      );
      
      // Deduplicate detected repos
      const detectedRepos = [...new Set(gitRootResults.filter((r): r is string => r !== null))];

      gitLogger.debug("Detected repos:", detectedRepos);
      
      // Add newly detected repos IN PARALLEL
      const newRepos = detectedRepos.filter(repoPath => !state.repositories.some(r => r.id === repoPath));
      await Promise.all(
        newRepos.map(repoPath => {
          gitLogger.debug(`Adding repository: ${repoPath}`);
          return addRepository(repoPath);
        })
      );

      gitLogger.debug("Total repositories:", state.repositories.length, "Active:", state.activeRepositoryId);
      
      // If no active repo, or if active repo is not in the detected repos, set the first one
      const activeExists = state.activeRepositoryId && state.repositories.some(r => r.id === state.activeRepositoryId);
      if (!activeExists && state.repositories.length > 0) {
        setActiveRepository(state.repositories[0].id);
      }
    } catch (err) {
      gitLogger.error("Failed to detect repositories:", err);
      setState("globalError", String(err));
    } finally {
      setState("isLoading", false);
      detectionInProgress = false;
      
      // If another detection was requested while we were running, do it now
      if (detectionPending) {
        gitLogger.debug("Running pending detection");
        setTimeout(() => detectRepositories(), 100);
      }
    }
  };

  // Toggle auto-detection
  const setAutoDetectEnabled = (enabled: boolean) => {
    setState("autoDetectEnabled", enabled);
    if (enabled) {
      detectRepositories();
    }
  };

  // Get repository by ID
  const getRepositoryById = (id: string) => {
    return state.repositories.find(r => r.id === id);
  };

  // Get repository by path
  const getRepositoryByPath = (path: string) => {
    const normalizedPath = normalizePath(path);
    return state.repositories.find(r => r.id === normalizedPath);
  };

  // Get repository for a file
  const getRepositoryForFile = (filePath: string) => {
    const normalizedFilePath = normalizePath(filePath);
    return state.repositories.find(r => isSubPath(r.path, normalizedFilePath));
  };

  // Stage files
  const stageFiles = async (repoId: string, files: string[]) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/stage`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, files }),
    });

    await refreshRepository(repoId);
  };

  // Unstage files
  const unstageFiles = async (repoId: string, files: string[]) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/unstage`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, files }),
    });

    await refreshRepository(repoId);
  };

  // Stage all
  const stageAll = async (repoId: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/stage-all`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path }),
    });

    await refreshRepository(repoId);
  };

  // Unstage all
  const unstageAll = async (repoId: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/unstage-all`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path }),
    });

    await refreshRepository(repoId);
  };

  // Discard changes
  const discardChanges = async (repoId: string, files: string[]) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/discard`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, files }),
    });

    await refreshRepository(repoId);
  };

  // Commit
  const commit = async (repoId: string, message: string, sign?: boolean): Promise<boolean> => {
    const repo = getRepositoryById(repoId);
    if (!repo) return false;

    try {
      await invoke<string>("git_commit", { path: repo.path, message, sign });
      await refreshRepository(repoId);
      return true;
    } catch (err) {
      console.error("[MultiRepo] Commit failed:", err);
      return false;
    }
  };

  // Checkout branch
  const checkout = async (repoId: string, branch: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/checkout`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, branch }),
    });

    await refreshRepository(repoId);
  };

  // Create branch
  const createBranch = async (repoId: string, name: string, checkoutBranch: boolean = true) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/branch/create`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, name, checkout: checkoutBranch }),
    });

    await refreshRepository(repoId);
  };

  // Delete branch
  const deleteBranch = async (repoId: string, name: string, force: boolean = false) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    await apiCall(`/branch/delete`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, name, force }),
    });

    await refreshRepository(repoId);
  };

  // Merge branch
  const mergeBranch = async (repoId: string, branch: string): Promise<{ hasConflicts: boolean }> => {
    const repo = getRepositoryById(repoId);
    if (!repo) return { hasConflicts: false };

    const result = await apiCall<{ hasConflicts: boolean }>(`/merge`, {
      method: "POST",
      body: JSON.stringify({ path: repo.path, branch }),
    });

    await refreshRepository(repoId);
    return { hasConflicts: result?.hasConflicts ?? false };
  };

  // Push - uses followTagsWhenSync setting to optionally push tags
  const push = async (repoId: string, remote?: string, branch?: string, followTags?: boolean) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    // Use followTags if explicitly provided, otherwise use setting
    const useFollowTags = followTags !== undefined ? followTags : gitSettings.followTagsWhenSync;

    try {
      await invoke("git_push_with_tags", { 
        path: repo.path, 
        remote: remote ?? null, 
        branch: branch ?? null,
        followTags: useFollowTags
      });
    } catch (err) {
      console.error("[MultiRepo] Push failed:", err);
      throw err;
    }

    await refreshRepository(repoId);
  };

  // Pull with optional rebase flag
  const pullWithRebase = async (repoId: string, remote?: string, branch?: string, rebase?: boolean) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    // Use rebase if explicitly requested or if rebaseWhenSync setting is enabled
    const useRebase = rebase !== undefined ? rebase : gitSettings.rebaseWhenSync;
    
    try {
      if (useRebase) {
        gitLogger.debug(`Pulling with rebase for ${repo.name}`);
        await invoke("git_pull_rebase", { path: repo.path, remote, branch });
      } else {
        await invoke("git_pull", { path: repo.path, remote, branch });
      }
    } catch (err) {
      // Fallback to apiCall if the new invoke commands don't exist
      gitLogger.warn(`Pull invoke failed, trying apiCall:`, err);
      await apiCall(`/pull`, {
        method: "POST",
        body: JSON.stringify({ path: repo.path, remote, branch, rebase: useRebase }),
      });
    }

    await refreshRepository(repoId);
  };

  // Pull (uses rebaseWhenSync setting automatically)
  const pull = async (repoId: string, remote?: string, branch?: string) => {
    await pullWithRebase(repoId, remote, branch);
  };

  // Fetch from remote - uses pruneOnFetch and fetchTags settings
  const fetchFromRemote = async (repoId: string, remote?: string, prune?: boolean, tags?: boolean) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    // Use settings if not explicitly provided
    const usePrune = prune !== undefined ? prune : gitSettings.pruneOnFetch;
    const useTags = tags !== undefined ? tags : gitSettings.fetchTags;

    try {
      await invoke("git_fetch_with_options", { 
        path: repo.path, 
        remote: remote ?? null,
        prune: usePrune,
        tags: useTags
      });
    } catch (err) {
      gitLogger.error("Fetch failed:", err);
      throw err;
    }

    await refreshRepository(repoId);
  };

  // Execute cross-repo operation
  const executeCrossRepoOperation = async (operation: CrossRepoOperation) => {
    setState("isLoading", true);

    try {
      switch (operation) {
        case "fetch-all":
          await Promise.all(state.repositories.map(r => fetchFromRemote(r.id)));
          break;
        case "pull-all":
          await Promise.all(state.repositories.map(r => pull(r.id)));
          break;
        case "push-all":
          await Promise.all(state.repositories.map(r => push(r.id)));
          break;
        case "sync-all":
          await Promise.all(state.repositories.map(r => fetchFromRemote(r.id)));
          await Promise.all(state.repositories.map(r => pull(r.id)));
          break;
      }
    } finally {
      setState("isLoading", false);
    }
  };

  // Get summary statistics
  const getSummary = () => {
    const repos = state.repositories;
    return {
      totalRepos: repos.length,
      reposWithChanges: repos.filter(r => 
        r.stagedFiles.length > 0 || r.unstagedFiles.length > 0
      ).length,
      totalStagedFiles: repos.reduce((sum, r) => sum + r.stagedFiles.length, 0),
      totalUnstagedFiles: repos.reduce((sum, r) => sum + r.unstagedFiles.length, 0),
      totalConflicts: repos.reduce((sum, r) => sum + r.conflictFiles.length, 0),
    };
  };

  // Initialize a new git repository
  const gitInit = async (path: string): Promise<boolean> => {
    try {
      await invoke("git_init", { path });
      // Add the newly initialized repo to tracking
      const added = await addRepository(path);
      return added;
    } catch (err) {
      console.error("[MultiRepo] git init failed:", err);
      return false;
    }
  };

  // Undo the last commit (soft reset HEAD~1)
  const undoLastCommit = async (repoId: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_reset_soft", { path: repo.path, target: "HEAD~1" });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Undo last commit failed:", err);
      throw err;
    }
  };

  // Rename a branch
  const renameBranch = async (repoId: string, oldName: string, newName: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_branch_rename", { path: repo.path, oldName, newName });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Rename branch failed:", err);
      throw err;
    }
  };

  // Stage specific lines from a file
  const stageSelectedLines = async (
    repoId: string, 
    uri: string, 
    ranges: Array<{ start: number; end: number }>
  ) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_stage_lines", { path: repo.path, file: uri, ranges });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Stage selected lines failed:", err);
      throw err;
    }
  };

  // Unstage specific lines from a file
  const unstageSelectedLines = async (
    repoId: string, 
    uri: string, 
    ranges: Array<{ start: number; end: number }>
  ) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_unstage_lines", { path: repo.path, file: uri, ranges });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Unstage selected lines failed:", err);
      throw err;
    }
  };

  // Remove untracked files (git clean)
  const gitClean = async (repoId: string, paths?: string[]) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_clean", { path: repo.path, files: paths ?? null });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] git clean failed:", err);
      throw err;
    }
  };

  // Add a remote
  const addRemote = async (repoId: string, name: string, url: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_remote_add", { path: repo.path, name, url });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Add remote failed:", err);
      throw err;
    }
  };

  // Remove a remote
  const removeRemote = async (repoId: string, name: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_remote_remove", { path: repo.path, name });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Remove remote failed:", err);
      throw err;
    }
  };

  // Rename a remote
  const renameRemote = async (repoId: string, oldName: string, newName: string) => {
    const repo = getRepositoryById(repoId);
    if (!repo) return;

    try {
      await invoke("git_remote_rename", { path: repo.path, oldName, newName });
      await refreshRepository(repoId);
    } catch (err) {
      console.error("[MultiRepo] Rename remote failed:", err);
      throw err;
    }
  };
  
  // Get git sync settings accessor
  const gitSyncSettingsAccessor = () => gitSettings;
  
  // Update git sync settings
  const updateGitSyncSettings = (updates: Partial<GitSyncSettings>) => {
    setGitSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveGitSettings(newSettings);
      return newSettings;
    });
    
    // Dispatch event for settings change
    window.dispatchEvent(new CustomEvent("multirepo:git-settings-changed", {
      detail: { settings: gitSettings },
    }));
  };

  // Suppress unused warnings - these are kept for future use
  void _REFRESH_INTERVAL;
  void _eventuallyUpdateWhenIdleAndWait;
  void _executeGitOperation;

  const contextValue: MultiRepoContextValue = {
    state,
    repositories,
    activeRepository,
    addRepository,
    removeRepository,
    setActiveRepository,
    refreshRepository,
    refreshAllRepositories,
    detectRepositories,
    setAutoDetectEnabled,
    getRepositoryById,
    getRepositoryByPath,
    getRepositoryForFile,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    discardChanges,
    commit,
    checkout,
    createBranch,
    deleteBranch,
    mergeBranch,
    push,
    pull,
    fetch: fetchFromRemote,
    executeCrossRepoOperation,
    getSummary,
    gitSyncSettings: gitSyncSettingsAccessor,
    updateGitSyncSettings,
    pullWithRebase,
    gitInit,
    undoLastCommit,
    renameBranch,
    stageSelectedLines,
    unstageSelectedLines,
    gitClean,
    addRemote,
    removeRemote,
    renameRemote,
  };

  return (
    <MultiRepoContext.Provider value={contextValue}>
      {props.children}
    </MultiRepoContext.Provider>
  );
}

export function useMultiRepo(): MultiRepoContextValue {
  const ctx = useContext(MultiRepoContext);
  if (!ctx) {
    throw new Error("useMultiRepo must be used within MultiRepoProvider");
  }
  return ctx;
}
