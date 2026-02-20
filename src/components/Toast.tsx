import { Show, createSignal, onMount, onCleanup, JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import type { ToastVariant, ToastAction } from "@/context/ToastContext";

export interface ToastProps {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
  onDismiss: (id: string) => void;
  onAction?: (id: string, actionId: string) => void;
}

// VS Code spec: 200ms ease-out animation
const ANIMATION_DURATION = 200;

export function Toast(props: ToastProps) {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isExiting, setIsExiting] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  const [progress, setProgress] = createSignal(100);

  let progressInterval: ReturnType<typeof setInterval> | undefined;
  let dismissTimeout: ReturnType<typeof setTimeout> | undefined;

  const startProgressTimer = () => {
    if (props.duration <= 0) return;

    const updateInterval = 50;
    const decrementPerTick = (100 / props.duration) * updateInterval;

    progressInterval = setInterval(() => {
      if (!isHovered()) {
        setProgress((prev) => {
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
      props.onDismiss(props.id);
    }, ANIMATION_DURATION);
  };

  const handleAction = () => {
    if (props.action && props.onAction) {
      props.onAction(props.id, props.action.id);
    }
    handleDismiss();
  };

  onMount(() => {
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
    switch (props.variant) {
      case "success":
        return "check";
      case "error":
        return "circle-exclamation";
      case "warning":
        return "triangle-exclamation";
      case "info":
        return "circle-info";
    }
  };

  const iconName = getIconName();

  // Get animation style
  const getAnimationStyle = (): JSX.CSSProperties => {
    if (isExiting()) {
      return { animation: "notification-fade-out 200ms ease-out forwards" };
    }
    if (isVisible()) {
      return { animation: "notification-fade-in 200ms ease-out forwards" };
    }
    return {};
  };

  // Get icon color based on variant
  const getIconColor = () => {
    switch (props.variant) {
      case "error": return "var(--cortex-error)";
      case "warning": return "var(--cortex-warning)";
      case "success": return "var(--cortex-success)";
      case "info": return "var(--jb-border-focus)";
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          "min-width": "350px",
          "max-width": "450px",
          background: "var(--jb-popup)",
          border: "1px solid var(--jb-border-divider)",
          "border-radius": "var(--jb-radius-lg)",
          "box-shadow": "var(--jb-shadow-popup)",
          overflow: "hidden",
          ...getAnimationStyle(),
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="alert"
        aria-live="polite"
      >
        {/* Close button - VS Code spec: absolute position top-right, visible on hover */}
        <button
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            opacity: isHovered() ? 1 : 0,
            padding: "4px",
            "border-radius": "var(--jb-radius-lg)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--jb-text-muted-color)",
            transition: "opacity 0.15s ease",
          }}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
        </button>

        <div style={{
          display: "flex",
          gap: "10px",
          padding: "10px 14px",
        }}>
          {/* Severity Icon - VS Code spec: 22px size */}
          <div style={{
            width: "22px",
            height: "22px",
            "flex-shrink": "0",
            color: getIconColor(),
          }}>
            <Icon name={iconName} style={{ width: "22px", height: "22px" }} />
          </div>

          {/* Message container */}
          <div style={{
            flex: "1",
            "font-size": "13px",
            "line-height": "1.4",
            color: "var(--jb-text-body-color)",
          }}>
            <Show when={props.title}>
              <div style={{
                "font-weight": "600",
                "margin-bottom": "4px",
              }}>
                {props.title}
              </div>
            </Show>
            <span>{props.message}</span>

            {/* Action buttons - VS Code spec */}
            <Show when={props.action}>
              <div style={{
                display: "flex",
                gap: "8px",
                "margin-top": "8px",
              }}>
                <button
                  style={{
                    padding: "2px 8px",
                    "font-size": "12px",
                    "border-radius": "var(--jb-radius-lg)",
                    background: "var(--jb-border-focus)",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={handleAction}
                >
                  {props.action!.label}
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Progress bar - VS Code spec: 2px height, var(--cortex-info) blue */}
        <Show when={props.duration > 0}>
          <div style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "2px",
            background: "var(--jb-surface-sunken)",
            overflow: "hidden",
          }}>
            <div
              style={{
                height: "100%",
                width: `${progress()}%`,
                background: "var(--jb-border-focus)",
                transition: isHovered() ? "none" : "width 50ms linear",
              }}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}

export default Toast;

