/**
 * Notification utility for showing user-facing error and warning messages.
 * Dispatches custom events that can be listened to by UI components.
 */

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface NotificationEvent {
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

/**
 * Shows an error notification to the user and logs to console.
 * @param title - Short title for the notification
 * @param message - Detailed error message
 */
export const showErrorNotification = (title: string, message: string): void => {
  window.dispatchEvent(new CustomEvent<NotificationEvent>('notification:show', {
    detail: { type: 'error', title, message }
  }));
  console.error(`[${title}]`, message);
};

/**
 * Shows a warning notification to the user and logs to console.
 * @param title - Short title for the notification
 * @param message - Detailed warning message
 */
export const showWarningNotification = (title: string, message: string): void => {
  window.dispatchEvent(new CustomEvent<NotificationEvent>('notification:show', {
    detail: { type: 'warning', title, message }
  }));
  console.warn(`[${title}]`, message);
};

/**
 * Shows an info notification to the user and logs to console.
 * @param title - Short title for the notification
 * @param message - Detailed info message
 */
export const showInfoNotification = (title: string, message: string): void => {
  window.dispatchEvent(new CustomEvent<NotificationEvent>('notification:show', {
    detail: { type: 'info', title, message }
  }));
  console.info(`[${title}]`, message);
};

/**
 * Shows a success notification to the user and logs to console.
 * @param title - Short title for the notification
 * @param message - Detailed success message
 */
export const showSuccessNotification = (title: string, message: string): void => {
  window.dispatchEvent(new CustomEvent<NotificationEvent>('notification:show', {
    detail: { type: 'success', title, message }
  }));
  if (import.meta.env.DEV) console.log(`[${title}]`, message);
};
