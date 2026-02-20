/**
 * CortexCodeNavHelp - Pixel-perfect code navigation help for Cortex UI Design System
 * Figma "Code Navigation Help": chevron-left icon + label text
 */

import { Component, JSX, splitProps } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexCodeNavHelpProps {
  label?: string;
  onClick?: (e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexCodeNavHelp: Component<CortexCodeNavHelpProps> = (props) => {
  const [local, others] = splitProps(props, [
    "label",
    "onClick",
    "class",
    "style",
  ]);

  const displayLabel = () => local.label ?? "Code Navigation Help";

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "flex-direction": "row",
    "align-items": "center",
    "justify-content": "flex-end",
    gap: "4px",
    height: "26px",
    border: "none",
    background: "transparent",
    padding: "0",
    cursor: local.onClick ? "pointer" : "default",
    ...local.style,
  });

  const labelStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: "var(--cortex-text-on-surface)",
    "white-space": "nowrap",
    "user-select": "none",
  });

  const handleClick = (e: MouseEvent) => {
    local.onClick?.(e);
  };

  return (
    <button
      type="button"
      class={local.class}
      style={containerStyle()}
      onClick={handleClick}
      {...others}
    >
      <CortexIcon name="chevron-left" size={16} color="var(--cortex-text-on-surface)" />
      <span style={labelStyle()}>{displayLabel()}</span>
    </button>
  );
};

export default CortexCodeNavHelp;
