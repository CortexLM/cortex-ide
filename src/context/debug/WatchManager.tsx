import { createSignal, type Accessor } from "solid-js";
import { useDebug, type Variable } from "@/context/DebugContext";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WatchManager");

const MAX_WATCH_HISTORY = 20;

/**
 * Return type for the useWatchHistory hook.
 */
export interface WatchHistoryManager {
  /** Reactive accessor for the list of recent watch expressions */
  history: Accessor<string[]>;
  /** Add an expression to history (deduplicates, caps at MAX_WATCH_HISTORY) */
  addToHistory: (expression: string) => void;
  /** Clear all history entries */
  clearHistory: () => void;
}

/**
 * Hook that tracks the last 20 watch expressions entered by the user.
 * Expressions are stored in most-recent-first order and deduplicated.
 *
 * @returns WatchHistoryManager with history accessor and mutation methods
 */
export function useWatchHistory(): WatchHistoryManager {
  const [history, setHistory] = createSignal<string[]>([]);

  const addToHistory = (expression: string): void => {
    const trimmed = expression.trim();
    if (trimmed.length === 0) {
      return;
    }

    setHistory((prev) => {
      const filtered = prev.filter((e) => e !== trimmed);
      const next = [trimmed, ...filtered];
      return next.slice(0, MAX_WATCH_HISTORY);
    });
  };

  const clearHistory = (): void => {
    setHistory([]);
  };

  return {
    history,
    addToHistory,
    clearHistory,
  };
}

/**
 * Return type for the useExpandableVariable hook.
 */
export interface ExpandableVariableManager {
  /** Reactive accessor for child variables (empty until expanded) */
  children: Accessor<Variable[]>;
  /** Whether the variable is currently expanded */
  expanded: Accessor<boolean>;
  /** Whether child variables are currently being loaded */
  loading: Accessor<boolean>;
  /** Toggle expanded state; loads children on first expand */
  toggle: () => Promise<void>;
}

/**
 * Hook that manages the expand/collapse state of a variable in the
 * debug variables view. On first expand, loads child variables via
 * the debug context's `expandVariable` method.
 *
 * Must be used within a DebugProvider.
 *
 * @param variablesReference - The DAP variables reference for loading children
 * @returns ExpandableVariableManager with children, expanded, loading, and toggle
 */
export function useExpandableVariable(
  variablesReference: number,
): ExpandableVariableManager {
  const debug = useDebug();
  const [children, setChildren] = createSignal<Variable[]>([]);
  const [expanded, setExpanded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  let loaded = false;

  const toggle = async (): Promise<void> => {
    if (expanded()) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (!loaded && variablesReference > 0) {
      setLoading(true);
      try {
        const result = await debug.expandVariable(variablesReference);
        setChildren(result);
        loaded = true;
      } catch (error) {
        logger.error("Failed to expand variable:", error);
        setExpanded(false);
      } finally {
        setLoading(false);
      }
    }
  };

  return {
    children,
    expanded,
    loading,
    toggle,
  };
}

/**
 * Copies a watch expression value to the system clipboard.
 *
 * @param value - The string value to copy
 * @returns A promise that resolves when the value is copied
 */
export async function copyValueToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch (error) {
    logger.error("Failed to copy value to clipboard:", error);
    throw error;
  }
}
