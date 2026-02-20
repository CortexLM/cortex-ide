import { Component, JSX, Show, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { UnifiedDiagnostic } from "@/context/DiagnosticsContext";
import type { DiagnosticSeverity } from "@/context/LSPContext";

export interface DiagnosticItemProps {
  diagnostic: UnifiedDiagnostic;
  isSelected?: boolean;
  showFilePath?: boolean;
  onClick?: (diagnostic: UnifiedDiagnostic) => void;
  onDoubleClick?: (diagnostic: UnifiedDiagnostic) => void;
}

const SEVERITY_CONFIG: Record<DiagnosticSeverity, { icon: string; color: string; label: string }> = {
  error: { icon: "circle-xmark", color: "var(--cortex-error)", label: "Error" },
  warning: { icon: "triangle-exclamation", color: "var(--cortex-warning)", label: "Warning" },
  information: { icon: "circle-info", color: "var(--cortex-info)", label: "Info" },
  hint: { icon: "lightbulb", color: "var(--cortex-text-muted)", label: "Hint" },
};

export const DiagnosticItem: Component<DiagnosticItemProps> = (props) => {
  const config = createMemo(() => SEVERITY_CONFIG[props.diagnostic.severity]);
  
  const location = createMemo(() => {
    const range = props.diagnostic.range;
    return `${range.start.line + 1}:${range.start.character + 1}`;
  });

  const fileName = createMemo(() => {
    const uri = props.diagnostic.uri;
    const path = uri.replace(/^file:\/\/\/?/, "");
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  });

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "flex-start",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    background: props.isSelected ? "var(--cortex-bg-active)" : "transparent",
    "border-left": `2px solid ${props.isSelected ? config().color : "transparent"}`,
    transition: "background var(--cortex-transition-fast)",
  });

  const handleMouseEnter = (e: MouseEvent) => {
    if (!props.isSelected) {
      (e.currentTarget as HTMLElement).style.background = "var(--cortex-bg-hover)";
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    if (!props.isSelected) {
      (e.currentTarget as HTMLElement).style.background = "transparent";
    }
  };

  return (
    <div
      style={containerStyle()}
      onClick={() => props.onClick?.(props.diagnostic)}
      onDblClick={() => props.onDoubleClick?.(props.diagnostic)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="listitem"
      aria-selected={props.isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick?.(props.diagnostic);
        }
      }}
    >
      <Icon
        name={config().icon}
        size={14}
        style={{ color: config().color, "flex-shrink": "0", "margin-top": "2px" }}
        aria-label={config().label}
      />
      <div style={{ flex: "1", "min-width": "0" }}>
        <div
          style={{
            "font-size": "12px",
            color: "var(--cortex-text-primary)",
            "word-break": "break-word",
          }}
        >
          {props.diagnostic.message}
        </div>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            "margin-top": "2px",
            "font-size": "11px",
            color: "var(--cortex-text-muted)",
          }}
        >
          <Show when={props.showFilePath}>
            <span style={{ "font-family": "var(--cortex-font-mono)" }}>{fileName()}</span>
          </Show>
          <span style={{ "font-family": "var(--cortex-font-mono)" }}>[Ln {location()}]</span>
          <Show when={props.diagnostic.code}>
            <span>{props.diagnostic.code}</span>
          </Show>
          <Show when={props.diagnostic.sourceName || props.diagnostic.source !== "lsp"}>
            <span>{props.diagnostic.sourceName || props.diagnostic.source}</span>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticItem;
