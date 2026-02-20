/**
 * =============================================================================
 * AUXILIARY SIDEBAR (Secondary Side Bar)
 * =============================================================================
 * 
 * The auxiliary sidebar is positioned opposite to the primary sidebar and can
 * contain views like Outline, Timeline, Chat, etc. It mirrors VS Code's 
 * secondary sidebar functionality.
 * 
 * Features:
 * - Positioned opposite to primary sidebar (left if primary is right, vice versa)
 * - Resizable with drag handle
 * - Toggle visibility
 * - Mini activity bar for quick view switching
 * - Syncs with LayoutContext for state management
 * - Supports drag-and-drop of views between sidebars
 * 
 * Usage:
 *   <AuxiliarySidebar>
 *     <TimelineView filePath={currentFile} />
 *   </AuxiliarySidebar>
 * 
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  Show,
  For,
  ParentProps,
  JSX,
} from "solid-js";
import { tokens } from "../../design-system/tokens";
import { HStack } from "../../design-system/primitives/Flex";
import { useResize } from "../../layout/hooks/useResize";
import { useLayout, useAuxiliaryBar, type LayoutView, type ViewLocation } from "../../context/LayoutContext";

// =============================================================================
// TYPES
// =============================================================================

export interface AuxiliarySidebarProps extends ParentProps {
  /** Custom class name */
  class?: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
  /** Show the mini activity bar */
  showActivityBar?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Callback when active view changes */
  onActiveViewChange?: (viewId: string | null) => void;
  /** Custom header actions */
  headerActions?: JSX.Element;
  /** Custom content renderer for views */
  renderView?: (view: LayoutView) => JSX.Element;
}

export interface AuxiliaryActivityBarProps {
  views: LayoutView[];
  activeViewId: string | null;
  onViewSelect: (viewId: string) => void;
  position: "left" | "right";
}

export interface AuxiliaryHeaderProps {
  title: string;
  icon?: string;
  onClose: () => void;
  onMinimize?: () => void;
  actions?: JSX.Element;
}

// =============================================================================
// ICONS (Codicons)
// =============================================================================

const icons: Record<string, () => JSX.Element> = {
  "symbol-class": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.34 9.71h.71l2.67-2.67v-.71L13.38 5h-.7l-1.82 1.81h-5V5.5l-1.5-1.5H3.5L2 5.5v.71l1.5 1.5h.86v5.08H3.5L2 14.29v.71l1.5 1.5h.86l1.5-1.5v-.86h5.79L13.38 16h.71l1.34-1.34v-.71l-2.67-2.67h-.71l-1.53 1.53H5.86V8.1h5.15l.33.33.33-.33-.33-.39z"/>
    </svg>
  ),
  "history": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.507 12.324a7 7 0 0 0 .065-8.56A7 7 0 0 0 2 4.393V2H1v3.5l.5.5H5V5H2.811a6.008 6.008 0 1 1-.135 5.77l-.898.44a7 7 0 0 0 11.729 1.114zM8 4h1v4H5V7h3V4z"/>
    </svg>
  ),
  "comment-discussion": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 2h-13l-.5.5v9l.5.5H4v2.5l.854.354L7.707 12H14.5l.5-.5v-9l-.5-.5zm-.5 9H7.293l-.147.146L5 13.293V11.5l-.5-.5H2V3h12v8z"/>
    </svg>
  ),
  "close": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
    </svg>
  ),
  "chevron-left": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.072 1.928L4 8l6.072 6.072.856-.856L5.712 8l5.216-5.216-.856-.856z"/>
    </svg>
  ),
  "chevron-right": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.928 14.072L12 8 5.928 1.928l-.856.856L10.288 8l-5.216 5.216.856.856z"/>
    </svg>
  ),
  "ellipsis": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
    </svg>
  ),
  "gripper": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 3h2v2H5zm4 0h2v2H9zM5 7h2v2H5zm4 0h2v2H9zM5 11h2v2H5zm4 0h2v2H9z"/>
    </svg>
  ),
};

function Icon(props: { name: string; size?: number }) {
  const iconFn = icons[props.name];
  const size = props.size || 16;
  
  return (
    <span
      style={{
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {iconFn ? iconFn() : null}
    </span>
  );
}

// =============================================================================
// MINI ACTIVITY BAR
// =============================================================================

function AuxiliaryActivityBar(props: AuxiliaryActivityBarProps) {
  const activityBarStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    width: "36px",
    "min-width": "36px",
    background: tokens.colors.surface.canvas,
    "border-left": props.position === "right" ? `1px solid ${tokens.colors.border.divider}` : "none",
    "border-right": props.position === "left" ? `1px solid ${tokens.colors.border.divider}` : "none",
  };

  const activityItemStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "36px",
    height: "36px",
    cursor: "pointer",
    color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
    background: isActive ? tokens.colors.interactive.hover : "transparent",
    "border-left": isActive && props.position === "right" 
      ? `2px solid ${tokens.colors.semantic.primary}` 
      : "2px solid transparent",
    "border-right": isActive && props.position === "left"
      ? `2px solid ${tokens.colors.semantic.primary}`
      : "2px solid transparent",
    transition: `all ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
  });

  return (
    <div style={activityBarStyle}>
      <For each={props.views}>
        {(view) => {
          const isActive = () => props.activeViewId === view.id;
          
          return (
            <div
              style={activityItemStyle(isActive())}
              onClick={() => props.onViewSelect(view.id)}
              title={view.title}
              role="tab"
              aria-selected={isActive()}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onViewSelect(view.id);
                }
              }}
              onMouseEnter={(e) => {
                if (!isActive()) {
                  e.currentTarget.style.background = tokens.colors.interactive.hover;
                  e.currentTarget.style.color = tokens.colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive()) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = tokens.colors.text.muted;
                }
              }}
            >
              <Icon name={view.icon || "symbol-class"} size={20} />
            </div>
          );
        }}
      </For>
    </div>
  );
}

// =============================================================================
// AUXILIARY HEADER
// =============================================================================

function AuxiliaryHeader(props: AuxiliaryHeaderProps) {
  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    height: "35px",
    "min-height": "35px",
    padding: `0 ${tokens.spacing.md}`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    "user-select": "none",
  };

  const titleStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    "font-size": tokens.typography.fontSize.sm,
    "font-weight": tokens.typography.fontWeight.semibold,
    "text-transform": "uppercase",
    "letter-spacing": "0.05em",
    color: tokens.colors.text.muted,
  };

  const buttonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "22px",
    height: "22px",
    padding: "0",
    border: "none",
    background: "transparent",
    color: tokens.colors.icon.default,
    "border-radius": tokens.radius.sm,
    cursor: "pointer",
    transition: `all ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
  };

  return (
    <div style={headerStyle}>
      <div style={titleStyle}>
        <Show when={props.icon}>
          <Icon name={props.icon!} size={14} />
        </Show>
        <span>{props.title}</span>
      </div>
      
      <HStack spacing="xs">
        {props.actions}
        <Show when={props.onMinimize}>
          <button
            style={buttonStyle}
            onClick={props.onMinimize}
            title="Minimize"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </Show>
        <button
          style={buttonStyle}
          onClick={props.onClose}
          title="Close Secondary Side Bar"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="close" size={14} />
        </button>
      </HStack>
    </div>
  );
}

// =============================================================================
// RESIZE HANDLE
// =============================================================================

interface ResizeHandleProps {
  position: "left" | "right";
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

function ResizeHandle(props: ResizeHandleProps) {
  const { startResize, isResizing, handleKeyDown } = useResize({
    direction: "horizontal",
    onResize: (delta) => {
      // Invert delta for left position
      props.onResize(props.position === "left" ? -delta : delta);
    },
    onResizeStart: props.onResizeStart,
    onResizeEnd: props.onResizeEnd,
  });

  const handleStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "0",
    bottom: "0",
    width: "4px",
    cursor: "col-resize",
    "z-index": "10",
    [props.position === "right" ? "left" : "right"]: "-2px",
  };

  return (
    <div
      style={{
        ...handleStyle,
        background: isResizing() ? tokens.colors.accent.muted : "transparent",
        transition: `background ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
      }}
      onMouseDown={startResize}
      onTouchStart={startResize}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize auxiliary sidebar"
      onMouseEnter={(e) => {
        if (!isResizing()) {
          e.currentTarget.style.background = tokens.colors.semantic.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (!isResizing()) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    />
  );
}

// =============================================================================
// DROP ZONE
// =============================================================================

interface DropZoneProps {
  location: ViewLocation;
  onDrop: (viewId: string) => void;
  isDragging: boolean;
}

function DropZone(props: DropZoneProps) {
  const [isOver, setIsOver] = createSignal(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const viewId = e.dataTransfer?.getData("text/plain");
    if (viewId) {
      props.onDrop(viewId);
    }
  };

  return (
    <Show when={props.isDragging}>
      <div
        style={{
          position: "absolute",
          inset: "0",
          background: isOver() ? `${tokens.colors.semantic.primary}20` : "transparent",
          border: isOver() ? `2px dashed ${tokens.colors.semantic.primary}` : "2px dashed transparent",
          "border-radius": tokens.radius.md,
          "z-index": "100",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "pointer-events": "auto",
          transition: `all ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Show when={isOver()}>
          <span
            style={{
              color: tokens.colors.semantic.primary,
              "font-size": tokens.typography.fontSize.sm,
              "font-weight": tokens.typography.fontWeight.medium,
            }}
          >
            Drop here
          </span>
        </Show>
      </div>
    </Show>
  );
}

// =============================================================================
// DEFAULT VIEW CONTENT
// =============================================================================

interface DefaultViewContentProps {
  view: LayoutView;
}

function DefaultViewContent(props: DefaultViewContentProps) {
  const emptyStateStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    height: "100%",
    padding: tokens.spacing.xl,
    color: tokens.colors.text.muted,
    "text-align": "center",
  };

  return (
    <div style={emptyStateStyle}>
      <Icon name={props.view.icon || "symbol-class"} size={48} />
      <span
        style={{
          "margin-top": tokens.spacing.md,
          "font-size": tokens.typography.fontSize.sm,
        }}
      >
        {props.view.title}
      </span>
      <span
        style={{
          "margin-top": tokens.spacing.sm,
          "font-size": tokens.typography.fontSize.xs,
          opacity: 0.7,
        }}
      >
        View content not available
      </span>
    </div>
  );
}

// =============================================================================
// AUXILIARY SIDEBAR COMPONENT
// =============================================================================

export function AuxiliarySidebar(props: AuxiliarySidebarProps) {
  const auxiliaryBar = useAuxiliaryBar();
  const layout = useLayout();
  
  const [isResizing, setIsResizing] = createSignal(false);
  
  // Get position (opposite to primary sidebar)
  const position = () => auxiliaryBar.position();
  
  // Get active view
  const activeView = createMemo(() => {
    const activeId = auxiliaryBar.activeViewId();
    return auxiliaryBar.views().find((v) => v.id === activeId);
  });

  // Handle resize
  const handleResize = (delta: number) => {
    const currentWidth = auxiliaryBar.width();
    auxiliaryBar.setWidth(currentWidth + delta);
  };

  // Handle view selection
  const handleViewSelect = (viewId: string) => {
    if (auxiliaryBar.activeViewId() === viewId) {
      // Toggle visibility if clicking the active view
      auxiliaryBar.toggle();
    } else {
      auxiliaryBar.setActiveView(viewId);
    }
    props.onActiveViewChange?.(viewId);
  };

  // Handle close
  const handleClose = () => {
    auxiliaryBar.setVisible(false);
    props.onVisibilityChange?.(false);
  };

  // Handle drop from drag and drop
  const handleDrop = (_viewId: string) => {
    layout.endDrag("auxiliaryBar");
  };

  // Track visibility changes
  createEffect(() => {
    const visible = auxiliaryBar.visible();
    props.onVisibilityChange?.(visible);
  });

  // Container styles
  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: auxiliaryBar.visible() ? "flex" : "none",
    "flex-direction": position() === "right" ? "row" : "row-reverse",
    width: `${auxiliaryBar.width()}px`,
    "min-width": "200px",
    "max-width": "600px",
    height: "100%",
    background: tokens.colors.surface.panel,
    "border-left": position() === "right" ? `1px solid ${tokens.colors.border.divider}` : "none",
    "border-right": position() === "left" ? `1px solid ${tokens.colors.border.divider}` : "none",
    transition: isResizing() ? "none" : `width ${tokens.motion.duration.normal} ${tokens.motion.easing.standard}`,
    overflow: "hidden",
  });

  const contentStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    flex: "1",
    "min-width": "0",
    overflow: "hidden",
  };

  const bodyStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    position: "relative",
  };

  return (
    <aside
      class={props.class}
      style={{ ...containerStyle(), ...props.style }}
      data-auxiliary-sidebar
      data-position={position()}
      data-visible={auxiliaryBar.visible()}
    >
      {/* Resize Handle */}
      <ResizeHandle
        position={position()}
        onResize={handleResize}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
      />
      
      {/* Mini Activity Bar */}
      <Show when={props.showActivityBar !== false}>
        <AuxiliaryActivityBar
          views={auxiliaryBar.views()}
          activeViewId={auxiliaryBar.activeViewId()}
          onViewSelect={handleViewSelect}
          position={position()}
        />
      </Show>
      
      {/* Main Content */}
      <div style={contentStyle}>
        {/* Header */}
        <Show when={activeView()}>
          <AuxiliaryHeader
            title={activeView()!.title}
            icon={activeView()!.icon}
            onClose={handleClose}
            actions={props.headerActions}
          />
        </Show>
        
        {/* Body */}
        <div style={bodyStyle}>
          {/* Drop Zone for drag and drop */}
          <DropZone
            location="auxiliaryBar"
            onDrop={handleDrop}
            isDragging={layout.state.dragState.isDragging}
          />
          
          {/* Content */}
          <Show
            when={activeView()}
            fallback={
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  height: "100%",
                  color: tokens.colors.text.muted,
                  "font-size": tokens.typography.fontSize.sm,
                }}
              >
                No view selected
              </div>
            }
          >
            {/* Custom render function or default */}
            <Show
              when={props.renderView}
              fallback={
                <Show when={props.children} fallback={<DefaultViewContent view={activeView()!} />}>
                  {props.children}
                </Show>
              }
            >
              {props.renderView!(activeView()!)}
            </Show>
          </Show>
        </div>
      </div>
    </aside>
  );
}

// =============================================================================
// TOGGLE BUTTON COMPONENT
// =============================================================================

export interface AuxiliarySidebarToggleProps {
  /** Custom class name */
  class?: string;
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Show label */
  showLabel?: boolean;
}

export function AuxiliarySidebarToggle(props: AuxiliarySidebarToggleProps) {
  const auxiliaryBar = useAuxiliaryBar();
  
  const sizes = {
    sm: { button: "24px", icon: 14 },
    md: { button: "28px", icon: 16 },
    lg: { button: "32px", icon: 18 },
  };
  
  const size = () => sizes[props.size || "md"];
  
  const buttonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.sm,
    height: size().button,
    "min-width": size().button,
    padding: props.showLabel ? `0 ${tokens.spacing.md}` : "0",
    border: "none",
    background: auxiliaryBar.visible() ? tokens.colors.interactive.active : "transparent",
    color: auxiliaryBar.visible() ? tokens.colors.text.primary : tokens.colors.text.muted,
    "border-radius": tokens.radius.sm,
    cursor: "pointer",
    transition: `all ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
    "font-size": tokens.typography.fontSize.sm,
  };

  return (
    <button
      class={props.class}
      style={buttonStyle}
      onClick={() => auxiliaryBar.toggle()}
      title={auxiliaryBar.visible() ? "Hide Secondary Side Bar" : "Show Secondary Side Bar"}
      aria-pressed={auxiliaryBar.visible()}
      onMouseEnter={(e) => {
        if (!auxiliaryBar.visible()) {
          e.currentTarget.style.background = tokens.colors.interactive.hover;
          e.currentTarget.style.color = tokens.colors.text.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (!auxiliaryBar.visible()) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = tokens.colors.text.muted;
        }
      }}
    >
      <Icon name="gripper" size={size().icon} />
      <Show when={props.showLabel}>
        <span>Secondary Side Bar</span>
      </Show>
    </button>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default AuxiliarySidebar;
