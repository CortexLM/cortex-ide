/**
 * CortexVibeToggle - Pixel-perfect Vibe/IDE toggle for Cortex UI Design System
 * Figma node 20:3251: Segmented control with 4 variants: IDE, Vibe, IDEHover, VibeHover
 * Container: 92×32px, border-radius 12px, #1A1B1F bg, #3C3D40 border
 * Active segment: #266FCF blue background
 */

import { Component, JSX, splitProps, createSignal } from "solid-js";

export type CortexVibeToggleMode = "vibe" | "ide";
export type CortexVibeToggleVariant = "IDE" | "Vibe" | "IDEHover" | "VibeHover";

export interface CortexVibeToggleProps {
  mode: CortexVibeToggleMode;
  onChange?: (mode: CortexVibeToggleMode) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexVibeToggle: Component<CortexVibeToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "mode",
    "onChange",
    "class",
    "style",
  ]);

  const [vibeHovered, setVibeHovered] = createSignal(false);
  const [ideHovered, setIdeHovered] = createSignal(false);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    position: "relative",
    width: "92px",
    height: "32px",
    background: "var(--cortex-small-btn-bg)",
    border: "1px solid var(--cortex-small-btn-border)",
    "border-radius": "12px",
    overflow: "hidden",
    "flex-shrink": "0",
    ...local.style,
  });

  const segmentStyle = (isVibe: boolean): JSX.CSSProperties => {
    const isActive = isVibe ? local.mode === "vibe" : local.mode === "ide";
    const isHov = isVibe ? vibeHovered() : ideHovered();
    const activeRadius = isVibe ? "10px 0 0 10px" : "0 10px 10px 0";
    const inactiveRadius = isVibe ? "6px 0 0 6px" : "0 6px 6px 0";
    return {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      width: "46px",
      height: "32px",
      background: isActive
        ? "var(--cortex-accent-blue)"
        : isHov
        ? "rgba(255, 255, 255, 0.05)"
        : "transparent",
      "border-radius": isActive ? activeRadius : inactiveRadius,
      cursor: "pointer",
      border: "none",
      padding: "0",
      "font-family": "var(--cortex-font-sans)",
      "font-size": "14px",
      "font-weight": "400",
      "line-height": "1em",
      color: isActive ? "var(--cortex-text-on-surface)" : "var(--cortex-text-secondary)",
      transition: "all 200ms ease",
      "z-index": "1",
    };
  };

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      <button
        type="button"
        style={segmentStyle(true)}
        onClick={() => local.onChange?.("vibe")}
        onMouseEnter={() => setVibeHovered(true)}
        onMouseLeave={() => setVibeHovered(false)}
        aria-label="Vibe mode"
        aria-pressed={local.mode === "vibe"}
      >
        Vibe
      </button>
      <button
        type="button"
        style={segmentStyle(false)}
        onClick={() => local.onChange?.("ide")}
        onMouseEnter={() => setIdeHovered(true)}
        onMouseLeave={() => setIdeHovered(false)}
        aria-label="IDE mode"
        aria-pressed={local.mode === "ide"}
      >
        IDE
      </button>
    </div>
  );
};

export default CortexVibeToggle;
