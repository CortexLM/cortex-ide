/**
 * EditorBreadcrumbs - Breadcrumb path bar below editor tabs
 *
 * Figma specs (layout_4JGJVO):
 * - Row layout, justify flex-end, align center, gap 4px
 * - Height: 26px
 * - Font: Figtree 12px, weight 500, color #8C8D8F
 * - Chevron separators between path segments
 * - Padding: 0px 12px for alignment with editor content
 */

import { Component, JSX, For, Show } from "solid-js";
import { CortexIcon } from "./primitives";
import type { BreadcrumbSegment } from "./CortexBreadcrumb";

export type { BreadcrumbSegment };

export interface EditorBreadcrumbsProps {
  segments: BreadcrumbSegment[];
  class?: string;
  style?: JSX.CSSProperties;
}

export const EditorBreadcrumbs: Component<EditorBreadcrumbsProps> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    height: "26px",
    padding: "0px 16px",
    "flex-shrink": "0",
    background: "#141415",
    ...props.style,
  });

  const segmentStyle = (): JSX.CSSProperties => ({
    "font-family": "'Figtree', sans-serif",
    "font-size": "12px",
    "font-weight": "500",
    "line-height": "1em",
    color: "#8C8D8F",
    "white-space": "nowrap",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    padding: "0",
    "user-select": "none",
    transition: "color 100ms ease",
  });

  return (
    <nav class={props.class} style={containerStyle()} aria-label="Breadcrumb">
      <For each={props.segments}>
        {(segment, index) => (
          <>
            <button
              type="button"
              style={segmentStyle()}
              onClick={segment.onClick}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#FCFCFC";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#8C8D8F";
              }}
            >
              {segment.label}
            </button>
            <Show when={index() < props.segments.length - 1}>
              <CortexIcon name="chevron-right" size={12} color="#8C8D8F" />
            </Show>
          </>
        )}
      </For>
    </nav>
  );
};

export default EditorBreadcrumbs;
