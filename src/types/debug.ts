/**
 * Debug Types
 *
 * Centralized type definitions for debug-related functionality.
 * These types are used for debug hover, inline values, exception widgets,
 * breakpoint modes, instruction breakpoints, session management, and debug console settings.
 */

// ============================================================================
// Range Types
// ============================================================================

/**
 * Represents a range in a document (0-based line/character positions).
 */
export interface DocumentRange {
  /** Start line (0-based) */
  startLine: number;
  /** Start character/column (0-based) */
  startCharacter: number;
  /** End line (0-based) */
  endLine: number;
  /** End character/column (0-based) */
  endCharacter: number;
}

// ============================================================================
// Debug Hover Types
// ============================================================================

/**
 * Result of evaluating an expression for debug hover.
 * Contains the evaluated value along with type information and expandability.
 */
export interface DebugHoverResult {
  /** The string representation of the evaluated value */
  value: string;
  /** The type of the result if available (e.g., "number", "string", "object") */
  type?: string;
  /** Reference for expanding complex variables (non-zero means expandable) */
  variablesReference: number;
  /** Number of named child variables (for objects) */
  namedVariables?: number;
  /** Number of indexed child variables (for arrays) */
  indexedVariables?: number;
}

/**
 * State for debug hover tooltip in the editor.
 * Tracks the hovered expression and its evaluation result.
 */
export interface DebugHoverState {
  /** The expression being hovered (e.g., "myVariable", "obj.property") */
  expression: string;
  /** The evaluation result for the expression */
  result: DebugHoverResult;
  /** The range of the expression in the document */
  range: DocumentRange;
  /** Whether the hover tooltip is expanded to show children */
  expanded: boolean;
  /** Child variables when expanded (for objects/arrays) */
  children: DebugHoverChildVariable[];
}

/**
 * Child variable displayed in expanded debug hover.
 */
export interface DebugHoverChildVariable {
  /** Variable name */
  name: string;
  /** Variable value as string */
  value: string;
  /** Variable type */
  type?: string;
  /** Reference for further expansion */
  variablesReference: number;
}

// ============================================================================
// Inline Value Types
// ============================================================================

/**
 * Type of inline value displayed in the editor.
 */
export type InlineValueType = "variable" | "expression";

/**
 * An inline value to display in the editor during debugging.
 * Shows variable values directly in the code at the relevant location.
 */
export interface InlineValue {
  /** Range where the inline value should be displayed */
  range: DocumentRange;
  /** Text to display (the evaluated value) */
  text: string;
  /** Type of inline value */
  type: InlineValueType;
}

/**
 * State for inline values display in the editor.
 */
export interface InlineValueState {
  /** Whether inline values display is enabled */
  enabled: boolean;
  /** Current inline values to display */
  values: InlineValue[];
}

// ============================================================================
// Exception Widget Types
// ============================================================================

/**
 * Detailed information about an exception.
 * Based on DAP ExceptionDetails but simplified for UI display.
 */
export interface ExceptionInfo {
  /** Exception identifier or class name */
  id: string;
  /** Human-readable description of the exception */
  description: string;
  /** How the debugger should handle this exception */
  breakMode: ExceptionBreakMode;
  /** Additional details about the exception */
  details?: ExceptionDetails;
}

/**
 * How the debugger handles exceptions.
 */
export type ExceptionBreakMode =
  | "never"        // Never break on this exception
  | "always"       // Always break when this exception is thrown
  | "unhandled"    // Break only on unhandled exceptions
  | "userUnhandled"; // Break on user-unhandled exceptions

/**
 * Additional exception details from the debug adapter.
 */
export interface ExceptionDetails {
  /** Message contained in the exception */
  message?: string;
  /** Type name of the exception */
  typeName?: string;
  /** Fully qualified type name */
  fullTypeName?: string;
  /** Stack trace as a string */
  stackTrace?: string;
  /** Inner exception details */
  innerException?: ExceptionDetails[];
  /** Evaluate name for expression evaluation */
  evaluateName?: string;
}

/**
 * State for the exception widget displayed when an exception is caught.
 */
export interface ExceptionWidgetState {
  /** Whether the exception widget is visible */
  visible: boolean;
  /** Exception information to display */
  exception: ExceptionInfo | null;
  /** Position where the widget should be displayed */
  position: ExceptionWidgetPosition;
}

/**
 * Position for the exception widget in the editor.
 */
export interface ExceptionWidgetPosition {
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based, optional) */
  column?: number;
}

// ============================================================================
// Breakpoint Mode Types
// ============================================================================

/**
 * Breakpoint mode configuration.
 * Defines different modes for breakpoints (e.g., "Always", "When hit count", "Log message").
 */
export interface BreakpointMode {
  /** Unique identifier for this mode */
  mode: string;
  /** Human-readable label for the mode */
  label: string;
  /** Description of what this mode does */
  description: string;
  /** What types of breakpoints this mode applies to */
  appliesTo: BreakpointModeAppliesTo[];
}

/**
 * Types of breakpoints that a mode can apply to.
 */
export type BreakpointModeAppliesTo =
  | "source"      // Source breakpoints (line breakpoints)
  | "function"    // Function breakpoints
  | "data"        // Data/watchpoint breakpoints
  | "instruction" // Instruction breakpoints
  | "exception";  // Exception breakpoints

// ============================================================================
// Data Breakpoint Types
// ============================================================================

/**
 * Type of access that triggers a data breakpoint.
 */
export type DataBreakpointAccessType = "read" | "write" | "readWrite";

// ============================================================================
// Instruction Breakpoint Types
// ============================================================================

/**
 * An instruction breakpoint (breakpoint at a specific memory address).
 * Used for low-level debugging with disassembly view.
 */
export interface InstructionBreakpoint {
  /** Memory reference for the instruction (usually hex address) */
  instructionReference: string;
  /** Optional offset from the instruction reference */
  offset?: number;
  /** Condition expression that must evaluate to true for the breakpoint to hit */
  condition?: string;
  /** Expression evaluated to determine how many times to skip before stopping */
  hitCondition?: string;
}

// ============================================================================
// Debug Session Picker Types
// ============================================================================

/**
 * Basic information about a debug session for the session picker.
 * Note: The full DebugSessionInfo interface is defined in DebugContext.tsx
 * This is a simplified version for the types module.
 */
export interface DebugSessionInfoBase {
  /** Unique session identifier */
  id: string;
  /** Human-readable name for the session */
  name: string;
  /** Debug adapter type (e.g., "node", "python", "cppdbg") */
  type: string;
  /** Parent session ID for child/nested debug sessions */
  parentSession?: string;
}

/**
 * State for the debug session picker UI.
 * Shows available debug sessions and allows switching between them.
 * Uses generic type to allow flexibility with different session info types.
 */
export interface SessionPickerState<T extends DebugSessionInfoBase = DebugSessionInfoBase> {
  /** List of active debug sessions */
  sessions: T[];
  /** Currently active session */
  activeSession: T | null;
  /** Whether the session picker is visible */
  visible: boolean;
}

// ============================================================================
// Breakpoint Activation Types
// ============================================================================

/**
 * Global breakpoint activation state.
 * Controls whether breakpoints are globally enabled or disabled.
 */
export interface BreakpointActivation {
  /** Whether breakpoints are globally enabled */
  globalEnabled: boolean;
}

// ============================================================================
// Debug Console Settings Types
// ============================================================================

/**
 * Settings for the debug console appearance and behavior.
 */
export interface DebugConsoleSettings {
  /** Font size in pixels for console output */
  fontSize: number;
  /** Font family for console output */
  fontFamily: string;
  /** Line height multiplier (e.g., 1.5 for 150% line height) */
  lineHeight: number;
  /** Whether to wrap long lines */
  wordWrap: boolean;
  /** Whether to collapse identical consecutive lines */
  collapseIdenticalLines: boolean;
  /** Whether to show history suggestions in console input */
  historySuggestions: boolean;
  /** Maximum number of lines to keep in console history */
  maximumLines: number;
}

/**
 * Default debug console settings.
 */
export const DEFAULT_DEBUG_CONSOLE_SETTINGS: DebugConsoleSettings = {
  fontSize: 13,
  fontFamily: "monospace",
  lineHeight: 1.4,
  wordWrap: true,
  collapseIdenticalLines: true,
  historySuggestions: true,
  maximumLines: 10000,
};

// ============================================================================
// Debug Toolbar Types
// ============================================================================

/**
 * Location/style of the debug toolbar.
 */
export type DebugToolbarLocation =
  | "floating"      // Floating toolbar that can be dragged
  | "docked"        // Docked to the top of the editor area
  | "commandCenter" // Integrated into the command center/title bar
  | "hidden";       // Hidden (use keyboard shortcuts only)

/**
 * Debug toolbar configuration.
 */
export interface DebugToolbarConfig {
  /** Location of the toolbar */
  location: DebugToolbarLocation;
  /** Whether to show the toolbar during active debug session only */
  showOnlyDuringDebugging: boolean;
}

// ============================================================================
// Re-exports from DebugContext (for convenience)
// ============================================================================

/**
 * Note: The following types are defined in DebugContext.tsx and can be imported from there:
 * - Breakpoint
 * - BreakpointLocation
 * - DataBreakpoint
 * - FunctionBreakpoint
 * - ExceptionBreakpoint
 * - ExceptionBreakpointFilter
 * - BreakpointGroup
 * - Variable
 * - Scope
 * - StackFrame
 * - Thread
 * - Source
 * - WatchExpression
 * - EvaluateResult
 * - SetVariableResult
 * - DebugCapabilities
 * - StepInTarget
 * - GotoTarget
 * - OutputMessage
 * - InlineValueInfo
 * - DebugSessionConfig
 * - DebugSessionState
 * - CompoundConfig
 * - SavedLaunchConfig
 */
