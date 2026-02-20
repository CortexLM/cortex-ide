import { Show, createMemo, onMount, onCleanup, JSX } from "solid-js";
import { useDebug } from "@/context/DebugContext";
import { useDebugSettings, DebugSettings } from "@/context/SettingsContext";
import { Icon } from "@/components/ui/Icon";
import { createLogger } from "@/utils/logger";

const debugToolbarLogger = createLogger("DebugToolbar");

/**
 * Debug Toolbar - VS Code Specification Compliant
 * 
 * Specs:
 * - Height: 28px (fixed)
 * - Z-index: 2520 (below quick input 2550, above titlebar 2500)
 * - Icon size: 16px (background-size)
 * - Layout: flex with 4px margin-right for actions
 * - Drag area: 20px width, 0.5 opacity, grab cursor
 * - Padding-left: 2px
 * - Border-radius: 5px
 * 
 * Toolbar Locations:
 * - floating: Draggable overlay (default, VS Code style)
 * - docked: Fixed in debug panel header (no drag handle)
 * - commandCenter: Show in title bar area (centered, higher z-index)
 * - hidden: No toolbar visible (use commands only)
 */

type DebugToolbarLocation = DebugSettings["toolbarLocation"];

interface DebugToolbarProps {
  /** Override the location from settings (useful for embedding in specific areas) */
  locationOverride?: DebugToolbarLocation;
}

export function DebugToolbar(props: DebugToolbarProps = {}) {
  const debug = useDebug();
  const debugSettings = useDebugSettings();
  
  // Get toolbar location from settings or props override
  const toolbarLocation = createMemo(() => 
    props.locationOverride ?? debugSettings.settings().toolbarLocation
  );

  const handleContinue = async () => {
    try {
      await debug.continue_();
    } catch (e) {
      debugToolbarLogger.error("Continue failed:", e);
    }
  };

  const handlePause = async () => {
    try {
      await debug.pause();
    } catch (e) {
      debugToolbarLogger.error("Pause failed:", e);
    }
  };

  const handleStepOver = async () => {
    try {
      await debug.stepOver();
    } catch (e) {
      debugToolbarLogger.error("Step over failed:", e);
    }
  };

  const handleStepInto = async () => {
    try {
      await debug.stepInto();
    } catch (e) {
      debugToolbarLogger.error("Step into failed:", e);
    }
  };

  const handleStepOut = async () => {
    try {
      await debug.stepOut();
    } catch (e) {
      debugToolbarLogger.error("Step out failed:", e);
    }
  };

  const handleStepBack = async () => {
    try {
      await debug.stepBack();
    } catch (e) {
      debugToolbarLogger.error("Step back failed:", e);
    }
  };

  const handleReverseContinue = async () => {
    try {
      await debug.reverseContinue();
    } catch (e) {
      debugToolbarLogger.error("Reverse continue failed:", e);
    }
  };

  const handleStop = async () => {
    try {
      await debug.stopSession();
    } catch (e) {
      debugToolbarLogger.error("Stop failed:", e);
    }
  };

  const handleRestart = async () => {
    try {
      await debug.restartSession();
    } catch (e) {
      debugToolbarLogger.error("Restart failed:", e);
    }
  };

  const handleHotReload = async () => {
    try {
      await debug.hotReload();
    } catch (e) {
      debugToolbarLogger.error("Hot reload failed:", e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!debug.state.isDebugging) return;
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (key === "F5" && !ctrl && !shift) {
      e.preventDefault();
      if (debug.state.isPaused) handleContinue(); else handlePause();
    } else if (key === "F5" && shift && !ctrl) {
      e.preventDefault();
      handleStop();
    } else if (key === "F5" && ctrl && shift) {
      e.preventDefault();
      handleRestart();
    } else if (key === "F6" && !ctrl && !shift) {
      e.preventDefault();
      handlePause();
    } else if (key === "F10" && !ctrl && !shift) {
      e.preventDefault();
      handleStepOver();
    } else if (key === "F11" && !ctrl && !shift) {
      e.preventDefault();
      handleStepInto();
    } else if (key === "F11" && shift && !ctrl) {
      e.preventDefault();
      handleStepOut();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  // VS Code action button styles - 16px icon background, flex centered
  const actionButtonStyle = {
    "margin-right": "4px",
    "background-size": "16px",
    "background-position": "center center",
    "background-repeat": "no-repeat",
  };

  // Get container styles based on toolbar location
  const getContainerStyle = (): JSX.CSSProperties => {
    const location = toolbarLocation();
    
    const baseStyle: JSX.CSSProperties = {
      "border-color": "var(--border-weak)",
      height: "28px",
      background: "var(--debug-toolbar-background)",
      "-webkit-app-region": "no-drag",
    };

    switch (location) {
      case "floating":
        return {
          ...baseStyle,
          "z-index": "2520",
          "padding-left": "2px",
          "border-radius": "var(--cortex-radius-md)",
        };
      case "docked":
        // Docked in panel header - no border-radius, full width
        return {
          ...baseStyle,
          "z-index": "auto",
          "padding-left": "8px",
          "padding-right": "8px",
          "border-radius": "0",
        };
      case "commandCenter":
        // Command center (title bar area) - centered, higher z-index
        return {
          ...baseStyle,
          "z-index": "2550",
          "padding-left": "8px",
          "padding-right": "8px",
          "border-radius": "var(--cortex-radius-md)",
          position: "fixed",
          top: "4px",
          left: "50%",
          transform: "translateX(-50%)",
          "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
        };
      case "hidden":
      default:
        return baseStyle;
    }
  };

  // Get container class based on location
  const getContainerClass = (): string => {
    const location = toolbarLocation();
    const baseClass = "debug-toolbar flex items-center";
    
    switch (location) {
      case "floating":
        return `${baseClass} relative shrink-0 border-b`;
      case "docked":
        return `${baseClass} shrink-0 border-b`;
      case "commandCenter":
        return `${baseClass} border rounded`;
      case "hidden":
      default:
        return baseClass;
    }
  };

  // Hidden location - render nothing
  if (toolbarLocation() === "hidden") {
    return null;
  }

  // Determine if we should show the drag handle (only for floating)
  const showDragHandle = () => toolbarLocation() === "floating";

  return (
    <div
      class={getContainerClass()}
      style={getContainerStyle()}
    >
      {/* Drag area (gripper) - VS Code spec: 20px width, 0.5 opacity - only for floating */}
      <Show when={showDragHandle()}>
        <div
          class="drag-area flex items-center justify-center shrink-0"
          style={{
            width: "20px",
            opacity: "0.5",
            cursor: "grab",
            color: "var(--text-weak)",
          }}
          title="Drag to move toolbar"
        >
          <Icon name="ellipsis" size="md" />
        </div>
      </Show>

      {/* Continue / Pause - VS Code colors */}
      <Show
        when={debug.state.isPaused}
        fallback={
          <button
            onClick={handlePause}
            class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{
              ...actionButtonStyle,
              color: "var(--debug-icon-pause-foreground)",
            }}
            title="Pause (F6)"
          >
            <Icon name="pause" style={{ width: "16px", height: "16px" }} />
          </button>
        }
      >
        <button
          onClick={handleContinue}
          class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{
            ...actionButtonStyle,
            color: "var(--debug-icon-continue-foreground)",
          }}
          title="Continue (F5)"
        >
          <Icon name="play" style={{ width: "16px", height: "16px" }} />
        </button>
      </Show>

      {/* Step Over */}
      <button
        onClick={handleStepOver}
        disabled={!debug.state.isPaused}
        class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-[0.65] disabled:cursor-default hover:bg-[var(--surface-raised)]"
        style={{
          ...actionButtonStyle,
          color: "var(--debug-icon-step-over-foreground)",
        }}
        title="Step Over (F10)"
      >
        <Icon name="forward-step" style={{ width: "16px", height: "16px" }} />
      </button>

      {/* Step Into */}
      <button
        onClick={handleStepInto}
        disabled={!debug.state.isPaused}
        class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-[0.65] disabled:cursor-default hover:bg-[var(--surface-raised)]"
        style={{
          ...actionButtonStyle,
          color: "var(--debug-icon-step-into-foreground)",
        }}
        title="Step Into (F11)"
      >
        <Icon name="arrow-down" style={{ width: "16px", height: "16px" }} />
      </button>

      {/* Step Out */}
      <button
        onClick={handleStepOut}
        disabled={!debug.state.isPaused}
        class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-[0.65] disabled:cursor-default hover:bg-[var(--surface-raised)]"
        style={{
          ...actionButtonStyle,
          color: "var(--debug-icon-step-out-foreground)",
        }}
        title="Step Out (Shift+F11)"
      >
        <Icon name="arrow-up" style={{ width: "16px", height: "16px" }} />
      </button>

      {/* Step Back - only shown when debug adapter supports reverse debugging */}
      <Show when={debug.state.capabilities?.supportsStepBack}>
        <button
          onClick={handleStepBack}
          disabled={!debug.state.isPaused}
          class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-[0.65] disabled:cursor-default hover:bg-[var(--surface-raised)]"
          style={{
            ...actionButtonStyle,
            color: "var(--debug-icon-step-back-foreground, var(--text-primary))",
          }}
          title="Step Back"
        >
          <Icon name="backward-step" style={{ width: "16px", height: "16px" }} />
        </button>
      </Show>

      {/* Reverse Continue - only shown when debug adapter supports reverse debugging */}
      <Show when={debug.state.capabilities?.supportsReverseContinue}>
        <button
          onClick={handleReverseContinue}
          disabled={!debug.state.isPaused}
          class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors disabled:opacity-[0.65] disabled:cursor-default hover:bg-[var(--surface-raised)]"
          style={{
            ...actionButtonStyle,
            color: "var(--debug-icon-reverse-continue-foreground, var(--text-primary))",
          }}
          title="Reverse Continue"
        >
          <Icon name="backward" style={{ width: "16px", height: "16px" }} />
        </button>
      </Show>

      {/* Separator */}
      <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />

      {/* Restart - VS Code green */}
      <button
        onClick={handleRestart}
        class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-raised)]"
        style={{
          ...actionButtonStyle,
          color: "var(--debug-icon-restart-foreground)",
        }}
        title="Restart (Ctrl+Shift+F5)"
      >
        <Icon name="rotate" style={{ width: "16px", height: "16px" }} />
      </button>

      {/* Hot Reload - only shown when supported (lightning bolt icon) */}
      <Show when={debug.state.hotReloadEnabled}>
        <button
          onClick={handleHotReload}
          class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{
            ...actionButtonStyle,
            color: "var(--debug-icon-hot-reload-foreground, var(--cortex-warning))",
          }}
          title="Hot Reload - Restart with updated code (Ctrl+Shift+F9)"
        >
          <Icon name="bolt" style={{ width: "16px", height: "16px" }} />
        </button>
      </Show>

      {/* Stop - VS Code red */}
      <button
        onClick={handleStop}
        class="action-item w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-raised)]"
        style={{
          ...actionButtonStyle,
          color: "var(--debug-icon-stop-foreground)",
        }}
        title="Stop (Shift+F5)"
      >
        <Icon name="stop" style={{ width: "16px", height: "16px" }} />
      </button>
    </div>
  );
}

