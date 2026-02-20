import { createSignal, For, Show, createMemo, onMount, onCleanup, type JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import {
  useNotifications,
  type NotificationFilter,
} from "@/context/NotificationsContext";
import { Notification } from "@/components/Notification";

// VS Code spec constants
const CENTER_MAX_WIDTH = 450;
const CENTER_MAX_HEIGHT = 400;
const HEADER_HEIGHT = 35;

interface NotificationsBadgeProps {
  count: number;
  onClick: () => void;
}

export function NotificationsBadge(props: NotificationsBadgeProps) {
  return (
    <button
      style={{ 
        position: "relative",
        padding: "8px",
        "border-radius": "var(--jb-radius-lg)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onClick={props.onClick}
      title="Notifications"
    >
      <Icon name="bell" style={{ width: "20px", height: "20px", color: "var(--jb-text-muted-color)" }} />
      <Show when={props.count > 0}>
        <span
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            "min-width": "18px",
            height: "18px",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "font-weight": "700",
            "border-radius": "var(--cortex-radius-full)",
            padding: "0 4px",
            background: "var(--cortex-error)",
            color: "white",
            "font-size": "var(--jb-font-size-xs)",
          }}
        >
          {props.count > 99 ? "99+" : props.count}
        </span>
      </Show>
    </button>
  );
}

const FILTER_OPTIONS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "collaboration_invite", label: "Invites" },
  { value: "mention", label: "Mentions" },
  { value: "build_result", label: "Builds" },
  { value: "error_alert", label: "Errors" },
  { value: "update_available", label: "Updates" },
];

export function NotificationsPanel() {
  const notifications = useNotifications();
  const [showSettings, setShowSettings] = createSignal(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = createSignal(false);

  let panelRef: HTMLDivElement | undefined;
  let filterButtonRef: HTMLButtonElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (panelRef && !panelRef.contains(e.target as Node)) {
      notifications.closePanel();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const currentFilterLabel = createMemo(() => {
    const f = notifications.filter();
    const option = FILTER_OPTIONS.find((o) => o.value === f);
    return option?.label || "All";
  });

  // Common toolbar button style
  const toolbarButtonStyle = (disabled?: boolean): JSX.CSSProperties => ({
    padding: "4px",
    "border-radius": "var(--jb-radius-lg)",
    border: "none",
    background: "transparent",
    cursor: disabled ? "default" : "pointer",
    color: "var(--jb-text-muted-color)",
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.1s ease",
  });

  return (
    <Show when={notifications.isOpen()}>
      <div
        ref={panelRef}
        style={{
          /* VS Code spec: 450x400px max, absolute positioning */
          position: "absolute",
          right: "7px",
          top: "100%",
          "margin-top": "8px",
          "max-width": `${CENTER_MAX_WIDTH}px`,
          "max-height": `${CENTER_MAX_HEIGHT}px`,
          width: `${CENTER_MAX_WIDTH}px`,
          display: "flex",
          "flex-direction": "column",
          "border-radius": "var(--jb-radius-lg)",
          overflow: "hidden",
          "z-index": "1000",
          background: "var(--jb-popup)",
          border: "1px solid var(--jb-border-divider)",
          "box-shadow": "var(--jb-shadow-popup)",
        }}
      >
        {/* Header - VS Code spec: 35px height, uppercase title */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "padding-left": "8px",
            "padding-right": "5px",
            height: `${HEADER_HEIGHT}px`,
            background: "var(--jb-popup)",
            "border-bottom": "1px solid var(--jb-border-divider)",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <h3
              style={{
                "text-transform": "uppercase",
                "font-size": "var(--jb-font-size-xs)",
                "font-weight": "600",
                color: "var(--jb-text-muted-color)",
                "letter-spacing": "0.04em",
                margin: "0",
              }}
            >
              Notifications
            </h3>
            <Show when={notifications.unreadCount() > 0}>
              <span
                style={{
                  "min-width": "16px",
                  height: "16px",
                  padding: "0 4px",
                  "font-size": "var(--jb-font-size-xs)",
                  "font-weight": "600",
                  "line-height": "16px",
                  "text-align": "center",
                  background: "var(--jb-border-focus)",
                  color: "white",
                  "border-radius": "var(--cortex-radius-md)",
                }}
              >
                {notifications.unreadCount()}
              </span>
            </Show>
          </div>

          {/* Header toolbar - VS Code spec: flex-end alignment */}
          <div
            style={{
              flex: "1",
              display: "flex",
              "justify-content": "flex-end",
              "align-items": "center",
              gap: "2px",
            }}
          >
            {/* Filter dropdown */}
            <div style={{ position: "relative" }}>
              <button
                ref={filterButtonRef}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "4px 6px",
                  "border-radius": "var(--jb-radius-lg)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  "font-size": "var(--jb-font-size-xs)",
                  color: "var(--jb-text-muted-color)",
                  transition: "background 0.1s ease",
                }}
                onClick={() => setFilterDropdownOpen((prev) => !prev)}
              >
                <Icon name="filter" style={{ width: "14px", height: "14px" }} />
                <span>{currentFilterLabel()}</span>
              </button>

              <Show when={filterDropdownOpen()}>
                <div
                  style={{
                    position: "absolute",
                    right: "0",
                    top: "100%",
                    "margin-top": "4px",
                    padding: "4px 0",
                    "z-index": "10",
                    "min-width": "120px",
                    background: "var(--jb-popup)",
                    border: "1px solid var(--jb-border-divider)",
                    "border-radius": "var(--jb-radius-lg)",
                    "box-shadow": "var(--jb-shadow-popup)",
                  }}
                >
                  <For each={FILTER_OPTIONS}>
                    {(option) => (
                      <button
                        style={{
                          width: "100%",
                          padding: "6px 12px",
                          "text-align": "left",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                          "font-size": "var(--jb-font-size-sm)",
                          color:
                            notifications.filter() === option.value
                              ? "var(--jb-border-focus)"
                              : "var(--jb-text-body-color)",
                        }}
                        onClick={() => {
                          notifications.setFilter(option.value);
                          setFilterDropdownOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Mark all read */}
            <button
              style={toolbarButtonStyle(notifications.unreadCount() === 0)}
              onClick={() => notifications.markAllAsRead()}
              title="Mark all as read"
              disabled={notifications.unreadCount() === 0}
            >
              <Icon name="circle-check" style={{ width: "16px", height: "16px" }} />
            </button>

            {/* Clear all */}
            <button
              style={toolbarButtonStyle(notifications.notifications.length === 0)}
              onClick={() => notifications.clearAll()}
              title="Clear all"
              disabled={notifications.notifications.length === 0}
            >
              <Icon name="trash" style={{ width: "16px", height: "16px" }} />
            </button>

            {/* Settings */}
            <button
              style={toolbarButtonStyle()}
              onClick={() => setShowSettings((prev) => !prev)}
              title="Notification settings"
            >
              <Icon name="gear" style={{ width: "16px", height: "16px" }} />
            </button>

            {/* Close */}
            <button
              style={toolbarButtonStyle()}
              onClick={() => notifications.closePanel()}
              title="Close"
            >
              <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        <Show when={showSettings()}>
          <div
            style={{
              padding: "12px 16px",
              "border-bottom": "1px solid var(--jb-border-divider)",
              background: "var(--jb-popup)",
            }}
          >
            <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
              <label style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                <span style={{ "font-size": "var(--jb-font-size-sm)", color: "var(--jb-text-body-color)" }}>
                  Enable notifications
                </span>
                <input
                  type="checkbox"
                  checked={notifications.settings.enabled}
                  onChange={(e) =>
                    notifications.updateSettings({ enabled: e.target.checked })
                  }
                  style={{ width: "16px", height: "16px", "accent-color": "var(--jb-border-focus)" }}
                />
              </label>

              <label style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                <span style={{ "font-size": "var(--jb-font-size-sm)", color: "var(--jb-text-body-color)" }}>
                  Desktop notifications
                </span>
                <input
                  type="checkbox"
                  checked={notifications.settings.desktopNotifications}
                  onChange={(e) =>
                    notifications.updateSettings({
                      desktopNotifications: e.target.checked,
                    })
                  }
                  style={{ width: "16px", height: "16px", "accent-color": "var(--jb-border-focus)" }}
                />
              </label>

              <label style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                <span style={{ "font-size": "var(--jb-font-size-sm)", color: "var(--jb-text-body-color)" }}>
                  Sound
                </span>
                <input
                  type="checkbox"
                  checked={notifications.settings.soundEnabled}
                  onChange={(e) =>
                    notifications.updateSettings({
                      soundEnabled: e.target.checked,
                    })
                  }
                  style={{ width: "16px", height: "16px", "accent-color": "var(--jb-border-focus)" }}
                />
              </label>

              <label style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                <span style={{ "font-size": "var(--jb-font-size-sm)", color: "var(--jb-text-body-color)" }}>
                  Do not disturb
                </span>
                <input
                  type="checkbox"
                  checked={notifications.settings.doNotDisturb}
                  onChange={(e) =>
                    notifications.updateSettings({
                      doNotDisturb: e.target.checked,
                    })
                  }
                  style={{ width: "16px", height: "16px", "accent-color": "var(--jb-border-focus)" }}
                />
              </label>
            </div>
          </div>
        </Show>

        {/* Notification list - VS Code spec: scrollable, max-height minus header */}
        <div
          style={{
            "flex": "1",
            "overflow-y": "auto",
            "max-height": `${CENTER_MAX_HEIGHT - HEADER_HEIGHT}px`,
            color: "var(--jb-text-body-color)",
            background: "var(--jb-popup)",
          }}
        >
          <Show
            when={notifications.filteredNotifications().length > 0}
            fallback={
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "justify-content": "center",
                  padding: "40px 20px",
                  color: "var(--jb-text-muted-color)",
                }}
              >
                <Icon
                  name="bell"
                  style={{
                    width: "48px",
                    height: "48px",
                    "margin-bottom": "16px",
                    opacity: "0.5",
                    color: "var(--jb-text-muted-color)",
                  }}
                />
                <p
                  style={{
                    "font-size": "var(--jb-font-size-base)",
                    "text-align": "center",
                    color: "var(--jb-text-body-color)",
                  }}
                >
                  {notifications.filter() === "all"
                    ? "No notifications"
                    : `No ${currentFilterLabel().toLowerCase()} notifications`}
                </p>
                <p
                  style={{
                    "font-size": "var(--jb-font-size-sm)",
                    "text-align": "center",
                    "margin-top": "4px",
                    color: "var(--jb-text-muted-color)",
                  }}
                >
                  We'll notify you when something happens
                </p>
              </div>
            }
          >
            <For each={notifications.filteredNotifications()}>
              {(notification) => (
                <Notification
                  notification={notification}
                  onMarkRead={notifications.markAsRead}
                  onMarkUnread={notifications.markAsUnread}
                  onRemove={notifications.removeNotification}
                  onAction={notifications.executeAction}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Footer with clear read button */}
        <Show when={notifications.notifications.some((n) => n.isRead)}>
          <div
            style={{
              padding: "8px",
              "border-top": "1px solid var(--jb-border-divider)",
              background: "var(--jb-popup)",
            }}
          >
            <button
              style={{
                width: "100%",
                padding: "4px 10px",
                "font-size": "var(--jb-font-size-sm)",
                "border-radius": "var(--jb-radius-lg)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--jb-text-muted-color)",
                transition: "background 0.1s ease",
              }}
              onClick={() => notifications.clearRead()}
            >
              Clear read notifications
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}

