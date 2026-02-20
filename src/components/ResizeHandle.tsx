import { createSignal, onCleanup, onMount, JSX, Show } from "solid-js";

export type ResizeDirection = "horizontal" | "vertical";

/**
 * Sash state enum matching VS Code specification
 */
export enum SashState {
  Disabled = 0,    // No interaction allowed
  AtMinimum = 1,   // Can only grow (resize down/right)
  AtMaximum = 2,   // Can only shrink (resize up/left)
  Enabled = 3      // Full bidirectional resize
}

export interface ResizeHandleProps {
  direction: ResizeDirection;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  minSize?: number;
  maxSize?: number;
  defaultSize?: number;
  style?: JSX.CSSProperties;
  disabled?: boolean;
  /** Sash state for cursor indication */
  state?: SashState;
  /** Show orthogonal corner handles at start position */
  orthogonalStartHandle?: boolean;
  /** Show orthogonal corner handles at end position */
  orthogonalEndHandle?: boolean;
  /** Callback when corner handle is dragged */
  onCornerDrag?: (corner: 'start' | 'end', deltaX: number, deltaY: number) => void;
}

// VS Code sash hover delay (300ms)
const SASH_HOVER_DELAY = 300;

export function ResizeHandle(props: ResizeHandleProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  const [showHoverIndicator, setShowHoverIndicator] = createSignal(false);
  let startPos = 0;
  let lastClickTime = 0;
  let hoverTimeout: number | undefined;

  const handleMouseDown = (e: MouseEvent) => {
    if (props.disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Check for double-click (within 300ms)
    const now = Date.now();
    if (now - lastClickTime < 300) {
      props.onDoubleClick?.();
      lastClickTime = 0;
      return;
    }
    lastClickTime = now;
    
    setIsDragging(true);
    setShowHoverIndicator(true);
    startPos = props.direction === "horizontal" ? e.clientX : e.clientY;
    props.onResizeStart?.();

    // VS Code uses col-resize/row-resize on macOS
    const isMac = navigator.platform.toLowerCase().includes('mac');
    document.body.style.cursor = props.direction === "horizontal" 
      ? (isMac ? "col-resize" : "ew-resize")
      : (isMac ? "row-resize" : "ns-resize");
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;

    const currentPos = props.direction === "horizontal" ? e.clientX : e.clientY;
    const delta = currentPos - startPos;
    
    if (delta !== 0) {
      props.onResize(delta);
      startPos = currentPos;
    }
  };

  const handleMouseUp = () => {
    if (isDragging()) {
      setIsDragging(false);
      props.onResizeEnd?.();
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    // VS Code hover delay: 300ms before showing indicator
    hoverTimeout = window.setTimeout(() => {
      if (isHovered() && !props.disabled) {
        setShowHoverIndicator(true);
      }
    }, SASH_HOVER_DELAY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = undefined;
    }
    if (!isDragging()) {
      setShowHoverIndicator(false);
    }
  };

  onMount(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  const isHorizontal = () => props.direction === "horizontal";
  const isMac = () => navigator.platform.toLowerCase().includes('mac');
  
  /**
   * Get cursor based on state and direction (VS Code spec)
   */
  const getCursor = () => {
    if (props.disabled) return "default";
    
    const state = props.state ?? SashState.Enabled;
    const horizontal = isHorizontal();
    const mac = isMac();
    
    switch (state) {
      case SashState.Disabled:
        return "default";
      case SashState.AtMinimum:
        return horizontal ? "e-resize" : "s-resize";
      case SashState.AtMaximum:
        return horizontal ? "w-resize" : "n-resize";
      case SashState.Enabled:
      default:
        return horizontal 
          ? (mac ? "col-resize" : "ew-resize")
          : (mac ? "row-resize" : "ns-resize");
    }
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    "flex-shrink": "0",
    "z-index": "10",
    cursor: getCursor(),
    // Dimensions based on direction
    ...(isHorizontal() 
      ? { width: "4px", height: "100%" }
      : { height: "4px", width: "100%" }
    ),
    ...props.style,
  });

  const hitAreaStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    ...(isHorizontal()
      ? { left: "-4px", right: "-4px", top: "0", bottom: "0" }
      : { top: "-4px", bottom: "-4px", left: "0", right: "0" }
    ),
    background: "transparent",
  });

  const indicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    ...(isHorizontal()
      ? { left: "1px", width: "2px", top: "0", bottom: "0" }
      : { top: "1px", height: "2px", left: "0", right: "0" }
    ),
    background: (showHoverIndicator() || isDragging()) && !props.disabled
      ? "var(--jb-border-focus)"
      : "transparent",
    transition: "background var(--cortex-transition-fast)",
    "pointer-events": "none",
  });

  const cornerStyle = (position: 'start' | 'end'): JSX.CSSProperties => ({
    position: "absolute",
    width: "8px",
    height: "8px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--jb-border-focus)",
    cursor: "nwse-resize",
    ...(isHorizontal()
      ? { 
          left: "-2px", 
          [position === 'start' ? 'top' : 'bottom']: "-4px" 
        }
      : { 
          top: "-2px", 
          [position === 'start' ? 'left' : 'right']: "-4px" 
        }
    ),
  });

  return (
    <div
      style={containerStyle()}
      data-direction={props.direction}
      data-dragging={isDragging()}
      data-disabled={props.disabled}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Extended hit area for easier grabbing (12px total) */}
      <div style={hitAreaStyle()} />
      
      {/* Visual indicator line */}
      <div style={indicatorStyle()} />
      
      {/* Orthogonal corner handle at start */}
      <Show when={props.orthogonalStartHandle && !props.disabled}>
        <div style={cornerStyle('start')} />
      </Show>
      
      {/* Orthogonal corner handle at end */}
      <Show when={props.orthogonalEndHandle && !props.disabled}>
        <div style={cornerStyle('end')} />
      </Show>
    </div>
  );
}

export default ResizeHandle;

