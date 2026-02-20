import { createContext, useContext, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { useTauriListeners } from "../hooks";

// ============================================================================
// Types
// ============================================================================

export type AuxiliaryWindowType = "editor" | "terminal" | "preview" | "panel" | "custom";

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowBounds {
  position: WindowPosition;
  size: WindowSize;
}

export interface AuxiliaryWindowOptions {
  /** Window title */
  title?: string;
  /** Type of content */
  type: AuxiliaryWindowType;
  /** Content identifier (file path for editor, panel id, etc.) */
  contentId: string;
  /** Initial window position */
  position?: WindowPosition;
  /** Initial window size */
  size?: WindowSize;
  /** Whether the window should be resizable */
  resizable?: boolean;
  /** Whether the window should have decorations */
  decorations?: boolean;
  /** Whether the window should be always on top */
  alwaysOnTop?: boolean;
  /** Whether the window should be focused on creation */
  focus?: boolean;
  /** Custom metadata for the window */
  metadata?: Record<string, unknown>;
}

export interface AuxiliaryWindow {
  /** Unique window identifier */
  id: string;
  /** Window label used by Tauri */
  label: string;
  /** Window title */
  title: string;
  /** Type of content in the window */
  type: AuxiliaryWindowType;
  /** Content identifier */
  contentId: string;
  /** Whether the window is focused */
  focused: boolean;
  /** Whether the window is minimized */
  minimized: boolean;
  /** Whether the window is maximized */
  maximized: boolean;
  /** Window bounds (position and size) */
  bounds: WindowBounds;
  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
}

export interface WindowStateUpdate {
  id: string;
  focused?: boolean;
  minimized?: boolean;
  maximized?: boolean;
  bounds?: Partial<WindowBounds>;
}

export interface WindowContentSync {
  windowId: string;
  contentId: string;
  type: AuxiliaryWindowType;
  data: unknown;
}

export interface MergeWindowRequest {
  windowId: string;
  targetGroupId?: string;
}

// ============================================================================
// Event Types for Inter-Window Communication
// ============================================================================

export type WindowEventType =
  | "window:created"
  | "window:closed"
  | "window:focused"
  | "window:moved"
  | "window:resized"
  | "window:content-sync"
  | "window:state-changed"
  | "window:merge-request"
  | "window:detach-request";

export interface WindowEvent<T = unknown> {
  type: WindowEventType;
  windowId: string;
  timestamp: number;
  payload: T;
}

// ============================================================================
// Context State
// ============================================================================

interface WindowsState {
  windows: AuxiliaryWindow[];
  activeWindowId: string | null;
  isMainWindow: boolean;
  mainWindowLabel: string;
}

interface WindowsContextValue {
  /** Current state */
  state: WindowsState;
  /** Open a new auxiliary window */
  openWindow: (options: AuxiliaryWindowOptions) => Promise<AuxiliaryWindow | null>;
  /** Close an auxiliary window */
  closeWindow: (id: string) => Promise<void>;
  /** Focus an auxiliary window */
  focusWindow: (id: string) => Promise<void>;
  /** Minimize an auxiliary window */
  minimizeWindow: (id: string) => Promise<void>;
  /** Maximize an auxiliary window */
  maximizeWindow: (id: string) => Promise<void>;
  /** Restore an auxiliary window from minimized/maximized state */
  restoreWindow: (id: string) => Promise<void>;
  /** Get window by ID */
  getWindow: (id: string) => AuxiliaryWindow | undefined;
  /** Get window by content ID */
  getWindowByContent: (contentId: string) => AuxiliaryWindow | undefined;
  /** Check if content is in an auxiliary window */
  isContentInWindow: (contentId: string) => boolean;
  /** Update window bounds */
  updateWindowBounds: (id: string, bounds: Partial<WindowBounds>) => Promise<void>;
  /** Send data to a specific window */
  sendToWindow: (id: string, data: WindowContentSync) => Promise<void>;
  /** Broadcast data to all auxiliary windows */
  broadcastToWindows: (data: WindowContentSync) => Promise<void>;
  /** Request to merge a window back into the main window */
  requestMerge: (windowId: string, targetGroupId?: string) => Promise<void>;
  /** Request to detach content into a new window */
  requestDetach: (contentId: string, type: AuxiliaryWindowType, position?: WindowPosition) => Promise<AuxiliaryWindow | null>;
  /** Subscribe to window events */
  onWindowEvent: (callback: (event: WindowEvent) => void) => () => void;
  /** Close all auxiliary windows */
  closeAllWindows: () => Promise<void>;
  /** Get all windows of a specific type */
  getWindowsByType: (type: AuxiliaryWindowType) => AuxiliaryWindow[];
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "cortex_auxiliary_windows";
const MAIN_WINDOW_LABEL = "main";
const WINDOW_PREFIX = "aux_";

const DEFAULT_WINDOW_SIZE: WindowSize = {
  width: 800,
  height: 600,
};

const DEFAULT_WINDOW_OPTIONS: Partial<AuxiliaryWindowOptions> = {
  resizable: true,
  decorations: true,
  alwaysOnTop: false,
  focus: true,
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateWindowId(): string {
  return `${WINDOW_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateWindowLabel(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function serializeWindowState(windows: AuxiliaryWindow[]): string {
  const persistedData = windows.map((w) => ({
    id: w.id,
    label: w.label,
    title: w.title,
    type: w.type,
    contentId: w.contentId,
    bounds: w.bounds,
    metadata: w.metadata,
  }));
  return JSON.stringify(persistedData);
}


// ============================================================================
// Context
// ============================================================================

const WindowsContext = createContext<WindowsContextValue>();

export function WindowsProvider(props: ParentProps) {
  const currentWindow = getCurrentWebviewWindow();
  const isMainWindow = currentWindow.label === MAIN_WINDOW_LABEL || currentWindow.label.startsWith("main-");

  const [state, setState] = createStore<WindowsState>({
    windows: [],
    activeWindowId: null,
    isMainWindow,
    mainWindowLabel: MAIN_WINDOW_LABEL,
  });

  // Track active WebviewWindow instances
  const windowInstances = new Map<string, WebviewWindow>();
  
  // Event subscribers
  const eventSubscribers = new Set<(event: WindowEvent) => void>();

  // ============================================================================
  // Event Emission Helper
  // ============================================================================

  const emitWindowEvent = <T,>(type: WindowEventType, windowId: string, payload: T): void => {
    const event: WindowEvent<T> = {
      type,
      windowId,
      timestamp: Date.now(),
      payload,
    };
    
    // Notify local subscribers
    for (const subscriber of eventSubscribers) {
      try {
        subscriber(event);
      } catch (e) {
        console.error("[Windows] Event subscriber error:", e);
      }
    }
    
    // Broadcast to other windows via Tauri events
    emit("cortex:window-event", event).catch((e) => {
      console.error("[Windows] Failed to emit event:", e);
    });
  };

  // ============================================================================
  // Window Management Functions
  // ============================================================================

  const openWindow = async (options: AuxiliaryWindowOptions): Promise<AuxiliaryWindow | null> => {
    if (!isMainWindow) {
      // Auxiliary windows should request the main window to create new windows
      await emit("cortex:window-open-request", options);
      return null;
    }

    // Check if content is already in a window
    const existingWindow = state.windows.find((w) => w.contentId === options.contentId);
    if (existingWindow) {
      await focusWindow(existingWindow.id);
      return existingWindow;
    }

    const id = generateWindowId();
    const label = generateWindowLabel(id);
    const mergedOptions = { ...DEFAULT_WINDOW_OPTIONS, ...options };
    
    const title = mergedOptions.title || `${options.type}: ${options.contentId}`;
    const size = mergedOptions.size || DEFAULT_WINDOW_SIZE;
    const position = mergedOptions.position;

    try {
      // Create the Tauri WebviewWindow
      const webviewWindow = new WebviewWindow(label, {
        title,
        width: size.width,
        height: size.height,
        x: position?.x,
        y: position?.y,
        resizable: mergedOptions.resizable,
        decorations: mergedOptions.decorations,
        alwaysOnTop: mergedOptions.alwaysOnTop,
        focus: mergedOptions.focus,
        url: `index.html?window=${label}&type=${options.type}&content=${encodeURIComponent(options.contentId)}`,
      });

      // Wait for window to be created
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Window creation timeout"));
        }, 10000);

        webviewWindow.once("tauri://created", () => {
          clearTimeout(timeoutId);
          resolve();
        });

        webviewWindow.once("tauri://error", (e) => {
          clearTimeout(timeoutId);
          reject(new Error(String(e.payload)));
        });
      });

      // Store the window instance
      windowInstances.set(id, webviewWindow);

      // Create the window record
      const auxiliaryWindow: AuxiliaryWindow = {
        id,
        label,
        title,
        type: options.type,
        contentId: options.contentId,
        focused: mergedOptions.focus ?? true,
        minimized: false,
        maximized: false,
        bounds: {
          position: position || { x: 0, y: 0 },
          size,
        },
        metadata: mergedOptions.metadata || {},
        createdAt: Date.now(),
      };

      // Update state
      setState("windows", (windows) => [...windows, auxiliaryWindow]);
      setState("activeWindowId", id);

      // Set up window event listeners
      setupWindowListeners(id, webviewWindow);

      // Persist state
      persistWindowState();

      // Emit event
      emitWindowEvent("window:created", id, auxiliaryWindow);

      return auxiliaryWindow;
    } catch (e) {
      console.error("[Windows] Failed to create window:", e);
      return null;
    }
  };

  const closeWindow = async (id: string): Promise<void> => {
    const windowInstance = windowInstances.get(id);
    const windowRecord = state.windows.find((w) => w.id === id);
    
    if (!windowRecord) return;

    try {
      if (windowInstance) {
        await windowInstance.close();
        windowInstances.delete(id);
      }
    } catch (e) {
      console.error("[Windows] Failed to close window:", e);
    }

    // Update state
    setState("windows", (windows) => windows.filter((w) => w.id !== id));
    
    if (state.activeWindowId === id) {
      const remainingWindows = state.windows.filter((w) => w.id !== id);
      setState("activeWindowId", remainingWindows[0]?.id || null);
    }

    // Persist state
    persistWindowState();

    // Emit event
    emitWindowEvent("window:closed", id, { contentId: windowRecord.contentId });
  };

  const focusWindow = async (id: string): Promise<void> => {
    const windowInstance = windowInstances.get(id);
    
    if (windowInstance) {
      try {
        await windowInstance.setFocus();
        
        setState(
          "windows",
          (w) => w.id === id,
          produce((window) => {
            window.focused = true;
            window.minimized = false;
          })
        );
        
        setState(
          "windows",
          (w) => w.id !== id,
          "focused",
          false
        );
        
        setState("activeWindowId", id);

        emitWindowEvent("window:focused", id, {});
      } catch (e) {
        console.error("[Windows] Failed to focus window:", e);
      }
    }
  };

  const minimizeWindow = async (id: string): Promise<void> => {
    const windowInstance = windowInstances.get(id);
    
    if (windowInstance) {
      try {
        await windowInstance.minimize();
        
        setState(
          "windows",
          (w) => w.id === id,
          produce((window) => {
            window.minimized = true;
            window.focused = false;
          })
        );

        emitWindowEvent("window:state-changed", id, { minimized: true });
      } catch (e) {
        console.error("[Windows] Failed to minimize window:", e);
      }
    }
  };

  const maximizeWindow = async (id: string): Promise<void> => {
    const windowInstance = windowInstances.get(id);
    
    if (windowInstance) {
      try {
        await windowInstance.maximize();
        
        setState(
          "windows",
          (w) => w.id === id,
          produce((window) => {
            window.maximized = true;
            window.minimized = false;
          })
        );

        emitWindowEvent("window:state-changed", id, { maximized: true });
      } catch (e) {
        console.error("[Windows] Failed to maximize window:", e);
      }
    }
  };

  const restoreWindow = async (id: string): Promise<void> => {
    const windowInstance = windowInstances.get(id);
    
    if (windowInstance) {
      try {
        await windowInstance.unminimize();
        await windowInstance.unmaximize();
        
        setState(
          "windows",
          (w) => w.id === id,
          produce((window) => {
            window.minimized = false;
            window.maximized = false;
          })
        );

        emitWindowEvent("window:state-changed", id, { minimized: false, maximized: false });
      } catch (e) {
        console.error("[Windows] Failed to restore window:", e);
      }
    }
  };

  const updateWindowBounds = async (id: string, bounds: Partial<WindowBounds>): Promise<void> => {
    const windowInstance = windowInstances.get(id);
    
    if (windowInstance) {
      try {
        if (bounds.position) {
          await windowInstance.setPosition(
            new (await import("@tauri-apps/api/dpi")).LogicalPosition(
              bounds.position.x,
              bounds.position.y
            )
          );
        }
        
        if (bounds.size) {
          await windowInstance.setSize(
            new (await import("@tauri-apps/api/dpi")).LogicalSize(
              bounds.size.width,
              bounds.size.height
            )
          );
        }

        setState(
          "windows",
          (w) => w.id === id,
          produce((window) => {
            if (bounds.position) {
              window.bounds.position = bounds.position;
            }
            if (bounds.size) {
              window.bounds.size = bounds.size;
            }
          })
        );

        persistWindowState();
        
        emitWindowEvent("window:resized", id, bounds);
      } catch (e) {
        console.error("[Windows] Failed to update window bounds:", e);
      }
    }
  };

  // ============================================================================
  // Query Functions
  // ============================================================================

  const getWindow = (id: string): AuxiliaryWindow | undefined => {
    return state.windows.find((w) => w.id === id);
  };

  const getWindowByContent = (contentId: string): AuxiliaryWindow | undefined => {
    return state.windows.find((w) => w.contentId === contentId);
  };

  const isContentInWindow = (contentId: string): boolean => {
    return state.windows.some((w) => w.contentId === contentId);
  };

  const getWindowsByType = (type: AuxiliaryWindowType): AuxiliaryWindow[] => {
    return state.windows.filter((w) => w.type === type);
  };

  // ============================================================================
  // Communication Functions
  // ============================================================================

  const sendToWindow = async (id: string, data: WindowContentSync): Promise<void> => {
    const windowRecord = state.windows.find((w) => w.id === id);
    
    if (windowRecord) {
      await emit(`cortex:window-sync:${windowRecord.label}`, data);
    }
  };

  const broadcastToWindows = async (data: WindowContentSync): Promise<void> => {
    await emit("cortex:window-broadcast", data);
  };

  const requestMerge = async (windowId: string, targetGroupId?: string): Promise<void> => {
    const windowRecord = state.windows.find((w) => w.id === windowId);
    
    if (windowRecord) {
      const request: MergeWindowRequest = {
        windowId,
        targetGroupId,
      };
      
      emitWindowEvent("window:merge-request", windowId, request);
      
      // Close the auxiliary window after merge request is processed
      await closeWindow(windowId);
    }
  };

  const requestDetach = async (
    contentId: string,
    type: AuxiliaryWindowType,
    position?: WindowPosition
  ): Promise<AuxiliaryWindow | null> => {
    emitWindowEvent("window:detach-request", "main", { contentId, type });
    
    return openWindow({
      type,
      contentId,
      position,
      focus: true,
    });
  };

  // ============================================================================
  // Event Subscription
  // ============================================================================

  const onWindowEvent = (callback: (event: WindowEvent) => void): (() => void) => {
    eventSubscribers.add(callback);
    return () => eventSubscribers.delete(callback);
  };

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  const closeAllWindows = async (): Promise<void> => {
    const windowIds = state.windows.map((w) => w.id);
    
    for (const id of windowIds) {
      await closeWindow(id);
    }
  };

  // ============================================================================
  // Window Event Listeners Setup
  // ============================================================================

  const setupWindowListeners = (id: string, webviewWindow: WebviewWindow): void => {
    // Focus event
    webviewWindow.onFocusChanged(({ payload: focused }) => {
      setState(
        "windows",
        (w) => w.id === id,
        "focused",
        focused
      );
      
      if (focused) {
        setState("activeWindowId", id);
        emitWindowEvent("window:focused", id, {});
      }
    }).catch(console.error);

    // Move event
    webviewWindow.onMoved(({ payload }) => {
      setState(
        "windows",
        (w) => w.id === id,
        "bounds",
        "position",
        { x: payload.x, y: payload.y }
      );
      
      persistWindowState();
      emitWindowEvent("window:moved", id, { x: payload.x, y: payload.y });
    }).catch(console.error);

    // Resize event
    webviewWindow.onResized(({ payload }) => {
      setState(
        "windows",
        (w) => w.id === id,
        "bounds",
        "size",
        { width: payload.width, height: payload.height }
      );
      
      persistWindowState();
      emitWindowEvent("window:resized", id, { width: payload.width, height: payload.height });
    }).catch(console.error);

    // Close event
    webviewWindow.onCloseRequested(async (event) => {
      // Allow the window to close
      event.preventDefault();
      await closeWindow(id);
    }).catch(console.error);
  };

  // ============================================================================
  // Persistence
  // ============================================================================

  const persistWindowState = (): void => {
    try {
      const serialized = serializeWindowState(state.windows);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (e) {
      console.error("[Windows] Failed to persist state:", e);
    }
  };


  // ============================================================================
  // Initialization and Cleanup
  // ============================================================================

  // Register cleanup synchronously
  onCleanup(() => {
    // Close all auxiliary windows when main window closes
    if (isMainWindow) {
      closeAllWindows().catch(console.error);
    }
  });

  // Set up global event listeners using useTauriListeners (only for main window)
  // Note: The hook handles cleanup automatically
  if (isMainWindow) {
    useTauriListeners([
      {
        event: "cortex:window-event",
        handler: (payload: WindowEvent) => {
          for (const subscriber of eventSubscribers) {
            try {
              subscriber(payload);
            } catch (e) {
              console.error("[Windows] Event subscriber error:", e);
            }
          }
        },
      },
      {
        event: "cortex:window-open-request",
        handler: async (payload: unknown) => {
          await openWindow(payload as AuxiliaryWindowOptions);
        },
      },
      {
        event: "cortex:window-merge-request",
        handler: (payload: MergeWindowRequest) => {
          emitWindowEvent("window:merge-request", payload.windowId, payload);
        },
      },
    ]);
  }

  onMount(() => {
    if (!isMainWindow) {
      // Auxiliary windows don't manage other windows
      return;
    }

    // Load persisted window state (positions/sizes for recreation)
    // Note: We don't automatically recreate windows on startup
    // This is just for reference if user wants to restore
    
    
    // Clear the persisted state on fresh start
    localStorage.removeItem(STORAGE_KEY);
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: WindowsContextValue = {
    state,
    openWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    getWindow,
    getWindowByContent,
    isContentInWindow,
    updateWindowBounds,
    sendToWindow,
    broadcastToWindows,
    requestMerge,
    requestDetach,
    onWindowEvent,
    closeAllWindows,
    getWindowsByType,
  };

  return (
    <WindowsContext.Provider value={contextValue}>
      {props.children}
    </WindowsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWindows(): WindowsContextValue {
  const context = useContext(WindowsContext);
  if (!context) {
    throw new Error("useWindows must be used within WindowsProvider");
  }
  return context;
}

// ============================================================================
// Utility Hook for Auxiliary Windows
// ============================================================================

export interface AuxiliaryWindowInfo {
  windowId: string | null;
  windowLabel: string | null;
  windowType: AuxiliaryWindowType | null;
  contentId: string | null;
  isAuxiliaryWindow: boolean;
}

export function useAuxiliaryWindowInfo(): AuxiliaryWindowInfo {
  const urlParams = new URLSearchParams(window.location.search);
  let windowLabel = urlParams.get("window");
  const windowType = urlParams.get("type") as AuxiliaryWindowType | null;
  const contentId = urlParams.get("content");

  // Robustness: Fallback to Tauri's own window label if URL param is missing
  if (!windowLabel) {
    try {
      windowLabel = getCurrentWebviewWindow().label;
    } catch (err) {
      console.debug("[Windows] Get window label failed:", err);
      windowLabel = null;
    }
  }

  // A window is truly an auxiliary content window if it's explicitly labeled as one
  // or if it has the required auxiliary parameters and isn't a known main window type.
  // This prevents misclassification of main/secondary IDE windows as auxiliary windows.
  const isAuxiliary = (windowLabel?.startsWith(WINDOW_PREFIX)) || 
                      (windowLabel !== null && 
                       windowLabel !== MAIN_WINDOW_LABEL && 
                       !windowLabel.startsWith("main-") &&
                       windowType !== null && 
                       contentId !== null);

  return {
    windowId: windowLabel,
    windowLabel,
    windowType,
    contentId: contentId ? decodeURIComponent(contentId) : null,
    isAuxiliaryWindow: !!isAuxiliary,
  };
}
