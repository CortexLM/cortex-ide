import { Show, For, createSignal, type JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type {
  Notification as NotificationType,
  NotificationType as NotificationVariant,
} from "@/context/NotificationsContext";

export interface NotificationProps {
  notification: NotificationType;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onRemove: (id: string) => void;
  onAction: (notificationId: string, actionId: string) => void;
}

const ICON_NAME_MAP: Record<NotificationVariant, string> = {
  collaboration_invite: "user-plus",
  mention: "at",
  build_result: "screwdriver-wrench",
  error_alert: "circle-exclamation",
  update_available: "download",
  info: "circle-info",
  success: "circle-check",
  warning: "triangle-exclamation",
  progress: "spinner",
};

// JetBrains/Cortex severity icon colors
const ICON_COLORS: Record<NotificationVariant, string> = {
  error_alert: "var(--cortex-error)",
  warning: "var(--cortex-warning)",
  success: "var(--cortex-success)",
  update_available: "var(--jb-border-focus)",
  collaboration_invite: "var(--cortex-info)",
  mention: "var(--cortex-info)",
  build_result: "var(--jb-text-body-color)",
  info: "var(--jb-border-focus)",
  progress: "var(--jb-border-focus)",
};

// VS Code spec constants
const ROW_HEIGHT = 42;    // Collapsed notification height
const LINE_HEIGHT = 22;   // Single line of text
const ICON_SIZE = 22;     // VS Code icon size

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function Notification(props: NotificationProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);

  const iconName = ICON_NAME_MAP[props.notification.type] || "bell";
  const iconColor = ICON_COLORS[props.notification.type] || "var(--jb-border-focus)";

  // Check if notification has expandable content
  const hasExpandableContent = () => 
    props.notification.source || 
    (props.notification.actions && props.notification.actions.length > 0);

  // Button style helper
  const toolbarButtonStyle = (): JSX.CSSProperties => ({
    opacity: isHovered() || isExpanded() ? 1 : 0,
    padding: "4px",
    "border-radius": "var(--jb-radius-lg)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "var(--jb-text-muted-color)",
    transition: "opacity 0.15s ease",
  });

  return (
    <div
      style={{
        /* VS Code spec: 42px collapsed, variable expanded, 10px 14px padding */
        "min-height": `${ROW_HEIGHT}px`,
        padding: "10px 14px",
        "box-sizing": "border-box",
        "border-radius": "var(--jb-radius-lg)",
        background: props.notification.isRead
          ? "var(--jb-popup)"
          : "color-mix(in srgb, var(--jb-popup) 80%, transparent)",
        "border-bottom": "1px solid var(--jb-border-divider)",
        cursor: hasExpandableContent() ? "pointer" : "default",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDblClick={() => hasExpandableContent() && setIsExpanded(!isExpanded())}
    >
      {/* Main row */}
      <div 
        style={{
          display: "flex",
          "flex-grow": "1",
          "align-items": "flex-start",
        }}
      >
        {/* Severity Icon - VS Code spec: 22px size */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            flex: `0 0 ${ICON_SIZE}px`,
            width: `${ICON_SIZE}px`,
            height: `${ICON_SIZE}px`,
            "margin-right": "10px",
            "flex-shrink": "0",
          }}
        >
          <Icon
            name={iconName}
            style={{ 
              width: `${ICON_SIZE}px`, 
              height: `${ICON_SIZE}px`, 
              color: iconColor,
              "flex-shrink": "0",
            }}
          />
        </div>

        {/* Message container - VS Code spec: 22px line-height, ellipsis overflow */}
        <div
          style={{
            "line-height": `${LINE_HEIGHT}px`,
            overflow: "hidden",
            "text-overflow": isExpanded() ? "unset" : "ellipsis",
            flex: "1",
            "user-select": "text",
            "white-space": isExpanded() ? "normal" : "nowrap",
            "word-wrap": isExpanded() ? "break-word" : "normal",
            "font-size": "var(--jb-font-size-base)",
            color: "var(--jb-text-body-color)",
          }}
        >
          <span style={{ "font-weight": "600", "margin-right": "4px" }}>
            {props.notification.title}
          </span>
          <span style={{ opacity: props.notification.isRead ? 0.7 : 1 }}>
            {props.notification.message}
          </span>
        </div>

        {/* Timestamp - always visible */}
        <span
          style={{
            "font-size": "var(--jb-font-size-xs)",
            color: "var(--jb-text-muted-color)",
            "flex-shrink": "0",
            "margin-left": "8px",
            "line-height": `${LINE_HEIGHT}px`,
          }}
        >
          {formatRelativeTime(props.notification.timestamp)}
        </span>

        {/* Toolbar container - VS Code spec: visible on hover/focus/expanded */}
        <div
          style={{
            display: "flex",
            height: `${LINE_HEIGHT}px`,
            "flex-shrink": "0",
            "margin-left": "4px",
            opacity: isHovered() || isExpanded() ? 1 : 0,
            transition: "opacity 100ms ease",
          }}
        >
          {/* Mark read/unread button */}
          <button
            style={toolbarButtonStyle()}
            onClick={(e) => {
              e.stopPropagation();
              props.notification.isRead
                ? props.onMarkUnread(props.notification.id)
                : props.onMarkRead(props.notification.id);
            }}
            title={props.notification.isRead ? "Mark as unread" : "Mark as read"}
            aria-label={props.notification.isRead ? "Mark as unread" : "Mark as read"}
          >
            {props.notification.isRead ? (
              <Icon name="circle" style={{ width: "14px", height: "14px" }} />
            ) : (
              <Icon name="check" style={{ width: "14px", height: "14px" }} />
            )}
          </button>

          {/* Close/remove button */}
          <button
            style={toolbarButtonStyle()}
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove(props.notification.id);
            }}
            title="Remove notification"
            aria-label="Remove notification"
          >
            <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </div>

      {/* Details row - VS Code spec: visible when expanded */}
      <Show when={isExpanded() && hasExpandableContent()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "padding-left": "24px", /* Align with message after icon */
            overflow: "hidden",
            "margin-top": "4px",
          }}
        >
          {/* Source label - VS Code spec: 12px font-size */}
          <Show when={props.notification.source}>
            <span
              style={{
                flex: "1",
                "font-size": "var(--jb-font-size-sm)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                color: "var(--jb-text-muted-color)",
              }}
            >
              Source: {props.notification.source}
            </span>
          </Show>

          {/* Action buttons - VS Code spec: 2px 8px padding, 12px font-size */}
          <Show when={props.notification.actions && props.notification.actions.length > 0}>
            <div
              style={{
                display: "flex",
                overflow: "hidden",
                gap: "8px",
                "margin-top": "8px",
              }}
            >
              <For each={props.notification.actions}>
                {(action) => (
                  <button
                    style={{
                      width: "fit-content",
                      padding: "2px 8px",
                      display: "inline-block",
                      "font-size": "var(--jb-font-size-sm)",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "outline-offset": "2px",
                      "border-radius": "var(--jb-radius-lg)",
                      border: "none",
                      cursor: "pointer",
                      background:
                        action.variant === "primary"
                          ? "var(--jb-border-focus)"
                          : action.variant === "danger"
                          ? "var(--cortex-error)"
                          : "var(--jb-hover-bg)",
                      color:
                        action.variant === "primary" || action.variant === "danger"
                          ? "white"
                          : "var(--jb-text-body-color)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onAction(props.notification.id, action.id);
                    }}
                  >
                    {action.label}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default Notification;

