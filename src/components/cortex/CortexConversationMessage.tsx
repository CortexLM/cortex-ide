/**
 * CortexConversationMessage - Individual message component for conversation view
 * Renders user/assistant/system messages with code highlighting and tool call progress
 */

import { Component, Show, For, createSignal, createResource, JSX } from "solid-js";
import { highlightCode, normalizeLanguage } from "@/utils/shikiHighlighter";
import { SafeHTML } from "@/components/ui/SafeHTML";
import { CortexIcon } from "./primitives/CortexIcon";

export interface ToolCall {
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolCalls?: ToolCall[];
  isError?: boolean;
  codeBlocks?: { language: string; code: string }[];
}

export interface CortexConversationMessageProps {
  message: Message;
  isStreaming?: boolean;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const containerStyle = (role: Message["role"], isError?: boolean): JSX.CSSProperties => ({
  padding: "12px 16px",
  "border-radius": "var(--cortex-radius-md)",
  background: isError
    ? "rgba(239,68,68,0.1)"
    : role === "system"
      ? "rgba(255,255,255,0.05)"
      : "var(--cortex-bg-primary)",
  border: isError
    ? "1px solid rgba(239,68,68,0.3)"
    : "1px solid var(--cortex-border-default, rgba(255,255,255,0.08))",
});

const contentStyle: JSX.CSSProperties = {
  "font-family": "'Inter', sans-serif",
  "font-size": "14px",
  "line-height": "1.6",
  color: "var(--cortex-text-primary)",
  "white-space": "pre-wrap",
};

const inlineCodeStyle: JSX.CSSProperties = {
  background: "rgba(178,255,34,0.2)",
  color: "var(--cortex-accent-primary)",
  padding: "1px 4px",
  "border-radius": "var(--cortex-radius-xs)",
  "font-family": "'JetBrains Mono', monospace",
  "font-size": "12px",
};

const codeBlockWrapperStyle: JSX.CSSProperties = {
  position: "relative",
  background: "var(--cortex-bg-secondary)",
  "border-radius": "var(--cortex-radius-md)",
  "margin-top": "8px",
  overflow: "hidden",
};

const codeBlockHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  height: "28px",
  padding: "0 12px",
  background: "rgba(0,0,0,0.2)",
  "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.08))",
};

const codeBlockLangStyle: JSX.CSSProperties = {
  "font-family": "'JetBrains Mono', monospace",
  "font-size": "11px",
  color: "var(--cortex-text-inactive)",
  "text-transform": "lowercase",
};

const codeBlockBodyStyle: JSX.CSSProperties = {
  padding: "12px",
  "overflow-x": "auto",
  "font-family": "'JetBrains Mono', monospace",
  "font-size": "12px",
  "line-height": "1.5",
};

const fallbackCodeStyle: JSX.CSSProperties = {
  margin: "0",
  color: "var(--cortex-text-primary)",
  "white-space": "pre",
};

function parseInlineCode(content: string): JSX.Element[] {
  const parts = content.split(/(`[^`]+`)/g);
  return parts.map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <span style={inlineCodeStyle}>{part.slice(1, -1)}</span>;
    }
    return part;
  });
}

function HighlightedCodeBlock(props: { code: string; language: string }) {
  const [copied, setCopied] = createSignal(false);
  const lang = () => normalizeLanguage(props.language);

  const [highlighted] = createResource(
    () => ({ code: props.code, lang: lang() }),
    async ({ code, lang: l }) => {
      try {
        return await highlightCode(code, l);
      } catch {
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
    }
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = props.code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const copyBtnStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: copied() ? "var(--cortex-success)" : "var(--cortex-text-inactive)",
    padding: "2px",
  });

  return (
    <div style={codeBlockWrapperStyle}>
      <div style={codeBlockHeaderStyle}>
        <span style={codeBlockLangStyle}>{props.language || "code"}</span>
        <button style={copyBtnStyle()} onClick={handleCopy} title={copied() ? "Copied!" : "Copy code"}>
          <CortexIcon name={copied() ? "check" : "copy"} size={14} />
        </button>
      </div>
      <div style={codeBlockBodyStyle}>
        <Show
          when={!highlighted.loading && highlighted()}
          fallback={<pre style={fallbackCodeStyle}><code>{props.code}</code></pre>}
        >
          <SafeHTML html={highlighted()!} />
        </Show>
      </div>
    </div>
  );
}

export const CortexConversationMessage: Component<CortexConversationMessageProps> = (props) => {
  const [toolsExpanded, setToolsExpanded] = createSignal(false);

  const toolCallsSummaryStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.03)",
    "border-radius": "var(--cortex-radius-md)",
    "margin-top": "8px",
    "font-family": "'Inter', sans-serif",
    "font-size": "12px",
    color: "var(--cortex-text-inactive)",
    cursor: "pointer",
    border: "none",
    width: "100%",
    "text-align": "left",
  };

  const toolItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "4px 12px 4px 24px",
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "11px",
    color: "var(--cortex-text-inactive)",
  };

  const statusColor = (status: ToolCall["status"]): string =>
    status === "completed" ? "var(--cortex-success)" :
    status === "error" ? "var(--cortex-error)" :
    status === "pending" ? "var(--cortex-text-muted, #666)" : "var(--cortex-text-inactive)";

  const completedCount = () => props.message.toolCalls?.filter((t) => t.status === "completed").length ?? 0;

  const cursorStyle: JSX.CSSProperties = {
    display: "inline-block",
    width: "2px",
    height: "1em",
    background: "var(--cortex-text-primary)",
    "margin-left": "2px",
    "vertical-align": "text-bottom",
    animation: "cursor-blink 1s step-end infinite",
  };

  return (
    <div style={containerStyle(props.message.role, props.message.isError)}>
      <div style={contentStyle}>
        {parseInlineCode(props.message.content)}
        <Show when={props.isStreaming}>
          <span style={cursorStyle} />
        </Show>
      </div>

      <Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
        <button style={toolCallsSummaryStyle} onClick={() => setToolsExpanded((v) => !v)}>
          <span>{toolsExpanded() ? "▾" : "▸"}</span>
          <span>
            {props.message.toolCalls!.length} tool calls, {completedCount()} completed
          </span>
        </button>
        <Show when={toolsExpanded()}>
          <For each={props.message.toolCalls}>
            {(tc) => (
              <div style={toolItemStyle}>
                <CortexIcon
                  name={tc.status === "completed" ? "check" : tc.status === "error" ? "x-close" : tc.status === "pending" ? "clock" : "refresh"}
                  size={12}
                  color={statusColor(tc.status)}
                />
                <span>{tc.name}</span>
              </div>
            )}
          </For>
        </Show>
      </Show>

      <For each={props.message.codeBlocks}>
        {(block) => <HighlightedCodeBlock code={block.code} language={block.language} />}
      </For>
    </div>
  );
};

export default CortexConversationMessage;
