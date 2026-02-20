/**
 * CanvasBackground.tsx
 * 
 * Grid background for the factory canvas.
 * Supports dotted or lined grid patterns that scale with zoom.
 * Uses Orion theme CSS variables.
 */

import { JSX, createMemo } from "solid-js";

export type GridPattern = "dots" | "lines" | "none";

export interface CanvasBackgroundProps {
  /** Grid pattern type */
  pattern?: GridPattern;
  /** Grid cell size in pixels */
  gridSize?: number;
  /** Current zoom level (1 = 100%) */
  zoom?: number;
  /** Pan offset X */
  panX?: number;
  /** Pan offset Y */
  panY?: number;
  /** Whether the grid is visible */
  visible?: boolean;
  /** Custom style overrides */
  style?: JSX.CSSProperties;
}

export function CanvasBackground(props: CanvasBackgroundProps) {
  const pattern = () => props.pattern ?? "dots";
  const gridSize = () => props.gridSize ?? 20;
  const zoom = () => props.zoom ?? 1;
  const panX = () => props.panX ?? 0;
  const panY = () => props.panY ?? 0;
  const visible = () => props.visible ?? true;

  // Calculate scaled grid size based on zoom
  const scaledGridSize = createMemo(() => gridSize() * zoom());
  
  // Large grid for major lines (every 5 cells)
  const largeGridSize = createMemo(() => scaledGridSize() * 5);

  // Pattern ID for uniqueness
  const patternId = createMemo(() => `canvas-grid-${pattern()}-${Math.random().toString(36).slice(2, 9)}`);
  const largePatternId = createMemo(() => `canvas-grid-large-${Math.random().toString(36).slice(2, 9)}`);

  // Calculate pattern offset based on pan
  const patternOffsetX = createMemo(() => (panX() % scaledGridSize()) + scaledGridSize());
  const patternOffsetY = createMemo(() => (panY() % scaledGridSize()) + scaledGridSize());

  const renderDotPattern = () => (
    <>
      <defs>
        {/* Small dots pattern */}
        <pattern
          id={patternId()}
          x={patternOffsetX()}
          y={patternOffsetY()}
          width={scaledGridSize()}
          height={scaledGridSize()}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={scaledGridSize() / 2}
            cy={scaledGridSize() / 2}
            r={Math.max(0.5, zoom() * 0.8)}
            fill="var(--jb-border-default, rgba(255, 255, 255, 0.08))"
          />
        </pattern>
        {/* Large dots pattern (every 5th cell) */}
        <pattern
          id={largePatternId()}
          x={patternOffsetX()}
          y={patternOffsetY()}
          width={largeGridSize()}
          height={largeGridSize()}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={largeGridSize() / 2}
            cy={largeGridSize() / 2}
            r={Math.max(1, zoom() * 1.2)}
            fill="var(--jb-text-muted-color, rgba(255, 255, 255, 0.15))"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId()})`} />
      <rect width="100%" height="100%" fill={`url(#${largePatternId()})`} />
    </>
  );

  const renderLinePattern = () => (
    <>
      <defs>
        {/* Small lines pattern */}
        <pattern
          id={patternId()}
          x={patternOffsetX()}
          y={patternOffsetY()}
          width={scaledGridSize()}
          height={scaledGridSize()}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${scaledGridSize()} 0 L 0 0 0 ${scaledGridSize()}`}
            fill="none"
            stroke="var(--jb-border-default, rgba(255, 255, 255, 0.05))"
            stroke-width={Math.max(0.5, zoom() * 0.5)}
          />
        </pattern>
        {/* Large lines pattern (every 5th cell) */}
        <pattern
          id={largePatternId()}
          x={patternOffsetX()}
          y={patternOffsetY()}
          width={largeGridSize()}
          height={largeGridSize()}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${largeGridSize()} 0 L 0 0 0 ${largeGridSize()}`}
            fill="none"
            stroke="var(--jb-text-muted-color, rgba(255, 255, 255, 0.1))"
            stroke-width={Math.max(0.5, zoom() * 0.8)}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId()})`} />
      <rect width="100%" height="100%" fill={`url(#${largePatternId()})`} />
    </>
  );

  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    "pointer-events": "none",
    "user-select": "none",
    ...props.style,
  });

  return (
    <div
      class="factory-canvas-background"
      style={containerStyle()}
      aria-hidden="true"
    >
      {visible() && pattern() !== "none" && (
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            top: "0",
            left: "0",
          }}
        >
          {/* Base background */}
          <rect
            width="100%"
            height="100%"
            fill="var(--jb-canvas, var(--cortex-bg-secondary))"
          />
          
          {/* Grid pattern */}
          {pattern() === "dots" && renderDotPattern()}
          {pattern() === "lines" && renderLinePattern()}
        </svg>
      )}
    </div>
  );
}

export default CanvasBackground;

