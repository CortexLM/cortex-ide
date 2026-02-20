/**
 * SSH Connection Manager
 *
 * Panel showing all active SSH connections and saved profiles.
 * Features:
 * - List of active connections with status
 * - Disconnect button per connection
 * - Connection details (host, user, uptime)
 * - New connection button
 * - Saved profiles management
 * - Connection health monitoring
 */

import {
  createSignal,
  For,
  Show,
  onMount,
  onCleanup,
  createMemo,
} from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useRemote,
  ConnectionProfile,
  ConnectionStatus,
} from "@/context/RemoteContext";
import { useTerminals, SSHTerminalInfo } from "@/context/TerminalsContext";
import { SSHConnectionDialog } from "./SSHConnectionDialog";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

export interface SSHConnectionManagerProps {
  /** Called when a terminal is opened for a connection */
  onOpenTerminal?: (connectionId: string) => void;
  /** Show header with title */
  showHeader?: boolean;
  /** Custom class name */
  class?: string;
  /** View mode */
  defaultView?: "list" | "grid";
  /** Show search bar */
  showSearch?: boolean;
}

type SortOption = "name" | "lastConnected" | "host";

// ============================================================================
// Component
// ============================================================================

export function SSHConnectionManager(props: SSHConnectionManagerProps) {
  const remote = useRemote();
  const terminals = useTerminals();

  // State
  const [showDialog, setShowDialog] = createSignal(false);
  const [editingProfile, setEditingProfile] = createSignal<
    ConnectionProfile | undefined
  >(undefined);
  const [sshSessions, setSSHSessions] = createSignal<SSHTerminalInfo[]>([]);
  const [refreshing, setRefreshing] = createSignal(false);
  const [expandedSections, setExpandedSections] = createSignal<{
    active: boolean;
    saved: boolean;
  }>({ active: true, saved: true });
  const [viewMode, setViewMode] = createSignal<"list" | "grid">(
    props.defaultView || "list"
  );
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortBy] = createSignal<SortOption>("name");
  const [contextMenu, setContextMenu] = createSignal<{
    profile: ConnectionProfile;
    x: number;
    y: number;
  } | null>(null);

  // Refresh interval
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // ============================================================================
  // Data Loading
  // ============================================================================

  const refreshSessions = async () => {
    try {
      const sessions = await terminals.listSSHSessions();
      setSSHSessions(sessions);
    } catch (e) {
      console.error("[SSHConnectionManager] Failed to refresh sessions:", e);
    }
  };

  onMount(() => {
    refreshSessions();
    remote.loadProfiles();

    // Refresh every 10 seconds
    refreshInterval = setInterval(refreshSessions, 10000);
  });

  onCleanup(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // ============================================================================
  // Computed Values
  // ============================================================================

  const filteredProfiles = createMemo(() => {
    let profiles = [...remote.state.profiles];

    // Filter by search query
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      profiles = profiles.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.host.toLowerCase().includes(query) ||
          p.username.toLowerCase().includes(query)
      );
    }

    // Sort
    profiles.sort((a, b) => {
      switch (sortBy()) {
        case "name":
          return a.name.localeCompare(b.name);
        case "host":
          return a.host.localeCompare(b.host);
        case "lastConnected":
          // Would need lastConnected field in profile
          return 0;
        default:
          return 0;
      }
    });

    return profiles;
  });

  const activeSessions = createMemo(() => sshSessions());

  // ============================================================================
  // Actions
  // ============================================================================



  const handleDisconnect = async (connectionId: string) => {
    try {
      await remote.disconnect(connectionId);
      await refreshSessions();
    } catch (e) {
      console.error("[SSHConnectionManager] Disconnect failed:", e);
    }
  };

  const handleOpenTerminal = async (profile: ConnectionProfile) => {
    try {
      // Check if we already have an SSH terminal for this profile
      const sessions = sshSessions();
      const existingSession = sessions.find(
        (s) =>
          s.host === profile.host &&
          s.port === profile.port &&
          s.username === profile.username
      );

      if (existingSession) {
        // Just notify the caller to focus existing terminal
        props.onOpenTerminal?.(existingSession.id);
        return;
      }

      // Create new SSH terminal
      const terminalInfo = await terminals.createSSHTerminal(
        {
          host: profile.host,
          port: profile.port,
          username: profile.username,
          auth_method: profile.auth_method,
          profile_id: profile.id,
          initial_cwd: profile.default_directory,
        },
        profile.name
      );

      props.onOpenTerminal?.(terminalInfo.id);
      await refreshSessions();
    } catch (e) {
      console.error("[SSHConnectionManager] Failed to open terminal:", e);
    }
  };

  const handleDeleteProfile = async (profileId: string, e?: MouseEvent) => {
    e?.stopPropagation();
    if (
      !confirm("Are you sure you want to delete this connection profile?")
    ) {
      return;
    }

    try {
      await remote.deleteProfile(profileId);
    } catch (e) {
      console.error("[SSHConnectionManager] Failed to delete profile:", e);
    }
  };

  const handleCopyConnection = (profile: ConnectionProfile) => {
    const connectionString = `ssh ${profile.username}@${profile.host} -p ${profile.port}`;
    navigator.clipboard.writeText(connectionString);
  };

  const handleDuplicateProfile = async (profile: ConnectionProfile) => {
    const newId = await remote.generateProfileId();
    const duplicated: ConnectionProfile = {
      ...profile,
      id: newId,
      name: `${profile.name} (copy)`,
    };
    await remote.saveProfile(duplicated);
  };

  const toggleSection = (section: "active" | "saved") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const getConnectionStatus = (
    profile: ConnectionProfile
  ): ConnectionStatus => {
    const connection = remote.state.connections.find(
      (c) => c.profile.id === profile.id
    );
    return connection?.status || "disconnected";
  };

  const isConnected = (profile: ConnectionProfile): boolean => {
    const status = getConnectionStatus(profile);
    return status === "connected";
  };

  const statusColor = (status: ConnectionStatus): string => {
    if (typeof status === "object" && "error" in status) {
      return tokens.colors.semantic.error;
    }
    switch (status) {
      case "connected":
        return tokens.colors.semantic.success;
      case "connecting":
      case "reconnecting":
        return tokens.colors.semantic.warning;
      case "disconnected":
        return tokens.colors.text.muted;
      default:
        return tokens.colors.text.muted;
    }
  };

  const statusText = (status: ConnectionStatus): string => {
    if (typeof status === "object" && "error" in status) {
      return `Error`;
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Close context menu on click outside
  const handleDocumentClick = () => setContextMenu(null);
  onMount(() => document.addEventListener("click", handleDocumentClick));
  onCleanup(() => document.removeEventListener("click", handleDocumentClick));

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class={props.class}
      style={{ display: "flex", "flex-direction": "column", height: "100%" }}
    >
      {/* Header */}
      <Show when={props.showHeader !== false}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.md,
            }}
          >
            <div
              style={{
                padding: tokens.spacing.sm,
                "border-radius": tokens.radius.md,
                "background-color": tokens.colors.semantic.primary + "20",
              }}
            >
              <Icon
                name="server"
                class="w-5 h-5"
                style={{ color: tokens.colors.semantic.primary }}
              />
            </div>
            <div>
              <span
                style={{
                  "font-weight": tokens.typography.fontWeight.semibold,
                  color: tokens.colors.text.primary,
                }}
              >
                SSH Connections
              </span>
              <Show when={activeSessions().length > 0}>
                <span
                  style={{
                    "margin-left": tokens.spacing.sm,
                    padding: `2px ${tokens.spacing.sm}`,
                    "border-radius": tokens.radius.full,
                    "background-color": tokens.colors.semantic.success + "20",
                    color: tokens.colors.semantic.success,
                    "font-size": tokens.typography.fontSize.xs,
                  }}
                >
                  {activeSessions().length} active
                </span>
              </Show>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
            }}
          >
            {/* View toggle */}
            <div
              style={{
                display: "flex",
                "border-radius": tokens.radius.md,
                overflow: "hidden",
                border: `1px solid ${tokens.colors.border.divider}`,
              }}
            >
              <button
                onClick={() => setViewMode("list")}
                style={{
                  display: "flex",
                  "align-items": "center",
                  padding: tokens.spacing.xs,
                  border: "none",
                  background:
                    viewMode() === "list"
                      ? tokens.colors.semantic.primary
                      : "transparent",
                  color:
                    viewMode() === "list" ? "white" : tokens.colors.text.muted,
                  cursor: "pointer",
                }}
                title="List view"
              >
                <Icon name="list" size={16} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                style={{
                  display: "flex",
                  "align-items": "center",
                  padding: tokens.spacing.xs,
                  border: "none",
                  background:
                    viewMode() === "grid"
                      ? tokens.colors.semantic.primary
                      : "transparent",
                  color:
                    viewMode() === "grid" ? "white" : tokens.colors.text.muted,
                  cursor: "pointer",
                }}
                title="Grid view"
              >
                <Icon name="grid" size={16} />
              </button>
            </div>

            <button
              onClick={async () => {
                setRefreshing(true);
                await refreshSessions();
                await remote.loadProfiles();
                setRefreshing(false);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                padding: tokens.spacing.xs,
                "border-radius": tokens.radius.sm,
                border: "none",
                background: "transparent",
                color: tokens.colors.text.muted,
                cursor: "pointer",
              }}
              title="Refresh"
            >
              <Icon
                name="rotate"
                size={16}
                class={refreshing() ? "animate-spin" : ""}
              />
            </button>

            <button
              onClick={() => {
                setEditingProfile(undefined);
                setShowDialog(true);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.xs,
                padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                "border-radius": tokens.radius.md,
                border: "none",
                background: tokens.colors.semantic.primary,
                color: "white",
                cursor: "pointer",
                "font-size": tokens.typography.fontSize.sm,
                "font-weight": tokens.typography.fontWeight.medium,
              }}
            >
              <Icon name="plus" size={14} />
              New
            </button>
          </div>
        </div>
      </Show>

      {/* Search */}
      <Show when={props.showSearch !== false}>
        <div
          style={{
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
              "border-radius": tokens.radius.md,
              "background-color": "var(--surface-raised)",
              border: `1px solid ${tokens.colors.border.divider}`,
            }}
          >
            <Icon name="magnifying-glass" size={14} style={{ color: tokens.colors.text.muted }} />
            <input
              type="text"
              placeholder="Search connections..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                color: tokens.colors.text.primary,
                "font-size": tokens.typography.fontSize.sm,
              }}
            />
            <Show when={searchQuery()}>
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  display: "flex",
                  padding: "2px",
                  border: "none",
                  background: "transparent",
                  color: tokens.colors.text.muted,
                  cursor: "pointer",
                }}
              >
                <Icon name="xmark" size={12} />
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Content */}
      <div
        style={{ flex: 1, overflow: "auto", padding: tokens.spacing.md }}
      >
        {/* Active SSH Sessions */}
        <Show when={activeSessions().length > 0}>
          <div style={{ "margin-bottom": tokens.spacing.lg }}>
            {/* Section header */}
            <button
              onClick={() => toggleSection("active")}
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.sm,
                width: "100%",
                padding: `${tokens.spacing.xs} 0`,
                "margin-bottom": tokens.spacing.sm,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: tokens.colors.text.muted,
                "font-size": tokens.typography.fontSize.xs,
                "text-transform": "uppercase",
                "letter-spacing": "0.05em",
              }}
            >
              {expandedSections().active ? (
                <Icon name="chevron-down" size={12} />
              ) : (
                <Icon name="chevron-right" size={12} />
              )}
              <Icon name="wave-pulse" size={12} />
              Active Sessions ({activeSessions().length})
            </button>

            <Show when={expandedSections().active}>
              <div
                style={{
                  display: viewMode() === "grid" ? "grid" : "flex",
                  "grid-template-columns":
                    viewMode() === "grid"
                      ? "repeat(auto-fill, minmax(250px, 1fr))"
                      : undefined,
                  "flex-direction": viewMode() === "list" ? "column" : undefined,
                  gap: tokens.spacing.sm,
                }}
              >
                <For each={activeSessions()}>
                  {(session) => (
                    <div
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: tokens.spacing.md,
                        padding: tokens.spacing.md,
                        "border-radius": tokens.radius.md,
                        "background-color": "var(--surface-raised)",
                        border: `1px solid ${tokens.colors.border.divider}`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onClick={() => props.onOpenTerminal?.(session.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor =
                          tokens.colors.semantic.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor =
                          tokens.colors.border.divider;
                      }}
                    >
                      {/* Status indicator */}
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          "border-radius": "var(--cortex-radius-full)",
                          "background-color":
                            typeof session.status === "string" &&
                            session.status === "connected"
                              ? tokens.colors.semantic.success
                              : tokens.colors.semantic.error,
                          "box-shadow": `0 0 8px ${
                            typeof session.status === "string" &&
                            session.status === "connected"
                              ? tokens.colors.semantic.success
                              : tokens.colors.semantic.error
                          }50`,
                        }}
                      />

                      {/* Session info */}
                      <div style={{ flex: 1, "min-width": 0 }}>
                        <div
                          style={{
                            "font-weight": tokens.typography.fontWeight.medium,
                            color: tokens.colors.text.primary,
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                        >
                          {session.name}
                        </div>
                        <div
                          style={{
                            "font-size": tokens.typography.fontSize.xs,
                            color: tokens.colors.text.muted,
                            display: "flex",
                            "align-items": "center",
                            gap: tokens.spacing.sm,
                          }}
                        >
                          <span>{session.remote_platform}</span>
                          <Show when={session.connected_at}>
                            <span
                              style={{
                                display: "flex",
                                "align-items": "center",
                                gap: "2px",
                              }}
                            >
                              <Icon name="clock" size={10} />
                              {formatTimestamp(session.connected_at)}
                            </span>
                          </Show>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        style={{
                          display: "flex",
                          gap: tokens.spacing.xs,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            props.onOpenTerminal?.(session.id)
                          }
                          style={{
                            display: "flex",
                            "align-items": "center",
                            padding: tokens.spacing.xs,
                            "border-radius": tokens.radius.sm,
                            border: "none",
                            background: "transparent",
                            color: tokens.colors.text.muted,
                            cursor: "pointer",
                          }}
                          title="Open Terminal"
                        >
                          <Icon name="terminal" size={14} />
                        </button>

                        <button
                          onClick={() =>
                            terminals.disconnectSSH(session.id)
                          }
                          style={{
                            display: "flex",
                            "align-items": "center",
                            padding: tokens.spacing.xs,
                            "border-radius": tokens.radius.sm,
                            border: "none",
                            background: "transparent",
                            color: tokens.colors.semantic.error,
                            cursor: "pointer",
                          }}
                          title="Disconnect"
                        >
                          <Icon name="xmark" size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Saved Profiles */}
        <div>
          {/* Section header */}
          <button
            onClick={() => toggleSection("saved")}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              width: "100%",
              padding: `${tokens.spacing.xs} 0`,
              "margin-bottom": tokens.spacing.sm,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: tokens.colors.text.muted,
              "font-size": tokens.typography.fontSize.xs,
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
            }}
          >
            {expandedSections().saved ? (
              <Icon name="chevron-down" size={12} />
            ) : (
              <Icon name="chevron-right" size={12} />
            )}
            <Icon name="server" size={12} />
            Saved Connections ({filteredProfiles().length})
          </button>

          <Show when={expandedSections().saved}>
            <Show
              when={filteredProfiles().length > 0}
              fallback={
                <div
                  style={{
                    padding: tokens.spacing.xl,
                    "text-align": "center",
                    color: tokens.colors.text.muted,
                    "font-size": tokens.typography.fontSize.sm,
                  }}
                >
                  <Icon
                    name="server"
                    class="w-8 h-8 mx-auto mb-3"
                    style={{ opacity: 0.5 }}
                  />
                  <p>No saved connections</p>
                  <p
                    style={{
                      "font-size": tokens.typography.fontSize.xs,
                      "margin-top": tokens.spacing.xs,
                    }}
                  >
                    Click "New" to add your first SSH connection
                  </p>
                </div>
              }
            >
              <div
                style={{
                  display: viewMode() === "grid" ? "grid" : "flex",
                  "grid-template-columns":
                    viewMode() === "grid"
                      ? "repeat(auto-fill, minmax(250px, 1fr))"
                      : undefined,
                  "flex-direction": viewMode() === "list" ? "column" : undefined,
                  gap: tokens.spacing.sm,
                }}
              >
                <For each={filteredProfiles()}>
                  {(profile) => {
                    const status = getConnectionStatus(profile);
                    const connected = isConnected(profile);

                    return (
                      <div
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: tokens.spacing.md,
                          padding: tokens.spacing.md,
                          "border-radius": tokens.radius.md,
                          "background-color": "var(--surface-raised)",
                          border: `1px solid ${tokens.colors.border.divider}`,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onClick={() => handleOpenTerminal(profile)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor =
                            tokens.colors.semantic.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            tokens.colors.border.divider;
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            profile,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        {/* Status indicator */}
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            "border-radius": "var(--cortex-radius-full)",
                            "background-color": statusColor(status),
                          }}
                        />

                        {/* Profile info */}
                        <div style={{ flex: 1, "min-width": 0 }}>
                          <div
                            style={{
                              "font-weight":
                                tokens.typography.fontWeight.medium,
                              color: tokens.colors.text.primary,
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                            }}
                          >
                            {profile.name}
                          </div>
                          <div
                            style={{
                              "font-size": tokens.typography.fontSize.xs,
                              color: tokens.colors.text.muted,
                            }}
                          >
                            {profile.username}@{profile.host}:{profile.port}
                          </div>
                        </div>

                        {/* Status text */}
                        <Show when={status !== "disconnected"}>
                          <span
                            style={{
                              "font-size": tokens.typography.fontSize.xs,
                              color: statusColor(status),
                              padding: `2px ${tokens.spacing.sm}`,
                              "border-radius": tokens.radius.sm,
                              "background-color": statusColor(status) + "15",
                            }}
                          >
                            {statusText(status)}
                          </span>
                        </Show>

                        {/* Actions */}
                        <div
                          style={{
                            display: "flex",
                            gap: tokens.spacing.xs,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Show when={!connected}>
                            <button
                              onClick={() => handleOpenTerminal(profile)}
                              style={{
                                display: "flex",
                                "align-items": "center",
                                padding: tokens.spacing.xs,
                                "border-radius": tokens.radius.sm,
                                border: "none",
                                background: "transparent",
                                color: tokens.colors.semantic.success,
                                cursor: "pointer",
                              }}
                              title="Connect"
                            >
                              <Icon name="bolt" size={14} />
                            </button>
                          </Show>

                          <Show when={connected}>
                            <button
                              onClick={() =>
                                handleDisconnect(profile.id)
                              }
                              style={{
                                display: "flex",
                                "align-items": "center",
                                padding: tokens.spacing.xs,
                                "border-radius": tokens.radius.sm,
                                border: "none",
                                background: "transparent",
                                color: tokens.colors.semantic.warning,
                                cursor: "pointer",
                              }}
                              title="Disconnect"
                            >
                              <Icon name="wifi-slash" size={14} />
                            </button>
                          </Show>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProfile(profile);
                              setShowDialog(true);
                            }}
                            style={{
                              display: "flex",
                              "align-items": "center",
                              padding: tokens.spacing.xs,
                              "border-radius": tokens.radius.sm,
                              border: "none",
                              background: "transparent",
                              color: tokens.colors.text.muted,
                              cursor: "pointer",
                            }}
                            title="Edit"
                          >
                            <Icon name="pen" size={14} />
                          </button>

                          <button
                            onClick={(e) =>
                              handleDeleteProfile(profile.id, e)
                            }
                            style={{
                              display: "flex",
                              "align-items": "center",
                              padding: tokens.spacing.xs,
                              "border-radius": tokens.radius.sm,
                              border: "none",
                              background: "transparent",
                              color: tokens.colors.semantic.error,
                              cursor: "pointer",
                            }}
                            title="Delete"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Context Menu */}
      <Show when={contextMenu()}>
        <div
          style={{
            position: "fixed",
            left: `${contextMenu()!.x}px`,
            top: `${contextMenu()!.y}px`,
            "min-width": "160px",
            padding: tokens.spacing.xs,
            "border-radius": tokens.radius.md,
            "background-color": "var(--surface-overlay)",
            border: `1px solid ${tokens.colors.border.divider}`,
            "box-shadow": tokens.shadows.lg,
            "z-index": 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleOpenTerminal(contextMenu()!.profile);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              width: "100%",
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              border: "none",
              background: "transparent",
              "border-radius": tokens.radius.sm,
              color: tokens.colors.text.primary,
              cursor: "pointer",
              "font-size": tokens.typography.fontSize.sm,
              "text-align": "left",
            }}
          >
            <Icon name="terminal" size={14} />
            Open Terminal
          </button>
          <button
            onClick={() => {
              handleCopyConnection(contextMenu()!.profile);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              width: "100%",
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              border: "none",
              background: "transparent",
              "border-radius": tokens.radius.sm,
              color: tokens.colors.text.primary,
              cursor: "pointer",
              "font-size": tokens.typography.fontSize.sm,
              "text-align": "left",
            }}
          >
            <Icon name="copy" size={14} />
            Copy SSH Command
          </button>
          <button
            onClick={() => {
              handleDuplicateProfile(contextMenu()!.profile);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              width: "100%",
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              border: "none",
              background: "transparent",
              "border-radius": tokens.radius.sm,
              color: tokens.colors.text.primary,
              cursor: "pointer",
              "font-size": tokens.typography.fontSize.sm,
              "text-align": "left",
            }}
          >
            <Icon name="copy" size={14} />
            Duplicate
          </button>
          <div
            style={{
              height: "1px",
              "background-color": tokens.colors.border.divider,
              margin: `${tokens.spacing.xs} 0`,
            }}
          />
          <button
            onClick={() => {
              setEditingProfile(contextMenu()!.profile);
              setShowDialog(true);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              width: "100%",
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              border: "none",
              background: "transparent",
              "border-radius": tokens.radius.sm,
              color: tokens.colors.text.primary,
              cursor: "pointer",
              "font-size": tokens.typography.fontSize.sm,
              "text-align": "left",
            }}
          >
            <Icon name="pen" size={14} />
            Edit
          </button>
          <button
            onClick={() => {
              handleDeleteProfile(contextMenu()!.profile.id);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              width: "100%",
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              border: "none",
              background: "transparent",
              "border-radius": tokens.radius.sm,
              color: tokens.colors.semantic.error,
              cursor: "pointer",
              "font-size": tokens.typography.fontSize.sm,
              "text-align": "left",
            }}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      </Show>

      {/* Connection Dialog */}
      <SSHConnectionDialog
        isOpen={showDialog()}
        onClose={() => {
          setShowDialog(false);
          setEditingProfile(undefined);
        }}
        editProfile={editingProfile()}
        onConnect={(profile) => {
          handleOpenTerminal(profile);
        }}
      />
    </div>
  );
}

export default SSHConnectionManager;

