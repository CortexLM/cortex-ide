import { Show, For, createSignal, createMemo } from "solid-js";
import { useTesting, type TestItem, type TestStatus } from "@/context/TestingContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";

function statusIcon(status: TestStatus): { name: string; color: string } {
  switch (status) {
    case "passed": return { name: "circle-check", color: "var(--cortex-success)" };
    case "failed": return { name: "circle-xmark", color: "var(--cortex-error)" };
    case "skipped": return { name: "circle-minus", color: "var(--text-weak)" };
    case "running": return { name: "spinner", color: "var(--cortex-info)" };
    case "error": return { name: "triangle-exclamation", color: "var(--cortex-error)" };
    default: return { name: "circle", color: "var(--text-weak)" };
  }
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "";
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function TestItemRow(props: {
  test: TestItem;
  depth: number;
  onNavigate: (filePath: string, line?: number) => void;
}) {
  const testing = useTesting();
  const [expanded, setExpanded] = createSignal(false);
  const indent = () => `${props.depth * 16 + 8}px`;
  const icon = () => statusIcon(props.test.status);
  const hasChildren = () => props.test.children.length > 0;
  const hasError = () => !!props.test.errorMessage;
  const result = () => testing.getTestResult(props.test.id);

  return (
    <div>
      <div
        class="flex items-center gap-1 group hover:bg-[var(--surface-raised)] cursor-pointer"
        style={{ height: "24px", "padding-left": indent(), "font-size": "12px" }}
        onClick={() => {
          if (hasChildren()) setExpanded(!expanded());
          else if (hasError()) setExpanded(!expanded());
        }}
      >
        <Show when={hasChildren()}>
          <span class="w-3 shrink-0 text-center" style={{ color: "var(--text-weak)" }}>
            {expanded() ? "▾" : "▸"}
          </span>
        </Show>
        <Show when={!hasChildren()}>
          <span class="w-3 shrink-0" />
        </Show>
        <Icon name={icon().name} size={14} color={icon().color} class="shrink-0" />
        <span class="truncate" style={{ color: "var(--text-base)" }}>
          {props.test.name}
        </span>
        <Show when={props.test.duration !== undefined}>
          <span style={{ color: "var(--text-weak)", "font-size": "11px", "margin-left": "auto", "padding-right": "8px" }}>
            {formatDuration(props.test.duration)}
          </span>
        </Show>
        <div class="shrink-0 opacity-0 group-hover:opacity-100 flex gap-0.5 pr-1">
          <IconButton
            size="sm"
            variant="ghost"
            onClick={(e: MouseEvent) => { e.stopPropagation(); props.onNavigate(props.test.filePath, props.test.line); }}
            title="Go to Test"
          >
            <Icon name="arrow-up-right-from-square" size={10} />
          </IconButton>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={(e: MouseEvent) => { e.stopPropagation(); testing.runTest(props.test.id); }}
            title="Run Test"
          >
            <Icon name="play" size={10} />
          </IconButton>
        </div>
      </div>
      <Show when={expanded() && hasError()}>
        <div
          style={{
            "padding-left": `${props.depth * 16 + 32}px`,
            "padding-right": "8px",
            "padding-top": "4px",
            "padding-bottom": "4px",
            "font-size": "11px",
            "font-family": "var(--monaco-monospace-font, monospace)",
            "white-space": "pre-wrap",
            "word-break": "break-word",
            background: "var(--cortex-error-bg, rgba(255,0,0,0.05))",
            "border-left": "3px solid var(--cortex-error)",
          }}
        >
          <div style={{ color: "var(--cortex-error)" }}>{props.test.errorMessage}</div>
          <Show when={props.test.errorStack}>
            <div style={{ color: "var(--text-weak)", "margin-top": "4px" }}>{props.test.errorStack}</div>
          </Show>
          <Show when={result()?.output && result()!.output.length > 0}>
            <div style={{ color: "var(--text-weak)", "margin-top": "4px", "border-top": "1px solid var(--surface-border)", "padding-top": "4px" }}>
              <For each={result()!.output}>
                {(line) => <div>{line}</div>}
              </For>
            </div>
          </Show>
        </div>
      </Show>
      <Show when={expanded() && hasChildren()}>
        <For each={props.test.children}>
          {(child) => <TestItemRow test={child} depth={props.depth + 1} onNavigate={props.onNavigate} />}
        </For>
      </Show>
    </div>
  );
}

export function TestResults() {
  const testing = useTesting();
  const [filter, setFilter] = createSignal<"all" | "failed" | "passed">("all");

  const counts = () => testing.testCounts();
  const duration = () => {
    const run = testing.state.currentRun;
    if (!run) return null;
    if (run.duration !== undefined) return run.duration;
    if (run.startedAt && run.finishedAt) return run.finishedAt - run.startedAt;
    return null;
  };

  const filteredTests = createMemo(() => {
    const tests = testing.filteredTests();
    const f = filter();
    if (f === "all") return tests;
    return tests.filter((t) => {
      if (f === "failed") return t.status === "failed" || t.status === "error";
      if (f === "passed") return t.status === "passed";
      return true;
    });
  });

  const handleNavigate = (filePath: string, line?: number) => {
    window.dispatchEvent(new CustomEvent("editor:goto", {
      detail: { path: filePath, line: line || 1, column: 1, focus: true },
    }));
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center gap-2 px-2 shrink-0" style={{ height: "32px", "border-bottom": "1px solid var(--surface-border)" }}>
        <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Test Results</span>
        <Show when={duration() !== null}>
          <span style={{ color: "var(--text-weak)", "font-size": "11px" }}>
            {formatDuration(duration()!)}
          </span>
        </Show>
      </div>
      <div class="flex items-center gap-2 px-2 shrink-0" style={{ height: "28px", "border-bottom": "1px solid var(--surface-border)" }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            background: filter() === "all" ? "var(--cortex-accent-primary)" : "transparent",
            color: filter() === "all" ? "white" : "var(--text-base)",
            border: "none",
            "border-radius": "3px",
            padding: "1px 8px",
            "font-size": "11px",
            cursor: "pointer",
          }}
        >
          All {counts().total}
        </button>
        <div class="flex items-center gap-1">
          <button
            onClick={() => setFilter("passed")}
            style={{
              background: filter() === "passed" ? "var(--cortex-success)" : "transparent",
              color: filter() === "passed" ? "white" : "var(--cortex-success)",
              border: "none",
              "border-radius": "3px",
              padding: "1px 8px",
              "font-size": "11px",
              cursor: "pointer",
            }}
          >
            ✓ {counts().passed}
          </button>
          <button
            onClick={() => setFilter("failed")}
            style={{
              background: filter() === "failed" ? "var(--cortex-error)" : "transparent",
              color: filter() === "failed" ? "white" : "var(--cortex-error)",
              border: "none",
              "border-radius": "3px",
              padding: "1px 8px",
              "font-size": "11px",
              cursor: "pointer",
            }}
          >
            ✕ {counts().failed}
          </button>
          <span style={{ color: "var(--text-weak)", "font-size": "11px" }}>
            ⊘ {counts().skipped}
          </span>
        </div>
        <Show when={testing.state.isRunning}>
          <span class="animate-spin" style={{ color: "var(--cortex-info)", "font-size": "11px", "margin-left": "auto" }}>⟳</span>
        </Show>
      </div>
      <div class="flex-1 overflow-y-auto">
        <For each={filteredTests()}>
          {(test) => <TestItemRow test={test} depth={0} onNavigate={handleNavigate} />}
        </For>
        <Show when={filteredTests().length === 0}>
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            <Show when={counts().total === 0} fallback="No matching tests">
              No test results yet
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
