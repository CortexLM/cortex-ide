/**
 * CortexSendButton - Pixel-perfect send button for Cortex UI Design System
 * Figma "Send Button Container": 32×32px, 16px radius, lime accent
 */

import { Component, JSX, splitProps, createSignal } from "solid-js";

export interface CortexSendButtonProps {
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexSendButton: Component<CortexSendButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "onClick",
    "disabled",
    "class",
    "style",
  ]);

  const [hovered, setHovered] = createSignal(false);

  const getBackground = (): string => {
    if (local.disabled) return "var(--cortex-accent-disabled)";
    if (hovered()) return "var(--cortex-accent-hover)";
    return "var(--cortex-accent-primary)";
  };

  const getIconFill = (): string => {
    return local.disabled ? "var(--cortex-accent-dark-bg)" : "var(--cortex-text-primary)";
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: "32px",
    height: "32px",
    padding: "0",
    margin: "0",
    border: "none",
    background: getBackground(),
    "border-radius": "16px",
    cursor: local.disabled ? "not-allowed" : "pointer",
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
      disabled={local.disabled}
      {...others}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ "flex-shrink": "0" }}
      >
        <path
          d="M14.5 1.5L7.5 8.5M14.5 1.5L10 14.5L7.5 8.5M14.5 1.5L1.5 6L7.5 8.5"
          stroke={getIconFill()}
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
};

export default CortexSendButton;
