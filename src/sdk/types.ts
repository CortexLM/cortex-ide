/**
 * @fileoverview Cortex SDK Type Definitions
 * 
 * This module provides comprehensive TypeScript types for the Cortex CLI SDK.
 * All types are derived from the Rust protocol definitions in cortex-protocol.
 * 
 * @module @cortex/sdk/types
 * @author Cortex Team
 * @license Apache-2.0
 */

// ============================================================================
// SDK Version
// ============================================================================

export const SDK_VERSION = "1.0.0";

// ============================================================================
// Core Identifiers
// ============================================================================

/**
 * Unique conversation/session identifier (UUID format).
 * Used to track and resume conversations across CLI invocations.
 */
export type ConversationId = string;

/**
 * Unique identifier for tool calls within a session.
 */
export type CallId = string;

/**
 * Message identifier for tracking individual messages.
 */
export type MessageId = string;

// ============================================================================
// Autonomy and Permission Types
// ============================================================================

/**
 * Autonomy level for exec mode.
 * Controls what operations the agent can perform without user approval.
 */
export enum AutonomyLevel {
  /**
   * Read-only mode (default). No file modifications or command execution.
   * Safe for reviewing planned changes without execution.
   */
  ReadOnly = "read-only",

  /**
   * Low-risk operations. Enables basic file operations while blocking system changes.
   * Good for: documentation updates, code formatting, adding comments.
   */
  Low = "low",

  /**
   * Development operations. Adds package installation, builds, local git operations.
   * Good for: local development, testing, dependency management.
   */
  Medium = "medium",

  /**
   * Production operations. Enables git push, deployments, sensitive operations.
   * Good for: CI/CD pipelines, automated deployments.
   */
  High = "high",
}

/**
 * Ask for approval policy.
 * Determines when the agent should request user confirmation.
 */
export enum AskForApproval {
  /** Only auto-approve known safe read-only commands. */
  UnlessTrusted = "unless-trusted",
  /** Ask only when user explicitly requests approval. */
  OnRequest = "on-request",
  /** Ask only when an operation fails. */
  OnFailure = "on-failure",
  /** Never ask for approval (use with caution). */
  Never = "never",
}

/**
 * Sandbox policy for command execution.
 */
export type SandboxPolicy =
  | { type: "none" }
  | { type: "read_only" }
  | {
      type: "workspace_write";
      writable_roots: string[];
      network_access: boolean;
      exclude_tmpdir_env_var: boolean;
      exclude_slash_tmp: boolean;
    };

/**
 * Review decision for approval requests.
 */
export enum ReviewDecision {
  Approved = "approved",
  Rejected = "rejected",
  ApproveOnce = "approve_once",
  ApproveSession = "approve_session",
  ApproveForever = "approve_forever",
  EditAndRun = "edit_and_run",
}

/**
 * Sandbox risk level for command assessment.
 */
export enum SandboxRiskLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

// ============================================================================
// Output Format Types
// ============================================================================

/**
 * Output format for exec mode.
 */
export enum ExecOutputFormat {
  /** Human-readable text output (default). */
  Text = "text",
  /** Structured JSON output with final result. */
  Json = "json",
  /** Streaming JSON Lines showing execution in real-time. */
  StreamJson = "stream-json",
  /** JSON-RPC streaming protocol for multi-turn conversations. */
  StreamJsonrpc = "stream-jsonrpc",
}

/**
 * Input format for exec mode.
 */
export enum ExecInputFormat {
  /** Standard text input (default). */
  Text = "text",
  /** JSON-RPC streaming for multi-turn sessions. */
  StreamJsonrpc = "stream-jsonrpc",
}

/**
 * Output format for run command.
 */
export enum RunOutputFormat {
  Default = "default",
  Json = "json",
  Jsonl = "jsonl",
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base event structure from the CLI.
 */
export interface Event {
  /** Submission id this event correlates with. */
  id: string;
  /** The event message payload. */
  msg: EventMsg;
}

/**
 * Union type for all possible event messages.
 */
export type EventMsg =
  | { type: "session_configured"; data: SessionConfiguredEvent }
  | { type: "task_started"; data: TaskStartedEvent }
  | { type: "task_complete"; data: TaskCompleteEvent }
  | { type: "turn_aborted"; data: TurnAbortedEvent }
  | { type: "error"; data: ErrorEvent }
  | { type: "warning"; data: WarningEvent }
  | { type: "stream_error"; data: StreamErrorEvent }
  | { type: "agent_message"; data: AgentMessageEvent }
  | { type: "agent_message_delta"; data: AgentMessageDeltaEvent }
  | { type: "user_message"; data: UserMessageEvent }
  | { type: "agent_reasoning"; data: AgentReasoningEvent }
  | { type: "agent_reasoning_delta"; data: AgentReasoningDeltaEvent }
  | { type: "exec_command_begin"; data: ExecCommandBeginEvent }
  | { type: "exec_command_output_delta"; data: ExecCommandOutputDeltaEvent }
  | { type: "exec_command_end"; data: ExecCommandEndEvent }
  | { type: "exec_approval_request"; data: ExecApprovalRequestEvent }
  | { type: "patch_apply_begin"; data: PatchApplyBeginEvent }
  | { type: "patch_apply_end"; data: PatchApplyEndEvent }
  | { type: "mcp_tool_call_begin"; data: McpToolCallBeginEvent }
  | { type: "mcp_tool_call_end"; data: McpToolCallEndEvent }
  | { type: "mcp_startup_update"; data: McpStartupUpdateEvent }
  | { type: "mcp_startup_complete"; data: McpStartupCompleteEvent }
  | { type: "token_count"; data: TokenCountEvent }
  | { type: "web_search_begin"; data: WebSearchBeginEvent }
  | { type: "web_search_end"; data: WebSearchEndEvent }
  | { type: "plan_update"; data: PlanUpdateEvent }
  | { type: "apply_patch_approval_request"; data: ApplyPatchApprovalRequestEvent };

// ============================================================================
// Session Events
// ============================================================================

/**
 * Event emitted when a session is configured.
 */
export interface SessionConfiguredEvent {
  session_id: ConversationId;
  model?: string;
  provider?: string;
}

/**
 * Event emitted when a task starts.
 */
export interface TaskStartedEvent {
  model_context_window?: number;
  request_id?: string;
}

/**
 * Event emitted when a task completes.
 */
export interface TaskCompleteEvent {
  last_agent_message?: string;
  total_tokens_used?: number;
  execution_time_ms?: number;
}

/**
 * Reason for turn abortion.
 */
export enum TurnAbortReason {
  Interrupted = "interrupted",
  Timeout = "timeout",
  MaxTurnsReached = "max_turns_reached",
  PermissionDenied = "permission_denied",
  UserCancelled = "user_cancelled",
  Error = "error",
}

/**
 * Event emitted when a turn is aborted.
 */
export interface TurnAbortedEvent {
  reason: TurnAbortReason;
  message?: string;
}

// ============================================================================
// Error and Warning Events
// ============================================================================

/**
 * Cortex-specific error info.
 */
export type CortexErrorInfo =
  | "context_window_exceeded"
  | "rate_limit_exceeded"
  | "authentication_error"
  | "model_not_found"
  | "permission_denied"
  | "network_error"
  | "internal_error";

/**
 * Error event from the CLI.
 */
export interface ErrorEvent {
  message: string;
  code?: string;
  error_info?: CortexErrorInfo;
  recoverable?: boolean;
}

/**
 * Warning event from the CLI.
 */
export interface WarningEvent {
  message: string;
  code?: string;
}

/**
 * Stream error event (during streaming).
 */
export interface StreamErrorEvent {
  message: string;
  fatal?: boolean;
}

// ============================================================================
// Message Events
// ============================================================================

/**
 * Agent message event with complete content.
 */
export interface AgentMessageEvent {
  message_id?: MessageId;
  content: string;
  role?: "assistant";
}

/**
 * Agent message delta event (streaming).
 */
export interface AgentMessageDeltaEvent {
  delta: string;
  message_id?: MessageId;
}

/**
 * User message event.
 */
export interface UserMessageEvent {
  message_id?: MessageId;
  content: string;
  images?: string[];
}

/**
 * Agent reasoning event (thinking).
 */
export interface AgentReasoningEvent {
  text: string;
  section_title?: string;
}

/**
 * Agent reasoning delta event (streaming thinking).
 */
export interface AgentReasoningDeltaEvent {
  delta: string;
}

// ============================================================================
// Command Execution Events
// ============================================================================

/**
 * Source of command execution.
 */
export enum ExecCommandSource {
  Agent = "agent",
  User = "user",
  System = "system",
}

/**
 * Parsed command structure.
 */
export interface ParsedCommand {
  program: string;
  args: string[];
  raw_command: string;
}

/**
 * Event emitted when command execution begins.
 */
export interface ExecCommandBeginEvent {
  call_id: CallId;
  command: string;
  parsed_command?: ParsedCommand;
  source?: ExecCommandSource;
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Output stream type.
 */
export enum ExecOutputStream {
  Stdout = "stdout",
  Stderr = "stderr",
}

/**
 * Event emitted for command output.
 */
export interface ExecCommandOutputDeltaEvent {
  call_id: CallId;
  stream: ExecOutputStream;
  data: string;
}

/**
 * Event emitted when command execution ends.
 */
export interface ExecCommandEndEvent {
  call_id: CallId;
  exit_code: number;
  duration_ms?: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Command risk assessment.
 */
export interface SandboxCommandAssessment {
  risk_level: SandboxRiskLevel;
  reasons: string[];
  suggested_action?: string;
}

/**
 * Event requesting approval for command execution.
 */
export interface ExecApprovalRequestEvent {
  call_id: CallId;
  command: string;
  parsed_command?: ParsedCommand;
  assessment: SandboxCommandAssessment;
  cwd?: string;
}

// ============================================================================
// File Patch Events
// ============================================================================

/**
 * Summary of file changes in a patch.
 */
export interface PatchSummary {
  files_added: number;
  files_modified: number;
  files_deleted: number;
  lines_added: number;
  lines_deleted: number;
}

/**
 * File change in a patch.
 */
export type FileChange =
  | { type: "add"; path: string; content: string }
  | { type: "modify"; path: string; old_content: string; new_content: string }
  | { type: "delete"; path: string };

/**
 * Event emitted when patch application begins.
 */
export interface PatchApplyBeginEvent {
  call_id: CallId;
  files: string[];
  summary?: PatchSummary;
}

/**
 * Event emitted when patch application ends.
 */
export interface PatchApplyEndEvent {
  call_id: CallId;
  success: boolean;
  files_modified: string[];
  error_message?: string;
}

/**
 * Event requesting approval for patch application.
 */
export interface ApplyPatchApprovalRequestEvent {
  id: string;
  patch_content: string;
  files: FileChange[];
  summary: PatchSummary;
}

// ============================================================================
// MCP (Model Context Protocol) Events
// ============================================================================

/**
 * MCP tool invocation details.
 */
export interface McpInvocation {
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

/**
 * Event emitted when MCP tool call begins.
 */
export interface McpToolCallBeginEvent {
  call_id: CallId;
  invocation: McpInvocation;
}

/**
 * MCP content types.
 */
export type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "resource"; uri: string; text?: string; blob?: string };

/**
 * MCP tool result.
 */
export interface McpToolResult {
  content: McpContent[];
  is_error?: boolean;
}

/**
 * Event emitted when MCP tool call ends.
 */
export interface McpToolCallEndEvent {
  call_id: CallId;
  result: McpToolResult;
  duration_ms?: number;
}

/**
 * MCP startup status.
 */
export type McpStartupStatus =
  | { state: "starting"; server: string }
  | { state: "ready"; server: string; tools: string[] }
  | { state: "failed"; server: string; error: string };

/**
 * Event emitted during MCP startup.
 */
export interface McpStartupUpdateEvent {
  server: string;
  status: McpStartupStatus;
}

/**
 * Event emitted when MCP startup completes.
 */
export interface McpStartupCompleteEvent {
  ready: string[];
  failed: McpStartupFailure[];
}

/**
 * MCP startup failure details.
 */
export interface McpStartupFailure {
  server: string;
  error: string;
}

/**
 * MCP tool definition.
 */
export interface McpToolDefinition {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

// ============================================================================
// Token Usage Events
// ============================================================================

/**
 * Token usage statistics.
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Token usage info with model details.
 */
export interface TokenUsageInfo {
  total_token_usage: TokenUsage;
  model?: string;
  session_token_usage?: TokenUsage;
}

/**
 * Event emitted with token count information.
 */
export interface TokenCountEvent {
  info?: TokenUsageInfo;
}

// ============================================================================
// Web Search Events
// ============================================================================

/**
 * Event emitted when web search begins.
 */
export interface WebSearchBeginEvent {
  call_id: CallId;
  query: string;
  search_type?: string;
}

/**
 * Web search result.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
}

/**
 * Event emitted when web search ends.
 */
export interface WebSearchEndEvent {
  call_id: CallId;
  results: WebSearchResult[];
  query?: string;
}

// ============================================================================
// Plan/Todo Events
// ============================================================================

/**
 * Plan item status.
 */
export enum PlanItemStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Completed = "completed",
  Skipped = "skipped",
  Failed = "failed",
}

/**
 * Individual plan item.
 */
export interface PlanItem {
  id: string;
  title: string;
  status: PlanItemStatus;
  details?: string;
}

/**
 * Event emitted when plan is updated.
 */
export interface PlanUpdateEvent {
  plan: PlanItem[];
}

// ============================================================================
// User Input Types
// ============================================================================

/**
 * User input types for submissions.
 */
export type UserInput =
  | { type: "text"; text: string }
  | { type: "image"; path: string }
  | { type: "image_base64"; data: string; media_type: string }
  | { type: "file"; path: string }
  | { type: "approval"; decision: ReviewDecision; call_id?: CallId };

/**
 * Submission to the agent.
 */
export interface Submission {
  id: string;
  input: UserInput;
  images?: string[];
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session metadata.
 */
export interface SessionMetadata {
  id: ConversationId;
  title?: string;
  created_at: string;
  updated_at: string;
  model?: string;
  cwd?: string;
  message_count?: number;
  is_locked?: boolean;
  is_favorite?: boolean;
}

/**
 * Session list response.
 */
export interface SessionListResponse {
  sessions: SessionMetadata[];
  total: number;
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * AI model information.
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  context_window?: number;
  max_output_tokens?: number;
  supports_vision?: boolean;
  supports_tools?: boolean;
  pricing?: ModelPricing;
}

/**
 * Model pricing information.
 */
export interface ModelPricing {
  input_per_1k_tokens: number;
  output_per_1k_tokens: number;
  currency: string;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent definition.
 */
export interface AgentDefinition {
  name: string;
  description?: string;
  system_prompt?: string;
  tools?: string[];
  model?: string;
  path?: string;
}

// ============================================================================
// Config Types
// ============================================================================

/**
 * CLI configuration.
 */
export interface CliConfig {
  model?: string;
  provider?: string;
  api_key?: string;
  api_base_url?: string;
  sandbox_mode?: string;
  approval_policy?: string;
  web_search?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// JSON-RPC Types (for stream-jsonrpc mode)
// ============================================================================

/**
 * JSON-RPC request structure.
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC error structure.
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC response structure.
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

/**
 * JSON-RPC notification (no id).
 */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// CLI Exit Codes
// ============================================================================

/**
 * Standard CLI exit codes.
 */
export enum CliExitCode {
  /** Successful execution. */
  Success = 0,
  /** General error. */
  Error = 1,
  /** Command line usage error. */
  UsageError = 2,
  /** Permission denied. */
  PermissionDenied = 126,
  /** Command not found. */
  CommandNotFound = 127,
  /** Interrupted (SIGINT). */
  Interrupted = 130,
  /** Timeout. */
  Timeout = 124,
}

// ============================================================================
// CLI Command Options
// ============================================================================

/**
 * Base options for CLI commands.
 */
export interface BaseCliOptions {
  /** Working directory for the command. */
  cwd?: string;
  /** Model to use. */
  model?: string;
  /** Verbose output. */
  verbose?: boolean;
  /** Timeout in seconds. */
  timeout?: number;
}

/**
 * Options for the exec command.
 */
export interface ExecOptions extends BaseCliOptions {
  /** Output format. */
  outputFormat?: ExecOutputFormat;
  /** Input format. */
  inputFormat?: ExecInputFormat;
  /** Autonomy level. */
  autonomy?: AutonomyLevel;
  /** Skip permission checks (dangerous). */
  skipPermissions?: boolean;
  /** Session ID to continue. */
  sessionId?: string;
  /** Maximum number of turns. */
  maxTurns?: number;
  /** Enabled tools. */
  enabledTools?: string[];
  /** Disabled tools. */
  disabledTools?: string[];
  /** Images to attach. */
  images?: string[];
  /** Custom system prompt. */
  systemPrompt?: string;
  /** Maximum output tokens. */
  maxTokens?: number;
  /** Start in spec mode. */
  useSpec?: boolean;
  /** Model for spec mode. */
  specModel?: string;
}

/**
 * Options for the run command.
 */
export interface RunOptions extends BaseCliOptions {
  /** Output format. */
  format?: RunOutputFormat;
  /** Agent to use. */
  agent?: string;
  /** Files to attach. */
  files?: string[];
  /** Continue previous session. */
  continue?: boolean;
  /** Disable streaming. */
  noStreaming?: boolean;
  /** Enable web search. */
  webSearch?: boolean;
}

/**
 * Options for session listing.
 */
export interface SessionListOptions {
  /** Show all sessions. */
  all?: boolean;
  /** Days to include. */
  days?: number;
  /** Search query. */
  search?: string;
  /** Maximum results. */
  limit?: number;
  /** Show only favorites. */
  favorites?: boolean;
  /** Output as JSON. */
  json?: boolean;
}

/**
 * Options for agent commands.
 */
export interface AgentOptions {
  /** Show as JSON. */
  json?: boolean;
  /** Include global agents. */
  global?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Generic result type for CLI operations.
 */
export interface CliResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  exitCode: number;
  stderr?: string;
  durationMs?: number;
}

/**
 * Streaming event callback.
 */
export type EventCallback = (event: EventMsg) => void;

/**
 * Streaming options.
 */
export interface StreamingOptions {
  onEvent?: EventCallback;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}
