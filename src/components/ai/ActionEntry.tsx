import { Show, createSignal, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { LoadingSpinner } from "@/components/ui";

// ============================================================================
// Types
// ============================================================================

export type AgentActionType =
  | "file_read"
  | "file_edit"
  | "file_create"
  | "file_delete"
  | "terminal_command"
  | "terminal_output"
  | "thinking"
  | "tool_start"
  | "tool_complete"
  | "tool_error";

export type ActionStatus = "running" | "success" | "error" | "pending";

export interface AgentAction {
  id: string;
  type: AgentActionType;
  timestamp: number;
  status: ActionStatus;
  duration?: number;
  data: ActionData;
}

export type ActionData =
  | FileReadData
  | FileEditData
  | FileCreateData
  | FileDeleteData
  | TerminalCommandData
  | TerminalOutputData
  | ThinkingData
  | ToolStartData
  | ToolCompleteData
  | ToolErrorData;

export interface FileReadData {
  type: "file_read";
  path: string;
  lineCount?: number;
  preview?: string;
}

export interface FileEditData {
  type: "file_edit";
  path: string;
  linesAdded?: number;
  linesRemoved?: number;
  diff?: string;
}

export interface FileCreateData {
  type: "file_create";
  path: string;
  lineCount?: number;
}

export interface FileDeleteData {
  type: "file_delete";
  path: string;
}

export interface TerminalCommandData {
  type: "terminal_command";
  command: string;
  cwd?: string;
}

export interface TerminalOutputData {
  type: "terminal_output";
  output: string;
  exitCode?: number;
}

export interface ThinkingData {
  type: "thinking";
  content?: string;
}

export interface ToolStartData {
  type: "tool_start";
  toolName: string;
  args?: Record<string, unknown>;
}

export interface ToolCompleteData {
  type: "tool_complete";
  toolName: string;
  result?: string;
  success: boolean;
}

export interface ToolErrorData {
  type: "tool_error";
  toolName: string;
  error: string;
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[/\\]/);
  if (parts.length <= 2) return path.slice(-maxLength);
  return `.../${parts.slice(-2).join("/")}`;
}

// ============================================================================
// Action Icon Component
// ============================================================================

function getActionIcon(type: AgentActionType) {
  switch (type) {
    case "file_read":
      return <Icon name="eye" class="w-3.5 h-3.5" />;
    case "file_edit":
      return <Icon name="pen" class="w-3.5 h-3.5" />;
    case "file_create":
      return <Icon name="plus" class="w-3.5 h-3.5" />;
    case "file_delete":
      return <Icon name="trash" class="w-3.5 h-3.5" />;
    case "terminal_command":
    case "terminal_output":
      return <Icon name="terminal" class="w-3.5 h-3.5" />;
    case "thinking":
      return <Icon name="microchip" class="w-3.5 h-3.5" />;
    case "tool_start":
    case "tool_complete":
    case "tool_error":
      return <Icon name="wrench" class="w-3.5 h-3.5" />;
    default:
      return <Icon name="code" class="w-3.5 h-3.5" />;
  }
}

function getActionColor(type: AgentActionType): string {
  switch (type) {
    case "file_read":
      return "var(--vscode-textLink-foreground)";
    case "file_edit":
      return "var(--vscode-notificationsWarningIcon-foreground)";
    case "file_create":
      return "var(--vscode-chat-linesAddedForeground)";
    case "file_delete":
      return "var(--vscode-chat-linesRemovedForeground)";
    case "terminal_command":
    case "terminal_output":
      return "var(--vscode-terminal-ansiCyan, var(--cortex-info))";
    case "thinking":
      return "var(--vscode-notificationsInfoIcon-foreground)";
    case "tool_start":
    case "tool_complete":
      return "var(--accent)";
    case "tool_error":
      return "var(--vscode-errorForeground)";
    default:
      return "var(--text-weak)";
  }
}

function getStatusIcon(status: ActionStatus) {
  switch (status) {
    case "running":
      return <LoadingSpinner size={12} style={{ color: "var(--accent)" }} />;
    case "success":
      return <Icon name="check" class="w-3 h-3" style={{ color: "var(--vscode-chat-linesAddedForeground)" }} />;
    case "error":
      return <Icon name="xmark" class="w-3 h-3" style={{ color: "var(--vscode-errorForeground)" }} />;
    case "pending":
      return <Icon name="clock" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />;
    default:
      return null;
  }
}

// ============================================================================
// ActionEntry Component
// ============================================================================

export interface ActionEntryProps {
  action: AgentAction;
  compact?: boolean;
  defaultExpanded?: boolean;
  animate?: boolean;
}

export function ActionEntry(props: ActionEntryProps) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? false);

  const isExpandable = createMemo(() => {
    const data = props.action.data;
    return (
      data.type === "terminal_output" ||
      data.type === "file_edit" ||
      data.type === "thinking" ||
      data.type === "tool_complete" ||
      data.type === "tool_error"
    );
  });

  const actionTitle = createMemo(() => {
    const data = props.action.data;
    switch (data.type) {
      case "file_read":
        return `Reading ${getFileName(data.path)}`;
      case "file_edit":
        return `Editing ${getFileName(data.path)}`;
      case "file_create":
        return `Creating ${getFileName(data.path)}`;
      case "file_delete":
        return `Deleting ${getFileName(data.path)}`;
      case "terminal_command":
        return `$ ${data.command.length > 50 ? data.command.slice(0, 50) + "..." : data.command}`;
      case "terminal_output":
        return "Terminal Output";
      case "thinking":
        return "Thinking...";
      case "tool_start":
        return `Running ${data.toolName}`;
      case "tool_complete":
        return `Completed ${data.toolName}`;
      case "tool_error":
        return `Error in ${data.toolName}`;
      default:
        return "Action";
    }
  });

  const actionSubtitle = createMemo(() => {
    const data = props.action.data;
    switch (data.type) {
      case "file_read":
        return data.lineCount ? `${data.lineCount} lines` : truncatePath(data.path);
      case "file_edit": {
        const parts: string[] = [];
        if (data.linesAdded) parts.push(`+${data.linesAdded}`);
        if (data.linesRemoved) parts.push(`-${data.linesRemoved}`);
        return parts.length > 0 ? parts.join(" ") : truncatePath(data.path);
      }
      case "file_create":
        return data.lineCount ? `${data.lineCount} lines` : truncatePath(data.path);
      case "file_delete":
        return truncatePath(data.path);
      case "terminal_command":
        return data.cwd ? `in ${truncatePath(data.cwd, 30)}` : undefined;
      case "terminal_output":
        return data.exitCode !== undefined ? `exit ${data.exitCode}` : undefined;
      case "tool_start":
        return data.args ? `${Object.keys(data.args).length} args` : undefined;
      case "tool_complete":
        return data.success ? "success" : "failed";
      case "tool_error":
        return data.error.slice(0, 40);
      default:
        return undefined;
    }
  });

  const expandedContent = createMemo(() => {
    const data = props.action.data;
    switch (data.type) {
      case "terminal_output":
        return data.output;
      case "file_edit":
        return data.diff;
      case "thinking":
        return data.content;
      case "tool_complete":
        return data.result;
      case "tool_error":
        return data.error;
      default:
        return undefined;
    }
  });

  return (
    <div
      class="action-entry"
      classList={{
        "action-entry--compact": props.compact,
        "action-entry--expandable": isExpandable(),
        "action-entry--expanded": expanded(),
        "action-entry--animate": props.animate,
        "action-entry--running": props.action.status === "running",
        "action-entry--error": props.action.status === "error",
      }}
      style={{
        "--action-color": getActionColor(props.action.type),
      }}
    >
      {/* Main Row */}
      <div
        class="action-entry__header"
        onClick={() => isExpandable() && setExpanded(!expanded())}
        role={isExpandable() ? "button" : undefined}
        tabIndex={isExpandable() ? 0 : undefined}
        onKeyDown={(e) => {
          if (isExpandable() && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded());
          }
        }}
      >
        {/* Expand/Collapse Indicator */}
        <Show when={isExpandable()}>
          <span class="action-entry__chevron">
            <Show when={expanded()} fallback={<Icon name="chevron-right" class="w-3 h-3" />}>
              <Icon name="chevron-down" class="w-3 h-3" />
            </Show>
          </span>
        </Show>
        <Show when={!isExpandable()}>
          <span class="action-entry__chevron-placeholder" />
        </Show>

        {/* Icon */}
        <span class="action-entry__icon" style={{ color: getActionColor(props.action.type) }}>
          {getActionIcon(props.action.type)}
        </span>

        {/* Title & Subtitle */}
        <div class="action-entry__content">
          <span class="action-entry__title">{actionTitle()}</span>
          <Show when={actionSubtitle() && !props.compact}>
            <span class="action-entry__subtitle">{actionSubtitle()}</span>
          </Show>
        </div>

        {/* Status Badge */}
        <Show when={props.action.data.type === "file_create"}>
          <span class="action-entry__badge action-entry__badge--success">new</span>
        </Show>
        <Show when={props.action.data.type === "file_delete"}>
          <span class="action-entry__badge action-entry__badge--error">del</span>
        </Show>
        <Show when={props.action.data.type === "file_edit"}>
          <div class="action-entry__diff-stats">
            <Show when={(props.action.data as FileEditData).linesAdded}>
              <span class="action-entry__diff-added">+{(props.action.data as FileEditData).linesAdded}</span>
            </Show>
            <Show when={(props.action.data as FileEditData).linesRemoved}>
              <span class="action-entry__diff-removed">-{(props.action.data as FileEditData).linesRemoved}</span>
            </Show>
          </div>
        </Show>

        {/* Duration */}
        <Show when={props.action.duration && !props.compact}>
          <span class="action-entry__duration">{formatDuration(props.action.duration!)}</span>
        </Show>

        {/* Status Icon */}
        <span class="action-entry__status">{getStatusIcon(props.action.status)}</span>

        {/* Timestamp */}
        <Show when={!props.compact}>
          <span class="action-entry__timestamp">{formatTimestamp(props.action.timestamp)}</span>
        </Show>
      </div>

      {/* Expanded Content */}
      <Show when={expanded() && expandedContent()}>
        <div class="action-entry__body">
          <pre class="action-entry__code">{expandedContent()}</pre>
        </div>
      </Show>
    </div>
  );
}

export default ActionEntry;

