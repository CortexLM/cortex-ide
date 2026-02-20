import { JSX } from "solid-js";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  style?: JSX.CSSProperties;
}

export function Divider(props: DividerProps) {
  const orientation = () => props.orientation || "horizontal";

  const style: JSX.CSSProperties = orientation() === "horizontal" 
    ? {
        width: "100%",
        height: "1px",
        background: "var(--jb-border-divider)",
        margin: "8px 0",
        "flex-shrink": "0",
        ...props.style,
      }
    : {
        width: "1px",
        height: "100%",
        background: "var(--jb-border-divider)",
        margin: "0 8px",
        "flex-shrink": "0",
        ...props.style,
      };

  return <div style={style} />;
}

export interface SpacerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  style?: JSX.CSSProperties;
}

export function Spacer(props: SpacerProps) {
  const size = () => props.size || "md";

  const sizeMap: Record<string, string> = {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
  };

  const style: JSX.CSSProperties = {
    height: sizeMap[size()],
    width: "100%",
    "flex-shrink": "0",
    ...props.style,
  };

  return <div style={style} />;
}
