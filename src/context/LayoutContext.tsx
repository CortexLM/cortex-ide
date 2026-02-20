/**
 * Layout Context - Manages workbench layout state including sidebars and panels
 * 
 * Handles:
 * - Primary sidebar (left/right position)
 * - Auxiliary bar (secondary sidebar)
 * - Panel visibility and state
 * - View management and drag-drop between sidebars
 */

import {
  createContext,
  useContext,
  ParentProps,
  createEffect,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

/** View identifiers for sidebar panels */
export type ViewId =
  | "outline"
  | "timeline"
  | "chat"
  | "search"
  | "debug"
  | "extensions"
  | "git"
  | "explorer"
  | "problems"
  | "output"
  | "terminal"
  | "custom";

/** View location in the layout */
export type ViewLocation = "primarySidebar" | "auxiliaryBar" | "panel";

/** Sidebar position */
export type SidebarPosition = "left" | "right";

/** Represents a view that can be placed in sidebars or panel */
export interface LayoutView {
  id: string;
  viewId: ViewId;
  title: string;
  icon?: string;
  location: ViewLocation;
  order: number;
  /** Custom component path for dynamic views */
  component?: string;
  /** Whether this view can be moved */
  movable?: boolean;
  /** Whether this view can be closed */
  closable?: boolean;
}

/** Auxiliary bar (secondary sidebar) state */
export interface AuxiliaryBarState {
  visible: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  activeViewId: string | null;
  views: LayoutView[];
}

/** Primary sidebar state */
export interface PrimarySidebarState {
  visible: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  position: SidebarPosition;
  activeViewId: string | null;
}

/** Panel state */
export interface PanelState {
  visible: boolean;
  height: number;
  minHeight: number;
  maxHeight: number;
  position: "bottom" | "left" | "right";
  activeViewId: string | null;
}

/** Complete layout state */
export interface LayoutState {
  primarySidebar: PrimarySidebarState;
  auxiliaryBar: AuxiliaryBarState;
  panel: PanelState;
  /** Tracks ongoing drag operations */
  dragState: {
    isDragging: boolean;
    sourceViewId: string | null;
    sourceLocation: ViewLocation | null;
    targetLocation: ViewLocation | null;
  };
}

/** Layout context API */
export interface LayoutContextValue {
  state: LayoutState;
  
  // Auxiliary Bar
  toggleAuxiliaryBar: () => void;
  setAuxiliaryBarVisible: (visible: boolean) => void;
  setAuxiliaryBarWidth: (width: number) => void;
  setAuxiliaryBarActiveView: (viewId: string | null) => void;
  addAuxiliaryBarView: (view: Omit<LayoutView, "location" | "order">) => void;
  removeAuxiliaryBarView: (viewId: string) => void;
  
  // Primary Sidebar
  togglePrimarySidebar: () => void;
  setPrimarySidebarVisible: (visible: boolean) => void;
  setPrimarySidebarWidth: (width: number) => void;
  setPrimarySidebarPosition: (position: SidebarPosition) => void;
  toggleSidebarPosition: () => void;
  
  // Panel
  togglePanel: () => void;
  setPanelVisible: (visible: boolean) => void;
  setPanelHeight: (height: number) => void;
  
  // View Management
  moveView: (viewId: string, toLocation: ViewLocation) => void;
  startDrag: (viewId: string, fromLocation: ViewLocation) => void;
  endDrag: (toLocation: ViewLocation | null) => void;
  cancelDrag: () => void;
  
  // Utilities
  getAuxiliaryBarPosition: () => SidebarPosition;
  isViewInLocation: (viewId: string, location: ViewLocation) => boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_LAYOUT = "cortex:layout:state";
// Reserved for future auxiliary bar settings persistence
const _STORAGE_KEY_AUXILIARY_BAR = "cortex:layout:auxiliaryBar";
void _STORAGE_KEY_AUXILIARY_BAR;

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_AUXILIARY_BAR_VIEWS: LayoutView[] = [
  {
    id: "aux-outline",
    viewId: "outline",
    title: "Outline",
    icon: "symbol-class",
    location: "auxiliaryBar",
    order: 0,
    movable: true,
    closable: false,
  },
  {
    id: "aux-timeline",
    viewId: "timeline",
    title: "Timeline",
    icon: "history",
    location: "auxiliaryBar",
    order: 1,
    movable: true,
    closable: false,
  },
  {
    id: "aux-chat",
    viewId: "chat",
    title: "Chat",
    icon: "comment-discussion",
    location: "auxiliaryBar",
    order: 2,
    movable: true,
    closable: false,
  },
];

const DEFAULT_LAYOUT_STATE: LayoutState = {
  primarySidebar: {
    visible: true,
    width: 260,
    minWidth: 160,
    maxWidth: 500,
    position: "left",
    activeViewId: "explorer",
  },
  auxiliaryBar: {
    visible: false,
    width: 300,
    minWidth: 200,
    maxWidth: 600,
    activeViewId: "outline",
    views: DEFAULT_AUXILIARY_BAR_VIEWS,
  },
  panel: {
    visible: true,
    height: 220,
    minHeight: 100,
    maxHeight: 600,
    position: "bottom",
    activeViewId: "terminal",
  },
  dragState: {
    isDragging: false,
    sourceViewId: null,
    sourceLocation: null,
    targetLocation: null,
  },
};

// ============================================================================
// Context
// ============================================================================

const LayoutContext = createContext<LayoutContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function LayoutProvider(props: ParentProps) {
  // Load persisted state
  const loadPersistedState = (): LayoutState => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<LayoutState>;
        return {
          ...DEFAULT_LAYOUT_STATE,
          primarySidebar: {
            ...DEFAULT_LAYOUT_STATE.primarySidebar,
            ...(parsed.primarySidebar || {}),
          },
          auxiliaryBar: {
            ...DEFAULT_LAYOUT_STATE.auxiliaryBar,
            ...(parsed.auxiliaryBar || {}),
            // Ensure default views are present
            views: parsed.auxiliaryBar?.views?.length 
              ? parsed.auxiliaryBar.views 
              : DEFAULT_AUXILIARY_BAR_VIEWS,
          },
          panel: {
            ...DEFAULT_LAYOUT_STATE.panel,
            ...(parsed.panel || {}),
          },
          dragState: DEFAULT_LAYOUT_STATE.dragState,
        };
      }
    } catch (e) {
      console.warn("[LayoutContext] Failed to load persisted state:", e);
    }
    return DEFAULT_LAYOUT_STATE;
  };

  const [state, setState] = createStore<LayoutState>(loadPersistedState());

  // Persist state on changes
  createEffect(() => {
    const toSave = {
      primarySidebar: {
        visible: state.primarySidebar.visible,
        width: state.primarySidebar.width,
        position: state.primarySidebar.position,
        activeViewId: state.primarySidebar.activeViewId,
      },
      auxiliaryBar: {
        visible: state.auxiliaryBar.visible,
        width: state.auxiliaryBar.width,
        activeViewId: state.auxiliaryBar.activeViewId,
        views: state.auxiliaryBar.views,
      },
      panel: {
        visible: state.panel.visible,
        height: state.panel.height,
        position: state.panel.position,
        activeViewId: state.panel.activeViewId,
      },
    };
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(toSave));
    } catch (e) {
      console.warn("[LayoutContext] Failed to persist state:", e);
    }
  });

  // ========== Auxiliary Bar Actions ==========

  const toggleAuxiliaryBar = () => {
    setState("auxiliaryBar", "visible", (v) => !v);
    window.dispatchEvent(new CustomEvent("layout:auxiliaryBar-toggled", {
      detail: { visible: state.auxiliaryBar.visible }
    }));
  };

  const setAuxiliaryBarVisible = (visible: boolean) => {
    setState("auxiliaryBar", "visible", visible);
    window.dispatchEvent(new CustomEvent("layout:auxiliaryBar-toggled", {
      detail: { visible }
    }));
  };

  const setAuxiliaryBarWidth = (width: number) => {
    const clamped = Math.max(
      state.auxiliaryBar.minWidth,
      Math.min(state.auxiliaryBar.maxWidth, width)
    );
    setState("auxiliaryBar", "width", clamped);
  };

  const setAuxiliaryBarActiveView = (viewId: string | null) => {
    setState("auxiliaryBar", "activeViewId", viewId);
    // Auto-show when selecting a view
    if (viewId && !state.auxiliaryBar.visible) {
      setState("auxiliaryBar", "visible", true);
    }
  };

  const addAuxiliaryBarView = (view: Omit<LayoutView, "location" | "order">) => {
    setState(
      produce((s) => {
        const maxOrder = Math.max(0, ...s.auxiliaryBar.views.map((v) => v.order));
        s.auxiliaryBar.views.push({
          ...view,
          location: "auxiliaryBar",
          order: maxOrder + 1,
        });
      })
    );
  };

  const removeAuxiliaryBarView = (viewId: string) => {
    setState(
      produce((s) => {
        const index = s.auxiliaryBar.views.findIndex((v) => v.id === viewId);
        if (index !== -1) {
          const view = s.auxiliaryBar.views[index];
          if (view.closable !== false) {
            s.auxiliaryBar.views.splice(index, 1);
            // If active view is removed, select another
            if (s.auxiliaryBar.activeViewId === viewId) {
              s.auxiliaryBar.activeViewId = s.auxiliaryBar.views[0]?.id || null;
            }
          }
        }
      })
    );
  };

  // ========== Primary Sidebar Actions ==========

  const togglePrimarySidebar = () => {
    setState("primarySidebar", "visible", (v) => !v);
    window.dispatchEvent(new CustomEvent("layout:sidebar-toggled", {
      detail: { visible: state.primarySidebar.visible }
    }));
  };

  const setPrimarySidebarVisible = (visible: boolean) => {
    setState("primarySidebar", "visible", visible);
  };

  const setPrimarySidebarWidth = (width: number) => {
    const clamped = Math.max(
      state.primarySidebar.minWidth,
      Math.min(state.primarySidebar.maxWidth, width)
    );
    setState("primarySidebar", "width", clamped);
  };

  const setPrimarySidebarPosition = (position: SidebarPosition) => {
    setState("primarySidebar", "position", position);
    window.dispatchEvent(new CustomEvent("layout:sidebar-position-changed", {
      detail: { position }
    }));
  };

  const toggleSidebarPosition = () => {
    const newPosition = state.primarySidebar.position === "left" ? "right" : "left";
    setPrimarySidebarPosition(newPosition);
  };

  // ========== Panel Actions ==========

  const togglePanel = () => {
    setState("panel", "visible", (v) => !v);
    window.dispatchEvent(new CustomEvent("layout:panel-toggled", {
      detail: { visible: state.panel.visible }
    }));
  };

  const setPanelVisible = (visible: boolean) => {
    setState("panel", "visible", visible);
  };

  const setPanelHeight = (height: number) => {
    const clamped = Math.max(
      state.panel.minHeight,
      Math.min(state.panel.maxHeight, height)
    );
    setState("panel", "height", clamped);
  };

  // ========== View Management ==========

  const moveView = (viewId: string, toLocation: ViewLocation) => {
    setState(
      produce((s) => {
        // Find and remove from current location
        let movedView: LayoutView | undefined;

        // Check auxiliary bar
        const auxIndex = s.auxiliaryBar.views.findIndex((v) => v.id === viewId);
        if (auxIndex !== -1) {
          movedView = { ...s.auxiliaryBar.views[auxIndex] };
          if (movedView.movable !== false) {
            s.auxiliaryBar.views.splice(auxIndex, 1);
          } else {
            return;
          }
        }

        if (!movedView) return;

        // Add to new location
        movedView.location = toLocation;
        
        if (toLocation === "auxiliaryBar") {
          const maxOrder = Math.max(0, ...s.auxiliaryBar.views.map((v) => v.order));
          movedView.order = maxOrder + 1;
          s.auxiliaryBar.views.push(movedView);
        }
        // Note: Moving to other locations would be handled similarly
      })
    );
  };

  const startDrag = (viewId: string, fromLocation: ViewLocation) => {
    setState("dragState", {
      isDragging: true,
      sourceViewId: viewId,
      sourceLocation: fromLocation,
      targetLocation: null,
    });
  };

  const endDrag = (toLocation: ViewLocation | null) => {
    const { sourceViewId, sourceLocation } = state.dragState;
    
    if (sourceViewId && toLocation && toLocation !== sourceLocation) {
      moveView(sourceViewId, toLocation);
    }
    
    setState("dragState", {
      isDragging: false,
      sourceViewId: null,
      sourceLocation: null,
      targetLocation: null,
    });
  };

  const cancelDrag = () => {
    setState("dragState", {
      isDragging: false,
      sourceViewId: null,
      sourceLocation: null,
      targetLocation: null,
    });
  };

  // ========== Utilities ==========

  const getAuxiliaryBarPosition = (): SidebarPosition => {
    // Auxiliary bar is opposite to primary sidebar
    return state.primarySidebar.position === "left" ? "right" : "left";
  };

  const isViewInLocation = (viewId: string, location: ViewLocation): boolean => {
    if (location === "auxiliaryBar") {
      return state.auxiliaryBar.views.some((v) => v.id === viewId);
    }
    return false;
  };

  // ========== Event Listeners ==========

  onMount(() => {
    // Listen for keyboard shortcut to toggle auxiliary bar (Ctrl+Alt+B)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleAuxiliaryBar();
      }
    };

    // Listen for layout toggle events
    const handleTogglePanel = () => togglePanel();
    const handleToggleSidebar = () => togglePrimarySidebar();
    const handleToggleAuxiliaryBar = () => toggleAuxiliaryBar();
    const handleSidebarPositionToggle = () => toggleSidebarPosition();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("layout:toggle-panel", handleTogglePanel);
    window.addEventListener("layout:toggle-sidebar", handleToggleSidebar);
    window.addEventListener("layout:toggle-auxiliary-bar", handleToggleAuxiliaryBar);
    window.addEventListener("sidebar:toggle-position", handleSidebarPositionToggle);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("layout:toggle-panel", handleTogglePanel);
      window.removeEventListener("layout:toggle-sidebar", handleToggleSidebar);
      window.removeEventListener("layout:toggle-auxiliary-bar", handleToggleAuxiliaryBar);
      window.removeEventListener("sidebar:toggle-position", handleSidebarPositionToggle);
    });
  });

  const value: LayoutContextValue = {
    state,
    
    // Auxiliary Bar
    toggleAuxiliaryBar,
    setAuxiliaryBarVisible,
    setAuxiliaryBarWidth,
    setAuxiliaryBarActiveView,
    addAuxiliaryBarView,
    removeAuxiliaryBarView,
    
    // Primary Sidebar
    togglePrimarySidebar,
    setPrimarySidebarVisible,
    setPrimarySidebarWidth,
    setPrimarySidebarPosition,
    toggleSidebarPosition,
    
    // Panel
    togglePanel,
    setPanelVisible,
    setPanelHeight,
    
    // View Management
    moveView,
    startDrag,
    endDrag,
    cancelDrag,
    
    // Utilities
    getAuxiliaryBarPosition,
    isViewInLocation,
  };

  return (
    <LayoutContext.Provider value={value}>
      {props.children}
    </LayoutContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useLayout(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/** Hook for auxiliary bar state and actions */
export function useAuxiliaryBar() {
  const layout = useLayout();
  
  return {
    visible: () => layout.state.auxiliaryBar.visible,
    width: () => layout.state.auxiliaryBar.width,
    activeViewId: () => layout.state.auxiliaryBar.activeViewId,
    views: () => layout.state.auxiliaryBar.views,
    position: () => layout.getAuxiliaryBarPosition(),
    
    toggle: layout.toggleAuxiliaryBar,
    setVisible: layout.setAuxiliaryBarVisible,
    setWidth: layout.setAuxiliaryBarWidth,
    setActiveView: layout.setAuxiliaryBarActiveView,
    addView: layout.addAuxiliaryBarView,
    removeView: layout.removeAuxiliaryBarView,
  };
}

/** Hook for primary sidebar state */
export function usePrimarySidebar() {
  const layout = useLayout();
  
  return {
    visible: () => layout.state.primarySidebar.visible,
    width: () => layout.state.primarySidebar.width,
    position: () => layout.state.primarySidebar.position,
    
    toggle: layout.togglePrimarySidebar,
    setVisible: layout.setPrimarySidebarVisible,
    setWidth: layout.setPrimarySidebarWidth,
    setPosition: layout.setPrimarySidebarPosition,
    togglePosition: layout.toggleSidebarPosition,
  };
}

export default LayoutProvider;
