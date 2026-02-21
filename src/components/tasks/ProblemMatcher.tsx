/**
 * ProblemMatcher Components - Parse and display task output diagnostics
 *
 * Features:
 * - Real-time parsing of task output
 * - Error/warning highlighting
 * - Click to navigate to file location
 * - Integration with Problems panel
 * - Built-in matcher presets ($tsc, $eslint, etc.)
 */

import { createSignal, createEffect, createMemo, Show, For } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  type ParsedDiagnostic,
  type ProblemMatcherSeverity,
  parseTaskOutput,
  BUILTIN_PROBLEM_MATCHERS,
} from "@/context/TasksContext";
import { useDiagnostics } from "@/context/DiagnosticsContext";

// ============================================================================
// Types
// ============================================================================

interface GroupedDiagnostic {
  file: string;
  relativePath: string;
  diagnostics: ParsedDiagnostic[];
  errorCount: number;
  warningCount: number;
}

// ============================================================================
// Problem Matcher Preview Component
// ============================================================================

interface ProblemMatcherPreviewProps {
  output: string;
  matcherName: string;
  basePath?: string;
}

/**
 * Preview parsed diagnostics from task output
 */
export function ProblemMatcherPreview(props: ProblemMatcherPreviewProps) {
  const [diagnostics, setDiagnostics] = createSignal<ParsedDiagnostic[]>([]);
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());

  createEffect(() => {
    const matcher = BUILTIN_PROBLEM_MATCHERS[props.matcherName];
    if (matcher && props.output) {
      const parsed = parseTaskOutput(
        props.output,
        props.matcherName,
        props.basePath || "."
      );
      setDiagnostics(parsed);
      // Expand all files by default
      setExpandedFiles(new Set(parsed.map((d) => d.file)));
    } else {
      setDiagnostics([]);
    }
  });

  const groupedDiagnostics = createMemo((): GroupedDiagnostic[] => {
    const byFile = new Map<string, ParsedDiagnostic[]>();

    for (const d of diagnostics()) {
      const existing = byFile.get(d.file) || [];
      existing.push(d);
      byFile.set(d.file, existing);
    }

    return Array.from(byFile.entries())
      .map(([file, diags]) => ({
        file,
        relativePath: getRelativePath(file, props.basePath),
        diagnostics: diags.sort((a, b) => a.line - b.line),
        errorCount: diags.filter((d) => d.severity === "error").length,
        warningCount: diags.filter((d) => d.severity === "warning").length,
      }))
      .sort((a, b) => {
        // Sort by error count, then warning count
        if (a.errorCount !== b.errorCount) return b.errorCount - a.errorCount;
        if (a.warningCount !== b.warningCount) return b.warningCount - a.warningCount;
        return a.relativePath.localeCompare(b.relativePath);
      });
  });

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const counts = createMemo(() => {
    const all = diagnostics();
    return {
      error: all.filter((d) => d.severity === "error").length,
      warning: all.filter((d) => d.severity === "warning").length,
      info: all.filter((d) => d.severity === "info").length,
      hint: all.filter((d) => d.severity === "hint").length,
      total: all.length,
    };
  });

  return (
    <div
      class="flex flex-col rounded border overflow-hidden"
      style={{
        background: "var(--surface-base)",
        "border-color": "var(--border-base)",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-base)" }}
      >
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
            Problem Matcher: {props.matcherName}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <Show when={counts().error > 0}>
            <span
              class="flex items-center gap-1 text-xs px-1.5 rounded"
              style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)" }}
            >
              <Icon name="circle-exclamation" class="w-3 h-3" />
              {counts().error}
            </span>
          </Show>
          <Show when={counts().warning > 0}>
            <span
              class="flex items-center gap-1 text-xs px-1.5 rounded"
              style={{ background: "var(--cortex-warning)20", color: "var(--cortex-warning)" }}
            >
              <Icon name="triangle-exclamation" class="w-3 h-3" />
              {counts().warning}
            </span>
          </Show>
          <Show when={counts().info > 0}>
            <span
              class="flex items-center gap-1 text-xs px-1.5 rounded"
              style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}
            >
              <Icon name="circle-info" class="w-3 h-3" />
              {counts().info}
            </span>
          </Show>
        </div>
      </div>

      {/* Content */}
      <div class="max-h-[300px] overflow-y-auto">
        <Show
          when={groupedDiagnostics().length > 0}
          fallback={
            <div class="px-4 py-6 text-center">
              <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                No problems detected
              </p>
            </div>
          }
        >
          <For each={groupedDiagnostics()}>
            {(group) => (
              <div class="border-b last:border-b-0" style={{ "border-color": "var(--border-weak)" }}>
                {/* File Header */}
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-hover)] text-left"
                  onClick={() => toggleFile(group.file)}
                >
                  <Icon
                    name="chevron-right"
                    class="w-3 h-3 transition-transform shrink-0"
                    style={{
                      color: "var(--text-weak)",
                      transform: expandedFiles().has(group.file)
                        ? "rotate(90deg)"
                        : "rotate(0deg)",
                    }}
                  />
                  <Icon name="file" class="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-weak)" }} />
                  <span class="text-xs truncate" style={{ color: "var(--text-base)" }}>
                    {group.relativePath}
                  </span>
                  <div class="flex-1" />
                  <Show when={group.errorCount > 0}>
                    <span
                      class="text-[10px] px-1 rounded"
                      style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)" }}
                    >
                      {group.errorCount}
                    </span>
                  </Show>
                  <Show when={group.warningCount > 0}>
                    <span
                      class="text-[10px] px-1 rounded"
                      style={{ background: "var(--cortex-warning)20", color: "var(--cortex-warning)" }}
                    >
                      {group.warningCount}
                    </span>
                  </Show>
                </button>

                {/* Diagnostics */}
                <Show when={expandedFiles().has(group.file)}>
                  <div class="pb-1">
                    <For each={group.diagnostics}>
                      {(diag) => <DiagnosticItem diagnostic={diag} />}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Diagnostic Item Component
// ============================================================================

interface DiagnosticItemProps {
  diagnostic: ParsedDiagnostic;
  onNavigate?: (diag: ParsedDiagnostic) => void;
}

function DiagnosticItem(props: DiagnosticItemProps) {
  const getSeverityIcon = () => {
    switch (props.diagnostic.severity) {
      case "error":
        return <Icon name="circle-exclamation" class="w-3.5 h-3.5" style={{ color: "var(--cortex-error)" }} />;
      case "warning":
        return <Icon name="triangle-exclamation" class="w-3.5 h-3.5" style={{ color: "var(--cortex-warning)" }} />;
      case "info":
        return <Icon name="circle-info" class="w-3.5 h-3.5" style={{ color: "var(--cortex-info)" }} />;
      case "hint":
        return <Icon name="circle-info" class="w-3.5 h-3.5" style={{ color: "var(--cortex-info)" }} />;
    }
  };

  const handleClick = () => {
    if (props.onNavigate) {
      props.onNavigate(props.diagnostic);
    } else {
      // Navigate to file location
      window.dispatchEvent(
        new CustomEvent("editor:navigate-to-location", {
          detail: {
            uri: `file://${props.diagnostic.file.replace(/\\/g, "/")}`,
            line: props.diagnostic.line,
            column: props.diagnostic.column,
          },
        })
      );
    }
  };

  return (
    <div
      class="flex items-start gap-2 px-3 py-1.5 ml-5 cursor-pointer hover:bg-[var(--surface-hover)] group"
      onClick={handleClick}
    >
      <div class="shrink-0 mt-0.5">{getSeverityIcon()}</div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-xs font-mono shrink-0"
            style={{ color: "var(--text-weak)" }}
          >
            {props.diagnostic.line}:{props.diagnostic.column}
          </span>
          <Show when={props.diagnostic.code}>
            <span
              class="text-[10px] px-1 rounded shrink-0"
              style={{ background: "var(--surface-hover)", color: "var(--text-weak)" }}
            >
              {props.diagnostic.code}
            </span>
          </Show>
        </div>
        <p
          class="text-xs break-words"
          style={{ color: "var(--text-base)" }}
        >
          {props.diagnostic.message}
        </p>
      </div>

      <button
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-active)]"
        title="Navigate to location"
      >
        <Icon name="arrow-up-right-from-square" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
      </button>
    </div>
  );
}

// ============================================================================
// Task Problems Panel Component
// ============================================================================

interface TaskProblemsPanelProps {
  taskLabel: string;
  output: string[];
  matcherConfig?: string | string[];
  basePath?: string;
}

/**
 * Panel to display problems parsed from a running task
 */
export function TaskProblemsPanel(props: TaskProblemsPanelProps) {
  // Diagnostics context available for future integration
  void useDiagnostics();
  const [localDiagnostics, setLocalDiagnostics] = createSignal<ParsedDiagnostic[]>([]);
  const [showFilter, setShowFilter] = createSignal(false);
  const [severityFilter, setSeverityFilter] = createSignal<Set<ProblemMatcherSeverity>>(
    new Set(["error", "warning", "info", "hint"])
  );

  // Parse diagnostics whenever output changes
  createEffect(() => {
    const output = props.output.join("\n");
    if (!props.matcherConfig || !output) {
      setLocalDiagnostics([]);
      return;
    }

    const matchers = Array.isArray(props.matcherConfig)
      ? props.matcherConfig
      : [props.matcherConfig];

    const allDiagnostics: ParsedDiagnostic[] = [];

    for (const matcher of matchers) {
      try {
        const parsed = parseTaskOutput(output, matcher, props.basePath || ".");
        allDiagnostics.push(...parsed);
      } catch (e) {
        console.error(`[ProblemMatcher] Failed to parse with ${matcher}:`, e);
      }
    }

    setLocalDiagnostics(allDiagnostics);
  });

  const filteredDiagnostics = createMemo(() =>
    localDiagnostics().filter((d) => severityFilter().has(d.severity))
  );

  const groupedDiagnostics = createMemo((): GroupedDiagnostic[] => {
    const byFile = new Map<string, ParsedDiagnostic[]>();

    for (const d of filteredDiagnostics()) {
      const existing = byFile.get(d.file) || [];
      existing.push(d);
      byFile.set(d.file, existing);
    }

    return Array.from(byFile.entries())
      .map(([file, diags]) => ({
        file,
        relativePath: getRelativePath(file, props.basePath),
        diagnostics: diags.sort((a, b) => a.line - b.line),
        errorCount: diags.filter((d) => d.severity === "error").length,
        warningCount: diags.filter((d) => d.severity === "warning").length,
      }))
      .sort((a, b) => b.errorCount - a.errorCount || b.warningCount - a.warningCount);
  });

  const counts = createMemo(() => ({
    error: localDiagnostics().filter((d) => d.severity === "error").length,
    warning: localDiagnostics().filter((d) => d.severity === "warning").length,
    info: localDiagnostics().filter((d) => d.severity === "info").length,
    hint: localDiagnostics().filter((d) => d.severity === "hint").length,
  }));

  const toggleSeverity = (severity: ProblemMatcherSeverity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const copyAllDiagnostics = () => {
    const text = filteredDiagnostics()
      .map(
        (d) =>
          `${d.file}:${d.line}:${d.column}: ${d.severity}: ${d.message}${
            d.code ? ` [${d.code}]` : ""
          }`
      )
      .join("\n");

    navigator.clipboard.writeText(text);
  };

  return (
    <div
      class="flex flex-col h-full"
      style={{
        background: "var(--surface-base)",
        "border-top": "1px solid var(--border-base)",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-base)" }}
      >
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
            Problems
          </span>

          {/* Counts */}
          <Show when={counts().error > 0}>
            <span
              class="flex items-center gap-1 text-xs px-1.5 rounded cursor-pointer"
              style={{
                background: severityFilter().has("error") ? "var(--cortex-error)30" : "var(--cortex-error)10",
                color: "var(--cortex-error)",
              }}
              onClick={() => toggleSeverity("error")}
            >
              <Icon name="circle-exclamation" class="w-3 h-3" />
              {counts().error}
            </span>
          </Show>
          <Show when={counts().warning > 0}>
            <span
              class="flex items-center gap-1 text-xs px-1.5 rounded cursor-pointer"
              style={{
                background: severityFilter().has("warning") ? "var(--cortex-warning)30" : "var(--cortex-warning)10",
                color: "var(--cortex-warning)",
              }}
              onClick={() => toggleSeverity("warning")}
            >
              <Icon name="triangle-exclamation" class="w-3 h-3" />
              {counts().warning}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="p-1 rounded hover:bg-[var(--surface-hover)]"
            title="Copy all"
            onClick={copyAllDiagnostics}
          >
            <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </button>
          <button
            class="p-1 rounded hover:bg-[var(--surface-hover)]"
            title="Filter"
            onClick={() => setShowFilter(!showFilter())}
          >
            <Icon name="filter" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <Show when={showFilter()}>
        <div
          class="flex items-center gap-2 px-3 py-1.5 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            Show:
          </span>
          {(["error", "warning", "info", "hint"] as ProblemMatcherSeverity[]).map((sev) => (
            <button
              class="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: severityFilter().has(sev)
                  ? "var(--surface-active)"
                  : "transparent",
                color: severityFilter().has(sev)
                  ? "var(--text-base)"
                  : "var(--text-weak)",
              }}
              onClick={() => toggleSeverity(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
      </Show>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={groupedDiagnostics().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-8">
              <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                No problems found
              </p>
            </div>
          }
        >
          <For each={groupedDiagnostics()}>
            {(group) => (
              <FileProblemsGroup group={group} />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// File Problems Group Component
// ============================================================================

interface FileProblemsGroupProps {
  group: GroupedDiagnostic;
}

function FileProblemsGroup(props: FileProblemsGroupProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);

  return (
    <div class="border-b" style={{ "border-color": "var(--border-weak)" }}>
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-hover)]"
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <Icon
          name="chevron-right"
          class="w-3 h-3 transition-transform shrink-0"
          style={{
            color: "var(--text-weak)",
            transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        <Icon name="file" class="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-weak)" }} />
        <span class="text-xs truncate text-left" style={{ color: "var(--text-base)" }}>
          {props.group.relativePath}
        </span>
        <div class="flex-1" />
        <Show when={props.group.errorCount > 0}>
          <span
            class="text-[10px] px-1 rounded"
            style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)" }}
          >
            {props.group.errorCount}
          </span>
        </Show>
        <Show when={props.group.warningCount > 0}>
          <span
            class="text-[10px] px-1 rounded"
            style={{ background: "var(--cortex-warning)20", color: "var(--cortex-warning)" }}
          >
            {props.group.warningCount}
          </span>
        </Show>
      </button>

      <Show when={isExpanded()}>
        <For each={props.group.diagnostics}>
          {(diag) => <DiagnosticItem diagnostic={diag} />}
        </For>
      </Show>
    </div>
  );
}

// ============================================================================
// Problem Matcher Selector Component
// ============================================================================

interface ProblemMatcherSelectorProps {
  value: string[];
  onChange: (matchers: string[]) => void;
}

/**
 * Selector for choosing problem matchers
 */
export function ProblemMatcherSelector(props: ProblemMatcherSelectorProps) {
  const availableMatchers = Object.keys(BUILTIN_PROBLEM_MATCHERS);

  const toggleMatcher = (matcher: string) => {
    if (props.value.includes(matcher)) {
      props.onChange(props.value.filter((m) => m !== matcher));
    } else {
      props.onChange([...props.value, matcher]);
    }
  };

  const getMatcherDescription = (matcher: string) => {
    switch (matcher) {
      case "$tsc":
        return "TypeScript compiler";
      case "$tsc-watch":
        return "TypeScript watch mode";
      case "$eslint-stylish":
        return "ESLint stylish format";
      case "$eslint-compact":
        return "ESLint compact format";
      case "$gcc":
        return "GCC/Clang compiler";
      case "$go":
        return "Go compiler";
      case "$go-test":
        return "Go test runner";
      case "$python":
        return "Python traceback";
      case "$rustc":
        return "Rust compiler";
      case "$mscompile":
        return "MSBuild/C# compiler";
      case "$javac":
        return "Java/Maven compiler";
      default:
        return matcher;
    }
  };

  return (
    <div class="space-y-2">
      <label class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
        Problem Matchers
      </label>
      <div class="grid grid-cols-2 gap-2">
        <For each={availableMatchers}>
          {(matcher) => (
            <button
              class="flex items-center gap-2 px-2 py-1.5 rounded text-left"
              style={{
                background: props.value.includes(matcher)
                  ? "var(--cortex-info)20"
                  : "var(--surface-raised)",
                border: props.value.includes(matcher)
                  ? "1px solid var(--cortex-info)"
                  : "1px solid var(--border-base)",
                color: "var(--text-base)",
              }}
              onClick={() => toggleMatcher(matcher)}
            >
              <div
                class="w-3 h-3 rounded-sm flex items-center justify-center"
                style={{
                  background: props.value.includes(matcher)
                    ? "var(--cortex-info)"
                    : "var(--surface-hover)",
                }}
              >
                <Show when={props.value.includes(matcher)}>
                  <svg
                    class="w-2 h-2 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </Show>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-mono">{matcher}</div>
                <div class="text-[10px]" style={{ color: "var(--text-weak)" }}>
                  {getMatcherDescription(matcher)}
                </div>
              </div>
            </button>
          )}
        </For>
      </div>
      <p class="text-[10px]" style={{ color: "var(--text-weak)" }}>
        Selected matchers will parse task output and populate the Problems panel
      </p>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function getRelativePath(filePath: string, basePath?: string): string {
  if (!basePath) return filePath;

  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedBase = basePath.replace(/\\/g, "/").replace(/\/$/, "");

  if (normalizedFile.startsWith(normalizedBase)) {
    return normalizedFile.slice(normalizedBase.length + 1);
  }

  return filePath;
}

// ============================================================================
// Exports
// ============================================================================

export {
  DiagnosticItem,
  FileProblemsGroup,
  getRelativePath,
};

