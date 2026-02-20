/**
 * CortexModelSelector - Pixel-perfect model selector for Cortex UI Design System
 * Figma "Model Selector Container": displays selected model with dropdown
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexModelSelectorProps {
  modelName: string;
  modelIcon?: string;
  isOpen?: boolean;
  onClick?: (e: MouseEvent) => void;
  children?: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexModelSelector: Component<CortexModelSelectorProps> = (props) => {
  const [local, others] = splitProps(props, [
    "modelName",
    "modelIcon",
    "isOpen",
    "onClick",
    "children",
    "class",
    "style",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const getBackground = (): string => {
    if (local.isOpen) return "var(--cortex-bg-secondary)";
    if (hovered()) return "var(--cortex-bg-elevated)";
    return "var(--cortex-bg-primary)";
  };

  const getBorder = (): string => {
    if (local.isOpen) return "1px solid transparent";
    return "1px solid var(--cortex-border-hover)";
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    gap: "8px",
    height: "32px",
    padding: "0 8px",
    background: getBackground(),
    border: getBorder(),
    "border-radius": "8px",
    cursor: "pointer",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    position: "relative",
    ...local.style,
  });

  const labelStyle = (): JSX.CSSProperties => ({
    "font-family": "'Figtree', var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: "var(--cortex-text-on-surface)",
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
        <Show when={local.modelIcon}>
          <CortexIcon name={local.modelIcon!} size={16} />
        </Show>
        <span style={labelStyle()}>{local.modelName}</span>
        <CortexIcon
          name={local.isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color="var(--cortex-text-primary)"
        />
      </button>
      <Show when={local.isOpen && local.children}>
        {local.children}
      </Show>
    </div>
  );
};

export default CortexModelSelector;
