/**
 * NotificationHandler - Headless component that bridges app events to notifications
 *
 * Listens for domain events (file:saved, git:push, git:pull, extension:activated)
 * and dispatches user-facing notifications via the NotificationsContext.
 * Renders nothing — mount alongside layout components.
 */

import { onMount, onCleanup } from "solid-js";
import { useNotifications } from "@/context/NotificationsContext";

export function NotificationHandler() {
  const notifications = useNotifications();

  onMount(() => {
    const handleFileSaved = (e: Event) => {
      const detail = (e as CustomEvent<{ path?: string }>).detail;
      const name = detail?.path?.split("/").pop() ?? "File";
      notifications.notify({
        type: "success",
        title: "File Saved",
        message: `${name} saved successfully.`,
        duration: 3000,
      });
    };

    const handleGitPush = () => {
      notifications.notify({
        type: "success",
        title: "Git Push",
        message: "Changes pushed to remote.",
        duration: 4000,
      });
    };

    const handleGitPull = () => {
      notifications.notify({
        type: "info",
        title: "Git Pull",
        message: "Latest changes pulled from remote.",
        duration: 4000,
      });
    };

    const handleExtensionActivated = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string; name?: string }>).detail;
      const name = detail?.name ?? detail?.id ?? "Extension";
      notifications.notify({
        type: "success",
        title: "Extension Activated",
        message: `${name} is now active.`,
        duration: 4000,
      });
    };

    const handleLegacyNotification = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; message?: string; title?: string }>).detail;
      if (!detail?.message) return;
      notifications.notify({
        type: (detail.type as "info" | "success" | "warning" | "error") || "info",
        title: detail.title ?? "Notification",
        message: detail.message,
      });
    };

    window.addEventListener("file:saved", handleFileSaved);
    window.addEventListener("git:push", handleGitPush);
    window.addEventListener("git:pull", handleGitPull);
    window.addEventListener("extension:activated", handleExtensionActivated);
    window.addEventListener("notification", handleLegacyNotification);

    onCleanup(() => {
      window.removeEventListener("file:saved", handleFileSaved);
      window.removeEventListener("git:push", handleGitPush);
      window.removeEventListener("git:pull", handleGitPull);
      window.removeEventListener("extension:activated", handleExtensionActivated);
      window.removeEventListener("notification", handleLegacyNotification);
    });
  });

  return null;
}

export default NotificationHandler;
