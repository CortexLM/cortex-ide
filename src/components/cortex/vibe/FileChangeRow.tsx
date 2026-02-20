import { Component, Show, JSX } from "solid-js";
import { CortexIcon } from "../primitives/CortexIcon";

export interface FileChangeRowProps {
  path: string;
  additions: number;
  deletions: number;
  status: "modified" | "added" | "deleted" | "renamed";
  isExpanded?: boolean;
  onClick: () => void;
}

const ICON_MAP: Record<string, string> = {
  ts: "file-code", tsx: "file-code", js: "file-code", jsx: "file-code",
  rs: "file-code", py: "file-code", go: "file-code", rb: "file-code",
  json: "file-code", toml: "file-code", yaml: "file-code", yml: "file-code",
  md: "file-text", txt: "file-text", css: "file-code", html: "file-code",
  lock: "lock-01", svg: "file", png: "file", jpg: "file",
};

const getIconName = (p: string) => ICON_MAP[p.split(".").pop()?.toLowerCase() || ""] || "file";
const getFileName = (p: string) => p.split("/").pop() || p;

export const FileChangeRow: Component<FileChangeRowProps> = (props) => {
  const rowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    padding: "0 24px",
    gap: "8px",
    cursor: "pointer",
  };

  return (
    <div
      style={rowStyle}
      onClick={props.onClick}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--cortex-vibe-hover-bg)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <CortexIcon name={getIconName(props.path)} size={16} color="var(--cortex-text-secondary)" />
      <span style={{
        flex: "1",
        "font-family": "var(--cortex-font-sans)",
        "font-size": "var(--cortex-text-sm)",
        "font-weight": "var(--cortex-font-medium)",
        color: "var(--cortex-text-on-surface)",
        "max-width": "128px",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {getFileName(props.path)}
      </span>
      <div style={{
        display: "flex",
        gap: "4px",
        "font-family": "var(--cortex-font-mono)",
        "font-size": "var(--cortex-text-xs)",
        "line-height": "1.17",
        "text-align": "right",
      }}>
        <Show when={props.deletions > 0}>
          <span style={{ color: "var(--cortex-vibe-status-error)", width: "30px", "text-align": "right" }}>-{props.deletions}</span>
        </Show>
        <Show when={props.additions > 0}>
          <span style={{ color: "var(--cortex-vibe-status-completed)", width: "30px", "text-align": "right" }}>+{props.additions}</span>
        </Show>
      </div>
    </div>
  );
};
