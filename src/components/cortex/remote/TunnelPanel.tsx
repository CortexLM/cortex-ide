import { Component, createSignal, For, Show } from "solid-js";
import { useTunnel, type TunnelAuthProvider, type TunnelStatus } from "@/context/TunnelContext";

const statusBadgeClasses: Record<TunnelStatus, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  connecting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  closing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const statusLabels: Record<TunnelStatus, string> = {
  active: "Active",
  connecting: "Connecting",
  error: "Error",
  inactive: "Inactive",
  closing: "Closing",
};

export const TunnelPanel: Component = () => {
  const tunnel = useTunnel();

  const [newPort, setNewPort] = createSignal(3000);
  const [authProvider, setAuthProvider] = createSignal<TunnelAuthProvider>("github");
  const [tunnelUrl, setTunnelUrl] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);

  const handleCreateTunnel = async () => {
    setIsCreating(true);
    try {
      await tunnel.createTunnel(newPort(), authProvider());
    } catch {
      // Error is set in context state
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnectTunnel = async () => {
    const url = tunnelUrl().trim();
    if (!url) return;
    setIsCreating(true);
    try {
      await tunnel.connectToTunnel(url);
      setTunnelUrl("");
    } catch {
      // Error is set in context state
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
  };

  const handleDisconnect = (tunnelId: string) => {
    void tunnel.disconnectTunnel(tunnelId);
  };

  return (
    <div class="flex flex-col h-full bg-[#1e1e1e] text-white text-sm">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-white/70" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a4 4 0 0 0-4 4v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 5V5a2 2 0 1 0-4 0v1h4z" />
          </svg>
          <span class="font-medium">Remote Tunnels</span>
        </div>
        <button
          class="p-1 rounded hover:bg-white/10 text-white/60 transition-colors"
          onClick={() => void tunnel.refreshTunnels()}
          title="Refresh"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.5 2a.5.5 0 0 0-.5.5V5a5 5 0 1 0-1.07 5.5.5.5 0 0 0-.76-.65A4 4 0 1 1 12 5.5H9.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-auto">
        {/* Error Display */}
        <Show when={tunnel.state.error}>
          <div class="mx-4 mt-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {tunnel.state.error}
          </div>
        </Show>

        {/* Create Tunnel Form */}
        <div class="px-4 py-3 border-b border-white/10">
          <div class="text-xs text-white/50 uppercase tracking-wide mb-2">Create Tunnel</div>
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <input
                type="number"
                min={1}
                max={65535}
                value={newPort()}
                onInput={(e) => setNewPort(parseInt(e.currentTarget.value, 10) || 3000)}
                class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                placeholder="Port"
              />
              <select
                value={authProvider()}
                onChange={(e) => setAuthProvider(e.currentTarget.value as TunnelAuthProvider)}
                class="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="github">GitHub</option>
                <option value="microsoft">Microsoft</option>
              </select>
            </div>
            <button
              onClick={handleCreateTunnel}
              disabled={isCreating() || tunnel.state.isLoading}
              class="w-full py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating() ? "Creating..." : "Create Tunnel"}
            </button>
          </div>
        </div>

        {/* Connect to Existing Tunnel */}
        <div class="px-4 py-3 border-b border-white/10">
          <div class="text-xs text-white/50 uppercase tracking-wide mb-2">Connect to Tunnel</div>
          <div class="flex gap-2">
            <input
              type="text"
              value={tunnelUrl()}
              onInput={(e) => setTunnelUrl(e.currentTarget.value)}
              class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="Tunnel URL"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleConnectTunnel();
              }}
            />
            <button
              onClick={handleConnectTunnel}
              disabled={!tunnelUrl().trim() || isCreating()}
              class="px-3 py-1.5 rounded text-sm font-medium bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Connect
            </button>
          </div>
        </div>

        {/* Active Tunnels List */}
        <div class="px-4 py-3">
          <div class="text-xs text-white/50 uppercase tracking-wide mb-2">
            Active Tunnels ({tunnel.activeTunnelCount()})
          </div>
          <Show
            when={tunnel.state.tunnels.length > 0}
            fallback={
              <div class="text-center text-white/30 text-xs py-6">
                No active tunnels
              </div>
            }
          >
            <div class="flex flex-col gap-2" style={{ opacity: tunnel.state.isLoading ? "0.6" : "1" }}>
              <For each={tunnel.state.tunnels}>
                {(t) => (
                  <div class="bg-white/5 rounded-lg border border-white/10 p-3">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium truncate">{t.name || `Port ${t.localPort}`}</span>
                      <span
                        class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusBadgeClasses[t.status]}`}
                      >
                        {statusLabels[t.status]}
                      </span>
                    </div>
                    <Show when={t.url}>
                      <div class="flex items-center gap-1.5 mb-2">
                        <span class="text-xs text-white/50 truncate flex-1">{t.url}</span>
                        <button
                          onClick={() => handleCopyUrl(t.url)}
                          class="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
                          title="Copy URL"
                        >
                          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z" />
                            <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1H8v1H2V6h1V5H2z" />
                          </svg>
                        </button>
                      </div>
                    </Show>
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-white/40">Port {t.localPort}</span>
                      <button
                        onClick={() => handleDisconnect(t.id)}
                        disabled={t.status === "closing"}
                        class="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                    <Show when={t.error}>
                      <div class="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                        {t.error}
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default TunnelPanel;
