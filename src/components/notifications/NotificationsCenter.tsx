import { createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "@/components/ui/Icon";
import { useNotifications, type NotificationFilter } from "@/context/NotificationsContext";
import { NotificationItem } from "./NotificationItem";
import { NotificationToast } from "./NotificationToast";

const FILTER_OPTIONS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warnings" },
  { value: "error_alert", label: "Errors" },
  { value: "progress", label: "Progress" },
];

export interface NotificationsCenterProps {
  position?: "bottom-right" | "top-right" | "bottom-left" | "top-left";
}

export function NotificationsCenter(props: NotificationsCenterProps) {
  const notifications = useNotifications();
  const [showPanel, setShowPanel] = createSignal(false);
  let panelRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  const position = () => props.position || "bottom-right";

  const handleClickOutside = (e: MouseEvent) => {
    if (
      panelRef &&
      !panelRef.contains(e.target as Node) &&
      buttonRef &&
      !buttonRef.contains(e.target as Node)
    ) {
      setShowPanel(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const getPositionStyles = () => {
    const pos = position();
    const base: Record<string, string> = {
      position: "fixed",
      "z-index": "1000",
    };

    if (pos.includes("bottom")) {
      base.bottom = "60px";
    } else {
      base.top = "60px";
    }

    if (pos.includes("right")) {
      base.right = "16px";
    } else {
      base.left = "16px";
    }

    return base;
  };

  const getToastContainerStyles = () => {
    const pos = position();
    const base: Record<string, string> = {
      position: "fixed",
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "z-index": "1001",
      "pointer-events": "none",
    };

    if (pos.includes("bottom")) {
      base.bottom = "16px";
      base["flex-direction"] = "column-reverse";
    } else {
      base.top = "16px";
    }

    if (pos.includes("right")) {
      base.right = "16px";
      base["align-items"] = "flex-end";
    } else {
      base.left = "16px";
      base["align-items"] = "flex-start";
    }

    return base;
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setShowPanel(!showPanel())}
        title="Notifications"
        style={{
          position: "relative",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "32px",
          height: "32px",
          background: showPanel() ? "var(--cortex-bg-tertiary)" : "transparent",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          color: "var(--cortex-text-secondary)",
          cursor: "pointer",
        }}
      >
        <Icon name="bell" style={{ width: "16px", height: "16px" }} />
        <Show when={notifications.unreadCount() > 0}>
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              "min-width": "14px",
              height: "14px",
              padding: "0 4px",
              "font-size": "10px",
              "font-weight": "600",
              "line-height": "14px",
              "text-align": "center",
              background: "var(--cortex-accent-primary)",
              color: "white",
              "border-radius": "7px",
            }}
          >
            {notifications.unreadCount() > 99 ? "99+" : notifications.unreadCount()}
          </span>
        </Show>
      </button>

      <Show when={showPanel()}>
        <Portal>
          <div ref={panelRef} style={getPositionStyles()}>
            <div
              style={{
                width: "380px",
                "max-height": "480px",
                background: "var(--cortex-bg-primary)",
                border: "1px solid var(--cortex-border-default)",
                "border-radius": "var(--cortex-radius-lg)",
                "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.4)",
                overflow: "hidden",
                display: "flex",
                "flex-direction": "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                  padding: "12px 16px",
                  "border-bottom": "1px solid var(--cortex-border-default)",
                  background: "var(--cortex-bg-secondary)",
                }}
              >
                <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                  <Icon
                    name="bell"
                    style={{
                      width: "14px",
                      height: "14px",
                      color: "var(--cortex-text-secondary)",
                    }}
                  />
                  <span
                    style={{
                      "font-size": "13px",
                      "font-weight": "500",
                      color: "var(--cortex-text-primary)",
                    }}
                  >
                    Notifications
                  </span>
                  <Show when={notifications.unreadCount() > 0}>
                    <span
                      style={{
                        padding: "2px 6px",
                        "font-size": "11px",
                        background: "var(--cortex-accent-primary)",
                        color: "white",
                        "border-radius": "10px",
                      }}
                    >
                      {notifications.unreadCount()}
                    </span>
                  </Show>
                </div>

                <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <Show when={notifications.unreadCount() > 0}>
                    <button
                      onClick={() => notifications.markAllAsRead()}
                      title="Mark all as read"
                      style={{
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        width: "28px",
                        height: "28px",
                        background: "transparent",
                        border: "none",
                        "border-radius": "var(--cortex-radius-sm)",
                        color: "var(--cortex-text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      <Icon name="check-double" style={{ width: "14px", height: "14px" }} />
                    </button>
                  </Show>
                  <button
                    onClick={() => notifications.clearAll()}
                    title="Clear all"
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "28px",
                      height: "28px",
                      background: "transparent",
                      border: "none",
                      "border-radius": "var(--cortex-radius-sm)",
                      color: "var(--cortex-text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="trash" style={{ width: "14px", height: "14px" }} />
                  </button>
                  <button
                    onClick={() => setShowPanel(false)}
                    title="Close"
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "28px",
                      height: "28px",
                      background: "transparent",
                      border: "none",
                      "border-radius": "var(--cortex-radius-sm)",
                      color: "var(--cortex-text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  padding: "8px 12px",
                  "border-bottom": "1px solid var(--cortex-border-default)",
                  "overflow-x": "auto",
                }}
              >
                <For each={FILTER_OPTIONS}>
                  {(option) => (
                    <button
                      onClick={() => notifications.setFilter(option.value)}
                      style={{
                        padding: "4px 10px",
                        "font-size": "11px",
                        "white-space": "nowrap",
                        background:
                          notifications.filter() === option.value
                            ? "var(--cortex-accent-primary)"
                            : "var(--cortex-bg-tertiary)",
                        border: "none",
                        "border-radius": "var(--cortex-radius-sm)",
                        color:
                          notifications.filter() === option.value
                            ? "white"
                            : "var(--cortex-text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  )}
                </For>
              </div>

              <div
                style={{
                  flex: "1",
                  "overflow-y": "auto",
                  "min-height": "0",
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
                        padding: "48px 24px",
                        color: "var(--cortex-text-inactive)",
                      }}
                    >
                      <Icon
                        name="bell-slash"
                        style={{
                          width: "32px",
                          height: "32px",
                          "margin-bottom": "12px",
                          opacity: "0.5",
                        }}
                      />
                      <span style={{ "font-size": "13px" }}>No notifications</span>
                    </div>
                  }
                >
                  <For each={notifications.filteredNotifications()}>
                    {(notification) => (
                      <NotificationItem
                        notification={notification}
                        onMarkAsRead={notifications.markAsRead}
                        onRemove={notifications.removeNotification}
                        onAction={notifications.executeAction}
                      />
                    )}
                  </For>
                </Show>
              </div>

              <Show when={notifications.settings.doNotDisturb}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    gap: "8px",
                    padding: "8px",
                    "border-top": "1px solid var(--cortex-border-default)",
                    background: "var(--cortex-warning)20",
                  }}
                >
                  <Icon
                    name="moon"
                    style={{
                      width: "12px",
                      height: "12px",
                      color: "var(--cortex-warning)",
                    }}
                  />
                  <span
                    style={{
                      "font-size": "11px",
                      color: "var(--cortex-warning)",
                    }}
                  >
                    Do Not Disturb is on
                  </span>
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>

      <Portal>
        <div style={getToastContainerStyles()}>
          <For each={notifications.toasts()}>
            {(toast) => (
              <div style={{ "pointer-events": "auto" }}>
                <NotificationToast
                  notification={toast}
                  onDismiss={notifications.dismissToast}
                  onAction={notifications.executeAction}
                />
              </div>
            )}
          </For>
        </div>
      </Portal>
    </>
  );
}

export default NotificationsCenter;
