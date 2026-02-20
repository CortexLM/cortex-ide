import { Component, JSX, Show, For, createMemo } from "solid-js";
import { CortexButton, CortexIcon, CortexIconButton } from "../primitives";
import type { UnifiedDiagnostic, CodeAction, DiagnosticRelatedInfo } from "@/context/DiagnosticsContext";
import type { DiagnosticSeverity } from "@/context/LSPContext";

export interface ErrorDetailViewProps {
  diagnostic: UnifiedDiagnostic;
  onClose?: () => void;
  onApplyAction?: (action: CodeAction) => void;
  onNavigateToSource?: () => void;
}

const SEV_CONFIG: Record<DiagnosticSeverity, { icon: string; color: string; label: string }> = {
  error: { icon: "circle-xmark", color: "var(--cortex-error)", label: "Error" },
  warning: { icon: "triangle-exclamation", color: "var(--cortex-warning)", label: "Warning" },
  information: { icon: "circle-info", color: "var(--cortex-info)", label: "Info" },
  hint: { icon: "lightbulb", color: "var(--cortex-text-muted)", label: "Hint" },
};

const STACK_TRACE_PATTERN = /^\s+at\s+.+/;

const fileName = (uri: string): string => {
  const parts = uri.replace(/^file:\/\/\/?/, "").split(/[/\\]/);
  return parts.slice(-2).join("/") || parts[0];
};

const fullPath = (uri: string): string => uri.replace(/^file:\/\/\/?/, "");

const loc = (line: number, character: number): string =>
  `Ln ${line + 1}, Col ${character + 1}`;

const parseStackTrace = (message: string): string[] => {
  const lines = message.split("\n");
  return lines.filter((line) => STACK_TRACE_PATTERN.test(line));
};

const sectionHeaderStyle: JSX.CSSProperties = {
  "font-size": "11px",
  "font-weight": "600",
  "text-transform": "uppercase",
  "letter-spacing": "0.5px",
  color: "var(--cortex-text-muted)",
  "margin-bottom": "6px",
};

const sectionStyle: JSX.CSSProperties = {
  padding: "10px 16px",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

export const ErrorDetailView: Component<ErrorDetailViewProps> = (props) => {
  const config = createMemo(() => SEV_CONFIG[props.diagnostic.severity]);

  const stackLines = createMemo(() => parseStackTrace(props.diagnostic.message));

  const messageWithoutStack = createMemo(() => {
    const lines = props.diagnostic.message.split("\n");
    return lines.filter((line) => !STACK_TRACE_PATTERN.test(line)).join("\n").trim();
  });

  const hasRelated = createMemo(
    () => props.diagnostic.relatedInformation && props.diagnostic.relatedInformation.length > 0,
  );

  const hasActions = createMemo(
    () => props.diagnostic.codeActions && props.diagnostic.codeActions.length > 0,
  );

  const hasStack = createMemo(() => stackLines().length > 0);

  const relatedInfoLoc = (info: DiagnosticRelatedInfo): string => {
    const file = fileName(info.location.uri);
    const line = info.location.range.start.line + 1;
    const col = info.location.range.start.character + 1;
    return `${file}:${line}:${col}`;
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-secondary)",
        color: "var(--cortex-text-primary)",
        "font-family": "var(--cortex-font-sans)",
        "font-size": "13px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "8px 12px",
          "border-bottom": "1px solid var(--cortex-border-default)",
          "flex-shrink": "0",
        }}
      >
        <CortexIcon name={config().icon} size={16} color={config().color} />
        <span style={{ flex: "1", "font-weight": "600", "font-size": "13px" }}>
          {config().label} Detail
        </span>
        <Show when={props.onClose}>
          <CortexIconButton icon="xmark" size={16} onClick={() => props.onClose?.()} title="Close" />
        </Show>
      </div>

      <div style={{ flex: "1", overflow: "auto" }}>
        <div style={sectionStyle}>
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              "border-radius": "var(--cortex-radius-sm)",
              background: config().color,
              color: "var(--cortex-text-primary)",
              "font-size": "11px",
              "font-weight": "600",
              "line-height": "1.4",
            }}
          >
            {config().label}
          </span>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Message</div>
          <div
            style={{
              "font-size": "12px",
              "word-wrap": "break-word",
              "white-space": "pre-wrap",
              "line-height": "1.5",
              "font-family": "var(--cortex-font-mono)",
            }}
          >
            {messageWithoutStack()}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Location</div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", "font-size": "12px" }}>
            <span
              onClick={() => props.onNavigateToSource?.()}
              style={{
                color: "var(--cortex-accent-primary)",
                cursor: props.onNavigateToSource ? "pointer" : "default",
                "font-family": "var(--cortex-font-mono)",
                "text-decoration": props.onNavigateToSource ? "underline" : "none",
              }}
            >
              {fullPath(props.diagnostic.uri)}
            </span>
            <span style={{ color: "var(--cortex-text-muted)", "font-family": "var(--cortex-font-mono)" }}>
              {loc(props.diagnostic.range.start.line, props.diagnostic.range.start.character)}
            </span>
          </div>
        </div>

        <Show when={props.diagnostic.sourceName || props.diagnostic.source}>
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>Source</div>
            <span style={{ "font-size": "12px", color: "var(--cortex-text-secondary)" }}>
              {props.diagnostic.sourceName || props.diagnostic.source}
            </span>
          </div>
        </Show>

        <Show when={props.diagnostic.code}>
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>Code</div>
            <span
              style={{
                "font-size": "12px",
                "font-family": "var(--cortex-font-mono)",
                padding: "2px 6px",
                background: "var(--cortex-bg-active)",
                "border-radius": "var(--cortex-radius-sm)",
              }}
            >
              {String(props.diagnostic.code)}
            </span>
          </div>
        </Show>

        <Show when={hasRelated()}>
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>Related Information</div>
            <For each={props.diagnostic.relatedInformation}>
              {(info) => (
                <div
                  style={{
                    display: "flex",
                    "flex-direction": "column",
                    gap: "2px",
                    padding: "4px 0",
                    "border-bottom": "1px solid var(--cortex-border-default)",
                  }}
                >
                  <span
                    onClick={() => props.onNavigateToSource?.()}
                    style={{
                      "font-size": "11px",
                      "font-family": "var(--cortex-font-mono)",
                      color: "var(--cortex-accent-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {relatedInfoLoc(info)}
                  </span>
                  <span style={{ "font-size": "12px", color: "var(--cortex-text-secondary)" }}>
                    {info.message}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={hasActions()}>
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>Code Actions</div>
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <For each={props.diagnostic.codeActions}>
                {(action) => (
                  <CortexButton
                    variant={action.isPreferred ? "primary" : "secondary"}
                    size="xs"
                    icon="wand-magic-sparkles"
                    onClick={() => props.onApplyAction?.(action)}
                    style={{ "justify-content": "flex-start" }}
                  >
                    {action.title}
                  </CortexButton>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={hasStack()}>
          <div style={{ ...sectionStyle, "border-bottom": "none" }}>
            <div style={sectionHeaderStyle}>Stack Trace</div>
            <div
              style={{
                "font-size": "11px",
                "font-family": "var(--cortex-font-mono)",
                "white-space": "pre",
                overflow: "auto",
                "line-height": "1.6",
                color: "var(--cortex-text-secondary)",
                padding: "6px 8px",
                background: "var(--cortex-bg-primary)",
                "border-radius": "var(--cortex-radius-sm)",
              }}
            >
              {stackLines().join("\n")}
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ErrorDetailView;
