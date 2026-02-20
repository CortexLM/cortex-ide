/**
 * DropZoneOverlay - Drop zone detection overlay for drag-tab-to-create-split.
 * Shows visual indicators on editor group edges when dragging a tab.
 */
import { createSignal, Show, type Component, type JSX } from "solid-js";
import type { DropPosition } from "@/components/editor/grid/types";

// ============================================================================
// Types
// ============================================================================

export interface DropZoneOverlayProps {
  onDrop: (position: DropPosition) => void;
  active: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ZONES: { position: DropPosition; style: JSX.CSSProperties }[] = [
  {
    position: "left",
    style: { top: "0", left: "0", width: "25%", height: "100%" },
  },
  {
    position: "right",
    style: { top: "0", right: "0", width: "25%", height: "100%" },
  },
  {
    position: "top",
    style: { top: "0", left: "25%", width: "50%", height: "25%" },
  },
  {
    position: "bottom",
    style: { bottom: "0", left: "25%", width: "50%", height: "25%" },
  },
  {
    position: "center",
    style: { top: "25%", left: "25%", width: "50%", height: "50%" },
  },
];

const HIGHLIGHT_COLOR = "var(--accent-muted, rgba(59, 130, 246, 0.2))";
const HIGHLIGHT_BORDER = "var(--accent-primary, #3b82f6)";

// ============================================================================
// Component
// ============================================================================

export const DropZoneOverlay: Component<DropZoneOverlayProps> = (props) => {
  const [hoveredZone, setHoveredZone] = createSignal<DropPosition | null>(null);

  const handleDragEnter = (position: DropPosition) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredZone(position);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    const related = e.relatedTarget as Node | null;
    const current = e.currentTarget as HTMLElement;
    if (related && current.contains(related)) return;
    setHoveredZone(null);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (position: DropPosition) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredZone(null);
    props.onDrop(position);
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    inset: "0",
    "z-index": "10",
    "pointer-events": props.active ? "auto" : "none",
    opacity: props.active ? "1" : "0",
    transition: "opacity 150ms ease",
  });

  const zoneStyle = (position: DropPosition, base: JSX.CSSProperties): JSX.CSSProperties => {
    const isHovered = hoveredZone() === position;
    return {
      ...base,
      position: "absolute",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      background: isHovered ? HIGHLIGHT_COLOR : "transparent",
      border: isHovered ? `2px dashed ${HIGHLIGHT_BORDER}` : "2px dashed transparent",
      "border-radius": "4px",
      transition: "background 150ms ease, border-color 150ms ease",
      "box-sizing": "border-box",
    };
  };

  const labelStyle = (position: DropPosition): JSX.CSSProperties => ({
    "font-size": "11px",
    "font-weight": "500",
    color: "var(--text-secondary)",
    opacity: hoveredZone() === position ? "1" : "0",
    transition: "opacity 150ms ease",
    "pointer-events": "none",
    "text-transform": "capitalize",
    "user-select": "none",
  });

  return (
    <Show when={props.active}>
      <div style={containerStyle()}>
        {ZONES.map((zone) => (
          <div
            style={zoneStyle(zone.position, zone.style)}
            onDragEnter={handleDragEnter(zone.position)}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop(zone.position)}
            data-drop-zone={zone.position}
          >
            <span style={labelStyle(zone.position)}>{zone.position}</span>
          </div>
        ))}
      </div>
    </Show>
  );
};

export default DropZoneOverlay;
