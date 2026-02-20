/**
 * CortexBreadcrumb - Breadcrumb trail for active status bar variant
 * Figma: app > components > survey with chevron-right separators
 * Font: Figtree 500 weight, 14px
 */

import { Component, JSX, splitProps, For, Show } from "solid-js";
import { CortexIcon } from "./primitives";

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

export interface CortexBreadcrumbProps {
  segments: BreadcrumbSegment[];
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexBreadcrumb: Component<CortexBreadcrumbProps> = (props) => {
  const [local, others] = splitProps(props, [
    "segments",
    "class",
    "style",
  ]);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    height: "26px",
    ...local.style,
  });

  const segmentStyle = (isLast: boolean): JSX.CSSProperties => ({
    "font-family": "'Figtree', var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: isLast ? "#FCFCFC" : "var(--cortex-text-secondary, #8C8D8F)",
    "white-space": "nowrap",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    padding: "0",
    "user-select": "none",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  return (
    <nav class={local.class} style={containerStyle()} aria-label="Breadcrumb" {...others}>
      <For each={local.segments}>
        {(segment, index) => (
          <>
            <button
              type="button"
              style={segmentStyle(index() === local.segments.length - 1)}
              onClick={segment.onClick}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#FCFCFC";
              }}
              onMouseLeave={(e) => {
                if (index() !== local.segments.length - 1) {
                  (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-secondary, #8C8D8F)";
                }
              }}
            >
              {segment.label}
            </button>
            <Show when={index() < local.segments.length - 1}>
              <CortexIcon
                name="chevron-right"
                size={12}
                color="var(--cortex-text-secondary, #8C8D8F)"
              />
            </Show>
          </>
        )}
      </For>
    </nav>
  );
};

export default CortexBreadcrumb;
