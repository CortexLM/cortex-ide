import { Component, Show, createSignal } from "solid-js";
import { Extension, MarketplaceExtension, ExtensionUpdateInfo } from "../../context/ExtensionsContext";
import { Card, Text, Button, Badge } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { RuntimeStatusIndicator } from "./ExtensionRuntimeStatus";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("extensions");

export type ViewMode = "grid" | "list";
export type ViewportMode = "normal" | "narrow" | "mini";

interface ExtensionCardProps {
  extension: Extension | MarketplaceExtension;
  isInstalled?: boolean;
  viewMode?: ViewMode;
  viewportMode?: ViewportMode;
  /** Update info if an update is available */
  updateInfo?: ExtensionUpdateInfo;
  /** Whether an update is currently in progress */
  isUpdating?: boolean;
  /** Whether to show runtime status indicator */
  showRuntimeStatus?: boolean;
  onEnable?: (name: string) => void;
  onDisable?: (name: string) => void;
  onUninstall?: (name: string) => void;
  onInstall?: (name: string) => void;
  onUpdate?: (name: string) => void;
  onClick?: (extension: Extension | MarketplaceExtension) => void;
}

/** Check if extension is local Extension type vs MarketplaceExtension */
function isLocalExtension(ext: Extension | MarketplaceExtension): ext is Extension {
  return "manifest" in ext;
}

export const ExtensionCard: Component<ExtensionCardProps> = (props) => {
  const [confirmingUninstall, setConfirmingUninstall] = createSignal(false);

  const viewMode = () => props.viewMode || "grid";
  const viewportMode = () => props.viewportMode || "normal";
  const isListView = () => viewMode() === "list";

  const name = () =>
    isLocalExtension(props.extension)
      ? props.extension.manifest.name
      : props.extension.name;

  const version = () =>
    isLocalExtension(props.extension)
      ? props.extension.manifest.version
      : props.extension.version;

  const description = () =>
    isLocalExtension(props.extension)
      ? props.extension.manifest.description
      : props.extension.description;

  const author = () =>
    isLocalExtension(props.extension)
      ? props.extension.manifest.author
      : props.extension.author;

  const enabled = () =>
    isLocalExtension(props.extension) ? props.extension.enabled : false;

  const downloads = () =>
    !isLocalExtension(props.extension) ? props.extension.downloads : null;

  const rating = () =>
    !isLocalExtension(props.extension) ? props.extension.rating : null;

  const categories = () =>
    !isLocalExtension(props.extension) ? props.extension.categories : [];

  const handleToggleEnabled = (e: MouseEvent) => {
    e.stopPropagation();
    if (enabled()) {
      props.onDisable?.(name());
    } else {
      props.onEnable?.(name());
    }
  };

  const handleUninstall = (e: MouseEvent) => {
    e.stopPropagation();
    if (confirmingUninstall()) {
      props.onUninstall?.(name());
      setConfirmingUninstall(false);
    } else {
      setConfirmingUninstall(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmingUninstall(false), 3000);
    }
  };

  const handleInstall = (e: MouseEvent) => {
    e.stopPropagation();
    props.onInstall?.(name());
  };

  const handleUpdate = (e: MouseEvent) => {
    e.stopPropagation();
    props.onUpdate?.(name());
  };

  const handleCardClick = () => {
    props.onClick?.(props.extension);
  };

  const hasUpdate = () => !!props.updateInfo;
  const isUpdating = () => !!props.isUpdating;

  // VS Code-style list view (60px height, compact)
  if (isListView()) {
    return (
      <div
        class="extension-card"
        onClick={handleCardClick}
        style={{
          display: "flex",
          "flex-direction": "row",
          "align-items": "center",
          height: "60px",
          padding: "6px 12px",
          "background-color": "transparent",
          gap: "10px",
          cursor: props.onClick ? "pointer" : "default",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = tokens.colors.interactive.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {/* Icon - 48x48 */}
        <div
          style={{
            width: "48px",
            height: "48px",
            "min-width": "48px",
            "background-color": tokens.colors.surface.canvas,
            "border-radius": tokens.radius.sm,
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
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        {/* Extension Info */}
        <div style={{ flex: 1, "min-width": 0, overflow: "hidden" }}>
          {/* Name - 13px bold */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                "font-size": "13px",
                "font-weight": 700,
                color: tokens.colors.text.primary,
                "white-space": "nowrap",
                overflow: "hidden",
                "text-overflow": "ellipsis",
              }}
            >
              {name()}
            </span>
            <Show when={isLocalExtension(props.extension)}>
              <span
                style={{
                  "font-size": "10px",
                  padding: "1px 4px",
                  "border-radius": "var(--cortex-radius-sm)",
                  "background-color": enabled()
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(239, 68, 68, 0.2)",
                  color: enabled()
                    ? tokens.colors.semantic.success
                    : tokens.colors.semantic.error,
                }}
              >
                {enabled() ? "Enabled" : "Disabled"}
              </span>
            </Show>
            {/* Update available badge */}
            <Show when={hasUpdate()}>
              <span
                style={{
                  "font-size": "10px",
                  padding: "1px 4px",
                  "border-radius": "var(--cortex-radius-sm)",
                  "background-color": "rgba(59, 130, 246, 0.2)",
                  color: tokens.colors.semantic.info,
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
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {props.updateInfo?.availableVersion}
              </span>
            </Show>
            {/* Runtime status indicator */}
            <Show when={props.showRuntimeStatus && isLocalExtension(props.extension)}>
              <RuntimeStatusIndicator extensionId={name()} />
            </Show>
          </div>
          {/* Publisher - 12px muted */}
          <div
            style={{
              "font-size": "12px",
              color: tokens.colors.text.muted,
              "white-space": "nowrap",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "margin-top": "2px",
            }}
          >
            {author()}
          </div>
          {/* Description truncated */}
          <div
            style={{
              "font-size": "12px",
              color: tokens.colors.text.muted,
              "white-space": "nowrap",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "margin-top": "2px",
            }}
          >
            {description()}
          </div>
        </div>

        {/* Actions - small, right-aligned */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
            "flex-shrink": 0,
          }}
        >
          {/* VS Code action buttons: 2px border-radius, line-height 14px, max-width 150px (100px narrow) */}
          <Show when={isLocalExtension(props.extension)}>
            {/* Update button - shown when update is available */}
            <Show when={hasUpdate()}>
              <button
                onClick={handleUpdate}
                disabled={isUpdating()}
                class="extension-action-button"
                style={{
                  padding: "0 5px",
                  "border-radius": tokens.radius.sm,
                  border: `1px solid ${tokens.colors.semantic.info}`,
                  "font-size": "11px",
                  "font-weight": 500,
                  cursor: isUpdating() ? "not-allowed" : "pointer",
                  "line-height": "14px",
                  "max-width": viewportMode() === "narrow" ? "100px" : "150px",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "background-color": tokens.colors.semantic.info,
                  color: "var(--cortex-text-primary)",
                  opacity: isUpdating() ? 0.7 : 1,
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                }}
              >
                <Show when={isUpdating()}>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  </svg>
                </Show>
                {isUpdating() ? "Updating..." : "Update"}
              </button>
            </Show>
            <button
              onClick={handleToggleEnabled}
              class="extension-action-button"
              style={{
                padding: "0 5px",
                "border-radius": tokens.radius.sm,
                border: `1px solid ${tokens.colors.border.default}`,
                "font-size": "11px",
                "font-weight": 500,
                cursor: "pointer",
                "line-height": "14px",
                "max-width": viewportMode() === "narrow" ? "100px" : "150px",
                "white-space": "nowrap",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "background-color": enabled()
                  ? tokens.colors.surface.canvas
                  : tokens.colors.semantic.primary,
                color: tokens.colors.text.inverse,
              }}
            >
              {enabled() ? "Disable" : "Enable"}
            </button>
            <button
              onClick={handleUninstall}
              class="extension-action-button"
              style={{
                padding: "0 5px",
                "border-radius": tokens.radius.sm,
                border: `1px solid ${tokens.colors.border.default}`,
                "font-size": "11px",
                "font-weight": 500,
                cursor: "pointer",
                "line-height": "14px",
                "max-width": viewportMode() === "narrow" ? "100px" : "150px",
                "white-space": "nowrap",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "background-color": confirmingUninstall()
                  ? tokens.colors.semantic.error
                  : tokens.colors.surface.canvas,
                color: "var(--cortex-text-primary)",
              }}
            >
              {confirmingUninstall() ? "Confirm" : "Uninstall"}
            </button>
          </Show>
          <Show when={!isLocalExtension(props.extension)}>
            <Show
              when={!props.isInstalled}
              fallback={
                <span
                  style={{
                    padding: "0 5px",
                    "font-size": "11px",
                    "line-height": "14px",
                    color: tokens.colors.text.muted,
                    "font-style": "italic",
                    opacity: 0.9,
                  }}
                >
                  Installed
                </span>
              }
            >
              <button
                onClick={handleInstall}
                class="extension-action-button"
                style={{
                  padding: "0 5px",
                  "border-radius": tokens.radius.sm,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "font-size": "11px",
                  "font-weight": 500,
                  cursor: "pointer",
                  "line-height": "14px",
                  "max-width": viewportMode() === "narrow" ? "100px" : "150px",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "background-color": tokens.colors.semantic.primary,
                  color: tokens.colors.text.inverse,
                }}
              >
                Install
              </button>
            </Show>
          </Show>
        </div>
      </div>
    );
  }

  // Grid view (original card layout)
  return (
    <Card
      variant="outlined"
      padding="md"
      hoverable={!!props.onClick}
      onClick={handleCardClick}
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "12px",
        cursor: props.onClick ? "pointer" : "default",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "flex-start",
          "justify-content": "space-between",
          gap: "12px",
        }}
      >
        {/* Icon placeholder */}
        <div
          style={{
            width: "48px",
            height: "48px",
            "min-width": "48px",
            background: tokens.colors.interactive.active,
            "border-radius": tokens.radius.lg,
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: tokens.colors.border.focus,
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
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        {/* Info */}
        <div style={{ flex: 1, "min-width": 0 }}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              "flex-wrap": "wrap",
            }}
          >
            <Text as="h3" weight="bold" size="sm" style={{ margin: 0 }}>
              {name()}
            </Text>
            <Badge size="sm">v{version()}</Badge>
            <Show when={isLocalExtension(props.extension)}>
              <Badge 
                variant={enabled() ? "success" : "error"} 
                size="sm"
              >
                {enabled() ? "Enabled" : "Disabled"}
              </Badge>
            </Show>
            <Show when={hasUpdate()}>
              <Badge variant="accent" size="sm">
                Update: v{props.updateInfo?.availableVersion}
              </Badge>
            </Show>
          </div>
          <Text variant="muted" size="xs" style={{ "margin-top": "4px" }}>
            by {author()}
          </Text>
        </div>
      </div>

      {/* Description */}
      <Text size="sm" style={{ "line-height": "1.5" }}>
        {description()}
      </Text>

      {/* Marketplace Stats */}
      <Show when={downloads() !== null || rating() !== null}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "16px",
          }}
        >
          <Show when={downloads() !== null}>
            <Text variant="muted" size="xs" style={{ display: "flex", "align-items": "center", gap: "4px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloads()?.toLocaleString()} downloads
            </Text>
          </Show>
          <Show when={rating() !== null}>
            <Text variant="muted" size="xs" style={{ display: "flex", "align-items": "center", gap: "4px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {rating()?.toFixed(1)}
            </Text>
          </Show>
        </div>
      </Show>

      {/* Categories */}
      <Show when={categories().length > 0}>
        <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
          {categories().map((cat) => (
            <Badge size="sm">{cat}</Badge>
          ))}
        </div>
      </Show>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          "margin-top": "4px",
          "justify-content": "flex-end",
        }}
      >
        <Show when={isLocalExtension(props.extension)}>
          <Show when={hasUpdate()}>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating()}
              loading={isUpdating()}
              variant="primary"
              size="sm"
            >
              {isUpdating() ? "Updating..." : "Update"}
            </Button>
          </Show>
          <Button
            onClick={handleToggleEnabled}
            variant={enabled() ? "secondary" : "primary"}
            size="sm"
          >
            {enabled() ? "Disable" : "Enable"}
          </Button>
          <Button
            onClick={handleUninstall}
            variant={confirmingUninstall() ? "danger" : "secondary"}
            size="sm"
          >
            {confirmingUninstall() ? "Confirm" : "Uninstall"}
          </Button>
        </Show>
        <Show when={!isLocalExtension(props.extension)}>
          <Show
            when={!props.isInstalled}
            fallback={
              <Text variant="muted" size="xs" style={{ "font-style": "italic", opacity: "0.9", padding: "0 5px" }}>
                Installed
              </Text>
            }
          >
            <Button
              onClick={handleInstall}
              variant="primary"
              size="sm"
            >
              Install
            </Button>
          </Show>
        </Show>
      </div>
    </Card>
  );
};

