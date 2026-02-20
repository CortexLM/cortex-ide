import { JSX, splitProps, ParentProps, Show } from "solid-js";

export interface ListItemProps extends ParentProps {
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  label?: string;
  description?: string;
  badge?: string | number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: JSX.CSSProperties;
}

export function ListItem(props: ListItemProps) {
  const [local] = splitProps(props, [
    "icon",
    "iconRight",
    "label",
    "description",
    "badge",
    "selected",
    "disabled",
    "onClick",
    "style",
    "children",
  ]);

  const baseStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    "border-radius": "var(--cortex-radius-md)",
    background: local.selected ? "var(--surface-active)" : "transparent",
    color: local.selected ? "var(--text-title)" : "var(--text-primary)",
    cursor: local.disabled ? "not-allowed" : local.onClick ? "pointer" : "default",
    opacity: local.disabled ? "0.5" : "1",
    transition: "background 100ms ease",
    "user-select": "none",
    "font-size": "13px",
  };

  const computedStyle = (): JSX.CSSProperties => ({
    ...baseStyle,
    ...local.style,
  });

  const iconStyle: JSX.CSSProperties = {
    color: local.selected ? "var(--text-title)" : "var(--text-muted)",
    "flex-shrink": "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
    display: "flex",
    "flex-direction": "column",
    "justify-content": "center",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-body-size)",
    "font-weight": "var(--jb-text-body-weight)",
    color: "inherit",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--text-placeholder)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const badgeStyle: JSX.CSSProperties = {
    "font-size": "10px",
    padding: "1px 6px",
    "border-radius": "var(--jb-radius-sm)",
    background: "var(--jb-surface-active)",
    color: "var(--jb-text-muted-color)",
    "flex-shrink": "0",
  };

  const handleMouseEnter = (e: MouseEvent) => {
    if (!local.disabled && !local.selected) {
      (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)";
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    if (!local.disabled && !local.selected) {
      (e.currentTarget as HTMLElement).style.background = "transparent";
    }
  };

  return (
    <div
      style={computedStyle()}
      onClick={local.disabled ? undefined : local.onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Show when={local.icon}>
        <span style={iconStyle}>{local.icon}</span>
      </Show>
      
      <Show when={local.label || local.description || local.children} fallback={local.children}>
        <div style={contentStyle}>
          <Show when={local.label}>
            <span style={labelStyle}>{local.label}</span>
          </Show>
          <Show when={local.description}>
            <span style={descriptionStyle}>{local.description}</span>
          </Show>
          {local.children}
        </div>
      </Show>
      
      <Show when={local.badge !== undefined}>
        <span style={badgeStyle}>{local.badge}</span>
      </Show>
      
      <Show when={local.iconRight}>
        <span style={iconStyle}>{local.iconRight}</span>
      </Show>
    </div>
  );
}

export interface ListGroupProps extends ParentProps {
  title?: string;
  style?: JSX.CSSProperties;
}

export function ListGroup(props: ListGroupProps) {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    ...props.style,
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-header-size)",
    "font-weight": "var(--jb-text-header-weight)",
    "text-transform": "uppercase",
    "letter-spacing": "var(--jb-text-header-spacing)",
    color: "var(--jb-text-header-color)",
    padding: "8px 12px 4px",
  };

  return (
    <div style={containerStyle}>
      <Show when={props.title}>
        <span style={titleStyle}>{props.title}</span>
      </Show>
      {props.children}
    </div>
  );
}

