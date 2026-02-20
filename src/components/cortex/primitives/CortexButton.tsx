/**
 * CortexButton - Pixel-perfect button component for Cortex UI Design System
 *
 * Figma specs:
 * - Primary: bg var(--cortex-accent-primary) #B2FF22, text #000000, hover #6C8A2C
 * - Secondary: bg transparent, border var(--cortex-border-default), text white
 * - Ghost: bg transparent, no border, text white, hover bg rgba(255,255,255,0.05)
 * - Danger: bg var(--cortex-error), text white
 * - Accent: bg #266FCF (blue), text white
 *
 * Small Button (Figma layout_NPH8DG):
 *   height 24px, padding 8px, border-radius 8px, bg #1A1B1F, border #3C3D40
 *   Font: Geist 14px weight 400, letterSpacing -1.5%
 */

import { Component, JSX, splitProps, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export type CortexButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type CortexButtonSize = "xs" | "sm" | "md" | "lg";

export interface CortexButtonProps {
  variant?: CortexButtonVariant;
  size?: CortexButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  onClick?: (e: MouseEvent) => void;
  children?: JSX.Element;
  type?: "button" | "submit" | "reset";
  title?: string;
}

const SIZE_STYLES: Record<CortexButtonSize, JSX.CSSProperties> = {
  xs: {
    height: "24px",
    padding: "0 8px",
    "font-size": "14px",
    "letter-spacing": "-0.015em",
    gap: "4px",
  },
  sm: {
    height: "32px",
    padding: "0 12px",
    "font-size": "14px",
    gap: "6px",
  },
  md: {
    height: "40px",
    padding: "0 16px",
    "font-size": "14px",
    gap: "8px",
  },
  lg: {
    height: "48px",
    padding: "0 24px",
    "font-size": "16px",
    gap: "10px",
  },
};

const ICON_SIZES: Record<CortexButtonSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
};

export const CortexButton: Component<CortexButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "variant", "size", "disabled", "loading", "icon", "iconPosition",
    "fullWidth", "class", "style", "onClick", "children", "type", "title",
  ]);

  const variant = () => local.variant || "primary";
  const size = () => local.size || "md";
  const iconPos = () => local.iconPosition || "left";

  const baseStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    border: "1px solid transparent",
    "border-radius": "var(--cortex-radius-md, 8px)",
    "font-family": "var(--cortex-font-sans, 'Figtree', sans-serif)",
    "font-weight": "500",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    "white-space": "nowrap",
    "user-select": "none",
    width: local.fullWidth ? "100%" : "auto",
    outline: "none",
    ...SIZE_STYLES[size()],
    ...local.style,
  });

  const variantStyle = (): JSX.CSSProperties => {
    switch (variant()) {
      case "primary":
        return {
          background: "var(--cortex-btn-primary-bg, var(--cortex-accent-primary))",
          color: "var(--cortex-btn-primary-text, var(--cortex-accent-text, #000000))",
          border: "1px solid var(--cortex-btn-primary-border, transparent)",
        };
      case "secondary":
        return {
          background: "var(--cortex-small-btn-bg, #1A1B1F)",
          color: "var(--cortex-btn-secondary-text, var(--cortex-text-primary))",
          border: "1px solid var(--cortex-small-btn-border, #3C3D40)",
        };
      case "ghost":
        return {
          background: "var(--cortex-btn-ghost-bg, transparent)",
          color: "var(--cortex-btn-ghost-text, var(--cortex-text-primary))",
          border: "1px solid transparent",
        };
      case "danger":
        return {
          background: "var(--cortex-btn-danger-bg, var(--cortex-error))",
          color: "var(--cortex-btn-danger-text, var(--cortex-text-primary))",
          border: "1px solid var(--cortex-btn-danger-border, transparent)",
        };
      case "accent":
        return {
          background: "var(--cortex-accent-blue, #266FCF)",
          color: "#FFFFFF",
          border: "1px solid transparent",
        };
      default:
        return {};
    }
  };

  const handleMouseEnter = (e: MouseEvent) => {
    if (local.disabled) return;
    const target = e.currentTarget as HTMLElement;
    switch (variant()) {
      case "primary":
        target.style.background = "var(--cortex-btn-primary-bg-hover, var(--cortex-accent-hover, #6C8A2C))";
        break;
      case "secondary":
        target.style.background = "var(--cortex-btn-secondary-bg-hover, rgba(255,255,255,0.08))";
        break;
      case "ghost":
        target.style.background = "var(--cortex-btn-ghost-bg-hover, rgba(255,255,255,0.05))";
        break;
      case "danger":
        target.style.background = "var(--cortex-btn-danger-bg-hover, var(--cortex-error-hover))";
        break;
      case "accent":
        target.style.background = "var(--cortex-accent-hover, #1E5CAD)";
        break;
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    switch (variant()) {
      case "primary":
        target.style.background = "var(--cortex-btn-primary-bg, var(--cortex-accent-primary))";
        break;
      case "secondary":
        target.style.background = "var(--cortex-small-btn-bg, #1A1B1F)";
        break;
      case "ghost":
        target.style.background = "var(--cortex-btn-ghost-bg, transparent)";
        break;
      case "danger":
        target.style.background = "var(--cortex-btn-danger-bg, var(--cortex-error))";
        break;
      case "accent":
        target.style.background = "var(--cortex-accent-blue, #266FCF)";
        break;
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (local.disabled || local.loading) return;
    local.onClick?.(e);
  };

  return (
    <button
      type={local.type || "button"}
      class={local.class}
      style={{ ...baseStyle(), ...variantStyle() }}
      disabled={local.disabled || local.loading}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={local.title}
      {...others}
    >
      <Show when={local.loading}>
        <span
          style={{
            width: `${ICON_SIZES[size()]}px`,
            height: `${ICON_SIZES[size()]}px`,
            border: "2px solid currentColor",
            "border-top-color": "transparent",
            "border-radius": "var(--cortex-radius-full)",
            animation: "figma-spin 0.8s linear infinite",
          }}
        />
      </Show>

      <Show when={!local.loading && local.icon && iconPos() === "left"}>
        <CortexIcon name={local.icon!} size={ICON_SIZES[size()]} />
      </Show>

      <Show when={local.children}>
        <span>{local.children}</span>
      </Show>

      <Show when={!local.loading && local.icon && iconPos() === "right"}>
        <CortexIcon name={local.icon!} size={ICON_SIZES[size()]} />
      </Show>
    </button>
  );
};

export default CortexButton;
