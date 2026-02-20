/**
 * StreamingManager - High-Performance Streaming Coordinator
 *
 * Provides 60+ FPS update batching using requestAnimationFrame for smooth
 * streaming updates in agent activity displays. Inspired by Zed's approach
 * to real-time content streaming.
 *
 * Features:
 * - Batches updates to reduce re-renders (target: 60 FPS / ~16.67ms)
 * - Priority-based update queuing (high/normal/low)
 * - Backpressure handling for slow consumers
 * - Memory-efficient circular buffer for update history
 * - Type-safe update subscription system
 *
 * Performance characteristics:
 * - Single RAF callback per frame (no stacking)
 * - O(1) update queueing, O(n) flush where n = pending updates
 * - Maximum 1000 updates per flush to prevent frame drops
 * - Automatic backpressure when queue exceeds threshold
 *
 * @example
 * ```ts
 * const manager = StreamingManager.getInstance();
 *
 * // Subscribe to updates
 * const unsubscribe = manager.subscribe((updates) => {
 *   updates.forEach(update => console.log(update));
 * });
 *
 * // Queue updates (batched automatically)
 * manager.queueUpdate({ type: 'text', content: 'Hello' });
 * manager.queueUpdate({ type: 'text', content: ' World' });
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/** Update priority levels for queue ordering */
export type UpdatePriority = "high" | "normal" | "low";

/** Base update interface that all updates must implement */
export interface BaseUpdate {
  /** Unique identifier for deduplication */
  id: string;
  /** Timestamp when update was created */
  timestamp: number;
  /** Update priority for queue ordering */
  priority: UpdatePriority;
}

/** Text content update for streaming text */
export interface TextUpdate extends BaseUpdate {
  type: "text";
  /** The text content to append/display */
  content: string;
  /** Target element/region identifier */
  targetId?: string;
  /** Whether this completes a streaming sequence */
  isComplete?: boolean;
}

/** Cursor/caret position update */
export interface CursorUpdate extends BaseUpdate {
  type: "cursor";
  /** Line number (0-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** Whether cursor is visible */
  visible: boolean;
}

/** List item update for animated lists */
export interface ListUpdate extends BaseUpdate {
  type: "list_add" | "list_remove" | "list_update" | "list_reorder";
  /** Target list identifier */
  listId: string;
  /** Item(s) being affected */
  items: ListItem[];
  /** Position index for add/reorder operations */
  index?: number;
}

/** List item structure */
export interface ListItem {
  id: string;
  data: unknown;
}

/** Progress/status update */
export interface ProgressUpdate extends BaseUpdate {
  type: "progress";
  /** Progress value (0-1) or null for indeterminate */
  progress: number | null;
  /** Status message */
  message?: string;
  /** Associated task/operation identifier */
  taskId?: string;
}

/** Terminal output update */
export interface TerminalUpdate extends BaseUpdate {
  type: "terminal";
  /** Raw terminal output (may include ANSI codes) */
  output: string;
  /** Stream identifier (stdout/stderr) */
  stream: "stdout" | "stderr";
  /** Whether this is the final output */
  isComplete?: boolean;
}

/** Union of all update types */
export type Update =
  | TextUpdate
  | CursorUpdate
  | ListUpdate
  | ProgressUpdate
  | TerminalUpdate;

/** Callback type for update subscribers */
export type UpdateCallback = (updates: Update[]) => void;

/** Subscriber with metadata */
interface Subscriber {
  id: number;
  callback: UpdateCallback;
  /** Optional filter for specific update types */
  filter?: Update["type"][];
}

/** Backpressure status */
export interface BackpressureStatus {
  /** Whether backpressure is currently active */
  active: boolean;
  /** Current queue size */
  queueSize: number;
  /** Threshold that triggered backpressure */
  threshold: number;
  /** Recommended action */
  recommendation: "wait" | "drop_low_priority" | "normal";
}

/** Streaming statistics for monitoring */
export interface StreamingStats {
  /** Total updates processed since start */
  totalUpdates: number;
  /** Updates processed in last second */
  updatesPerSecond: number;
  /** Average batch size */
  avgBatchSize: number;
  /** Number of dropped updates due to backpressure */
  droppedUpdates: number;
  /** Current subscriber count */
  subscriberCount: number;
  /** Time of last flush in ms */
  lastFlushTime: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Maximum updates to process per frame (prevents frame drops) */
const MAX_UPDATES_PER_FLUSH = 1000;

/** Queue size threshold for backpressure activation */
const BACKPRESSURE_THRESHOLD = 5000;

/** Queue size for critical backpressure (start dropping low priority) */
const CRITICAL_BACKPRESSURE_THRESHOLD = 8000;

/** History buffer size for replay functionality */
const HISTORY_BUFFER_SIZE = 100;

/** Stats sampling interval in milliseconds */
const STATS_SAMPLE_INTERVAL = 1000;

// ============================================================================
// StreamingManager Class
// ============================================================================

/**
 * Singleton class that coordinates high-frequency streaming updates.
 * Uses requestAnimationFrame for optimal batching and rendering performance.
 */
export class StreamingManager {
  private static instance: StreamingManager | null = null;

  // Update queue with priority ordering
  private pendingUpdates: Update[] = [];
  private rafId: number | null = null;

  // Subscription management
  private subscribers: Map<number, Subscriber> = new Map();
  private nextSubscriberId = 0;

  // Backpressure state
  private backpressureActive = false;

  // Statistics tracking
  private stats: StreamingStats = {
    totalUpdates: 0,
    updatesPerSecond: 0,
    avgBatchSize: 0,
    droppedUpdates: 0,
    subscriberCount: 0,
    lastFlushTime: 0,
  };
  private recentBatchSizes: number[] = [];
  private updatesInLastSecond = 0;
  private statsIntervalId: ReturnType<typeof setInterval> | null = null;

  // History buffer for replay
  private historyBuffer: Update[] = [];

  // Deduplication map (id -> timestamp)
  private recentUpdateIds: Map<string, number> = new Map();
  private dedupeCleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.startStatsTracking();
    this.startDedupeCleanup();
  }

  /**
   * Get the singleton instance of StreamingManager
   */
  public static getInstance(): StreamingManager {
    if (!StreamingManager.instance) {
      StreamingManager.instance = new StreamingManager();
    }
    return StreamingManager.instance;
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  public static resetInstance(): void {
    if (StreamingManager.instance) {
      StreamingManager.instance.destroy();
      StreamingManager.instance = null;
    }
  }

  /**
   * Queue an update for the next animation frame.
   * Updates are automatically batched and flushed at 60 FPS.
   *
   * @param update - The update to queue
   * @returns Whether the update was queued (false if dropped due to backpressure)
   */
  public queueUpdate(update: Update): boolean {
    // Check for duplicate updates (same id within 16ms)
    const existingTimestamp = this.recentUpdateIds.get(update.id);
    if (existingTimestamp && update.timestamp - existingTimestamp < 16) {
      return false; // Deduplicate rapid identical updates
    }
    this.recentUpdateIds.set(update.id, update.timestamp);

    // Handle backpressure
    if (this.pendingUpdates.length >= CRITICAL_BACKPRESSURE_THRESHOLD) {
      if (update.priority === "low") {
        this.stats.droppedUpdates++;
        return false; // Drop low priority updates under critical pressure
      }
    }

    if (this.pendingUpdates.length >= BACKPRESSURE_THRESHOLD) {
      this.backpressureActive = true;
    }

    // Insert update with priority ordering
    this.insertByPriority(update);

    // Schedule flush if not already scheduled
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }

    return true;
  }

  /**
   * Queue multiple updates at once (more efficient than individual calls)
   *
   * @param updates - Array of updates to queue
   * @returns Number of updates successfully queued
   */
  public queueUpdates(updates: Update[]): number {
    let queued = 0;
    for (const update of updates) {
      if (this.queueUpdate(update)) {
        queued++;
      }
    }
    return queued;
  }

  /**
   * Insert update maintaining priority order (high > normal > low)
   */
  private insertByPriority(update: Update): void {
    if (update.priority === "high") {
      // High priority: insert at front
      this.pendingUpdates.unshift(update);
    } else if (update.priority === "low") {
      // Low priority: append at end
      this.pendingUpdates.push(update);
    } else {
      // Normal priority: insert before low priority section
      let insertIndex = this.pendingUpdates.length;
      for (let i = this.pendingUpdates.length - 1; i >= 0; i--) {
        if (this.pendingUpdates[i].priority !== "low") {
          insertIndex = i + 1;
          break;
        }
        if (i === 0) {
          insertIndex = 0;
        }
      }
      this.pendingUpdates.splice(insertIndex, 0, update);
    }
  }

  /**
   * Flush all pending updates to subscribers.
   * Called automatically via requestAnimationFrame.
   */
  private flush(): void {
    this.rafId = null;

    if (this.pendingUpdates.length === 0) {
      return;
    }

    const startTime = performance.now();

    // Take up to MAX_UPDATES_PER_FLUSH updates
    const updates = this.pendingUpdates.splice(0, MAX_UPDATES_PER_FLUSH);

    // Update stats
    this.stats.totalUpdates += updates.length;
    this.updatesInLastSecond += updates.length;
    this.recentBatchSizes.push(updates.length);
    if (this.recentBatchSizes.length > 60) {
      this.recentBatchSizes.shift();
    }

    // Add to history buffer
    this.addToHistory(updates);

    // Notify subscribers
    const subscriberList = Array.from(this.subscribers.values());
    for (const subscriber of subscriberList) {
      try {
        // Apply filter if specified
        const filteredUpdates = subscriber.filter
          ? updates.filter((u) => subscriber.filter!.includes(u.type))
          : updates;

        if (filteredUpdates.length > 0) {
          subscriber.callback(filteredUpdates);
        }
      } catch (error) {
        console.error("[StreamingManager] Subscriber callback error:", error);
      }
    }

    this.stats.lastFlushTime = performance.now() - startTime;

    // Check if more updates pending
    if (this.pendingUpdates.length > 0) {
      this.rafId = requestAnimationFrame(() => this.flush());
    } else {
      // Clear backpressure when queue is empty
      this.backpressureActive = false;
    }
  }

  /**
   * Force immediate flush of all pending updates.
   * Use sparingly - preferably let RAF handle timing.
   */
  public forceFlush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.flush();
  }

  /**
   * Subscribe to update notifications.
   *
   * @param callback - Function called with batched updates
   * @param filter - Optional array of update types to receive
   * @returns Unsubscribe function
   */
  public subscribe(
    callback: UpdateCallback,
    filter?: Update["type"][]
  ): () => void {
    const id = this.nextSubscriberId++;
    this.subscribers.set(id, { id, callback, filter });
    this.stats.subscriberCount = this.subscribers.size;

    return () => {
      this.subscribers.delete(id);
      this.stats.subscriberCount = this.subscribers.size;
    };
  }

  /**
   * Get current backpressure status and recommendations
   */
  public getBackpressureStatus(): BackpressureStatus {
    const queueSize = this.pendingUpdates.length;
    let recommendation: BackpressureStatus["recommendation"] = "normal";

    if (queueSize >= CRITICAL_BACKPRESSURE_THRESHOLD) {
      recommendation = "drop_low_priority";
    } else if (queueSize >= BACKPRESSURE_THRESHOLD) {
      recommendation = "wait";
    }

    return {
      active: this.backpressureActive,
      queueSize,
      threshold: BACKPRESSURE_THRESHOLD,
      recommendation,
    };
  }

  /**
   * Get current streaming statistics
   */
  public getStats(): Readonly<StreamingStats> {
    return { ...this.stats };
  }

  /**
   * Get recent update history (for replay/recovery)
   *
   * @param count - Number of recent updates to retrieve
   */
  public getHistory(count: number = HISTORY_BUFFER_SIZE): Update[] {
    return this.historyBuffer.slice(-count);
  }

  /**
   * Clear all pending updates
   */
  public clearPending(): void {
    this.pendingUpdates = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.backpressureActive = false;
  }

  /**
   * Add updates to circular history buffer
   */
  private addToHistory(updates: Update[]): void {
    this.historyBuffer.push(...updates);
    // Keep only last HISTORY_BUFFER_SIZE updates
    if (this.historyBuffer.length > HISTORY_BUFFER_SIZE) {
      this.historyBuffer = this.historyBuffer.slice(-HISTORY_BUFFER_SIZE);
    }
  }

  /**
   * Start statistics tracking interval
   */
  private startStatsTracking(): void {
    this.statsIntervalId = setInterval(() => {
      this.stats.updatesPerSecond = this.updatesInLastSecond;
      this.updatesInLastSecond = 0;

      if (this.recentBatchSizes.length > 0) {
        this.stats.avgBatchSize =
          this.recentBatchSizes.reduce((a, b) => a + b, 0) /
          this.recentBatchSizes.length;
      }
    }, STATS_SAMPLE_INTERVAL);
  }

  /**
   * Start deduplication map cleanup interval
   */
  private startDedupeCleanup(): void {
    this.dedupeCleanupInterval = setInterval(() => {
      const now = Date.now();
      const expireThreshold = 1000; // 1 second
      const entries = Array.from(this.recentUpdateIds.entries());
      for (const [id, timestamp] of entries) {
        if (now - timestamp > expireThreshold) {
          this.recentUpdateIds.delete(id);
        }
      }
    }, 5000); // Cleanup every 5 seconds
  }

  /**
   * Cleanup all resources
   */
  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.statsIntervalId !== null) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
    if (this.dedupeCleanupInterval !== null) {
      clearInterval(this.dedupeCleanupInterval);
      this.dedupeCleanupInterval = null;
    }
    this.subscribers.clear();
    this.pendingUpdates = [];
    this.historyBuffer = [];
    this.recentUpdateIds.clear();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the global StreamingManager instance
 */
export function getStreamingManager(): StreamingManager {
  return StreamingManager.getInstance();
}

/**
 * Create a text update with defaults
 */
export function createTextUpdate(
  content: string,
  options: Partial<Omit<TextUpdate, "type" | "content">> = {}
): TextUpdate {
  return {
    id: options.id ?? `text-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: options.timestamp ?? Date.now(),
    priority: options.priority ?? "normal",
    type: "text",
    content,
    targetId: options.targetId,
    isComplete: options.isComplete,
  };
}

/**
 * Create a terminal update with defaults
 */
export function createTerminalUpdate(
  output: string,
  stream: "stdout" | "stderr" = "stdout",
  options: Partial<Omit<TerminalUpdate, "type" | "output" | "stream">> = {}
): TerminalUpdate {
  return {
    id: options.id ?? `term-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: options.timestamp ?? Date.now(),
    priority: options.priority ?? "normal",
    type: "terminal",
    output,
    stream,
    isComplete: options.isComplete,
  };
}

/**
 * Create a list update with defaults
 */
export function createListUpdate(
  listId: string,
  updateType: ListUpdate["type"],
  items: ListItem[],
  options: Partial<Omit<ListUpdate, "type" | "listId" | "items">> = {}
): ListUpdate {
  return {
    id: options.id ?? `list-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: options.timestamp ?? Date.now(),
    priority: options.priority ?? "normal",
    type: updateType,
    listId,
    items,
    index: options.index,
  };
}

/**
 * Create a progress update with defaults
 */
export function createProgressUpdate(
  progress: number | null,
  options: Partial<Omit<ProgressUpdate, "type" | "progress">> = {}
): ProgressUpdate {
  return {
    id: options.id ?? `progress-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: options.timestamp ?? Date.now(),
    priority: options.priority ?? "normal",
    type: "progress",
    progress,
    message: options.message,
    taskId: options.taskId,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default StreamingManager;
