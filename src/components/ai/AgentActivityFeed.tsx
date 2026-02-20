import {
  Show,
  For,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Icon } from "../ui/Icon";
import { LoadingSpinner } from "@/components/ui";
import {
  ActionEntry,
  type AgentAction,
  type AgentActionType,
  type ActionStatus,
  type ActionData,
  type ToolStartData,
  type ToolCompleteData,
} from "./ActionEntry";
import "./AgentActivityFeed.css";

// ============================================================================
// Types
// ============================================================================

/** Backend action entry from Rust ActionLogEntry */
interface BackendActionLogEntry {
  id: string;
  timestamp: number;
  action: BackendAgentAction;
  session_id: string;
  description: string;
  category: string;
}

/** Backend AgentAction from Rust */
interface BackendAgentAction {
  type: string;
  path?: string;
  lines_read?: number;
  lines_changed?: number;
  diff_preview?: string;
  file_count?: number;
  query?: string;
  results_count?: number;
  command?: string;
  cwd?: string;
  output?: string;
  is_error?: boolean;
  content?: string;
  tool_name?: string;
  tool_id?: string;
  success?: boolean;
  duration_ms?: number;
}

export interface AgentActivityFeedProps {
  /** Initial compact mode state */
  compact?: boolean;
  /** Maximum number of actions to keep in history */
  maxActions?: number;
  /** Auto-scroll to new entries */
  autoScroll?: boolean;
  /** Show session summary */
  showSummary?: boolean;
  /** Custom class name */
  class?: string;
  /** Event name to listen for (default: "agent-action") */
  eventName?: string;
}

export interface SessionSummary {
  totalActions: number;
  filesRead: number;
  filesEdited: number;
  filesCreated: number;
  filesDeleted: number;
  commandsRun: number;
  toolsUsed: number;
  errors: number;
  startTime: number;
  duration: number;
}

type FilterType = "all" | AgentActionType;

// ============================================================================
// Filter Options
// ============================================================================

const FILTER_OPTIONS: { value: FilterType; label: string; icon: string }[] = [
  { value: "all", label: "All Actions", icon: "wave-pulse" },
  { value: "file_read", label: "File Reads", icon: "file" },
  { value: "file_edit", label: "File Edits", icon: "pen" },
  { value: "file_create", label: "File Creates", icon: "file" },
  { value: "file_delete", label: "File Deletes", icon: "file" },
  { value: "terminal_command", label: "Commands", icon: "terminal" },
  { value: "terminal_output", label: "Output", icon: "terminal" },
  { value: "thinking", label: "Thinking", icon: "microchip" },
  { value: "tool_start", label: "Tool Start", icon: "wrench" },
  { value: "tool_complete", label: "Tool Complete", icon: "wrench" },
];

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function calculateSummary(actions: AgentAction[]): SessionSummary {
  const now = Date.now();
  const startTime = actions.length > 0 ? actions[0].timestamp : now;
  
  return {
    totalActions: actions.length,
    filesRead: actions.filter((a) => a.type === "file_read").length,
    filesEdited: actions.filter((a) => a.type === "file_edit").length,
    filesCreated: actions.filter((a) => a.type === "file_create").length,
    filesDeleted: actions.filter((a) => a.type === "file_delete").length,
    commandsRun: actions.filter((a) => a.type === "terminal_command").length,
    toolsUsed: actions.filter((a) => a.type === "tool_start" || a.type === "tool_complete").length,
    errors: actions.filter((a) => a.status === "error").length,
    startTime,
    duration: now - startTime,
  };
}

function formatSessionDuration(ms: number): string {
  if (ms < 1000) return "just started";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ============================================================================
// AgentActivityFeed Component
// ============================================================================

export function AgentActivityFeed(props: AgentActivityFeedProps) {
  const [actions, setActions] = createSignal<AgentAction[]>([]);
  const [filter, setFilter] = createSignal<FilterType>("all");
  const [showFilterDropdown, setShowFilterDropdown] = createSignal(false);
  const [paused, setPaused] = createSignal(false);
  const [compact, setCompact] = createSignal(props.compact ?? false);
  const [autoScroll, setAutoScroll] = createSignal(props.autoScroll ?? true);
  const [expandedSummary, setExpandedSummary] = createSignal(props.showSummary ?? false);
  
  let feedRef: HTMLDivElement | undefined;
  let unlisten: UnlistenFn | undefined;
  const maxActions = props.maxActions ?? 500;
  const eventName = props.eventName ?? "agent-action";

  // Filtered actions
  const filteredActions = createMemo(() => {
    const currentFilter = filter();
    if (currentFilter === "all") return actions();
    return actions().filter((a) => a.type === currentFilter);
  });

  // Session summary
  const summary = createMemo(() => calculateSummary(actions()));

  // Running actions count
  const runningCount = createMemo(() => actions().filter((a) => a.status === "running").length);

  // Auto-scroll effect
  createEffect(() => {
    // Track changes to filteredActions
    void filteredActions();
    if (autoScroll() && feedRef && !paused()) {
      requestAnimationFrame(() => {
        if (feedRef) {
          feedRef.scrollTop = feedRef.scrollHeight;
        }
      });
    }
  });

  // Map backend ActionLogEntry to frontend AgentAction
  const mapBackendAction = (entry: BackendActionLogEntry): AgentAction => {
    const action = entry.action;
    const type = action.type as string;
    
    // Map backend action types to frontend types
    const typeMap: Record<string, AgentActionType> = {
      "file_read": "file_read",
      "file_edit": "file_edit",
      "file_create": "file_create",
      "file_delete": "file_delete",
      "directory_list": "file_read",
      "search": "terminal_command",
      "terminal_command": "terminal_command",
      "terminal_output": "terminal_output",
      "thinking": "thinking",
      "tool_start": "tool_start",
      "tool_complete": "tool_complete",
    };
    
    const frontendType = typeMap[type] || "tool_start";
    
    // Extract data based on action type
    let data: ActionData;
    switch (type) {
      case "file_read":
        data = {
          type: "file_read",
          path: action.path || "",
          lineCount: action.lines_read,
        };
        break;
      case "file_edit":
        data = {
          type: "file_edit",
          path: action.path || "",
          linesAdded: action.lines_changed,
          diff: action.diff_preview,
        };
        break;
      case "file_create":
        data = {
          type: "file_create",
          path: action.path || "",
        };
        break;
      case "file_delete":
        data = {
          type: "file_delete",
          path: action.path || "",
        };
        break;
      case "directory_list":
        data = {
          type: "file_read",
          path: action.path || "",
          lineCount: action.file_count,
        };
        break;
      case "search":
        data = {
          type: "terminal_command",
          command: `search: ${action.query || ""}`,
        };
        break;
      case "terminal_command":
        data = {
          type: "terminal_command",
          command: action.command || "",
          cwd: action.cwd,
        };
        break;
      case "terminal_output":
        data = {
          type: "terminal_output",
          output: action.output || "",
        };
        break;
      case "thinking":
        data = {
          type: "thinking",
          content: action.content,
        };
        break;
      case "tool_start":
        data = {
          type: "tool_start",
          toolName: action.tool_name || "Unknown",
        };
        break;
      case "tool_complete":
        data = {
          type: "tool_complete",
          toolName: action.tool_name || "Unknown",
          success: action.success ?? true,
        };
        break;
      default:
        data = {
          type: "tool_start",
          toolName: type,
        };
    }
    
    // Determine status
    let status: ActionStatus = "success";
    if (type === "tool_start" || type === "thinking") {
      status = "running";
    } else if (type === "tool_complete" && action.success === false) {
      status = "error";
    }
    
    return {
      id: entry.id,
      type: frontendType,
      timestamp: entry.timestamp,
      status,
      duration: action.duration_ms,
      data,
    };
  };

  // Handle incoming agent action events from backend
  const handleAgentAction = (payload: unknown) => {
    if (paused()) return;

    const entry = payload as BackendActionLogEntry;
    
    // Transform backend entry to frontend action
    const newAction = mapBackendAction(entry);
    
    // Check if this is an update to tool_complete for existing tool_start
    setActions((prev) => {
      // For tool_complete, find and update the matching tool_start by toolName
      if (newAction.data.type === "tool_complete") {
        const toolCompleteData = newAction.data as ToolCompleteData;
        // Find the most recent running tool_start with same toolName
        let toolStartIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          const a = prev[i];
          if (a.data.type === "tool_start" && 
              a.status === "running" &&
              (a.data as ToolStartData).toolName === toolCompleteData.toolName) {
            toolStartIdx = i;
            break;
          }
        }
        if (toolStartIdx !== -1) {
          const updated = [...prev];
          updated[toolStartIdx] = {
            ...updated[toolStartIdx],
            status: toolCompleteData.success ? "success" : "error",
            duration: newAction.duration,
          };
          return updated;
        }
      }
      
      // Add new action
      const updated = [...prev, newAction];
      // Trim if exceeds max
      if (updated.length > maxActions) {
        return updated.slice(-maxActions);
      }
      return updated;
    });
  };

  // Set up Tauri event listener
  onMount(async () => {
    try {
      unlisten = await listen(eventName, (event) => {
        handleAgentAction(event.payload);
      });
    } catch (e) {
      console.error(`[AgentActivityFeed] Failed to listen to ${eventName}:`, e);
    }
  });

  onCleanup(() => {
    if (unlisten) {
      unlisten();
    }
  });

  // Clear all actions
  const clearActions = () => {
    setActions([]);
  };

  // Close filter dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".activity-feed__filter-dropdown")) {
      setShowFilterDropdown(false);
    }
  };

  createEffect(() => {
    if (showFilterDropdown()) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  return (
    <div
      class={`activity-feed ${props.class || ""}`}
      classList={{
        "activity-feed--compact": compact(),
        "activity-feed--paused": paused(),
      }}
    >
      {/* Header */}
      <header class="activity-feed__header">
        <div class="activity-feed__title">
          <Icon name="wave-pulse" class="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span>Activity</span>
          <Show when={runningCount() > 0}>
            <span class="activity-feed__running-badge">
              <LoadingSpinner size={10} />
              <span>{runningCount()}</span>
            </span>
          </Show>
        </div>

        <div class="activity-feed__controls">
          {/* Filter Dropdown */}
          <div class="activity-feed__filter-dropdown">
            <button
              class="activity-feed__control-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown())}
              title="Filter actions"
            >
              <Icon name="filter" class="w-3.5 h-3.5" />
              <Show when={filter() !== "all"}>
                <span class="activity-feed__filter-indicator" />
              </Show>
            </button>

            <Show when={showFilterDropdown()}>
              <div class="activity-feed__dropdown">
                <For each={FILTER_OPTIONS}>
                  {(option) => (
                    <button
                      class="activity-feed__dropdown-item"
                      classList={{ "activity-feed__dropdown-item--active": filter() === option.value }}
                      onClick={() => {
                        setFilter(option.value);
                        setShowFilterDropdown(false);
                      }}
                    >
                      <Icon name={option.icon as any} class="w-3.5 h-3.5" />
                      <span>{option.label}</span>
                      <Show when={filter() === option.value}>
                        <span class="activity-feed__check">✓</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Pause/Resume */}
          <button
            class="activity-feed__control-btn"
            classList={{ "activity-feed__control-btn--active": paused() }}
            onClick={() => setPaused(!paused())}
            title={paused() ? "Resume feed" : "Pause feed"}
          >
            <Show when={paused()} fallback={<Icon name="pause" class="w-3.5 h-3.5" />}>
              <Icon name="play" class="w-3.5 h-3.5" />
            </Show>
          </button>

          {/* Compact/Expanded Toggle */}
          <button
            class="activity-feed__control-btn"
            onClick={() => setCompact(!compact())}
            title={compact() ? "Expand view" : "Compact view"}
          >
            <Show when={compact()} fallback={<Icon name="minimize" class="w-3.5 h-3.5" />}>
              <Icon name="maximize" class="w-3.5 h-3.5" />
            </Show>
          </button>

          {/* Clear */}
          <button
            class="activity-feed__control-btn"
            onClick={clearActions}
            title="Clear all actions"
            disabled={actions().length === 0}
          >
            <Icon name="trash" class="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Session Summary */}
      <Show when={props.showSummary !== false}>
        <div class="activity-feed__summary">
          <button
            class="activity-feed__summary-toggle"
            onClick={() => setExpandedSummary(!expandedSummary())}
          >
            <span class="activity-feed__summary-label">Session Summary</span>
            <span class="activity-feed__summary-duration">
              {formatSessionDuration(summary().duration)}
            </span>
            <Show when={expandedSummary()} fallback={<Icon name="chevron-down" class="w-3.5 h-3.5" />}>
              <Icon name="chevron-up" class="w-3.5 h-3.5" />
            </Show>
          </button>

          <Show when={expandedSummary()}>
            <div class="activity-feed__summary-details">
              <div class="activity-feed__stat">
                <span class="activity-feed__stat-value">{summary().totalActions}</span>
                <span class="activity-feed__stat-label">Total</span>
              </div>
              <div class="activity-feed__stat">
                <span class="activity-feed__stat-value">{summary().filesRead}</span>
                <span class="activity-feed__stat-label">Reads</span>
              </div>
              <div class="activity-feed__stat">
                <span class="activity-feed__stat-value">{summary().filesEdited}</span>
                <span class="activity-feed__stat-label">Edits</span>
              </div>
              <div class="activity-feed__stat">
                <span class="activity-feed__stat-value">{summary().filesCreated}</span>
                <span class="activity-feed__stat-label">Creates</span>
              </div>
              <div class="activity-feed__stat">
                <span class="activity-feed__stat-value">{summary().commandsRun}</span>
                <span class="activity-feed__stat-label">Commands</span>
              </div>
              <Show when={summary().errors > 0}>
                <div class="activity-feed__stat activity-feed__stat--error">
                  <span class="activity-feed__stat-value">{summary().errors}</span>
                  <span class="activity-feed__stat-label">Errors</span>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Feed Content */}
      <div ref={feedRef} class="activity-feed__content">
        <Show
          when={filteredActions().length > 0}
          fallback={
            <div class="activity-feed__empty">
              <Icon name="wave-pulse" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
              <span>No activity yet</span>
              <Show when={filter() !== "all"}>
                <span class="activity-feed__empty-hint">
                  Try clearing the filter
                </span>
              </Show>
            </div>
          }
        >
          <For each={filteredActions()}>
            {(action, index) => (
              <ActionEntry
                action={action}
                compact={compact()}
                animate={index() === filteredActions().length - 1}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Footer with auto-scroll toggle */}
      <footer class="activity-feed__footer">
        <label class="activity-feed__autoscroll">
          <input
            type="checkbox"
            checked={autoScroll()}
            onChange={(e) => setAutoScroll(e.currentTarget.checked)}
          />
          <span>Auto-scroll</span>
        </label>
        <span class="activity-feed__count">
          {filteredActions().length}
          <Show when={filter() !== "all"}>
            <span> / {actions().length}</span>
          </Show>
          <span> actions</span>
        </span>
      </footer>
    </div>
  );
}

// ============================================================================
// Compact Variant for Sidebar
// ============================================================================

export interface AgentActivityFeedCompactProps {
  /** Maximum items to show */
  maxItems?: number;
  /** Click handler for expanding */
  onExpand?: () => void;
}

export function AgentActivityFeedCompact(props: AgentActivityFeedCompactProps) {
  const [actions, setActions] = createSignal<AgentAction[]>([]);
  let unlisten: UnlistenFn | undefined;
  const maxItems = props.maxItems ?? 5;

  onMount(async () => {
    try {
      unlisten = await listen("agent-action", (event) => {
        const actionData = event.payload as Partial<AgentAction>;
        setActions((prev) => {
          const actionType = actionData.type || "tool_start";
          // Create default data based on action type
          const defaultData: ActionData = actionData.data ?? { type: actionType } as ToolStartData;
          const newAction: AgentAction = {
            id: actionData.id || generateId(),
            type: actionType,
            timestamp: actionData.timestamp || Date.now(),
            status: actionData.status || "running",
            duration: actionData.duration,
            data: defaultData,
          };
          return [...prev.slice(-(maxItems - 1)), newAction];
        });
      });
    } catch (e) {
      console.error("[AgentActivityFeedCompact] Failed to listen to agent-action:", e);
    }
  });

  onCleanup(() => {
    if (unlisten) unlisten();
  });

  const runningCount = createMemo(() => actions().filter((a) => a.status === "running").length);

  return (
    <div class="activity-feed-compact" onClick={props.onExpand}>
      <div class="activity-feed-compact__header">
        <Icon name="wave-pulse" class="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
        <span>Activity</span>
        <Show when={runningCount() > 0}>
          <LoadingSpinner size={10} style={{ color: "var(--accent)" }} />
        </Show>
      </div>
      <div class="activity-feed-compact__list">
        <For each={actions().slice(-maxItems)}>
          {(action) => <ActionEntry action={action} compact={true} />}
        </For>
        <Show when={actions().length === 0}>
          <span class="activity-feed-compact__empty">No activity</span>
        </Show>
      </div>
    </div>
  );
}

export default AgentActivityFeed;
