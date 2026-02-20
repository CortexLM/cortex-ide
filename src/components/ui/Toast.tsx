/**
 * Toast Component - Enhanced notification toasts with VS Code styling
 * 
 * Features:
 * - Position: bottom-right
 * - Auto-dismiss with configurable duration
 * - Progress bar for timed dismiss
 * - Action buttons
 * - Close button
 * - Stack multiple toasts
 * - Support for different notification types (info, warning, error, success, progress)
 */

import {
  Show,
  For,
  createSignal,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { Icon } from './Icon';
import { tokens } from "@/design-system/tokens";

// =============================================================================
// TYPES
// =============================================================================

export type ToastType = "info" | "success" | "warning" | "error" | "progress";

export interface ToastAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
}

export interface ToastProps {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // 0 for persistent
  progress?: number; // 0-100 for progress type
  actions?: ToastAction[];
  onDismiss?: (id: string) => void;
  onAction?: (id: string, actionId: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ANIMATION_DURATION = 200;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 8000,
  warning: 10000,
  error: 15000,
  progress: 0, // Persistent by default
};

// =============================================================================
// TOAST COMPONENT
// =============================================================================

export function Toast(props: ToastProps) {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isExiting, setIsExiting] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  const [dismissProgress, setDismissProgress] = createSignal(100);

  let progressInterval: ReturnType<typeof setInterval> | undefined;
  let dismissTimeout: ReturnType<typeof setTimeout> | undefined;

  const duration = () => props.duration ?? DEFAULT_DURATIONS[props.type];
  const isPersistent = () => duration() <= 0 || props.type === "progress";

  const startProgressTimer = () => {
    if (isPersistent()) return;

    const d = duration();
    const updateInterval = 50;
    const decrementPerTick = (100 / d) * updateInterval;

    progressInterval = setInterval(() => {
      if (!isHovered()) {
        setDismissProgress((prev) => {
          const next = prev - decrementPerTick;
          if (next <= 0) {
            handleDismiss();
            return 0;
          }
          return next;
        });
      }
    }, updateInterval);
  };

  const stopProgressTimer = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = undefined;
    }
  };

  const handleDismiss = () => {
    if (isExiting()) return;
    setIsExiting(true);
    stopProgressTimer();

    dismissTimeout = setTimeout(() => {
      props.onDismiss?.(props.id);
    }, ANIMATION_DURATION);
  };

  const handleAction = (action: ToastAction) => {
    action.onClick?.();
    props.onAction?.(props.id, action.id);
    handleDismiss();
  };

  onMount(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    startProgressTimer();
  });

  onCleanup(() => {
    stopProgressTimer();
    if (dismissTimeout) clearTimeout(dismissTimeout);
  });

  const getIconName = () => {
    switch (props.type) {
      case "success":
        return "check";
      case "error":
        return "circle-exclamation";
      case "warning":
        return "triangle-exclamation";
      case "progress":
        return "spinner";
      case "info":
      default:
        return "circle-info";
    }
  };

  const getIconColor = (): string => {
    switch (props.type) {
      case "success":
        return "var(--state-success)";
      case "error":
        return "var(--state-error)";
      case "warning":
        return "var(--state-warning)";
      case "progress":
      case "info":
      default:
        return "var(--state-info)";
    }
  };

  const getAnimationStyle = (): JSX.CSSProperties => {
    if (isExiting()) {
      return {
        opacity: "0",
        transform: "translateX(16px)",
        transition: `opacity ${ANIMATION_DURATION}ms ease-out, transform ${ANIMATION_DURATION}ms ease-out`,
      };
    }
    if (isVisible()) {
      return {
        opacity: "1",
        transform: "translateX(0)",
        transition: `opacity ${ANIMATION_DURATION}ms ease-out, transform ${ANIMATION_DURATION}ms ease-out`,
      };
    }
    return {
      opacity: "0",
      transform: "translateX(16px)",
    };
  };

  const getActionButtonStyle = (variant?: string): JSX.CSSProperties => {
    const baseStyle: JSX.CSSProperties = {
      padding: "6px 12px",
      "font-size": "12px",
      "font-weight": "500",
      "border-radius": "var(--radius-sm)",
      border: "none",
      cursor: "pointer",
    };

    if (variant === "primary") {
      return { ...baseStyle, background: "var(--state-info)", color: "var(--text-title)" };
    }
    if (variant === "danger") {
      return { ...baseStyle, background: "var(--state-error)", color: "var(--text-title)" };
    }
    return { ...baseStyle, background: "var(--surface-hover)", color: "var(--text-primary)" };
  };

  return (
    <div
      style={{
        position: "relative",
        "pointer-events": "auto",
        ...getAnimationStyle(),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="alert"
      aria-live="polite"
    >
      <div
        style={{
          position: "relative",
          width: "350px",
          "max-width": "calc(100vw - 32px)",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border-default)",
          "border-radius": "var(--radius-md)",
          "box-shadow": "var(--shadow-popup)",
          overflow: "hidden",
        }}
      >
        {/* Close button */}
        <button
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "20px",
            height: "20px",
            padding: "0",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            "border-radius": "var(--radius-sm)",
            opacity: isHovered() ? "1" : "0",
            transition: "opacity 100ms ease, background 100ms ease",
          }}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="xmark" size={14} />
        </button>

        {/* Content */}
        <div
          style={{
            display: "flex",
            gap: tokens.spacing.md,
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            "padding-right": "32px", // Space for close button
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
            <Icon
              name={getIconName()}
              size={18}
              class={props.type === "progress" ? "animate-spin" : ""}
            />
          </div>

          {/* Text Content */}
          <div style={{ flex: 1, "min-width": 0 }}>
            <Show when={props.title}>
              <div
                style={{
                  "font-size": "13px",
                  "font-weight": "600",
                  color: "var(--text-title)",
                  "margin-bottom": tokens.spacing.xs,
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                }}
              >
                {props.title}
              </div>
            </Show>
            <div
              style={{
                "font-size": "13px",
                "line-height": "1.5",
                color: "var(--text-primary)",
              }}
            >
              {props.message}
            </div>

            {/* Progress indicator for progress type */}
            <Show when={props.type === "progress" && props.progress !== undefined}>
              <div
                style={{
                  "margin-top": tokens.spacing.md,
                  height: "4px",
                  background: "var(--surface-hover)",
                  "border-radius": "var(--cortex-radius-sm)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${props.progress}%`,
                    background: "var(--state-info)",
                    "border-radius": "var(--cortex-radius-sm)",
                    transition: "width 150ms ease",
                  }}
                />
              </div>
              <div
                style={{
                  "margin-top": tokens.spacing.xs,
                  "font-size": "11px",
                  color: tokens.colors.text.muted,
                }}
              >
                {Math.round(props.progress || 0)}% complete
              </div>
            </Show>

            {/* Actions */}
            <Show when={props.actions && props.actions.length > 0}>
              <div
                style={{
                  display: "flex",
                  gap: tokens.spacing.sm,
                  "margin-top": tokens.spacing.md,
                }}
              >
                <For each={props.actions}>
                  {(action) => (
                    <button
                      style={getActionButtonStyle(action.variant)}
                      onClick={() => handleAction(action)}
                      onMouseEnter={(e) => {
                        if (action.variant === "primary") {
                          e.currentTarget.style.background = "var(--surface-active)";
                        } else if (action.variant === "danger") {
                          e.currentTarget.style.background = "var(--state-error)";
                        } else {
                          e.currentTarget.style.background = "var(--surface-active)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (action.variant === "primary") {
                          e.currentTarget.style.background = "var(--state-info)";
                        } else if (action.variant === "danger") {
                          e.currentTarget.style.background = "var(--state-error)";
                        } else {
                          e.currentTarget.style.background = "var(--surface-hover)";
                        }
                      }}
                    >
                      {action.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Dismiss Progress Bar */}
        <Show when={!isPersistent()}>
          <div
            style={{
              position: "absolute",
              bottom: "0",
              left: "0",
              right: "0",
              height: "2px",
              background: "var(--surface-hover)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${dismissProgress()}%`,
                background: "var(--state-info)",
                transition: isHovered() ? "none" : "width 50ms linear",
              }}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// TOAST CONTAINER
// =============================================================================

export interface ToastContainerProps {
  toasts: ToastProps[];
  onDismiss: (id: string) => void;
  onAction?: (id: string, actionId: string) => void;
}

export function ToastContainer(props: ToastContainerProps) {
  return (
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
      <For each={props.toasts}>
        {(toast) => (
          <Toast
            {...toast}
            onDismiss={props.onDismiss}
            onAction={props.onAction}
          />
        )}
      </For>
    </div>
  );
}

export default Toast;

