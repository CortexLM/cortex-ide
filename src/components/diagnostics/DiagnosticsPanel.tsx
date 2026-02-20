import { Component, JSX, Show, For, createMemo, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { DiagnosticItem } from "./DiagnosticItem";
import { DiagnosticsFilter } from "./DiagnosticsFilter";
import {
  useDiagnostics,
  type UnifiedDiagnostic,
} from "@/context/DiagnosticsContext";
import type { DiagnosticSeverity } from "@/context/LSPContext";

export interface DiagnosticsPanelProps {
  class?: string;
  style?: JSX.CSSProperties;
}

const SEVERITY_ORDER: DiagnosticSeverity[] = ["error", "warning", "information", "hint"];
const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  information: "Info",
  hint: "Hints",
};

export const DiagnosticsPanel: Component<DiagnosticsPanelProps> = (props) => {
  const diagnostics = useDiagnostics();
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set());

  const groupMode = createMemo(() => diagnostics.state.groupMode);
  const selectedId = createMemo(() => diagnostics.state.selectedDiagnosticId);
  const isRefreshing = createMemo(() => diagnostics.state.isRefreshing);
  const counts = createMemo(() => diagnostics.getCounts());
  const filteredCounts = createMemo(() => diagnostics.getFilteredCounts());

  const groupedDiagnostics = createMemo(() => {
    const mode = groupMode();
    if (mode === "file") {
      return diagnostics.getDiagnosticsGroupedByFile();
    } else if (mode === "severity") {
      return diagnostics.getDiagnosticsGroupedBySeverity();
    } else {
      return diagnostics.getDiagnosticsGroupedBySource();
    }
  });

  const sortedGroupKeys = createMemo(() => {
    const groups = groupedDiagnostics();
    const keys = Array.from(groups.keys());

    if (groupMode() === "severity") {
      return SEVERITY_ORDER.filter((s) => keys.includes(s as string));
    }

    return keys.sort((a, b) => {
      const countA = groups.get(a)?.length ?? 0;
      const countB = groups.get(b)?.length ?? 0;
      return countB - countA;
    });
  });

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDiagnosticClick = (diag: UnifiedDiagnostic) => {
    diagnostics.selectDiagnostic(diag.id);
  };

  const handleDiagnosticDoubleClick = (diag: UnifiedDiagnostic) => {
    diagnostics.selectDiagnostic(diag.id);
    diagnostics.navigateToSelected();
  };

  const getGroupLabel = (key: string): string => {
    if (groupMode() === "severity") {
      return SEVERITY_LABELS[key as DiagnosticSeverity] || key;
    }
    if (groupMode() === "file") {
      const path = key.replace(/^file:\/\/\/?/, "");
      const parts = path.split(/[/\\]/);
      return parts.slice(-2).join("/") || path;
    }
    return key;
  };

  const getGroupIcon = (key: string): string => {
    if (groupMode() === "severity") {
      const icons: Record<DiagnosticSeverity, string> = {
        error: "circle-xmark",
        warning: "triangle-exclamation",
        information: "circle-info",
        hint: "lightbulb",
      };
      return icons[key as DiagnosticSeverity] || "circle";
    }
    if (groupMode() === "file") {
      return "file-code";
    }
    return "puzzle-piece";
  };

  const getGroupColor = (key: string): string => {
    if (groupMode() === "severity") {
      const colors: Record<DiagnosticSeverity, string> = {
        error: "var(--cortex-error)",
        warning: "var(--cortex-warning)",
        information: "var(--cortex-info)",
        hint: "var(--cortex-text-muted)",
      };
      return colors[key as DiagnosticSeverity] || "var(--cortex-text-muted)";
    }
    return "var(--cortex-text-muted)";
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--cortex-border-default)",
    "flex-shrink": "0",
  };

  const titleStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
  };

  const groupHeaderStyle = (_isCollapsed: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "6px 12px",
    cursor: "pointer",
    background: "var(--cortex-bg-secondary)",
    "border-bottom": "1px solid var(--cortex-border-default)",
    position: "sticky",
    top: "0",
    "z-index": "1",
  });

  const emptyStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    height: "100%",
    gap: "12px",
    color: "var(--cortex-text-muted)",
  };

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <Icon name="clipboard-list" size={16} />
          <span>Problems</span>
          <Show when={counts().total > 0}>
            <Badge variant={counts().error > 0 ? "error" : counts().warning > 0 ? "warning" : "muted"}>
              {filteredCounts().total}
            </Badge>
          </Show>
        </div>
        <div style={actionsStyle}>
          <IconButton
            icon={<Icon name="rotate" size={14} class={isRefreshing() ? "animate-spin" : ""} />}
            tooltip="Refresh"
            onClick={() => diagnostics.refreshDiagnostics()}
            disabled={isRefreshing()}
            size="sm"
          />
          <IconButton
            icon={<Icon name="filter" size={14} />}
            tooltip="Reset Filters"
            onClick={() => diagnostics.resetFilter()}
            size="sm"
          />
          <IconButton
            icon={<Icon name="trash" size={14} />}
            tooltip="Clear All"
            onClick={() => diagnostics.clearDiagnostics()}
            size="sm"
          />
        </div>
      </div>

      <DiagnosticsFilter />

      <div style={contentStyle} role="list" aria-label="Diagnostics list">
        <Show
          when={filteredCounts().total > 0}
          fallback={
            <div style={emptyStyle}>
              <Icon name="circle-check" size={32} style={{ color: "var(--cortex-success)" }} />
              <span>No problems detected</span>
            </div>
          }
        >
          <For each={sortedGroupKeys()}>
            {(key) => {
              const items = () => groupedDiagnostics().get(key) || [];
              const isCollapsed = () => collapsedGroups().has(key as string);

              return (
                <div>
                  <div
                    style={groupHeaderStyle(isCollapsed())}
                    onClick={() => toggleGroup(key as string)}
                    role="button"
                    aria-expanded={!isCollapsed()}
                  >
                    <Icon
                      name={isCollapsed() ? "chevron-right" : "chevron-down"}
                      size={10}
                      style={{ color: "var(--cortex-text-muted)" }}
                    />
                    <Icon
                      name={getGroupIcon(key as string)}
                      size={14}
                      style={{ color: getGroupColor(key as string) }}
                    />
                    <span
                      style={{
                        flex: "1",
                        "font-size": "12px",
                        "font-weight": "500",
                        color: "var(--cortex-text-primary)",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {getGroupLabel(key as string)}
                    </span>
                    <Badge variant="muted" size="sm">
                      {items().length}
                    </Badge>
                  </div>
                  <Show when={!isCollapsed()}>
                    <For each={items()}>
                      {(diag) => (
                        <DiagnosticItem
                          diagnostic={diag}
                          isSelected={selectedId() === diag.id}
                          showFilePath={groupMode() !== "file"}
                          onClick={handleDiagnosticClick}
                          onDoubleClick={handleDiagnosticDoubleClick}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default DiagnosticsPanel;
