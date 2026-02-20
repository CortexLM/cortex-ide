/**
 * =============================================================================
 * USE RESIZE - High-performance resize hook
 * =============================================================================
 * 
 * This hook provides smooth, 60fps resizing for panels and split views.
 * It uses requestAnimationFrame to batch updates and prevent jank.
 * 
 * Features:
 * - RAF-throttled updates for 60fps performance
 * - Touch support for mobile/tablet
 * - Keyboard accessibility
 * - Proper cleanup on unmount
 * 
 * Usage:
 *   const { startResize, isResizing } = useResize({
 *     onResize: (delta) => updatePanelWidth(delta),
 *     direction: "horizontal",
 *   });
 * =============================================================================
 */

import { createSignal, onCleanup, Accessor } from "solid-js";

// =============================================================================
// TYPES
// =============================================================================

export type ResizeDirection = "horizontal" | "vertical";

export interface UseResizeOptions {
  direction: ResizeDirection;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  minDelta?: number;
  maxDelta?: number;
}

export interface UseResizeReturn {
  startResize: (e: MouseEvent | TouchEvent) => void;
  isResizing: Accessor<boolean>;
  handleKeyDown: (e: KeyboardEvent) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useResize(options: UseResizeOptions): UseResizeReturn {
  const {
    direction,
    onResize,
    onResizeStart,
    onResizeEnd,
    minDelta = -Infinity,
    maxDelta = Infinity,
  } = options;

  const [isResizing, setIsResizing] = createSignal(false);
  
  let startPosition = 0;
  let lastPosition = 0;
  let rafId: number | null = null;
  let totalDelta = 0;

  // Get position from mouse or touch event
  const getPosition = (e: MouseEvent | TouchEvent): number => {
    if ("touches" in e) {
      return direction === "horizontal" ? e.touches[0].clientX : e.touches[0].clientY;
    }
    return direction === "horizontal" ? e.clientX : e.clientY;
  };

  // RAF-throttled resize handler
  const scheduleResize = (position: number) => {
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      const delta = position - lastPosition;
      const clampedDelta = Math.max(minDelta, Math.min(maxDelta, delta));
      
      if (clampedDelta !== 0) {
        totalDelta += clampedDelta;
        onResize(clampedDelta);
        lastPosition = position;
      }
      
      rafId = null;
    });
  };

  // Mouse/touch move handler
  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isResizing()) return;
    
    e.preventDefault();
    const position = getPosition(e);
    scheduleResize(position);
  };

  // Mouse/touch end handler
  const handleEnd = () => {
    if (!isResizing()) return;
    
    setIsResizing(false);
    
    // Cancel any pending RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    
    // Remove event listeners
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleMove);
    document.removeEventListener("touchend", handleEnd);
    document.removeEventListener("touchcancel", handleEnd);
    
    // Reset cursor
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    
    onResizeEnd?.();
  };

  // Start resize
  const startResize = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    startPosition = getPosition(e);
    lastPosition = startPosition;
    totalDelta = 0;
    
    // Set cursor and prevent text selection
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    
    // Add event listeners
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    document.addEventListener("touchcancel", handleEnd);
    
    onResizeStart?.();
  };

  // Keyboard handler for accessibility
  const handleKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10;
    let delta = 0;
    
    if (direction === "horizontal") {
      if (e.key === "ArrowLeft") delta = -step;
      else if (e.key === "ArrowRight") delta = step;
    } else {
      if (e.key === "ArrowUp") delta = -step;
      else if (e.key === "ArrowDown") delta = step;
    }
    
    if (delta !== 0) {
      e.preventDefault();
      const clampedDelta = Math.max(minDelta, Math.min(maxDelta, delta));
      onResize(clampedDelta);
    }
  };

  // Cleanup on unmount
  onCleanup(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleMove);
    document.removeEventListener("touchend", handleEnd);
    document.removeEventListener("touchcancel", handleEnd);
  });

  return {
    startResize,
    isResizing,
    handleKeyDown,
  };
}

// =============================================================================
// RESIZE HANDLE COMPONENT HELPER
// =============================================================================

export interface ResizeHandleStyle {
  position: "absolute";
  cursor: string;
  zIndex: number;
  // Position based on direction
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width?: string;
  height?: string;
}

export function getResizeHandleStyle(
  direction: ResizeDirection,
  position: "start" | "end" = "end",
  size: number = 4
): ResizeHandleStyle {
  const base: ResizeHandleStyle = {
    position: "absolute",
    cursor: direction === "horizontal" ? "col-resize" : "row-resize",
    zIndex: 10,
  };

  if (direction === "horizontal") {
    return {
      ...base,
      top: "0",
      bottom: "0",
      width: `${size}px`,
      [position === "start" ? "left" : "right"]: "0",
    };
  } else {
    return {
      ...base,
      left: "0",
      right: "0",
      height: `${size}px`,
      [position === "start" ? "top" : "bottom"]: "0",
    };
  }
}

export default useResize;
