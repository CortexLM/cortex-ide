/**
 * CortexDropdownItem - Pixel-perfect dropdown menu item for Cortex UI Design System
 * Figma "Dropdown Item": supports default and recent file variants
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexDropdownItemProps {
  label: string;
  shortcut?: string;
  iconRight?: string;
  showShortcut?: boolean;
  showIconRight?: boolean;
  onClick?: (e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
  isRecentFile?: boolean;
}

export const CortexDropdownItem: Component<CortexDropdownItemProps> = (props) => {
  const [local, others] = splitProps(props, [
    "label",
    "shortcut",
    "iconRight",
    "showShortcut",
    "showIconRight",
    "onClick",
    "class",
    "style",
    "isRecentFile",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const baseStyle = (): JSX.CSSProperties => {
    if (local.isRecentFile) {
      return {
        display: "flex",
        "flex-direction": "column",
        "align-self": "stretch",
        padding: "8px",
        gap: "8px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "all var(--cortex-transition-normal, 150ms ease)",
        "text-align": "left",
        width: "100%",
        ...local.style,
      };
    }

    return {
      display: "flex",
      "flex-direction": "row",
      "align-items": "center",
      "justify-content": "space-between",
      "align-self": "stretch",
      padding: "4px 8px",
      gap: "8px",
      background: hovered() ? "#252628" : "transparent",
      "border-radius": hovered() ? "4px" : "0",
      border: "none",
      cursor: "pointer",
      transition: "all var(--cortex-transition-normal, 150ms ease)",
      "text-align": "left",
      width: "100%",
      ...local.style,
    };
  };

  const labelStyle = (): JSX.CSSProperties => ({
    "font-family": "'Figtree', var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": local.isRecentFile ? "16px" : "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: "var(--cortex-text-primary, #FCFCFC)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  const shortcutStyle = (): JSX.CSSProperties => ({
    "font-family": "'Figtree', var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: "#8C8D8F",
    "white-space": "nowrap",
    "flex-shrink": "0",
  });

  const handleMouseEnter = () => {
    if (!local.isRecentFile) setHovered(true);
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
      <span style={labelStyle()}>{local.label}</span>
      <Show when={!local.isRecentFile && local.showShortcut && local.shortcut}>
        <span style={shortcutStyle()}>{local.shortcut}</span>
      </Show>
      <Show when={!local.isRecentFile && local.showIconRight && local.iconRight}>
        <CortexIcon name={local.iconRight!} size={16} />
      </Show>
    </button>
  );
};

export default CortexDropdownItem;
