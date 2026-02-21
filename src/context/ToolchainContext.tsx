import { createContext, useContext, ParentComponent, onMount, onCleanup, createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "../utils/workspace";

// ============================================================================
// Types
// ============================================================================

export type ToolchainKind = "node" | "python" | "rust";

export interface ToolchainInfo {
  kind: ToolchainKind;
  name: string;
  version: string;
  path: string;
  isDefault: boolean;
  extra: Record<string, string>;
}

export interface ProjectToolchains {
  node: string | null;
  python: string | null;
  rust: string | null;
}

export interface ToolchainDetectionResult {
  nodeToolchains: ToolchainInfo[];
  pythonToolchains: ToolchainInfo[];
  rustToolchains: ToolchainInfo[];
}

// ============================================================================
// State
// ============================================================================

interface ToolchainState {
  isLoading: boolean;
  error: string | null;
  nodeToolchains: ToolchainInfo[];
  pythonToolchains: ToolchainInfo[];
  rustToolchains: ToolchainInfo[];
  projectToolchains: ProjectToolchains;
  showSelector: boolean;
  selectorKind: ToolchainKind | null;
}

interface ToolchainContextValue {
  state: ToolchainState;

  // Detection
  detectAll: () => Promise<void>;
  detectNode: () => Promise<void>;
  detectPython: () => Promise<void>;
  detectRust: () => Promise<void>;
  detectProject: (projectPath: string) => Promise<void>;
  refreshToolchains: () => Promise<void>;

  // Selection
  setProjectToolchain: (kind: ToolchainKind, path: string | null) => Promise<void>;
  getProjectToolchain: (kind: ToolchainKind) => string | null;
  getActiveToolchain: (kind: ToolchainKind) => ToolchainInfo | null;

  // Environment
  getEnvForProject: (projectPath: string) => Promise<Record<string, string>>;

  // UI
  openSelector: (kind: ToolchainKind) => void;
  closeSelector: () => void;

  // Computed
  allToolchains: () => ToolchainInfo[];
  hasToolchains: () => boolean;
  getToolchainsByKind: (kind: ToolchainKind) => ToolchainInfo[];
}

const ToolchainContext = createContext<ToolchainContextValue>();

// ============================================================================
// Provider
// ============================================================================

export const ToolchainProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<ToolchainState>({
    isLoading: false,
    error: null,
    nodeToolchains: [],
    pythonToolchains: [],
    rustToolchains: [],
    projectToolchains: {
      node: null,
      python: null,
      rust: null,
    },
    showSelector: false,
    selectorKind: null,
  });

  // ============================================================================
  // Detection
  // ============================================================================

  const detectAll = async () => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const result = await invoke<ToolchainDetectionResult>("toolchain_detect_all");
      setState(produce((s) => {
        s.nodeToolchains = result.nodeToolchains;
        s.pythonToolchains = result.pythonToolchains;
        s.rustToolchains = result.rustToolchains;
      }));
    } catch (error) {
      console.error("[Toolchain] Failed to detect toolchains:", error);
      setState("error", String(error));
    } finally {
      setState("isLoading", false);
    }
  };

  const detectNode = async () => {
    try {
      const result = await invoke<ToolchainInfo[]>("toolchain_detect_node");
      setState("nodeToolchains", result);
    } catch (error) {
      console.error("[Toolchain] Failed to detect Node.js:", error);
    }
  };

  const detectPython = async () => {
    try {
      const result = await invoke<ToolchainInfo[]>("toolchain_detect_python");
      setState("pythonToolchains", result);
    } catch (error) {
      console.error("[Toolchain] Failed to detect Python:", error);
    }
  };

  const detectRust = async () => {
    try {
      const result = await invoke<ToolchainInfo[]>("toolchain_detect_rust");
      setState("rustToolchains", result);
    } catch (error) {
      console.error("[Toolchain] Failed to detect Rust:", error);
    }
  };

  const detectProject = async (projectPath: string) => {
    try {
      const result = await invoke<ProjectToolchains>("toolchain_detect_project", {
        projectPath,
      });
      setState("projectToolchains", result);
    } catch (error) {
      console.error("[Toolchain] Failed to detect project toolchains:", error);
    }
  };

  const refreshToolchains = async () => {
    try {
      await invoke("toolchain_clear_cache");
      await detectAll();

      const projectPath = getProjectPath();
      if (projectPath) {
        await detectProject(projectPath);
      }
    } catch (error) {
      console.error("[Toolchain] Failed to refresh:", error);
    }
  };

  // ============================================================================
  // Selection
  // ============================================================================

  const setProjectToolchain = async (kind: ToolchainKind, path: string | null) => {
    const projectPath = getProjectPath();
    if (!projectPath) {
      console.warn("[Toolchain] No project path set");
      return;
    }

    try {
      await invoke("toolchain_set_project", {
        projectPath,
        kind,
        toolchainPath: path,
      });

      setState(produce((s) => {
        s.projectToolchains[kind] = path;
      }));

      // Save to localStorage for persistence
      const saved = localStorage.getItem("cortex_project_toolchains") || "{}";
      const toolchains = JSON.parse(saved);
      toolchains[projectPath] = {
        ...toolchains[projectPath],
        [kind]: path,
      };
      localStorage.setItem("cortex_project_toolchains", JSON.stringify(toolchains));

      // Emit event for other components
      window.dispatchEvent(new CustomEvent("toolchain:changed", {
        detail: { kind, path, projectPath },
      }));
    } catch (error) {
      console.error("[Toolchain] Failed to set project toolchain:", error);
    }
  };

  const getProjectToolchain = (kind: ToolchainKind): string | null => {
    return state.projectToolchains[kind];
  };

  const getActiveToolchain = (kind: ToolchainKind): ToolchainInfo | null => {
    const projectPath = state.projectToolchains[kind];
    const toolchains = getToolchainsByKind(kind);

    if (projectPath) {
      return toolchains.find((t) => t.path === projectPath) || null;
    }

    // Return default toolchain if no project-specific one
    return toolchains.find((t) => t.isDefault) || toolchains[0] || null;
  };

  // ============================================================================
  // Environment
  // ============================================================================

  const getEnvForProject = async (projectPath: string): Promise<Record<string, string>> => {
    try {
      return await invoke<Record<string, string>>("toolchain_get_env_for_project", {
        projectPath,
      });
    } catch (error) {
      console.error("[Toolchain] Failed to get environment:", error);
      return {};
    }
  };

  // ============================================================================
  // UI
  // ============================================================================

  const openSelector = (kind: ToolchainKind) => {
    setState("selectorKind", kind);
    setState("showSelector", true);
  };

  const closeSelector = () => {
    setState("showSelector", false);
    setState("selectorKind", null);
  };

  // ============================================================================
  // Computed
  // ============================================================================

  const allToolchains = createMemo(() => [
    ...state.nodeToolchains,
    ...state.pythonToolchains,
    ...state.rustToolchains,
  ]);

  const hasToolchains = createMemo(() => allToolchains().length > 0);

  const getToolchainsByKind = (kind: ToolchainKind): ToolchainInfo[] => {
    switch (kind) {
      case "node":
        return state.nodeToolchains;
      case "python":
        return state.pythonToolchains;
      case "rust":
        return state.rustToolchains;
      default:
        return [];
    }
  };

  // ============================================================================
  // Initialization
  // ============================================================================

  onMount(() => {
    // Load saved project toolchains
    const loadSavedToolchains = () => {
      const projectPath = getProjectPath();
      if (projectPath) {
        const saved = localStorage.getItem("cortex_project_toolchains");
        if (saved) {
          try {
            const toolchains = JSON.parse(saved);
            if (toolchains[projectPath]) {
              setState("projectToolchains", toolchains[projectPath]);
            }
          } catch (err) {
            console.debug("[Toolchain] Parse toolchains failed:", err);
          }
        }
      }
    };

    loadSavedToolchains();

    // Initial detection
    detectAll();

    // Detect project-specific toolchains
    const projectPath = getProjectPath();
    if (projectPath) {
      detectProject(projectPath);
    }

    // Listen for project changes
    const handleProjectOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        detectProject(detail.path);
        loadSavedToolchains();
      }
    };

    const handleOpenSelector = ((e: CustomEvent) => {
      if (e.detail?.kind) {
        openSelector(e.detail.kind);
      }
    }) as EventListener;

    const handleRefresh = () => refreshToolchains();

    window.addEventListener("cortex:project-opened", handleProjectOpen);
    window.addEventListener("toolchain:open-selector", handleOpenSelector);
    window.addEventListener("toolchain:refresh", handleRefresh);

    onCleanup(() => {
      window.removeEventListener("cortex:project-opened", handleProjectOpen);
      window.removeEventListener("toolchain:open-selector", handleOpenSelector);
      window.removeEventListener("toolchain:refresh", handleRefresh);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: ToolchainContextValue = {
    state,
    detectAll,
    detectNode,
    detectPython,
    detectRust,
    detectProject,
    refreshToolchains,
    setProjectToolchain,
    getProjectToolchain,
    getActiveToolchain,
    getEnvForProject,
    openSelector,
    closeSelector,
    allToolchains,
    hasToolchains,
    getToolchainsByKind,
  };

  return (
    <ToolchainContext.Provider value={value}>
      {props.children}
    </ToolchainContext.Provider>
  );
};

export function useToolchain() {
  const ctx = useContext(ToolchainContext);
  if (!ctx) throw new Error("useToolchain must be used within ToolchainProvider");
  return ctx;
}
