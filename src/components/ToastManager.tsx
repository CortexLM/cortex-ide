/**
 * ToastManager - Renders toast notifications from NotificationsContext
 * 
 * This component connects the NotificationsContext toast state to the Toast UI components.
 * It should be rendered once at the app root level.
 */

import { For, Show } from "solid-js";
import { useNotifications } from "@/context/NotificationsContext";
import { Toast, type ToastType, type ToastAction } from "@/components/ui/Toast";
import { tokens } from "@/design-system/tokens";

export function ToastManager() {
  const notifications = useNotifications();
  const toasts = () => notifications.toasts();

  // Map notification type to toast type
  const mapType = (type: string): ToastType => {
    switch (type) {
      case "success":
        return "success";
      case "error_alert":
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "progress":
        return "progress";
      case "info":
      case "collaboration_invite":
      case "mention":
      case "build_result":
      case "update_available":
      default:
        return "info";
    }
  };

  // Map notification actions to toast actions
  const mapActions = (
    notification: ReturnType<typeof toasts>[number]
  ): ToastAction[] | undefined => {
    if (!notification.actions) return undefined;
    return notification.actions.map((action) => ({
      id: action.id,
      label: action.label,
      variant: action.variant,
      onClick: () => {
        notifications.executeAction(notification.id, action.id);
      },
    }));
  };

  const handleDismiss = (id: string) => {
    notifications.dismissToast(id);
  };

  const handleAction = (notificationId: string, actionId: string) => {
    notifications.executeAction(notificationId, actionId);
    notifications.dismissToast(notificationId);
  };

  return (
    <Show when={toasts().length > 0}>
      <div
        class="notifications-toasts"
        style={{
          position: "fixed",
          bottom: "30px",
          right: "16px",
          "z-index": tokens.zIndex.notifications,
          display: "flex",
          "flex-direction": "column",
          gap: tokens.spacing.md,
          "pointer-events": "none",
          "max-height": "calc(100vh - 60px)",
          "overflow-y": "auto",
          "overflow-x": "hidden",
        }}
      >
        <For each={toasts()}>
          {(notification) => (
            <Toast
              id={notification.id}
              type={mapType(notification.type)}
              title={notification.title}
              message={notification.message}
              duration={notification.duration}
              progress={notification.progress}
              actions={mapActions(notification)}
              onDismiss={handleDismiss}
              onAction={handleAction}
            />
          )}
        </For>
      </div>
    </Show>
  );
}

export default ToastManager;
