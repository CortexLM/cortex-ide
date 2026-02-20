/**
 * MultiSessionPanel - VS Code-style multi-target debug session management
 * 
 * Displays all active debug sessions and provides controls for:
 * - Switching between sessions
 * - Viewing session state at a glance
 * - Multi-session controls (pause all, continue all, stop all, restart all)
 */

import { For, Show, createMemo, JSX } from "solid-js";
import { useDebug, type DebugSessionInfo, type DebugSessionState } from "@/context/DebugContext";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

interface SessionItemProps {
  session: DebugSessionInfo;
  isActive: boolean;
  onSelect: () => void;
  onStop: () => void;
  onRestart: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSessionStateIcon(state: DebugSessionState): string {
  switch (state.type) {
    case "initializing":
      return "loader";
    case "running":
      return "play";
    case "stopped":
      return "pause";
    case "ended":
      return "stop";
    default:
      return "bug";
  }
}

function getSessionStateColor(state: DebugSessionState): string {
  switch (state.type) {
    case "initializing":
      return tokens.colors.semantic.warning;
    case "running":
      return tokens.colors.semantic.success;
    case "stopped":
      return tokens.colors.semantic.primary;
    case "ended":
      return tokens.colors.text.muted;
    default:
      return tokens.colors.text.primary;
  }
}

function getSessionStateLabel(state: DebugSessionState): string {
  switch (state.type) {
    case "initializing":
      return "Initializing...";
    case "running":
      return "Running";
    case "stopped":
      return state.description || state.reason || "Paused";
    case "ended":
      return "Ended";
    default:
      return "Unknown";
  }
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    "flex-direction": "column",
    background: tokens.colors.surface.panel,
    "border-radius": tokens.radius.md,
    overflow: "hidden",
  } as JSX.CSSProperties,

  header: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    "min-height": "32px",
  } as JSX.CSSProperties,

  headerTitle: {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    "font-size": "12px",
    "font-weight": "600",
    color: tokens.colors.text.primary,
  } as JSX.CSSProperties,

  headerActions: {
    display: "flex",
    "align-items": "center",
    gap: "2px",
  } as JSX.CSSProperties,

  actionButton: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "22px",
    height: "22px",
    "border-radius": tokens.radius.sm,
    border: "none",
    background: "transparent",
    color: tokens.colors.text.muted,
    cursor: "pointer",
    transition: "all 0.1s ease",
  } as JSX.CSSProperties,

  actionButtonHover: {
    background: tokens.colors.surface.hover,
    color: tokens.colors.text.primary,
  } as JSX.CSSProperties,

  sessionList: {
    display: "flex",
    "flex-direction": "column",
    "max-height": "200px",
    "overflow-y": "auto",
  } as JSX.CSSProperties,

  sessionItem: {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    cursor: "pointer",
    transition: "background 0.1s ease",
    "border-left": "2px solid transparent",
  } as JSX.CSSProperties,

  sessionItemActive: {
    background: "rgba(99, 102, 241, 0.1)",
    "border-left-color": tokens.colors.semantic.primary,
  } as JSX.CSSProperties,

  sessionItemHover: {
    background: tokens.colors.surface.hover,
  } as JSX.CSSProperties,

  sessionIcon: {
    width: "14px",
    height: "14px",
    "flex-shrink": "0",
  } as JSX.CSSProperties,

  sessionInfo: {
    flex: "1",
    "min-width": "0",
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  } as JSX.CSSProperties,

  sessionName: {
    "font-size": "12px",
    "font-weight": "500",
    color: tokens.colors.text.primary,
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  sessionState: {
    "font-size": "10px",
    color: tokens.colors.text.muted,
  } as JSX.CSSProperties,

  sessionActions: {
    display: "flex",
    "align-items": "center",
    gap: "2px",
    opacity: "0",
    transition: "opacity 0.1s ease",
  } as JSX.CSSProperties,

  sessionActionsVisible: {
    opacity: "1",
  } as JSX.CSSProperties,

  emptyState: {
    padding: tokens.spacing.lg,
    "text-align": "center",
    color: tokens.colors.text.muted,
    "font-size": "12px",
  } as JSX.CSSProperties,

  badge: {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    "min-width": "16px",
    height: "16px",
    padding: "0 4px",
    "border-radius": "var(--cortex-radius-md)",
    "font-size": "10px",
    "font-weight": "600",
    background: tokens.colors.semantic.primary,
    color: "white",
  } as JSX.CSSProperties,
};

// ============================================================================
// Session Item Component
// ============================================================================

function SessionItem(props: SessionItemProps) {
  const stateColor = () => getSessionStateColor(props.session.state);
  const stateIcon = () => getSessionStateIcon(props.session.state);
  const stateLabel = () => getSessionStateLabel(props.session.state);

  return (
    <div
      style={{
        ...styles.sessionItem,
        ...(props.isActive ? styles.sessionItemActive : {}),
      }}
      onClick={props.onSelect}
      onMouseEnter={(e) => {
        if (!props.isActive) {
          e.currentTarget.style.background = tokens.colors.surface.hover;
        }
        const actions = e.currentTarget.querySelector(".session-actions") as HTMLElement;
        if (actions) actions.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        if (!props.isActive) {
          e.currentTarget.style.background = "transparent";
        }
        const actions = e.currentTarget.querySelector(".session-actions") as HTMLElement;
        if (actions) actions.style.opacity = "0";
      }}
    >
      {/* Session State Icon */}
      <Icon 
        name={stateIcon()} 
        style={{ ...styles.sessionIcon, color: stateColor() }} 
      />

      {/* Session Info */}
      <div style={styles.sessionInfo}>
        <div style={styles.sessionName}>{props.session.name}</div>
        <div style={{ ...styles.sessionState, color: stateColor() }}>
          {stateLabel()} • {props.session.type}
        </div>
      </div>

      {/* Session Actions (visible on hover) */}
      <div class="session-actions" style={styles.sessionActions}>
        <button
          style={styles.actionButton}
          onClick={(e) => {
            e.stopPropagation();
            props.onRestart();
          }}
          title="Restart Session"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.surface.hover;
            e.currentTarget.style.color = tokens.colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = tokens.colors.text.muted;
          }}
        >
          <Icon name="rotate" style={{ width: "12px", height: "12px" }} />
        </button>
        <button
          style={styles.actionButton}
          onClick={(e) => {
            e.stopPropagation();
            props.onStop();
          }}
          title="Stop Session"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.surface.hover;
            e.currentTarget.style.color = tokens.colors.semantic.error;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = tokens.colors.text.muted;
          }}
        >
          <Icon name="stop" style={{ width: "12px", height: "12px" }} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Multi Session Panel Component
// ============================================================================

export interface MultiSessionPanelProps {
  /** Optional custom class */
  class?: string;
  /** Whether to show the header */
  showHeader?: boolean;
}

export function MultiSessionPanel(props: MultiSessionPanelProps) {
  const debug = useDebug();

  const sessions = createMemo(() => debug.getSessions());
  const activeSessionId = () => debug.state.activeSessionId;
  const sessionCount = () => sessions().length;

  // Count sessions by state
  const runningCount = createMemo(() => 
    sessions().filter(s => s.state.type === "running").length
  );
  const pausedCount = createMemo(() => 
    sessions().filter(s => s.state.type === "stopped").length
  );

  // Handlers for multi-session controls
  const handlePauseAll = async () => {
    try {
      await debug.pauseAll();
    } catch (e) {
      console.error("Pause all failed:", e);
    }
  };

  const handleContinueAll = async () => {
    try {
      await debug.continueAll();
    } catch (e) {
      console.error("Continue all failed:", e);
    }
  };

  const handleStopAll = async () => {
    try {
      await debug.stopAll();
    } catch (e) {
      console.error("Stop all failed:", e);
    }
  };

  const handleRestartAll = async () => {
    try {
      await debug.restartAll();
    } catch (e) {
      console.error("Restart all failed:", e);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    debug.setActiveSession(sessionId);
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await debug.stopSession(sessionId);
    } catch (e) {
      console.error("Stop session failed:", e);
    }
  };

  const handleRestartSession = async (sessionId: string) => {
    try {
      await debug.restartSession(sessionId);
    } catch (e) {
      console.error("Restart session failed:", e);
    }
  };

  return (
    <div style={styles.container} class={props.class}>
      {/* Header with multi-session controls */}
      <Show when={props.showHeader !== false}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Icon name="bug" style={{ width: "14px", height: "14px" }} />
            <span>Debug Sessions</span>
            <Show when={sessionCount() > 0}>
              <span style={styles.badge}>{sessionCount()}</span>
            </Show>
          </div>

          {/* Multi-session action buttons */}
          <Show when={sessionCount() > 1}>
            <div style={styles.headerActions}>
              {/* Continue All */}
              <Show when={pausedCount() > 0}>
                <button
                  style={styles.actionButton}
                  onClick={handleContinueAll}
                  title={`Continue All (${pausedCount()} paused)`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.colors.surface.hover;
                    e.currentTarget.style.color = tokens.colors.semantic.success;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = tokens.colors.text.muted;
                  }}
                >
                  <Icon name="play" style={{ width: "12px", height: "12px" }} />
                </button>
              </Show>

              {/* Pause All */}
              <Show when={runningCount() > 0}>
                <button
                  style={styles.actionButton}
                  onClick={handlePauseAll}
                  title={`Pause All (${runningCount()} running)`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.colors.surface.hover;
                    e.currentTarget.style.color = tokens.colors.semantic.warning;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = tokens.colors.text.muted;
                  }}
                >
                  <Icon name="pause" style={{ width: "12px", height: "12px" }} />
                </button>
              </Show>

              {/* Restart All */}
              <button
                style={styles.actionButton}
                onClick={handleRestartAll}
                title="Restart All Sessions"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tokens.colors.surface.hover;
                  e.currentTarget.style.color = tokens.colors.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = tokens.colors.text.muted;
                }}
              >
                <Icon name="rotate" style={{ width: "12px", height: "12px" }} />
              </button>

              {/* Stop All */}
              <button
                style={styles.actionButton}
                onClick={handleStopAll}
                title="Stop All Sessions"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tokens.colors.surface.hover;
                  e.currentTarget.style.color = tokens.colors.semantic.error;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = tokens.colors.text.muted;
                }}
              >
                <Icon name="stop" style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Session List */}
      <div style={styles.sessionList}>
        <Show
          when={sessionCount() > 0}
          fallback={
            <div style={styles.emptyState}>
              <Icon name="bug" style={{ width: "24px", height: "24px", opacity: "0.5", "margin-bottom": "8px" }} />
              <div>No active debug sessions</div>
              <div style={{ "margin-top": "4px", opacity: "0.7" }}>
                Press F5 or use the Run menu to start debugging
              </div>
            </div>
          }
        >
          <For each={sessions()}>
            {(session) => (
              <SessionItem
                session={session}
                isActive={session.id === activeSessionId()}
                onSelect={() => handleSelectSession(session.id)}
                onStop={() => handleStopSession(session.id)}
                onRestart={() => handleRestartSession(session.id)}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export default MultiSessionPanel;

