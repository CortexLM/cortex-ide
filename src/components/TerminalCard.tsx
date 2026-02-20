import { Show, For, type JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import { TerminalInfo, useTerminals } from "@/context/TerminalsContext";
import { Card, Text, Badge, EmptyState, StatusDot } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

interface TerminalCardProps {
  terminal: TerminalInfo;
  onKill?: () => void;
}

export function TerminalCard(props: TerminalCardProps) {
  const { openTerminal } = useTerminals();

  const statusColor = () => {
    switch (props.terminal.status) {
      case "running": return tokens.colors.semantic.success;
      case "exited": return tokens.colors.text.muted;
      case "error": return tokens.colors.semantic.error;
      default: return tokens.colors.text.muted;
    }
  };

  const statusVariant = (): "success" | "error" | "idle" => {
    switch (props.terminal.status) {
      case "running": return "success";
      case "error": return "error";
      default: return "idle";
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.lg,
    padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  const iconContainerStyle: JSX.CSSProperties = {
    width: "32px",
    height: "32px",
    "border-radius": tokens.radius.sm,
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: `color-mix(in srgb, ${statusColor()} 20%, transparent)`,
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
  };

  return (
    <Card
      variant="outlined"
      padding="none"
      hoverable
      onClick={() => openTerminal(props.terminal.id)}
      style={{ "border-radius": tokens.radius.md }}
    >
      <div style={containerStyle}>
        <div style={iconContainerStyle}>
          <Icon 
            name="terminal"
            style={{ 
              width: "16px", 
              height: "16px", 
              color: statusColor(),
            }} 
          />
        </div>
        
        <div style={contentStyle}>
          <Text variant="body" weight="medium" truncate>
            {props.terminal.name}
          </Text>
          <Text variant="muted" size="xs" truncate>
            {props.terminal.cwd}
          </Text>
        </div>

        <div style={actionsStyle}>
          <Show when={props.terminal.status === "running"}>
            <StatusDot status={statusVariant()} />
          </Show>
          <Show when={props.terminal.status === "exited"}>
            <Badge variant="default" size="sm">
              Exit: {props.terminal.exitCode ?? "?"}
            </Badge>
          </Show>
          <Icon 
            name="chevron-right"
            style={{ 
              width: "16px", 
              height: "16px", 
              color: tokens.colors.icon.default,
            }} 
          />
        </div>
      </div>
    </Card>
  );
}

export function TerminalsList() {
  const { state } = useTerminals();

  const listStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: tokens.spacing.md,
  };

  return (
    <Show 
      when={state.terminals.length > 0}
      fallback={
        <EmptyState
          icon={<Icon name="terminal" />}
          description="No terminals running"
        />
      }
    >
      <div style={listStyle}>
        <For each={state.terminals}>
          {(terminal) => <TerminalCard terminal={terminal} />}
        </For>
      </div>
    </Show>
  );
}
