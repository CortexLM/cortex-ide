/**
 * MiniMap.tsx
 * 
 * Overview minimap showing the entire workflow.
 * Displays node positions with a draggable viewport indicator.
 */

import { JSX, createMemo, createSignal, For, Show } from "solid-js";

export interface MiniMapNode {
  /** Node identifier */
  id: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Node width */
  width: number;
  /** Node height */
  height: number;
  /** Node color/type for display */
  color?: string;
  /** Whether node is selected */
  selected?: boolean;
}

export interface MiniMapViewport {
  /** Viewport X position (in canvas coordinates) */
  x: number;
  /** Viewport Y position (in canvas coordinates) */
  y: number;
  /** Viewport width (in canvas coordinates) */
  width: number;
  /** Viewport height (in canvas coordinates) */
  height: number;
}

export interface MiniMapProps {
  /** List of nodes to display */
  nodes: MiniMapNode[];
  /** Current viewport bounds */
  viewport: MiniMapViewport;
  /** Width of minimap in pixels */
  width?: number;
  /** Height of minimap in pixels */
  height?: number;
  /** Whether minimap is visible */
  visible?: boolean;
  /** Position on canvas */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Click to navigate handler */
  onNavigate?: (x: number, y: number) => void;
  /** Viewport drag handler */
  onViewportDrag?: (deltaX: number, deltaY: number) => void;
  /** Custom style overrides */
  style?: JSX.CSSProperties;
}

export function MiniMap(props: MiniMapProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });

  const width = () => props.width ?? 200;
  const height = () => props.height ?? 150;
  const visible = () => props.visible ?? true;
  const position = () => props.position ?? "bottom-right";

  // Calculate bounds of all nodes
  const nodeBounds = createMemo(() => {
    if (props.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const node of props.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    // Add padding
    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  });

  // Calculate scale to fit all nodes in minimap
  const scale = createMemo(() => {
    const bounds = nodeBounds();
    const boundsWidth = bounds.maxX - bounds.minX;
    const boundsHeight = bounds.maxY - bounds.minY;
    
    const scaleX = width() / boundsWidth;
    const scaleY = height() / boundsHeight;
    
    return Math.min(scaleX, scaleY, 0.1); // Cap at 10% scale
  });

  // Transform canvas coordinates to minimap coordinates
  const toMiniMapCoords = (x: number, y: number) => {
    const bounds = nodeBounds();
    const s = scale();
    return {
      x: (x - bounds.minX) * s,
      y: (y - bounds.minY) * s,
    };
  };

  // Transform minimap coordinates to canvas coordinates
  const toCanvasCoords = (x: number, y: number) => {
    const bounds = nodeBounds();
    const s = scale();
    return {
      x: x / s + bounds.minX,
      y: y / s + bounds.minY,
    };
  };

  // Scaled viewport rectangle
  const scaledViewport = createMemo(() => {
    const vp = props.viewport;
    const start = toMiniMapCoords(vp.x, vp.y);
    return {
      x: start.x,
      y: start.y,
      width: vp.width * scale(),
      height: vp.height * scale(),
    };
  });

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const vp = scaledViewport();
    
    // Check if clicking on viewport indicator
    if (
      x >= vp.x && x <= vp.x + vp.width &&
      y >= vp.y && y <= vp.y + vp.height
    ) {
      // Start dragging viewport
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Click to navigate
      const canvasCoords = toCanvasCoords(x, y);
      props.onNavigate?.(
        canvasCoords.x - props.viewport.width / 2,
        canvasCoords.y - props.viewport.height / 2
      );
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;
    
    const deltaX = e.clientX - dragStart().x;
    const deltaY = e.clientY - dragStart().y;
    
    // Convert delta to canvas coordinates
    const s = scale();
    props.onViewportDrag?.(deltaX / s, deltaY / s);
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Position styles
  const positionStyles: Record<string, JSX.CSSProperties> = {
    "bottom-right": { bottom: "16px", right: "16px" },
    "bottom-left": { bottom: "16px", left: "16px" },
    "top-right": { top: "16px", right: "16px" },
    "top-left": { top: "16px", left: "16px" },
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    width: `${width()}px`,
    height: `${height()}px`,
    background: "var(--jb-panel, var(--cortex-bg-secondary))",
    border: "1px solid var(--jb-border-default, rgba(255, 255, 255, 0.08))",
    "border-radius": "var(--jb-radius-md, 10px)",
    "box-shadow": "var(--jb-shadow-popup, 0px 8px 16px rgba(0, 0, 0, 0.45))",
    overflow: "hidden",
    "user-select": "none",
    "z-index": "100",
    opacity: isDragging() ? "1" : "0.85",
    transition: "opacity 0.15s ease",
    ...positionStyles[position()],
    ...props.style,
  });

  return (
    <Show when={visible()}>
      <div
        class="factory-minimap"
        style={containerStyle()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label="Workflow minimap"
      >
        <svg width={width()} height={height()}>
          {/* Background */}
          <rect
            width={width()}
            height={height()}
            fill="var(--jb-canvas, var(--cortex-bg-secondary))"
          />
          
          {/* Nodes */}
          <For each={props.nodes}>
            {(node) => {
              const pos = toMiniMapCoords(node.x, node.y);
              const nodeWidth = Math.max(4, node.width * scale());
              const nodeHeight = Math.max(3, node.height * scale());
              
              return (
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={1}
                  fill={node.selected 
                    ? "var(--accent-primary, var(--cortex-info))" 
                    : (node.color || "var(--jb-text-muted-color, var(--cortex-text-inactive))")
                  }
                  opacity={node.selected ? 1 : 0.6}
                />
              );
            }}
          </For>
          
          {/* Viewport indicator */}
          <rect
            x={scaledViewport().x}
            y={scaledViewport().y}
            width={Math.max(10, scaledViewport().width)}
            height={Math.max(10, scaledViewport().height)}
            fill="var(--accent-muted, rgba(59, 130, 246, 0.15))"
            stroke="var(--accent-primary, var(--cortex-info))"
            stroke-width={1.5}
            rx={2}
            style={{ cursor: "move" }}
          />
        </svg>
        
        {/* Header label */}
        <div
          style={{
            position: "absolute",
            top: "4px",
            left: "8px",
            "font-size": "10px",
            "font-family": "var(--jb-font-ui)",
            color: "var(--jb-text-muted-color, var(--cortex-text-inactive))",
            "text-transform": "uppercase",
            "letter-spacing": "0.5px",
            "pointer-events": "none",
          }}
        >
          Minimap
        </div>
      </div>
    </Show>
  );
}

export default MiniMap;

