/**
 * =============================================================================
 * STATUS BAR MANAGER
 * =============================================================================
 * 
 * A comprehensive status bar manager that provides an extension-compatible API
 * for registering, updating, and managing status bar items. This component
 * mirrors VS Code's status bar API for seamless extension integration.
 * 
 * Features:
 * - Register/unregister status bar items dynamically
 * - Support for left/right alignment with priority sorting
 * - Click handlers with command execution
 * - Rich tooltips (text and Markdown)
 * - Custom colors and background colors
 * - Accessibility support
 * - Extension API compatibility
 * 
 * Usage:
 *   const manager = useStatusBarManager();
 *   const item = manager.registerStatusBarItem({
 *     id: 'my-extension.status',
 *     name: 'My Status',
 *     text: '$(sync~spin) Syncing...',
 *     alignment: 'left',
 *     priority: 100,
 *     command: 'my-extension.sync',
 *   });
 * 
 * =============================================================================
 */

import {
  createSignal,
  createContext,
  useContext,
  createMemo,
  createEffect,
  onCleanup,
  For,
  Show,
  JSX,
  ParentProps,
} from "solid-js";

import { tokens } from "../../design-system/tokens";
import type { StatusBarItemOptions, MarkdownString, Command } from "../../types/workbench";
import { SafeHTML } from "../ui/SafeHTML";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Internal representation of a status bar item with runtime state.
 */
export interface StatusBarItem extends StatusBarItemOptions {
  /** Whether the item is currently visible */
  visible: boolean;
  /** Whether the item is currently being hovered */
  isHovered?: boolean;
  /** Dispose function to remove the item */
  dispose: () => void;
  /** Update the item's properties */
  update: (options: Partial<Omit<StatusBarItemOptions, 'id'>>) => void;
  /** Show the item */
  show: () => void;
  /** Hide the item */
  hide: () => void;
}

/**
 * Options for creating a status bar item (extends base options).
 */
export interface CreateStatusBarItemOptions extends StatusBarItemOptions {
  /** Whether the item starts visible (default: true) */
  visible?: boolean;
}

/**
 * Status bar manager state.
 */
interface StatusBarManagerState {
  /** All registered status bar items */
  items: Map<string, StatusBarItem>;
  /** Whether the status bar is visible */
  visible: boolean;
  /** Currently focused item id */
  focusedItemId: string | null;
}

/**
 * Status bar manager context value.
 */
interface StatusBarManagerContextValue {
  /** Current state */
  state: StatusBarManagerState;
  /** Register a new status bar item */
  registerStatusBarItem: (options: CreateStatusBarItemOptions) => StatusBarItem;
  /** Unregister a status bar item by id */
  unregisterStatusBarItem: (id: string) => void;
  /** Get a status bar item by id */
  getStatusBarItem: (id: string) => StatusBarItem | undefined;
  /** Get all left-aligned items sorted by priority */
  getLeftItems: () => StatusBarItem[];
  /** Get all right-aligned items sorted by priority */
  getRightItems: () => StatusBarItem[];
  /** Show the status bar */
  showStatusBar: () => void;
  /** Hide the status bar */
  hideStatusBar: () => void;
  /** Toggle status bar visibility */
  toggleStatusBar: () => void;
  /** Execute a command */
  executeCommand: (command: string | Command, ...args: unknown[]) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const StatusBarManagerContext = createContext<StatusBarManagerContextValue>();

export function useStatusBarManager() {
  const context = useContext(StatusBarManagerContext);
  if (!context) {
    throw new Error("useStatusBarManager must be used within a StatusBarManagerProvider");
  }
  return context;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse codicon syntax $(icon-name) and return icon element.
 */
function parseCodiconText(text: string): JSX.Element {
  const parts: JSX.Element[] = [];
  const regex = /\$\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the icon
    if (match.index > lastIndex) {
      parts.push(<span>{text.slice(lastIndex, match.index)}</span>);
    }

    // Parse icon name and modifiers
    const iconSpec = match[1];
    const [iconName, ...modifiers] = iconSpec.split("~");
    const isSpinning = modifiers.includes("spin");

    // Add icon
    parts.push(
      <span
        class={`codicon codicon-${iconName}`}
        style={{
          animation: isSpinning ? "spin 1s linear infinite" : undefined,
        }}
      />
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

/**
 * Check if tooltip is a MarkdownString.
 */
function isMarkdownString(tooltip: string | MarkdownString | undefined): tooltip is MarkdownString {
  return typeof tooltip === "object" && tooltip !== null && "value" in tooltip;
}

/**
 * Get background color class/style for semantic backgrounds.
 */
function getBackgroundStyle(backgroundColor?: string): JSX.CSSProperties {
  if (!backgroundColor) return {};

  switch (backgroundColor) {
    case "warning":
      return { background: tokens.colors.semantic.warning, color: "white" };
    case "error":
      return { background: tokens.colors.semantic.error, color: "white" };
    default:
      return { background: backgroundColor };
  }
}

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

interface StatusBarTooltipProps {
  tooltip: string | MarkdownString;
  visible: boolean;
  anchorRef: HTMLElement | null;
}

function StatusBarTooltip(props: StatusBarTooltipProps) {
  const [position, setPosition] = createSignal({ x: 0, y: 0 });

  createEffect(() => {
    if (props.visible && props.anchorRef) {
      const rect = props.anchorRef.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    }
  });

  const tooltipStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${position().x}px`,
    top: `${position().y}px`,
    transform: "translate(-50%, -100%)",
    "max-width": "400px",
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.divider}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
    "font-size": tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    "white-space": "pre-wrap",
    "word-wrap": "break-word",
    "z-index": tokens.zIndex.tooltip,
    "pointer-events": "none",
  });

  return (
    <Show when={props.visible}>
      <div style={tooltipStyle()} role="tooltip">
        <Show
          when={isMarkdownString(props.tooltip)}
          fallback={<span>{props.tooltip as string}</span>}
        >
          {/* Render markdown content */}
          <SafeHTML
            html={(props.tooltip as MarkdownString).value}
            style={{
              "font-family": tokens.typography.fontFamily.ui,
            }}
          />
        </Show>
      </div>
    </Show>
  );
}

// =============================================================================
// STATUS BAR ITEM COMPONENT
// =============================================================================

interface StatusBarItemComponentProps {
  item: StatusBarItem;
  onCommand: (command: string | Command, ...args: unknown[]) => void;
}

function StatusBarItemComponent(props: StatusBarItemComponentProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [showTooltip, setShowTooltip] = createSignal(false);
  let itemRef: HTMLButtonElement | undefined;
  let tooltipTimeout: ReturnType<typeof setTimeout> | undefined;

  // Show tooltip after hover delay
  createEffect(() => {
    if (isHovered() && props.item.tooltip) {
      tooltipTimeout = setTimeout(() => setShowTooltip(true), 500);
    } else {
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      setShowTooltip(false);
    }
  });

  onCleanup(() => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
  });

  const handleClick = () => {
    if (props.item.command) {
      props.onCommand(props.item.command);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const backgroundStyle = () => getBackgroundStyle(props.item.backgroundColor);

  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
    height: "22px",
    padding: `0 ${tokens.spacing.md}`,
    border: "none",
    background: isHovered()
      ? props.item.backgroundColor
        ? backgroundStyle().background
        : tokens.colors.interactive.hover
      : backgroundStyle().background || "transparent",
    color: props.item.color || backgroundStyle().color || tokens.colors.text.muted,
    "font-size": "var(--jb-text-muted-size)",
    "font-family": tokens.typography.fontFamily.ui,
    cursor: props.item.command ? "pointer" : "default",
    "white-space": "nowrap",
    transition: `background-color ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
    outline: "none",
  });

  const hoverStyle = (): JSX.CSSProperties => ({
    color: props.item.color || backgroundStyle().color || tokens.colors.text.primary,
  });

  return (
    <Show when={props.item.visible}>
      <button
        ref={itemRef}
        style={{
          ...itemStyle(),
          ...(isHovered() ? hoverStyle() : {}),
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        title={
          typeof props.item.tooltip === "string"
            ? props.item.tooltip
            : props.item.tooltip?.value
        }
        aria-label={
          props.item.accessibilityInformation?.label || props.item.name
        }
        role={(props.item.accessibilityInformation?.role || "status") as "status" | "button"}
        tabIndex={0}
      >
        {parseCodiconText(props.item.text)}
      </button>

      {/* Rich tooltip for markdown content */}
      <Show when={props.item.tooltip && isMarkdownString(props.item.tooltip)}>
        <StatusBarTooltip
          tooltip={props.item.tooltip!}
          visible={showTooltip()}
          anchorRef={itemRef || null}
        />
      </Show>
    </Show>
  );
}

// =============================================================================
// STATUS BAR MANAGER PROVIDER
// =============================================================================

export interface StatusBarManagerProviderProps extends ParentProps {
  /** Initial visibility state */
  initialVisible?: boolean;
  /** Command executor function */
  onExecuteCommand?: (command: string, args?: unknown[]) => void;
}

export function StatusBarManagerProvider(props: StatusBarManagerProviderProps) {
  const [items, setItems] = createSignal<Map<string, StatusBarItem>>(new Map());
  const [visible, setVisible] = createSignal(props.initialVisible ?? true);
  const [focusedItemId, _setFocusedItemId] = createSignal<string | null>(null);

  // Create a status bar item
  const createStatusBarItem = (options: CreateStatusBarItemOptions): StatusBarItem => {
    const item: StatusBarItem = {
      ...options,
      visible: options.visible ?? true,
      dispose: () => unregisterStatusBarItem(options.id),
      update: (updateOptions) => {
        setItems((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(options.id);
          if (existing) {
            newMap.set(options.id, { ...existing, ...updateOptions });
          }
          return newMap;
        });
      },
      show: () => {
        setItems((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(options.id);
          if (existing) {
            newMap.set(options.id, { ...existing, visible: true });
          }
          return newMap;
        });
      },
      hide: () => {
        setItems((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(options.id);
          if (existing) {
            newMap.set(options.id, { ...existing, visible: false });
          }
          return newMap;
        });
      },
    };
    return item;
  };

  // Register a new status bar item
  const registerStatusBarItem = (options: CreateStatusBarItemOptions): StatusBarItem => {
    const item = createStatusBarItem(options);
    setItems((prev) => {
      const newMap = new Map(prev);
      newMap.set(options.id, item);
      return newMap;
    });
    return item;
  };

  // Unregister a status bar item
  const unregisterStatusBarItem = (id: string) => {
    setItems((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  // Get a status bar item by id
  const getStatusBarItem = (id: string): StatusBarItem | undefined => {
    return items().get(id);
  };

  // Get left-aligned items sorted by priority (higher priority = more to the left)
  const getLeftItems = createMemo(() => {
    const leftItems = Array.from(items().values()).filter(
      (item) => item.alignment === "left"
    );
    return leftItems.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  });

  // Get right-aligned items sorted by priority (higher priority = more to the right)
  const getRightItems = createMemo(() => {
    const rightItems = Array.from(items().values()).filter(
      (item) => item.alignment === "right"
    );
    return rightItems.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  });

  // Execute a command
  const executeCommand = (command: string | Command, ...args: unknown[]) => {
    if (typeof command === "string") {
      props.onExecuteCommand?.(command, args);
      window.dispatchEvent(
        new CustomEvent("command:execute", {
          detail: { command, arguments: args },
        })
      );
    } else {
      props.onExecuteCommand?.(command.command, command.arguments);
      window.dispatchEvent(
        new CustomEvent("command:execute", {
          detail: { command: command.command, arguments: command.arguments },
        })
      );
    }
  };

  const contextValue: StatusBarManagerContextValue = {
    state: {
      get items() {
        return items();
      },
      get visible() {
        return visible();
      },
      get focusedItemId() {
        return focusedItemId();
      },
    },
    registerStatusBarItem,
    unregisterStatusBarItem,
    getStatusBarItem,
    getLeftItems: () => getLeftItems(),
    getRightItems: () => getRightItems(),
    showStatusBar: () => setVisible(true),
    hideStatusBar: () => setVisible(false),
    toggleStatusBar: () => setVisible((v) => !v),
    executeCommand,
  };

  return (
    <StatusBarManagerContext.Provider value={contextValue}>
      {props.children}
    </StatusBarManagerContext.Provider>
  );
}

// =============================================================================
// STATUS BAR RENDERER COMPONENT
// =============================================================================

export interface StatusBarRendererProps {
  /** Additional class name */
  class?: string;
  /** Additional styles */
  style?: JSX.CSSProperties;
  /** Whether to show a divider between item groups */
  showDividers?: boolean;
  /** Slot for additional left content */
  leftSlot?: JSX.Element;
  /** Slot for additional right content */
  rightSlot?: JSX.Element;
}

export function StatusBarRenderer(props: StatusBarRendererProps) {
  const manager = useStatusBarManager();

  const containerStyle = (): JSX.CSSProperties => ({
    display: manager.state.visible ? "flex" : "none",
    "align-items": "center",
    "justify-content": "space-between",
    height: "22px",
    "min-height": "22px",
    "max-height": "22px",
    color: tokens.colors.text.muted,
    "font-size": "var(--jb-text-muted-size)",
    "font-weight": "400",
    "user-select": "none",
    ...props.style,
  });

  const sectionStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
  };

  const dividerStyle: JSX.CSSProperties = {
    width: "1px",
    height: "14px",
    background: tokens.colors.border.divider,
    opacity: 0.3,
    margin: `0 ${tokens.spacing.sm}`,
  };

  return (
    <div
      class={props.class}
      style={containerStyle()}
      role="status"
      aria-label="Status bar"
    >
      {/* Left Section */}
      <div style={sectionStyle}>
        {props.leftSlot}
        <For each={manager.getLeftItems()}>
          {(item, index) => (
            <>
              <Show when={props.showDividers && index() > 0}>
                <div style={dividerStyle} />
              </Show>
              <StatusBarItemComponent
                item={item}
                onCommand={manager.executeCommand}
              />
            </>
          )}
        </For>
      </div>

      {/* Right Section */}
      <div style={sectionStyle}>
        <For each={manager.getRightItems()}>
          {(item, index) => (
            <>
              <Show when={props.showDividers && index() > 0}>
                <div style={dividerStyle} />
              </Show>
              <StatusBarItemComponent
                item={item}
                onCommand={manager.executeCommand}
              />
            </>
          )}
        </For>
        {props.rightSlot}
      </div>
    </div>
  );
}

// =============================================================================
// EXTENSION API - Compatible with VS Code extension API
// =============================================================================

/**
 * Extension-compatible API for creating status bar items.
 * This mirrors the VS Code window.createStatusBarItem API.
 */
export function createExtensionStatusBarAPI(manager: StatusBarManagerContextValue) {
  return {
    /**
     * Creates a new status bar item.
     * @param id Unique identifier for the item
     * @param alignment The alignment of the item (left or right)
     * @param priority The priority of the item (higher values are placed more to the left/right)
     */
    createStatusBarItem: (
      id: string,
      alignment: "left" | "right" = "left",
      priority?: number
    ): StatusBarItem => {
      return manager.registerStatusBarItem({
        id,
        name: id,
        text: "",
        alignment,
        priority,
        visible: false,
      });
    },

    /**
     * Register a status bar item with full options.
     */
    registerStatusBarItem: manager.registerStatusBarItem,

    /**
     * Unregister a status bar item.
     */
    unregisterStatusBarItem: manager.unregisterStatusBarItem,

    /**
     * Get a status bar item by id.
     */
    getStatusBarItem: manager.getStatusBarItem,
  };
}

// =============================================================================
// HOOK FOR EASY STATUS BAR ITEM CREATION
// =============================================================================

/**
 * Hook to create and manage a status bar item with automatic cleanup.
 */
export function useStatusBarItem(options: CreateStatusBarItemOptions): StatusBarItem {
  const manager = useStatusBarManager();
  const item = manager.registerStatusBarItem(options);

  onCleanup(() => {
    item.dispose();
  });

  return item;
}

// =============================================================================
// EXPORTS
// =============================================================================

// Note: StatusBarItem and CreateStatusBarItemOptions are already exported at their definitions
export type {
  StatusBarManagerState,
  StatusBarManagerContextValue,
};

export {
  StatusBarManagerContext,
  parseCodiconText,
  isMarkdownString,
  getBackgroundStyle,
};

export default StatusBarManagerProvider;
