import { Show, For, createSignal, createMemo, createEffect, onCleanup } from "solid-js";
import { Icon } from "../../ui/Icon";
import { ToolCard, type ToolStatus } from "./ToolCard";

// ============================================================================
// Types
// ============================================================================

export interface TerminalViewerProps {
  /** The command being executed */
  command: string;
  /** The terminal output (can be streaming) */
  output?: string;
  /** Exit code (undefined if still running) */
  exitCode?: number;
  /** Current status */
  status?: ToolStatus;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Working directory */
  cwd?: string;
  /** Whether the output is currently streaming */
  isStreaming?: boolean;
  /** Maximum height before scrolling (default: 400px) */
  maxHeight?: number;
  /** Whether to start collapsed */
  defaultCollapsed?: boolean;
  /** Called when copy button is clicked */
  onCopy?: () => void;
  /** Called when stop button is clicked */
  onStop?: () => void;
}

// ============================================================================
// ANSI Color Parser
// ============================================================================

interface AnsiSegment {
  text: string;
  style: AnsiStyle;
}

interface AnsiStyle {
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}

const ANSI_COLORS: Record<number, string> = {
  30: "var(--cortex-bg-primary)", // Black
  31: "var(--cortex-error)", // Red
  32: "var(--cortex-success)", // Green
  33: "var(--cortex-warning)", // Yellow
  34: "var(--cortex-info)", // Blue
  35: "var(--cortex-info)", // Magenta
  36: "var(--cortex-success)", // Cyan
  37: "var(--cortex-text-primary)", // White
  90: "var(--cortex-text-inactive)", // Bright Black
  91: "var(--cortex-error)", // Bright Red
  92: "var(--cortex-success)", // Bright Green
  93: "var(--cortex-warning)", // Bright Yellow
  94: "var(--cortex-info)", // Bright Blue
  95: "var(--cortex-info)", // Bright Magenta
  96: "var(--cortex-success)", // Bright Cyan
  97: "var(--cortex-text-primary)", // Bright White
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: "var(--cortex-bg-primary)",
  41: "var(--cortex-error)",
  42: "var(--cortex-success)",
  43: "var(--cortex-warning)",
  44: "var(--cortex-info)",
  45: "var(--cortex-info)",
  46: "var(--cortex-success)",
  47: "var(--cortex-text-primary)",
  100: "var(--cortex-text-inactive)",
  101: "var(--cortex-error)",
  102: "var(--cortex-success)",
  103: "var(--cortex-warning)",
  104: "var(--cortex-info)",
  105: "var(--cortex-info)",
  106: "var(--cortex-success)",
  107: "var(--cortex-text-primary)",
};

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentStyle: AnsiStyle = {};
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the escape sequence
    if (match.index > lastIndex) {
      const textSegment = text.slice(lastIndex, match.index);
      if (textSegment) {
        segments.push({ text: textSegment, style: { ...currentStyle } });
      }
    }

    // Parse the escape sequence
    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) {
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 2) {
        currentStyle.dim = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code >= 30 && code <= 37) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (code >= 40 && code <= 47) {
        currentStyle.background = ANSI_BG_COLORS[code];
      } else if (code >= 90 && code <= 97) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (code >= 100 && code <= 107) {
        currentStyle.background = ANSI_BG_COLORS[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), style: { ...currentStyle } });
  }

  return segments;
}

function getStyleString(style: AnsiStyle): string {
  const styles: string[] = [];
  if (style.color) styles.push(`color: ${style.color}`);
  if (style.background) styles.push(`background: ${style.background}`);
  if (style.bold) styles.push("font-weight: bold");
  if (style.italic) styles.push("font-style: italic");
  if (style.underline) styles.push("text-decoration: underline");
  if (style.dim) styles.push("opacity: 0.6");
  return styles.join("; ");
}

// ============================================================================
// Component
// ============================================================================

export function TerminalViewer(props: TerminalViewerProps) {
  const [copied, setCopied] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal(props.defaultCollapsed ?? false);
  let outputRef: HTMLPreElement | undefined;
  let copyTimeoutId: number | undefined;

  // Auto-scroll to bottom when output changes
  createEffect(() => {
    if (props.output && outputRef && props.isStreaming) {
      outputRef.scrollTop = outputRef.scrollHeight;
    }
  });

  onCleanup(() => {
    if (copyTimeoutId) clearTimeout(copyTimeoutId);
  });

  const parsedOutput = createMemo(() => {
    if (!props.output) return [];
    return parseAnsi(props.output);
  });

  const outputLines = createMemo(() => {
    return (props.output || "").split("\n").length;
  });

  const exitCodeColor = createMemo(() => {
    if (props.exitCode === undefined) return "var(--vscode-descriptionForeground)";
    return props.exitCode === 0
      ? "var(--vscode-chat-linesAddedForeground)"
      : "var(--vscode-errorForeground)";
  });

  const statusFromExitCode = createMemo((): ToolStatus => {
    if (props.status) return props.status;
    if (props.exitCode === undefined) return "running";
    return props.exitCode === 0 ? "completed" : "error";
  });

  const handleCopy = async () => {
    const textToCopy = props.command + (props.output ? "\n" + props.output : "");
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (copyTimeoutId) clearTimeout(copyTimeoutId);
      copyTimeoutId = window.setTimeout(() => setCopied(false), 2000);
      props.onCopy?.();
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      copyTimeoutId = window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolCard
      name="Execute"
      icon={<Icon name="terminal" class="w-4 h-4" />}
      status={statusFromExitCode()}
      durationMs={props.durationMs}
      defaultExpanded={true}
    >
      <div class="terminal-viewer">
        {/* Command Header */}
        <div
          class="terminal-command"
          style={{
            display: "flex",
            "align-items": "flex-start",
            "justify-content": "space-between",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.3)",
            "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
          }}
        >
          <div style={{ flex: "1", "min-width": "0" }}>
            {/* CWD */}
            <Show when={props.cwd}>
              <div
                style={{
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  color: "var(--vscode-descriptionForeground)",
                  "margin-bottom": "4px",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                }}
              >
                {props.cwd}
              </div>
            </Show>

            {/* Command */}
            <div
              style={{
                display: "flex",
                "align-items": "flex-start",
                gap: "8px",
              }}
            >
              <span
                style={{
                  color: "var(--vscode-chat-linesAddedForeground)",
                  "flex-shrink": "0",
                }}
              >
                $
              </span>
              <code
                style={{
                  "font-family": "var(--monaco-monospace-font, monospace)",
                  "font-size": "var(--vscode-chat-font-size-body-s)",
                  color: "var(--vscode-foreground)",
                  "white-space": "pre-wrap",
                  "word-break": "break-all",
                }}
              >
                {props.command}
              </code>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", "align-items": "center", gap: "4px", "flex-shrink": "0", "margin-left": "12px" }}>
            {/* Stop Button */}
            <Show when={props.isStreaming && props.onStop}>
              <button
                type="button"
                onClick={props.onStop}
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "24px",
                  height: "24px",
                  padding: "0",
                  background: "transparent",
                  border: "none",
                  color: "var(--vscode-errorForeground)",
                  cursor: "pointer",
                  "border-radius": "var(--cortex-radius-sm)",
                }}
                title="Stop execution"
              >
                <Icon name="stop" class="w-3.5 h-3.5" />
              </button>
            </Show>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                padding: "0",
                background: "transparent",
                border: "none",
                color: copied() ? "var(--vscode-chat-linesAddedForeground)" : "var(--vscode-descriptionForeground)",
                cursor: "pointer",
                "border-radius": "var(--cortex-radius-sm)",
              }}
              title={copied() ? "Copied!" : "Copy command and output"}
            >
<Show when={copied()} fallback={<Icon name="copy" class="w-3.5 h-3.5" />}>
                <Icon name="check" class="w-3.5 h-3.5" />
              </Show>
            </button>

            {/* Collapse Toggle */}
            <Show when={props.output}>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed())}
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "24px",
                  height: "24px",
                  padding: "0",
                  background: "transparent",
                  border: "none",
                  color: "var(--vscode-descriptionForeground)",
                  cursor: "pointer",
                  "border-radius": "var(--cortex-radius-sm)",
                }}
                title={collapsed() ? "Expand output" : "Collapse output"}
              >
<Show when={collapsed()} fallback={<Icon name="chevron-up" class="w-3.5 h-3.5" />}>
                  <Icon name="chevron-down" class="w-3.5 h-3.5" />
                </Show>
              </button>
            </Show>
          </div>
        </div>

        {/* Output */}
        <Show when={props.output && !collapsed()}>
          <pre
            ref={outputRef}
            class="terminal-output"
            style={{
              margin: "0",
              padding: "10px 14px",
              "font-family": "var(--monaco-monospace-font, monospace)",
              "font-size": "var(--vscode-chat-font-size-body-xs)",
              "line-height": "1.5",
              background: "var(--vscode-editor-background)",
              color: "var(--vscode-foreground)",
              "white-space": "pre-wrap",
              "word-break": "break-all",
              "max-height": `${props.maxHeight || 400}px`,
              "overflow-y": "auto",
              "overflow-x": "hidden",
            }}
          >
            <For each={parsedOutput()}>
              {(segment) => (
                <span style={getStyleString(segment.style)}>{segment.text}</span>
              )}
            </For>
            <Show when={props.isStreaming}>
              <span class="terminal-cursor" style={{
                display: "inline-block",
                width: "8px",
                height: "14px",
                background: "var(--vscode-foreground)",
                animation: "terminal-blink 1s step-end infinite",
                "vertical-align": "middle",
              }} />
            </Show>
          </pre>
        </Show>

        {/* Collapsed Summary */}
        <Show when={props.output && collapsed()}>
          <div
            style={{
              padding: "8px 14px",
              "font-size": "var(--vscode-chat-font-size-body-xs)",
              color: "var(--vscode-descriptionForeground)",
              background: "var(--vscode-editor-background)",
            }}
          >
            {outputLines()} lines of output (click to expand)
          </div>
        </Show>

        {/* Footer with Exit Code */}
        <Show when={props.exitCode !== undefined}>
          <div
            class="terminal-footer"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "8px 14px",
              "border-top": "1px solid var(--vscode-chat-requestBorder)",
              background: "rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
<Show when={props.exitCode === 0} fallback={
                <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: "var(--vscode-errorForeground)" }} />
              }>
                <Icon name="check" class="w-4 h-4" style={{ color: "var(--vscode-chat-linesAddedForeground)" }} />
              </Show>
              <span
                style={{
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                Exit code:
              </span>
              <span
                style={{
                  display: "inline-flex",
                  "align-items": "center",
                  "justify-content": "center",
                  "min-width": "20px",
                  padding: "2px 6px",
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  "font-weight": "500",
                  background: props.exitCode === 0 ? "rgba(74, 222, 128, 0.15)" : "rgba(248, 113, 113, 0.15)",
                  color: exitCodeColor(),
                }}
              >
                {props.exitCode}
              </span>
            </div>

            <Show when={outputLines() > 0}>
              <span
                style={{
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                {outputLines()} lines
              </span>
            </Show>
          </div>
        </Show>

        <style>{`
          @keyframes terminal-blink {
            50% { opacity: 0; }
          }
          .terminal-viewer:hover .terminal-command button {
            opacity: 1;
          }
          .terminal-output::-webkit-scrollbar {
            width: 8px;
          }
          .terminal-output::-webkit-scrollbar-track {
            background: transparent;
          }
          .terminal-output::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: var(--cortex-radius-sm);
          }
          .terminal-output::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
          }
        `}</style>
      </div>
    </ToolCard>
  );
}

export default TerminalViewer;

