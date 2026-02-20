import { Show, For } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { Notification } from "@/context/NotificationsContext";

export interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onRemove?: (id: string) => void;
  onAction?: (notificationId: string, actionId: string) => void;
}

function getNotificationIcon(type: Notification["type"]): string {
  switch (type) {
    case "success":
      return "circle-check";
    case "error_alert":
      return "circle-exclamation";
    case "warning":
      return "triangle-exclamation";
    case "info":
      return "circle-info";
    case "progress":
      return "spinner";
    case "collaboration_invite":
      return "user-plus";
    case "mention":
      return "at";
    case "build_result":
      return "hammer";
    case "update_available":
      return "download";
    default:
      return "bell";
  }
}

function getNotificationColor(type: Notification["type"]): string {
  switch (type) {
    case "success":
      return "var(--cortex-success, #6a9955)";
    case "error_alert":
      return "var(--cortex-error, #f44747)";
    case "warning":
      return "var(--cortex-warning, #dcdcaa)";
    case "info":
      return "var(--cortex-info, #569cd6)";
    case "progress":
      return "var(--cortex-accent-primary)";
    default:
      return "var(--cortex-text-secondary)";
  }
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function NotificationItem(props: NotificationItemProps) {
  const handleClick = () => {
    if (!props.notification.isRead && props.onMarkAsRead) {
      props.onMarkAsRead(props.notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex",
        gap: "12px",
        padding: "12px",
        background: props.notification.isRead
          ? "transparent"
          : "var(--cortex-bg-tertiary)",
        "border-bottom": "1px solid var(--cortex-border-default)",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--cortex-bg-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = props.notification.isRead
          ? "transparent"
          : "var(--cortex-bg-tertiary)";
      }}
    >
      <div
        style={{
          "flex-shrink": "0",
          width: "32px",
          height: "32px",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "border-radius": "50%",
          background: `${getNotificationColor(props.notification.type)}20`,
        }}
      >
        <Icon
          name={getNotificationIcon(props.notification.type)}
          style={{
            width: "16px",
            height: "16px",
            color: getNotificationColor(props.notification.type),
          }}
        />
      </div>

      <div style={{ flex: "1", "min-width": "0" }}>
        <div
          style={{
            display: "flex",
            "align-items": "flex-start",
            "justify-content": "space-between",
            gap: "8px",
          }}
        >
          <div style={{ flex: "1", "min-width": "0" }}>
            <Show when={props.notification.title}>
              <div
                style={{
                  "font-size": "13px",
                  "font-weight": "500",
                  color: "var(--cortex-text-primary)",
                  "margin-bottom": "2px",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                }}
              >
                {props.notification.title}
              </div>
            </Show>
            <div
              style={{
                "font-size": "12px",
                color: "var(--cortex-text-secondary)",
                "line-height": "1.4",
              }}
            >
              {props.notification.message}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove?.(props.notification.id);
            }}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "20px",
              height: "20px",
              background: "transparent",
              border: "none",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-inactive)",
              cursor: "pointer",
              opacity: "0",
              transition: "opacity 0.15s ease",
            }}
            class="notification-remove-btn"
          >
            <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            "margin-top": "8px",
          }}
        >
          <div
            style={{
              "font-size": "11px",
              color: "var(--cortex-text-inactive)",
            }}
          >
            <Show when={props.notification.source}>
              <span style={{ "margin-right": "8px" }}>{props.notification.source}</span>
            </Show>
            {formatTimestamp(props.notification.timestamp)}
          </div>

          <Show when={props.notification.actions && props.notification.actions.length > 0}>
            <div style={{ display: "flex", gap: "6px" }}>
              <For each={props.notification.actions}>
                {(action) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onAction?.(props.notification.id, action.id);
                    }}
                    style={{
                      padding: "4px 8px",
                      "font-size": "11px",
                      background:
                        action.variant === "primary"
                          ? "var(--cortex-accent-primary)"
                          : action.variant === "danger"
                          ? "var(--cortex-error)"
                          : "var(--cortex-bg-tertiary)",
                      border: "none",
                      "border-radius": "var(--cortex-radius-sm)",
                      color:
                        action.variant === "primary" || action.variant === "danger"
                          ? "white"
                          : "var(--cortex-text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {action.label}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={props.notification.type === "progress" && props.notification.progress !== undefined}>
          <div
            style={{
              "margin-top": "8px",
              height: "4px",
              background: "var(--cortex-bg-tertiary)",
              "border-radius": "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${props.notification.progress}%`,
                background: "var(--cortex-accent-primary)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </Show>
      </div>

      <style>{`
        .notification-remove-btn {
          opacity: 0 !important;
        }
        div:hover > .notification-remove-btn,
        div:hover .notification-remove-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

export default NotificationItem;
