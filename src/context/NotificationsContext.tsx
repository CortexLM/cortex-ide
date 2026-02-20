/**
 * =============================================================================
 * NOTIFICATIONS CONTEXT - Comprehensive Notification System
 * =============================================================================
 * 
 * This module provides a VS Code-style notification system with:
 * - Toast notifications with auto-dismiss
 * - Notification center panel with history
 * - Progress notifications for long-running operations
 * - Do Not Disturb mode
 * - Desktop notification support
 * - Persistent notification history
 * 
 * @example Basic usage
 * ```tsx
 * const notifications = useNotifications();
 * 
 * // Simple notifications
 * notifications.notify({ message: "File saved", type: "success" });
 * notifications.notify({ message: "Build failed", type: "error" });
 * 
 * // With actions
 * notifications.notify({
 *   type: "warning",
 *   title: "Unsaved changes",
 *   message: "You have unsaved changes",
 *   actions: [
 *     { id: "save", label: "Save", variant: "primary" },
 *     { id: "discard", label: "Discard", variant: "danger" }
 *   ]
 * });
 * 
 * // Progress notifications
 * const progress = notifications.showProgress("Building...");
 * progress.update(50, "Compiling...");
 * progress.complete("Build complete!");
 * ```
 * =============================================================================
 */

import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  onMount,
  onCleanup,
  createMemo,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * Notification types for the Cortex Desktop IDE
 */
export type NotificationType =
  | "collaboration_invite"
  | "mention"
  | "build_result"
  | "error_alert"
  | "update_available"
  | "info"
  | "success"
  | "warning"
  | "progress";

/**
 * Notification priority levels
 */
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/**
 * Represents an action that can be taken on a notification
 */
export interface NotificationAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}

/**
 * A notification entry in the store
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  priority: NotificationPriority;
  source?: string;
  metadata?: Record<string, unknown>;
  actions?: NotificationAction[];
  expiresAt?: number;
  /** Progress percentage (0-100) for progress notifications */
  progress?: number;
  /** Whether this is a toast notification (auto-dismiss) */
  isToast?: boolean;
  /** Custom auto-dismiss duration in ms (0 = persistent) */
  duration?: number;
}

/**
 * Options for the notify() convenience method
 */
export interface NotifyOptions {
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  source?: string;
  actions?: NotificationAction[];
  /** Show as toast (default: true) */
  toast?: boolean;
  /** Auto-dismiss duration in ms (0 = persistent) */
  duration?: number;
  /** Also add to notification history (default: true) */
  persist?: boolean;
}

/**
 * Progress notification handle for updating/completing long operations
 */
export interface ProgressHandle {
  id: string;
  /** Update progress (0-100) */
  update: (progress: number, message?: string) => void;
  /** Complete with success */
  complete: (message?: string) => void;
  /** Complete with error */
  fail: (error: string) => void;
  /** Cancel/dismiss the progress notification */
  cancel: () => void;
}

/**
 * Filter options for notifications
 */
export type NotificationFilter = "all" | NotificationType;

/**
 * Notification store state
 */
interface NotificationsStore {
  notifications: Notification[];
  filter: NotificationFilter;
  isOpen: boolean;
  settings: NotificationSettings;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  enabled: boolean;
  desktopNotifications: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
  typeSettings: Record<NotificationType, { enabled: boolean; desktop: boolean }>;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  desktopNotifications: true,
  soundEnabled: true,
  doNotDisturb: false,
  typeSettings: {
    collaboration_invite: { enabled: true, desktop: true },
    mention: { enabled: true, desktop: true },
    build_result: { enabled: true, desktop: true },
    error_alert: { enabled: true, desktop: true },
    update_available: { enabled: true, desktop: true },
    info: { enabled: true, desktop: false },
    success: { enabled: true, desktop: false },
    warning: { enabled: true, desktop: true },
    progress: { enabled: true, desktop: false },
  },
};

interface NotificationsContextValue {
  /** Reactive store of notifications */
  notifications: Notification[];
  /** Active toasts for display */
  toasts: Accessor<Notification[]>;
  /** Current filter applied */
  filter: Accessor<NotificationFilter>;
  /** Whether the notifications panel is open */
  isOpen: Accessor<boolean>;
  /** Total unread count */
  unreadCount: Accessor<number>;
  /** Filtered notifications based on current filter */
  filteredNotifications: Accessor<Notification[]>;
  /** Notification settings */
  settings: NotificationSettings;

  /** Add a new notification */
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "isRead">
  ) => Promise<string>;
  /** Mark a notification as read */
  markAsRead: (id: string) => void;
  /** Mark a notification as unread */
  markAsUnread: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Remove a notification */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** Clear read notifications */
  clearRead: () => void;
  /** Set the filter */
  setFilter: (filter: NotificationFilter) => void;
  /** Toggle the notifications panel */
  togglePanel: () => void;
  /** Open the notifications panel */
  openPanel: () => void;
  /** Close the notifications panel */
  closePanel: () => void;
  /** Execute a notification action */
  executeAction: (notificationId: string, actionId: string) => void;
  /** Update notification settings */
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  /** Show a desktop notification */
  showDesktopNotification: (title: string, body: string) => Promise<void>;
  /** Set Do Not Disturb mode */
  setDoNotDisturb: (enabled: boolean) => void;

  // =========================================================================
  // ENHANCED NOTIFICATION API
  // =========================================================================

  /**
   * Simplified notify method for common notifications
   * @example
   * notify({ message: "File saved", type: "success" })
   * notify({ message: "Error occurred", type: "error", actions: [...] })
   */
  notify: (options: NotifyOptions) => string;

  /**
   * Show a progress notification for long-running operations
   * @example
   * const progress = showProgress("Indexing files...");
   * progress.update(50, "Half way there");
   * progress.complete("Indexing complete");
   */
  showProgress: (title: string, initialMessage?: string) => ProgressHandle;

  /**
   * Dismiss a toast notification
   */
  dismissToast: (id: string) => void;

  /**
   * Dismiss all toasts
   */
  dismissAllToasts: () => void;

  /** Convenience methods for creating specific notification types */
  notifyCollaborationInvite: (
    from: string,
    room: string,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
  notifyMention: (
    from: string,
    context: string,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
  notifyBuildResult: (
    success: boolean,
    message: string,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
  notifyError: (
    error: string,
    source?: string,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
  notifyUpdateAvailable: (
    version: string,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
}

const NotificationsContext = createContext<NotificationsContextValue>();

const STORAGE_KEY = "cortex-notifications";
const SETTINGS_STORAGE_KEY = "cortex-notification-settings";
const MAX_NOTIFICATIONS = 100;

function loadNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const notifications: Notification[] = JSON.parse(stored);
      const now = Date.now();
      return notifications.filter((n) => !n.expiresAt || n.expiresAt > now);
    }
  } catch (err) {
    console.debug("[Notifications] Parse failed:", err);
  }
  return [];
}

function saveNotifications(notifications: Notification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch (err) {
    console.debug("[Notifications] Save failed:", err);
  }
}

function loadSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.debug("[Notifications] Parse settings failed:", err);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.debug("[Notifications] Save settings failed:", err);
  }
}

// Maximum number of visible toasts at once
const MAX_TOASTS = 5;

export function NotificationsProvider(props: ParentProps) {
  const [store, setStore] = createStore<NotificationsStore>({
    notifications: loadNotifications(),
    filter: "all",
    isOpen: false,
    settings: loadSettings(),
  });

  const [filter, setFilterSignal] = createSignal<NotificationFilter>("all");
  const [isOpen, setIsOpenSignal] = createSignal(false);
  const [activeToasts, setActiveToasts] = createSignal<Notification[]>([]);

  let unlistenFn: UnlistenFn | undefined;
  let cleanupInterval: ReturnType<typeof setInterval> | undefined;

  // Register cleanup synchronously
  onCleanup(() => {
    unlistenFn?.();
    if (cleanupInterval) clearInterval(cleanupInterval);
  });

  onMount(async () => {
    // Listen for notification events from Tauri backend
    try {
      unlistenFn = await listen<{
        type: string;
        title: string;
        message: string;
        metadata?: Record<string, unknown>;
      }>("notification:new", (event) => {
        const { type, title, message, metadata } = event.payload;
        addNotification({
          type: type as NotificationType,
          title,
          message,
          priority: "normal",
          metadata,
        });
      });
    } catch (err) {
      console.debug("[Notifications] Tauri event listener failed:", err);
    }

    // Set up expiration cleanup interval
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      setStore(
        produce((s) => {
          s.notifications = s.notifications.filter(
            (n) => !n.expiresAt || n.expiresAt > now
          );
        })
      );
    }, 60000); // Check every minute
  });

  const unreadCount = createMemo(() =>
    store.notifications.filter((n) => !n.isRead).length
  );

  const filteredNotifications = createMemo(() => {
    const f = filter();
    if (f === "all") {
      return store.notifications.slice().sort((a, b) => b.timestamp - a.timestamp);
    }
    return store.notifications
      .filter((n) => n.type === f)
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  const addNotification = async (
    notification: Omit<Notification, "id" | "timestamp" | "isRead">
  ): Promise<string> => {
    const id = crypto.randomUUID();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      isRead: false,
    };

    setStore(
      produce((s) => {
        s.notifications.unshift(newNotification);
        // Limit stored notifications
        if (s.notifications.length > MAX_NOTIFICATIONS) {
          s.notifications = s.notifications.slice(0, MAX_NOTIFICATIONS);
        }
      })
    );

    saveNotifications(store.notifications);

    // Show desktop notification if enabled
    const typeSettings = store.settings.typeSettings[notification.type];
    if (
      store.settings.enabled &&
      store.settings.desktopNotifications &&
      !store.settings.doNotDisturb &&
      typeSettings?.enabled &&
      typeSettings?.desktop
    ) {
      await showDesktopNotification(notification.title, notification.message);
    }

    return id;
  };

  const markAsRead = (id: string) => {
    setStore(
      produce((s) => {
        const notification = s.notifications.find((n) => n.id === id);
        if (notification) {
          notification.isRead = true;
        }
      })
    );
    saveNotifications(store.notifications);
  };

  const markAsUnread = (id: string) => {
    setStore(
      produce((s) => {
        const notification = s.notifications.find((n) => n.id === id);
        if (notification) {
          notification.isRead = false;
        }
      })
    );
    saveNotifications(store.notifications);
  };

  const markAllAsRead = () => {
    setStore(
      produce((s) => {
        s.notifications.forEach((n) => {
          n.isRead = true;
        });
      })
    );
    saveNotifications(store.notifications);
  };

  const removeNotification = (id: string) => {
    setStore(
      produce((s) => {
        s.notifications = s.notifications.filter((n) => n.id !== id);
      })
    );
    saveNotifications(store.notifications);
  };

  const clearAll = () => {
    setStore(
      produce((s) => {
        s.notifications = [];
      })
    );
    saveNotifications([]);
  };

  const clearRead = () => {
    setStore(
      produce((s) => {
        s.notifications = s.notifications.filter((n) => !n.isRead);
      })
    );
    saveNotifications(store.notifications);
  };

  const setFilter = (f: NotificationFilter) => {
    setFilterSignal(f);
    setStore("filter", f);
  };

  const togglePanel = () => {
    setIsOpenSignal((prev) => !prev);
    setStore("isOpen", !store.isOpen);
  };

  const openPanel = () => {
    setIsOpenSignal(true);
    setStore("isOpen", true);
  };

  const closePanel = () => {
    setIsOpenSignal(false);
    setStore("isOpen", false);
  };

  const executeAction = (notificationId: string, actionId: string) => {
    const notification = store.notifications.find((n) => n.id === notificationId);
    if (!notification) return;

    // Emit custom event for action handling
    window.dispatchEvent(
      new CustomEvent("notification:action", {
        detail: { notificationId, actionId, notification },
      })
    );

    // Mark as read after action
    markAsRead(notificationId);
  };

  const updateSettings = (settings: Partial<NotificationSettings>) => {
    setStore(
      produce((s) => {
        Object.assign(s.settings, settings);
      })
    );
    saveSettings(store.settings);
  };

  const showDesktopNotification = async (
    title: string,
    body: string
  ): Promise<void> => {
    try {
      await invoke("show_notification", { title, body });
    } catch (err) {
      console.debug("[Notifications] Native notification failed:", err);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      } else if ("Notification" in window && Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body });
        }
      }
    }
  };

  // Convenience methods for specific notification types
  const notifyCollaborationInvite = async (
    from: string,
    room: string,
    metadata?: Record<string, unknown>
  ): Promise<string> => {
    return addNotification({
      type: "collaboration_invite",
      title: "Collaboration Invite",
      message: `${from} invited you to join "${room}"`,
      priority: "high",
      source: from,
      metadata: { ...metadata, from, room },
      actions: [
        { id: "accept", label: "Accept", variant: "primary" },
        { id: "decline", label: "Decline", variant: "secondary" },
      ],
    });
  };

  const notifyMention = async (
    from: string,
    context: string,
    metadata?: Record<string, unknown>
  ): Promise<string> => {
    return addNotification({
      type: "mention",
      title: "You were mentioned",
      message: `${from} mentioned you: "${context}"`,
      priority: "normal",
      source: from,
      metadata: { ...metadata, from, context },
      actions: [{ id: "view", label: "View", variant: "primary" }],
    });
  };

  const notifyBuildResult = async (
    success: boolean,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<string> => {
    return addNotification({
      type: "build_result",
      title: success ? "Build Succeeded" : "Build Failed",
      message,
      priority: success ? "normal" : "high",
      metadata: { ...metadata, success },
      actions: success
        ? []
        : [{ id: "view_errors", label: "View Errors", variant: "primary" }],
    });
  };

  const notifyError = async (
    error: string,
    source?: string,
    metadata?: Record<string, unknown>
  ): Promise<string> => {
    return addNotification({
      type: "error_alert",
      title: "Error",
      message: error,
      priority: "urgent",
      source,
      metadata,
      actions: [{ id: "view_details", label: "View Details", variant: "primary" }],
    });
  };

  const notifyUpdateAvailable = async (
    version: string,
    metadata?: Record<string, unknown>
  ): Promise<string> => {
    return addNotification({
      type: "update_available",
      title: "Update Available",
      message: `Version ${version} is available. Restart to update.`,
      priority: "normal",
      metadata: { ...metadata, version },
      actions: [
        { id: "restart", label: "Restart Now", variant: "primary" },
        { id: "later", label: "Later", variant: "secondary" },
      ],
    });
  };

  // =========================================================================
  // ENHANCED NOTIFICATION API IMPLEMENTATION
  // =========================================================================

  /**
   * Set Do Not Disturb mode
   */
  const setDoNotDisturb = (enabled: boolean) => {
    updateSettings({ doNotDisturb: enabled });
  };

  /**
   * Add a toast notification to the active toasts list
   */
  const addToast = (notification: Notification) => {
    if (store.settings.doNotDisturb) return;

    setActiveToasts((prev) => {
      const newToasts = [...prev, notification];
      // Limit visible toasts
      if (newToasts.length > MAX_TOASTS) {
        return newToasts.slice(-MAX_TOASTS);
      }
      return newToasts;
    });
  };

  /**
   * Dismiss a toast notification
   */
  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * Dismiss all toasts
   */
  const dismissAllToasts = () => {
    setActiveToasts([]);
  };

  /**
   * Simplified notify method for common notifications
   */
  const notify = (options: NotifyOptions): string => {
    const id = crypto.randomUUID();
    const notifyType = options.type || "info";
    const showToast = options.toast !== false;
    const persist = options.persist !== false;

    const notification: Notification = {
      id,
      type: notifyType as NotificationType,
      title: options.title || getDefaultTitle(notifyType),
      message: options.message,
      timestamp: Date.now(),
      isRead: false,
      priority: notifyType === "error" ? "high" : "normal",
      source: options.source,
      actions: options.actions,
      isToast: showToast,
      duration: options.duration,
    };

    // Add to notification history if persist is true
    if (persist) {
      setStore(
        produce((s) => {
          s.notifications.unshift(notification);
          if (s.notifications.length > MAX_NOTIFICATIONS) {
            s.notifications = s.notifications.slice(0, MAX_NOTIFICATIONS);
          }
        })
      );
      saveNotifications(store.notifications);
    }

    // Show as toast if enabled
    if (showToast && store.settings.enabled && !store.settings.doNotDisturb) {
      addToast(notification);
    }

    return id;
  };

  /**
   * Show a progress notification for long-running operations
   */
  const showProgress = (title: string, initialMessage?: string): ProgressHandle => {
    const id = crypto.randomUUID();

    const notification: Notification = {
      id,
      type: "progress",
      title,
      message: initialMessage || "Processing...",
      timestamp: Date.now(),
      isRead: false,
      priority: "normal",
      progress: 0,
      isToast: true,
      duration: 0, // Persistent until completed
    };

    // Add to store
    setStore(
      produce((s) => {
        s.notifications.unshift(notification);
        if (s.notifications.length > MAX_NOTIFICATIONS) {
          s.notifications = s.notifications.slice(0, MAX_NOTIFICATIONS);
        }
      })
    );

    // Show as toast
    if (store.settings.enabled && !store.settings.doNotDisturb) {
      addToast(notification);
    }

    const handle: ProgressHandle = {
      id,
      update: (progress: number, message?: string) => {
        setStore(
          produce((s) => {
            const n = s.notifications.find((n) => n.id === id);
            if (n) {
              n.progress = Math.min(100, Math.max(0, progress));
              if (message) n.message = message;
            }
          })
        );
        // Update toast
        setActiveToasts((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, progress: Math.min(100, Math.max(0, progress)), message: message || t.message }
              : t
          )
        );
      },
      complete: (message?: string) => {
        // Remove progress notification from store
        removeNotification(id);
        dismissToast(id);

        // Show success notification
        if (message) {
          notify({
            type: "success",
            title,
            message,
            duration: 5000,
          });
        }
      },
      fail: (error: string) => {
        // Remove progress notification from store
        removeNotification(id);
        dismissToast(id);

        // Show error notification
        notify({
          type: "error",
          title: `${title} Failed`,
          message: error,
          duration: 10000,
        });
      },
      cancel: () => {
        removeNotification(id);
        dismissToast(id);
      },
    };

    return handle;
  };

  /**
   * Get default title based on notification type
   */
  const getDefaultTitle = (type: string): string => {
    switch (type) {
      case "success":
        return "Success";
      case "error":
        return "Error";
      case "warning":
        return "Warning";
      case "info":
      default:
        return "Info";
    }
  };

  const value: NotificationsContextValue = {
    notifications: store.notifications,
    toasts: activeToasts,
    filter,
    isOpen,
    unreadCount,
    filteredNotifications,
    settings: store.settings,
    addNotification,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    removeNotification,
    clearAll,
    clearRead,
    setFilter,
    togglePanel,
    openPanel,
    closePanel,
    executeAction,
    updateSettings,
    showDesktopNotification,
    setDoNotDisturb,
    notify,
    showProgress,
    dismissToast,
    dismissAllToasts,
    notifyCollaborationInvite,
    notifyMention,
    notifyBuildResult,
    notifyError,
    notifyUpdateAvailable,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {props.children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
