import { 
  ParentProps, 
  createSignal, 
  createEffect, 
  JSX,
  Show,
  splitProps,
  onMount,
  onCleanup,
} from "solid-js";
import { ResizeHandle, ResizeDirection } from "./ResizeHandle";
import { IconButton, Text } from "@/components/ui";
import { Icon } from "./ui/Icon";

// ============================================================================
// Panel Component
// ============================================================================

export interface PanelProps extends ParentProps {
  id: string;
  title?: string;
  icon?: JSX.Element;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showHeader?: boolean;
  headerHeight?: number;
  actions?: JSX.Element;
  onCollapse?: (collapsed: boolean) => void;
  onClose?: () => void;
  onFocus?: () => void;
  style?: JSX.CSSProperties;
  emptyState?: JSX.Element;
}

export function Panel(props: PanelProps) {
  const [local] = splitProps(props, [
    "id", "title", "icon", "defaultSize", "minSize", "maxSize",
    "collapsible", "defaultCollapsed", "showHeader", "headerHeight",
    "actions", "onCollapse", "onClose", "onFocus", "style",
    "emptyState", "children"
  ]);

  const [isCollapsed, setIsCollapsed] = createSignal(local.defaultCollapsed ?? false);
  
  const headerH = () => local.headerHeight ?? 34;
  const showHeader = () => local.showHeader !== false && (local.title || local.actions);

  const handleCollapse = () => {
    const newCollapsed = !isCollapsed();
    setIsCollapsed(newCollapsed);
    local.onCollapse?.(newCollapsed);
  };

  const panelStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--jb-surface-base)",
    ...local.style,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "flex-shrink": "0",
    padding: "0 12px",
    "user-select": "none",
    height: `${headerH()}px`,
    "min-height": `${headerH()}px`,
    background: "var(--jb-surface-base)",
    "border-bottom": "1px solid var(--jb-border-divider)",
  });

  const headerContentStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    flex: "1",
    "min-width": "0",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "2px",
  };

  const contentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "min-height": "0",
    overflow: "hidden",
    height: isCollapsed() ? "0" : "auto",
    opacity: isCollapsed() ? "0" : "1",
    transition: "all 150ms ease",
  });

  const emptyStateContainerStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    height: "100%",
  };

  return (
    <div
      style={panelStyle()}
      onFocus={() => local.onFocus?.()}
      tabIndex={-1}
      data-panel-id={local.id}
    >
      {/* Panel Header */}
      <Show when={showHeader()}>
        <div style={headerStyle()}>
          {/* Icon & Title */}
          <div style={headerContentStyle}>
            <Show when={local.icon}>
              <span style={{ color: "var(--jb-icon-color-default)" }}>
                {local.icon}
              </span>
            </Show>
            <Show when={local.title}>
              <Text variant="header" truncate>{local.title}</Text>
            </Show>
          </div>
          
          {/* Actions */}
          <div style={actionsStyle}>
            {local.actions}
            
            {/* Collapse button */}
            <Show when={local.collapsible}>
              <IconButton
                size="sm"
                onClick={handleCollapse}
                tooltip={isCollapsed() ? "Expand" : "Collapse"}
              >
                {isCollapsed() ? (
                  <Icon name="maximize" size={14} />
                ) : (
                  <Icon name="minimize" size={14} />
                )}
              </IconButton>
            </Show>
            
            {/* Close button */}
            <Show when={local.onClose}>
              <IconButton
                size="sm"
                onClick={local.onClose}
                tooltip="Close"
              >
                <Icon name="xmark" size={14} />
              </IconButton>
            </Show>
          </div>
        </div>
      </Show>
      
      {/* Panel Content */}
      <div style={contentStyle()}>
        <Show when={!isCollapsed()}>
          <Show 
            when={local.children} 
            fallback={
              <Show when={local.emptyState}>
                <div style={emptyStateContainerStyle}>
                  {local.emptyState}
                </div>
              </Show>
            }
          >
            {local.children}
          </Show>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// PanelGroup Component
// ============================================================================

export type PanelGroupDirection = "horizontal" | "vertical";

export interface PanelGroupProps extends ParentProps {
  direction?: PanelGroupDirection;
  style?: JSX.CSSProperties;
}

export function PanelGroup(props: PanelGroupProps) {
  const direction = () => props.direction ?? "horizontal";

  const groupStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "min-height": "0",
    "min-width": "0",
    "flex-direction": direction() === "horizontal" ? "row" : "column",
    ...props.style,
  });

  return (
    <div style={groupStyle()}>
      {props.children}
    </div>
  );
}

// ============================================================================
// ResizablePanel Component (with integrated resize handle)
// ============================================================================

export interface ResizablePanelProps extends ParentProps {
  id: string;
  position: "left" | "right" | "top" | "bottom";
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onResize?: (size: number) => void;
  onCollapse?: (collapsed: boolean) => void;
  storageKey?: string;
  style?: JSX.CSSProperties;
}

export function ResizablePanel(props: ResizablePanelProps) {
  const isHorizontal = () => props.position === "left" || props.position === "right";
  const isStart = () => props.position === "left" || props.position === "top";
  
  // Load saved size from localStorage
  const getSavedSize = () => {
    if (props.storageKey) {
      const saved = localStorage.getItem(`panel_size_${props.storageKey}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return props.defaultSize;
  };

  const getSavedCollapsed = () => {
    if (props.storageKey) {
      const saved = localStorage.getItem(`panel_collapsed_${props.storageKey}`);
      if (saved !== null) return saved === "true";
    }
    return props.defaultCollapsed ?? false;
  };

  const [size, setSize] = createSignal(getSavedSize());
  const [collapsed] = createSignal(getSavedCollapsed());
  const [_lastSize, setLastSize] = createSignal(getSavedSize());

  // Save size to localStorage
  createEffect(() => {
    if (props.storageKey && !collapsed()) {
      localStorage.setItem(`panel_size_${props.storageKey}`, size().toString());
    }
  });

  createEffect(() => {
    if (props.storageKey) {
      localStorage.setItem(`panel_collapsed_${props.storageKey}`, collapsed().toString());
    }
  });

  const handleResize = (delta: number) => {
    const multiplier = isStart() ? 1 : -1;
    const newSize = Math.max(
      props.minSize ?? 50,
      Math.min(props.maxSize ?? 800, size() + delta * multiplier)
    );
    setSize(newSize);
    setLastSize(newSize);
    props.onResize?.(newSize);
  };

  const handleDoubleClick = () => {
    // Reset to default size on double-click
    setSize(props.defaultSize);
    setLastSize(props.defaultSize);
    props.onResize?.(props.defaultSize);
  };

  const currentSize = () => collapsed() ? 0 : size();
  const resizeDirection = (): ResizeDirection => isHorizontal() ? "horizontal" : "vertical";

  const panelStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-shrink": "0",
    "flex-direction": isStart() ? "row" : "row-reverse",
    width: isHorizontal() ? `${currentSize()}px` : "100%",
    height: isHorizontal() ? "100%" : `${currentSize()}px`,
    "min-width": isHorizontal() ? (collapsed() ? "0" : `${props.minSize ?? 50}px`) : undefined,
    "min-height": !isHorizontal() ? (collapsed() ? "0" : `${props.minSize ?? 50}px`) : undefined,
    "max-width": isHorizontal() && props.maxSize ? `${props.maxSize}px` : undefined,
    "max-height": !isHorizontal() && props.maxSize ? `${props.maxSize}px` : undefined,
    transition: "width 150ms ease, height 150ms ease",
    overflow: "hidden",
    ...props.style,
  });

  const contentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "min-width": "0",
    "min-height": "0",
    overflow: "hidden",
    opacity: collapsed() ? "0" : "1",
    transition: "opacity 150ms ease",
  });

  return (
    <div
      style={panelStyle()}
      data-panel-id={props.id}
      data-collapsed={collapsed()}
    >
      {/* Panel Content */}
      <div style={contentStyle()}>
        {props.children}
      </div>
      
      {/* Resize Handle */}
      <Show when={!collapsed()}>
        <ResizeHandle
          direction={resizeDirection()}
          onResize={handleResize}
          onDoubleClick={handleDoubleClick}
          minSize={props.minSize}
          maxSize={props.maxSize}
          defaultSize={props.defaultSize}
          disabled={collapsed()}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// CollapsiblePanel - A panel that can be collapsed with animation
// ============================================================================

export interface CollapsiblePanelProps extends ParentProps {
  id: string;
  title?: string;
  icon?: JSX.Element;
  position: "left" | "right" | "bottom";
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  collapsed: boolean;
  onToggle: () => void;
  actions?: JSX.Element;
  headerHeight?: number;
  storageKey?: string;
  style?: JSX.CSSProperties;
}

export function CollapsiblePanel(props: CollapsiblePanelProps) {
  const isHorizontal = () => props.position === "left" || props.position === "right";
  const isStart = () => props.position === "left";
  const headerH = () => props.headerHeight ?? 34;
  
  // Load/save size from localStorage
  const getSavedSize = () => {
    if (props.storageKey) {
      const saved = localStorage.getItem(`panel_size_${props.storageKey}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return props.defaultSize;
  };

  const [size, setSize] = createSignal(getSavedSize());

  createEffect(() => {
    if (props.storageKey && !props.collapsed) {
      localStorage.setItem(`panel_size_${props.storageKey}`, size().toString());
    }
  });

  const handleResize = (delta: number) => {
    const multiplier = isStart() ? 1 : -1;
    if (!isHorizontal()) {
      // For bottom panel, positive delta means shrinking
      const newSize = Math.max(
        props.minSize ?? 100,
        Math.min(props.maxSize ?? 500, size() - delta)
      );
      setSize(newSize);
    } else {
      const newSize = Math.max(
        props.minSize ?? 100,
        Math.min(props.maxSize ?? 500, size() + delta * multiplier)
      );
      setSize(newSize);
    }
  };

  const handleDoubleClick = () => {
    // Reset to default size
    setSize(props.defaultSize);
  };

  const currentSize = () => props.collapsed ? 0 : size();

  const CollapseIcon = () => {
    if (props.position === "bottom") {
      return props.collapsed 
        ? <Icon name="chevron-up" size={14} /> 
        : <Icon name="chevron-down" size={14} />;
    } else if (props.position === "left") {
      return props.collapsed 
        ? <Icon name="chevron-right" size={14} /> 
        : <Icon name="chevron-left" size={14} />;
    } else {
      return props.collapsed 
        ? <Icon name="chevron-left" size={14} /> 
        : <Icon name="chevron-right" size={14} />;
    }
  };

  const panelStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    width: isHorizontal() ? `${currentSize()}px` : "100%",
    height: isHorizontal() ? "100%" : `${currentSize()}px`,
    "min-width": isHorizontal() ? (props.collapsed ? "0" : `${props.minSize ?? 100}px`) : undefined,
    "min-height": !isHorizontal() ? (props.collapsed ? "0" : `${props.minSize ?? 100}px`) : undefined,
    transition: "width 150ms ease, height 150ms ease, opacity 150ms ease",
    opacity: props.collapsed ? "0" : "1",
    "pointer-events": props.collapsed ? "none" : "auto",
    background: "var(--jb-surface-base)",
    ...props.style,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "flex-shrink": "0",
    padding: "0 12px",
    "user-select": "none",
    height: `${headerH()}px`,
    "min-height": `${headerH()}px`,
    "border-bottom": "1px solid var(--jb-border-divider)",
  });

  const headerContentStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    flex: "1",
    "min-width": "0",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "2px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-height": "0",
    overflow: "hidden",
  };

  const resizeHandleContainerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    [isStart() ? "right" : "left"]: "0",
    top: "0",
    bottom: "0",
  });

  return (
    <div
      style={panelStyle()}
      data-panel-id={props.id}
      data-collapsed={props.collapsed}
    >
      {/* Resize Handle at top for bottom panel */}
      <Show when={!props.collapsed && props.position === "bottom"}>
        <ResizeHandle
          direction="vertical"
          onResize={handleResize}
          onDoubleClick={handleDoubleClick}
          minSize={props.minSize}
          maxSize={props.maxSize}
          defaultSize={props.defaultSize}
        />
      </Show>

      {/* Header */}
      <Show when={props.title}>
        <div style={headerStyle()}>
          <div style={headerContentStyle}>
            <Show when={props.icon}>
              <span style={{ color: "var(--jb-icon-color-default)" }}>
                {props.icon}
              </span>
            </Show>
            <Text variant="header" truncate>{props.title}</Text>
          </div>
          
          <div style={actionsStyle}>
            {props.actions}
            <IconButton
              size="sm"
              onClick={props.onToggle}
              tooltip={props.collapsed ? "Expand" : "Collapse"}
            >
              <CollapseIcon />
            </IconButton>
          </div>
        </div>
      </Show>

      {/* Content */}
      <div style={contentStyle}>
        {props.children}
      </div>

      {/* Resize Handle for side panels */}
      <Show when={!props.collapsed && isHorizontal()}>
        <div style={resizeHandleContainerStyle()}>
          <ResizeHandle
            direction="horizontal"
            onResize={handleResize}
            onDoubleClick={handleDoubleClick}
            minSize={props.minSize}
            maxSize={props.maxSize}
            defaultSize={props.defaultSize}
          />
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// SplitPanel - For editor split views
// ============================================================================

export interface SplitPanelProps extends ParentProps {
  id?: string;
  direction: "horizontal" | "vertical";
  ratio?: number;
  minRatio?: number;
  maxRatio?: number;
  onRatioChange?: (ratio: number) => void;
  first: () => JSX.Element;
  second: () => JSX.Element;
  storageKey?: string;
}

export function SplitPanel(props: SplitPanelProps) {
  const getSavedRatio = () => {
    if (props.storageKey) {
      const saved = localStorage.getItem(`split_ratio_${props.storageKey}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return props.ratio ?? 0.5;
  };

  const [ratio, setRatio] = createSignal(getSavedRatio());
  const [isDragging, setIsDragging] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (props.storageKey) {
      localStorage.setItem(`split_ratio_${props.storageKey}`, ratio().toString());
    }
  });

  const isVertical = () => props.direction === "vertical";
  const minRatio = () => props.minRatio ?? 0.15;
  const maxRatio = () => props.maxRatio ?? 0.85;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !containerRef) return;
    
    const rect = containerRef.getBoundingClientRect();
    let newRatio: number;
    
    if (isVertical()) {
      newRatio = (e.clientX - rect.left) / rect.width;
    } else {
      newRatio = (e.clientY - rect.top) / rect.height;
    }
    
    newRatio = Math.max(minRatio(), Math.min(maxRatio(), newRatio));
    setRatio(newRatio);
    props.onRatioChange?.(newRatio);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    // Reset to 50%
    setRatio(0.5);
    props.onRatioChange?.(0.5);
  };

  onMount(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  });

  const containerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    overflow: "hidden",
    "flex-direction": isVertical() ? "row" : "column",
  });

  const firstPanelStyle = (): JSX.CSSProperties => ({
    display: "flex",
    overflow: "hidden",
    [isVertical() ? "width" : "height"]: `${ratio() * 100}%`,
    "min-width": isVertical() ? "100px" : undefined,
    "min-height": !isVertical() ? "100px" : undefined,
  });

  const dividerStyle = (): JSX.CSSProperties => ({
    "flex-shrink": "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    transition: "background var(--cortex-transition-fast)",
    width: isVertical() ? "4px" : "100%",
    height: isVertical() ? "100%" : "4px",
    background: isDragging() ? "var(--jb-border-focus)" : "var(--jb-border-divider)",
    cursor: isVertical() ? "col-resize" : "row-resize",
  });

  const secondPanelStyle = (): JSX.CSSProperties => ({
    display: "flex",
    overflow: "hidden",
    [isVertical() ? "width" : "height"]: `${(1 - ratio()) * 100}%`,
    "min-width": isVertical() ? "100px" : undefined,
    "min-height": !isVertical() ? "100px" : undefined,
  });

  return (
    <div
      ref={containerRef}
      style={containerStyle()}
      data-split-id={props.id}
    >
      {/* First panel */}
      <div style={firstPanelStyle()}>
        {props.first()}
      </div>
      
      {/* Resize handle */}
      <div
        style={dividerStyle()}
        onMouseDown={handleMouseDown}
        onDblClick={handleDoubleClick}
      />
      
      {/* Second panel */}
      <div style={secondPanelStyle()}>
        {props.second()}
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { ResizeHandle, SashState } from "./ResizeHandle";
export type { ResizeHandleProps } from "./ResizeHandle";
