/**
 * Event Types
 *
 * Centralized type definitions for event payloads used across the application
 * for Tauri IPC events and custom DOM events.
 *
 * ## AI Event Pipelines
 *
 * There are two separate AI event pipelines:
 *
 * ### Pipeline 1: Cortex Protocol (Primary)
 * - **Tauri Event:** `"cortex:event"`
 * - **Payload:** `WsMessage` (see `src-tauri/src/ai/protocol.rs`)
 * - **Emitter:** `session.rs` via `convert_event_to_ws()`
 * - **Listeners:** `SDKContext.tsx`, `AgentFollowContext.tsx`
 * - Handles: streaming, tool calls, approvals, task lifecycle, terminals
 *
 * ### Pipeline 2: Legacy AI Module
 * - **Tauri Events:** `"ai:stream-chunk"`, `"ai:tool-call"`, `"ai:tool-result"`, `"ai:error"`
 * - **Emitter:** `ai/mod.rs` (`ai_stream` command)
 * - **Listeners:** `AIContext.tsx`, `AIStreamContext.tsx`, `InlineAssistant.tsx`
 * - Handles: direct model streaming, inline completions
 *
 * See `docs/AI_EVENT_CONTRACTS.md` for the full event contract reference.
 */

// ============================================================================
// AI Event Payloads (Legacy Pipeline: "ai:*" events)
// ============================================================================

/**
 * Stream chunk event from AI streaming.
 *
 * **Tauri Event:** `"ai:stream-chunk"`
 * **Emitter:** `ai/mod.rs` → `ai_stream` command
 * **Pipeline:** Legacy AI Module
 */
export interface StreamChunkEvent {
  /** Thread ID receiving the chunk */
  threadId: string;
  /** Content chunk */
  content: string;
  /** Whether streaming is complete */
  done: boolean;
}

/**
 * Tool call event from AI.
 *
 * **Tauri Event:** `"ai:tool-call"`
 * **Emitter:** `ai/mod.rs` → `ai_stream` command (when model returns tool calls)
 * **Pipeline:** Legacy AI Module
 */
export interface ToolCallEvent {
  /** Thread ID where tool was called */
  threadId: string;
  /** Unique call identifier */
  callId: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Tool result event.
 *
 * **Tauri Event:** `"ai:tool-result"`
 * **Pipeline:** Legacy AI Module
 * **Note:** Currently only consumed by `CortexAIModificationsPanel.tsx`.
 * Tool results in the primary pipeline flow through `"cortex:event"` as
 * `tool_call_end` messages instead.
 */
export interface ToolResultEvent {
  /** Thread ID */
  threadId: string;
  /** Call identifier */
  callId: string;
  /** Tool output */
  output: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Agent status change event.
 *
 * **Tauri Event:** `"ai:agent-status"`
 * **Emitter:** `ai/agents/commands.rs`
 * **Pipeline:** Legacy AI Module
 */
export interface AgentStatusEvent {
  /** Agent identifier */
  agentId: string;
  /** New status */
  status: "idle" | "running" | "completed" | "failed";
}

/**
 * AI error event.
 *
 * **Tauri Event:** `"ai:error"`
 * **Pipeline:** Legacy AI Module
 * **Note:** Errors in the primary pipeline flow through `"cortex:event"` as
 * `error` messages with `{ code, message }` payload.
 */
export interface AIErrorEvent {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
}

// ============================================================================
// Terminal Event Payloads
// ============================================================================

/**
 * Terminal output event.
 */
export interface TerminalOutputEvent {
  /** Terminal ID */
  terminal_id: string;
  /** Output data */
  data: string;
}

/**
 * Terminal status change event.
 */
export interface TerminalStatusEvent {
  /** Terminal ID */
  terminal_id: string;
  /** New status */
  status: string;
  /** Exit code if applicable */
  exit_code?: number;
}

/**
 * Terminal created event.
 */
export interface TerminalCreatedEvent {
  /** Terminal ID */
  id: string;
  /** Terminal name */
  name: string;
  /** Current working directory */
  cwd: string;
  /** Shell path */
  shell: string;
}

// ============================================================================
// File System Event Payloads
// ============================================================================

/**
 * File saved event.
 */
export interface FileSavedEvent {
  /** File path */
  path: string;
  /** File ID */
  fileId: string;
}

/**
 * File changed event (from file watcher).
 */
export interface FileChangedEvent {
  /** File path */
  path: string;
  /** Type of change */
  kind: "create" | "modify" | "delete" | "rename";
  /** New path for rename events */
  newPath?: string;
}

/**
 * File closing event (before editor cleanup).
 */
export interface FileClosingEvent {
  /** File ID being closed */
  fileId: string;
}

// ============================================================================
// Workspace Event Payloads
// ============================================================================

/**
 * Folder added to workspace event.
 */
export interface FolderAddedEvent {
  /** Folder path */
  path: string;
}

/**
 * Folder removed from workspace event.
 */
export interface FolderRemovedEvent {
  /** Folder path */
  path: string;
}

/**
 * Workspace loaded event.
 */
export interface WorkspaceLoadedEvent {
  /** Workspace file path */
  filePath: string;
  /** Workspace format (if detected) */
  format?: "cortex" | "vscode";
}

/**
 * Project opened event.
 */
export interface ProjectOpenedEvent {
  /** Project path */
  path: string;
}

// ============================================================================
// Settings Event Payloads
// ============================================================================

/**
 * Settings changed event.
 */
export interface SettingsChangedEvent {
  /** Section that changed */
  section: string;
  /** New settings value */
  settings?: unknown;
}

/**
 * Settings reset event.
 */
export interface SettingsResetEvent {
  /** Section that was reset (or all if undefined) */
  section?: string;
}

/**
 * Workspace settings changed event.
 */
export interface WorkspaceSettingsChangedEvent {
  /** Section changed */
  section: string;
  /** Key changed */
  key: string;
  /** New value */
  value: unknown;
}

// ============================================================================
// Notification Event Payloads
// ============================================================================

/**
 * Notification event.
 */
export interface NotificationEvent {
  /** Notification type */
  type: "info" | "success" | "warning" | "error";
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Duration in ms (optional) */
  duration?: number;
  /** Actions (optional) */
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// ============================================================================
// Git Event Payloads
// ============================================================================

/**
 * Git status changed event.
 */
export interface GitStatusChangedEvent {
  /** Repository path */
  repoPath: string;
  /** Current branch */
  branch: string | null;
  /** Number of staged files */
  stagedCount: number;
  /** Number of unstaged files */
  unstagedCount: number;
}

/**
 * Git branch changed event.
 */
export interface GitBranchChangedEvent {
  /** Repository path */
  repoPath: string;
  /** Previous branch */
  previousBranch: string | null;
  /** New branch */
  newBranch: string;
}

// ============================================================================
// Editor Event Payloads
// ============================================================================

/**
 * Cursor position changed event.
 */
export interface CursorPositionChangedEvent {
  /** File ID */
  fileId: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** All cursor positions (for multi-cursor) */
  cursors?: Array<{ line: number; column: number }>;
}

/**
 * Selection changed event.
 */
export interface SelectionChangedEvent {
  /** File ID */
  fileId: string;
  /** Selections */
  selections: Array<{
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }>;
}

// ============================================================================
// Debug Event Payloads
// ============================================================================

/**
 * Debug session state.
 */
export type DebugSessionStateType =
  | { type: "initializing" }
  | { type: "running" }
  | { type: "stopped"; reason: string; threadId?: number; description?: string }
  | { type: "ended" };

/**
 * Debug event payload - union of all possible debug events from backend.
 */
export type DebugEvent =
  | { type: "stateChanged"; state: DebugSessionStateType }
  | { type: "threadsUpdated"; threads: Array<{ id: number; name: string; stopped?: boolean }> }
  | { type: "stackTraceUpdated"; frames: Array<{
      id: number;
      name: string;
      source?: { name?: string; path?: string; sourceReference?: number };
      line: number;
      column: number;
      endLine?: number;
      endColumn?: number;
      canRestart?: boolean;
      presentationHint?: string;
    }> }
  | { type: "variablesUpdated"; variables: Array<{
      name: string;
      value: string;
      type?: string;
      variablesReference: number;
      namedVariables?: number;
      indexedVariables?: number;
      evaluateName?: string;
    }> }
  | { type: "breakpointsChanged"; path: string; breakpoints: Array<{
      id?: number;
      path: string;
      line: number;
      column?: number;
      endColumn?: number;
      verified: boolean;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
      message?: string;
      enabled: boolean;
      isLogpoint?: boolean;
      logHitCount?: number;
      triggeredBy?: string | null;
      isTriggeredBreakpoint?: boolean;
    }> }
  | { type: "dataBreakpointHit"; id: string }
  | { type: "dataBreakpointsChanged"; breakpoints: Array<{
      id: string;
      variableName: string;
      accessType: "read" | "write" | "readWrite";
      enabled: boolean;
      hitCount: number;
      verified?: boolean;
      description?: string;
      dataId?: string;
    }> }
  | { type: "output"; category: string; output: string; source?: string; line?: number }
  | { type: "terminated"; sessionId?: string }
  | { type: "exited"; exitCode: number; sessionId?: string }
  | { type: "capabilitiesReceived"; debugType?: string; exceptionBreakpointFilters?: Array<{
      filter: string;
      label: string;
      description?: string;
      default?: boolean;
      supportsCondition?: boolean;
      conditionDescription?: string;
    }> };

/**
 * Debug session started event.
 */
export interface DebugSessionStartedEvent {
  /** Session ID */
  sessionId: string;
  /** Debug configuration name */
  name: string;
  /** Debug type */
  type: string;
}

/**
 * Breakpoint hit event.
 */
export interface BreakpointHitEvent {
  /** Session ID */
  sessionId: string;
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Breakpoint ID */
  breakpointId?: string;
}

// ============================================================================
// Command Event Payloads
// ============================================================================

/**
 * Command executed event.
 */
export interface CommandExecutedEvent {
  /** Command ID */
  commandId: string;
  /** Arguments passed */
  args?: unknown[];
  /** Execution result */
  result?: unknown;
}

// ============================================================================
// Extension Event Payloads
// ============================================================================

/**
 * Extension installed event.
 */
export interface ExtensionInstalledEvent {
  /** Extension ID */
  extensionId: string;
  /** Extension version */
  version: string;
}

/**
 * Extension activated event.
 */
export interface ExtensionActivatedEvent {
  /** Extension ID */
  extensionId: string;
  /** Activation time in ms */
  activationTime: number;
}

// ============================================================================
// Window Event Payloads
// ============================================================================

/**
 * Window focus changed event.
 */
export interface WindowFocusChangedEvent {
  /** Whether window is focused */
  focused: boolean;
}

/**
 * Window resized event.
 */
export interface WindowResizedEvent {
  /** New width */
  width: number;
  /** New height */
  height: number;
}
