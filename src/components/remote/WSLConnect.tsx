import { createSignal, For, Show, onMount } from "solid-js";
import { Icon } from "../ui/Icon";
import { useRemote, WSLDistro, WSLConnectionStatus } from "@/context/RemoteContext";

interface WSLConnectProps {
  onFolderOpened?: (distro: string, path: string) => void;
  onTerminalOpened?: (distro: string) => void;
}

export function WSLConnect(props: WSLConnectProps) {
  const remote = useRemote();
  const [isDetecting, setIsDetecting] = createSignal(false);
  const [selectedDistro, setSelectedDistro] = createSignal<string | null>(null);
  const [folderPath, setFolderPath] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    if (remote.state.wslDistros.length === 0) {
      await handleDetectWSL();
    }
  });

  const handleDetectWSL = async () => {
    setIsDetecting(true);
    setError(null);
    try {
      await remote.detectWSL();
    } catch (e) {
      setError(`Failed to detect WSL: ${String(e)}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleConnect = async (distroName: string) => {
    setError(null);
    try {
      await remote.connectToWSL(distroName);
    } catch (e) {
      setError(`Failed to connect to ${distroName}: ${String(e)}`);
    }
  };

  const handleDisconnect = async (distroName: string) => {
    setError(null);
    try {
      await remote.disconnectFromWSL(distroName);
    } catch (e) {
      setError(`Failed to disconnect from ${distroName}: ${String(e)}`);
    }
  };

  const handleOpenFolder = async (distro: WSLDistro) => {
    if (!folderPath().trim()) {
      setError("Please enter a folder path");
      return;
    }
    setError(null);
    try {
      await remote.openFolderInWSL(distro.name, folderPath());
      props.onFolderOpened?.(distro.name, folderPath());
    } catch (e) {
      setError(`Failed to open folder: ${String(e)}`);
    }
  };

  const handleOpenTerminal = async (distro: WSLDistro) => {
    setError(null);
    try {
      await remote.openTerminalInWSL(distro.name);
      props.onTerminalOpened?.(distro.name);
    } catch (e) {
      setError(`Failed to open terminal: ${String(e)}`);
    }
  };

  const getStatusIcon = (status: WSLConnectionStatus) => {
    switch (status) {
      case "connected":
        return <Icon name="wifi" class="w-4 h-4" style={{ color: "var(--success)" }} />;
      case "connecting":
        return <Icon name="rotate" class="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />;
      case "error":
        return <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: "var(--error)" }} />;
      default:
        return <Icon name="wifi-slash" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />;
    }
  };

  const getStatusText = (status: WSLConnectionStatus) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <span class="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-weak)" }}>
          WSL Distributions
        </span>
        <button
          onClick={handleDetectWSL}
          disabled={isDetecting()}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
          style={{ color: "var(--text-weak)" }}
          title="Refresh WSL distributions"
        >
          <Icon name="rotate" class={`w-4 h-4 ${isDetecting() ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error Display */}
      <Show when={error()}>
        <div
          class="mx-3 mt-2 px-3 py-2 rounded-md text-xs"
          style={{
            "background-color": "var(--error-bg)",
            "color": "var(--error)",
            "border": "1px solid var(--error)",
          }}
        >
          {error()}
        </div>
      </Show>

      {/* WSL Not Available */}
      <Show when={!remote.state.wslAvailable && !isDetecting()}>
        <div class="px-3 py-4 text-center">
          <Icon name="desktop" class="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-weaker)" }} />
          <p class="text-xs" style={{ color: "var(--text-weak)" }}>
            WSL is not available on this system
          </p>
          <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
            Install WSL to use this feature
          </p>
          <button
            onClick={handleDetectWSL}
            class="mt-3 text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            Retry Detection
          </button>
        </div>
      </Show>

      {/* Distro List */}
      <Show when={remote.state.wslAvailable}>
        <div class="flex-1 overflow-y-auto py-1">
          <Show
            when={remote.state.wslDistros.length > 0}
            fallback={
              <div class="px-3 py-4 text-center">
                <Icon name="desktop" class="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-weaker)" }} />
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  No WSL distributions found
                </p>
                <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
                  Install a distribution from the Microsoft Store
                </p>
              </div>
            }
          >
            <For each={remote.state.wslDistros}>
              {(distro) => {
                const isExpanded = () => selectedDistro() === distro.name;
                const isConnected = () => distro.status === "connected";
                const isConnecting = () => distro.status === "connecting";

                return (
                  <div
                    class="border-b last:border-b-0"
                    style={{ "border-color": "var(--border-weak)" }}
                  >
                    {/* Distro Header Row */}
                    <button
                      onClick={() => setSelectedDistro(isExpanded() ? null : distro.name)}
                      class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-raised)]"
                    >
                      {/* Status Icon */}
                      <div class="w-5 h-5 flex items-center justify-center">
                        {getStatusIcon(distro.status)}
                      </div>

                      {/* Distro Info */}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                            {distro.name}
                          </span>
                          <Show when={distro.isDefault}>
                            <span
                              class="px-1.5 py-0.5 text-[10px] font-medium rounded"
                              style={{
                                "background-color": "var(--accent)",
                                "color": "white",
                              }}
                            >
                              Default
                            </span>
                          </Show>
                        </div>
                        <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                          {distro.version === 2 ? "WSL 2" : "WSL 1"} • {getStatusText(distro.status)}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div class="flex items-center gap-1">
                        <Show when={!isConnected() && !isConnecting()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnect(distro.name);
                            }}
                            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-overlay)]"
                            style={{ color: "var(--accent)" }}
                            title="Connect"
                          >
                            <Icon name="wifi" class="w-4 h-4" />
                          </button>
                        </Show>
                        <Show when={isConnected()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnect(distro.name);
                            }}
                            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-overlay)]"
                            style={{ color: "var(--text-weak)" }}
                            title="Disconnect"
                          >
                            <Icon name="wifi-slash" class="w-4 h-4" />
                          </button>
                        </Show>
                      </div>
                    </button>

                    {/* Expanded Actions Panel */}
                    <Show when={isExpanded()}>
                      <div
                        class="px-3 pb-3 space-y-3"
                        style={{ "background-color": "var(--surface-raised)" }}
                      >
                        {/* Open Folder Section */}
                        <div class="space-y-1.5">
                          <label class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                            Open Folder in WSL
                          </label>
                          <div class="flex gap-2">
                            <input
                              type="text"
                              value={folderPath()}
                              onInput={(e) => setFolderPath(e.currentTarget.value)}
                              placeholder="/home/user/projects"
                              class="flex-1 px-2 py-1.5 rounded text-xs"
                              style={{
                                "background-color": "var(--surface-base)",
                                "border": "1px solid var(--border-base)",
                                "color": "var(--text-base)",
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleOpenFolder(distro);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleOpenFolder(distro)}
                              disabled={!folderPath().trim()}
                              class="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                              style={{
                                "background-color": "var(--accent)",
                                "color": "white",
                              }}
                            >
                              <Icon name="folder" class="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div class="flex gap-2">
                          <button
                            onClick={() => handleOpenTerminal(distro)}
                            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors hover:opacity-90"
                            style={{
                              "background-color": "var(--surface-overlay)",
                              "color": "var(--text-base)",
                              "border": "1px solid var(--border-base)",
                            }}
                          >
                            <Icon name="terminal" class="w-3.5 h-3.5" />
                            Open Terminal
                          </button>
                          <Show when={!isConnected()}>
                            <button
                              onClick={() => handleConnect(distro.name)}
                              disabled={isConnecting()}
                              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                              style={{
                                "background-color": "var(--accent)",
                                "color": "white",
                              }}
                            >
                              <Show when={isConnecting()} fallback={<Icon name="wifi" class="w-3.5 h-3.5" />}>
                                <Icon name="rotate" class="w-3.5 h-3.5 animate-spin" />
                              </Show>
                              {isConnecting() ? "Connecting..." : "Connect"}
                            </button>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={isDetecting() && remote.state.wslDistros.length === 0}>
        <div class="px-3 py-4 text-center">
          <Icon name="rotate" class="w-6 h-6 mx-auto mb-2 animate-spin" style={{ color: "var(--accent)" }} />
          <p class="text-xs" style={{ color: "var(--text-weak)" }}>
            Detecting WSL distributions...
          </p>
        </div>
      </Show>
    </div>
  );
}

/**
 * WSL Status indicator for the status bar
 * Displays the currently connected WSL distribution
 */
export function WSLStatusIndicator() {
  const remote = useRemote();

  const activeWSL = () => {
    return remote.state.wslDistros.find((d) => d.status === "connected");
  };

  return (
    <Show when={activeWSL()}>
      <button
        class="flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors hover:bg-[rgba(255,255,255,0.06)]"
        style={{ color: "var(--text-weak)" }}
        title={`Connected to WSL: ${activeWSL()?.name}`}
        onClick={() => window.dispatchEvent(new CustomEvent("remote:show-wsl"))}
      >
        <Icon name="desktop" class="w-3 h-3" style={{ color: "var(--success)" }} />
        <span style={{ "font-size": "11px" }}>WSL: {activeWSL()?.name}</span>
      </button>
    </Show>
  );
}
