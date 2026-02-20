/**
 * Card - Cortex UI Design System Card Component
 * Uses Cortex UI tokens for consistent styling across the app
 * 
 * Cortex UI specs:
 * - Background: var(--cortex-bg-primary) (--cortex-bg-primary)
 * - Border: rgba(255,255,255,0.15) (--cortex-border-default)
 * - Border radius: 16px (--cortex-radius-xl) or 12px (--cortex-radius-lg)
 */
import { JSX, splitProps, ParentProps } from "solid-js";

export interface CardProps extends ParentProps {
  variant?: "default" | "elevated" | "outlined" | "flat";
  padding?: "none" | "sm" | "md" | "lg";
  radius?: "sm" | "md" | "lg" | "xl";
  style?: JSX.CSSProperties;
  class?: string;
  onClick?: () => void;
  hoverable?: boolean;
  /** 
   * When false, card keeps its margins inside SidebarSection (opt-out of full-bleed).
   * Default: true (card will use negative margins in sidebar sections)
   */
  inset?: boolean;
}

export function Card(props: CardProps) {
  const [local, rest] = splitProps(props, [
    "variant",
    "padding",
    "radius",
    "style",
    "class",
    "onClick",
    "hoverable",
    "inset",
    "children",
  ]);

  const variant = () => local.variant || "default";
  const padding = () => local.padding || "md";
  const radius = () => local.radius || "lg";
  const inset = () => local.inset !== false;

  const paddingMap: Record<string, string> = {
    none: "0",
    sm: "var(--cortex-space-2)",   // 8px
    md: "var(--cortex-space-3)",   // 12px
    lg: "var(--cortex-space-4)",   // 16px
  };

  const radiusMap: Record<string, string> = {
    sm: "var(--cortex-radius-sm)",   // 4px
    md: "var(--cortex-radius-md)",   // 8px
    lg: "var(--cortex-radius-lg)",   // 12px
    xl: "var(--cortex-radius-xl)",   // 16px
  };

  const baseStyle: JSX.CSSProperties = {
    "border-radius": radiusMap[radius()],
    padding: paddingMap[padding()],
    transition: "background var(--cortex-transition-fast), border-color var(--cortex-transition-fast)",
  };

  const variantStyles: Record<string, JSX.CSSProperties> = {
    default: {
      background: "var(--cortex-bg-primary)",
      border: "1px solid var(--cortex-border-default)",
    },
    elevated: {
      background: "var(--cortex-bg-elevated)",
      border: "1px solid var(--cortex-border-default)",
      "box-shadow": "var(--cortex-elevation-2)",
    },
    outlined: {
      background: "transparent",
      border: "1px solid var(--cortex-border-default)",
    },
    flat: {
      background: "transparent",
      border: "none",
    },
  };

  const computedStyle = (): JSX.CSSProperties => ({
    ...baseStyle,
    ...variantStyles[variant()],
    cursor: local.onClick || local.hoverable ? "pointer" : "default",
    ...local.style,
  });

  const handleMouseEnter = (e: MouseEvent) => {
    if (local.onClick || local.hoverable) {
      (e.currentTarget as HTMLElement).style.background = "var(--cortex-bg-hover)";
      (e.currentTarget as HTMLElement).style.borderColor = "var(--cortex-border-hover)";
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    if (local.onClick || local.hoverable) {
      const bg = variantStyles[variant()].background || "var(--cortex-bg-primary)";
      (e.currentTarget as HTMLElement).style.background = bg as string;
      (e.currentTarget as HTMLElement).style.borderColor = "var(--cortex-border-default)";
    }
  };

  const cardClass = () => {
    const classes = ["card"];
    if (local.class) classes.push(local.class);
    if (!inset()) classes.push("card--inset");
    return classes.join(" ");
  };

  return (
    <div
      {...rest}
      data-card
      data-card-inset={inset() ? "true" : "false"}
      class={cardClass()}
      style={computedStyle()}
      onClick={local.onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {local.children}
    </div>
  );
}


