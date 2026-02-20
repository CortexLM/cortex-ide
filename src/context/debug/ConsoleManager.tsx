import { createSignal, type Accessor } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ConsoleManager");

const DEFAULT_MAX_HISTORY = 50;

/**
 * Return type for the useConsoleHistory hook.
 */
export interface ConsoleHistoryManager {
  /** Reactive accessor for the command history array (oldest first) */
  history: Accessor<string[]>;
  /** Reactive accessor for the current navigation index (-1 = not navigating) */
  historyIndex: Accessor<number>;
  /** Add a command to history */
  addCommand: (command: string) => void;
  /** Navigate up (older) in history; returns the command or undefined */
  navigateUp: () => string | undefined;
  /** Navigate down (newer) in history; returns the command or undefined */
  navigateDown: () => string | undefined;
  /** Reset navigation index to -1 (not navigating) */
  resetNavigation: () => void;
}

/**
 * Hook that manages debug console command history with up/down navigation.
 * Commands are stored in chronological order (oldest first).
 * Duplicate consecutive commands are not added.
 *
 * @param maxSize - Maximum number of commands to retain (default: 50)
 * @returns ConsoleHistoryManager with history, navigation, and mutation methods
 */
export function useConsoleHistory(
  maxSize: number = DEFAULT_MAX_HISTORY,
): ConsoleHistoryManager {
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);

  const addCommand = (command: string): void => {
    const trimmed = command.trim();
    if (trimmed.length === 0) {
      return;
    }

    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === trimmed) {
        return prev;
      }
      const next = [...prev, trimmed];
      if (next.length > maxSize) {
        return next.slice(next.length - maxSize);
      }
      return next;
    });
    setHistoryIndex(-1);
  };

  const navigateUp = (): string | undefined => {
    const h = history();
    if (h.length === 0) {
      return undefined;
    }

    const currentIndex = historyIndex();
    let newIndex: number;

    if (currentIndex === -1) {
      newIndex = h.length - 1;
    } else if (currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else {
      return h[0];
    }

    setHistoryIndex(newIndex);
    return h[newIndex];
  };

  const navigateDown = (): string | undefined => {
    const h = history();
    const currentIndex = historyIndex();

    if (currentIndex === -1) {
      return undefined;
    }

    if (currentIndex < h.length - 1) {
      const newIndex = currentIndex + 1;
      setHistoryIndex(newIndex);
      return h[newIndex];
    }

    setHistoryIndex(-1);
    return undefined;
  };

  const resetNavigation = (): void => {
    setHistoryIndex(-1);
  };

  return {
    history,
    historyIndex,
    addCommand,
    navigateUp,
    navigateDown,
    resetNavigation,
  };
}

/** Completion item from the debug adapter */
export interface DebugCompletionItem {
  label: string;
  text?: string;
  sortText?: string;
  detail?: string;
  type?: string;
  start?: number;
  length?: number;
}

/**
 * Return type for the useConsoleCompletions hook.
 */
export interface ConsoleCompletionsManager {
  /** Reactive accessor for the current completion items */
  completions: Accessor<DebugCompletionItem[]>;
  /** Fetch completions from the debug adapter for the given text and cursor column */
  fetchCompletions: (text: string, column: number) => Promise<void>;
  /** Whether a completions request is in progress */
  loading: Accessor<boolean>;
  /** Clear the current completions list */
  clearCompletions: () => void;
}

/**
 * Hook that manages debug console completions by sending DAP completion
 * requests to the debug adapter via Tauri invoke.
 *
 * @param sessionId - Reactive accessor for the active debug session ID
 * @returns ConsoleCompletionsManager with completions, fetch, and clear methods
 */
export function useConsoleCompletions(
  sessionId: Accessor<string | null>,
): ConsoleCompletionsManager {
  const [completions, setCompletions] = createSignal<DebugCompletionItem[]>([]);
  const [loading, setLoading] = createSignal(false);

  const fetchCompletions = async (
    text: string,
    column: number,
  ): Promise<void> => {
    const sid = sessionId();
    if (!sid) {
      setCompletions([]);
      return;
    }

    setLoading(true);
    try {
      const items = await invoke<DebugCompletionItem[]>("debug_completions", {
        sessionId: sid,
        text,
        column,
        line: null,
      });
      setCompletions(items);
    } catch (error) {
      logger.error("Failed to fetch debug completions:", error);
      setCompletions([]);
    } finally {
      setLoading(false);
    }
  };

  const clearCompletions = (): void => {
    setCompletions([]);
  };

  return {
    completions,
    fetchCompletions,
    loading,
    clearCompletions,
  };
}

/**
 * Return type for the useMultiLineInput hook.
 */
export interface MultiLineInputManager {
  /** Reactive accessor for the current input value */
  value: Accessor<string>;
  /** Set the input value */
  setValue: (v: string) => void;
  /** Whether the input is currently in multi-line mode */
  isMultiLine: Accessor<boolean>;
  /**
   * Keyboard event handler for the input element.
   * - Shift+Enter: inserts a newline (enables multi-line mode)
   * - Enter (without Shift): calls onSubmit with the current value
   *
   * @param e - The keyboard event
   * @param onSubmit - Callback invoked when Enter is pressed without Shift
   */
  handleKeyDown: (e: KeyboardEvent, onSubmit: (value: string) => void) => void;
  /** Reset the input value and multi-line state */
  reset: () => void;
}

/**
 * Hook that manages multi-line input state for the debug console.
 * Shift+Enter adds a newline; Enter submits the input.
 *
 * @returns MultiLineInputManager with value, event handler, and reset
 */
export function useMultiLineInput(): MultiLineInputManager {
  const [value, setValue] = createSignal("");
  const [isMultiLine, setIsMultiLine] = createSignal(false);

  const handleKeyDown = (
    e: KeyboardEvent,
    onSubmit: (value: string) => void,
  ): void => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      setValue((prev) => prev + "\n");
      setIsMultiLine(true);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const current = value().trim();
      if (current.length > 0) {
        onSubmit(current);
        reset();
      }
    }
  };

  const reset = (): void => {
    setValue("");
    setIsMultiLine(false);
  };

  return {
    value,
    setValue,
    isMultiLine,
    handleKeyDown,
    reset,
  };
}
