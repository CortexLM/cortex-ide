import { Show, JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import { useSDK } from "@/context/SDKContext";
import { Button, Text, Badge, SidebarSection, SidebarContent, StatusDot, Divider } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

export function Sidebar() {
  const { state, createSession, destroySession, connect, disconnect, interrupt } = useSDK();

  const handleNewSession = async () => {
    await createSession();
  };

  const handleClearSession = async () => {
    await destroySession();
  };

  const handleToggleConnection = async () => {
    if (state.connected) {
      disconnect();
    } else {
      await connect();
    }
  };

  const handleInterrupt = async () => {
    await interrupt();
  };

  const sidebarStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    width: "100%",
    background: tokens.colors.surface.canvas,
    "border-right": `1px solid ${tokens.colors.border.divider}`,
  };

  const logoStyle: JSX.CSSProperties = {
    width: "28px",
    height: "28px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: tokens.colors.semantic.primary,
    "border-radius": tokens.radius.sm,
    color: "var(--cortex-text-primary)",
    "font-weight": "700",
    "font-size": "14px",
  };

  const brandContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
  };

  const actionsContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "6px",
    padding: `0 ${tokens.spacing.md}`,
  };

  const sessionContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    background: tokens.colors.interactive.hover,
    "border-radius": tokens.radius.md,
  };

  const sessionHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
  };

  const sessionDetailsStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: tokens.spacing.sm,
    "padding-left": "24px",
  };

  const detailRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    "font-size": "11px",
    color: tokens.colors.text.muted,
  };

  const statsGridStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "6px",
  };

  const statRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: `${tokens.spacing.sm} 0`,
  };

  const emptyStateStyle: JSX.CSSProperties = {
    padding: "16px",
    "text-align": "center",
    color: tokens.colors.text.muted,
    "font-size": "12px",
  };

  const activityContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    margin: `0 ${tokens.spacing.md}`,
    background: "rgba(53, 116, 240, 0.1)",
    "border-radius": tokens.radius.md,
    "border-left": `3px solid ${tokens.colors.semantic.primary}`,
  };

  const activityHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    color: tokens.colors.semantic.primary,
    "font-size": "12px",
    "font-weight": "500",
  };

  const activityReasoningStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: tokens.colors.text.muted,
    "padding-left": "24px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    display: "-webkit-box",
    "-webkit-line-clamp": "3",
    "-webkit-box-orient": "vertical",
  };

  const spacerStyle: JSX.CSSProperties = {
    flex: "1",
  };

  const footerStyle: JSX.CSSProperties = {
    padding: tokens.spacing.lg,
    "border-top": `1px solid ${tokens.colors.border.divider}`,
  };

  const footerRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
  };

  const connectionStatusStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    "font-size": "11px",
    color: tokens.colors.text.muted,
  };

  const serverInfoStyle: JSX.CSSProperties = {
    "margin-top": tokens.spacing.md,
    "font-size": "10px",
    color: tokens.colors.text.muted,
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  return (
    <aside style={sidebarStyle}>
      {/* Logo/Brand Header */}
      <div style={brandContainerStyle}>
        <div style={logoStyle}>F</div>
        <Text weight="semibold" size="md">Cortex</Text>
      </div>

      <SidebarContent>
        {/* Action Buttons */}
        <SidebarSection title="Actions">
          <div style={actionsContainerStyle}>
            <Button 
              variant="secondary"
              size="sm"
              icon={<Icon name="circle-plus" style={{ width: "14px", height: "14px" }} />}
              onClick={handleNewSession}
              disabled={!state.connected}
              style={{ "justify-content": "flex-start", width: "100%" }}
            >
              New Session
            </Button>
            <Button 
              variant="danger"
              size="sm"
              icon={<Icon name="trash" style={{ width: "14px", height: "14px" }} />}
              onClick={handleClearSession}
              disabled={!state.currentSession}
              style={{ "justify-content": "flex-start", width: "100%" }}
            >
              Clear Session
            </Button>
            <Show when={state.isStreaming}>
              <Button 
                variant="secondary"
                size="sm"
                icon={<Icon name="circle-stop" style={{ width: "14px", height: "14px" }} />}
                onClick={handleInterrupt}
                style={{ 
                  "justify-content": "flex-start", 
                  width: "100%",
                  color: tokens.colors.semantic.warning,
                  "border-color": tokens.colors.semantic.warning,
                }}
              >
                Stop Generation
              </Button>
            </Show>
            <Button 
              variant={state.connected ? "secondary" : "primary"}
              size="sm"
              icon={state.connected 
                ? <Icon name="wifi" style={{ width: "14px", height: "14px" }} /> 
                : <Icon name="wifi-slash" style={{ width: "14px", height: "14px" }} />
              }
              onClick={handleToggleConnection}
              style={{ "justify-content": "flex-start", width: "100%" }}
            >
              {state.connected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </SidebarSection>

        <Divider style={{ margin: "8px 12px" }} />

        {/* Current Session Info */}
        <SidebarSection title="Current Session">
          <Show
            when={state.currentSession}
            fallback={<div style={emptyStateStyle}>No active session</div>}
          >
            <div style={sessionContainerStyle}>
              <div style={sessionHeaderStyle}>
                <Icon name="message" style={{ width: "16px", height: "16px", color: tokens.colors.semantic.primary }} />
                <Text weight="medium" size="sm">Current Session</Text>
              </div>
              <div style={sessionDetailsStyle}>
                <div style={detailRowStyle}>
                  <Icon name="microchip" style={{ width: "12px", height: "12px" }} />
                  <span>{state.currentSession!.model}</span>
                </div>
                <div style={detailRowStyle}>
                  <Icon name="folder" style={{ width: "12px", height: "12px" }} />
                  <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {state.currentSession!.cwd}
                  </span>
                </div>
              </div>
            </div>
          </Show>
        </SidebarSection>

        <Divider style={{ margin: "8px 12px" }} />

        {/* Stats Section */}
        <SidebarSection title="Statistics">
          <div style={statsGridStyle}>
            <div style={statRowStyle}>
              <Text variant="muted" size="xs">Messages</Text>
              <Badge variant="default">{state.messages.length}</Badge>
            </div>
            <div style={statRowStyle}>
              <Text variant="muted" size="xs">Status</Text>
              <Badge variant={state.isStreaming ? "accent" : "success"}>
                {state.isStreaming ? "Generating..." : "Ready"}
              </Badge>
            </div>
          </div>
        </SidebarSection>

        {/* Activity Indicator */}
        <Show when={state.isStreaming}>
          <div style={activityContainerStyle}>
            <div style={activityHeaderStyle}>
              <Icon name="wave-pulse" style={{ width: "14px", height: "14px", animation: "pulse 2s infinite" }} />
              <span>Cortex is thinking...</span>
            </div>
            <Show when={state.reasoning}>
              <div style={activityReasoningStyle}>
                {state.reasoning}
              </div>
            </Show>
          </div>
        </Show>
      </SidebarContent>

      {/* Spacer */}
      <div style={spacerStyle} />

      {/* Footer */}
      <div style={footerStyle}>
        <div style={footerRowStyle}>
          <Text variant="muted" size="xs">Cortex Desktop v0.1.0</Text>
          <div style={connectionStatusStyle}>
            <StatusDot status={state.connected ? "success" : "error"} />
            <span>{state.connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        <Show when={state.serverInfo}>
          <div style={serverInfoStyle}>
            Server: {state.serverInfo!.url}
          </div>
        </Show>
      </div>
    </aside>
  );
}

