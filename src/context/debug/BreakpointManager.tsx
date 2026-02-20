import { createSignal, type Accessor } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  useDebug,
  type DataBreakpointAccessType,
} from "@/context/DebugContext";
import { createLogger } from "@/utils/logger";

const logger = createLogger("BreakpointManager");

/**
 * Interpolates `{variable}` expressions in a logpoint message template
 * using the provided variables map.
 *
 * @param template - Message template with `{variable}` placeholders
 * @param variables - Map of variable names to their string values
 * @returns The interpolated message string
 *
 * @example
 * ```ts
 * evaluateLogpointMessage("x = {x}, y = {y}", { x: "42", y: "hello" })
 * // => "x = 42, y = hello"
 * ```
 */
export function evaluateLogpointMessage(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey in variables) {
      return variables[trimmedKey];
    }
    return `{${trimmedKey}}`;
  });
}

/**
 * Tracks hit counts per breakpoint ID.
 */
export interface HitCountTracker {
  /** Get the hit count for a specific breakpoint ID */
  get: (breakpointId: string) => number;
  /** Increment the hit count for a specific breakpoint ID */
  increment: (breakpointId: string) => number;
  /** Reset the hit count for a specific breakpoint ID (or all if no ID given) */
  reset: (breakpointId?: string) => void;
  /** Get all hit counts as a readonly record */
  getAll: Accessor<Readonly<Record<string, number>>>;
}

/**
 * Creates a reactive store that tracks hit counts per breakpoint ID.
 * Useful for implementing hit-count conditional breakpoints.
 *
 * @returns A HitCountTracker with get, increment, reset, and getAll methods
 */
export function createHitCountTracker(): HitCountTracker {
  const [counts, setCounts] = createSignal<Record<string, number>>({});

  const get = (breakpointId: string): number => {
    return counts()[breakpointId] ?? 0;
  };

  const increment = (breakpointId: string): number => {
    const current = get(breakpointId);
    const next = current + 1;
    setCounts((prev) => ({ ...prev, [breakpointId]: next }));
    return next;
  };

  const reset = (breakpointId?: string): void => {
    if (breakpointId !== undefined) {
      setCounts((prev) => {
        const next = { ...prev };
        delete next[breakpointId];
        return next;
      });
    } else {
      setCounts({});
    }
  };

  return {
    get,
    increment,
    reset,
    getAll: counts,
  };
}

/** Response from the DAP dataBreakpointInfo request */
export interface DataBreakpointInfoResult {
  dataId: string | null;
  description: string;
  accessTypes: DataBreakpointAccessType[] | null;
  canPersist: boolean;
}

/** Parameters for setting data breakpoints via DAP */
interface DataBreakpointParams {
  dataId: string;
  accessType: DataBreakpointAccessType;
  condition?: string;
  hitCondition?: string;
}

/** Result from setting data breakpoints */
interface SetDataBreakpointsResult {
  breakpoints: Array<{
    id?: string;
    verified: boolean;
    message?: string;
  }>;
}

/**
 * Return type for the useDataBreakpoints hook.
 */
export interface DataBreakpointsManager {
  /** Request data breakpoint info for a variable from the debug adapter */
  requestInfo: (
    sessionId: string,
    variablesReference: number | undefined,
    name: string,
    frameId?: number,
  ) => Promise<DataBreakpointInfoResult>;
  /** Set data breakpoints on the debug adapter */
  setDataBreakpoints: (
    sessionId: string,
    breakpoints: DataBreakpointParams[],
  ) => Promise<SetDataBreakpointsResult>;
  /** Whether a DAP request is currently in progress */
  loading: Accessor<boolean>;
}

/**
 * Hook for enhanced data breakpoint management.
 * Provides functions to query data breakpoint info and set data breakpoints
 * via DAP's `dataBreakpointInfo` and `setDataBreakpoints` requests.
 *
 * Must be used within a DebugProvider.
 */
export function useDataBreakpoints(): DataBreakpointsManager {
  useDebug();
  const [loading, setLoading] = createSignal(false);

  const requestInfo = async (
    sessionId: string,
    variablesReference: number | undefined,
    name: string,
    frameId?: number,
  ): Promise<DataBreakpointInfoResult> => {
    setLoading(true);
    try {
      const result = await invoke<DataBreakpointInfoResult>(
        "debug_data_breakpoint_info",
        {
          sessionId,
          variablesReference: variablesReference ?? null,
          name,
          frameId: frameId ?? null,
        },
      );
      return result;
    } catch (error) {
      logger.error("Failed to get data breakpoint info:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const setDataBreakpoints = async (
    sessionId: string,
    breakpoints: DataBreakpointParams[],
  ): Promise<SetDataBreakpointsResult> => {
    setLoading(true);
    try {
      const result = await invoke<SetDataBreakpointsResult>(
        "debug_set_data_breakpoints",
        {
          sessionId,
          breakpoints,
        },
      );
      return result;
    } catch (error) {
      logger.error("Failed to set data breakpoints:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    requestInfo,
    setDataBreakpoints,
    loading,
  };
}
