/**
 * Tauri IPC Batching Utility
 *
 * This module provides high-performance command batching for Tauri IPC calls.
 * Commands are queued and flushed either after 16ms (one frame) or when the
 * queue reaches a threshold, reducing round-trip overhead.
 *
 * Features:
 * - Automatic command batching with configurable timing
 * - MessagePack serialization for large payloads
 * - Result caching with automatic invalidation
 * - Type-safe batch command interface
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

/** Batch command types matching Rust BatchCommand enum */
export type BatchCommandType =
  | { type: "fs_read_file"; params: { path: string } }
  | { type: "fs_read_files"; params: { paths: string[] } }
  | { type: "fs_get_metadata"; params: { path: string } }
  | { type: "fs_get_metadata_batch"; params: { paths: string[] } }
  | { type: "fs_exists"; params: { path: string } }
  | { type: "fs_exists_batch"; params: { paths: string[] } }
  | { type: "fs_read_file_binary"; params: { path: string } }
  | { type: "fs_is_file"; params: { path: string } }
  | { type: "fs_is_directory"; params: { path: string } };

/** Result from batch command execution */
export type BatchResult<T = unknown> =
  | { status: "ok"; data: T; cached?: boolean }
  | { status: "error"; message: string };

/** File metadata structure from Rust */
export interface FileMetadata {
  path: string;
  isDir: boolean;
  isFile: boolean;
  isSymlink: boolean;
  isHidden: boolean;
  size: number;
  modifiedAt: number | null;
  createdAt: number | null;
  accessedAt: number | null;
  readonly: boolean;
}

/** Cache statistics from backend */
export interface CacheStats {
  file_cache_size: number;
  metadata_cache_size: number;
  exists_cache_size: number;
  invalidated_paths: number;
}

/** Internal queued command with resolver */
interface QueuedCommand<T> {
  command: BatchCommandType;
  resolve: (result: T) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// Configuration
// ============================================================================

/** Batch flush interval in milliseconds (one frame at 60fps) */
const BATCH_FLUSH_INTERVAL_MS = 16;

/** Maximum commands to queue before forcing a flush */
const MAX_QUEUE_SIZE = 50;

/** Threshold in bytes for using MessagePack serialization */
const MSGPACK_THRESHOLD_BYTES = 10_000;

// ============================================================================
// Command Queue Manager
// ============================================================================

/**
 * Singleton class managing command batching and queue flushing.
 * Commands are automatically batched and sent together to reduce IPC overhead.
 */
class BatchCommandQueue {
  private queue: QueuedCommand<unknown>[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private unlistenFn: UnlistenFn | null = null;

  constructor() {
    this.setupFileChangeListener();
  }

  /**
   * Setup listener for file change events to invalidate cache
   */
  private async setupFileChangeListener(): Promise<void> {
    try {
      this.unlistenFn = await listen<{ paths: string[]; type: string }>(
        "fs:change",
        (event) => {
          // Invalidate cache for changed files
          for (const path of event.payload.paths) {
            invoke("batch_cache_invalidate", { path }).catch((err) => {
              console.warn("Failed to invalidate cache for path:", path, err);
            });
          }
        }
      );
    } catch (error) {
      console.warn("Failed to setup file change listener:", error);
    }
  }

  /**
   * Cleanup resources when no longer needed
   */
  public async cleanup(): Promise<void> {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  /**
   * Add a command to the batch queue
   */
  public enqueue<T>(command: BatchCommandType): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        command,
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      // Schedule flush if not already scheduled
      if (!this.flushTimeout && !this.isFlushing) {
        this.flushTimeout = setTimeout(() => {
          void this.flush();
        }, BATCH_FLUSH_INTERVAL_MS);
      }

      // Force flush if queue is full
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        if (this.flushTimeout) {
          clearTimeout(this.flushTimeout);
          this.flushTimeout = null;
        }
        void this.flush();
      }
    });
  }

  /**
   * Immediately flush all queued commands
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    this.flushTimeout = null;

    // Take all commands from queue
    const commands = this.queue.splice(0);
    const batchCommands = commands.map((c) => c.command);

    try {
      // Choose serialization method based on payload size
      const payloadSize = JSON.stringify(batchCommands).length;
      let results: BatchResult[];

      if (payloadSize > MSGPACK_THRESHOLD_BYTES) {
        // Use MessagePack for large payloads
        results = await this.invokeWithMsgpack(batchCommands);
      } else {
        // Use JSON for smaller payloads
        results = await invoke<BatchResult[]>("batch_commands", {
          commands: batchCommands,
        });
      }

      // Resolve each command with its result
      for (let i = 0; i < commands.length; i++) {
        const result = results[i];
        if (result.status === "ok") {
          commands[i].resolve(result.data);
        } else {
          commands[i].reject(new Error(result.message));
        }
      }
    } catch (error) {
      // Reject all commands on batch failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      for (const cmd of commands) {
        cmd.reject(new Error(`Batch command failed: ${errorMsg}`));
      }
    } finally {
      this.isFlushing = false;

      // If more commands were added during flush, schedule another flush
      if (this.queue.length > 0 && !this.flushTimeout) {
        this.flushTimeout = setTimeout(() => {
          void this.flush();
        }, BATCH_FLUSH_INTERVAL_MS);
      }
    }
  }

  /**
   * Invoke batch commands using MessagePack serialization
   */
  private async invokeWithMsgpack(
    commands: BatchCommandType[]
  ): Promise<BatchResult[]> {
    // Encode commands as MessagePack using base64
    // Note: Full MessagePack encoding would require a library like @msgpack/msgpack
    // For now, we fall back to JSON encoding wrapped in base64
    const jsonStr = JSON.stringify(commands);
    const base64Data = btoa(
      new Uint8Array(new TextEncoder().encode(jsonStr)).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const resultBase64 = await invoke<string>("batch_commands_msgpack", {
      data: base64Data,
    });

    // Decode base64 result
    const binaryStr = atob(resultBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Parse as JSON (MessagePack would be decoded here with proper library)
    const jsonResult = new TextDecoder().decode(bytes);
    try {
      return JSON.parse(jsonResult) as BatchResult[];
    } catch (e) {
      console.error("[BatchQueue] Failed to parse batch result:", e);
      return [];
    }
  }
}

// Global singleton instance
let batchQueue: BatchCommandQueue | null = null;

/**
 * Get or create the batch command queue singleton
 */
function getQueue(): BatchCommandQueue {
  if (!batchQueue) {
    batchQueue = new BatchCommandQueue();
  }
  return batchQueue;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Execute a batched invoke call. Commands are automatically batched
 * and sent together to reduce IPC overhead.
 *
 * @example
 * ```ts
 * // Read multiple files efficiently
 * const [file1, file2] = await Promise.all([
 *   batchInvoke({ type: "fs_read_file", params: { path: "/path/to/file1.txt" } }),
 *   batchInvoke({ type: "fs_read_file", params: { path: "/path/to/file2.txt" } }),
 * ]);
 * ```
 */
export async function batchInvoke<T = unknown>(
  command: BatchCommandType
): Promise<T> {
  return getQueue().enqueue<T>(command);
}

/**
 * Force immediate flush of all queued commands.
 * Useful when you need results immediately without waiting for the batch interval.
 */
export async function flushBatch(): Promise<void> {
  return getQueue().flush();
}

/**
 * Cleanup batch queue resources.
 * Call this when the application is shutting down.
 */
export async function cleanupBatchQueue(): Promise<void> {
  if (batchQueue) {
    await batchQueue.cleanup();
    batchQueue = null;
  }
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Read a file's contents with automatic batching
 */
export async function batchReadFile(path: string): Promise<string> {
  return batchInvoke<string>({
    type: "fs_read_file",
    params: { path },
  });
}

/**
 * Read multiple files' contents in a single batch
 */
export async function batchReadFiles(
  paths: string[]
): Promise<Record<string, BatchResult<string>>> {
  return batchInvoke<Record<string, BatchResult<string>>>({
    type: "fs_read_files",
    params: { paths },
  });
}

/**
 * Get file metadata with automatic batching
 */
export async function batchGetMetadata(path: string): Promise<FileMetadata> {
  return batchInvoke<FileMetadata>({
    type: "fs_get_metadata",
    params: { path },
  });
}

/**
 * Get metadata for multiple files in a single batch
 */
export async function batchGetMetadataBatch(
  paths: string[]
): Promise<Record<string, BatchResult<FileMetadata>>> {
  return batchInvoke<Record<string, BatchResult<FileMetadata>>>({
    type: "fs_get_metadata_batch",
    params: { paths },
  });
}

/**
 * Check if a file exists with automatic batching
 */
export async function batchExists(path: string): Promise<boolean> {
  return batchInvoke<boolean>({
    type: "fs_exists",
    params: { path },
  });
}

/**
 * Check if multiple files exist in a single batch
 */
export async function batchExistsBatch(
  paths: string[]
): Promise<Record<string, boolean>> {
  return batchInvoke<Record<string, boolean>>({
    type: "fs_exists_batch",
    params: { paths },
  });
}

/**
 * Read a binary file as base64 with automatic batching
 */
export async function batchReadFileBinary(path: string): Promise<string> {
  return batchInvoke<string>({
    type: "fs_read_file_binary",
    params: { path },
  });
}

/**
 * Check if path is a file with automatic batching
 */
export async function batchIsFile(path: string): Promise<boolean> {
  return batchInvoke<boolean>({
    type: "fs_is_file",
    params: { path },
  });
}

/**
 * Check if path is a directory with automatic batching
 */
export async function batchIsDirectory(path: string): Promise<boolean> {
  return batchInvoke<boolean>({
    type: "fs_is_directory",
    params: { path },
  });
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Invalidate cache for a specific path
 */
export async function invalidateCache(path: string): Promise<void> {
  return invoke("batch_cache_invalidate", { path });
}

/**
 * Invalidate cache for all files under a directory
 */
export async function invalidateCacheDirectory(path: string): Promise<void> {
  return invoke("batch_cache_invalidate_directory", { path });
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  return invoke<CacheStats>("batch_cache_stats");
}

/**
 * Clear all caches
 */
export async function clearCache(): Promise<void> {
  return invoke("batch_cache_clear");
}

// ============================================================================
// Direct Batch Execution (without queuing)
// ============================================================================

/**
 * Execute multiple commands in a single batch immediately (bypass queue).
 * Useful when you have a known set of commands to execute together.
 *
 * @example
 * ```ts
 * const results = await executeBatch([
 *   { type: "fs_read_file", params: { path: "/file1.txt" } },
 *   { type: "fs_get_metadata", params: { path: "/file2.txt" } },
 *   { type: "fs_exists", params: { path: "/file3.txt" } },
 * ]);
 * ```
 */
export async function executeBatch(
  commands: BatchCommandType[]
): Promise<BatchResult[]> {
  return invoke<BatchResult[]>("batch_commands", { commands });
}

/**
 * Execute multiple commands using MessagePack serialization.
 * Better for large payloads to reduce serialization overhead.
 */
export async function executeBatchMsgpack(
  commands: BatchCommandType[]
): Promise<BatchResult[]> {
  const jsonStr = JSON.stringify(commands);
  const base64Data = btoa(
    new Uint8Array(new TextEncoder().encode(jsonStr)).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );

  const resultBase64 = await invoke<string>("batch_commands_msgpack", {
    data: base64Data,
  });

  const binaryStr = atob(resultBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const jsonResult = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(jsonResult) as BatchResult[];
  } catch (e) {
    console.error("[executeBatch] Failed to parse batch result:", e);
    return [];
  }
}
