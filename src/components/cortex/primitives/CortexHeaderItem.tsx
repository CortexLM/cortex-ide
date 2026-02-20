/**
 * CortexHeaderItem - Pixel-perfect header menu item for Cortex UI Design System
 * Figma "Header item": menu bar items with hover/active states
 */

import { Component, JSX, splitProps, createSignal } from "solid-js";

export interface CortexHeaderItemProps {
  label: string;
  isActive?: boolean;
  onClick?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexHeaderItem: Component<CortexHeaderItemProps> = (props) => {
  const [local, others] = splitProps(props, [
    "label",
    "isActive",
    "onClick",
    "onMouseEnter",
    "class",
    "style",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const isHighlighted = () => hovered() || local.isActive;

  const baseStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    padding: "8px 10px",
    gap: "10px",
    border: "none",
    background: isHighlighted() ? "var(--cortex-bg-secondary)" : "transparent",
    "border-radius": isHighlighted() ? "var(--cortex-radius-md)" : "0",
    color: isHighlighted() ? "var(--cortex-text-primary)" : "var(--cortex-text-secondary)",
    "font-family": "var(--cortex-font-sans)",
    "font-size": "16px",
    "font-weight": "500",
    "line-height": "1em",
    cursor: "pointer",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    "white-space": "nowrap",
    "user-select": "none",
    ...local.style,
  });

  const handleMouseEnter = (e: MouseEvent) => {
    setHovered(true);
    local.onMouseEnter?.(e);
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
      style={baseStyle()}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...others}
    >
      {local.label}
    </button>
  );
};

export default CortexHeaderItem;
