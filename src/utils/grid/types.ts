/**
 * Grid types and shared utilities for the grid serialization system.
 */

import type { GridCell } from "@/components/editor/grid/types";

export interface SerializedGridState {
  version: number;
  root: GridCell;
  activeCell: string;
  timestamp: number;
}

export function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export type { GridCell, EditorGridState } from "@/components/editor/grid/types";
