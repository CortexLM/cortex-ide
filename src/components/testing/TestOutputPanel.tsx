/**
 * TestOutputPanel.tsx
 * 
 * Dedicated output panel for test results.
 * - Collapsible test output
 * - Syntax highlighting for errors
 * - Stack trace parsing with clickable links
 * - Diff view for assertion failures
 */

import { createSignal, createEffect, createMemo, For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useTesting, TestRunResult, TestStatus } from "@/context/TestingContext";

export interface TestOutputPanelProps {
  onGoToFile?: (filePath: string, line?: number, column?: number) => void;
}

interface ParsedStackFrame {
  file: string;
  line: number;
  column?: number;
  functionName?: string;
  raw: string;
}

interface AssertionDiff {
  expected: string;
  actual: string;
  message?: string;
}

/**
 * Parse stack trace lines into clickable frames
 */
function parseStackTrace(trace: string): ParsedStackFrame[] {
  const frames: ParsedStackFrame[] = [];
  const lines = trace.split("\n");

  // Common stack trace patterns
  const patterns = [
    // Node.js / JavaScript: "    at functionName (file:line:column)"
    /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/,
    // Node.js / JavaScript: "    at file:line:column"
    /^\s*at\s+(.+?):(\d+):(\d+)$/,
    // Python: "  File "path", line N, in function"
    /^\s*File\s+"(.+?)",\s+line\s+(\d+)(?:,\s+in\s+(.+))?$/,
    // Rust: "   --> file:line:column"
    /^\s*-->\s+(.+?):(\d+):(\d+)$/,
    // Go: "    file:line +offset"
    /^\s*(.+?):(\d+)\s+/,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        // Determine which capture groups have what
        if (pattern.source.includes("at") && match[2]) {
          // Node.js pattern
          frames.push({
            functionName: match[1] || undefined,
            file: match[2],
            line: parseInt(match[3], 10),
            column: match[4] ? parseInt(match[4], 10) : undefined,
            raw: line,
          });
        } else if (pattern.source.includes("File")) {
          // Python pattern
          frames.push({
            file: match[1],
            line: parseInt(match[2], 10),
            functionName: match[3] || undefined,
            raw: line,
          });
        } else if (match[1] && match[2]) {
          // Other patterns
          frames.push({
            file: match[1],
            line: parseInt(match[2], 10),
            column: match[3] ? parseInt(match[3], 10) : undefined,
            raw: line,
          });
        }
        break;
      }
    }
  }

  return frames;
}

/**
 * Parse assertion failure diff from error message
 */
function parseAssertionDiff(message: string): AssertionDiff | null {
  // Jest/Vitest pattern
  const jestPattern = /Expected:\s*(.+?)\s*Received:\s*(.+)/s;
  const jestMatch = message.match(jestPattern);
  if (jestMatch) {
    return {
      expected: jestMatch[1].trim(),
      actual: jestMatch[2].trim(),
    };
  }

  // pytest pattern
  const pytestPattern = /AssertionError:\s*(.+?)\s*!=\s*(.+)/;
  const pytestMatch = message.match(pytestPattern);
  if (pytestMatch) {
    return {
      expected: pytestMatch[1].trim(),
      actual: pytestMatch[2].trim(),
    };
  }

  // Rust pattern
  const rustPattern = /assertion\s+(?:failed|`left == right`)[\s\S]*left:\s*`?(.+?)`?\s*right:\s*`?(.+?)`?$/m;
  const rustMatch = message.match(rustPattern);
  if (rustMatch) {
    return {
      expected: rustMatch[1].trim(),
      actual: rustMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get status color
 */
function getStatusColor(status: TestStatus): string {
  switch (status) {
    case "passed":
      return "var(--cortex-success)";
    case "failed":
    case "error":
      return "var(--cortex-error)";
    case "skipped":
      return "var(--cortex-warning)";
    case "running":
      return "var(--cortex-info)";
    default:
      return "var(--cortex-text-inactive)";
  }
}

/**
 * Get status icon
 */
function StatusIcon(props: { status: TestStatus; size?: string }) {
  const size = props.size || "w-4 h-4";
  const color = getStatusColor(props.status);

  switch (props.status) {
    case "passed":
      return <Icon name="check" class={size} style={{ color }} />;
    case "failed":
    case "error":
      return <Icon name="xmark" class={size} style={{ color }} />;
    case "skipped":
      return <Icon name="minus" class={size} style={{ color }} />;
    case "running":
      return <Icon name="play" class={`${size} animate-pulse`} style={{ color }} />;
    default:
      return <Icon name="clock" class={size} style={{ color }} />;
  }
}

/**
 * Single test result item component
 */
function TestResultItem(props: {
  testId: string;
  testName: string;
  result: TestRunResult;
  onGoToFile?: (filePath: string, line?: number, column?: number) => void;
}) {
  const [isExpanded, setIsExpanded] = createSignal(props.result.status === "failed" || props.result.status === "error");

  const stackFrames = createMemo(() => {
    if (props.result.errorStack) {
      return parseStackTrace(props.result.errorStack);
    }
    return [];
  });

  const assertionDiff = createMemo(() => {
    if (props.result.errorMessage) {
      return parseAssertionDiff(props.result.errorMessage);
    }
    return null;
  });

  const handleFrameClick = (frame: ParsedStackFrame) => {
    props.onGoToFile?.(frame.file, frame.line, frame.column);
  };

  const copyOutput = async () => {
    const output = [
      `Test: ${props.testName}`,
      `Status: ${props.result.status}`,
      `Duration: ${formatDuration(props.result.duration)}`,
      props.result.errorMessage ? `\nError: ${props.result.errorMessage}` : "",
      props.result.errorStack ? `\nStack Trace:\n${props.result.errorStack}` : "",
      props.result.output.length > 0 ? `\nOutput:\n${props.result.output.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(output);
  };

  return (
    <div class="test-result-item">
      <div
        class="test-result-header"
        classList={{ "test-result-header--expanded": isExpanded() }}
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <span class="test-result-chevron">
          {isExpanded() ? <Icon name="chevron-down" class="w-3 h-3" /> : <Icon name="chevron-right" class="w-3 h-3" />}
        </span>
        <StatusIcon status={props.result.status} />
        <span class="test-result-name" title={props.testName}>
          {props.testName}
        </span>
        <span class="test-result-duration">{formatDuration(props.result.duration)}</span>
        <button class="test-result-action" onClick={(e) => { e.stopPropagation(); copyOutput(); }} title="Copy output">
          <Icon name="copy" class="w-3 h-3" />
        </button>
      </div>

      <Show when={isExpanded()}>
        <div class="test-result-content">
          {/* Error message */}
          <Show when={props.result.errorMessage}>
            <div class="test-result-error">
              <div class="test-result-error-header">
                <Icon name="triangle-exclamation" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
                <span>Error</span>
              </div>
              <pre class="test-result-error-message">{props.result.errorMessage}</pre>
            </div>
          </Show>

          {/* Assertion diff */}
          <Show when={assertionDiff()}>
            <div class="test-result-diff">
              <div class="test-result-diff-header">Assertion Difference</div>
              <div class="test-result-diff-content">
                <div class="test-result-diff-expected">
                  <span class="test-result-diff-label">Expected:</span>
                  <pre>{assertionDiff()?.expected}</pre>
                </div>
                <div class="test-result-diff-actual">
                  <span class="test-result-diff-label">Actual:</span>
                  <pre>{assertionDiff()?.actual}</pre>
                </div>
              </div>
            </div>
          </Show>

          {/* Stack trace */}
          <Show when={stackFrames().length > 0}>
            <div class="test-result-stack">
              <div class="test-result-stack-header">Stack Trace</div>
              <div class="test-result-stack-frames">
                <For each={stackFrames()}>
                  {(frame) => (
                    <div
                      class="test-result-stack-frame"
                      onClick={() => handleFrameClick(frame)}
                      title="Click to go to file"
                    >
                      <Show when={frame.functionName}>
                        <span class="test-result-stack-function">{frame.functionName}</span>
                      </Show>
                      <span class="test-result-stack-location">
                        {frame.file}:{frame.line}
                        {frame.column !== undefined ? `:${frame.column}` : ""}
                      </span>
                      <Icon name="arrow-up-right-from-square" class="w-3 h-3 test-result-stack-link" />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Console output */}
          <Show when={props.result.output.length > 0}>
            <div class="test-result-output">
              <div class="test-result-output-header">Console Output</div>
              <pre class="test-result-output-content">{props.result.output.join("\n")}</pre>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * Main test output panel component
 */
export function TestOutputPanel(props: TestOutputPanelProps) {
  const testing = useTesting();
  const [filter, setFilter] = createSignal<"all" | "failed">("all");
  const [autoScroll, setAutoScroll] = createSignal(true);

  let outputContainerRef: HTMLDivElement | undefined;

  // Get current run results
  const results = createMemo(() => {
    const run = testing.state.currentRun;
    if (!run) return [];

    const entries: Array<{ testId: string; testName: string; result: TestRunResult }> = [];
    run.results.forEach((result, testId) => {
      const test = testing.state.testIndex.get(testId);
      entries.push({
        testId,
        testName: test?.fullName || testId,
        result,
      });
    });

    // Apply filter
    if (filter() === "failed") {
      return entries.filter((e) => e.result.status === "failed" || e.result.status === "error");
    }

    return entries;
  });

  // Auto-scroll to bottom on new output
  createEffect(() => {
    // Access output.length to create dependency for reactivity
    void testing.state.output.length;
    if (autoScroll() && outputContainerRef) {
      outputContainerRef.scrollTop = outputContainerRef.scrollHeight;
    }
  });

  const clearOutput = () => {
    testing.clearOutput();
  };

  const copyAllOutput = async () => {
    const output = testing.state.output.join("\n");
    await navigator.clipboard.writeText(output);
  };

  const exportResults = () => {
    const run = testing.state.currentRun;
    if (!run) return;

    const data = {
      runId: run.id,
      startedAt: new Date(run.startedAt).toISOString(),
      finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
      status: run.status,
      summary: {
        total: run.totalTests,
        passed: run.passedTests,
        failed: run.failedTests,
        skipped: run.skippedTests,
      },
      results: Array.from(run.results.entries()).map(([id, result]) => ({
        id,
        ...result,
      })),
      output: testing.state.output,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-results-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="test-output-panel">
      {/* Header */}
      <div class="test-output-header">
        <span class="test-output-title">Test Output</span>
        <div class="test-output-actions">
          <select
            class="test-output-filter"
            value={filter()}
            onChange={(e) => setFilter(e.currentTarget.value as "all" | "failed")}
          >
            <option value="all">All Tests</option>
            <option value="failed">Failed Only</option>
          </select>
          <label class="test-output-autoscroll">
            <input
              type="checkbox"
              checked={autoScroll()}
              onChange={(e) => setAutoScroll(e.currentTarget.checked)}
            />
            <span>Auto-scroll</span>
          </label>
          <button class="test-output-action" onClick={copyAllOutput} title="Copy all output">
            <Icon name="copy" class="w-4 h-4" />
          </button>
          <button class="test-output-action" onClick={exportResults} title="Export results">
            <Icon name="download" class="w-4 h-4" />
          </button>
          <button class="test-output-action" onClick={clearOutput} title="Clear output">
            <Icon name="trash" class="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <Show when={testing.state.currentRun}>
        <div class="test-output-summary">
          <div class="test-output-summary-stats">
            <span class="test-output-stat test-output-stat--total">
              {testing.state.currentRun!.totalTests} tests
            </span>
            <span class="test-output-stat test-output-stat--passed">
              <Icon name="check" class="w-3 h-3" />
              {testing.state.currentRun!.passedTests}
            </span>
            <span class="test-output-stat test-output-stat--failed">
              <Icon name="xmark" class="w-3 h-3" />
              {testing.state.currentRun!.failedTests}
            </span>
            <Show when={testing.state.currentRun!.skippedTests > 0}>
              <span class="test-output-stat test-output-stat--skipped">
                <Icon name="minus" class="w-3 h-3" />
                {testing.state.currentRun!.skippedTests}
              </span>
            </Show>
          </div>
          <Show when={testing.state.currentRun!.duration}>
            <span class="test-output-summary-duration">
              <Icon name="clock" class="w-3 h-3" />
              {formatDuration(testing.state.currentRun!.duration!)}
            </span>
          </Show>
        </div>
      </Show>

      {/* Results list */}
      <div class="test-output-results" ref={outputContainerRef}>
        <Show
          when={results().length > 0}
          fallback={
            <div class="test-output-empty">
              <Show
                when={testing.state.isRunning}
                fallback={
                  <>
                    <Icon name="play" class="w-8 h-8" style={{ color: "var(--text-weaker)", opacity: "0.5" }} />
                    <p>Run tests to see results</p>
                  </>
                }
              >
                <div class="test-output-running">
                  <div class="test-output-spinner" />
                  <p>Running tests...</p>
                </div>
              </Show>
            </div>
          }
        >
          <For each={results()}>
            {(item) => (
              <TestResultItem
                testId={item.testId}
                testName={item.testName}
                result={item.result}
                onGoToFile={props.onGoToFile}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Raw output */}
      <Show when={testing.state.output.length > 0}>
        <details class="test-output-raw">
          <summary>Raw Output ({testing.state.output.length} lines)</summary>
          <pre class="test-output-raw-content">{testing.state.output.join("\n")}</pre>
        </details>
      </Show>

      {/* Styles */}
      <style>{`
        .test-output-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--background-base);
          color: var(--text-base);
        }

        .test-output-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-weak);
          min-height: 36px;
        }

        .test-output-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-weak);
        }

        .test-output-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .test-output-filter {
          padding: 2px 6px;
          font-size: 11px;
          background: var(--surface-sunken);
          border: 1px solid var(--border-weak);
          border-radius: var(--cortex-radius-sm);
          color: var(--text-base);
          outline: none;
        }

        .test-output-autoscroll {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-weak);
          cursor: pointer;
        }

        .test-output-autoscroll input {
          margin: 0;
        }

        .test-output-action {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          background: transparent;
          border: none;
          border-radius: var(--cortex-radius-sm);
          color: var(--text-weak);
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
        }

        .test-output-action:hover {
          background: var(--surface-raised);
          color: var(--text-base);
        }

        .test-output-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--surface-sunken);
          border-bottom: 1px solid var(--border-weak);
        }

        .test-output-summary-stats {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .test-output-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .test-output-stat--total { color: var(--text-weak); }
        .test-output-stat--passed { color: var(--cortex-success); }
        .test-output-stat--failed { color: var(--cortex-error); }
        .test-output-stat--skipped { color: var(--cortex-warning); }

        .test-output-summary-duration {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-weaker);
        }

        .test-output-results {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .test-output-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--text-weaker);
          font-size: 13px;
        }

        .test-output-running {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .test-output-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-weak);
          border-top-color: var(--cortex-info);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .test-result-item {
          border-bottom: 1px solid var(--border-weak);
        }

        .test-result-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .test-result-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .test-result-chevron {
          color: var(--text-weaker);
        }

        .test-result-name {
          flex: 1;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .test-result-duration {
          font-size: 10px;
          color: var(--text-weaker);
          font-family: monospace;
        }

        .test-result-action {
          opacity: 0;
          padding: 4px;
          background: transparent;
          border: none;
          border-radius: var(--cortex-radius-sm);
          color: var(--text-weak);
          cursor: pointer;
          transition: opacity 0.1s, background 0.1s;
        }

        .test-result-header:hover .test-result-action {
          opacity: 1;
        }

        .test-result-action:hover {
          background: var(--surface-raised);
        }

        .test-result-content {
          padding: 0 12px 12px 36px;
        }

        .test-result-error {
          margin-bottom: 12px;
        }

        .test-result-error-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--cortex-error);
          margin-bottom: 4px;
        }

        .test-result-error-message {
          padding: 8px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: var(--cortex-radius-sm);
          font-size: 11px;
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
        }

        .test-result-diff {
          margin-bottom: 12px;
        }

        .test-result-diff-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-weak);
          margin-bottom: 6px;
        }

        .test-result-diff-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .test-result-diff-expected,
        .test-result-diff-actual {
          padding: 8px;
          border-radius: var(--cortex-radius-sm);
          font-family: monospace;
          font-size: 11px;
        }

        .test-result-diff-expected {
          background: rgba(34, 197, 94, 0.1);
          border-left: 3px solid var(--cortex-success);
        }

        .test-result-diff-actual {
          background: rgba(239, 68, 68, 0.1);
          border-left: 3px solid var(--cortex-error);
        }

        .test-result-diff-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: var(--text-weak);
          margin-bottom: 4px;
        }

        .test-result-diff-expected pre,
        .test-result-diff-actual pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .test-result-stack {
          margin-bottom: 12px;
        }

        .test-result-stack-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-weak);
          margin-bottom: 6px;
        }

        .test-result-stack-frames {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .test-result-stack-frame {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          font-size: 11px;
          font-family: monospace;
          background: var(--surface-sunken);
          border-radius: var(--cortex-radius-sm);
          cursor: pointer;
          transition: background 0.1s;
        }

        .test-result-stack-frame:hover {
          background: var(--surface-raised);
        }

        .test-result-stack-function {
          color: var(--cortex-info);
        }

        .test-result-stack-location {
          color: var(--text-weak);
          flex: 1;
        }

        .test-result-stack-link {
          color: var(--text-weaker);
          opacity: 0;
          transition: opacity 0.1s;
        }

        .test-result-stack-frame:hover .test-result-stack-link {
          opacity: 1;
        }

        .test-result-output {
          margin-bottom: 12px;
        }

        .test-result-output-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-weak);
          margin-bottom: 6px;
        }

        .test-result-output-content {
          padding: 8px;
          background: var(--surface-sunken);
          border-radius: var(--cortex-radius-sm);
          font-size: 11px;
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow-y: auto;
          margin: 0;
        }

        .test-output-raw {
          border-top: 1px solid var(--border-weak);
        }

        .test-output-raw summary {
          padding: 8px 12px;
          font-size: 11px;
          color: var(--text-weak);
          cursor: pointer;
          user-select: none;
        }

        .test-output-raw summary:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .test-output-raw-content {
          padding: 8px 12px;
          margin: 0;
          font-size: 11px;
          font-family: monospace;
          background: var(--surface-sunken);
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 300px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}

export default TestOutputPanel;

