/**
 * Retry Logic with Quadratic Backoff (VS Code Pattern)
 * 
 * Provides utilities for retrying operations that may fail
 * due to transient errors like locked repositories.
 */

import { GitErrorCode, isRetryableError } from "./git/errors";

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 10) */
  maxAttempts?: number;
  /** List of error codes that should trigger a retry */
  retryOnErrors?: GitErrorCode[];
  /** Base delay in milliseconds for backoff calculation (default: 50) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelayMs?: number;
  /** Callback called before each retry */
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

/**
 * Default error codes that trigger automatic retry
 */
const DEFAULT_RETRYABLE_ERRORS: GitErrorCode[] = [
  GitErrorCode.RepositoryIsLocked,
  GitErrorCode.CantLockRef,
];

/**
 * Execute an operation with automatic retry and quadratic backoff
 * 
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => invoke("git_commit", { path, message }),
 *   { maxAttempts: 5 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 10,
    retryOnErrors = DEFAULT_RETRYABLE_ERRORS,
    baseDelayMs = 50,
    maxDelayMs = 5000,
    onRetry,
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Get the error code from the error object
      const gitErrorCode = error.gitErrorCode as GitErrorCode | undefined;
      
      // Check if we should retry
      const shouldRetry = 
        attempt < maxAttempts &&
        gitErrorCode &&
        (retryOnErrors.includes(gitErrorCode) || isRetryableError(gitErrorCode));
      
      if (shouldRetry) {
        // Calculate delay with quadratic backoff: 50ms, 200ms, 450ms, 800ms, 1250ms...
        // Capped at maxDelayMs
        const delay = Math.min(Math.pow(attempt, 2) * baseDelayMs, maxDelayMs);
        
        // Notify about retry
        onRetry?.(attempt, error, delay);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Not a retryable error or max attempts reached
        throw error;
      }
    }
  }
  
  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Result type for operations that can fail gracefully
 */
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Execute an operation and return a Result instead of throwing
 */
export async function tryOperation<T>(
  operation: () => Promise<T>
): Promise<Result<T>> {
  try {
    const value = await operation();
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Execute an operation with retry and return a Result
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<Result<T>> {
  try {
    const value = await withRetry(operation, options);
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Delay execution for a specified duration
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute multiple operations in parallel with individual retry
 */
export async function withRetryAll<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<T[]> {
  return Promise.all(
    operations.map(op => withRetry(op, options))
  );
}

/**
 * Execute multiple operations in parallel, settling all regardless of failures
 */
export async function withRetryAllSettled<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<Result<T>>> {
  return Promise.all(
    operations.map(op => withRetryResult(op, options))
  );
}
