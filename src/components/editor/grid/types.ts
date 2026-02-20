/**
 * Grid type definitions and constants for the EditorGrid system.
 */

import type { JSX } from "solid-js";

export interface GridCell {
  /** Unique identifier for this cell */
  id: string;
  /** Type of cell content */
  type: "editor" | "group" | "grid";
  /** For editor type: the file ID being edited */
  fileId?: string;
  /** For grid type: nested children */
  children?: GridCell[];
  /** For grid type: direction of the split */
  direction?: "horizontal" | "vertical";
  /** For grid type: relative sizes of children (ratios that sum to 1) */
  sizes?: number[];
}

export interface EditorGridState {
  /** Root cell of the grid tree */
  root: GridCell;
  /** Currently active cell ID */
  activeCell: string;
}

export interface EditorGridProps {
  /** Current grid state */
  state: EditorGridState;
  /** Callback when state changes */
  onStateChange: (state: EditorGridState) => void;
  /** Render function for editor content */
  renderEditor: (fileId: string, cellId: string) => JSX.Element;
  /** Render function for empty cells */
  renderEmpty?: (cellId: string) => JSX.Element;
  /** Minimum cell size in pixels */
  minCellSize?: number;
  /** Callback when a cell is activated */
  onCellActivate?: (cellId: string) => void;
  /** Callback when an editor is dropped into a cell */
  onEditorDrop?: (fileId: string, targetCellId: string, position: DropPosition) => void;
  /** Callback when a tab drag starts */
  onTabDragStart?: (fileId: string, groupId: string) => void;
}

export type DropPosition = "center" | "left" | "right" | "top" | "bottom";

export const DEFAULT_MIN_CELL_SIZE = 100;
export const EDGE_DROP_THRESHOLD = 0.25; // 25% of cell size for edge drops
