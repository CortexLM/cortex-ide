import { Component, Show, For, createSignal, JSX } from "solid-js";
import { CortexIcon } from "../primitives/CortexIcon";
import { StreamingCursor } from "./StreamingCursor";

export interface ToolCall {
  name: string;
  status: "running" | "completed" | "error";
}

export interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolCalls?: ToolCall[];
  isError?: boolean;
  reasoning?: string;
  fileDiffs?: { path: string; additions: number; deletions: number }[];
}

export interface MessageBubbleProps {
  message: MessageData;
  isStreaming?: boolean;
}

function parseContent(content: string): JSX.Element[] {
  const parts = content.split(/(`[^`]+`)/g);
  return parts.map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <span style={{
          background: "var(--cortex-vibe-hover-bg)",
          color: "var(--cortex-vibe-code-highlight)",
          padding: "2px 4px",
          "border-radius": "var(--cortex-radius-xs)",
          "font-family": "var(--cortex-font-mono)",
          "font-size": "var(--cortex-text-xs)",
        }}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

const statusColor = (s: ToolCall["status"]) =>
  s === "completed" ? "var(--cortex-vibe-status-completed)" : s === "error" ? "var(--cortex-vibe-status-error)" : "var(--cortex-text-secondary)";

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const [toolsExpanded, setToolsExpanded] = createSignal(false);
  const completedCount = () => props.message.toolCalls?.filter(t => t.status === "completed").length ?? 0;

  const isUser = () => props.message.role === "user";

  const containerStyle = (): JSX.CSSProperties => ({
    padding: "12px",
    "border-radius": "9px",
    background: props.message.isError
      ? "var(--cortex-vibe-status-error-bg)"
      : isUser()
        ? "var(--cortex-bg-primary)"
        : "transparent",
    border: props.message.isError
      ? "1px solid var(--cortex-vibe-status-error-border)"
      : isUser()
        ? "none"
        : "none",
  });

  return (
    <div style={containerStyle()}>
      <Show when={props.message.reasoning}>
        <div style={{
          "font-family": "var(--cortex-font-sans)",
          "font-size": "var(--cortex-text-xs)",
          "font-weight": "var(--cortex-font-medium)",
          color: "var(--cortex-text-secondary)",
          "margin-bottom": "8px",
        }}>
          {props.message.reasoning}
        </div>
      </Show>

      <div style={{
        "font-family": "var(--cortex-font-sans)",
        "font-size": "var(--cortex-text-sm)",
        "font-weight": "var(--cortex-font-medium)",
        "line-height": "1.43",
        color: isUser() ? "var(--cortex-text-on-surface)" : "var(--cortex-text-on-surface)",
        "white-space": "pre-wrap",
      }}>
        {parseContent(props.message.content)}
        <Show when={props.isStreaming}>
          <StreamingCursor />
        </Show>
      </div>

      <Show when={props.message.fileDiffs && props.message.fileDiffs.length > 0}>
        <div style={{ "margin-top": "8px", display: "flex", "flex-wrap": "wrap", gap: "4px" }}>
          <For each={props.message.fileDiffs}>
            {(diff) => (
              <span style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "4px",
                "font-family": "var(--cortex-font-mono)",
                "font-size": "var(--cortex-text-xs)",
                background: "var(--cortex-vibe-hover-bg)",
                padding: "2px 4px",
                "border-radius": "var(--cortex-radius-xs)",
                color: "var(--cortex-vibe-code-highlight)",
              }}>
                {diff.path}
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
        <button
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "8px 12px",
            background: "var(--cortex-vibe-tool-bg)",
            "border-radius": "var(--cortex-radius-md)",
            "margin-top": "8px",
            "font-family": "var(--cortex-font-sans)",
            "font-size": "var(--cortex-text-xs)",
            color: "var(--cortex-text-secondary)",
            cursor: "pointer",
            border: "none",
            width: "100%",
            "text-align": "left",
          }}
          onClick={() => setToolsExpanded(v => !v)}
        >
          <span>{toolsExpanded() ? "▾" : "▸"}</span>
          <span>{props.message.toolCalls!.length} tool calls, {completedCount()} completed</span>
        </button>
        <Show when={toolsExpanded()}>
          <For each={props.message.toolCalls}>
            {(tc) => (
              <div style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                padding: "4px 12px 4px 24px",
                "font-family": "var(--cortex-font-mono)",
                "font-size": "11px",
                color: "var(--cortex-text-secondary)",
              }}>
                <CortexIcon
                  name={tc.status === "completed" ? "check" : tc.status === "error" ? "x-close" : "refresh"}
                  size={12}
                  color={statusColor(tc.status)}
                />
                <span>{tc.name}</span>
              </div>
            )}
          </For>
        </Show>
      </Show>

      <Show when={props.message.timestamp}>
        <div style={{
          "font-family": "var(--cortex-font-sans)",
          "font-size": "11px",
          color: "var(--cortex-vibe-text-dim)",
          "margin-top": "6px",
        }}>
          {props.message.timestamp!.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </Show>
    </div>
  );
};
