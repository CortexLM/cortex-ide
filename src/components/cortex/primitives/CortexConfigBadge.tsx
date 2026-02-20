/**
 * CortexConfigBadge - Pixel-perfect config badge for Cortex UI Design System
 * Figma "Config" component: config icon + label + chevron, with hover/active states
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export type CortexConfigBadgeVariant = "default" | "hover" | "active";

export interface CortexConfigBadgeProps {
  label?: string;
  variant?: CortexConfigBadgeVariant;
  isOpen?: boolean;
  onClick?: (e: MouseEvent) => void;
  children?: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexConfigBadge: Component<CortexConfigBadgeProps> = (props) => {
  const [local, others] = splitProps(props, [
    "label",
    "variant",
    "isOpen",
    "onClick",
    "children",
    "class",
    "style",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const displayLabel = () => local.label ?? "config";
  const effectiveVariant = () => local.variant ?? "default";

  const getBackground = (): string => {
    const v = effectiveVariant();
    if (v === "active") return "var(--cortex-bg-secondary)";
    if (v === "hover" || hovered()) return "var(--cortex-bg-hover)";
    return "transparent";
  };

  const getBorderRadius = (): string => {
    const v = effectiveVariant();
    if (v === "active" || v === "hover" || hovered()) return "4px";
    return "0";
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "flex-direction": "row",
    "align-items": "center",
    gap: "8px",
    padding: "2px 4px",
    background: getBackground(),
    "border-radius": getBorderRadius(),
    border: "none",
    cursor: "pointer",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    position: "relative",
    ...local.style,
  });

  const labelStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans)",
    "font-size": "16px",
    "font-weight": "500",
    "line-height": "1em",
    color: "var(--cortex-text-primary)",
    "white-space": "nowrap",
    "user-select": "none",
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
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        class={local.class}
        style={containerStyle()}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...others}
      >
        <CortexIcon name="gear" size={16} />
        <span style={labelStyle()}>{displayLabel()}</span>
        <CortexIcon
          name={local.isOpen ? "chevron-up" : "chevron-down"}
          size={20}
        />
      </button>
      <Show when={local.isOpen && local.children}>
        {local.children}
      </Show>
    </div>
  );
};

export default CortexConfigBadge;
