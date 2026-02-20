/**
 * CortexChatMessageBubble - Pixel-perfect chat message rendering
 *
 * Figma: 166:2184 → AI Terminal component
 * - User messages: bg rgba(255,255,255,0.05), padding 12px, border-radius 12px
 * - Agent messages: transparent bg, column layout with tool calls + code blocks
 * - Tool calls: "Edited N files... Review" + "Undo Changes" in var(--cortex-action-destructive)
 * - Thinking: collapsible with star icon
 * - Code blocks: Shiki syntax highlighting
 */

import { Component, JSX, Show, For, createSignal, createResource } from "solid-js";
import { CortexIcon } from "./primitives";
import type { ChatMessage } from "./CortexChatPanel";

export interface ChatMessageBubbleProps {
  message: ChatMessage;
}

const FONT = "var(--cortex-font-sans, 'Figtree', sans-serif)";
const FONT_MONO = "var(--cortex-font-mono, 'Source Code Pro', 'JetBrains Mono', monospace)";

/* ---------- Container styles per role ---------- */
const containerStyle = (isUser: boolean): JSX.CSSProperties => ({
  display: "flex",
  "flex-direction": "column",
  gap: isUser ? "0" : "4px",
  padding: "12px",
  background: isUser ? "var(--cortex-chat-user-msg-bg)" : "transparent",
  "border-radius": isUser ? "var(--cortex-sidebar-radius, 12px)" : "0",
});

/* ---------- Content text ---------- */
const contentStyle = (_isUser: boolean): JSX.CSSProperties => ({
  "font-family": FONT,
  "font-size": "14px",
  "font-weight": "400",
  color: "var(--cortex-text-primary)",
  "line-height": "1.43em",
  "white-space": "pre-wrap",
  "word-break": "break-word",
});

/* ---------- Thinking indicator ---------- */
const thinkingStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  color: "var(--cortex-text-inactive)",
  "font-family": FONT,
  "font-size": "14px",
  "font-weight": "400",
  "line-height": "1.43em",
  cursor: "pointer",
  background: "transparent",
  border: "none",
  padding: "4px 0",
};

/* ---------- Progress items ---------- */
const progressContainerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
  padding: "0 4px",
};

const getProgressItemStyle = (status: string): JSX.CSSProperties => ({
  display: "flex",
  "align-items": "center",
  gap: "8px",
  "font-family": FONT,
  "font-size": "12px",
  "font-weight": "400",
  "line-height": "1.2em",
  color:
    status === "completed"
      ? "var(--cortex-success)"
      : status === "error"
      ? "var(--cortex-error)"
      : "var(--cortex-text-inactive)",
});

const getProgressIconName = (status: string): string =>
  status === "completed" ? "check" : status === "error" ? "alert" : "star";

/* ---------- Tool call styles ---------- */
const toolCallContainerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
  padding: "0 4px",
};

const toolCallRowStyle: JSX.CSSProperties = {
  display: "flex",
  "justify-content": "space-between",
  "align-items": "center",
  gap: "4px",
};

const toolCallLabelStyle: JSX.CSSProperties = {
  "font-family": FONT,
  "font-size": "12px",
  "font-weight": "400",
  "line-height": "1.2em",
  color: "var(--cortex-text-inactive)",
};

const undoButtonStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "0",
  "font-family": FONT,
  "font-size": "12px",
  "font-weight": "400",
  "line-height": "1.2em",
  color: "var(--cortex-action-destructive)",
};

/* ---------- Actions ---------- */
const actionsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "16px",
  "margin-top": "8px",
};

const actionLinkStyle: JSX.CSSProperties = {
  "font-family": FONT,
  "font-size": "12px",
  color: "var(--cortex-accent-primary)",
  cursor: "pointer",
  display: "flex",
  "align-items": "center",
  gap: "4px",
  background: "transparent",
  border: "none",
  padding: "0",
};

/* ---------- Code block styles ---------- */
const codeBlockWrapperStyle: JSX.CSSProperties = {
  position: "relative",
  background: "var(--cortex-bg-secondary)",
  "border-radius": "var(--cortex-radius-md, 8px)",
  "margin-top": "8px",
  overflow: "hidden",
};

const codeBlockHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  height: "28px",
  padding: "0 12px",
  background: "var(--cortex-chat-code-header-bg)",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

const codeBlockLangStyle: JSX.CSSProperties = {
  "font-family": FONT_MONO,
  "font-size": "11px",
  color: "var(--cortex-text-inactive)",
  "text-transform": "lowercase",
};

const codeBlockBodyStyle: JSX.CSSProperties = {
  padding: "12px",
  "overflow-x": "auto",
  "font-family": FONT_MONO,
  "font-size": "12px",
  "line-height": "1.5",
};

const fallbackCodeStyle: JSX.CSSProperties = {
  margin: "0",
  color: "var(--cortex-text-primary)",
  "white-space": "pre",
};

/* ---------- Code block component with Shiki ---------- */
function HighlightedCodeBlock(props: { code: string; language: string }) {
  const [copied, setCopied] = createSignal(false);

  const [highlighted] = createResource(
    () => ({ code: props.code, lang: props.language }),
    async ({ code, lang }) => {
      try {
        const { highlightCode, normalizeLanguage } = await import("@/utils/shikiHighlighter");
        return await highlightCode(code, normalizeLanguage(lang));
      } catch {
        return "";
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

  return (
    <div style={codeBlockWrapperStyle}>
      <div style={codeBlockHeaderStyle}>
        <span style={codeBlockLangStyle}>{props.language || "code"}</span>
        <button
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: copied() ? "var(--cortex-success)" : "var(--cortex-text-inactive)",
            padding: "2px",
          }}
          onClick={handleCopy}
          title={copied() ? "Copied!" : "Copy code"}
        >
          <CortexIcon name={copied() ? "check" : "copy"} size={14} />
        </button>
      </div>
      <div style={codeBlockBodyStyle}>
        <Show
          when={!highlighted.loading && highlighted()}
          fallback={<pre style={fallbackCodeStyle}><code>{props.code}</code></pre>}
        >
          <div innerHTML={highlighted()!} />
        </Show>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */
export const ChatMessageBubble: Component<ChatMessageBubbleProps> = (props) => {
  const isUser = () => props.message.type === "user";
  const [thinkingExpanded, setThinkingExpanded] = createSignal(false);

  return (
    <div style={containerStyle(isUser())}>
      {/* Thinking indicator (collapsible) */}
      <Show when={props.message.isThinking}>
        <button
          style={thinkingStyle}
          onClick={() => setThinkingExpanded((v) => !v)}
        >
          <CortexIcon name="star" size={16} color="var(--cortex-accent-primary)" />
          <span>{thinkingExpanded() ? "▾ Thinking..." : "▸ Thinking..."}</span>
        </button>
      </Show>

      {/* Message content */}
      <Show when={props.message.content}>
        <p style={{ ...contentStyle(isUser()), margin: "0" }}>{props.message.content}</p>
      </Show>

      {/* Progress items */}
      <Show when={props.message.progress && props.message.progress!.length > 0}>
        <div style={progressContainerStyle}>
          <For each={props.message.progress}>
            {(item) => (
              <div style={getProgressItemStyle(item.status)}>
                <CortexIcon name={getProgressIconName(item.status)} size={14} />
                <span>{item.label}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Tool calls */}
      <Show when={props.message.toolCalls && props.message.toolCalls!.length > 0}>
        <div style={toolCallContainerStyle}>
          <For each={props.message.toolCalls}>
            {(tc) => (
              <div style={toolCallRowStyle}>
                <span style={toolCallLabelStyle}>
                  <Show when={tc.status === "completed"}>
                    <CortexIcon name="check" size={12} color="var(--cortex-success)" />
                  </Show>
                  <Show when={tc.status === "running"}>
                    <CortexIcon name="refresh" size={12} color="var(--cortex-text-inactive)" />
                  </Show>
                  <Show when={tc.status === "error"}>
                    <CortexIcon name="alert" size={12} color="var(--cortex-error)" />
                  </Show>
                  {" "}{tc.filesEdited ? `Edited ${tc.filesEdited} files... ` : ""}{tc.name}
                </span>
                <Show when={tc.onUndo}>
                  <button style={undoButtonStyle} onClick={tc.onUndo}>
                    <CortexIcon name="corner-up-left" size={12} color="var(--cortex-action-destructive)" />
                    Undo Changes
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Code blocks */}
      <Show when={props.message.codeBlocks && props.message.codeBlocks!.length > 0}>
        <For each={props.message.codeBlocks}>
          {(block) => <HighlightedCodeBlock code={block.code} language={block.language} />}
        </For>
      </Show>

      {/* Action buttons */}
      <Show when={props.message.actions && props.message.actions!.length > 0}>
        <div style={actionsStyle}>
          <For each={props.message.actions}>
            {(action) => (
              <button style={actionLinkStyle} onClick={action.onClick}>
                <Show when={action.icon}>
                  <CortexIcon name={action.icon!} size={12} />
                </Show>
                {action.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
