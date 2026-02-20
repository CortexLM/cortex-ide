/**
 * GridSash - Resizable divider between grid cells
 * 
 * Features:
 * - Drag to resize adjacent cells
 * - Double-click to equalize sizes
 * - Visual feedback on hover/drag
 * - Smooth animations
 */

import {
  createSignal,
  onCleanup,
  type Component,
  type JSX,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

export interface GridSashProps {
  /** Direction of the sash (horizontal = stacked vertically, vertical = side by side) */
  direction: "horizontal" | "vertical";
  /** Callback when sash is dragged */
  onResize: (delta: number) => void;
  /** Callback when sash is double-clicked */
  onDoubleClick: () => void;
  /** Size of the sash in pixels */
  size?: number;
  /** Hover area size in pixels (larger than visual size for easier grabbing) */
  hoverSize?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SASH_SIZE = 4;
const DEFAULT_HOVER_SIZE = 8;

// ============================================================================
// GridSash Component
// ============================================================================

export const GridSash: Component<GridSashProps> = (props) => {
  let sashRef: HTMLDivElement | undefined;
  const [isDragging, setIsDragging] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const sashSize = () => props.size ?? DEFAULT_SASH_SIZE;
  const hoverSize = () => props.hoverSize ?? DEFAULT_HOVER_SIZE;
  const isVertical = () => props.direction === "vertical";

  // Track drag start position
  let dragStartPos = 0;
  let lastDelta = 0;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    dragStartPos = isVertical() ? e.clientX : e.clientY;
    lastDelta = 0;

    // Add global listeners
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    // Add cursor style to body for smooth dragging
    document.body.style.cursor = isVertical() ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;

    const currentPos = isVertical() ? e.clientX : e.clientY;
    const totalDelta = currentPos - dragStartPos;
    const incrementalDelta = totalDelta - lastDelta;
    lastDelta = totalDelta;

    // Call resize with incremental delta for smoother updates
    props.onResize(incrementalDelta);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    // Remove global listeners
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    
    // Reset cursor
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const handleDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onDoubleClick();
  };

  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  // Calculate styles
  const containerStyle = (): JSX.CSSProperties => {
    const size = hoverSize();
    return {
      position: "relative",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "flex-shrink": "0",
      width: isVertical() ? `${size}px` : "100%",
      height: isVertical() ? "100%" : `${size}px`,
      cursor: isVertical() ? "col-resize" : "row-resize",
      "z-index": "5",
      // Center the visual sash
      margin: isVertical() 
        ? `0 -${(size - sashSize()) / 2}px` 
        : `-${(size - sashSize()) / 2}px 0`,
    };
  };

  const sashStyle = (): JSX.CSSProperties => {
    const active = isDragging() || isHovered();
    return {
      position: "absolute",
      width: isVertical() ? `${sashSize()}px` : "100%",
      height: isVertical() ? "100%" : `${sashSize()}px`,
      background: active
        ? "var(--accent, var(--cortex-info))"
        : "var(--border-subtle, var(--jb-border-default, var(--cortex-bg-hover)))",
      transition: isDragging() ? "none" : "background 150ms ease",
      "pointer-events": "none",
    };
  };

  return (
    <div
      ref={sashRef}
      class="grid-sash"
      style={containerStyle()}
      onMouseDown={handleMouseDown}
      onDblClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-direction={props.direction}
      data-dragging={isDragging()}
    >
      <div class="grid-sash-visual" style={sashStyle()} />
    </div>
  );
};

export default GridSash;

