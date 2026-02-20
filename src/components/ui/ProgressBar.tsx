import { Show, JSX } from "solid-js";

export interface ProgressBarProps {
  value: number;
  max?: number;
  size?: "sm" | "md";
  variant?: "default" | "primary" | "success" | "error";
  showLabel?: boolean;
  style?: JSX.CSSProperties;
  /** Mode for the progress bar: "discrete" shows current value, "infinite" shows indeterminate animation */
  mode?: "discrete" | "infinite";
  /** Whether the progress bar is visible */
  visible?: boolean;
}

export function ProgressBar(props: ProgressBarProps) {
  const max = () => props.max || 100;
  const size = () => props.size || "sm";
  const variant = () => props.variant || "default";
  const mode = () => props.mode || "discrete";
  const isVisible = () => props.visible !== false;
  const percentage = () => Math.min(100, Math.max(0, (props.value / max()) * 100));

  const sizeMap: Record<string, string> = {
    sm: "4px",
    md: "6px",
  };

  const colorMap: Record<string, string> = {
    default: "var(--jb-text-muted-color)",
    primary: "var(--jb-border-focus)",
    success: "var(--cortex-success)",
    error: "var(--cortex-error)",
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: isVisible() ? "flex" : "none",
    "align-items": "center",
    gap: "8px",
    ...props.style,
  });

  const trackStyle: JSX.CSSProperties = {
    flex: "1",
    height: sizeMap[size()],
    background: "var(--jb-canvas)",
    "border-radius": "var(--jb-radius-sm)",
    overflow: "hidden",
    position: "relative",
  };

  const fillStyle = (): JSX.CSSProperties => {
    if (mode() === "infinite") {
      return {
        height: "100%",
        width: "30%",
        background: colorMap[variant()],
        "border-radius": "var(--jb-radius-sm)",
        animation: "progress-infinite 2s ease-in-out infinite",
        position: "absolute",
        left: "0",
      };
    }
    return {
      height: "100%",
      width: `${percentage()}%`,
      background: colorMap[variant()],
      "border-radius": "var(--jb-radius-sm)",
      transition: "width var(--cortex-transition-normal)",
    };
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "min-width": "32px",
    "text-align": "right",
  };

  return (
    <>
      <Show when={isVisible()}>
        <div style={containerStyle()}>
          <div style={trackStyle}>
            <div style={fillStyle()} />
          </div>
          <Show when={props.showLabel && mode() === "discrete"}>
            <span style={labelStyle}>{Math.round(percentage())}%</span>
          </Show>
        </div>
      </Show>
      <style>{`
        @keyframes progress-infinite {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </>
  );
}
