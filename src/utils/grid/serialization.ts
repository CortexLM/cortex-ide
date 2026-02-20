/**
 * Grid serialization, deserialization, validation, and storage operations.
 */

import type { GridCell, EditorGridState } from "@/utils/grid/types";
import type { SerializedGridState } from "@/utils/grid/types";

const CURRENT_VERSION = 1;
const STORAGE_KEY = "orion_editor_grid_state";

/**
 * Serialize grid state to JSON string for storage
 */
export function serializeGrid(state: EditorGridState): string {
  const serialized: SerializedGridState = {
    version: CURRENT_VERSION,
    root: state.root,
    activeCell: state.activeCell,
    timestamp: Date.now(),
  };
  return JSON.stringify(serialized);
}

/**
 * Deserialize JSON string to grid state
 * Returns null if invalid or incompatible version
 */
export function deserializeGrid(json: string): EditorGridState | null {
  try {
    const parsed = JSON.parse(json) as SerializedGridState;

    if (!parsed.version || parsed.version > CURRENT_VERSION) {
      console.warn("[GridSerializer] Incompatible grid state version:", parsed.version);
      return null;
    }

    if (!validateGridCell(parsed.root)) {
      console.warn("[GridSerializer] Invalid grid cell structure");
      return null;
    }

    const cellIds = getAllCellIds(parsed.root);
    if (!cellIds.includes(parsed.activeCell)) {
      const leafIds = getLeafCellIds(parsed.root);
      parsed.activeCell = leafIds[0] || parsed.root.id;
    }

    return {
      root: parsed.root,
      activeCell: parsed.activeCell,
    };
  } catch (e) {
    console.error("[GridSerializer] Failed to deserialize grid:", e);
    return null;
  }
}

/**
 * Validate grid cell structure recursively
 */
function validateGridCell(cell: unknown): cell is GridCell {
  if (!cell || typeof cell !== "object") return false;

  const c = cell as Record<string, unknown>;

  if (typeof c.id !== "string" || !c.id) return false;
  if (!["editor", "group", "grid"].includes(c.type as string)) return false;

  if (c.type === "grid") {
    if (!Array.isArray(c.children) || c.children.length === 0) return false;
    if (!["horizontal", "vertical"].includes(c.direction as string)) return false;
    if (!Array.isArray(c.sizes) || c.sizes.length !== c.children.length) return false;

    for (const size of c.sizes) {
      if (typeof size !== "number" || size <= 0 || size > 1) return false;
    }

    for (const child of c.children) {
      if (!validateGridCell(child)) return false;
    }
  }

  return true;
}

/**
 * Get all cell IDs in the tree
 */
function getAllCellIds(cell: GridCell): string[] {
  const ids = [cell.id];
  if (cell.children) {
    for (const child of cell.children) {
      ids.push(...getAllCellIds(child));
    }
  }
  return ids;
}

/**
 * Get all leaf (editor/group) cell IDs
 */
export function getLeafCellIds(cell: GridCell): string[] {
  if (cell.type === "editor" || cell.type === "group") {
    return [cell.id];
  }
  if (cell.children) {
    return cell.children.flatMap(getLeafCellIds);
  }
  return [];
}

/**
 * Save grid state to localStorage
 */
export function saveGridState(state: EditorGridState): void {
  try {
    const json = serializeGrid(state);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.error("[GridSerializer] Failed to save grid state:", e);
  }
}

/**
 * Load grid state from localStorage
 */
export function loadGridState(): EditorGridState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return deserializeGrid(json);
  } catch (e) {
    console.error("[GridSerializer] Failed to load grid state:", e);
    return null;
  }
}

/**
 * Clear saved grid state
 */
export function clearGridState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("[GridSerializer] Failed to clear grid state:", e);
  }
}
