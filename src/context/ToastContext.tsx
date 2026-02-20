import { createContext, useContext, ParentProps, For } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Toast } from "@/components/Toast";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  id: string;
  label: string;
}

interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
}

interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
}

const ToastContext = createContext<ToastContextValue>();

// VS Code auto-dismiss timeouts (per spec)
const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 10000, // Same as info
  info: 10000,    // 10s
  warning: 12000, // 12s
  error: 15000,   // 15s
};

// VS Code spec: Maximum 3 visible toasts at once
const MAX_TOASTS = 3;

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createStore<ToastItem[]>([]);

  const show = (toast: Omit<ToastItem, "id" | "duration"> & { duration?: number }): string => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? DEFAULT_DURATIONS[toast.variant];
    const newToast: ToastItem = { ...toast, id, duration };

    setToasts(
      produce((t) => {
        t.push(newToast);
        // Limit the number of visible toasts
        if (t.length > MAX_TOASTS) {
          t.splice(0, t.length - MAX_TOASTS);
        }
      })
    );

    return id;
  };

  const dismiss = (id: string) => {
    setToasts(
      produce((t) => {
        const idx = t.findIndex((toast) => toast.id === id);
        if (idx !== -1) t.splice(idx, 1);
      })
    );
  };

  const dismissAll = () => {
    setToasts([]);
  };

  const handleAction = (toastId: string, actionId: string) => {
    // Dispatch a custom event for action handling
    window.dispatchEvent(
      new CustomEvent("toast:action", {
        detail: { toastId, actionId },
      })
    );
  };

  const success = (message: string, options?: ToastOptions): string =>
    show({ message, variant: "success", ...options });

  const error = (message: string, options?: ToastOptions): string =>
    show({ message, variant: "error", ...options });

  const warning = (message: string, options?: ToastOptions): string =>
    show({ message, variant: "warning", ...options });

  const info = (message: string, options?: ToastOptions): string =>
    show({ message, variant: "info", ...options });

  const contextValue: ToastContextValue = {
    show,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {props.children}
      {/* Toast container - VS Code spec: bottom-right, 16px from edge, 30px from bottom */}
      <div
        class="notifications-toasts"
        style={{
          position: "fixed",
          bottom: "30px",      /* Above status bar */
          right: "16px",       /* 16px from right edge */
          "z-index": "1000",   /* VS Code z-index */
          display: "flex",
          "flex-direction": "column",
          gap: "8px",          /* Stack multiple notifications */
          "pointer-events": "none",
        }}
      >
        <For each={toasts}>
          {(toast) => (
            <Toast
              id={toast.id}
              title={toast.title}
              message={toast.message}
              variant={toast.variant}
              duration={toast.duration}
              action={toast.action}
              onDismiss={dismiss}
              onAction={handleAction}
            />
          )}
        </For>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
