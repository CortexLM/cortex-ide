import { Component, For } from "solid-js";

export interface DiffLine {
  lineNumber?: number;
  content: string;
  type: "context" | "addition" | "deletion" | "collapsed";
}

export interface DiffPreviewProps {
  fileName: string;
  lines: DiffLine[];
}

const lineColors: Record<DiffLine["type"], { bg: string; numBg: string }> = {
  context: { bg: "transparent", numBg: "transparent" },
  addition: { bg: "var(--cortex-vibe-diff-addition-bg)", numBg: "var(--cortex-vibe-diff-addition-num-bg)" },
  deletion: { bg: "var(--cortex-vibe-diff-deletion-bg)", numBg: "var(--cortex-vibe-diff-deletion-num-bg)" },
  collapsed: { bg: "transparent", numBg: "transparent" },
};

export const DiffPreview: Component<DiffPreviewProps> = (props) => {
  return (
    <div style={{
      background: "var(--cortex-vibe-badge-bg)",
      "border-radius": "var(--cortex-radius-md)",
      overflow: "hidden",
    }}>
      <For each={props.lines}>
        {(line) => {
          if (line.type === "collapsed") {
            return (
              <div style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "0 12px",
                "font-family": "var(--cortex-font-mono)",
                "font-size": "var(--cortex-text-xs)",
                color: "var(--cortex-text-secondary)",
                height: "18px",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
                <span>{line.content}</span>
              </div>
            );
          }

          const colors = lineColors[line.type];
          return (
            <div style={{
              display: "flex",
              "align-items": "center",
              height: "18px",
              background: colors.bg,
            }}>
              <div style={{
                width: "64px",
                padding: "0 12px",
                "font-family": "var(--cortex-font-mono)",
                "font-size": "var(--cortex-text-xs)",
                color: "var(--cortex-text-secondary)",
                "text-align": "right",
                background: colors.numBg,
                height: "100%",
                display: "flex",
                "align-items": "center",
                "justify-content": "flex-end",
                "flex-shrink": "0",
                "box-sizing": "border-box",
              }}>
                {line.lineNumber ?? ""}
              </div>
              <div style={{
                flex: "1",
                padding: "0 16px",
                "font-family": "var(--cortex-font-mono)",
                "font-size": "var(--cortex-text-xs)",
                color: line.type === "deletion" ? "var(--cortex-vibe-deletion-text)" : line.type === "addition" ? "var(--cortex-vibe-addition-text)" : "var(--cortex-text-on-surface)",
                "white-space": "pre",
                overflow: "hidden",
                "text-overflow": "ellipsis",
              }}>
                {line.content}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};
