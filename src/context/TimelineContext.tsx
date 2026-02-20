/**
 * Timeline Context
 *
 * Provides a system for managing file timeline snapshots:
 * - Create and restore snapshots of file content
 * - Browse timeline entries per file
 * - Compare snapshots with diff support
 * - Track disk usage and statistics
 */

import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { createLogger } from "../utils/logger";

const timelineLogger = createLogger("Timeline");

// ============================================================================
// Types
// ============================================================================

export interface TimelineEntry {
  id: string;
  filePath: string;
  timestamp: number;
  label: string | null;
  source: "autoSave" | "manualSave" | "undo" | "gitCommit" | "refactor";
  size: number;
  snapshotPath: string;
}

export interface TimelineStats {
  totalEntries: number;
  totalFiles: number;
  diskUsageBytes: number;
}

export interface DiffLine {
  kind: string;
  content: string;
}

export interface DiffResult {
  hunks: DiffLine[];
  addedLines: number;
  removedLines: number;
}

interface TimelineState {
  entries: TimelineEntry[];
  loading: boolean;
  error: string | null;
  selectedFilePath: string | null;
  stats: TimelineStats | null;
}

interface TimelineContextValue {
  state: TimelineState;
  loadEntries: (filePath: string) => Promise<void>;
  createSnapshot: (
    filePath: string,
    content: string,
    source: string,
    label?: string,
  ) => Promise<TimelineEntry>;
  restoreSnapshot: (entryId: string) => Promise<string>;
  deleteEntry: (entryId: string) => Promise<void>;
  clearFile: (filePath: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getContent: (entryId: string) => Promise<string>;
  compare: (entryIdA: string, entryIdB: string) => Promise<DiffResult>;
  setLabel: (entryId: string, label: string) => Promise<void>;
  refreshStats: () => Promise<void>;
}

const TimelineContext = createContext<TimelineContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function TimelineProvider(props: { children: JSX.Element }) {
  const [entries, setEntries] = createSignal<TimelineEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = createSignal<string | null>(
    null,
  );
  const [stats, setStats] = createSignal<TimelineStats | null>(null);

  let unlistenFn: UnlistenFn | undefined;

  onCleanup(() => {
    unlistenFn?.();
  });

  onMount(async () => {
    try {
      await invoke("timeline_init");
      timelineLogger.debug("Timeline storage initialized");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to initialize timeline:", message);
      setError(message);
    }

    try {
      unlistenFn = await listen<{ filePath?: string }>(
        "timeline:changed",
        (event) => {
          const filePath = event.payload?.filePath;
          const currentPath = selectedFilePath();
          if (filePath && currentPath && filePath === currentPath) {
            loadEntries(currentPath);
          }
          refreshStats();
        },
      );
    } catch (err) {
      timelineLogger.debug("Tauri event listener setup failed:", err);
    }
  });

  const loadEntries = async (filePath: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<TimelineEntry[]>("timeline_get_entries", {
        filePath,
      });
      setEntries(result);
      setSelectedFilePath(filePath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to load entries:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const createSnapshot = async (
    filePath: string,
    content: string,
    source: string,
    label?: string,
  ): Promise<TimelineEntry> => {
    setError(null);
    try {
      const entry = await invoke<TimelineEntry>("timeline_create_snapshot", {
        filePath,
        content,
        source,
        label: label ?? null,
      });
      if (selectedFilePath() === filePath) {
        setEntries((prev) => [entry, ...prev]);
      }
      return entry;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to create snapshot:", message);
      setError(message);
      throw err;
    }
  };

  const restoreSnapshot = async (entryId: string): Promise<string> => {
    setError(null);
    try {
      return await invoke<string>("timeline_restore_snapshot", { entryId });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to restore snapshot:", message);
      setError(message);
      throw err;
    }
  };

  const deleteEntry = async (entryId: string): Promise<void> => {
    setError(null);
    try {
      await invoke("timeline_delete_entry", { entryId });
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to delete entry:", message);
      setError(message);
      throw err;
    }
  };

  const clearFile = async (filePath: string): Promise<void> => {
    setError(null);
    try {
      await invoke("timeline_clear_file", { filePath });
      if (selectedFilePath() === filePath) {
        setEntries([]);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to clear file timeline:", message);
      setError(message);
      throw err;
    }
  };

  const clearAll = async (): Promise<void> => {
    setError(null);
    try {
      await invoke("timeline_clear_all");
      setEntries([]);
      setSelectedFilePath(null);
      setStats(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to clear all timelines:", message);
      setError(message);
      throw err;
    }
  };

  const getContent = async (entryId: string): Promise<string> => {
    setError(null);
    try {
      return await invoke<string>("timeline_get_content", { entryId });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to get content:", message);
      setError(message);
      throw err;
    }
  };

  const compare = async (
    entryIdA: string,
    entryIdB: string,
  ): Promise<DiffResult> => {
    setError(null);
    try {
      return await invoke<DiffResult>("timeline_compare", {
        entryIdA,
        entryIdB,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to compare entries:", message);
      setError(message);
      throw err;
    }
  };

  const setLabel = async (entryId: string, label: string): Promise<void> => {
    setError(null);
    try {
      await invoke("timeline_set_label", { entryId, label });
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, label } : e)),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to set label:", message);
      setError(message);
      throw err;
    }
  };

  const refreshStats = async (): Promise<void> => {
    try {
      const result = await invoke<TimelineStats>("timeline_get_stats");
      setStats(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      timelineLogger.error("Failed to refresh stats:", message);
    }
  };

  const value: TimelineContextValue = {
    get state(): TimelineState {
      return {
        entries: entries(),
        loading: loading(),
        error: error(),
        selectedFilePath: selectedFilePath(),
        stats: stats(),
      };
    },
    loadEntries,
    createSnapshot,
    restoreSnapshot,
    deleteEntry,
    clearFile,
    clearAll,
    getContent,
    compare,
    setLabel,
    refreshStats,
  };

  return (
    <TimelineContext.Provider value={value}>
      {props.children}
    </TimelineContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
}
