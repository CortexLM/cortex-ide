import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  JSX,
  onMount,
  onCleanup,
} from "solid-js";
import { useRemote, ForwardedPortStatus } from "@/context/RemoteContext";
import {
  CortexButton,
  CortexModal,
  CortexIcon,
  CortexTooltip,
  CortexToggle,
} from "@/components/cortex/primitives";
import { createLogger } from "@/utils/logger";

const log = createLogger("PortForwarding");

export interface PortForwardingPanelProps {
  connectionId: string;
  onNotification?: (title: string, message: string) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const PortForwardingPanel: Component<PortForwardingPanelProps> = (props) => {
  const remote = useRemote();
  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [isAdding, setIsAdding] = createSignal(false);
  const [addError, setAddError] = createSignal<string | null>(null);
  const [localPort, setLocalPort] = createSignal("");
  const [remotePort, setRemotePort] = createSignal("");
  const [remoteHost, setRemoteHost] = createSignal("localhost");
  const [samePort, setSamePort] = createSignal(true);
  const [lastChecked, setLastChecked] = createSignal<Date>(new Date());

  const forwardedPorts = createMemo(() =>
    remote.getForwardedPorts(props.connectionId)
  );

  const detectedPorts = createMemo(() => {
    const forwarded = new Set(forwardedPorts().map((p) => p.remotePort));
    return remote.state.detectedPorts.filter((p) => !forwarded.has(p.port));
  });

  onMount(() => {
    const handlePortDetected = (
      event: CustomEvent<{ connectionId: string; port: { port: number } }>
    ) => {
      if (event.detail.connectionId === props.connectionId) {
        props.onNotification?.(
          "Port Detected",
          `Port ${event.detail.port.port} detected on remote server`
        );
      }
    };

    window.addEventListener(
      "remote:port-detected",
      handlePortDetected as EventListener
    );

    onCleanup(() => {
      window.removeEventListener(
        "remote:port-detected",
        handlePortDetected as EventListener
      );
    });
  });

  onMount(() => {
    const healthInterval = setInterval(() => {
      setLastChecked(new Date());
    }, 30_000);

    onCleanup(() => {
      clearInterval(healthInterval);
    });
  });

  const resetForm = () => {
    setLocalPort("");
    setRemotePort("");
    setRemoteHost("localhost");
    setSamePort(true);
    setAddError(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleAddPort = async () => {
    const local = parseInt(localPort(), 10);
    const remoteP = samePort() ? local : parseInt(remotePort(), 10);

    if (isNaN(local) || local < 1 || local > 65535) {
      setAddError("Invalid local port");
      return;
    }
    if (isNaN(remoteP) || remoteP < 1 || remoteP > 65535) {
      setAddError("Invalid remote port");
      return;
    }

    setIsAdding(true);
    setAddError(null);

    try {
      await remote.forwardPort(
        props.connectionId,
        local,
        remoteP,
        remoteHost()
      );
      setShowAddDialog(false);
      props.onNotification?.(
        "Port Forwarded",
        `Port ${local} → ${remoteP} forwarded successfully`
      );
    } catch (e) {
      setAddError(String(e));
    } finally {
      setIsAdding(false);
    }
  };

  const handleStopForwarding = async (portId: string) => {
    try {
      await remote.stopForwarding(portId);
    } catch (e) {
      log.error("Failed to stop port forwarding:", e);
    }
  };

  const handleOpenPort = (portId: string) => {
    remote.openForwardedPort(portId);
  };

  const handleForwardDetected = async (port: number) => {
    try {
      await remote.forwardPort(props.connectionId, port, port, "localhost");
      props.onNotification?.("Port Forwarded", `Port ${port} forwarded successfully`);
    } catch (e) {
      log.error("Failed to forward detected port:", e);
    }
  };

  const handleReconnect = async (port: {
    id: string;
    localPort: number;
    remotePort: number;
    remoteHost: string;
  }) => {
    try {
      await remote.stopForwarding(port.id);
    } catch (_stopErr) {
      // Ignore stop errors for errored tunnels
    }
    try {
      await remote.forwardPort(
        props.connectionId,
        port.localPort,
        port.remotePort,
        port.remoteHost
      );
      props.onNotification?.(
        "Port Reconnected",
        `Port ${port.localPort} → ${port.remotePort} reconnected`
      );
    } catch (e) {
      log.error("Failed to reconnect port forwarding:", e);
    }
  };

  const formatLastChecked = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  const titleStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
  });

  const titleTextStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--cortex-text-muted)",
  });

  const badgeStyle = (): JSX.CSSProperties => ({
    padding: "2px 6px",
    "font-size": "10px",
    "border-radius": "10px",
    background: "var(--cortex-bg-secondary)",
    color: "var(--cortex-text-muted)",
  });

  const listStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "overflow-y": "auto",
  });

  const emptyStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "24px",
    gap: "12px",
    color: "var(--cortex-text-muted)",
  });

  const healthIndicatorStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "6px 12px",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    background: "var(--cortex-bg-secondary)",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={headerStyle()}>
        <div style={titleStyle()}>
          <CortexIcon name="globe" size={14} />
          <span style={titleTextStyle()}>Forwarded Ports</span>
          <Show when={forwardedPorts().length > 0}>
            <span style={badgeStyle()}>{forwardedPorts().length}</span>
          </Show>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <CortexTooltip
            content={remote.autoForward() ? "Auto-forward enabled" : "Auto-forward disabled"}
            position="bottom"
          >
            <CortexToggle
              checked={remote.autoForward()}
              onChange={() => remote.setAutoForwardPorts(!remote.autoForward())}
              size="sm"
            />
          </CortexTooltip>
          <CortexTooltip content="Refresh ports" position="bottom">
            <CortexButton
              variant="ghost"
              size="sm"
              onClick={() => setLastChecked(new Date())}
              aria-label="Refresh ports"
            >
              <CortexIcon name="rotate" size={14} />
            </CortexButton>
          </CortexTooltip>
          <CortexTooltip content="Forward a port" position="bottom">
            <CortexButton
              variant="ghost"
              size="sm"
              onClick={handleOpenDialog}
              aria-label="Forward a port"
            >
              <CortexIcon name="plus" size={14} />
            </CortexButton>
          </CortexTooltip>
        </div>
      </div>

      <div style={listStyle()}>
        <Show
          when={forwardedPorts().length > 0}
          fallback={
            <div style={emptyStyle()}>
              <CortexIcon name="server" size={32} />
              <span style={{ "font-size": "13px" }}>No ports forwarded</span>
              <CortexButton variant="secondary" size="sm" onClick={handleOpenDialog}>
                Forward a Port
              </CortexButton>
            </div>
          }
        >
          <div style={{ padding: "4px 0" }}>
            <div
              style={{
                display: "grid",
                "grid-template-columns": "80px 1fr 90px 70px",
                padding: "6px 12px",
                "font-size": "10px",
                "font-weight": "600",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
                color: "var(--cortex-text-muted)",
                background: "var(--cortex-bg-secondary)",
              }}
            >
              <span>Local</span>
              <span>Remote</span>
              <span>Status</span>
              <span style={{ "text-align": "right" }}>Actions</span>
            </div>
            <For each={forwardedPorts()}>
              {(port) => (
                <PortRow
                  port={port}
                  onStop={() => handleStopForwarding(port.id)}
                  onOpen={() => handleOpenPort(port.id)}
                  onReconnect={() => handleReconnect(port)}
                />
              )}
            </For>
          </div>
        </Show>

        <Show when={detectedPorts().length > 0}>
          <div style={{ padding: "12px" }}>
            <div
              style={{
                "font-size": "10px",
                "font-weight": "600",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
                color: "var(--cortex-text-muted)",
                "margin-bottom": "8px",
              }}
            >
              Detected Ports
            </div>
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <For each={detectedPorts()}>
                {(detected) => (
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      padding: "6px 8px",
                      "border-radius": "6px",
                      background: "var(--cortex-bg-secondary)",
                      border: "1px solid var(--cortex-border-default)",
                    }}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                      <span
                        style={{
                          "font-family": "var(--cortex-font-mono, monospace)",
                          "font-size": "12px",
                          color: "var(--cortex-text-primary)",
                        }}
                      >
                        :{detected.port}
                      </span>
                      <Show when={detected.protocol}>
                        <span
                          style={{
                            padding: "2px 6px",
                            "font-size": "10px",
                            "border-radius": "4px",
                            background: "var(--cortex-bg-elevated)",
                            color: "var(--cortex-text-muted)",
                          }}
                        >
                          {detected.protocol}
                        </span>
                      </Show>
                    </div>
                    <CortexButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleForwardDetected(detected.port)}
                    >
                      Forward
                    </CortexButton>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <Show when={forwardedPorts().length > 0}>
        <div style={healthIndicatorStyle()}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <CortexIcon
              name="circle-check"
              size={10}
              style={{ color: "var(--cortex-success, #22c55e)" }}
            />
            <span style={{ "font-size": "10px", color: "var(--cortex-text-muted)" }}>
              Last checked: {formatLastChecked(lastChecked())}
            </span>
          </div>
          <span style={{ "font-size": "10px", color: "var(--cortex-text-muted)" }}>
            {forwardedPorts().filter((p) => p.status === "active").length} active
          </span>
        </div>
      </Show>

      <CortexModal
        open={showAddDialog()}
        onClose={() => setShowAddDialog(false)}
        title="Forward Port"
        size="sm"
        confirmText="Forward Port"
        cancelText="Cancel"
        onConfirm={handleAddPort}
        onCancel={() => setShowAddDialog(false)}
        confirmLoading={isAdding()}
        confirmDisabled={!localPort()}
      >
        <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--cortex-text-muted)",
                "margin-bottom": "6px",
              }}
            >
              Local Port
            </label>
            <input
              type="number"
              value={localPort()}
              onInput={(e: InputEvent) => {
                const value = (e.currentTarget as HTMLInputElement).value;
                setLocalPort(value);
                if (samePort()) {
                  setRemotePort(value);
                }
              }}
              placeholder="e.g., 3000"
              style={{
                width: "100%",
                padding: "8px 12px",
                "font-size": "14px",
                background: "var(--cortex-bg-secondary)",
                border: "1px solid var(--cortex-border-default)",
                "border-radius": "6px",
                color: "var(--cortex-text-primary)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <CortexToggle
              checked={samePort()}
              onChange={() => setSamePort(!samePort())}
              size="sm"
            />
            <span style={{ "font-size": "12px", color: "var(--cortex-text-muted)" }}>
              Same local and remote port
            </span>
          </div>

          <Show when={!samePort()}>
            <div>
              <label
                style={{
                  display: "block",
                  "font-size": "12px",
                  "font-weight": "500",
                  color: "var(--cortex-text-muted)",
                  "margin-bottom": "6px",
                }}
              >
                Remote Port
              </label>
              <input
                type="number"
                value={remotePort()}
                onInput={(e: InputEvent) => setRemotePort((e.currentTarget as HTMLInputElement).value)}
                placeholder="e.g., 8080"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  "font-size": "14px",
                  background: "var(--cortex-bg-secondary)",
                  border: "1px solid var(--cortex-border-default)",
                  "border-radius": "6px",
                  color: "var(--cortex-text-primary)",
                  outline: "none",
                }}
              />
            </div>
          </Show>

          <div>
            <label
              style={{
                display: "block",
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--cortex-text-muted)",
                "margin-bottom": "6px",
              }}
            >
              Remote Host
            </label>
            <input
              type="text"
              value={remoteHost()}
              onInput={(e: InputEvent) => setRemoteHost((e.currentTarget as HTMLInputElement).value)}
              placeholder="localhost"
              style={{
                width: "100%",
                padding: "8px 12px",
                "font-size": "14px",
                background: "var(--cortex-bg-secondary)",
                border: "1px solid var(--cortex-border-default)",
                "border-radius": "6px",
                color: "var(--cortex-text-primary)",
                outline: "none",
              }}
            />
            <p
              style={{
                "font-size": "11px",
                color: "var(--cortex-text-muted)",
                "margin-top": "4px",
              }}
            >
              Usually "localhost" to forward a port from the remote server
            </p>
          </div>

          <Show when={addError()}>
            <div
              style={{
                padding: "8px 12px",
                "border-radius": "6px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--cortex-error, #ef4444)",
                "font-size": "12px",
              }}
            >
              {addError()}
            </div>
          </Show>
        </div>
      </CortexModal>
    </div>
  );
};

interface PortRowProps {
  port: {
    id: string;
    localPort: number;
    remotePort: number;
    remoteHost: string;
    status: ForwardedPortStatus;
    error?: string;
  };
  onStop: () => void;
  onOpen: () => void;
  onReconnect: () => void;
}

const PortRow: Component<PortRowProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const rowStyle = (): JSX.CSSProperties => ({
    display: "grid",
    "grid-template-columns": "80px 1fr 90px 70px",
    "align-items": "center",
    padding: "6px 12px",
    background: isHovered() ? "var(--cortex-bg-hover)" : "transparent",
    transition: "background 100ms ease",
  });

  const statusColor = () => {
    switch (props.port.status) {
      case "active":
        return "var(--cortex-success, #22c55e)";
      case "connecting":
        return "var(--cortex-accent-primary)";
      case "error":
        return "var(--cortex-error, #ef4444)";
      default:
        return "var(--cortex-text-muted)";
    }
  };

  const statusText = () => {
    switch (props.port.status) {
      case "active":
        return "Active";
      case "connecting":
        return "Connecting...";
      case "error":
        return props.port.error || "Error";
      case "stopped":
        return "Stopped";
      default:
        return "Unknown";
    }
  };

  const statusIcon = () => {
    switch (props.port.status) {
      case "active":
        return "circle-check";
      case "connecting":
        return "spinner";
      case "error":
        return "circle-exclamation";
      default:
        return "server";
    }
  };

  return (
    <div
      style={rowStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        style={{
          "font-family": "var(--cortex-font-mono, monospace)",
          "font-size": "12px",
          color: "var(--cortex-text-primary)",
        }}
      >
        :{props.port.localPort}
      </span>
      <span
        style={{
          "font-family": "var(--cortex-font-mono, monospace)",
          "font-size": "12px",
          color: "var(--cortex-text-muted)",
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
        }}
      >
        {props.port.remoteHost}:{props.port.remotePort}
      </span>
      <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
        <CortexIcon
          name={statusIcon()}
          size={14}
          style={{ color: statusColor() }}
          class={props.port.status === "connecting" ? "animate-spin" : ""}
        />
        <span style={{ "font-size": "11px", color: statusColor() }}>
          {statusText()}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "flex-end",
          gap: "4px",
        }}
      >
        <Show when={props.port.status === "active"}>
          <CortexTooltip content="Open in browser" position="top">
            <CortexButton variant="ghost" size="sm" onClick={props.onOpen}>
              <CortexIcon name="arrow-up-right-from-square" size={12} />
            </CortexButton>
          </CortexTooltip>
        </Show>
        <Show when={props.port.status === "error"}>
          <CortexTooltip content="Reconnect tunnel" position="top">
            <CortexButton variant="ghost" size="sm" onClick={props.onReconnect}>
              <CortexIcon name="rotate" size={12} />
            </CortexButton>
          </CortexTooltip>
        </Show>
        <CortexTooltip content="Stop forwarding" position="top">
          <CortexButton
            variant="ghost"
            size="sm"
            onClick={props.onStop}
            style={{ color: "var(--cortex-error, #ef4444)" }}
          >
            <CortexIcon name="trash" size={12} />
          </CortexButton>
        </CortexTooltip>
      </div>
    </div>
  );
};

export default PortForwardingPanel;
