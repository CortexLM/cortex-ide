/**
 * Centered Editor Layout Component
 * 
 * Provides a standalone centered layout for the editor that is INDEPENDENT
 * of Zen Mode (matching VS Code's separate implementation).
 * 
 * Features:
 * - Toggle with command: "View: Toggle Centered Layout"
 * - Keyboard shortcut: Ctrl+K Ctrl+C
 * - Glued left/right margins that resize with window
 * - Editor content centered within margins
 * - Smooth transitions when toggling
 * - Configurable max width and margin ratio
 */

import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show,
  ParentProps,
  Accessor,
} from "solid-js";
import { useSettings } from "@/context/SettingsContext";

// ============================================================================
// Types
// ============================================================================

export interface CenteredLayoutSettings {
  /** Whether centered layout is enabled */
  enabled: boolean;
  /** Maximum editor width in pixels (default 1200px) */
  maxWidth: number;
  /** Auto-adjust width based on viewport */
  autoResize: boolean;
  /** Ratio of side margins (0-0.4) - how much of viewport is margins */
  sideMarginRatio: number;
}

export interface CenteredLayoutState {
  /** Whether centered layout is currently active */
  active: boolean;
  /** Computed content width in pixels */
  contentWidth: number;
  /** Computed margin width in pixels */
  marginWidth: number;
}

export interface CenteredLayoutActions {
  /** Toggle centered layout on/off */
  toggle: () => void;
  /** Enable centered layout */
  enable: () => void;
  /** Disable centered layout */
  disable: () => void;
  /** Update settings */
  updateSettings: (settings: Partial<CenteredLayoutSettings>) => void;
}

export interface UseCenteredLayoutReturn {
  state: Accessor<CenteredLayoutState>;
  settings: Accessor<CenteredLayoutSettings>;
  actions: CenteredLayoutActions;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_CENTERED_LAYOUT_SETTINGS: CenteredLayoutSettings = {
  enabled: false,
  maxWidth: 1200,
  autoResize: true,
  sideMarginRatio: 0.15,
};

// ============================================================================
// Global State
// ============================================================================

const [centeredLayoutActive, setCenteredLayoutActive] = createSignal(false);
const [centeredLayoutSettings, setCenteredLayoutSettings] = createSignal<CenteredLayoutSettings>(
  DEFAULT_CENTERED_LAYOUT_SETTINGS
);

// ============================================================================
// Centered Layout Hook
// ============================================================================

/**
 * Hook to access and control centered layout state.
 * Can be used anywhere in the app to check if centered layout is active
 * or to programmatically enable/disable centered layout.
 */
export function useCenteredLayout(): UseCenteredLayoutReturn {
  const [viewportWidth, setViewportWidth] = createSignal(window.innerWidth);
  
  // Update viewport width on resize
  onMount(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    
    window.addEventListener("resize", handleResize);
    
    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
    });
  });
  
  // Compute layout dimensions based on settings and viewport
  const computedState = createMemo<CenteredLayoutState>(() => {
    const settings = centeredLayoutSettings();
    const active = centeredLayoutActive();
    const width = viewportWidth();
    
    if (!active) {
      return {
        active: false,
        contentWidth: width,
        marginWidth: 0,
      };
    }
    
    let contentWidth: number;
    let marginWidth: number;
    
    if (settings.autoResize) {
      // Auto-resize mode: use margin ratio to calculate margins
      const clampedRatio = Math.max(0, Math.min(0.4, settings.sideMarginRatio));
      marginWidth = Math.floor(width * clampedRatio);
      contentWidth = Math.min(width - marginWidth * 2, settings.maxWidth);
      
      // Recalculate margin to center the content properly
      marginWidth = Math.floor((width - contentWidth) / 2);
    } else {
      // Fixed mode: use maxWidth directly
      contentWidth = Math.min(width, settings.maxWidth);
      marginWidth = Math.floor((width - contentWidth) / 2);
    }
    
    return {
      active,
      contentWidth: Math.max(contentWidth, 400), // Minimum content width
      marginWidth: Math.max(marginWidth, 0),
    };
  });
  
  const actions: CenteredLayoutActions = {
    toggle: () => {
      setCenteredLayoutActive((prev) => !prev);
      dispatchCenteredLayoutEvent(!centeredLayoutActive());
    },
    enable: () => {
      setCenteredLayoutActive(true);
      dispatchCenteredLayoutEvent(true);
    },
    disable: () => {
      setCenteredLayoutActive(false);
      dispatchCenteredLayoutEvent(false);
    },
    updateSettings: (newSettings) => {
      setCenteredLayoutSettings((prev) => ({ ...prev, ...newSettings }));
    },
  };
  
  return {
    state: computedState,
    settings: centeredLayoutSettings,
    actions,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function dispatchCenteredLayoutEvent(active: boolean): void {
  window.dispatchEvent(
    new CustomEvent(active ? "centered-layout:enter" : "centered-layout:exit", {
      detail: { active },
    })
  );
}

// ============================================================================
// Centered Layout Wrapper Component
// ============================================================================

interface CenteredLayoutWrapperProps extends ParentProps {
  /** Override enabled state (for external control) */
  enabled?: boolean;
  /** Custom max width (overrides settings) */
  maxWidth?: number;
  /** Custom margin ratio (overrides settings) */
  marginRatio?: number;
  /** CSS class name for the container */
  class?: string;
}

/**
 * Wrapper component that centers its children with configurable margins.
 * 
 * This component creates "glued" margins on either side of the content
 * that resize with the window, similar to VS Code's centered layout.
 */
export function CenteredLayoutWrapper(props: CenteredLayoutWrapperProps) {
  const { state, settings } = useCenteredLayout();
  
  // Determine if layout should be active (prop override or global state)
  const isActive = createMemo(() => {
    if (props.enabled !== undefined) {
      return props.enabled;
    }
    return state().active;
  });
  
  // Compute dimensions
  const dimensions = createMemo(() => {
    if (!isActive()) {
      return { contentWidth: "100%", marginWidth: "0px" };
    }
    
    const s = state();
    const overrideMaxWidth = props.maxWidth ?? settings().maxWidth;
    const overrideRatio = props.marginRatio ?? settings().sideMarginRatio;
    
    // Recalculate if using overrides
    if (props.maxWidth !== undefined || props.marginRatio !== undefined) {
      const viewportWidth = window.innerWidth;
      const clampedRatio = Math.max(0, Math.min(0.4, overrideRatio));
      const marginWidth = Math.floor(viewportWidth * clampedRatio);
      const contentWidth = Math.min(viewportWidth - marginWidth * 2, overrideMaxWidth);
      const finalMargin = Math.floor((viewportWidth - contentWidth) / 2);
      
      return {
        contentWidth: `${Math.max(contentWidth, 400)}px`,
        marginWidth: `${Math.max(finalMargin, 0)}px`,
      };
    }
    
    return {
      contentWidth: `${s.contentWidth}px`,
      marginWidth: `${s.marginWidth}px`,
    };
  });
  
  return (
    <div
      class={`centered-layout-container ${props.class ?? ""}`}
      style={{
        display: "flex",
        "flex-direction": "row",
        width: "100%",
        height: "100%",
        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Left margin */}
      <Show when={isActive()}>
        <div
          class="centered-layout-margin centered-layout-margin-left"
          style={{
            width: dimensions().marginWidth,
            height: "100%",
            background: "var(--centered-layout-margin-bg, var(--background-base))",
            "flex-shrink": 0,
            transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </Show>
      
      {/* Content area */}
      <div
        class="centered-layout-content"
        style={{
          flex: isActive() ? "0 0 auto" : "1",
          width: isActive() ? dimensions().contentWidth : "100%",
          "max-width": isActive() ? dimensions().contentWidth : "100%",
          height: "100%",
          overflow: "hidden",
          transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {props.children}
      </div>
      
      {/* Right margin */}
      <Show when={isActive()}>
        <div
          class="centered-layout-margin centered-layout-margin-right"
          style={{
            width: dimensions().marginWidth,
            height: "100%",
            background: "var(--centered-layout-margin-bg, var(--background-base))",
            "flex-shrink": 0,
            transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// Centered Layout Provider Component
// ============================================================================

interface CenteredLayoutProviderProps extends ParentProps {}

/**
 * Provider component that sets up centered layout keyboard shortcuts
 * and syncs with settings context.
 * Should be placed near the root of the app to enable centered layout functionality.
 */
export function CenteredLayoutProvider(props: CenteredLayoutProviderProps) {
  const settingsContext = useSettings();
  const { actions } = useCenteredLayout();
  
  // Sync with settings context on mount and when settings change
  createEffect(() => {
    const workbenchSettings = settingsContext.effectiveSettings()?.workbench;
    if (workbenchSettings?.editor?.centeredLayout) {
      const centeredSettings = workbenchSettings.editor.centeredLayout;
      setCenteredLayoutSettings({
        enabled: centeredSettings.enabled ?? DEFAULT_CENTERED_LAYOUT_SETTINGS.enabled,
        maxWidth: centeredSettings.maxWidth ?? DEFAULT_CENTERED_LAYOUT_SETTINGS.maxWidth,
        autoResize: centeredSettings.autoResize ?? DEFAULT_CENTERED_LAYOUT_SETTINGS.autoResize,
        sideMarginRatio: centeredSettings.sideMarginRatio ?? DEFAULT_CENTERED_LAYOUT_SETTINGS.sideMarginRatio,
      });
      setCenteredLayoutActive(centeredSettings.enabled ?? false);
    }
  });
  
  // Two-key chord state for Ctrl+K Ctrl+C
  let waitingForSecondKey = false;
  let chordTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Setup keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle two-key chord: Ctrl+K Ctrl+C
      if (waitingForSecondKey) {
        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "c") {
          e.preventDefault();
          e.stopPropagation();
          actions.toggle();
        }
        // Reset chord state after any key press
        waitingForSecondKey = false;
        if (chordTimeout) {
          clearTimeout(chordTimeout);
          chordTimeout = null;
        }
        return;
      }
      
      // First key of chord: Ctrl+K
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        waitingForSecondKey = true;
        
        // Reset chord after 1 second timeout
        chordTimeout = setTimeout(() => {
          waitingForSecondKey = false;
          chordTimeout = null;
        }, 1000);
        
        return;
      }
    };
    
    // Listen for command from command palette
    const handleToggleCommand = () => {
      actions.toggle();
    };
    
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("centered-layout:toggle", handleToggleCommand);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("centered-layout:toggle", handleToggleCommand);
      if (chordTimeout) {
        clearTimeout(chordTimeout);
      }
    });
  });
  
  return <>{props.children}</>;
}

// ============================================================================
// Exports
// ============================================================================

export {
  centeredLayoutActive,
  setCenteredLayoutActive,
  centeredLayoutSettings,
  setCenteredLayoutSettings,
};
