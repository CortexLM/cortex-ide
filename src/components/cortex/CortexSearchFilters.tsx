/**
 * CortexSearchFilters - Collapsible include/exclude filter inputs for search
 * Renders file pattern filters that can be toggled open/closed
 */

import { Component, Show, JSX } from "solid-js";

export interface CortexSearchFiltersProps {
  includePattern: string;
  excludePattern: string;
  onIncludeChange: (value: string) => void;
  onExcludeChange: (value: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

const labelStyle: JSX.CSSProperties = {
  "font-size": "11px",
  color: "var(--cortex-text-inactive)",
  "margin-bottom": "4px",
};

const filterInputStyle: JSX.CSSProperties = {
  width: "100%",
  background: "var(--cortex-bg-primary)",
  border: "1px solid var(--cortex-bg-hover)",
  "border-radius": "var(--cortex-radius-sm)",
  color: "var(--cortex-text-primary)",
  padding: "6px 8px",
  "font-size": "12px",
  outline: "none",
};

export const CortexSearchFilters: Component<CortexSearchFiltersProps> = (props) => {
  return (
    <div>
      <button
        onClick={props.onToggleExpanded}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--cortex-text-inactive)",
          cursor: "pointer",
          padding: "4px 0",
          "font-size": "12px",
          display: "flex",
          "align-items": "center",
          gap: "4px",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{
            transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        >
          <path d="M6 4l4 4-4 4V4z" />
        </svg>
        Filters
      </button>

      <Show when={props.expanded}>
        <div style={{ "margin-top": "8px", display: "flex", "flex-direction": "column", gap: "8px" }}>
          <div>
            <div style={labelStyle}>Files to include</div>
            <input
              type="text"
              value={props.includePattern}
              onInput={(e) => props.onIncludeChange(e.currentTarget.value)}
              placeholder="e.g., *.ts, src/**"
              style={filterInputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Files to exclude</div>
            <input
              type="text"
              value={props.excludePattern}
              onInput={(e) => props.onExcludeChange(e.currentTarget.value)}
              placeholder="e.g., node_modules, *.test.ts"
              style={filterInputStyle}
            />
          </div>
        </div>
      </Show>
    </div>
  );
};

export default CortexSearchFilters;
