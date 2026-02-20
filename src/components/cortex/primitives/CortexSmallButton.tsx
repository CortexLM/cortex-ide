/**
 * CortexSmallButton - Pixel-perfect small button for Cortex UI Design System
 * Figma "Small Button": 24px height, 8px padding, 8px gap
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexSmallButtonProps {
  children?: JSX.Element;
  icon?: string;
  onClick?: (e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
  disabled?: boolean;
}

export const CortexSmallButton: Component<CortexSmallButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "children",
    "icon",
    "onClick",
    "class",
    "style",
    "disabled",
  ]);

  const [hovered, setHovered] = createSignal(false);
  const [active, setActive] = createSignal(false);

  const getBackground = (): string => {
    if (active() && !local.disabled) return "var(--cortex-bg-primary, #141415)";
    if (hovered() && !local.disabled) return "var(--cortex-bg-hover, #252628)";
    return "var(--cortex-small-btn-bg, #1A1B1F)";
  };

  const baseStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    height: "24px",
    padding: "0 8px",
    gap: "8px",
    background: getBackground(),
    border: "1px solid var(--cortex-small-btn-border, #3C3D40)",
    "border-radius": "8px",
    color: "var(--cortex-text-primary, #FCFCFC)",
    "font-family": "'Figtree', var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "font-weight": "400",
    "letter-spacing": "-0.015em",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    "white-space": "nowrap",
    "user-select": "none",
    ...local.style,
  });

  const handleMouseEnter = () => {
    if (!local.disabled) setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setActive(false);
  };

  const handleMouseDown = () => {
    if (!local.disabled) setActive(true);
  };

  const handleMouseUp = () => {
    setActive(false);
  };

  const handleClick = (e: MouseEvent) => {
    if (local.disabled) return;
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
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      disabled={local.disabled}
      {...others}
    >
      <Show when={local.icon}>
        <CortexIcon name={local.icon!} size={16} color="var(--cortex-text-primary, #FFFFFF)" />
      </Show>
      <Show when={local.children}>
        <span>{local.children}</span>
      </Show>
    </button>
  );
};

export default CortexSmallButton;