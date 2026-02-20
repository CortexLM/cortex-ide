/**
 * LLM Provider Types and Interfaces
 * Unified type definitions for multi-provider LLM support
 */

// ============================================================================
// Provider Types
// ============================================================================

export type LLMProviderType = 
  | "anthropic"
  | "openai"
  | "google"
  | "mistral"
  | "deepseek"
  | "openrouter";

// ============================================================================
// Message Types
// ============================================================================

export interface LLMMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// ============================================================================
// Tool Definition
// ============================================================================

export interface LLMToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface LLMRequestOptions {
  model: string;
  messages: LLMMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  tools?: LLMToolDefinition[];
  stopSequences?: string[];
}

export interface LLMResponse {
  id: string;
  content: string;
  role: "assistant";
  model: string;
  toolCalls?: LLMToolCall[];
  usage?: LLMUsage;
  finishReason?: "stop" | "tool_use" | "length" | "error";
}

export interface LLMStreamChunk {
  type: "text" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "usage" | "done" | "error";
  content?: string;
  toolCall?: Partial<LLMToolCall>;
  usage?: LLMUsage;
  error?: string;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

// ============================================================================
// Model Definitions
// ============================================================================

export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProviderType;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsThinking?: boolean;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  description?: string;
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface LLMProviderSettings {
  anthropic?: LLMProviderConfig;
  openai?: LLMProviderConfig;
  google?: LLMProviderConfig;
  mistral?: LLMProviderConfig;
  deepseek?: LLMProviderConfig;
  openrouter?: LLMProviderConfig;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface LLMProvider {
  readonly type: LLMProviderType;
  readonly name: string;
  readonly isConfigured: boolean;
  
  configure(config: LLMProviderConfig): void;
  getModels(): LLMModel[];
  getDefaultModel(): LLMModel;
  
  complete(options: LLMRequestOptions): Promise<LLMResponse>;
  stream(options: LLMRequestOptions): AsyncGenerator<LLMStreamChunk, void, unknown>;
  
  countTokens?(text: string, model?: string): Promise<number>;
  validateApiKey?(): Promise<boolean>;
}

// ============================================================================
// Error Types
// ============================================================================

export class LLMError extends Error {
  constructor(
    message: string,
    public code: LLMErrorCode,
    public provider: LLMProviderType,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export type LLMErrorCode = 
  | "INVALID_API_KEY"
  | "RATE_LIMIT"
  | "CONTEXT_LENGTH_EXCEEDED"
  | "INVALID_REQUEST"
  | "MODEL_NOT_FOUND"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "CONTENT_FILTERED"
  | "UNKNOWN";

// ============================================================================
// Utility Types
// ============================================================================

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

export interface ProviderStatus {
  type: LLMProviderType;
  name: string;
  isConfigured: boolean;
  isConnected: boolean;
  lastError?: string;
  modelCount: number;
}
