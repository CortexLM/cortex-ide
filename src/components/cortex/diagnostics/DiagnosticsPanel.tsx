import { Component, JSX, createSignal, createMemo, For, Show } from "solid-js";
import { CortexIcon } from "../primitives";
import { useDiagnostics, type UnifiedDiagnostic } from "@/context/DiagnosticsContext";
import type { DiagnosticSeverity } from "@/context/LSPContext";

export interface DiagnosticsPanelProps {
  class?: string;
  style?: JSX.CSSProperties;
}

type SubTab = "file" | "project" | "deps";

const SEV_CONFIG: Record<DiagnosticSeverity, { icon: string; color: string; label: string; filterKey: "showErrors" | "showWarnings" | "showInformation" | "showHints" }> = {
  error: { icon: "circle-xmark", color: "var(--cortex-error)", label: "Errors", filterKey: "showErrors" },
  warning: { icon: "triangle-exclamation", color: "var(--cortex-warning)", label: "Warnings", filterKey: "showWarnings" },
  information: { icon: "circle-info", color: "var(--cortex-info)", label: "Info", filterKey: "showInformation" },
  hint: { icon: "lightbulb", color: "var(--cortex-text-muted)", label: "Hints", filterKey: "showHints" },
};

const fileName = (uri: string): string => {
  const parts = uri.replace(/^file:\/\/\/?/, "").split(/[/\\]/);
  return parts[parts.length - 1] || parts[0];
};

const filePath = (uri: string): string => {
  const cleaned = uri.replace(/^file:\/\/\/?/, "");
  const parts = cleaned.split(/[/\\]/);
  return parts.slice(0, -1).join("/") || "";
};

export const DiagnosticsPanel: Component<DiagnosticsPanelProps> = (props) => {
  const diagnostics = useDiagnostics();
  const [subTab, setSubTab] = createSignal<SubTab>("file");
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set());

  const counts = createMemo(() => diagnostics.getCounts());
  const filter = createMemo(() => diagnostics.state.filter);
  const filteredDiagnostics = createMemo(() => diagnostics.getFilteredDiagnostics());
  const groupedByFile = createMemo(() => diagnostics.getDiagnosticsGroupedByFile());

  const sortedFileKeys = createMemo(() => {
    const groups = groupedByFile();
    return Array.from(groups.keys()).sort((a, b) => {
      const aCount = groups.get(a)?.length ?? 0;
      const bCount = groups.get(b)?.length ?? 0;
      return bCount - aCount;
    });
  });

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSeverityFilter = (severity: DiagnosticSeverity) => {
    const key = SEV_CONFIG[severity].filterKey;
    diagnostics.setFilter({ [key]: !filter()[key] });
  };

  const handleDiagnosticClick = (diag: UnifiedDiagnostic) => {
    diagnostics.selectDiagnostic(diag.id);
    diagnostics.navigateToSelected();
  };

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-primary)",
        color: "var(--cortex-text-primary)",
        "font-family": "var(--cortex-font-sans)",
        "font-size": "12px",
        overflow: "hidden",
        ...props.style,
      }}
    >
      <div style={{
        display: "flex",
        "justify-content": "space-between",
        "align-items": "center",
        padding: "0 12px 0 0",
        "flex-shrink": "0",
        "border-bottom": "1px solid var(--cortex-border-default)",
      }}>
        <div style={{ display: "flex", "align-items": "center", height: "36px" }}>
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "10px",
            padding: "10px 20px",
            height: "36px",
            color: "var(--cortex-text-muted)",
            "font-size": "12px",
          }}>
            Problems
          </div>
          <div style={{ display: "flex", "align-items": "center", height: "36px" }}>
            <div style={{ width: "1px", height: "100%", background: "var(--cortex-border-default)" }} />
            <SubTabButton label="File" count={counts().total} active={subTab() === "file"} onClick={() => setSubTab("file")} />
            <div style={{ width: "1px", height: "100%", background: "var(--cortex-border-default)" }} />
            <SubTabButton label="Project Errors" count={counts().error + counts().warning} active={subTab() === "project"} onClick={() => setSubTab("project")} />
            <div style={{ width: "1px", height: "100%", background: "var(--cortex-border-default)" }} />
            <SubTabButton label="Vulnerable Dependencies" active={subTab() === "deps"} onClick={() => setSubTab("deps")} />
            <div style={{ width: "1px", height: "100%", background: "var(--cortex-border-default)" }} />
          </div>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          <SeverityBadge severity="error" icon="circle-xmark" color={SEV_CONFIG.error.color} count={counts().error} active={filter().showErrors} onClick={() => toggleSeverityFilter("error")} />
          <SeverityBadge severity="warning" icon="triangle-exclamation" color={SEV_CONFIG.warning.color} count={counts().warning} active={filter().showWarnings} onClick={() => toggleSeverityFilter("warning")} />
          <SeverityBadge severity="information" icon="circle-info" color={SEV_CONFIG.information.color} count={counts().information} active={filter().showInformation} onClick={() => toggleSeverityFilter("information")} />
        </div>
      </div>

      <div style={{ flex: "1", overflow: "auto" }} role="list" aria-label="Diagnostics list">
        <Show when={subTab() === "deps"}>
          <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", height: "100%", gap: "8px", color: "var(--cortex-text-muted)" }}>
            <CortexIcon name="check-circle" size={24} color="var(--cortex-success)" />
            <span>No vulnerable dependencies detected</span>
          </div>
        </Show>

        <Show when={subTab() === "file" || subTab() === "project"}>
          <Show
            when={filteredDiagnostics().length > 0}
            fallback={
              <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", height: "100%", gap: "8px", color: "var(--cortex-text-muted)" }}>
                <CortexIcon name="check-circle" size={24} color="var(--cortex-success)" />
                <span>No problems detected</span>
              </div>
            }
          >
            <For each={sortedFileKeys()}>
              {(fileUri) => {
                const items = () => groupedByFile().get(fileUri) || [];
                const isCollapsed = () => collapsedGroups().has(fileUri);
                return (
                  <div>
                    <div
                      onClick={() => toggleGroup(fileUri)}
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "4px",
                        padding: "6px 12px",
                        cursor: "pointer",
                        background: "var(--cortex-bg-primary)",
                        "border-bottom": "1px solid var(--cortex-border-default)",
                        "user-select": "none",
                      }}
                      role="button"
                      aria-expanded={!isCollapsed()}
                    >
                      <CortexIcon name={isCollapsed() ? "chevron-right" : "chevron-down"} size={10} color="var(--cortex-text-muted)" />
                      <CortexIcon name="file-code" size={14} />
                      <span style={{ "font-size": "12px", "font-weight": "400" }}>{fileName(fileUri)}</span>
                      <span style={{ color: "var(--cortex-text-muted)", "font-size": "12px", "margin-left": "4px", flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                        {filePath(fileUri)}
                      </span>
                      <span style={{ color: "var(--cortex-text-muted)", "font-size": "12px", "flex-shrink": "0" }}>
                        {items().length} {items().length === 1 ? "problem" : "problems"}
                      </span>
                    </div>
                    <Show when={!isCollapsed()}>
                      <For each={items()}>
                        {(diag) => <DiagnosticRow diagnostic={diag} onClick={handleDiagnosticClick} />}
                      </For>
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
};

interface SubTabButtonProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

const SubTabButton: Component<SubTabButtonProps> = (props) => (
  <button
    style={{
      position: "relative",
      display: "flex",
      "align-items": "center",
      gap: "4px",
      padding: "10px 20px",
      height: "36px",
      background: "transparent",
      border: "none",
      color: props.active ? "var(--cortex-text-primary)" : "var(--cortex-text-muted)",
      "font-family": "var(--cortex-font-sans)",
      "font-size": "12px",
      cursor: "pointer",
      "white-space": "nowrap",
    }}
    onClick={props.onClick}
  >
    {props.label}
    <Show when={props.count !== undefined && props.count > 0}>
      <span style={{ color: props.active ? "var(--cortex-accent-primary)" : "var(--cortex-text-muted)", "font-size": "12px" }}>
        {props.count}
      </span>
    </Show>
    <Show when={props.active}>
      <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", height: "2px", background: "var(--cortex-accent-primary)" }} />
    </Show>
  </button>
);

interface SeverityBadgeProps {
  severity: DiagnosticSeverity;
  icon: string;
  color: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const SeverityBadge: Component<SeverityBadgeProps> = (props) => (
  <button
    onClick={props.onClick}
    aria-pressed={props.active}
    aria-label={`Toggle ${props.severity} filter`}
    style={{
      display: "flex",
      "align-items": "center",
      gap: "2px",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      opacity: props.active ? "1" : "0.4",
      padding: "2px 4px",
      "border-radius": "4px",
      transition: "opacity 100ms ease",
    }}
  >
    <CortexIcon name={props.icon} size={14} color={props.color} />
    <span style={{ color: "var(--cortex-text-primary)", "font-size": "12px" }}>{props.count}</span>
  </button>
);

interface DiagnosticRowProps {
  diagnostic: UnifiedDiagnostic;
  onClick: (diag: UnifiedDiagnostic) => void;
}

const DiagnosticRow: Component<DiagnosticRowProps> = (props) => {
  const config = () => SEV_CONFIG[props.diagnostic.severity];

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "4px 12px 4px 20px",
        cursor: "pointer",
        "white-space": "nowrap",
      }}
      onClick={() => props.onClick(props.diagnostic)}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(252, 252, 252, 0.08)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick(props.diagnostic);
        }
      }}
    >
      <CortexIcon name={config().icon} size={14} color={config().color} style={{ "flex-shrink": "0" }} />
      <span style={{ color: "var(--cortex-text-primary)", "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", flex: "1", "min-width": "0" }}>
        {props.diagnostic.message}
      </span>
      <span style={{ color: "var(--cortex-text-muted)", "font-size": "12px", "flex-shrink": "0", "font-family": "var(--cortex-font-mono)" }}>
        :{props.diagnostic.range.start.line + 1}
      </span>
    </div>
  );
};

export default DiagnosticsPanel;
