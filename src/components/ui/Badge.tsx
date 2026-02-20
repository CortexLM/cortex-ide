/**
 * Badge - Cortex UI Design System Badge Component
 * 
 * Cortex UI specs:
 * - Default accent: var(--cortex-accent-primary) bg, var(--cortex-accent-text) text
 * - Border radius: pill (9999px)
 * - Padding: 2px 6px (sm), 2px 8px (md)
 */
import { JSX, splitProps, ParentProps } from "solid-js";

export interface BadgeProps extends ParentProps {
  variant?: "default" | "accent" | "success" | "warning" | "error" | "muted";
  size?: "sm" | "md";
  style?: JSX.CSSProperties;
}

export function Badge(props: BadgeProps) {
  const [local] = splitProps(props, ["variant", "size", "style", "children"]);

  const variant = () => local.variant || "default";
  const size = () => local.size || "sm";

  const sizeStyles: Record<string, JSX.CSSProperties> = {
    sm: { "font-size": "10px", padding: "1px 6px" },
    md: { "font-size": "11px", padding: "2px 8px" },
  };

  const variantStyles: Record<string, JSX.CSSProperties> = {
    default: {
      background: "var(--cortex-bg-hover)",
      color: "var(--cortex-text-primary)",
    },
    accent: {
      background: "var(--cortex-accent-primary)",
      color: "var(--cortex-accent-text)",
    },
    success: {
      background: "var(--cortex-success-bg)",
      color: "var(--cortex-success)",
    },
    warning: {
      background: "var(--cortex-warning-bg)",
      color: "var(--cortex-warning)",
    },
    error: {
      background: "var(--cortex-error-bg)",
      color: "var(--cortex-error)",
    },
    muted: {
      background: "var(--cortex-bg-primary)",
      color: "var(--cortex-text-inactive)",
    },
  };

  const baseStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    "border-radius": "var(--cortex-radius-full)",
    "font-weight": "500",
    "white-space": "nowrap",
    "flex-shrink": "0",
  };

  const computedStyle = (): JSX.CSSProperties => ({
    ...baseStyle,
    ...sizeStyles[size()],
    ...variantStyles[variant()],
    ...local.style,
  });

  return <span style={computedStyle()}>{local.children}</span>;
}

export interface StatusDotProps {
  status: "idle" | "active" | "success" | "warning" | "error";
  size?: "sm" | "md";
  style?: JSX.CSSProperties;
}

export function StatusDot(props: StatusDotProps) {
  const size = () => props.size || "sm";

  const sizeMap: Record<string, string> = {
    sm: "6px",
    md: "8px",
  };

  const colorMap: Record<string, string> = {
    idle: "var(--cortex-bg-active)",
    active: "var(--cortex-accent-primary)",
    success: "var(--cortex-success)",
    warning: "var(--cortex-warning)",
    error: "var(--cortex-error)",
  };

  const style: JSX.CSSProperties = {
    width: sizeMap[size()],
    height: sizeMap[size()],
    "border-radius": "var(--cortex-radius-full)",
    background: colorMap[props.status],
    "flex-shrink": "0",
    ...props.style,
  };

  return <span style={style} />;
}

