/**
 * InlineDiffView - Unified/inline diff display
 *
 * Shows additions and deletions inline in a single scrollable view
 * with dual line numbers (original + modified) and LCS-based comparison.
 */

import { createSignal, createEffect, createMemo, Show, For, onMount, onCleanup, type JSX } from "solid-js";

const MONO_FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";
const ADDITION_BG = "rgba(78, 201, 176, 0.15)";
const ADDITION_BG_ACTIVE = "rgba(78, 201, 176, 0.3)";
const DELETION_BG = "rgba(241, 76, 76, 0.15)";
const DELETION_BG_ACTIVE = "rgba(241, 76, 76, 0.3)";

interface DiffChange {
  type: "addition" | "deletion" | "modification";
  originalStartLine: number;
  originalEndLine: number;
  modifiedStartLine: number;
  modifiedEndLine: number;
}

interface InlineDiffViewProps {
  originalContent: string;
  modifiedContent: string;
  language: string;
  originalPath?: string;
  modifiedPath?: string;
  changes?: DiffChange[];
  currentChangeIndex?: number;
  onNavigateChange?: (index: number) => void;
  fontSize?: number;
  lineHeight?: number;
}

interface DiffLine {
  type: "added" | "deleted" | "unchanged";
  content: string;
  originalLineNum: number | null;
  modifiedLineNum: number | null;
  changeIndex: number | null;
}

function computeLCSDiff(originalLines: string[], modifiedLines: string[]): DiffLine[] {
  const m = originalLines.length;
  const n = modifiedLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = originalLines[i - 1] === modifiedLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      result.push({ type: "unchanged", content: originalLines[i - 1], originalLineNum: i, modifiedLineNum: j, changeIndex: null });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", content: modifiedLines[j - 1], originalLineNum: null, modifiedLineNum: j, changeIndex: null });
      j--;
    } else {
      result.push({ type: "deleted", content: originalLines[i - 1], originalLineNum: i, modifiedLineNum: null, changeIndex: null });
      i--;
    }
  }

  return result.reverse();
}

function assignChangeIndices(lines: DiffLine[], changes: DiffChange[] | undefined): DiffLine[] {
  if (!changes || changes.length === 0) return lines;
  return lines.map((line) => {
    const idx = changes.findIndex((c) => {
      if (line.type === "deleted" && line.originalLineNum !== null) {
        return line.originalLineNum >= c.originalStartLine && line.originalLineNum <= c.originalEndLine;
      }
      if (line.type === "added" && line.modifiedLineNum !== null) {
        return line.modifiedLineNum >= c.modifiedStartLine && line.modifiedLineNum <= c.modifiedEndLine;
      }
      return false;
    });
    return { ...line, changeIndex: idx >= 0 ? idx : null };
  });
}

export function InlineDiffView(props: InlineDiffViewProps) {
  let containerRef: HTMLDivElement | undefined;
  const [currentIdx, setCurrentIdx] = createSignal(props.currentChangeIndex ?? 0);

  createEffect(() => {
    if (props.currentChangeIndex !== undefined) {
      setCurrentIdx(props.currentChangeIndex);
    }
  });

  const fontSize = () => props.fontSize ?? 13;
  const lh = () => props.lineHeight ?? 20;

  const diffLines = createMemo(() => {
    const origLines = props.originalContent.split("\n");
    const modLines = props.modifiedContent.split("\n");
    const raw = computeLCSDiff(origLines, modLines);
    return assignChangeIndices(raw, props.changes);
  });

  const totalChanges = createMemo(() => {
    if (!props.changes) return 0;
    return props.changes.length;
  });

  const navigateToChange = (index: number) => {
    if (totalChanges() === 0) return;
    const clamped = Math.max(0, Math.min(index, totalChanges() - 1));
    setCurrentIdx(clamped);
    props.onNavigateChange?.(clamped);
    scrollToChange(clamped);
  };

  const scrollToChange = (index: number) => {
    if (!containerRef) return;
    const lines = diffLines();
    const lineIdx = lines.findIndex((l) => l.changeIndex === index);
    if (lineIdx >= 0) {
      containerRef.scrollTop = lineIdx * lh();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "F5" && e.altKey && !e.ctrlKey) {
      e.preventDefault();
      if (e.shiftKey) {
        navigateToChange(currentIdx() - 1);
      } else {
        navigateToChange(currentIdx() + 1);
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  const getLineBg = (line: DiffLine): string | undefined => {
    const isActive = line.changeIndex !== null && line.changeIndex === currentIdx();
    if (line.type === "added") return isActive ? ADDITION_BG_ACTIVE : ADDITION_BG;
    if (line.type === "deleted") return isActive ? DELETION_BG_ACTIVE : DELETION_BG;
    return undefined;
  };

  const getPrefix = (type: DiffLine["type"]): string => {
    if (type === "added") return "+";
    if (type === "deleted") return "-";
    return " ";
  };

  const containerStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--cortex-bg-primary)",
    color: "var(--cortex-text-primary)",
    "font-family": MONO_FONT,
    "font-size": `${fontSize()}px`,
  };

  const headerStyle: JSX.CSSProperties = {
    height: "32px",
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "0 12px",
    "border-bottom": `1px solid var(--cortex-border-default)`,
    "flex-shrink": "0",
    background: "var(--cortex-bg-secondary)",
    "font-size": "12px",
    color: "var(--cortex-text-inactive)",
  };

  const scrollContainerStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
  };

  const gutterStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "0",
    "flex-shrink": "0",
    "user-select": "none",
  };

  const lineNumStyle: JSX.CSSProperties = {
    width: "48px",
    "text-align": "right",
    "padding-right": "8px",
    color: "var(--cortex-text-inactive)",
    "flex-shrink": "0",
  };

  const prefixStyle: JSX.CSSProperties = {
    width: "20px",
    "text-align": "center",
    "flex-shrink": "0",
    "user-select": "none",
  };

  return (
    <div style={containerStyle}>
      <Show when={props.originalPath || props.modifiedPath}>
        <div style={headerStyle}>
          <Show when={props.originalPath}>
            <span>{props.originalPath}</span>
          </Show>
          <Show when={props.originalPath && props.modifiedPath}>
            <span style={{ opacity: "0.5" }}>→</span>
          </Show>
          <Show when={props.modifiedPath}>
            <span>{props.modifiedPath}</span>
          </Show>
          <Show when={totalChanges() > 0}>
            <span style={{ "margin-left": "auto" }}>
              Change {currentIdx() + 1} / {totalChanges()}
            </span>
          </Show>
        </div>
      </Show>

      <div ref={containerRef} style={scrollContainerStyle}>
        <div style={{ "min-width": "fit-content" }}>
          <For each={diffLines()}>
            {(line) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  height: `${lh()}px`,
                  "line-height": `${lh()}px`,
                  background: getLineBg(line),
                  "white-space": "pre",
                }}
              >
                <div style={gutterStyle}>
                  <div style={lineNumStyle}>
                    {line.originalLineNum ?? ""}
                  </div>
                  <div style={lineNumStyle}>
                    {line.modifiedLineNum ?? ""}
                  </div>
                </div>
                <div
                  style={{
                    ...prefixStyle,
                    color: line.type === "added" ? "rgba(78, 201, 176, 0.8)" : line.type === "deleted" ? "rgba(241, 76, 76, 0.8)" : "var(--cortex-text-inactive)",
                  }}
                >
                  {getPrefix(line.type)}
                </div>
                <div style={{ flex: "1", "padding-right": "16px" }}>
                  {line.content}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

export default InlineDiffView;
