/**
 * =============================================================================
 * SPLIT VIEW - Resizable split view container
 * =============================================================================
 * 
 * SplitView creates a split layout with a draggable divider between two panes.
 * Supports both horizontal (side-by-side) and vertical (top-bottom) orientations.
 * 
 * Features:
 * - Smooth, 60fps resize performance
 * - Minimum size constraints
 * - Double-click to reset to default ratio
 * - Keyboard accessibility
 * - Persist split ratio to store
 * 
 * Usage:
 *   <SplitView
 *     orientation="horizontal"
 *     defaultRatio={0.3}
 *     minPrimarySize={200}
 *     minSecondarySize={300}
 *   >
 *     <Panel slot="primary">Left content</Panel>
 *     <Panel slot="secondary">Right content</Panel>
 *   </SplitView>
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  JSX,
  Show,
  createMemo,
} from "solid-js";
import { tokens } from "../../design-system/tokens";
import { useResize } from "../hooks/useResize";

// =============================================================================
// TYPES
// =============================================================================

export type SplitOrientation = "horizontal" | "vertical";

export interface SplitViewProps {
  id?: string;
  orientation?: SplitOrientation;
  defaultRatio?: number; // 0-1, default 0.5
  minPrimarySize?: number;
  minSecondarySize?: number;
  
  // Children with slots
  primary: JSX.Element;
  secondary: JSX.Element;
  
  // Events
  onRatioChange?: (ratio: number) => void;
  
  // Styling
  class?: string;
  style?: JSX.CSSProperties;
  
  // Divider customization
  dividerSize?: number;
  showDividerHandle?: boolean;
}

// =============================================================================
// DIVIDER COMPONENT
// =============================================================================

interface DividerProps {
  orientation: SplitOrientation;
  size: number;
  showHandle: boolean;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
}

function Divider(props: DividerProps) {
  const { startResize, isResizing, handleKeyDown } = useResize({
    direction: props.orientation,
    onResize: props.onResize,
    onResizeStart: props.onResizeStart,
    onResizeEnd: props.onResizeEnd,
  });

  const isHorizontal = () => props.orientation === "horizontal";

  const dividerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    "flex-shrink": "0",
    width: isHorizontal() ? `${props.size}px` : "100%",
    height: isHorizontal() ? "100%" : `${props.size}px`,
    cursor: isHorizontal() ? "col-resize" : "row-resize",
    background: isResizing() ? tokens.colors.accent.muted : "transparent",
    transition: "background 150ms ease",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  });

  const handleStyle = (): JSX.CSSProperties => ({
    width: isHorizontal() ? "2px" : "32px",
    height: isHorizontal() ? "32px" : "2px",
    "border-radius": "2px",
    background: tokens.colors.border.default,
    opacity: isResizing() ? "1" : "0",
    transition: "opacity 150ms ease",
  });

  return (
    <div
      style={dividerStyle()}
      onMouseDown={startResize}
      onTouchStart={startResize}
      onDblClick={props.onDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation={props.orientation}
      onMouseEnter={(e) => {
        if (!isResizing()) {
          e.currentTarget.style.background = tokens.colors.interactive.hover;
          const handle = e.currentTarget.querySelector("[data-handle]") as HTMLElement;
          if (handle) handle.style.opacity = "1";
        }
      }}
      onMouseLeave={(e) => {
        if (!isResizing()) {
          e.currentTarget.style.background = "transparent";
          const handle = e.currentTarget.querySelector("[data-handle]") as HTMLElement;
          if (handle) handle.style.opacity = "0";
        }
      }}
    >
      <Show when={props.showHandle}>
        <div data-handle style={handleStyle()} />
      </Show>
    </div>
  );
}

// =============================================================================
// SPLIT VIEW COMPONENT
// =============================================================================

export function SplitView(props: SplitViewProps) {
  const orientation = () => props.orientation || "horizontal";
  const defaultRatio = () => props.defaultRatio ?? 0.5;
  const dividerSize = () => props.dividerSize ?? 4;
  
  const [ratio, setRatio] = createSignal(defaultRatio());
  const [containerSize, setContainerSize] = createSignal(0);
  const [isResizing, setIsResizing] = createSignal(false);
  
  let containerRef: HTMLDivElement | undefined;

  // Update container size on mount and resize
  createEffect(() => {
    if (!containerRef) return;
    
    const updateSize = () => {
      const rect = containerRef!.getBoundingClientRect();
      setContainerSize(orientation() === "horizontal" ? rect.width : rect.height);
    };
    
    updateSize();
    
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef);
    
    return () => observer.disconnect();
  });

  // Calculate pane sizes
  const primarySize = createMemo(() => {
    const total = containerSize() - dividerSize();
    return Math.round(total * ratio());
  });

  const secondarySize = createMemo(() => {
    const total = containerSize() - dividerSize();
    return total - primarySize();
  });

  // Handle resize
  const handleResize = (delta: number) => {
    const total = containerSize() - dividerSize();
    if (total <= 0) return;
    
    // Calculate new ratio
    const newPrimarySize = primarySize() + delta;
    const minPrimary = props.minPrimarySize ?? 100;
    const minSecondary = props.minSecondarySize ?? 100;
    
    // Clamp to minimum sizes
    const clampedPrimarySize = Math.max(minPrimary, Math.min(total - minSecondary, newPrimarySize));
    const newRatio = clampedPrimarySize / total;
    
    setRatio(newRatio);
    props.onRatioChange?.(newRatio);
  };

  // Reset to default ratio on double-click
  const handleDoubleClick = () => {
    setRatio(defaultRatio());
    props.onRatioChange?.(defaultRatio());
  };

  const isHorizontal = () => orientation() === "horizontal";

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": isHorizontal() ? "row" : "column",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    ...props.style,
  });

  const paneStyle = (size: number): JSX.CSSProperties => ({
    width: isHorizontal() ? `${size}px` : "100%",
    height: isHorizontal() ? "100%" : `${size}px`,
    "flex-shrink": "0",
    overflow: "hidden",
    transition: isResizing() ? "none" : "width 100ms ease-out, height 100ms ease-out",
  });

  return (
    <div
      ref={containerRef}
      class={props.class}
      style={containerStyle()}
      data-split-view={props.id}
      data-split-orientation={orientation()}
    >
      {/* Primary pane */}
      <div style={paneStyle(primarySize())}>
        {props.primary}
      </div>

      {/* Divider */}
      <Divider
        orientation={orientation()}
        size={dividerSize()}
        showHandle={props.showDividerHandle ?? true}
        onResize={handleResize}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
        onDoubleClick={handleDoubleClick}
      />

      {/* Secondary pane */}
      <div style={paneStyle(secondarySize())}>
        {props.secondary}
      </div>
    </div>
  );
}

// =============================================================================
// PRESET SPLIT VIEWS
// =============================================================================

/**
 * Horizontal split (side by side)
 */
export function HSplit(props: Omit<SplitViewProps, "orientation">) {
  return <SplitView {...props} orientation="horizontal" />;
}

/**
 * Vertical split (top and bottom)
 */
export function VSplit(props: Omit<SplitViewProps, "orientation">) {
  return <SplitView {...props} orientation="vertical" />;
}

export default SplitView;
