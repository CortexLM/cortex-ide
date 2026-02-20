/**
 * CortexStartPause - Pixel-perfect start/pause toggle for Cortex UI Design System
 * Figma "Start / Pause": 16×16px play/pause icon with hover opacity
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";

export type CortexStartPauseState = "start" | "pause";

export interface CortexStartPauseProps {
  state: CortexStartPauseState;
  onClick?: (e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexStartPause: Component<CortexStartPauseProps> = (props) => {
  const [local, others] = splitProps(props, [
    "state",
    "onClick",
    "class",
    "style",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: "16px",
    height: "16px",
    padding: "0",
    margin: "0",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    opacity: hovered() ? "0.5" : "1",
    transition: "opacity var(--cortex-transition-normal, 150ms ease)",
    "flex-shrink": "0",
    ...local.style,
  });

  const handleMouseEnter = () => {
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const handleClick = (e: MouseEvent) => {
    local.onClick?.(e);
  };

  return (
    <button
      type="button"
      class={local.class}
      style={containerStyle()}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...others}
    >
      <Show when={local.state === "start"}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 3L13 8L4 13V3Z"
            fill="var(--cortex-accent-primary)"
            stroke="var(--cortex-accent-primary)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </Show>
      <Show when={local.state === "pause"}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="3" y="1" width="3" height="14" rx="0.5" fill="var(--cortex-pause-color)" />
          <rect x="10" y="1" width="3" height="14" rx="0.5" fill="var(--cortex-pause-color)" />
        </svg>
      </Show>
    </button>
  );
};

export default CortexStartPause;
