/**
 * CortexSearchResultList - Search results tree with replace preview support
 * Renders file headers with collapsible match lines
 */

import { Component, For, Show, JSX } from "solid-js";
import type { SearchResultEntry, SearchMatchResult } from "@/utils/tauri-api";

export interface CortexSearchResultListProps {
  results: SearchResultEntry[];
  expandedFiles: Set<string>;
  replaceText: string;
  showReplace: boolean;
  onToggleFile: (file: string) => void;
  onMatchClick: (file: string, line: number, column: number) => void;
  onReplaceInFile: (file: string) => void;
  onDismissFile: (file: string) => void;
}

const fileHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  padding: "6px 16px",
  cursor: "pointer",
  gap: "8px",
};

const matchRowStyle: JSX.CSSProperties = {
  padding: "4px 16px 4px 48px",
  cursor: "pointer",
  "font-family": "var(--cortex-font-mono)",
  "font-size": "12px",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
};

const replacePreviewRowStyle: JSX.CSSProperties = {
  padding: "2px 16px 4px 48px",
  "font-family": "var(--cortex-font-mono)",
  "font-size": "12px",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
};

const fileActionBtnStyle: JSX.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--cortex-text-inactive)",
  cursor: "pointer",
  padding: "2px 4px",
  "border-radius": "var(--cortex-radius-sm)",
  "font-size": "12px",
  "line-height": "1",
};

const matchCountBadgeStyle: JSX.CSSProperties = {
  color: "var(--cortex-accent-text)",
  background: "var(--cortex-accent-primary)",
  "border-radius": "var(--cortex-radius-sm)",
  padding: "1px 6px",
  "font-size": "11px",
  "font-weight": "500",
  "min-width": "18px",
  "text-align": "center",
};

const dirPathStyle: JSX.CSSProperties = {
  color: "var(--cortex-text-inactive)",
  "font-size": "12px",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
  "margin-left": "4px",
};

const fileActionsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "2px",
  opacity: "0",
  transition: "opacity 0.15s",
};

const getDirname = (filepath: string): string => {
  const parts = filepath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
};

const getFilename = (filepath: string): string => {
  return filepath.split("/").pop() ?? filepath;
};

const renderMatchHighlight = (match: SearchMatchResult): JSX.Element => {
  const before = match.text.slice(0, match.matchStart);
  const matched = match.text.slice(match.matchStart, match.matchEnd);
  const after = match.text.slice(match.matchEnd);

  return (
    <span>
      {before}
      <span style={{
        background: "var(--cortex-accent-primary)",
        color: "var(--cortex-accent-text)",
        "border-radius": "var(--cortex-radius-sm)",
      }}>
        {matched}
      </span>
      {after}
    </span>
  );
};

const renderReplacePreview = (match: SearchMatchResult, replaceText: string): JSX.Element => {
  const before = match.text.slice(0, match.matchStart);
  const matched = match.text.slice(match.matchStart, match.matchEnd);
  const after = match.text.slice(match.matchEnd);

  return (
    <span>
      {before}
      <span style={{
        "text-decoration": "line-through",
        color: "var(--cortex-error)",
        opacity: "0.8",
      }}>
        {matched}
      </span>
      <span style={{
        background: "var(--cortex-success-bg)",
        color: "var(--cortex-success)",
        "border-radius": "var(--cortex-radius-sm)",
      }}>
        {replaceText}
      </span>
      {after}
    </span>
  );
};

export const CortexSearchResultList: Component<CortexSearchResultListProps> = (props) => {
  return (
    <div style={{
      "font-family": "var(--cortex-font-sans)",
      "font-size": "13px",
      color: "var(--cortex-text-primary)",
    }}>
      <For each={props.results}>
        {(result) => (
          <div>
            <div
              onClick={() => props.onToggleFile(result.file)}
              style={fileHeaderStyle}
              class="search-file-row"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="var(--cortex-text-inactive)"
                style={{
                  transform: props.expandedFiles.has(result.file) ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                  "flex-shrink": "0",
                }}
              >
                <path d="M6 4l4 4-4 4V4z"/>
              </svg>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="var(--cortex-text-inactive)"
                style={{ "flex-shrink": "0" }}
              >
                <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
              </svg>
              <span style={{
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                "font-weight": "500",
              }}>
                {getFilename(result.file)}
              </span>
              <span style={dirPathStyle}>
                {getDirname(result.file)}
              </span>
              <span style={{ flex: "1" }} />
              <Show when={props.showReplace}>
                <div class="file-actions" style={fileActionsStyle}>
                  <button
                    style={fileActionBtnStyle}
                    title="Replace in file"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onReplaceInFile(result.file);
                    }}
                  >
                    Replace
                  </button>
                  <button
                    style={{
                      ...fileActionBtnStyle,
                      "font-size": "14px",
                      "font-weight": "bold",
                    }}
                    title="Dismiss file"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onDismissFile(result.file);
                    }}
                  >
                    ×
                  </button>
                </div>
              </Show>
              <span style={matchCountBadgeStyle}>
                {result.matches.length}
              </span>
            </div>
            <Show when={props.expandedFiles.has(result.file)}>
              <For each={result.matches}>
                {(match) => (
                  <div>
                    <div
                      style={matchRowStyle}
                      class="search-match-row"
                      onClick={() => props.onMatchClick(result.file, match.line, match.column)}
                    >
                      <span style={{
                        color: "var(--cortex-text-inactive)",
                        "margin-right": "8px",
                        "user-select": "none",
                      }}>
                        {match.line}
                      </span>
                      {renderMatchHighlight(match)}
                    </div>
                    <Show when={props.showReplace && props.replaceText}>
                      <div style={replacePreviewRowStyle}>
                        <span style={{
                          color: "var(--cortex-text-inactive)",
                          "margin-right": "8px",
                          visibility: "hidden",
                          "user-select": "none",
                        }}>
                          {match.line}
                        </span>
                        {renderReplacePreview(match, props.replaceText)}
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>
        )}
      </For>

      <style>{`
        .search-file-row:hover { background: var(--cortex-interactive-hover, rgba(255,255,255,0.05)); }
        .search-file-row:hover .file-actions { opacity: 1; }
        .search-match-row:hover { background: var(--cortex-interactive-hover, rgba(255,255,255,0.05)); }
      `}</style>
    </div>
  );
};

export default CortexSearchResultList;
