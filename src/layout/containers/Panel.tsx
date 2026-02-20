/**
 * =============================================================================
 * PANEL - Base panel container for IDE layout
 * =============================================================================
 * 
 * Panel is the foundational container for all dockable, resizable content areas.
 * It integrates with the LayoutStore for state management and provides:
 * - Collapse/expand functionality
 * - Resize handles
 * - Container query support
 * - Header with title and actions
 * 
 * Usage:
 *   <Panel
 *     id="explorer"
 *     title="Explorer"
 *     icon={<FolderIcon />}
 *     position="left"
 *     defaultWidth={280}
 *     collapsible
 *   >
 *     <FileExplorer />
 *   </Panel>
 * =============================================================================
 */

import { 
  createSignal, 
  createEffect, 
  onMount,
  ParentProps, 
  Show, 
  JSX,
  createMemo,
} from "solid-js";
import { tokens } from "../../design-system/tokens";
import { Box } from "../../design-system/primitives/Box";
import { Flex, HStack } from "../../design-system/primitives/Flex";
import { useResize, getResizeHandleStyle } from "../hooks/useResize";
import { useContainerQuery } from "../hooks/useContainerQuery";
import { layoutActions, layoutSelectors } from "../engine/LayoutStore";

// =============================================================================
// TYPES
// =============================================================================

export type PanelPosition = "left" | "right" | "bottom" | "floating";

export interface PanelProps extends ParentProps {
  id: string;
  title?: string;
  icon?: JSX.Element;
  
  // Position & sizing
  position?: PanelPosition;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  
  // Features
  collapsible?: boolean;
  resizable?: boolean;
  showHeader?: boolean;
  
  // Actions
  headerActions?: JSX.Element;
  
  // Events
  onCollapse?: () => void;
  onExpand?: () => void;
  onResize?: (width: number, height: number) => void;
  
  // Styling
  class?: string;
  style?: JSX.CSSProperties;
  
  // Container query callback
  onContainerResize?: (width: number, height: number) => void;
}

// =============================================================================
// PANEL HEADER
// =============================================================================

interface PanelHeaderProps {
  title?: string;
  icon?: JSX.Element;
  actions?: JSX.Element;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isCompact?: boolean;
}

function PanelHeader(props: PanelHeaderProps) {
  return (
    <Flex
      align="center"
      justify="space-between"
      padding="sm"
      paddingX="md"
      minHeight={28}
      style={{
        "flex-shrink": "0",
        "user-select": "none",
      }}
    >
      <HStack spacing="sm" align="center">
        <Show when={props.icon}>
          <Box 
            color={tokens.colors.icon.default}
            style={{ 
              width: "16px", // Standard icon size
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
            }}
          >
            {props.icon}
          </Box>
        </Show>
        <Show when={props.title && !props.isCompact}>
          <Box
            style={{
              "font-size": tokens.typography.fontSize.sm,
              "font-weight": tokens.typography.fontWeight.semibold,
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
              color: tokens.colors.text.muted,
            }}
          >
            {props.title}
          </Box>
        </Show>
      </HStack>
      
      <HStack spacing="xs">
        {props.actions}
        <Show when={props.collapsible}>
          <button
            onClick={props.onToggleCollapse}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "20px",
              height: "20px",
              padding: "0",
              border: "none",
              background: "transparent",
              color: tokens.colors.icon.default,
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              transition: tokens.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            title={props.isCollapsed ? "Expand" : "Collapse"}
          >
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
              style={{
                transform: props.isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: tokens.transitions.fast,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </Show>
      </HStack>
    </Flex>
  );
}

// =============================================================================
// RESIZE HANDLE
// =============================================================================

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  position?: "start" | "end";
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

function ResizeHandle(props: ResizeHandleProps) {
  const { startResize, isResizing, handleKeyDown } = useResize({
    direction: props.direction,
    onResize: props.onResize,
    onResizeStart: props.onResizeStart,
    onResizeEnd: props.onResizeEnd,
  });

  const handleStyle = getResizeHandleStyle(props.direction, props.position || "end");

  return (
    <div
      style={{
        ...handleStyle,
        background: isResizing() ? tokens.colors.accent.muted : "transparent",
        transition: "background 150ms ease",
      }}
      onMouseDown={startResize}
      onTouchStart={startResize}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation={props.direction}
      onMouseEnter={(e) => {
        if (!isResizing()) {
          e.currentTarget.style.background = tokens.colors.interactive.hover;
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
// PANEL COMPONENT
// =============================================================================

export function Panel(props: PanelProps) {
  const [containerRef, setContainerRef] = createSignal<HTMLElement>();
  const [isResizing, setIsResizing] = createSignal(false);

  // Container query for responsive behavior
  const { size, breakpoints } = useContainerQuery(containerRef);
  
  // Get panel state from store or use local state
  const panelState = createMemo(() => layoutSelectors.getPanel(props.id));
  
  // Local state fallback
  const [localWidth, setLocalWidth] = createSignal(props.defaultWidth || 260);
  const [localHeight, setLocalHeight] = createSignal(props.defaultHeight || 200);
  const [localCollapsed, setLocalCollapsed] = createSignal(false);

  // Effective values (prefer store state if available)
  const width = () => panelState()?.width ?? localWidth();
  const height = () => panelState()?.height ?? localHeight();
  const isCollapsed = () => panelState()?.isCollapsed ?? localCollapsed();

  // Register panel in store on mount
  onMount(() => {
    layoutActions.registerPanel(props.id, props.title || props.id, props.position || "left", {
      width: props.defaultWidth || 260,
      height: props.defaultHeight || 200,
      minWidth: props.minWidth || 160,
      maxWidth: props.maxWidth || 600,
      minHeight: props.minHeight || 100,
      maxHeight: props.maxHeight || 800,
    });
  });

  // Container resize callback
  createEffect(() => {
    const s = size();
    props.onContainerResize?.(s.width, s.height);
  });

  // Handlers
  const handleToggleCollapse = () => {
    if (panelState()) {
      layoutActions.toggleCollapse(props.id);
    } else {
      setLocalCollapsed(!localCollapsed());
    }
    
    if (isCollapsed()) {
      props.onExpand?.();
    } else {
      props.onCollapse?.();
    }
  };

  const handleResize = (delta: number) => {
    const direction = props.position === "bottom" ? "height" : "width";
    
    if (panelState()) {
      layoutActions.resizePanelByDelta(props.id, direction, delta);
    } else {
      if (direction === "width") {
        setLocalWidth((w) => Math.max(props.minWidth || 160, Math.min(props.maxWidth || 600, w + delta)));
      } else {
        setLocalHeight((h) => Math.max(props.minHeight || 100, Math.min(props.maxHeight || 800, h + delta)));
      }
    }
    
    props.onResize?.(width(), height());
  };

  // Determine resize direction based on position
  const resizeDirection = () => props.position === "bottom" ? "vertical" : "horizontal";
  const resizePosition = () => props.position === "left" ? "end" : "start";

  // Compute styles based on position
  const computedStyle = (): JSX.CSSProperties => {
    const baseStyle: JSX.CSSProperties = {
      position: "relative",
      display: "flex",
      "flex-direction": "column",
      background: tokens.colors.surface.panel,
      "border-radius": tokens.radius.md,
      overflow: "hidden",
      transition: isResizing() ? "none" : "width 250ms ease-out, height 250ms ease-out",
    };

    if (props.position === "bottom") {
      return {
        ...baseStyle,
        width: "100%",
        height: isCollapsed() ? "0px" : `${height()}px`,
        "min-height": isCollapsed() ? "0px" : `${props.minHeight || 100}px`,
      };
    }

    return {
      ...baseStyle,
      width: isCollapsed() ? "0px" : `${width()}px`,
      "min-width": isCollapsed() ? "0px" : `${props.minWidth || 160}px`,
      height: "100%",
    };
  };

  return (
    <div
      ref={setContainerRef}
      class={props.class}
      style={{ ...computedStyle(), ...props.style }}
      data-panel-id={props.id}
      data-panel-position={props.position}
      data-panel-collapsed={isCollapsed()}
    >
      <Show when={props.showHeader !== false && !isCollapsed()}>
        <PanelHeader
          title={props.title}
          icon={props.icon}
          actions={props.headerActions}
          collapsible={props.collapsible}
          isCollapsed={isCollapsed()}
          onToggleCollapse={handleToggleCollapse}
          isCompact={breakpoints().xs}
        />
      </Show>

      <Show when={!isCollapsed()}>
        <Box
          flex={1}
          overflow="hidden"
          minHeight={0}
        >
          {props.children}
        </Box>
      </Show>

      <Show when={props.resizable !== false && !isCollapsed()}>
        <ResizeHandle
          direction={resizeDirection()}
          position={resizePosition()}
          onResize={handleResize}
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
        />
      </Show>
    </div>
  );
}

export default Panel;
