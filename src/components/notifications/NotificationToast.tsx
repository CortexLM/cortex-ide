import { Show, For, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { Notification } from "@/context/NotificationsContext";

export interface NotificationToastProps {
  notification: Notification;
  onDismiss?: (id: string) => void;
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

export function NotificationToast(props: NotificationToastProps) {
  const [isExiting, setIsExiting] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      props.onDismiss?.(props.notification.id);
    }, 200);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        gap: "12px",
        padding: "12px 16px",
        background: "var(--cortex-bg-elevated)",
        border: "1px solid var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-lg)",
        "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
        "max-width": "360px",
        "min-width": "280px",
        animation: isExiting()
          ? "toast-exit 0.2s ease-out forwards"
          : "toast-enter 0.2s ease-out",
        transform: "translateX(0)",
        opacity: "1",
      }}
    >
      <div
        style={{
          "flex-shrink": "0",
          width: "24px",
          height: "24px",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
      >
        <Icon
          name={getNotificationIcon(props.notification.type)}
          style={{
            width: "18px",
            height: "18px",
            color: getNotificationColor(props.notification.type),
          }}
        />
      </div>

      <div style={{ flex: "1", "min-width": "0" }}>
        <Show when={props.notification.title}>
          <div
            style={{
              "font-size": "13px",
              "font-weight": "500",
              color: "var(--cortex-text-primary)",
              "margin-bottom": "4px",
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

        <Show when={props.notification.actions && props.notification.actions.length > 0}>
          <div style={{ display: "flex", gap: "8px", "margin-top": "10px" }}>
            <For each={props.notification.actions}>
              {(action) => (
                <button
                  onClick={() => props.onAction?.(props.notification.id, action.id)}
                  style={{
                    padding: "5px 12px",
                    "font-size": "11px",
                    "font-weight": "500",
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
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.notification.type === "progress" && props.notification.progress !== undefined}>
          <div
            style={{
              "margin-top": "10px",
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

      <button
        onClick={handleDismiss}
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
          "flex-shrink": "0",
          opacity: isHovered() ? "1" : "0.5",
          transition: "opacity 0.15s ease",
        }}
      >
        <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
      </button>

      <style>{`
        @keyframes toast-enter {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes toast-exit {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default NotificationToast;
