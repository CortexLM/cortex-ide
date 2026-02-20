/**
 * @fileoverview Cortex SDK Error Handling
 * 
 * Provides comprehensive error types and utilities for handling
 * CLI errors, including exit code interpretation and error recovery.
 * 
 * @module @cortex/sdk/errors
 * @author Cortex Team
 * @license Apache-2.0
 */

import type { CortexErrorInfo } from "./types";

// ============================================================================
// Base Error Classes
// ============================================================================

/**
 * Base error class for all Cortex SDK errors.
 */
export class CortexError extends Error {
  /** Error code for programmatic handling. */
  readonly code: string;
  /** Whether this error is potentially recoverable. */
  readonly recoverable: boolean;

  constructor(message: string, code: string, recoverable = false) {
    super(message);
    this.name = "CortexError";
    this.code = code;
    this.recoverable = recoverable;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CortexError);
    }
  }
}

/**
 * Error thrown when CLI execution fails.
 */
export class CliExecutionError extends CortexError {
  /** CLI exit code. */
  readonly exitCode: number;
  /** Standard error output. */
  readonly stderr: string;
  /** Standard output (may contain partial results). */
  readonly stdout: string;
  /** Execution duration in milliseconds. */
  readonly durationMs?: number;

  constructor(
    message: string,
    exitCode: number,
    stdout = "",
    stderr = "",
    durationMs?: number
  ) {
    super(message, getErrorCodeFromExitCode(exitCode), isRecoverableExitCode(exitCode));
    this.name = "CliExecutionError";
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.durationMs = durationMs;
  }

  /**
   * Create from a CLI result.
   */
  static fromResult(result: {
    success: boolean;
    error?: string;
    exitCode: number;
    data?: string;
    stderr?: string;
    durationMs?: number;
  }): CliExecutionError {
    return new CliExecutionError(
      result.error ?? `CLI exited with code ${result.exitCode}`,
      result.exitCode,
      result.data ?? "",
      result.stderr ?? "",
      result.durationMs
    );
  }
}

/**
 * Error thrown when CLI times out.
 */
export class TimeoutError extends CortexError {
  /** Timeout duration in milliseconds. */
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message, "TIMEOUT", true);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when the CLI is not found.
 */
export class CliNotFoundError extends CortexError {
  /** Searched paths. */
  readonly searchedPaths: string[];

  constructor(message: string, searchedPaths: string[] = []) {
    super(message, "CLI_NOT_FOUND", false);
    this.name = "CliNotFoundError";
    this.searchedPaths = searchedPaths;
  }
}

/**
 * Error thrown when permission is denied.
 */
export class PermissionDeniedError extends CortexError {
  /** The operation that was denied. */
  readonly operation: string;
  /** The resource that was accessed. */
  readonly resource?: string;

  constructor(message: string, operation: string, resource?: string) {
    super(message, "PERMISSION_DENIED", false);
    this.name = "PermissionDeniedError";
    this.operation = operation;
    this.resource = resource;
  }
}

/**
 * Error thrown for authentication failures.
 */
export class AuthenticationError extends CortexError {
  /** The authentication method that failed. */
  readonly method?: string;

  constructor(message: string, method?: string) {
    super(message, "AUTHENTICATION_ERROR", true);
    this.name = "AuthenticationError";
    this.method = method;
  }
}

/**
 * Error thrown when rate limited.
 */
export class RateLimitError extends CortexError {
  /** Retry after this many seconds. */
  readonly retryAfterSeconds?: number;
  /** Rate limit window information. */
  readonly limitInfo?: RateLimitInfo;

  constructor(message: string, retryAfterSeconds?: number, limitInfo?: RateLimitInfo) {
    super(message, "RATE_LIMIT_EXCEEDED", true);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limitInfo = limitInfo;
  }
}

/**
 * Error thrown when the context window is exceeded.
 */
export class ContextWindowExceededError extends CortexError {
  /** Current token count. */
  readonly currentTokens?: number;
  /** Maximum allowed tokens. */
  readonly maxTokens?: number;

  constructor(message: string, currentTokens?: number, maxTokens?: number) {
    super(message, "CONTEXT_WINDOW_EXCEEDED", true);
    this.name = "ContextWindowExceededError";
    this.currentTokens = currentTokens;
    this.maxTokens = maxTokens;
  }
}

/**
 * Error thrown when a model is not found.
 */
export class ModelNotFoundError extends CortexError {
  /** The model ID that was not found. */
  readonly modelId: string;
  /** Available models (if known). */
  readonly availableModels?: string[];

  constructor(message: string, modelId: string, availableModels?: string[]) {
    super(message, "MODEL_NOT_FOUND", false);
    this.name = "ModelNotFoundError";
    this.modelId = modelId;
    this.availableModels = availableModels;
  }
}

/**
 * Error thrown when a session is not found.
 */
export class SessionNotFoundError extends CortexError {
  /** The session ID that was not found. */
  readonly sessionId: string;

  constructor(message: string, sessionId: string) {
    super(message, "SESSION_NOT_FOUND", false);
    this.name = "SessionNotFoundError";
    this.sessionId = sessionId;
  }
}

/**
 * Error thrown when JSON parsing fails.
 */
export class JsonParseError extends CortexError {
  /** The raw content that failed to parse. */
  readonly rawContent: string;
  /** The underlying parse error. */
  readonly parseError: Error;

  constructor(message: string, rawContent: string, parseError: Error) {
    super(message, "JSON_PARSE_ERROR", false);
    this.name = "JsonParseError";
    this.rawContent = rawContent;
    this.parseError = parseError;
  }
}

/**
 * Error thrown when a network operation fails.
 */
export class NetworkError extends CortexError {
  /** The URL that was accessed. */
  readonly url?: string;
  /** HTTP status code if applicable. */
  readonly statusCode?: number;

  constructor(message: string, url?: string, statusCode?: number) {
    super(message, "NETWORK_ERROR", true);
    this.name = "NetworkError";
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when the user cancels an operation.
 */
export class CancelledError extends CortexError {
  constructor(message = "Operation cancelled by user") {
    super(message, "CANCELLED", false);
    this.name = "CancelledError";
  }
}

// ============================================================================
// Rate Limit Types
// ============================================================================

/**
 * Rate limit information.
 */
export interface RateLimitInfo {
  /** Used percentage of the rate limit. */
  usedPercent: number;
  /** Remaining requests. */
  remaining?: number;
  /** Reset time (Unix timestamp). */
  resetAt?: number;
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Get error code from CLI exit code.
 */
function getErrorCodeFromExitCode(exitCode: number): string {
  switch (exitCode) {
    case 0:
      return "SUCCESS";
    case 1:
      return "GENERAL_ERROR";
    case 2:
      return "USAGE_ERROR";
    case 126:
      return "PERMISSION_DENIED";
    case 127:
      return "COMMAND_NOT_FOUND";
    case 130:
      return "INTERRUPTED";
    case 124:
      return "TIMEOUT";
    default:
      if (exitCode >= 128 && exitCode < 256) {
        return `SIGNAL_${exitCode - 128}`;
      }
      return `EXIT_${exitCode}`;
  }
}

/**
 * Check if an exit code represents a recoverable error.
 */
function isRecoverableExitCode(exitCode: number): boolean {
  // Timeout and interrupt are recoverable
  if (exitCode === 124 || exitCode === 130) return true;
  // Signal-based exits might be recoverable
  if (exitCode >= 128 && exitCode < 256) return true;
  return false;
}

/**
 * Parse error information from CLI stderr.
 */
export function parseCliError(stderr: string): Partial<ParsedError> {
  const result: Partial<ParsedError> = {};

  // Check for common error patterns
  if (stderr.includes("rate limit") || stderr.includes("too many requests")) {
    result.type = "rate_limit";
    const match = stderr.match(/retry after (\d+)/i);
    if (match) {
      result.retryAfterSeconds = parseInt(match[1], 10);
    }
  } else if (
    stderr.includes("context window exceeded") ||
    stderr.includes("token limit")
  ) {
    result.type = "context_window_exceeded";
    const tokenMatch = stderr.match(/(\d+)\s*\/\s*(\d+)\s*tokens/);
    if (tokenMatch) {
      result.currentTokens = parseInt(tokenMatch[1], 10);
      result.maxTokens = parseInt(tokenMatch[2], 10);
    }
  } else if (
    stderr.includes("authentication") ||
    stderr.includes("unauthorized") ||
    stderr.includes("invalid api key")
  ) {
    result.type = "authentication_error";
  } else if (
    stderr.includes("permission denied") ||
    stderr.includes("access denied")
  ) {
    result.type = "permission_denied";
  } else if (stderr.includes("not found")) {
    if (stderr.includes("model")) {
      result.type = "model_not_found";
    } else if (stderr.includes("session")) {
      result.type = "session_not_found";
    } else if (stderr.includes("command") || stderr.includes("cortex")) {
      result.type = "cli_not_found";
    }
  } else if (
    stderr.includes("timeout") ||
    stderr.includes("timed out")
  ) {
    result.type = "timeout";
  } else if (
    stderr.includes("network") ||
    stderr.includes("connection refused") ||
    stderr.includes("ECONNREFUSED")
  ) {
    result.type = "network_error";
  }

  // Extract any error message
  const messageMatch = stderr.match(/error:\s*(.+?)(?:\n|$)/i);
  if (messageMatch) {
    result.message = messageMatch[1].trim();
  }

  return result;
}

/**
 * Parsed error type (union of CortexErrorInfo and extra types).
 */
export type ParsedErrorType = 
  | CortexErrorInfo 
  | "cli_not_found" 
  | "session_not_found" 
  | "timeout"
  | "rate_limit";

/**
 * Parsed error information.
 */
export interface ParsedError {
  type: ParsedErrorType;
  message?: string;
  retryAfterSeconds?: number;
  currentTokens?: number;
  maxTokens?: number;
}

/**
 * Create a typed error from CLI result.
 */
export function createErrorFromResult(result: {
  success: boolean;
  error?: string;
  exitCode: number;
  data?: string;
  stderr?: string;
  durationMs?: number;
}): CortexError {
  const stderr = result.stderr ?? result.error ?? "";
  const parsed = parseCliError(stderr);

  switch (parsed.type) {
    case "rate_limit":
    case "rate_limit_exceeded":
      return new RateLimitError(
        parsed.message ?? "Rate limit exceeded",
        parsed.retryAfterSeconds
      );
    case "context_window_exceeded":
      return new ContextWindowExceededError(
        parsed.message ?? "Context window exceeded",
        parsed.currentTokens,
        parsed.maxTokens
      );
    case "authentication_error":
      return new AuthenticationError(parsed.message ?? "Authentication failed");
    case "permission_denied":
      return new PermissionDeniedError(
        parsed.message ?? "Permission denied",
        "unknown"
      );
    case "model_not_found":
      return new ModelNotFoundError(parsed.message ?? "Model not found", "unknown");
    case "session_not_found":
      return new SessionNotFoundError(
        parsed.message ?? "Session not found",
        "unknown"
      );
    case "cli_not_found":
      return new CliNotFoundError(parsed.message ?? "CLI not found");
    case "timeout":
      return new TimeoutError(parsed.message ?? "Operation timed out", 0);
    case "network_error":
      return new NetworkError(parsed.message ?? "Network error");
    default:
      return CliExecutionError.fromResult(result);
  }
}

/**
 * Check if an error is a specific type.
 */
export function isCortexError(error: unknown): error is CortexError {
  return error instanceof CortexError;
}

/**
 * Check if an error is recoverable.
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof CortexError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Get suggested retry delay for an error.
 */
export function getRetryDelay(error: unknown, attempt: number): number {
  // If it's a rate limit error with retry info, use that
  if (error instanceof RateLimitError && error.retryAfterSeconds) {
    return error.retryAfterSeconds * 1000;
  }

  // Exponential backoff with jitter
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 1000;

  return exponentialDelay + jitter;
}

/**
 * Retry an operation with exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const shouldRetry = options.shouldRetry ?? isRecoverableError;
  const onRetry = options.onRetry;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts - 1 || !shouldRetry(error)) {
        throw error;
      }

      const delay = getRetryDelay(error, attempt);
      onRetry?.(error, attempt, delay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Options for retry operations.
 */
export interface RetryOptions {
  /** Maximum number of attempts. */
  maxAttempts?: number;
  /** Function to determine if an error should trigger a retry. */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback when a retry is about to happen. */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format an error for display.
 */
export function formatError(error: unknown): string {
  if (error instanceof CliExecutionError) {
    let message = `CLI Error (exit code ${error.exitCode}): ${error.message}`;
    if (error.stderr) {
      message += `\n\nStderr:\n${error.stderr}`;
    }
    return message;
  }

  if (error instanceof CortexError) {
    return `${error.name} [${error.code}]: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Format an error for logging.
 */
export function formatErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof CortexError) {
    const base: Record<string, unknown> = {
      name: error.name,
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      stack: error.stack,
    };

    if (error instanceof CliExecutionError) {
      return {
        ...base,
        exitCode: error.exitCode,
        stderr: error.stderr,
        stdout: error.stdout,
        durationMs: error.durationMs,
      };
    }

    if (error instanceof TimeoutError) {
      return { ...base, timeoutMs: error.timeoutMs };
    }

    if (error instanceof RateLimitError) {
      return {
        ...base,
        retryAfterSeconds: error.retryAfterSeconds,
        limitInfo: error.limitInfo,
      };
    }

    return base;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error: String(error) };
}
