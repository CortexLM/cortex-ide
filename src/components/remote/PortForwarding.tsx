import { createSignal, For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useRemote, ForwardedPortStatus } from "@/context/RemoteContext";
import { Button, IconButton } from "@/components/ui";

interface PortForwardingProps {
  connectionId: string;
  onNotification?: (title: string, message: string) => void;
}

interface AddPortDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (localPort: number, remotePort: number, remoteHost: string) => void;
  isLoading: boolean;
  error: string | null;
}

function AddPortDialog(props: AddPortDialogProps) {
  const [localPort, setLocalPort] = createSignal("");
  const [remotePort, setRemotePort] = createSignal("");
  const [remoteHost, setRemoteHost] = createSignal("localhost");
  const [samePort, setSamePort] = createSignal(true);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const local = parseInt(localPort(), 10);
    const remote = samePort() ? local : parseInt(remotePort(), 10);

    if (isNaN(local) || local < 1 || local > 65535) {
      return;
    }
    if (isNaN(remote) || remote < 1 || remote > 65535) {
      return;
    }

    props.onSubmit(local, remote, remoteHost());
  };

  const handleLocalPortChange = (value: string) => {
    setLocalPort(value);
    if (samePort()) {
      setRemotePort(value);
    }
  };

  const resetForm = () => {
    setLocalPort("");
    setRemotePort("");
    setRemoteHost("localhost");
    setSamePort(true);
  };

  // Reset form when dialog opens
  createMemo(() => {
    if (props.isOpen) {
      resetForm();
    }
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ "background-color": "rgba(0, 0, 0, 0.5)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            props.onClose();
          }
        }}
      >
        <div
          class="w-[400px] rounded-lg shadow-xl"
          style={{
            "background-color": "var(--surface-overlay)",
            border: "1px solid var(--border-base)",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <h2 class="text-sm font-semibold" style={{ color: "var(--text-base)" }}>
              Forward Port
            </h2>
            <IconButton
              icon={<Icon name="xmark" class="w-4 h-4" />}
              title="Close"
              variant="ghost"
              size="sm"
              onClick={props.onClose}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} class="p-4 space-y-4">
            {/* Local Port */}
            <div class="space-y-1.5">
              <label
                class="block text-xs font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Local Port
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                value={localPort()}
                onInput={(e) => handleLocalPortChange(e.currentTarget.value)}
                placeholder="e.g., 3000"
                class="w-full px-3 py-2 text-sm rounded"
                style={{
                  "background-color": "var(--surface-base)",
                  border: "1px solid var(--border-base)",
                  color: "var(--text-base)",
                }}
                required
              />
            </div>

            {/* Same Port Toggle */}
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSamePort(!samePort())}
                class="flex items-center gap-2"
                style={{ color: "var(--text-weak)" }}
              >
                <Show
                  when={samePort()}
                  fallback={<Icon name="toggle-off" class="w-5 h-5" />}
                >
                  <Icon name="toggle-on" class="w-5 h-5" style={{ color: "var(--accent)" }} />
                </Show>
                <span class="text-xs">Same local and remote port</span>
              </button>
            </div>

            {/* Remote Port (shown when not same) */}
            <Show when={!samePort()}>
              <div class="space-y-1.5">
                <label
                  class="block text-xs font-medium"
                  style={{ color: "var(--text-weak)" }}
                >
                  Remote Port
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={remotePort()}
                  onInput={(e) => setRemotePort(e.currentTarget.value)}
                  placeholder="e.g., 8080"
                  class="w-full px-3 py-2 text-sm rounded"
                  style={{
                    "background-color": "var(--surface-base)",
                    border: "1px solid var(--border-base)",
                    color: "var(--text-base)",
                  }}
                  required
                />
              </div>
            </Show>

            {/* Remote Host */}
            <div class="space-y-1.5">
              <label
                class="block text-xs font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Remote Host
              </label>
              <input
                type="text"
                value={remoteHost()}
                onInput={(e) => setRemoteHost(e.currentTarget.value)}
                placeholder="localhost"
                class="w-full px-3 py-2 text-sm rounded"
                style={{
                  "background-color": "var(--surface-base)",
                  border: "1px solid var(--border-base)",
                  color: "var(--text-base)",
                }}
              />
              <p class="text-xs" style={{ color: "var(--text-weaker)" }}>
                Usually "localhost" to forward a port from the remote server
              </p>
            </div>

            {/* Error message */}
            <Show when={props.error}>
              <div
                class="px-3 py-2 rounded text-xs"
                style={{
                  "background-color": "rgba(239, 68, 68, 0.1)",
                  color: "var(--error)",
                }}
              >
                {props.error}
              </div>
            </Show>

            {/* Actions */}
            <div class="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={props.onClose} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={props.isLoading}
                disabled={!localPort() || props.isLoading}
              >
                Forward Port
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}

function StatusIcon(props: { status: ForwardedPortStatus }) {
  return (
    <Show
      when={props.status === "active"}
      fallback={
        <Show
          when={props.status === "connecting"}
          fallback={
            <Show
              when={props.status === "error"}
              fallback={
                <Icon name="server" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />
              }
            >
              <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: "var(--error)" }} />
            </Show>
          }
        >
          <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />
        </Show>
      }
    >
      <Icon name="circle-check" class="w-4 h-4" style={{ color: "var(--success)" }} />
    </Show>
  );
}

function StatusText(props: { status: ForwardedPortStatus; error?: string }) {
  const statusText = () => {
    switch (props.status) {
      case "active":
        return "Active";
      case "connecting":
        return "Connecting...";
      case "error":
        return props.error || "Error";
      case "stopped":
        return "Stopped";
      default:
        return "Unknown";
    }
  };

  const statusColor = () => {
    switch (props.status) {
      case "active":
        return "var(--success)";
      case "connecting":
        return "var(--accent)";
      case "error":
        return "var(--error)";
      default:
        return "var(--text-weak)";
    }
  };

  return (
    <span class="text-xs" style={{ color: statusColor() }}>
      {statusText()}
    </span>
  );
}

export function PortForwarding(props: PortForwardingProps) {
  const remote = useRemote();
  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [isAdding, setIsAdding] = createSignal(false);
  const [addError, setAddError] = createSignal<string | null>(null);

  // Get forwarded ports for this connection
  const forwardedPorts = createMemo(() => 
    remote.getForwardedPorts(props.connectionId)
  );

  // Get detected ports (suggestions)
  const detectedPorts = createMemo(() => {
    const forwarded = new Set(forwardedPorts().map((p) => p.remotePort));
    return remote.state.detectedPorts.filter((p) => !forwarded.has(p.port));
  });

  // Listen for port detection events
  onMount(() => {
    const handlePortDetected = (event: CustomEvent<{ connectionId: string; port: { port: number } }>) => {
      if (event.detail.connectionId === props.connectionId) {
        props.onNotification?.(
          "Port Detected",
          `Port ${event.detail.port.port} detected on remote server`
        );
      }
    };

    window.addEventListener("remote:port-detected", handlePortDetected as EventListener);

    onCleanup(() => {
      window.removeEventListener("remote:port-detected", handlePortDetected as EventListener);
    });
  });

  const handleAddPort = async (localPort: number, remotePort: number, remoteHost: string) => {
    setIsAdding(true);
    setAddError(null);

    try {
      await remote.forwardPort(props.connectionId, localPort, remotePort, remoteHost);
      setShowAddDialog(false);
      props.onNotification?.("Port Forwarded", `Port ${localPort} → ${remotePort} forwarded successfully`);
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
      console.error("Failed to stop port forwarding:", e);
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
      console.error("Failed to forward detected port:", e);
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="globe" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span
            class="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--text-weak)" }}
          >
            Forwarded Ports
          </span>
          <Show when={forwardedPorts().length > 0}>
            <span
              class="px-1.5 py-0.5 text-xs rounded"
              style={{
                "background-color": "var(--surface-raised)",
                color: "var(--text-weak)",
              }}
            >
              {forwardedPorts().length}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          {/* Auto-forward toggle */}
          <button
            onClick={() => remote.setAutoForwardPorts(!remote.autoForward())}
            class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title={remote.autoForward() ? "Auto-forward enabled" : "Auto-forward disabled"}
          >
            <Show
              when={remote.autoForward()}
              fallback={<Icon name="toggle-off" class="w-4 h-4" />}
            >
              <Icon name="toggle-on" class="w-4 h-4" style={{ color: "var(--accent)" }} />
            </Show>
            <span>Auto</span>
          </button>
          <IconButton
            icon={<Icon name="plus" class="w-4 h-4" />}
            title="Forward a port"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          />
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        {/* Active Ports Table */}
        <Show
          when={forwardedPorts().length > 0}
          fallback={
            <div class="px-3 py-6 text-center">
              <Icon name="server" class="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-weaker)" }} />
              <p class="text-xs mb-2" style={{ color: "var(--text-weak)" }}>
                No ports forwarded
              </p>
              <button
                onClick={() => setShowAddDialog(true)}
                class="text-xs font-medium"
                style={{ color: "var(--accent)" }}
              >
                + Forward a Port
              </button>
            </div>
          }
        >
          <div class="divide-y" style={{ "border-color": "var(--border-weak)" }}>
            {/* Table Header */}
            <div
              class="grid px-3 py-2 text-xs font-medium uppercase tracking-wide"
              style={{
                "grid-template-columns": "80px 1fr 90px 70px",
                color: "var(--text-weaker)",
                "background-color": "var(--surface-base)",
              }}
            >
              <span>Local</span>
              <span>Remote</span>
              <span>Status</span>
              <span class="text-right">Actions</span>
            </div>

            {/* Table Rows */}
            <For each={forwardedPorts()}>
              {(port) => (
                <div
                  class="grid items-center px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-raised)]"
                  style={{
                    "grid-template-columns": "80px 1fr 90px 70px",
                    "border-color": "var(--border-weak)",
                  }}
                >
                  {/* Local Port */}
                  <span class="font-mono text-xs" style={{ color: "var(--text-base)" }}>
                    :{port.localPort}
                  </span>

                  {/* Remote */}
                  <span class="font-mono text-xs truncate" style={{ color: "var(--text-weak)" }}>
                    {port.remoteHost}:{port.remotePort}
                  </span>

                  {/* Status */}
                  <div class="flex items-center gap-1.5">
                    <StatusIcon status={port.status} />
                    <StatusText status={port.status} error={port.error} />
                  </div>

                  {/* Actions */}
                  <div class="flex items-center justify-end gap-1">
                    <Show when={port.status === "active"}>
                      <IconButton
                        icon={<Icon name="arrow-up-right-from-square" class="w-3.5 h-3.5" />}
                        title="Open in browser"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPort(port.id)}
                      />
                    </Show>
                    <IconButton
                      icon={<Icon name="trash" class="w-3.5 h-3.5" />}
                      title="Stop forwarding"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStopForwarding(port.id)}
                      style={{ color: "var(--error)" }}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Detected Ports Suggestions */}
        <Show when={detectedPorts().length > 0}>
          <div class="mt-2 px-3">
            <div
              class="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: "var(--text-weaker)" }}
            >
              Detected Ports
            </div>
            <div class="space-y-1">
              <For each={detectedPorts()}>
                {(detected) => (
                  <div
                    class="flex items-center justify-between px-2 py-1.5 rounded"
                    style={{
                      "background-color": "var(--surface-raised)",
                      border: "1px solid var(--border-weak)",
                    }}
                  >
                    <div class="flex items-center gap-2">
                      <span
                        class="font-mono text-xs"
                        style={{ color: "var(--text-base)" }}
                      >
                        :{detected.port}
                      </span>
                      <Show when={detected.protocol}>
                        <span
                          class="px-1.5 py-0.5 text-xs rounded"
                          style={{
                            "background-color": "var(--surface-overlay)",
                            color: "var(--text-weak)",
                          }}
                        >
                          {detected.protocol}
                        </span>
                      </Show>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleForwardDetected(detected.port)}
                    >
                      Forward
                    </Button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* Add Port Dialog */}
      <AddPortDialog
        isOpen={showAddDialog()}
        onClose={() => {
          setShowAddDialog(false);
          setAddError(null);
        }}
        onSubmit={handleAddPort}
        isLoading={isAdding()}
        error={addError()}
      />
    </div>
  );
}
