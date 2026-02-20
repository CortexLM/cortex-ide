/**
 * CortexIconButton - Pixel-perfect icon button for Cortex UI Design System
 * Figma "Icons Hover" component: 20×20px container, 16×16 icon inside
 */

import { Component, JSX, splitProps, createSignal } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexIconButtonProps {
  icon: string;
  size?: number;
  onClick?: (e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
  title?: string;
  disabled?: boolean;
}

export const CortexIconButton: Component<CortexIconButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "icon",
    "size",
    "onClick",
    "class",
    "style",
    "title",
    "disabled",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const size = () => local.size ?? 20;
  const iconSize = () => Math.round(size() * 0.8);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: `${size()}px`,
    height: `${size()}px`,
    padding: "0",
    margin: "0",
    border: "none",
    background: hovered() && !local.disabled ? "rgba(252, 252, 252, 0.08)" : "transparent",
    "border-radius": hovered() && !local.disabled ? "4px" : "0",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    "flex-shrink": "0",
    ...local.style,
  });

  const handleMouseEnter = () => {
    if (!local.disabled) setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const handleClick = (e: MouseEvent) => {
    if (local.disabled) return;
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
      title={local.title}
      disabled={local.disabled}
      {...others}
    >
      <CortexIcon name={local.icon} size={iconSize()} />
    </button>
  );
};

export default CortexIconButton;
