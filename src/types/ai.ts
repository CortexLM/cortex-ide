/**
 * AI Types
 *
 * Centralized type definitions for AI-related functionality including
 * models, threads, messages, tools, and sub-agents.
 */

// ============================================================================
// AI Model Types
// ============================================================================

/**
 * AI model information.
 */
export interface AIModel {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Provider (e.g., "anthropic", "openai") */
  provider: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Whether model supports streaming */
  supportsStreaming: boolean;
  /** Whether model supports tool use */
  supportsTools: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role types.
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * File context attached to a message.
 */
export interface FileContext {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** Programming language */
  language: string;
}

/**
 * Context information for a message.
 */
export interface MessageContext {
  /** Primary file context */
  file?: FileContext;
  /** Additional file paths */
  files?: string[];
  /** Selected text */
  selection?: string;
  /** Diagnostic messages */
  diagnostics?: string[];
  /** Workspace name */
  workspace?: string;
  /** Workspace path */
  workspacePath?: string;
}

/**
 * Tool call within a message.
 */
export interface ToolCall {
  /** Unique call identifier */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
  /** Call status */
  status: "pending" | "running" | "completed" | "failed";
}

/**
 * Result of a tool call.
 */
export interface ToolResult {
  /** Associated call ID */
  callId: string;
  /** Tool output */
  output: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  durationMs?: number;
}

/**
 * A chat message.
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Creation timestamp */
  timestamp: number;
  /** Tool calls made by this message */
  toolCalls?: ToolCall[];
  /** Tool results for this message */
  toolResults?: ToolResult[];
  /** Whether this message represents an error */
  isError?: boolean;
  /** Context attached to the message */
  context?: MessageContext;
}

/**
 * Alias for backward compatibility.
 */
export type AIMessage = Message;

// ============================================================================
// Thread Types
// ============================================================================

/**
 * A conversation thread.
 */
export interface Thread {
  /** Unique thread identifier */
  id: string;
  /** Thread title */
  title: string;
  /** Messages in the thread */
  messages: Message[];
  /** Model used for this thread */
  model: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Session containing multiple threads.
 */
export interface Session {
  /** Session identifier */
  id: string;
  /** Session name */
  name: string;
  /** Threads in this session */
  threads: Thread[];
  /** Active thread ID */
  activeThreadId: string | null;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessedAt: number;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Tool parameter definition.
 */
export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Parameter description */
  description: string;
  /** Whether parameter is required */
  required: boolean;
  /** Default value if any */
  default?: unknown;
  /** Enum values if applicable */
  enum?: string[];
}

/**
 * Tool definition.
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool parameters */
  parameters: ToolParameter[];
  /** Tool category */
  category?: string;
  /** Whether tool is enabled */
  enabled?: boolean;
}

// ============================================================================
// Sub-Agent Types
// ============================================================================

/**
 * Sub-agent status.
 */
export type SubAgentStatus = "idle" | "running" | "completed" | "failed";

/**
 * A sub-agent instance.
 */
export interface SubAgent {
  /** Agent identifier */
  id: string;
  /** Agent name */
  name: string;
  /** Agent description */
  description: string;
  /** Current status */
  status: SubAgentStatus;
  /** Parent agent ID if spawned by another agent */
  parentId?: string;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Creation timestamp */
  createdAt?: number;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * A chunk of streaming content.
 */
export interface StreamChunk {
  /** Content fragment */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
}

// ============================================================================
// AI State Types
// ============================================================================

/**
 * AI provider state.
 */
export interface AIState {
  /** Available models */
  models: AIModel[];
  /** Currently selected model ID */
  selectedModel: string;
  /** All threads */
  threads: Thread[];
  /** Active thread ID */
  activeThreadId: string | null;
  /** Active sub-agents */
  agents: SubAgent[];
  /** Available tools */
  tools: ToolDefinition[];
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current streaming content */
  streamingContent: string;
  /** Abort controller for current stream */
  currentStreamAbortController: AbortController | null;
}

// ============================================================================
// Inline Suggestions Types
// ============================================================================

/**
 * Inline code suggestion.
 */
export interface InlineSuggestion {
  /** Suggestion text */
  text: string;
  /** Position to insert at */
  position: {
    line: number;
    column: number;
  };
  /** Range to replace (if any) */
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  /** Source of suggestion */
  source: "copilot" | "supermaven" | "local";
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Completion item for code completion.
 */
export interface CompletionItem {
  /** Label to display */
  label: string;
  /** Text to insert */
  insertText: string;
  /** Item kind */
  kind: string;
  /** Detail text */
  detail?: string;
  /** Documentation */
  documentation?: string;
  /** Sort priority */
  sortText?: string;
  /** Filter text */
  filterText?: string;
}
