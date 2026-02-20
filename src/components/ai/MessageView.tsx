import { Show, For, createSignal, createMemo, JSX } from "solid-js";
import { Icon } from "../ui/Icon";
import { Message, ToolCall } from "@/context/SDKContext";
import { Markdown } from "../Markdown";
import { Card, Text, Badge, IconButton } from "@/components/ui";


// ============================================================================
// New Color Palette
// ============================================================================
const palette = {
  canvas: "var(--cortex-bg-hover)",
  panel: "var(--cortex-bg-active)",
  inputCard: "var(--cortex-bg-active)",
  border: "rgba(107, 114, 142, 0.4)",
  borderSubtle: "rgba(107, 114, 142, 0.3)",
  textTitle: "var(--cortex-text-primary)",
  textBody: "var(--cortex-text-primary)",
  textMuted: "var(--cortex-text-inactive)",
  accent: "var(--cortex-text-inactive)",
  outputBg: "var(--cortex-bg-hover)",
  outputText: "var(--cortex-text-secondary)",
};

// ============================================================================
// NeonGridLoader Component - 3x3 Neon Grid with Snake Animation
// ============================================================================
function getSnakeDelay(index: number): number {
  const snakeOrder = [0, 1, 2, 5, 4, 3, 6, 7, 8];
  return snakeOrder.indexOf(index) * 100;
}

function NeonGridLoader() {
  const neonColor = "var(--cortex-info)";
  const glowColor = "rgba(0, 217, 255, 0.6)";
  
  return (
    <div style={{
      display: "grid",
      "grid-template-columns": "repeat(3, 1fr)",
      gap: "4px",
      width: "36px",
      height: "36px",
    }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          style={{
            width: "10px",
            height: "10px",
            "border-radius": "var(--cortex-radius-sm)",
            background: neonColor,
            opacity: "0.3",
            "box-shadow": `0 0 8px ${glowColor}, 0 0 12px ${glowColor}`,
            animation: `neonPulse 1.2s ease-in-out infinite`,
            "animation-delay": `${getSnakeDelay(i)}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes neonPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); box-shadow: 0 0 12px ${glowColor}, 0 0 20px ${glowColor}, 0 0 30px ${glowColor}; }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface MessageViewProps {
  message: Message;
  isStreaming?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}

function getTextContent(message: Message): string {
  return message.parts
    .filter((p): p is { type: "text"; content: string } => p.type === "text")
    .map((p) => p.content)
    .join("\n");
}

// User message style
const userMessageStyle: JSX.CSSProperties = {
  background: palette.inputCard,
  "border-radius": "var(--cortex-radius-lg)",
  padding: "12px 16px",
  color: palette.textBody,
  "max-width": "80%",
  "align-self": "flex-end",
};

// Assistant message style
const assistantMessageStyle: JSX.CSSProperties = {
  background: "transparent",
  "border-left": `2px solid ${palette.border}`,
  "padding-left": "16px",
  color: palette.textBody,
};

// Content style
const contentStyle: JSX.CSSProperties = {
  "font-size": "14px",
  "line-height": "1.6",
  color: palette.textBody,
};

// ============================================================================
// MessageView Component
// ============================================================================

export function MessageView(props: MessageViewProps) {
  const isUser = () => props.message.role === "user";
  const isAssistant = () => props.message.role === "assistant";
  const isSystem = () => props.message.role === "system";
  
  const textContent = createMemo(() => getTextContent(props.message));
  const toolCalls = createMemo(() =>
    props.message.parts.filter(
      (p): p is { type: "tool"; tool: ToolCall } => p.type === "tool"
    )
  );

  const avatarStyle: JSX.CSSProperties = {
    width: "24px",
    height: "24px",
    "border-radius": "var(--cortex-radius-full)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "flex-shrink": "0",
  };

  return (
    <div
      style={{ 
        display: "flex",
        gap: "12px",
        padding: "12px 20px",
        "padding-right": "24px",
      }}
    >
      {/* Avatar - 24px standard */}
      <Show when={isAssistant()}>
        <div 
          style={{
            ...avatarStyle,
            background: palette.accent,
            outline: `1px solid ${palette.border}`,
          }}
        >
          <Icon name="microchip" style={{ width: "14px", height: "14px", color: palette.canvas }} />
        </div>
      </Show>
      <Show when={isUser()}>
        <div 
          style={{
            ...avatarStyle,
            background: "transparent",
            outline: `1px solid ${palette.border}`,
          }}
        >
          <Icon name="user" style={{ width: "14px", height: "14px", color: palette.textMuted }} />
        </div>
      </Show>
      <Show when={isSystem()}>
        <div 
          style={{
            ...avatarStyle,
            background: "rgba(53, 116, 240, 0.2)",
            outline: `1px solid ${palette.border}`,
          }}
        >
          <Icon name="circle-info" style={{ width: "14px", height: "14px", color: palette.textTitle }} />
        </div>
      </Show>

      <div style={{ flex: "1", "min-width": "0" }}>
        {/* Header with role name and timestamp */}
        <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "8px" }}>
          <Text
            variant="body"
            weight="semibold"
            style={{ 
              color: isUser() ? palette.textTitle : palette.accent,
            }}
          >
            {isUser() ? "You" : isAssistant() ? "Cortex" : "System"}
          </Text>
          <Text variant="muted" style={{ color: palette.textMuted }}>
            {formatTime(props.message.timestamp)}
          </Text>
          <Show when={props.message.metadata?.inputTokens}>
            <Badge variant="default" size="sm">
              {props.message.metadata!.inputTokens} + {props.message.metadata!.outputTokens} tokens
            </Badge>
          </Show>
        </div>

        {/* Reasoning/Thinking section (for assistant) */}
        <Show when={props.message.reasoning}>
          <ReasoningSection reasoning={props.message.reasoning!} />
        </Show>

        {/* Content with markdown rendering */}
        <Show when={textContent()}>
          <div style={isUser() ? userMessageStyle : { ...assistantMessageStyle, ...contentStyle }}>
            <Markdown content={textContent()} />
            
            {/* Streaming cursor */}
            <Show when={props.isStreaming}>
              <span style={{
                display: "inline-block",
                width: "2px",
                height: "16px",
                background: palette.accent,
                animation: "blink 1s infinite",
                "margin-left": "2px",
                "vertical-align": "text-bottom",
              }} />
            </Show>
          </div>
        </Show>

        {/* Show NeonGridLoader when streaming with no content yet */}
        <Show when={props.isStreaming && !textContent()}>
          <div style={{ display: "flex", "align-items": "center", gap: "12px", padding: "8px 0" }}>
            <NeonGridLoader />
            <span style={{ color: palette.textMuted, "font-size": "13px" }}>Thinking...</span>
          </div>
        </Show>

        {/* Tool calls */}
        <Show when={toolCalls().length > 0}>
          <div style={{ "margin-top": "12px", display: "flex", "flex-direction": "column", gap: "8px" }}>
            <For each={toolCalls()}>
              {(part) => <ToolCallView tool={part.tool} />}
            </For>
          </div>
        </Show>

        {/* Message actions */}
        <MessageActions message={props.message} />
      </div>
    </div>
  );
}

// ============================================================================
// ReasoningSection Component
// ============================================================================

interface ReasoningSectionProps {
  reasoning: string;
}

function ReasoningSection(props: ReasoningSectionProps) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <Card 
      variant="outlined" 
      padding="none"
      style={{ overflow: "hidden", "margin-bottom": "12px", background: palette.panel, "border-color": palette.borderSubtle }}
    >
      <IconButton
        onClick={() => setExpanded(!expanded())}
        style={{
          width: "100%",
          height: "auto",
          padding: "8px 12px",
          display: "flex",
          "align-items": "center",
          gap: "8px",
          "justify-content": "flex-start",
          "border-radius": "0",
        }}
      >
        <Show when={expanded()} fallback={<Icon name="chevron-right" style={{ width: "16px", height: "16px", color: palette.textMuted }} />}>
          <Icon name="chevron-down" style={{ width: "16px", height: "16px", color: palette.textMuted }} />
        </Show>
        <Text variant="muted" style={{ color: palette.textMuted }}>Thinking...</Text>
      </IconButton>
      <Show when={expanded()}>
        <div 
          style={{
            padding: "8px 12px",
            "border-top": `1px solid ${palette.borderSubtle}`,
            "font-size": "12px",
            color: palette.textMuted,
            "font-style": "italic",
            "white-space": "pre-wrap",
          }}
        >
          {props.reasoning}
        </div>
      </Show>
    </Card>
  );
}

// ============================================================================
// ToolCallView Component
// ============================================================================

interface ToolCallViewProps {
  tool: ToolCall;
}

// Tool status styles
const statusStyles = {
  running: { color: "var(--cortex-text-inactive)" },
  completed: { color: "var(--cortex-success)" },
  error: { color: "var(--cortex-error)" },
};

// Tool output style
const outputStyle: JSX.CSSProperties = {
  background: palette.outputBg,
  "border-radius": "var(--cortex-radius-md)",
  padding: "8px 12px",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  color: palette.outputText,
  "margin-top": "8px",
  "max-height": "200px",
  overflow: "auto",
};

function ToolCallView(props: ToolCallViewProps) {
  const [expanded, setExpanded] = createSignal(true);

  const getIconName = () => {
    const name = props.tool.name.toLowerCase();
    if (name.includes("exec") || name.includes("bash") || name.includes("shell") || name.includes("execute")) {
      return "terminal";
    }
    if (name.includes("read") || name.includes("write") || name.includes("file") || name.includes("create") || name.includes("edit")) {
      return "file";
    }
    return "code";
  };

  const getStatusBorderColor = (): string => {
    switch (props.tool.status) {
      case "running": return statusStyles.running.color;
      case "completed": return statusStyles.completed.color;
      case "error": return statusStyles.error.color;
      default: return palette.border;
    }
  };

  const getStatusBadgeVariant = (): "default" | "warning" | "success" | "error" => {
    switch (props.tool.status) {
      case "running": return "warning";
      case "completed": return "success";
      case "error": return "error";
      default: return "default";
    }
  };

  return (
    <Card 
      variant="outlined"
      padding="none"
      style={{
        overflow: "hidden",
        "border-color": getStatusBorderColor(),
        background: palette.panel,
      }}
    >
      <IconButton
        onClick={() => setExpanded(!expanded())}
        style={{
          width: "100%",
          height: "auto",
          padding: "8px 12px",
          display: "flex",
          "align-items": "center",
          gap: "12px",
          "justify-content": "flex-start",
          "border-radius": "0",
        }}
      >
        <Icon name={getIconName()} style={{ width: "16px", height: "16px", "flex-shrink": "0", color: palette.accent }} />
        <Text 
          variant="body" 
          weight="medium"
          truncate
          style={{ 
            flex: "1",
            "font-family": "var(--jb-font-mono)",
            "text-align": "left",
            color: palette.textBody,
          }}
        >
          {props.tool.name}
        </Text>

        <Show when={props.tool.status === "running"}>
          <Icon name="spinner" style={{ width: "16px", height: "16px", color: statusStyles.running.color, animation: "spin 1s linear infinite" }} />
        </Show>
        <Show when={props.tool.status === "completed"}>
          <Icon name="check" style={{ width: "16px", height: "16px", color: statusStyles.completed.color }} />
        </Show>
        <Show when={props.tool.status === "error"}>
          <Icon name="xmark" style={{ width: "16px", height: "16px", color: statusStyles.error.color }} />
        </Show>

        <Show when={props.tool.durationMs}>
          <Badge variant={getStatusBadgeVariant()} size="sm">
            {props.tool.durationMs! < 1000
              ? `${props.tool.durationMs}ms`
              : `${(props.tool.durationMs! / 1000).toFixed(1)}s`}
          </Badge>
        </Show>

        <Show when={expanded()} fallback={<Icon name="chevron-right" style={{ width: "16px", height: "16px", color: palette.textMuted }} />}>
          <Icon name="chevron-down" style={{ width: "16px", height: "16px", color: palette.textMuted }} />
        </Show>
      </IconButton>

      <Show when={expanded()}>
        <div style={{ "border-top": `1px solid ${palette.borderSubtle}` }}>
          {/* Input */}
          <Show when={Object.keys(props.tool.input).length > 0}>
            <div style={{ padding: "8px 12px", "border-bottom": `1px solid ${palette.borderSubtle}` }}>
              <Text variant="muted" size="xs" style={{ "margin-bottom": "4px", display: "block", color: palette.textMuted }}>Input</Text>
              <pre style={{ 
                "font-family": "var(--jb-font-mono)",
                "font-size": "12px",
                "overflow-x": "auto",
                "max-height": "128px",
                "overflow-y": "auto",
                color: palette.textMuted,
                margin: "0",
              }}>
                {formatToolInput(props.tool.input)}
              </pre>
            </div>
          </Show>

          {/* Output */}
          <Show when={props.tool.output}>
            <div style={{ padding: "8px 12px" }}>
              <Text variant="muted" size="xs" style={{ "margin-bottom": "4px", display: "block", color: palette.textMuted }}>Output</Text>
              <pre style={outputStyle}>
                {props.tool.output}
              </pre>
            </div>
          </Show>
        </div>
      </Show>
    </Card>
  );
}

function formatToolInput(input: Record<string, unknown>): string {
  // For common tools, show a cleaner format
  if (input.command) {
    return String(input.command);
  }
  if (input.file_path && input.content) {
    const content = String(input.content);
    return `${input.file_path}\n---\n${content.slice(0, 500)}${content.length > 500 ? "..." : ""}`;
  }
  if (input.file_path) {
    return String(input.file_path);
  }
  if (input.pattern) {
    return `pattern: ${input.pattern}${input.path ? ` in ${input.path}` : ""}`;
  }
  return JSON.stringify(input, null, 2);
}

// ============================================================================
// MessageActions Component
// ============================================================================

interface MessageActionsProps {
  message: Message;
}

function MessageActions(props: MessageActionsProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    const content = getTextContent(props.message);
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const textContent = createMemo(() => getTextContent(props.message));

  return (
    <Show when={textContent()}>
      <div style={{ "margin-top": "8px" }}>
        <IconButton
          onClick={handleCopy}
          size="sm"
          tooltip={copied() ? "Copied!" : "Copy message"}
          style={{
            color: copied() ? statusStyles.completed.color : palette.textMuted,
          }}
        >
          <Show when={copied()} fallback={<Icon name="copy" style={{ width: "14px", height: "14px" }} />}>
            <Icon name="check" style={{ width: "14px", height: "14px" }} />
          </Show>
        </IconButton>
      </div>
    </Show>
  );
}

// ============================================================================
// DateSeparator Component
// ============================================================================

export interface DateSeparatorProps {
  timestamp: number;
}

export function DateSeparator(props: DateSeparatorProps) {
  const lineStyle: JSX.CSSProperties = {
    flex: "1",
    height: "1px",
    background: palette.borderSubtle,
  };

  return (
    <div style={{ 
      display: "flex", 
      "align-items": "center", 
      gap: "12px", 
      padding: "16px 0",
    }}>
      <div style={lineStyle} />
      <Text variant="muted" size="xs" style={{ color: palette.textMuted }}>{formatDate(props.timestamp)}</Text>
      <div style={lineStyle} />
    </div>
  );
}

export default MessageView;

