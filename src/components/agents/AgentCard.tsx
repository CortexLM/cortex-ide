import { JSX, For, Show, createSignal } from "solid-js";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { Agent } from "@/types/agents";

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onInvoke?: () => void;
}

export function AgentCard(props: AgentCardProps) {
  const [menuOpen, setMenuOpen] = createSignal(false);

  const cardStyle: JSX.CSSProperties = {
    position: "relative",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    "justify-content": "space-between",
    gap: "12px",
  };

  const titleRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    flex: "1",
    "min-width": "0",
  };

  const avatarStyle: JSX.CSSProperties = {
    width: "40px",
    height: "40px",
    "border-radius": "var(--cortex-radius-lg)",
    background: props.agent.color || "var(--accent-primary)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: "var(--cortex-text-primary)",
    "font-weight": "600",
    "font-size": "16px",
    "flex-shrink": "0",
  };

  const infoStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const nameStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "15px",
    "font-weight": "600",
    color: "var(--text-title)",
    margin: "0",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const descStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-muted)",
    margin: "4px 0 0",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    display: "-webkit-box",
    "-webkit-line-clamp": "2",
    "-webkit-box-orient": "vertical",
  };

  const menuButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "background 150ms ease, color 150ms ease",
  };

  const menuStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "40px",
    right: "12px",
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--jb-radius-md)",
    "box-shadow": "var(--shadow-popup)",
    "min-width": "120px",
    "z-index": "100",
    overflow: "hidden",
  };

  const menuItemStyle = (danger: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: danger ? "var(--state-error)" : "var(--text-primary)",
    background: "transparent",
    border: "none",
    width: "100%",
    "text-align": "left",
    cursor: "pointer",
    transition: "background 150ms ease",
  });

  const toolsStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "6px",
    "margin-top": "12px",
  };

  const metaStyle: JSX.CSSProperties = {
    "margin-top": "12px",
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    color: "var(--text-weaker)",
    display: "flex",
    "align-items": "center",
    gap: "12px",
  };

  const scopeBadgeVariant = () => {
    switch (props.agent.scope) {
      case "builtin":
        return "accent";
      case "user":
        return "success";
      case "project":
        return "default";
      default:
        return "default";
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split("-");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleMenuClick = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <Card variant="default" padding="md" style={cardStyle} hoverable>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <div style={avatarStyle}>{getInitials(props.agent.name)}</div>
          <div style={infoStyle}>
            <h3 style={nameStyle}>{props.agent.name}</h3>
            <p style={descStyle}>{props.agent.description}</p>
          </div>
        </div>
        
        <div style={{ position: "relative" }}>
          <button
            style={menuButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen());
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Icon name="ellipsis-vertical" size={14} />
          </button>
          
          <Show when={menuOpen()}>
            <div style={menuStyle}>
              <Show when={props.onInvoke}>
                <button
                  style={menuItemStyle(false)}
                  onClick={() => handleMenuClick(props.onInvoke!)}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="play" size={12} />
                  Invoke
                </button>
              </Show>
              <button
                style={menuItemStyle(false)}
                onClick={() => handleMenuClick(props.onEdit)}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Icon name="pen" size={12} />
                Edit
              </button>
              <Show when={props.agent.scope !== "builtin"}>
                <button
                  style={menuItemStyle(true)}
                  onClick={() => handleMenuClick(props.onDelete)}
                  onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--state-error) 10%, transparent)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="trash" size={12} />
                  Delete
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      <Show when={props.agent.tools.length > 0}>
        <div style={toolsStyle}>
          <For each={props.agent.tools.slice(0, 5)}>
            {(tool) => (
              <Badge variant="default" size="sm">
                {tool}
              </Badge>
            )}
          </For>
          <Show when={props.agent.tools.length > 5}>
            <Badge variant="default" size="sm">
              +{props.agent.tools.length - 5}
            </Badge>
          </Show>
        </div>
      </Show>

      <div style={metaStyle}>
        <span>Model: {props.agent.model || "inherit"}</span>
        <span>•</span>
        <span>Reasoning: {props.agent.reasoningEffort || "medium"}</span>
        <span>•</span>
        <Badge variant={scopeBadgeVariant()} size="sm">
          {props.agent.scope}
        </Badge>
      </div>
    </Card>
  );
}

