import { Show, createMemo } from "solid-js";
import { useDebug, DebugSessionInfo } from "@/context/DebugContext";
import { tokens } from "@/design-system/tokens";
import { IconButton } from "@/components/ui";
import { Icon } from "../ui/Icon";

/**
 * Debug Status Bar Component
 * 
 * Shows debug session status in the main status bar when debugging is active.
 * Displays:
 * - Debug session name/config
 * - Status (Running, Paused, Stopped)
 * - Play/Pause/Stop/Restart quick actions
 * - Current stack frame location
 */

export interface DebugStatusBarProps {
  /** Current debug session (null when not debugging) */
  session: DebugSessionInfo | null;
  /** Continue execution callback */
  onContinue: () => void;
  /** Pause execution callback */
  onPause: () => void;
  /** Stop debug session callback */
  onStop: () => void;
  /** Restart debug session callback */
  onRestart: () => void;
}

type DebugStatus = "running" | "paused" | "initializing" | "stopped";

/**
 * Get the display status from session state
 */
function getSessionStatus(session: DebugSessionInfo | null): DebugStatus {
  if (!session) return "stopped";
  
  switch (session.state.type) {
    case "initializing":
      return "initializing";
    case "running":
      return "running";
    case "stopped":
      return "paused";
    case "ended":
      return "stopped";
    default:
      return "stopped";
  }
}

/**
 * Get status indicator color based on debug state
 */
function getStatusColor(status: DebugStatus): string {
  switch (status) {
    case "running":
      return tokens.colors.semantic.success;
    case "paused":
      return tokens.colors.semantic.warning;
    case "initializing":
      return tokens.colors.semantic.info;
    case "stopped":
    default:
      return tokens.colors.text.muted;
  }
}

/**
 * Get status label text
 */
function getStatusLabel(status: DebugStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "initializing":
      return "Starting...";
    case "stopped":
    default:
      return "Stopped";
  }
}

export function DebugStatusBar(props: DebugStatusBarProps) {
  const debug = useDebug();
  
  const status = createMemo(() => getSessionStatus(props.session));
  const statusColor = createMemo(() => getStatusColor(status()));
  const statusLabel = createMemo(() => getStatusLabel(status()));
  
  // Get current frame location for display
  const currentLocation = createMemo(() => {
    const frames = debug.state.stackFrames;
    if (frames.length === 0) return null;
    
    const topFrame = frames[0];
    if (!topFrame.source?.path) return null;
    
    const fileName = topFrame.source.path.split(/[/\\]/).pop() || topFrame.source.path;
    return `${topFrame.name} (${fileName}:${topFrame.line})`;
  });
  
  // Don't render anything if not debugging
  if (!props.session) {
    return null;
  }
  
  // Item styles matching StatusBar conventions
  const itemBaseClass = "flex items-center gap-1 cursor-pointer";
  const itemHoverStyle = `hover:bg-[${tokens.colors.interactive.hover}]`;
  const itemStyle = {
    padding: `0 ${tokens.spacing.md}`,
    "line-height": "22px",
    transition: "background-color 100ms ease",
    "white-space": "nowrap",
  };

  return (
    <div 
      class="debug-status-bar flex items-center"
      style={{ height: "22px" }}
    >
      {/* Debug indicator with status color */}
      <div
        class={`${itemBaseClass}`}
        style={{
          ...itemStyle,
          background: statusColor(),
          color: "white",
          gap: tokens.spacing.sm,
        }}
        title={`Debug: ${props.session.name} - ${statusLabel()}`}
        onClick={() => window.dispatchEvent(new CustomEvent("layout:focus-debug"))}
      >
        {/* Status icon */}
        <Show 
          when={status() !== "initializing"} 
          fallback={<Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />}
        >
          <Icon name="bug" class="w-3.5 h-3.5" />
        </Show>
        
        {/* Session name */}
        <span 
          class="text-xs font-medium truncate"
          style={{ "max-width": "120px" }}
        >
          {props.session.name}
        </span>
        
        {/* Status badge */}
        <span 
          class="text-xs uppercase"
          style={{ 
            opacity: 0.9,
            "font-size": "9px",
            "letter-spacing": "0.5px",
          }}
        >
          {statusLabel()}
        </span>
      </div>
      
      {/* Quick action buttons */}
      <div 
        class="flex items-center"
        style={{ 
          background: "var(--surface-sunken)",
          "border-radius": "0 2px 2px 0",
        }}
      >
        {/* Continue/Pause button */}
        <Show
          when={status() === "paused"}
          fallback={
            <IconButton
              size="sm"
              variant="ghost"
              onClick={props.onPause}
              disabled={status() === "initializing"}
              tooltip="Pause (F6)"
              style={{ 
                width: "22px", 
                height: "22px",
                color: "var(--debug-icon-pause-foreground)",
              }}
            >
              <Icon name="pause" class="w-3.5 h-3.5" />
            </IconButton>
          }
        >
          <IconButton
            size="sm"
            variant="ghost"
            onClick={props.onContinue}
            tooltip="Continue (F5)"
            style={{ 
              width: "22px", 
              height: "22px",
              color: "var(--debug-icon-continue-foreground)",
            }}
          >
            <Icon name="play" class="w-3.5 h-3.5" />
          </IconButton>
        </Show>
        
        {/* Restart button */}
        <IconButton
          size="sm"
          variant="ghost"
          onClick={props.onRestart}
          tooltip="Restart (Ctrl+Shift+F5)"
          style={{ 
            width: "22px", 
            height: "22px",
            color: "var(--debug-icon-restart-foreground)",
          }}
        >
          <Icon name="rotate" class="w-3 h-3" />
        </IconButton>
        
        {/* Stop button */}
        <IconButton
          size="sm"
          variant="ghost"
          onClick={props.onStop}
          tooltip="Stop (Shift+F5)"
          style={{ 
            width: "22px", 
            height: "22px",
            color: "var(--debug-icon-stop-foreground)",
          }}
        >
          <Icon name="stop" class="w-3 h-3" />
        </IconButton>
      </div>
      
      {/* Current location (when paused) */}
      <Show when={status() === "paused" && currentLocation()}>
        <div
          class={`${itemBaseClass} ${itemHoverStyle}`}
          style={{ 
            ...itemStyle, 
            color: tokens.colors.text.muted,
            "font-size": "11px",
            "max-width": "200px",
          }}
          title={`Current location: ${currentLocation()}`}
          onClick={() => {
            // Navigate to current frame location
            const frames = debug.state.stackFrames;
            if (frames.length > 0 && frames[0].source?.path) {
              window.dispatchEvent(new CustomEvent("editor:goto", {
                detail: {
                  path: frames[0].source.path,
                  line: frames[0].line,
                  column: frames[0].column || 1,
                  focus: true,
                }
              }));
            }
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
          onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
        >
          <span class="truncate">{currentLocation()}</span>
        </div>
      </Show>
    </div>
  );
}

/**
 * Hook to create a DebugStatusBar with debug context integration
 */
export function useDebugStatusBar() {
  const debug = useDebug();
  
  const activeSession = createMemo(() => debug.getActiveSession() || null);
  
  const handleContinue = async () => {
    try {
      await debug.continue_();
    } catch (e) {
      console.error("Continue failed:", e);
    }
  };
  
  const handlePause = async () => {
    try {
      await debug.pause();
    } catch (e) {
      console.error("Pause failed:", e);
    }
  };
  
  const handleStop = async () => {
    try {
      await debug.stopSession();
    } catch (e) {
      console.error("Stop failed:", e);
    }
  };
  
  const handleRestart = async () => {
    try {
      await debug.restartSession();
    } catch (e) {
      console.error("Restart failed:", e);
    }
  };
  
  return {
    session: activeSession,
    isDebugging: () => debug.state.isDebugging,
    onContinue: handleContinue,
    onPause: handlePause,
    onStop: handleStop,
    onRestart: handleRestart,
  };
}

export default DebugStatusBar;
