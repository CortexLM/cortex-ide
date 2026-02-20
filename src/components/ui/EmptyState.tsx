import { JSX, Show, ParentProps } from "solid-js";

export interface EmptyStateProps extends ParentProps {
  icon?: JSX.Element;
  title?: string;
  description?: string;
  action?: JSX.Element;
  style?: JSX.CSSProperties;
}

export function EmptyState(props: EmptyStateProps) {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "48px 24px",
    "text-align": "center",
    ...props.style,
  };

  const iconContainerStyle: JSX.CSSProperties = {
    width: "64px",
    height: "64px",
    "border-radius": "var(--radius-lg)",
    background: "var(--surface-hover)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "margin-bottom": "16px",
    color: "var(--text-muted)",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "16px",
    "font-weight": "600",
    color: "var(--text-title)",
    "margin-bottom": "8px",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "13px",
    color: "var(--text-muted)",
    "max-width": "300px",
    "line-height": "1.5",
  };

  const actionStyle: JSX.CSSProperties = {
    "margin-top": "20px",
  };

  return (
    <div style={containerStyle}>
      <Show when={props.icon}>
        <div style={iconContainerStyle}>{props.icon}</div>
      </Show>
      <Show when={props.title}>
        <div style={titleStyle}>{props.title}</div>
      </Show>
      <Show when={props.description}>
        <div style={descriptionStyle}>{props.description}</div>
      </Show>
      <Show when={props.action}>
        <div style={actionStyle}>{props.action}</div>
      </Show>
      {props.children}
    </div>
  );
}
