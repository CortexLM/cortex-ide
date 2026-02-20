/**
 * CortexNotifications - Notification center and toast system for Cortex Desktop
 *
 * Features:
 * - Toast notifications (bottom-right, auto-dismiss with configurable timeout)
 * - Notification types: info / warning / error / success
 * - Action buttons on notifications
 * - Notification history panel (slides out from right)
 * - Bridges `notification:show` and `notifications:toggle` events to NotificationsContext
 */

import {
  Component,
  Show,
  For,
  onMount,
  onCleanup,
  createSignal,
  createMemo,
} from "solid-js";
import { Portal } from "solid-js/web";
import { CortexIcon } from "./primitives";
import { useNotifications } from "@/context/NotificationsContext";
import type { Notification, NotificationAction } from "@/context/NotificationsContext";
import type { NotificationEvent } from "@/utils/notifications";

const TOAST_DEFAULT_DURATION: Record<string, number> = {
  info: 5000,
  success: 4000,
  warning: 7000,
  error: 10000,
  error_alert: 10000,
};

const TYPE_ICON: Record<string, string> = {
  success: "check-circle",
  error: "circle-xmark",
  error_alert: "circle-xmark",
  warning: "warning",
  info: "info",
  progress: "refresh",
};

const TYPE_COLOR: Record<string, string> = {
  success: "var(--cortex-success, #6a9955)",
  error: "var(--cortex-error, #f44747)",
  error_alert: "var(--cortex-error, #f44747)",
  warning: "var(--cortex-warning, #dcdcaa)",
  info: "var(--cortex-info, #569cd6)",
  progress: "var(--cortex-accent-primary)",
};

interface ToastEntry {
  id: string;
  notification: Notification;
  timer: ReturnType<typeof setTimeout> | null;
}

export function CortexNotifications() {
  const notifications = useNotifications();
  const [showPanel, setShowPanel] = createSignal(false);
  const [localToasts, setLocalToasts] = createSignal<ToastEntry[]>([]);
  let panelRef: HTMLDivElement | undefined;

  const dismissLocalToast = (id: string) => {
    setLocalToasts((prev) => {
      const entry = prev.find((t) => t.id === id);
      if (entry?.timer) clearTimeout(entry.timer);
      return prev.filter((t) => t.id !== id);
    });
    notifications.dismissToast(id);
  };

  const addLocalToast = (n: Notification) => {
    const duration = n.duration ?? TOAST_DEFAULT_DURATION[n.type] ?? 5000;
    const timer =
      duration > 0
        ? setTimeout(() => dismissLocalToast(n.id), duration)
        : null;

    setLocalToasts((prev) => {
      const next = [...prev, { id: n.id, notification: n, timer }];
      return next.length > 5 ? next.slice(-5) : next;
    });
  };

  onMount(() => {
    const handleNotificationShow = (e: Event) => {
      const detail = (e as CustomEvent<NotificationEvent>).detail;
      if (!detail) return;

      const typeMap: Record<string, string> = {
        error: "error_alert",
        warning: "warning",
        info: "info",
        success: "success",
      };
      const mappedType = typeMap[detail.type] || "info";

      const id = notifications.notify({
        type: detail.type as "info" | "success" | "warning" | "error",
        title: detail.title,
        message: detail.message,
        duration: detail.duration,
        toast: false,
        persist: true,
      });

      const toastNotification: Notification = {
        id,
        type: mappedType as Notification["type"],
        title: detail.title,
        message: detail.message,
        timestamp: Date.now(),
        isRead: false,
        priority: detail.type === "error" ? "high" : "normal",
        duration: detail.duration,
      };
      addLocalToast(toastNotification);
    };

    const handleToggle = () => {
      setShowPanel((prev) => !prev);
    };

    window.addEventListener("notification:show", handleNotificationShow);
    window.addEventListener("notifications:toggle", handleToggle);

    onCleanup(() => {
      window.removeEventListener("notification:show", handleNotificationShow);
      window.removeEventListener("notifications:toggle", handleToggle);
      localToasts().forEach((t) => {
        if (t.timer) clearTimeout(t.timer);
      });
    });
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (panelRef && !panelRef.contains(e.target as Node)) {
      setShowPanel(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  const sortedHistory = createMemo(() =>
    [...notifications.notifications].sort((a, b) => b.timestamp - a.timestamp)
  );

  return (
    <>
      {/* Toast container — bottom-right */}
      <Portal>
        <div
          style={{
            position: "fixed",
            bottom: "48px",
            right: "16px",
            display: "flex",
            "flex-direction": "column-reverse",
            gap: "8px",
            "z-index": "9999",
            "pointer-events": "none",
            "max-width": "400px",
          }}
        >
          <For each={localToasts()}>
            {(entry) => (
              <ToastCard
                notification={entry.notification}
                onDismiss={() => dismissLocalToast(entry.id)}
                onAction={(actionId) =>
                  notifications.executeAction(entry.id, actionId)
                }
              />
            )}
          </For>
        </div>
      </Portal>

      {/* History panel — slides from right */}
      <Show when={showPanel()}>
        <Portal>
          <div
            style={{
              position: "fixed",
              inset: "0",
              "z-index": "9998",
              background: "rgba(0,0,0,0.3)",
            }}
          />
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: "0",
              right: "0",
              bottom: "0",
              width: "380px",
              background: "var(--cortex-bg-primary, #141415)",
              border: "1px solid var(--cortex-border-default, #2E2F31)",
              "box-shadow": "-4px 0 24px rgba(0,0,0,0.4)",
              display: "flex",
              "flex-direction": "column",
              "z-index": "9999",
              "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
              animation: "cortex-slide-in-right 200ms ease-out",
            }}
          >
            <style>{`
              @keyframes cortex-slide-in-right {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>

            {/* Header */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "12px 16px",
                "border-bottom":
                  "1px solid var(--cortex-border-default, #2E2F31)",
                "flex-shrink": "0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                }}
              >
                <CortexIcon
                  name="bell"
                  size={16}
                  color="var(--cortex-text-secondary)"
                />
                <span
                  style={{
                    "font-size": "14px",
                    "font-weight": "600",
                    color: "var(--cortex-text-primary)",
                  }}
                >
                  Notifications
                </span>
                <Show when={notifications.unreadCount() > 0}>
                  <span
                    style={{
                      padding: "1px 6px",
                      "font-size": "11px",
                      "font-weight": "600",
                      background: "var(--cortex-accent-primary, #BFFF00)",
                      color: "#000",
                      "border-radius": "10px",
                    }}
                  >
                    {notifications.unreadCount()}
                  </span>
                </Show>
              </div>

              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                }}
              >
                <Show when={notifications.unreadCount() > 0}>
                  <PanelButton
                    icon="check"
                    title="Mark all as read"
                    onClick={() => notifications.markAllAsRead()}
                  />
                </Show>
                <PanelButton
                  icon="trash-03"
                  title="Clear all"
                  onClick={() => notifications.clearAll()}
                />
                <PanelButton
                  icon="x-close"
                  title="Close"
                  onClick={() => setShowPanel(false)}
                />
              </div>
            </div>

            {/* List */}
            <div
              style={{
                flex: "1",
                "overflow-y": "auto",
                "min-height": "0",
              }}
            >
              <Show
                when={sortedHistory().length > 0}
                fallback={
                  <div
                    style={{
                      display: "flex",
                      "flex-direction": "column",
                      "align-items": "center",
                      "justify-content": "center",
                      padding: "64px 24px",
                      color: "var(--cortex-text-inactive, #555)",
                    }}
                  >
                    <CortexIcon
                      name="bell"
                      size={32}
                      color="var(--cortex-text-inactive)"
                      style={{ opacity: "0.4", "margin-bottom": "12px" }}
                    />
                    <span style={{ "font-size": "13px" }}>
                      No notifications
                    </span>
                  </div>
                }
              >
                <For each={sortedHistory()}>
                  {(n) => (
                    <HistoryItem
                      notification={n}
                      onMarkAsRead={() => notifications.markAsRead(n.id)}
                      onRemove={() => notifications.removeNotification(n.id)}
                      onAction={(actionId) =>
                        notifications.executeAction(n.id, actionId)
                      }
                    />
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}

const PanelButton: Component<{
  icon: string;
  title: string;
  onClick: () => void;
}> = (props) => {
  const [hovered, setHovered] = createSignal(false);

  return (
    <button
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        width: "28px",
        height: "28px",
        background: hovered()
          ? "rgba(255,255,255,0.08)"
          : "transparent",
        border: "none",
        "border-radius": "var(--cortex-radius-sm, 4px)",
        color: "var(--cortex-text-secondary)",
        cursor: "pointer",
      }}
    >
      <CortexIcon name={props.icon} size={14} color="currentColor" />
    </button>
  );
};

const ToastCard: Component<{
  notification: Notification;
  onDismiss: () => void;
  onAction: (actionId: string) => void;
}> = (props) => {
  const iconName = () =>
    TYPE_ICON[props.notification.type] || "bell";
  const iconColor = () =>
    TYPE_COLOR[props.notification.type] || "var(--cortex-text-secondary)";

  return (
    <div
      style={{
        "pointer-events": "auto",
        display: "flex",
        gap: "10px",
        padding: "12px 14px",
        background: "var(--cortex-bg-secondary, #1E1E1F)",
        border: "1px solid var(--cortex-border-default, #2E2F31)",
        "border-radius": "var(--cortex-radius-lg, 12px)",
        "box-shadow": "0 4px 16px rgba(0,0,0,0.4)",
        "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
        animation: "cortex-toast-in 200ms ease-out",
        "max-width": "400px",
      }}
    >
      <style>{`
        @keyframes cortex-toast-in {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <CortexIcon
        name={iconName()}
        size={18}
        color={iconColor()}
        style={{ "flex-shrink": "0", "margin-top": "1px" }}
      />

      <div style={{ flex: "1", "min-width": "0" }}>
        <div
          style={{
            "font-size": "13px",
            "font-weight": "600",
            color: "var(--cortex-text-primary)",
            "margin-bottom": "2px",
          }}
        >
          {props.notification.title}
        </div>
        <div
          style={{
            "font-size": "12px",
            color: "var(--cortex-text-secondary, #8C8D8F)",
            "line-height": "1.4",
            "word-break": "break-word",
          }}
        >
          {props.notification.message}
        </div>

        <Show
          when={
            props.notification.actions &&
            props.notification.actions.length > 0
          }
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              "margin-top": "8px",
            }}
          >
            <For each={props.notification.actions}>
              {(action: NotificationAction) => (
                <button
                  onClick={() => props.onAction(action.id)}
                  style={{
                    padding: "3px 10px",
                    "font-size": "11px",
                    "font-weight": "500",
                    background:
                      action.variant === "primary"
                        ? "var(--cortex-accent-primary, #BFFF00)"
                        : "var(--cortex-bg-tertiary, #2A2A2B)",
                    color:
                      action.variant === "primary"
                        ? "#000"
                        : "var(--cortex-text-primary)",
                    border: "none",
                    "border-radius": "var(--cortex-radius-sm, 4px)",
                    cursor: "pointer",
                    "font-family": "inherit",
                  }}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <button
        onClick={props.onDismiss}
        aria-label="Dismiss"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "20px",
          height: "20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          "flex-shrink": "0",
          padding: "0",
        }}
      >
        <CortexIcon
          name="x-close"
          size={12}
          color="var(--cortex-text-muted, #555)"
        />
      </button>
    </div>
  );
};

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

const HistoryItem: Component<{
  notification: Notification;
  onMarkAsRead: () => void;
  onRemove: () => void;
  onAction: (actionId: string) => void;
}> = (props) => {
  const [hovered, setHovered] = createSignal(false);
  const iconName = () =>
    TYPE_ICON[props.notification.type] || "bell";
  const iconColor = () =>
    TYPE_COLOR[props.notification.type] || "var(--cortex-text-secondary)";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!props.notification.isRead) props.onMarkAsRead();
      }}
      style={{
        display: "flex",
        gap: "10px",
        padding: "10px 16px",
        cursor: "pointer",
        background: hovered()
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        "border-bottom":
          "1px solid var(--cortex-border-default, rgba(255,255,255,0.06))",
        opacity: props.notification.isRead ? "0.6" : "1",
        transition: "background 100ms ease, opacity 100ms ease",
      }}
    >
      <CortexIcon
        name={iconName()}
        size={16}
        color={iconColor()}
        style={{ "flex-shrink": "0", "margin-top": "2px" }}
      />

      <div style={{ flex: "1", "min-width": "0" }}>
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            "margin-bottom": "2px",
          }}
        >
          <span
            style={{
              "font-size": "12px",
              "font-weight": props.notification.isRead ? "400" : "600",
              color: "var(--cortex-text-primary)",
            }}
          >
            {props.notification.title}
          </span>
          <span
            style={{
              "font-size": "10px",
              color: "var(--cortex-text-muted, #555)",
              "flex-shrink": "0",
              "margin-left": "8px",
            }}
          >
            {formatTimestamp(props.notification.timestamp)}
          </span>
        </div>
        <div
          style={{
            "font-size": "11px",
            color: "var(--cortex-text-secondary, #8C8D8F)",
            "line-height": "1.4",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            display: "-webkit-box",
            "-webkit-line-clamp": "2",
            "-webkit-box-orient": "vertical",
          }}
        >
          {props.notification.message}
        </div>

        <Show
          when={
            props.notification.actions &&
            props.notification.actions.length > 0
          }
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              "margin-top": "6px",
            }}
          >
            <For each={props.notification.actions}>
              {(action: NotificationAction) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onAction(action.id);
                  }}
                  style={{
                    padding: "2px 8px",
                    "font-size": "10px",
                    "font-weight": "500",
                    background:
                      action.variant === "primary"
                        ? "var(--cortex-accent-primary, #BFFF00)"
                        : "var(--cortex-bg-tertiary, #2A2A2B)",
                    color:
                      action.variant === "primary"
                        ? "#000"
                        : "var(--cortex-text-primary)",
                    border: "none",
                    "border-radius": "var(--cortex-radius-sm, 4px)",
                    cursor: "pointer",
                    "font-family": "inherit",
                  }}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={hovered()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove();
          }}
          aria-label="Remove notification"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "20px",
            height: "20px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            "flex-shrink": "0",
            padding: "0",
          }}
        >
          <CortexIcon
            name="x-close"
            size={12}
            color="var(--cortex-text-muted, #555)"
          />
        </button>
      </Show>
    </div>
  );
};

export default CortexNotifications;
