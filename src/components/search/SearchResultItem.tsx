import { Component, Show, For, createSignal, JSX } from "solid-js";

export interface SearchResultItemProps {
  file: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  beforeContext?: Array<{ lineNumber: number; text: string }>;
  afterContext?: Array<{ lineNumber: number; text: string }>;
  replaceText?: string;
  showReplace?: boolean;
  onMatchClick?: (file: string, line: number, column: number) => void;
  onReplace?: (file: string, line: number) => void;
  onDismiss?: (file: string, line: number) => void;
}

const containerStyle: JSX.CSSProperties = {
  "font-family": "'SF Pro Text', -apple-system, sans-serif",
  "font-size": "13px",
};

const contextLineStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "baseline",
  padding: "1px 8px 1px 12px",
  "font-family": "monospace",
  "font-size": "12px",
  color: "var(--cortex-text-muted)",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
};

const lineNumberStyle: JSX.CSSProperties = {
  "min-width": "36px",
  "text-align": "right",
  "margin-right": "8px",
  color: "var(--cortex-text-muted)",
  "font-size": "11px",
  "font-family": "monospace",
  "flex-shrink": "0",
  "user-select": "none",
};

const matchLineStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  padding: "2px 8px 2px 12px",
  cursor: "pointer",
  "font-family": "monospace",
  "font-size": "12px",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  position: "relative",
};

const matchHighlightStyle: JSX.CSSProperties = {
  background: "var(--cortex-accent-primary)",
  color: "var(--cortex-accent-text)",
  "border-radius": "var(--cortex-radius-sm)",
  padding: "0 1px",
};

const actionButtonStyle: JSX.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "2px 4px",
  "border-radius": "var(--cortex-radius-sm)",
  "font-size": "11px",
  "line-height": "1",
};

export const SearchResultItem: Component<SearchResultItemProps> = (props) => {
  const [hovered, setHovered] = createSignal(false);

  const handleClick = () => {
    props.onMatchClick?.(props.file, props.line, props.column);
    window.dispatchEvent(
      new CustomEvent("editor:goto", {
        detail: { file: props.file, line: props.line, column: props.column },
      })
    );
  };

  const handleReplace = (e: MouseEvent) => {
    e.stopPropagation();
    props.onReplace?.(props.file, props.line);
  };

  const handleDismiss = (e: MouseEvent) => {
    e.stopPropagation();
    props.onDismiss?.(props.file, props.line);
  };

  const beforeText = () => props.text.slice(0, props.matchStart);
  const matchedText = () => props.text.slice(props.matchStart, props.matchEnd);
  const afterText = () => props.text.slice(props.matchEnd);

  return (
    <div style={containerStyle}>
      <Show when={props.beforeContext && props.beforeContext.length > 0}>
        <For each={props.beforeContext}>
          {(ctx) => (
            <div style={contextLineStyle}>
              <span style={lineNumberStyle}>{ctx.lineNumber}</span>
              <span>{ctx.text}</span>
            </div>
          )}
        </For>
      </Show>

      <div
        style={{
          ...matchLineStyle,
          background: hovered()
            ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
            : "transparent",
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={lineNumberStyle}>{props.line}</span>
        <span
          style={{
            flex: "1",
            "min-width": "0",
            overflow: "hidden",
            "text-overflow": "ellipsis",
          }}
        >
          <span style={{ color: "var(--cortex-text-secondary)" }}>
            {beforeText()}
          </span>
          <span style={matchHighlightStyle}>{matchedText()}</span>
          <span style={{ color: "var(--cortex-text-secondary)" }}>
            {afterText()}
          </span>
        </span>

        <Show when={props.showReplace && hovered()}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "2px",
              "flex-shrink": "0",
              "margin-left": "4px",
            }}
          >
            <button
              style={{
                ...actionButtonStyle,
                color: "var(--cortex-text-muted)",
              }}
              class="hover:text-[var(--cortex-text-primary)]"
              title="Replace this match"
              onClick={handleReplace}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M3 3h4v1H4v3h3v1H3V3zm6 0h4v5h-1V4h-3V3z" />
              </svg>
            </button>
            <button
              style={{
                ...actionButtonStyle,
                color: "var(--cortex-text-muted)",
              }}
              class="hover:text-[var(--cortex-text-primary)]"
              title="Dismiss this match"
              onClick={handleDismiss}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
              </svg>
            </button>
          </div>
        </Show>
      </div>

      <Show when={props.afterContext && props.afterContext.length > 0}>
        <For each={props.afterContext}>
          {(ctx) => (
            <div style={contextLineStyle}>
              <span style={lineNumberStyle}>{ctx.lineNumber}</span>
              <span>{ctx.text}</span>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export default SearchResultItem;
