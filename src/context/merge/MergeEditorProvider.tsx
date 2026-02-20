import { createContext, useContext, ParentComponent, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";
import { getProjectPath } from "@/utils/workspace";

const logger = createLogger("MergeEditor");

// ============================================================================
// Types
// ============================================================================

export interface ConflictRegion {
  id: string;
  startLine: number;
  endLine: number;
  currentContent: string;
  incomingContent: string;
  baseContent: string;
  resolution: "current" | "incoming" | "both" | "custom" | null;
  customContent?: string;
}

export interface MergeFile {
  path: string;
  conflicts: ConflictRegion[];
  originalContent: string;
  resolvedContent: string | null;
}

export interface MergeEditorState {
  isOpen: boolean;
  activeFile: MergeFile | null;
  conflictFiles: string[];
  resolvedFiles: string[];
}

type ResolutionKind = "current" | "incoming" | "both" | "custom";

interface MergeEditorContextValue {
  state: MergeEditorState;
  openMergeEditor: (filePath: string) => Promise<void>;
  closeMergeEditor: () => void;
  resolveConflict: (conflictId: string, resolution: ResolutionKind, customContent?: string) => void;
  acceptCurrent: (conflictId: string) => void;
  acceptIncoming: (conflictId: string) => void;
  acceptBoth: (conflictId: string) => void;
  abortMerge: () => Promise<void>;
  continueMerge: () => Promise<void>;
}

// ============================================================================
// Conflict Marker Parser
// ============================================================================

let conflictCounter = 0;

function nextConflictId(): string {
  conflictCounter += 1;
  return `conflict_${conflictCounter}`;
}

const MARKER_CURRENT_START = /^<{7}\s/;
const MARKER_BASE_START = /^\|{7}\s/;
const MARKER_SEPARATOR = /^={7}$/;
const MARKER_INCOMING_END = /^>{7}\s/;

function parseConflictMarkers(content: string): ConflictRegion[] {
  const lines = content.split("\n");
  const regions: ConflictRegion[] = [];

  let i = 0;
  while (i < lines.length) {
    if (!MARKER_CURRENT_START.test(lines[i])) {
      i++;
      continue;
    }

    const startLine = i;
    const currentLines: string[] = [];
    const baseLines: string[] = [];
    const incomingLines: string[] = [];

    let section: "current" | "base" | "incoming" = "current";
    let hasBase = false;
    let endLine = -1;
    let j = i + 1;

    while (j < lines.length) {
      if (MARKER_BASE_START.test(lines[j])) {
        section = "base";
        hasBase = true;
        j++;
        continue;
      }
      if (MARKER_SEPARATOR.test(lines[j])) {
        section = "incoming";
        j++;
        continue;
      }
      if (MARKER_INCOMING_END.test(lines[j])) {
        endLine = j;
        break;
      }

      switch (section) {
        case "current":
          currentLines.push(lines[j]);
          break;
        case "base":
          baseLines.push(lines[j]);
          break;
        case "incoming":
          incomingLines.push(lines[j]);
          break;
      }
      j++;
    }

    if (endLine === -1) {
      i++;
      continue;
    }

    regions.push({
      id: nextConflictId(),
      startLine,
      endLine,
      currentContent: currentLines.join("\n"),
      incomingContent: incomingLines.join("\n"),
      baseContent: hasBase ? baseLines.join("\n") : "",
      resolution: null,
    });

    i = endLine + 1;
  }

  return regions;
}

// ============================================================================
// Resolved Content Builder
// ============================================================================

function buildResolvedContent(originalContent: string, conflicts: ConflictRegion[]): string | null {
  const allResolved = conflicts.every((c) => c.resolution !== null);
  if (!allResolved) return null;

  const lines = originalContent.split("\n");
  const result: string[] = [];
  let lineIdx = 0;

  for (const conflict of conflicts) {
    while (lineIdx < conflict.startLine) {
      result.push(lines[lineIdx]);
      lineIdx++;
    }

    let resolvedText: string;
    switch (conflict.resolution) {
      case "current":
        resolvedText = conflict.currentContent;
        break;
      case "incoming":
        resolvedText = conflict.incomingContent;
        break;
      case "both":
        resolvedText = conflict.currentContent + "\n" + conflict.incomingContent;
        break;
      case "custom":
        resolvedText = conflict.customContent ?? "";
        break;
      default:
        resolvedText = "";
    }

    if (resolvedText.length > 0) {
      result.push(resolvedText);
    }

    lineIdx = conflict.endLine + 1;
  }

  while (lineIdx < lines.length) {
    result.push(lines[lineIdx]);
    lineIdx++;
  }

  return result.join("\n");
}

// ============================================================================
// Context
// ============================================================================

const MergeEditorContext = createContext<MergeEditorContextValue>();

// ============================================================================
// Provider
// ============================================================================

export const MergeEditorProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<MergeEditorState>({
    isOpen: false,
    activeFile: null,
    conflictFiles: [],
    resolvedFiles: [],
  });

  const openMergeEditor = async (filePath: string): Promise<void> => {
    try {
      const content = await invoke<string>("fs_read_file", { path: filePath });
      const conflicts = parseConflictMarkers(content);

      if (conflicts.length === 0) {
        logger.warn("No conflict markers found in", filePath);
        return;
      }

      batch(() => {
        setState("isOpen", true);
        setState("activeFile", {
          path: filePath,
          conflicts,
          originalContent: content,
          resolvedContent: null,
        });
        setState("conflictFiles", (prev) =>
          prev.includes(filePath) ? prev : [...prev, filePath]
        );
      });

      window.dispatchEvent(
        new CustomEvent("merge-editor:opened", { detail: { filePath, conflictCount: conflicts.length } })
      );
      logger.info("Opened merge editor for", filePath, `(${conflicts.length} conflicts)`);
    } catch (err) {
      logger.error("Failed to open merge editor:", err);
      throw err;
    }
  };

  const closeMergeEditor = (): void => {
    const filePath = state.activeFile?.path ?? null;

    batch(() => {
      setState("isOpen", false);
      setState("activeFile", null);
    });

    window.dispatchEvent(
      new CustomEvent("merge-editor:closed", { detail: { filePath } })
    );
    logger.info("Closed merge editor");
  };

  const resolveConflict = (conflictId: string, resolution: ResolutionKind, customContent?: string): void => {
    if (!state.activeFile) return;

    setState(produce((s) => {
      if (!s.activeFile) return;

      const conflict = s.activeFile.conflicts.find((c) => c.id === conflictId);
      if (!conflict) {
        logger.warn("Conflict not found:", conflictId);
        return;
      }

      conflict.resolution = resolution;
      if (resolution === "custom" && customContent !== undefined) {
        conflict.customContent = customContent;
      }

      s.activeFile.resolvedContent = buildResolvedContent(
        s.activeFile.originalContent,
        s.activeFile.conflicts
      );

      const allResolved = s.activeFile.conflicts.every((c) => c.resolution !== null);
      if (allResolved) {
        const filePath = s.activeFile.path;
        if (!s.resolvedFiles.includes(filePath)) {
          s.resolvedFiles.push(filePath);
        }

        window.dispatchEvent(
          new CustomEvent("merge-editor:resolved", { detail: { filePath } })
        );
        logger.info("All conflicts resolved for", filePath);
      }
    }));
  };

  const acceptCurrent = (conflictId: string): void => {
    resolveConflict(conflictId, "current");
  };

  const acceptIncoming = (conflictId: string): void => {
    resolveConflict(conflictId, "incoming");
  };

  const acceptBoth = (conflictId: string): void => {
    resolveConflict(conflictId, "both");
  };

  const abortMerge = async (): Promise<void> => {
    const repoPath = getProjectPath();
    if (!repoPath) {
      logger.error("No project path available for merge abort");
      throw new Error("No project path available");
    }

    try {
      await invoke("git_merge_abort", { path: repoPath });
      batch(() => {
        setState("isOpen", false);
        setState("activeFile", null);
        setState("conflictFiles", []);
        setState("resolvedFiles", []);
      });
      logger.info("Merge aborted");
    } catch (err) {
      logger.error("Failed to abort merge:", err);
      throw err;
    }
  };

  const continueMerge = async (): Promise<void> => {
    const repoPath = getProjectPath();
    if (!repoPath) {
      logger.error("No project path available for merge continue");
      throw new Error("No project path available");
    }

    if (state.activeFile?.resolvedContent != null) {
      try {
        await invoke("fs_write_file", {
          path: state.activeFile.path,
          content: state.activeFile.resolvedContent,
        });
      } catch (err) {
        logger.error("Failed to write resolved file:", err);
        throw err;
      }
    }

    try {
      await invoke("git_merge_continue", { path: repoPath });
      batch(() => {
        setState("isOpen", false);
        setState("activeFile", null);
        setState("conflictFiles", []);
        setState("resolvedFiles", []);
      });
      logger.info("Merge continued successfully");
    } catch (err) {
      logger.error("Failed to continue merge:", err);
      throw err;
    }
  };

  const value: MergeEditorContextValue = {
    state,
    openMergeEditor,
    closeMergeEditor,
    resolveConflict,
    acceptCurrent,
    acceptIncoming,
    acceptBoth,
    abortMerge,
    continueMerge,
  };

  return (
    <MergeEditorContext.Provider value={value}>
      {props.children}
    </MergeEditorContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useMergeEditor(): MergeEditorContextValue {
  const ctx = useContext(MergeEditorContext);
  if (!ctx) throw new Error("useMergeEditor must be used within MergeEditorProvider");
  return ctx;
}
