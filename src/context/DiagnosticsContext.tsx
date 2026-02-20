/**
 * Diagnostics Context - Aggregates diagnostics from all sources
 *
 * Combines diagnostics from:
 * - LSP (Language Server Protocol)
 * - TypeScript compiler
 * - ESLint and other linters
 * - Build output
 * - Custom problem matchers from tasks
 */

import {
  createContext,
  useContext,
  ParentProps,
  onMount,
  onCleanup,
  createEffect,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useLSP, type DiagnosticSeverity } from "./LSPContext";
import type { ParsedDiagnostic, ProblemMatcherSeverity } from "./TasksContext";
import { getProjectPath } from "../utils/workspace";
import { createLogger } from "../utils/logger";

const diagnosticsLogger = createLogger("Diagnostics");

// ============================================================================
// Types
// ============================================================================

export type DiagnosticSource =
  | "lsp"
  | "typescript"
  | "eslint"
  | "build"
  | "task"
  | "custom";

export interface DiagnosticPosition {
  line: number;
  character: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export interface DiagnosticRelatedInfo {
  location: {
    uri: string;
    range: DiagnosticRange;
  };
  message: string;
}

export interface CodeAction {
  title: string;
  kind?: string;
  isPreferred?: boolean;
  edit?: {
    changes?: Record<string, Array<{ range: DiagnosticRange; newText: string }>>;
  };
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
}

export interface UnifiedDiagnostic {
  id: string;
  uri: string;
  range: DiagnosticRange;
  severity: DiagnosticSeverity;
  code?: string | number;
  source: DiagnosticSource;
  sourceName?: string;
  message: string;
  relatedInformation?: DiagnosticRelatedInfo[];
  codeActions?: CodeAction[];
  timestamp: number;
}

export interface FileDiagnostics {
  uri: string;
  diagnostics: UnifiedDiagnostic[];
  lastUpdated: number;
}

export type GroupMode = "file" | "severity" | "source";

export interface DiagnosticFilter {
  showErrors: boolean;
  showWarnings: boolean;
  showInformation: boolean;
  showHints: boolean;
  currentFileOnly: boolean;
  sources: DiagnosticSource[];
}

export interface DiagnosticCounts {
  error: number;
  warning: number;
  information: number;
  hint: number;
  total: number;
}

// ============================================================================
// State
// ============================================================================

interface DiagnosticsState {
  diagnostics: Record<string, FileDiagnostics>;
  filter: DiagnosticFilter;
  groupMode: GroupMode;
  selectedDiagnosticId: string | null;
  isPanelOpen: boolean;
  isRefreshing: boolean;
  lastRefresh: number;
  autoRefresh: boolean;
  currentFileUri: string | null;
}

interface DiagnosticsContextValue {
  state: DiagnosticsState;

  // Diagnostics access
  getAllDiagnostics: () => UnifiedDiagnostic[];
  getDiagnosticsForFile: (uri: string) => UnifiedDiagnostic[];
  getDiagnosticById: (id: string) => UnifiedDiagnostic | undefined;
  getFilteredDiagnostics: () => UnifiedDiagnostic[];

  // Grouping
  getDiagnosticsGroupedByFile: () => Map<string, UnifiedDiagnostic[]>;
  getDiagnosticsGroupedBySeverity: () => Map<DiagnosticSeverity, UnifiedDiagnostic[]>;
  getDiagnosticsGroupedBySource: () => Map<DiagnosticSource, UnifiedDiagnostic[]>;

  // Counts
  getCounts: () => DiagnosticCounts;
  getFilteredCounts: () => DiagnosticCounts;
  getCountsForFile: (uri: string) => DiagnosticCounts;

  // Filtering
  setFilter: (filter: Partial<DiagnosticFilter>) => void;
  resetFilter: () => void;
  setGroupMode: (mode: GroupMode) => void;
  setCurrentFileUri: (uri: string | null) => void;

  // Selection
  selectDiagnostic: (id: string | null) => void;
  selectNextDiagnostic: () => void;
  selectPreviousDiagnostic: () => void;
  navigateToSelected: () => void;

  // Panel state
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  // Refresh
  refreshDiagnostics: () => Promise<void>;
  setAutoRefresh: (enabled: boolean) => void;

  // Actions
  clearDiagnostics: (uri?: string) => void;
  addDiagnostics: (
    uri: string,
    diagnostics: Omit<UnifiedDiagnostic, "id" | "timestamp">[],
    source: DiagnosticSource
  ) => void;
  addParsedDiagnostics: (diagnostics: ParsedDiagnostic[], taskLabel?: string) => void;
  clearTaskDiagnostics: (taskLabel?: string) => void;
  applyCodeAction: (action: CodeAction) => Promise<void>;

  // Export
  exportDiagnostics: (format: "json" | "csv" | "markdown") => string;
  exportToFile: (format: "json" | "csv" | "markdown") => Promise<void>;
}

const DiagnosticsContext = createContext<DiagnosticsContextValue>();

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FILTER: DiagnosticFilter = {
  showErrors: true,
  showWarnings: true,
  showInformation: true,
  showHints: true,
  currentFileOnly: false,
  sources: ["lsp", "typescript", "eslint", "build", "task", "custom"],
};

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3,
};

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRelativePath(uri: string, projectPath?: string): string {
  const fullPath = uri.replace(/^file:\/\//, "");
  if (projectPath && fullPath.startsWith(projectPath)) {
    return fullPath.slice(projectPath.length + 1);
  }
  return fullPath;
}

function parseBuildOutput(output: string): Omit<UnifiedDiagnostic, "id" | "timestamp">[] {
  const diagnostics: Omit<UnifiedDiagnostic, "id" | "timestamp">[] = [];

  // Common patterns for build errors
  const patterns = [
    // TypeScript/ESLint style: file(line,col): error TS1234: message
    /^(.+?)\((\d+),(\d+)\):\s*(error|warning|info)\s+(\w+):\s*(.+)$/gm,
    // GCC/Clang style: file:line:col: error: message
    /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/gm,
    // Rust style: error[E0123]: message --> file:line:col
    /^(error|warning)\[(\w+)\]:\s*(.+)\n\s*-->\s*(.+?):(\d+):(\d+)$/gm,
    // Generic: file:line: error: message
    /^(.+?):(\d+):\s*(error|warning|Error|Warning):\s*(.+)$/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      try {
        // Different patterns have different capture groups
        const diagnostic = parseMatchToDiagnostic(match, pattern);
        if (diagnostic) {
          diagnostics.push(diagnostic);
        }
      } catch (err) {
        console.debug("[Diagnostics] Parse match failed:", err);
      }
    }
  }

  return diagnostics;
}

function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseMatchToDiagnostic(
  match: RegExpExecArray,
  pattern: RegExp
): Omit<UnifiedDiagnostic, "id" | "timestamp"> | null {
  const patternStr = pattern.source;

  // TypeScript/ESLint style
  if (patternStr.includes("error|warning|info")) {
    const [, file, line, col, severity, code, message] = match;
    const lineNum = safeParseInt(line, 1);
    const colNum = safeParseInt(col, 1);
    return {
      uri: `file://${file.replace(/\\/g, "/")}`,
      range: {
        start: { line: lineNum - 1, character: colNum - 1 },
        end: { line: lineNum - 1, character: colNum },
      },
      severity: mapSeverityString(severity),
      code,
      source: "build",
      message,
    };
  }

  // GCC/Clang style
  if (patternStr.includes("error|warning|note")) {
    const [, file, line, col, severity, message] = match;
    const lineNum = safeParseInt(line, 1);
    const colNum = safeParseInt(col, 1);
    return {
      uri: `file://${file.replace(/\\/g, "/")}`,
      range: {
        start: { line: lineNum - 1, character: colNum - 1 },
        end: { line: lineNum - 1, character: colNum },
      },
      severity: mapSeverityString(severity),
      source: "build",
      message,
    };
  }

  return null;
}

function mapSeverityString(severity: string): DiagnosticSeverity {
  switch (severity.toLowerCase()) {
    case "error":
      return "error";
    case "warning":
    case "warn":
      return "warning";
    case "info":
    case "information":
    case "note":
      return "information";
    case "hint":
      return "hint";
    default:
      return "information";
  }
}

/**
 * Maps ProblemMatcherSeverity to DiagnosticSeverity
 */
function mapProblemMatcherSeverity(severity: ProblemMatcherSeverity): DiagnosticSeverity {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "information";
    case "hint":
      return "hint";
    default:
      return "information";
  }
}

/**
 * Converts a ParsedDiagnostic from the problem matcher to a UnifiedDiagnostic
 */
function convertParsedDiagnostic(
  parsed: ParsedDiagnostic
): Omit<UnifiedDiagnostic, "id" | "timestamp"> {
  // Normalize file path to URI format
  let uri = parsed.file;
  if (!uri.startsWith("file://")) {
    // Handle Windows paths (C:\...) and Unix paths (/...)
    const normalizedPath = parsed.file.replace(/\\/g, "/");
    if (/^[A-Za-z]:/.test(normalizedPath)) {
      // Windows absolute path
      uri = `file:///${normalizedPath}`;
    } else if (normalizedPath.startsWith("/")) {
      // Unix absolute path
      uri = `file://${normalizedPath}`;
    } else {
      // Relative path - prefix with file://
      uri = `file://${normalizedPath}`;
    }
  }

  return {
    uri,
    range: {
      start: {
        line: parsed.line - 1, // Convert 1-based to 0-based
        character: parsed.column - 1,
      },
      end: {
        line: (parsed.endLine ?? parsed.line) - 1,
        character: (parsed.endColumn ?? parsed.column) - 1,
      },
    },
    severity: mapProblemMatcherSeverity(parsed.severity),
    code: parsed.code,
    source: "task",
    sourceName: parsed.source,
    message: parsed.message,
  };
}

// ============================================================================
// Provider
// ============================================================================

export function DiagnosticsProvider(props: ParentProps) {
  const lsp = useLSP();

  const [state, setState] = createStore<DiagnosticsState>({
    diagnostics: {},
    filter: DEFAULT_FILTER,
    groupMode: "file",
    selectedDiagnosticId: null,
    isPanelOpen: false,
    isRefreshing: false,
    lastRefresh: 0,
    autoRefresh: true,
    currentFileUri: null,
  });

  let unlistenBuildOutput: UnlistenFn | undefined;
  let unlistenTaskOutput: UnlistenFn | undefined;
  let unlistenFileChange: UnlistenFn | undefined;
  let refreshDebounceTimer: number | undefined;

  // ============================================================================
  // Sync from LSP Context
  // ============================================================================

  createEffect(() => {
    const lspDiagnostics = lsp.getAllDiagnostics();
    const now = Date.now();

    setState(
      produce((s) => {
        // Clear old LSP diagnostics
        for (const uri of Object.keys(s.diagnostics)) {
          s.diagnostics[uri].diagnostics = s.diagnostics[uri].diagnostics.filter(
            (d) => d.source !== "lsp"
          );
        }

        // Add new LSP diagnostics
        for (const doc of lspDiagnostics) {
          const unified: UnifiedDiagnostic[] = doc.diagnostics.map((d) => ({
            id: generateId(),
            uri: doc.uri,
            range: d.range,
            severity: d.severity ?? "information",
            code: d.code,
            source: "lsp" as DiagnosticSource,
            sourceName: d.source,
            message: d.message,
            relatedInformation: d.relatedInformation,
            timestamp: now,
          }));

          if (!s.diagnostics[doc.uri]) {
            s.diagnostics[doc.uri] = {
              uri: doc.uri,
              diagnostics: [],
              lastUpdated: now,
            };
          }

          s.diagnostics[doc.uri].diagnostics.push(...unified);
          s.diagnostics[doc.uri].lastUpdated = now;
        }

        // Clean up empty entries
        for (const uri of Object.keys(s.diagnostics)) {
          if (s.diagnostics[uri].diagnostics.length === 0) {
            delete s.diagnostics[uri];
          }
        }
      })
    );
  });

  // ============================================================================
  // Event Listeners
  // ============================================================================

  // Define event handlers at component scope for proper cleanup
  const handleTogglePanel = () => togglePanel();
  const handleActiveFileChange = (e: Event) => {
    const data = (e as CustomEvent).detail;
    if (data?.uri || data?.path) {
      const uri = data.uri || `file://${data.path.replace(/\\/g, "/")}`;
      setCurrentFileUri(uri);
    }
  };
  
  // Handler for parsed diagnostics from task problem matchers
  const handleTaskParsedDiagnostics = (e: Event) => {
    const detail = (e as CustomEvent<{
      taskLabel: string;
      diagnostics: ParsedDiagnostic[];
      clear?: boolean;
    }>).detail;
    
    if (detail?.diagnostics) {
      // Clear previous diagnostics from this task if requested
      if (detail.clear) {
        clearTaskDiagnostics(detail.taskLabel);
      }
      addParsedDiagnostics(detail.diagnostics, detail.taskLabel);
    }
  };

  // Handler for clearing task diagnostics
  const handleTaskClearDiagnostics = (e: Event) => {
    const detail = (e as CustomEvent<{ taskLabel?: string }>).detail;
    clearTaskDiagnostics(detail?.taskLabel);
  };

  // Register cleanup synchronously
  onCleanup(() => {
    unlistenBuildOutput?.();
    unlistenTaskOutput?.();
    unlistenFileChange?.();
    window.removeEventListener("problems:toggle", handleTogglePanel);
    window.removeEventListener("editor:active-file-changed", handleActiveFileChange);
    window.removeEventListener("task:parsed-diagnostics", handleTaskParsedDiagnostics);
    window.removeEventListener("task:clear-diagnostics", handleTaskClearDiagnostics);
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
    }
  });

  onMount(async () => {
    // Listen for build output
    unlistenBuildOutput = await listen<{ output: string; task_id?: string }>(
      "build:output",
      (event) => {
        const parsed = parseBuildOutput(event.payload.output);
        for (const diag of parsed) {
          addDiagnostics(diag.uri, [diag], "build");
        }
      }
    );

    // Listen for task output with problem matchers
    unlistenTaskOutput = await listen<{
      task_id: string;
      output: string;
      problem_matcher?: {
        pattern: string;
        file?: number;
        line?: number;
        column?: number;
        message?: number;
        severity?: number;
      };
    }>("task:output", (event) => {
      if (event.payload.problem_matcher) {
        try {
          const pattern = new RegExp(event.payload.problem_matcher.pattern, "gm");
          let match;
          while ((match = pattern.exec(event.payload.output)) !== null) {
            const pm = event.payload.problem_matcher;
            const file = pm.file ? match[pm.file] : match[1];
            const line = pm.line ? safeParseInt(match[pm.line], 1) : 1;
            const col = pm.column ? safeParseInt(match[pm.column], 1) : 1;
            const message = pm.message ? match[pm.message] : match[0];
            const severity = pm.severity
              ? mapSeverityString(match[pm.severity])
              : "error";

            addDiagnostics(
              `file://${file.replace(/\\/g, "/")}`,
              [
                {
                  uri: `file://${file.replace(/\\/g, "/")}`,
                  range: {
                    start: { line: line - 1, character: col - 1 },
                    end: { line: line - 1, character: col },
                  },
                  severity,
                  source: "task",
                  message,
                },
              ],
              "task"
            );
          }
        } catch (e) {
          diagnosticsLogger.error("Failed to parse task output:", e);
        }
      }
    });

    // Listen for file changes to trigger refresh
    unlistenFileChange = await listen<{ path: string }>("file:changed", (_event) => {
      if (state.autoRefresh) {
        debouncedRefresh();
      }
    });

    // Register window event listeners
    window.addEventListener("problems:toggle", handleTogglePanel);
    window.addEventListener("editor:active-file-changed", handleActiveFileChange);
    window.addEventListener("task:parsed-diagnostics", handleTaskParsedDiagnostics);
    window.addEventListener("task:clear-diagnostics", handleTaskClearDiagnostics);
  });

  // ============================================================================
  // Debounced Refresh
  // ============================================================================

  const debouncedRefresh = () => {
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
    }
    refreshDebounceTimer = window.setTimeout(() => {
      refreshDiagnostics();
    }, 500);
  };

  // ============================================================================
  // Diagnostics Access
  // ============================================================================

  const getAllDiagnostics = (): UnifiedDiagnostic[] => {
    const all: UnifiedDiagnostic[] = [];
    for (const file of Object.values(state.diagnostics)) {
      all.push(...file.diagnostics);
    }
    return all.sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff !== 0) return severityDiff;
      if (a.uri !== b.uri) return a.uri.localeCompare(b.uri);
      return a.range.start.line - b.range.start.line;
    });
  };

  const getDiagnosticsForFile = (uri: string): UnifiedDiagnostic[] => {
    return state.diagnostics[uri]?.diagnostics ?? [];
  };

  const getDiagnosticById = (id: string): UnifiedDiagnostic | undefined => {
    for (const file of Object.values(state.diagnostics)) {
      const found = file.diagnostics.find((d) => d.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const getFilteredDiagnostics = (): UnifiedDiagnostic[] => {
    const all = getAllDiagnostics();
    const { filter, currentFileUri } = state;

    return all.filter((d) => {
      if (filter.currentFileOnly && currentFileUri && d.uri !== currentFileUri) {
        return false;
      }
      if (!filter.sources.includes(d.source)) {
        return false;
      }
      switch (d.severity) {
        case "error":
          return filter.showErrors;
        case "warning":
          return filter.showWarnings;
        case "information":
          return filter.showInformation;
        case "hint":
          return filter.showHints;
        default:
          return true;
      }
    });
  };

  // ============================================================================
  // Grouping
  // ============================================================================

  const getDiagnosticsGroupedByFile = (): Map<string, UnifiedDiagnostic[]> => {
    const filtered = getFilteredDiagnostics();
    const groups = new Map<string, UnifiedDiagnostic[]>();

    for (const diag of filtered) {
      const existing = groups.get(diag.uri) || [];
      existing.push(diag);
      groups.set(diag.uri, existing);
    }

    return groups;
  };

  const getDiagnosticsGroupedBySeverity = (): Map<DiagnosticSeverity, UnifiedDiagnostic[]> => {
    const filtered = getFilteredDiagnostics();
    const groups = new Map<DiagnosticSeverity, UnifiedDiagnostic[]>([
      ["error", []],
      ["warning", []],
      ["information", []],
      ["hint", []],
    ]);

    for (const diag of filtered) {
      const existing = groups.get(diag.severity) || [];
      existing.push(diag);
      groups.set(diag.severity, existing);
    }

    return groups;
  };

  const getDiagnosticsGroupedBySource = (): Map<DiagnosticSource, UnifiedDiagnostic[]> => {
    const filtered = getFilteredDiagnostics();
    const groups = new Map<DiagnosticSource, UnifiedDiagnostic[]>();

    for (const diag of filtered) {
      const existing = groups.get(diag.source) || [];
      existing.push(diag);
      groups.set(diag.source, existing);
    }

    return groups;
  };

  // ============================================================================
  // Counts
  // ============================================================================

  const getCounts = (): DiagnosticCounts => {
    const all = getAllDiagnostics();
    return {
      error: all.filter((d) => d.severity === "error").length,
      warning: all.filter((d) => d.severity === "warning").length,
      information: all.filter((d) => d.severity === "information").length,
      hint: all.filter((d) => d.severity === "hint").length,
      total: all.length,
    };
  };

  const getFilteredCounts = (): DiagnosticCounts => {
    const filtered = getFilteredDiagnostics();
    return {
      error: filtered.filter((d) => d.severity === "error").length,
      warning: filtered.filter((d) => d.severity === "warning").length,
      information: filtered.filter((d) => d.severity === "information").length,
      hint: filtered.filter((d) => d.severity === "hint").length,
      total: filtered.length,
    };
  };

  const getCountsForFile = (uri: string): DiagnosticCounts => {
    const fileDiags = getDiagnosticsForFile(uri);
    return {
      error: fileDiags.filter((d) => d.severity === "error").length,
      warning: fileDiags.filter((d) => d.severity === "warning").length,
      information: fileDiags.filter((d) => d.severity === "information").length,
      hint: fileDiags.filter((d) => d.severity === "hint").length,
      total: fileDiags.length,
    };
  };

  // ============================================================================
  // Filtering
  // ============================================================================

  const setFilter = (filter: Partial<DiagnosticFilter>) => {
    setState("filter", (prev) => ({ ...prev, ...filter }));
  };

  const resetFilter = () => {
    setState("filter", DEFAULT_FILTER);
  };

  const setGroupMode = (mode: GroupMode) => {
    setState("groupMode", mode);
  };

  const setCurrentFileUri = (uri: string | null) => {
    setState("currentFileUri", uri);
  };

  // ============================================================================
  // Selection
  // ============================================================================

  const selectDiagnostic = (id: string | null) => {
    setState("selectedDiagnosticId", id);
  };

  const selectNextDiagnostic = () => {
    const filtered = getFilteredDiagnostics();
    if (filtered.length === 0) return;

    const currentIndex = filtered.findIndex((d) => d.id === state.selectedDiagnosticId);
    const nextIndex = currentIndex < filtered.length - 1 ? currentIndex + 1 : 0;
    setState("selectedDiagnosticId", filtered[nextIndex].id);
    navigateToSelected();
  };

  const selectPreviousDiagnostic = () => {
    const filtered = getFilteredDiagnostics();
    if (filtered.length === 0) return;

    const currentIndex = filtered.findIndex((d) => d.id === state.selectedDiagnosticId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filtered.length - 1;
    setState("selectedDiagnosticId", filtered[prevIndex].id);
    navigateToSelected();
  };

  const navigateToSelected = () => {
    const diag = getDiagnosticById(state.selectedDiagnosticId ?? "");
    if (!diag) return;

    window.dispatchEvent(
      new CustomEvent("navigate-to-location", {
        detail: {
          uri: diag.uri,
          line: diag.range.start.line + 1,
          column: diag.range.start.character + 1,
        },
      })
    );
  };

  // ============================================================================
  // Panel State
  // ============================================================================

  const openPanel = () => setState("isPanelOpen", true);
  const closePanel = () => setState("isPanelOpen", false);
  const togglePanel = () => setState("isPanelOpen", !state.isPanelOpen);

  // ============================================================================
  // Refresh
  // ============================================================================

  const refreshDiagnostics = async () => {
    setState("isRefreshing", true);

    try {
      // Request fresh diagnostics from backend
      await invoke("diagnostics_refresh").catch(() => {
        // Command may not exist, that's okay
      });

      setState("lastRefresh", Date.now());
    } catch (e) {
      diagnosticsLogger.error("Failed to refresh:", e);
    } finally {
      setState("isRefreshing", false);
    }
  };

  const setAutoRefresh = (enabled: boolean) => {
    setState("autoRefresh", enabled);
  };

  // ============================================================================
  // Actions
  // ============================================================================

  const clearDiagnostics = (uri?: string) => {
    if (uri) {
      setState("diagnostics", uri, undefined!);
    } else {
      setState("diagnostics", {});
    }
  };

  const addDiagnostics = (
    uri: string,
    diagnostics: Omit<UnifiedDiagnostic, "id" | "timestamp">[],
    source: DiagnosticSource
  ) => {
    const now = Date.now();

    setState(
      produce((s) => {
        if (!s.diagnostics[uri]) {
          s.diagnostics[uri] = {
            uri,
            diagnostics: [],
            lastUpdated: now,
          };
        }

        // Remove old diagnostics from this source
        s.diagnostics[uri].diagnostics = s.diagnostics[uri].diagnostics.filter(
          (d) => d.source !== source
        );

        // Add new diagnostics
        const unified: UnifiedDiagnostic[] = diagnostics.map((d) => ({
          ...d,
          id: generateId(),
          timestamp: now,
        }));

        s.diagnostics[uri].diagnostics.push(...unified);
        s.diagnostics[uri].lastUpdated = now;
      })
    );
  };

  /**
   * Adds parsed diagnostics from a task's problem matcher output
   */
  const addParsedDiagnostics = (diagnostics: ParsedDiagnostic[], taskLabel?: string) => {
    const now = Date.now();

    // Group diagnostics by file URI
    const byUri = new Map<string, Omit<UnifiedDiagnostic, "id" | "timestamp">[]>();

    for (const parsed of diagnostics) {
      const converted = convertParsedDiagnostic(parsed);
      if (taskLabel) {
        converted.sourceName = `${taskLabel}: ${parsed.source}`;
      }
      
      const existing = byUri.get(converted.uri) || [];
      existing.push(converted);
      byUri.set(converted.uri, existing);
    }

    // Add diagnostics for each file
    setState(
      produce((s) => {
        for (const [uri, diags] of byUri) {
          if (!s.diagnostics[uri]) {
            s.diagnostics[uri] = {
              uri,
              diagnostics: [],
              lastUpdated: now,
            };
          }

          // Add new diagnostics with IDs and timestamps
          const unified: UnifiedDiagnostic[] = diags.map((d) => ({
            ...d,
            id: generateId(),
            timestamp: now,
          }));

          s.diagnostics[uri].diagnostics.push(...unified);
          s.diagnostics[uri].lastUpdated = now;
        }
      })
    );

    diagnosticsLogger.debug(`Added ${diagnostics.length} diagnostics from task${taskLabel ? ` "${taskLabel}"` : ""}`);
  };

  /**
   * Clears all task diagnostics, optionally filtered by task label
   */
  const clearTaskDiagnostics = (taskLabel?: string) => {
    setState(
      produce((s) => {
        for (const uri of Object.keys(s.diagnostics)) {
          s.diagnostics[uri].diagnostics = s.diagnostics[uri].diagnostics.filter((d) => {
            if (d.source !== "task") {
              return true;
            }
            if (taskLabel && d.sourceName) {
              // Only remove diagnostics from this specific task
              return !d.sourceName.startsWith(`${taskLabel}:`);
            }
            // Remove all task diagnostics if no label specified
            return taskLabel !== undefined;
          });

          // Clean up empty entries
          if (s.diagnostics[uri].diagnostics.length === 0) {
            delete s.diagnostics[uri];
          }
        }
      })
    );

    diagnosticsLogger.debug(`Cleared task diagnostics${taskLabel ? ` for "${taskLabel}"` : ""}`);
  };

  const applyCodeAction = async (action: CodeAction) => {
    if (action.edit?.changes) {
      for (const [uri, edits] of Object.entries(action.edit.changes)) {
        for (const edit of edits) {
          window.dispatchEvent(
            new CustomEvent("editor:apply-edit", {
              detail: {
                uri,
                range: edit.range,
                newText: edit.newText,
              },
            })
          );
        }
      }
    }

    if (action.command) {
      window.dispatchEvent(
        new CustomEvent("lsp:execute-command", {
          detail: {
            command: action.command.command,
            arguments: action.command.arguments,
          },
        })
      );
    }
  };

  // ============================================================================
  // Export
  // ============================================================================

  const exportDiagnostics = (format: "json" | "csv" | "markdown"): string => {
    const diagnostics = getFilteredDiagnostics();
    const projectPath = getProjectPath();

    switch (format) {
      case "json":
        return JSON.stringify(
          diagnostics.map((d) => ({
            file: getRelativePath(d.uri, projectPath),
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            severity: d.severity,
            source: d.sourceName || d.source,
            code: d.code,
            message: d.message,
          })),
          null,
          2
        );

      case "csv": {
        const header = "File,Line,Column,Severity,Source,Code,Message";
        const rows = diagnostics.map((d) =>
          [
            `"${getRelativePath(d.uri, projectPath)}"`,
            d.range.start.line + 1,
            d.range.start.character + 1,
            d.severity,
            d.sourceName || d.source,
            d.code || "",
            `"${d.message.replace(/"/g, '""')}"`,
          ].join(",")
        );
        return [header, ...rows].join("\n");
      }

      case "markdown": {
        const counts = getFilteredCounts();
        const lines = [
          "# Diagnostics Report",
          "",
          `Generated: ${new Date().toISOString()}`,
          "",
          "## Summary",
          "",
          `- **Errors**: ${counts.error}`,
          `- **Warnings**: ${counts.warning}`,
          `- **Information**: ${counts.information}`,
          `- **Hints**: ${counts.hint}`,
          `- **Total**: ${counts.total}`,
          "",
          "## Details",
          "",
        ];

        const byFile = getDiagnosticsGroupedByFile();
        for (const [uri, diags] of byFile) {
          lines.push(`### ${getRelativePath(uri, projectPath)}`);
          lines.push("");
          for (const d of diags) {
            const icon =
              d.severity === "error"
                ? "❌"
                : d.severity === "warning"
                ? "⚠️"
                : d.severity === "information"
                ? "ℹ️"
                : "💡";
            lines.push(
              `- ${icon} Line ${d.range.start.line + 1}: ${d.message}${
                d.code ? ` [${d.code}]` : ""
              }`
            );
          }
          lines.push("");
        }

        return lines.join("\n");
      }
    }
  };

  const exportToFile = async (format: "json" | "csv" | "markdown") => {
    const content = exportDiagnostics(format);
    const extension = format === "markdown" ? "md" : format;
    const filename = `diagnostics-${new Date().toISOString().split("T")[0]}.${extension}`;

    try {
      // Try to use Tauri's save dialog
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: filename,
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [extension],
          },
        ],
      });

      if (path) {
        await invoke("fs_write_file", { path, content });
      }
    } catch (err) {
      console.debug("[Diagnostics] File save failed:", err);
      // Fallback to browser download
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: DiagnosticsContextValue = {
    state,
    getAllDiagnostics,
    getDiagnosticsForFile,
    getDiagnosticById,
    getFilteredDiagnostics,
    getDiagnosticsGroupedByFile,
    getDiagnosticsGroupedBySeverity,
    getDiagnosticsGroupedBySource,
    getCounts,
    getFilteredCounts,
    getCountsForFile,
    setFilter,
    resetFilter,
    setGroupMode,
    setCurrentFileUri,
    selectDiagnostic,
    selectNextDiagnostic,
    selectPreviousDiagnostic,
    navigateToSelected,
    openPanel,
    closePanel,
    togglePanel,
    refreshDiagnostics,
    setAutoRefresh,
    clearDiagnostics,
    addDiagnostics,
    addParsedDiagnostics,
    clearTaskDiagnostics,
    applyCodeAction,
    exportDiagnostics,
    exportToFile,
  };

  return (
    <DiagnosticsContext.Provider value={value}>
      {props.children}
    </DiagnosticsContext.Provider>
  );
}

export function useDiagnostics() {
  const context = useContext(DiagnosticsContext);
  if (!context) {
    throw new Error("useDiagnostics must be used within DiagnosticsProvider");
  }
  return context;
}
