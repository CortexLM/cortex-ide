/**
 * useDebugSession - Debug lifecycle management hook
 *
 * Provides a reactive interface for managing debug sessions via the
 * Debug Adapter Protocol (DAP) backend. Handles session lifecycle,
 * pause/resume, and stepping operations with proper cleanup.
 *
 * Features:
 * - Session start/stop lifecycle management
 * - Pause/resume toggle
 * - Step over, step into, step out operations
 * - Reactive state signals for session status
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * function DebugToolbar() {
 *   const {
 *     isActive, isPaused, startSession, stopSession,
 *     togglePause, stepOver, stepInto, stepOut,
 *   } = useDebugSession();
 *
 *   return (
 *     <div>
 *       <Show when={!isActive()}>
 *         <button onClick={() => startSession({ program: "/app/main.ts" })}>
 *           Start Debug
 *         </button>
 *       </Show>
 *       <Show when={isActive()}>
 *         <button onClick={togglePause}>
 *           {isPaused() ? "Continue" : "Pause"}
 *         </button>
 *         <button onClick={stepOver}>Step Over</button>
 *         <button onClick={stepInto}>Step Into</button>
 *         <button onClick={stepOut}>Step Out</button>
 *         <button onClick={stopSession}>Stop</button>
 *       </Show>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  onCleanup,
  batch,
  type Accessor,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/** Configuration for starting a debug session */
export interface DebugSessionConfig {
  /** Path to the program to debug */
  program: string;
  /** Working directory for the debug session */
  cwd?: string;
  /** Command-line arguments for the program */
  args?: string[];
  /** Environment variables for the debug session */
  env?: Record<string, string>;
  /** Debug adapter type (e.g., "node", "python", "lldb") */
  type?: string;
  /** Whether to stop on entry */
  stopOnEntry?: boolean;
  /** Port for the debug adapter */
  port?: number;
}

/** Return type for useDebugSession hook */
export interface UseDebugSessionReturn {
  /** Whether a debug session is currently active */
  isActive: Accessor<boolean>;
  /** Whether the debug session is currently paused at a breakpoint */
  isPaused: Accessor<boolean>;
  /** The current debug session identifier */
  sessionId: Accessor<string | null>;
  /** Start a new debug session with the given configuration */
  startSession: (config: DebugSessionConfig) => Promise<void>;
  /** Stop the current debug session */
  stopSession: () => Promise<void>;
  /** Toggle between paused and running states */
  togglePause: () => Promise<void>;
  /** Step over the current line */
  stepOver: () => Promise<void>;
  /** Step into the current function call */
  stepInto: () => Promise<void>;
  /** Step out of the current function */
  stepOut: () => Promise<void>;
}

// ============================================================================
// useDebugSession Hook
// ============================================================================

/**
 * Hook for managing debug session lifecycle via DAP.
 *
 * @returns Object with session state signals and control methods
 *
 * @example
 * ```tsx
 * const { isActive, isPaused, startSession, stopSession } = useDebugSession();
 *
 * // Start a debug session
 * await startSession({ program: "./src/main.ts", type: "node" });
 *
 * // Check state
 * if (isActive() && isPaused()) {
 *   await stepOver();
 * }
 * ```
 */
export function useDebugSession(): UseDebugSessionReturn {
  const [isActive, setIsActive] = createSignal<boolean>(false);
  const [isPaused, setIsPaused] = createSignal<boolean>(false);
  const [sessionId, setSessionId] = createSignal<string | null>(null);

  const startSession = async (config: DebugSessionConfig): Promise<void> => {
    const id = await invoke<string>("dap_start_session", { config });

    batch(() => {
      setSessionId(id);
      setIsActive(true);
      setIsPaused(false);
    });
  };

  const stopSession = async (): Promise<void> => {
    const currentId = sessionId();
    if (!currentId) {
      return;
    }

    await invoke("dap_stop_session", { sessionId: currentId });

    batch(() => {
      setIsActive(false);
      setIsPaused(false);
      setSessionId(null);
    });
  };

  const togglePause = async (): Promise<void> => {
    const currentId = sessionId();
    if (!currentId || !isActive()) {
      return;
    }

    if (isPaused()) {
      await invoke("dap_continue", { sessionId: currentId });
      setIsPaused(false);
    } else {
      await invoke("dap_pause", { sessionId: currentId });
      setIsPaused(true);
    }
  };

  const stepOver = async (): Promise<void> => {
    const currentId = sessionId();
    if (!currentId || !isActive()) {
      return;
    }

    await invoke("dap_step_over", { sessionId: currentId });
  };

  const stepInto = async (): Promise<void> => {
    const currentId = sessionId();
    if (!currentId || !isActive()) {
      return;
    }

    await invoke("dap_step_into", { sessionId: currentId });
  };

  const stepOut = async (): Promise<void> => {
    const currentId = sessionId();
    if (!currentId || !isActive()) {
      return;
    }

    await invoke("dap_step_out", { sessionId: currentId });
  };

  onCleanup(() => {
    const currentId = sessionId();
    if (currentId && isActive()) {
      void invoke("dap_stop_session", { sessionId: currentId });
    }
  });

  return {
    isActive,
    isPaused,
    sessionId,
    startSession,
    stopSession,
    togglePause,
    stepOver,
    stepInto,
    stepOut,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useDebugSession;
