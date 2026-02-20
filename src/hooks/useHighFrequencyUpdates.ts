/**
 * useHighFrequencyUpdates - High-Performance Streaming Text Hook
 *
 * Provides 60+ FPS text streaming with intelligent batching, debouncing,
 * and backpressure handling for terminal output and streaming AI responses.
 *
 * Features:
 * - Batches character updates for efficient rendering
 * - Debounces rapid updates (< 16ms apart) using RAF
 * - Smooth cursor/caret animation with CSS
 * - Graceful backpressure handling for slow consumers
 * - Memory-efficient circular buffer for streaming content
 * - Automatic line buffering for terminal output
 *
 * Performance characteristics:
 * - Updates batched per animation frame (60 FPS target)
 * - Maximum 10,000 characters per flush to prevent frame drops
 * - O(1) append operations with amortized buffer growth
 * - Automatic GC-friendly buffer rotation
 *
 * @example
 * ```tsx
 * function TerminalOutput() {
 *   const {
 *     content,
 *     append,
 *     cursorPosition,
 *     isStreaming,
 *   } = useHighFrequencyUpdates({
 *     maxBufferSize: 100000,
 *     onFlush: (text) => console.log('Flushed:', text.length, 'chars'),
 *   });
 *
 *   // Append streaming content
 *   websocket.onmessage = (e) => append(e.data);
 *
 *   return (
 *     <pre class={isStreaming() ? 'streaming' : ''}>
 *       {content()}
 *       <span class="cursor" style={{ left: `${cursorPosition().column}ch` }} />
 *     </pre>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createMemo,
  onCleanup,
  batch,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Cursor position in the content */
export interface CursorPosition {
  /** Line number (0-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** Absolute character offset */
  offset: number;
  /** Whether cursor is visible */
  visible: boolean;
}

/** Line information for efficient rendering */
export interface LineInfo {
  /** Line number (0-indexed) */
  index: number;
  /** Character offset where line starts */
  startOffset: number;
  /** Character offset where line ends */
  endOffset: number;
  /** Line content without newline */
  content: string;
}

/** Streaming statistics */
export interface StreamingStats {
  /** Total characters received */
  totalChars: number;
  /** Characters received in last second */
  charsPerSecond: number;
  /** Number of flushes performed */
  flushCount: number;
  /** Average characters per flush */
  avgCharsPerFlush: number;
  /** Number of dropped characters due to backpressure */
  droppedChars: number;
  /** Current buffer size */
  bufferSize: number;
  /** Time streaming has been active (ms) */
  streamingDuration: number;
}

/** Configuration options */
export interface UseHighFrequencyUpdatesOptions {
  /** Initial content */
  initialContent?: string;
  /** Maximum buffer size in characters */
  maxBufferSize?: number;
  /** Threshold to start rotating buffer (percentage of max) */
  bufferRotationThreshold?: number;
  /** Maximum characters to process per flush */
  maxCharsPerFlush?: number;
  /** Debounce time in milliseconds (0 to disable) */
  debounceMs?: number;
  /** Whether to show blinking cursor */
  showCursor?: boolean;
  /** Cursor blink rate in milliseconds */
  cursorBlinkRate?: number;
  /** Whether to parse ANSI escape codes */
  parseAnsi?: boolean;
  /** Whether to enable line buffering */
  lineBuffering?: boolean;
  /** Callback when content is flushed */
  onFlush?: (content: string, stats: StreamingStats) => void;
  /** Callback when streaming starts */
  onStreamStart?: () => void;
  /** Callback when streaming ends */
  onStreamEnd?: (finalStats: StreamingStats) => void;
  /** Callback for backpressure events */
  onBackpressure?: (dropped: number) => void;
}

/** Return type of useHighFrequencyUpdates */
export interface UseHighFrequencyUpdatesReturn {
  /** Current content as reactive signal */
  content: Accessor<string>;
  /** Current lines as reactive signal */
  lines: Accessor<LineInfo[]>;
  /** Current cursor position */
  cursorPosition: Accessor<CursorPosition>;
  /** Whether currently streaming */
  isStreaming: Accessor<boolean>;
  /** Current statistics */
  stats: Accessor<StreamingStats>;
  /** Append text to buffer */
  append: (text: string) => void;
  /** Append multiple chunks efficiently */
  appendChunks: (chunks: string[]) => void;
  /** Clear all content */
  clear: () => void;
  /** Set content directly (replaces buffer) */
  setContent: (content: string) => void;
  /** Start streaming mode */
  startStreaming: () => void;
  /** End streaming mode */
  endStreaming: () => void;
  /** Force flush pending updates */
  flush: () => void;
  /** Scroll to specific line */
  scrollToLine: (line: number) => void;
  /** Get line at offset */
  getLineAtOffset: (offset: number) => LineInfo | null;
  /** Get visible lines for virtual rendering */
  getVisibleLines: (startLine: number, count: number) => LineInfo[];
}

// ============================================================================
// Configuration Defaults
// ============================================================================

const DEFAULT_MAX_BUFFER_SIZE = 1_000_000; // 1MB of text
const DEFAULT_BUFFER_ROTATION_THRESHOLD = 0.9; // 90%
const DEFAULT_MAX_CHARS_PER_FLUSH = 10_000;
const DEFAULT_DEBOUNCE_MS = 0; // Use RAF timing by default
const DEFAULT_CURSOR_BLINK_RATE = 530;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse content into lines
 */
function parseLines(content: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let offset = 0;

  const rawLines = content.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const lineContent = rawLines[i];
    lines.push({
      index: i,
      startOffset: offset,
      endOffset: offset + lineContent.length,
      content: lineContent,
    });
    offset += lineContent.length + 1; // +1 for newline
  }

  return lines;
}

/**
 * Calculate cursor position from offset
 */
function offsetToCursor(content: string, offset: number): CursorPosition {
  const lines = content.substring(0, offset).split("\n");
  const line = lines.length - 1;
  const column = lines[line]?.length ?? 0;

  return {
    line,
    column,
    offset,
    visible: true,
  };
}

/**
 * Strip ANSI escape codes from text
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

// ============================================================================
// useHighFrequencyUpdates Hook
// ============================================================================

/**
 * Hook for high-performance streaming text updates
 */
export function useHighFrequencyUpdates(
  options: UseHighFrequencyUpdatesOptions = {}
): UseHighFrequencyUpdatesReturn {
  const {
    initialContent = "",
    maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
    bufferRotationThreshold = DEFAULT_BUFFER_ROTATION_THRESHOLD,
    maxCharsPerFlush = DEFAULT_MAX_CHARS_PER_FLUSH,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    showCursor = true,
    cursorBlinkRate = DEFAULT_CURSOR_BLINK_RATE,
    parseAnsi = false,
    lineBuffering = true,
    onFlush,
    onStreamStart,
    onStreamEnd,
    onBackpressure,
  } = options;

  // ============================================================================
  // State
  // ============================================================================

  const [content, setContent] = createSignal(initialContent);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [cursorVisible, setCursorVisible] = createSignal(showCursor);

  // Pending buffer for batching
  let pendingBuffer = "";
  let rafId: number | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let cursorBlinkInterval: ReturnType<typeof setInterval> | null = null;

  // Statistics
  const [stats, setStats] = createSignal<StreamingStats>({
    totalChars: initialContent.length,
    charsPerSecond: 0,
    flushCount: 0,
    avgCharsPerFlush: 0,
    droppedChars: 0,
    bufferSize: initialContent.length,
    streamingDuration: 0,
  });

  let streamStartTime: number | null = null;
  let charsInLastSecond = 0;
  let statsIntervalId: ReturnType<typeof setInterval> | null = null;
  let recentFlushSizes: number[] = [];

  // ============================================================================
  // Computed Values
  // ============================================================================

  const lines = createMemo(() => parseLines(content()));

  const cursorPosition = createMemo((): CursorPosition => {
    const currentContent = content();
    const pos = offsetToCursor(currentContent, currentContent.length);
    return {
      ...pos,
      visible: cursorVisible() && isStreaming(),
    };
  });

  // ============================================================================
  // Buffer Management
  // ============================================================================

  /**
   * Rotate buffer when it exceeds threshold
   */
  const rotateBufferIfNeeded = (currentContent: string): string => {
    if (currentContent.length < maxBufferSize * bufferRotationThreshold) {
      return currentContent;
    }

    // Keep last 50% of content
    const keepFrom = Math.floor(currentContent.length / 2);

    // Find nearest line boundary
    const lineStart = currentContent.indexOf("\n", keepFrom);
    const rotateFrom = lineStart !== -1 ? lineStart + 1 : keepFrom;

    return currentContent.substring(rotateFrom);
  };

  /**
   * Flush pending updates to content
   */
  const flushPending = () => {
    rafId = null;

    if (pendingBuffer.length === 0) {
      return;
    }

    const startTime = performance.now();
    let textToAppend = pendingBuffer;

    // Limit chars per flush
    if (textToAppend.length > maxCharsPerFlush) {
      const excess = textToAppend.length - maxCharsPerFlush;
      textToAppend = textToAppend.substring(0, maxCharsPerFlush);
      pendingBuffer = pendingBuffer.substring(maxCharsPerFlush);

      // Report backpressure
      if (onBackpressure) {
        onBackpressure(excess);
      }

      // Schedule another flush
      scheduleFlush();
    } else {
      pendingBuffer = "";
    }

    // Handle line buffering - keep incomplete last line in buffer
    if (lineBuffering && !textToAppend.endsWith("\n")) {
      const lastNewline = textToAppend.lastIndexOf("\n");
      if (lastNewline !== -1) {
        const incomplete = textToAppend.substring(lastNewline + 1);
        textToAppend = textToAppend.substring(0, lastNewline + 1);
        pendingBuffer = incomplete + pendingBuffer;
      } else if (pendingBuffer.length === 0) {
        // No newline found and nothing pending - flush anyway to avoid stalling
        // This handles single-line outputs
      }
    }

    // Strip ANSI if configured
    if (parseAnsi) {
      textToAppend = stripAnsi(textToAppend);
    }

    if (textToAppend.length === 0) {
      return;
    }

    // Update content
    batch(() => {
      setContent((prev) => {
        let newContent = prev + textToAppend;
        newContent = rotateBufferIfNeeded(newContent);
        return newContent;
      });

      // Update stats
      charsInLastSecond += textToAppend.length;
      recentFlushSizes.push(textToAppend.length);
      if (recentFlushSizes.length > 60) {
        recentFlushSizes.shift();
      }

      setStats((prev) => ({
        ...prev,
        totalChars: prev.totalChars + textToAppend.length,
        flushCount: prev.flushCount + 1,
        bufferSize: content().length,
        avgCharsPerFlush:
          recentFlushSizes.reduce((a, b) => a + b, 0) / recentFlushSizes.length,
      }));
    });

    // Callback
    if (onFlush) {
      onFlush(textToAppend, stats());
    }

    const flushTime = performance.now() - startTime;
    if (flushTime > 16) {
      console.warn(
        `[useHighFrequencyUpdates] Slow flush: ${flushTime.toFixed(2)}ms`
      );
    }
  };

  /**
   * Schedule a flush using RAF
   */
  const scheduleFlush = () => {
    if (rafId !== null) {
      return; // Already scheduled
    }

    if (debounceMs > 0) {
      // Use debounce
      if (debounceTimeout !== null) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        debounceTimeout = null;
        rafId = requestAnimationFrame(flushPending);
      }, debounceMs);
    } else {
      // Use RAF directly
      rafId = requestAnimationFrame(flushPending);
    }
  };

  // ============================================================================
  // Public API
  // ============================================================================

  const append = (text: string) => {
    if (text.length === 0) return;

    // Check for buffer overflow
    if (pendingBuffer.length + text.length > maxBufferSize) {
      const overflow = pendingBuffer.length + text.length - maxBufferSize;
      setStats((prev) => ({
        ...prev,
        droppedChars: prev.droppedChars + overflow,
      }));

      if (onBackpressure) {
        onBackpressure(overflow);
      }

      // Truncate to fit
      text = text.substring(0, maxBufferSize - pendingBuffer.length);
    }

    pendingBuffer += text;
    scheduleFlush();
  };

  const appendChunks = (chunks: string[]) => {
    const combined = chunks.join("");
    append(combined);
  };

  const clear = () => {
    pendingBuffer = "";
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (debounceTimeout !== null) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }

    batch(() => {
      setContent("");
      setStats((prev) => ({
        ...prev,
        bufferSize: 0,
      }));
    });
  };

  const setContentDirectly = (newContent: string) => {
    pendingBuffer = "";
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    batch(() => {
      setContent(newContent);
      setStats((prev) => ({
        ...prev,
        totalChars: newContent.length,
        bufferSize: newContent.length,
      }));
    });
  };

  const startStreaming = () => {
    if (isStreaming()) return;

    setIsStreaming(true);
    streamStartTime = Date.now();

    // Start cursor blink
    if (showCursor) {
      cursorBlinkInterval = setInterval(() => {
        setCursorVisible((v) => !v);
      }, cursorBlinkRate);
    }

    // Start stats tracking
    statsIntervalId = setInterval(() => {
      const duration = streamStartTime ? Date.now() - streamStartTime : 0;

      setStats((prev) => ({
        ...prev,
        charsPerSecond: charsInLastSecond,
        streamingDuration: duration,
      }));

      charsInLastSecond = 0;
    }, 1000);

    if (onStreamStart) {
      onStreamStart();
    }
  };

  const endStreaming = () => {
    if (!isStreaming()) return;

    // Flush any remaining content
    if (pendingBuffer.length > 0) {
      flushPending();
    }

    setIsStreaming(false);
    setCursorVisible(false);

    // Stop cursor blink
    if (cursorBlinkInterval !== null) {
      clearInterval(cursorBlinkInterval);
      cursorBlinkInterval = null;
    }

    // Stop stats tracking
    if (statsIntervalId !== null) {
      clearInterval(statsIntervalId);
      statsIntervalId = null;
    }

    if (onStreamEnd) {
      onStreamEnd(stats());
    }

    streamStartTime = null;
  };

  const forceFlush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (debounceTimeout !== null) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    flushPending();
  };

  const scrollToLine = (line: number) => {
    // This would need to be connected to a scrollable container
    // Implementation depends on the UI component using this hook
    const lineInfos = lines();
    if (line >= 0 && line < lineInfos.length) {
      // Dispatch custom event for scroll
      window.dispatchEvent(
        new CustomEvent("streaming-scroll-to-line", {
          detail: { line, lineInfo: lineInfos[line] },
        })
      );
    }
  };

  const getLineAtOffset = (offset: number): LineInfo | null => {
    const lineInfos = lines();
    for (const line of lineInfos) {
      if (offset >= line.startOffset && offset <= line.endOffset) {
        return line;
      }
    }
    return null;
  };

  const getVisibleLines = (startLine: number, count: number): LineInfo[] => {
    const lineInfos = lines();
    return lineInfos.slice(startLine, startLine + count);
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onCleanup(() => {
    // Cancel pending RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }

    // Clear debounce
    if (debounceTimeout !== null) {
      clearTimeout(debounceTimeout);
    }

    // Stop cursor blink
    if (cursorBlinkInterval !== null) {
      clearInterval(cursorBlinkInterval);
    }

    // Stop stats tracking
    if (statsIntervalId !== null) {
      clearInterval(statsIntervalId);
    }
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    content,
    lines,
    cursorPosition,
    isStreaming,
    stats,
    append,
    appendChunks,
    clear,
    setContent: setContentDirectly,
    startStreaming,
    endStreaming,
    flush: forceFlush,
    scrollToLine,
    getLineAtOffset,
    getVisibleLines,
  };
}

// ============================================================================
// Additional Utility Hooks
// ============================================================================

/**
 * Hook for managing a blinking cursor separately
 */
export function useBlinkingCursor(
  options: { blinkRate?: number; initialVisible?: boolean } = {}
): {
  visible: Accessor<boolean>;
  start: () => void;
  stop: () => void;
  toggle: () => void;
} {
  const { blinkRate = DEFAULT_CURSOR_BLINK_RATE, initialVisible = true } =
    options;

  const [visible, setVisible] = createSignal(initialVisible);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (intervalId !== null) return;
    setVisible(true);
    intervalId = setInterval(() => {
      setVisible((v) => !v);
    }, blinkRate);
  };

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    setVisible(false);
  };

  const toggle = () => {
    setVisible((v) => !v);
  };

  onCleanup(() => {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
  });

  return { visible, start, stop, toggle };
}

/**
 * Hook for debounced high-frequency callback
 */
export function useRAFDebounce<T>(
  callback: (value: T) => void,
  options: { leading?: boolean } = {}
): (value: T) => void {
  const { leading = false } = options;

  let rafId: number | null = null;
  let lastValue: T | null = null;
  let hasLeadingCall = false;

  const debouncedCallback = (value: T) => {
    lastValue = value;

    if (leading && !hasLeadingCall) {
      hasLeadingCall = true;
      callback(value);
      return;
    }

    if (rafId !== null) {
      return; // Already scheduled
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      hasLeadingCall = false;
      if (lastValue !== null) {
        callback(lastValue);
      }
    });
  };

  onCleanup(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });

  return debouncedCallback;
}

// ============================================================================
// Default Export
// ============================================================================

export default useHighFrequencyUpdates;
