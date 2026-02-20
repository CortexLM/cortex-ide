/**
 * Grid manipulation utilities for splitting, closing, and moving cells.
 */

import type { GridCell, EditorGridState } from "@/utils/grid/types";
import { generateCellId } from "@/utils/grid/types";
import { getLeafCellIds } from "@/utils/grid/serialization";
import { createSingleEditorLayout } from "@/utils/grid/layoutFactories";

/**
 * Split a cell in the grid
 */
export function splitCell(
  state: EditorGridState,
  cellId: string,
  direction: "horizontal" | "vertical",
  newFileId?: string
): EditorGridState {
  const newState = cloneState(state);
  const cell = findCell(newState.root, cellId);

  if (!cell) return state;

  const newCell: GridCell = {
    id: generateCellId(),
    type: "editor",
    fileId: newFileId,
  };

  if (cell.type === "editor" || cell.type === "group") {
    const originalCell: GridCell = {
      id: generateCellId(),
      type: cell.type,
      fileId: cell.fileId,
    };

    cell.type = "grid";
    cell.direction = direction;
    cell.children = [originalCell, newCell];
    cell.sizes = [0.5, 0.5];
    delete cell.fileId;

    newState.activeCell = newCell.id;
  }

  return newState;
}

/**
 * Close a cell in the grid
 */
export function closeCell(state: EditorGridState, cellId: string): EditorGridState {
  const newState = cloneState(state);

  if (newState.root.id === cellId) {
    if (newState.root.type === "editor" || newState.root.type === "group") {
      return createSingleEditorLayout();
    }
  }

  const newRoot = removeCellFromTree(newState.root, cellId);
  if (!newRoot) {
    return createSingleEditorLayout();
  }

  newState.root = newRoot;

  const leafIds = getLeafCellIds(newState.root);
  if (!leafIds.includes(newState.activeCell)) {
    newState.activeCell = leafIds[0] || newState.root.id;
  }

  return newState;
}

/**
 * Move editor to another cell
 */
export function moveEditorToCell(
  state: EditorGridState,
  fileId: string,
  targetCellId: string
): EditorGridState {
  const newState = cloneState(state);
  const targetCell = findCell(newState.root, targetCellId);

  if (!targetCell || (targetCell.type !== "editor" && targetCell.type !== "group")) {
    return state;
  }

  clearFileIdFromTree(newState.root, fileId);

  targetCell.fileId = fileId;
  newState.activeCell = targetCellId;

  return newState;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function cloneState(state: EditorGridState): EditorGridState {
  return {
    root: cloneCell(state.root),
    activeCell: state.activeCell,
  };
}

function cloneCell(cell: GridCell): GridCell {
  return {
    ...cell,
    children: cell.children?.map(cloneCell),
    sizes: cell.sizes ? [...cell.sizes] : undefined,
  };
}

function findCell(root: GridCell, id: string): GridCell | undefined {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findCell(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

function removeCellFromTree(root: GridCell, id: string): GridCell | null {
  if (root.id === id) return null;

  if (root.children) {
    const newChildren: GridCell[] = [];
    const newSizes: number[] = [];
    let removedSize = 0;

    root.children.forEach((child, index) => {
      if (child.id === id) {
        removedSize = root.sizes?.[index] ?? 1 / root.children!.length;
      } else {
        const processed = removeCellFromTree(child, id);
        if (processed) {
          newChildren.push(processed);
          newSizes.push(root.sizes?.[index] ?? 1 / root.children!.length);
        }
      }
    });

    if (newChildren.length === 0) return null;
    if (newChildren.length === 1) return newChildren[0];

    const totalRemaining = newSizes.reduce((a, b) => a + b, 0);
    const redistributedSizes = newSizes.map(
      (s) => (s / totalRemaining) * (totalRemaining + removedSize)
    );

    const sum = redistributedSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = redistributedSizes.map((s) => s / sum);

    return {
      ...root,
      children: newChildren,
      sizes: normalizedSizes,
    };
  }

  return root;
}

function clearFileIdFromTree(root: GridCell, fileId: string): void {
  if (root.fileId === fileId) {
    delete root.fileId;
  }
  if (root.children) {
    root.children.forEach((child) => clearFileIdFromTree(child, fileId));
  }
}
