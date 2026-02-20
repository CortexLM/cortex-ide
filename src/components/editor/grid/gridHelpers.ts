/**
 * Grid helper utilities for manipulating the GridCell tree.
 */

import type { GridCell } from "./types";

/**
 * Deep clone a grid cell tree
 */
export function cloneCell(cell: GridCell): GridCell {
  return {
    ...cell,
    children: cell.children?.map(cloneCell),
    sizes: cell.sizes ? [...cell.sizes] : undefined,
  };
}

/**
 * Find a cell by ID in the tree
 */
export function findCell(root: GridCell, id: string): GridCell | undefined {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findCell(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Replace a cell in the tree by ID
 */
export function replaceCell(root: GridCell, id: string, newCell: GridCell): GridCell {
  if (root.id === id) return newCell;
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => replaceCell(child, id, newCell)),
    };
  }
  return root;
}

/**
 * Get all leaf cell IDs
 */
export function getLeafCellIds(root: GridCell): string[] {
  if (root.type === "editor" || root.type === "group") {
    return [root.id];
  }
  if (root.children) {
    return root.children.flatMap(getLeafCellIds);
  }
  return [];
}
