/**
 * =============================================================================
 * LAYOUT STORE - Centralized state management for IDE layout
 * =============================================================================
 * 
 * This store manages all layout state including:
 * - Panel dimensions and positions
 * - Collapse/expand states
 * - Docking positions
 * - Split view configurations
 * 
 * Uses SolidJS stores for fine-grained reactivity and optimal performance.
 * =============================================================================
 */

import { createStore, produce } from "solid-js/store";
import { createEffect, batch } from "solid-js";

// =============================================================================
// TYPES
// =============================================================================

export type DockPosition = "left" | "right" | "bottom" | "floating";
export type SplitOrientation = "horizontal" | "vertical";

export interface PanelState {
  id: string;
  title: string;
  
  // Dimensions
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  
  // States
  isCollapsed: boolean;
  isMaximized: boolean;
  isVisible: boolean;
  
  // Docking
  dockPosition: DockPosition;
  order: number;
  
  // Floating panel position (when dockPosition is "floating")
  floatingX?: number;
  floatingY?: number;
}

export interface SplitState {
  id: string;
  orientation: SplitOrientation;
  ratio: number; // 0-1, represents the position of the divider
  panelIds: [string, string];
}

export interface LayoutState {
  panels: Record<string, PanelState>;
  splits: Record<string, SplitState>;
  activePanel: string | null;
  focusedPanel: string | null;
  
  // Global layout settings
  sidebarPosition: "left" | "right";
  activityBarPosition: "side" | "top" | "hidden";
  panelPosition: "bottom" | "left" | "right";
  
  // Zen mode
  zenMode: boolean;
  
  // View mode
  viewMode: "ide" | "vibe";
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_PANEL_CONFIG: Omit<PanelState, "id" | "title" | "dockPosition"> = {
  width: 260,
  height: 200,
  minWidth: 160,
  minHeight: 100,
  maxWidth: 600,
  maxHeight: 800,
  isCollapsed: false,
  isMaximized: false,
  isVisible: true,
  order: 0,
};

const INITIAL_STATE: LayoutState = {
  panels: {},
  splits: {},
  activePanel: null,
  focusedPanel: null,
  sidebarPosition: "left",
  activityBarPosition: "side",
  panelPosition: "bottom",
  zenMode: false,
  viewMode: "ide",
};

// =============================================================================
// STORAGE KEYS
// =============================================================================

const STORAGE_PREFIX = "orion_layout_";

function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

// =============================================================================
// STORE CREATION
// =============================================================================

function loadPersistedState(): Partial<LayoutState> {
  try {
    const stored = localStorage.getItem(getStorageKey("state"));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load layout state:", e);
  }
  return {};
}

function mergeWithDefaults(persisted: Partial<LayoutState>): LayoutState {
  return {
    ...INITIAL_STATE,
    ...persisted,
    panels: {
      ...INITIAL_STATE.panels,
      ...persisted.panels,
    },
    splits: {
      ...INITIAL_STATE.splits,
      ...persisted.splits,
    },
  };
}

// Create the store
const persistedState = loadPersistedState();
const [layoutState, setLayoutState] = createStore<LayoutState>(
  mergeWithDefaults(persistedState)
);

// =============================================================================
// PERSISTENCE
// =============================================================================

let persistTimeout: ReturnType<typeof setTimeout> | null = null;

function persistState() {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      localStorage.setItem(getStorageKey("state"), JSON.stringify(layoutState));
    } catch (e) {
      console.warn("Failed to persist layout state:", e);
    }
  }, 100);
}

// Auto-persist on changes
createEffect(() => {
  // Track all state changes
  JSON.stringify(layoutState);
  persistState();
});

// =============================================================================
// PANEL ACTIONS
// =============================================================================

export const layoutActions = {
  /**
   * Register a new panel
   */
  registerPanel: (
    id: string,
    title: string,
    dockPosition: DockPosition,
    config?: Partial<PanelState>
  ) => {
    setLayoutState(produce((state) => {
      if (!state.panels[id]) {
        state.panels[id] = {
          ...DEFAULT_PANEL_CONFIG,
          ...config,
          id,
          title,
          dockPosition,
        };
      }
    }));
  },

  /**
   * Unregister a panel
   */
  unregisterPanel: (id: string) => {
    setLayoutState(produce((state) => {
      delete state.panels[id];
    }));
  },

  /**
   * Resize a panel
   */
  resizePanel: (id: string, dimension: "width" | "height", value: number) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        const minKey = dimension === "width" ? "minWidth" : "minHeight";
        const maxKey = dimension === "width" ? "maxWidth" : "maxHeight";
        panel[dimension] = Math.max(panel[minKey], Math.min(panel[maxKey], value));
      }
    }));
  },

  /**
   * Resize panel by delta (useful for drag operations)
   */
  resizePanelByDelta: (id: string, dimension: "width" | "height", delta: number) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        const minKey = dimension === "width" ? "minWidth" : "minHeight";
        const maxKey = dimension === "width" ? "maxWidth" : "maxHeight";
        const newValue = panel[dimension] + delta;
        panel[dimension] = Math.max(panel[minKey], Math.min(panel[maxKey], newValue));
      }
    }));
  },

  /**
   * Toggle panel collapse state
   */
  toggleCollapse: (id: string) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        panel.isCollapsed = !panel.isCollapsed;
        // If collapsing and this is the active panel, clear active
        if (panel.isCollapsed && state.activePanel === id) {
          state.activePanel = null;
        }
      }
    }));
  },

  /**
   * Set panel collapse state directly
   */
  setCollapsed: (id: string, collapsed: boolean) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        panel.isCollapsed = collapsed;
        if (collapsed && state.activePanel === id) {
          state.activePanel = null;
        }
      }
    }));
  },

  /**
   * Toggle panel maximize state
   */
  toggleMaximize: (id: string) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        panel.isMaximized = !panel.isMaximized;
      }
    }));
  },

  /**
   * Set panel visibility
   */
  setVisible: (id: string, visible: boolean) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        panel.isVisible = visible;
      }
    }));
  },

  /**
   * Set panel dock position
   */
  setDockPosition: (id: string, position: DockPosition) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        panel.dockPosition = position;
      }
    }));
  },

  /**
   * Set active panel
   */
  setActivePanel: (id: string | null) => {
    setLayoutState("activePanel", id);
  },

  /**
   * Set focused panel
   */
  setFocusedPanel: (id: string | null) => {
    setLayoutState("focusedPanel", id);
  },

  /**
   * Update floating panel position
   */
  setFloatingPosition: (id: string, x: number, y: number) => {
    setLayoutState(produce((state) => {
      const panel = state.panels[id];
      if (panel) {
        panel.floatingX = x;
        panel.floatingY = y;
      }
    }));
  },
};

// =============================================================================
// SPLIT ACTIONS
// =============================================================================

export const splitActions = {
  /**
   * Create a split view
   */
  createSplit: (
    id: string,
    orientation: SplitOrientation,
    panelIds: [string, string],
    ratio: number = 0.5
  ) => {
    setLayoutState(produce((state) => {
      state.splits[id] = {
        id,
        orientation,
        ratio,
        panelIds,
      };
    }));
  },

  /**
   * Remove a split view
   */
  removeSplit: (id: string) => {
    setLayoutState(produce((state) => {
      delete state.splits[id];
    }));
  },

  /**
   * Update split ratio
   */
  setSplitRatio: (id: string, ratio: number) => {
    setLayoutState(produce((state) => {
      const split = state.splits[id];
      if (split) {
        split.ratio = Math.max(0.1, Math.min(0.9, ratio));
      }
    }));
  },

  /**
   * Update split ratio by delta
   */
  setSplitRatioByDelta: (id: string, delta: number) => {
    setLayoutState(produce((state) => {
      const split = state.splits[id];
      if (split) {
        const newRatio = split.ratio + delta;
        split.ratio = Math.max(0.1, Math.min(0.9, newRatio));
      }
    }));
  },
};

// =============================================================================
// GLOBAL LAYOUT ACTIONS
// =============================================================================

export const globalLayoutActions = {
  /**
   * Set sidebar position
   */
  setSidebarPosition: (position: "left" | "right") => {
    setLayoutState("sidebarPosition", position);
  },

  /**
   * Set activity bar position
   */
  setActivityBarPosition: (position: "side" | "top" | "hidden") => {
    setLayoutState("activityBarPosition", position);
  },

  /**
   * Set panel position
   */
  setPanelPosition: (position: "bottom" | "left" | "right") => {
    setLayoutState("panelPosition", position);
  },

  /**
   * Toggle zen mode
   */
  toggleZenMode: () => {
    setLayoutState("zenMode", !layoutState.zenMode);
  },

  /**
   * Set zen mode
   */
  setZenMode: (enabled: boolean) => {
    setLayoutState("zenMode", enabled);
  },

  /**
   * Set view mode
   */
  setViewMode: (mode: "ide" | "vibe") => {
    setLayoutState("viewMode", mode);
  },

  /**
   * Toggle view mode
   */
  toggleViewMode: () => {
    setLayoutState("viewMode", layoutState.viewMode === "ide" ? "vibe" : "ide");
  },

  /**
   * Reset layout to defaults
   */
  resetLayout: () => {
    batch(() => {
      setLayoutState(INITIAL_STATE);
      localStorage.removeItem(getStorageKey("state"));
    });
  },
};

// =============================================================================
// SELECTORS
// =============================================================================

export const layoutSelectors = {
  /**
   * Get panel by ID
   */
  getPanel: (id: string): PanelState | undefined => layoutState.panels[id],

  /**
   * Get all panels by dock position
   */
  getPanelsByPosition: (position: DockPosition): PanelState[] => {
    return Object.values(layoutState.panels)
      .filter((panel) => panel.dockPosition === position && panel.isVisible)
      .sort((a, b) => a.order - b.order);
  },

  /**
   * Get visible panels
   */
  getVisiblePanels: (): PanelState[] => {
    return Object.values(layoutState.panels).filter((panel) => panel.isVisible);
  },

  /**
   * Get active panel
   */
  getActivePanel: (): PanelState | undefined => {
    return layoutState.activePanel ? layoutState.panels[layoutState.activePanel] : undefined;
  },

  /**
   * Check if any panel is maximized
   */
  hasMaximizedPanel: (): boolean => {
    return Object.values(layoutState.panels).some((panel) => panel.isMaximized);
  },

  /**
   * Get split by ID
   */
  getSplit: (id: string): SplitState | undefined => layoutState.splits[id],

  /**
   * Check if in zen mode
   */
  isZenMode: (): boolean => layoutState.zenMode,

  /**
   * Get current view mode
   */
  getViewMode: (): "ide" | "vibe" => layoutState.viewMode,
};

// =============================================================================
// EXPORTS
// =============================================================================

export { layoutState, setLayoutState };

export const useLayoutStore = () => ({
  state: layoutState,
  actions: layoutActions,
  splitActions,
  globalActions: globalLayoutActions,
  selectors: layoutSelectors,
});

export default useLayoutStore;
