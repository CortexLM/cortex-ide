import { createContext, useContext, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { createPatch } from "diff";
import { getProjectPath } from "../utils/workspace";

/**
 * Represents a single history snapshot for a file
 */
export interface HistoryEntry {
  id: string;
  filePath: string;
  timestamp: number;
  size: number;
  contentHash: string;
  trigger: HistoryTrigger;
  label?: string;
}

/**
 * What triggered the history snapshot
 */
export type HistoryTrigger = "save" | "external" | "periodic" | "manual";

/**
 * History configuration options
 */
export interface LocalHistorySettings {
  enabled: boolean;
  storagePath: string;
  maxEntriesPerFile: number;
  maxTotalSizeMB: number;
  periodicSaveIntervalMs: number;
  excludePatterns: string[];
}

/**
 * Internal state for the LocalHistory context
 */
interface LocalHistoryState {
  settings: LocalHistorySettings;
  historyByFile: Map<string, HistoryEntry[]>;
  contentCache: Map<string, string>;
  totalSizeBytes: number;
  isInitialized: boolean;
}

/**
 * Comparison result between two versions
 */
export interface VersionComparison {
  entryId: string;
  filePath: string;
  historyContent: string;
  currentContent: string;
  diff: string;
  hasChanges: boolean;
}

/**
 * Context value exposed to consumers
 */
interface LocalHistoryContextValue {
  state: LocalHistoryState;
  saveSnapshot: (filePath: string, trigger?: HistoryTrigger, label?: string) => Promise<HistoryEntry | null>;
  getHistory: (filePath: string) => HistoryEntry[];
  restoreVersion: (filePath: string, entryId: string) => Promise<boolean>;
  deleteEntry: (filePath: string, entryId: string) => Promise<boolean>;
  clearHistory: (filePath: string) => Promise<boolean>;
  clearAllHistory: () => Promise<boolean>;
  compareWithCurrent: (filePath: string, entryId: string) => Promise<VersionComparison | null>;
  getEntryContent: (filePath: string, entryId: string) => Promise<string | null>;
  updateSettings: (settings: Partial<LocalHistorySettings>) => void;
  getTotalHistorySize: () => number;
  getHistoryEntryCount: () => number;
  onFileSave: (filePath: string) => Promise<void>;
  onBeforeExternalModification: (filePath: string) => Promise<void>;
}

const LocalHistoryContext = createContext<LocalHistoryContextValue>();

const DEFAULT_SETTINGS: LocalHistorySettings = {
  enabled: true,
  storagePath: ".cortex/history",
  maxEntriesPerFile: 50,
  maxTotalSizeMB: 100,
  periodicSaveIntervalMs: 300000, // 5 minutes
  excludePatterns: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "target/**",
    "*.lock",
    "*.log",
    "*.min.js",
    "*.min.css",
  ],
};

const STORAGE_KEY = "cortex-local-history-settings";
const INDEX_FILE = "index.json";
const CONTENT_DIR = "content";

/**
 * Generate a unique ID for history entries
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a simple hash from content for deduplication
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + content.length.toString(36);
}

/**
 * Convert file path to a safe directory name
 */
function pathToSafeDir(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return btoa(normalized)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Check if a file path matches any exclude pattern
 */
function matchesExcludePattern(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  
  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\\/g, "/").toLowerCase();
    
    if (normalizedPattern.includes("**")) {
      const parts = normalizedPattern.split("**");
      if (parts.length === 2) {
        const [prefix, suffix] = parts;
        if (prefix && !normalized.includes(prefix.replace(/\/$/, ""))) continue;
        if (suffix && !normalized.endsWith(suffix.replace(/^\//, ""))) continue;
        return true;
      }
    } else if (normalizedPattern.includes("*")) {
      const regex = new RegExp(
        "^" + normalizedPattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
      );
      if (regex.test(normalized)) return true;
    } else {
      if (normalized.includes(normalizedPattern)) return true;
    }
  }
  
  return false;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format timestamp to full date/time string
 */
export function formatFullTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function LocalHistoryProvider(props: ParentProps) {
  let periodicSaveTimer: ReturnType<typeof setInterval> | null = null;
  let projectPath: string | null = null;

  const [state, setState] = createStore<LocalHistoryState>({
    settings: { ...DEFAULT_SETTINGS },
    historyByFile: new Map(),
    contentCache: new Map(),
    totalSizeBytes: 0,
    isInitialized: false,
  });

  /**
   * Get the base storage path for history
   */
  const getStorageBasePath = (): string => {
    if (projectPath) {
      return `${projectPath}/${state.settings.storagePath}`;
    }
    return state.settings.storagePath;
  };

  /**
   * Get the storage path for a specific file's history
   */
  const getFileHistoryPath = (filePath: string): string => {
    const base = getStorageBasePath();
    const safeDir = pathToSafeDir(filePath);
    return `${base}/${safeDir}`;
  };

  /**
   * Read file content using Tauri
   */
  const readFile = async (path: string): Promise<string | null> => {
    try {
      const content = await invoke<string>("fs_read_file", { path });
      return content;
    } catch (err) {
      console.debug("[LocalHistory] Read file failed:", err);
      return null;
    }
  };

  /**
   * Write file content using Tauri
   */
  const writeFile = async (path: string, content: string): Promise<boolean> => {
    try {
      await invoke("fs_write_file", { path, content });
      return true;
    } catch (err) {
      console.debug("[LocalHistory] Write file failed:", err);
      return false;
    }
  };

  /**
   * Delete a file using Tauri
   */
  const deleteFile = async (path: string): Promise<boolean> => {
    try {
      await invoke("fs_delete_file", { path });
      return true;
    } catch (err) {
      console.debug("[LocalHistory] Delete file failed:", err);
      return false;
    }
  };

  /**
   * Check if a path exists
   */
  const pathExists = async (path: string): Promise<boolean> => {
    try {
      return await invoke<boolean>("fs_exists", { path });
    } catch (err) {
      console.debug("[LocalHistory] Exists check failed:", err);
      return false;
    }
  };

  /**
   * Create directory if it doesn't exist
   */
  const ensureDirectory = async (path: string): Promise<boolean> => {
    try {
      const exists = await pathExists(path);
      if (!exists) {
        await invoke("fs_create_directory", { path });
      }
      return true;
    } catch (err) {
      console.debug("[LocalHistory] Ensure directory failed:", err);
      return false;
    }
  };

  /**
   * Load the index file for a file's history
   */
  const loadFileIndex = async (filePath: string): Promise<HistoryEntry[]> => {
    const historyPath = getFileHistoryPath(filePath);
    const indexPath = `${historyPath}/${INDEX_FILE}`;
    
    const content = await readFile(indexPath);
    if (!content) return [];
    
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.debug("[LocalHistory] Parse entries failed:", err);
      return [];
    }
  };

  /**
   * Save the index file for a file's history
   */
  const saveFileIndex = async (filePath: string, entries: HistoryEntry[]): Promise<boolean> => {
    const historyPath = getFileHistoryPath(filePath);
    await ensureDirectory(historyPath);
    await ensureDirectory(`${historyPath}/${CONTENT_DIR}`);
    
    const indexPath = `${historyPath}/${INDEX_FILE}`;
    return writeFile(indexPath, JSON.stringify(entries, null, 2));
  };

  /**
   * Load content for a specific history entry
   */
  const loadEntryContent = async (filePath: string, entry: HistoryEntry): Promise<string | null> => {
    const cacheKey = `${filePath}:${entry.id}`;
    const cached = state.contentCache.get(cacheKey);
    if (cached !== undefined) return cached;
    
    const historyPath = getFileHistoryPath(filePath);
    const contentPath = `${historyPath}/${CONTENT_DIR}/${entry.contentHash}`;
    
    const content = await readFile(contentPath);
    if (content !== null) {
      setState("contentCache", (cache) => {
        const newCache = new Map(cache);
        newCache.set(cacheKey, content);
        return newCache;
      });
    }
    
    return content;
  };

  /**
   * Save content for a history entry
   */
  const saveEntryContent = async (filePath: string, contentHash: string, content: string): Promise<boolean> => {
    const historyPath = getFileHistoryPath(filePath);
    const contentPath = `${historyPath}/${CONTENT_DIR}/${contentHash}`;
    
    const exists = await pathExists(contentPath);
    if (exists) return true;
    
    return writeFile(contentPath, content);
  };

  /**
   * Delete content file if no longer referenced
   */
  const cleanupOrphanedContent = async (filePath: string, entries: HistoryEntry[]): Promise<void> => {
    const historyPath = getFileHistoryPath(filePath);
    const contentDir = `${historyPath}/${CONTENT_DIR}`;
    
    const usedHashes = new Set(entries.map((e) => e.contentHash));
    
    try {
      const files = await invoke<Array<{ name: string }>>("fs_list_directory", { 
        path: contentDir,
        showHidden: false,
        includeIgnored: true,
      });
      
      for (const file of files) {
        if (!usedHashes.has(file.name)) {
          await deleteFile(`${contentDir}/${file.name}`);
        }
      }
    } catch (err) {
      console.debug("[LocalHistory] Clean directory failed:", err);
    }
  };

  /**
   * Enforce the maximum entries per file limit
   */
  const enforceMaxEntries = async (filePath: string, entries: HistoryEntry[]): Promise<HistoryEntry[]> => {
    if (entries.length <= state.settings.maxEntriesPerFile) {
      return entries;
    }
    
    entries.sort((a, b) => b.timestamp - a.timestamp);
    const toKeep = entries.slice(0, state.settings.maxEntriesPerFile);
    
    await cleanupOrphanedContent(filePath, toKeep);
    
    return toKeep;
  };

  /**
   * Calculate total size of all history
   */
  const calculateTotalSize = (): number => {
    let total = 0;
    state.historyByFile.forEach((entries) => {
      for (const entry of entries) {
        total += entry.size;
      }
    });
    return total;
  };

  /**
   * Save a snapshot of a file to local history
   */
  const saveSnapshot = async (
    filePath: string,
    trigger: HistoryTrigger = "manual",
    label?: string
  ): Promise<HistoryEntry | null> => {
    if (!state.settings.enabled) return null;
    if (matchesExcludePattern(filePath, state.settings.excludePatterns)) return null;
    
    const content = await readFile(filePath);
    if (content === null) return null;
    
    const contentHash = hashContent(content);
    
    const existingEntries = state.historyByFile.get(filePath) || await loadFileIndex(filePath);
    const mostRecent = existingEntries[0];
    if (mostRecent && mostRecent.contentHash === contentHash) {
      return null;
    }
    
    const entry: HistoryEntry = {
      id: generateId(),
      filePath,
      timestamp: Date.now(),
      size: new Blob([content]).size,
      contentHash,
      trigger,
      label,
    };
    
    const contentSaved = await saveEntryContent(filePath, contentHash, content);
    if (!contentSaved) return null;
    
    const newEntries = [entry, ...existingEntries];
    const trimmedEntries = await enforceMaxEntries(filePath, newEntries);
    
    const indexSaved = await saveFileIndex(filePath, trimmedEntries);
    if (!indexSaved) return null;
    
    setState("historyByFile", (map) => {
      const newMap = new Map(map);
      newMap.set(filePath, trimmedEntries);
      return newMap;
    });
    
    setState("totalSizeBytes", calculateTotalSize());
    
    const cacheKey = `${filePath}:${entry.id}`;
    setState("contentCache", (cache) => {
      const newCache = new Map(cache);
      newCache.set(cacheKey, content);
      return newCache;
    });
    
    return entry;
  };

  /**
   * Get all history entries for a file
   */
  const getHistory = (filePath: string): HistoryEntry[] => {
    return state.historyByFile.get(filePath) || [];
  };

  /**
   * Restore a file to a previous version
   */
  const restoreVersion = async (filePath: string, entryId: string): Promise<boolean> => {
    const entries = state.historyByFile.get(filePath);
    if (!entries) return false;
    
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return false;
    
    const content = await loadEntryContent(filePath, entry);
    if (content === null) return false;
    
    await saveSnapshot(filePath, "manual", "Before restore");
    
    const success = await writeFile(filePath, content);
    
    if (success) {
      window.dispatchEvent(
        new CustomEvent("local-history:restored", {
          detail: { filePath, entryId, timestamp: entry.timestamp },
        })
      );
    }
    
    return success;
  };

  /**
   * Delete a specific history entry
   */
  const deleteEntry = async (filePath: string, entryId: string): Promise<boolean> => {
    const entries = state.historyByFile.get(filePath);
    if (!entries) return false;
    
    const newEntries = entries.filter((e) => e.id !== entryId);
    
    await cleanupOrphanedContent(filePath, newEntries);
    
    const success = await saveFileIndex(filePath, newEntries);
    if (!success) return false;
    
    setState("historyByFile", (map) => {
      const newMap = new Map(map);
      if (newEntries.length === 0) {
        newMap.delete(filePath);
      } else {
        newMap.set(filePath, newEntries);
      }
      return newMap;
    });
    
    const cacheKey = `${filePath}:${entryId}`;
    setState("contentCache", (cache) => {
      const newCache = new Map(cache);
      newCache.delete(cacheKey);
      return newCache;
    });
    
    setState("totalSizeBytes", calculateTotalSize());
    
    return true;
  };

  /**
   * Clear all history for a specific file
   */
  const clearHistory = async (filePath: string): Promise<boolean> => {
    const historyPath = getFileHistoryPath(filePath);
    
    try {
      await invoke("fs_delete_directory", { path: historyPath, recursive: true });
    } catch (err) {
      console.debug("[LocalHistory] Delete history failed:", err);
    }
    
    setState("historyByFile", (map) => {
      const newMap = new Map(map);
      newMap.delete(filePath);
      return newMap;
    });
    
    setState("contentCache", (cache) => {
      const newCache = new Map(cache);
      for (const key of cache.keys()) {
        if (key.startsWith(`${filePath}:`)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    setState("totalSizeBytes", calculateTotalSize());
    
    return true;
  };

  /**
   * Clear all history for all files
   */
  const clearAllHistory = async (): Promise<boolean> => {
    const basePath = getStorageBasePath();
    
    try {
      await invoke("fs_delete_directory", { path: basePath, recursive: true });
    } catch (err) {
      console.debug("[LocalHistory] Delete all failed:", err);
    }
    
    setState("historyByFile", new Map());
    setState("contentCache", new Map());
    setState("totalSizeBytes", 0);
    
    return true;
  };

  /**
   * Compare a history entry with the current file content
   */
  const compareWithCurrent = async (
    filePath: string,
    entryId: string
  ): Promise<VersionComparison | null> => {
    const entries = state.historyByFile.get(filePath);
    if (!entries) return null;
    
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return null;
    
    const historyContent = await loadEntryContent(filePath, entry);
    if (historyContent === null) return null;
    
    const currentContent = await readFile(filePath);
    if (currentContent === null) return null;
    
    const hasChanges = historyContent !== currentContent;
    
    let diff = "";
    if (hasChanges) {
      const fileName = filePath.split("/").pop() || filePath.split("\\").pop() || filePath;
      diff = createPatch(fileName, historyContent, currentContent, "History", "Current");
    }
    
    return {
      entryId,
      filePath,
      historyContent,
      currentContent,
      diff,
      hasChanges,
    };
  };

  /**
   * Get content for a specific history entry
   */
  const getEntryContent = async (filePath: string, entryId: string): Promise<string | null> => {
    const entries = state.historyByFile.get(filePath);
    if (!entries) return null;
    
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return null;
    
    return loadEntryContent(filePath, entry);
  };

  /**
   * Update settings
   */
  const updateSettings = (settings: Partial<LocalHistorySettings>): void => {
    setState("settings", (current) => ({ ...current, ...settings }));
    saveSettingsToStorage();
    setupPeriodicSave();
  };

  /**
   * Get total history size in bytes
   */
  const getTotalHistorySize = (): number => {
    return state.totalSizeBytes;
  };

  /**
   * Get total number of history entries
   */
  const getHistoryEntryCount = (): number => {
    let count = 0;
    state.historyByFile.forEach((entries) => {
      count += entries.length;
    });
    return count;
  };

  /**
   * Hook to call when a file is saved
   */
  const onFileSave = async (filePath: string): Promise<void> => {
    await saveSnapshot(filePath, "save");
  };

  /**
   * Hook to call before external modification
   */
  const onBeforeExternalModification = async (filePath: string): Promise<void> => {
    await saveSnapshot(filePath, "external", "Before external change");
  };

  /**
   * Load settings from localStorage
   */
  const loadSettingsFromStorage = (): void => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState("settings", (current) => ({ ...current, ...parsed }));
      }
    } catch (err) {
      console.debug("[LocalHistory] Load settings failed:", err);
    }
  };

  /**
   * Save settings to localStorage
   */
  const saveSettingsToStorage = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (err) {
      console.debug("[LocalHistory] Save settings failed:", err);
    }
  };

  /**
   * Set up periodic auto-save
   */
  const setupPeriodicSave = (): void => {
    if (periodicSaveTimer) {
      clearInterval(periodicSaveTimer);
      periodicSaveTimer = null;
    }
    
    if (state.settings.enabled && state.settings.periodicSaveIntervalMs > 0) {
      periodicSaveTimer = setInterval(async () => {
        window.dispatchEvent(new CustomEvent("local-history:periodic-save"));
      }, state.settings.periodicSaveIntervalMs);
    }
  };

  /**
   * Initialize history for known open files
   */
  const initializeHistory = async (): Promise<void> => {
    const currentProject = getProjectPath();
    if (currentProject) {
      projectPath = currentProject;
    }
    
    setState("isInitialized", true);
  };

  /**
   * Load history for a file path on demand
   */
  const ensureHistoryLoaded = async (filePath: string): Promise<void> => {
    if (state.historyByFile.has(filePath)) return;
    
    const entries = await loadFileIndex(filePath);
    if (entries.length > 0) {
      setState("historyByFile", (map) => {
        const newMap = new Map(map);
        newMap.set(filePath, entries);
        return newMap;
      });
      setState("totalSizeBytes", calculateTotalSize());
    }
  };

  onMount(() => {
    loadSettingsFromStorage();
    setupPeriodicSave();
    initializeHistory();
    
    const handleFileSave = (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string }>;
      if (customEvent.detail?.path) {
        onFileSave(customEvent.detail.path);
      }
    };
    
    const handleFileOpen = async (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string }>;
      if (customEvent.detail?.path) {
        await ensureHistoryLoaded(customEvent.detail.path);
      }
    };
    
    window.addEventListener("file:saved", handleFileSave);
    window.addEventListener("file:opened", handleFileOpen);
    
    onCleanup(() => {
      if (periodicSaveTimer) {
        clearInterval(periodicSaveTimer);
        periodicSaveTimer = null;
      }
      window.removeEventListener("file:saved", handleFileSave);
      window.removeEventListener("file:opened", handleFileOpen);
    });
  });

  const value: LocalHistoryContextValue = {
    state,
    saveSnapshot,
    getHistory,
    restoreVersion,
    deleteEntry,
    clearHistory,
    clearAllHistory,
    compareWithCurrent,
    getEntryContent,
    updateSettings,
    getTotalHistorySize,
    getHistoryEntryCount,
    onFileSave,
    onBeforeExternalModification,
  };

  return (
    <LocalHistoryContext.Provider value={value}>
      {props.children}
    </LocalHistoryContext.Provider>
  );
}

export function useLocalHistory() {
  const context = useContext(LocalHistoryContext);
  if (!context) {
    throw new Error("useLocalHistory must be used within LocalHistoryProvider");
  }
  return context;
}
