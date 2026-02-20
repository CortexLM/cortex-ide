/**
 * Extension Pack View Component
 *
 * Shows pack contents and allows bulk actions:
 * - List all extensions in pack
 * - Individual enable/disable
 * - Install missing extensions
 * - Uninstall entire pack
 * - Pack description and publisher
 */

import { Component, Show, For, createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { useExtensions, ExtensionPack, ExtensionPackState } from "../../context/ExtensionsContext";
import { Text, Button, Badge } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

interface ExtensionPackViewProps {
  /** Pack ID to display */
  packId: string;
  /** Callback when view is closed */
  onClose: () => void;
  /** Optional callback when an extension in the pack is clicked */
  onExtensionClick?: (extensionId: string) => void;
}

interface ExtensionInPackStatus {
  id: string;
  installed: boolean;
  enabled: boolean;
  version?: string;
}

export const ExtensionPackView: Component<ExtensionPackViewProps> = (props) => {
  const {
    extensions,
    enableExtension,
    disableExtension,
    installFromMarketplace,
    uninstallExtension,
    installExtensionPack,
    uninstallExtensionPack,
    getExtensionPackContents,
    getInstalledPacks,
    isWebExtension,
    getExtensionKind,
  } = useExtensions();

  const [pack, setPack] = createSignal<ExtensionPack | null>(null);
  const [packState, setPackState] = createSignal<ExtensionPackState | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [confirmingUninstall, setConfirmingUninstall] = createSignal(false);
  const [installProgress, setInstallProgress] = createSignal<{ current: number; total: number } | null>(null);

  // Fetch pack metadata on mount
  onMount(async () => {
    setLoading(true);
    try {
      // Get pack contents and state
      const extensionIds = getExtensionPackContents(props.packId);
      const installedPacks = getInstalledPacks();
      const currentPackState = installedPacks.find((p) => p.packId === props.packId) ?? null;
      setPackState(currentPackState);

      // Try to get full pack metadata
      // This would come from the context or a fetch call
      // For now, construct from available data
      if (extensionIds.length > 0 || currentPackState) {
        setPack({
          id: props.packId,
          name: props.packId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          extensionIds: extensionIds.length > 0 ? extensionIds : currentPackState?.installedExtensions ?? [],
          description: `Extension pack containing ${extensionIds.length || currentPackState?.installedExtensions.length || 0} extensions`,
          publisher: "Unknown",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pack");
    } finally {
      setLoading(false);
    }
  });

  // Listen for pack install progress events
  onMount(() => {
    const handleProgress = (event: CustomEvent) => {
      if (event.detail.packId === props.packId) {
        setInstallProgress({
          current: event.detail.installed,
          total: event.detail.total,
        });
      }
    };

    const handleComplete = (event: CustomEvent) => {
      if (event.detail.packId === props.packId) {
        setInstallProgress(null);
        // Refresh pack state
        const installedPacks = getInstalledPacks();
        setPackState(installedPacks.find((p) => p.packId === props.packId) ?? null);
      }
    };

    window.addEventListener("extensions:pack-install-progress", handleProgress as EventListener);
    window.addEventListener("extensions:pack-install-complete", handleComplete as EventListener);

    onCleanup(() => {
      window.removeEventListener("extensions:pack-install-progress", handleProgress as EventListener);
      window.removeEventListener("extensions:pack-install-complete", handleComplete as EventListener);
    });
  });

  // Get status of each extension in the pack
  const extensionStatuses = createMemo((): ExtensionInPackStatus[] => {
    const currentPack = pack();
    if (!currentPack) return [];

    const installedExtensions = extensions();

    return currentPack.extensionIds.map((id) => {
      const ext = installedExtensions.find((e) => e.manifest.name === id);
      return {
        id,
        installed: !!ext,
        enabled: ext?.enabled ?? false,
        version: ext?.manifest.version,
      };
    });
  });

  // Count statistics
  const stats = createMemo(() => {
    const statuses = extensionStatuses();
    return {
      total: statuses.length,
      installed: statuses.filter((s) => s.installed).length,
      enabled: statuses.filter((s) => s.enabled).length,
      missing: statuses.filter((s) => !s.installed).length,
    };
  });

  // Whether the entire pack is installed
  const isFullyInstalled = createMemo(() => stats().missing === 0);

  // Whether any installation is in progress
  const isInstalling = createMemo(() => installProgress() !== null || packState()?.installing);

  // Handle installing the entire pack
  const handleInstallPack = async () => {
    setError(null);
    try {
      await installExtensionPack(props.packId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to install pack");
    }
  };

  // Handle uninstalling the entire pack
  const handleUninstallPack = async () => {
    if (!confirmingUninstall()) {
      setConfirmingUninstall(true);
      setTimeout(() => setConfirmingUninstall(false), 3000);
      return;
    }

    setError(null);
    setConfirmingUninstall(false);
    try {
      await uninstallExtensionPack(props.packId);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to uninstall pack");
    }
  };

  // Handle installing a single missing extension
  const handleInstallExtension = async (extensionId: string) => {
    setError(null);
    try {
      await installFromMarketplace(extensionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to install ${extensionId}`);
    }
  };

  // Handle toggling extension enabled state
  const handleToggleExtension = async (extensionId: string, currentlyEnabled: boolean) => {
    setError(null);
    try {
      if (currentlyEnabled) {
        await disableExtension(extensionId);
      } else {
        await enableExtension(extensionId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to toggle ${extensionId}`);
    }
  };

  // Handle uninstalling a single extension
  const handleUninstallExtension = async (extensionId: string) => {
    setError(null);
    try {
      await uninstallExtension(extensionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to uninstall ${extensionId}`);
    }
  };

  // Render extension kind badges
  const renderKindBadges = (extensionId: string) => {
    const kinds = getExtensionKind(extensionId);
    const isWeb = isWebExtension(extensionId);

    return (
      <div style={{ display: "flex", gap: "4px" }}>
        <For each={kinds}>
          {(kind) => (
            <Badge
              size="sm"
              variant={kind === "web" ? "success" : kind === "ui" ? "accent" : "default"}
            >
              {kind}
            </Badge>
          )}
        </For>
        <Show when={isWeb}>
          <Badge size="sm" variant="success">
            Web
          </Badge>
        </Show>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "background-color": tokens.colors.surface.base,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "16px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Button>

          {/* Pack icon */}
          <div
            style={{
              width: "48px",
              height: "48px",
              "background-color": tokens.colors.interactive.active,
              "border-radius": tokens.radius.lg,
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              color: tokens.colors.semantic.primary,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>

          {/* Pack info */}
          <div>
            <Text as="h2" weight="bold" size="lg" style={{ margin: 0 }}>
              {pack()?.name ?? props.packId}
            </Text>
            <Text variant="muted" size="sm">
              {pack()?.publisher ?? "Unknown publisher"}
            </Text>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <Show when={!isFullyInstalled() && !isInstalling()}>
            <Button variant="primary" size="sm" onClick={handleInstallPack}>
              Install All ({stats().missing})
            </Button>
          </Show>
          <Show when={isInstalling()}>
            <Button variant="secondary" size="sm" disabled>
              <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                </svg>
                Installing ({installProgress()?.current ?? 0}/{installProgress()?.total ?? stats().total})
              </span>
            </Button>
          </Show>
          <Show when={stats().installed > 0}>
            <Button
              variant={confirmingUninstall() ? "danger" : "secondary"}
              size="sm"
              onClick={handleUninstallPack}
            >
              {confirmingUninstall() ? "Confirm Uninstall All" : "Uninstall Pack"}
            </Button>
          </Show>
        </div>
      </div>

      {/* Description and stats */}
      <div style={{ padding: "16px", "border-bottom": `1px solid ${tokens.colors.border.default}` }}>
        <Text size="sm" style={{ "margin-bottom": "12px" }}>
          {pack()?.description}
        </Text>
        
        <div style={{ display: "flex", gap: "16px", "flex-wrap": "wrap" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Badge variant="default">{stats().total}</Badge>
            <Text size="xs" variant="muted">Total</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Badge variant="success">{stats().installed}</Badge>
            <Text size="xs" variant="muted">Installed</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Badge variant="accent">{stats().enabled}</Badge>
            <Text size="xs" variant="muted">Enabled</Text>
          </div>
          <Show when={stats().missing > 0}>
            <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
              <Badge variant="warning">{stats().missing}</Badge>
              <Text size="xs" variant="muted">Missing</Text>
            </div>
          </Show>
        </div>
      </div>

      {/* Error display */}
      <Show when={error()}>
        <div
          style={{
            padding: "12px 16px",
            "background-color": "rgba(239, 68, 68, 0.1)",
            "border-bottom": `1px solid ${tokens.colors.semantic.error}`,
          }}
        >
          <Text size="sm" style={{ color: tokens.colors.semantic.error }}>
            {error()}
          </Text>
        </div>
      </Show>

      {/* Loading state */}
      <Show when={loading()}>
        <div
          style={{
            flex: 1,
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
          }}
        >
          <Text variant="muted">Loading pack contents...</Text>
        </div>
      </Show>

      {/* Extension list */}
      <Show when={!loading()}>
        <div style={{ flex: 1, overflow: "auto" }}>
          <For each={extensionStatuses()}>
            {(status) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  padding: "12px 16px",
                  "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                  gap: "12px",
                  cursor: props.onExtensionClick ? "pointer" : "default",
                }}
                onClick={() => props.onExtensionClick?.(status.id)}
                onMouseEnter={(e) => {
                  if (props.onExtensionClick) {
                    e.currentTarget.style.backgroundColor = tokens.colors.interactive.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {/* Extension icon */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    "min-width": "32px",
                    "background-color": status.installed
                      ? tokens.colors.interactive.active
                      : tokens.colors.surface.canvas,
                    "border-radius": tokens.radius.md,
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    color: status.installed
                      ? tokens.colors.semantic.primary
                      : tokens.colors.text.muted,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>

                {/* Extension info */}
                <div style={{ flex: 1, "min-width": 0 }}>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <Text weight="bold" size="sm" style={{ margin: 0 }}>
                      {status.id}
                    </Text>
                    <Show when={status.version}>
                      <Badge size="sm">v{status.version}</Badge>
                    </Show>
                    <Show when={status.installed}>
                      <Badge
                        size="sm"
                        variant={status.enabled ? "success" : "error"}
                      >
                        {status.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </Show>
                    <Show when={!status.installed}>
                      <Badge size="sm" variant="warning">
                        Not Installed
                      </Badge>
                    </Show>
                  </div>
                  <Show when={status.installed}>
                    <div style={{ "margin-top": "4px" }}>
                      {renderKindBadges(status.id)}
                    </div>
                  </Show>
                </div>

                {/* Actions */}
                <div
                  style={{ display: "flex", gap: "6px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Show when={!status.installed}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleInstallExtension(status.id)}
                    >
                      Install
                    </Button>
                  </Show>
                  <Show when={status.installed}>
                    <Button
                      variant={status.enabled ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleToggleExtension(status.id, status.enabled)}
                    >
                      {status.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleUninstallExtension(status.id)}
                    >
                      Uninstall
                    </Button>
                  </Show>
                </div>
              </div>
            )}
          </For>

          {/* Empty state */}
          <Show when={extensionStatuses().length === 0 && !loading()}>
            <div
              style={{
                padding: "48px 16px",
                "text-align": "center",
              }}
            >
              <Text variant="muted">No extensions in this pack</Text>
            </div>
          </Show>
        </div>
      </Show>

      {/* Failed extensions section */}
      <Show when={packState()?.failedExtensions && packState()!.failedExtensions.length > 0}>
        <div
          style={{
            padding: "12px 16px",
            "background-color": "rgba(239, 68, 68, 0.05)",
            "border-top": `1px solid ${tokens.colors.border.default}`,
          }}
        >
          <Text size="sm" weight="bold" style={{ color: tokens.colors.semantic.error, "margin-bottom": "8px" }}>
            Failed to install:
          </Text>
          <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
            <For each={packState()!.failedExtensions}>
              {(extId) => (
                <Badge variant="error" size="sm">
                  {extId}
                </Badge>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ExtensionPackView;
