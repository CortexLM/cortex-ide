/**
 * Git Merge Context
 *
 * Provides merge state management throughout the application.
 * Manages conflict detection, three-way diff resolution, and merge operations.
 */

import {
  createContext,
  useContext,
  createEffect,
  ParentProps,
  onMount,
} from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "@/utils/workspace";

interface MergeConflictFile {
  path: string;
  conflictCount: number;
  hasBaseContent: boolean;
  oursLabel: string;
  theirsLabel: string;
}

interface MergeConflictRegion {
  id: string;
  index: number;
  startLine: number;
  endLine: number;
  separatorLine: number;
  baseMarkerLine?: number;
  oursContent: string[];
  theirsContent: string[];
  baseContent?: string[];
  oursLabel: string;
  theirsLabel: string;
}

interface ThreeWayDiffResult {
  filePath: string;
  conflicts: MergeConflictRegion[];
  oursFullContent: string;
  theirsFullContent: string;
  baseFullContent?: string;
  hasBaseContent: boolean;
  rawContent: string;
}

interface GitMergeState {
  isMerging: boolean;
  conflictFiles: MergeConflictFile[];
  currentFile: string | null;
  threeWayDiff: ThreeWayDiffResult | null;
  resolvedFiles: Set<string>;
  isLoading: boolean;
  error: string | null;
}

interface GitMergeContextValue {
  state: GitMergeState;

  /** Load merge conflicts from the current project */
  loadConflicts: () => Promise<void>;

  /** Select a file and load its three-way diff */
  selectFile: (filePath: string) => Promise<void>;

  /** Resolve a conflict by writing the resolved content */
  resolveConflict: (filePath: string, resolvedContent: string) => Promise<void>;

  /** Abort the current merge operation */
  abortMerge: () => Promise<void>;

  /** Refresh merge state by reloading conflicts */
  refreshState: () => Promise<void>;

  /** Check if a file has been resolved */
  isFileResolved: (filePath: string) => boolean;

  /** Get the number of resolved files */
  resolvedCount: () => number;

  /** Get the total number of conflicted files */
  totalConflicts: () => number;

  /** Check if all conflicts have been resolved */
  allResolved: () => boolean;
}

const GitMergeContext = createContext<GitMergeContextValue>();

export function GitMergeProvider(props: ParentProps) {
  const [state, setState] = createStore<GitMergeState>({
    isMerging: false,
    conflictFiles: [],
    currentFile: null,
    threeWayDiff: null,
    resolvedFiles: new Set<string>(),
    isLoading: false,
    error: null,
  });

  /** Load merge conflicts from the backend */
  const loadConflicts = async () => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const path = getProjectPath();
      if (!path) {
        setState("isMerging", false);
        setState("conflictFiles", []);
        return;
      }

      const conflicts = await invoke<MergeConflictFile[]>(
        "git_get_merge_conflicts",
        { path },
      );

      setState("isMerging", conflicts.length > 0);
      setState("conflictFiles", conflicts);
    } catch (e) {
      console.error("[GitMerge] Failed to load conflicts:", e);
      setState("error", String(e));
      setState("isMerging", false);
      setState("conflictFiles", []);
    } finally {
      setState("isLoading", false);
    }
  };

  /** Select a file and load its three-way diff data */
  const selectFile = async (filePath: string) => {
    setState("currentFile", filePath);
    setState("isLoading", true);
    setState("error", null);

    try {
      const path = getProjectPath();
      if (!path) {
        console.warn("[GitMerge] Cannot select file - no project path");
        return;
      }

      const result = await invoke<ThreeWayDiffResult>(
        "git_get_three_way_diff",
        { path, filePath },
      );

      setState("threeWayDiff", result);
    } catch (e) {
      console.error("[GitMerge] Failed to load three-way diff:", e);
      setState("error", String(e));
      setState("threeWayDiff", null);
    } finally {
      setState("isLoading", false);
    }
  };

  /** Resolve a conflict by writing resolved content and refreshing state */
  const resolveConflict = async (
    filePath: string,
    resolvedContent: string,
  ) => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const path = getProjectPath();
      if (!path) {
        console.warn("[GitMerge] Cannot resolve conflict - no project path");
        return;
      }

      await invoke("git_resolve_conflict", { path, filePath, resolvedContent });

      const updated = new Set(state.resolvedFiles);
      updated.add(filePath);
      setState("resolvedFiles", updated);

      await loadConflicts();
    } catch (e) {
      console.error("[GitMerge] Failed to resolve conflict:", e);
      setState("error", String(e));
    } finally {
      setState("isLoading", false);
    }
  };

  /** Abort the current merge and reset state */
  const abortMerge = async () => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const path = getProjectPath();
      if (!path) {
        console.warn("[GitMerge] Cannot abort merge - no project path");
        return;
      }

      await invoke("git_abort_merge", { path });

      setState("isMerging", false);
      setState("conflictFiles", []);
      setState("currentFile", null);
      setState("threeWayDiff", null);
      setState("resolvedFiles", new Set<string>());
    } catch (e) {
      console.error("[GitMerge] Failed to abort merge:", e);
      setState("error", String(e));
    } finally {
      setState("isLoading", false);
    }
  };

  /** Refresh merge state by reloading conflicts */
  const refreshState = async () => {
    await loadConflicts();
  };

  /** Check if a file has been resolved */
  const isFileResolved = (filePath: string): boolean => {
    return state.resolvedFiles.has(filePath);
  };

  /** Get the number of resolved files */
  const resolvedCount = (): number => {
    return state.resolvedFiles.size;
  };

  /** Get the total number of conflicted files */
  const totalConflicts = (): number => {
    return state.conflictFiles.length;
  };

  /** Check if all conflicts have been resolved */
  const allResolved = (): boolean => {
    return resolvedCount() === totalConflicts() && totalConflicts() > 0;
  };

  onMount(() => {
    loadConflicts();
  });

  createEffect(() => {
    const projectPath = getProjectPath();
    if (projectPath) {
      loadConflicts();
    }
  });

  return (
    <GitMergeContext.Provider
      value={{
        state,
        loadConflicts,
        selectFile,
        resolveConflict,
        abortMerge,
        refreshState,
        isFileResolved,
        resolvedCount,
        totalConflicts,
        allResolved,
      }}
    >
      {props.children}
    </GitMergeContext.Provider>
  );
}

export function useGitMerge() {
  const context = useContext(GitMergeContext);
  if (!context) {
    throw new Error("useGitMerge must be used within GitMergeProvider");
  }
  return context;
}
