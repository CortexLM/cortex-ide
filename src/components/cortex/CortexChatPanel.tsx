/**
 * CortexChatPanel - Pixel-perfect chat panel matching Figma design
 *
 * 3 States:
 * 1. Home (Full Screen) - Centered logo + title + prompt input + import buttons
 * 2. Minimized (Overlay) - 369×297px positioned bottom-left
 * 3. Expanded (Agent Working) - Full conversation with progress indicators
 *
 * Figma refs: 166:2183 (Main Screen / Home), 166:2184 (AI terminal flow / Expanded)
 */

import { Component, JSX, splitProps, Show, For } from "solid-js";
import { CortexPromptInput, CortexButton } from "./primitives";
import { ChatMessageBubble } from "./CortexChatMessageBubble";

export type ChatPanelState = "home" | "minimized" | "expanded";

export interface ChatMessage {
  id: string;
  type: "user" | "agent";
  content: string;
  timestamp?: Date;
  actions?: ChatAction[];
  isThinking?: boolean;
  progress?: ChatProgress[];
  toolCalls?: ChatToolCall[];
  codeBlocks?: { language: string; code: string }[];
}

export interface ChatAction {
  id: string;
  label: string;
  icon?: string;
  onClick?: () => void;
}

export interface ChatProgress {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface ChatToolCall {
  name: string;
  status: "running" | "completed" | "error";
  filesEdited?: number;
  onUndo?: () => void;
  onReview?: () => void;
}

export interface CortexChatPanelProps {
  state?: ChatPanelState;
  messages?: ChatMessage[];
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  modelName?: string;
  modelIcon?: string;
  onModelClick?: () => void;
  onPlusClick?: () => void;
  onUploadClick?: () => void;
  onBuildClick?: () => void;
  onImportCodeClick?: () => void;
  onImportDesignClick?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

type InputProps = Omit<
  CortexChatPanelProps,
  "state" | "messages" | "onBuildClick" | "onImportCodeClick" | "onImportDesignClick" | "class" | "style"
>;

const PromptInputBlock: Component<InputProps & { style?: JSX.CSSProperties }> = (props) => (
  <CortexPromptInput
    value={props.inputValue}
    placeholder="Send a prompt or run a command..."
    onChange={props.onInputChange}
    onSubmit={props.onSubmit}
    onStop={props.onStop}
    isProcessing={props.isProcessing}
    modelName={props.modelName}
    modelIcon={props.modelIcon}
    onModelClick={props.onModelClick}
    onPlusClick={props.onPlusClick}
    onUploadClick={props.onUploadClick}
    style={props.style}
  />
);

const AnimatedLogo: Component<{ size?: number }> = (props) => (
  <img
    src="/assets/claude-logo.svg"
    alt="Claude"
    style={{ width: `${props.size || 120}px`, height: `${props.size || 120}px` }}
  />
);

const FONT = "var(--cortex-font-sans, 'Figtree', sans-serif)";
const ICON_16: JSX.CSSProperties = { width: "16px", height: "16px" };

export const CortexChatPanel: Component<CortexChatPanelProps> = (props) => {
  const [local] = splitProps(props, [
    "state", "messages", "inputValue", "onInputChange", "onSubmit", "onStop",
    "isProcessing", "modelName", "modelIcon", "onModelClick", "onPlusClick",
    "onUploadClick", "onBuildClick", "onImportCodeClick", "onImportDesignClick",
    "class", "style",
  ]);
  const state = () => local.state || "home";

  return (
    <Show
      when={state() === "home"}
      fallback={
        <Show when={state() === "minimized"} fallback={<ExpandedChat {...local} />}>
          <MinimizedChat {...local} />
        </Show>
      }
    >
      <HomeChat {...local} />
    </Show>
  );
};

/* ============================================================================
   HOME STATE - Full screen, centered content
   Figma: 166:2183 → Main Screen → Frame 2147230361
   Layout: column, center-aligned, 802px content width
   ============================================================================ */
const HomeChat: Component<Omit<CortexChatPanelProps, "state" | "messages">> = (props) => (
  <div class={props.class} style={{
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    width: "100%",
    height: "100%",
    background: "var(--cortex-bg-primary)",
    gap: "24px",
    padding: "48px",
    position: "relative",
    overflow: "hidden",
    ...props.style,
  }}>
    <AnimatedLogo size={120} />

    {/* Title Container: Figma layout_BJ5RLN - column, center, gap 8px */}
    <div style={{
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      gap: "8px",
    }}>
      {/* Title: Figtree 56px weight 500, lineHeight 1.14em */}
      <h1 style={{
        "font-family": FONT,
        "font-size": "56px",
        "font-weight": "500",
        color: "var(--cortex-text-primary)",
        "text-align": "center",
        "line-height": "1.14em",
        "letter-spacing": "0px",
        margin: "0",
      }}>What would you like to build</h1>

      {/* Subtitle: Figtree 20px weight 500, lineHeight 1.2em */}
      <p style={{
        "font-family": FONT,
        "font-size": "20px",
        "font-weight": "500",
        color: "var(--cortex-text-secondary)",
        "text-align": "center",
        "line-height": "1.2em",
        margin: "0",
      }}>Start a conversation or open a project</p>
    </div>

    {/* Prompt + Import Options: Figma layout_NRGR04 - column, gap 12px */}
    <div style={{
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
    }}>
      <PromptInputBlock {...props} />

      {/* Import Options: Figma layout_L2GHFF - row, justify end, gap 16px, padding 0 16px, width 802px */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "flex-end",
        gap: "16px",
        padding: "0 16px",
        width: "802px",
        "max-width": "100%",
      }}>
        <CortexButton variant="secondary" size="xs" onClick={props.onImportDesignClick}>
          <img src="/assets/palette.svg" alt="" style={ICON_16} />
          Import Design
        </CortexButton>
        <CortexButton variant="secondary" size="xs" onClick={props.onImportCodeClick}>
          <img src="/assets/code.svg" alt="" style={ICON_16} />
          Import Code
        </CortexButton>
        <CortexButton variant="secondary" size="xs" onClick={props.onBuildClick}>
          <img src="/assets/brackets-square.svg" alt="" style={ICON_16} />
          Build
        </CortexButton>
      </div>
    </div>
  </div>
);

/* ============================================================================
   MINIMIZED STATE - 369×297px overlay, bottom-left
   Figma: AI terminal / no requests → sidebar panel
   ============================================================================ */
const MinimizedChat: Component<Omit<CortexChatPanelProps, "state">> = (props) => (
  <div class={props.class} style={{
    position: "absolute",
    left: "8px",
    bottom: "36px",
    width: "369px",
    height: "297px",
    background: "var(--cortex-small-btn-bg)",
    "border-radius": "16px",
    border: "1px solid var(--cortex-border-subtle)",
    display: "flex",
    "flex-direction": "column",
    padding: "12px",
    gap: "16px",
    "box-shadow": "var(--cortex-panel-shadow)",
    transition: "box-shadow 200ms ease-out, opacity 200ms ease-out",
    ...props.style,
  }}>
    {/* Title area */}
    <div style={{
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      padding: "8px",
    }}>
      <h2 style={{
        "font-family": FONT,
        "font-size": "20px",
        "font-weight": "500",
        color: "var(--cortex-text-primary)",
        "line-height": "1em",
        margin: "0",
      }}>What would you like to build?</h2>
      <p style={{
        "font-family": FONT,
        "font-size": "16px",
        "font-weight": "500",
        color: "var(--cortex-text-secondary)",
        "line-height": "1em",
        margin: "0",
      }}>Start a conversation or open a project</p>
    </div>

    <div style={{ flex: "1" }} />

    <PromptInputBlock {...props} style={{ width: "100%" }} />
  </div>
);

/* ============================================================================
   EXPANDED STATE - Full conversation with messages + prompt
   Figma: 166:2184 → AI terminal history → AI Terminal component
   Chat messages in scrollable area, prompt at bottom
   ============================================================================ */
const ExpandedChat: Component<Omit<CortexChatPanelProps, "state">> = (props) => (
  <div class={props.class} style={{
    position: "absolute",
    left: "8px",
    bottom: "36px",
    width: "369px",
    "max-height": "calc(100vh - 120px)",
    background: "var(--cortex-small-btn-bg)",
    "border-radius": "16px",
    border: "1px solid var(--cortex-border-subtle)",
    display: "flex",
    "flex-direction": "column",
    padding: "0 8px 8px 8px",
    gap: "0",
    "box-shadow": "var(--cortex-panel-shadow)",
    transition: "box-shadow 200ms ease-out, opacity 200ms ease-out",
    overflow: "hidden",
    ...props.style,
  }}>
    {/* Scrollable message area: Figma layout_77BZNU - column, gap 16px, padding 0 8px */}
    <div style={{
      flex: "1",
      "overflow-y": "auto",
      display: "flex",
      "flex-direction": "column",
      gap: "16px",
      padding: "8px 0",
    }}>
      <For each={props.messages || []}>
        {(message) => <ChatMessageBubble message={message} />}
      </For>
    </div>

    {/* Prompt input area: Figma layout_IFH6L8 - column, gap 10px, padding 8px */}
    <div style={{
      padding: "8px",
      background: "var(--cortex-border-default)",
      border: "1px solid var(--cortex-border-accent)",
      "border-radius": "16px",
    }}>
      <PromptInputBlock {...props} style={{ width: "100%" }} />
    </div>
  </div>
);

export default CortexChatPanel;
