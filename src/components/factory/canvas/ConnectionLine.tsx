/**
 * ConnectionLine.tsx
 * 
 * Edge rendering component for connecting nodes.
 * Supports bezier curves, different colors, animated flow, and labels.
 */

import { JSX, Show, createMemo, createSignal, onMount, onCleanup } from "solid-js";

export type EdgeType = "default" | "success" | "error" | "conditional" | "data" | "control";

export interface EdgeLabel {
  /** Label text */
  text: string;
  /** Position along edge (0-1) */
  position?: number;
}

export interface ConnectionLineProps {
  /** Unique edge identifier */
  id: string;
  /** Source X coordinate */
  sourceX: number;
  /** Source Y coordinate */
  sourceY: number;
  /** Target X coordinate */
  targetX: number;
  /** Target Y coordinate */
  targetY: number;
  /** Source node ID */
  sourceNodeId?: string;
  /** Target node ID */
  targetNodeId?: string;
  /** Source port handle ID */
  sourceHandle?: string;
  /** Target port handle ID */
  targetHandle?: string;
  /** Edge type for styling */
  type?: EdgeType;
  /** Whether edge is selected */
  selected?: boolean;
  /** Whether edge is hovered */
  hovered?: boolean;
  /** Whether to show animated flow */
  animated?: boolean;
  /** Edge label */
  label?: EdgeLabel;
  /** Curvature of the bezier (0-1) */
  curvature?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Click handler */
  onClick?: (e: MouseEvent) => void;
  /** Mouse enter handler */
  onMouseEnter?: (e: MouseEvent) => void;
  /** Mouse leave handler */
  onMouseLeave?: (e: MouseEvent) => void;
  /** Context menu handler */
  onContextMenu?: (e: MouseEvent) => void;
  /** Custom style overrides */
  style?: JSX.CSSProperties;
}

// Edge type color map
const EDGE_COLORS: Record<EdgeType, string> = {
  default: "var(--jb-text-muted-color, var(--cortex-text-inactive))",
  success: "var(--cortex-success, var(--cortex-success))",
  error: "var(--cortex-error, var(--cortex-error))",
  conditional: "var(--cortex-warning, var(--cortex-warning))",
  data: "var(--accent-primary, var(--cortex-info))",
  control: "var(--state-info, var(--cortex-info))",
};

const EDGE_COLORS_SELECTED: Record<EdgeType, string> = {
  default: "var(--jb-text-body-color, var(--cortex-text-secondary))",
  success: "var(--cortex-success)",
  error: "var(--cortex-error)",
  conditional: "var(--cortex-warning)",
  data: "var(--accent-light, var(--cortex-info))",
  control: "var(--accent-light, var(--cortex-info))",
};

export function ConnectionLine(props: ConnectionLineProps) {
  const [animationOffset, setAnimationOffset] = createSignal(0);
  let animationFrame: number | undefined;

  const type = () => props.type ?? "default";
  const curvature = () => props.curvature ?? 0.5;
  const strokeWidth = () => props.strokeWidth ?? 2;

  // Animate flow
  onMount(() => {
    if (props.animated) {
      const animate = () => {
        setAnimationOffset((prev) => (prev + 0.5) % 20);
        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    }
  });

  onCleanup(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });

  // Calculate bezier control points for smooth curves
  const path = createMemo(() => {
    const { sourceX, sourceY, targetX, targetY } = props;
    const dx = Math.abs(targetX - sourceX);
    const dy = Math.abs(targetY - sourceY);
    
    // Calculate control point offset based on distance and curvature
    const controlOffset = Math.max(50, dx * curvature(), dy * 0.5);
    
    // Control points for horizontal flow (source right -> target left)
    const c1x = sourceX + controlOffset;
    const c1y = sourceY;
    const c2x = targetX - controlOffset;
    const c2y = targetY;
    
    return `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
  });

  // Calculate label position at midpoint of bezier
  const labelPosition = createMemo(() => {
    if (!props.label) return null;
    
    const { sourceX, sourceY, targetX, targetY } = props;
    const t = props.label.position ?? 0.5;
    
    // Bezier midpoint calculation
    const dx = Math.abs(targetX - sourceX);
    const controlOffset = Math.max(50, dx * curvature());
    
    const c1x = sourceX + controlOffset;
    const c1y = sourceY;
    const c2x = targetX - controlOffset;
    const c2y = targetY;
    
    // Cubic bezier formula
    const mt = 1 - t;
    const x = mt * mt * mt * sourceX + 
              3 * mt * mt * t * c1x + 
              3 * mt * t * t * c2x + 
              t * t * t * targetX;
    const y = mt * mt * mt * sourceY + 
              3 * mt * mt * t * c1y + 
              3 * mt * t * t * c2y + 
              t * t * t * targetY;
    
    return { x, y };
  });

  const edgeColor = () => {
    if (props.selected || props.hovered) {
      return EDGE_COLORS_SELECTED[type()];
    }
    return EDGE_COLORS[type()];
  };

  const currentStrokeWidth = () => {
    if (props.selected) return strokeWidth() + 1;
    if (props.hovered) return strokeWidth() + 0.5;
    return strokeWidth();
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onClick?.(e);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onContextMenu?.(e);
  };

  return (
    <g
      class="factory-connection-line"
      data-edge-id={props.id}
      data-source={props.sourceNodeId}
      data-target={props.targetNodeId}
      style={{
        cursor: "pointer",
        ...props.style,
      }}
    >
      {/* Invisible wider path for easier selection */}
      <path
        d={path()}
        fill="none"
        stroke="transparent"
        stroke-width={strokeWidth() + 12}
        stroke-linecap="round"
        onClick={handleClick}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
        onContextMenu={handleContextMenu}
        style={{ cursor: "pointer" }}
      />
      
      {/* Main edge path */}
      <path
        d={path()}
        fill="none"
        stroke={edgeColor()}
        stroke-width={currentStrokeWidth()}
        stroke-linecap="round"
        stroke-dasharray={props.animated ? "5,5" : undefined}
        stroke-dashoffset={props.animated ? animationOffset() : undefined}
        style={{
          transition: "stroke 0.15s ease, stroke-width 0.15s ease",
          "pointer-events": "none",
        }}
      />
      
      {/* Selection glow effect */}
      <Show when={props.selected}>
        <path
          d={path()}
          fill="none"
          stroke={edgeColor()}
          stroke-width={currentStrokeWidth() + 4}
          stroke-linecap="round"
          opacity={0.3}
          style={{ "pointer-events": "none" }}
        />
      </Show>
      
      {/* Arrow marker at target */}
      <polygon
        points={calculateArrowPoints(props.targetX, props.targetY, props.sourceX, props.sourceY)}
        fill={edgeColor()}
        style={{
          transition: "fill 0.15s ease",
          "pointer-events": "none",
        }}
      />
      
      {/* Edge label */}
      <Show when={props.label && labelPosition()}>
        <g transform={`translate(${labelPosition()!.x}, ${labelPosition()!.y})`}>
          <rect
            x={-getTextWidth(props.label!.text) / 2 - 6}
            y={-10}
            width={getTextWidth(props.label!.text) + 12}
            height={20}
            rx={4}
            fill="var(--jb-panel, var(--cortex-bg-secondary))"
            stroke={edgeColor()}
            stroke-width={1}
          />
          <text
            x={0}
            y={4}
            text-anchor="middle"
            fill="var(--jb-text-body-color, var(--cortex-text-secondary))"
            font-size="11"
            font-family="var(--jb-font-ui)"
            style={{ "pointer-events": "none", "user-select": "none" }}
          >
            {props.label!.text}
          </text>
        </g>
      </Show>
    </g>
  );
}

/**
 * Calculate arrow head points for the edge target
 */
function calculateArrowPoints(
  targetX: number,
  targetY: number,
  sourceX: number,
  sourceY: number
): string {
  const arrowLength = 10;
  const arrowWidth = 6;
  
  // Calculate angle from source to target
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);
  
  // Arrow tip is at target
  const tipX = targetX;
  const tipY = targetY;
  
  // Calculate base points
  const baseX = tipX - arrowLength * Math.cos(angle);
  const baseY = tipY - arrowLength * Math.sin(angle);
  
  const leftX = baseX - arrowWidth * Math.cos(angle - Math.PI / 2);
  const leftY = baseY - arrowWidth * Math.sin(angle - Math.PI / 2);
  
  const rightX = baseX - arrowWidth * Math.cos(angle + Math.PI / 2);
  const rightY = baseY - arrowWidth * Math.sin(angle + Math.PI / 2);
  
  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}

/**
 * Estimate text width for label background sizing
 */
function getTextWidth(text: string): number {
  return text.length * 6.5;
}

/**
 * Temporary connection line during edge creation
 */
export interface TempConnectionLineProps {
  /** Source X coordinate */
  sourceX: number;
  /** Source Y coordinate */
  sourceY: number;
  /** Current mouse X coordinate */
  targetX: number;
  /** Current mouse Y coordinate */
  targetY: number;
  /** Whether connection is valid */
  valid?: boolean;
}

export function TempConnectionLine(props: TempConnectionLineProps) {
  const curvature = 0.4;
  
  const path = createMemo(() => {
    const { sourceX, sourceY, targetX, targetY } = props;
    const dx = Math.abs(targetX - sourceX);
    const controlOffset = Math.max(30, dx * curvature);
    
    const c1x = sourceX + controlOffset;
    const c1y = sourceY;
    const c2x = targetX - controlOffset;
    const c2y = targetY;
    
    return `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
  });

  return (
    <path
      class="factory-temp-connection"
      d={path()}
      fill="none"
      stroke={props.valid === false ? "var(--cortex-error, var(--cortex-error))" : "var(--accent-primary, var(--cortex-info))"}
      stroke-width={2}
      stroke-linecap="round"
      stroke-dasharray="6,4"
      opacity={0.7}
      style={{ "pointer-events": "none" }}
    />
  );
}

export default ConnectionLine;

