import {
  createContext,
  useContext,
  ParentComponent,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { fsExists, fsReadFile } from "../utils/tauri-api";
import { parseJsoncSafe } from "../utils/jsonc";
import type { DebugEvent } from "../types/events";
import { DEFAULT_SETTINGS, type DebugSettings } from "./SettingsContext";
import { createLogger } from "../utils/logger";

const debugLogger = createLogger("Debug");
import {
  type DebugHoverState,
  
  type InlineValueState,
  
  type ExceptionWidgetState,
  type ExceptionInfo,
  type SessionPickerState as SessionPickerStateBase,
  type BreakpointActivation,
  type DebugConsoleSettings,
  type DebugToolbarLocation,
  
  DEFAULT_DEBUG_CONSOLE_SETTINGS,
} from "../types/debug";

// Use our DebugSessionInfo type for SessionPickerState
type SessionPickerState = SessionPickerStateBase<DebugSessionInfo>;

// ============== Types ==============

export interface DebugSessionConfig {
  id: string;
  name: string;
  type: string;
  request: "launch" | "attach";
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
  console?: string;
  port?: number;
  host?: string;
  adapterPath?: string;
  adapterArgs?: string[];
  preLaunchTask?: string;
  postDebugTask?: string;
  [key: string]: unknown;
}

export interface DebugSessionInfo {
  id: string;
  name: string;
  type: string;
  state: DebugSessionState;
}

export type DebugSessionState =
  | { type: "initializing" }
  | { type: "running" }
  | { type: "stopped"; reason: string; threadId?: number; description?: string }
  | { type: "ended" };

export interface Thread {
  id: number;
  name: string;
  stopped?: boolean;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: Source;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  canRestart?: boolean;
  presentationHint?: string;
}

export interface Source {
  name?: string;
  path?: string;
  sourceReference?: number;
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  evaluateName?: string;
}

export interface Breakpoint {
  id?: number;
  path: string;
  line: number;
  column?: number;
  endColumn?: number;
  verified: boolean;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  message?: string;
  enabled: boolean;
  isLogpoint?: boolean;
  logHitCount?: number;
  /** ID of the trigger breakpoint (format: "path:line" or "path:line:column") */
  triggeredBy?: string | null;
  /** Whether this is a triggered breakpoint that was auto-disabled and waiting for trigger */
  isTriggeredBreakpoint?: boolean;
}

export interface Logpoint {
  id: string;
  file: string;
  line: number;
  message: string;
  enabled: boolean;
  hitCount?: number;
}

/**
 * DAP ExceptionBreakpointFilter - describes an exception filter available from the debug adapter.
 * These are reported in the adapter's capabilities during initialization.
 */
export interface ExceptionBreakpointFilter {
  filter: string;
  label: string;
  description?: string;
  default?: boolean;
  supportsCondition?: boolean;
  conditionDescription?: string;
}

/**
 * Exception breakpoint setting - user's configuration for each filter.
 * Combines the filter info from the adapter with user's enabled/condition settings.
 */
export interface ExceptionBreakpoint {
  filter: string;
  label: string;
  description?: string;
  enabled: boolean;
  condition?: string;
  supportsCondition: boolean;
  conditionDescription?: string;
}

/**
 * Storage key prefix for persisting exception breakpoint settings per debug type.
 */
const EXCEPTION_BP_STORAGE_KEY = "orion:exception-breakpoints";

/**
 * Persisted exception breakpoint settings structure.
 */
interface PersistedExceptionSettings {
  [filter: string]: {
    enabled: boolean;
    condition?: string;
  };
}

export type DataBreakpointAccessType = "read" | "write" | "readWrite";

export interface DataBreakpoint {
  id: string;
  variableName: string;
  accessType: DataBreakpointAccessType;
  enabled: boolean;
  hitCount: number;
  verified?: boolean;
  description?: string;
  dataId?: string;
}

export interface Scope {
  name: string;
  presentationHint?: string;
  variablesReference: number;
  expensive: boolean;
}

/** Information about a variable value to display inline in the editor */
export interface InlineValueInfo {
  /** Variable name */
  name: string;
  /** Truncated display value */
  value: string;
  /** Variable type if available */
  type?: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based, optional) */
  column?: number;
  /** Full untruncated value for hover tooltip */
  fullValue: string;
  /** Reference for expandable variables */
  variablesReference?: number;
}

export interface FunctionBreakpoint {
  name: string;
  condition?: string;
  hitCondition?: string;
  enabled: boolean;
  verified: boolean;
  id?: number;
  message?: string;
}

/**
 * Breakpoint Group - allows organizing breakpoints into named groups
 * that can be enabled/disabled together.
 */
export interface BreakpointGroup {
  id: string;
  name: string;
  breakpointIds: string[];
  enabled: boolean;
}

/**
 * Unique identifier for a breakpoint used in groups.
 * Format: "path:line" or "path:line:column" for inline breakpoints
 */
export type BreakpointId = string;

/**
 * Helper to create a breakpoint ID from path, line, and optional column.
 */
export function createBreakpointId(path: string, line: number, column?: number): BreakpointId {
  return column !== undefined ? `${path}:${line}:${column}` : `${path}:${line}`;
}

/**
 * Helper to parse a breakpoint ID into its components.
 */
export function parseBreakpointId(id: BreakpointId): { path: string; line: number; column?: number } {
  const parts = id.split(":");
  // Handle Windows paths with drive letter (e.g., C:\path\file.ts:10)
  if (parts.length >= 3 && parts[0].length === 1) {
    // Windows path: drive letter is single character
    // Find the last numeric parts for line and optional column
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    if (!isNaN(parseInt(lastPart, 10)) && !isNaN(parseInt(secondLastPart, 10))) {
      // Format: C:\path\file.ts:10:5 (with column)
      const column = parseInt(lastPart, 10);
      const line = parseInt(secondLastPart, 10);
      const path = parts.slice(0, -2).join(":");
      return { path, line, column };
    } else if (!isNaN(parseInt(lastPart, 10))) {
      // Format: C:\path\file.ts:10 (without column)
      const line = parseInt(lastPart, 10);
      const path = parts.slice(0, -1).join(":");
      return { path, line };
    }
  }
  
  // Unix path or other format
  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];
  
  if (parts.length >= 3 && !isNaN(parseInt(lastPart, 10)) && !isNaN(parseInt(secondLastPart, 10))) {
    // Format: /path/file.ts:10:5 (with column)
    const column = parseInt(lastPart, 10);
    const line = parseInt(secondLastPart, 10);
    const path = parts.slice(0, -2).join(":");
    return { path, line, column };
  } else if (parts.length >= 2 && !isNaN(parseInt(lastPart, 10))) {
    // Format: /path/file.ts:10 (without column)
    const line = parseInt(lastPart, 10);
    const path = parts.slice(0, -1).join(":");
    return { path, line };
  }
  
  // Fallback - treat whole thing as path with line 0
  return { path: id, line: 0 };
}

/**
 * Storage key for persisting breakpoint groups.
 */
const BREAKPOINT_GROUPS_STORAGE_KEY = "orion:breakpoint-groups";

export interface BreakpointLocation {
  path: string;
  line: number;
  column?: number;
  endColumn?: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  enabled?: boolean;
  /** ID of the trigger breakpoint (format: "path:line" or "path:line:column") */
  triggeredBy?: string | null;
  /** Whether this is a triggered breakpoint */
  isTriggeredBreakpoint?: boolean;
}

export interface EvaluateResult {
  result: string;
  type?: string;
  variablesReference: number;
}

/**
 * Result of evaluating an expression for debug hover.
 * Combines the expression range with the evaluated value.
 */
export interface DebugHoverResult {
  /** The expression that was evaluated */
  expression: string;
  /** The evaluated result */
  result: string;
  /** The type of the result if available */
  type?: string;
  /** Reference for expanding complex variables */
  variablesReference: number;
  /** The range of the expression in the document (0-based line/character) */
  range?: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
}

export interface SetVariableResult {
  value: string;
  type?: string;
  variablesReference: number;
}

/** Debug adapter capabilities - indicates which features are supported */
export interface DebugCapabilities {
  supportsStepBack?: boolean;
  supportsReverseContinue?: boolean;
  supportsRestartFrame?: boolean;
  supportsRestartRequest?: boolean;
  supportsSetVariable?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsDisassembleRequest?: boolean;
  supportsReadMemoryRequest?: boolean;
  supportsWriteMemoryRequest?: boolean;
  supportsDataBreakpoints?: boolean;
  supportsStepInTargetsRequest?: boolean;
  supportsGotoTargetsRequest?: boolean;
}

/**
 * Step-in target - represents a function that can be stepped into
 * when multiple function calls exist on the same line.
 * DAP: StepInTarget
 */
export interface StepInTarget {
  /** Unique identifier for this target */
  id: number;
  /** Display label for the target (usually function name) */
  label: string;
  /** Line number where the target begins */
  line?: number;
  /** Column number where the target begins */
  column?: number;
  /** End line for the target */
  endLine?: number;
  /** End column for the target */
  endColumn?: number;
}

/**
 * Goto target - represents a location that can be jumped to
 * during debugging (set next statement / jump to cursor).
 * DAP: GotoTarget
 */
export interface GotoTarget {
  /** Unique identifier for this target */
  id: number;
  /** Display label for the target */
  label: string;
  /** Line number of the target */
  line: number;
  /** Column number of the target */
  column?: number;
  /** End line for the target */
  endLine?: number;
  /** End column for the target */
  endColumn?: number;
  /** Optional instruction pointer reference */
  instructionPointerReference?: string;
}

export interface OutputMessage {
  category: string;
  output: string;
  source?: string;
  line?: number;
  timestamp: number;
}

export interface WatchExpression {
  id: string;
  expression: string;
  result?: string;
  type?: string;
  error?: string;
}

export interface CompoundConfig {
  name: string;
  configurations: string[];
  preLaunchTask?: string;
  postDebugTask?: string;
  stopAll: boolean;
}

export interface SavedLaunchConfig extends DebugSessionConfig {
  saved: true;
}

// ============== State ==============

// ============== Event Callback Types ==============

/** Callback for session start events */
export type OnDidStartSessionCallback = (session: DebugSessionInfo) => void;

/** Callback for session stop events */
export type OnDidStopSessionCallback = (sessionId: string, exitCode?: number) => void;

/** Callback for breakpoint change events */
export type OnDidChangeBreakpointsCallback = (changes: {
  added: Breakpoint[];
  removed: Breakpoint[];
  changed: Breakpoint[];
}) => void;

// ============== Debug Settings Types ==============

/** Settings for debug behavior */
export interface DebugBehaviorSettings {
  /** Focus the IDE window when a breakpoint is hit */
  focusWindowOnBreak: boolean;
  /** Focus the editor at the breakpoint location when stopped */
  focusEditorOnBreak: boolean;
  /** Show debug status in the status bar */
  showInStatusBar: boolean;
  /** Open debug panel when a session starts */
  openDebugOnSessionStart: boolean;
  /** Close readonly debug tabs when session ends */
  closeReadonlyTabsOnEnd: boolean;
}

/** Default debug behavior settings */
export const DEFAULT_DEBUG_BEHAVIOR_SETTINGS: DebugBehaviorSettings = {
  focusWindowOnBreak: true,
  focusEditorOnBreak: true,
  showInStatusBar: true,
  openDebugOnSessionStart: true,
  closeReadonlyTabsOnEnd: false,
};

interface DebugState {
  sessions: DebugSessionInfo[];
  activeSessionId: string | null;
  threads: Thread[];
  stackFrames: StackFrame[];
  activeThreadId: number | null;
  activeFrameId: number | null;
  variables: Variable[];
  scopes: Scope[];
  scopeVariables: Record<number, Variable[]>;
  breakpoints: Record<string, Breakpoint[]>;
  functionBreakpoints: FunctionBreakpoint[];
  dataBreakpoints: DataBreakpoint[];
  exceptionBreakpoints: ExceptionBreakpoint[];
  exceptionBreakpointFilters: ExceptionBreakpointFilter[];
  currentDebugType: string | null;
  watchExpressions: WatchExpression[];
  output: OutputMessage[];
  isDebugging: boolean;
  isPaused: boolean;
  currentFile: string | null;
  currentLine: number | null;
  savedConfigurations: SavedLaunchConfig[];
  compounds: CompoundConfig[];
  activeCompoundName: string | null;
  compoundSessionIds: string[];
  /** Whether inline values are enabled in the editor */
  inlineValuesEnabled: boolean;
  /** Inline values for the current debug state, keyed by file path */
  inlineValues: Record<string, InlineValueInfo[]>;
  /** Debug adapter capabilities */
  capabilities: DebugCapabilities | null;
  /** Session configs keyed by session ID, for post-debug task execution */
  sessionConfigs: Record<string, DebugSessionConfig>;
  /** Whether hot reload is supported and enabled */
  hotReloadEnabled: boolean;
  /** Breakpoint groups for organizing breakpoints */
  breakpointGroups: BreakpointGroup[];
  
  // ============== New State Properties ==============
  
  /** Debug hover state for tooltip display */
  debugHoverState: DebugHoverState | null;
  /** Inline values state (UI display state) */
  inlineValuesState: InlineValueState;
  /** Exception widget state for displaying caught exceptions */
  exceptionWidgetState: ExceptionWidgetState;
  /** Global breakpoint activation state */
  breakpointActivation: BreakpointActivation;
  /** Session picker state for multi-session UI */
  sessionPickerState: SessionPickerState;
  /** Debug console settings */
  debugConsoleSettings: DebugConsoleSettings;
  /** Debug toolbar location setting */
  toolbarLocation: DebugToolbarLocation;
  /** Debug behavior settings */
  debugBehaviorSettings: DebugBehaviorSettings;
}

interface DebugContextValue {
  state: DebugState;
  // Session management
  startSession: (config: DebugSessionConfig) => Promise<DebugSessionInfo>;
  stopSession: (sessionId?: string, terminate?: boolean) => Promise<void>;
  restartSession: (sessionId?: string) => Promise<void>;
  hotReload: () => Promise<void>;
  getActiveSession: () => DebugSessionInfo | undefined;
  /** Get all active debug sessions */
  getSessions: () => DebugSessionInfo[];
  /** Switch to a different active session */
  setActiveSession: (sessionId: string) => void;
  
  // Multi-session control (for compound debugging / multi-target debugging)
  /** Pause all active debug sessions */
  pauseAll: () => Promise<void>;
  /** Continue all paused debug sessions */
  continueAll: () => Promise<void>;
  /** Stop all active debug sessions */
  stopAll: () => Promise<void>;
  /** Restart all active debug sessions */
  restartAll: () => Promise<void>;
  
  // Execution control
  continue_: () => Promise<void>;
  pause: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  stepBack: () => Promise<void>;
  reverseContinue: () => Promise<void>;
  runToCursor: (path: string, line: number) => Promise<void>;
  // Breakpoints
  setBreakpoints: (path: string, breakpoints: BreakpointLocation[]) => Promise<Breakpoint[]>;
  toggleBreakpoint: (path: string, line: number, column?: number) => Promise<Breakpoint[]>;
  removeBreakpoint: (path: string, line: number, column?: number) => Promise<void>;
  getBreakpointsForFile: (path: string) => Breakpoint[];
  setBreakpointCondition: (path: string, line: number, condition: string, column?: number) => Promise<void>;
  setBreakpointHitCondition: (path: string, line: number, hitCondition: string, column?: number) => Promise<void>;
  enableBreakpoint: (path: string, line: number, enabled: boolean, column?: number) => Promise<void>;
  removeAllBreakpoints: () => Promise<void>;
  // Function breakpoints
  addFunctionBreakpoint: (name: string, condition?: string) => Promise<void>;
  removeFunctionBreakpoint: (name: string) => Promise<void>;
  enableFunctionBreakpoint: (name: string, enabled: boolean) => Promise<void>;
  setFunctionBreakpointCondition: (name: string, condition: string) => Promise<void>;
  // Data breakpoints
  addDataBreakpoint: (variableName: string, accessType: DataBreakpointAccessType, dataId?: string) => Promise<DataBreakpoint | null>;
  removeDataBreakpoint: (id: string) => Promise<void>;
  enableDataBreakpoint: (id: string, enabled: boolean) => Promise<void>;
  clearDataBreakpoints: () => Promise<void>;
  // Exception breakpoints
  setExceptionBreakpoint: (filter: string, enabled: boolean, condition?: string) => Promise<void>;
  setExceptionBreakpointCondition: (filter: string, condition: string) => Promise<void>;
  getExceptionBreakpoints: () => ExceptionBreakpoint[];
  getExceptionBreakpointFilters: () => ExceptionBreakpointFilter[];
  // Logpoints
  addLogpoint: (path: string, line: number, message: string) => Promise<Breakpoint[]>;
  setLogpointMessage: (path: string, line: number, message: string) => Promise<void>;
  toggleLogpoint: (path: string, line: number) => Promise<Breakpoint[]>;
  convertToLogpoint: (path: string, line: number, message: string) => Promise<void>;
  convertToBreakpoint: (path: string, line: number) => Promise<void>;
  evaluateLogpointMessage: (message: string) => Promise<string>;
  // Stack trace
  selectThread: (threadId: number) => Promise<void>;
  selectFrame: (frameId: number) => Promise<void>;
  // Variables
  getVariables: () => Promise<Variable[]>;
  getScopes: () => Promise<Scope[]>;
  getScopeVariables: (scopeRef: number) => Promise<Variable[]>;
  expandVariable: (variablesReference: number) => Promise<Variable[]>;
  expandVariablePaged: (variablesReference: number, start?: number, count?: number) => Promise<Variable[]>;
  setVariable: (variablesReference: number, name: string, value: string) => Promise<SetVariableResult>;
  // Watch expressions
  addWatchExpression: (expression: string) => void;
  removeWatchExpression: (id: string) => void;
  updateWatchExpression: (id: string, expression: string) => void;
  evaluateWatch: (id: string) => Promise<void>;
  refreshWatches: () => Promise<void>;
  // Evaluate
  evaluate: (expression: string, context?: string) => Promise<EvaluateResult>;
  /**
   * Evaluates an expression at a given position for debug hover.
   * Uses LSP's evaluatableExpression if available, otherwise falls back to word-at-cursor.
   * @param uri The document URI
   * @param line The line number (0-based)
   * @param character The character position (0-based)
   * @param getEvaluatableExpression Optional LSP function to get the evaluatable expression
   * @param getTextAtRange Optional function to get text at a range for fallback
   */
  evaluateForHover: (
    uri: string,
    line: number,
    character: number,
    getEvaluatableExpression?: (uri: string, line: number, character: number) => Promise<{
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      expression?: string;
    } | null>,
    getTextAtRange?: (startLine: number, startChar: number, endLine: number, endChar: number) => string
  ) => Promise<DebugHoverResult | null>;
  // Output
  clearOutput: () => void;
  // Compound configurations
  launchCompound: (name: string) => Promise<DebugSessionInfo[]>;
  stopCompound: () => Promise<void>;
  addCompound: (compound: CompoundConfig) => void;
  removeCompound: (name: string) => void;
  updateCompound: (name: string, compound: CompoundConfig) => void;
  getCompounds: () => CompoundConfig[];
  addSavedConfiguration: (config: SavedLaunchConfig) => void;
  removeSavedConfiguration: (name: string) => void;
  getSavedConfigurations: () => SavedLaunchConfig[];
  // Inline values
  setInlineValuesEnabled: (enabled: boolean) => void;
  getInlineValuesForFile: (path: string) => InlineValueInfo[];
  refreshInlineValues: () => Promise<void>;
  // Breakpoint groups
  createBreakpointGroup: (name: string) => BreakpointGroup;
  deleteBreakpointGroup: (groupId: string) => void;
  renameBreakpointGroup: (groupId: string, newName: string) => void;
  addBreakpointToGroup: (groupId: string, breakpointId: BreakpointId) => void;
  removeBreakpointFromGroup: (groupId: string, breakpointId: BreakpointId) => void;
  toggleBreakpointGroup: (groupId: string, enabled?: boolean) => Promise<void>;
  getBreakpointGroups: () => BreakpointGroup[];
  getGroupsForBreakpoint: (breakpointId: BreakpointId) => BreakpointGroup[];
  // Triggered/Dependent breakpoints
  setBreakpointTriggeredBy: (path: string, line: number, triggeredBy: string | null, column?: number) => Promise<void>;
  getAllBreakpointsFlat: () => Breakpoint[];
  getBreakpointId: (bp: Breakpoint) => string;
  // Step Into Targets - allows choosing which function to step into when multiple exist on a line
  /**
   * Gets available step-in targets for the current stack frame.
   * Used when multiple function calls exist on the same line.
   * Requires capabilities.supportsStepInTargetsRequest
   * @param frameId The frame ID to get targets for
   */
  getStepInTargets: (frameId: number) => Promise<StepInTarget[]>;
  /**
   * Steps into a specific target (function) on the current line.
   * @param targetId The target ID from getStepInTargets
   */
  stepIntoTarget: (targetId: number) => Promise<void>;
  // Restart Frame - restart execution from a specific stack frame
  /**
   * Restarts execution from a specific stack frame.
   * Requires capabilities.supportsRestartFrame
   * @param frameId The frame ID to restart from
   */
  restartFrame: (frameId: number) => Promise<void>;
  // Jump to Cursor (Set Next Statement) - move execution point to cursor location
  /**
   * Gets available goto targets for a specific location.
   * Used for "Jump to Cursor" / "Set Next Statement" functionality.
   * Requires capabilities.supportsGotoTargetsRequest
   * @param uri The file URI
   * @param line The target line number (1-based)
   */
  getGotoTargets: (uri: string, line: number) => Promise<GotoTarget[]>;
  /**
   * Jumps execution to a specific goto target.
   * Moves the instruction pointer without executing intermediate code.
   * @param targetId The target ID from getGotoTargets
   */
  jumpToLocation: (targetId: number) => Promise<void>;
  
  // ============== Debug Hover State ==============
  /** Get current debug hover state */
  getDebugHoverState: () => DebugHoverState | null;
  /** Set debug hover state (for tooltip display) */
  setDebugHoverState: (state: DebugHoverState | null) => void;
  /** Expand debug hover to show children */
  expandDebugHover: () => Promise<void>;
  /** Collapse debug hover */
  collapseDebugHover: () => void;
  
  // ============== Inline Values State ==============
  /** Get inline values state */
  getInlineValuesState: () => InlineValueState;
  /** Set inline values state */
  setInlineValuesState: (state: Partial<InlineValueState>) => void;
  
  // ============== Exception Widget ==============
  /** Get exception widget state */
  getExceptionWidgetState: () => ExceptionWidgetState;
  /** Show exception widget with exception info */
  showExceptionWidget: (exception: ExceptionInfo, line: number, column?: number) => void;
  /** Hide exception widget */
  hideExceptionWidget: () => void;
  
  // ============== Breakpoint Activation ==============
  /** Get global breakpoint activation state */
  getBreakpointActivation: () => BreakpointActivation;
  /** Set global breakpoint activation (enable/disable all breakpoints) */
  setBreakpointActivation: (enabled: boolean) => Promise<void>;
  /** Toggle global breakpoint activation */
  toggleBreakpointActivation: () => Promise<void>;
  
  // ============== Session Picker ==============
  /** Get session picker state */
  getSessionPickerState: () => SessionPickerState;
  /** Show session picker */
  showSessionPicker: () => void;
  /** Hide session picker */
  hideSessionPicker: () => void;
  /** Select session from picker */
  selectSessionFromPicker: (sessionId: string) => void;
  
  // ============== Debug Console Settings ==============
  /** Get debug console settings */
  getDebugConsoleSettings: () => DebugConsoleSettings;
  /** Update debug console settings */
  setDebugConsoleSettings: (settings: Partial<DebugConsoleSettings>) => void;
  
  // ============== Toolbar Location ==============
  /** Get debug toolbar location */
  getToolbarLocation: () => DebugToolbarLocation;
  /** Set debug toolbar location */
  setToolbarLocation: (location: DebugToolbarLocation) => void;
  
  // ============== Debug Behavior Settings ==============
  /** Get debug behavior settings */
  getDebugBehaviorSettings: () => DebugBehaviorSettings;
  /** Update debug behavior settings */
  setDebugBehaviorSettings: (settings: Partial<DebugBehaviorSettings>) => void;
  
  // ============== Event Subscriptions ==============
  /** Register callback for session start events */
  onDidStartSession: (callback: OnDidStartSessionCallback) => () => void;
  /** Register callback for session stop events */
  onDidStopSession: (callback: OnDidStopSessionCallback) => () => void;
  /** Register callback for breakpoint change events */
  onDidChangeBreakpoints: (callback: OnDidChangeBreakpointsCallback) => () => void;
}

const DebugContext = createContext<DebugContextValue>();

// ============================================================================
// VS Code launch.json Types and Loading
// ============================================================================

/**
 * VS Code launch.json configuration structure
 */
interface VSCodeLaunchConfig {
  name: string;
  type: string;
  request: "launch" | "attach";
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  envFile?: string;
  stopOnEntry?: boolean;
  console?: string;
  port?: number;
  host?: string;
  preLaunchTask?: string;
  postDebugTask?: string;
  
  // Node.js specific
  runtimeExecutable?: string;
  runtimeArgs?: string[];
  skipFiles?: string[];
  
  // Python specific
  python?: string;
  module?: string;
  justMyCode?: boolean;
  
  // C++/Rust specific
  MIMode?: string;
  miDebuggerPath?: string;
  externalConsole?: boolean;
  
  // Go specific
  mode?: string;
  buildFlags?: string;
  
  // Allow any other properties
  [key: string]: unknown;
}

/**
 * VS Code launch.json file structure
 */
interface VSCodeLaunchFile {
  version?: string;
  configurations?: VSCodeLaunchConfig[];
  compounds?: CompoundConfig[];
}

/**
 * Converts a VS Code launch configuration to our SavedLaunchConfig format
 */
function convertVSCodeLaunchConfig(config: VSCodeLaunchConfig): SavedLaunchConfig {
  return {
    id: `vscode-${config.name}-${Date.now()}`,
    name: config.name,
    type: config.type,
    request: config.request,
    program: config.program,
    args: config.args,
    cwd: config.cwd,
    env: config.env,
    stopOnEntry: config.stopOnEntry,
    console: config.console,
    port: config.port,
    host: config.host,
    preLaunchTask: config.preLaunchTask,
    postDebugTask: config.postDebugTask,
    // Pass through all other properties
    ...Object.fromEntries(
      Object.entries(config).filter(([key]) => 
        !["name", "type", "request", "program", "args", "cwd", "env", "stopOnEntry", 
          "console", "port", "host", "preLaunchTask", "postDebugTask"].includes(key)
      )
    ),
    saved: true,
  };
}

/**
 * Loads VS Code launch configurations from .vscode/launch.json
 */
async function loadVSCodeLaunchConfigs(workspacePath: string): Promise<{
  configurations: SavedLaunchConfig[];
  compounds: CompoundConfig[];
}> {
  const launchPath = `${workspacePath}/.vscode/launch.json`;
  
  try {
    const exists = await fsExists(launchPath);
    if (!exists) {
      return { configurations: [], compounds: [] };
    }
    
    const content = await fsReadFile(launchPath);
    const launchJson = parseJsoncSafe<VSCodeLaunchFile>(content, { configurations: [], compounds: [] });
    
    const configurations: SavedLaunchConfig[] = [];
    const compounds: CompoundConfig[] = [];
    
    // Convert configurations
    if (launchJson.configurations && Array.isArray(launchJson.configurations)) {
      for (const config of launchJson.configurations) {
        if (config.name && config.type && config.request) {
          configurations.push(convertVSCodeLaunchConfig(config));
        }
      }
    }
    
    // Convert compounds
    if (launchJson.compounds && Array.isArray(launchJson.compounds)) {
      for (const compound of launchJson.compounds) {
        if (compound.name && compound.configurations) {
          compounds.push({
            name: compound.name,
            configurations: compound.configurations,
            preLaunchTask: compound.preLaunchTask,
            stopAll: compound.stopAll ?? true,
          });
        }
      }
    }
    
    debugLogger.debug(`Loaded ${configurations.length} configuration(s) and ${compounds.length} compound(s) from .vscode/launch.json`);
    return { configurations, compounds };
  } catch (error) {
    console.warn("[Debug] Failed to load VS Code launch configurations:", error);
    return { configurations: [], compounds: [] };
  }
}

// ============== Provider ==============

// ============== Storage Keys ==============
const DEBUG_CONSOLE_SETTINGS_KEY = "orion:debug-console-settings";
const DEBUG_TOOLBAR_LOCATION_KEY = "orion:debug-toolbar-location";
const DEBUG_BEHAVIOR_SETTINGS_KEY = "orion:debug-behavior-settings";
const BREAKPOINT_ACTIVATION_KEY = "orion:breakpoint-activation";

export const DebugProvider: ParentComponent = (props) => {
  // ============== Event Callback Registries ==============
  const onStartSessionCallbacks = new Set<OnDidStartSessionCallback>();
  const onStopSessionCallbacks = new Set<OnDidStopSessionCallback>();
  const onChangeBreakpointsCallbacks = new Set<OnDidChangeBreakpointsCallback>();

  // Load persisted settings
  const loadDebugConsoleSettings = (): DebugConsoleSettings => {
    try {
      const stored = localStorage.getItem(DEBUG_CONSOLE_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_DEBUG_CONSOLE_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Failed to load debug console settings:", e);
    }
    return { ...DEFAULT_DEBUG_CONSOLE_SETTINGS };
  };

  const loadToolbarLocation = (): DebugToolbarLocation => {
    try {
      const stored = localStorage.getItem(DEBUG_TOOLBAR_LOCATION_KEY);
      if (stored) {
        return stored as DebugToolbarLocation;
      }
    } catch (e) {
      console.warn("Failed to load toolbar location:", e);
    }
    return "floating";
  };

  const loadDebugBehaviorSettings = (): DebugBehaviorSettings => {
    try {
      const stored = localStorage.getItem(DEBUG_BEHAVIOR_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_DEBUG_BEHAVIOR_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Failed to load debug behavior settings:", e);
    }
    return { ...DEFAULT_DEBUG_BEHAVIOR_SETTINGS };
  };

  const loadBreakpointActivation = (): BreakpointActivation => {
    try {
      const stored = localStorage.getItem(BREAKPOINT_ACTIVATION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load breakpoint activation:", e);
    }
    return { globalEnabled: true };
  };

  const [state, setState] = createStore<DebugState>({
    sessions: [],
    activeSessionId: null,
    threads: [],
    stackFrames: [],
    activeThreadId: null,
    activeFrameId: null,
    variables: [],
    scopes: [],
    scopeVariables: {},
    breakpoints: {},
    functionBreakpoints: [],
    dataBreakpoints: [],
    exceptionBreakpoints: [],
    exceptionBreakpointFilters: [],
    currentDebugType: null,
    watchExpressions: [],
    output: [],
    isDebugging: false,
    isPaused: false,
    currentFile: null,
    currentLine: null,
    savedConfigurations: [],
    compounds: [],
    activeCompoundName: null,
    compoundSessionIds: [],
    inlineValuesEnabled: true,
    inlineValues: {},
    capabilities: null,
    sessionConfigs: {},
    hotReloadEnabled: false,
    breakpointGroups: [],
    // New state properties
    debugHoverState: null,
    inlineValuesState: {
      enabled: true,
      values: [],
    },
    exceptionWidgetState: {
      visible: false,
      exception: null,
      position: { line: 1 },
    },
    breakpointActivation: loadBreakpointActivation(),
    sessionPickerState: {
      sessions: [],
      activeSession: null,
      visible: false,
    },
    debugConsoleSettings: loadDebugConsoleSettings(),
    toolbarLocation: loadToolbarLocation(),
    debugBehaviorSettings: loadDebugBehaviorSettings(),
  });

  let unlistenEvent: UnlistenFn | null = null;

  /**
   * Loads persisted breakpoint groups from localStorage.
   */
  const loadBreakpointGroups = (): BreakpointGroup[] => {
    try {
      const stored = localStorage.getItem(BREAKPOINT_GROUPS_STORAGE_KEY);
      if (stored) {
        const groups = JSON.parse(stored);
        if (Array.isArray(groups)) {
          return groups;
        }
      }
    } catch (e) {
      console.warn("Failed to load breakpoint groups:", e);
    }
    return [];
  };

  /**
   * Saves breakpoint groups to localStorage.
   */
  const saveBreakpointGroups = (groups: BreakpointGroup[]): void => {
    try {
      localStorage.setItem(BREAKPOINT_GROUPS_STORAGE_KEY, JSON.stringify(groups));
    } catch (e) {
      console.warn("Failed to save breakpoint groups:", e);
    }
  };

  /**
   * Loads persisted exception breakpoint settings for a specific debug type from localStorage.
   */
  const loadExceptionBreakpointSettings = (debugType: string): PersistedExceptionSettings => {
    try {
      const key = `${EXCEPTION_BP_STORAGE_KEY}:${debugType}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load exception breakpoint settings:", e);
    }
    return {};
  };

  /**
   * Saves exception breakpoint settings for a specific debug type to localStorage.
   */
  const saveExceptionBreakpointSettings = (debugType: string, settings: PersistedExceptionSettings): void => {
    try {
      const key = `${EXCEPTION_BP_STORAGE_KEY}:${debugType}`;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save exception breakpoint settings:", e);
    }
  };

  // Cache for debug settings - updated via settings:changed event
  let cachedDebugSettings: DebugSettings = { ...DEFAULT_SETTINGS.debug };

  /**
   * Gets the current debug settings.
   * Uses cached settings that are updated when settings change.
   */
  const getDebugSettings = (): DebugSettings => {
    return cachedDebugSettings;
  };

  /**
   * Updates the cached debug settings.
   * Called when settings change event is received.
   */
  const updateCachedDebugSettings = (settings: Partial<DebugSettings>): void => {
    cachedDebugSettings = { ...DEFAULT_SETTINGS.debug, ...settings };
  };

  /**
   * Focuses the window when a breakpoint is hit (if setting enabled).
   */
  const focusWindowOnBreak = async (): Promise<void> => {
    const settings = getDebugSettings();
    if (!settings.focusWindowOnBreak) return;

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      await appWindow.setFocus();
    } catch (e) {
      console.warn("Failed to focus window on break:", e);
    }
  };

  /**
   * Focuses the editor at the breakpoint location (if setting enabled).
   */
  const focusEditorOnBreak = (path: string, line: number): void => {
    const settings = getDebugSettings();
    if (!settings.focusEditorOnBreak) return;

    // Dispatch event to focus editor at the breakpoint location
    window.dispatchEvent(new CustomEvent("editor:goto", {
      detail: { path, line, column: 1, focus: true }
    }));
  };

  /**
   * Opens the debug panel (if setting enabled).
   */
  const openDebugPanelOnSessionStart = (): void => {
    const settings = getDebugSettings();
    if (!settings.openDebugOnSessionStart) return;

    // Dispatch event to open/focus the debug panel
    window.dispatchEvent(new CustomEvent("layout:focus-debug"));
  };

  /**
   * Closes readonly debug tabs when session ends (if setting enabled).
   */
  const closeReadonlyDebugTabs = (): void => {
    const settings = getDebugSettings();
    if (!settings.closeReadonlyTabsOnEnd) return;

    // Dispatch event to close readonly debug tabs
    window.dispatchEvent(new CustomEvent("editor:close-readonly-debug-tabs"));
  };

  /**
   * Initializes exception breakpoints from adapter filters and persisted settings.
   * Called when a debug session provides its capabilities.
   */
  const initializeExceptionBreakpoints = (debugType: string, filters: ExceptionBreakpointFilter[]): void => {
    const persistedSettings = loadExceptionBreakpointSettings(debugType);
    
    const exceptionBreakpoints: ExceptionBreakpoint[] = filters.map((filter) => {
      const persisted = persistedSettings[filter.filter];
      return {
        filter: filter.filter,
        label: filter.label,
        description: filter.description,
        enabled: persisted?.enabled ?? filter.default ?? false,
        condition: persisted?.condition,
        supportsCondition: filter.supportsCondition ?? false,
        conditionDescription: filter.conditionDescription,
      };
    });

    setState(
      produce((s) => {
        s.exceptionBreakpointFilters = filters;
        s.exceptionBreakpoints = exceptionBreakpoints;
        s.currentDebugType = debugType;
      })
    );

    // Sync initial state with adapter
    syncExceptionBreakpointsWithAdapter();
  };

  /**
   * Syncs the current exception breakpoint settings with the debug adapter.
   * Sends the setExceptionBreakpoints request with enabled filters.
   */
  const syncExceptionBreakpointsWithAdapter = async (): Promise<void> => {
    if (!state.activeSessionId) return;

    const enabledFilters = state.exceptionBreakpoints
      .filter((eb) => eb.enabled)
      .map((eb) => ({
        filterId: eb.filter,
        condition: eb.condition,
      }));

    try {
      await invoke("debug_set_exception_breakpoints", {
        sessionId: state.activeSessionId,
        filters: enabledFilters,
      });
    } catch (error) {
      console.error("Failed to set exception breakpoints:", error);
    }
  };

  /**
   * Persists current exception breakpoint settings for the active debug type.
   */
  const persistExceptionBreakpointSettings = (): void => {
    const debugType = state.currentDebugType;
    if (!debugType) return;

    const settings: PersistedExceptionSettings = {};
    for (const eb of state.exceptionBreakpoints) {
      settings[eb.filter] = {
        enabled: eb.enabled,
        condition: eb.condition,
      };
    }

    saveExceptionBreakpointSettings(debugType, settings);
  };

  /**
   * Stops all sessions in the active compound when stopAll is enabled.
   * Called internally when a session terminates.
   */
  const stopAllCompoundSessions = async (excludeSessionId: string): Promise<void> => {
    const compoundName = state.activeCompoundName;
    if (!compoundName) return;

    const compound = state.compounds.find((c) => c.name === compoundName);
    if (!compound || !compound.stopAll) return;

    const sessionsToStop = state.compoundSessionIds.filter((id) => id !== excludeSessionId);
    for (const sessionId of sessionsToStop) {
      try {
        await invoke("debug_stop_session", { sessionId, terminateDebuggee: true });
      } catch (err) {
        console.debug("Stop session failed (may already be stopped):", err);
      }
    }

    setState(
      produce((s) => {
        s.activeCompoundName = null;
        s.compoundSessionIds = [];
      })
    );
  };

  /**
   * Loads VS Code launch configurations and adds them to saved configurations.
   */
  const loadWorkspaceConfigurations = async (workspacePath: string) => {
    const { configurations, compounds } = await loadVSCodeLaunchConfigs(workspacePath);
    
    if (configurations.length > 0 || compounds.length > 0) {
      setState(
        produce((s) => {
          // Add VS Code configurations (avoid duplicates by name)
          for (const config of configurations) {
            const existingIndex = s.savedConfigurations.findIndex((c) => c.name === config.name);
            if (existingIndex === -1) {
              s.savedConfigurations.push(config);
            }
          }
          
          // Add compounds (avoid duplicates by name)
          for (const compound of compounds) {
            const existingIndex = s.compounds.findIndex((c) => c.name === compound.name);
            if (existingIndex === -1) {
              s.compounds.push(compound);
            }
          }
        })
      );
    }
  };

  /**
   * Generates a unique ID for a breakpoint based on its path, line, and optional column.
   */
  const getBreakpointId = (bp: Breakpoint): string => {
    if (bp.column !== undefined) {
      return `${bp.path}:${bp.line}:${bp.column}`;
    }
    return `${bp.path}:${bp.line}`;
  };

  /**
   * Returns all breakpoints as a flat array.
   */
  const getAllBreakpointsFlat = (): Breakpoint[] => {
    const allBps: Breakpoint[] = [];
    for (const bps of Object.values(state.breakpoints)) {
      allBps.push(...bps);
    }
    return allBps;
  };

  /**
   * Checks if the current stopped location matches a trigger breakpoint.
   * If so, enables all dependent breakpoints that have this as their triggeredBy.
   */
  const checkAndEnableTriggeredBreakpoints = async (path: string, line: number): Promise<void> => {
    const triggerId = `${path}:${line}`;
    
    // Find all breakpoints that are triggered by this breakpoint
    const updates: { path: string; breakpoints: BreakpointLocation[] }[] = [];
    
    for (const [filePath, breakpoints] of Object.entries(state.breakpoints)) {
      const needsUpdate = breakpoints.some(bp => bp.triggeredBy === triggerId && bp.isTriggeredBreakpoint && !bp.enabled);
      
      if (needsUpdate) {
        const updatedBreakpoints = breakpoints.map(bp => {
          if (bp.triggeredBy === triggerId && bp.isTriggeredBreakpoint && !bp.enabled) {
            return {
              path: bp.path,
              line: bp.line,
              column: bp.column,
              endColumn: bp.endColumn,
              condition: bp.condition,
              hitCondition: bp.hitCondition,
              logMessage: bp.logMessage,
              enabled: true, // Enable the triggered breakpoint
              triggeredBy: bp.triggeredBy,
              isTriggeredBreakpoint: bp.isTriggeredBreakpoint,
            };
          }
          return {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
            triggeredBy: bp.triggeredBy,
            isTriggeredBreakpoint: bp.isTriggeredBreakpoint,
          };
        });
        updates.push({ path: filePath, breakpoints: updatedBreakpoints });
      }
    }
    
    // Apply updates
    for (const update of updates) {
      await setBreakpoints(update.path, update.breakpoints);
    }
  };

  /**
   * Resets all triggered breakpoints to disabled state.
   * Called when the debug session ends.
   */
  const resetTriggeredBreakpoints = async (): Promise<void> => {
    const updates: { path: string; breakpoints: BreakpointLocation[] }[] = [];
    
    for (const [filePath, breakpoints] of Object.entries(state.breakpoints)) {
      const needsUpdate = breakpoints.some(bp => bp.isTriggeredBreakpoint && bp.enabled);
      
      if (needsUpdate) {
        const updatedBreakpoints = breakpoints.map(bp => {
          if (bp.isTriggeredBreakpoint && bp.enabled) {
            return {
              path: bp.path,
              line: bp.line,
              column: bp.column,
              endColumn: bp.endColumn,
              condition: bp.condition,
              hitCondition: bp.hitCondition,
              logMessage: bp.logMessage,
              enabled: false, // Disable triggered breakpoints
              triggeredBy: bp.triggeredBy,
              isTriggeredBreakpoint: bp.isTriggeredBreakpoint,
            };
          }
          return {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
            triggeredBy: bp.triggeredBy,
            isTriggeredBreakpoint: bp.isTriggeredBreakpoint,
          };
        });
        updates.push({ path: filePath, breakpoints: updatedBreakpoints });
      }
    }
    
    // Apply updates (without session, just update local state)
    for (const update of updates) {
      setState(
        produce((s) => {
          s.breakpoints[update.path] = update.breakpoints.map(bp => ({
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled ?? false,
            triggeredBy: bp.triggeredBy,
            isTriggeredBreakpoint: bp.isTriggeredBreakpoint,
            verified: false,
          }));
        })
      );
    }
  };

  // Event handlers defined outside onMount for cleanup
  let unlistenProject: (() => void) | undefined;
  const handleWorkspaceLoaded = async (e: Event) => {
    const detail = (e as CustomEvent<{ workspacePath: string }>).detail;
    if (detail?.workspacePath) {
      await loadWorkspaceConfigurations(detail.workspacePath);
    }
  };
  const handleSettingsChanged = (e: Event) => {
    const detail = (e as CustomEvent<{ section: string; settings?: DebugSettings }>).detail;
    if (detail?.section === "debug" && detail.settings) {
      updateCachedDebugSettings(detail.settings);
    }
  };

  // Register cleanup synchronously
  onCleanup(() => {
    unlistenEvent?.();
    unlistenProject?.();
    window.removeEventListener("settings:workspace-loaded", handleWorkspaceLoaded);
    window.removeEventListener("settings:changed", handleSettingsChanged);
  });

  onMount(() => {
    // ESSENTIAL - Load immediately (fast localStorage read)
    const savedGroups = loadBreakpointGroups();
    if (savedGroups.length > 0) {
      setState("breakpointGroups", savedGroups);
    }

    // Register fast window event listeners immediately
    window.addEventListener("settings:workspace-loaded", handleWorkspaceLoaded);
    window.addEventListener("settings:changed", handleSettingsChanged);

    // Request initial debug settings by dispatching a request event
    window.dispatchEvent(new CustomEvent("debug:request-settings"));

    // DEFERRED - Set up Tauri event listeners after first paint
    // These don't need to block startup since debug events won't fire until user starts debugging
    const initDeferredListeners = async () => {
      // Listen for debug events from backend
      unlistenEvent = await listen<DebugEvent>("debug:event", (event) => {
        handleDebugEvent(event.payload);
      });
      
      // Listen for workspace/project open events
      unlistenProject = await listen<{ path: string }>("project:opened", async (event) => {
        await loadWorkspaceConfigurations(event.payload.path);
      });
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(initDeferredListeners, { timeout: 2000 });
    } else {
      setTimeout(initDeferredListeners, 100);
    }
  });

  const handleDebugEvent = (event: DebugEvent) => {
    const eventType = event.type;

    switch (eventType) {
      case "stateChanged":
        setState(
          produce((s) => {
            const session = s.sessions.find((sess) => sess.id === s.activeSessionId);
            if (session) {
              session.state = event.state;
            }
            s.isPaused = event.state.type === "stopped";
            if (event.state.type === "ended") {
              s.isDebugging = false;
            }
          })
        );
        break;

      case "threadsUpdated":
        setState("threads", event.threads);
        break;

      case "stackTraceUpdated":
        setState("stackFrames", event.frames);
        if (event.frames.length > 0) {
          setState("activeFrameId", event.frames[0].id);
          // Update current file and line from top frame
          const topFrame = event.frames[0];
          if (topFrame.source?.path) {
            setState("currentFile", topFrame.source.path);
            setState("currentLine", topFrame.line);
            // Check if we hit a trigger breakpoint and enable dependent breakpoints
            checkAndEnableTriggeredBreakpoints(topFrame.source.path, topFrame.line);
            // Apply focus settings when stopped at breakpoint
            focusWindowOnBreak();
            focusEditorOnBreak(topFrame.source.path, topFrame.line);
          }
        }
        break;

      case "variablesUpdated":
        setState("variables", event.variables);
        break;

      case "breakpointsChanged":
        setState(
          produce((s) => {
            if (event.path === "[functions]") {
              s.functionBreakpoints = event.breakpoints.map((bp: any) => ({
                name: bp.path, // We stored name in path
                condition: bp.condition,
                hitCondition: bp.hitCondition,
                enabled: s.functionBreakpoints.find(f => f.name === bp.path)?.enabled ?? true,
                verified: bp.verified,
                id: bp.id,
                message: bp.message,
              }));
            } else {
              s.breakpoints[event.path] = event.breakpoints;
            }
          })
        );
        break;

      case "dataBreakpointHit":
        setState(
          produce((s) => {
            const bp = s.dataBreakpoints.find((dbp) => dbp.id === event.id);
            if (bp) {
              bp.hitCount += 1;
            }
          })
        );
        break;

      case "dataBreakpointsChanged":
        if (event.breakpoints) {
          setState(
            produce((s) => {
              s.dataBreakpoints = event.breakpoints.map((bp: DataBreakpoint) => ({
                ...bp,
                hitCount: s.dataBreakpoints.find((dbp) => dbp.id === bp.id)?.hitCount ?? 0,
              }));
            })
          );
        }
        break;

      case "output":
        setState(
          produce((s) => {
            s.output.push({
              category: event.category,
              output: event.output,
              source: event.source,
              line: event.line,
              timestamp: Date.now(),
            });
            // Keep max 1000 output entries
            if (s.output.length > 1000) {
              s.output = s.output.slice(-1000);
            }
          })
        );
        break;

      case "terminated":
        {
          const terminatedSessionId = event.sessionId;
          // Execute postDebugTask if configured
          const terminatedConfig = terminatedSessionId ? state.sessionConfigs[terminatedSessionId] : null;
          if (terminatedConfig?.postDebugTask) {
            invoke("tasks_run_task", { taskName: terminatedConfig.postDebugTask }).catch((e) => {
              console.warn(`Post-debug task "${terminatedConfig.postDebugTask}" failed:`, e);
            });
          }
          // Handle compound stopAll behavior
          if (terminatedSessionId && state.compoundSessionIds.includes(terminatedSessionId)) {
            stopAllCompoundSessions(terminatedSessionId);
          }
          // Reset triggered breakpoints to disabled state
          resetTriggeredBreakpoints();
          // Close readonly debug tabs if setting enabled
          closeReadonlyDebugTabs();
          // Hide exception widget
          hideExceptionWidget();
          setState(
            produce((s) => {
              // Clean up session config
              if (terminatedSessionId) {
                delete s.sessionConfigs[terminatedSessionId];
              }
              // Remove session from sessions list
              s.sessions = s.sessions.filter((sess) => sess.id !== terminatedSessionId);
              // Remove session from compound tracking
              s.compoundSessionIds = s.compoundSessionIds.filter((id) => id !== terminatedSessionId);
              if (s.compoundSessionIds.length === 0) {
                s.activeCompoundName = null;
              }
              // Update active session if needed
              if (s.activeSessionId === terminatedSessionId) {
                s.activeSessionId = s.sessions[0]?.id || null;
              }
              s.isDebugging = s.sessions.length > 0;
              s.isPaused = false;
              s.threads = [];
              s.stackFrames = [];
              s.variables = [];
              s.scopes = [];
              s.scopeVariables = {};
              s.dataBreakpoints = [];
              s.currentFile = null;
              s.currentLine = null;
              // Clear debug hover state
              s.debugHoverState = null;
            })
          );
          // Update session picker state
          updateSessionPickerState();
          // Notify listeners
          if (terminatedSessionId) {
            notifySessionStopped(terminatedSessionId);
          }
        }
        break;

      case "exited":
        {
          const exitedSessionId = event.sessionId;
          const exitCode = event.exitCode;
          // Execute postDebugTask if configured
          const exitedConfig = exitedSessionId ? state.sessionConfigs[exitedSessionId] : null;
          if (exitedConfig?.postDebugTask) {
            invoke("tasks_run_task", { taskName: exitedConfig.postDebugTask }).catch((e) => {
              console.warn(`Post-debug task "${exitedConfig.postDebugTask}" failed:`, e);
            });
          }
          // Handle compound stopAll behavior
          if (exitedSessionId && state.compoundSessionIds.includes(exitedSessionId)) {
            stopAllCompoundSessions(exitedSessionId);
          }
          // Reset triggered breakpoints to disabled state
          resetTriggeredBreakpoints();
          // Close readonly debug tabs if setting enabled
          closeReadonlyDebugTabs();
          // Hide exception widget
          hideExceptionWidget();
          setState(
            produce((s) => {
              // Clean up session config
              if (exitedSessionId) {
                delete s.sessionConfigs[exitedSessionId];
              }
              // Remove session from sessions list
              s.sessions = s.sessions.filter((sess) => sess.id !== exitedSessionId);
              // Remove session from compound tracking
              s.compoundSessionIds = s.compoundSessionIds.filter((id) => id !== exitedSessionId);
              if (s.compoundSessionIds.length === 0) {
                s.activeCompoundName = null;
              }
              // Update active session if needed
              if (s.activeSessionId === exitedSessionId) {
                s.activeSessionId = s.sessions[0]?.id || null;
              }
              s.isDebugging = s.sessions.length > 0;
              s.isPaused = false;
              s.output.push({
                category: "console",
                output: `Process exited with code ${exitCode}\n`,
                timestamp: Date.now(),
              });
              // Clear debug hover state
              s.debugHoverState = null;
            })
          );
          // Update session picker state
          updateSessionPickerState();
          // Notify listeners
          if (exitedSessionId) {
            notifySessionStopped(exitedSessionId, exitCode);
          }
        }
        break;

      case "capabilitiesReceived":
        {
          // Debug adapter has provided its capabilities including exception breakpoint filters
          const debugType = event.debugType || "unknown";
          const filters: ExceptionBreakpointFilter[] = event.exceptionBreakpointFilters || [];
          
          // If adapter doesn't provide filters, provide default exception types
          const effectiveFilters = filters.length > 0 ? filters : getDefaultExceptionFilters(debugType);
          
          initializeExceptionBreakpoints(debugType, effectiveFilters);
        }
        break;
    }
  };

  /**
   * Returns default exception breakpoint filters for common debug types.
   * Used when the debug adapter doesn't provide its own filters.
   */
  const getDefaultExceptionFilters = (debugType: string): ExceptionBreakpointFilter[] => {
    switch (debugType.toLowerCase()) {
      case "node":
      case "chrome":
      case "msedge":
      case "pwa-node":
      case "pwa-chrome":
      case "javascript":
        return [
          {
            filter: "all",
            label: "All Exceptions",
            description: "Break on all exceptions, whether handled or unhandled",
            default: false,
            supportsCondition: true,
            conditionDescription: "Expression to evaluate. Break if result is truthy.",
          },
          {
            filter: "uncaught",
            label: "Uncaught Exceptions",
            description: "Break on exceptions that are not caught by any handler",
            default: true,
            supportsCondition: true,
            conditionDescription: "Expression to evaluate. Break if result is truthy.",
          },
        ];
      case "python":
      case "debugpy":
        return [
          {
            filter: "raised",
            label: "Raised Exceptions",
            description: "Break when an exception is raised",
            default: false,
            supportsCondition: false,
          },
          {
            filter: "uncaught",
            label: "Uncaught Exceptions",
            description: "Break on exceptions not caught by any handler",
            default: true,
            supportsCondition: false,
          },
          {
            filter: "userUnhandled",
            label: "User-uncaught Exceptions",
            description: "Break on exceptions not caught in user code",
            default: false,
            supportsCondition: false,
          },
        ];
      case "cppdbg":
      case "cppvsdbg":
      case "lldb":
      case "gdb":
        return [
          {
            filter: "all",
            label: "All C++ Exceptions",
            description: "Break on all C++ exceptions",
            default: false,
            supportsCondition: false,
          },
          {
            filter: "uncaught",
            label: "Uncaught C++ Exceptions",
            description: "Break on uncaught C++ exceptions",
            default: true,
            supportsCondition: false,
          },
        ];
      case "coreclr":
      case "clr":
        return [
          {
            filter: "all",
            label: "All CLR Exceptions",
            description: "Break on all CLR exceptions",
            default: false,
            supportsCondition: true,
            conditionDescription: "Exception type name or expression",
          },
          {
            filter: "user-unhandled",
            label: "User-unhandled Exceptions",
            description: "Break on exceptions not handled in user code",
            default: true,
            supportsCondition: true,
            conditionDescription: "Exception type name or expression",
          },
        ];
      case "java":
        return [
          {
            filter: "all",
            label: "All Exceptions",
            description: "Break on all Java exceptions",
            default: false,
            supportsCondition: true,
            conditionDescription: "Exception class name pattern",
          },
          {
            filter: "uncaught",
            label: "Uncaught Exceptions",
            description: "Break on uncaught exceptions",
            default: true,
            supportsCondition: true,
            conditionDescription: "Exception class name pattern",
          },
        ];
      case "go":
      case "dlv":
        return [
          {
            filter: "panic",
            label: "Panic",
            description: "Break on Go panic",
            default: true,
            supportsCondition: false,
          },
        ];
      case "rust":
      case "codelldb":
        return [
          {
            filter: "rust_panic",
            label: "Rust Panic",
            description: "Break on Rust panic",
            default: true,
            supportsCondition: false,
          },
          {
            filter: "cpp",
            label: "C++ Exceptions",
            description: "Break on C++ exceptions (from dependencies)",
            default: false,
            supportsCondition: false,
          },
        ];
      default:
        // Generic fallback filters that work with most DAP adapters
        return [
          {
            filter: "all",
            label: "All Exceptions",
            description: "Break on all exceptions",
            default: false,
            supportsCondition: false,
          },
          {
            filter: "uncaught",
            label: "Uncaught Exceptions",
            description: "Break on uncaught exceptions",
            default: true,
            supportsCondition: false,
          },
        ];
    }
  };

  // ============== Event Notification Helpers ==============

  /**
   * Notifies all registered callbacks when a session starts.
   */
  const notifySessionStarted = (session: DebugSessionInfo): void => {
    for (const callback of onStartSessionCallbacks) {
      try {
        callback(session);
      } catch (e) {
        console.error("Error in onDidStartSession callback:", e);
      }
    }
  };

  /**
   * Notifies all registered callbacks when a session stops.
   */
  const notifySessionStopped = (sessionId: string, exitCode?: number): void => {
    for (const callback of onStopSessionCallbacks) {
      try {
        callback(sessionId, exitCode);
      } catch (e) {
        console.error("Error in onDidStopSession callback:", e);
      }
    }
  };

  /**
   * Notifies all registered callbacks when breakpoints change.
   */
  const notifyBreakpointsChanged = (changes: {
    added: Breakpoint[];
    removed: Breakpoint[];
    changed: Breakpoint[];
  }): void => {
    for (const callback of onChangeBreakpointsCallbacks) {
      try {
        callback(changes);
      } catch (e) {
        console.error("Error in onDidChangeBreakpoints callback:", e);
      }
    }
  };

  /**
   * Updates the session picker state to reflect current sessions.
   */
  const updateSessionPickerState = (): void => {
    const activeSession = state.sessions.find(s => s.id === state.activeSessionId) || null;
    setState(
      produce((s) => {
        s.sessionPickerState = {
          sessions: [...s.sessions],
          activeSession,
          visible: s.sessionPickerState.visible,
        };
      })
    );
  };

  // Session management
  const startSession = async (config: DebugSessionConfig): Promise<DebugSessionInfo> => {
    const session = await invoke<DebugSessionInfo>("debug_start_session", { config });
    setState(
      produce((s) => {
        s.sessions.push(session);
        s.activeSessionId = session.id;
        s.isDebugging = true;
        s.isPaused = false;
        s.output = [];
        s.currentDebugType = config.type;
        // Store the config for post-debug task execution
        s.sessionConfigs[session.id] = config;
      })
    );
    
    // Update session picker state
    updateSessionPickerState();
    
    // Notify listeners
    notifySessionStarted(session);
    
    // Open debug panel on session start if setting enabled
    openDebugPanelOnSessionStart();
    
    // Fetch capabilities from the debug adapter
    try {
      const caps = await invoke<DebugCapabilities>("debug_get_capabilities", { sessionId: session.id });
      setState("capabilities", caps);
      // Enable hot reload if the adapter supports restart requests
      // Hot reload works by restarting the debug session with updated code
      const supportsHotReload = caps?.supportsRestartRequest === true;
      setState("hotReloadEnabled", supportsHotReload);
    } catch (e) {
      console.warn("Failed to fetch debug capabilities:", e);
      setState("capabilities", null);
      setState("hotReloadEnabled", false);
    }
    
    // Initialize exception breakpoints with default filters for this debug type
    // until the adapter provides its capabilities
    const defaultFilters = getDefaultExceptionFilters(config.type);
    initializeExceptionBreakpoints(config.type, defaultFilters);
    
    return session;
  };

  const stopSession = async (sessionId?: string, terminate = true): Promise<void> => {
    const id = sessionId || state.activeSessionId;
    if (!id) return;

    // Get the config before stopping to access postDebugTask
    const sessionConfig = state.sessionConfigs[id];

    try {
      await invoke("debug_stop_session", { sessionId: id, terminateDebuggee: terminate });
      
      // Execute postDebugTask if configured
      if (sessionConfig?.postDebugTask) {
        try {
          await invoke("tasks_run_task", { taskName: sessionConfig.postDebugTask });
        } catch (e) {
          console.warn(`Post-debug task "${sessionConfig.postDebugTask}" failed:`, e);
        }
      }
      
      setState(
        produce((s) => {
          s.sessions = s.sessions.filter((sess) => sess.id !== id);
          // Clean up session config
          delete s.sessionConfigs[id];
          if (s.activeSessionId === id) {
            s.activeSessionId = s.sessions[0]?.id || null;
            s.isDebugging = s.sessions.length > 0;
            s.isPaused = false;
            s.threads = [];
            s.stackFrames = [];
            s.variables = [];
            s.capabilities = null;
          }
        })
      );
    } catch (error) {
      console.error("Debug stopSession failed:", error);
    }
  };

  const restartSession = async (sessionId?: string): Promise<void> => {
    const id = sessionId || state.activeSessionId;
    if (!id) return;

    try {
      await invoke("debug_restart", { sessionId: id });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug restartSession failed:", error);
    }
  };

  /**
   * Hot reload the debug session - restarts the debuggee with updated code.
   * This uses the DAP restart request if supported by the debug adapter.
   * For Node.js, this effectively restarts the process to pick up code changes.
   */
  const hotReload = async (): Promise<void> => {
    if (!state.activeSessionId || !state.hotReloadEnabled) {
      console.warn("Hot reload not available - no active session or not supported");
      return;
    }

    try {
      // Use the restart command which will pick up code changes
      await invoke("debug_restart", { sessionId: state.activeSessionId });
      setState("isPaused", false);
      
      // Emit event for UI notification
      window.dispatchEvent(new CustomEvent("debug:hotReload", {
        detail: { sessionId: state.activeSessionId }
      }));
    } catch (error) {
      console.error("Hot reload failed:", error);
      throw error;
    }
  };

  const getActiveSession = (): DebugSessionInfo | undefined => {
    return state.sessions.find((s) => s.id === state.activeSessionId);
  };

  /**
   * Returns all active debug sessions.
   */
  const getSessions = (): DebugSessionInfo[] => {
    return state.sessions;
  };

  /**
   * Switches to a different active debug session.
   */
  const setActiveSession = (sessionId: string): void => {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found`);
      return;
    }

    setState(
      produce((s) => {
        s.activeSessionId = sessionId;
        // Clear current state that is session-specific
        s.threads = [];
        s.stackFrames = [];
        s.variables = [];
        s.scopes = [];
        s.scopeVariables = {};
        s.activeThreadId = null;
        s.activeFrameId = null;
      })
    );

    // Update session picker state
    updateSessionPickerState();

    // Request threads for the new active session
    invoke("debug_get_threads", { sessionId }).then((threads: unknown) => {
      setState("threads", threads as Thread[]);
    }).catch((e) => {
      console.warn("Failed to get threads for session:", e);
    });
  };

  // Execution control
  const continue_ = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_continue", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug continue failed:", error);
    }
  };

  const pause = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_pause", { sessionId: state.activeSessionId });
    } catch (error) {
      console.error("Debug pause failed:", error);
    }
  };

  const stepOver = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_step_over", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug stepOver failed:", error);
    }
  };

  const stepInto = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_step_into", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug stepInto failed:", error);
    }
  };

  const stepOut = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_step_out", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug stepOut failed:", error);
    }
  };

  const stepBack = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_step_back", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug stepBack failed:", error);
    }
  };

  const reverseContinue = async (): Promise<void> => {
    if (!state.activeSessionId) return;
    try {
      await invoke("debug_reverse_continue", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug reverseContinue failed:", error);
    }
  };

  // ============================================================================
  // Multi-Session Control (for compound/multi-target debugging)
  // ============================================================================

  /**
   * Pause all active debug sessions.
   * Useful for compound debugging where you want to inspect state across all targets.
   */
  const pauseAll = async (): Promise<void> => {
    const sessions = state.sessions.filter(s => s.state.type === "running");
    const pausePromises = sessions.map(async (session) => {
      try {
        await invoke("debug_pause", { sessionId: session.id });
      } catch (error) {
        debugLogger.error(`Failed to pause session ${session.name}:`, error);
      }
    });
    await Promise.all(pausePromises);
  };

  /**
   * Continue all paused debug sessions.
   * Useful for compound debugging where you want to resume all targets simultaneously.
   */
  const continueAll = async (): Promise<void> => {
    const sessions = state.sessions.filter(s => s.state.type === "stopped");
    const continuePromises = sessions.map(async (session) => {
      try {
        await invoke("debug_continue", { sessionId: session.id });
      } catch (error) {
        debugLogger.error(`Failed to continue session ${session.name}:`, error);
      }
    });
    await Promise.all(continuePromises);
    setState("isPaused", false);
  };

  /**
   * Stop all active debug sessions.
   * Terminates all running debug sessions.
   */
  const stopAll = async (): Promise<void> => {
    const sessions = [...state.sessions]; // Copy to avoid mutation during iteration
    const stopPromises = sessions.map(async (session) => {
      try {
        await invoke("debug_terminate", { sessionId: session.id });
      } catch (error) {
        debugLogger.error(`Failed to stop session ${session.name}:`, error);
        // Try disconnect as fallback
        try {
          await invoke("debug_disconnect", { sessionId: session.id });
        } catch (err) {
          console.debug("Debug disconnect fallback failed:", err);
        }
      }
    });
    await Promise.all(stopPromises);
  };

  /**
   * Restart all active debug sessions.
   * Restarts each session with its original configuration.
   */
  const restartAll = async (): Promise<void> => {
    const sessions = [...state.sessions]; // Copy to avoid mutation during iteration
    const restartPromises = sessions.map(async (session) => {
      try {
        // Try to restart using the session config
        const config = state.sessionConfigs[session.id];
        if (config) {
          await invoke("debug_restart", { sessionId: session.id });
        } else {
          debugLogger.warn(`No config found for session ${session.name}, cannot restart`);
        }
      } catch (error) {
        debugLogger.error(`Failed to restart session ${session.name}:`, error);
      }
    });
    await Promise.all(restartPromises);
  };

  // Run to cursor - sets a temporary breakpoint and continues
  const runToCursor = async (path: string, line: number): Promise<void> => {
    if (!state.activeSessionId || !state.isPaused) return;

    // Save existing breakpoints for this file
    const existingBreakpoints = state.breakpoints[path] || [];
    
    // Add temporary breakpoint at cursor
    const tempBreakpoints: BreakpointLocation[] = [
      ...existingBreakpoints.map((bp) => ({
        path: bp.path,
        line: bp.line,
        condition: bp.condition,
        enabled: bp.enabled,
      })),
      { path, line, enabled: true },
    ];

    try {
      // Set breakpoints including temporary one
      await invoke("debug_set_breakpoints", {
        sessionId: state.activeSessionId,
        path,
        breakpoints: tempBreakpoints,
      });

      // Continue execution
      await invoke("debug_continue", { sessionId: state.activeSessionId });
      setState("isPaused", false);
    } catch (error) {
      console.error("Debug runToCursor failed:", error);
    }

    // Note: The temporary breakpoint will be cleaned up when we hit it
    // or can be manually removed after stopping
  };

  // Breakpoints
  const setBreakpoints = async (
    path: string,
    breakpoints: BreakpointLocation[]
  ): Promise<Breakpoint[]> => {
    // Get existing breakpoints for change notification
    const existingBreakpoints = state.breakpoints[path] || [];
    
    // Check if breakpoints are globally disabled
    const globalEnabled = state.breakpointActivation.globalEnabled;
    
    // Filter out disabled breakpoints for the adapter, but keep them locally
    const enabledBreakpoints = globalEnabled 
      ? breakpoints.filter((bp) => bp.enabled !== false)
      : []; // Send empty if globally disabled

    if (!state.activeSessionId) {
      // Store locally without session
      const bps: Breakpoint[] = breakpoints.map((bp) => ({
        path: bp.path,
        line: bp.line,
        column: bp.column,
        endColumn: bp.endColumn,
        verified: false,
        condition: bp.condition,
        hitCondition: bp.hitCondition,
        logMessage: bp.logMessage,
        enabled: bp.enabled !== false,
      }));
      setState(
        produce((s) => {
          s.breakpoints[path] = bps;
        })
      );
      
      // Calculate and notify changes
      const added = bps.filter(bp => !existingBreakpoints.some(e => e.line === bp.line && e.column === bp.column));
      const removed = existingBreakpoints.filter(e => !bps.some(bp => bp.line === e.line && bp.column === e.column));
      const changed = bps.filter(bp => {
        const existing = existingBreakpoints.find(e => e.line === bp.line && e.column === bp.column);
        return existing && (existing.enabled !== bp.enabled || existing.condition !== bp.condition);
      });
      
      if (added.length > 0 || removed.length > 0 || changed.length > 0) {
        notifyBreakpointsChanged({ added, removed, changed });
      }
      
      return bps;
    }

    // Only send enabled breakpoints to the adapter (DAP supports column in SourceBreakpoint)
    const result = await invoke<Breakpoint[]>("debug_set_breakpoints", {
      sessionId: state.activeSessionId,
      path,
      breakpoints: enabledBreakpoints,
    });

    // Merge results with disabled breakpoints
    const allBreakpoints: Breakpoint[] = breakpoints.map((bp) => {
      if (bp.enabled === false) {
        return {
          path: bp.path,
          line: bp.line,
          column: bp.column,
          endColumn: bp.endColumn,
          verified: false,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          enabled: false,
        };
      }
      // Match by line and column for inline breakpoints
      const adapterBp = result.find((r) => r.line === bp.line && (bp.column === undefined || r.column === bp.column));
      return {
        ...bp,
        path: bp.path,
        line: adapterBp?.line ?? bp.line,
        column: adapterBp?.column ?? bp.column,
        endColumn: adapterBp?.endColumn ?? bp.endColumn,
        verified: adapterBp?.verified ?? false,
        id: adapterBp?.id,
        message: adapterBp?.message,
        enabled: true,
      };
    });

    setState(
      produce((s) => {
        s.breakpoints[path] = allBreakpoints;
      })
    );
    
    // Calculate and notify changes
    const added = allBreakpoints.filter(bp => !existingBreakpoints.some(e => e.line === bp.line && e.column === bp.column));
    const removed = existingBreakpoints.filter(e => !allBreakpoints.some(bp => bp.line === e.line && bp.column === e.column));
    const changed = allBreakpoints.filter(bp => {
      const existing = existingBreakpoints.find(e => e.line === bp.line && e.column === bp.column);
      return existing && (existing.enabled !== bp.enabled || existing.condition !== bp.condition || existing.verified !== bp.verified);
    });
    
    if (added.length > 0 || removed.length > 0 || changed.length > 0) {
      notifyBreakpointsChanged({ added, removed, changed });
    }
    
    return allBreakpoints;
  };

  const toggleBreakpoint = async (path: string, line: number, column?: number): Promise<Breakpoint[]> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    // For inline breakpoints (with column), match by line AND column; otherwise just by line (ignoring column bps)
    const existingIndex = existingBreakpoints.findIndex((bp) => 
      bp.line === line && (column === undefined ? bp.column === undefined : bp.column === column)
    );

    let newBreakpoints: BreakpointLocation[];
    if (existingIndex >= 0) {
      newBreakpoints = existingBreakpoints
        .filter((_, i) => i !== existingIndex)
        .map((bp) => ({
          path: bp.path,
          line: bp.line,
          column: bp.column,
          endColumn: bp.endColumn,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          enabled: bp.enabled,
        }));
    } else {
      newBreakpoints = [
        ...existingBreakpoints.map((bp) => ({
          path: bp.path,
          line: bp.line,
          column: bp.column,
          endColumn: bp.endColumn,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          enabled: bp.enabled,
        })),
        { path, line, column, enabled: true },
      ];
    }

    return setBreakpoints(path, newBreakpoints);
  };

  const removeBreakpoint = async (path: string, line: number, column?: number): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints
      .filter((bp) => !(bp.line === line && (column === undefined ? bp.column === undefined : bp.column === column)))
      .map((bp) => ({
        path: bp.path,
        line: bp.line,
        column: bp.column,
        endColumn: bp.endColumn,
        condition: bp.condition,
        hitCondition: bp.hitCondition,
        logMessage: bp.logMessage,
        enabled: bp.enabled,
      }));
    await setBreakpoints(path, newBreakpoints);
  };

  const getBreakpointsForFile = (path: string): Breakpoint[] => {
    return state.breakpoints[path] || [];
  };

  const setBreakpointCondition = async (
    path: string,
    line: number,
    condition: string,
    column?: number
  ): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      (bp.line === line && (column === undefined ? bp.column === undefined : bp.column === column))
        ? {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: condition || undefined,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
        : {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  const setBreakpointHitCondition = async (
    path: string,
    line: number,
    hitCondition: string,
    column?: number
  ): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      (bp.line === line && (column === undefined ? bp.column === undefined : bp.column === column))
        ? {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: hitCondition || undefined,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
        : {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  const enableBreakpoint = async (
    path: string,
    line: number,
    enabled: boolean,
    column?: number
  ): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      (bp.line === line && (column === undefined ? bp.column === undefined : bp.column === column))
        ? {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled,
          }
        : {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  /**
   * Sets the triggeredBy relationship for a breakpoint.
   * When triggeredBy is set, the breakpoint becomes a triggered breakpoint that is initially disabled.
   * It will be automatically enabled when the trigger breakpoint is hit.
   * Pass null to remove the triggeredBy relationship.
   */
  const setBreakpointTriggeredBy = async (
    path: string,
    line: number,
    triggeredBy: string | null,
    column?: number
  ): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      (bp.line === line && (column === undefined ? bp.column === undefined : bp.column === column))
        ? {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            // When setting triggeredBy, disable the breakpoint; when clearing, enable it
            enabled: triggeredBy === null ? true : false,
            triggeredBy: triggeredBy,
            isTriggeredBreakpoint: triggeredBy !== null,
          }
        : {
            path: bp.path,
            line: bp.line,
            column: bp.column,
            endColumn: bp.endColumn,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
            triggeredBy: bp.triggeredBy,
            isTriggeredBreakpoint: bp.isTriggeredBreakpoint,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  const removeAllBreakpoints = async (): Promise<void> => {
    const paths = Object.keys(state.breakpoints);
    for (const path of paths) {
      await setBreakpoints(path, []);
    }
    setState("breakpoints", {});
    setState("functionBreakpoints", []);
    await syncFunctionBreakpoints();
  };

  // Function breakpoints - internal sync function
  const syncFunctionBreakpoints = async (): Promise<void> => {
    if (!state.activeSessionId) return;

    const enabledBreakpoints = state.functionBreakpoints.filter((bp) => bp.enabled);
    
    try {
      await invoke("debug_set_function_breakpoints", {
        sessionId: state.activeSessionId,
        functionNames: enabledBreakpoints.map((bp) => bp.name),
        conditions: enabledBreakpoints.map((bp) => bp.condition || null),
      });
    } catch (error) {
      console.error("Failed to sync function breakpoints:", error);
    }
  };

  const addFunctionBreakpoint = async (name: string, condition?: string): Promise<void> => {
    if (!name) return;
    
    const existing = state.functionBreakpoints.find(f => f.name === name);
    if (existing) return;

    const newBp: FunctionBreakpoint = {
      name,
      condition,
      enabled: true,
      verified: false,
    };

    setState(produce(s => {
      s.functionBreakpoints.push(newBp);
    }));

    await syncFunctionBreakpoints();
  };

  const removeFunctionBreakpoint = async (name: string): Promise<void> => {
    setState(produce(s => {
      s.functionBreakpoints = s.functionBreakpoints.filter(f => f.name !== name);
    }));

    await syncFunctionBreakpoints();
  };

  const enableFunctionBreakpoint = async (name: string, enabled: boolean): Promise<void> => {
    setState(produce(s => {
      const bp = s.functionBreakpoints.find(f => f.name === name);
      if (bp) bp.enabled = enabled;
    }));

    await syncFunctionBreakpoints();
  };

  const setFunctionBreakpointCondition = async (name: string, condition: string): Promise<void> => {
    setState(produce(s => {
      const bp = s.functionBreakpoints.find(f => f.name === name);
      if (bp) bp.condition = condition || undefined;
    }));

    await syncFunctionBreakpoints();
  };

  // Data breakpoints - internal sync function
  const syncDataBreakpoints = async (): Promise<void> => {
    if (!state.activeSessionId) return;

    const enabledBreakpoints = state.dataBreakpoints.filter((bp) => bp.enabled);
    
    try {
      const result = await invoke<Array<{ id: string; dataId: string; verified: boolean; message?: string }>>(
        "debug_set_data_breakpoints",
        {
          sessionId: state.activeSessionId,
          breakpoints: enabledBreakpoints.map((bp) => ({
            dataId: bp.dataId || bp.variableName,
            accessType: bp.accessType,
            condition: undefined,
            hitCondition: undefined,
          })),
        }
      );

      setState(
        produce((s) => {
          s.dataBreakpoints = s.dataBreakpoints.map((bp) => {
            if (!bp.enabled) return bp;
            const resultBp = result.find((r) => r.dataId === (bp.dataId || bp.variableName));
            return {
              ...bp,
              verified: resultBp?.verified ?? false,
              description: resultBp?.message,
            };
          });
        })
      );
    } catch (error) {
      console.error("Failed to sync data breakpoints:", error);
    }
  };

  const addDataBreakpoint = async (
    variableName: string,
    accessType: DataBreakpointAccessType,
    dataId?: string
  ): Promise<DataBreakpoint | null> => {
    const existingBp = state.dataBreakpoints.find(
      (bp) => bp.variableName === variableName && bp.accessType === accessType
    );
    if (existingBp) {
      return existingBp;
    }

    const newBreakpoint: DataBreakpoint = {
      id: `data-bp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      variableName,
      accessType,
      enabled: true,
      hitCount: 0,
      verified: false,
      dataId: dataId || variableName,
    };

    setState(
      produce((s) => {
        s.dataBreakpoints.push(newBreakpoint);
      })
    );

    await syncDataBreakpoints();

    const updatedBp = state.dataBreakpoints.find((bp) => bp.id === newBreakpoint.id);
    return updatedBp || newBreakpoint;
  };

  const removeDataBreakpoint = async (id: string): Promise<void> => {
    setState(
      produce((s) => {
        s.dataBreakpoints = s.dataBreakpoints.filter((bp) => bp.id !== id);
      })
    );

    await syncDataBreakpoints();
  };

  const enableDataBreakpoint = async (id: string, enabled: boolean): Promise<void> => {
    setState(
      produce((s) => {
        const bp = s.dataBreakpoints.find((b) => b.id === id);
        if (bp) {
          bp.enabled = enabled;
        }
      })
    );

    await syncDataBreakpoints();
  };

  const clearDataBreakpoints = async (): Promise<void> => {
    setState("dataBreakpoints", []);

    if (state.activeSessionId) {
      try {
        await invoke("debug_set_data_breakpoints", {
          sessionId: state.activeSessionId,
          breakpoints: [],
        });
      } catch (error) {
        console.error("Failed to clear data breakpoints:", error);
      }
    }
  };

  // Logpoints
  const addLogpoint = async (
    path: string,
    line: number,
    message: string
  ): Promise<Breakpoint[]> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const existingIndex = existingBreakpoints.findIndex((bp) => bp.line === line);

    let newBreakpoints: BreakpointLocation[];
    if (existingIndex >= 0) {
      // Convert existing breakpoint to logpoint
      newBreakpoints = existingBreakpoints.map((bp, i) =>
        i === existingIndex
          ? {
              path: bp.path,
              line: bp.line,
              logMessage: message,
              enabled: bp.enabled,
            }
          : {
              path: bp.path,
              line: bp.line,
              condition: bp.condition,
              hitCondition: bp.hitCondition,
              logMessage: bp.logMessage,
              enabled: bp.enabled,
            }
      );
    } else {
      // Add new logpoint
      newBreakpoints = [
        ...existingBreakpoints.map((bp) => ({
          path: bp.path,
          line: bp.line,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          enabled: bp.enabled,
        })),
        { path, line, logMessage: message, enabled: true },
      ];
    }

    return setBreakpoints(path, newBreakpoints);
  };

  const setLogpointMessage = async (
    path: string,
    line: number,
    message: string
  ): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      bp.line === line
        ? {
            path: bp.path,
            line: bp.line,
            condition: undefined,
            hitCondition: bp.hitCondition,
            logMessage: message,
            enabled: bp.enabled,
          }
        : {
            path: bp.path,
            line: bp.line,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  const toggleLogpoint = async (path: string, line: number): Promise<Breakpoint[]> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const existingIndex = existingBreakpoints.findIndex(
      (bp) => bp.line === line && bp.logMessage
    );

    let newBreakpoints: BreakpointLocation[];
    if (existingIndex >= 0) {
      // Remove existing logpoint
      newBreakpoints = existingBreakpoints
        .filter((_, i) => i !== existingIndex)
        .map((bp) => ({
          path: bp.path,
          line: bp.line,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          enabled: bp.enabled,
        }));
    } else {
      // Add new logpoint with default message
      newBreakpoints = [
        ...existingBreakpoints.map((bp) => ({
          path: bp.path,
          line: bp.line,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
          enabled: bp.enabled,
        })),
        { path, line, logMessage: "Log: line {line}", enabled: true },
      ];
    }

    return setBreakpoints(path, newBreakpoints);
  };

  const convertToLogpoint = async (
    path: string,
    line: number,
    message: string
  ): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      bp.line === line
        ? {
            path: bp.path,
            line: bp.line,
            condition: undefined,
            hitCondition: bp.hitCondition,
            logMessage: message,
            enabled: bp.enabled,
          }
        : {
            path: bp.path,
            line: bp.line,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  const convertToBreakpoint = async (path: string, line: number): Promise<void> => {
    const existingBreakpoints = state.breakpoints[path] || [];
    const newBreakpoints = existingBreakpoints.map((bp) =>
      bp.line === line
        ? {
            path: bp.path,
            line: bp.line,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: undefined,
            enabled: bp.enabled,
          }
        : {
            path: bp.path,
            line: bp.line,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: bp.enabled,
          }
    );
    await setBreakpoints(path, newBreakpoints);
  };

  /**
   * Evaluates a logpoint message template by replacing {expr} placeholders
   * with their evaluated values. Returns the interpolated string.
   * Example: "Value is {x}" with x=42 returns "Value is 42"
   */
  const evaluateLogpointMessage = async (message: string): Promise<string> => {
    if (!state.activeSessionId) {
      return message;
    }

    // Find all {expression} patterns in the message
    const expressionPattern = /\{([^}]+)\}/g;
    const matches = [...message.matchAll(expressionPattern)];

    if (matches.length === 0) {
      return message;
    }

    let result = message;

    for (const match of matches) {
      const fullMatch = match[0];
      const expression = match[1].trim();

      try {
        const evalResult = await invoke<EvaluateResult>("debug_evaluate", {
          sessionId: state.activeSessionId,
          expression,
          context: "watch",
        });
        result = result.replace(fullMatch, evalResult.result);
      } catch (err) {
        console.debug("Watch expression evaluation failed:", err);
        result = result.replace(fullMatch, `<${expression}: error>`);
      }
    }

    return result;
  };

  // Stack trace
  const selectThread = async (threadId: number): Promise<void> => {
    if (!state.activeSessionId) return;

    try {
      setState("activeThreadId", threadId);
      await invoke("debug_set_active_thread", {
        sessionId: state.activeSessionId,
        threadId,
      });

      const frames = await invoke<StackFrame[]>("debug_get_stack_trace", {
        sessionId: state.activeSessionId,
        threadId,
      });
      setState("stackFrames", frames);
      if (frames.length > 0) {
        setState("activeFrameId", frames[0].id);
      }
    } catch (error) {
      console.error("Debug selectThread failed:", error);
    }
  };

  const selectFrame = async (frameId: number): Promise<void> => {
    if (!state.activeSessionId) return;

    try {
      setState("activeFrameId", frameId);
      await invoke("debug_set_active_frame", {
        sessionId: state.activeSessionId,
        frameId,
      });

      // Refresh variables for the selected frame
      await getVariables();
      await refreshWatches();
    } catch (error) {
      console.error("Debug selectFrame failed:", error);
    }
  };

  // Variables
  const getVariables = async (): Promise<Variable[]> => {
    if (!state.activeSessionId) return [];

    const variables = await invoke<Variable[]>("debug_get_variables", {
      sessionId: state.activeSessionId,
    });
    setState("variables", variables);
    return variables;
  };

  const getScopes = async (): Promise<Scope[]> => {
    if (!state.activeSessionId || state.activeFrameId === null) return [];

    try {
      const scopes = await invoke<Scope[]>("debug_get_scopes", {
        sessionId: state.activeSessionId,
        frameId: state.activeFrameId,
      });
      setState("scopes", scopes);
      return scopes;
    } catch (err) {
      console.debug("Scopes fetch failed (adapter may not support):", err);
      return [];
    }
  };

  const getScopeVariables = async (scopeRef: number): Promise<Variable[]> => {
    if (!state.activeSessionId) return [];

    try {
      const variables = await invoke<Variable[]>("debug_expand_variable", {
        sessionId: state.activeSessionId,
        variablesReference: scopeRef,
      });
      setState(
        produce((s) => {
          s.scopeVariables[scopeRef] = variables;
        })
      );
      return variables;
    } catch (err) {
      console.debug("Variables fetch failed:", err);
      return [];
    }
  };

  const expandVariable = async (variablesReference: number): Promise<Variable[]> => {
    if (!state.activeSessionId) return [];

    return await invoke<Variable[]>("debug_expand_variable", {
      sessionId: state.activeSessionId,
      variablesReference,
    });
  };

  /**
   * Expand a variable with paging support for lazy loading large arrays/collections.
   * @param variablesReference The reference ID of the variable to expand
   * @param start Starting index for paging (0-based)
   * @param count Number of items to fetch
   * @returns Array of child variables
   */
  const expandVariablePaged = async (
    variablesReference: number,
    start?: number,
    count?: number
  ): Promise<Variable[]> => {
    if (!state.activeSessionId) return [];

    return await invoke<Variable[]>("debug_expand_variable_paged", {
      sessionId: state.activeSessionId,
      variablesReference,
      start: start ?? null,
      count: count ?? null,
    });
  };

  const setVariable = async (
    variablesReference: number,
    name: string,
    value: string
  ): Promise<SetVariableResult> => {
    if (!state.activeSessionId) {
      throw new Error("No active debug session");
    }

    const result = await invoke<SetVariableResult>("debug_set_variable", {
      sessionId: state.activeSessionId,
      variablesReference,
      name,
      value,
    });

    // Refresh variables after setting
    await getVariables();

    return result;
  };

  // Watch expressions
  const addWatchExpression = (expression: string): void => {
    const id = `watch-${Date.now()}`;
    setState(
      produce((s) => {
        s.watchExpressions.push({ id, expression });
      })
    );
    if (state.isPaused) {
      evaluateWatch(id);
    }
  };

  const removeWatchExpression = (id: string): void => {
    setState(
      produce((s) => {
        s.watchExpressions = s.watchExpressions.filter((w) => w.id !== id);
      })
    );
  };

  const updateWatchExpression = (id: string, expression: string): void => {
    setState(
      produce((s) => {
        const watch = s.watchExpressions.find((w) => w.id === id);
        if (watch) {
          watch.expression = expression;
          watch.result = undefined;
          watch.error = undefined;
        }
      })
    );
    if (state.isPaused) {
      evaluateWatch(id);
    }
  };

  const evaluateWatch = async (id: string): Promise<void> => {
    if (!state.activeSessionId) return;

    const watch = state.watchExpressions.find((w) => w.id === id);
    if (!watch) return;

    try {
      const result = await invoke<EvaluateResult>("debug_evaluate", {
        sessionId: state.activeSessionId,
        expression: watch.expression,
        context: "watch",
      });
      setState(
        produce((s) => {
          const w = s.watchExpressions.find((we) => we.id === id);
          if (w) {
            w.result = result.result;
            w.type = result.type;
            w.error = undefined;
          }
        })
      );
    } catch (e) {
      setState(
        produce((s) => {
          const w = s.watchExpressions.find((we) => we.id === id);
          if (w) {
            w.error = String(e);
            w.result = undefined;
          }
        })
      );
    }
  };

  const refreshWatches = async (): Promise<void> => {
    for (const watch of state.watchExpressions) {
      await evaluateWatch(watch.id);
    }
  };

  // Evaluate
  const evaluate = async (expression: string, context?: string): Promise<EvaluateResult> => {
    if (!state.activeSessionId) {
      throw new Error("No active debug session");
    }
    return await invoke<EvaluateResult>("debug_evaluate", {
      sessionId: state.activeSessionId,
      expression,
      context: context || "repl",
    });
  };

  /**
   * Evaluates an expression at a given position for debug hover.
   * Uses LSP's evaluatableExpression if available, otherwise falls back to word-at-cursor heuristic.
   */
  const evaluateForHover = async (
    uri: string,
    line: number,
    character: number,
    getEvaluatableExpression?: (uri: string, line: number, character: number) => Promise<{
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      expression?: string;
    } | null>,
    getTextAtRange?: (startLine: number, startChar: number, endLine: number, endChar: number) => string
  ): Promise<DebugHoverResult | null> => {
    if (!state.activeSessionId || !state.isPaused) {
      return null;
    }

    let expression: string | undefined;
    let range: { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;

    // Try to get evaluatable expression from LSP first
    if (getEvaluatableExpression) {
      try {
        const evalExpr = await getEvaluatableExpression(uri, line, character);
        if (evalExpr) {
          range = evalExpr.range;
          // If LSP provides the expression directly, use it
          if (evalExpr.expression) {
            expression = evalExpr.expression;
          } else if (getTextAtRange && range) {
            // Otherwise, get the text at the range
            expression = getTextAtRange(
              range.start.line,
              range.start.character,
              range.end.line,
              range.end.character
            );
          }
        }
      } catch (e) {
        // LSP evaluatable expression failed, will fall back to word-at-cursor
        console.debug("LSP evaluatableExpression failed:", e);
      }
    }

    // If no expression from LSP, we can't evaluate without the text
    if (!expression) {
      return null;
    }

    // Skip common keywords and non-evaluatable expressions
    const skipPatterns = [
      /^(if|else|for|while|do|switch|case|break|continue|return|throw|try|catch|finally)$/,
      /^(const|let|var|function|class|interface|type|enum|import|export|from|as)$/,
      /^(true|false|null|undefined|NaN|Infinity)$/,
      /^[0-9]+(\.[0-9]+)?$/, // Numbers
      /^["'`]/, // String literals
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(expression)) {
        return null;
      }
    }

    try {
      const result = await invoke<EvaluateResult>("debug_evaluate", {
        sessionId: state.activeSessionId,
        expression,
        context: "hover",
      });

      return {
        expression,
        result: result.result,
        type: result.type,
        variablesReference: result.variablesReference,
        range: range ? {
          startLine: range.start.line,
          startCharacter: range.start.character,
          endLine: range.end.line,
          endCharacter: range.end.character,
        } : undefined,
      };
    } catch (e) {
      // Evaluation failed (e.g., expression not in scope)
      console.debug("Debug hover evaluation failed:", e);
      return null;
    }
  };

  // Output
  const clearOutput = (): void => {
    setState("output", []);
  };

  // ============== Inline Values ==============
  
  /** Maximum length for truncated inline values */
  const INLINE_VALUE_MAX_LENGTH = 50;

  /**
   * Truncates a value string for inline display.
   * Long values are truncated with ellipsis.
   */
  const truncateValue = (value: string): string => {
    if (value.length <= INLINE_VALUE_MAX_LENGTH) {
      return value;
    }
    return value.substring(0, INLINE_VALUE_MAX_LENGTH - 3) + "...";
  };

  /**
   * Enables or disables inline values display.
   */
  const setInlineValuesEnabled = (enabled: boolean): void => {
    setState("inlineValuesEnabled", enabled);
    if (!enabled) {
      setState("inlineValues", {});
    } else if (state.isPaused) {
      refreshInlineValues();
    }
  };

  /**
   * Gets inline values for a specific file path.
   */
  const getInlineValuesForFile = (path: string): InlineValueInfo[] => {
    return state.inlineValues[path] || [];
  };

  /**
   * Refreshes inline values based on current debug state.
   * Parses variables and maps them to line numbers when possible.
   */
  const refreshInlineValues = async (): Promise<void> => {
    if (!state.inlineValuesEnabled || !state.isPaused || !state.currentFile) {
      setState("inlineValues", {});
      return;
    }

    const currentPath = state.currentFile;
    const currentLine = state.currentLine;
    if (!currentPath || currentLine === null) {
      setState("inlineValues", {});
      return;
    }

    // Build inline values from variables
    const inlineValuesMap: InlineValueInfo[] = [];
    const variables = state.variables;

    // For each variable, create an inline value entry
    for (const variable of variables) {
      // Skip variables with empty names or complex types without useful display
      if (!variable.name || variable.name.startsWith("__")) {
        continue;
      }

      const inlineValue: InlineValueInfo = {
        name: variable.name,
        value: truncateValue(variable.value),
        type: variable.type,
        line: currentLine,
        fullValue: variable.value,
        variablesReference: variable.variablesReference > 0 ? variable.variablesReference : undefined,
      };

      inlineValuesMap.push(inlineValue);
    }

    // Also get scope variables if available
    for (const scope of state.scopes) {
      if (scope.presentationHint === "locals" || scope.presentationHint === "arguments") {
        const scopeVars = state.scopeVariables[scope.variablesReference] || [];
        for (const variable of scopeVars) {
          // Avoid duplicates
          if (inlineValuesMap.some(v => v.name === variable.name)) {
            continue;
          }
          if (!variable.name || variable.name.startsWith("__")) {
            continue;
          }

          const inlineValue: InlineValueInfo = {
            name: variable.name,
            value: truncateValue(variable.value),
            type: variable.type,
            line: currentLine,
            fullValue: variable.value,
            variablesReference: variable.variablesReference > 0 ? variable.variablesReference : undefined,
          };

          inlineValuesMap.push(inlineValue);
        }
      }
    }

    setState(
      produce((s) => {
        s.inlineValues[currentPath] = inlineValuesMap;
      })
    );

    // Dispatch event for CodeEditor to update decorations
    window.dispatchEvent(new CustomEvent("debug:inlineValuesUpdated", {
      detail: {
        path: currentPath,
        values: inlineValuesMap,
      }
    }));
  };

  // ============== Compound Configurations ==============

  /**
   * Launches all configurations in a compound simultaneously.
   * Runs preLaunchTask first if specified, then starts all sessions in parallel.
   */
  const launchCompound = async (name: string): Promise<DebugSessionInfo[]> => {
    const compound = state.compounds.find((c) => c.name === name);
    if (!compound) {
      throw new Error(`Compound configuration "${name}" not found`);
    }

    // Run pre-launch task if specified
    if (compound.preLaunchTask) {
      try {
        await invoke("tasks_run_task", { taskName: compound.preLaunchTask });
      } catch (e) {
        console.warn(`Pre-launch task "${compound.preLaunchTask}" failed:`, e);
      }
    }

    // Clear output for fresh compound launch
    setState("output", []);

    // Find all configurations to launch
    const configsToLaunch = compound.configurations
      .map((configName) => state.savedConfigurations.find((c) => c.name === configName))
      .filter((c): c is SavedLaunchConfig => c !== undefined);

    if (configsToLaunch.length === 0) {
      throw new Error(`No valid configurations found in compound "${name}"`);
    }

    // Set compound as active before launching
    setState(
      produce((s) => {
        s.activeCompoundName = name;
        s.compoundSessionIds = [];
      })
    );

    // Launch all configurations simultaneously
    const launchPromises = configsToLaunch.map(async (config) => {
      const sessionConfig: DebugSessionConfig = {
        ...config,
        id: `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      const session = await invoke<DebugSessionInfo>("debug_start_session", { config: sessionConfig });
      setState(
        produce((s) => {
          s.sessions.push(session);
          s.compoundSessionIds.push(session.id);
          if (!s.activeSessionId) {
            s.activeSessionId = session.id;
          }
          s.isDebugging = true;
          s.isPaused = false;
        })
      );
      return session;
    });

    const sessions = await Promise.all(launchPromises);
    return sessions;
  };

  /**
   * Stops all sessions in the active compound.
   */
  const stopCompound = async (): Promise<void> => {
    if (!state.activeCompoundName || state.compoundSessionIds.length === 0) return;

    // Get the compound configuration for postDebugTask
    const compound = state.compounds.find((c) => c.name === state.activeCompoundName);

    // Stop all sessions in the compound
    for (const sessionId of [...state.compoundSessionIds]) {
      try {
        await invoke("debug_stop_session", { sessionId, terminateDebuggee: true });
      } catch (err) {
        console.debug("Stop session failed (may already be stopped):", err);
      }
    }

    // Execute postDebugTask if configured
    if (compound?.postDebugTask) {
      try {
        await invoke("tasks_run_task", { taskName: compound.postDebugTask });
      } catch (e) {
        console.warn(`Post-debug task "${compound.postDebugTask}" failed:`, e);
      }
    }

    setState(
      produce((s) => {
        // Clean up session configs for compound sessions
        for (const sessionId of s.compoundSessionIds) {
          delete s.sessionConfigs[sessionId];
        }
        s.sessions = s.sessions.filter((sess) => !s.compoundSessionIds.includes(sess.id));
        s.compoundSessionIds = [];
        s.activeCompoundName = null;
        s.activeSessionId = s.sessions[0]?.id || null;
        s.isDebugging = s.sessions.length > 0;
        s.isPaused = false;
        s.threads = [];
        s.stackFrames = [];
        s.variables = [];
      })
    );
  };

  /**
   * Adds or updates a compound configuration.
   */
  const addCompound = (compound: CompoundConfig): void => {
    setState(
      produce((s) => {
        const existingIndex = s.compounds.findIndex((c) => c.name === compound.name);
        if (existingIndex >= 0) {
          s.compounds[existingIndex] = compound;
        } else {
          s.compounds.push(compound);
        }
      })
    );
  };

  /**
   * Removes a compound configuration by name.
   */
  const removeCompound = (name: string): void => {
    setState(
      produce((s) => {
        s.compounds = s.compounds.filter((c) => c.name !== name);
      })
    );
  };

  /**
   * Updates an existing compound configuration.
   */
  const updateCompound = (name: string, compound: CompoundConfig): void => {
    setState(
      produce((s) => {
        const index = s.compounds.findIndex((c) => c.name === name);
        if (index >= 0) {
          s.compounds[index] = compound;
        }
      })
    );
  };

  /**
   * Returns all compound configurations.
   */
  const getCompounds = (): CompoundConfig[] => {
    return state.compounds;
  };

  /**
   * Adds or updates a saved launch configuration.
   */
  const addSavedConfiguration = (config: SavedLaunchConfig): void => {
    setState(
      produce((s) => {
        const existingIndex = s.savedConfigurations.findIndex((c) => c.name === config.name);
        if (existingIndex >= 0) {
          s.savedConfigurations[existingIndex] = config;
        } else {
          s.savedConfigurations.push(config);
        }
      })
    );
  };

  /**
   * Removes a saved launch configuration by name.
   */
  const removeSavedConfiguration = (name: string): void => {
    setState(
      produce((s) => {
        s.savedConfigurations = s.savedConfigurations.filter((c) => c.name !== name);
      })
    );
  };

  /**
   * Returns all saved launch configurations.
   */
  const getSavedConfigurations = (): SavedLaunchConfig[] => {
    return state.savedConfigurations;
  };

  // ============== Breakpoint Groups ==============

  /**
   * Creates a new breakpoint group with the given name.
   */
  const createBreakpointGroup = (name: string): BreakpointGroup => {
    const newGroup: BreakpointGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      breakpointIds: [],
      enabled: true,
    };

    setState(
      produce((s) => {
        s.breakpointGroups.push(newGroup);
      })
    );

    // Persist to localStorage
    saveBreakpointGroups([...state.breakpointGroups, newGroup]);

    return newGroup;
  };

  /**
   * Deletes a breakpoint group by ID.
   */
  const deleteBreakpointGroup = (groupId: string): void => {
    setState(
      produce((s) => {
        s.breakpointGroups = s.breakpointGroups.filter((g) => g.id !== groupId);
      })
    );

    // Persist to localStorage
    saveBreakpointGroups(state.breakpointGroups.filter((g) => g.id !== groupId));
  };

  /**
   * Renames a breakpoint group.
   */
  const renameBreakpointGroup = (groupId: string, newName: string): void => {
    setState(
      produce((s) => {
        const group = s.breakpointGroups.find((g) => g.id === groupId);
        if (group) {
          group.name = newName;
        }
      })
    );

    // Persist to localStorage
    saveBreakpointGroups(state.breakpointGroups);
  };

  /**
   * Adds a breakpoint to a group.
   */
  const addBreakpointToGroup = (groupId: string, breakpointId: BreakpointId): void => {
    setState(
      produce((s) => {
        const group = s.breakpointGroups.find((g) => g.id === groupId);
        if (group && !group.breakpointIds.includes(breakpointId)) {
          group.breakpointIds.push(breakpointId);
        }
      })
    );

    // Persist to localStorage
    saveBreakpointGroups(state.breakpointGroups);
  };

  /**
   * Removes a breakpoint from a group.
   */
  const removeBreakpointFromGroup = (groupId: string, breakpointId: BreakpointId): void => {
    setState(
      produce((s) => {
        const group = s.breakpointGroups.find((g) => g.id === groupId);
        if (group) {
          group.breakpointIds = group.breakpointIds.filter((id) => id !== breakpointId);
        }
      })
    );

    // Persist to localStorage
    saveBreakpointGroups(state.breakpointGroups);
  };

  /**
   * Toggles a breakpoint group's enabled state.
   * When enabled is undefined, it toggles the current state.
   * This also enables/disables all breakpoints in the group.
   */
  const toggleBreakpointGroup = async (groupId: string, enabled?: boolean): Promise<void> => {
    const group = state.breakpointGroups.find((g) => g.id === groupId);
    if (!group) return;

    const newEnabled = enabled !== undefined ? enabled : !group.enabled;

    // Update the group's enabled state
    setState(
      produce((s) => {
        const g = s.breakpointGroups.find((grp) => grp.id === groupId);
        if (g) {
          g.enabled = newEnabled;
        }
      })
    );

    // Enable/disable all breakpoints in the group
    for (const breakpointId of group.breakpointIds) {
      const { path, line, column } = parseBreakpointId(breakpointId);
      try {
        await enableBreakpoint(path, line, newEnabled, column);
      } catch (e) {
        console.warn(`Failed to ${newEnabled ? "enable" : "disable"} breakpoint ${breakpointId}:`, e);
      }
    }

    // Persist to localStorage
    saveBreakpointGroups(state.breakpointGroups);
  };

  /**
   * Returns all breakpoint groups.
   */
  const getBreakpointGroups = (): BreakpointGroup[] => {
    return state.breakpointGroups;
  };

  /**
   * Returns all groups that contain a specific breakpoint.
   */
  const getGroupsForBreakpoint = (breakpointId: BreakpointId): BreakpointGroup[] => {
    return state.breakpointGroups.filter((g) => g.breakpointIds.includes(breakpointId));
  };

  // ============== Step Into Targets ==============

  /**
   * Gets available step-in targets for the current stack frame.
   * Used when multiple function calls exist on the same line.
   * DAP request: stepInTargets
   * Requires capabilities.supportsStepInTargetsRequest
   */
  const getStepInTargets = async (frameId: number): Promise<StepInTarget[]> => {
    if (!state.activeSessionId) {
      return [];
    }

    if (!state.capabilities?.supportsStepInTargetsRequest) {
      console.warn("Debug adapter does not support stepInTargets request");
      return [];
    }

    try {
      const targets = await invoke<StepInTarget[]>("debug_get_step_in_targets", {
        sessionId: state.activeSessionId,
        frameId,
      });
      return targets;
    } catch (error) {
      console.error("Failed to get step-in targets:", error);
      return [];
    }
  };

  /**
   * Steps into a specific target (function) on the current line.
   * DAP request: stepIn with targetId
   */
  const stepIntoTarget = async (targetId: number): Promise<void> => {
    if (!state.activeSessionId) return;

    try {
      await invoke("debug_step_into_target", {
        sessionId: state.activeSessionId,
        targetId,
      });
      setState("isPaused", false);
    } catch (error) {
      console.error("Failed to step into target:", error);
    }
  };

  // ============== Restart Frame ==============

  /**
   * Restarts execution from a specific stack frame.
   * DAP request: restartFrame
   * Requires capabilities.supportsRestartFrame
   */
  const restartFrame = async (frameId: number): Promise<void> => {
    if (!state.activeSessionId) return;

    if (!state.capabilities?.supportsRestartFrame) {
      console.warn("Debug adapter does not support restartFrame request");
      return;
    }

    try {
      await invoke("debug_restart_frame", {
        sessionId: state.activeSessionId,
        frameId,
      });
      // The debug adapter will send new stopped event after restart
    } catch (error) {
      console.error("Failed to restart frame:", error);
    }
  };

  // ============== Jump to Cursor (Goto Targets) ==============

  /**
   * Gets available goto targets for a specific location.
   * Used for "Jump to Cursor" / "Set Next Statement" functionality.
   * DAP request: gotoTargets
   * Requires capabilities.supportsGotoTargetsRequest
   */
  const getGotoTargets = async (uri: string, line: number): Promise<GotoTarget[]> => {
    if (!state.activeSessionId) {
      return [];
    }

    if (!state.capabilities?.supportsGotoTargetsRequest) {
      console.warn("Debug adapter does not support gotoTargets request");
      return [];
    }

    try {
      const targets = await invoke<GotoTarget[]>("debug_get_goto_targets", {
        sessionId: state.activeSessionId,
        sourcePath: uri,
        line,
      });
      return targets;
    } catch (error) {
      console.error("Failed to get goto targets:", error);
      return [];
    }
  };

  /**
   * Jumps execution to a specific goto target.
   * Moves the instruction pointer without executing intermediate code.
   * DAP request: goto
   */
  const jumpToLocation = async (targetId: number): Promise<void> => {
    if (!state.activeSessionId) return;

    if (!state.capabilities?.supportsGotoTargetsRequest) {
      console.warn("Debug adapter does not support goto request");
      return;
    }

    try {
      await invoke("debug_goto", {
        sessionId: state.activeSessionId,
        targetId,
        threadId: state.activeThreadId,
      });
      // The debug adapter will send new stopped event after goto
    } catch (error) {
      console.error("Failed to jump to location:", error);
    }
  };

  // ============== Debug Hover State ==============

  /**
   * Gets the current debug hover state.
   */
  const getDebugHoverState = (): DebugHoverState | null => {
    return state.debugHoverState;
  };

  /**
   * Sets the debug hover state for tooltip display.
   */
  const setDebugHoverState = (hoverState: DebugHoverState | null): void => {
    setState("debugHoverState", hoverState);
  };

  /**
   * Expands the debug hover to show children variables.
   */
  const expandDebugHover = async (): Promise<void> => {
    const hoverState = state.debugHoverState;
    if (!hoverState || hoverState.result.variablesReference === 0) {
      return;
    }

    try {
      const children = await expandVariable(hoverState.result.variablesReference);
      setState(
        produce((s) => {
          if (s.debugHoverState) {
            s.debugHoverState.expanded = true;
            s.debugHoverState.children = children.map((v) => ({
              name: v.name,
              value: v.value,
              type: v.type,
              variablesReference: v.variablesReference,
            }));
          }
        })
      );
    } catch (e) {
      console.error("Failed to expand debug hover:", e);
    }
  };

  /**
   * Collapses the debug hover.
   */
  const collapseDebugHover = (): void => {
    setState(
      produce((s) => {
        if (s.debugHoverState) {
          s.debugHoverState.expanded = false;
          s.debugHoverState.children = [];
        }
      })
    );
  };

  // ============== Inline Values State ==============

  /**
   * Gets the inline values state.
   */
  const getInlineValuesState = (): InlineValueState => {
    return state.inlineValuesState;
  };

  /**
   * Sets the inline values state.
   */
  const setInlineValuesState = (newState: Partial<InlineValueState>): void => {
    setState(
      produce((s) => {
        s.inlineValuesState = { ...s.inlineValuesState, ...newState };
      })
    );
  };

  // ============== Exception Widget ==============

  /**
   * Gets the exception widget state.
   */
  const getExceptionWidgetState = (): ExceptionWidgetState => {
    return state.exceptionWidgetState;
  };

  /**
   * Shows the exception widget with the given exception info.
   */
  const showExceptionWidget = (exception: ExceptionInfo, line: number, column?: number): void => {
    setState(
      produce((s) => {
        s.exceptionWidgetState = {
          visible: true,
          exception,
          position: { line, column },
        };
      })
    );
  };

  /**
   * Hides the exception widget.
   */
  const hideExceptionWidget = (): void => {
    setState(
      produce((s) => {
        s.exceptionWidgetState = {
          visible: false,
          exception: null,
          position: { line: 1 },
        };
      })
    );
  };

  // ============== Breakpoint Activation ==============

  /**
   * Gets the global breakpoint activation state.
   */
  const getBreakpointActivation = (): BreakpointActivation => {
    return state.breakpointActivation;
  };

  /**
   * Sets the global breakpoint activation state.
   * When disabled, all breakpoints are effectively ignored without removing them.
   */
  const setBreakpointActivation = async (enabled: boolean): Promise<void> => {
    setState("breakpointActivation", { globalEnabled: enabled });
    
    // Persist to localStorage
    try {
      localStorage.setItem(BREAKPOINT_ACTIVATION_KEY, JSON.stringify({ globalEnabled: enabled }));
    } catch (e) {
      console.warn("Failed to save breakpoint activation:", e);
    }

    // Re-sync all breakpoints with the debug adapter
    if (state.activeSessionId) {
      for (const [path, breakpoints] of Object.entries(state.breakpoints)) {
        if (enabled) {
          // Re-enable: send enabled breakpoints to adapter
          const enabledBps = breakpoints.filter((bp) => bp.enabled).map((bp) => ({
            path: bp.path,
            line: bp.line,
            column: bp.column,
            condition: bp.condition,
            hitCondition: bp.hitCondition,
            logMessage: bp.logMessage,
            enabled: true,
          }));
          try {
            await invoke("debug_set_breakpoints", {
              sessionId: state.activeSessionId,
              path,
              breakpoints: enabledBps,
            });
          } catch (e) {
            console.warn(`Failed to re-enable breakpoints for ${path}:`, e);
          }
        } else {
          // Disable: send empty breakpoints to adapter (keeps them in local state)
          try {
            await invoke("debug_set_breakpoints", {
              sessionId: state.activeSessionId,
              path,
              breakpoints: [],
            });
          } catch (e) {
            console.warn(`Failed to disable breakpoints for ${path}:`, e);
          }
        }
      }
    }
  };

  /**
   * Toggles the global breakpoint activation state.
   */
  const toggleBreakpointActivation = async (): Promise<void> => {
    await setBreakpointActivation(!state.breakpointActivation.globalEnabled);
  };

  // ============== Session Picker ==============

  /**
   * Gets the session picker state.
   */
  const getSessionPickerState = (): SessionPickerState => {
    return state.sessionPickerState;
  };

  /**
   * Shows the session picker UI.
   */
  const showSessionPicker = (): void => {
    setState(
      produce((s) => {
        s.sessionPickerState.visible = true;
        s.sessionPickerState.sessions = [...s.sessions];
        s.sessionPickerState.activeSession = s.sessions.find((sess) => sess.id === s.activeSessionId) || null;
      })
    );
  };

  /**
   * Hides the session picker UI.
   */
  const hideSessionPicker = (): void => {
    setState(
      produce((s) => {
        s.sessionPickerState.visible = false;
      })
    );
  };

  /**
   * Selects a session from the picker and switches to it.
   */
  const selectSessionFromPicker = (sessionId: string): void => {
    setActiveSession(sessionId);
    hideSessionPicker();
  };

  // ============== Debug Console Settings ==============

  /**
   * Gets the debug console settings.
   */
  const getDebugConsoleSettings = (): DebugConsoleSettings => {
    return state.debugConsoleSettings;
  };

  /**
   * Updates the debug console settings.
   */
  const setDebugConsoleSettings = (settings: Partial<DebugConsoleSettings>): void => {
    setState(
      produce((s) => {
        s.debugConsoleSettings = { ...s.debugConsoleSettings, ...settings };
      })
    );

    // Persist to localStorage
    try {
      localStorage.setItem(DEBUG_CONSOLE_SETTINGS_KEY, JSON.stringify(state.debugConsoleSettings));
    } catch (e) {
      console.warn("Failed to save debug console settings:", e);
    }
  };

  // ============== Toolbar Location ==============

  /**
   * Gets the debug toolbar location.
   */
  const getToolbarLocation = (): DebugToolbarLocation => {
    return state.toolbarLocation;
  };

  /**
   * Sets the debug toolbar location.
   */
  const setToolbarLocation = (location: DebugToolbarLocation): void => {
    setState("toolbarLocation", location);

    // Persist to localStorage
    try {
      localStorage.setItem(DEBUG_TOOLBAR_LOCATION_KEY, location);
    } catch (e) {
      console.warn("Failed to save toolbar location:", e);
    }
  };

  // ============== Debug Behavior Settings ==============

  /**
   * Gets the debug behavior settings.
   */
  const getDebugBehaviorSettings = (): DebugBehaviorSettings => {
    return state.debugBehaviorSettings;
  };

  /**
   * Updates the debug behavior settings.
   */
  const setDebugBehaviorSettings = (settings: Partial<DebugBehaviorSettings>): void => {
    setState(
      produce((s) => {
        s.debugBehaviorSettings = { ...s.debugBehaviorSettings, ...settings };
      })
    );

    // Persist to localStorage
    try {
      localStorage.setItem(DEBUG_BEHAVIOR_SETTINGS_KEY, JSON.stringify(state.debugBehaviorSettings));
    } catch (e) {
      console.warn("Failed to save debug behavior settings:", e);
    }
  };

  // ============== Event Subscriptions ==============

  /**
   * Registers a callback for session start events.
   * Returns an unsubscribe function.
   */
  const onDidStartSession = (callback: OnDidStartSessionCallback): (() => void) => {
    onStartSessionCallbacks.add(callback);
    return () => {
      onStartSessionCallbacks.delete(callback);
    };
  };

  /**
   * Registers a callback for session stop events.
   * Returns an unsubscribe function.
   */
  const onDidStopSession = (callback: OnDidStopSessionCallback): (() => void) => {
    onStopSessionCallbacks.add(callback);
    return () => {
      onStopSessionCallbacks.delete(callback);
    };
  };

  /**
   * Registers a callback for breakpoint change events.
   * Returns an unsubscribe function.
   */
  const onDidChangeBreakpoints = (callback: OnDidChangeBreakpointsCallback): (() => void) => {
    onChangeBreakpointsCallbacks.add(callback);
    return () => {
      onChangeBreakpointsCallbacks.delete(callback);
    };
  };

  return (
    <DebugContext.Provider
      value={{
        state,
        startSession,
        stopSession,
        restartSession,
        hotReload,
        getActiveSession,
        getSessions,
        setActiveSession,
        pauseAll,
        continueAll,
        stopAll,
        restartAll,
        continue_,
        pause,
        stepOver,
        stepInto,
        stepOut,
        stepBack,
        reverseContinue,
        runToCursor,
        setBreakpoints,
        toggleBreakpoint,
        removeBreakpoint,
        getBreakpointsForFile,
        setBreakpointCondition,
        setBreakpointHitCondition,
        enableBreakpoint,
        removeAllBreakpoints,
        addFunctionBreakpoint,
        removeFunctionBreakpoint,
        enableFunctionBreakpoint,
        setFunctionBreakpointCondition,
        addDataBreakpoint,
        removeDataBreakpoint,
        enableDataBreakpoint,
        clearDataBreakpoints,
        addLogpoint,
        setLogpointMessage,
        toggleLogpoint,
        convertToLogpoint,
        convertToBreakpoint,
        evaluateLogpointMessage,
        selectThread,
        selectFrame,
        getVariables,
        getScopes,
        getScopeVariables,
        expandVariable,
        expandVariablePaged,
        setVariable,
        addWatchExpression,
        removeWatchExpression,
        updateWatchExpression,
        evaluateWatch,
        refreshWatches,
        evaluate,
        evaluateForHover,
        clearOutput,
        setInlineValuesEnabled,
        getInlineValuesForFile,
        refreshInlineValues,
        launchCompound,
        stopCompound,
        addCompound,
        removeCompound,
        updateCompound,
        getCompounds,
        addSavedConfiguration,
        removeSavedConfiguration,
        getSavedConfigurations,
        setExceptionBreakpoint: async (filter: string, enabled: boolean, condition?: string) => {
          setState(
            produce((s) => {
              const eb = s.exceptionBreakpoints.find((e) => e.filter === filter);
              if (eb) {
                eb.enabled = enabled;
                if (condition !== undefined) {
                  eb.condition = condition;
                }
              }
            })
          );
          
          // Persist settings and sync with adapter
          persistExceptionBreakpointSettings();
          await syncExceptionBreakpointsWithAdapter();
        },
        setExceptionBreakpointCondition: async (filter: string, condition: string) => {
          setState(
            produce((s) => {
              const eb = s.exceptionBreakpoints.find((e) => e.filter === filter);
              if (eb && eb.supportsCondition) {
                eb.condition = condition || undefined;
              }
            })
          );
          
          // Persist settings and sync with adapter
          persistExceptionBreakpointSettings();
          await syncExceptionBreakpointsWithAdapter();
        },
        getExceptionBreakpoints: () => {
          return state.exceptionBreakpoints;
        },
        getExceptionBreakpointFilters: () => {
          return state.exceptionBreakpointFilters;
        },
        // Breakpoint groups
        createBreakpointGroup,
        deleteBreakpointGroup,
        renameBreakpointGroup,
        addBreakpointToGroup,
        removeBreakpointFromGroup,
        toggleBreakpointGroup,
        getBreakpointGroups,
        getGroupsForBreakpoint,
        // Triggered/Dependent breakpoints
        setBreakpointTriggeredBy,
        getAllBreakpointsFlat,
        getBreakpointId,
        // Step Into Targets
        getStepInTargets,
        stepIntoTarget,
        // Restart Frame
        restartFrame,
        // Jump to Cursor (Goto Targets)
        getGotoTargets,
        jumpToLocation,
        // Debug Hover State
        getDebugHoverState,
        setDebugHoverState,
        expandDebugHover,
        collapseDebugHover,
        // Inline Values State
        getInlineValuesState,
        setInlineValuesState,
        // Exception Widget
        getExceptionWidgetState,
        showExceptionWidget,
        hideExceptionWidget,
        // Breakpoint Activation
        getBreakpointActivation,
        setBreakpointActivation,
        toggleBreakpointActivation,
        // Session Picker
        getSessionPickerState,
        showSessionPicker,
        hideSessionPicker,
        selectSessionFromPicker,
        // Debug Console Settings
        getDebugConsoleSettings,
        setDebugConsoleSettings,
        // Toolbar Location
        getToolbarLocation,
        setToolbarLocation,
        // Debug Behavior Settings
        getDebugBehaviorSettings,
        setDebugBehaviorSettings,
        // Event Subscriptions
        onDidStartSession,
        onDidStopSession,
        onDidChangeBreakpoints,
      }}
    >
      {props.children}
    </DebugContext.Provider>
  );
};

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error("useDebug must be used within DebugProvider");
  }
  return context;
}

// Re-export types from debug.ts for convenience
export type {
  DebugHoverState,
  DebugHoverChildVariable,
  InlineValueState,
  InlineValue,
  ExceptionWidgetState,
  ExceptionInfo,
  BreakpointActivation,
  DebugConsoleSettings,
  DebugToolbarLocation,
  DebugToolbarConfig,
} from "../types/debug";

// Export our local SessionPickerState type
export type { SessionPickerState };

// Note: OnDidStartSessionCallback, OnDidStopSessionCallback, OnDidChangeBreakpointsCallback
// are already exported at their definitions (lines 440, 443, 446)

// Note: DebugBehaviorSettings is already exported at its definition (line 455)
// Note: DEFAULT_DEBUG_BEHAVIOR_SETTINGS is already exported at its definition (line 466)

export { DEFAULT_DEBUG_CONSOLE_SETTINGS } from "../types/debug";
