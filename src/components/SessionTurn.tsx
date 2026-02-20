import { Show, createMemo, createSignal, JSX } from "solid-js";
import { Message } from "@/context/SDKContext";
import { Markdown } from "./Markdown";
import { Icon } from "./ui/Icon";
import { AgentMessage } from "./Chat/AgentMessage";
import { Card, IconButton, Text } from "@/components/ui";

interface SessionTurnProps {
  user: Message;
  assistant?: Message;
  isLast: boolean;
  isWorking: boolean;
  reasoning?: string;
}



function CopyButton(props: { text: string }) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async (e: Event) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = props.text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <IconButton
      onClick={handleCopy}
      size="sm"
      tooltip={copied() ? "Copied!" : "Copy message"}
      style={{
        color: copied() ? "var(--cortex-success)" : "var(--jb-text-muted-color)",
      }}
    >
      <Show when={copied()} fallback={<Icon name="copy" size={14} />}>
        <Icon name="check" size={14} />
      </Show>
    </IconButton>
  );
}

export function SessionTurn(props: SessionTurnProps) {
  const [userHovered, setUserHovered] = createSignal(false);

  // Get user message text
  const userText = createMemo(() => {
    const textPart = props.user.parts.find(p => p.type === "text");
    return textPart?.type === "text" ? textPart.content : "";
  });

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "20px",
    "margin-bottom": "32px",
  };

  return (
    <div style={containerStyle}>
      {/* User message - bubble style */}
      <div 
        style={{ position: "relative" }}
        onMouseEnter={() => setUserHovered(true)}
        onMouseLeave={() => setUserHovered(false)}
      >
        {/* Copy button - hover */}
        <div 
          style={{ 
            position: "absolute",
            top: "-4px",
            right: "-4px",
            "z-index": "10",
            transition: "opacity 0.15s",
            opacity: userHovered() ? "1" : "0",
          }}
        >
          <CopyButton text={userText()} />
        </div>

        {/* User bubble */}
        <Card 
          variant="outlined"
          padding="md"
          style={{ 
            display: "inline-block",
            "max-width": "85%",
          }}
        >
          <Text variant="body" style={{ "line-height": "1.6" }}>
            <Markdown content={userText()} />
          </Text>
        </Card>
      </div>

      {/* Assistant response */}
      <Show when={props.assistant || props.isWorking}>
        <div>
          {/* Response label */}
          <Text 
            variant="muted" 
            size="xs"
            style={{ "margin-bottom": "6px", display: "block" }}
          >
            Response
          </Text>
          
          <Show when={props.assistant}>
            <AgentMessage message={props.assistant!} />
          </Show>
          
          <Show when={props.isWorking && !props.assistant}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "8px 0" }}>
              <div 
                style={{ 
                  width: "6px", 
                  height: "6px", 
                  "border-radius": "var(--cortex-radius-full)", 
                  background: "var(--jb-text-muted-color)",
                  animation: "pulse 2s infinite",
                }} 
              />
              <Text variant="muted" size="xs">Thinking...</Text>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

