import { batch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import type { GridCell, EditorGridState } from "../../components/editor/EditorGrid";
import {
  saveGridState,
  createSingleEditorLayout,
  splitCell,
  closeCell as closeGridCell,
} from "../../utils/gridSerializer";
import type { EditorState } from "./editorTypes";

export function loadUseGridLayout(): boolean {
  try {
    const stored = localStorage.getItem("orion_use_grid_layout");
    return stored === "true";
  } catch (_e) {
    return false;
  }
}

export function createGridOperations(
  state: EditorState,
  setState: SetStoreFunction<EditorState>,
) {
  const setUseGridLayout = (use: boolean) => {
    setState("useGridLayout", use);
    try {
      localStorage.setItem("orion_use_grid_layout", use ? "true" : "false");
    } catch (e) {
      console.error("[EditorContext] Failed to save grid layout preference:", e);
    }
    
    if (use && !state.gridState) {
      const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
      const newGridState = createSingleEditorLayout(activeFile?.id);
      setState("gridState", newGridState);
      saveGridState(newGridState);
    }
  };

  const splitEditorInGrid = (direction: "horizontal" | "vertical", fileId?: string) => {
    if (!state.gridState) {
      const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
      const newGridState = createSingleEditorLayout(activeFile?.id);
      setState("gridState", newGridState);
    }
    
    const currentGridState = state.gridState!;
    const activeCellId = currentGridState.activeCell;
    const targetFileId = fileId || state.activeFileId || undefined;
    
    const newGridState = splitCell(currentGridState, activeCellId, direction, targetFileId);
    
    batch(() => {
      setState("gridState", newGridState);
    });
    
    saveGridState(newGridState);
  };

  const closeGridCellAction = (cellId: string) => {
    if (!state.gridState) return;
    
    const newGridState = closeGridCell(state.gridState, cellId);
    
    batch(() => {
      setState("gridState", newGridState);
    });
    
    saveGridState(newGridState);
  };

  const moveEditorToGridCell = (fileId: string, cellId: string) => {
    if (!state.gridState) return;
    
    const updateCell = (cell: GridCell): GridCell => {
      if (cell.id === cellId) {
        return { ...cell, fileId };
      }
      if (cell.children) {
        return {
          ...cell,
          children: cell.children.map(updateCell),
        };
      }
      return cell;
    };
    
    const newGridState: EditorGridState = {
      root: updateCell(state.gridState.root),
      activeCell: cellId,
    };
    
    batch(() => {
      setState("gridState", newGridState);
      setState("activeFileId", fileId);
    });
    
    saveGridState(newGridState);
  };

  const updateGridState = (newState: EditorGridState) => {
    batch(() => {
      setState("gridState", newState);
    });
    saveGridState(newState);
  };

  return {
    setUseGridLayout,
    splitEditorInGrid,
    closeGridCellAction,
    moveEditorToGridCell,
    updateGridState,
  };
}
