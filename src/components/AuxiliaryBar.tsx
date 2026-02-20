/**
 * AuxiliaryBar - Secondary sidebar component (like VS Code's right sidebar)
 * 
 * Features:
 * - Positioned opposite to primary sidebar
 * - Resizable width with drag handle
 * - Collapsible
 * - Hosts multiple views (Outline, Timeline, Chat, custom panels)
 * - View tabs at top for switching
 * - Supports drag-and-drop between sidebars
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  JSX,
  Switch,
  Match,
  lazy,
  Suspense,
} from "solid-js";
import { useAuxiliaryBar, type ViewId, type LayoutView } from "@/context/LayoutContext";
import { Icon } from "./ui/Icon";
import { ResizeHandle, SashState } from "@/components/ResizeHandle";
import { tokens } from "@/design-system/tokens";
import { IconButton, Text, LoadingSpinner } from "@/components/ui";

// Lazy-load view components
const OutlineView = lazy(() => import("@/components/OutlineView").then(m => ({ default: m.OutlineView })));
const TimelineView = lazy(() => import("@/components/TimelineView").then(m => ({ default: m.TimelineView })));
const ChatPanel = lazy(() => import("@/components/cortex/CortexChatPanel").then(m => ({ default: m.CortexChatPanel })));

// ============================================================================
// Types
// ============================================================================

export interface AuxiliaryBarProps {
  /** Custom class name */
  class?: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
  /** Current file path for context-aware views */
  currentFilePath?: string;
}

interface ViewTabProps {
  view: LayoutView;
  isActive: boolean;
  onClick: () => void;
  onClose?: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
}

// ============================================================================
// View Icon Component
// ============================================================================

function ViewIcon(props: { viewId: ViewId; size?: number }) {
  const size = () => props.size || 16;
  
  return (
    <Switch fallback={<Icon name="list" size={size()} />}>
      <Match when={props.viewId === "outline"}>
        <Icon name="list" size={size()} />
      </Match>
      <Match when={props.viewId === "timeline"}>
        <Icon name="clock" size={size()} />
      </Match>
      <Match when={props.viewId === "chat"}>
        <Icon name="comment" size={size()} />
      </Match>
    </Switch>
  );
}

// ============================================================================
// View Tab Component
// ============================================================================

function ViewTab(props: ViewTabProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  
  const handleDragStart = (e: DragEvent) => {
    setIsDragging(true);
    e.dataTransfer?.setData("text/plain", props.view.id);
    props.onDragStart?.(e);
  };
  
  const handleDragEnd = (e: DragEvent) => {
    setIsDragging(false);
    props.onDragEnd?.(e);
  };
  
  return (
    <button
      class="auxiliary-bar-tab"
      classList={{
        "auxiliary-bar-tab--active": props.isActive,
        "auxiliary-bar-tab--dragging": isDragging(),
      }}
      onClick={props.onClick}
      draggable={props.view.movable !== false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={props.view.title}
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        gap: tokens.spacing.xs,
        padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
        background: props.isActive ? tokens.colors.interactive.active : "transparent",
        color: props.isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
        border: "none",
        "border-bottom": props.isActive 
          ? `2px solid ${tokens.colors.semantic.primary}` 
          : "2px solid transparent",
        cursor: "pointer",
        "white-space": "nowrap",
        "font-size": tokens.typography.fontSize.sm,
        "font-weight": props.isActive ? tokens.typography.fontWeight.medium : tokens.typography.fontWeight.normal,
        transition: `all ${tokens.motion.duration.fast}`,
        opacity: isDragging() ? "0.5" : "1",
      }}
    >
      <ViewIcon viewId={props.view.viewId} size={14} />
      <span>{props.view.title}</span>
      <Show when={props.view.closable !== false && props.onClose}>
        <span
          class="auxiliary-bar-tab-close"
          onClick={(e) => {
            e.stopPropagation();
            props.onClose?.();
          }}
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "14px",
            height: "14px",
            "margin-left": tokens.spacing.xs,
            "border-radius": tokens.radius.sm,
            opacity: "0",
            transition: `opacity ${tokens.motion.duration.fast}`,
          }}
        >
          <Icon name="xmark" size={10} />
        </span>
      </Show>
    </button>
  );
}

// ============================================================================
// View Content Component
// ============================================================================

function ViewContent(props: { viewId: ViewId; filePath?: string }) {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        height: "100%",
        color: tokens.colors.text.muted,
      }}>
        <LoadingSpinner size="sm" />
      </div>
    }>
      <Switch fallback={
        <div style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          height: "100%",
          padding: tokens.spacing["2xl"],
          "text-align": "center",
          color: tokens.colors.text.muted,
        }}>
          <ViewIcon viewId={props.viewId} size={32} />
          <Text variant="muted" size="sm" style={{ "margin-top": tokens.spacing.md }}>
            View not implemented
          </Text>
        </div>
      }>
        <Match when={props.viewId === "outline"}>
          <OutlineView />
        </Match>
        <Match when={props.viewId === "timeline"}>
          <Show 
            when={props.filePath}
            fallback={
              <div style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                height: "100%",
                padding: tokens.spacing["2xl"],
                "text-align": "center",
                color: tokens.colors.text.muted,
              }}>
                <Icon name="clock" size={32} style={{ opacity: "0.5" }} />
                <Text variant="muted" size="sm" style={{ "margin-top": tokens.spacing.md }}>
                  Open a file to view its timeline
                </Text>
              </div>
            }
          >
            <TimelineView filePath={props.filePath!} />
          </Show>
        </Match>
        <Match when={props.viewId === "chat"}>
          <ChatPanel />
        </Match>
      </Switch>
    </Suspense>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AuxiliaryBar(props: AuxiliaryBarProps) {
  const auxiliaryBar = useAuxiliaryBar();
  
  const [isResizing, setIsResizing] = createSignal(false);
  const [showViewMenu, setShowViewMenu] = createSignal(false);
  
  // Get current active view
  const activeView = createMemo(() => {
    const views = auxiliaryBar.views();
    const activeId = auxiliaryBar.activeViewId();
    return views.find(v => v.id === activeId) || views[0];
  });
  
  // Determine sash state for resize handle
  const getSashState = (): SashState => {
    const width = auxiliaryBar.width();
    const minWidth = 200;
    const maxWidth = 600;
    
    if (width <= minWidth) return SashState.AtMinimum;
    if (width >= maxWidth) return SashState.AtMaximum;
    return SashState.Enabled;
  };
  
  // Handle resize
  const handleResize = (delta: number) => {
    // When auxiliary bar is on right, negative delta increases width
    // When on left, positive delta increases width
    const position = auxiliaryBar.position();
    const adjustment = position === "right" ? -delta : delta;
    auxiliaryBar.setWidth(auxiliaryBar.width() + adjustment);
  };
  
  // Handle double-click on resize handle - reset to default width
  const handleResizeDoubleClick = () => {
    auxiliaryBar.setWidth(300);
  };
  
  // Handle view tab click
  const handleTabClick = (viewId: string) => {
    if (viewId === auxiliaryBar.activeViewId()) {
      // Clicking active tab toggles visibility
      auxiliaryBar.toggle();
    } else {
      auxiliaryBar.setActiveView(viewId);
    }
  };
  
  // Handle close button
  const handleClose = () => {
    auxiliaryBar.setVisible(false);
  };
  
  // Handle drag over for view drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };
  
  // Handle drop for view reordering
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const viewId = e.dataTransfer?.getData("text/plain");
    if (viewId) {
      // Handle view reorder or move
      if (import.meta.env.DEV) console.log("[AuxiliaryBar] Drop view:", viewId);
    }
  };
  
  // Position styles based on sidebar position
  const positionStyles = createMemo((): JSX.CSSProperties => {
    const position = auxiliaryBar.position();
    const isRight = position === "right";
    
    return {
      [isRight ? "right" : "left"]: "0",
      [isRight ? "border-left" : "border-right"]: `1px solid ${tokens.colors.border.divider}`,
    };
  });
  
  // Container style
  const containerStyle = createMemo((): JSX.CSSProperties => ({
    display: auxiliaryBar.visible() ? "flex" : "none",
    "flex-direction": "column",
    width: `${auxiliaryBar.width()}px`,
    height: "100%",
    background: tokens.colors.surface.panel,
    "flex-shrink": "0",
    position: "relative",
    ...positionStyles(),
    ...props.style,
  }));
  
  // Resize handle position
  const resizeHandleStyle = createMemo((): JSX.CSSProperties => {
    const position = auxiliaryBar.position();
    return {
      position: "absolute",
      top: "0",
      bottom: "0",
      [position === "right" ? "left" : "right"]: "-2px",
      "z-index": "10",
    };
  });

  return (
    <Show when={auxiliaryBar.visible()}>
      <aside
        class={`auxiliary-bar ${props.class || ""}`}
        classList={{ "auxiliary-bar--resizing": isResizing() }}
        style={containerStyle()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Resize Handle */}
        <div style={resizeHandleStyle()}>
          <ResizeHandle
            direction="horizontal"
            onResize={handleResize}
            onResizeStart={() => setIsResizing(true)}
            onResizeEnd={() => setIsResizing(false)}
            onDoubleClick={handleResizeDoubleClick}
            state={getSashState()}
          />
        </div>
        
        {/* Header with Tabs */}
        <div
          class="auxiliary-bar-header"
          style={{
            display: "flex",
            "align-items": "center",
            height: tokens.sizes.layout.panelHeader,
            "min-height": tokens.sizes.layout.panelHeader,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            background: tokens.colors.surface.panel,
          }}
        >
          {/* Tabs Container */}
          <div
            class="auxiliary-bar-tabs"
            style={{
              display: "flex",
              "align-items": "center",
              flex: "1",
              "min-width": "0",
              "overflow-x": "auto",
              "scrollbar-width": "none",
            }}
          >
            <For each={auxiliaryBar.views()}>
              {(view) => (
                <ViewTab
                  view={view}
                  isActive={view.id === auxiliaryBar.activeViewId()}
                  onClick={() => handleTabClick(view.id)}
                  onClose={view.closable !== false ? () => auxiliaryBar.removeView(view.id) : undefined}
                />
              )}
            </For>
          </div>
          
          {/* Actions */}
          <div
            class="auxiliary-bar-actions"
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.xs,
              padding: `0 ${tokens.spacing.sm}`,
            }}
          >
            {/* View Menu */}
            <IconButton
              size="sm"
              tooltip="More Views"
              onClick={() => setShowViewMenu(!showViewMenu())}
            >
              <Icon name="plus" size={14} />
            </IconButton>
            
            {/* Close Button */}
            <IconButton
              size="sm"
              tooltip="Close Secondary Sidebar"
              onClick={handleClose}
            >
              <Icon name="xmark" size={14} />
            </IconButton>
          </div>
        </div>
        
        {/* Content Area */}
        <div
          class="auxiliary-bar-content"
          style={{
            flex: "1",
            "min-height": "0",
            overflow: "hidden",
          }}
        >
          <Show when={activeView()}>
            <ViewContent 
              viewId={activeView()!.viewId} 
              filePath={props.currentFilePath}
            />
          </Show>
        </div>
      </aside>
    </Show>
  );
}

// ============================================================================
// Collapse Button (for Activity Bar integration)
// ============================================================================

export interface AuxiliaryBarToggleProps {
  /** Custom class name */
  class?: string;
}

export function AuxiliaryBarToggle(props: AuxiliaryBarToggleProps) {
  const auxiliaryBar = useAuxiliaryBar();
  
  return (
    <IconButton
      class={props.class}
      size="sm"
      tooltip={auxiliaryBar.visible() ? "Hide Secondary Sidebar" : "Show Secondary Sidebar"}
      onClick={() => auxiliaryBar.toggle()}
      style={{
        color: auxiliaryBar.visible() 
          ? tokens.colors.icon.active 
          : tokens.colors.icon.inactive,
      }}
    >
      <Show
        when={auxiliaryBar.position() === "right"}
        fallback={
          auxiliaryBar.visible() 
            ? <Icon name="chevron-left" size={16} />
            : <Icon name="chevron-right" size={16} />
        }
      >
        {auxiliaryBar.visible() 
          ? <Icon name="chevron-right" size={16} />
          : <Icon name="chevron-left" size={16} />
        }
      </Show>
    </IconButton>
  );
}

// ============================================================================
// CSS (add to your global styles)
// ============================================================================

/*
.auxiliary-bar-tab:hover {
  background: var(--jb-surface-hover);
}

.auxiliary-bar-tab:hover .auxiliary-bar-tab-close {
  opacity: 0.7;
}

.auxiliary-bar-tab-close:hover {
  opacity: 1 !important;
  background: var(--jb-surface-active);
}

.auxiliary-bar-tabs::-webkit-scrollbar {
  display: none;
}
*/

export default AuxiliaryBar;
