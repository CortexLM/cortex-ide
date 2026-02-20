import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  batch,
  createEffect,
  onMount,
  onCleanup,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { WorkspaceStateData, RecentWorkspaceBackend, WorkspaceFileDataBackend, FolderDisplayMode } from "@/types/workspace";

// ============================================================================
// Types
// ============================================================================

export interface RecentWorkspace {
  /** Unique identifier */
  id: string;
  /** Path to the workspace file (.cortex-workspace) or folder path for single-folder workspaces */
  path: string;
  /** Display name for the workspace */
  name: string;
  /** Timestamp of last opened */
  lastOpened: number;
  /** Whether this is a multi-folder workspace file */
  isWorkspaceFile: boolean;
  /** Number of folders in the workspace (for display) */
  folderCount: number;
}

export interface WorkspaceFolder {
  /** Absolute path to the folder */
  path: string;
  /** Display name for the folder */
  name: string;
  /** Custom color for the folder header */
  color?: string;
  /** Custom icon identifier */
  icon?: string;
}

export interface WorkspaceSettings {
  /** User-defined settings for the workspace */
  [key: string]: unknown;
}

export interface WorkspaceFile {
  /** Array of workspace folders */
  folders: Array<{ path: string; name?: string; color?: string; icon?: string }>;
  /** Workspace settings */
  settings: WorkspaceSettings;
}

/** VS Code .code-workspace file format */
export interface CodeWorkspaceFile {
  /** Array of workspace folders in VS Code format */
  folders: Array<{ path: string; name?: string }>;
  /** VS Code settings */
  settings?: Record<string, unknown>;
  /** VS Code extensions recommendations */
  extensions?: {
    recommendations?: string[];
    unwantedRecommendations?: string[];
  };
  /** VS Code launch configurations */
  launch?: Record<string, unknown>;
  /** VS Code tasks */
  tasks?: Record<string, unknown>;
}

/** Workspace format type */
export type WorkspaceFormat = "cortex" | "vscode";

export interface FolderGitStatus {
  folder: string;
  branch: string;
  stagedCount: number;
  unstagedCount: number;
  hasConflicts: boolean;
  ahead: number;
  behind: number;
}

export interface WorkspaceContextValue {
  /** All workspace folders */
  folders: () => WorkspaceFolder[];
  /** Path to the current workspace file (.cortex-workspace) */
  workspaceFilePath: () => string | null;
  /** Currently active/focused folder path */
  activeFolder: () => string | null;
  /** Whether any workspace is loaded */
  isWorkspaceOpen: () => boolean;
  /** Whether we have multiple folders */
  isMultiRoot: () => boolean;
  /** Workspace settings */
  settings: () => WorkspaceSettings;
  
  /** Add a folder to the workspace */
  addFolder: (path: string, name?: string) => Promise<void>;
  /** Remove a folder from the workspace */
  removeFolder: (path: string) => void;
  /** Save workspace to a .cortex-workspace file */
  saveWorkspace: (filePath?: string) => Promise<string | null>;
  /** Load a workspace from a .cortex-workspace file */
  loadWorkspace: (filePath: string) => Promise<void>;
  /** Set the display name for a folder */
  setFolderName: (path: string, name: string) => void;
  /** Set a custom color for a folder */
  setFolderColor: (path: string, color: string | undefined) => void;
  /** Set a custom icon for a folder */
  setFolderIcon: (path: string, icon: string | undefined) => void;
  /** Reorder folders by moving from one index to another */
  reorderFolders: (fromIndex: number, toIndex: number) => void;
  /** Set the active folder */
  setActiveFolder: (path: string | null) => void;
  /** Update workspace settings */
  updateSettings: (updates: Partial<WorkspaceSettings>) => void;
  /** Clear the workspace (close all folders) */
  closeWorkspace: () => void;
  /** Open folder picker and add selected folder */
  addFolderWithPicker: () => Promise<void>;
  /** Get folder by path */
  getFolderByPath: (path: string) => WorkspaceFolder | undefined;
  /** Check if a path is in the workspace */
  containsPath: (path: string) => boolean;
  /** Get the workspace folder that contains a given file path */
  getFolderForFile: (filePath: string) => WorkspaceFolder | undefined;
  /** Load a VS Code .code-workspace file */
  loadCodeWorkspace: (filePath: string) => Promise<void>;
  /** Save workspace as VS Code .code-workspace file */
  saveAsCodeWorkspace: (filePath?: string) => Promise<string | null>;
  /** Save workspace with format selection dialog */
  saveWorkspaceAs: () => Promise<string | null>;
  /** Open workspace file (auto-detects format) */
  openWorkspaceFile: () => Promise<void>;
  /** Recent workspaces list */
  recentWorkspaces: () => RecentWorkspace[];
  /** Add a workspace to recent workspaces history */
  addToRecentWorkspaces: (path: string, name: string, isWorkspaceFile?: boolean, folderCount?: number) => void;
  /** Remove a workspace from recent workspaces */
  removeFromRecentWorkspaces: (id: string) => void;
  /** Clear all recent workspaces */
  clearRecentWorkspaces: () => void;
  /** Open a recent workspace */
  openRecentWorkspace: (workspace: RecentWorkspace) => Promise<void>;
  /** Copy a file/directory across workspace folders */
  crossFolderCopy: (source: string, destination: string) => Promise<void>;
  /** Move a file/directory across workspace folders */
  crossFolderMove: (source: string, destination: string) => Promise<void>;
  /** Check if a workspace path is trusted */
  checkTrust: (workspacePath: string) => Promise<{ isTrusted: boolean; path: string }>;
  /** Set trust state for a workspace path */
  setTrust: (workspacePath: string, trusted: boolean) => Promise<void>;
  /** Aggregated git status across all workspace roots */
  aggregatedGitStatus: () => FolderGitStatus[];
  /** Refresh aggregated git status */
  refreshGitStatus: () => Promise<void>;
  /** Save workspace file via backend (atomic write) */
  saveWorkspaceViaBackend: (filePath?: string) => Promise<string | null>;
  /** Load workspace file via backend */
  loadWorkspaceViaBackend: (filePath: string) => Promise<void>;
  /** Import a VS Code .code-workspace file via backend */
  importCodeWorkspace: (filePath: string) => Promise<void>;
  /** Save workspace editor state to backend */
  saveWorkspaceState: (editorState?: WorkspaceStateData) => Promise<void>;
  /** Restore workspace editor state from backend */
  restoreWorkspaceState: () => Promise<WorkspaceStateData | null>;
  /** Load recent workspaces from backend persistent storage */
  loadRecentWorkspacesFromBackend: () => Promise<void>;
  /** Whether trust prompt dialog is open */
  isTrustPromptOpen: () => boolean;
  /** Set trust prompt dialog open state */
  setTrustPromptOpen: (open: boolean) => void;
  /** Path pending trust decision */
  pendingTrustPath: () => string | null;
  /** Set pending trust path */
  setPendingTrustPath: (path: string | null) => void;
  /** Folder display mode (relative or absolute paths) */
  folderDisplayMode: () => FolderDisplayMode;
  /** Set folder display mode */
  setFolderDisplayMode: (mode: FolderDisplayMode) => void;
  /** Drag state for folder reordering */
  dragState: () => WorkspaceDragState;
  /** Start dragging a folder */
  startDrag: (index: number) => void;
  /** Update drop target */
  updateDropTarget: (index: number | null) => void;
  /** End drag and apply reorder */
  endDrag: () => void;
  /** Path display mode per folder */
  getPathDisplayMode: (path: string) => PathDisplayMode;
  /** Toggle path display mode for a folder */
  togglePathDisplayMode: (path: string) => void;
  /** Save editor state for workspace restore */
  saveEditorState: (state: EditorRestoreState) => void;
  /** Get saved editor state */
  getEditorState: () => EditorRestoreState | null;
  /** Load recent workspaces from backend */
  loadRecentFromBackend: () => Promise<void>;
  /** Save recent workspaces to backend */
  saveRecentToBackend: () => Promise<void>;
}

export interface WorkspaceDragState {
  isDragging: boolean;
  dragIndex: number | null;
  dropIndex: number | null;
}

export type PathDisplayMode = "relative" | "absolute";

export interface EditorRestoreState {
  openFiles: string[];
  activeFile: string | null;
  editorGroups: Array<{ files: string[] }>;
}

// ============================================================================
// Predefined Folder Colors
// ============================================================================

export const FOLDER_COLORS = [
  { name: "Default", value: undefined },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function extractFolderName(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || "Folder";
}

function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  return normalizedChild.startsWith(normalizedParent + "/") || normalizedChild === normalizedParent;
}

/**
 * Get the directory containing a file path
 */
function getDirectoryPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
}

/**
 * Resolve a potentially relative path against a base directory
 */
function resolvePath(basePath: string, targetPath: string): string {
  const normalizedTarget = normalizePath(targetPath);
  
  // If path is absolute (starts with / on Unix or has drive letter on Windows)
  if (normalizedTarget.startsWith("/") || /^[A-Za-z]:/.test(normalizedTarget)) {
    return normalizedTarget;
  }
  
  // Handle relative path
  const normalizedBase = normalizePath(basePath);
  const parts = normalizedBase.split("/");
  const targetParts = normalizedTarget.split("/");
  
  for (const part of targetParts) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  
  return parts.join("/");
}

/**
 * Make a path relative to a base directory
 */
function makeRelativePath(basePath: string, targetPath: string): string {
  const normalizedBase = normalizePath(basePath);
  const normalizedTarget = normalizePath(targetPath);
  
  // If paths are on different drives (Windows), return absolute path
  if (normalizedBase[0]?.toLowerCase() !== normalizedTarget[0]?.toLowerCase() && 
      /^[A-Za-z]:/.test(normalizedBase) && /^[A-Za-z]:/.test(normalizedTarget)) {
    return normalizedTarget;
  }
  
  const baseParts = normalizedBase.split("/");
  const targetParts = normalizedTarget.split("/");
  
  // Find common prefix
  let commonLength = 0;
  while (
    commonLength < baseParts.length && 
    commonLength < targetParts.length && 
    baseParts[commonLength]?.toLowerCase() === targetParts[commonLength]?.toLowerCase()
  ) {
    commonLength++;
  }
  
  // Build relative path
  const upCount = baseParts.length - commonLength;
  const relativeParts = [...Array(upCount).fill(".."), ...targetParts.slice(commonLength)];
  
  return relativeParts.join("/") || ".";
}

/**
 * Detect workspace file format from extension
 */
function detectWorkspaceFormat(filePath: string): WorkspaceFormat {
  const normalized = normalizePath(filePath).toLowerCase();
  if (normalized.endsWith(".code-workspace")) {
    return "vscode";
  }
  return "cortex";
}

// ============================================================================
// Context
// ============================================================================

const WorkspaceContext = createContext<WorkspaceContextValue>();

import { getWindowLabel } from "@/utils/windowStorage";

const STORAGE_KEY_BASE = "cortex_workspace_state";
const RECENT_WORKSPACES_KEY = "cortex_recent_workspaces";
const MAX_RECENT_WORKSPACES = 20;

function getStorageKey(): string {
  const label = getWindowLabel();
  return label === "main" ? STORAGE_KEY_BASE : `${STORAGE_KEY_BASE}_${label}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadRecentWorkspaces(): RecentWorkspace[] {
  if (typeof localStorage === "undefined") return [];
  
  const stored = localStorage.getItem(RECENT_WORKSPACES_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map((w: Partial<RecentWorkspace> & { path: string }) => ({
          id: w.id || generateId(),
          path: w.path,
          name: w.name || extractFolderName(w.path),
          lastOpened: w.lastOpened || Date.now(),
          isWorkspaceFile: w.isWorkspaceFile || false,
          folderCount: w.folderCount || 1,
        }));
      }
    } catch {
      // Ignore parse errors
    }
  }
  return [];
}

function saveRecentWorkspaces(workspaces: RecentWorkspace[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch (e) {
    console.error("Failed to save recent workspaces:", e);
  }
}

export function WorkspaceProvider(props: ParentProps) {
  const [folders, setFolders] = createSignal<WorkspaceFolder[]>([]);
  const [workspaceFilePath, setWorkspaceFilePath] = createSignal<string | null>(null);
  const [activeFolder, setActiveFolder] = createSignal<string | null>(null);
  const [settings, setSettings] = createSignal<WorkspaceSettings>({});
  const [recentWorkspaces, setRecentWorkspaces] = createSignal<RecentWorkspace[]>([]);
  const [isTrustPromptOpen, setTrustPromptOpen] = createSignal(false);
  const [pendingTrustPath, setPendingTrustPath] = createSignal<string | null>(null);
  const [folderDisplayMode, setFolderDisplayMode] = createSignal<FolderDisplayMode>("relative");

  // Derived state
  const isWorkspaceOpen = createMemo(() => folders().length > 0);
  const isMultiRoot = createMemo(() => folders().length > 1);

  // Load persisted state on mount
  onMount(() => {
    const stored = localStorage.getItem(getStorageKey());
    if (stored) {
      try {
        const state = JSON.parse(stored) as {
          folders?: WorkspaceFolder[];
          workspaceFilePath?: string | null;
          activeFolder?: string | null;
          settings?: WorkspaceSettings;
        };
        
        batch(() => {
          if (state.folders && Array.isArray(state.folders)) {
            setFolders(state.folders);
          }
          if (state.workspaceFilePath) {
            setWorkspaceFilePath(state.workspaceFilePath);
          }
          if (state.activeFolder) {
            setActiveFolder(state.activeFolder);
          }
          if (state.settings) {
            setSettings(state.settings);
          }
        });
      } catch {
        // Ignore parse errors
      }
    }
    
    // Load recent workspaces
    const loadedRecent = loadRecentWorkspaces();
    setRecentWorkspaces(loadedRecent);
    
    // Also try loading from backend
    loadRecentFromBackend();
    
    // Also check for window-specific or legacy single project
    // Only use legacy fallback for main window - new windows should start fresh
    const label = getWindowLabel();
    const windowProject = localStorage.getItem(`cortex_current_project_${label}`);
    const legacyProject = label === "main" ? localStorage.getItem("cortex_current_project") : null;
    const projectToLoad = windowProject || legacyProject;
    if (projectToLoad && folders().length === 0) {
      addFolder(projectToLoad);
    }
    
    // Listen for project changes from other components
    const handleProjectChange = (e: CustomEvent<{ path: string }>) => {
      const newPath = e.detail.path;
      if (newPath && newPath !== ".") {
        // Clear existing folders and add the new one
        batch(() => {
          setFolders([]);
          setWorkspaceFilePath(null);
          setActiveFolder(null);
        });
        addFolder(newPath);
      }
    };
    
    window.addEventListener("workspace:open-folder", handleProjectChange as EventListener);
    
    // Also poll localStorage for changes (for compatibility with SDK's project watch)
    // Use 2000ms interval instead of 500ms to reduce CPU overhead while still being responsive
    // Use window-specific key for multi-window support (reuse label from above)
    // Only use legacy fallback for main window - new windows should not inherit main's project
    const projectKey = `cortex_current_project_${label}`;
    const getLegacyFallback = () => label === "main" ? localStorage.getItem("cortex_current_project") : null;
    let lastProject = localStorage.getItem(projectKey) || getLegacyFallback();
    const pollInterval = window.setInterval(() => {
      const currentProject = localStorage.getItem(projectKey) || getLegacyFallback();
      if (currentProject && currentProject !== "." && currentProject !== lastProject) {
        lastProject = currentProject;
        const currentFolders = folders();
        // Only update if the folder is different
        if (currentFolders.length === 0 || currentFolders[0]?.path !== currentProject.replace(/\\/g, "/")) {
          batch(() => {
            setFolders([]);
            setWorkspaceFilePath(null);
            setActiveFolder(null);
          });
          addFolder(currentProject);
        }
      }
    }, 2000);
    
    onCleanup(() => {
      window.removeEventListener("workspace:open-folder", handleProjectChange as EventListener);
      window.clearInterval(pollInterval);
    });
  });

  // Persist state changes
  createEffect(() => {
    const state = {
      folders: folders(),
      workspaceFilePath: workspaceFilePath(),
      activeFolder: activeFolder(),
      settings: settings(),
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
    
    // Also update legacy key for compatibility (and window-specific key)
    const label = getWindowLabel();
    const firstFolder = folders()[0];
    if (firstFolder) {
      localStorage.setItem("cortex_current_project", firstFolder.path);
      localStorage.setItem(`cortex_current_project_${label}`, firstFolder.path);
    } else {
      localStorage.removeItem("cortex_current_project");
      localStorage.removeItem(`cortex_current_project_${label}`);
    }
  });

  // Add a folder to the workspace
  const addFolder = async (path: string, name?: string): Promise<void> => {
    const normalizedPath = normalizePath(path);
    
    // Check if folder already exists
    if (folders().some(f => normalizePath(f.path) === normalizedPath)) {
      return;
    }

    // Verify the folder exists - skip verification if commands not available
    // The folder will be validated when actually used
    try {
      // Try to get the file tree to verify it's a valid directory
      await invoke("fs_get_file_tree", { 
        path: normalizedPath, 
        depth: 1,
        showHidden: false,
        includeIgnored: false,
      });
    } catch (err) {
      // If fs_get_file_tree fails, the path might not exist or not be a directory
      // But we'll still add it and let the file explorer handle the error
      console.warn("Could not verify folder, adding anyway:", normalizedPath, err);
    }

    const folder: WorkspaceFolder = {
      path: normalizedPath,
      name: name || extractFolderName(normalizedPath),
    };

    batch(() => {
      setFolders(prev => [...prev, folder]);
      // Set as active if it's the first folder
      if (folders().length === 0 || !activeFolder()) {
        setActiveFolder(normalizedPath);
      }
    });

    // Dispatch event for compatibility
    window.dispatchEvent(new CustomEvent("workspace:folder-added", { 
      detail: { path: normalizedPath } 
    }));
  };

  // Remove a folder from the workspace
  const removeFolder = (path: string): void => {
    const normalizedPath = normalizePath(path);
    
    batch(() => {
      setFolders(prev => prev.filter(f => normalizePath(f.path) !== normalizedPath));
      
      // Update active folder if needed
      if (activeFolder() && normalizePath(activeFolder()!) === normalizedPath) {
        const remaining = folders();
        setActiveFolder(remaining.length > 0 ? remaining[0].path : null);
      }
    });

    // Dispatch event for compatibility
    window.dispatchEvent(new CustomEvent("workspace:folder-removed", { 
      detail: { path: normalizedPath } 
    }));
  };

  // Save workspace to a .cortex-workspace file
  const saveWorkspace = async (filePath?: string): Promise<string | null> => {
    let targetPath = filePath || workspaceFilePath();
    
    if (!targetPath) {
      // Show save dialog
      const selected = await saveDialog({
        title: "Save Workspace",
        defaultPath: "workspace.cortex-workspace",
        filters: [
          { name: "Cortex Workspace", extensions: ["cortex-workspace"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      
      if (!selected) {
        return null;
      }
      targetPath = selected;
    }

    const workspaceFile: WorkspaceFile = {
      folders: folders().map(f => ({
        path: f.path,
        name: f.name !== extractFolderName(f.path) ? f.name : undefined,
        color: f.color,
        icon: f.icon,
      })),
      settings: settings(),
    };

    try {
      await invoke("fs_write_file", {
        path: targetPath,
        content: JSON.stringify(workspaceFile, null, 2),
      });
      setWorkspaceFilePath(targetPath);
      return targetPath;
    } catch (err) {
      console.error("Failed to save workspace:", err);
      throw err;
    }
  };

  // Load a workspace from a .cortex-workspace file
  const loadWorkspace = async (filePath: string): Promise<void> => {
    try {
      const content = await invoke<string>("fs_read_file", { path: filePath });
      const workspaceFile = JSON.parse(content) as WorkspaceFile;

      batch(() => {
        // Clear existing folders
        setFolders([]);
        setSettings(workspaceFile.settings || {});
        setWorkspaceFilePath(filePath);
        setActiveFolder(null);
      });

      // Add folders from workspace file
      for (const folderEntry of workspaceFile.folders || []) {
        const folder: WorkspaceFolder = {
          path: normalizePath(folderEntry.path),
          name: folderEntry.name || extractFolderName(folderEntry.path),
          color: folderEntry.color,
          icon: folderEntry.icon,
        };

        // Add folder - verification will happen when file explorer loads
        try {
          await invoke("fs_get_file_tree", { path: folder.path, depth: 1, showHidden: false, includeIgnored: false });
          setFolders(prev => [...prev, folder]);
        } catch {
          // Still add it, let file explorer show the error state
          console.warn(`Could not verify workspace folder, adding anyway: ${folder.path}`);
          setFolders(prev => [...prev, folder]);
        }
      }

      // Set first folder as active
      const loadedFolders = folders();
      if (loadedFolders.length > 0) {
        setActiveFolder(loadedFolders[0].path);
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent("workspace:loaded", { 
        detail: { filePath } 
      }));
    } catch (err) {
      console.error("Failed to load workspace:", err);
      throw err;
    }
  };

  // Set the display name for a folder
  const setFolderName = (path: string, name: string): void => {
    const normalizedPath = normalizePath(path);
    setFolders(prev => prev.map(f => 
      normalizePath(f.path) === normalizedPath 
        ? { ...f, name: name.trim() || extractFolderName(f.path) }
        : f
    ));
  };

  // Set a custom color for a folder
  const setFolderColor = (path: string, color: string | undefined): void => {
    const normalizedPath = normalizePath(path);
    setFolders(prev => prev.map(f => 
      normalizePath(f.path) === normalizedPath 
        ? { ...f, color }
        : f
    ));
  };

  // Set a custom icon for a folder
  const setFolderIcon = (path: string, icon: string | undefined): void => {
    const normalizedPath = normalizePath(path);
    setFolders(prev => prev.map(f => 
      normalizePath(f.path) === normalizedPath 
        ? { ...f, icon }
        : f
    ));
  };

  // Reorder folders by moving from one index to another
  const reorderFolders = (fromIndex: number, toIndex: number): void => {
    const currentFolders = folders();
    
    if (
      fromIndex < 0 || 
      fromIndex >= currentFolders.length || 
      toIndex < 0 || 
      toIndex >= currentFolders.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const newFolders = [...currentFolders];
    const [movedFolder] = newFolders.splice(fromIndex, 1);
    newFolders.splice(toIndex, 0, movedFolder);
    setFolders(newFolders);
  };

  // Update workspace settings
  const updateSettings = (updates: Partial<WorkspaceSettings>): void => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // Clear the workspace (close all folders)
  const closeWorkspace = (): void => {
    batch(() => {
      setFolders([]);
      setWorkspaceFilePath(null);
      setActiveFolder(null);
      setSettings({});
    });
    
    localStorage.removeItem("cortex_current_project");
    
    window.dispatchEvent(new CustomEvent("workspace:closed"));
  };

  // Open folder picker and add selected folder
  const addFolderWithPicker = async (): Promise<void> => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Add Folder to Workspace",
      });

      if (selected && typeof selected === "string") {
        await addFolder(selected);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  // Get folder by path
  const getFolderByPath = (path: string): WorkspaceFolder | undefined => {
    const normalizedPath = normalizePath(path);
    return folders().find(f => normalizePath(f.path) === normalizedPath);
  };

  // Check if a path is in the workspace
  const containsPath = (path: string): boolean => {
    const normalizedPath = normalizePath(path);
    return folders().some(f => isSubPath(f.path, normalizedPath));
  };

  // Get the workspace folder that contains a given file path
  const getFolderForFile = (filePath: string): WorkspaceFolder | undefined => {
    const normalizedFilePath = normalizePath(filePath);
    return folders().find(f => isSubPath(f.path, normalizedFilePath));
  };

  // Load a VS Code .code-workspace file
  const loadCodeWorkspace = async (filePath: string): Promise<void> => {
    try {
      const content = await invoke<string>("fs_read_file", { path: filePath });
      const codeWorkspaceFile = JSON.parse(content) as CodeWorkspaceFile;
      const workspaceDir = getDirectoryPath(filePath);

      batch(() => {
        // Clear existing folders
        setFolders([]);
        // Convert VS Code settings to our settings format (store as-is for now)
        setSettings(codeWorkspaceFile.settings as WorkspaceSettings || {});
        setWorkspaceFilePath(filePath);
        setActiveFolder(null);
      });

      // Add folders from VS Code workspace file
      for (const folderEntry of codeWorkspaceFile.folders || []) {
        // Resolve relative paths against the workspace file location
        const resolvedPath = resolvePath(workspaceDir, folderEntry.path);
        
        const folder: WorkspaceFolder = {
          path: resolvedPath,
          name: folderEntry.name || extractFolderName(resolvedPath),
        };

        // Add folder - verification will happen when file explorer loads
        try {
          await invoke("fs_get_file_tree", { path: folder.path, depth: 1, showHidden: false, includeIgnored: false });
          setFolders(prev => [...prev, folder]);
        } catch {
          // Still add it, let file explorer show the error state
          console.warn(`Could not verify workspace folder, adding anyway: ${folder.path}`);
          setFolders(prev => [...prev, folder]);
        }
      }

      // Set first folder as active
      const loadedFolders = folders();
      if (loadedFolders.length > 0) {
        setActiveFolder(loadedFolders[0].path);
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent("workspace:loaded", { 
        detail: { filePath, format: "vscode" } 
      }));
    } catch (err) {
      console.error("Failed to load VS Code workspace:", err);
      throw err;
    }
  };

  // Save workspace as VS Code .code-workspace file
  const saveAsCodeWorkspace = async (filePath?: string): Promise<string | null> => {
    let targetPath = filePath;
    
    if (!targetPath) {
      // Show save dialog
      const selected = await saveDialog({
        title: "Save Workspace As VS Code Format",
        defaultPath: "workspace.code-workspace",
        filters: [
          { name: "VS Code Workspace", extensions: ["code-workspace"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      
      if (!selected) {
        return null;
      }
      targetPath = selected;
    }

    const workspaceDir = getDirectoryPath(targetPath);
    
    // Build VS Code workspace file with relative paths
    const codeWorkspaceFile: CodeWorkspaceFile = {
      folders: folders().map(f => {
        const relativePath = makeRelativePath(workspaceDir, f.path);
        return {
          path: relativePath,
          // Only include name if it's different from folder name
          ...(f.name !== extractFolderName(f.path) ? { name: f.name } : {}),
        };
      }),
      settings: settings() as Record<string, unknown>,
    };

    try {
      await invoke("fs_write_file", {
        path: targetPath,
        content: JSON.stringify(codeWorkspaceFile, null, 2),
      });
      return targetPath;
    } catch (err) {
      console.error("Failed to save VS Code workspace:", err);
      throw err;
    }
  };

  // Save workspace with format selection dialog
  const saveWorkspaceAs = async (): Promise<string | null> => {
    // Show save dialog with both format options
    const selected = await saveDialog({
      title: "Save Workspace As",
      defaultPath: "workspace.cortex-workspace",
      filters: [
        { name: "Cortex Workspace", extensions: ["cortex-workspace"] },
        { name: "VS Code Workspace", extensions: ["code-workspace"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    
    if (!selected) {
      return null;
    }

    // Detect format from selected file extension
    const format = detectWorkspaceFormat(selected);
    
    if (format === "vscode") {
      return saveAsCodeWorkspace(selected);
    } else {
      return saveWorkspace(selected);
    }
  };

  // Open workspace file (auto-detects format)
  const openWorkspaceFile = async (): Promise<void> => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        title: "Open Workspace",
        filters: [
          { name: "Workspace Files", extensions: ["cortex-workspace", "code-workspace"] },
          { name: "Cortex Workspace", extensions: ["cortex-workspace"] },
          { name: "VS Code Workspace", extensions: ["code-workspace"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!selected || typeof selected !== "string") {
        return;
      }

      // Detect format and load accordingly
      const format = detectWorkspaceFormat(selected);
      
      if (format === "vscode") {
        await loadCodeWorkspace(selected);
      } else {
        await loadWorkspace(selected);
      }
    } catch (err) {
      console.error("Failed to open workspace file:", err);
      throw err;
    }
  };

  // Add workspace to recent workspaces history
  const addToRecentWorkspaces = (
    path: string,
    name: string,
    isWorkspaceFile: boolean = false,
    folderCount: number = 1
  ): void => {
    const normalizedPath = normalizePath(path);
    
    setRecentWorkspaces(prev => {
      // Check if already exists
      const existingIndex = prev.findIndex(
        w => normalizePath(w.path) === normalizedPath
      );
      
      let updated: RecentWorkspace[];
      
      if (existingIndex !== -1) {
        // Update existing entry
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          name,
          lastOpened: Date.now(),
          isWorkspaceFile,
          folderCount,
        };
        // Move to front
        const [item] = updated.splice(existingIndex, 1);
        updated.unshift(item);
      } else {
        // Add new entry
        const newWorkspace: RecentWorkspace = {
          id: generateId(),
          path: normalizedPath,
          name,
          lastOpened: Date.now(),
          isWorkspaceFile,
          folderCount,
        };
        updated = [newWorkspace, ...prev];
        
        // Trim to max size
        if (updated.length > MAX_RECENT_WORKSPACES) {
          updated = updated.slice(0, MAX_RECENT_WORKSPACES);
        }
      }
      
      // Persist
      saveRecentWorkspaces(updated);
      // Also persist to backend
      saveRecentToBackend();
      return updated;
    });
  };

  // Remove workspace from recent workspaces
  const removeFromRecentWorkspaces = (id: string): void => {
    setRecentWorkspaces(prev => {
      const updated = prev.filter(w => w.id !== id);
      saveRecentWorkspaces(updated);
      return updated;
    });
  };

  // Clear all recent workspaces
  const clearRecentWorkspaces = (): void => {
    setRecentWorkspaces([]);
    saveRecentWorkspaces([]);
  };

  // Open a recent workspace
  const openRecentWorkspace = async (workspace: RecentWorkspace): Promise<void> => {
    try {
      if (workspace.isWorkspaceFile) {
        // Load workspace file (auto-detect format)
        const format = detectWorkspaceFormat(workspace.path);
        if (format === "vscode") {
          await loadCodeWorkspace(workspace.path);
        } else {
          await loadWorkspace(workspace.path);
        }
      } else {
        // Single folder - clear workspace and add folder
        batch(() => {
          setFolders([]);
          setWorkspaceFilePath(null);
          setActiveFolder(null);
        });
        await addFolder(workspace.path, workspace.name);
      }
      
      // Update timestamp in recent list
      addToRecentWorkspaces(
        workspace.path,
        workspace.name,
        workspace.isWorkspaceFile,
        workspace.folderCount
      );
    } catch (err) {
      console.error("Failed to open recent workspace:", err);
      throw err;
    }
  };

  // Git status signal
  const [aggregatedGitStatus, setAggregatedGitStatus] = createSignal<FolderGitStatus[]>([]);

  // Drag-and-drop state
  const [dragState, setDragState] = createSignal<WorkspaceDragState>({
    isDragging: false,
    dragIndex: null,
    dropIndex: null,
  });

  // Path display mode per folder
  const [pathDisplayModes, setPathDisplayModes] = createSignal<Record<string, PathDisplayMode>>({});

  // Editor restore state
  const [editorRestoreState, setEditorRestoreState] = createSignal<EditorRestoreState | null>(null);

  const startDrag = (index: number): void => {
    setDragState({ isDragging: true, dragIndex: index, dropIndex: null });
  };

  const updateDropTarget = (index: number | null): void => {
    setDragState(prev => ({ ...prev, dropIndex: index }));
  };

  const endDrag = (): void => {
    const state = dragState();
    if (state.dragIndex !== null && state.dropIndex !== null && state.dragIndex !== state.dropIndex) {
      reorderFolders(state.dragIndex, state.dropIndex);
    }
    setDragState({ isDragging: false, dragIndex: null, dropIndex: null });
  };

  const getPathDisplayMode = (path: string): PathDisplayMode => {
    return pathDisplayModes()[normalizePath(path)] || "absolute";
  };

  const togglePathDisplayMode = (path: string): void => {
    const normalizedPath = normalizePath(path);
    setPathDisplayModes(prev => ({
      ...prev,
      [normalizedPath]: prev[normalizedPath] === "relative" ? "absolute" : "relative",
    }));
  };

  const saveEditorState = (state: EditorRestoreState): void => {
    setEditorRestoreState(state);
    try {
      const key = `${getStorageKey()}_editor_state`;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save editor state:", e);
    }
  };

  const getEditorState = (): EditorRestoreState | null => {
    const cached = editorRestoreState();
    if (cached) return cached;
    try {
      const key = `${getStorageKey()}_editor_state`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as EditorRestoreState;
        setEditorRestoreState(parsed);
        return parsed;
      }
    } catch {
      // Ignore
    }
    return null;
  };

  const loadRecentFromBackend = async (): Promise<void> => {
    try {
      const entries = await invoke<Array<{
        id: string;
        path: string;
        name: string;
        lastOpened: number;
        isWorkspaceFile: boolean;
        folderCount: number;
      }>>("workspace_get_recent");
      setRecentWorkspaces(entries.map(e => ({
        id: e.id,
        path: e.path,
        name: e.name,
        lastOpened: e.lastOpened,
        isWorkspaceFile: e.isWorkspaceFile,
        folderCount: e.folderCount,
      })));
    } catch (err) {
      console.debug("Failed to load recent workspaces from backend:", err);
    }
  };

  const saveRecentToBackend = async (): Promise<void> => {
    try {
      const entries = recentWorkspaces().map(w => ({
        id: w.id,
        path: w.path,
        name: w.name,
        lastOpened: w.lastOpened,
        isWorkspaceFile: w.isWorkspaceFile,
        folderCount: w.folderCount,
      }));
      await invoke("workspace_save_recent", { entries });
    } catch (err) {
      console.debug("Failed to save recent workspaces to backend:", err);
    }
  };

  // Copy a file/directory across workspace folders
  const crossFolderCopy = async (source: string, destination: string): Promise<void> => {
    try {
      await invoke("workspace_cross_folder_copy", {
        source,
        destination,
        roots: folders().map(f => f.path),
      });
    } catch (err) {
      console.error("Failed to copy across workspace folders:", err);
      throw err;
    }
  };

  // Move a file/directory across workspace folders
  const crossFolderMove = async (source: string, destination: string): Promise<void> => {
    try {
      await invoke("workspace_cross_folder_move", {
        source,
        destination,
        roots: folders().map(f => f.path),
      });
    } catch (err) {
      console.error("Failed to move across workspace folders:", err);
      throw err;
    }
  };

  // Check if a workspace path is trusted
  const checkTrust = async (workspacePath: string): Promise<{ isTrusted: boolean; path: string }> => {
    try {
      return await invoke<{ isTrusted: boolean; path: string }>("workspace_trust_check", {
        workspacePath,
      });
    } catch (err) {
      console.error("Failed to check workspace trust:", err);
      throw err;
    }
  };

  // Set trust state for a workspace path
  const setTrust = async (workspacePath: string, trusted: boolean): Promise<void> => {
    try {
      await invoke("workspace_trust_set", {
        workspacePath,
        trusted,
      });
    } catch (err) {
      console.error("Failed to set workspace trust:", err);
      throw err;
    }
  };

  // Refresh aggregated git status across all workspace roots
  const refreshGitStatus = async (): Promise<void> => {
    try {
      const status = await invoke<FolderGitStatus[]>("workspace_aggregate_git_status", {
        roots: folders().map(f => f.path),
      });
      setAggregatedGitStatus(status);
    } catch (err) {
      console.error("Failed to refresh aggregated git status:", err);
      throw err;
    }
  };

  const saveWorkspaceViaBackend = async (filePath?: string): Promise<string | null> => {
    let targetPath = filePath || workspaceFilePath();
    if (!targetPath) {
      const selected = await saveDialog({
        title: "Save Workspace",
        defaultPath: "workspace.cortex-workspace",
        filters: [
          { name: "Cortex Workspace", extensions: ["cortex-workspace"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!selected) return null;
      targetPath = selected;
    }

    const data = {
      folders: folders().map(f => ({
        path: f.path,
        name: f.name !== extractFolderName(f.path) ? f.name : undefined,
        color: f.color,
        icon: f.icon,
      })),
      settings: settings(),
    };

    try {
      await invoke("save_workspace_file", { filePath: targetPath, data });
      setWorkspaceFilePath(targetPath);
      return targetPath;
    } catch (err) {
      console.error("Failed to save workspace via backend:", err);
      throw err;
    }
  };

  const loadWorkspaceViaBackend = async (filePath: string): Promise<void> => {
    try {
      const data = await invoke<WorkspaceFileDataBackend>("load_workspace_file", { filePath });
      batch(() => {
        setFolders([]);
        setSettings(data.settings as WorkspaceSettings || {});
        setWorkspaceFilePath(filePath);
        setActiveFolder(null);
      });

      for (const folderEntry of data.folders || []) {
        const folder: WorkspaceFolder = {
          path: normalizePath(folderEntry.path),
          name: folderEntry.name || extractFolderName(folderEntry.path),
          color: folderEntry.color,
          icon: folderEntry.icon,
        };
        setFolders(prev => [...prev, folder]);
      }

      const loadedFolders = folders();
      if (loadedFolders.length > 0) {
        setActiveFolder(loadedFolders[0].path);
      }
    } catch (err) {
      console.error("Failed to load workspace via backend:", err);
      throw err;
    }
  };

  const importCodeWorkspaceViaBackend = async (filePath: string): Promise<void> => {
    try {
      const data = await invoke<WorkspaceFileDataBackend>("import_code_workspace", { filePath });
      batch(() => {
        setFolders([]);
        setSettings(data.settings as WorkspaceSettings || {});
        setWorkspaceFilePath(filePath);
        setActiveFolder(null);
      });

      for (const folderEntry of data.folders || []) {
        const folder: WorkspaceFolder = {
          path: normalizePath(folderEntry.path),
          name: folderEntry.name || extractFolderName(folderEntry.path),
          color: folderEntry.color,
          icon: folderEntry.icon,
        };
        setFolders(prev => [...prev, folder]);
      }

      const loadedFolders = folders();
      if (loadedFolders.length > 0) {
        setActiveFolder(loadedFolders[0].path);
      }
    } catch (err) {
      console.error("Failed to import code workspace:", err);
      throw err;
    }
  };

  const saveWorkspaceStateToBackend = async (editorState?: WorkspaceStateData): Promise<void> => {
    const wsPath = workspaceFilePath() || folders()[0]?.path;
    if (!wsPath) return;
    const workspaceId = btoa(wsPath).replace(/[/+=]/g, "_");
    const state = editorState || { openEditors: [], activeEditor: null, layout: null, scrollPositions: {} };
    try {
      await invoke("save_workspace_state", { workspaceId, state });
    } catch (err) {
      console.error("Failed to save workspace state:", err);
    }
  };

  const restoreWorkspaceStateFromBackend = async (): Promise<WorkspaceStateData | null> => {
    const wsPath = workspaceFilePath() || folders()[0]?.path;
    if (!wsPath) return null;
    const workspaceId = btoa(wsPath).replace(/[/+=]/g, "_");
    try {
      const state = await invoke<WorkspaceStateData | null>("restore_workspace_state", { workspaceId });
      return state;
    } catch (err) {
      console.error("Failed to restore workspace state:", err);
      return null;
    }
  };

  const loadRecentWorkspacesFromBackend = async (): Promise<void> => {
    try {
      const entries = await invoke<RecentWorkspaceBackend[]>("get_recent_workspaces");
      const mapped: RecentWorkspace[] = entries.map(e => ({
        id: generateId(),
        path: e.path,
        name: e.name,
        lastOpened: e.lastOpened,
        isWorkspaceFile: e.isWorkspaceFile,
        folderCount: e.folderCount,
      }));
      setRecentWorkspaces(prev => {
        const existingPaths = new Set(prev.map(w => normalizePath(w.path)));
        const newOnes = mapped.filter(w => !existingPaths.has(normalizePath(w.path)));
        return [...prev, ...newOnes].sort((a, b) => b.lastOpened - a.lastOpened).slice(0, MAX_RECENT_WORKSPACES);
      });
    } catch (err) {
      console.error("Failed to load recent workspaces from backend:", err);
    }
  };

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Signal getters and functions are stable references, so we can create this object once
  // Using a constant object that never changes reference
  const contextValue: WorkspaceContextValue = {
    folders,
    workspaceFilePath,
    activeFolder,
    isWorkspaceOpen,
    isMultiRoot,
    settings,
    recentWorkspaces,
    addFolder,
    removeFolder,
    saveWorkspace,
    loadWorkspace,
    setFolderName,
    setFolderColor,
    setFolderIcon,
    reorderFolders,
    setActiveFolder,
    updateSettings,
    closeWorkspace,
    addFolderWithPicker,
    getFolderByPath,
    containsPath,
    getFolderForFile,
    loadCodeWorkspace,
    saveAsCodeWorkspace,
    saveWorkspaceAs,
    openWorkspaceFile,
    addToRecentWorkspaces,
    removeFromRecentWorkspaces,
    clearRecentWorkspaces,
    openRecentWorkspace,
    crossFolderCopy,
    crossFolderMove,
    checkTrust,
    setTrust,
    aggregatedGitStatus,
    refreshGitStatus,
    saveWorkspaceViaBackend,
    loadWorkspaceViaBackend,
    importCodeWorkspace: importCodeWorkspaceViaBackend,
    saveWorkspaceState: saveWorkspaceStateToBackend,
    restoreWorkspaceState: restoreWorkspaceStateFromBackend,
    loadRecentWorkspacesFromBackend,
    isTrustPromptOpen,
    setTrustPromptOpen,
    pendingTrustPath,
    setPendingTrustPath,
    folderDisplayMode,
    setFolderDisplayMode,
    dragState,
    startDrag,
    updateDropTarget,
    endDrag,
    getPathDisplayMode,
    togglePathDisplayMode,
    saveEditorState,
    getEditorState,
    loadRecentFromBackend,
    saveRecentToBackend,
  };

  // In SolidJS, the Provider value should be a stable reference.
  // Since all our signal accessors and functions are already stable,
  // we can pass contextValue directly without concern for reference changes
  // triggering re-renders (SolidJS tracks signal reads, not object identity).
  return (
    <WorkspaceContext.Provider value={contextValue}>
      {props.children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}