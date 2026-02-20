/**
 * Extension Runtime Status Badge
 * Shows running extension status in Extensions panel
 * - Green dot for active
 * - Yellow dot for idle
 * - Red dot for error
 * - Memory usage tooltip
 * - CPU usage if high
 */

import { Component, Show, createMemo } from "solid-js";
import { useExtensionRuntime } from "../../context/ExtensionsContext";
import { ExtensionStatus } from "../../context/ExtensionHostContext";
import { tokens } from "@/design-system/tokens";
import { Text } from "@/components/ui";

// ============================================================================
// Types
// ============================================================================

export interface RuntimeStatusBadgeProps {
  /** Extension ID to show status for */
  extensionId: string;
  /** Whether to show expanded details (memory/CPU) */
  showDetails?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

// ============================================================================
// Constants
// ============================================================================

const HIGH_MEMORY_THRESHOLD_MB = 50;
const HIGH_CPU_THRESHOLD_PERCENT = 10;

// ============================================================================
// Components
// ============================================================================

/**
 * Status dot indicator showing extension runtime state
 */
export const RuntimeStatusDot: Component<{
  status: "active" | "idle" | "error" | "inactive";
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}> = (props) => {
  const size = () => props.size || "md";
  const sizeMap = { sm: "6px", md: "8px", lg: "10px" };

  const getColor = () => {
    switch (props.status) {
      case "active":
        return tokens.colors.semantic.success;
      case "idle":
        return tokens.colors.semantic.warning;
      case "error":
        return tokens.colors.semantic.error;
      case "inactive":
      default:
        return tokens.colors.text.muted;
    }
  };

  return (
    <div
      style={{
        width: sizeMap[size()],
        height: sizeMap[size()],
        "border-radius": "var(--cortex-radius-full)",
        "background-color": getColor(),
        "flex-shrink": 0,
        animation: props.animated && props.status === "active" ? "pulse 2s infinite" : "none",
      }}
      title={`Status: ${props.status}`}
    />
  );
};

/**
 * Runtime status badge for a single extension
 */
export const RuntimeStatusBadge: Component<RuntimeStatusBadgeProps> = (props) => {
  const runtime = useExtensionRuntime();

  // Get runtime state for this extension
  const runtimeState = createMemo(() => {
    return runtime.extensions().find((s) => s.id === props.extensionId);
  });

  // Determine display status
  const displayStatus = createMemo((): "active" | "idle" | "error" | "inactive" => {
    const state = runtimeState();
    if (!state) return "inactive";

    switch (state.status) {
      case ExtensionStatus.Active:
        // Check if recently active (within last 30 seconds)
        const lastActivityTime = state.lastActivity || 0;
        const isRecentlyActive = Date.now() - lastActivityTime < 30000;
        return isRecentlyActive ? "active" : "idle";
      case ExtensionStatus.Error:
      case ExtensionStatus.Crashed:
        return "error";
      case ExtensionStatus.Activating:
      case ExtensionStatus.Deactivating:
        return "active";
      default:
        return "inactive";
    }
  });

  const memoryUsage = createMemo(() => runtimeState()?.memoryUsage || 0);
  const cpuUsage = createMemo(() => runtimeState()?.cpuUsage || 0);
  const isHighMemory = createMemo(() => memoryUsage() > HIGH_MEMORY_THRESHOLD_MB);
  const isHighCPU = createMemo(() => cpuUsage() > HIGH_CPU_THRESHOLD_PERCENT);

  const showDetails = () => props.showDetails ?? false;
  const size = () => props.size || "md";

  // Build tooltip text
  const tooltipText = createMemo(() => {
    const state = runtimeState();
    if (!state) return "Not running";

    const parts: string[] = [];
    parts.push(`Status: ${displayStatus()}`);

    if (state.activationTime) {
      parts.push(`Activation: ${state.activationTime.toFixed(0)}ms`);
    }

    if (state.memoryUsage) {
      parts.push(`Memory: ${state.memoryUsage.toFixed(1)} MB`);
    }

    if (state.cpuUsage) {
      parts.push(`CPU: ${state.cpuUsage.toFixed(1)}%`);
    }

    if (state.error) {
      parts.push(`Error: ${state.error}`);
    }

    return parts.join("\n");
  });

  return (
    <div
      class="runtime-status-badge"
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: tokens.spacing.xs,
      }}
      title={tooltipText()}
    >
      <RuntimeStatusDot
        status={displayStatus()}
        size={size()}
        animated={displayStatus() === "active"}
      />

      <Show when={showDetails() && displayStatus() !== "inactive"}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.sm,
            "font-size": size() === "sm" ? "10px" : "11px",
          }}
        >
          {/* Memory indicator */}
          <Show when={memoryUsage() > 0}>
            <span
              style={{
                color: isHighMemory()
                  ? tokens.colors.semantic.warning
                  : tokens.colors.text.muted,
                display: "flex",
                "align-items": "center",
                gap: "2px",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
              </svg>
              {memoryUsage().toFixed(0)}MB
            </span>
          </Show>

          {/* CPU indicator - only show if high */}
          <Show when={isHighCPU()}>
            <span
              style={{
                color: tokens.colors.semantic.warning,
                display: "flex",
                "align-items": "center",
                gap: "2px",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
              {cpuUsage().toFixed(0)}%
            </span>
          </Show>
        </div>
      </Show>

      {/* Pulse animation CSS */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

/**
 * Compact inline status indicator
 */
export const RuntimeStatusIndicator: Component<{ extensionId: string }> = (props) => {
  return <RuntimeStatusBadge extensionId={props.extensionId} size="sm" />;
};

/**
 * Extended status with details for extension cards
 */
export const RuntimeStatusDetails: Component<{ extensionId: string }> = (props) => {
  return <RuntimeStatusBadge extensionId={props.extensionId} size="md" showDetails />;
};

/**
 * Summary of all running extensions
 */
export const RuntimeStatusSummary: Component = () => {
  const runtime = useExtensionRuntime();

  const stats = createMemo(() => {
    const states = runtime.extensions();
    const active = states.filter(
      (s) => s.status === ExtensionStatus.Active
    ).length;
    const errors = states.filter(
      (s) => s.status === ExtensionStatus.Error || s.status === ExtensionStatus.Crashed
    ).length;
    const totalMemory = states.reduce((sum, s) => sum + (s.memoryUsage || 0), 0);

    return { total: states.length, active, errors, totalMemory };
  });

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: tokens.spacing.md,
        padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
        "background-color": tokens.colors.surface.canvas,
        "border-radius": tokens.radius.sm,
        "font-size": "12px",
      }}
    >
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
        <RuntimeStatusDot status="active" size="sm" />
        <Text size="sm">{stats().active} running</Text>
      </div>

      <Show when={stats().errors > 0}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
          <RuntimeStatusDot status="error" size="sm" />
          <Text size="sm" style={{ color: tokens.colors.semantic.error }}>
            {stats().errors} errors
          </Text>
        </div>
      </Show>

      <Show when={stats().totalMemory > 0}>
        <Text variant="muted" size="sm">
          {stats().totalMemory.toFixed(0)} MB
        </Text>
      </Show>
    </div>
  );
};

export default RuntimeStatusBadge;

