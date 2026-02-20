/**
 * SelectionBox.tsx
 * 
 * Selection rectangle for multi-selecting nodes via drag.
 * Renders a semi-transparent box during drag operations.
 */

import { JSX, Show } from "solid-js";

export interface SelectionBoxBounds {
  /** Starting X coordinate */
  startX: number;
  /** Starting Y coordinate */
  startY: number;
  /** Current X coordinate */
  endX: number;
  /** Current Y coordinate */
  endY: number;
}

export interface SelectionBoxProps {
  /** Whether selection is active */
  active: boolean;
  /** Bounding coordinates of selection */
  bounds: SelectionBoxBounds | null;
  /** Custom style overrides */
  style?: JSX.CSSProperties;
}

export function SelectionBox(props: SelectionBoxProps) {
  // Calculate normalized rectangle (handle negative width/height)
  const rect = () => {
    if (!props.bounds) return null;
    
    const { startX, startY, endX, endY } = props.bounds;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    return { x, y, width, height };
  };

  const boxStyle = (): JSX.CSSProperties => {
    const r = rect();
    if (!r) return {};
    
    return {
      position: "absolute",
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      background: "var(--accent-muted, rgba(59, 130, 246, 0.15))",
      border: "1px solid var(--accent-primary, var(--cortex-info))",
      "border-radius": "var(--cortex-radius-sm)",
      "pointer-events": "none",
      "z-index": "1000",
      ...props.style,
    };
  };

  return (
    <Show when={props.active && rect()}>
      <div
        class="factory-selection-box"
        style={boxStyle()}
        role="presentation"
        aria-hidden="true"
      />
    </Show>
  );
}

/**
 * Check if a node rectangle intersects with the selection box
 */
export function isNodeInSelection(
  nodeRect: { x: number; y: number; width: number; height: number },
  selectionBounds: SelectionBoxBounds
): boolean {
  const selX = Math.min(selectionBounds.startX, selectionBounds.endX);
  const selY = Math.min(selectionBounds.startY, selectionBounds.endY);
  const selWidth = Math.abs(selectionBounds.endX - selectionBounds.startX);
  const selHeight = Math.abs(selectionBounds.endY - selectionBounds.startY);
  
  // Check AABB intersection
  return !(
    nodeRect.x + nodeRect.width < selX ||
    nodeRect.x > selX + selWidth ||
    nodeRect.y + nodeRect.height < selY ||
    nodeRect.y > selY + selHeight
  );
}

export default SelectionBox;

