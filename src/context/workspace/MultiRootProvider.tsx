import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface MultiRootFolder {
  path: string;
  name?: string;
  color?: string;
  icon?: string;
}

export interface MultiRootWorkspaceFile {
  folders: MultiRootFolder[];
  settings: Record<string, unknown>;
  perFolderSettings: Record<string, Record<string, unknown>>;
}

export interface MultiRootContextValue {
  folders: Accessor<MultiRootFolder[]>;
  workspaceFilePath: Accessor<string | null>;
  isMultiRoot: Accessor<boolean>;
  addFolder: (path: string, name?: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  saveWorkspace: (filePath: string) => Promise<void>;
  loadWorkspace: (filePath: string) => Promise<void>;
  getFolderSettings: (folderPath: string) => Record<string, unknown>;
  setFolderSettings: (folderPath: string, settings: Record<string, unknown>) => void;
  perFolderSettings: Record<string, Record<string, unknown>>;
}

// ============================================================================
// State
// ============================================================================

interface MultiRootState {
  folders: MultiRootFolder[];
  workspaceFilePath: string | null;
  perFolderSettings: Record<string, Record<string, unknown>>;
}

// ============================================================================
// Context
// ============================================================================

const MultiRootContext = createContext<MultiRootContextValue>();

const log = createLogger("MultiRoot");

// ============================================================================
// Provider
// ============================================================================

export function MultiRootProvider(props: ParentProps) {
  const [state, setState] = createStore<MultiRootState>({
    folders: [],
    workspaceFilePath: null,
    perFolderSettings: {},
  });

  const [, setLoading] = createSignal(false);

  const folders = createMemo(() => state.folders);
  const workspaceFilePath = createMemo(() => state.workspaceFilePath);
  const isMultiRoot = createMemo(() => state.folders.length > 1);

  const addFolder = async (path: string, name?: string): Promise<void> => {
    const filePath = state.workspaceFilePath;
    if (!filePath) {
      throw new Error("No workspace file loaded. Save a workspace first.");
    }
    try {
      setLoading(true);
      await invoke("multi_root_add_folder", { filePath, folderPath: path, name });
      setState(
        produce((s) => {
          const exists = s.folders.some((f) => f.path === path);
          if (!exists) {
            s.folders.push({ path, name });
          }
        }),
      );
      log.debug("Added folder:", path);
    } catch (e) {
      log.error("Failed to add folder:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const removeFolder = async (path: string): Promise<void> => {
    const filePath = state.workspaceFilePath;
    if (!filePath) {
      throw new Error("No workspace file loaded. Save a workspace first.");
    }
    try {
      setLoading(true);
      await invoke("multi_root_remove_folder", { filePath, folderPath: path });
      setState(
        produce((s) => {
          s.folders = s.folders.filter((f) => f.path !== path);
          delete s.perFolderSettings[path];
        }),
      );
      log.debug("Removed folder:", path);
    } catch (e) {
      log.error("Failed to remove folder:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const saveWorkspace = async (filePath: string): Promise<void> => {
    try {
      setLoading(true);
      const data: MultiRootWorkspaceFile = {
        folders: [...state.folders],
        settings: {},
        perFolderSettings: { ...state.perFolderSettings },
      };
      await invoke("multi_root_save_workspace", { filePath, data });
      setState("workspaceFilePath", filePath);
      log.debug("Saved workspace to:", filePath);
    } catch (e) {
      log.error("Failed to save workspace:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspace = async (filePath: string): Promise<void> => {
    try {
      setLoading(true);
      const data = await invoke<MultiRootWorkspaceFile>(
        "multi_root_load_workspace",
        { filePath },
      );
      setState({
        folders: data.folders,
        workspaceFilePath: filePath,
        perFolderSettings: data.perFolderSettings ?? {},
      });
      log.debug("Loaded workspace from:", filePath);
    } catch (e) {
      log.error("Failed to load workspace:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const getFolderSettings = (folderPath: string): Record<string, unknown> => {
    return state.perFolderSettings[folderPath] ?? {};
  };

  const setFolderSettings = (
    folderPath: string,
    settings: Record<string, unknown>,
  ): void => {
    setState("perFolderSettings", folderPath, settings);
    const filePath = state.workspaceFilePath;
    if (!filePath) {
      log.warn("No workspace file loaded; folder settings not persisted.");
      return;
    }
    invoke("multi_root_set_folder_settings", { filePath, folderPath, settings }).catch(
      (e) => {
        log.error("Failed to persist folder settings:", e);
      },
    );
  };

  const contextValue: MultiRootContextValue = {
    folders,
    workspaceFilePath,
    isMultiRoot,
    addFolder,
    removeFolder,
    saveWorkspace,
    loadWorkspace,
    getFolderSettings,
    setFolderSettings,
    get perFolderSettings() {
      return state.perFolderSettings;
    },
  };

  return (
    <MultiRootContext.Provider value={contextValue}>
      {props.children}
    </MultiRootContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useMultiRoot(): MultiRootContextValue {
  const context = useContext(MultiRootContext);
  if (!context) {
    throw new Error("useMultiRoot must be used within MultiRootProvider");
  }
  return context;
}
