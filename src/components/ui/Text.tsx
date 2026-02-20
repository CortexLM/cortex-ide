import { JSX, splitProps, ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface TextProps extends ParentProps {
  variant?: "body" | "muted" | "header";
  size?: "xs" | "sm" | "md" | "lg";
  weight?: "regular" | "medium" | "semibold" | "bold";
  color?: "default" | "muted" | "primary" | "success" | "warning" | "error";
  truncate?: boolean;
  align?: "left" | "center" | "right";
  as?: "span" | "p" | "div" | "label" | "h1" | "h2" | "h3";
  style?: JSX.CSSProperties;
}

export function Text(props: TextProps) {
  const [local, _rest] = splitProps(props, [
    "variant",
    "size",
    "weight",
    "color",
    "truncate",
    "align",
    "as",
    "style",
    "children",
  ]);

  const variant = () => local.variant || "body";

  const variantStyles: Record<string, JSX.CSSProperties> = {
    body: {
      "font-size": "var(--jb-text-body-size)",
      "font-weight": "var(--jb-text-body-weight)",
      color: "var(--jb-text-body-color)",
    },
    muted: {
      "font-size": "var(--jb-text-muted-size)",
      "font-weight": "var(--jb-text-muted-weight)",
      color: "var(--jb-text-muted-color)",
    },
    header: {
      "font-size": "var(--jb-text-header-size)",
      "font-weight": "var(--jb-text-header-weight)",
      "text-transform": "uppercase",
      "letter-spacing": "var(--jb-text-header-spacing)",
      color: "var(--jb-text-header-color)",
    },
  };

  const sizeStyles: Record<string, JSX.CSSProperties> = {
    xs: { "font-size": "10px" },
    sm: { "font-size": "11px" },
    md: { "font-size": "13px" },
    lg: { "font-size": "14px" },
  };

  const weightStyles: Record<string, JSX.CSSProperties> = {
    regular: { "font-weight": "400" },
    medium: { "font-weight": "500" },
    semibold: { "font-weight": "600" },
    bold: { "font-weight": "700" },
  };

  const colorStyles: Record<string, JSX.CSSProperties> = {
    default: {},
    muted: { color: "var(--jb-text-muted-color)" },
    primary: { color: "var(--jb-border-focus)" },
    success: { color: "var(--cortex-success)" },
    warning: { color: "var(--cortex-warning)" },
    error: { color: "var(--cortex-error)" },
  };

  const baseStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    margin: "0",
    ...(local.truncate ? {
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    } : {}),
    ...(local.align ? { "text-align": local.align } : {}),
  };

  const computedStyle = (): JSX.CSSProperties => ({
    ...baseStyle,
    ...variantStyles[variant()],
    ...(local.size ? sizeStyles[local.size] : {}),
    ...(local.weight ? weightStyles[local.weight] : {}),
    ...(local.color ? colorStyles[local.color] : {}),
    ...local.style,
  });

  return (
    <Dynamic component={local.as || "span"} style={computedStyle()}>
      {local.children}
    </Dynamic>
  );
}

export function SectionTitle(props: ParentProps<{ style?: JSX.CSSProperties }>) {
  return (
    <Text variant="header" style={{ "margin-bottom": "8px", ...props.style }}>
      {props.children}
    </Text>
  );
}
