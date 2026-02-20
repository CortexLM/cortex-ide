import {
  createSignal,
  onMount,
  onCleanup,
  Show,
  ParentProps,
  Accessor,
} from "solid-js";
import { Icon } from "./ui/Icon";
import { useSettings } from "@/context/SettingsContext";

// ============================================================================
// Types
// ============================================================================

export interface ZenModeState {
  /** Whether zen mode is currently active */
  active: boolean;
  /** Whether the app is in fullscreen mode */
  fullscreen: boolean;
  /** Settings snapshot captured when entering Zen Mode (for restore) */
  savedState: ZenModeSavedState | null;
}

/** State saved when entering Zen Mode for restoration on exit */
export interface ZenModeSavedState {
  lineNumbers: "on" | "off" | "relative" | "interval";
  tabsVisible: boolean;
  activityBarVisible: boolean;
  sidebarVisible: boolean;
  statusBarVisible: boolean;
  panelVisible: boolean;
  menuBarVisible: boolean;
  wasFullscreen: boolean;
}

/** Enhanced Zen Mode settings */
export interface EnhancedZenModeSettings {
  // Existing settings
  fullScreen: boolean;
  centerLayout: boolean;
  hideSidebar: boolean;
  hideStatusBar: boolean;
  hidePanel: boolean;
  hideMenuBar: boolean;
  silentNotifications: boolean;
  maxWidth: string;
  showLineNumbers: boolean;
  
  // NEW - Additional settings
  hideLineNumbers: boolean;    // Hide editor line numbers (overrides showLineNumbers)
  hideTabs: boolean;           // Hide tab bar
  hideActivityBar: boolean;    // Explicit activity bar hide
  restore: boolean;            // Restore window state on exit
}

export interface ZenModeActions {
  /** Toggle zen mode on/off */
  toggle: () => void;
  /** Enable zen mode */
  enter: () => void;
  /** Exit zen mode */
  exit: () => void;
  /** Toggle fullscreen mode */
  toggleFullscreen: () => void;
  /** Get current Zen Mode settings */
  getSettings: () => EnhancedZenModeSettings;
}

export interface UseZenModeReturn {
  state: Accessor<ZenModeState>;
  actions: ZenModeActions;
}

// ============================================================================
// Default Enhanced Settings
// ============================================================================

const DEFAULT_ZEN_MODE_SETTINGS: EnhancedZenModeSettings = {
  fullScreen: false,
  centerLayout: true,
  hideSidebar: true,
  hideStatusBar: true,
  hidePanel: true,
  hideMenuBar: true,
  silentNotifications: true,
  maxWidth: "900px",
  showLineNumbers: true,
  // New settings
  hideLineNumbers: false,
  hideTabs: false,
  hideActivityBar: true,
  restore: true,
};

// ============================================================================
// Zen Mode Context State
// ============================================================================

const [zenModeActive, setZenModeActive] = createSignal(false);
const [zenModeFullscreen, setZenModeFullscreen] = createSignal(false);
const [zenModeSavedState, setZenModeSavedState] = createSignal<ZenModeSavedState | null>(null);
const [escapeCount, setEscapeCount] = createSignal(0);
const [escapeTimeout, setEscapeTimeout] = createSignal<ReturnType<typeof setTimeout> | null>(null);

// Cached settings to avoid repeated lookups
let cachedZenModeSettings: EnhancedZenModeSettings = { ...DEFAULT_ZEN_MODE_SETTINGS };

// ============================================================================
// Zen Mode Hook
// ============================================================================

/**
 * Hook to access and control zen mode state.
 * Can be used anywhere in the app to check if zen mode is active
 * or to programmatically enter/exit zen mode.
 */
export function useZenMode(): UseZenModeReturn {
  const state: Accessor<ZenModeState> = () => ({
    active: zenModeActive(),
    fullscreen: zenModeFullscreen(),
    savedState: zenModeSavedState(),
  });

  const actions: ZenModeActions = {
    toggle: () => {
      if (zenModeActive()) {
        exitZenMode();
      } else {
        enterZenMode();
      }
    },
    enter: enterZenMode,
    exit: exitZenMode,
    toggleFullscreen: () => {
      if (zenModeFullscreen()) {
        exitFullscreen();
      } else {
        enterFullscreen();
      }
    },
    getSettings: () => ({ ...cachedZenModeSettings }),
  };

  return { state, actions };
}

/**
 * Update cached Zen Mode settings from the settings context.
 * Called when settings change.
 */
export function updateZenModeSettings(settings: Partial<EnhancedZenModeSettings>): void {
  cachedZenModeSettings = { ...cachedZenModeSettings, ...settings };
}

// ============================================================================
// Zen Mode Functions
// ============================================================================

/**
 * Capture current UI state before entering Zen Mode.
 * Used for restoration on exit if `restore` setting is enabled.
 */
function captureCurrentState(): ZenModeSavedState {
  // Get current UI state by checking DOM or dispatching query events
  // Default values if state cannot be determined
  return {
    lineNumbers: "on", // Will be updated by editor
    tabsVisible: true,
    activityBarVisible: true,
    sidebarVisible: true,
    statusBarVisible: true,
    panelVisible: true,
    menuBarVisible: true,
    wasFullscreen: zenModeFullscreen(),
  };
}

function enterZenMode() {
  // Capture state before making changes (for restore on exit)
  if (cachedZenModeSettings.restore) {
    setZenModeSavedState(captureCurrentState());
  }
  
  setZenModeActive(true);
  setEscapeCount(0);
  
  // Dispatch event for other components to react
  // Include settings so components know what to hide
  window.dispatchEvent(new CustomEvent("zenmode:enter", {
    detail: {
      settings: { ...cachedZenModeSettings },
    },
  }));
  
  // Dispatch specific events for each UI element to hide
  if (cachedZenModeSettings.hideLineNumbers) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-line-numbers"));
  }
  if (cachedZenModeSettings.hideTabs) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-tabs"));
  }
  if (cachedZenModeSettings.hideActivityBar) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-activity-bar"));
  }
  if (cachedZenModeSettings.hideSidebar) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-sidebar"));
  }
  if (cachedZenModeSettings.hideStatusBar) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-status-bar"));
  }
  if (cachedZenModeSettings.hidePanel) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-panel"));
  }
  if (cachedZenModeSettings.hideMenuBar) {
    window.dispatchEvent(new CustomEvent("zenmode:hide-menu-bar"));
  }
  if (cachedZenModeSettings.silentNotifications) {
    window.dispatchEvent(new CustomEvent("zenmode:silence-notifications"));
  }
  
  // Store state in session storage for persistence during session
  sessionStorage.setItem("cortex_zen_mode", "true");
  sessionStorage.setItem("cortex_zen_mode_settings", JSON.stringify(cachedZenModeSettings));
}

function exitZenMode() {
  const savedState = zenModeSavedState();
  const shouldRestore = cachedZenModeSettings.restore && savedState;
  
  setZenModeActive(false);
  setEscapeCount(0);
  
  // Exit fullscreen if active (unless we were already in fullscreen before)
  if (zenModeFullscreen() && (!savedState || !savedState.wasFullscreen)) {
    exitFullscreen();
  }
  
  // Dispatch event for other components to react
  // Include saved state for restoration
  window.dispatchEvent(new CustomEvent("zenmode:exit", {
    detail: {
      restore: shouldRestore,
      savedState: savedState,
    },
  }));
  
  // Dispatch specific restore events
  if (shouldRestore) {
    window.dispatchEvent(new CustomEvent("zenmode:restore-state", {
      detail: savedState,
    }));
  }
  
  // Clear saved state
  setZenModeSavedState(null);
  
  // Clear session storage
  sessionStorage.removeItem("cortex_zen_mode");
  sessionStorage.removeItem("cortex_zen_mode_settings");
}

async function enterFullscreen() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const window = getCurrentWindow();
    await window.setFullscreen(true);
    setZenModeFullscreen(true);
  } catch (error) {
    // Fallback to browser fullscreen API
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      setZenModeFullscreen(true);
    }
  }
}

async function exitFullscreen() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const window = getCurrentWindow();
    await window.setFullscreen(false);
    setZenModeFullscreen(false);
  } catch (error) {
    // Fallback to browser fullscreen API
    if (document.exitFullscreen && document.fullscreenElement) {
      await document.exitFullscreen();
      setZenModeFullscreen(false);
    }
  }
}

function handleEscapePress() {
  const currentCount = escapeCount();
  const timeout = escapeTimeout();
  
  // Clear any existing timeout
  if (timeout) {
    clearTimeout(timeout);
  }
  
  if (currentCount === 0) {
    // First escape press
    setEscapeCount(1);
    
    // Set timeout to reset escape count after 500ms
    const newTimeout = setTimeout(() => {
      setEscapeCount(0);
      setEscapeTimeout(null);
    }, 500);
    
    setEscapeTimeout(newTimeout);
  } else {
    // Second escape press within 500ms - exit zen mode
    setEscapeCount(0);
    setEscapeTimeout(null);
    exitZenMode();
  }
}

// ============================================================================
// Zen Mode Exit Button Component
// ============================================================================

interface ZenModeExitButtonProps {
  onExit: () => void;
}

function ZenModeExitButton(props: ZenModeExitButtonProps) {
  const [visible, setVisible] = createSignal(true);
  const [hovered, setHovered] = createSignal(false);
  
  // Auto-hide after 3 seconds of inactivity, show on mouse move
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const resetHideTimer = () => {
    setVisible(true);
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    hideTimeout = setTimeout(() => {
      if (!hovered()) {
        setVisible(false);
      }
    }, 3000);
  };
  
  onMount(() => {
    resetHideTimer();
    
    const handleMouseMove = () => {
      resetHideTimer();
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    
    onCleanup(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    });
  });
  
  return (
    <button
      onClick={props.onExit}
      onMouseEnter={() => {
        setHovered(true);
        setVisible(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        resetHideTimer();
      }}
      class="fixed top-4 right-4 z-[9999] flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300"
      style={{
        background: hovered() ? "var(--surface-raised)" : "rgba(0, 0, 0, 0.4)",
        color: hovered() ? "var(--text-base)" : "rgba(255, 255, 255, 0.8)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        "backdrop-filter": "blur(8px)",
        opacity: visible() ? "1" : "0",
        transform: visible() ? "translateY(0)" : "translateY(-8px)",
        "pointer-events": visible() ? "auto" : "none",
        "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
      title="Exit Zen Mode (Escape twice)"
    >
      <Icon name="xmark" class="w-4 h-4" />
      <span class="text-xs font-medium">Exit Zen Mode</span>
    </button>
  );
}

// ============================================================================
// Zen Mode Overlay Component
// ============================================================================

interface ZenModeOverlayProps extends ParentProps {
  /** Whether zen mode is active */
  active: boolean;
  /** Max width for centered content (e.g., "900px") */
  maxWidth?: string;
  /** Whether to center the content */
  centerLayout?: boolean;
  /** Callback when exit button is clicked */
  onExit: () => void;
}

/**
 * Overlay component that wraps content in zen mode styling.
 * Provides centered layout with max width and clean aesthetics.
 */
export function ZenModeOverlay(props: ZenModeOverlayProps) {
  const { effectiveSettings } = useSettings();
  
  const zenSettings = () => effectiveSettings().zenMode;
  const shouldCenter = () => props.centerLayout ?? zenSettings()?.centerLayout ?? true;
  const maxWidth = () => props.maxWidth ?? zenSettings()?.maxWidth ?? "900px";
  
  return (
    <Show when={props.active}>
      <div
        class="zen-mode-overlay fixed inset-0 z-[9998] flex flex-col"
        style={{
          background: "var(--background-base)",
        }}
      >
        {/* Exit button */}
        <ZenModeExitButton onExit={props.onExit} />
        
        {/* Content container */}
        <div
          class="flex-1 flex flex-col overflow-hidden transition-all duration-300"
          style={{
            "justify-content": shouldCenter() ? "center" : "flex-start",
            "align-items": shouldCenter() ? "center" : "stretch",
            padding: shouldCenter() ? "24px" : "0",
          }}
        >
          <div
            class="w-full h-full overflow-hidden"
            style={{
              "max-width": shouldCenter() ? maxWidth() : "100%",
            }}
          >
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Zen Mode Provider Component
// ============================================================================

interface ZenModeProviderProps extends ParentProps {}

/**
 * Provider component that sets up zen mode keyboard shortcuts and state management.
 * Should be placed near the root of the app to enable zen mode functionality.
 */
export function ZenModeProvider(props: ZenModeProviderProps) {
  const { effectiveSettings } = useSettings();
  
  // Restore zen mode state from session storage
  onMount(() => {
    const stored = sessionStorage.getItem("cortex_zen_mode");
    if (stored === "true") {
      setZenModeActive(true);
    }
    
    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
      );
      setZenModeFullscreen(isFullscreen);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    });
  });
  
  // Setup keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K Z: Toggle Zen Mode (VSCode-style two-key binding)
      // We detect Ctrl+K, then wait for Z
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        // Set up listener for the follow-up key
        const handleFollowUp = (followE: KeyboardEvent) => {
          if (followE.key.toLowerCase() === "z") {
            followE.preventDefault();
            followE.stopPropagation();
            
            if (zenModeActive()) {
              exitZenMode();
            } else {
              enterZenMode();
              
              // Check if fullscreen should be enabled automatically
              const zenSettings = effectiveSettings().zenMode;
              if (zenSettings?.fullScreen) {
                enterFullscreen();
              }
            }
          }
          // Remove listener after any key press
          window.removeEventListener("keydown", handleFollowUp, true);
        };
        
        // Listen for the next keydown
        window.addEventListener("keydown", handleFollowUp, true);
        
        // Remove listener after 1 second timeout
        setTimeout(() => {
          window.removeEventListener("keydown", handleFollowUp, true);
        }, 1000);
        
        return;
      }
      
      // Escape: Exit zen mode (double press)
      if (e.key === "Escape" && zenModeActive()) {
        e.preventDefault();
        handleEscapePress();
      }
      
      // F11: Toggle fullscreen while in zen mode
      if (e.key === "F11" && zenModeActive()) {
        e.preventDefault();
        if (zenModeFullscreen()) {
          exitFullscreen();
        } else {
          enterFullscreen();
        }
      }
    };
    
    // Listen for zen mode toggle command from command palette
    const handleZenModeCommand = () => {
      if (zenModeActive()) {
        exitZenMode();
      } else {
        enterZenMode();
        
        // Check if fullscreen should be enabled automatically
        const zenSettings = effectiveSettings().zenMode;
        if (zenSettings?.fullScreen) {
          enterFullscreen();
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("zenmode:toggle", handleZenModeCommand);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("zenmode:toggle", handleZenModeCommand);
      
      // Clean up timeout on unmount
      const timeout = escapeTimeout();
      if (timeout) {
        clearTimeout(timeout);
      }
    });
  });
  
  return <>{props.children}</>;
}

// ============================================================================
// CSS Classes for Zen Mode Transitions
// ============================================================================

/**
 * CSS class names to apply for zen mode transitions.
 * Use these in your components to add smooth show/hide animations.
 */
export const zenModeClasses = {
  /** Class for elements that should fade out in zen mode */
  fadeOut: "zen-fade-out",
  /** Class for elements that should slide out to the left */
  slideLeft: "zen-slide-left",
  /** Class for elements that should slide out to the right */
  slideRight: "zen-slide-right",
  /** Class for elements that should slide up */
  slideUp: "zen-slide-up",
  /** Class for elements that should slide down */
  slideDown: "zen-slide-down",
} as const;

/**
 * Inline styles for zen mode transitions.
 * Apply these dynamically based on zen mode state.
 */
export function getZenModeTransitionStyle(
  isZenMode: boolean,
  direction: "left" | "right" | "up" | "down" | "fade" = "fade"
): Record<string, string> {
  const baseTransition = "all 300ms cubic-bezier(0.4, 0, 0.2, 1)";
  
  if (!isZenMode) {
    return {
      opacity: "1",
      transform: "translate(0, 0)",
      transition: baseTransition,
    };
  }
  
  const transforms: Record<string, string> = {
    left: "translateX(-100%)",
    right: "translateX(100%)",
    up: "translateY(-100%)",
    down: "translateY(100%)",
    fade: "translate(0, 0)",
  };
  
  return {
    opacity: "0",
    transform: transforms[direction],
    transition: baseTransition,
    "pointer-events": "none",
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  zenModeActive,
  zenModeFullscreen,
  zenModeSavedState,
  enterZenMode,
  exitZenMode,
  enterFullscreen,
  exitFullscreen,
  cachedZenModeSettings,
  DEFAULT_ZEN_MODE_SETTINGS,
};


