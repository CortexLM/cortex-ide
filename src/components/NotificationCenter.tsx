/**
 * NotificationCenter - A VS Code-style notification center panel
 * 
 * Features:
 * - Bell icon with badge showing unread count
 * - Notification panel with list of all notifications
 * - Group notifications by source
 * - Clear all button
 * - Do Not Disturb toggle
 * - Mark as read functionality
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useNotifications, type Notification } from "@/context/NotificationsContext";
import { IconButton, Text, Button } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// =============================================================================
// NOTIFICATION CENTER BUTTON (Status Bar Item)
// =============================================================================

export interface NotificationCenterButtonProps {
  onClick?: () => void;
}

export function NotificationCenterButton(props: NotificationCenterButtonProps) {
  const notifications = useNotifications();
  const unreadCount = () => notifications.unreadCount();

  return (
    <div
      class="notifications-badge"
      style={{ position: "relative", display: "inline-flex" }}
    >
      <IconButton
        size="sm"
        variant="ghost"
        onClick={() => {
          notifications.togglePanel();
          props.onClick?.();
        }}
        tooltip={
          notifications.settings.doNotDisturb
            ? "Notifications (Do Not Disturb)"
            : `Notifications (${unreadCount()} unread)`
        }
        active={notifications.isOpen()}
      >
        <Show when={notifications.settings.doNotDisturb} fallback={<Icon name="bell" />}>
          <Icon name="bell-slash" />
        </Show>
      </IconButton>
      <Show when={unreadCount() > 0 && !notifications.settings.doNotDisturb}>
        <span
          class="notifications-badge-count"
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            "min-width": "14px",
            height: "14px",
            padding: "0 3px",
            "font-size": "10px",
            "font-weight": "600",
            "line-height": "14px",
            "text-align": "center",
            background: tokens.colors.semantic.primary,
            color: "white",
            "border-radius": "var(--cortex-radius-full)",
            "pointer-events": "none",
          }}
        >
          {unreadCount() > 99 ? "99+" : unreadCount()}
        </span>
      </Show>
    </div>
  );
}

// =============================================================================
// NOTIFICATION CENTER PANEL
// =============================================================================

export function NotificationCenter() {
  const notifications = useNotifications();
  const [groupBySource] = createSignal(true);
  let panelRef: HTMLDivElement | undefined;

  // Close panel on click outside
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef &&
        !panelRef.contains(e.target as Node) &&
        notifications.isOpen()
      ) {
        // Check if click is on the bell button
        const target = e.target as HTMLElement;
        if (!target.closest(".notifications-badge")) {
          notifications.closePanel();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && notifications.isOpen()) {
        notifications.closePanel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Group notifications by source
  const groupedNotifications = createMemo(() => {
    const filtered = notifications.filteredNotifications();
    if (!groupBySource()) {
      return [{ source: null, items: filtered }];
    }

    const groups = new Map<string, Notification[]>();
    const noSource: Notification[] = [];

    for (const n of filtered) {
      if (n.source) {
        const existing = groups.get(n.source) || [];
        existing.push(n);
        groups.set(n.source, existing);
      } else {
        noSource.push(n);
      }
    }

    const result: { source: string | null; items: Notification[] }[] = [];
    groups.forEach((items, source) => {
      result.push({ source, items });
    });
    if (noSource.length > 0) {
      result.push({ source: null, items: noSource });
    }

    return result;
  });

  const hasNotifications = createMemo(
    () => notifications.filteredNotifications().length > 0
  );

  return (
    <Show when={notifications.isOpen()}>
      <div
        ref={panelRef}
        class="notifications-center visible"
        style={{
          position: "fixed",
          right: "16px",
          bottom: "30px",
          "z-index": tokens.zIndex.notifications,
          width: "380px",
          "max-width": "calc(100vw - 32px)",
          "max-height": "450px",
          background: tokens.colors.surface.popup,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.lg,
          "box-shadow": tokens.shadows.popup,
          overflow: "hidden",
          display: "flex",
          "flex-direction": "column",
        }}
        role="dialog"
        aria-label="Notification Center"
      >
        {/* Header */}
        <div
          class="notifications-center-header"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "8px 12px",
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            "flex-shrink": 0,
          }}
        >
          <Text
            variant="muted"
            size="xs"
            weight="semibold"
            style={{
              "text-transform": "uppercase",
              "letter-spacing": "0.5px",
            }}
          >
            Notifications
          </Text>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.xs,
            }}
          >
            {/* Do Not Disturb Toggle */}
            <IconButton
              size="sm"
              variant="ghost"
              onClick={() =>
                notifications.updateSettings({
                  doNotDisturb: !notifications.settings.doNotDisturb,
                })
              }
              tooltip={
                notifications.settings.doNotDisturb
                  ? "Disable Do Not Disturb"
                  : "Enable Do Not Disturb"
              }
              active={notifications.settings.doNotDisturb}
            >
              <Icon name="bell-slash" />
            </IconButton>

            {/* Mark All as Read */}
            <Show when={notifications.unreadCount() > 0}>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={() => notifications.markAllAsRead()}
                tooltip="Mark All as Read"
              >
                <Icon name="circle-check" />
              </IconButton>
            </Show>

            {/* Clear All */}
            <Show when={hasNotifications()}>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={() => notifications.clearAll()}
                tooltip="Clear All Notifications"
              >
                <Icon name="trash" />
              </IconButton>
            </Show>

            {/* Close Panel */}
            <IconButton
              size="sm"
              variant="ghost"
              onClick={() => notifications.closePanel()}
              tooltip="Close"
            >
              <Icon name="xmark" />
            </IconButton>
          </div>
        </div>

        {/* Do Not Disturb Banner */}
        <Show when={notifications.settings.doNotDisturb}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.md,
              padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
              background: `${tokens.colors.semantic.warning}20`,
              "border-bottom": `1px solid ${tokens.colors.border.divider}`,
              "flex-shrink": 0,
            }}
          >
            <Icon
              name="bell-slash"
              style={{
                width: "14px",
                height: "14px",
                color: tokens.colors.semantic.warning,
              }}
            />
            <Text variant="muted" size="sm">
              Do Not Disturb is enabled
            </Text>
          </div>
        </Show>

        {/* Notifications List */}
        <div
          class="notifications-list-container"
          style={{
            flex: 1,
            "overflow-y": "auto",
            "overflow-x": "hidden",
          }}
        >
          <Show
            when={hasNotifications()}
            fallback={
              <div
                class="notifications-center-empty"
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "justify-content": "center",
                  padding: "40px 20px",
                  color: tokens.colors.text.muted,
                }}
              >
                <Icon
                  name="bell"
                  style={{
                    width: "32px",
                    height: "32px",
                    opacity: 0.4,
                    "margin-bottom": "12px",
                  }}
                />
                <Text variant="muted">No notifications</Text>
              </div>
            }
          >
            <For each={groupedNotifications()}>
              {(group) => (
                <>
                  <Show when={group.source && groupBySource()}>
                    <div
                      style={{
                        padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
                        background: tokens.colors.surface.panel,
                        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                      }}
                    >
                      <Text
                        variant="muted"
                        size="xs"
                        weight="semibold"
                        style={{ "text-transform": "uppercase" }}
                      >
                        {group.source}
                      </Text>
                    </div>
                  </Show>
                  <For each={group.items}>
                    {(notification) => (
                      <NotificationItem
                        notification={notification}
                        onDismiss={() =>
                          notifications.removeNotification(notification.id)
                        }
                        onMarkAsRead={() =>
                          notifications.markAsRead(notification.id)
                        }
                        onAction={(actionId) =>
                          notifications.executeAction(notification.id, actionId)
                        }
                      />
                    )}
                  </For>
                </>
              )}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  );
}

// =============================================================================
// NOTIFICATION ITEM
// =============================================================================

interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
  onMarkAsRead: () => void;
  onAction: (actionId: string) => void;
}

function NotificationItem(props: NotificationItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const getIconName = () => {
    switch (props.notification.type) {
      case "error_alert":
        return "circle-exclamation";
      case "warning":
        return "triangle-exclamation";
      case "success":
        return "circle-check";
      case "build_result":
        return props.notification.metadata?.success ? "circle-check" : "circle-exclamation";
      default:
        return "circle-info";
    }
  };

  const getIconColor = (): string => {
    switch (props.notification.type) {
      case "error_alert":
        return tokens.colors.semantic.error;
      case "warning":
        return tokens.colors.semantic.warning;
      case "success":
        return tokens.colors.semantic.success;
      case "build_result":
        return props.notification.metadata?.success
          ? tokens.colors.semantic.success
          : tokens.colors.semantic.error;
      default:
        return tokens.colors.semantic.info;
    }
  };

  const iconName = getIconName();

  const timeAgo = createMemo(() => {
    const diff = Date.now() - props.notification.timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  });

  return (
    <div
      class="notification-list-item"
      style={{
        display: "flex",
        "flex-direction": "column",
        padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        background: isHovered()
          ? tokens.colors.interactive.hover
          : props.notification.isRead
          ? "transparent"
          : `${tokens.colors.semantic.primary}08`,
        cursor: "pointer",
        transition: "background 100ms ease",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (!props.notification.isRead) {
          props.onMarkAsRead();
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
      role="listitem"
    >
      {/* Main Row */}
      <div
        style={{
          display: "flex",
          "align-items": "flex-start",
          gap: tokens.spacing.md,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "20px",
            height: "20px",
            "flex-shrink": 0,
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: getIconColor(),
          }}
        >
          <Icon name={iconName} style={{ width: "16px", height: "16px" }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, "min-width": 0 }}>
          {/* Title */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              gap: tokens.spacing.md,
            }}
          >
            <Text
              variant="body"
              weight={props.notification.isRead ? "regular" : "medium"}
              style={{
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {props.notification.title}
            </Text>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.xs,
                "flex-shrink": 0,
              }}
            >
              <Text
                variant="muted"
                size="xs"
                style={{ "white-space": "nowrap" }}
              >
                {timeAgo()}
              </Text>
              <Show when={isHovered()}>
                <button
                  style={{
                    padding: "2px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: tokens.colors.text.muted,
                    "border-radius": tokens.radius.sm,
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDismiss();
                  }}
                  title="Dismiss"
                >
                  <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
                </button>
              </Show>
            </div>
          </div>

          {/* Message */}
          <Text
            variant="muted"
            size="sm"
            style={{
              "margin-top": tokens.spacing.xs,
              display: "-webkit-box",
              "-webkit-line-clamp": "2",
              "-webkit-box-orient": "vertical",
              overflow: "hidden",
            }}
          >
            {props.notification.message}
          </Text>

          {/* Actions */}
          <Show when={props.notification.actions?.length}>
            <div
              style={{
                display: "flex",
                gap: tokens.spacing.sm,
                "margin-top": tokens.spacing.md,
              }}
            >
              <For each={props.notification.actions}>
                {(action) => (
                  <Button
                    variant={action.variant === "primary" ? "primary" : "ghost"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onAction(action.id);
                    }}
                    style={{
                      height: "24px",
                      padding: "0 8px",
                      "font-size": "11px",
                    }}
                  >
                    {action.label}
                  </Button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Unread indicator */}
        <Show when={!props.notification.isRead}>
          <div
            style={{
              width: "6px",
              height: "6px",
              "border-radius": "var(--cortex-radius-full)",
              background: tokens.colors.semantic.primary,
              "flex-shrink": 0,
              "margin-top": "7px",
            }}
          />
        </Show>
      </div>
    </div>
  );
}

export default NotificationCenter;

