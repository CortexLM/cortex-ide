import { Component, createSignal, createEffect, onMount, onCleanup, Show, Switch, Match, JSX } from "solid-js";
import { listen, emit, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  useAuxiliaryWindowInfo,
  AuxiliaryWindowType,
  WindowContentSync,
  WindowEvent,
} from "@/context/WindowsContext";

// ============================================================================
// Types
// ============================================================================

export interface AuxiliaryWindowProps {
  /** Render function for editor content */
  renderEditor?: (contentId: string, onClose: () => void) => JSX.Element;
  /** Render function for terminal content */
  renderTerminal?: (contentId: string, onClose: () => void) => JSX.Element;
  /** Render function for preview content */
  renderPreview?: (contentId: string, onClose: () => void) => JSX.Element;
  /** Render function for panel content */
  renderPanel?: (contentId: string, onClose: () => void) => JSX.Element;
  /** Render function for custom content */
  renderCustom?: (contentId: string, metadata: Record<string, unknown>, onClose: () => void) => JSX.Element;
  /** Callback when window requests to merge back */
  onMergeRequest?: (contentId: string, windowType: AuxiliaryWindowType) => void;
  /** Callback when content is synchronized */
  onContentSync?: (data: WindowContentSync) => void;
  /** Custom header component */
  headerComponent?: (props: AuxiliaryWindowHeaderProps) => JSX.Element;
  /** CSS class for the window container */
  class?: string;
  /** Additional styles for the window container */
  style?: JSX.CSSProperties;
}

export interface AuxiliaryWindowHeaderProps {
  title: string;
  windowType: AuxiliaryWindowType;
  contentId: string;
  onClose: () => void;
  onMerge: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

export interface SyncedState<T = unknown> {
  data: T;
  timestamp: number;
  source: string;
}

// ============================================================================
// Default Header Component
// ============================================================================

const DefaultHeader: Component<AuxiliaryWindowHeaderProps> = (props) => {
  const getTypeIcon = (): string => {
    switch (props.windowType) {
      case "editor": return "📄";
      case "terminal": return "⬛";
      case "preview": return "👁";
      case "panel": return "📊";
      default: return "🪟";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        height: "32px",
        padding: "0 8px",
        background: "var(--color-bg-secondary, var(--cortex-bg-primary))",
        "border-bottom": "1px solid var(--color-border, #333)",
        "-webkit-app-region": "drag",
        "user-select": "none",
      }}
    >
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span>{getTypeIcon()}</span>
        <span
          style={{
            "font-size": "12px",
            color: "var(--color-text, #ccc)",
            "max-width": "300px",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {props.title}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "4px",
          "-webkit-app-region": "no-drag",
        }}
      >
        <button
          onClick={props.onMerge}
          title="Merge back to main window"
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            "border-radius": "var(--cortex-radius-sm)",
            color: "var(--color-text-secondary, #888)",
            "font-size": "11px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-bg-hover, #333)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          ↩ Merge
        </button>

        <button
          onClick={props.onMinimize}
          title="Minimize"
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            "border-radius": "var(--cortex-radius-sm)",
            color: "var(--color-text-secondary, #888)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-bg-hover, #333)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          −
        </button>

        <button
          onClick={props.onMaximize}
          title="Maximize"
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            "border-radius": "var(--cortex-radius-sm)",
            color: "var(--color-text-secondary, #888)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-bg-hover, #333)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          □
        </button>

        <button
          onClick={props.onClose}
          title="Close"
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            "border-radius": "var(--cortex-radius-sm)",
            color: "var(--color-text-secondary, #888)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--cortex-error)";
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-text-secondary, #888)";
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Fallback Content Components
// ============================================================================

const FallbackContent: Component<{ type: string; contentId: string }> = (props) => {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        height: "100%",
        padding: "32px",
        color: "var(--color-text-secondary, #888)",
        "text-align": "center",
      }}
    >
      <div style={{ "font-size": "48px", "margin-bottom": "16px" }}>🪟</div>
      <div style={{ "font-size": "16px", "margin-bottom": "8px" }}>
        Content type: <strong>{props.type}</strong>
      </div>
      <div style={{ "font-size": "12px", "word-break": "break-all" }}>
        Content ID: {props.contentId}
      </div>
      <div
        style={{
          "margin-top": "24px",
          "font-size": "12px",
          "max-width": "400px",
          color: "var(--color-text-tertiary, #666)",
        }}
      >
        No renderer provided for this content type.
        Pass a render function via the appropriate prop.
      </div>
    </div>
  );
};

const LoadingContent: Component = () => {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        height: "100%",
        color: "var(--color-text-secondary, #888)",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "2px solid var(--color-border, #333)",
          "border-top-color": "var(--color-primary, var(--cortex-info))",
          "border-radius": "var(--cortex-radius-full)",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ "margin-top": "16px", "font-size": "14px" }}>
        Loading content...
      </div>
    </div>
  );
};

const ErrorContent: Component<{ message: string }> = (props) => {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        height: "100%",
        padding: "32px",
        color: "var(--color-error, #f44)",
        "text-align": "center",
      }}
    >
      <div style={{ "font-size": "48px", "margin-bottom": "16px" }}>⚠️</div>
      <div style={{ "font-size": "14px" }}>{props.message}</div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AuxiliaryWindow: Component<AuxiliaryWindowProps> = (props) => {
  const windowInfo = useAuxiliaryWindowInfo();
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [syncedData, setSyncedData] = createSignal<SyncedState | null>(null);
  const [isMaximized, setIsMaximized] = createSignal(false);

  let unlistenFunctions: UnlistenFn[] = [];

  const currentWindow = getCurrentWebviewWindow();

  // ============================================================================
  // Window Control Functions
  // ============================================================================

  const handleClose = async (): Promise<void> => {
    try {
      // Emit close event for the main window to handle cleanup
      await emit("cortex:window-close-request", {
        windowId: windowInfo.windowId,
        contentId: windowInfo.contentId,
        windowType: windowInfo.windowType,
      });
      
      await currentWindow.close();
    } catch (e) {
      console.error("[AuxiliaryWindow] Failed to close:", e);
    }
  };

  const handleMerge = async (): Promise<void> => {
    if (windowInfo.contentId && windowInfo.windowType) {
      props.onMergeRequest?.(windowInfo.contentId, windowInfo.windowType);
      
      await emit("cortex:window-merge-request", {
        windowId: windowInfo.windowId,
        contentId: windowInfo.contentId,
        windowType: windowInfo.windowType,
      });
      
      await currentWindow.close();
    }
  };

  const handleMinimize = async (): Promise<void> => {
    try {
      await currentWindow.minimize();
    } catch (e) {
      console.error("[AuxiliaryWindow] Failed to minimize:", e);
    }
  };

  const handleMaximize = async (): Promise<void> => {
    try {
      if (isMaximized()) {
        await currentWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await currentWindow.maximize();
        setIsMaximized(true);
      }
    } catch (e) {
      console.error("[AuxiliaryWindow] Failed to maximize:", e);
    }
  };

  // ============================================================================
  // Content Sync
  // ============================================================================

  const setupSyncListeners = async (): Promise<void> => {
    // Listen for window-specific sync events
    if (windowInfo.windowLabel) {
      const unlistenSync = await listen<WindowContentSync>(
        `cortex:window-sync:${windowInfo.windowLabel}`,
        (event) => {
          setSyncedData({
            data: event.payload.data,
            timestamp: Date.now(),
            source: "direct",
          });
          props.onContentSync?.(event.payload);
        }
      );
      unlistenFunctions.push(unlistenSync);
    }

    // Listen for broadcast events
    const unlistenBroadcast = await listen<WindowContentSync>(
      "cortex:window-broadcast",
      (event) => {
        // Only process if the content matches
        if (event.payload.contentId === windowInfo.contentId) {
          setSyncedData({
            data: event.payload.data,
            timestamp: Date.now(),
            source: "broadcast",
          });
          props.onContentSync?.(event.payload);
        }
      }
    );
    unlistenFunctions.push(unlistenBroadcast);

    // Listen for global window events
    const unlistenWindowEvents = await listen<WindowEvent>(
      "cortex:window-event",
      (event) => {
        if (event.payload.windowId === windowInfo.windowId) {
          handleWindowEvent(event.payload);
        }
      }
    );
    unlistenFunctions.push(unlistenWindowEvents);
  };

  const handleWindowEvent = (event: WindowEvent): void => {
    switch (event.type) {
      case "window:state-changed":
        // Handle state changes from main window
        break;
      case "window:content-sync":
        setSyncedData({
          data: event.payload,
          timestamp: event.timestamp,
          source: "event",
        });
        break;
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(async () => {
    if (!windowInfo.isAuxiliaryWindow) {
      setError("This component should only be used in auxiliary windows");
      setIsLoading(false);
      return;
    }

    if (!windowInfo.contentId || !windowInfo.windowType) {
      setError("Missing window parameters");
      setIsLoading(false);
      return;
    }

    try {
      await setupSyncListeners();

      // Notify main window that we're ready
      await emit("cortex:window-ready", {
        windowId: windowInfo.windowId,
        contentId: windowInfo.contentId,
        windowType: windowInfo.windowType,
      });

      // Check initial maximized state
      const maximized = await currentWindow.isMaximized();
      setIsMaximized(maximized);

      setIsLoading(false);
    } catch (e) {
      console.error("[AuxiliaryWindow] Initialization failed:", e);
      setError("Failed to initialize window");
      setIsLoading(false);
    }
  });

  onCleanup(() => {
    for (const unlisten of unlistenFunctions) {
      unlisten();
    }
    unlistenFunctions = [];
  });

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd/Ctrl + W to close
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        handleClose();
      }
      // Cmd/Ctrl + Shift + M to merge
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "m") {
        e.preventDefault();
        handleMerge();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // ============================================================================
  // Render Content
  // ============================================================================

  const renderContent = (): JSX.Element => {
    if (!windowInfo.contentId || !windowInfo.windowType) {
      return <ErrorContent message="Invalid window configuration" />;
    }

    const contentId = windowInfo.contentId;
    const onClose = handleClose;

    return (
      <Switch fallback={<FallbackContent type={windowInfo.windowType} contentId={contentId} />}>
        <Match when={windowInfo.windowType === "editor" && props.renderEditor}>
          {props.renderEditor!(contentId, onClose)}
        </Match>
        <Match when={windowInfo.windowType === "terminal" && props.renderTerminal}>
          {props.renderTerminal!(contentId, onClose)}
        </Match>
        <Match when={windowInfo.windowType === "preview" && props.renderPreview}>
          {props.renderPreview!(contentId, onClose)}
        </Match>
        <Match when={windowInfo.windowType === "panel" && props.renderPanel}>
          {props.renderPanel!(contentId, onClose)}
        </Match>
        <Match when={windowInfo.windowType === "custom" && props.renderCustom}>
          {props.renderCustom!(contentId, syncedData()?.data as Record<string, unknown> || {}, onClose)}
        </Match>
      </Switch>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  const HeaderComponent = props.headerComponent || DefaultHeader;

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100vh",
        width: "100vw",
        background: "var(--color-bg, var(--cortex-bg-primary))",
        color: "var(--color-text, #ccc)",
        overflow: "hidden",
        ...props.style,
      }}
    >
      <Show when={windowInfo.isAuxiliaryWindow && windowInfo.contentId && windowInfo.windowType}>
        <HeaderComponent
          title={windowInfo.contentId || "Untitled"}
          windowType={windowInfo.windowType!}
          contentId={windowInfo.contentId!}
          onClose={handleClose}
          onMerge={handleMerge}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
        />
      </Show>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <Show when={isLoading()}>
          <LoadingContent />
        </Show>
        
        <Show when={error()}>
          <ErrorContent message={error()!} />
        </Show>
        
        <Show when={!isLoading() && !error()}>
          {renderContent()}
        </Show>
      </div>
    </div>
  );
};

// ============================================================================
// Hook for Synced State in Auxiliary Windows
// ============================================================================

export interface UseSyncedStateOptions<T> {
  initialValue: T;
  syncKey: string;
  debounceMs?: number;
}

export function useSyncedState<T>(options: UseSyncedStateOptions<T>): [
  () => T,
  (value: T | ((prev: T) => T)) => void,
  () => boolean
] {
  const windowInfo = useAuxiliaryWindowInfo();
  const [value, setValue] = createSignal<T>(options.initialValue);
  const [isSyncing, setIsSyncing] = createSignal(false);
  
  let syncTimeout: ReturnType<typeof setTimeout> | null = null;

  const emitSync = (newValue: T): void => {
    if (!windowInfo.isAuxiliaryWindow) return;

    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    const debounceMs = options.debounceMs ?? 100;
    
    syncTimeout = setTimeout(() => {
      setIsSyncing(true);
      
      emit("cortex:state-sync", {
        windowId: windowInfo.windowId,
        contentId: windowInfo.contentId,
        syncKey: options.syncKey,
        value: newValue,
        timestamp: Date.now(),
      }).finally(() => {
        setIsSyncing(false);
      });
    }, debounceMs);
  };

  const setValueWithSync = (newValueOrFn: T | ((prev: T) => T)): void => {
    const newValue = typeof newValueOrFn === "function"
      ? (newValueOrFn as (prev: T) => T)(value())
      : newValueOrFn;
    
    setValue(() => newValue);
    emitSync(newValue);
  };

  // Listen for incoming sync
  onMount(async () => {
    const unlisten = await listen<{
      syncKey: string;
      value: T;
      windowId: string;
    }>("cortex:state-sync-incoming", (event) => {
      if (
        event.payload.syncKey === options.syncKey &&
        event.payload.windowId !== windowInfo.windowId
      ) {
        setValue(() => event.payload.value);
      }
    });

    onCleanup(() => {
      unlisten();
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
    });
  });

  return [value, setValueWithSync, isSyncing];
}

// ============================================================================
// Tab Detach Helper
// ============================================================================

export interface TabDetachConfig {
  contentId: string;
  type: AuxiliaryWindowType;
  title?: string;
  size?: { width: number; height: number };
}

export async function detachTabToWindow(config: TabDetachConfig): Promise<void> {
  await emit("cortex:window-open-request", {
    type: config.type,
    contentId: config.contentId,
    title: config.title,
    size: config.size,
    focus: true,
  });
}

// ============================================================================
// Tab Context Menu Helper
// ============================================================================

export interface TabContextMenuAction {
  label: string;
  action: () => void | Promise<void>;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

export function getDetachTabAction(contentId: string, type: AuxiliaryWindowType): TabContextMenuAction {
  return {
    label: "Move to New Window",
    icon: "🪟",
    shortcut: "Ctrl+Shift+O",
    action: async () => {
      await detachTabToWindow({ contentId, type });
    },
  };
}

// ============================================================================
// Drag-to-Detach Hook
// ============================================================================

export interface UseDragDetachOptions {
  contentId: string;
  type: AuxiliaryWindowType;
  title?: string;
  threshold?: number;
}

export interface DragDetachHandlers {
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  draggable: boolean;
}

export function useDragDetach(options: UseDragDetachOptions): DragDetachHandlers {
  const threshold = options.threshold ?? 50;
  let dragStartY = 0;
  let isDraggingOut = false;

  const onDragStart = (e: DragEvent): void => {
    dragStartY = e.clientY;
    isDraggingOut = false;
    
    // Set drag data
    e.dataTransfer?.setData("text/plain", JSON.stringify({
      contentId: options.contentId,
      type: options.type,
      title: options.title,
    }));
  };

  const onDragEnd = async (e: DragEvent): Promise<void> => {
    const deltaY = e.clientY - dragStartY;
    
    // Check if dragged outside the tab bar area (downward)
    if (deltaY > threshold && !isDraggingOut) {
      isDraggingOut = true;
      
      await detachTabToWindow({
        contentId: options.contentId,
        type: options.type,
        title: options.title,
        size: { width: 800, height: 600 },
      });
    }
  };

  return {
    onDragStart,
    onDragEnd,
    draggable: true,
  };
}

export default AuxiliaryWindow;

