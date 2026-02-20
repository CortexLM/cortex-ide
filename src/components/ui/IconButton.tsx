import { JSX, splitProps } from "solid-js";

export interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outlined";
  active?: boolean;
  tooltip?: string;
  /** Icon element to render. Alternative to passing icon as children. */
  icon?: JSX.Element;
}

export function IconButton(props: IconButtonProps) {
  const [local, rest] = splitProps(props, [
    "size",
    "variant",
    "active",
    "tooltip",
    "icon",
    "children",
    "style",
    "disabled",
  ]);

  const size = () => local.size || "md";
  const variant = () => local.variant || "ghost";

  const sizeMap: Record<string, { size: string; iconSize: string }> = {
    sm: { size: "20px", iconSize: "14px" },
    md: { size: "24px", iconSize: "16px" },
    lg: { size: "28px", iconSize: "18px" },
  };

  const baseStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: sizeMap[size()].size,
    height: sizeMap[size()].size,
    padding: "0",
    background: local.active ? "var(--surface-active)" : "transparent",
    border: variant() === "outlined" ? "1px solid var(--border-default)" : "none",
    "border-radius": "var(--jb-radius-sm)",
    color: local.active ? "var(--text-title)" : "var(--text-primary)",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "background var(--cortex-transition-fast), color var(--cortex-transition-fast)",
    "flex-shrink": "0",
  };

  const computedStyle = (): JSX.CSSProperties => ({
    ...baseStyle,
    ...(typeof local.style === "object" ? local.style : {}),
  });

  const handleMouseEnter = (e: MouseEvent) => {
    if (!local.disabled) {
      const el = e.currentTarget as HTMLElement;
      el.style.background = "var(--surface-hover)";
      el.style.color = "var(--text-title)";
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    if (!local.disabled) {
      const el = e.currentTarget as HTMLElement;
      el.style.background = local.active ? "var(--surface-active)" : "transparent";
      el.style.color = local.active ? "var(--text-title)" : "var(--text-primary)";
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!local.disabled) {
      const el = e.currentTarget as HTMLElement;
      el.style.background = "var(--surface-active)";
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!local.disabled) {
      const el = e.currentTarget as HTMLElement;
      el.style.background = "var(--surface-hover)";
    }
  };

  return (
    <button
      {...rest}
      disabled={local.disabled}
      title={local.tooltip}
      style={computedStyle()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <span style={{ 
        width: sizeMap[size()].iconSize, 
        height: sizeMap[size()].iconSize,
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
      }}>
        {local.icon ?? local.children}
      </span>
    </button>
  );
}
