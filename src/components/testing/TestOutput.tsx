import { Show, For, createSignal, createEffect } from "solid-js";
import { useTesting } from "@/context/TestingContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";

const SCROLL_THRESHOLD_PX = 30;

const ANSI_COLORS: Record<string, string> = {
  "30": "var(--text-weak)",
  "31": "var(--cortex-error)",
  "32": "var(--cortex-success)",
  "33": "var(--cortex-warning)",
  "34": "var(--cortex-info)",
  "35": "#c586c0",
  "36": "#4ec9b0",
  "37": "var(--text-base)",
  "90": "var(--text-weak)",
  "91": "#f48771",
  "92": "#89d185",
  "93": "#e2c08d",
  "94": "#6cb6ff",
  "95": "#d2a8ff",
  "96": "#56d4dd",
  "97": "var(--text-base)",
};

interface AnsiSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

function parseAnsiLine(line: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentColor: string | undefined;
  let currentBold = false;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), color: currentColor, bold: currentBold });
    }
    const codes = match[1].split(";");
    for (const code of codes) {
      if (code === "0" || code === "") {
        currentColor = undefined;
        currentBold = false;
      } else if (code === "1") {
        currentBold = true;
      } else if (ANSI_COLORS[code]) {
        currentColor = ANSI_COLORS[code];
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), color: currentColor, bold: currentBold });
  }

  if (segments.length === 0 && line.length > 0) {
    segments.push({ text: line });
  }

  return segments;
}

function OutputLine(props: { line: string }) {
  const segments = () => parseAnsiLine(props.line);

  return (
    <div style={{ "min-height": "18px", "line-height": "18px", "white-space": "pre-wrap", "word-break": "break-all" }}>
      <For each={segments()}>
        {(seg) => (
          <span style={{
            color: seg.color || "var(--text-base)",
            "font-weight": seg.bold ? "bold" : "normal",
          }}>
            {seg.text}
          </span>
        )}
      </For>
    </div>
  );
}

export function TestOutput() {
  const testing = useTesting();
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [filterStream, setFilterStream] = createSignal<"all" | "stdout" | "stderr">("all");
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    void testing.state.output.length;
    if (autoScroll() && containerRef) {
      requestAnimationFrame(() => {
        containerRef!.scrollTop = containerRef!.scrollHeight;
      });
    }
  });

  const handleScroll = () => {
    if (!containerRef) return;
    const isAtBottom = containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight < SCROLL_THRESHOLD_PX;
    if (!isAtBottom && autoScroll()) {
      setAutoScroll(false);
    }
  };

  const filteredOutput = () => {
    const output = testing.state.output;
    const stream = filterStream();
    if (stream === "all") return output;
    return output.filter((line) => {
      if (stream === "stderr") return line.includes("ERR") || line.includes("Error") || line.includes("FAIL");
      return true;
    });
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center justify-between px-2 shrink-0" style={{ height: "28px", "border-bottom": "1px solid var(--surface-border)" }}>
        <div class="flex items-center gap-2">
          <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Output</span>
          <Show when={testing.state.isRunning}>
            <span class="animate-spin" style={{ color: "var(--cortex-info)", "font-size": "10px" }}>⟳</span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <select
            value={filterStream()}
            onChange={(e) => setFilterStream(e.currentTarget.value as "all" | "stdout" | "stderr")}
            style={{
              background: "var(--cortex-bg-primary)",
              color: "var(--text-base)",
              border: "1px solid var(--surface-border)",
              "border-radius": "3px",
              "font-size": "10px",
              height: "20px",
              padding: "0 4px",
              outline: "none",
            }}
          >
            <option value="all">All</option>
            <option value="stdout">stdout</option>
            <option value="stderr">stderr</option>
          </select>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={() => setAutoScroll(!autoScroll())}
            title={autoScroll() ? "Auto-scroll On" : "Auto-scroll Off"}
          >
            <Icon name={autoScroll() ? "lock" : "lock-open"} size={10} color={autoScroll() ? "var(--cortex-accent-primary)" : "var(--text-weak)"} />
          </IconButton>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={() => testing.clearOutput()}
            title="Clear Output"
          >
            <Icon name="trash-can" size={10} />
          </IconButton>
        </div>
      </div>
      <div
        ref={containerRef}
        class="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
        style={{
          "font-size": "12px",
          "font-family": "var(--monaco-monospace-font, monospace)",
        }}
        onScroll={handleScroll}
      >
        <For each={filteredOutput()}>
          {(line) => <OutputLine line={line} />}
        </For>
        <Show when={filteredOutput().length === 0}>
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            No output yet
          </div>
        </Show>
      </div>
    </div>
  );
}
