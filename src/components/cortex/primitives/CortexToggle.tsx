/**
 * CortexToggle - Pixel-perfect toggle/switch component for Cortex UI Design System
 *
 * Figma specs:
 * - Track: bg var(--cortex-switch-bg-off/on), border-radius full, border 1px
 * - Thumb: white circle with shadow, smooth transition
 * - Focus: 2px outline offset with accent color
 * - Disabled: opacity 0.5, cursor not-allowed
 */

import { Component, JSX, splitProps } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  leftIcon?: string;
  rightIcon?: string;
  leftLabel?: string;
  rightLabel?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

const SIZE_SPECS = {
  sm: {
    track: { width: 32, height: 16 },
    thumb: { size: 12, offset: 2 },
    travel: 16,
  },
  md: {
    track: { width: 44, height: 24 },
    thumb: { size: 18, offset: 3 },
    travel: 20,
  },
  lg: {
    track: { width: 56, height: 28 },
    thumb: { size: 22, offset: 3 },
    travel: 28,
  },
};

export const CortexToggle: Component<CortexToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "checked", "onChange", "disabled", "size",
    "leftIcon", "rightIcon", "leftLabel", "rightLabel",
    "class", "style",
  ]);

  const size = () => local.size || "md";
  const specs = () => SIZE_SPECS[size()];

  const trackStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "align-items": "center",
    width: `${specs().track.width}px`,
    height: `${specs().track.height}px`,
    background: local.checked
      ? "var(--cortex-switch-bg-on, var(--cortex-accent-primary))"
      : "var(--cortex-switch-bg-off, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-full, 9999px)",
    border: local.checked
      ? "1px solid transparent"
      : "1px solid var(--cortex-switch-border, rgba(255,255,255,0.1))",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    "flex-shrink": "0",
    outline: "none",
    ...local.style,
  });

  const thumbStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    width: `${specs().thumb.size}px`,
    height: `${specs().thumb.size}px`,
    background: "var(--cortex-switch-thumb, var(--cortex-text-primary))",
    "border-radius": "var(--cortex-radius-full)",
    "box-shadow": "0 1px 3px rgba(0, 0, 0, 0.3)",
    transform: local.checked
      ? `translateX(${specs().travel}px)`
      : "translateX(0)",
    left: `${specs().thumb.offset}px`,
    transition: "transform var(--cortex-transition-slow, 300ms) cubic-bezier(0.4, 0, 0.2, 1)",
  });

  const handleClick = () => {
    if (local.disabled) return;
    local.onChange?.(!local.checked);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      local.onChange?.(!local.checked);
    }
  };

  const handleMouseEnter = (e: MouseEvent) => {
    if (local.disabled) return;
    const target = e.currentTarget as HTMLElement;
    if (!local.checked) {
      target.style.background = "var(--cortex-bg-hover, rgba(255,255,255,0.08))";
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.background = local.checked
      ? "var(--cortex-switch-bg-on, var(--cortex-accent-primary))"
      : "var(--cortex-switch-bg-off, var(--cortex-bg-hover))";
  };

  return (
    <button
      type="button"
      class={local.class}
      style={trackStyle()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={local.disabled}
      aria-pressed={local.checked}
      role="switch"
      {...others}
    >
      <div style={thumbStyle()} />
    </button>
  );
};

/**
 * CortexThemeToggle - Specialized theme toggle with sun/moon icons
 * Figma: x:1247, y:12, 100×28px
 * ASYMMETRIC DESIGN:
 * - Sun Container: x:2, y:0, 48×28px (full height)
 * - Moon Container: x:50, y:2, 48×24px (shorter, offset by 2px)
 */
export interface CortexThemeToggleProps {
  isDark?: boolean;
  onChange?: (isDark: boolean) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexThemeToggle: Component<CortexThemeToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "isDark", "onChange", "class", "style",
  ]);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    width: "100px",
    height: "28px",
    background: "var(--cortex-bg-tertiary, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-full, 9999px)",
    position: "relative",
    ...local.style,
  });

  const indicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    width: "48px",
    height: local.isDark ? "24px" : "28px",
    background: "var(--cortex-bg-hover, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-full, 9999px)",
    transition: "all var(--cortex-transition-slow, 300ms) cubic-bezier(0.4, 0, 0.2, 1)",
    transform: local.isDark ? "translateX(50px)" : "translateX(2px)",
    top: local.isDark ? "2px" : "0px",
    left: "0px",
  });

  const sunButtonStyle = (isActive: boolean): JSX.CSSProperties => ({
    position: "absolute",
    left: "2px",
    top: "0px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "48px",
    height: "28px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    "z-index": "1",
    outline: "none",
    color: isActive
      ? "var(--cortex-accent-primary)"
      : "var(--cortex-text-inactive, #747577)",
    transition: "color var(--cortex-transition-normal, 150ms ease)",
  });

  const moonButtonStyle = (isActive: boolean): JSX.CSSProperties => ({
    position: "absolute",
    left: "50px",
    top: "2px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "48px",
    height: "24px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    "z-index": "1",
    outline: "none",
    color: isActive
      ? "var(--cortex-accent-primary)"
      : "var(--cortex-text-inactive, #747577)",
    transition: "color var(--cortex-transition-normal, 150ms ease)",
  });

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      <div style={indicatorStyle()} />

      <button
        type="button"
        style={sunButtonStyle(!local.isDark)}
        onClick={() => local.onChange?.(false)}
        aria-label="Light mode"
      >
        <CortexIcon name="sun" size={16} />
      </button>

      <button
        type="button"
        style={moonButtonStyle(local.isDark ?? false)}
        onClick={() => local.onChange?.(true)}
        aria-label="Dark mode"
      >
        <CortexIcon name="moon" size={16} />
      </button>
    </div>
  );
};

/**
 * CortexModeToggle - Vibe/IDE mode toggle from Figma design
 * Figma node-id: 0:1712
 * Container: bg #1A1B1F, border #3C3D40, border-radius 12px, 92×32px
 * Active segment: bg #266FCF (blue), rounded corners
 */
export interface CortexModeToggleProps {
  mode: "vibe" | "ide";
  onChange?: (mode: "vibe" | "ide") => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexModeToggle: Component<CortexModeToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "mode", "onChange", "class", "style",
  ]);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    position: "relative",
    width: "92px",
    height: "32px",
    background: "#1A1B1F",
    border: "1px solid #3C3D40",
    "border-radius": "12px",
    overflow: "hidden",
    ...local.style,
  });

  const segmentStyle = (isVibe: boolean): JSX.CSSProperties => {
    const isActive = isVibe ? local.mode === "vibe" : local.mode === "ide";
    return {
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      width: "46px",
      height: "32px",
      background: isActive ? "var(--cortex-accent-blue, #266FCF)" : "transparent",
      "border-radius": isActive
        ? (isVibe ? "10px 6px 6px 10px" : "6px 10px 10px 6px")
        : "0",
      cursor: "pointer",
      border: "none",
      padding: "0",
      outline: "none",
      "font-family": "var(--cortex-font-sans, 'Figtree', sans-serif)",
      "font-size": "14px",
      "font-weight": "400",
      "line-height": "18px",
      color: isActive ? "#FFFFFF" : "var(--cortex-text-inactive, #8C8D8F)",
      transition: "all 200ms ease",
      "z-index": "1",
    };
  };

  const handleMouseEnter = (e: MouseEvent, isVibe: boolean) => {
    const isActive = isVibe ? local.mode === "vibe" : local.mode === "ide";
    if (!isActive) {
      (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.05)";
    }
  };

  const handleMouseLeave = (e: MouseEvent, isVibe: boolean) => {
    const isActive = isVibe ? local.mode === "vibe" : local.mode === "ide";
    if (!isActive) {
      (e.currentTarget as HTMLElement).style.background = "transparent";
    }
  };

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      <button
        type="button"
        style={segmentStyle(true)}
        onClick={() => local.onChange?.("vibe")}
        onMouseEnter={(e) => handleMouseEnter(e, true)}
        onMouseLeave={(e) => handleMouseLeave(e, true)}
        aria-label="Vibe mode"
      >
        Vibe
      </button>
      <button
        type="button"
        style={segmentStyle(false)}
        onClick={() => local.onChange?.("ide")}
        onMouseEnter={(e) => handleMouseEnter(e, false)}
        onMouseLeave={(e) => handleMouseLeave(e, false)}
        aria-label="IDE mode"
      >
        IDE
      </button>
    </div>
  );
};

export default CortexToggle;
