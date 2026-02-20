import { Component, Show, For, createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { useExtensions } from "../../context/ExtensionsContext";
import { useExtensionRecommendations } from "../../context/ExtensionRecommendationsContext";
import { ExtensionCard, ViewportMode } from "./ExtensionCard";
import { Button, IconButton, Input, Text, Badge } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import "../../styles/extensions.css";

interface ExtensionsPanelProps {
  onClose?: () => void;
}

type FilterType = "all" | "enabled" | "disabled" | "recommended" | "outdated";

export const ExtensionsPanel: Component<ExtensionsPanelProps> = (props) => {
  const {
    extensions,
    loading,
    error,
    extensionsDir,
    loadExtensions,
    enableExtension,
    disableExtension,
    uninstallExtension,
    openExtensionsDirectory,
    installFromMarketplace,
    // Update-related
    outdatedExtensions,
    outdatedCount,
    checkingForUpdates,
    lastChecked,
    checkForUpdates,
    updateExtension,
    updateAllExtensions,
    getUpdateInfo,
    isExtensionUpdating,
  } = useExtensions();

  const {
    recommendations,
    uninstalledRecommendations,
    loading: recommendationsLoading,
    installAllRecommendations,
    reloadRecommendations,
  } = useExtensionRecommendations();

  const [searchQuery, setSearchQuery] = createSignal("");
  const [filter, setFilter] = createSignal<FilterType>("all");
  // VS Code responsive breakpoints: normal, narrow, mini
  const [viewportMode] = createSignal<ViewportMode>("normal");
  const [installingAll, setInstallingAll] = createSignal(false);
  const [updatingAll, setUpdatingAll] = createSignal(false);

  // Listen for show recommendations event
  onMount(() => {
    const handleShowRecommendations = () => {
      setFilter("recommended");
    };

    window.addEventListener("extensions:show-recommendations", handleShowRecommendations);
    
    onCleanup(() => {
      window.removeEventListener("extensions:show-recommendations", handleShowRecommendations);
    });
  });

  const filteredExtensions = createMemo(() => {
    // If showing recommendations, return empty (recommendations shown separately)
    if (filter() === "recommended") {
      return [];
    }

    let exts = extensions();
    const query = searchQuery().toLowerCase();

    // Apply text search
    if (query) {
      exts = exts.filter(
        (ext) =>
          ext.manifest.name.toLowerCase().includes(query) ||
          ext.manifest.description.toLowerCase().includes(query) ||
          ext.manifest.author.toLowerCase().includes(query)
      );
    }

    // Apply filter
    switch (filter()) {
      case "enabled":
        exts = exts.filter((ext) => ext.enabled);
        break;
      case "disabled":
        exts = exts.filter((ext) => !ext.enabled);
        break;
      case "outdated":
        exts = exts.filter((ext) => outdatedExtensions().has(ext.manifest.name));
        break;
    }

    return exts;
  });

  // Format last checked time
  const formattedLastChecked = createMemo(() => {
    const last = lastChecked();
    if (!last) return "Never";
    const now = new Date();
    const diff = now.getTime() - last.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return last.toLocaleDateString();
  });

  const handleInstallAllRecommended = async () => {
    setInstallingAll(true);
    try {
      await installAllRecommendations();
      await loadExtensions();
      await reloadRecommendations();
    } finally {
      setInstallingAll(false);
    }
  };

  const handleInstallRecommendation = async (id: string) => {
    try {
      await installFromMarketplace(id);
      await loadExtensions();
      await reloadRecommendations();
    } catch (e) {
      console.error(`Failed to install ${id}:`, e);
    }
  };

  const handleEnable = async (name: string) => {
    await enableExtension(name);
  };

  const handleDisable = async (name: string) => {
    await disableExtension(name);
  };

  const handleUninstall = async (name: string) => {
    await uninstallExtension(name);
  };

  const handleRefresh = async () => {
    await loadExtensions();
  };

  const handleCheckForUpdates = async () => {
    await checkForUpdates();
  };

  const handleUpdateAll = async () => {
    setUpdatingAll(true);
    try {
      await updateAllExtensions();
    } finally {
      setUpdatingAll(false);
    }
  };

  const handleUpdateExtension = async (name: string) => {
    await updateExtension(name);
  };

  return (
    <div
      class={`extensions-viewlet ${viewportMode()}`}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "background-color": tokens.colors.surface.panel,
        color: tokens.colors.text.primary,
      }}
    >
      {/* Header - VS Code viewlet header: 41px height */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `0 ${tokens.spacing.lg}`,
          height: "41px",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.lg }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <h2 style={{ margin: 0, "font-size": "16px", "font-weight": 600 }}>
            Extensions
          </h2>
          <Badge size="md">{extensions().length}</Badge>
          {/* Updates available badge */}
          <Show when={outdatedCount() > 0}>
            <div 
              onClick={() => setFilter("outdated")} 
              style={{ cursor: "pointer" }}
              title="Show extensions with updates"
            >
              <Badge size="sm" variant="accent">
                {outdatedCount()} update{outdatedCount() > 1 ? "s" : ""}
              </Badge>
            </div>
          </Show>
        </div>
        <div style={{ display: "flex", gap: tokens.spacing.md }}>
          {/* Update All button - shown when updates available */}
          <Show when={outdatedCount() > 0}>
            <Button
              onClick={handleUpdateAll}
              disabled={updatingAll()}
              loading={updatingAll()}
              variant="primary"
              size="sm"
              style={{ "font-size": "11px", padding: "0 8px", height: "22px" }}
            >
              Update All ({outdatedCount()})
            </Button>
          </Show>
          {/* Check for updates button */}
          <IconButton
            onClick={handleCheckForUpdates}
            disabled={checkingForUpdates()}
            tooltip={`Check for updates (Last: ${formattedLastChecked()})`}
            variant="outlined"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              style={{
                animation: checkingForUpdates() ? "spin 1s linear infinite" : "none",
              }}
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </IconButton>
          <IconButton
            onClick={handleRefresh}
            disabled={loading()}
            tooltip="Refresh extensions"
            variant="outlined"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              style={{
                animation: loading() ? "spin 1s linear infinite" : "none",
              }}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </IconButton>
          <IconButton
            onClick={openExtensionsDirectory}
            tooltip="Open extensions folder"
            variant="outlined"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </IconButton>
          <Show when={props.onClose}>
            <IconButton
              onClick={props.onClose}
              tooltip="Close"
              variant="outlined"
            >
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
          </Show>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: tokens.spacing.md,
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <Input
          type="text"
          placeholder="Search Extensions in Marketplace"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
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
        <select
          value={filter()}
          onChange={(e) => setFilter(e.currentTarget.value as FilterType)}
          style={{
            width: "100%",
            height: "22px",
            padding: `0 ${tokens.spacing.md}`,
            "border-radius": tokens.radius.sm,
            border: `1px solid ${tokens.colors.border.default}`,
            "background-color": tokens.colors.surface.panel,
            color: tokens.colors.text.primary,
            "font-size": "12px",
            cursor: "pointer",
          }}
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="outdated">
            Outdated{outdatedCount() > 0 ? ` (${outdatedCount()})` : ""}
          </option>
          <option value="recommended">Recommended</option>
        </select>
      </div>

      {/* Error Message */}
      <Show when={error()}>
        <div
          style={{
            margin: `${tokens.spacing.lg} 20px`,
            padding: tokens.spacing.lg,
            "background-color": "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${tokens.colors.semantic.error}`,
            "border-radius": tokens.radius.md,
            color: tokens.colors.semantic.error,
            "font-size": "13px",
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error()}
        </div>
      </Show>

      {/* Extensions Directory Info */}
      <div
        style={{
          padding: `${tokens.spacing.md} 20px`,
          "font-size": "11px",
          color: tokens.colors.text.muted,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        Extensions directory: {extensionsDir()}
      </div>

      {/* Extensions List */}
      <div
        style={{
          flex: 1,
          "overflow-y": "auto",
          padding: "0",
        }}
      >
        <Show
          when={!loading()}
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
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>Loading extensions...</span>
            </div>
          }
        >
          {/* Recommended Extensions View */}
          <Show when={filter() === "recommended"}>
            <Show
              when={!recommendationsLoading()}
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
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  <span>Loading recommendations...</span>
                </div>
              }
            >
              <Show
                when={recommendations().length > 0}
                fallback={
                  <div
                    style={{
                      display: "flex",
                      "flex-direction": "column",
                      "align-items": "center",
                      "justify-content": "center",
                      height: "200px",
                      gap: tokens.spacing.xl,
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
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    <div style={{ "text-align": "center" }}>
                      <p style={{ margin: `0 0 ${tokens.spacing.md}` }}>No recommendations</p>
                      <p
                        style={{
                          margin: 0,
                          "font-size": "12px",
                          "max-width": "300px",
                        }}
                      >
                        This workspace has no extension recommendations. Add a{" "}
                        <code style={{ "background-color": tokens.colors.surface.canvas, padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm }}>
                          .vscode/extensions.json
                        </code>{" "}
                        file to recommend extensions.
                      </p>
                    </div>
                  </div>
                }
              >
                <div style={{ "flex-direction": "column" }}>
                  {/* Recommended Header with Install All button */}
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                      "background-color": tokens.colors.surface.canvas,
                      "border-bottom": `1px solid ${tokens.colors.border.default}`,
                    }}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={tokens.colors.semantic.warning}
                        stroke-width="2"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <Text size="md" weight="semibold">
                        Workspace Recommendations
                      </Text>
                      <Badge size="sm">{recommendations().length}</Badge>
                    </div>
                    <Show when={uninstalledRecommendations().length > 0}>
                      <Button
                        onClick={handleInstallAllRecommended}
                        disabled={installingAll()}
                        loading={installingAll()}
                        variant="primary"
                        size="sm"
                      >
                        Install All ({uninstalledRecommendations().length})
                      </Button>
                    </Show>
                  </div>

                  {/* Recommendation Items */}
                  <div style={{ display: "flex", "flex-direction": "column" }}>
                    <For each={recommendations()}>
                      {(rec) => (
                        <div
                          style={{
                            display: "flex",
                            "flex-direction": "row",
                            "align-items": "center",
                            height: "52px",
                            padding: "6px 12px",
                            "background-color": "transparent",
                            gap: "10px",
                            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = tokens.colors.interactive.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          {/* Icon */}
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              "min-width": "40px",
                              "background-color": tokens.colors.surface.canvas,
                              "border-radius": tokens.radius.sm,
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "center",
                              color: tokens.colors.semantic.primary,
                            }}
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, "min-width": 0, overflow: "hidden" }}>
                            <div
                              style={{
                                display: "flex",
                                "align-items": "center",
                                gap: "6px",
                              }}
                            >
                              <Text size="md" weight="semibold" truncate>
                                {rec.id}
                              </Text>
                              <Show when={rec.isInstalled}>
                                <Badge
                                  size="sm"
                                  variant={rec.isEnabled ? "success" : "error"}
                                >
                                  {rec.isEnabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </Show>
                            </div>
                            <Text variant="muted" size="sm" style={{ "margin-top": "2px" }}>
                              {rec.isInstalled ? "Installed" : "Not installed"}
                            </Text>
                          </div>

                          {/* Action */}
                          <div style={{ "flex-shrink": 0 }}>
                            <Show
                              when={!rec.isInstalled}
                              fallback={
                                <Text
                                  size="sm"
                                  color="success"
                                  style={{
                                    display: "flex",
                                    "align-items": "center",
                                    gap: "4px",
                                  }}
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Installed
                                </Text>
                              }
                            >
                              <Button
                                onClick={() => handleInstallRecommendation(rec.id)}
                                variant="primary"
                                size="sm"
                              >
                                Install
                              </Button>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </Show>

          {/* Regular Extensions View */}
          <Show when={filter() !== "recommended"}>
            <Show
              when={filteredExtensions().length > 0}
              fallback={
                <div
                  style={{
                    display: "flex",
                    "flex-direction": "column",
                    "align-items": "center",
                    "justify-content": "center",
                    height: "200px",
                    gap: tokens.spacing.xl,
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
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <div style={{ "text-align": "center" }}>
                    <p style={{ margin: `0 0 ${tokens.spacing.md}` }}>No extensions found</p>
                    <p
                      style={{
                        margin: 0,
                        "font-size": "12px",
                        "max-width": "300px",
                      }}
                    >
                      Install extensions by placing them in the extensions directory
                      or browse the marketplace.
                    </p>
                  </div>
                  <Button
                    onClick={openExtensionsDirectory}
                    variant="primary"
                  >
                    Open Extensions Folder
                  </Button>
                </div>
              }
            >
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "0",
                }}
              >
                <For each={filteredExtensions()}>
                  {(ext) => (
                    <ExtensionCard
                      extension={ext}
                      viewMode="list"
                      viewportMode={viewportMode()}
                      updateInfo={getUpdateInfo(ext.manifest.name)}
                      isUpdating={isExtensionUpdating(ext.manifest.name)}
                      onEnable={handleEnable}
                      onDisable={handleDisable}
                      onUninstall={handleUninstall}
                      onUpdate={handleUpdateExtension}
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </div>

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
