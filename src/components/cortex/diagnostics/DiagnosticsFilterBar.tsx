import { Component, JSX, createMemo, For } from "solid-js";
import { CortexIcon, CortexInput, CortexDropdown, CortexTooltip } from "../primitives";
import type { CortexDropdownOption } from "../primitives";
import {
  useDiagnostics,
  type DiagnosticFilter,
  type DiagnosticSource,
  type GroupMode,
} from "@/context/DiagnosticsContext";
import type { DiagnosticSeverity } from "@/context/LSPContext";

export interface DiagnosticsFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

interface SeverityToggle {
  key: keyof Pick<DiagnosticFilter, "showErrors" | "showWarnings" | "showInformation" | "showHints">;
  severity: DiagnosticSeverity;
  icon: string;
  label: string;
  color: string;
}

const SEVERITY_TOGGLES: SeverityToggle[] = [
  { key: "showErrors", severity: "error", icon: "circle-xmark", label: "Errors", color: "var(--cortex-error)" },
  { key: "showWarnings", severity: "warning", icon: "triangle-exclamation", label: "Warnings", color: "var(--cortex-warning)" },
  { key: "showInformation", severity: "information", icon: "circle-info", label: "Info", color: "var(--cortex-info, #3794ff)" },
  { key: "showHints", severity: "hint", icon: "lightbulb", label: "Hints", color: "var(--cortex-text-muted)" },
];

const SOURCE_OPTIONS: CortexDropdownOption[] = [
  { value: "all", label: "All Sources" },
  { value: "lsp", label: "LSP" },
  { value: "typescript", label: "TypeScript" },
  { value: "eslint", label: "ESLint" },
  { value: "build", label: "Build" },
  { value: "task", label: "Task" },
  { value: "custom", label: "Custom" },
];

const ALL_SOURCES: DiagnosticSource[] = ["lsp", "typescript", "eslint", "build", "task", "custom"];

const SORT_OPTIONS: CortexDropdownOption[] = [
  { value: "severity", label: "Severity" },
  { value: "file", label: "File" },
  { value: "position", label: "Position" },
];

const GROUP_OPTIONS: CortexDropdownOption[] = [
  { value: "file", label: "File" },
  { value: "severity", label: "Severity" },
  { value: "source", label: "Source" },
];

const containerStyle = (custom?: JSX.CSSProperties): JSX.CSSProperties => ({
  display: "flex",
  "align-items": "center",
  gap: "6px",
  padding: "6px 12px",
  "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  "flex-wrap": "wrap",
  "flex-shrink": "0",
  ...custom,
});

const severityGroupStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "2px",
};

const dividerStyle: JSX.CSSProperties = {
  width: "1px",
  height: "16px",
  background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
  "flex-shrink": "0",
};

const toggleBtnStyle = (active: boolean): JSX.CSSProperties => ({
  display: "inline-flex",
  "align-items": "center",
  gap: "4px",
  padding: "2px 6px",
  background: active ? "var(--cortex-bg-active, rgba(255,255,255,0.08))" : "transparent",
  border: "none",
  "border-radius": "var(--cortex-radius-sm, 4px)",
  cursor: "pointer",
  opacity: active ? "1" : "0.5",
  transition: "all var(--cortex-transition-fast, 100ms ease)",
});

const dropdownCompactStyle: JSX.CSSProperties = {
  height: "24px",
  "min-width": "90px",
  "font-size": "11px",
};

export const DiagnosticsFilterBar: Component<DiagnosticsFilterBarProps> = (props) => {
  const diagnostics = useDiagnostics();
  const counts = createMemo(() => diagnostics.getCounts());
  const filter = createMemo(() => diagnostics.state.filter);
  const groupMode = createMemo(() => diagnostics.state.groupMode);

  const activeSourceValue = createMemo(() => {
    const sources = filter().sources;
    if (sources.length === ALL_SOURCES.length) return "all";
    if (sources.length === 1) return sources[0];
    return "all";
  });

  const toggleSeverity = (key: SeverityToggle["key"]) => {
    diagnostics.setFilter({ [key]: !filter()[key] });
  };

  const handleSourceChange = (value: string) => {
    if (value === "all") {
      diagnostics.setFilter({ sources: [...ALL_SOURCES] });
    } else {
      diagnostics.setFilter({ sources: [value as DiagnosticSource] });
    }
  };

  const handleGroupChange = (value: string) => {
    diagnostics.setGroupMode(value as GroupMode);
  };

  return (
    <div class={props.class} style={containerStyle(props.style)}>
      <div style={severityGroupStyle}>
        <For each={SEVERITY_TOGGLES}>
          {(toggle) => (
            <CortexTooltip content={`${filter()[toggle.key] ? "Hide" : "Show"} ${toggle.label}`}>
              <button
                style={toggleBtnStyle(filter()[toggle.key])}
                onClick={() => toggleSeverity(toggle.key)}
                aria-pressed={filter()[toggle.key]}
              >
                <CortexIcon name={toggle.icon} size={12} color={toggle.color} />
                <span style={{ "font-size": "11px", color: "var(--cortex-text-primary)" }}>
                  {counts()[toggle.severity]}
                </span>
              </button>
            </CortexTooltip>
          )}
        </For>
      </div>

      <div style={dividerStyle} />

      <CortexInput
        value={props.searchQuery}
        onChange={props.onSearchChange}
        placeholder="Filter problems..."
        leftIcon="search"
        size="sm"
        style={{ flex: "1", "min-width": "120px", "max-width": "220px", height: "24px" }}
        type="search"
      />

      <div style={dividerStyle} />

      <CortexDropdown
        options={SOURCE_OPTIONS}
        value={activeSourceValue()}
        onChange={handleSourceChange}
        style={dropdownCompactStyle}
      />

      <CortexDropdown
        options={SORT_OPTIONS}
        value={props.sortBy}
        onChange={props.onSortChange}
        style={dropdownCompactStyle}
      />

      <CortexDropdown
        options={GROUP_OPTIONS}
        value={groupMode()}
        onChange={handleGroupChange}
        style={dropdownCompactStyle}
      />
    </div>
  );
};

export default DiagnosticsFilterBar;
