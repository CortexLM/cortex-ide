/**
 * CortexOpenProjectDropdown - Pixel-perfect open project dropdown for Cortex UI Design System
 * Figma "Open Project Dropdown": toggle button with chevron and dropdown content
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexOpenProjectDropdownProps {
  label?: string;
  isOpen?: boolean;
  onClick?: (e: MouseEvent) => void;
  children?: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexOpenProjectDropdown: Component<CortexOpenProjectDropdownProps> = (props) => {
  const [local, others] = splitProps(props, [
    "label",
    "isOpen",
    "onClick",
    "children",
    "class",
    "style",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const displayLabel = () => local.label ?? "Open File";

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    gap: "4px",
    padding: "8px 6px 8px 12px",
    background: local.isOpen ? "var(--cortex-open-project-open-bg)" : "var(--cortex-open-project-bg)",
    border: local.isOpen ? "1px solid transparent" : "1px solid var(--cortex-open-project-border)",
    "border-radius": "12px",
    cursor: "pointer",
    opacity: !local.isOpen && hovered() ? "0.5" : "1",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    position: "relative",
    ...local.style,
  });

  const labelStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans)",
    "font-size": "16px",
    "font-weight": "400",
    "line-height": "1em",
    color: local.isOpen ? "var(--cortex-open-project-open-text, #1C1C1D)" : "var(--cortex-text-secondary)",
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
        <span style={labelStyle()}>{displayLabel()}</span>
        <CortexIcon
          name={local.isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={local.isOpen ? "var(--cortex-open-project-open-text, #1C1C1D)" : "var(--cortex-text-primary)"}
        />
      </button>
      <Show when={local.isOpen && local.children}>
        {local.children}
      </Show>
    </div>
  );
};

export default CortexOpenProjectDropdown;
