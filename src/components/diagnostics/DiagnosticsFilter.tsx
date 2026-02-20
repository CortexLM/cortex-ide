import { Component, JSX, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useDiagnostics, type DiagnosticFilter, type GroupMode } from "@/context/DiagnosticsContext";

export interface DiagnosticsFilterProps {
  class?: string;
  style?: JSX.CSSProperties;
}

interface FilterToggleProps {
  active: boolean;
  icon: string;
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}

const FilterToggle: Component<FilterToggleProps> = (props) => {
  const buttonStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    background: props.active ? "var(--cortex-bg-active)" : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    opacity: props.active ? "1" : "0.6",
    transition: "all var(--cortex-transition-fast)",
  });

  return (
    <button
      style={buttonStyle()}
      onClick={props.onClick}
      title={`${props.active ? "Hide" : "Show"} ${props.label}`}
      aria-pressed={props.active}
    >
      <Icon name={props.icon} size={12} style={{ color: props.color }} />
      <span style={{ "font-size": "11px", color: "var(--cortex-text-primary)" }}>
        {props.count}
      </span>
    </button>
  );
};

export const DiagnosticsFilter: Component<DiagnosticsFilterProps> = (props) => {
  const diagnostics = useDiagnostics();
  const counts = createMemo(() => diagnostics.getCounts());
  const filter = createMemo(() => diagnostics.state.filter);
  const groupMode = createMemo(() => diagnostics.state.groupMode);

  const toggleSeverity = (key: keyof Pick<DiagnosticFilter, "showErrors" | "showWarnings" | "showInformation" | "showHints">) => {
    diagnostics.setFilter({ [key]: !filter()[key] });
  };

  const setGroupMode = (mode: GroupMode) => {
    diagnostics.setGroupMode(mode);
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "4px 8px",
    "border-bottom": "1px solid var(--cortex-border-default)",
    "flex-wrap": "wrap",
    ...props.style,
  });

  const groupStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "2px",
  };

  const dividerStyle: JSX.CSSProperties = {
    width: "1px",
    height: "16px",
    background: "var(--cortex-border-default)",
    margin: "0 4px",
  };

  const groupButtonStyle = (active: boolean): JSX.CSSProperties => ({
    padding: "2px 6px",
    background: active ? "var(--cortex-bg-active)" : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    "font-size": "11px",
    color: active ? "var(--cortex-text-primary)" : "var(--cortex-text-muted)",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={groupStyle}>
        <FilterToggle
          active={filter().showErrors}
          icon="circle-xmark"
          label="Errors"
          count={counts().error}
          color="var(--cortex-error)"
          onClick={() => toggleSeverity("showErrors")}
        />
        <FilterToggle
          active={filter().showWarnings}
          icon="triangle-exclamation"
          label="Warnings"
          count={counts().warning}
          color="var(--cortex-warning)"
          onClick={() => toggleSeverity("showWarnings")}
        />
        <FilterToggle
          active={filter().showInformation}
          icon="circle-info"
          label="Info"
          count={counts().information}
          color="var(--cortex-info)"
          onClick={() => toggleSeverity("showInformation")}
        />
        <FilterToggle
          active={filter().showHints}
          icon="lightbulb"
          label="Hints"
          count={counts().hint}
          color="var(--cortex-text-muted)"
          onClick={() => toggleSeverity("showHints")}
        />
      </div>

      <div style={dividerStyle} />

      <div style={groupStyle}>
        <span style={{ "font-size": "11px", color: "var(--cortex-text-muted)", "margin-right": "4px" }}>
          Group:
        </span>
        <button
          style={groupButtonStyle(groupMode() === "file")}
          onClick={() => setGroupMode("file")}
        >
          File
        </button>
        <button
          style={groupButtonStyle(groupMode() === "severity")}
          onClick={() => setGroupMode("severity")}
        >
          Severity
        </button>
        <button
          style={groupButtonStyle(groupMode() === "source")}
          onClick={() => setGroupMode("source")}
        >
          Source
        </button>
      </div>

      <div style={dividerStyle} />

      <button
        style={{
          ...groupButtonStyle(filter().currentFileOnly),
          display: "flex",
          "align-items": "center",
          gap: "4px",
        }}
        onClick={() => diagnostics.setFilter({ currentFileOnly: !filter().currentFileOnly })}
        title="Show only diagnostics for current file"
      >
        <Icon name="file" size={11} />
        Current File
      </button>
    </div>
  );
};

export default DiagnosticsFilter;
