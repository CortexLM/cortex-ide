import { JSX, splitProps, Show, createSignal, ParentProps } from "solid-js";

export interface AlertProps extends ParentProps {
  /** Alert variant */
  variant?: "info" | "success" | "warning" | "error";
  /** Alert title */
  title?: string;
  /** Custom icon */
  icon?: JSX.Element;
  /** Whether alert is dismissible */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Alert(props: AlertProps) {
  const [local] = splitProps(props, [
    "variant", "title", "icon", "dismissible", "onDismiss", "style", "children"
  ]);

  const [dismissed, setDismissed] = createSignal(false);
  const [closeHover, setCloseHover] = createSignal(false);

  const variant = () => local.variant || "info";

  const variantConfig: Record<string, { bg: string; border: string; icon: string; color: string }> = {
    info: {
      bg: "var(--state-info-bg)",
      border: "var(--state-info)",
      icon: "var(--state-info)",
      color: "var(--text-primary)",
    },
    success: {
      bg: "var(--state-success-bg)",
      border: "var(--state-success)",
      icon: "var(--state-success)",
      color: "var(--text-primary)",
    },
    warning: {
      bg: "var(--state-warning-bg)",
      border: "var(--state-warning)",
      icon: "var(--state-warning)",
      color: "var(--text-primary)",
    },
    error: {
      bg: "var(--state-error-bg)",
      border: "var(--state-error)",
      icon: "var(--state-error)",
      color: "var(--text-primary)",
    },
  };

  const config = () => variantConfig[variant()];

  const handleDismiss = () => {
    setDismissed(true);
    local.onDismiss?.();
  };

  const defaultIcons: Record<string, JSX.Element> = {
    info: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 7V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="5" r="0.75" fill="currentColor"/>
      </svg>
    ),
    success: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ),
    warning: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M8 6V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    ),
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    gap: "12px",
    padding: "12px 16px",
    background: config().bg,
    "border-left": `3px solid ${config().border}`,
    "border-radius": "var(--radius-sm)",
    "font-family": "var(--jb-font-ui)",
    ...local.style,
  });

  const iconStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    "padding-top": "1px",
    color: config().icon,
    "flex-shrink": "0",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--text-title)",
    "margin-bottom": local.children ? "4px" : "0",
  };

  const bodyStyle: JSX.CSSProperties = {
    "font-size": "13px",
    color: "var(--text-primary)",
    "line-height": "1.5",
  };

  const closeStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "20px",
    height: "20px",
    background: closeHover() ? "var(--surface-hover)" : "transparent",
    border: "none",
    "border-radius": "var(--radius-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
    "flex-shrink": "0",
    transition: "background var(--cortex-transition-fast)",
  });

  return (
    <Show when={!dismissed()}>
      <div style={containerStyle()} role="alert">
        <span style={iconStyle}>
          {local.icon || defaultIcons[variant()]}
        </span>
        <div style={contentStyle}>
          <Show when={local.title}>
            <div style={titleStyle}>{local.title}</div>
          </Show>
          <Show when={local.children}>
            <div style={bodyStyle}>{local.children}</div>
          </Show>
        </div>
        <Show when={local.dismissible}>
          <button
            type="button"
            style={closeStyle()}
            onClick={handleDismiss}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            aria-label="Dismiss alert"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </Show>
      </div>
    </Show>
  );
}
