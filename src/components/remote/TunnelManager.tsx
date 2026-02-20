import { createSignal, For, Show, createMemo, onCleanup, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { useRemote, TunnelInfo, TunnelStatus, TunnelAuthProvider } from "@/context/RemoteContext";
import { Button, IconButton } from "@/components/ui";

interface TunnelManagerProps {
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
  onTunnelStatusChange?: (tunnel: TunnelInfo | null) => void;
}

interface CreateTunnelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (localPort: number, authProvider: TunnelAuthProvider) => void;
  isLoading: boolean;
  error: string | null;
}

interface ConnectTunnelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tunnelUrl: string) => void;
  isLoading: boolean;
  error: string | null;
}

function MicrosoftIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="9" height="9" fill="var(--cortex-error)" />
      <rect x="11" y="1" width="9" height="9" fill="var(--cortex-success)" />
      <rect x="1" y="11" width="9" height="9" fill="var(--cortex-info)" />
      <rect x="11" y="11" width="9" height="9" fill="var(--cortex-warning)" />
    </svg>
  );
}

function TunnelStatusIcon(props: { status: TunnelStatus }) {
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
                <Icon name="cloud" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />
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

function TunnelStatusText(props: { status: TunnelStatus; error?: string }) {
  const statusText = () => {
    switch (props.status) {
      case "active":
        return "Active";
      case "connecting":
        return "Connecting...";
      case "error":
        return props.error || "Error";
      case "closing":
        return "Closing...";
      case "inactive":
        return "Inactive";
      default:
        return "Unknown";
    }
  };

  const statusColor = () => {
    switch (props.status) {
      case "active":
        return "var(--success)";
      case "connecting":
      case "closing":
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

function AuthProviderBadge(props: { provider: TunnelAuthProvider }) {
  return (
    <div
      class="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
      style={{
        "background-color": "var(--surface-overlay)",
        color: "var(--text-weak)",
      }}
    >
      <Show
        when={props.provider === "github"}
        fallback={<MicrosoftIcon class="w-3 h-3" />}
      >
        <Icon name="code-branch" class="w-3 h-3" />
      </Show>
      <span class="capitalize">{props.provider}</span>
    </div>
  );
}

function CreateTunnelDialog(props: CreateTunnelDialogProps) {
  const [localPort, setLocalPort] = createSignal("3000");
  const [authProvider, setAuthProvider] = createSignal<TunnelAuthProvider>("github");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const port = parseInt(localPort(), 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      return;
    }

    props.onSubmit(port, authProvider());
  };

  const resetForm = () => {
    setLocalPort("3000");
    setAuthProvider("github");
  };

  createEffect(() => {
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
          class="w-[420px] rounded-lg shadow-xl"
          style={{
            "background-color": "var(--surface-overlay)",
            border: "1px solid var(--border-base)",
          }}
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <h2 class="text-sm font-semibold" style={{ color: "var(--text-base)" }}>
              Create Remote Tunnel
            </h2>
            <IconButton
              icon={<Icon name="xmark" class="w-4 h-4" />}
              title="Close"
              variant="ghost"
              size="sm"
              onClick={props.onClose}
            />
          </div>

          <form onSubmit={handleSubmit} class="p-4 space-y-4">
            <div class="space-y-1.5">
              <label
                class="block text-xs font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Local Port to Expose
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                value={localPort()}
                onInput={(e) => setLocalPort(e.currentTarget.value)}
                placeholder="e.g., 3000"
                class="w-full px-3 py-2 text-sm rounded font-mono"
                style={{
                  "background-color": "var(--surface-base)",
                  border: "1px solid var(--border-base)",
                  color: "var(--text-base)",
                }}
                required
              />
              <p class="text-xs" style={{ color: "var(--text-weaker)" }}>
                The local port running your application (e.g., dev server on port 3000)
              </p>
            </div>

            <div class="space-y-2">
              <label
                class="block text-xs font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Authentication Provider
              </label>
              <p class="text-xs mb-2" style={{ color: "var(--text-weaker)" }}>
                Choose how users will authenticate to access your tunnel
              </p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthProvider("github")}
                  class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    "background-color": authProvider() === "github"
                      ? "var(--accent)"
                      : "var(--surface-base)",
                    color: authProvider() === "github" ? "white" : "var(--text-base)",
                    border: `2px solid ${
                      authProvider() === "github" ? "var(--accent)" : "var(--border-base)"
                    }`,
                  }}
                >
                  <Icon name="code-branch" class="w-5 h-5" />
                  <span>GitHub</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthProvider("microsoft")}
                  class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    "background-color": authProvider() === "microsoft"
                      ? "var(--accent)"
                      : "var(--surface-base)",
                    color: authProvider() === "microsoft" ? "white" : "var(--text-base)",
                    border: `2px solid ${
                      authProvider() === "microsoft" ? "var(--accent)" : "var(--border-base)"
                    }`,
                  }}
                >
                  <MicrosoftIcon class="w-5 h-5" />
                  <span>Microsoft</span>
                </button>
              </div>
            </div>

            <div
              class="px-3 py-2 rounded text-xs"
              style={{
                "background-color": "var(--surface-raised)",
                color: "var(--text-weak)",
              }}
            >
              <p class="font-medium mb-1" style={{ color: "var(--text-base)" }}>
                How Remote Tunnels Work
              </p>
              <ul class="space-y-1 list-disc list-inside">
                <li>Creates a secure tunnel to expose your local port</li>
                <li>Generates a unique URL accessible from any browser</li>
                <li>Requires {authProvider() === "github" ? "GitHub" : "Microsoft"} authentication for security</li>
                <li>Perfect for sharing work-in-progress with collaborators</li>
              </ul>
            </div>

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
                Create Tunnel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}

function ConnectTunnelDialog(props: ConnectTunnelDialogProps) {
  const [tunnelUrl, setTunnelUrl] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const url = tunnelUrl().trim();

    if (!url) {
      return;
    }

    props.onSubmit(url);
  };

  const resetForm = () => {
    setTunnelUrl("");
  };

  createEffect(() => {
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
          class="w-[420px] rounded-lg shadow-xl"
          style={{
            "background-color": "var(--surface-overlay)",
            border: "1px solid var(--border-base)",
          }}
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <h2 class="text-sm font-semibold" style={{ color: "var(--text-base)" }}>
              Connect to Remote Tunnel
            </h2>
            <IconButton
              icon={<Icon name="xmark" class="w-4 h-4" />}
              title="Close"
              variant="ghost"
              size="sm"
              onClick={props.onClose}
            />
          </div>

          <form onSubmit={handleSubmit} class="p-4 space-y-4">
            <div class="space-y-1.5">
              <label
                class="block text-xs font-medium"
                style={{ color: "var(--text-weak)" }}
              >
                Tunnel URL or ID
              </label>
              <input
                type="text"
                value={tunnelUrl()}
                onInput={(e) => setTunnelUrl(e.currentTarget.value)}
                placeholder="https://xxx.devtunnels.ms or tunnel-id"
                class="w-full px-3 py-2 text-sm rounded font-mono"
                style={{
                  "background-color": "var(--surface-base)",
                  border: "1px solid var(--border-base)",
                  color: "var(--text-base)",
                }}
                required
              />
              <p class="text-xs" style={{ color: "var(--text-weaker)" }}>
                Enter the tunnel URL or ID shared with you
              </p>
            </div>

            <div
              class="px-3 py-2 rounded text-xs"
              style={{
                "background-color": "var(--surface-raised)",
                color: "var(--text-weak)",
              }}
            >
              <p>
                You may be prompted to authenticate with GitHub or Microsoft depending on the tunnel's configuration.
              </p>
            </div>

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

            <div class="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={props.onClose} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={props.isLoading}
                disabled={!tunnelUrl().trim() || props.isLoading}
              >
                Connect
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}

export function TunnelManager(props: TunnelManagerProps) {
  const remote = useRemote();
  
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [showConnectDialog, setShowConnectDialog] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [createError, setCreateError] = createSignal<string | null>(null);
  const [connectError, setConnectError] = createSignal<string | null>(null);
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  const tunnels = createMemo(() => remote.getTunnels());
  
  const activeTunnel = createMemo(() => {
    const active = tunnels().find((t) => t.status === "active");
    return active || null;
  });

  createEffect(() => {
    const active = activeTunnel();
    props.onTunnelStatusChange?.(active);
  });

  const copyTimeoutRef: { current: number | null } = { current: null };

  onCleanup(() => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
  });

  const handleCreateTunnel = async (localPort: number, authProvider: TunnelAuthProvider) => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const tunnel = await remote.createTunnel(localPort, authProvider);
      setShowCreateDialog(false);
      props.onNotification?.(
        "Tunnel Created",
        `Tunnel available at ${tunnel.url}`,
        "success"
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setCreateError(errorMsg);
      props.onNotification?.("Failed to Create Tunnel", errorMsg, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnectTunnel = async (tunnelUrl: string) => {
    setIsConnecting(true);
    setConnectError(null);

    try {
      const tunnel = await remote.connectToTunnel(tunnelUrl);
      setShowConnectDialog(false);
      props.onNotification?.(
        "Connected to Tunnel",
        `Successfully connected to ${tunnel.url}`,
        "success"
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setConnectError(errorMsg);
      props.onNotification?.("Failed to Connect", errorMsg, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCloseTunnel = async (tunnelId: string) => {
    try {
      await remote.closeTunnel(tunnelId);
      props.onNotification?.("Tunnel Closed", "The tunnel has been closed", "info");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      props.onNotification?.("Failed to Close Tunnel", errorMsg, "error");
    }
  };

  const handleCopyUrl = async (tunnel: TunnelInfo) => {
    try {
      await navigator.clipboard.writeText(tunnel.url);
      setCopiedId(tunnel.id);
      props.onNotification?.("URL Copied", "Tunnel URL copied to clipboard", "success");
      
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (e) {
      props.onNotification?.("Copy Failed", "Failed to copy URL to clipboard", "error");
    }
  };

  const handleOpenInBrowser = (tunnel: TunnelInfo) => {
    if (tunnel.url) {
      window.open(tunnel.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleRefreshTunnel = async (tunnelId: string) => {
    try {
      await remote.refreshTunnel(tunnelId);
      props.onNotification?.("Tunnel Refreshed", "Tunnel connection refreshed", "success");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      props.onNotification?.("Refresh Failed", errorMsg, "error");
    }
  };

  const formatTimeRemaining = (expiresAt?: number): string => {
    if (!expiresAt) return "";
    
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  return (
    <div class="flex flex-col h-full">
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="cloud" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span
            class="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--text-weak)" }}
          >
            Remote Tunnels
          </span>
          <Show when={tunnels().length > 0}>
            <span
              class="px-1.5 py-0.5 text-xs rounded"
              style={{
                "background-color": "var(--surface-raised)",
                color: "var(--text-weak)",
              }}
            >
              {tunnels().length}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <IconButton
            icon={<Icon name="link" class="w-4 h-4" />}
            title="Connect to existing tunnel"
            variant="ghost"
            size="sm"
            onClick={() => setShowConnectDialog(true)}
          />
          <IconButton
            icon={<Icon name="plus" class="w-4 h-4" />}
            title="Create new tunnel"
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={tunnels().length > 0}
          fallback={
            <div class="px-3 py-6 text-center">
              <Icon name="cloud" class="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-weaker)" }} />
              <p class="text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                No active tunnels
              </p>
              <p class="text-xs mb-3" style={{ color: "var(--text-weaker)" }}>
                Create a tunnel to share your local development server
              </p>
              <div class="flex justify-center gap-2">
                <button
                  onClick={() => setShowConnectDialog(true)}
                  class="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                  style={{ 
                    color: "var(--text-base)",
                    "background-color": "var(--surface-raised)",
                  }}
                >
                  <Icon name="link" class="inline w-3 h-3 mr-1" />
                  Connect
                </button>
                <button
                  onClick={() => setShowCreateDialog(true)}
                  class="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                  style={{ 
                    color: "white",
                    "background-color": "var(--accent)",
                  }}
                >
                  <Icon name="plus" class="inline w-3 h-3 mr-1" />
                  Create Tunnel
                </button>
              </div>
            </div>
          }
        >
          <div class="divide-y" style={{ "border-color": "var(--border-weak)" }}>
            <For each={tunnels()}>
              {(tunnel) => (
                <div
                  class="px-3 py-3 transition-colors hover:bg-[var(--surface-raised)]"
                  style={{ "border-color": "var(--border-weak)" }}
                >
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <TunnelStatusIcon status={tunnel.status} />
                      <TunnelStatusText status={tunnel.status} error={tunnel.error} />
                      <AuthProviderBadge provider={tunnel.authProvider} />
                    </div>
                    <div class="flex items-center gap-1">
                      <Show when={tunnel.status === "active"}>
                        <IconButton
                          icon={<Icon name="rotate" class="w-3.5 h-3.5" />}
                          title="Refresh tunnel"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRefreshTunnel(tunnel.id)}
                        />
                        <IconButton
                          icon={<Icon name="arrow-up-right-from-square" class="w-3.5 h-3.5" />}
                          title="Open in browser"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenInBrowser(tunnel)}
                        />
                        <IconButton
                          icon={
                            copiedId() === tunnel.id ? (
                              <Icon name="circle-check" class="w-3.5 h-3.5" />
                            ) : (
                              <Icon name="copy" class="w-3.5 h-3.5" />
                            )
                          }
                          title={copiedId() === tunnel.id ? "Copied!" : "Copy URL"}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(tunnel)}
                        />
                      </Show>
                      <IconButton
                        icon={<Icon name="trash" class="w-3.5 h-3.5" />}
                        title="Close tunnel"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCloseTunnel(tunnel.id)}
                        style={{ color: "var(--error)" }}
                      />
                    </div>
                  </div>

                  <Show when={tunnel.url}>
                    <div
                      class="flex items-center gap-2 px-2 py-1.5 rounded mb-2 cursor-pointer group"
                      style={{
                        "background-color": "var(--surface-base)",
                        border: "1px solid var(--border-weak)",
                      }}
                      onClick={() => handleCopyUrl(tunnel)}
                      title="Click to copy URL"
                    >
                      <Icon name="link" class="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-weak)" }} />
                      <span
                        class="font-mono text-xs truncate flex-1"
                        style={{ color: "var(--text-base)" }}
                      >
                        {tunnel.url}
                      </span>
                      <Icon
                        name="copy"
                        class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: "var(--text-weak)" }}
                      />
                    </div>
                  </Show>

                  <div class="flex items-center justify-between text-xs" style={{ color: "var(--text-weaker)" }}>
                    <span>Port {tunnel.localPort}</span>
                    <Show when={tunnel.expiresAt}>
                      <span>{formatTimeRemaining(tunnel.expiresAt)}</span>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <CreateTunnelDialog
        isOpen={showCreateDialog()}
        onClose={() => {
          setShowCreateDialog(false);
          setCreateError(null);
        }}
        onSubmit={handleCreateTunnel}
        isLoading={isCreating()}
        error={createError()}
      />

      <ConnectTunnelDialog
        isOpen={showConnectDialog()}
        onClose={() => {
          setShowConnectDialog(false);
          setConnectError(null);
        }}
        onSubmit={handleConnectTunnel}
        isLoading={isConnecting()}
        error={connectError()}
      />
    </div>
  );
}

export function TunnelStatusBar(props: { tunnel: TunnelInfo | null; onCopy?: () => void }) {
  const handleCopy = async () => {
    if (props.tunnel?.url) {
      try {
        await navigator.clipboard.writeText(props.tunnel.url);
        props.onCopy?.();
      } catch (e) {
        console.error("Failed to copy tunnel URL:", e);
      }
    }
  };

  return (
    <Show when={props.tunnel}>
      {(tunnel) => (
        <div
          class="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-[var(--surface-raised)] transition-colors rounded"
          onClick={handleCopy}
          title="Click to copy tunnel URL"
        >
          <TunnelStatusIcon status={tunnel().status} />
          <span class="font-mono truncate max-w-[200px]" style={{ color: "var(--text-base)" }}>
            {tunnel().url ? new URL(tunnel().url).hostname : "Tunnel"}
          </span>
          <span style={{ color: "var(--text-weaker)" }}>:{tunnel().localPort}</span>
        </div>
      )}
    </Show>
  );
}

