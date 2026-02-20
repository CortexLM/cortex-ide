import { createSignal, For, Show, onMount } from "solid-js";
import { Icon } from "../ui/Icon";
import { ConnectionProfile, ConnectionInfo, useRemote, WSLDistro } from "@/context/RemoteContext";

interface RemoteHostsListProps {
  onNewConnection: () => void;
  onEditProfile: (profile: ConnectionProfile) => void;
  onSelectConnection: (connectionId: string) => void;
}

// Linux distro icon component
function LinuxIcon(props: { distro: string; class?: string }) {
  const getIcon = () => {
    const lower = props.distro.toLowerCase();
    if (lower.includes("ubuntu")) return "🐧";
    if (lower.includes("debian")) return "🌀";
    if (lower.includes("fedora")) return "🎩";
    if (lower.includes("arch")) return "🔷";
    if (lower.includes("alpine")) return "🏔️";
    if (lower.includes("kali")) return "🐉";
    return "🐧";
  };

  return <span class={props.class}>{getIcon()}</span>;
}

export function RemoteHostsList(props: RemoteHostsListProps) {
  const remote = useRemote();
  const [menuOpenId, setMenuOpenId] = createSignal<string | null>(null);
  const [connectingId, setConnectingId] = createSignal<string | null>(null);
  const [wslConnectingId, setWslConnectingId] = createSignal<string | null>(null);
  const [wslMenuOpenId, setWslMenuOpenId] = createSignal<string | null>(null);

  // Detect WSL on mount
  onMount(() => {
    remote.detectWSL();
  });

  const getConnectionStatus = (profileId: string): ConnectionInfo | undefined => {
    return remote.state.connections.find((c) => c.id === profileId);
  };

  const isConnected = (profileId: string): boolean => {
    const conn = getConnectionStatus(profileId);
    return conn?.status === "connected";
  };

  const isConnecting = (profileId: string): boolean => {
    const conn = getConnectionStatus(profileId);
    return conn?.status === "connecting" || conn?.status === "reconnecting" || connectingId() === profileId;
  };

  const hasError = (profileId: string): { message: string } | null => {
    const conn = getConnectionStatus(profileId);
    if (conn?.status && typeof conn.status === "object" && "error" in conn.status) {
      return conn.status.error;
    }
    return null;
  };

  const handleConnect = async (profile: ConnectionProfile) => {
    setConnectingId(profile.id);
    try {
      await remote.connect(profile);
      props.onSelectConnection(profile.id);
    } catch (e) {
      console.error("Failed to connect:", e);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await remote.disconnect(connectionId);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
  };

  const handleReconnect = async (connectionId: string) => {
    setConnectingId(connectionId);
    try {
      await remote.reconnect(connectionId);
      props.onSelectConnection(connectionId);
    } catch (e) {
      console.error("Failed to reconnect:", e);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDelete = async (profileId: string) => {
    if (isConnected(profileId)) {
      await handleDisconnect(profileId);
    }
    try {
      await remote.deleteProfile(profileId);
    } catch (e) {
      console.error("Failed to delete profile:", e);
    }
    setMenuOpenId(null);
  };

  // WSL helpers
  const isWSLConnected = (distroName: string): boolean => {
    const distro = remote.state.wslDistros.find((d) => d.name === distroName);
    return distro?.status === "connected";
  };

  const isWSLConnecting = (distroName: string): boolean => {
    const distro = remote.state.wslDistros.find((d) => d.name === distroName);
    return distro?.status === "connecting" || wslConnectingId() === distroName;
  };

  const getWSLError = (distroName: string): string | undefined => {
    const distro = remote.state.wslDistros.find((d) => d.name === distroName);
    return distro?.status === "error" ? distro.error : undefined;
  };

  const handleWSLConnect = async (distro: WSLDistro) => {
    setWslConnectingId(distro.name);
    try {
      await remote.connectToWSL(distro.name);
    } catch (e) {
      console.error("Failed to connect to WSL:", e);
    } finally {
      setWslConnectingId(null);
    }
  };

  const handleWSLDisconnect = async (distroName: string) => {
    try {
      await remote.disconnectFromWSL(distroName);
    } catch (e) {
      console.error("Failed to disconnect from WSL:", e);
    }
  };

  const handleOpenWSLTerminal = async (distroName: string) => {
    try {
      await remote.openTerminalInWSL(distroName);
    } catch (e) {
      console.error("Failed to open WSL terminal:", e);
    }
    setWslMenuOpenId(null);
  };

  const handleOpenWSLFolder = async (distroName: string) => {
    try {
      await remote.openFolderInWSL(distroName, "~");
    } catch (e) {
      console.error("Failed to open WSL folder:", e);
    }
    setWslMenuOpenId(null);
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <span class="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-weak)" }}>
          Remote Hosts
        </span>
        <button
          onClick={props.onNewConnection}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Add SSH connection"
        >
          <Icon name="plus" class="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div class="flex-1 overflow-y-auto py-1">
        <Show
          when={remote.state.profiles.length > 0}
          fallback={
            <div class="px-3 py-4 text-center">
              <Icon name="server" class="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-weaker)" }} />
              <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                No saved connections
              </p>
              <button
                onClick={props.onNewConnection}
                class="mt-2 text-xs font-medium"
                style={{ color: "var(--accent)" }}
              >
                + Add SSH Host
              </button>
            </div>
          }
        >
          <For each={remote.state.profiles}>
            {(profile) => {
              const connected = () => isConnected(profile.id);
              const connecting = () => isConnecting(profile.id);
              const error = () => hasError(profile.id);
              const isActive = () => remote.state.activeConnectionId === profile.id;

              return (
                <div
                  class="relative group"
                  classList={{
                    "bg-[var(--surface-raised)]": isActive() && connected(),
                  }}
                >
                  <button
                    onClick={() => {
                      if (connected()) {
                        props.onSelectConnection(profile.id);
                      } else {
                        handleConnect(profile);
                      }
                    }}
                    disabled={connecting()}
                    class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
                  >
                    {/* Status icon */}
                    <div class="w-5 h-5 flex items-center justify-center">
                      <Show
                        when={!connecting()}
                        fallback={
                          <Icon name="rotate" class="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />
                        }
                      >
                        <Show
                          when={connected()}
                          fallback={
                            <Show
                              when={error()}
                              fallback={
                                <Icon name="wifi-slash" class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />
                              }
                            >
                              <Icon name="wifi-slash" class="w-4 h-4" style={{ color: "var(--error)" }} />
                            </Show>
                          }
                        >
                          <Icon name="wifi" class="w-4 h-4" style={{ color: "var(--success)" }} />
                        </Show>
                      </Show>
                    </div>

                    {/* Connection info */}
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                        {profile.name}
                      </div>
                      <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                        {profile.username}@{profile.host}:{profile.port}
                      </div>
                      <Show when={error()}>
                        <div class="text-xs truncate" style={{ color: "var(--error)" }}>
                          {error()?.message}
                        </div>
                      </Show>
                    </div>

                    {/* Menu button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId() === profile.id ? null : profile.id);
                      }}
                      class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface-overlay)]"
                      style={{ color: "var(--text-weak)" }}
                    >
                      <Icon name="ellipsis-vertical" class="w-4 h-4" />
                    </button>
                  </button>

                  {/* Dropdown menu */}
                  <Show when={menuOpenId() === profile.id}>
                    <div
                      class="absolute right-2 top-full z-10 py-1 rounded-md shadow-lg min-w-[150px]"
                      style={{
                        "background-color": "var(--surface-overlay)",
                        "border": "1px solid var(--border-base)",
                      }}
                    >
                      <Show when={connected()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnect(profile.id);
                            setMenuOpenId(null);
                          }}
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                          style={{ color: "var(--text-base)" }}
                        >
                          <Icon name="wifi-slash" class="w-4 h-4" />
                          Disconnect
                        </button>
                      </Show>
                      <Show when={error()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReconnect(profile.id);
                            setMenuOpenId(null);
                          }}
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                          style={{ color: "var(--text-base)" }}
                        >
                          <Icon name="rotate" class="w-4 h-4" />
                          Reconnect
                        </button>
                      </Show>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onEditProfile(profile);
                          setMenuOpenId(null);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ color: "var(--text-base)" }}
                      >
                        <Icon name="pen" class="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(profile.id);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ color: "var(--error)" }}
                      >
                        <Icon name="trash" class="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* WSL Section */}
      <Show when={remote.state.wslAvailable && remote.state.wslDistros.length > 0}>
        <div
          class="border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          {/* WSL Header */}
          <div
            class="flex items-center justify-between px-3 py-2 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <span class="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-weak)" }}>
              WSL Distributions
            </span>
            <button
              onClick={() => remote.detectWSL()}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Refresh WSL distributions"
            >
              <Icon name="rotate" class="w-3.5 h-3.5" />
            </button>
          </div>

          {/* WSL Distro List */}
          <div class="py-1">
            <For each={remote.state.wslDistros}>
              {(distro) => {
                const connected = () => isWSLConnected(distro.name);
                const connecting = () => isWSLConnecting(distro.name);
                const error = () => getWSLError(distro.name);
                const isActive = () => remote.state.activeWSLDistro === distro.name;

                return (
                  <div
                    class="relative group"
                    classList={{
                      "bg-[var(--surface-raised)]": isActive() && connected(),
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!connected()) {
                          handleWSLConnect(distro);
                        }
                      }}
                      disabled={connecting()}
                      class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
                    >
                      {/* Distro icon */}
                      <div class="w-5 h-5 flex items-center justify-center">
                        <Show
                          when={!connecting()}
                          fallback={
                            <Icon name="rotate" class="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />
                          }
                        >
                          <LinuxIcon distro={distro.name} class="text-base" />
                        </Show>
                      </div>

                      {/* Distro info */}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                            {distro.name}
                          </span>
                          <Show when={distro.isDefault}>
                            <span
                              class="text-[10px] px-1.5 py-0.5 rounded"
                              style={{
                                "background-color": "var(--accent-translucent)",
                                color: "var(--accent)",
                              }}
                            >
                              Default
                            </span>
                          </Show>
                        </div>
                        <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                          WSL{distro.version}
                          <Show when={connected()}>
                            <span style={{ color: "var(--success)" }}> • Connected</span>
                          </Show>
                        </div>
                        <Show when={error()}>
                          <div class="text-xs truncate" style={{ color: "var(--error)" }}>
                            {error()}
                          </div>
                        </Show>
                      </div>

                      {/* Status indicator */}
                      <Show when={connected()}>
                        <div class="w-2 h-2 rounded-full" style={{ "background-color": "var(--success)" }} />
                      </Show>

                      {/* Menu button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWslMenuOpenId(wslMenuOpenId() === distro.name ? null : distro.name);
                        }}
                        class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface-overlay)]"
                        style={{ color: "var(--text-weak)" }}
                      >
                        <Icon name="ellipsis-vertical" class="w-4 h-4" />
                      </button>
                    </button>

                    {/* WSL Dropdown menu */}
                    <Show when={wslMenuOpenId() === distro.name}>
                      <div
                        class="absolute right-2 top-full z-10 py-1 rounded-md shadow-lg min-w-[150px]"
                        style={{
                          "background-color": "var(--surface-overlay)",
                          "border": "1px solid var(--border-base)",
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWSLTerminal(distro.name);
                          }}
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                          style={{ color: "var(--text-base)" }}
                        >
                          <Icon name="terminal" class="w-4 h-4" />
                          Open Terminal
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWSLFolder(distro.name);
                          }}
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                          style={{ color: "var(--text-base)" }}
                        >
                          <Icon name="folder" class="w-4 h-4" />
                          Open in Explorer
                        </button>
                        <Show when={connected()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWSLDisconnect(distro.name);
                              setWslMenuOpenId(null);
                            }}
                            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--surface-raised)]"
                            style={{ color: "var(--text-base)" }}
                          >
                            <Icon name="wifi-slash" class="w-4 h-4" />
                            Disconnect
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
