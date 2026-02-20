import { JSX, For, Show } from "solid-js";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { SharedMessage } from "@/types/share";

interface SharedMessageListProps {
  messages: SharedMessage[];
  readOnly?: boolean;
}

export function SharedMessageList(props: SharedMessageListProps) {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "16px",
    padding: "20px",
    "overflow-y": "auto",
    flex: "1",
  };

  return (
    <div style={containerStyle}>
      <For each={props.messages}>
        {(message) => <SharedMessageItem message={message} />}
      </For>
    </div>
  );
}

interface SharedMessageItemProps {
  message: SharedMessage;
}

function SharedMessageItem(props: SharedMessageItemProps) {
  const isUser = () => props.message.role === "user";
  const isAssistant = () => props.message.role === "assistant";

  const messageStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
    "max-width": isUser() ? "85%" : "100%",
    "margin-left": isUser() ? "auto" : "0",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--text-muted)",
  };

  const contentStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    "line-height": "1.6",
    color: "var(--text-primary)",
    "white-space": "pre-wrap",
    "word-break": "break-word",
  };

  const toolCallsStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
    "margin-top": "8px",
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={messageStyle}>
      <div style={headerStyle}>
        <Icon
          name={isUser() ? "user" : isAssistant() ? "robot" : "info-circle"}
          size={14}
        />
        <span style={{ "text-transform": "capitalize" }}>{props.message.role}</span>
        <span style={{ color: "var(--text-weaker)" }}>•</span>
        <span>{formatTimestamp(props.message.timestamp)}</span>
      </div>
      <Card
        variant={isUser() ? "outlined" : "default"}
        padding="md"
        style={{
          background: isUser() ? "var(--surface-hover)" : "var(--surface-card)",
        }}
      >
        <div style={contentStyle}>{props.message.content}</div>
        <Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
          <div style={toolCallsStyle}>
            <For each={props.message.toolCalls}>
              {(toolCall) => <ToolCallItem toolCall={toolCall} />}
            </For>
          </div>
        </Show>
      </Card>
    </div>
  );
}

interface ToolCallItemProps {
  toolCall: NonNullable<SharedMessage["toolCalls"]>[number];
}

function ToolCallItem(props: ToolCallItemProps) {
  const containerStyle: JSX.CSSProperties = {
    "border-top": "1px solid var(--border-default)",
    "padding-top": "8px",
    "margin-top": "8px",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "margin-bottom": "8px",
  };

  const outputStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    "font-size": "12px",
    padding: "8px 12px",
    background: "var(--surface-base)",
    "border-radius": "var(--jb-radius-sm)",
    "max-height": "200px",
    "overflow-y": "auto",
    "white-space": "pre-wrap",
    "word-break": "break-all",
    color: "var(--text-muted)",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <Icon name="wrench" size={12} />
        <Badge variant="default" size="sm">
          {props.toolCall.name}
        </Badge>
      </div>
      <Show when={props.toolCall.output}>
        <div style={outputStyle}>{props.toolCall.output}</div>
      </Show>
    </div>
  );
}
