/**
 * Grid layout factory functions for creating common editor layouts.
 */

import type { GridCell, EditorGridState } from "@/utils/grid/types";
import { generateCellId } from "@/utils/grid/types";

/**
 * Create a single editor layout
 */
export function createSingleEditorLayout(fileId?: string): EditorGridState {
  const cellId = generateCellId();
  return {
    root: {
      id: cellId,
      type: "editor",
      fileId,
    },
    activeCell: cellId,
  };
}

/**
 * Create a split layout (horizontal or vertical)
 */
export function createSplitLayout(
  direction: "h" | "v",
  fileIds: string[]
): EditorGridState {
  if (fileIds.length === 0) {
    return createSingleEditorLayout();
  }

  if (fileIds.length === 1) {
    return createSingleEditorLayout(fileIds[0]);
  }

  const children: GridCell[] = fileIds.map((fileId) => ({
    id: generateCellId(),
    type: "editor" as const,
    fileId,
  }));

  const equalSize = 1 / children.length;
  const rootId = generateCellId();

  return {
    root: {
      id: rootId,
      type: "grid",
      direction: direction === "h" ? "horizontal" : "vertical",
      children,
      sizes: children.map(() => equalSize),
    },
    activeCell: children[0].id,
  };
}

/**
 * Create a 2x2 grid layout
 */
export function create2x2Layout(
  fileIds: [string?, string?, string?, string?]
): EditorGridState {
  const topLeft: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[0] };
  const topRight: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[1] };
  const bottomLeft: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[2] };
  const bottomRight: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[3] };

  const topRow: GridCell = {
    id: generateCellId(),
    type: "grid",
    direction: "vertical",
    children: [topLeft, topRight],
    sizes: [0.5, 0.5],
  };

  const bottomRow: GridCell = {
    id: generateCellId(),
    type: "grid",
    direction: "vertical",
    children: [bottomLeft, bottomRight],
    sizes: [0.5, 0.5],
  };

  const rootId = generateCellId();

  return {
    root: {
      id: rootId,
      type: "grid",
      direction: "horizontal",
      children: [topRow, bottomRow],
      sizes: [0.5, 0.5],
    },
    activeCell: topLeft.id,
  };
}

/**
 * Create a 3-column layout
 */
export function create3ColumnLayout(fileIds: [string?, string?, string?]): EditorGridState {
  const left: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[0] };
  const center: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[1] };
  const right: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[2] };

  const rootId = generateCellId();

  return {
    root: {
      id: rootId,
      type: "grid",
      direction: "vertical",
      children: [left, center, right],
      sizes: [0.333, 0.334, 0.333],
    },
    activeCell: left.id,
  };
}

/**
 * Create layout with main editor and side panel (e.g., for preview)
 */
export function createMainWithSideLayout(
  mainFileId?: string,
  sideFileId?: string,
  sidePosition: "left" | "right" = "right",
  sideRatio: number = 0.3
): EditorGridState {
  const main: GridCell = { id: generateCellId(), type: "editor", fileId: mainFileId };
  const side: GridCell = { id: generateCellId(), type: "editor", fileId: sideFileId };

  const mainRatio = 1 - sideRatio;
  const rootId = generateCellId();

  return {
    root: {
      id: rootId,
      type: "grid",
      direction: "vertical",
      children: sidePosition === "left" ? [side, main] : [main, side],
      sizes: sidePosition === "left" ? [sideRatio, mainRatio] : [mainRatio, sideRatio],
    },
    activeCell: main.id,
  };
}
