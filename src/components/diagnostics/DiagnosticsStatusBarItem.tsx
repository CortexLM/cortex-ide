import { Component, JSX, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useDiagnostics } from "@/context/DiagnosticsContext";

export interface DiagnosticsStatusBarItemProps {
  onClick?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const DiagnosticsStatusBarItem: Component<DiagnosticsStatusBarItemProps> = (props) => {
  const diagnostics = useDiagnostics();
  const counts = createMemo(() => diagnostics.getCounts());

  const hasErrors = createMemo(() => counts().error > 0);
  const hasWarnings = createMemo(() => counts().warning > 0);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "0 8px",
    height: "100%",
    cursor: "pointer",
    "font-size": "12px",
    color: hasErrors()
      ? "var(--cortex-error)"
      : hasWarnings()
      ? "var(--cortex-warning)"
      : "var(--cortex-text-muted)",
    transition: "color var(--cortex-transition-fast)",
    ...props.style,
  });

  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "3px",
  };

  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
    } else {
      diagnostics.togglePanel();
    }
  };

  return (
    <div
      class={props.class}
      style={containerStyle()}
      onClick={handleClick}
      role="button"
      aria-label={`${counts().error} errors, ${counts().warning} warnings`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div style={itemStyle}>
        <Icon
          name="circle-xmark"
          size={12}
          style={{ color: hasErrors() ? "var(--cortex-error)" : "inherit" }}
        />
        <span>{counts().error}</span>
      </div>
      <div style={itemStyle}>
        <Icon
          name="triangle-exclamation"
          size={12}
          style={{ color: hasWarnings() ? "var(--cortex-warning)" : "inherit" }}
        />
        <span>{counts().warning}</span>
      </div>
    </div>
  );
};

export default DiagnosticsStatusBarItem;
