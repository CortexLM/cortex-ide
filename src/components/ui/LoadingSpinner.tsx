import { JSX } from "solid-js";

export interface LoadingSpinnerProps {
  /** Size can be a preset ("sm" | "md" | "lg") or a number in pixels */
  size?: "sm" | "md" | "lg" | number;
  color?: string;
  style?: JSX.CSSProperties;
}

export function LoadingSpinner(props: LoadingSpinnerProps) {
  const sizeMap: Record<string, string> = {
    sm: "12px",
    md: "16px",
    lg: "24px",
  };

  const computedSize = (): string => {
    const s = props.size;
    if (s === undefined) return sizeMap.md;
    if (typeof s === "number") return `${s}px`;
    return sizeMap[s] || sizeMap.md;
  };

  const style: JSX.CSSProperties = {
    width: computedSize(),
    height: computedSize(),
    animation: "ui-spin 1s linear infinite",
    ...props.style,
  };

  return (
    <>
      <svg
        viewBox="0 0 16 16"
        fill="none"
        style={style}
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke={props.color || "currentColor"}
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="28"
          stroke-dashoffset="10"
          opacity="0.8"
        />
      </svg>
      <style>{`
        @keyframes ui-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
