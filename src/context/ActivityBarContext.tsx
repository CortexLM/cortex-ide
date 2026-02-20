/**
 * =============================================================================
 * ACTIVITY BAR CONTEXT - Global State Management for Activity Bar
 * =============================================================================
 * 
 * Provides centralized state management for the Activity Bar component,
 * including view selection, visibility, order, and badge counts.
 * 
 * Features:
 * - Track active view
 * - Track hidden items
 * - Track custom order
 * - Persist state to localStorage
 * - Manage badge counts
 * - Handle settings integration
 * 
 * @module context/ActivityBarContext
 * =============================================================================
 */

import {
  createContext,
  useContext,
  ParentProps,
  createEffect,
  createMemo,
  onMount,
  batch,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useSettings, ActivityBarLocation } from "./SettingsContext";

// =============================================================================
// Types
// =============================================================================

/** View container identifiers - matches VS Code view container IDs */
export type ViewContainerId = 
  | "workbench.view.explorer"
  | "workbench.view.search"
  | "workbench.view.scm"
  | "workbench.view.debug"
  | "workbench.view.extensions"
  | "workbench.view.agents"
  | "workbench.view.testing"
  | "workbench.view.remote"
  | string; // Allow custom view containers

/** Simplified view ID for internal use */
export type ViewId = 
  | "explorer"
  | "search"
  | "scm"
  | "debug"
  | "extensions"
  | "agents"
  | "testing"
  | "remote"
  | string;

/** Activity bar item definition */
export interface ActivityBarItemDefinition {
  id: ViewId;
  viewContainerId: ViewContainerId;
  label: string;
  iconClass?: string;
  order: number;
  visible: boolean;
  isBuiltin: boolean;
}

/** Badge information */
export interface ActivityBarBadge {
  count: number;
  color?: string;
  tooltip?: string;
}

/** Activity bar state */
export interface ActivityBarState {
  /** Currently active view ID */
  activeViewId: ViewId | null;
  /** Set of hidden item IDs */
  hiddenItems: string[];
  /** Custom order of items (by ID) */
  itemOrder: string[];
  /** Badge counts by view ID */
  badges: Record<string, ActivityBarBadge>;
  /** Whether sidebar is visible */
  sidebarVisible: boolean;
  /** Custom items added by extensions */
  customItems: ActivityBarItemDefinition[];
}

/** Activity bar context value */
export interface ActivityBarContextValue {
  /** Current state */
  state: ActivityBarState;
  
  /** Accessors */
  activeViewId: Accessor<ViewId | null>;
  isVisible: Accessor<boolean>;
  location: Accessor<ActivityBarLocation>;
  sidebarVisible: Accessor<boolean>;
  
  /** Actions */
  setActiveView: (viewId: ViewId) => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  
  /** Item management */
  hideItem: (itemId: string) => void;
  showItem: (itemId: string) => void;
  isItemHidden: (itemId: string) => boolean;
  reorderItems: (fromId: string, toId: string) => void;
  resetOrder: () => void;
  
  /** Badge management */
  setBadge: (viewId: string, badge: ActivityBarBadge | null) => void;
  getBadge: (viewId: string) => ActivityBarBadge | undefined;
  clearBadges: () => void;
  
  /** Custom items */
  registerCustomItem: (item: ActivityBarItemDefinition) => void;
  unregisterCustomItem: (itemId: string) => void;
  getCustomItems: () => ActivityBarItemDefinition[];
  
  /** Computed */
  getVisibleItems: () => ActivityBarItemDefinition[];
  getOrderedItems: () => ActivityBarItemDefinition[];
}

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEY_ACTIVE = "orion_activitybar_active";
const STORAGE_KEY_HIDDEN = "orion_activitybar_hidden";
const STORAGE_KEY_ORDER = "orion_activitybar_order";
const STORAGE_KEY_SIDEBAR = "orion_activitybar_sidebar_visible";

// =============================================================================
// Default Items
// =============================================================================

const DEFAULT_ITEMS: ActivityBarItemDefinition[] = [
  {
    id: "explorer",
    viewContainerId: "workbench.view.explorer",
    label: "Explorer",
    iconClass: "codicon-files",
    order: 0,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "search",
    viewContainerId: "workbench.view.search",
    label: "Search",
    iconClass: "codicon-search",
    order: 1,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "scm",
    viewContainerId: "workbench.view.scm",
    label: "Source Control",
    iconClass: "codicon-source-control",
    order: 2,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "debug",
    viewContainerId: "workbench.view.debug",
    label: "Run and Debug",
    iconClass: "codicon-debug-alt",
    order: 3,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "extensions",
    viewContainerId: "workbench.view.extensions",
    label: "Extensions",
    iconClass: "codicon-extensions",
    order: 4,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "agents",
    viewContainerId: "workbench.view.agents",
    label: "AI Agents",
    iconClass: "codicon-robot",
    order: 5,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "testing",
    viewContainerId: "workbench.view.testing",
    label: "Testing",
    iconClass: "codicon-beaker",
    order: 6,
    visible: true,
    isBuiltin: true,
  },
  {
    id: "remote",
    viewContainerId: "workbench.view.remote",
    label: "Remote Explorer",
    iconClass: "codicon-remote",
    order: 7,
    visible: true,
    isBuiltin: true,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
  }
}

// =============================================================================
// Context
// =============================================================================

const ActivityBarContext = createContext<ActivityBarContextValue>();

// =============================================================================
// Provider
// =============================================================================

export function ActivityBarProvider(props: ParentProps) {
  // Try to get settings context
  let settingsContext: ReturnType<typeof useSettings> | null = null;
  try {
    settingsContext = useSettings();
  } catch (err) {
    console.debug("[ActivityBar] Settings context unavailable:", err);
  }

  // Initialize state from storage
  const [state, setState] = createStore<ActivityBarState>({
    activeViewId: loadFromStorage<ViewId | null>(STORAGE_KEY_ACTIVE, "explorer"),
    hiddenItems: loadFromStorage<string[]>(STORAGE_KEY_HIDDEN, []),
    itemOrder: loadFromStorage<string[]>(STORAGE_KEY_ORDER, DEFAULT_ITEMS.map(i => i.id)),
    badges: {},
    sidebarVisible: loadFromStorage<boolean>(STORAGE_KEY_SIDEBAR, true),
    customItems: [],
  });

  // Computed values
  const activeViewId = () => state.activeViewId;
  const sidebarVisible = () => state.sidebarVisible;

  const isVisible = createMemo(() => {
    if (!settingsContext) return true;
    const theme = settingsContext.effectiveSettings()?.theme;
    return theme?.activityBarVisible !== false;
  });

  const location = createMemo((): ActivityBarLocation => {
    if (!settingsContext) return "side";
    return settingsContext.effectiveSettings()?.theme?.activityBarPosition ?? "side";
  });

  // Persist state changes
  createEffect(() => {
    saveToStorage(STORAGE_KEY_ACTIVE, state.activeViewId);
  });

  createEffect(() => {
    saveToStorage(STORAGE_KEY_HIDDEN, state.hiddenItems);
  });

  createEffect(() => {
    saveToStorage(STORAGE_KEY_ORDER, state.itemOrder);
  });

  createEffect(() => {
    saveToStorage(STORAGE_KEY_SIDEBAR, state.sidebarVisible);
  });

  // Actions
  const setActiveView = (viewId: ViewId) => {
    setState("activeViewId", viewId);
    
    // Emit event for other components to listen
    window.dispatchEvent(new CustomEvent("activitybar:view-changed", {
      detail: { viewId }
    }));
  };

  const toggleSidebar = () => {
    setState("sidebarVisible", !state.sidebarVisible);
    
    window.dispatchEvent(new CustomEvent("activitybar:sidebar-toggled", {
      detail: { visible: state.sidebarVisible }
    }));
  };

  const setSidebarVisible = (visible: boolean) => {
    setState("sidebarVisible", visible);
    
    window.dispatchEvent(new CustomEvent("activitybar:sidebar-toggled", {
      detail: { visible }
    }));
  };

  // Item management
  const hideItem = (itemId: string) => {
    setState(produce((s) => {
      if (!s.hiddenItems.includes(itemId)) {
        s.hiddenItems.push(itemId);
      }
    }));
  };

  const showItem = (itemId: string) => {
    setState(produce((s) => {
      s.hiddenItems = s.hiddenItems.filter(id => id !== itemId);
    }));
  };

  const isItemHidden = (itemId: string) => {
    return state.hiddenItems.includes(itemId);
  };

  const reorderItems = (fromId: string, toId: string) => {
    setState(produce((s) => {
      const fromIndex = s.itemOrder.indexOf(fromId);
      const toIndex = s.itemOrder.indexOf(toId);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        // Remove from current position
        s.itemOrder.splice(fromIndex, 1);
        // Insert at new position
        s.itemOrder.splice(toIndex, 0, fromId);
      }
    }));
  };

  const resetOrder = () => {
    batch(() => {
      setState("itemOrder", DEFAULT_ITEMS.map(i => i.id));
      setState("hiddenItems", []);
    });
  };

  // Badge management
  const setBadge = (viewId: string, badge: ActivityBarBadge | null) => {
    if (badge === null) {
      setState(produce((s) => {
        delete s.badges[viewId];
      }));
    } else {
      setState("badges", viewId, badge);
    }
  };

  const getBadge = (viewId: string) => {
    return state.badges[viewId];
  };

  const clearBadges = () => {
    setState("badges", {});
  };

  // Custom items
  const registerCustomItem = (item: ActivityBarItemDefinition) => {
    setState(produce((s) => {
      // Check if item already exists
      const existingIndex = s.customItems.findIndex(i => i.id === item.id);
      if (existingIndex !== -1) {
        s.customItems[existingIndex] = item;
      } else {
        s.customItems.push(item);
        // Add to order if not present
        if (!s.itemOrder.includes(item.id)) {
          s.itemOrder.push(item.id);
        }
      }
    }));
  };

  const unregisterCustomItem = (itemId: string) => {
    setState(produce((s) => {
      s.customItems = s.customItems.filter(i => i.id !== itemId);
      s.itemOrder = s.itemOrder.filter(id => id !== itemId);
    }));
  };

  const getCustomItems = () => {
    return state.customItems;
  };

  // Computed item lists
  const getVisibleItems = () => {
    const allItems = [...DEFAULT_ITEMS, ...state.customItems];
    return allItems.filter(item => !state.hiddenItems.includes(item.id));
  };

  const getOrderedItems = () => {
    const allItems = [...DEFAULT_ITEMS, ...state.customItems];
    const visibleItems = allItems.filter(item => !state.hiddenItems.includes(item.id));
    
    // Sort by order in itemOrder array
    return visibleItems.sort((a, b) => {
      const aIndex = state.itemOrder.indexOf(a.id);
      const bIndex = state.itemOrder.indexOf(b.id);
      
      // Items not in order go to the end, sorted by their default order
      if (aIndex === -1 && bIndex === -1) {
        return a.order - b.order;
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  };

  // Listen for external events
  onMount(() => {
    // Listen for view focus commands
    const handleViewFocus = (e: CustomEvent<{ view: string }>) => {
      if (e.detail?.view) {
        setActiveView(e.detail.view as ViewId);
        setSidebarVisible(true);
      }
    };

    // Listen for sidebar toggle commands
    const handleToggleSidebar = () => {
      toggleSidebar();
    };

    const handleFocusExplorer = () => {
      setActiveView("explorer" as ViewId);
      setSidebarVisible(true);
    };

    const handleFocusDebug = () => {
      setActiveView("debug" as ViewId);
      setSidebarVisible(true);
    };

    window.addEventListener("layout:focus-view", handleViewFocus as EventListener);
    window.addEventListener("layout:toggle-sidebar", handleToggleSidebar);
    window.addEventListener("layout:focus-explorer", handleFocusExplorer);
    window.addEventListener("layout:focus-debug", handleFocusDebug);

    return () => {
      window.removeEventListener("layout:focus-view", handleViewFocus as EventListener);
      window.removeEventListener("layout:toggle-sidebar", handleToggleSidebar);
      window.removeEventListener("layout:focus-explorer", handleFocusExplorer);
      window.removeEventListener("layout:focus-debug", handleFocusDebug);
    };
  });

  // Context value
  const value: ActivityBarContextValue = {
    state,
    activeViewId,
    isVisible,
    location,
    sidebarVisible,
    setActiveView,
    toggleSidebar,
    setSidebarVisible,
    hideItem,
    showItem,
    isItemHidden,
    reorderItems,
    resetOrder,
    setBadge,
    getBadge,
    clearBadges,
    registerCustomItem,
    unregisterCustomItem,
    getCustomItems,
    getVisibleItems,
    getOrderedItems,
  };

  return (
    <ActivityBarContext.Provider value={value}>
      {props.children}
    </ActivityBarContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useActivityBar(): ActivityBarContextValue {
  const context = useContext(ActivityBarContext);
  if (!context) {
    throw new Error("useActivityBar must be used within an ActivityBarProvider");
  }
  return context;
}

// =============================================================================
// Optional Hook (returns undefined if not in provider)
// =============================================================================

export function useActivityBarOptional(): ActivityBarContextValue | undefined {
  return useContext(ActivityBarContext);
}

// =============================================================================
// Exports
// =============================================================================

export { DEFAULT_ITEMS as ACTIVITY_BAR_DEFAULT_ITEMS };
