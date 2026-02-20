/**
 * CortexConversationView - Chat conversation view for Vibe mode
 * Figma: Left column inside right panel (738px), tab bar, messages, reasoning sections, inline code, prompt input
 * Wired to SDKContext messages for real streaming
 */

import { Component, For, Show, createSignal, createEffect, JSX } from "solid-js";
import { CortexPromptInput } from "./primitives/CortexInput";
import { VibeTabBar, type VibeTab } from "./vibe/VibeTabBar";
import { MessageBubble, type MessageData, type ToolCall } from "./vibe/MessageBubble";

export type { ToolCall } from "./vibe/MessageBubble";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolCalls?: ToolCall[];
  isError?: boolean;
  codeBlocks?: { language: string; code: string }[];
  reasoning?: string;
  fileDiffs?: { path: string; additions: number; deletions: number }[];
}

export interface CortexConversationViewProps {
  conversationTitle?: string;
  branchName?: string;
  status?: "in_progress" | "ready_to_merge" | "merged" | "error";
  messages: Message[];
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  modelName?: string;
  onModelClick?: () => void;
  onMerge?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

const TABS: VibeTab[] = [
  { id: "all_changes", label: "All Changes", icon: "clock" },
  { id: "current_task", label: "Current task", icon: "file" },
  { id: "review", label: "Review", icon: "file" },
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  in_progress: { bg: "var(--cortex-vibe-status-running-bg)", color: "var(--cortex-vibe-status-running)" },
  ready_to_merge: { bg: "var(--cortex-vibe-status-completed-bg)", color: "var(--cortex-vibe-status-completed)" },
  merged: { bg: "var(--cortex-vibe-status-merged-bg)", color: "var(--cortex-vibe-status-merged)" },
  error: { bg: "var(--cortex-vibe-status-error-bg)", color: "var(--cortex-vibe-status-error)" },
};

const STATUS_TEXT: Record<string, string> = {
  in_progress: "In Progress",
  ready_to_merge: "Ready to merge",
  merged: "Merged",
  error: "Error",
};

function toMessageData(msg: Message): MessageData {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    toolCalls: msg.toolCalls,
    isError: msg.isError,
    reasoning: msg.reasoning,
    fileDiffs: msg.fileDiffs,
  };
}

export const CortexConversationView: Component<CortexConversationViewProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal(props.activeTab ?? "all_changes");
  let messagesRef: HTMLDivElement | undefined;

  createEffect(() => {
    const len = props.messages.length;
    if (len > 0 && messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    props.onTabChange?.(tab);
  };

  const isLastAssistantStreaming = (index: number): boolean => {
    if (!props.isProcessing) return false;
    return index === props.messages.length - 1 && props.messages[index].role === "assistant";
  };

  const statusStyle = (): JSX.CSSProperties | undefined => {
    if (!props.status) return undefined;
    const s = STATUS_STYLES[props.status] ?? STATUS_STYLES.in_progress;
    return {
      "font-family": "var(--cortex-font-sans)",
      "font-size": "var(--cortex-text-xs)",
      "font-weight": "var(--cortex-font-medium)",
      padding: "4px 6px",
      "border-radius": "var(--cortex-radius-xs)",
      background: s.bg,
      color: s.color,
    };
  };

  const trailing = (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <Show when={props.status}>
        <span style={statusStyle()}>{STATUS_TEXT[props.status!] ?? "In Progress"}</span>
      </Show>
    </div>
  );

  return (
    <div class={props.class} style={{
      width: "738px",
      "flex-shrink": "0",
      display: "flex",
      "flex-direction": "column",
      "justify-content": "space-between",
      "border-right": "1px solid var(--cortex-border-default)",
      overflow: "hidden",
      "min-width": "0",
      gap: "24px",
      ...props.style,
    }}>
      {/* Tab Bar */}
      <VibeTabBar
        tabs={TABS}
        activeId={activeTab()}
        onTabChange={handleTabChange}
        trailing={trailing}
      />

      {/* User task bubble */}
      <Show when={props.messages.length > 0 && props.messages[0].role === "user"}>
        <div style={{
          padding: "12px",
          margin: "12px 120px",
          background: "var(--cortex-bg-primary)",
          "border-radius": "9px",
          "font-family": "var(--cortex-font-sans)",
          "font-size": "var(--cortex-text-sm)",
          "font-weight": "var(--cortex-font-medium)",
          "line-height": "1.43",
          color: "var(--cortex-text-on-surface)",
        }}>
          {props.messages[0].content}
        </div>
      </Show>

      {/* Messages */}
      <div ref={messagesRef} style={{
        flex: "1",
        "overflow-y": "auto",
        padding: "0 120px 24px",
        display: "flex",
        "flex-direction": "column",
        gap: "10px",
      }}>
        <For each={props.messages}>
          {(message, i) => {
            if (i() === 0 && message.role === "user") return null;
            return (
              <MessageBubble
                message={toMessageData(message)}
                isStreaming={isLastAssistantStreaming(i())}
              />
            );
          }}
        </For>
      </div>

      {/* Prompt Input */}
      <div style={{ padding: "12px", "flex-shrink": "0" }}>
        <div style={{
          background: "var(--cortex-border-default)",
          "border-radius": "var(--cortex-radius-xl)",
          padding: "16px",
          border: "1px solid var(--cortex-border-default)",
          display: "flex",
          "flex-direction": "column",
          gap: "32px",
        }}>
          <CortexPromptInput
            value={props.inputValue}
            placeholder="Send a prompt or run a command..."
            onChange={props.onInputChange}
            onSubmit={props.onSubmit}
            onStop={props.onStop}
            isProcessing={props.isProcessing}
            modelName={props.modelName ?? "claude-opus-4.5"}
            onModelClick={props.onModelClick}
          />
        </div>
      </div>
    </div>
  );
};

export default CortexConversationView;
