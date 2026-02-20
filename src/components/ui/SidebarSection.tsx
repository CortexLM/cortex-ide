import { JSX, splitProps, ParentProps, Show, createSignal } from "solid-js";
import { Icon } from './Icon';

export interface SidebarHeaderProps extends ParentProps {
  title: string;
  actions?: JSX.Element;
  style?: JSX.CSSProperties;
}

export function SidebarHeader(props: SidebarHeaderProps) {
  const style: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "10px 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    ...props.style,
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-header-size)",
    "font-weight": "var(--jb-text-header-weight)",
    "font-family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    "letter-spacing": "normal",
    color: "var(--jb-text-header-color)",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  };

  return (
    <div style={style}>
      <span style={titleStyle}>{props.title}</span>
      <Show when={props.actions}>
        <div style={actionsStyle}>{props.actions}</div>
      </Show>
    </div>
  );
}

export interface SidebarSectionProps extends ParentProps {
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  actions?: JSX.Element;
  style?: JSX.CSSProperties;
}

export function SidebarSection(props: SidebarSectionProps) {
  const [local] = splitProps(props, [
    "title",
    "collapsible",
    "defaultCollapsed",
    "actions",
    "style",
    "children",
  ]);

  const [collapsed, setCollapsed] = createSignal(local.defaultCollapsed || false);

  const sectionStyle: JSX.CSSProperties = {
    ...local.style,
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    padding: "8px 12px",
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--text-muted)",
    cursor: local.collapsible ? "pointer" : "default",
    "user-select": "none",
  };

  const titleStyle: JSX.CSSProperties = {
    flex: "1",
    color: "inherit",
  };

  const chevronStyle: JSX.CSSProperties = {
    width: "12px",
    height: "12px",
    color: "var(--text-placeholder)",
    transition: "transform 150ms ease",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  };

  const handleHeaderClick = () => {
    if (local.collapsible) {
      setCollapsed(!collapsed());
    }
  };

  // Build content class names for CSS-based spacing
  const contentClassName = () => {
    const classes = ["sidebar-section-content"];
    if (!local.title) {
      classes.push("sidebar-section-content--no-title");
    }
    return classes.join(" ");
  };

  const contentStyle = (): JSX.CSSProperties => ({
    display: collapsed() ? "none" : "block",
    padding: "4px 0",
  });

  return (
    <div class="sidebar-section" style={sectionStyle}>
      <Show when={local.title}>
        <div 
          style={headerStyle}
          onClick={handleHeaderClick}
          onMouseEnter={(e) => {
            if (local.collapsible) {
              e.currentTarget.style.background = "var(--surface-hover)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Show when={local.collapsible}>
            <Show when={collapsed()} fallback={
              <Icon name="chevron-down" size={12} style={chevronStyle} />
            }>
              <Icon name="chevron-right" size={12} style={chevronStyle} />
            </Show>
          </Show>
          <span style={titleStyle}>{local.title}</span>
          <Show when={local.actions}>
            <div style={actionsStyle} onClick={(e) => e.stopPropagation()}>
              {local.actions}
            </div>
          </Show>
        </div>
      </Show>
      <div class={contentClassName()} style={contentStyle()}>
        {local.children}
      </div>
    </div>
  );
}

export interface SidebarContentProps extends ParentProps {
  style?: JSX.CSSProperties;
}

export function SidebarContent(props: SidebarContentProps) {
  const style: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    ...props.style,
  };

  return <div style={style}>{props.children}</div>;
}
