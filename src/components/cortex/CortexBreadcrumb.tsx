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
    gap: "2px",
    height: "26px",
    ...local.style,
  });

  const segmentStyle = (isLast: boolean): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: isLast ? "var(--cortex-text-on-surface)" : "var(--cortex-text-secondary)",
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
                (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-on-surface)";
              }}
              onMouseLeave={(e) => {
                if (index() !== local.segments.length - 1) {
                  (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-secondary)";
                }
              }}
            >
              {segment.label}
            </button>
            <Show when={index() < local.segments.length - 1}>
              <CortexIcon
                name="chevron-right"
                size={16}
                color="var(--cortex-text-secondary)"
              />
            </Show>
          </>
        )}
      </For>
    </nav>
  );
};

export default CortexBreadcrumb;
