/**
 * Extension Profiler - Performance monitoring for extensions
 * Shows activation times, memory usage, CPU impact
 */

import {
  Component,
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  createEffect,
} from "solid-js";
import { useExtensions, useExtensionRuntime } from "../../context/ExtensionsContext";
import { IconButton, Text, Badge, Input } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { ExtensionStatus } from "../../context/ExtensionHostContext";

// ============================================================================
// Types
// ============================================================================

export interface ExtensionProfile {
  extensionId: string;
  extensionName: string;
  activationTime: number;       // ms to activate
  activationEvent: string;      // What triggered activation
  memoryUsage: number;          // MB
  cpuUsage: number;             // Percentage (0-100)
  apiCalls: number;             // Number of API calls made
  lastActive: Date;
  status: "active" | "idle" | "error";
}

interface ExtensionProfilerProps {
  onClose: () => void;
}

type SortKey = "activationTime" | "memoryUsage" | "cpuUsage" | "name" | "status";
type SortDirection = "asc" | "desc";

// ============================================================================
// Constants
// ============================================================================

const SLOW_ACTIVATION_THRESHOLD_MS = 100;
const HIGH_MEMORY_THRESHOLD_MB = 50;
const HIGH_CPU_THRESHOLD_PERCENT = 10;
const REFRESH_INTERVAL_MS = 5000;

// ============================================================================
// Component
// ============================================================================

export const ExtensionProfiler: Component<ExtensionProfilerProps> = (props) => {
  const { enabledExtensions } = useExtensions();
  const runtime = useExtensionRuntime();

  const [profiles, setProfiles] = createSignal<ExtensionProfile[]>([]);
  const [sortKey, setSortKey] = createSignal<SortKey>("activationTime");
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showSlowOnly, setShowSlowOnly] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [selectedExtension, setSelectedExtension] = createSignal<string | null>(null);

  let refreshInterval: ReturnType<typeof setInterval> | undefined;

  // Build profiles from runtime state
  const buildProfiles = (): ExtensionProfile[] => {
    const runtimeStates = runtime.extensions();
    const enabledExts = enabledExtensions();

    return runtimeStates.map((state) => {
      const ext = enabledExts.find((e) => e.manifest.name === state.id);
      const name = ext?.manifest.name || state.id;

      // Determine status
      let status: "active" | "idle" | "error" = "idle";
      if (state.status === ExtensionStatus.Error || state.status === ExtensionStatus.Crashed) {
        status = "error";
      } else if (state.status === ExtensionStatus.Active) {
        // Check if recently active (within last 30 seconds)
        const lastActivityTime = state.lastActivity || 0;
        const isRecentlyActive = Date.now() - lastActivityTime < 30000;
        status = isRecentlyActive ? "active" : "idle";
      }

      return {
        extensionId: state.id,
        extensionName: name,
        activationTime: state.activationTime || 0,
        activationEvent: "*", // Default - would come from extension manifest
        memoryUsage: state.memoryUsage || 0,
        cpuUsage: state.cpuUsage || 0,
        apiCalls: 0, // Would be tracked by extension host
        lastActive: new Date(state.lastActivity || Date.now()),
        status,
      };
    });
  };

  // Refresh profiles
  const refreshProfiles = async () => {
    setRefreshing(true);
    try {
      // In a real implementation, this would query the extension host for metrics
      const newProfiles = buildProfiles();
      setProfiles(newProfiles);
    } finally {
      setRefreshing(false);
    }
  };

  // Sorted and filtered profiles
  const sortedProfiles = createMemo(() => {
    let result = [...profiles()];

    // Filter by search query
    const query = searchQuery().toLowerCase();
    if (query) {
      result = result.filter(
        (p) =>
          p.extensionName.toLowerCase().includes(query) ||
          p.extensionId.toLowerCase().includes(query)
      );
    }

    // Filter slow only
    if (showSlowOnly()) {
      result = result.filter((p) => p.activationTime > SLOW_ACTIVATION_THRESHOLD_MS);
    }

    // Sort
    const key = sortKey();
    const dir = sortDirection();
    result.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case "activationTime":
          cmp = a.activationTime - b.activationTime;
          break;
        case "memoryUsage":
          cmp = a.memoryUsage - b.memoryUsage;
          break;
        case "cpuUsage":
          cmp = a.cpuUsage - b.cpuUsage;
          break;
        case "name":
          cmp = a.extensionName.localeCompare(b.extensionName);
          break;
        case "status":
          const statusOrder = { error: 0, active: 1, idle: 2 };
          cmp = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      return dir === "desc" ? -cmp : cmp;
    });

    return result;
  });

  // Stats
  const stats = createMemo(() => {
    const all = profiles();
    const slowCount = all.filter((p) => p.activationTime > SLOW_ACTIVATION_THRESHOLD_MS).length;
    const totalMemory = all.reduce((sum, p) => sum + p.memoryUsage, 0);
    const avgActivation =
      all.length > 0
        ? all.reduce((sum, p) => sum + p.activationTime, 0) / all.length
        : 0;
    const activeCount = all.filter((p) => p.status === "active").length;
    const errorCount = all.filter((p) => p.status === "error").length;

    return {
      total: all.length,
      slowCount,
      totalMemory,
      avgActivation,
      activeCount,
      errorCount,
    };
  });

  // Handle sort column click
  const handleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  // Restart an extension
  const handleRestartExtension = async (extensionId: string) => {
    try {
      await runtime.deactivate(extensionId);
      await runtime.activate(extensionId);
      await refreshProfiles();
    } catch (e) {
      console.error(`Failed to restart extension ${extensionId}:`, e);
    }
  };

  // Disable an extension
  const handleDisableExtension = async (extensionId: string) => {
    const { disableExtension } = useExtensions();
    try {
      await disableExtension(extensionId);
      await refreshProfiles();
    } catch (e) {
      console.error(`Failed to disable extension ${extensionId}:`, e);
    }
  };

  // Export profiling data
  const handleExport = () => {
    const data = {
      timestamp: new Date().toISOString(),
      profiles: profiles(),
      stats: stats(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extension-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Setup auto-refresh
  onMount(() => {
    refreshProfiles();
    refreshInterval = setInterval(refreshProfiles, REFRESH_INTERVAL_MS);
  });

  onCleanup(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Update profiles when runtime state changes
  createEffect(() => {
    runtime.extensions(); // Track dependency
    refreshProfiles();
  });

  const SortIcon = (key: SortKey) => {
    if (sortKey() !== key) return null;
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        style={{
          transform: sortDirection() === "asc" ? "rotate(180deg)" : "none",
          "margin-left": "4px",
        }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  };

  const StatusDot = (status: "active" | "idle" | "error") => {
    const colors = {
      active: tokens.colors.semantic.success,
      idle: tokens.colors.semantic.warning,
      error: tokens.colors.semantic.error,
    };
    return (
      <div
        style={{
          width: "8px",
          height: "8px",
          "border-radius": "var(--cortex-radius-full)",
          "background-color": colors[status],
          "flex-shrink": 0,
        }}
      />
    );
  };

  return (
    <div
      class="extension-profiler"
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "background-color": tokens.colors.surface.panel,
        color: tokens.colors.text.primary,
        "font-family": "var(--font-family-sans)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 20V10" />
            <path d="M18 20V4" />
            <path d="M6 20v-4" />
          </svg>
          <Text size="lg" weight="bold">
            Extension Profiler
          </Text>
          <Badge size="sm">{stats().total} running</Badge>
        </div>
        <div style={{ display: "flex", gap: tokens.spacing.sm }}>
          <IconButton onClick={handleExport} tooltip="Export profiling data" variant="outlined">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </IconButton>
          <IconButton
            onClick={refreshProfiles}
            disabled={refreshing()}
            tooltip="Refresh"
            variant="outlined"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              style={{ animation: refreshing() ? "spin 1s linear infinite" : "none" }}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </IconButton>
          <IconButton onClick={props.onClose} tooltip="Close" variant="outlined">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Stats Bar */}
      <div
        style={{
          display: "flex",
          gap: tokens.spacing.xl,
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "background-color": tokens.colors.surface.canvas,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "flex-wrap": "wrap",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Text variant="muted" size="sm">
            Active:
          </Text>
          <Badge variant="success" size="sm">
            {stats().activeCount}
          </Badge>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Text variant="muted" size="sm">
            Slow ({">"}100ms):
          </Text>
          <Badge variant={stats().slowCount > 0 ? "accent" : "default"} size="sm">
            {stats().slowCount}
          </Badge>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Text variant="muted" size="sm">
            Errors:
          </Text>
          <Badge variant={stats().errorCount > 0 ? "error" : "default"} size="sm">
            {stats().errorCount}
          </Badge>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Text variant="muted" size="sm">
            Avg Activation:
          </Text>
          <Text size="sm" weight="semibold">
            {stats().avgActivation.toFixed(1)}ms
          </Text>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Text variant="muted" size="sm">
            Total Memory:
          </Text>
          <Text size="sm" weight="semibold">
            {stats().totalMemory.toFixed(1)} MB
          </Text>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: tokens.spacing.md,
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "align-items": "center",
        }}
      >
        <Input
          type="text"
          placeholder="Search extensions..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: 1, "max-width": "300px" }}
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
        />
        <label
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.sm,
            cursor: "pointer",
            "font-size": "13px",
          }}
        >
          <input
            type="checkbox"
            checked={showSlowOnly()}
            onChange={(e) => setShowSlowOnly(e.currentTarget.checked)}
          />
          Show slow only ({">"}100ms)
        </label>
      </div>

      {/* Timeline Header */}
      <div
        style={{
          display: "grid",
          "grid-template-columns": "1fr 100px 100px 80px 80px 100px",
          gap: tokens.spacing.md,
          padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
          "background-color": tokens.colors.surface.canvas,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "font-size": "12px",
          "font-weight": 600,
          color: tokens.colors.text.muted,
        }}
      >
        <div
          onClick={() => handleSort("name")}
          style={{ cursor: "pointer", display: "flex", "align-items": "center" }}
        >
          Extension {SortIcon("name")}
        </div>
        <div
          onClick={() => handleSort("activationTime")}
          style={{ cursor: "pointer", display: "flex", "align-items": "center" }}
        >
          Activation {SortIcon("activationTime")}
        </div>
        <div
          onClick={() => handleSort("memoryUsage")}
          style={{ cursor: "pointer", display: "flex", "align-items": "center" }}
        >
          Memory {SortIcon("memoryUsage")}
        </div>
        <div
          onClick={() => handleSort("cpuUsage")}
          style={{ cursor: "pointer", display: "flex", "align-items": "center" }}
        >
          CPU {SortIcon("cpuUsage")}
        </div>
        <div
          onClick={() => handleSort("status")}
          style={{ cursor: "pointer", display: "flex", "align-items": "center" }}
        >
          Status {SortIcon("status")}
        </div>
        <div>Actions</div>
      </div>

      {/* Extension List */}
      <div
        style={{
          flex: 1,
          "overflow-y": "auto",
        }}
      >
        <Show
          when={sortedProfiles().length > 0}
          fallback={
            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                height: "200px",
                gap: tokens.spacing.lg,
                color: tokens.colors.text.muted,
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                style={{ opacity: 0.5 }}
              >
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
              <Text variant="muted">No running extensions</Text>
            </div>
          }
        >
          <For each={sortedProfiles()}>
            {(profile) => {
              const isSlow = profile.activationTime > SLOW_ACTIVATION_THRESHOLD_MS;
              const isHighMemory = profile.memoryUsage > HIGH_MEMORY_THRESHOLD_MB;
              const isHighCPU = profile.cpuUsage > HIGH_CPU_THRESHOLD_PERCENT;
              const isSelected = selectedExtension() === profile.extensionId;

              return (
                <div
                  onClick={() =>
                    setSelectedExtension((prev) =>
                      prev === profile.extensionId ? null : profile.extensionId
                    )
                  }
                  style={{
                    display: "grid",
                    "grid-template-columns": "1fr 100px 100px 80px 80px 100px",
                    gap: tokens.spacing.md,
                    padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                    "background-color": isSelected
                      ? tokens.colors.interactive.active
                      : "transparent",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = tokens.colors.interactive.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {/* Extension Name */}
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: tokens.spacing.sm,
                      overflow: "hidden",
                    }}
                  >
                    {StatusDot(profile.status)}
                    <Text
                      size="sm"
                      weight="semibold"
                      style={{
                        "white-space": "nowrap",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                      }}
                    >
                      {profile.extensionName}
                    </Text>
                  </div>

                  {/* Activation Time */}
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: tokens.spacing.sm,
                    }}
                  >
                    <Text
                      size="sm"
                      style={{
                        color: isSlow ? tokens.colors.semantic.warning : "inherit",
                        "font-weight": isSlow ? 600 : 400,
                      }}
                    >
                      {profile.activationTime.toFixed(0)}ms
                    </Text>
                    <Show when={isSlow}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={tokens.colors.semantic.warning}
                        stroke-width="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </Show>
                  </div>

                  {/* Memory */}
                  <Text
                    size="sm"
                    style={{
                      color: isHighMemory ? tokens.colors.semantic.warning : "inherit",
                      "font-weight": isHighMemory ? 600 : 400,
                    }}
                  >
                    {profile.memoryUsage.toFixed(1)} MB
                  </Text>

                  {/* CPU */}
                  <Text
                    size="sm"
                    style={{
                      color: isHighCPU ? tokens.colors.semantic.warning : "inherit",
                      "font-weight": isHighCPU ? 600 : 400,
                    }}
                  >
                    {profile.cpuUsage.toFixed(1)}%
                  </Text>

                  {/* Status */}
                  <Badge
                    size="sm"
                    variant={
                      profile.status === "active"
                        ? "success"
                        : profile.status === "error"
                        ? "error"
                        : "default"
                    }
                  >
                    {profile.status}
                  </Badge>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: tokens.spacing.xs,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      onClick={() => handleRestartExtension(profile.extensionId)}
                      tooltip="Restart extension"
                      variant="ghost"
                      size="sm"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    </IconButton>
                    <IconButton
                      onClick={() => handleDisableExtension(profile.extensionId)}
                      tooltip="Disable extension"
                      variant="ghost"
                      size="sm"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </IconButton>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Selected Extension Details */}
      <Show when={selectedExtension()}>
        {(extId) => {
          const profile = () => profiles().find((p) => p.extensionId === extId());
          return (
            <Show when={profile()}>
              {(p) => (
                <div
                  style={{
                    padding: tokens.spacing.lg,
                    "background-color": tokens.colors.surface.canvas,
                    "border-top": `1px solid ${tokens.colors.border.default}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      "justify-content": "space-between",
                      "align-items": "center",
                      "margin-bottom": tokens.spacing.md,
                    }}
                  >
                    <Text weight="bold">{p().extensionName}</Text>
                    <IconButton
                      onClick={() => setSelectedExtension(null)}
                      variant="ghost"
                      size="sm"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </IconButton>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: tokens.spacing.md,
                    }}
                  >
                    <div>
                      <Text variant="muted" size="sm">
                        Activation Event
                      </Text>
                      <Text size="sm">{p().activationEvent}</Text>
                    </div>
                    <div>
                      <Text variant="muted" size="sm">
                        Activation Time
                      </Text>
                      <Text
                        size="sm"
                        style={{
                          color:
                            p().activationTime > SLOW_ACTIVATION_THRESHOLD_MS
                              ? tokens.colors.semantic.warning
                              : "inherit",
                        }}
                      >
                        {p().activationTime.toFixed(2)}ms
                      </Text>
                    </div>
                    <div>
                      <Text variant="muted" size="sm">
                        Memory Usage
                      </Text>
                      <Text size="sm">{p().memoryUsage.toFixed(2)} MB</Text>
                    </div>
                    <div>
                      <Text variant="muted" size="sm">
                        CPU Usage
                      </Text>
                      <Text size="sm">{p().cpuUsage.toFixed(2)}%</Text>
                    </div>
                    <div>
                      <Text variant="muted" size="sm">
                        API Calls
                      </Text>
                      <Text size="sm">{p().apiCalls}</Text>
                    </div>
                    <div>
                      <Text variant="muted" size="sm">
                        Last Active
                      </Text>
                      <Text size="sm">{p().lastActive.toLocaleTimeString()}</Text>
                    </div>
                  </div>
                </div>
              )}
            </Show>
          );
        }}
      </Show>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ExtensionProfiler;

