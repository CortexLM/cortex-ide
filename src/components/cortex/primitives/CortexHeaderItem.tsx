/**
 * CortexHeaderItem - Pixel-perfect header menu item for Cortex UI Design System
 * Figma "Header item" (20:2695): menu bar items with Default, Hover, Dropdown open states
 *
 * Figma specs:
 *   Layout: row, justify center, align center, gap 10px, padding 8px 10px
 *   Font: Figtree 16px weight 500, line-height 1em
 *   Default: text #8C8D8F, bg transparent, no border-radius
 *   Hover/Active: text #FCFCFC, bg #1C1C1D, border-radius 8px
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
    background: isHighlighted() ? "#1C1C1D" : "transparent",
    "border-radius": isHighlighted() ? "8px" : "0",
    color: isHighlighted() ? "#FCFCFC" : "#8C8D8F",
    "font-family": "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "font-size": "16px",
    "font-weight": "500",
    "line-height": "1em",
    cursor: "pointer",
    transition: "all 150ms ease",
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