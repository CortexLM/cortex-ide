/**
 * CanvasToolbar.tsx
 * 
 * Toolbar controls for the factory canvas.
 * Includes zoom, grid, and editing controls.
 */

import { JSX, Show } from "solid-js";
import { IconButton } from "../../ui/IconButton";
import { Tooltip } from "../../ui/Tooltip";

export interface CanvasToolbarProps {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Whether grid is visible */
  gridVisible: boolean;
  /** Whether snap to grid is enabled */
  snapToGrid: boolean;
  /** Whether there are items to undo */
  canUndo: boolean;
  /** Whether there are items to redo */
  canRedo: boolean;
  /** Whether there are selected items */
  hasSelection: boolean;
  /** Position of toolbar */
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  /** Zoom in handler */
  onZoomIn?: () => void;
  /** Zoom out handler */
  onZoomOut?: () => void;
  /** Reset zoom handler */
  onZoomReset?: () => void;
  /** Fit to view handler */
  onFitView?: () => void;
  /** Toggle grid handler */
  onToggleGrid?: () => void;
  /** Toggle snap to grid handler */
  onToggleSnapToGrid?: () => void;
  /** Undo handler */
  onUndo?: () => void;
  /** Redo handler */
  onRedo?: () => void;
  /** Delete selected handler */
  onDeleteSelected?: () => void;
  /** Custom style overrides */
  style?: JSX.CSSProperties;
}

// SVG Icons
const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="7" cy="7" r="5" />
    <line x1="11" y1="11" x2="14" y2="14" />
    <line x1="7" y1="5" x2="7" y2="9" />
    <line x1="5" y1="7" x2="9" y2="7" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="7" cy="7" r="5" />
    <line x1="11" y1="11" x2="14" y2="14" />
    <line x1="5" y1="7" x2="9" y2="7" />
  </svg>
);

const FitViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="10" height="10" rx="1" />
    <polyline points="1,5 1,1 5,1" />
    <polyline points="11,1 15,1 15,5" />
    <polyline points="15,11 15,15 11,15" />
    <polyline points="5,15 1,15 1,11" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="1" y="1" width="14" height="14" rx="1" />
    <line x1="8" y1="1" x2="8" y2="15" />
    <line x1="1" y1="8" x2="15" y2="8" />
  </svg>
);

const SnapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="2" y="2" width="5" height="5" rx="0.5" />
    <rect x="9" y="9" width="5" height="5" rx="0.5" />
    <path d="M7 4.5 L9 4.5 L9 7 L11.5 7 L11.5 9" stroke-dasharray="2,1" />
  </svg>
);

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 7 L1 5 L3 3" />
    <path d="M1 5 L8 5 C11 5 13 7 13 10 C13 13 11 15 8 15 L5 15" />
  </svg>
);

const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M13 7 L15 5 L13 3" />
    <path d="M15 5 L8 5 C5 5 3 7 3 10 C3 13 5 15 8 15 L11 15" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 4 L13 4" />
    <path d="M6 4 L6 2 L10 2 L10 4" />
    <path d="M4 4 L4 14 L12 14 L12 4" />
    <line x1="6" y1="7" x2="6" y2="11" />
    <line x1="8" y1="7" x2="8" y2="11" />
    <line x1="10" y1="7" x2="10" y2="11" />
  </svg>
);

const Divider = () => (
  <div
    style={{
      width: "1px",
      height: "20px",
      background: "var(--jb-border-default, rgba(255, 255, 255, 0.08))",
      margin: "0 4px",
    }}
  />
);

export function CanvasToolbar(props: CanvasToolbarProps) {
  const position = () => props.position ?? "bottom-center";

  // Position styles
  const positionStyles: Record<string, JSX.CSSProperties> = {
    "top-left": { top: "16px", left: "16px" },
    "top-center": { top: "16px", left: "50%", transform: "translateX(-50%)" },
    "top-right": { top: "16px", right: "16px" },
    "bottom-left": { bottom: "16px", left: "16px" },
    "bottom-center": { bottom: "16px", left: "50%", transform: "translateX(-50%)" },
    "bottom-right": { bottom: "16px", right: "16px" },
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    display: "flex",
    "align-items": "center",
    gap: "2px",
    padding: "6px 8px",
    background: "var(--jb-panel, var(--cortex-bg-secondary))",
    border: "1px solid var(--jb-border-default, rgba(255, 255, 255, 0.08))",
    "border-radius": "var(--jb-radius-md, 10px)",
    "box-shadow": "var(--jb-shadow-popup, 0px 8px 16px rgba(0, 0, 0, 0.45))",
    "z-index": "100",
    ...positionStyles[position()],
    ...props.style,
  });

  const zoomLabelStyle: JSX.CSSProperties = {
    "min-width": "48px",
    "text-align": "center",
    "font-size": "12px",
    "font-family": "var(--jb-font-ui)",
    color: "var(--jb-text-body-color, var(--cortex-text-secondary))",
    "font-variant-numeric": "tabular-nums",
    padding: "0 4px",
    cursor: "pointer",
  };

  const formatZoom = (zoom: number) => `${Math.round(zoom * 100)}%`;

  return (
    <div
      class="factory-canvas-toolbar"
      style={containerStyle()}
      role="toolbar"
      aria-label="Canvas controls"
    >
      {/* Zoom controls */}
      <Tooltip content="Zoom out (Ctrl+-)" position="top">
        <IconButton
          onClick={props.onZoomOut}
          tooltip="Zoom out"
          size="sm"
        >
          <ZoomOutIcon />
        </IconButton>
      </Tooltip>

      <Tooltip content="Click to reset zoom" position="top">
        <div
          style={zoomLabelStyle}
          onClick={props.onZoomReset}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && props.onZoomReset?.()}
        >
          {formatZoom(props.zoom)}
        </div>
      </Tooltip>

      <Tooltip content="Zoom in (Ctrl++)" position="top">
        <IconButton
          onClick={props.onZoomIn}
          tooltip="Zoom in"
          size="sm"
        >
          <ZoomInIcon />
        </IconButton>
      </Tooltip>

      <Tooltip content="Fit to view (Ctrl+0)" position="top">
        <IconButton
          onClick={props.onFitView}
          tooltip="Fit to view"
          size="sm"
        >
          <FitViewIcon />
        </IconButton>
      </Tooltip>

      <Divider />

      {/* Grid controls */}
      <Tooltip content="Toggle grid (G)" position="top">
        <IconButton
          onClick={props.onToggleGrid}
          active={props.gridVisible}
          tooltip="Toggle grid"
          size="sm"
        >
          <GridIcon />
        </IconButton>
      </Tooltip>

      <Tooltip content="Snap to grid (Shift+G)" position="top">
        <IconButton
          onClick={props.onToggleSnapToGrid}
          active={props.snapToGrid}
          tooltip="Snap to grid"
          size="sm"
        >
          <SnapIcon />
        </IconButton>
      </Tooltip>

      <Divider />

      {/* History controls */}
      <Tooltip content="Undo (Ctrl+Z)" position="top">
        <IconButton
          onClick={props.onUndo}
          disabled={!props.canUndo}
          tooltip="Undo"
          size="sm"
        >
          <UndoIcon />
        </IconButton>
      </Tooltip>

      <Tooltip content="Redo (Ctrl+Y)" position="top">
        <IconButton
          onClick={props.onRedo}
          disabled={!props.canRedo}
          tooltip="Redo"
          size="sm"
        >
          <RedoIcon />
        </IconButton>
      </Tooltip>

      <Show when={props.hasSelection}>
        <Divider />

        {/* Selection controls */}
        <Tooltip content="Delete selected (Delete)" position="top">
          <IconButton
            onClick={props.onDeleteSelected}
            tooltip="Delete selected"
            size="sm"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Show>
    </div>
  );
}

export default CanvasToolbar;

