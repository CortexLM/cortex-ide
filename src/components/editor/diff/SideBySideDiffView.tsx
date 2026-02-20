/**
 * SideBySideDiffView - Side-by-side diff display
 *
 * Shows original content on the left and modified on the right with
 * synchronized scrolling, change highlighting, and connecting indicators.
 */

import { createSignal, createEffect, createMemo, Show, For, onMount, onCleanup, type JSX } from "solid-js";

const MONO_FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";
const ADDITION_BG = "rgba(78, 201, 176, 0.15)";
const ADDITION_BG_ACTIVE = "rgba(78, 201, 176, 0.3)";
const DELETION_BG = "rgba(241, 76, 76, 0.15)";
const DELETION_BG_ACTIVE = "rgba(241, 76, 76, 0.3)";
const EMPTY_LINE_BG = "rgba(128, 128, 128, 0.05)";

interface DiffChange {
  type: "addition" | "deletion" | "modification";
  originalStartLine: number;
  originalEndLine: number;
  modifiedStartLine: number;
  modifiedEndLine: number;
}

interface SideBySideDiffViewProps {
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

interface PairedLine {
  leftContent: string | null;
  rightContent: string | null;
  leftLineNum: number | null;
  rightLineNum: number | null;
  type: "unchanged" | "deleted" | "added" | "modified";
  changeIndex: number | null;
}

function computePairedLines(originalLines: string[], modifiedLines: string[], changes: DiffChange[] | undefined): PairedLine[] {
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

  const raw: PairedLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      raw.push({ leftContent: originalLines[i - 1], rightContent: modifiedLines[j - 1], leftLineNum: i, rightLineNum: j, type: "unchanged", changeIndex: null });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ leftContent: null, rightContent: modifiedLines[j - 1], leftLineNum: null, rightLineNum: j, type: "added", changeIndex: null });
      j--;
    } else {
      raw.push({ leftContent: originalLines[i - 1], rightContent: null, leftLineNum: i, rightLineNum: null, type: "deleted", changeIndex: null });
      i--;
    }
  }

  const lines = raw.reverse();

  if (!changes || changes.length === 0) return lines;

  return lines.map((line) => {
    const idx = changes.findIndex((c) => {
      if (line.type === "deleted" && line.leftLineNum !== null) {
        return line.leftLineNum >= c.originalStartLine && line.leftLineNum <= c.originalEndLine;
      }
      if (line.type === "added" && line.rightLineNum !== null) {
        return line.rightLineNum >= c.modifiedStartLine && line.rightLineNum <= c.modifiedEndLine;
      }
      if (line.type === "unchanged") {
        if (line.leftLineNum !== null) {
          return changes.some((ch) => ch.type === "modification" && line.leftLineNum! >= ch.originalStartLine && line.leftLineNum! <= ch.originalEndLine);
        }
      }
      return false;
    });
    return { ...line, changeIndex: idx >= 0 ? idx : null };
  });
}

export function SideBySideDiffView(props: SideBySideDiffViewProps) {
  let leftPanelRef: HTMLDivElement | undefined;
  let rightPanelRef: HTMLDivElement | undefined;
  let isSyncing = false;

  const [currentIdx, setCurrentIdx] = createSignal(props.currentChangeIndex ?? 0);

  createEffect(() => {
    if (props.currentChangeIndex !== undefined) {
      setCurrentIdx(props.currentChangeIndex);
    }
  });

  const fontSize = () => props.fontSize ?? 13;
  const lh = () => props.lineHeight ?? 20;

  const pairedLines = createMemo(() => {
    const origLines = props.originalContent.split("\n");
    const modLines = props.modifiedContent.split("\n");
    return computePairedLines(origLines, modLines, props.changes);
  });

  const totalChanges = createMemo(() => props.changes?.length ?? 0);

  const navigateToChange = (index: number) => {
    if (totalChanges() === 0) return;
    const clamped = Math.max(0, Math.min(index, totalChanges() - 1));
    setCurrentIdx(clamped);
    props.onNavigateChange?.(clamped);
    scrollToChange(clamped);
  };

  const scrollToChange = (index: number) => {
    const lineIdx = pairedLines().findIndex((l) => l.changeIndex === index);
    if (lineIdx >= 0) {
      const top = lineIdx * lh();
      leftPanelRef?.scrollTo({ top, behavior: "smooth" });
      rightPanelRef?.scrollTo({ top, behavior: "smooth" });
    }
  };

  const syncScroll = (source: "left" | "right") => {
    if (isSyncing) return;
    isSyncing = true;
    const src = source === "left" ? leftPanelRef : rightPanelRef;
    const dst = source === "left" ? rightPanelRef : leftPanelRef;
    if (src && dst) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing = false; });
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

  const getLeftBg = (line: PairedLine): string | undefined => {
    if (line.type !== "deleted" && line.type !== "modified") {
      return line.leftContent === null ? EMPTY_LINE_BG : undefined;
    }
    const isActive = line.changeIndex !== null && line.changeIndex === currentIdx();
    return isActive ? DELETION_BG_ACTIVE : DELETION_BG;
  };

  const getRightBg = (line: PairedLine): string | undefined => {
    if (line.type !== "added" && line.type !== "modified") {
      return line.rightContent === null ? EMPTY_LINE_BG : undefined;
    }
    const isActive = line.changeIndex !== null && line.changeIndex === currentIdx();
    return isActive ? ADDITION_BG_ACTIVE : ADDITION_BG;
  };

  const getIndicatorColor = (line: PairedLine): string | undefined => {
    if (line.type === "deleted") return "rgba(241, 76, 76, 0.6)";
    if (line.type === "added") return "rgba(78, 201, 176, 0.6)";
    if (line.type === "modified") return "rgba(229, 192, 123, 0.6)";
    return undefined;
  };

  const containerStyle: JSX.CSSProperties = { flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)", "font-family": MONO_FONT, "font-size": `${fontSize()}px` };
  const headerStyle: JSX.CSSProperties = { display: "flex", "align-items": "center", height: "32px", "border-bottom": "1px solid var(--cortex-border-default)", "flex-shrink": "0", background: "var(--cortex-bg-secondary)", "font-size": "12px", color: "var(--cortex-text-inactive)" };
  const headerHalfStyle: JSX.CSSProperties = { flex: "1", padding: "0 12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" };
  const bodyStyle: JSX.CSSProperties = { flex: "1", display: "flex", overflow: "hidden" };
  const panelStyle: JSX.CSSProperties = { flex: "1", overflow: "auto" };
  const indicatorColumnStyle: JSX.CSSProperties = { width: "8px", "flex-shrink": "0", background: "var(--cortex-bg-secondary)" };
  const lineNumStyle: JSX.CSSProperties = { width: "48px", "text-align": "right", "padding-right": "8px", color: "var(--cortex-text-inactive)", "flex-shrink": "0", "user-select": "none" };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerHalfStyle}>{props.originalPath ?? "Original"}</div>
        <Show when={totalChanges() > 0}>
          <span style={{ "flex-shrink": "0", padding: "0 8px" }}>
            Change {currentIdx() + 1} / {totalChanges()}
          </span>
        </Show>
        <div style={{ ...headerHalfStyle, "text-align": "right" }}>{props.modifiedPath ?? "Modified"}</div>
      </div>

      <div style={bodyStyle}>
        <div ref={leftPanelRef} style={panelStyle} onScroll={() => syncScroll("left")}>
          <div style={{ "min-width": "fit-content" }}>
            <For each={pairedLines()}>
              {(line) => (
                <div style={{ display: "flex", height: `${lh()}px`, "line-height": `${lh()}px`, background: getLeftBg(line), "white-space": "pre" }}>
                  <div style={lineNumStyle}>{line.leftLineNum ?? ""}</div>
                  <div style={{ flex: "1", "padding-right": "12px" }}>{line.leftContent ?? ""}</div>
                </div>
              )}
            </For>
          </div>
        </div>

        <div style={indicatorColumnStyle}>
          <For each={pairedLines()}>
            {(line) => {
              const color = getIndicatorColor(line);
              return (
                <div style={{ height: `${lh()}px`, background: color ?? "transparent" }} />
              );
            }}
          </For>
        </div>

        <div ref={rightPanelRef} style={panelStyle} onScroll={() => syncScroll("right")}>
          <div style={{ "min-width": "fit-content" }}>
            <For each={pairedLines()}>
              {(line) => (
                <div style={{ display: "flex", height: `${lh()}px`, "line-height": `${lh()}px`, background: getRightBg(line), "white-space": "pre" }}>
                  <div style={lineNumStyle}>{line.rightLineNum ?? ""}</div>
                  <div style={{ flex: "1", "padding-right": "12px" }}>{line.rightContent ?? ""}</div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SideBySideDiffView;
