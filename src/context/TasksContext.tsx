import { createContext, useContext, ParentComponent, onMount, onCleanup, createMemo, createSignal, type Accessor } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useSDK } from "./SDKContext";
import { useTerminals } from "./TerminalsContext";
import { getProjectPath } from "../utils/workspace";
// PERF: MonacoManager imported dynamically to avoid pulling Monaco into startup bundle
import { parseJsoncSafe } from "../utils/jsonc";
import { createLogger } from "../utils/logger";

const tasksLogger = createLogger("Tasks");
import type {
  TaskInputVariable,
  TaskInputPickOption,
  DependsOrder,
  InstancePolicy,
  ShellConfiguration,
  ShellQuotingOptions,
  TaskPresentationOptions,
  TaskRunOptions,
  TaskOSConfiguration,
  TaskConfigurationBase,
  TaskExecution,
  TaskStartEvent,
  TaskEndEvent,
  TaskProcessStartEvent,
  TaskProcessEndEvent,
} from "../types/tasks";

// ============================================================================
// Task Settings Storage Key
// ============================================================================

const TASKS_RUN_IN_TERMINAL_KEY = "cortex_tasks_run_in_terminal";
const TASKS_RECONNECT_KEY = "cortex_tasks_reconnect";

// ============================================================================
// Re-export types from tasks.ts for convenience
// ============================================================================

export type {
  TaskInputVariable,
  TaskInputPickOption,
  DependsOrder,
  InstancePolicy,
  ShellConfiguration,
  ShellQuotingOptions,
  TaskPresentationOptions,
  TaskRunOptions,
  TaskOSConfiguration,
  TaskConfigurationBase,
  TaskExecution,
  TaskStartEvent,
  TaskEndEvent,
  TaskProcessStartEvent,
  TaskProcessEndEvent,
};

/**
 * Get the default "run in terminal" setting from localStorage
 * Default is true to match VS Code behavior (tasks run in terminal)
 */
function getRunInTerminalDefault(): boolean {
  try {
    const stored = localStorage.getItem(TASKS_RUN_IN_TERMINAL_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // localStorage not available
  }
  return true; // Default to true (VS Code-style terminal execution)
}

/**
 * Set the default "run in terminal" setting in localStorage
 */
function setRunInTerminalDefault(value: boolean): void {
  try {
    localStorage.setItem(TASKS_RUN_IN_TERMINAL_KEY, String(value));
  } catch {
    // localStorage not available
  }
}

// ============================================================================
// Task Configuration Types
// ============================================================================

export type TaskGroup = "build" | "test" | "run" | "clean" | "deploy" | "none";

export type TaskType = "shell" | "process" | "npm" | "yarn" | "cargo" | "make" | "poetry" | "pip" | "docker";

export type ProblemMatcherSeverity = "error" | "warning" | "info" | "hint";

/**
 * Pattern configuration for extracting diagnostic information from output
 */
export interface ProblemMatcherPattern {
  /** Regular expression pattern with capture groups */
  regexp: string;
  /** Capture group index for the file path (1-based) */
  file?: number;
  /** Capture group index for the line number (1-based) */
  line?: number;
  /** Capture group index for the column number (1-based) */
  column?: number;
  /** Capture group index for the end line number (1-based) */
  endLine?: number;
  /** Capture group index for the end column number (1-based) */
  endColumn?: number;
  /** Capture group index for the error message (1-based) */
  message?: number;
  /** Capture group index for the severity string (1-based) */
  severity?: number;
  /** Capture group index for the error code (1-based) */
  code?: number;
  /** Whether this is a loop pattern that captures multiple matches per file header */
  loop?: boolean;
}

/**
 * Background task pattern configuration for watching tasks
 * Used to detect when a background task starts/ends a compilation cycle
 */
export interface BackgroundMatcher {
  /** Whether the task is active when it starts (for watch tasks) */
  activeOnStart?: boolean;
  /** Pattern that indicates the task has started a new compilation/work cycle */
  beginsPattern?: string | { regexp: string };
  /** Pattern that indicates the task has finished the compilation/work cycle */
  endsPattern?: string | { regexp: string };
}

/**
 * Problem matcher configuration for parsing task output into diagnostics
 */
export interface ProblemMatcher {
  /** Owner identifier for this matcher */
  owner?: string;
  /** Base path for resolving relative file paths */
  fileLocation?: "absolute" | "relative" | ["relative", string];
  /** Pattern or array of patterns for multiline matching */
  pattern: ProblemMatcherPattern | ProblemMatcherPattern[];
  /** Default severity when not captured from output */
  severity?: ProblemMatcherSeverity;
  /** Mapping from captured severity strings to severity levels */
  severityMapping?: Record<string, ProblemMatcherSeverity>;
  /** Background task pattern detection for watch tasks */
  background?: BackgroundMatcher;
}

/**
 * Built-in problem matcher name or custom matcher configuration
 */
export type ProblemMatcherConfig = string | ProblemMatcher | (string | ProblemMatcher)[];

// ============================================================================
// Built-in Problem Matchers
// ============================================================================

/**
 * TypeScript compiler problem matcher ($tsc)
 * Matches: path/file.ts(line,col): error TS1234: message
 */
const TSC_MATCHER: ProblemMatcher = {
  owner: "typescript",
  fileLocation: "absolute",
  pattern: {
    regexp: "^(.+?)\\((\\d+),(\\d+)\\):\\s*(error|warning)\\s+(TS\\d+):\\s*(.+)$",
    file: 1,
    line: 2,
    column: 3,
    severity: 4,
    code: 5,
    message: 6,
  },
  severityMapping: {
    error: "error",
    warning: "warning",
  },
};

/**
 * TypeScript watch mode problem matcher ($tsc-watch)
 * Matches: path/file.ts:line:col - error TS1234: message
 */
const TSC_WATCH_MATCHER: ProblemMatcher = {
  owner: "typescript",
  fileLocation: "absolute",
  pattern: {
    regexp: "^(.+?):(\\d+):(\\d+)\\s*-\\s*(error|warning)\\s+(TS\\d+):\\s*(.+)$",
    file: 1,
    line: 2,
    column: 3,
    severity: 4,
    code: 5,
    message: 6,
  },
  severityMapping: {
    error: "error",
    warning: "warning",
  },
};

/**
 * ESLint stylish format problem matcher ($eslint-stylish)
 * Matches two-line format:
 *   /path/to/file.js
 *     line:col  error/warning  message  rule-name
 */
const ESLINT_STYLISH_MATCHER: ProblemMatcher = {
  owner: "eslint",
  fileLocation: "absolute",
  pattern: [
    {
      regexp: "^([^\\s].*?)$",
      file: 1,
    },
    {
      regexp: "^\\s+(\\d+):(\\d+)\\s+(error|warning)\\s+(.+?)\\s{2,}(\\S+)\\s*$",
      line: 1,
      column: 2,
      severity: 3,
      message: 4,
      code: 5,
      loop: true,
    },
  ],
  severityMapping: {
    error: "error",
    warning: "warning",
  },
};

/**
 * ESLint compact format problem matcher ($eslint-compact)
 * Matches: /path/to/file.js: line:col: error/warning - message (rule-name)
 */
const ESLINT_COMPACT_MATCHER: ProblemMatcher = {
  owner: "eslint",
  fileLocation: "absolute",
  pattern: {
    regexp: "^(.+?):\\s*line\\s*(\\d+),\\s*col\\s*(\\d+),\\s*(Error|Warning)\\s*-\\s*(.+?)\\s*\\((.+?)\\)$",
    file: 1,
    line: 2,
    column: 3,
    severity: 4,
    message: 5,
    code: 6,
  },
  severityMapping: {
    Error: "error",
    Warning: "warning",
  },
};

/**
 * GCC/Clang compiler problem matcher ($gcc)
 * Matches: file:line:col: error/warning: message
 */
const GCC_MATCHER: ProblemMatcher = {
  owner: "gcc",
  fileLocation: "relative",
  pattern: {
    regexp: "^(.+?):(\\d+):(\\d+):\\s*(error|warning|note|fatal error):\\s*(.+)$",
    file: 1,
    line: 2,
    column: 3,
    severity: 4,
    message: 5,
  },
  severityMapping: {
    error: "error",
    "fatal error": "error",
    warning: "warning",
    note: "info",
  },
};

/**
 * Go compiler problem matcher ($go)
 * Matches: file:line:col: message (go vet, go build, etc.)
 */
const GO_MATCHER: ProblemMatcher = {
  owner: "go",
  fileLocation: "relative",
  pattern: {
    regexp: "^(.+?\\.go):(\\d+)(?::(\\d+))?:\\s*(.+)$",
    file: 1,
    line: 2,
    column: 3,
    message: 4,
  },
  severity: "error",
};

/**
 * Go test problem matcher ($go-test)
 * Matches: --- FAIL: TestName (0.00s) and file_test.go:line: message
 */
const GO_TEST_MATCHER: ProblemMatcher = {
  owner: "go-test",
  fileLocation: "relative",
  pattern: {
    regexp: "^\\s*(.+?\\.go):(\\d+):\\s*(.+)$",
    file: 1,
    line: 2,
    message: 3,
  },
  severity: "error",
};

/**
 * Python traceback problem matcher ($python)
 * Matches: File "path/to/file.py", line 123, in function_name
 */
const PYTHON_MATCHER: ProblemMatcher = {
  owner: "python",
  fileLocation: "absolute",
  pattern: [
    {
      regexp: '^\\s*File\\s+"(.+?)",\\s*line\\s*(\\d+)(?:,\\s*in\\s*.+)?$',
      file: 1,
      line: 2,
    },
    {
      regexp: "^(\\w+Error|\\w+Exception|\\w+Warning):\\s*(.+)$",
      severity: 1,
      message: 2,
      loop: false,
    },
  ],
  severityMapping: {
    SyntaxError: "error",
    IndentationError: "error",
    TabError: "error",
    TypeError: "error",
    ValueError: "error",
    NameError: "error",
    AttributeError: "error",
    KeyError: "error",
    IndexError: "error",
    ImportError: "error",
    ModuleNotFoundError: "error",
    RuntimeError: "error",
    RecursionError: "error",
    StopIteration: "error",
    AssertionError: "error",
    ZeroDivisionError: "error",
    FileNotFoundError: "error",
    PermissionError: "error",
    OSError: "error",
    IOError: "error",
    DeprecationWarning: "warning",
    FutureWarning: "warning",
    PendingDeprecationWarning: "warning",
    RuntimeWarning: "warning",
    SyntaxWarning: "warning",
    UserWarning: "warning",
    ResourceWarning: "warning",
  },
  severity: "error",
};

/**
 * Rust/Cargo compiler problem matcher ($rustc)
 * Matches: error[E0123]: message --> file:line:col
 */
const RUSTC_MATCHER: ProblemMatcher = {
  owner: "rustc",
  fileLocation: "relative",
  pattern: [
    {
      regexp: "^(error|warning)(?:\\[(E\\d+)\\])?:\\s*(.+)$",
      severity: 1,
      code: 2,
      message: 3,
    },
    {
      regexp: "^\\s*-->\\s*(.+?):(\\d+):(\\d+)$",
      file: 1,
      line: 2,
      column: 3,
      loop: false,
    },
  ],
  severityMapping: {
    error: "error",
    warning: "warning",
  },
};

/**
 * MSBuild/C# compiler problem matcher ($mscompile)
 * Matches: file(line,col): error/warning CODE: message
 */
const MSCOMPILE_MATCHER: ProblemMatcher = {
  owner: "mscompile",
  fileLocation: "absolute",
  pattern: {
    regexp: "^(.+?)\\((\\d+),(\\d+)\\):\\s*(error|warning)\\s+([A-Z]+\\d+):\\s*(.+)$",
    file: 1,
    line: 2,
    column: 3,
    severity: 4,
    code: 5,
    message: 6,
  },
  severityMapping: {
    error: "error",
    warning: "warning",
  },
};

/**
 * Java/Maven compiler problem matcher ($javac)
 * Matches: [ERROR] file:[line,col] message
 */
const JAVAC_MATCHER: ProblemMatcher = {
  owner: "javac",
  fileLocation: "absolute",
  pattern: {
    regexp: "^\\[(ERROR|WARNING)\\]\\s+(.+?):\\[(\\d+),(\\d+)\\]\\s*(.+)$",
    severity: 1,
    file: 2,
    line: 3,
    column: 4,
    message: 5,
  },
  severityMapping: {
    ERROR: "error",
    WARNING: "warning",
  },
};

/**
 * Registry of built-in problem matchers
 */
export const BUILTIN_PROBLEM_MATCHERS: Record<string, ProblemMatcher> = {
  "$tsc": TSC_MATCHER,
  "$tsc-watch": TSC_WATCH_MATCHER,
  "$eslint-stylish": ESLINT_STYLISH_MATCHER,
  "$eslint-compact": ESLINT_COMPACT_MATCHER,
  "$gcc": GCC_MATCHER,
  "$go": GO_MATCHER,
  "$go-test": GO_TEST_MATCHER,
  "$python": PYTHON_MATCHER,
  "$rustc": RUSTC_MATCHER,
  "$mscompile": MSCOMPILE_MATCHER,
  "$javac": JAVAC_MATCHER,
};

// ============================================================================
// Problem Matcher Parsing Types
// ============================================================================

export interface ParsedDiagnostic {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: ProblemMatcherSeverity;
  message: string;
  code?: string;
  source: string;
}

// ============================================================================
// Problem Matcher Parsing Implementation
// ============================================================================

/**
 * Resolves a problem matcher configuration to a ProblemMatcher object
 */
export function resolveProblemMatcher(config: ProblemMatcherConfig): ProblemMatcher[] {
  if (typeof config === "string") {
    const builtin = BUILTIN_PROBLEM_MATCHERS[config];
    return builtin ? [builtin] : [];
  }
  if (Array.isArray(config)) {
    return config.flatMap(c => resolveProblemMatcher(c));
  }
  return [config];
}

/**
 * Maps a severity string from task output to a ProblemMatcherSeverity
 */
function mapSeverityFromString(
  severityStr: string | undefined,
  severityMapping: Record<string, ProblemMatcherSeverity> | undefined,
  defaultSeverity: ProblemMatcherSeverity
): ProblemMatcherSeverity {
  if (!severityStr) {
    return defaultSeverity;
  }
  if (severityMapping && severityMapping[severityStr]) {
    return severityMapping[severityStr];
  }
  const lower = severityStr.toLowerCase();
  if (lower === "error" || lower === "fatal" || lower === "fatal error") {
    return "error";
  }
  if (lower === "warning" || lower === "warn") {
    return "warning";
  }
  if (lower === "info" || lower === "information" || lower === "note") {
    return "info";
  }
  if (lower === "hint") {
    return "hint";
  }
  return defaultSeverity;
}

/**
 * Extracts a capture group value from a regex match
 */
function extractGroup(match: RegExpExecArray, index: number | undefined): string | undefined {
  if (index === undefined || index < 1 || index >= match.length) {
    return undefined;
  }
  return match[index];
}

/**
 * Safely parses an integer with a fallback default value
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parses task output using a single-pattern problem matcher
 */
function parseSinglePattern(
  output: string,
  pattern: ProblemMatcherPattern,
  matcher: ProblemMatcher,
  basePath: string
): ParsedDiagnostic[] {
  const diagnostics: ParsedDiagnostic[] = [];
  const regex = new RegExp(pattern.regexp, "gm");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(output)) !== null) {
    const fileStr = extractGroup(match, pattern.file);
    const lineStr = extractGroup(match, pattern.line);
    const columnStr = extractGroup(match, pattern.column);
    const endLineStr = extractGroup(match, pattern.endLine);
    const endColumnStr = extractGroup(match, pattern.endColumn);
    const messageStr = extractGroup(match, pattern.message);
    const severityStr = extractGroup(match, pattern.severity);
    const codeStr = extractGroup(match, pattern.code);

    if (!fileStr || !lineStr) {
      continue;
    }

    const filePath = resolveFilePath(fileStr, matcher.fileLocation, basePath);
    const line = safeParseInt(lineStr, 1);
    const column = safeParseInt(columnStr, 1);

    const diagnostic: ParsedDiagnostic = {
      file: filePath,
      line,
      column,
      severity: mapSeverityFromString(severityStr, matcher.severityMapping, matcher.severity || "error"),
      message: messageStr || match[0],
      source: matcher.owner || "task",
    };

    if (endLineStr) {
      diagnostic.endLine = safeParseInt(endLineStr, line);
    }
    if (endColumnStr) {
      diagnostic.endColumn = safeParseInt(endColumnStr, column);
    }
    if (codeStr) {
      diagnostic.code = codeStr;
    }

    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

/**
 * Parses task output using a multi-pattern problem matcher (for multiline errors)
 */
function parseMultiPattern(
  output: string,
  patterns: ProblemMatcherPattern[],
  matcher: ProblemMatcher,
  basePath: string
): ParsedDiagnostic[] {
  const diagnostics: ParsedDiagnostic[] = [];
  const lines = output.split(/\r?\n/);

  let currentFile: string | undefined;
  let pendingData: {
    file?: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    message?: string;
    severity?: string;
    code?: string;
  } = {};

  let patternIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pattern = patterns[patternIndex];
    const regex = new RegExp(pattern.regexp);
    const match = regex.exec(line);

    if (match) {
      const fileStr = extractGroup(match, pattern.file);
      const lineStr = extractGroup(match, pattern.line);
      const columnStr = extractGroup(match, pattern.column);
      const endLineStr = extractGroup(match, pattern.endLine);
      const endColumnStr = extractGroup(match, pattern.endColumn);
      const messageStr = extractGroup(match, pattern.message);
      const severityStr = extractGroup(match, pattern.severity);
      const codeStr = extractGroup(match, pattern.code);

      if (fileStr) {
        currentFile = fileStr;
        pendingData.file = fileStr;
      }
      if (lineStr) {
        pendingData.line = safeParseInt(lineStr, 1);
      }
      if (columnStr) {
        pendingData.column = safeParseInt(columnStr, 1);
      }
      if (endLineStr) {
        pendingData.endLine = safeParseInt(endLineStr, pendingData.line ?? 1);
      }
      if (endColumnStr) {
        pendingData.endColumn = safeParseInt(endColumnStr, pendingData.column ?? 1);
      }
      if (messageStr) {
        pendingData.message = messageStr;
      }
      if (severityStr) {
        pendingData.severity = severityStr;
      }
      if (codeStr) {
        pendingData.code = codeStr;
      }

      if (pattern.loop) {
        if (pendingData.file && pendingData.line && pendingData.message) {
          const filePath = resolveFilePath(
            pendingData.file,
            matcher.fileLocation,
            basePath
          );

          diagnostics.push({
            file: filePath,
            line: pendingData.line,
            column: pendingData.column || 1,
            endLine: pendingData.endLine,
            endColumn: pendingData.endColumn,
            severity: mapSeverityFromString(pendingData.severity, matcher.severityMapping, matcher.severity || "error"),
            message: pendingData.message,
            code: pendingData.code,
            source: matcher.owner || "task",
          });

          pendingData = { file: currentFile };
        }
      } else {
        patternIndex++;
        if (patternIndex >= patterns.length) {
          if (pendingData.file && pendingData.line && pendingData.message) {
            const filePath = resolveFilePath(
              pendingData.file,
              matcher.fileLocation,
              basePath
            );

            diagnostics.push({
              file: filePath,
              line: pendingData.line,
              column: pendingData.column || 1,
              endLine: pendingData.endLine,
              endColumn: pendingData.endColumn,
              severity: mapSeverityFromString(pendingData.severity, matcher.severityMapping, matcher.severity || "error"),
              message: pendingData.message,
              code: pendingData.code,
              source: matcher.owner || "task",
            });
          }
          patternIndex = 0;
          pendingData = {};
          currentFile = undefined;
        }
      }
    } else if (patternIndex > 0 && !patterns[patternIndex].loop) {
      patternIndex = 0;
      pendingData = {};
      currentFile = undefined;
      i--;
    }
  }

  return diagnostics;
}

/**
 * Resolves a file path based on the fileLocation setting
 */
function resolveFilePath(
  filePath: string,
  fileLocation: ProblemMatcher["fileLocation"],
  basePath: string
): string {
  const normalizedPath = filePath.replace(/\\/g, "/");

  if (fileLocation === "absolute") {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/") || /^[A-Za-z]:/.test(normalizedPath)) {
    return normalizedPath;
  }

  let resolvedBasePath = basePath;
  if (Array.isArray(fileLocation)) {
    resolvedBasePath = fileLocation[1] || basePath;
  }

  const base = resolvedBasePath.replace(/\\/g, "/").replace(/\/$/, "");
  return `${base}/${normalizedPath}`;
}

/**
 * Main function to parse task output with a problem matcher configuration
 */
export function parseTaskOutput(
  output: string,
  matcherConfig: ProblemMatcherConfig,
  basePath: string
): ParsedDiagnostic[] {
  const matchers = resolveProblemMatcher(matcherConfig);
  const allDiagnostics: ParsedDiagnostic[] = [];

  for (const matcher of matchers) {
    const patterns = Array.isArray(matcher.pattern) ? matcher.pattern : [matcher.pattern];

    let diagnostics: ParsedDiagnostic[];
    if (patterns.length === 1) {
      diagnostics = parseSinglePattern(output, patterns[0], matcher, basePath);
    } else {
      diagnostics = parseMultiPattern(output, patterns, matcher, basePath);
    }

    allDiagnostics.push(...diagnostics);
  }

  return allDiagnostics;
}

// ============================================================================
// Task Variables - VSCode-compatible variable substitution
// ============================================================================

/**
 * Available task variables for substitution in task commands and arguments.
 * Compatible with VSCode's predefined variables.
 */
export interface TaskVariables {
  /** Full path of the workspace folder */
  workspaceFolder: string;
  /** Name of the workspace folder (last segment of path) */
  workspaceFolderBasename: string;
  /** Full path of the currently opened file */
  file: string;
  /** Workspace folder of the current file */
  fileWorkspaceFolder: string;
  /** Path of the current file relative to workspaceFolder */
  relativeFile: string;
  /** Directory path of the current file relative to workspaceFolder */
  relativeFileDirname: string;
  /** Filename of the current file with extension */
  fileBasename: string;
  /** Filename of the current file without extension */
  fileBasenameNoExtension: string;
  /** Directory path of the current file */
  fileDirname: string;
  /** File extension of the current file (including dot) */
  fileExtname: string;
  /** Current line number in the active editor */
  lineNumber: string;
  /** Currently selected text in the active editor */
  selectedText: string;
  /** Current working directory */
  cwd: string;
}

/**
 * Get the current active file path from localStorage or editor state.
 * Uses the same pattern as other contexts in the codebase.
 */
function getCurrentFilePath(): string {
  // Try to get from localStorage where file state is often stored
  const stored = localStorage.getItem("cortex_active_file");
  if (stored) return stored;
  
  // Try to get from recent files
  const recentFiles = localStorage.getItem("cortex_recent_files");
  if (recentFiles) {
    try {
      const files = JSON.parse(recentFiles);
      if (Array.isArray(files) && files.length > 0) {
        return files[0];
      }
    } catch {
      // Invalid JSON - ignore
    }
  }
  
  return "";
}

// Cached MonacoManager module reference (lazy-loaded)
let monacoManagerModule: typeof import("../utils/monacoManager") | null = null;

/**
 * Get the active Monaco editor instance if available.
 * Uses the MonacoManager singleton with lazy loading.
 */
function getActiveEditor(): { lineNumber: number; selectedText: string } | null {
  try {
    // If MonacoManager hasn't been loaded yet, return null
    // This is fine because the editor won't be open anyway during early startup
    if (!monacoManagerModule) {
      // Try to load it synchronously if already cached by Vite
      // This works because at task execution time, Monaco is definitely loaded
      try {
        // Use require-like pattern to check if module is already loaded
        const cached = (window as { __monacoManagerLoaded?: typeof import("../utils/monacoManager") }).__monacoManagerLoaded;
        if (cached) {
          monacoManagerModule = cached;
        } else {
          // Trigger async load for next time
          import("../utils/monacoManager").then(m => {
            monacoManagerModule = m;
            (window as { __monacoManagerLoaded?: typeof import("../utils/monacoManager") }).__monacoManagerLoaded = m;
          });
          return null;
        }
      } catch {
        return null;
      }
    }
    
    const manager = monacoManagerModule.MonacoManager.getInstance();
    const monaco = manager.getMonacoOrNull();
    
    if (monaco) {
      // Get all editor instances and find the focused one
      const editors = monaco.editor.getEditors();
      for (const editor of editors) {
        if (editor.hasTextFocus()) {
          const position = editor.getPosition();
          const selection = editor.getSelection();
          const model = editor.getModel();
          
          let selectedText = "";
          if (selection && model && !selection.isEmpty()) {
            selectedText = model.getValueInRange(selection);
          }
          
          return {
            lineNumber: position?.lineNumber || 1,
            selectedText,
          };
        }
      }
      
      // If no focused editor, try to get the first one
      if (editors.length > 0) {
        const editor = editors[0];
        const position = editor.getPosition();
        return {
          lineNumber: position?.lineNumber || 1,
          selectedText: "",
        };
      }
    }
  } catch {
    // MonacoManager might not be initialized yet
  }
  
  return null;
}

/**
 * Build task variables object with current workspace and editor state.
 * @param projectPath The current project/workspace path
 */
export function getTaskVariables(projectPath: string): TaskVariables {
  const currentFile = getCurrentFilePath();
  const editorState = getActiveEditor();
  
  // Normalize paths
  const normalizedProjectPath = projectPath.replace(/\\/g, "/");
  const normalizedFilePath = currentFile.replace(/\\/g, "/");
  
  // Extract file components
  const pathSeparatorIndex = Math.max(
    normalizedFilePath.lastIndexOf("/"),
    normalizedFilePath.lastIndexOf("\\")
  );
  const fileDirname = pathSeparatorIndex >= 0 
    ? normalizedFilePath.substring(0, pathSeparatorIndex) 
    : "";
  const fileName = pathSeparatorIndex >= 0 
    ? normalizedFilePath.substring(pathSeparatorIndex + 1) 
    : normalizedFilePath;
  
  // Extract extension
  const lastDotIndex = fileName.lastIndexOf(".");
  const fileExtname = lastDotIndex >= 0 ? fileName.substring(lastDotIndex) : "";
  const fileBasenameNoExtension = lastDotIndex >= 0 
    ? fileName.substring(0, lastDotIndex) 
    : fileName;
  
  // Calculate relative paths
  let relativeFile = normalizedFilePath;
  let relativeFileDirname = fileDirname;
  
  if (normalizedProjectPath && normalizedFilePath.startsWith(normalizedProjectPath)) {
    relativeFile = normalizedFilePath
      .substring(normalizedProjectPath.length)
      .replace(/^\//, "");
    relativeFileDirname = fileDirname
      .substring(normalizedProjectPath.length)
      .replace(/^\//, "");
  }
  
  return {
    workspaceFolder: projectPath,
    workspaceFolderBasename: normalizedProjectPath.split("/").pop() || "",
    file: currentFile,
    fileWorkspaceFolder: projectPath,
    relativeFile,
    relativeFileDirname,
    fileBasename: fileName,
    fileBasenameNoExtension,
    fileDirname,
    fileExtname,
    lineNumber: String(editorState?.lineNumber || 1),
    selectedText: editorState?.selectedText || "",
    cwd: projectPath,
  };
}

/**
 * Substitute VSCode-style variables in a string.
 * Supports:
 * - ${variableName} - standard task variables
 * - ${env:VARIABLE_NAME} - environment variables
 * - ${config:setting.name} - configuration values (placeholder support)
 * 
 * @param str The string containing variables to substitute
 * @param projectPath The current project/workspace path
 * @returns The string with variables replaced
 */
export function substituteTaskVariables(str: string, projectPath: string): string {
  const vars = getTaskVariables(projectPath);
  
  return str.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
    // Handle environment variables: ${env:VAR_NAME}
    if (varName.startsWith("env:")) {
      const envVarName = varName.slice(4);
      // Access environment variables - note: in browser context, this is limited
      // In Tauri, we'd need to call the backend for actual env vars
      // For now, check if it's in window.process.env (Node-like) or return match
      if (typeof process !== "undefined" && process.env) {
        return process.env[envVarName] || match;
      }
      return match;
    }
    
    // Handle config variables: ${config:setting.name}
    if (varName.startsWith("config:")) {
      const configKey = varName.slice(7);
      // Try to get from localStorage settings
      try {
        const settings = localStorage.getItem("cortex_settings");
        if (settings) {
          const parsed = JSON.parse(settings);
          // Support nested keys like "editor.fontSize"
          const keys = configKey.split(".");
          let value: unknown = parsed;
          for (const key of keys) {
            if (value && typeof value === "object" && key in value) {
              value = (value as Record<string, unknown>)[key];
            } else {
              return match; // Key not found, return original
            }
          }
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return String(value);
          }
        }
      } catch {
        // Invalid JSON or other error
      }
      return match;
    }
    
    // Handle standard task variables
    if (varName in vars) {
      return vars[varName as keyof TaskVariables];
    }
    
    // Unknown variable, return as-is
    return match;
  });
}

// ============================================================================
// Input Variable Resolution
// ============================================================================

/**
 * Check if a string contains input variable references (${input:id})
 */
export function hasInputVariables(str: string): boolean {
  return /\$\{input:([^}]+)\}/.test(str);
}

/**
 * Extract all input variable IDs from a string
 */
export function extractInputVariableIds(str: string): string[] {
  const matches = str.matchAll(/\$\{input:([^}]+)\}/g);
  const ids = new Set<string>();
  for (const match of matches) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

/**
 * Extract all input variable IDs from a task configuration
 */
export function extractTaskInputVariableIds(task: TaskConfig): string[] {
  const ids = new Set<string>();
  
  // Check command
  if (task.command) {
    extractInputVariableIds(task.command).forEach(id => ids.add(id));
  }
  
  // Check args
  if (task.args) {
    for (const arg of task.args) {
      extractInputVariableIds(arg).forEach(id => ids.add(id));
    }
  }
  
  // Check cwd
  if (task.cwd) {
    extractInputVariableIds(task.cwd).forEach(id => ids.add(id));
  }
  
  // Check env values
  if (task.env) {
    for (const value of Object.values(task.env)) {
      extractInputVariableIds(value).forEach(id => ids.add(id));
    }
  }
  
  return Array.from(ids);
}

/**
 * Substitute input variables in a string with resolved values
 */
export function substituteInputVariables(
  str: string,
  resolvedInputs: Record<string, string>
): string {
  return str.replace(/\$\{input:([^}]+)\}/g, (match, inputId: string) => {
    if (inputId in resolvedInputs) {
      return resolvedInputs[inputId];
    }
    return match; // Keep original if not resolved
  });
}

/**
 * Check if a string contains command variable references (${command:id})
 */
export function hasCommandVariables(str: string): boolean {
  return /\$\{command:([^}]+)\}/.test(str);
}

/**
 * Extract all command variable IDs from a string
 */
export function extractCommandVariableIds(str: string): string[] {
  const matches = str.matchAll(/\$\{command:([^}]+)\}/g);
  const ids = new Set<string>();
  for (const match of matches) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

/**
 * Substitute command variables in a string with resolved values
 */
export function substituteCommandVariables(
  str: string,
  resolvedCommands: Record<string, string>
): string {
  return str.replace(/\$\{command:([^}]+)\}/g, (match, commandId: string) => {
    if (commandId in resolvedCommands) {
      return resolvedCommands[commandId];
    }
    return match; // Keep original if not resolved
  });
}

// ============================================================================
// OS Detection and Configuration
// ============================================================================

/**
 * Detect the current operating system
 */
export function detectOS(): 'windows' | 'linux' | 'osx' {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac') || platform.includes('darwin')) return 'osx';
  return 'linux';
}

/**
 * Get default shell configuration for the current OS
 */
export function getDefaultShellConfig(os: 'windows' | 'linux' | 'osx'): ShellConfiguration {
  switch (os) {
    case 'windows':
      return {
        executable: 'cmd.exe',
        args: ['/d', '/c'],
        quoting: {
          escape: '^',
          strong: '"',
          weak: '"',
        },
      };
    case 'osx':
      return {
        executable: '/bin/zsh',
        args: ['-c'],
        quoting: {
          escape: '\\',
          strong: "'",
          weak: '"',
        },
      };
    case 'linux':
    default:
      return {
        executable: '/bin/bash',
        args: ['-c'],
        quoting: {
          escape: '\\',
          strong: "'",
          weak: '"',
        },
      };
  }
}

/**
 * Merge OS-specific configuration with base task configuration
 */
export function mergeOSConfig(
  task: TaskConfig,
  os: 'windows' | 'linux' | 'osx'
): TaskConfig {
  const osConfig = task[os];
  if (!osConfig) return task;
  
  return {
    ...task,
    command: osConfig.command ?? task.command,
    args: osConfig.args ?? task.args,
    cwd: osConfig.cwd ?? task.cwd,
    env: osConfig.env ? { ...task.env, ...osConfig.env } : task.env,
    shell: osConfig.shell ?? task.shell,
    presentation: osConfig.presentation ?? task.presentation,
  };
}

// ============================================================================
// Shell Quoting
// ============================================================================

/**
 * Quote an argument according to shell quoting options
 */
export function quoteShellArg(
  arg: string,
  quoting: ShellQuotingOptions | undefined,
  forceQuote: boolean = false
): string {
  if (!quoting) return arg;
  
  // Check if arg needs quoting (contains spaces or special characters)
  const needsQuoting = forceQuote || /[\s"'`$\\!&|;<>(){}[\]*?#~]/.test(arg);
  
  if (!needsQuoting) return arg;
  
  // Use strong quoting if available (single quotes in bash)
  if (quoting.strong) {
    // Escape any existing strong quote characters
    const escaped = arg.replace(new RegExp(quoting.strong, 'g'), 
      quoting.escape ? `${quoting.escape}${quoting.strong}` : `${quoting.strong}${quoting.strong}`);
    return `${quoting.strong}${escaped}${quoting.strong}`;
  }
  
  // Use weak quoting (double quotes)
  if (quoting.weak) {
    let escaped = arg;
    // Escape characters that need escaping in weak quotes
    if (quoting.escape) {
      const escapeChar = typeof quoting.escape === 'string' 
        ? quoting.escape 
        : quoting.escape.escapeChar;
      const charsToEscape = typeof quoting.escape === 'string'
        ? `${quoting.weak}$\`\\`
        : quoting.escape.charsToEscape;
      
      for (const char of charsToEscape) {
        escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `${escapeChar}${char}`);
      }
    }
    return `${quoting.weak}${escaped}${quoting.weak}`;
  }
  
  // Fallback: escape special characters
  if (quoting.escape) {
    const escapeChar = typeof quoting.escape === 'string' 
      ? quoting.escape 
      : quoting.escape.escapeChar;
    return arg.replace(/[\s"'`$\\!&|;<>(){}[\]*?#~]/g, char => `${escapeChar}${char}`);
  }
  
  return arg;
}

/**
 * Build a shell command with proper quoting
 */
export function buildShellCommand(
  command: string,
  args: string[] | undefined,
  shell: ShellConfiguration | undefined
): string {
  const parts = [command];
  
  if (args && args.length > 0) {
    for (const arg of args) {
      parts.push(quoteShellArg(arg, shell?.quoting));
    }
  }
  
  return parts.join(' ');
}

// ============================================================================
// Instance Policy Handling
// ============================================================================

/**
 * Check if a task can run based on instance policy
 */
export function checkInstancePolicy(
  task: TaskConfig,
  runningTasks: TaskRun[],
  backgroundTasks: TaskRun[]
): { canRun: boolean; action?: 'terminate' | 'prompt' | 'warn'; taskToTerminate?: TaskRun } {
  const instanceLimit = task.runOptions?.instanceLimit ?? 1;
  const instancePolicy = task.runOptions?.instancePolicy ?? 'prompt';
  
  // Find running instances of this task
  const runningInstances = [
    ...runningTasks.filter(r => r.taskLabel === task.label && r.status === 'running'),
    ...backgroundTasks.filter(r => r.taskLabel === task.label && r.status === 'running'),
  ];
  
  if (runningInstances.length < instanceLimit) {
    return { canRun: true };
  }
  
  switch (instancePolicy) {
    case 'silent':
      return { canRun: true };
    
    case 'warn':
      return { canRun: true, action: 'warn' };
    
    case 'terminateOldest':
      // Sort by start time, oldest first
      const oldest = [...runningInstances].sort((a, b) => a.startedAt - b.startedAt)[0];
      return { canRun: true, action: 'terminate', taskToTerminate: oldest };
    
    case 'terminateNewest':
      // The new task won't run
      return { canRun: false, action: 'terminate' };
    
    case 'prompt':
    default:
      return { canRun: false, action: 'prompt' };
  }
}

export interface TaskConfig {
  label: string;
  type: TaskType;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  problemMatcher?: ProblemMatcherConfig;
  dependsOn?: string[];
  /** Order in which dependent tasks should run: 'parallel' or 'sequence' */
  dependsOrder?: DependsOrder;
  group?: TaskGroup;
  /** Complete presentation options for terminal display */
  presentation?: TaskPresentationOptions;
  /** Run options controlling execution behavior */
  runOptions?: TaskRunOptions;
  /** Whether this is a background/watching task that runs indefinitely */
  isBackground?: boolean;
  isDefault?: boolean;
  source?: "user" | "workspace" | "auto-detected";
  providerId?: string;
  /** Shell configuration for this task */
  shell?: ShellConfiguration;
  /** Windows-specific configuration overrides */
  windows?: TaskConfigurationBase;
  /** Linux-specific configuration overrides */
  linux?: TaskConfigurationBase;
  /** macOS-specific configuration overrides */
  osx?: TaskConfigurationBase;
  /** Input variable definitions for this task */
  inputs?: TaskInputVariable[];
  /** Detail text shown in quick pick */
  detail?: string;
  /** Hide this task from the UI */
  hide?: boolean;
}

// ============================================================================
// Task Provider Types
// ============================================================================

export interface TaskProvider {
  id: string;
  name: string;
  configFiles: string[];
  enabled: boolean;
  detect: (cwd: string, readFile: (path: string) => Promise<string | null>) => Promise<TaskConfig[]>;
}

export interface TaskProviderRegistry {
  providers: TaskProvider[];
  register: (provider: TaskProvider) => void;
  unregister: (id: string) => void;
  getProvider: (id: string) => TaskProvider | undefined;
  enableProvider: (id: string, enabled: boolean) => void;
}

/** Background task status for watching tasks */
export type BackgroundTaskStatus = "watching" | "compiling" | "idle" | "error";

export interface TaskRun {
  id: string;
  taskLabel: string;
  config: TaskConfig;
  terminalId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: number;
  finishedAt?: number;
  exitCode?: number;
  output: string[];
  /** Whether this is a background task */
  isBackground?: boolean;
  /** Current status of background task (watching, compiling, idle) */
  backgroundStatus?: BackgroundTaskStatus;
  /** Timestamp of last compilation start */
  lastCompileStart?: number;
  /** Timestamp of last compilation end */
  lastCompileEnd?: number;
  /** Process ID if available */
  processId?: number;
  /** Resolved input variable values for this run */
  resolvedInputs?: Record<string, string>;
  /** Whether this task should be reconnected after reload */
  reconnectable?: boolean;
}

/** Stored state for task reconnection after reload */
export interface TaskReconnectState {
  taskLabel: string;
  terminalId: string;
  config: TaskConfig;
  startedAt: number;
  isBackground: boolean;
  resolvedInputs?: Record<string, string>;
}

export interface TaskHistory {
  taskLabel: string;
  lastRun: number;
  runCount: number;
}

// ============================================================================
// Run on Save Configuration
// ============================================================================

export interface RunOnSaveConfig {
  id: string;
  taskId: string;
  globPattern: string;
  delay: number;
  enabled: boolean;
}

// ============================================================================
// Tasks State
// ============================================================================

interface TasksState {
  tasks: TaskConfig[];
  detectedTasks: TaskConfig[];
  recentTasks: TaskHistory[];
  runningTasks: TaskRun[];
  /** Background tasks that are running (watch mode, etc.) */
  backgroundTasks: TaskRun[];
  taskHistory: TaskRun[];
  taskProviders: TaskProvider[];
  watchedFiles: string[];
  isDetecting: boolean;
  lastDetectionTime: number | null;
  showTasksPanel: boolean;
  showRunDialog: boolean;
  showConfigEditor: boolean;
  showRunOnSaveConfig: boolean;
  /** Whether to show the input variable prompt dialog */
  showInputPrompt: boolean;
  /** Current input prompt configuration */
  currentInputPrompt: {
    input: TaskInputVariable;
    taskLabel: string;
    resolve: (value: string | null) => void;
  } | null;
  selectedTask: TaskConfig | null;
  editingTask: TaskConfig | null;
  runOnSave: RunOnSaveConfig[];
  runOnSaveEnabled: boolean;
  /** Whether runOn: "folderOpen" tasks have been auto-started */
  folderOpenTasksStarted: boolean;
  /** Global input variables from tasks.json */
  globalInputs: TaskInputVariable[];
  /** Registered command handlers for ${command:id} variables */
  commandHandlers: Map<string, (args?: Record<string, unknown>) => Promise<string>>;
  /** Task executions for event tracking */
  executions: Map<string, TaskExecution>;
}

interface TasksContextValue {
  initialized: Accessor<boolean>;
  state: TasksState;
  
  // Task management
  addTask: (task: TaskConfig) => void;
  updateTask: (label: string, updates: Partial<TaskConfig>) => void;
  removeTask: (label: string) => void;
  
  // Task execution
  runTask: (task: TaskConfig, resolvedInputs?: Record<string, string>) => Promise<void>;
  runTaskByLabel: (label: string) => Promise<void>;
  runBuildTask: () => Promise<void>;
  runTestTask: () => Promise<void>;
  cancelTask: (runId: string) => Promise<void>;
  rerunTask: (run: TaskRun) => Promise<void>;
  
  // Background task execution
  runBackgroundTask: (task: TaskConfig, resolvedInputs?: Record<string, string>) => Promise<string>;
  stopBackgroundTask: (runId: string) => void;
  
  // Task discovery
  detectTasks: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  
  // Task providers
  taskProviders: TaskProviderRegistry;
  
  // UI state
  openTasksPanel: () => void;
  closeTasksPanel: () => void;
  toggleTasksPanel: () => void;
  openRunDialog: () => void;
  closeRunDialog: () => void;
  openConfigEditor: (task?: TaskConfig) => void;
  closeConfigEditor: () => void;
  setSelectedTask: (task: TaskConfig | null) => void;
  openRunOnSaveConfig: () => void;
  closeRunOnSaveConfig: () => void;
  
  // Input variable prompts
  resolveInputPrompt: (value: string | null) => void;
  
  // Run on Save
  addRunOnSave: (taskId: string, globPattern: string, delay?: number) => void;
  removeRunOnSave: (id: string) => void;
  updateRunOnSave: (id: string, updates: Partial<RunOnSaveConfig>) => void;
  toggleRunOnSaveEnabled: () => void;
  handleFileSaved: (filePath: string) => void;
  
  // Terminal integration
  /** Run a task directly in the integrated terminal (instead of via SDK) */
  runTaskInTerminal: (task: TaskConfig, resolvedInputs?: Record<string, string>) => Promise<void>;
  /** Get the default "run in terminal" setting */
  getRunInTerminalDefault: () => boolean;
  /** Set the default "run in terminal" setting */
  setRunInTerminalDefault: (value: boolean) => void;
  
  // Command variable handlers
  /** Register a command handler for ${command:id} variables */
  registerCommandHandler: (commandId: string, handler: (args?: Record<string, unknown>) => Promise<string>) => void;
  /** Unregister a command handler */
  unregisterCommandHandler: (commandId: string) => void;
  
  // Task events
  /** Subscribe to task start events */
  onDidStartTask: (callback: (event: TaskStartEvent) => void) => () => void;
  /** Subscribe to task end events */
  onDidEndTask: (callback: (event: TaskEndEvent) => void) => () => void;
  /** Subscribe to task process start events */
  onDidStartTaskProcess: (callback: (event: TaskProcessStartEvent) => void) => () => void;
  /** Subscribe to task process end events */
  onDidEndTaskProcess: (callback: (event: TaskProcessEndEvent) => void) => () => void;
  
  // Task reconnection
  /** Reconnect to tasks that were running before reload */
  reconnectTasks: () => Promise<void>;
  
  // Computed helpers
  allTasks: () => TaskConfig[];
  buildTasks: () => TaskConfig[];
  testTasks: () => TaskConfig[];
  backgroundTasks: () => TaskConfig[];
  defaultBuildTask: () => TaskConfig | undefined;
  defaultTestTask: () => TaskConfig | undefined;
  /** Get the current OS identifier */
  getCurrentOS: () => 'windows' | 'linux' | 'osx';
  /** Resolve OS-specific configuration for a task */
  resolveOSConfig: (task: TaskConfig) => TaskConfig;
}

// ============================================================================
// Task Group Inference Helper
// ============================================================================

const inferTaskGroupFromName = (scriptName: string): TaskGroup => {
  const name = scriptName.toLowerCase();
  if (name.includes("build") || name.includes("compile") || name.includes("lint") || name.includes("check") || name.includes("format")) {
    return "build";
  }
  if (name.includes("test") || name.includes("spec") || name.includes("e2e") || name.includes("coverage")) {
    return "test";
  }
  if (name.includes("start") || name.includes("serve") || name.includes("dev") || name.includes("run") || name.includes("watch")) {
    return "run";
  }
  if (name.includes("clean") || name.includes("clear") || name.includes("purge")) {
    return "clean";
  }
  if (name.includes("deploy") || name.includes("publish") || name.includes("release")) {
    return "deploy";
  }
  return "none";
};

// ============================================================================
// Built-in Task Providers
// ============================================================================

const createNpmProvider = (): TaskProvider => ({
  id: "npm",
  name: "NPM Scripts",
  configFiles: ["package.json"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const tasks: TaskConfig[] = [];
    const content = await readFile(`${cwd}/package.json`);
    if (!content) return tasks;

    try {
      const packageJson = JSON.parse(content);
      if (packageJson.scripts && typeof packageJson.scripts === "object") {
        for (const name of Object.keys(packageJson.scripts)) {
          tasks.push({
            label: `npm: ${name}`,
            type: "npm",
            command: "npm",
            args: ["run", name],
            cwd,
            source: "auto-detected",
            providerId: "npm",
            group: inferTaskGroupFromName(name),
          });
        }
      }
    } catch {
      // Invalid JSON - skip
    }
    return tasks;
  },
});

const createYarnProvider = (): TaskProvider => ({
  id: "yarn",
  name: "Yarn Scripts",
  configFiles: ["yarn.lock", "package.json"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const tasks: TaskConfig[] = [];
    const yarnLock = await readFile(`${cwd}/yarn.lock`);
    if (!yarnLock) return tasks;

    const content = await readFile(`${cwd}/package.json`);
    if (!content) return tasks;

    try {
      const packageJson = JSON.parse(content);
      if (packageJson.scripts && typeof packageJson.scripts === "object") {
        for (const name of Object.keys(packageJson.scripts)) {
          tasks.push({
            label: `yarn: ${name}`,
            type: "yarn",
            command: "yarn",
            args: [name],
            cwd,
            source: "auto-detected",
            providerId: "yarn",
            group: inferTaskGroupFromName(name),
          });
        }
      }
    } catch {
      // Invalid JSON - skip
    }
    return tasks;
  },
});

const createCargoProvider = (): TaskProvider => ({
  id: "cargo",
  name: "Cargo Commands",
  configFiles: ["Cargo.toml"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const content = await readFile(`${cwd}/Cargo.toml`);
    if (!content) return [];

    const tasks: TaskConfig[] = [
      { label: "cargo: build", type: "cargo", command: "cargo", args: ["build"], cwd, group: "build", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: build --release", type: "cargo", command: "cargo", args: ["build", "--release"], cwd, group: "build", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: test", type: "cargo", command: "cargo", args: ["test"], cwd, group: "test", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: run", type: "cargo", command: "cargo", args: ["run"], cwd, group: "run", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: check", type: "cargo", command: "cargo", args: ["check"], cwd, group: "build", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: clippy", type: "cargo", command: "cargo", args: ["clippy"], cwd, group: "build", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: clean", type: "cargo", command: "cargo", args: ["clean"], cwd, group: "clean", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: doc", type: "cargo", command: "cargo", args: ["doc", "--open"], cwd, group: "none", source: "auto-detected", providerId: "cargo" },
      { label: "cargo: bench", type: "cargo", command: "cargo", args: ["bench"], cwd, group: "test", source: "auto-detected", providerId: "cargo" },
    ];

    // Parse Cargo.toml for binary targets
    try {
      const lines = content.split("\n");
      let inBin = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("[[bin]]")) {
          inBin = true;
        } else if (trimmed.startsWith("[") && inBin) {
          inBin = false;
        } else if (inBin && trimmed.startsWith("name")) {
          const match = trimmed.match(/name\s*=\s*"([^"]+)"/);
          if (match) {
            tasks.push({ label: `cargo: run --bin ${match[1]}`, type: "cargo", command: "cargo", args: ["run", "--bin", match[1]], cwd, group: "run", source: "auto-detected", providerId: "cargo" });
          }
        }
      }
    } catch { /* continue with base tasks */ }

    return tasks;
  },
});

const createMakefileProvider = (): TaskProvider => ({
  id: "makefile",
  name: "Makefile Targets",
  configFiles: ["Makefile", "makefile", "GNUmakefile"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const tasks: TaskConfig[] = [];
    let content: string | null = null;
    for (const name of ["Makefile", "makefile", "GNUmakefile"]) {
      content = await readFile(`${cwd}/${name}`);
      if (content) break;
    }
    if (!content) return tasks;

    const targetRegex = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:(?!=)/gm;
    const seenTargets = new Set<string>();
    let match;
    while ((match = targetRegex.exec(content)) !== null) {
      const targetName = match[1];
      if (targetName.startsWith(".") || seenTargets.has(targetName)) continue;
      seenTargets.add(targetName);
      tasks.push({ label: `make: ${targetName}`, type: "make", command: "make", args: [targetName], cwd, source: "auto-detected", providerId: "makefile", group: inferTaskGroupFromName(targetName) });
    }
    if (tasks.length > 0) {
      tasks.unshift({ label: "make: (default)", type: "make", command: "make", args: [], cwd, source: "auto-detected", providerId: "makefile", group: "build" });
    }
    return tasks;
  },
});

const createPyprojectProvider = (): TaskProvider => ({
  id: "pyproject",
  name: "Python (pyproject.toml)",
  configFiles: ["pyproject.toml"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const tasks: TaskConfig[] = [];
    const content = await readFile(`${cwd}/pyproject.toml`);
    if (!content) return tasks;

    const isPoetry = content.includes("[tool.poetry]");
    const isPDM = content.includes("[tool.pdm]");
    const isHatch = content.includes("[tool.hatch]");

    if (isPoetry) {
      tasks.push(
        { label: "poetry: install", type: "poetry", command: "poetry", args: ["install"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" },
        { label: "poetry: build", type: "poetry", command: "poetry", args: ["build"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" },
        { label: "poetry: test (pytest)", type: "poetry", command: "poetry", args: ["run", "pytest"], cwd, group: "test", source: "auto-detected", providerId: "pyproject" },
        { label: "poetry: run python", type: "poetry", command: "poetry", args: ["run", "python"], cwd, group: "run", source: "auto-detected", providerId: "pyproject" },
        { label: "poetry: shell", type: "poetry", command: "poetry", args: ["shell"], cwd, group: "none", source: "auto-detected", providerId: "pyproject" },
        { label: "poetry: update", type: "poetry", command: "poetry", args: ["update"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" }
      );
      const scriptMatch = content.match(/\[tool\.poetry\.scripts\]([\s\S]*?)(?=\[|$)/);
      if (scriptMatch) {
        const scriptRegex = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/gm;
        let m;
        while ((m = scriptRegex.exec(scriptMatch[1])) !== null) {
          tasks.push({ label: `poetry: run ${m[1]}`, type: "poetry", command: "poetry", args: ["run", m[1]], cwd, group: inferTaskGroupFromName(m[1]), source: "auto-detected", providerId: "pyproject" });
        }
      }
    } else if (isPDM) {
      tasks.push(
        { label: "pdm: install", type: "pip", command: "pdm", args: ["install"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" },
        { label: "pdm: build", type: "pip", command: "pdm", args: ["build"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" },
        { label: "pdm: test", type: "pip", command: "pdm", args: ["run", "pytest"], cwd, group: "test", source: "auto-detected", providerId: "pyproject" }
      );
    } else if (isHatch) {
      tasks.push(
        { label: "hatch: build", type: "pip", command: "hatch", args: ["build"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" },
        { label: "hatch: test", type: "pip", command: "hatch", args: ["test"], cwd, group: "test", source: "auto-detected", providerId: "pyproject" },
        { label: "hatch: shell", type: "pip", command: "hatch", args: ["shell"], cwd, group: "none", source: "auto-detected", providerId: "pyproject" }
      );
    } else {
      tasks.push(
        { label: "pip: install -e .", type: "pip", command: "pip", args: ["install", "-e", "."], cwd, group: "build", source: "auto-detected", providerId: "pyproject" },
        { label: "python: -m pytest", type: "pip", command: "python", args: ["-m", "pytest"], cwd, group: "test", source: "auto-detected", providerId: "pyproject" },
        { label: "python: -m build", type: "pip", command: "python", args: ["-m", "build"], cwd, group: "build", source: "auto-detected", providerId: "pyproject" }
      );
    }

    const entryPointsMatch = content.match(/\[project\.scripts\]([\s\S]*?)(?=\[|$)/);
    if (entryPointsMatch) {
      const entryRegex = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/gm;
      let m;
      while ((m = entryRegex.exec(entryPointsMatch[1])) !== null) {
        tasks.push({ label: `python: ${m[1]}`, type: "pip", command: m[1], args: [], cwd, group: "run", source: "auto-detected", providerId: "pyproject" });
      }
    }
    return tasks;
  },
});

const createDockerProvider = (): TaskProvider => ({
  id: "docker",
  name: "Docker",
  configFiles: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const tasks: TaskConfig[] = [];

    const dockerfile = await readFile(`${cwd}/Dockerfile`);
    if (dockerfile) {
      tasks.push(
        { label: "docker: build .", type: "docker", command: "docker", args: ["build", "-t", "app:latest", "."], cwd, group: "build", source: "auto-detected", providerId: "docker" },
        { label: "docker: run app", type: "docker", command: "docker", args: ["run", "--rm", "-it", "app:latest"], cwd, group: "run", source: "auto-detected", providerId: "docker" }
      );
      const exposeMatch = dockerfile.match(/EXPOSE\s+(\d+)/g);
      if (exposeMatch && exposeMatch.length > 0) {
        const ports = exposeMatch.map(e => e.replace("EXPOSE ", "").trim());
        const portArgs = ports.flatMap(p => ["-p", `${p}:${p}`]);
        tasks.push({ label: "docker: run with ports", type: "docker", command: "docker", args: ["run", "--rm", "-it", ...portArgs, "app:latest"], cwd, group: "run", source: "auto-detected", providerId: "docker" });
      }
    }

    let composeFile: string | null = null;
    let composeFileName = "";
    for (const name of ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]) {
      composeFile = await readFile(`${cwd}/${name}`);
      if (composeFile) { composeFileName = name; break; }
    }
    if (composeFile) {
      tasks.push(
        { label: "docker-compose: up", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "up"], cwd, group: "run", source: "auto-detected", providerId: "docker" },
        { label: "docker-compose: up -d", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "up", "-d"], cwd, group: "run", source: "auto-detected", providerId: "docker" },
        { label: "docker-compose: up --build", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "up", "--build"], cwd, group: "build", source: "auto-detected", providerId: "docker" },
        { label: "docker-compose: down", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "down"], cwd, group: "clean", source: "auto-detected", providerId: "docker" },
        { label: "docker-compose: logs", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "logs", "-f"], cwd, group: "none", source: "auto-detected", providerId: "docker" },
        { label: "docker-compose: ps", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "ps"], cwd, group: "none", source: "auto-detected", providerId: "docker" },
        { label: "docker-compose: restart", type: "docker", command: "docker-compose", args: ["-f", composeFileName, "restart"], cwd, group: "run", source: "auto-detected", providerId: "docker" }
      );
      // Parse compose file for service names
      const lines = composeFile.split("\n");
      let inServices = false;
      let baseIndent = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "services:") { inServices = true; baseIndent = line.indexOf("services:"); continue; }
        if (inServices) {
          const lineIndent = line.search(/\S/);
          if (lineIndent !== -1 && lineIndent <= baseIndent && !trimmed.startsWith("#")) { inServices = false; continue; }
          const serviceMatch = line.match(/^(\s{2}|\t)([a-zA-Z_][a-zA-Z0-9_-]*):\s*$/);
          if (serviceMatch) {
            const svc = serviceMatch[2];
            tasks.push(
              { label: `docker-compose: up ${svc}`, type: "docker", command: "docker-compose", args: ["-f", composeFileName, "up", svc], cwd, group: "run", source: "auto-detected", providerId: "docker" },
              { label: `docker-compose: logs ${svc}`, type: "docker", command: "docker-compose", args: ["-f", composeFileName, "logs", "-f", svc], cwd, group: "none", source: "auto-detected", providerId: "docker" }
            );
          }
        }
      }
    }
    return tasks;
  },
});

// ============================================================================
// VS Code Tasks Provider
// ============================================================================

/**
 * VS Code tasks.json task definition
 */
interface VSCodeTask {
  label: string;
  type?: string;
  command?: string;
  script?: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    shell?: { executable?: string; args?: string[] };
  };
  group?: string | { kind: string; isDefault?: boolean };
  presentation?: {
    reveal?: "always" | "silent" | "never";
    revealProblems?: "never" | "onProblem" | "always";
    echo?: boolean;
    focus?: boolean;
    panel?: "shared" | "dedicated" | "new";
    showReuseMessage?: boolean;
    clear?: boolean;
    close?: boolean;
    group?: string;
  };
  problemMatcher?: ProblemMatcherConfig;
  dependsOn?: string | string[];
  dependsOrder?: DependsOrder;
  runOptions?: {
    reevaluateOnRerun?: boolean;
    runOn?: "folderOpen" | "default";
    instanceLimit?: number;
    instancePolicy?: InstancePolicy;
  };
  isBackground?: boolean;
  detail?: string;
  hide?: boolean;
  /** Windows-specific overrides */
  windows?: {
    command?: string;
    args?: string[];
    options?: { cwd?: string; env?: Record<string, string>; shell?: { executable?: string; args?: string[] } };
  };
  /** Linux-specific overrides */
  linux?: {
    command?: string;
    args?: string[];
    options?: { cwd?: string; env?: Record<string, string>; shell?: { executable?: string; args?: string[] } };
  };
  /** macOS-specific overrides */
  osx?: {
    command?: string;
    args?: string[];
    options?: { cwd?: string; env?: Record<string, string>; shell?: { executable?: string; args?: string[] } };
  };
}

/**
 * VS Code tasks.json file structure
 */
interface VSCodeTasksFile {
  version?: string;
  tasks?: VSCodeTask[];
  inputs?: TaskInputVariable[];
  /** OS-specific defaults */
  windows?: { options?: { cwd?: string; env?: Record<string, string>; shell?: { executable?: string; args?: string[] } } };
  linux?: { options?: { cwd?: string; env?: Record<string, string>; shell?: { executable?: string; args?: string[] } } };
  osx?: { options?: { cwd?: string; env?: Record<string, string>; shell?: { executable?: string; args?: string[] } } };
}

/**
 * Converts a VS Code task to Cortex TaskConfig format
 */
const convertVSCodeTask = (vscodeTask: VSCodeTask, cwd: string, globalInputs?: TaskInputVariable[]): TaskConfig => {
  // Determine the command - VS Code uses 'command' for shell tasks, 'script' for npm tasks
  let command = vscodeTask.command || "";
  let taskType: TaskType = "shell";
  
  // Handle npm/yarn type tasks
  if (vscodeTask.type === "npm" || vscodeTask.type === "yarn") {
    taskType = vscodeTask.type as TaskType;
    command = vscodeTask.type;
    // For npm/yarn tasks, the script is in the 'script' field
    if (vscodeTask.script) {
      // Args will be set separately
    }
  } else if (vscodeTask.type === "shell" || vscodeTask.type === "process") {
    taskType = vscodeTask.type as TaskType;
  }
  
  // Determine task group
  let group: TaskGroup = "none";
  let isDefault = false;
  if (typeof vscodeTask.group === "string") {
    group = vscodeTask.group as TaskGroup;
  } else if (vscodeTask.group && typeof vscodeTask.group === "object") {
    group = (vscodeTask.group.kind || "none") as TaskGroup;
    isDefault = vscodeTask.group.isDefault || false;
  }
  
  // Build args array
  let args: string[] = vscodeTask.args || [];
  if (vscodeTask.type === "npm" && vscodeTask.script) {
    args = ["run", vscodeTask.script, ...args];
  } else if (vscodeTask.type === "yarn" && vscodeTask.script) {
    args = [vscodeTask.script, ...args];
  }
  
  // Handle dependsOn
  let dependsOn: string[] | undefined;
  if (vscodeTask.dependsOn) {
    dependsOn = Array.isArray(vscodeTask.dependsOn) ? vscodeTask.dependsOn : [vscodeTask.dependsOn];
  }

  // Build shell configuration from options
  let shell: ShellConfiguration | undefined;
  if (vscodeTask.options?.shell) {
    shell = {
      executable: vscodeTask.options.shell.executable,
      args: vscodeTask.options.shell.args,
    };
  }

  // Build OS-specific configurations
  const buildOSConfig = (osConfig: VSCodeTask['windows']): TaskConfigurationBase | undefined => {
    if (!osConfig) return undefined;
    return {
      command: osConfig.command,
      args: osConfig.args,
      cwd: osConfig.options?.cwd,
      env: osConfig.options?.env,
      shell: osConfig.options?.shell ? {
        executable: osConfig.options.shell.executable,
        args: osConfig.options.shell.args,
      } : undefined,
    };
  };

  // Build complete presentation options
  const presentation: TaskPresentationOptions | undefined = vscodeTask.presentation ? {
    reveal: vscodeTask.presentation.reveal,
    revealProblems: vscodeTask.presentation.revealProblems,
    echo: vscodeTask.presentation.echo,
    focus: vscodeTask.presentation.focus,
    panel: vscodeTask.presentation.panel,
    showReuseMessage: vscodeTask.presentation.showReuseMessage,
    clear: vscodeTask.presentation.clear,
    close: vscodeTask.presentation.close,
    group: vscodeTask.presentation.group,
  } : undefined;

  // Build run options
  const runOptions: TaskRunOptions | undefined = vscodeTask.runOptions ? {
    reevaluateOnRerun: vscodeTask.runOptions.reevaluateOnRerun,
    runOn: vscodeTask.runOptions.runOn,
    instanceLimit: vscodeTask.runOptions.instanceLimit,
    instancePolicy: vscodeTask.runOptions.instancePolicy,
  } : undefined;
  
  return {
    label: vscodeTask.label,
    type: taskType,
    command,
    args,
    cwd: vscodeTask.options?.cwd || cwd,
    env: vscodeTask.options?.env,
    group,
    isDefault,
    isBackground: vscodeTask.isBackground,
    problemMatcher: vscodeTask.problemMatcher,
    dependsOn,
    dependsOrder: vscodeTask.dependsOrder,
    presentation,
    runOptions,
    shell,
    windows: buildOSConfig(vscodeTask.windows),
    linux: buildOSConfig(vscodeTask.linux),
    osx: buildOSConfig(vscodeTask.osx),
    inputs: globalInputs,
    detail: vscodeTask.detail,
    hide: vscodeTask.hide,
    source: "auto-detected",
    providerId: "vscode",
  };
};

/**
 * Creates the VS Code tasks provider that reads .vscode/tasks.json
 */
const createVSCodeTasksProvider = (): TaskProvider => ({
  id: "vscode",
  name: "VS Code Tasks",
  configFiles: [".vscode/tasks.json"],
  enabled: true,
  detect: async (cwd, readFile) => {
    const tasks: TaskConfig[] = [];
    const content = await readFile(`${cwd}/.vscode/tasks.json`);
    if (!content) return tasks;

    try {
      const tasksJson = parseJsoncSafe<VSCodeTasksFile>(content, { tasks: [] });
      
      // Extract global inputs
      const globalInputs = tasksJson.inputs;
      
      // Store global inputs in a custom event for the context to pick up
      if (globalInputs && globalInputs.length > 0) {
        window.dispatchEvent(new CustomEvent("tasks:global-inputs-loaded", {
          detail: { inputs: globalInputs },
        }));
      }
      
      if (tasksJson.tasks && Array.isArray(tasksJson.tasks)) {
        for (const vscodeTask of tasksJson.tasks) {
          if (vscodeTask.label) {
            tasks.push(convertVSCodeTask(vscodeTask, cwd, globalInputs));
          }
        }
      }
      
      tasksLogger.debug(`Loaded ${tasks.length} task(s) from .vscode/tasks.json`);
    } catch (e) {
      tasksLogger.warn("Failed to parse .vscode/tasks.json:", e);
    }
    
    return tasks;
  },
});

const createBuiltInProviders = (): TaskProvider[] => [
  createVSCodeTasksProvider(),
  createNpmProvider(),
  createYarnProvider(),
  createCargoProvider(),
  createMakefileProvider(),
  createPyprojectProvider(),
  createDockerProvider(),
];

// Config files to watch for auto-refresh
const CONFIG_FILES_TO_WATCH = [
  ".vscode/tasks.json",
  "package.json", "yarn.lock", "Cargo.toml",
  "Makefile", "makefile", "GNUmakefile", "pyproject.toml",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml",
];

const TasksContext = createContext<TasksContextValue>();

// ============================================================================
// Provider
// ============================================================================

export const TasksProvider: ParentComponent = (props) => {
  const sdk = useSDK();
  const terminals = useTerminals();

  const [state, setState] = createStore<TasksState>({
    tasks: [],
    detectedTasks: [],
    recentTasks: [],
    runningTasks: [],
    backgroundTasks: [],
    taskHistory: [],
    taskProviders: [],
    watchedFiles: [],
    isDetecting: false,
    lastDetectionTime: null,
    showTasksPanel: false,
    showRunDialog: false,
    showConfigEditor: false,
    showRunOnSaveConfig: false,
    showInputPrompt: false,
    currentInputPrompt: null,
    selectedTask: null,
    editingTask: null,
    runOnSave: [],
    runOnSaveEnabled: true,
    folderOpenTasksStarted: false,
    globalInputs: [],
    commandHandlers: new Map(),
    executions: new Map(),
  });

  const [initialized, setInitialized] = createSignal(false);

  // Event listeners for task events
  const taskStartListeners = new Set<(event: TaskStartEvent) => void>();
  const taskEndListeners = new Set<(event: TaskEndEvent) => void>();
  const taskProcessStartListeners = new Set<(event: TaskProcessStartEvent) => void>();
  const taskProcessEndListeners = new Set<(event: TaskProcessEndEvent) => void>();

  // ============================================================================
  // OS Detection
  // ============================================================================

  const getCurrentOS = (): 'windows' | 'linux' | 'osx' => detectOS();

  const resolveOSConfig = (task: TaskConfig): TaskConfig => mergeOSConfig(task, getCurrentOS());

  // Debounce timers for run on save
  const runOnSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // ============================================================================
  // Input Variable Resolution
  // ============================================================================

  /**
   * Prompt user for an input variable value
   */
  const promptForInput = (input: TaskInputVariable, taskLabel: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setState("currentInputPrompt", { input, taskLabel, resolve });
      setState("showInputPrompt", true);
    });
  };

  /**
   * Resolve the input prompt with a value
   */
  const resolveInputPrompt = (value: string | null) => {
    const prompt = state.currentInputPrompt;
    if (prompt) {
      prompt.resolve(value);
    }
    setState("showInputPrompt", false);
    setState("currentInputPrompt", null);
  };

  /**
   * Find an input variable definition by ID
   */
  const findInputVariable = (id: string, task: TaskConfig): TaskInputVariable | undefined => {
    // First check task-specific inputs
    if (task.inputs) {
      const found = task.inputs.find(i => i.id === id);
      if (found) return found;
    }
    // Then check global inputs
    return state.globalInputs.find(i => i.id === id);
  };

  /**
   * Resolve all input variables needed for a task
   */
  const resolveAllInputVariables = async (
    task: TaskConfig,
    existingInputs?: Record<string, string>
  ): Promise<Record<string, string> | null> => {
    const resolved: Record<string, string> = { ...existingInputs };
    const inputIds = extractTaskInputVariableIds(task);
    
    for (const inputId of inputIds) {
      // Skip if already resolved
      if (inputId in resolved) continue;
      
      const inputDef = findInputVariable(inputId, task);
      if (!inputDef) {
        console.warn(`[Tasks] Input variable "${inputId}" not found for task "${task.label}"`);
        continue;
      }
      
      let value: string | null = null;
      
      switch (inputDef.type) {
        case 'promptString':
          value = await promptForInput(inputDef, task.label);
          break;
          
        case 'pickString':
          value = await promptForInput(inputDef, task.label);
          break;
          
        case 'command':
          if (inputDef.command) {
            value = await resolveCommandVariable(inputDef.command, inputDef.args);
          }
          break;
      }
      
      // If user cancelled, return null
      if (value === null && inputDef.type !== 'command') {
        return null;
      }
      
      // Use default if no value
      resolved[inputId] = value ?? inputDef.default ?? '';
    }
    
    return resolved;
  };

  // ============================================================================
  // Command Variable Resolution
  // ============================================================================

  /**
   * Register a command handler for ${command:id} variables
   */
  const registerCommandHandler = (
    commandId: string,
    handler: (args?: Record<string, unknown>) => Promise<string>
  ) => {
    setState(produce(s => {
      s.commandHandlers.set(commandId, handler);
    }));
    tasksLogger.debug(`Registered command handler: ${commandId}`);
  };

  /**
   * Unregister a command handler
   */
  const unregisterCommandHandler = (commandId: string) => {
    setState(produce(s => {
      s.commandHandlers.delete(commandId);
    }));
  };

  /**
   * Resolve a command variable by executing its handler
   */
  const resolveCommandVariable = async (
    commandId: string,
    args?: Record<string, unknown>
  ): Promise<string | null> => {
    const handler = state.commandHandlers.get(commandId);
    if (!handler) {
      tasksLogger.warn(`No handler registered for command: ${commandId}`);
      
      // Try built-in commands
      const builtinResult = await resolveBuiltinCommand(commandId, args);
      if (builtinResult !== null) return builtinResult;
      
      return null;
    }
    
    try {
      return await handler(args);
    } catch (error) {
      tasksLogger.error(`Command handler failed for "${commandId}":`, error);
      return null;
    }
  };

  /**
   * Resolve built-in command variables
   */
  const resolveBuiltinCommand = async (
    commandId: string,
    _args?: Record<string, unknown>
  ): Promise<string | null> => {
    const projectPath = sdk.state.config.cwd || getProjectPath() || ".";
    const vars = getTaskVariables(projectPath);
    
    switch (commandId) {
      case 'workbench.action.tasks.pickInput':
        // Return the selected text or prompt
        return vars.selectedText || null;
      
      case 'extension.commandvariable.file.relativeFilePosix':
        return vars.relativeFile.replace(/\\/g, '/');
      
      case 'extension.commandvariable.file.relativeFileAsPath':
        return vars.relativeFile;
      
      case 'extension.commandvariable.workspace.folderBasename':
        return vars.workspaceFolderBasename;
      
      default:
        // Dispatch event to allow extensions to handle
        const event = new CustomEvent("tasks:resolve-command", {
          detail: { commandId, result: null },
        });
        window.dispatchEvent(event);
        return (event.detail as { result: string | null }).result;
    }
  };

  /**
   * Resolve all command variables in a string
   */
  const resolveAllCommandVariables = async (str: string): Promise<string> => {
    const commandIds = extractCommandVariableIds(str);
    const resolved: Record<string, string> = {};
    
    for (const commandId of commandIds) {
      const value = await resolveCommandVariable(commandId);
      if (value !== null) {
        resolved[commandId] = value;
      }
    }
    
    return substituteCommandVariables(str, resolved);
  };

  // ============================================================================
  // Task Events
  // ============================================================================

  /**
   * Emit a task start event
   */
  const emitTaskStart = (execution: TaskExecution) => {
    const event: TaskStartEvent = { execution };
    taskStartListeners.forEach(listener => listener(event));
    window.dispatchEvent(new CustomEvent("tasks:on-did-start-task", { detail: event }));
  };

  /**
   * Emit a task end event
   */
  const emitTaskEnd = (execution: TaskExecution, exitCode?: number) => {
    const event: TaskEndEvent = { execution, exitCode };
    taskEndListeners.forEach(listener => listener(event));
    window.dispatchEvent(new CustomEvent("tasks:on-did-end-task", { detail: event }));
  };

  /**
   * Emit a task process start event
   */
  const emitTaskProcessStart = (execution: TaskExecution, processId: number) => {
    const event: TaskProcessStartEvent = { execution, processId };
    taskProcessStartListeners.forEach(listener => listener(event));
    window.dispatchEvent(new CustomEvent("tasks:on-did-start-task-process", { detail: event }));
  };

  /**
   * Emit a task process end event
   */
  const emitTaskProcessEnd = (execution: TaskExecution, exitCode: number) => {
    const event: TaskProcessEndEvent = { execution, exitCode };
    taskProcessEndListeners.forEach(listener => listener(event));
    window.dispatchEvent(new CustomEvent("tasks:on-did-end-task-process", { detail: event }));
  };

  /**
   * Subscribe to task start events
   */
  const onDidStartTask = (callback: (event: TaskStartEvent) => void): (() => void) => {
    taskStartListeners.add(callback);
    return () => taskStartListeners.delete(callback);
  };

  /**
   * Subscribe to task end events
   */
  const onDidEndTask = (callback: (event: TaskEndEvent) => void): (() => void) => {
    taskEndListeners.add(callback);
    return () => taskEndListeners.delete(callback);
  };

  /**
   * Subscribe to task process start events
   */
  const onDidStartTaskProcess = (callback: (event: TaskProcessStartEvent) => void): (() => void) => {
    taskProcessStartListeners.add(callback);
    return () => taskProcessStartListeners.delete(callback);
  };

  /**
   * Subscribe to task process end events
   */
  const onDidEndTaskProcess = (callback: (event: TaskProcessEndEvent) => void): (() => void) => {
    taskProcessEndListeners.add(callback);
    return () => taskProcessEndListeners.delete(callback);
  };

  /**
   * Create a task execution object
   */
  const createTaskExecution = (task: TaskConfig, runId: string, terminalId?: string): TaskExecution => {
    const execution: TaskExecution = {
      id: runId,
      task: {
        label: task.label,
        type: task.type,
        source: task.source,
        group: task.group,
      },
      terminalId,
    };
    
    setState(produce(s => {
      s.executions.set(runId, execution);
    }));
    
    return execution;
  };

  // ============================================================================
  // Task Reconnection
  // ============================================================================

  /**
   * Save running tasks for reconnection after reload
   */
  const saveTasksForReconnection = () => {
    const tasksToSave: TaskReconnectState[] = [];
    
    // Save background tasks for reconnection
    for (const task of state.backgroundTasks) {
      if (task.status === 'running' && task.reconnectable !== false) {
        tasksToSave.push({
          taskLabel: task.taskLabel,
          terminalId: task.terminalId,
          config: task.config,
          startedAt: task.startedAt,
          isBackground: true,
          resolvedInputs: task.resolvedInputs,
        });
      }
    }
    
    // Save regular tasks marked as reconnectable
    for (const task of state.runningTasks) {
      if (task.status === 'running' && task.reconnectable) {
        tasksToSave.push({
          taskLabel: task.taskLabel,
          terminalId: task.terminalId,
          config: task.config,
          startedAt: task.startedAt,
          isBackground: false,
          resolvedInputs: task.resolvedInputs,
        });
      }
    }
    
    try {
      localStorage.setItem(TASKS_RECONNECT_KEY, JSON.stringify(tasksToSave));
    } catch (e) {
      tasksLogger.error("Failed to save tasks for reconnection:", e);
    }
  };

  /**
   * Load and reconnect to tasks that were running before reload
   */
  const reconnectTasks = async () => {
    try {
      const stored = localStorage.getItem(TASKS_RECONNECT_KEY);
      if (!stored) return;
      
      const tasksToReconnect: TaskReconnectState[] = JSON.parse(stored);
      
      // Clear the stored state
      localStorage.removeItem(TASKS_RECONNECT_KEY);
      
      if (tasksToReconnect.length === 0) return;
      
      tasksLogger.debug(`Reconnecting to ${tasksToReconnect.length} task(s)...`);
      
      for (const savedTask of tasksToReconnect) {
        // Check if terminal still exists
        const terminalExists = terminals.state.terminals.some(
          t => t.id === savedTask.terminalId
        );
        
        if (!terminalExists) {
          tasksLogger.debug(`Terminal ${savedTask.terminalId} no longer exists, skipping reconnection for "${savedTask.taskLabel}"`);
          continue;
        }
        
        // Recreate the task run
        const runId = crypto.randomUUID();
        const taskRun: TaskRun = {
          id: runId,
          taskLabel: savedTask.taskLabel,
          config: savedTask.config,
          terminalId: savedTask.terminalId,
          status: "running",
          startedAt: savedTask.startedAt,
          output: [],
          isBackground: savedTask.isBackground,
          backgroundStatus: savedTask.isBackground ? "watching" : undefined,
          resolvedInputs: savedTask.resolvedInputs,
          reconnectable: true,
        };
        
        if (savedTask.isBackground) {
          setState(produce(s => {
            s.backgroundTasks.push(taskRun);
          }));
        } else {
          setState(produce(s => {
            s.runningTasks.push(taskRun);
          }));
        }
        
        // Create execution for event tracking
        createTaskExecution(savedTask.config, runId, savedTask.terminalId);
        
        tasksLogger.debug(`Reconnected to task "${savedTask.taskLabel}"`);
      }
    } catch (e) {
      tasksLogger.error("Failed to reconnect tasks:", e);
    }
  };

  // ============================================================================
  // Task Management
  // ============================================================================

  const addTask = (task: TaskConfig) => {
    setState(produce((s) => {
      const existingIndex = s.tasks.findIndex(t => t.label === task.label);
      if (existingIndex >= 0) {
        s.tasks[existingIndex] = task;
      } else {
        s.tasks.push({ ...task, source: "user" });
      }
    }));
    saveTasks();
  };

  const updateTask = (label: string, updates: Partial<TaskConfig>) => {
    setState(produce((s) => {
      const task = s.tasks.find(t => t.label === label);
      if (task) {
        Object.assign(task, updates);
      }
    }));
    saveTasks();
  };

  const removeTask = (label: string) => {
    setState(produce((s) => {
      s.tasks = s.tasks.filter(t => t.label !== label);
    }));
    saveTasks();
  };

  // ============================================================================
  // Task Execution
  // ============================================================================

  const runTask = async (task: TaskConfig, resolvedInputs?: Record<string, string>) => {
    // Check if we should run in terminal by default (VS Code-style behavior)
    // This delegates to runTaskInTerminal for proper terminal integration
    if (getRunInTerminalDefault()) {
      return runTaskInTerminal(task, resolvedInputs);
    }
    
    // Check instance policy
    const policyCheck = checkInstancePolicy(task, state.runningTasks, state.backgroundTasks);
    if (!policyCheck.canRun) {
      if (policyCheck.action === 'prompt') {
        // Notify user that task is already running and instance policy blocks new runs
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            message: `Task "${task.label}" is already running. Please wait for it to complete or terminate it before running again.`,
          },
        }));
        tasksLogger.warn(`Task "${task.label}" is already running. Instance policy: prompt`);
        return;
      }
      if (policyCheck.action === 'terminate') {
        tasksLogger.debug(`Task "${task.label}" blocked by terminateNewest policy`);
        return;
      }
    }
    
    // Handle termination of existing instance if needed
    if (policyCheck.taskToTerminate) {
      tasksLogger.debug(`Terminating existing instance of "${task.label}" due to terminateOldest policy`);
      await cancelTask(policyCheck.taskToTerminate.id);
    }
    
    // Show warning if needed
    if (policyCheck.action === 'warn') {
      tasksLogger.warn(`Starting another instance of "${task.label}" (already running)`);
    }

    const runId = crypto.randomUUID();
    
    // Resolve OS-specific configuration
    const resolvedTask = resolveOSConfig(task);
    
    // Resolve input variables if needed
    let inputs: Record<string, string> | undefined = resolvedInputs;
    const inputIds = extractTaskInputVariableIds(resolvedTask);
    if (inputIds.length > 0 && !inputs) {
      // Check if we should reevaluate on rerun
      if (resolvedTask.runOptions?.reevaluateOnRerun !== false || !resolvedInputs) {
        const resolvedVars = await resolveAllInputVariables(resolvedTask, resolvedInputs);
        if (resolvedVars === null) {
          tasksLogger.debug(`Task "${resolvedTask.label}" cancelled - user cancelled input prompt`);
          return;
        }
        inputs = resolvedVars;
      }
    }
    
    // Resolve dependencies
    if (resolvedTask.dependsOn && resolvedTask.dependsOn.length > 0) {
      const dependsOrder = resolvedTask.dependsOrder || 'sequence';
      
      if (dependsOrder === 'parallel') {
        // Run all dependencies in parallel
        const depPromises = resolvedTask.dependsOn.map(async (depLabel) => {
          const depTask = allTasks().find(t => t.label === depLabel);
          if (depTask) {
            await runTask(depTask);
          }
        });
        await Promise.all(depPromises);
      } else {
        // Run dependencies sequentially
        for (const depLabel of resolvedTask.dependsOn) {
          const depTask = allTasks().find(t => t.label === depLabel);
          if (depTask) {
            await runTask(depTask);
          }
        }
      }
    }

    // Get the project path for variable substitution
    const projectPath = sdk.state.config.cwd || getProjectPath() || ".";

    // Apply all variable substitutions
    let substitutedCommand = substituteTaskVariables(resolvedTask.command, projectPath);
    let substitutedArgs = resolvedTask.args?.map(arg => substituteTaskVariables(arg, projectPath));
    let substitutedCwd = resolvedTask.cwd ? substituteTaskVariables(resolvedTask.cwd, projectPath) : undefined;

    // Substitute input variables
    if (inputs) {
      substitutedCommand = substituteInputVariables(substitutedCommand, inputs);
      substitutedArgs = substitutedArgs?.map(arg => substituteInputVariables(arg, inputs!));
      if (substitutedCwd) {
        substitutedCwd = substituteInputVariables(substitutedCwd, inputs);
      }
    }

    // Resolve command variables
    if (hasCommandVariables(substitutedCommand)) {
      substitutedCommand = await resolveAllCommandVariables(substitutedCommand);
    }
    if (substitutedArgs) {
      substitutedArgs = await Promise.all(
        substitutedArgs.map(arg => hasCommandVariables(arg) ? resolveAllCommandVariables(arg) : arg)
      );
    }

    // Build command with proper shell quoting
    const fullCommand = buildShellCommand(substitutedCommand, substitutedArgs, resolvedTask.shell);

    // Create task run record
    const taskRun: TaskRun = {
      id: runId,
      taskLabel: resolvedTask.label,
      config: resolvedTask,
      terminalId: "",
      status: "pending",
      startedAt: Date.now(),
      output: [],
      resolvedInputs: inputs,
    };

    setState(produce((s) => {
      s.runningTasks.push(taskRun);
    }));

    // Create execution and emit start event
    const execution = createTaskExecution(resolvedTask, runId);
    emitTaskStart(execution);

    // Update recent tasks
    updateRecentTask(resolvedTask.label);

    try {
      // Use SDK to send command that will create a terminal
      const cwd = substitutedCwd || sdk.state.config.cwd || ".";
      
      // Build environment string with variable substitution
      let envPrefix = "";
      if (resolvedTask.env) {
        const envEntries = Object.entries(resolvedTask.env);
        if (envEntries.length > 0) {
          // Substitute variables in environment variable values
          // For Windows, use SET commands
          envPrefix = envEntries.map(([k, v]) => {
            let substitutedValue = substituteTaskVariables(v, projectPath);
            if (inputs) {
              substitutedValue = substituteInputVariables(substitutedValue, inputs);
            }
            return `set "${k}=${substitutedValue}" && `;
          }).join("");
        }
      }

      // Execute via the agent or direct terminal
      const message = `Run this command in directory "${cwd}": ${envPrefix}${fullCommand}`;
      
      setState(produce((s) => {
        const run = s.runningTasks.find(r => r.id === runId);
        if (run) {
          run.status = "running";
        }
      }));

      // Send message to execute
      await sdk.sendMessage(message);
      
    } catch (error) {
      console.error("[Tasks] Failed to run task:", error);
      setState(produce((s) => {
        const run = s.runningTasks.find(r => r.id === runId);
        if (run) {
          run.status = "failed";
          run.finishedAt = Date.now();
        }
      }));
      
      // Emit end event with no exit code (error)
      emitTaskEnd(execution, undefined);
    }
  };

  const runTaskByLabel = async (label: string) => {
    const task = allTasks().find(t => t.label === label);
    if (task) {
      await runTask(task);
    } else {
      console.warn(`[Tasks] Task not found: ${label}`);
    }
  };

  const runBuildTask = async () => {
    const task = defaultBuildTask();
    if (task) {
      await runTask(task);
    } else {
      // Show run dialog if no default build task
      openRunDialog();
    }
  };

  const runTestTask = async () => {
    const task = defaultTestTask();
    if (task) {
      await runTask(task);
    } else {
      // Try to find any test task
      const testTasks = allTasks().filter(t => t.group === "test");
      if (testTasks.length === 1) {
        await runTask(testTasks[0]);
      } else {
        openRunDialog();
      }
    }
  };

  /**
   * Run a task directly in the integrated terminal.
   * Creates a new terminal with the task name and executes the command there.
   */
  const runTaskInTerminal = async (task: TaskConfig, resolvedInputs?: Record<string, string>) => {
    // Check instance policy
    const policyCheck = checkInstancePolicy(task, state.runningTasks, state.backgroundTasks);
    if (!policyCheck.canRun) {
      if (policyCheck.action === 'prompt') {
        tasksLogger.warn(`Task "${task.label}" is already running. Instance policy: prompt`);
        return;
      }
      if (policyCheck.action === 'terminate') {
        tasksLogger.debug(`Task "${task.label}" blocked by terminateNewest policy`);
        return;
      }
    }
    
    if (policyCheck.taskToTerminate) {
      await cancelTask(policyCheck.taskToTerminate.id);
    }

    const runId = crypto.randomUUID();
    
    // Resolve OS-specific configuration
    const resolvedTask = resolveOSConfig(task);
    
    // Resolve input variables if needed
    let inputs: Record<string, string> | undefined = resolvedInputs;
    const inputIds = extractTaskInputVariableIds(resolvedTask);
    if (inputIds.length > 0 && !inputs) {
      if (resolvedTask.runOptions?.reevaluateOnRerun !== false || !resolvedInputs) {
        const resolvedVars = await resolveAllInputVariables(resolvedTask, resolvedInputs);
        if (resolvedVars === null) {
          tasksLogger.debug(`Task "${resolvedTask.label}" cancelled - user cancelled input prompt`);
          return;
        }
        inputs = resolvedVars;
      }
    }
    
    // Resolve dependencies
    if (resolvedTask.dependsOn && resolvedTask.dependsOn.length > 0) {
      const dependsOrder = resolvedTask.dependsOrder || 'sequence';
      
      if (dependsOrder === 'parallel') {
        const depPromises = resolvedTask.dependsOn.map(async (depLabel) => {
          const depTask = allTasks().find(t => t.label === depLabel);
          if (depTask) {
            await runTaskInTerminal(depTask);
          }
        });
        await Promise.all(depPromises);
      } else {
        for (const depLabel of resolvedTask.dependsOn) {
          const depTask = allTasks().find(t => t.label === depLabel);
          if (depTask) {
            await runTaskInTerminal(depTask);
          }
        }
      }
    }

    // Get the project path for variable substitution
    const projectPath = sdk.state.config.cwd || getProjectPath() || ".";

    // Apply all variable substitutions
    let substitutedCommand = substituteTaskVariables(resolvedTask.command, projectPath);
    let substitutedArgs = resolvedTask.args?.map(arg => substituteTaskVariables(arg, projectPath));
    let substitutedCwd = resolvedTask.cwd ? substituteTaskVariables(resolvedTask.cwd, projectPath) : undefined;

    // Substitute input variables
    if (inputs) {
      substitutedCommand = substituteInputVariables(substitutedCommand, inputs);
      substitutedArgs = substitutedArgs?.map(arg => substituteInputVariables(arg, inputs!));
      if (substitutedCwd) {
        substitutedCwd = substituteInputVariables(substitutedCwd, inputs);
      }
    }

    // Resolve command variables
    if (hasCommandVariables(substitutedCommand)) {
      substitutedCommand = await resolveAllCommandVariables(substitutedCommand);
    }
    if (substitutedArgs) {
      substitutedArgs = await Promise.all(
        substitutedArgs.map(arg => hasCommandVariables(arg) ? resolveAllCommandVariables(arg) : arg)
      );
    }

    // Build command with proper shell quoting
    let fullCommand = buildShellCommand(substitutedCommand, substitutedArgs, resolvedTask.shell);

    // Build environment variable prefix
    if (resolvedTask.env) {
      const envEntries = Object.entries(resolvedTask.env);
      if (envEntries.length > 0) {
        const currentOS = getCurrentOS();
        const envPrefix = envEntries.map(([k, v]) => {
          let substitutedValue = substituteTaskVariables(v, projectPath);
          if (inputs) {
            substitutedValue = substituteInputVariables(substitutedValue, inputs);
          }
          // Use appropriate syntax for the OS
          if (currentOS === 'windows') {
            return `set "${k}=${substitutedValue}" && `;
          } else {
            return `export ${k}="${substitutedValue}" && `;
          }
        }).join("");
        fullCommand = envPrefix + fullCommand;
      }
    }

    // Update recent tasks
    updateRecentTask(resolvedTask.label);

    try {
      // Create a new terminal with the task name
      const cwd = substitutedCwd || sdk.state.config.cwd || ".";
      
      // Determine panel behavior based on presentation options
      const presentation = resolvedTask.presentation;
      let terminalName = `Task: ${resolvedTask.label}`;
      
      // Handle panel sharing
      if (presentation?.panel === 'shared' && presentation?.group) {
        terminalName = `Task Group: ${presentation.group}`;
      }
      
      const terminal = await terminals.createTerminal({
        name: terminalName,
        cwd,
      });

      // Create task run record
      const taskRun: TaskRun = {
        id: runId,
        taskLabel: resolvedTask.label,
        config: resolvedTask,
        terminalId: terminal.id,
        status: "running",
        startedAt: Date.now(),
        output: [],
        resolvedInputs: inputs,
        reconnectable: resolvedTask.isBackground,
      };

      setState(produce((s) => {
        s.runningTasks.push(taskRun);
      }));

      // Create execution and emit start event
      const execution = createTaskExecution(resolvedTask, runId, terminal.id);
      emitTaskStart(execution);

      // Handle presentation options
      if (presentation?.reveal !== 'never') {
        terminals.openTerminal(terminal.id);
        
        if (presentation?.focus) {
          // Focus the terminal
          terminals.setActiveTerminal(terminal.id);
        }
      }
      
      // Clear terminal if requested
      if (presentation?.clear) {
        await terminals.writeToTerminal(terminal.id, "\x1b[2J\x1b[H"); // ANSI clear screen
      }

      // Echo the command if enabled (default true)
      if (presentation?.echo !== false) {
        await terminals.writeToTerminal(terminal.id, `> ${fullCommand}\r\n`);
      }

      // Write the command to the terminal followed by newline to execute
      await terminals.writeToTerminal(terminal.id, fullCommand + "\r");
      
      tasksLogger.debug(`Running task "${resolvedTask.label}" in terminal: ${fullCommand}`);
      
      // Save for reconnection if it's a background task
      if (resolvedTask.isBackground) {
        saveTasksForReconnection();
      }
      
    } catch (error) {
      tasksLogger.error("Failed to run task in terminal:", error);
      setState(produce((s) => {
        const run = s.runningTasks.find(r => r.id === runId);
        if (run) {
          run.status = "failed";
          run.finishedAt = Date.now();
        }
      }));
    }
  };

  const cancelTask = async (runId: string) => {
    const run = state.runningTasks.find(r => r.id === runId);
    if (run && run.terminalId) {
      // Use terminals API directly if the task is running in a terminal
      try {
        // Send Ctrl+C to terminate the running process
        await terminals.writeToTerminal(run.terminalId, "\x03"); // Ctrl+C
        // Give the process a moment to terminate gracefully
        await new Promise(resolve => setTimeout(resolve, 100));
        // Close the terminal
        await terminals.closeTerminal(run.terminalId);
      } catch (e) {
        tasksLogger.debug(`Error closing terminal for task ${runId}:`, e);
        // Try fallback via SDK
        sdk.sendMessage(`Kill terminal ${run.terminalId}`);
      }
    }
    
    setState(produce((s) => {
      const run = s.runningTasks.find(r => r.id === runId);
      if (run) {
        run.status = "cancelled";
        run.finishedAt = Date.now();
      }
    }));
  };

  const rerunTask = async (run: TaskRun) => {
    await runTask(run.config);
  };

  // ============================================================================
  // Background Task Execution
  // ============================================================================

  /**
   * Helper to extract the regex string from a background pattern
   */
  const getBackgroundPatternRegex = (pattern: string | { regexp: string } | undefined): RegExp | null => {
    if (!pattern) return null;
    const regexStr = typeof pattern === "string" ? pattern : pattern.regexp;
    try {
      return new RegExp(regexStr);
    } catch {
      tasksLogger.warn(`Invalid background pattern regex: ${regexStr}`);
      return null;
    }
  };

  /**
   * Check if a line matches a background pattern
   */
  const matchesBackgroundPattern = (line: string, pattern: string | { regexp: string } | undefined): boolean => {
    const regex = getBackgroundPatternRegex(pattern);
    return regex ? regex.test(line) : false;
  };

  /**
   * Run a background task (watch mode, etc.) that doesn't wait for completion.
   * Returns the run ID for tracking.
   */
  const runBackgroundTask = async (task: TaskConfig, resolvedInputs?: Record<string, string>): Promise<string> => {
    // Check instance policy
    const policyCheck = checkInstancePolicy(task, state.runningTasks, state.backgroundTasks);
    if (!policyCheck.canRun) {
      if (policyCheck.action === 'prompt') {
        tasksLogger.warn(`Background task "${task.label}" is already running. Instance policy: prompt`);
        return "";
      }
      if (policyCheck.action === 'terminate') {
        tasksLogger.debug(`Background task "${task.label}" blocked by terminateNewest policy`);
        return "";
      }
    }
    
    if (policyCheck.taskToTerminate) {
      stopBackgroundTask(policyCheck.taskToTerminate.id);
    }

    const runId = crypto.randomUUID();
    
    // Resolve OS-specific configuration
    const resolvedTask = resolveOSConfig(task);
    
    // Resolve input variables if needed
    let inputs: Record<string, string> | undefined = resolvedInputs;
    const inputIds = extractTaskInputVariableIds(resolvedTask);
    if (inputIds.length > 0 && !inputs) {
      if (resolvedTask.runOptions?.reevaluateOnRerun !== false || !resolvedInputs) {
        const resolvedVars = await resolveAllInputVariables(resolvedTask, resolvedInputs);
        if (resolvedVars === null) {
          tasksLogger.debug(`Background task "${resolvedTask.label}" cancelled - user cancelled input prompt`);
          return "";
        }
        inputs = resolvedVars;
      }
    }
    
    // Resolve dependencies
    if (resolvedTask.dependsOn && resolvedTask.dependsOn.length > 0) {
      const dependsOrder = resolvedTask.dependsOrder || 'sequence';
      
      if (dependsOrder === 'parallel') {
        const depPromises = resolvedTask.dependsOn.map(async (depLabel) => {
          const depTask = allTasks().find(t => t.label === depLabel);
          if (depTask) {
            if (depTask.isBackground) {
              await runBackgroundTask(depTask);
            } else {
              await runTask(depTask);
            }
          }
        });
        await Promise.all(depPromises);
      } else {
        for (const depLabel of resolvedTask.dependsOn) {
          const depTask = allTasks().find(t => t.label === depLabel);
          if (depTask) {
            if (depTask.isBackground) {
              await runBackgroundTask(depTask);
            } else {
              await runTask(depTask);
            }
          }
        }
      }
    }

    // Get the project path for variable substitution
    const projectPath = sdk.state.config.cwd || getProjectPath() || ".";

    // Apply all variable substitutions
    let substitutedCommand = substituteTaskVariables(resolvedTask.command, projectPath);
    let substitutedArgs = resolvedTask.args?.map(arg => substituteTaskVariables(arg, projectPath));
    let substitutedCwd = resolvedTask.cwd ? substituteTaskVariables(resolvedTask.cwd, projectPath) : undefined;

    // Substitute input variables
    if (inputs) {
      substitutedCommand = substituteInputVariables(substitutedCommand, inputs);
      substitutedArgs = substitutedArgs?.map(arg => substituteInputVariables(arg, inputs!));
      if (substitutedCwd) {
        substitutedCwd = substituteInputVariables(substitutedCwd, inputs);
      }
    }

    // Resolve command variables
    if (hasCommandVariables(substitutedCommand)) {
      substitutedCommand = await resolveAllCommandVariables(substitutedCommand);
    }
    if (substitutedArgs) {
      substitutedArgs = await Promise.all(
        substitutedArgs.map(arg => hasCommandVariables(arg) ? resolveAllCommandVariables(arg) : arg)
      );
    }

    // Build command with proper shell quoting
    const fullCommand = buildShellCommand(substitutedCommand, substitutedArgs, resolvedTask.shell);

    // Determine initial background status
    let initialBackgroundStatus: BackgroundTaskStatus = "watching";
    const matchers = resolvedTask.problemMatcher ? resolveProblemMatcher(resolvedTask.problemMatcher) : [];
    const hasBackground = matchers.some(m => m.background);
    
    if (hasBackground) {
      const backgroundMatcher = matchers.find(m => m.background)?.background;
      if (backgroundMatcher?.activeOnStart !== false) {
        initialBackgroundStatus = "compiling";
      }
    }

    // Create task run record for background task
    const taskRun: TaskRun = {
      id: runId,
      taskLabel: resolvedTask.label,
      config: resolvedTask,
      terminalId: "",
      status: "running",
      startedAt: Date.now(),
      output: [],
      isBackground: true,
      backgroundStatus: initialBackgroundStatus,
      lastCompileStart: initialBackgroundStatus === "compiling" ? Date.now() : undefined,
      resolvedInputs: inputs,
      reconnectable: true,
    };

    setState(produce((s) => {
      s.backgroundTasks.push(taskRun);
    }));

    // Create execution and emit start event
    const execution = createTaskExecution(resolvedTask, runId);
    emitTaskStart(execution);

    // Update recent tasks
    updateRecentTask(resolvedTask.label);

    try {
      // Use SDK to send command that will create a terminal
      const cwd = substitutedCwd || sdk.state.config.cwd || ".";
      
      // Build environment string with variable substitution
      let envPrefix = "";
      if (resolvedTask.env) {
        const envEntries = Object.entries(resolvedTask.env);
        if (envEntries.length > 0) {
          const currentOS = getCurrentOS();
          envPrefix = envEntries.map(([k, v]) => {
            let substitutedValue = substituteTaskVariables(v, projectPath);
            if (inputs) {
              substitutedValue = substituteInputVariables(substitutedValue, inputs);
            }
            if (currentOS === 'windows') {
              return `set "${k}=${substitutedValue}" && `;
            } else {
              return `export ${k}="${substitutedValue}" && `;
            }
          }).join("");
        }
      }

      // Execute via the agent or direct terminal
      const message = `Run this command in directory "${cwd}": ${envPrefix}${fullCommand}`;
      
      tasksLogger.debug(`Starting background task "${resolvedTask.label}": ${fullCommand}`);
      
      // Send message to execute (don't await completion)
      sdk.sendMessage(message);
      
      // Save for reconnection
      saveTasksForReconnection();
      
    } catch (error) {
      tasksLogger.error("Failed to start background task:", error);
      setState(produce((s) => {
        const run = s.backgroundTasks.find(r => r.id === runId);
        if (run) {
          run.status = "failed";
          run.backgroundStatus = "error";
          run.finishedAt = Date.now();
        }
      }));
      
      // Emit end event
      const execution = state.executions.get(runId);
      if (execution) {
        emitTaskEnd(execution, undefined);
      }
    }

    return runId;
  };

  /**
   * Stop a running background task
   */
  const stopBackgroundTask = (runId: string) => {
    const run = state.backgroundTasks.find(r => r.id === runId);
    if (run && run.terminalId) {
      sdk.sendMessage(`Kill terminal ${run.terminalId}`);
    }
    
    setState(produce((s) => {
      const runToUpdate = s.backgroundTasks.find(r => r.id === runId);
      if (runToUpdate) {
        runToUpdate.status = "cancelled";
        runToUpdate.backgroundStatus = "idle";
        runToUpdate.finishedAt = Date.now();
        // Move to history
        s.taskHistory.unshift(runToUpdate);
        s.backgroundTasks = s.backgroundTasks.filter(r => r.id !== runId);
      }
    }));

    tasksLogger.debug(`Stopped background task: ${run?.taskLabel}`);
  };

  /**
   * Update background task status based on output line
   */
  const updateBackgroundTaskStatus = (runId: string, line: string) => {
    const run = state.backgroundTasks.find(r => r.id === runId);
    if (!run || !run.isBackground) return;

    const matchers = run.config.problemMatcher ? resolveProblemMatcher(run.config.problemMatcher) : [];
    const backgroundMatcher = matchers.find(m => m.background)?.background;
    
    if (!backgroundMatcher) return;

    // Check for begins pattern (compilation started)
    if (matchesBackgroundPattern(line, backgroundMatcher.beginsPattern)) {
      setState(produce((s) => {
        const runToUpdate = s.backgroundTasks.find(r => r.id === runId);
        if (runToUpdate) {
          runToUpdate.backgroundStatus = "compiling";
          runToUpdate.lastCompileStart = Date.now();
        }
      }));
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent("task:background-status", {
        detail: { runId, status: "compiling", taskLabel: run.taskLabel },
      }));
      return;
    }

    // Check for ends pattern (compilation finished)
    if (matchesBackgroundPattern(line, backgroundMatcher.endsPattern)) {
      setState(produce((s) => {
        const runToUpdate = s.backgroundTasks.find(r => r.id === runId);
        if (runToUpdate) {
          runToUpdate.backgroundStatus = "watching";
          runToUpdate.lastCompileEnd = Date.now();
        }
      }));
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent("task:background-status", {
        detail: { runId, status: "watching", taskLabel: run.taskLabel },
      }));
    }
  };

  /**
   * Run tasks configured with runOn: "folderOpen"
   */
  const runFolderOpenTasks = async () => {
    if (state.folderOpenTasksStarted) {
      tasksLogger.debug("Folder open tasks already started, skipping");
      return;
    }

    const tasksToRun = allTasks().filter(t => t.runOptions?.runOn === "folderOpen");
    
    if (tasksToRun.length === 0) {
      tasksLogger.debug("No tasks configured with runOn: folderOpen");
      setState("folderOpenTasksStarted", true);
      return;
    }

    tasksLogger.debug(`Running ${tasksToRun.length} folder open task(s)...`);
    setState("folderOpenTasksStarted", true);

    for (const task of tasksToRun) {
      try {
        if (task.isBackground) {
          await runBackgroundTask(task);
        } else {
          await runTask(task);
        }
      } catch (error) {
        tasksLogger.error(`Failed to run folder open task "${task.label}":`, error);
      }
    }
  };

  // ============================================================================
  // Recent Tasks
  // ============================================================================

  const updateRecentTask = (label: string) => {
    setState(produce((s) => {
      const existing = s.recentTasks.find(t => t.taskLabel === label);
      if (existing) {
        existing.lastRun = Date.now();
        existing.runCount++;
      } else {
        s.recentTasks.unshift({
          taskLabel: label,
          lastRun: Date.now(),
          runCount: 1,
        });
      }
      // Keep only last 20 recent tasks
      s.recentTasks = s.recentTasks.slice(0, 20);
    }));
    saveRecentTasks();
  };

  // ============================================================================
  // Task Provider Registry
  // ============================================================================

  const registerProvider = (provider: TaskProvider) => {
    setState(produce((s) => {
      const existingIndex = s.taskProviders.findIndex(p => p.id === provider.id);
      if (existingIndex >= 0) {
        s.taskProviders[existingIndex] = provider;
      } else {
        s.taskProviders.push(provider);
      }
    }));
    tasksLogger.debug(`Registered provider: ${provider.name}`);
  };

  const unregisterProvider = (id: string) => {
    setState(produce((s) => {
      s.taskProviders = s.taskProviders.filter(p => p.id !== id);
    }));
    tasksLogger.debug(`Unregistered provider: ${id}`);
  };

  const getProvider = (id: string): TaskProvider | undefined => {
    return state.taskProviders.find(p => p.id === id);
  };

  const enableProvider = (id: string, enabled: boolean) => {
    setState(produce((s) => {
      const provider = s.taskProviders.find(p => p.id === id);
      if (provider) {
        provider.enabled = enabled;
      }
    }));
    // Re-detect tasks when provider enable state changes
    detectTasks();
  };

  const taskProviders: TaskProviderRegistry = {
    get providers() { return state.taskProviders; },
    register: registerProvider,
    unregister: unregisterProvider,
    getProvider,
    enableProvider,
  };

  // ============================================================================
  // Task Discovery
  // ============================================================================

  /**
   * Read a file via the direct Tauri IPC
   */
  const readFileViaServer = async (path: string): Promise<string | null> => {
    try {
      return await sdk.invoke("fs_read_file", { path });
    } catch {
      // File not found or error - return null
    }
    return null;
  };

  /**
   * Detect tasks using all enabled providers
   */
  const detectTasks = async () => {
    if (state.isDetecting) {
      tasksLogger.debug("Detection already in progress, skipping");
      return;
    }

    setState("isDetecting", true);
    const detected: TaskConfig[] = [];
    const cwd = sdk.state.config.cwd || ".";

    tasksLogger.debug(`Starting task detection in: ${cwd}`);

    try {
      // Use all enabled providers to detect tasks
      const enabledProviders = state.taskProviders.filter(p => p.enabled);
      
      for (const provider of enabledProviders) {
        try {
          tasksLogger.debug(`Running provider: ${provider.name}`);
          const providerTasks = await provider.detect(cwd, readFileViaServer);
          detected.push(...providerTasks);
          tasksLogger.debug(`Provider ${provider.name} found ${providerTasks.length} tasks`);
        } catch (error) {
          tasksLogger.error(`Provider ${provider.name} failed:`, error);
        }
      }

      setState("detectedTasks", detected);
      setState("lastDetectionTime", Date.now());

      // Update watched files list based on provider config files
      const filesToWatch = new Set<string>();
      for (const provider of state.taskProviders) {
        for (const configFile of provider.configFiles) {
          filesToWatch.add(`${cwd}/${configFile}`);
        }
      }
      setState("watchedFiles", Array.from(filesToWatch));

      tasksLogger.debug(`Detection complete: ${detected.length} tasks found`);
    } catch (error) {
      tasksLogger.error("Failed to detect tasks:", error);
    } finally {
      setState("isDetecting", false);
    }
  };

  /**
   * Check if a file path matches any watched config files
   */
  const isWatchedConfigFile = (filePath: string): boolean => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const fileName = normalizedPath.split("/").pop() || "";
    return CONFIG_FILES_TO_WATCH.includes(fileName);
  };

  /**
   * Handle file changes to trigger task re-detection
   */
  const handleConfigFileChanged = (filePath: string) => {
    if (isWatchedConfigFile(filePath)) {
      tasksLogger.debug(`Config file changed: ${filePath}, scheduling re-detection`);
      // Debounce re-detection
      setTimeout(() => detectTasks(), 500);
    }
  };

  const refreshTasks = async () => {
    await loadTasks();
    await detectTasks();
  };

  // ============================================================================
  // UI State
  // ============================================================================

  const openTasksPanel = () => setState("showTasksPanel", true);
  const closeTasksPanel = () => setState("showTasksPanel", false);
  const toggleTasksPanel = () => setState("showTasksPanel", !state.showTasksPanel);
  
  const openRunDialog = () => setState("showRunDialog", true);
  const closeRunDialog = () => setState("showRunDialog", false);
  
  const openConfigEditor = (task?: TaskConfig) => {
    setState("editingTask", task || null);
    setState("showConfigEditor", true);
  };
  const closeConfigEditor = () => {
    setState("showConfigEditor", false);
    setState("editingTask", null);
  };
  
  const setSelectedTask = (task: TaskConfig | null) => setState("selectedTask", task);
  
  const openRunOnSaveConfig = () => setState("showRunOnSaveConfig", true);
  const closeRunOnSaveConfig = () => setState("showRunOnSaveConfig", false);

  // ============================================================================
  // Run on Save
  // ============================================================================

  /**
   * Simple glob pattern matcher that supports:
   * - * matches any characters except /
   * - ** matches any characters including /
   * - ? matches a single character
   * - {...} matches any of the comma-separated patterns
   */
  const matchGlobPattern = (pattern: string, filePath: string): boolean => {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/");
    
    // Convert glob pattern to regex
    let regexPattern = normalizedPattern
      // Escape special regex characters (except *, ?, {, }, ,)
      .replace(/[.+^$|()[\]]/g, "\\$&")
      // Handle ** first (matches any path including /)
      .replace(/\*\*/g, "<<<GLOBSTAR>>>")
      // Handle * (matches anything except /)
      .replace(/\*/g, "[^/]*")
      // Handle ?
      .replace(/\?/g, "[^/]")
      // Restore globstar
      .replace(/<<<GLOBSTAR>>>/g, ".*");
    
    // Handle brace expansion {a,b,c}
    const braceMatch = regexPattern.match(/\{([^}]+)\}/);
    if (braceMatch) {
      const alternatives = braceMatch[1].split(",").map(s => s.trim());
      const alternativePattern = `(${alternatives.join("|")})`;
      regexPattern = regexPattern.replace(/\{[^}]+\}/, alternativePattern);
    }
    
    // Match against the full path or just the filename
    const regex = new RegExp(`^${regexPattern}$`);
    const fileName = normalizedPath.split("/").pop() || "";
    
    return regex.test(normalizedPath) || regex.test(fileName);
  };

  const addRunOnSave = (taskId: string, globPattern: string, delay: number = 500) => {
    const config: RunOnSaveConfig = {
      id: crypto.randomUUID(),
      taskId,
      globPattern,
      delay,
      enabled: true,
    };
    
    setState(produce((s) => {
      s.runOnSave.push(config);
    }));
    saveRunOnSave();
    tasksLogger.debug("Added run on save config:", config);
  };

  const removeRunOnSave = (id: string) => {
    // Clear any pending timer for this config
    const timer = runOnSaveTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      runOnSaveTimers.delete(id);
    }
    
    setState(produce((s) => {
      s.runOnSave = s.runOnSave.filter(c => c.id !== id);
    }));
    saveRunOnSave();
    tasksLogger.debug("Removed run on save config:", id);
  };

  const updateRunOnSave = (id: string, updates: Partial<RunOnSaveConfig>) => {
    setState(produce((s) => {
      const config = s.runOnSave.find(c => c.id === id);
      if (config) {
        Object.assign(config, updates);
      }
    }));
    saveRunOnSave();
  };

  const toggleRunOnSaveEnabled = () => {
    setState("runOnSaveEnabled", !state.runOnSaveEnabled);
    saveRunOnSave();
    tasksLogger.debug("Run on save enabled:", !state.runOnSaveEnabled);
  };

  const handleFileSaved = (filePath: string) => {
    if (!state.runOnSaveEnabled) {
      return;
    }

    // Find all matching configs
    const matchingConfigs = state.runOnSave.filter(config => {
      if (!config.enabled) return false;
      return matchGlobPattern(config.globPattern, filePath);
    });

    if (matchingConfigs.length === 0) {
      return;
    }

    tasksLogger.debug(`File saved: ${filePath}, matching ${matchingConfigs.length} run on save config(s)`);

    // Execute matching tasks with debounce
    for (const config of matchingConfigs) {
      // Clear existing timer for this config
      const existingTimer = runOnSaveTimers.get(config.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer with debounce
      const timer = setTimeout(() => {
        runOnSaveTimers.delete(config.id);
        
        const task = allTasks().find(t => t.label === config.taskId);
        if (task) {
          tasksLogger.debug(`Running task "${task.label}" triggered by save of ${filePath}`);
          runTask(task);
        } else {
          tasksLogger.warn(`Run on save: Task "${config.taskId}" not found`);
        }
      }, config.delay);

      runOnSaveTimers.set(config.id, timer);
    }
  };

  const loadRunOnSave = () => {
    try {
      const stored = localStorage.getItem("cortex_run_on_save");
      if (stored) {
        const data = JSON.parse(stored);
        setState("runOnSave", data.configs || []);
        setState("runOnSaveEnabled", data.enabled ?? true);
      }
    } catch (e) {
      tasksLogger.error("Failed to load run on save configs:", e);
    }
  };

  const saveRunOnSave = () => {
    try {
      localStorage.setItem("cortex_run_on_save", JSON.stringify({
        configs: state.runOnSave,
        enabled: state.runOnSaveEnabled,
      }));
    } catch (e) {
      tasksLogger.error("Failed to save run on save configs:", e);
    }
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const allTasks = createMemo(() => [...state.tasks, ...state.detectedTasks]);

  const buildTasks = createMemo(() => 
    allTasks().filter(t => t.group === "build")
  );

  const testTasks = createMemo(() => 
    allTasks().filter(t => t.group === "test")
  );

  const defaultBuildTask = createMemo(() => 
    buildTasks().find(t => t.isDefault) || buildTasks()[0]
  );

  const defaultTestTask = createMemo(() => 
    testTasks().find(t => t.isDefault) || testTasks()[0]
  );

  const backgroundTaskConfigs = createMemo(() =>
    allTasks().filter(t => t.isBackground)
  );

  // ============================================================================
  // Persistence
  // ============================================================================

  const loadTasks = async () => {
    try {
      const stored = localStorage.getItem("cortex_tasks");
      if (stored) {
        const tasks = JSON.parse(stored) as TaskConfig[];
        setState("tasks", tasks);
      }
    } catch (e) {
      console.error("[Tasks] Failed to load tasks:", e);
    }
  };

  const saveTasks = () => {
    try {
      localStorage.setItem("cortex_tasks", JSON.stringify(state.tasks));
    } catch (e) {
      console.error("[Tasks] Failed to save tasks:", e);
    }
  };

  const loadRecentTasks = () => {
    try {
      const stored = localStorage.getItem("cortex_recent_tasks");
      if (stored) {
        const recent = JSON.parse(stored) as TaskHistory[];
        setState("recentTasks", recent);
      }
    } catch (e) {
      console.error("[Tasks] Failed to load recent tasks:", e);
    }
  };

  const saveRecentTasks = () => {
    try {
      localStorage.setItem("cortex_recent_tasks", JSON.stringify(state.recentTasks));
    } catch (e) {
      tasksLogger.error("Failed to save recent tasks:", e);
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  onMount(() => {
    // ESSENTIAL — fast localStorage reads needed for first render
    loadTasks();
    loadRecentTasks();
    loadRunOnSave();
    
    // Initialize built-in task providers (sync, CPU-light)
    const builtInProviders = createBuiltInProviders();
    for (const provider of builtInProviders) {
      registerProvider(provider);
    }
    tasksLogger.debug(`Initialized ${builtInProviders.length} built-in providers`);

    // DEFERRED — yield to main thread before registering event listeners and IPC
    let listenersRegistered = false;

    // Detect tasks when project is opened
    const handleProjectOpen = async () => {
      await detectTasks();
      // Run tasks configured with runOn: "folderOpen" after detection completes
      setTimeout(() => runFolderOpenTasks(), 500);
    };
    
    // Handle file save events for run on save and config file watching
    const handleFileSavedEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail?.path) {
        handleFileSaved(detail.path);
        // Check if this is a config file that should trigger re-detection
        handleConfigFileChanged(detail.path);
      }
    };
    
    // Handle file change events (for files that are modified but not necessarily saved)
    const handleFileChangedEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail?.path) {
        handleConfigFileChanged(detail.path);
      }
    };
    
    // Listen for terminal events to update task status
    const handleTerminalStatus = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const run = state.runningTasks.find(r => r.terminalId === data.terminal_id);
      const backgroundRun = state.backgroundTasks.find(r => r.terminalId === data.terminal_id);
      
      if (run && data.status === "stopped") {
        // Parse full output with problem matcher when task completes
        if (run.config.problemMatcher && run.output.length > 0) {
          const fullOutput = run.output.join("\n");
          const basePath = run.config.cwd || sdk.state.config.cwd || ".";
          const diagnostics = parseTaskOutput(fullOutput, run.config.problemMatcher, basePath);
          
          if (diagnostics.length > 0) {
            // Dispatch event with parsed diagnostics
            window.dispatchEvent(new CustomEvent("task:parsed-diagnostics", {
              detail: {
                taskLabel: run.taskLabel,
                diagnostics,
                clear: true, // Clear previous diagnostics from this task
              },
            }));
            tasksLogger.debug(`Parsed ${diagnostics.length} diagnostic(s) from task "${run.taskLabel}"`);
            
            // Handle revealProblems presentation option
            const presentation = run.config.presentation;
            if (presentation?.revealProblems === 'always' || 
                (presentation?.revealProblems === 'onProblem' && diagnostics.length > 0)) {
              window.dispatchEvent(new CustomEvent("problems:reveal"));
            }
          }
        }
        
        // Emit task end event
        const execution = state.executions.get(run.id);
        if (execution) {
          emitTaskEnd(execution, data.exit_code);
          emitTaskProcessEnd(execution, data.exit_code);
        }
        
        // Handle close presentation option
        if (run.config.presentation?.close && data.exit_code === 0) {
          // Close terminal on successful completion
          setTimeout(() => {
            terminals.closeTerminal(run.terminalId);
          }, 1000);
        }
      }
      
      // Handle regular tasks
      setState(produce((s) => {
        const runToUpdate = s.runningTasks.find(r => r.terminalId === data.terminal_id);
        if (runToUpdate) {
          if (data.status === "stopped") {
            runToUpdate.status = data.exit_code === 0 ? "completed" : "failed";
            runToUpdate.finishedAt = Date.now();
            runToUpdate.exitCode = data.exit_code;
            // Move to history
            s.taskHistory.unshift(runToUpdate);
            s.runningTasks = s.runningTasks.filter(r => r.id !== runToUpdate.id);
            // Remove from executions
            s.executions.delete(runToUpdate.id);
          }
        }
      }));

      // Handle background tasks
      if (backgroundRun && data.status === "stopped") {
        // Emit task end event
        const execution = state.executions.get(backgroundRun.id);
        if (execution) {
          emitTaskEnd(execution, data.exit_code);
          emitTaskProcessEnd(execution, data.exit_code);
        }
        
        setState(produce((s) => {
          const bgRunToUpdate = s.backgroundTasks.find(r => r.terminalId === data.terminal_id);
          if (bgRunToUpdate) {
            bgRunToUpdate.status = data.exit_code === 0 ? "completed" : "failed";
            bgRunToUpdate.backgroundStatus = "idle";
            bgRunToUpdate.finishedAt = Date.now();
            bgRunToUpdate.exitCode = data.exit_code;
            // Move to history
            s.taskHistory.unshift(bgRunToUpdate);
            s.backgroundTasks = s.backgroundTasks.filter(r => r.id !== bgRunToUpdate.id);
            // Remove from executions
            s.executions.delete(bgRunToUpdate.id);
          }
        }));
        
        // Update reconnection state
        saveTasksForReconnection();
        
        tasksLogger.debug(`Background task stopped: ${backgroundRun.taskLabel}`);
      }
    };

    const handleTerminalOutput = (e: Event) => {
      const data = (e as CustomEvent).detail;
      
      // Handle regular running tasks
      setState(produce((s) => {
        const run = s.runningTasks.find(r => r.terminalId === data.terminal_id);
        if (run) {
          run.output.push(data.content);
          // Keep last 10000 lines
          if (run.output.length > 10000) {
            run.output = run.output.slice(-10000);
          }
          
          // Try to detect process ID from output (e.g., "Process started with PID: 12345")
          if (!run.processId) {
            const pidMatch = data.content.match(/(?:PID|pid|Process ID)[:=\s]+(\d+)/);
            if (pidMatch) {
              run.processId = parseInt(pidMatch[1], 10);
              // Emit process start event
              const execution = s.executions.get(run.id);
              if (execution) {
                emitTaskProcessStart(execution, run.processId);
              }
            }
          }
          
          // Incrementally parse output if a problem matcher is configured
          // This provides real-time diagnostics as output streams in
          if (run.config.problemMatcher) {
            const basePath = run.config.cwd || sdk.state.config.cwd || ".";
            const diagnostics = parseTaskOutput(data.content, run.config.problemMatcher, basePath);
            
            if (diagnostics.length > 0) {
              window.dispatchEvent(new CustomEvent("task:parsed-diagnostics", {
                detail: {
                  taskLabel: run.taskLabel,
                  diagnostics,
                  clear: false, // Don't clear - append to existing diagnostics
                },
              }));
            }
          }
        }
      }));

      // Handle background tasks
      const bgRun = state.backgroundTasks.find(r => r.terminalId === data.terminal_id);
      if (bgRun) {
        setState(produce((s) => {
          const bgRunToUpdate = s.backgroundTasks.find(r => r.terminalId === data.terminal_id);
          if (bgRunToUpdate) {
            bgRunToUpdate.output.push(data.content);
            // Keep last 10000 lines
            if (bgRunToUpdate.output.length > 10000) {
              bgRunToUpdate.output = bgRunToUpdate.output.slice(-10000);
            }
            
            // Try to detect process ID from output
            if (!bgRunToUpdate.processId) {
              const pidMatch = data.content.match(/(?:PID|pid|Process ID)[:=\s]+(\d+)/);
              if (pidMatch) {
                bgRunToUpdate.processId = parseInt(pidMatch[1], 10);
                // Emit process start event
                const execution = s.executions.get(bgRunToUpdate.id);
                if (execution) {
                  emitTaskProcessStart(execution, bgRunToUpdate.processId);
                }
              }
            }
          }
        }));

        // Update background task status based on output patterns
        updateBackgroundTaskStatus(bgRun.id, data.content);

        // Also parse diagnostics for background tasks
        if (bgRun.config.problemMatcher) {
          const basePath = bgRun.config.cwd || sdk.state.config.cwd || ".";
          const diagnostics = parseTaskOutput(data.content, bgRun.config.problemMatcher, basePath);
          
          if (diagnostics.length > 0) {
            window.dispatchEvent(new CustomEvent("task:parsed-diagnostics", {
              detail: {
                taskLabel: bgRun.taskLabel,
                diagnostics,
                clear: false,
              },
            }));
          }
        }
      }
    };

    // Listen for global inputs loaded from tasks.json
    const handleGlobalInputsLoaded = (e: Event) => {
      const detail = (e as CustomEvent<{ inputs: TaskInputVariable[] }>).detail;
      if (detail?.inputs) {
        setState("globalInputs", detail.inputs);
        tasksLogger.debug(`Loaded ${detail.inputs.length} global input(s)`);
      }
    };

    // Listen for command events from CommandContext
    const handleOpenRunDialog = () => openRunDialog();
    const handleOpenPanel = () => openTasksPanel();
    const handleOpenConfigEditor = () => openConfigEditor();
    const handleRunBuild = () => runBuildTask();
    const handleRunTest = () => runTestTask();
    const handleRefresh = () => refreshTasks();
    
    // Handle before unload to save tasks for reconnection
    const handleBeforeUnload = () => {
      saveTasksForReconnection();
    };

    onCleanup(() => {
      if (listenersRegistered) {
        window.removeEventListener("cortex:project-opened", handleProjectOpen);
        window.removeEventListener("cortex:terminal-status", handleTerminalStatus);
        window.removeEventListener("cortex:terminal-output", handleTerminalOutput);
        window.removeEventListener("cortex:file-saved", handleFileSavedEvent);
        window.removeEventListener("cortex:file-changed", handleFileChangedEvent);
        window.removeEventListener("tasks:open-run-dialog", handleOpenRunDialog);
        window.removeEventListener("tasks:open-panel", handleOpenPanel);
        window.removeEventListener("tasks:open-config-editor", handleOpenConfigEditor);
        window.removeEventListener("tasks:run-build", handleRunBuild);
        window.removeEventListener("tasks:run-test", handleRunTest);
        window.removeEventListener("tasks:refresh", handleRefresh);
        window.removeEventListener("tasks:global-inputs-loaded", handleGlobalInputsLoaded);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
      
      // Save tasks for reconnection on cleanup
      saveTasksForReconnection();
      
      // Clear all pending run on save timers
      for (const timer of runOnSaveTimers.values()) {
        clearTimeout(timer);
      }
      runOnSaveTimers.clear();
      
      // Clear event listeners
      taskStartListeners.clear();
      taskEndListeners.clear();
      taskProcessStartListeners.clear();
      taskProcessEndListeners.clear();
    });

    queueMicrotask(() => {
      window.addEventListener("cortex:project-opened", handleProjectOpen);
      window.addEventListener("cortex:terminal-status", handleTerminalStatus);
      window.addEventListener("cortex:terminal-output", handleTerminalOutput);
      window.addEventListener("cortex:file-saved", handleFileSavedEvent);
      window.addEventListener("cortex:file-changed", handleFileChangedEvent);
      window.addEventListener("tasks:open-run-dialog", handleOpenRunDialog);
      window.addEventListener("tasks:open-panel", handleOpenPanel);
      window.addEventListener("tasks:open-config-editor", handleOpenConfigEditor);
      window.addEventListener("tasks:run-build", handleRunBuild);
      window.addEventListener("tasks:run-test", handleRunTest);
      window.addEventListener("tasks:refresh", handleRefresh);
      window.addEventListener("tasks:global-inputs-loaded", handleGlobalInputsLoaded);
      window.addEventListener("beforeunload", handleBeforeUnload);
      listenersRegistered = true;

      // Initial detection (after providers are initialized)
      setTimeout(() => detectTasks(), 1000);

      // Try to reconnect to tasks after a short delay
      setTimeout(() => reconnectTasks(), 1500);

      setInitialized(true);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: TasksContextValue = {
    initialized,
    state,
    addTask,
    updateTask,
    removeTask,
    runTask,
    runTaskByLabel,
    runBuildTask,
    runTestTask,
    cancelTask,
    rerunTask,
    runBackgroundTask,
    stopBackgroundTask,
    detectTasks,
    refreshTasks,
    taskProviders,
    openTasksPanel,
    closeTasksPanel,
    toggleTasksPanel,
    openRunDialog,
    closeRunDialog,
    openConfigEditor,
    closeConfigEditor,
    setSelectedTask,
    openRunOnSaveConfig,
    closeRunOnSaveConfig,
    resolveInputPrompt,
    addRunOnSave,
    removeRunOnSave,
    updateRunOnSave,
    toggleRunOnSaveEnabled,
    handleFileSaved,
    runTaskInTerminal,
    getRunInTerminalDefault,
    setRunInTerminalDefault,
    registerCommandHandler,
    unregisterCommandHandler,
    onDidStartTask,
    onDidEndTask,
    onDidStartTaskProcess,
    onDidEndTaskProcess,
    reconnectTasks,
    allTasks,
    buildTasks,
    testTasks,
    backgroundTasks: backgroundTaskConfigs,
    defaultBuildTask,
    defaultTestTask,
    getCurrentOS,
    resolveOSConfig,
  };

  return (
    <TasksContext.Provider value={value}>
      {props.children}
    </TasksContext.Provider>
  );
};

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
