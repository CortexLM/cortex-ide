import { JSX, splitProps, Show, For, createSignal } from "solid-js";

export interface BreadcrumbItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: JSX.Element;
  /** Whether this item is clickable */
  href?: string;
  /** Click handler */
  onClick?: () => void;
}

export interface BreadcrumbProps {
  /** Breadcrumb items */
  items: BreadcrumbItem[];
  /** Custom separator */
  separator?: JSX.Element;
  /** Maximum items before collapsing */
  maxItems?: number;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Breadcrumb(props: BreadcrumbProps) {
  const [local] = splitProps(props, ["items", "separator", "maxItems", "style"]);

  const [expanded, setExpanded] = createSignal(false);

  const visibleItems = () => {
    const max = local.maxItems || 0;
    if (!max || expanded() || local.items.length <= max) {
      return local.items;
    }
    // Show first, ellipsis, and last (max-1) items
    const firstItem = local.items[0];
    const lastItems = local.items.slice(-(max - 1));
    return [firstItem, { id: "__ellipsis__", label: "..." }, ...lastItems];
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    "font-size": "13px",
    ...local.style,
  };

  const separatorStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    color: "var(--text-placeholder)",
    "font-size": "11px",
    "flex-shrink": "0",
  };

  const defaultSeparator = (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  );

  return (
    <nav aria-label="Breadcrumb" style={containerStyle}>
      <For each={visibleItems()}>
        {(item, index) => (
          <>
            <Show when={index() > 0}>
              <span style={separatorStyle} aria-hidden="true">
                {local.separator || defaultSeparator}
              </span>
            </Show>
            <Show
              when={item.id !== "__ellipsis__"}
              fallback={
                <BreadcrumbEllipsis onClick={() => setExpanded(true)} />
              }
            >
              <BreadcrumbItemComponent
                item={item}
                isLast={index() === visibleItems().length - 1}
              />
            </Show>
          </>
        )}
      </For>
    </nav>
  );
}

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem;
  isLast: boolean;
}

function BreadcrumbItemComponent(props: BreadcrumbItemComponentProps) {
  const [hovered, setHovered] = createSignal(false);

  const isClickable = () => !props.isLast && (props.item.href || props.item.onClick);

  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "4px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    color: props.isLast ? "var(--text-title)" : (hovered() && isClickable() ? "var(--text-primary)" : "var(--text-muted)"),
    background: hovered() && isClickable() ? "var(--surface-hover)" : "transparent",
    cursor: props.isLast ? "default" : (isClickable() ? "pointer" : "default"),
    "text-decoration": "none",
    transition: "background 100ms ease, color 100ms ease",
  });

  const handleClick = () => {
    if (props.isLast) return;
    props.item.onClick?.();
  };

  const content = (
    <>
      <Show when={props.item.icon}>
        <span style={{ width: "14px", height: "14px", "flex-shrink": "0" }}>
          {props.item.icon}
        </span>
      </Show>
      <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
        {props.item.label}
      </span>
    </>
  );

  if (props.item.href && !props.isLast) {
    return (
      <a
        href={props.item.href}
        style={itemStyle()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-current={props.isLast ? "page" : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <span
      style={itemStyle()}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={props.isLast ? "page" : undefined}
      role={isClickable() ? "button" : undefined}
      tabIndex={isClickable() ? 0 : undefined}
    >
      {content}
    </span>
  );
}

function BreadcrumbEllipsis(props: { onClick: () => void }) {
  const [hovered, setHovered] = createSignal(false);

  const style = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    padding: "4px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--text-muted)",
    background: hovered() ? "var(--surface-hover)" : "transparent",
    cursor: "pointer",
    transition: "background 100ms ease, color 100ms ease",
  });

  return (
    <button
      type="button"
      style={style()}
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Show all breadcrumbs"
    >
      •••
    </button>
  );
}

