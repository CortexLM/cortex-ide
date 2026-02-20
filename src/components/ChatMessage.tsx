import { Show, For, createSignal, JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import { Message, ToolCall } from "@/context/SDKContext";
import { Markdown } from "./Markdown";
import { Card, Text, Badge, IconButton } from "@/components/ui";

// ============================================================================
// CSS Variable-based Color Palette
// ============================================================================
const palette = {
  canvas: "var(--surface-base)",
  panel: "var(--surface-card)",
  inputCard: "var(--surface-input)",
  border: "var(--border-default)",
  borderSubtle: "var(--border-default)",
  textTitle: "var(--text-title)",
  textBody: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  accent: "var(--text-placeholder)",
  outputBg: "var(--surface-base)",
  outputText: "var(--text-secondary)",
};

// Tool status styles
const statusStyles = {
  running: { color: "var(--text-placeholder)" },
  completed: { color: "var(--state-success)" },
  error: { color: "var(--state-error)" },
};

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

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage(props: ChatMessageProps) {
  const isUser = () => props.message.role === "user";
  const isAssistant = () => props.message.role === "assistant";
  const [showReasoning, setShowReasoning] = createSignal(false);

  const avatarStyle: JSX.CSSProperties = {
    display: "flex",
    width: "24px",
    height: "24px",
    "align-items": "center",
    "justify-content": "center",
    "border-radius": "var(--cortex-radius-full)",
    "flex-shrink": "0",
  };

  return (
    <div 
      style={{ 
        display: "flex",
        gap: "12px",
        padding: "12px 16px",
      }}
    >
      {/* Avatar - 24px standard */}
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

      <div style={{ flex: "1", "min-width": "0", display: "flex", "flex-direction": "column", gap: "12px" }}>
        {/* Header */}
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Text 
            variant="body" 
            weight="semibold"
            style={{ 
              color: isUser() ? palette.textTitle : palette.accent,
            }}
          >
            {isUser() ? "You" : "Cortex"}
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

        {/* Reasoning/Thinking section */}
        <Show when={props.message.reasoning}>
          <Card 
            variant="outlined" 
            padding="none"
            style={{ overflow: "hidden", background: palette.panel, "border-color": palette.borderSubtle }}
          >
            <IconButton
              onClick={() => setShowReasoning(!showReasoning())}
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
              {showReasoning() 
                ? <Icon name="chevron-down" style={{ width: "16px", height: "16px", color: palette.textMuted }} /> 
                : <Icon name="chevron-right" style={{ width: "16px", height: "16px", color: palette.textMuted }} />
              }
              <Text variant="muted" style={{ color: palette.textMuted }}>Thinking...</Text>
            </IconButton>
            <Show when={showReasoning()}>
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
                {props.message.reasoning}
              </div>
            </Show>
          </Card>
        </Show>

        {/* Render parts in order - tool calls and text interleaved */}
        <For each={props.message.parts}>
          {(part) => (
            <Show when={part.type === "tool"} fallback={
              <Show when={(part as { type: "text"; content: string }).content}>
                <div style={isUser() ? userMessageStyle : { ...assistantMessageStyle, ...contentStyle }}>
                  <Markdown content={(part as { type: "text"; content: string }).content} />
                </div>
              </Show>
            }>
              <ToolCallCard tool={(part as { type: "tool"; tool: ToolCall }).tool} />
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

interface ToolCallCardProps {
  tool: ToolCall;
}

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

function ToolCallCard(props: ToolCallCardProps) {
  const [expanded, setExpanded] = createSignal(true);

  const getIconName = () => {
    const name = props.tool.name.toLowerCase();
    if (name.includes("exec") || name.includes("bash") || name.includes("shell")) {
      return "terminal";
    }
    if (name.includes("read") || name.includes("write") || name.includes("file")) {
      return "file";
    }
    return "code";
  };

  const getStatusBadgeVariant = (): "default" | "warning" | "success" | "error" => {
    switch (props.tool.status) {
      case "running": return "warning";
      case "completed": return "success";
      case "error": return "error";
      default: return "default";
    }
  };

  const getStatusBorderColor = (): string => {
    switch (props.tool.status) {
      case "running": return statusStyles.running.color;
      case "completed": return statusStyles.completed.color;
      case "error": return statusStyles.error.color;
      default: return palette.border;
    }
  };

  const iconName = getIconName();

  return (
    <Card 
      variant="outlined"
      padding="none"
      style={{
        overflow: "hidden",
        margin: "8px 0",
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
        <Icon name={iconName} style={{ width: "16px", height: "16px", "flex-shrink": "0", color: palette.accent }} />
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

        {expanded() 
          ? <Icon name="chevron-down" style={{ width: "16px", height: "16px", color: palette.textMuted }} /> 
          : <Icon name="chevron-right" style={{ width: "16px", height: "16px", color: palette.textMuted }} />
        }
      </IconButton>

      <Show when={expanded()}>
        <div style={{ "border-top": `1px solid ${palette.borderSubtle}` }}>
          {/* Input */}
          <Show when={Object.keys(props.tool.input).length > 0}>
            <div 
              style={{ 
                padding: "8px 12px", 
                "border-bottom": `1px solid ${palette.borderSubtle}`,
              }}
            >
              <Text 
                variant="muted" 
                size="xs"
                style={{ "margin-bottom": "4px", display: "block", color: palette.textMuted }}
              >
                Input
              </Text>
              <pre 
                style={{ 
                  "font-family": "var(--jb-font-mono)",
                  "font-size": "12px",
                  "overflow-x": "auto",
                  "max-height": "128px",
                  "overflow-y": "auto",
                  color: palette.textMuted,
                  margin: "0",
                }}
              >
                {formatToolInput(props.tool.input)}
              </pre>
            </div>
          </Show>

          {/* Output */}
          <Show when={props.tool.output}>
            <div style={{ padding: "8px 12px" }}>
              <Text 
                variant="muted" 
                size="xs"
                style={{ "margin-bottom": "4px", display: "block", color: palette.textMuted }}
              >
                Output
              </Text>
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
    return `${input.file_path}\n---\n${String(input.content).slice(0, 500)}${String(input.content).length > 500 ? '...' : ''}`;
  }
  if (input.file_path) {
    return String(input.file_path);
  }
  if (input.pattern) {
    return `pattern: ${input.pattern}${input.path ? ` in ${input.path}` : ''}`;
  }
  return JSON.stringify(input, null, 2);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

