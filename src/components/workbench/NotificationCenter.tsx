/**
 * =============================================================================
 * NOTIFICATION CENTER - Complete Notification Management UI
 * =============================================================================
 * 
 * A comprehensive notification center component providing:
 * - Toast notifications (bottom-right corner)
 * - Notification center panel with history
 * - Progress indicators (indeterminate and percentage)
 * - Primary/secondary actions
 * - Individual dismiss and "Clear All"
 * - Do Not Disturb mode
 * - Notification filtering and history
 * 
 * @module NotificationCenter
 */

import {
  Component,
  For,
  Show,
  createSignal,
  createEffect,
  onCleanup,
  createMemo,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  useNotifications,
  Notification,
  NotificationType,
  NotificationFilter,
} from "../../context/NotificationsContext";

// =============================================================================
// Types
// =============================================================================

interface NotificationCenterProps {
  /** Custom class name for the notification center */
  class?: string;
  /** Position of the toast container */
  toastPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Maximum number of visible toasts */
  maxToasts?: number;
  /** Default toast duration in ms (0 = persistent) */
  defaultToastDuration?: number;
}

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction: (notificationId: string, actionId: string) => void;
}

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction: (notificationId: string, actionId: string) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const TOAST_DURATION_DEFAULT = 5000;
const TOAST_DURATION_ERROR = 10000;
const TOAST_DURATION_PROGRESS = 0; // Persistent

const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, {
  icon: string;
  colorClass: string;
  label: string;
}> = {
  info: { icon: "info", colorClass: "notification--info", label: "Info" },
  success: { icon: "check", colorClass: "notification--success", label: "Success" },
  warning: { icon: "warning", colorClass: "notification--warning", label: "Warning" },
  error_alert: { icon: "error", colorClass: "notification--error", label: "Error" },
  progress: { icon: "loading", colorClass: "notification--progress", label: "Progress" },
  collaboration_invite: { icon: "account", colorClass: "notification--info", label: "Collaboration" },
  mention: { icon: "mention", colorClass: "notification--info", label: "Mention" },
  build_result: { icon: "tools", colorClass: "notification--info", label: "Build" },
  update_available: { icon: "cloud-download", colorClass: "notification--info", label: "Update" },
};

const FILTER_OPTIONS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warnings" },
  { value: "error_alert", label: "Errors" },
  { value: "progress", label: "Progress" },
  { value: "collaboration_invite", label: "Collaboration" },
  { value: "mention", label: "Mentions" },
  { value: "build_result", label: "Build Results" },
  { value: "update_available", label: "Updates" },
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format timestamp to relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get toast duration based on notification type
 */
function getToastDuration(notification: Notification): number {
  if (notification.duration !== undefined) return notification.duration;
  if (notification.type === "progress") return TOAST_DURATION_PROGRESS;
  if (notification.type === "error_alert") return TOAST_DURATION_ERROR;
  return TOAST_DURATION_DEFAULT;
}

// =============================================================================
// Toast Component
// =============================================================================

const Toast: Component<ToastProps> = (props) => {
  const [isExiting, setIsExiting] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  
  const config = () => NOTIFICATION_TYPE_CONFIG[props.notification.type] || NOTIFICATION_TYPE_CONFIG.info;
  
  // Entry animation
  createEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  });
  
  // Auto-dismiss timer
  createEffect(() => {
    const duration = getToastDuration(props.notification);
    if (duration <= 0) return;
    
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);
    
    onCleanup(() => clearTimeout(timer));
  });
  
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      props.onDismiss(props.notification.id);
    }, 200); // Match animation duration
  };
  
  const handleAction = (actionId: string) => {
    props.onAction(props.notification.id, actionId);
    handleDismiss();
  };
  
  return (
    <div
      class={`notification-toast ${config().colorClass} ${isVisible() ? "notification-toast--visible" : ""} ${isExiting() ? "notification-toast--exiting" : ""}`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div class="notification-toast__icon">
        <Show
          when={props.notification.type !== "progress"}
          fallback={<div class="notification-toast__spinner" />}
        >
          <span class={`codicon codicon-${config().icon}`} />
        </Show>
      </div>
      
      {/* Content */}
      <div class="notification-toast__content">
        <div class="notification-toast__header">
          <span class="notification-toast__title">{props.notification.title}</span>
          <Show when={props.notification.source}>
            <span class="notification-toast__source">{props.notification.source}</span>
          </Show>
        </div>
        <p class="notification-toast__message">{props.notification.message}</p>
        
        {/* Progress bar */}
        <Show when={props.notification.type === "progress"}>
          <div class="notification-toast__progress">
            <Show
              when={props.notification.progress !== undefined && props.notification.progress >= 0}
              fallback={<div class="notification-toast__progress-bar notification-toast__progress-bar--indeterminate" />}
            >
              <div 
                class="notification-toast__progress-bar"
                style={{ width: `${props.notification.progress}%` }}
              />
              <span class="notification-toast__progress-text">{props.notification.progress}%</span>
            </Show>
          </div>
        </Show>
        
        {/* Actions */}
        <Show when={props.notification.actions && props.notification.actions.length > 0}>
          <div class="notification-toast__actions">
            <For each={props.notification.actions}>
              {(action) => (
                <button
                  class={`notification-toast__action notification-toast__action--${action.variant || "secondary"}`}
                  onClick={() => handleAction(action.id)}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      
      {/* Dismiss button */}
      <button
        class="notification-toast__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <span class="codicon codicon-close" />
      </button>
    </div>
  );
};

// =============================================================================
// Toast Container Component
// =============================================================================

const ToastContainer: Component<{
  position: NotificationCenterProps["toastPosition"];
}> = (props) => {
  const notifications = useNotifications();
  
  const positionClass = () => {
    switch (props.position) {
      case "bottom-left": return "toast-container--bottom-left";
      case "top-right": return "toast-container--top-right";
      case "top-left": return "toast-container--top-left";
      default: return "toast-container--bottom-right";
    }
  };
  
  return (
    <Portal>
      <div class={`toast-container ${positionClass()}`} aria-live="polite" aria-label="Notifications">
        <For each={notifications.toasts()}>
          {(toast) => (
            <Toast
              notification={toast}
              onDismiss={notifications.dismissToast}
              onAction={notifications.executeAction}
            />
          )}
        </For>
      </div>
    </Portal>
  );
};

// =============================================================================
// Notification Item Component (for history panel)
// =============================================================================

const NotificationItem: Component<NotificationItemProps> = (props) => {
  const config = () => NOTIFICATION_TYPE_CONFIG[props.notification.type] || NOTIFICATION_TYPE_CONFIG.info;
  
  return (
    <div
      class={`notification-item ${config().colorClass} ${props.notification.isRead ? "notification-item--read" : "notification-item--unread"}`}
      role="listitem"
    >
      {/* Unread indicator */}
      <Show when={!props.notification.isRead}>
        <div class="notification-item__unread-dot" />
      </Show>
      
      {/* Icon */}
      <div class="notification-item__icon">
        <Show
          when={props.notification.type !== "progress"}
          fallback={<div class="notification-item__spinner" />}
        >
          <span class={`codicon codicon-${config().icon}`} />
        </Show>
      </div>
      
      {/* Content */}
      <div class="notification-item__content">
        <div class="notification-item__header">
          <span class="notification-item__title">{props.notification.title}</span>
          <span class="notification-item__time">{formatRelativeTime(props.notification.timestamp)}</span>
        </div>
        
        <Show when={props.notification.source}>
          <span class="notification-item__source">{props.notification.source}</span>
        </Show>
        
        <p class="notification-item__message">{props.notification.message}</p>
        
        {/* Progress bar */}
        <Show when={props.notification.type === "progress"}>
          <div class="notification-item__progress">
            <Show
              when={props.notification.progress !== undefined && props.notification.progress >= 0}
              fallback={<div class="notification-item__progress-bar notification-item__progress-bar--indeterminate" />}
            >
              <div 
                class="notification-item__progress-bar"
                style={{ width: `${props.notification.progress}%` }}
              />
              <span class="notification-item__progress-text">{props.notification.progress}%</span>
            </Show>
          </div>
        </Show>
        
        {/* Actions */}
        <Show when={props.notification.actions && props.notification.actions.length > 0}>
          <div class="notification-item__actions">
            <For each={props.notification.actions}>
              {(action) => (
                <button
                  class={`notification-item__action notification-item__action--${action.variant || "secondary"}`}
                  onClick={() => props.onAction(props.notification.id, action.id)}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      
      {/* Item actions */}
      <div class="notification-item__menu">
        <Show
          when={props.notification.isRead}
          fallback={
            <button
              class="notification-item__menu-btn"
              onClick={() => props.onMarkAsRead(props.notification.id)}
              title="Mark as read"
            >
              <span class="codicon codicon-circle-outline" />
            </button>
          }
        >
          <button
            class="notification-item__menu-btn"
            onClick={() => props.onMarkAsUnread(props.notification.id)}
            title="Mark as unread"
          >
            <span class="codicon codicon-circle-filled" />
          </button>
        </Show>
        <button
          class="notification-item__menu-btn notification-item__menu-btn--dismiss"
          onClick={() => props.onDismiss(props.notification.id)}
          title="Dismiss"
        >
          <span class="codicon codicon-close" />
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Notification Panel Component
// =============================================================================

const NotificationPanel: Component = () => {
  const notifications = useNotifications();
  const [showSettings, setShowSettings] = createSignal(false);
  
  const isEmpty = createMemo(() => notifications.filteredNotifications().length === 0);
  
  return (
    <div class="notification-panel" role="dialog" aria-label="Notification Center">
      {/* Header */}
      <div class="notification-panel__header">
        <h2 class="notification-panel__title">
          Notifications
          <Show when={notifications.unreadCount() > 0}>
            <span class="notification-panel__badge">{notifications.unreadCount()}</span>
          </Show>
        </h2>
        
        <div class="notification-panel__header-actions">
          {/* Do Not Disturb toggle */}
          <button
            class={`notification-panel__dnd-btn ${notifications.settings.doNotDisturb ? "notification-panel__dnd-btn--active" : ""}`}
            onClick={() => notifications.setDoNotDisturb(!notifications.settings.doNotDisturb)}
            title={notifications.settings.doNotDisturb ? "Disable Do Not Disturb" : "Enable Do Not Disturb"}
          >
            <span class={`codicon codicon-${notifications.settings.doNotDisturb ? "bell-slash" : "bell"}`} />
          </button>
          
          {/* Settings toggle */}
          <button
            class="notification-panel__settings-btn"
            onClick={() => setShowSettings(!showSettings())}
            title="Notification Settings"
          >
            <span class="codicon codicon-gear" />
          </button>
          
          {/* Close panel */}
          <button
            class="notification-panel__close-btn"
            onClick={notifications.closePanel}
            title="Close"
          >
            <span class="codicon codicon-close" />
          </button>
        </div>
      </div>
      
      {/* Settings panel */}
      <Show when={showSettings()}>
        <NotificationSettings onClose={() => setShowSettings(false)} />
      </Show>
      
      {/* Do Not Disturb banner */}
      <Show when={notifications.settings.doNotDisturb}>
        <div class="notification-panel__dnd-banner">
          <span class="codicon codicon-bell-slash" />
          <span>Do Not Disturb is enabled</span>
          <button onClick={() => notifications.setDoNotDisturb(false)}>Disable</button>
        </div>
      </Show>
      
      {/* Filter and actions bar */}
      <div class="notification-panel__toolbar">
        <select
          class="notification-panel__filter"
          value={notifications.filter()}
          onChange={(e) => notifications.setFilter(e.currentTarget.value as NotificationFilter)}
        >
          <For each={FILTER_OPTIONS}>
            {(option) => (
              <option value={option.value}>{option.label}</option>
            )}
          </For>
        </select>
        
        <div class="notification-panel__toolbar-actions">
          <button
            class="notification-panel__toolbar-btn"
            onClick={notifications.markAllAsRead}
            disabled={notifications.unreadCount() === 0}
            title="Mark all as read"
          >
            <span class="codicon codicon-check-all" />
            <span>Mark all read</span>
          </button>
          
          <button
            class="notification-panel__toolbar-btn notification-panel__toolbar-btn--danger"
            onClick={notifications.clearAll}
            disabled={notifications.notifications.length === 0}
            title="Clear all notifications"
          >
            <span class="codicon codicon-trash" />
            <span>Clear all</span>
          </button>
        </div>
      </div>
      
      {/* Notification list */}
      <div class="notification-panel__list" role="list">
        <Show
          when={!isEmpty()}
          fallback={
            <div class="notification-panel__empty">
              <span class="codicon codicon-bell" />
              <p>No notifications</p>
              <Show when={notifications.filter() !== "all"}>
                <button onClick={() => notifications.setFilter("all")}>
                  Show all notifications
                </button>
              </Show>
            </div>
          }
        >
          <For each={notifications.filteredNotifications()}>
            {(notification) => (
              <NotificationItem
                notification={notification}
                onDismiss={notifications.removeNotification}
                onAction={notifications.executeAction}
                onMarkAsRead={notifications.markAsRead}
                onMarkAsUnread={notifications.markAsUnread}
              />
            )}
          </For>
        </Show>
      </div>
      
      {/* Footer with clear read option */}
      <Show when={notifications.notifications.some(n => n.isRead)}>
        <div class="notification-panel__footer">
          <button
            class="notification-panel__clear-read-btn"
            onClick={notifications.clearRead}
          >
            Clear read notifications
          </button>
        </div>
      </Show>
    </div>
  );
};

// =============================================================================
// Notification Settings Component
// =============================================================================

const NotificationSettings: Component<{ onClose: () => void }> = (props) => {
  const notifications = useNotifications();
  
  return (
    <div class="notification-settings">
      <div class="notification-settings__header">
        <h3>Settings</h3>
        <button class="notification-settings__close" onClick={props.onClose}>
          <span class="codicon codicon-close" />
        </button>
      </div>
      
      <div class="notification-settings__content">
        {/* Global settings */}
        <div class="notification-settings__section">
          <h4>General</h4>
          
          <label class="notification-settings__toggle">
            <input
              type="checkbox"
              checked={notifications.settings.enabled}
              onChange={(e) => notifications.updateSettings({ enabled: e.currentTarget.checked })}
            />
            <span>Enable notifications</span>
          </label>
          
          <label class="notification-settings__toggle">
            <input
              type="checkbox"
              checked={notifications.settings.desktopNotifications}
              onChange={(e) => notifications.updateSettings({ desktopNotifications: e.currentTarget.checked })}
              disabled={!notifications.settings.enabled}
            />
            <span>Desktop notifications</span>
          </label>
          
          <label class="notification-settings__toggle">
            <input
              type="checkbox"
              checked={notifications.settings.soundEnabled}
              onChange={(e) => notifications.updateSettings({ soundEnabled: e.currentTarget.checked })}
              disabled={!notifications.settings.enabled}
            />
            <span>Notification sounds</span>
          </label>
        </div>
        
        {/* Type-specific settings */}
        <div class="notification-settings__section">
          <h4>Notification Types</h4>
          
          <For each={FILTER_OPTIONS.filter(o => o.value !== "all")}>
            {(option) => {
              const typeKey = option.value as NotificationType;
              const typeSetting = () => notifications.settings.typeSettings[typeKey];
              
              return (
                <div class="notification-settings__type">
                  <span class="notification-settings__type-label">{option.label}</span>
                  <label class="notification-settings__mini-toggle">
                    <input
                      type="checkbox"
                      checked={typeSetting()?.enabled ?? true}
                      onChange={(e) => {
                        const newTypeSettings = { ...notifications.settings.typeSettings };
                        newTypeSettings[typeKey] = {
                          ...newTypeSettings[typeKey],
                          enabled: e.currentTarget.checked,
                        };
                        notifications.updateSettings({ typeSettings: newTypeSettings });
                      }}
                    />
                    <span>Show</span>
                  </label>
                  <label class="notification-settings__mini-toggle">
                    <input
                      type="checkbox"
                      checked={typeSetting()?.desktop ?? false}
                      onChange={(e) => {
                        const newTypeSettings = { ...notifications.settings.typeSettings };
                        newTypeSettings[typeKey] = {
                          ...newTypeSettings[typeKey],
                          desktop: e.currentTarget.checked,
                        };
                        notifications.updateSettings({ typeSettings: newTypeSettings });
                      }}
                      disabled={!typeSetting()?.enabled}
                    />
                    <span>Desktop</span>
                  </label>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Status Bar Notification Badge Component
// =============================================================================

export const NotificationBadge: Component<{ class?: string }> = (props) => {
  const notifications = useNotifications();
  
  return (
    <button
      class={`notification-badge ${props.class || ""} ${notifications.settings.doNotDisturb ? "notification-badge--dnd" : ""}`}
      onClick={notifications.togglePanel}
      title={`Notifications${notifications.unreadCount() > 0 ? ` (${notifications.unreadCount()} unread)` : ""}`}
    >
      <span class={`codicon codicon-${notifications.settings.doNotDisturb ? "bell-slash" : "bell"}`} />
      <Show when={notifications.unreadCount() > 0 && !notifications.settings.doNotDisturb}>
        <span class="notification-badge__count">
          {notifications.unreadCount() > 99 ? "99+" : notifications.unreadCount()}
        </span>
      </Show>
    </button>
  );
};

// =============================================================================
// Main NotificationCenter Component
// =============================================================================

/**
 * Complete notification center with toasts and history panel.
 * 
 * @example
 * ```tsx
 * <NotificationsProvider>
 *   <NotificationCenter toastPosition="bottom-right" />
 *   <App />
 * </NotificationsProvider>
 * ```
 */
export const NotificationCenter: Component<NotificationCenterProps> = (props) => {
  const notifications = useNotifications();
  
  // Handle keyboard shortcuts
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close panel
      if (e.key === "Escape" && notifications.isOpen()) {
        notifications.closePanel();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });
  
  return (
    <>
      {/* Toast container */}
      <ToastContainer position={props.toastPosition || "bottom-right"} />
      
      {/* Notification panel (overlay) */}
      <Show when={notifications.isOpen()}>
        <Portal>
          <div class="notification-center-overlay" onClick={notifications.closePanel} />
          <div class={`notification-center ${props.class || ""}`}>
            <NotificationPanel />
          </div>
        </Portal>
      </Show>
    </>
  );
};

// =============================================================================
// Styles (CSS-in-JS or external stylesheet reference)
// =============================================================================

/**
 * CSS styles for the NotificationCenter component.
 * These styles follow VS Code's design patterns and support theming.
 * 
 * Include these styles in your application's stylesheet or use a CSS-in-JS solution.
 * 
 * ```css
 * // Toast Container Positioning
 * .toast-container {
 *   position: fixed;
 *   z-index: 10000;
 *   display: flex;
 *   flex-direction: column;
 *   gap: 8px;
 *   padding: 16px;
 *   pointer-events: none;
 * }
 * 
 * .toast-container--bottom-right {
 *   bottom: 0;
 *   right: 0;
 * }
 * 
 * .toast-container--bottom-left {
 *   bottom: 0;
 *   left: 0;
 * }
 * 
 * .toast-container--top-right {
 *   top: 0;
 *   right: 0;
 * }
 * 
 * .toast-container--top-left {
 *   top: 0;
 *   left: 0;
 * }
 * 
 * // Toast Styles
 * .notification-toast {
 *   pointer-events: auto;
 *   display: flex;
 *   align-items: flex-start;
 *   gap: 12px;
 *   padding: 12px 16px;
 *   background: var(--vscode-notifications-background);
 *   border: 1px solid var(--vscode-notifications-border);
 *   border-radius: var(--cortex-radius-sm);
 *   box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
 *   min-width: 320px;
 *   max-width: 450px;
 *   opacity: 0;
 *   transform: translateX(100%);
 *   transition: opacity 200ms ease, transform 200ms ease;
 * }
 * 
 * .notification-toast--visible {
 *   opacity: 1;
 *   transform: translateX(0);
 * }
 * 
 * .notification-toast--exiting {
 *   opacity: 0;
 *   transform: translateX(100%);
 * }
 * 
 * // ... additional styles
 * ```
 */

// =============================================================================
// Exports
// =============================================================================

export default NotificationCenter;
export { Toast, ToastContainer, NotificationItem, NotificationPanel, NotificationSettings };
export type { NotificationCenterProps, ToastProps, NotificationItemProps };

