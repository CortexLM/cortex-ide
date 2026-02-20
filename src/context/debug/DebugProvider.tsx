import { useDebug } from "@/context/DebugContext";
import {
  createHitCountTracker,
  evaluateLogpointMessage,
  useDataBreakpoints,
  type HitCountTracker,
  type DataBreakpointsManager,
  type DataBreakpointInfoResult,
} from "./BreakpointManager";
import {
  useWatchHistory,
  useExpandableVariable,
  copyValueToClipboard,
  type WatchHistoryManager,
  type ExpandableVariableManager,
} from "./WatchManager";
import {
  useConsoleHistory,
  useConsoleCompletions,
  useMultiLineInput,
  type ConsoleHistoryManager,
  type ConsoleCompletionsManager,
  type MultiLineInputManager,
  type DebugCompletionItem,
} from "./ConsoleManager";

export {
  evaluateLogpointMessage,
  createHitCountTracker,
  useDataBreakpoints,
  useWatchHistory,
  useExpandableVariable,
  copyValueToClipboard,
  useConsoleHistory,
  useConsoleCompletions,
  useMultiLineInput,
};

export type {
  HitCountTracker,
  DataBreakpointsManager,
  DataBreakpointInfoResult,
  WatchHistoryManager,
  ExpandableVariableManager,
  ConsoleHistoryManager,
  ConsoleCompletionsManager,
  MultiLineInputManager,
  DebugCompletionItem,
};

export type {
  DebugSessionConfig,
  DebugSessionInfo,
  DebugSessionState,
  Thread,
  StackFrame,
  Source,
  Variable,
  Breakpoint,
  DataBreakpoint,
  DataBreakpointAccessType,
  Scope,
  WatchExpression,
  EvaluateResult,
  OutputMessage,
  FunctionBreakpoint,
  BreakpointGroup,
  BreakpointId,
  BreakpointLocation,
  SetVariableResult,
  DebugCapabilities,
  CompoundConfig,
  SavedLaunchConfig,
  InlineValueInfo,
  ExceptionBreakpoint,
  ExceptionBreakpointFilter,
  StepInTarget,
  GotoTarget,
  DebugBehaviorSettings,
  DebugHoverResult,
  Logpoint,
} from "@/context/DebugContext";

export { useDebug } from "@/context/DebugContext";

/**
 * Enhanced debug context value that extends the base debug context
 * with sub-manager features for breakpoints, watches, and console.
 */
export interface DebugEnhanced {
  /** Base debug context (all existing useDebug() functionality) */
  debug: ReturnType<typeof useDebug>;
  /** Hit count tracker for breakpoints */
  hitCountTracker: HitCountTracker;
  /** Watch expression history manager */
  watchHistory: WatchHistoryManager;
  /** Console command history manager */
  consoleHistory: ConsoleHistoryManager;
  /** Multi-line input manager for the debug console */
  multiLineInput: MultiLineInputManager;
}

/**
 * Enhanced debug hook that wraps `useDebug()` and adds sub-manager
 * features for breakpoint hit tracking, watch history, console history,
 * and multi-line input handling.
 *
 * Must be used within a DebugProvider.
 *
 * @returns DebugEnhanced with the base debug context and all sub-managers
 */
export function useDebugEnhanced(): DebugEnhanced {
  const debug = useDebug();
  const hitCountTracker = createHitCountTracker();
  const watchHistory = useWatchHistory();
  const consoleHistory = useConsoleHistory();
  const multiLineInput = useMultiLineInput();

  return {
    debug,
    hitCountTracker,
    watchHistory,
    consoleHistory,
    multiLineInput,
  };
}
