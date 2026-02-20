/**
 * =============================================================================
 * VIEW CONTAINER MANAGER - VS Code-style View Container Management
 * =============================================================================
 * 
 * A comprehensive view container management system for Orion Desktop, implementing
 * VS Code's sidebar view architecture with modern interactions.
 * 
 * Features:
 * - Render view containers and their nested views
 * - Drag & drop for view reordering within/between containers
 * - Collapse/expand views with smooth animations
 * - Context menus (move to sidebar, hide, reset layout)
 * - Integration with ActivityBar for container switching
 * - Support for extension-contributed views
 * - Persistence of view state (collapsed, order, visibility)
 * 
 * @module components/workbench/ViewContainerManager
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  For,
  Show,
  JSX,
  ParentProps,
  batch,
  Accessor,
} from "solid-js";
import { Portal } from "solid-js/web";
import { createStore, produce } from "solid-js/store";
import { tokens } from "@/design-system/tokens";
import { useActivityBar } from "@/context/ActivityBarContext";

// =============================================================================
// Types & Interfaces
// =============================================================================

/** View container identifier - maps to VS Code's view container IDs */
export type ViewContainerId =
  | "workbench.view.explorer"
  | "workbench.view.search"
  | "workbench.view.scm"
  | "workbench.view.debug"
  | "workbench.view.extensions"
  | "workbench.view.agents"
  | "workbench.view.testing"
  | "workbench.view.remote"
  | string;

/** View location in the workbench */
export type ViewLocation = "sidebar" | "panel" | "auxiliaryBar";

/** Individual view within a container */
export interface View {
  id: string;
  name: string;
  icon?: string;
  order: number;
  visible: boolean;
  collapsed: boolean;
  canToggleVisibility: boolean;
  /** Extension that contributed this view */
  extensionId?: string;
  /** When condition for visibility */
  when?: string;
  /** Custom render component */
  component?: () => JSX.Element;
  /** Context value for the view */
  contextValue?: string;
  /** Initial size weight */
  weight?: number;
}

/** View container holding multiple views */
export interface ViewContainer {
  id: ViewContainerId;
  title: string;
  icon: string;
  order: number;
  views: View[];
  location: ViewLocation;
  /** Whether container can be hidden */
  canHide: boolean;
  /** Extension that contributed this container */
  extensionId?: string;
}

/** Drag data for view drag & drop */
export interface ViewDragData {
  viewId: string;
  sourceContainerId: ViewContainerId;
  sourceIndex: number;
}

/** Context menu item */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  action?: () => void;
}

/** View container manager state */
export interface ViewContainerManagerState {
  containers: ViewContainer[];
  activeContainerId: ViewContainerId | null;
  collapsedViews: Set<string>;
  hiddenViews: Set<string>;
  viewOrder: Record<ViewContainerId, string[]>;
  dragState: {
    isDragging: boolean;
    dragData: ViewDragData | null;
    dropTarget: { containerId: ViewContainerId; index: number } | null;
  };
}

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEY_COLLAPSED = "viewcontainer_collapsed";
const STORAGE_KEY_HIDDEN = "viewcontainer_hidden";
const STORAGE_KEY_ORDER = "viewcontainer_order";

// =============================================================================
// Default View Containers
// =============================================================================

const DEFAULT_CONTAINERS: ViewContainer[] = [
  {
    id: "workbench.view.explorer",
    title: "Explorer",
    icon: "files",
    order: 0,
    location: "sidebar",
    canHide: false,
    views: [
      { id: "explorer.openEditors", name: "Open Editors", order: 0, visible: true, collapsed: true, canToggleVisibility: true },
      { id: "explorer.folders", name: "Folders", order: 1, visible: true, collapsed: false, canToggleVisibility: false },
      { id: "explorer.outline", name: "Outline", order: 2, visible: true, collapsed: true, canToggleVisibility: true },
      { id: "explorer.timeline", name: "Timeline", order: 3, visible: true, collapsed: true, canToggleVisibility: true },
    ],
  },
  {
    id: "workbench.view.search",
    title: "Search",
    icon: "search",
    order: 1,
    location: "sidebar",
    canHide: false,
    views: [
      { id: "search.results", name: "Search Results", order: 0, visible: true, collapsed: false, canToggleVisibility: false },
    ],
  },
  {
    id: "workbench.view.scm",
    title: "Source Control",
    icon: "source-control",
    order: 2,
    location: "sidebar",
    canHide: false,
    views: [
      { id: "scm.repositories", name: "Source Control Repositories", order: 0, visible: true, collapsed: true, canToggleVisibility: true },
      { id: "scm.changes", name: "Changes", order: 1, visible: true, collapsed: false, canToggleVisibility: false },
    ],
  },
  {
    id: "workbench.view.debug",
    title: "Run and Debug",
    icon: "debug-alt",
    order: 3,
    location: "sidebar",
    canHide: false,
    views: [
      { id: "debug.variables", name: "Variables", order: 0, visible: true, collapsed: false, canToggleVisibility: true },
      { id: "debug.watch", name: "Watch", order: 1, visible: true, collapsed: true, canToggleVisibility: true },
      { id: "debug.callStack", name: "Call Stack", order: 2, visible: true, collapsed: true, canToggleVisibility: true },
      { id: "debug.breakpoints", name: "Breakpoints", order: 3, visible: true, collapsed: true, canToggleVisibility: true },
    ],
  },
  {
    id: "workbench.view.extensions",
    title: "Extensions",
    icon: "extensions",
    order: 4,
    location: "sidebar",
    canHide: false,
    views: [
      { id: "extensions.installed", name: "Installed", order: 0, visible: true, collapsed: false, canToggleVisibility: false },
      { id: "extensions.recommended", name: "Recommended", order: 1, visible: true, collapsed: true, canToggleVisibility: true },
    ],
  },
  {
    id: "workbench.view.agents",
    title: "AI Agents",
    icon: "robot",
    order: 5,
    location: "sidebar",
    canHide: false,
    views: [
      { id: "agents.chat", name: "Chat", order: 0, visible: true, collapsed: false, canToggleVisibility: false },
      { id: "agents.history", name: "History", order: 1, visible: true, collapsed: true, canToggleVisibility: true },
      { id: "agents.tools", name: "Tools", order: 2, visible: true, collapsed: true, canToggleVisibility: true },
    ],
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function loadPersistedState(): {
  collapsed: string[];
  hidden: string[];
  order: Record<string, string[]>;
} {
  try {
    const collapsed = JSON.parse(localStorage.getItem(STORAGE_KEY_COLLAPSED) || "[]");
    const hidden = JSON.parse(localStorage.getItem(STORAGE_KEY_HIDDEN) || "[]");
    const order = JSON.parse(localStorage.getItem(STORAGE_KEY_ORDER) || "{}");
    return { collapsed, hidden, order };
  } catch {
    return { collapsed: [], hidden: [], order: {} };
  }
}

function savePersistedState(
  collapsed: string[],
  hidden: string[],
  order: Record<string, string[]>
): void {
  try {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(collapsed));
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(hidden));
    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order));
  } catch (e) {
    console.error("[ViewContainerManager] Failed to save state:", e);
  }
}

// =============================================================================
// Icons Component
// =============================================================================

const iconPaths: Record<string, string> = {
  "chevron-down": "M7.976 10.072l4.357-4.357.618.62L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z",
  "chevron-right": "M5.928 14.072L12 8 5.928 1.928l-.856.856L10.288 8l-5.216 5.216.856.856z",
  "ellipsis": "M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z",
  "eye": "M8 5.5A6.5 6.5 0 0 0 1.5 8a6.5 6.5 0 0 0 13 0A6.5 6.5 0 0 0 8 5.5zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
  "eye-closed": "M1.48 1.48l13.04 13.04-.96.96-2.42-2.42A6.47 6.47 0 0 1 8 14.5 6.5 6.5 0 0 1 1.5 8c0-1.3.38-2.5 1.03-3.52L.52 2.44l.96-.96zM8 5.5c.4 0 .77.07 1.12.2L4.7 10.12A3.5 3.5 0 0 1 8 5.5zM14.5 8c0 1.3-.38 2.5-1.03 3.52l-2.05-2.05c.13-.35.2-.72.2-1.12a3.5 3.5 0 0 0-3.5-3.5c-.4 0-.77.07-1.12.2L4.95 3.0A6.47 6.47 0 0 1 8 1.5 6.5 6.5 0 0 1 14.5 8z",
  "move": "M8 1l3 3H9v3h3V5l3 3-3 3V9H9v3h2l-3 3-3-3h2V9H4v2l-3-3 3-3v2h3V4H5l3-3z",
  "refresh": "M13.451 5.609l-.579-.939-1.068.812-.076.094c-.335.415-.927 1.341-.927 2.424 0 2.206-1.794 4-4 4-1.098 0-2.093-.445-2.813-1.164l1.227-1.227-3.75-.625.625 3.75 1.258-1.258A5.971 5.971 0 0 0 7.8 13c3.309 0 6-2.691 6-6 0-1.258-.33-2.077-.349-2.391zM2.549 9.391l.579.939 1.068-.812.076-.094c.335-.415.927-1.341.927-2.424 0-2.206 1.794-4 4-4 1.098 0 2.093.445 2.813 1.164l-1.227 1.227 3.75.625-.625-3.75-1.258 1.258A5.971 5.971 0 0 0 8.2 2c-3.309 0-6 2.691-6 6 0 1.258.33 2.077.349 2.391z",
  "gripper": "M5 3h2v2H5zm4 0h2v2H9zM5 7h2v2H5zm4 0h2v2H9zM5 11h2v2H5zm4 0h2v2H9z",
  "close": "M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z",
  "add": "M8 1v6H2v2h6v6h2V9h6V7H10V1H8z",
  "check": "M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z",
};

interface IconProps {
  name: string;
  size?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

function Icon(props: IconProps) {
  const size = () => props.size || 16;
  const path = () => iconPaths[props.name] || "";

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      fill="currentColor"
      class={props.class}
      style={props.style}
    >
      <path d={path()} />
    </svg>
  );
}

// =============================================================================
// Context Menu Component
// =============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

function ContextMenu(props: ContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;
  const [_submenuOpen, setSubmenuOpen] = createSignal<string | null>(null);

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Adjust position to stay on screen
  const position = createMemo(() => {
    const menuWidth = 200;
    const menuHeight = props.items.length * 28;
    let x = props.x;
    let y = props.y;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }

    return { x: Math.max(8, x), y: Math.max(8, y) };
  });

  const menuStyle: JSX.CSSProperties = {
    position: "fixed",
    left: `${position().x}px`,
    top: `${position().y}px`,
    "z-index": String(tokens.zIndex.dropdown),
    "min-width": "180px",
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
    padding: `${tokens.spacing.xs} 0`,
    overflow: "hidden",
  };

  const itemStyle = (disabled?: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    width: "100%",
    padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
    border: "none",
    background: "transparent",
    color: disabled ? tokens.colors.text.disabled : tokens.colors.text.primary,
    "font-size": tokens.typography.fontSize.base,
    "font-family": tokens.typography.fontFamily.ui,
    "text-align": "left",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? "0.5" : "1",
  });

  const separatorStyle: JSX.CSSProperties = {
    height: "1px",
    background: tokens.colors.border.divider,
    margin: `${tokens.spacing.sm} ${tokens.spacing.md}`,
  };

  return (
    <Portal>
      <div
        ref={menuRef}
        class="view-container-context-menu"
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <For each={props.items}>
          {(item) => (
            <Show
              when={!item.separator}
              fallback={<div style={separatorStyle} />}
            >
              <button
                style={itemStyle(item.disabled)}
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled && item.action) {
                    item.action();
                    props.onClose();
                  }
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.background = tokens.colors.interactive.hover;
                  }
                  if (item.submenu) {
                    setSubmenuOpen(item.id);
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Show when={item.icon}>
                  <Icon name={item.icon!} size={14} />
                </Show>
                <span style={{ flex: "1" }}>{item.label}</span>
                <Show when={item.checked}>
                  <Icon name="check" size={14} style={{ color: tokens.colors.semantic.primary }} />
                </Show>
                <Show when={item.submenu}>
                  <Icon name="chevron-right" size={12} />
                </Show>
              </button>
            </Show>
          )}
        </For>
      </div>
    </Portal>
  );
}

// =============================================================================
// View Header Component
// =============================================================================

interface ViewHeaderProps {
  view: View;
  containerId: ViewContainerId;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onMoveToPanel?: () => void;
  onMoveToAuxiliary?: () => void;
  onHideView?: () => void;
}

function ViewHeader(props: ViewHeaderProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [actionsMenuState, setActionsMenuState] = createSignal<{
    viewId: string;
    position: { x: number; y: number };
  } | null>(null);

  const showViewActionsMenu = (viewId: string, position: { x: number; y: number }) => {
    setActionsMenuState({ viewId, position });
  };

  const hideViewActionsMenu = () => {
    setActionsMenuState(null);
  };

  const getViewActionsMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    // Collapse/Expand option
    items.push({
      id: "collapse",
      label: props.isCollapsed ? "Expand View" : "Collapse View",
      icon: props.isCollapsed ? "chevron-down" : "chevron-right",
      action: () => {
        props.onToggleCollapse();
        hideViewActionsMenu();
      },
    });

    items.push({ id: "sep1", label: "", separator: true });

    // Move options
    items.push({
      id: "moveToPanel",
      label: "Move to Panel",
      icon: "move",
      action: () => {
        props.onMoveToPanel?.();
        hideViewActionsMenu();
      },
    });

    items.push({
      id: "moveToAuxiliary",
      label: "Move to Secondary Side Bar",
      icon: "move",
      action: () => {
        props.onMoveToAuxiliary?.();
        hideViewActionsMenu();
      },
    });

    // Hide option (only if view can be hidden)
    if (props.view.canToggleVisibility) {
      items.push({ id: "sep2", label: "", separator: true });
      items.push({
        id: "hideView",
        label: "Hide View",
        icon: "eye-closed",
        action: () => {
          props.onHideView?.();
          hideViewActionsMenu();
        },
      });
    }

    return items;
  };

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    height: "22px",
    padding: `0 ${tokens.spacing.sm}`,
    background: isHovered() ? tokens.colors.interactive.hover : "transparent",
    cursor: "pointer",
    "user-select": "none",
    opacity: props.isDragging ? "0.5" : "1",
    transition: `background ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
  });

  const chevronStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "16px",
    height: "16px",
    color: tokens.colors.icon.default,
    transition: `transform ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
    transform: props.isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
  });

  const titleStyle: JSX.CSSProperties = {
    flex: "1",
    "margin-left": tokens.spacing.xs,
    "font-size": tokens.typography.fontSize.sm,
    "font-weight": tokens.typography.fontWeight.semibold,
    "text-transform": "uppercase",
    "letter-spacing": "0.05em",
    color: tokens.colors.text.muted,
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const actionsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
    opacity: isHovered() ? "1" : "0",
    transition: `opacity ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
  });

  const actionButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "18px",
    height: "18px",
    border: "none",
    background: "transparent",
    color: tokens.colors.icon.default,
    "border-radius": tokens.radius.sm,
    cursor: "pointer",
  };

  return (
    <div
      class="view-header"
      style={headerStyle()}
      draggable={true}
      onClick={props.onToggleCollapse}
      onContextMenu={props.onContextMenu}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={chevronStyle()}>
        <Icon name="chevron-down" size={16} />
      </div>
      <span style={titleStyle}>{props.view.name}</span>
      <div style={actionsStyle()}>
        <button
          style={actionButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            // Show context menu with view actions
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            showViewActionsMenu(props.view.id, { x: rect.left, y: rect.bottom });
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          title="View Actions"
          aria-label="View Actions"
        >
          <Icon name="ellipsis" size={14} />
        </button>
      </div>

      {/* View Actions Context Menu */}
      <Show when={actionsMenuState()}>
        {(menuState) => (
          <ContextMenu
            x={menuState().position.x}
            y={menuState().position.y}
            items={getViewActionsMenuItems()}
            onClose={hideViewActionsMenu}
          />
        )}
      </Show>
    </div>
  );
}

// =============================================================================
// View Content Component
// =============================================================================

interface ViewContentProps {
  view: View;
  isCollapsed: boolean;
}

function ViewContent(props: ViewContentProps) {
  const contentStyle = (): JSX.CSSProperties => ({
    overflow: "hidden",
    "max-height": props.isCollapsed ? "0px" : "1000px",
    opacity: props.isCollapsed ? "0" : "1",
    transition: `max-height ${tokens.motion.duration.normal} ${tokens.motion.easing.easeInOut}, opacity ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
  });

  const innerStyle: JSX.CSSProperties = {
    padding: tokens.spacing.sm,
    "min-height": "60px",
  };

  const emptyStateStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "min-height": "60px",
    color: tokens.colors.text.muted,
    "font-size": tokens.typography.fontSize.sm,
  };

  return (
    <div class="view-content" style={contentStyle()}>
      <div style={innerStyle}>
        <Show
          when={props.view.component}
          fallback={
            <div style={emptyStateStyle}>
              No content
            </div>
          }
        >
          {props.view.component!()}
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// View Component (combines header + content)
// =============================================================================

interface ViewComponentProps {
  view: View;
  containerId: ViewContainerId;
  index: number;
  isCollapsed: boolean;
  onToggleCollapse: (viewId: string) => void;
  onContextMenu: (e: MouseEvent, view: View) => void;
  onDragStart: (e: DragEvent, view: View, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent, index: number) => void;
  onDrop: (e: DragEvent, index: number) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onMoveToPanel?: (viewId: string) => void;
  onMoveToAuxiliary?: (viewId: string) => void;
  onHideView?: (viewId: string) => void;
}

function ViewComponent(props: ViewComponentProps) {
  const containerStyle = (): JSX.CSSProperties => ({
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    background: props.isDropTarget ? `${tokens.colors.semantic.primary}10` : "transparent",
    transition: `background ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
  });

  const dropIndicatorStyle: JSX.CSSProperties = {
    height: "2px",
    background: tokens.colors.semantic.primary,
    margin: `0 ${tokens.spacing.sm}`,
  };

  return (
    <div
      class="view-component"
      style={containerStyle()}
      onDragOver={(e) => {
        e.preventDefault();
        props.onDragOver(e, props.index);
      }}
      onDrop={(e) => props.onDrop(e, props.index)}
    >
      <Show when={props.isDropTarget}>
        <div style={dropIndicatorStyle} />
      </Show>
      <ViewHeader
        view={props.view}
        containerId={props.containerId}
        isCollapsed={props.isCollapsed}
        onToggleCollapse={() => props.onToggleCollapse(props.view.id)}
        onContextMenu={(e) => props.onContextMenu(e, props.view)}
        onDragStart={(e) => props.onDragStart(e, props.view, props.index)}
        onDragEnd={props.onDragEnd}
        isDragging={props.isDragging}
        onMoveToPanel={() => props.onMoveToPanel?.(props.view.id)}
        onMoveToAuxiliary={() => props.onMoveToAuxiliary?.(props.view.id)}
        onHideView={() => props.onHideView?.(props.view.id)}
      />
      <ViewContent view={props.view} isCollapsed={props.isCollapsed} />
    </div>
  );
}

// =============================================================================
// View Container Component
// =============================================================================

interface ViewContainerComponentProps {
  container: ViewContainer;
  collapsedViews: Set<string>;
  hiddenViews: Set<string>;
  onToggleCollapse: (viewId: string) => void;
  onToggleVisibility: (viewId: string) => void;
  onMoveView: (viewId: string, targetLocation: ViewLocation) => void;
  onReorderViews: (containerId: ViewContainerId, fromIndex: number, toIndex: number) => void;
  onResetLayout: () => void;
  dragState: ViewContainerManagerState["dragState"];
  onDragStart: (containerId: ViewContainerId, viewId: string, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (containerId: ViewContainerId, index: number) => void;
  onDrop: (containerId: ViewContainerId, index: number) => void;
}

function ViewContainerComponent(props: ViewContainerComponentProps) {
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    view: View | null;
  } | null>(null);

  const visibleViews = createMemo(() =>
    props.container.views.filter((v) => !props.hiddenViews.has(v.id))
  );

  const handleContextMenu = (e: MouseEvent, view: View | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, view });
  };

  const getContextMenuItems = (view: View | null): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (view) {
      // View-specific actions
      items.push({
        id: "collapse",
        label: props.collapsedViews.has(view.id) ? "Expand" : "Collapse",
        icon: props.collapsedViews.has(view.id) ? "chevron-down" : "chevron-right",
        action: () => props.onToggleCollapse(view.id),
      });

      if (view.canToggleVisibility) {
        items.push({
          id: "hide",
          label: "Hide",
          icon: "eye-closed",
          action: () => props.onToggleVisibility(view.id),
        });
      }

      items.push({ id: "sep1", label: "", separator: true });

      items.push({
        id: "moveToPanel",
        label: "Move to Panel",
        icon: "move",
        action: () => props.onMoveView(view.id, "panel"),
      });

      items.push({
        id: "moveToAuxiliary",
        label: "Move to Secondary Side Bar",
        icon: "move",
        action: () => props.onMoveView(view.id, "auxiliaryBar"),
      });
    }

    items.push({ id: "sep2", label: "", separator: true });

    // Hidden views
    const hiddenViewsList = props.container.views.filter((v) =>
      props.hiddenViews.has(v.id)
    );
    if (hiddenViewsList.length > 0) {
      hiddenViewsList.forEach((v) => {
        items.push({
          id: `show-${v.id}`,
          label: `Show ${v.name}`,
          icon: "eye",
          action: () => props.onToggleVisibility(v.id),
        });
      });
      items.push({ id: "sep3", label: "", separator: true });
    }

    items.push({
      id: "reset",
      label: "Reset Layout",
      icon: "refresh",
      action: props.onResetLayout,
    });

    return items;
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    overflow: "hidden",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    height: "35px",
    padding: `0 ${tokens.spacing.md}`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    "user-select": "none",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": tokens.typography.fontSize.sm,
    "font-weight": tokens.typography.fontWeight.semibold,
    "text-transform": "uppercase",
    "letter-spacing": "0.05em",
    color: tokens.colors.text.muted,
  };

  const viewsContainerStyle: JSX.CSSProperties = {
    flex: "1",
    "overflow-y": "auto",
    "overflow-x": "hidden",
  };

  return (
    <div
      class="view-container"
      style={containerStyle}
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* Container Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>{props.container.title}</span>
      </div>

      {/* Views */}
      <div style={viewsContainerStyle}>
        <For each={visibleViews()}>
          {(view, index) => (
            <ViewComponent
              view={view}
              containerId={props.container.id}
              index={index()}
              isCollapsed={props.collapsedViews.has(view.id)}
              onToggleCollapse={props.onToggleCollapse}
              onContextMenu={handleContextMenu}
              onDragStart={(_e, v, i) => props.onDragStart(props.container.id, v.id, i)}
              onDragEnd={props.onDragEnd}
              onDragOver={(_e, i) => props.onDragOver(props.container.id, i)}
              onDrop={(_e, i) => props.onDrop(props.container.id, i)}
              isDragging={
                props.dragState.isDragging &&
                props.dragState.dragData?.viewId === view.id
              }
              isDropTarget={
                props.dragState.isDragging &&
                props.dragState.dropTarget?.containerId === props.container.id &&
                props.dragState.dropTarget?.index === index()
              }
              onMoveToPanel={(viewId) => props.onMoveView(viewId, "panel")}
              onMoveToAuxiliary={(viewId) => props.onMoveView(viewId, "auxiliaryBar")}
              onHideView={(viewId) => props.onToggleVisibility(viewId)}
            />
          )}
        </For>
      </div>

      {/* Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <ContextMenu
            x={menu().x}
            y={menu().y}
            items={getContextMenuItems(menu().view)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Show>
    </div>
  );
}

// =============================================================================
// Main ViewContainerManager Component
// =============================================================================

export interface ViewContainerManagerProps {
  /** Initial active container ID */
  activeContainerId?: ViewContainerId;
  /** Location filter (only show containers for this location) */
  location?: ViewLocation;
  /** Callback when active container changes */
  onActiveContainerChange?: (containerId: ViewContainerId) => void;
  /** Callback when a view is moved */
  onViewMove?: (viewId: string, fromContainer: ViewContainerId, toLocation: ViewLocation) => void;
  /** Custom render function for view content */
  renderViewContent?: (view: View, container: ViewContainer) => JSX.Element;
  /** Additional containers from extensions */
  extensionContainers?: ViewContainer[];
  /** Custom class name */
  class?: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function ViewContainerManager(props: ViewContainerManagerProps) {
  // Try to get activity bar context
  let activityBar: ReturnType<typeof useActivityBar> | null = null;
  try {
    activityBar = useActivityBar();
  } catch {
    // Activity bar context not available
  }

  // State
  const [containers, setContainers] = createStore<ViewContainer[]>([...DEFAULT_CONTAINERS]);
  const [collapsedViews, setCollapsedViews] = createSignal<Set<string>>(new Set());
  const [hiddenViews, setHiddenViews] = createSignal<Set<string>>(new Set());
  const [activeContainerId, setActiveContainerId] = createSignal<ViewContainerId | null>(
    props.activeContainerId || "workbench.view.explorer"
  );
  const [dragState, setDragState] = createStore<ViewContainerManagerState["dragState"]>({
    isDragging: false,
    dragData: null,
    dropTarget: null,
  });

  // Load persisted state
  onMount(() => {
    const { collapsed, hidden } = loadPersistedState();
    setCollapsedViews(new Set(collapsed));
    setHiddenViews(new Set(hidden));

    // Merge extension containers
    if (props.extensionContainers) {
      setContainers(produce((c) => {
        props.extensionContainers!.forEach((ext) => {
          const existing = c.find((x) => x.id === ext.id);
          if (!existing) {
            c.push(ext);
          }
        });
      }));
    }
  });

  // Persist state changes
  createEffect(() => {
    const collapsed = Array.from(collapsedViews());
    const hidden = Array.from(hiddenViews());
    savePersistedState(collapsed, hidden, {});
  });

  // Sync with activity bar
  createEffect(() => {
    if (activityBar) {
      const activeView = activityBar.activeViewId();
      if (activeView) {
        // Map activity bar view ID to container ID
        const containerMap: Record<string, ViewContainerId> = {
          explorer: "workbench.view.explorer",
          search: "workbench.view.search",
          scm: "workbench.view.scm",
          debug: "workbench.view.debug",
          extensions: "workbench.view.extensions",
          agents: "workbench.view.agents",
          testing: "workbench.view.testing",
          remote: "workbench.view.remote",
        };
        const containerId = containerMap[activeView];
        if (containerId) {
          setActiveContainerId(containerId);
        }
      }
    }
  });

  // Sync props.activeContainerId
  createEffect(() => {
    if (props.activeContainerId) {
      setActiveContainerId(props.activeContainerId);
    }
  });

  // Filtered containers by location - kept for potential future use
  const _filteredContainers = createMemo(() => {
    if (!props.location) return containers;
    return containers.filter((c) => c.location === props.location);
  });
  void _filteredContainers;

  // Active container
  const activeContainer = createMemo(() =>
    containers.find((c) => c.id === activeContainerId())
  );

  // Actions
  const toggleCollapse = (viewId: string) => {
    setCollapsedViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  const toggleVisibility = (viewId: string) => {
    setHiddenViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  const moveView = (viewId: string, toLocation: ViewLocation) => {
    // Find source container
    let sourceContainer: ViewContainer | undefined;
    let view: View | undefined;

    for (const container of containers) {
      const v = container.views.find((x) => x.id === viewId);
      if (v) {
        sourceContainer = container;
        view = v;
        break;
      }
    }

    if (sourceContainer && view) {
      props.onViewMove?.(viewId, sourceContainer.id, toLocation);

      // Dispatch event for other components to handle
      window.dispatchEvent(
        new CustomEvent("viewcontainer:view-moved", {
          detail: { viewId, fromContainer: sourceContainer.id, toLocation },
        })
      );
    }
  };

  const reorderViews = (containerId: ViewContainerId, fromIndex: number, toIndex: number) => {
    setContainers(
      produce((c) => {
        const container = c.find((x) => x.id === containerId);
        if (container) {
          const [moved] = container.views.splice(fromIndex, 1);
          container.views.splice(toIndex, 0, moved);
          // Update order values
          container.views.forEach((v, i) => {
            v.order = i;
          });
        }
      })
    );
  };

  const resetLayout = () => {
    batch(() => {
      setCollapsedViews(new Set<string>());
      setHiddenViews(new Set<string>());
      setContainers([...DEFAULT_CONTAINERS]);
    });
  };

  // Drag & Drop handlers
  const handleDragStart = (containerId: ViewContainerId, viewId: string, index: number) => {
    setDragState({
      isDragging: true,
      dragData: { viewId, sourceContainerId: containerId, sourceIndex: index },
      dropTarget: null,
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      dragData: null,
      dropTarget: null,
    });
  };

  const handleDragOver = (containerId: ViewContainerId, index: number) => {
    if (dragState.isDragging) {
      setDragState("dropTarget", { containerId, index });
    }
  };

  const handleDrop = (containerId: ViewContainerId, index: number) => {
    if (dragState.isDragging && dragState.dragData) {
      const { sourceContainerId, sourceIndex } = dragState.dragData;

      if (sourceContainerId === containerId) {
        // Reorder within same container
        reorderViews(containerId, sourceIndex, index);
      } else {
        // Move between containers (handled by moveView)
        // This would require more complex logic for cross-container moves
      }
    }
    handleDragEnd();
  };

  // Listen for external events
  onMount(() => {
    const handleFocusView = (e: CustomEvent<{ viewId: string }>) => {
      const viewId = e.detail?.viewId;
      if (viewId) {
        // Find container containing this view
        for (const container of containers) {
          const view = container.views.find((v) => v.id === viewId);
          if (view) {
            setActiveContainerId(container.id);
            // Expand if collapsed
            if (collapsedViews().has(viewId)) {
              toggleCollapse(viewId);
            }
            break;
          }
        }
      }
    };

    window.addEventListener("viewcontainer:focus-view", handleFocusView as EventListener);

    onCleanup(() => {
      window.removeEventListener("viewcontainer:focus-view", handleFocusView as EventListener);
    });
  });

  // Styles
  const managerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: tokens.colors.surface.panel,
    overflow: "hidden",
    ...props.style,
  });

  return (
    <div class={`view-container-manager ${props.class || ""}`} style={managerStyle()}>
      <Show when={activeContainer()}>
        {(container) => (
          <ViewContainerComponent
            container={container()}
            collapsedViews={collapsedViews()}
            hiddenViews={hiddenViews()}
            onToggleCollapse={toggleCollapse}
            onToggleVisibility={toggleVisibility}
            onMoveView={moveView}
            onReorderViews={reorderViews}
            onResetLayout={resetLayout}
            dragState={dragState}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        )}
      </Show>
    </div>
  );
}

// =============================================================================
// Context & Hooks
// =============================================================================

import { createContext, useContext } from "solid-js";

export interface ViewContainerContextValue {
  containers: Accessor<ViewContainer[]>;
  activeContainerId: Accessor<ViewContainerId | null>;
  collapsedViews: Accessor<Set<string>>;
  hiddenViews: Accessor<Set<string>>;
  
  setActiveContainer: (id: ViewContainerId) => void;
  toggleCollapse: (viewId: string) => void;
  toggleVisibility: (viewId: string) => void;
  moveView: (viewId: string, toLocation: ViewLocation) => void;
  registerView: (containerId: ViewContainerId, view: View) => void;
  unregisterView: (viewId: string) => void;
  resetLayout: () => void;
}

const ViewContainerContext = createContext<ViewContainerContextValue>();

export function ViewContainerProvider(props: ParentProps) {
  const [containers, setContainers] = createStore<ViewContainer[]>([...DEFAULT_CONTAINERS]);
  const [collapsedViews, setCollapsedViews] = createSignal<Set<string>>(new Set());
  const [hiddenViews, setHiddenViews] = createSignal<Set<string>>(new Set());
  const [activeContainerId, setActiveContainerId] = createSignal<ViewContainerId | null>(
    "workbench.view.explorer"
  );

  // Load persisted state
  onMount(() => {
    const { collapsed, hidden } = loadPersistedState();
    setCollapsedViews(new Set(collapsed));
    setHiddenViews(new Set(hidden));
  });

  // Persist state
  createEffect(() => {
    const collapsed = Array.from(collapsedViews());
    const hidden = Array.from(hiddenViews());
    savePersistedState(collapsed, hidden, {});
  });

  const toggleCollapse = (viewId: string) => {
    setCollapsedViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  const toggleVisibility = (viewId: string) => {
    setHiddenViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  const moveView = (viewId: string, toLocation: ViewLocation) => {
    window.dispatchEvent(
      new CustomEvent("viewcontainer:view-moved", {
        detail: { viewId, toLocation },
      })
    );
  };

  const registerView = (containerId: ViewContainerId, view: View) => {
    setContainers(
      produce((c) => {
        const container = c.find((x) => x.id === containerId);
        if (container) {
          const existing = container.views.find((v) => v.id === view.id);
          if (!existing) {
            container.views.push(view);
            container.views.sort((a, b) => a.order - b.order);
          }
        }
      })
    );
  };

  const unregisterView = (viewId: string) => {
    setContainers(
      produce((c) => {
        for (const container of c) {
          const index = container.views.findIndex((v) => v.id === viewId);
          if (index !== -1) {
            container.views.splice(index, 1);
            break;
          }
        }
      })
    );
  };

  const resetLayout = () => {
    batch(() => {
      setCollapsedViews(new Set<string>());
      setHiddenViews(new Set<string>());
      setContainers([...DEFAULT_CONTAINERS]);
    });
  };

  const value: ViewContainerContextValue = {
    containers: () => containers,
    activeContainerId,
    collapsedViews,
    hiddenViews,
    setActiveContainer: setActiveContainerId,
    toggleCollapse,
    toggleVisibility,
    moveView,
    registerView,
    unregisterView,
    resetLayout,
  };

  return (
    <ViewContainerContext.Provider value={value}>
      {props.children}
    </ViewContainerContext.Provider>
  );
}

export function useViewContainers(): ViewContainerContextValue {
  const context = useContext(ViewContainerContext);
  if (!context) {
    throw new Error("useViewContainers must be used within a ViewContainerProvider");
  }
  return context;
}

export function useViewContainersOptional(): ViewContainerContextValue | undefined {
  return useContext(ViewContainerContext);
}

// =============================================================================
// Exports
// =============================================================================

export { DEFAULT_CONTAINERS };
export default ViewContainerManager;
