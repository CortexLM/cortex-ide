import { createSignal } from "solid-js";
import { produce, SetStoreFunction } from "solid-js/store";
import type {
  CellType,
  NotebookCell,
  NotebookState,
  DragState,
  CollapseState,
} from "./types";

export function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function createEmptyCell(type: CellType): NotebookCell {
  return {
    id: generateCellId(),
    cell_type: type,
    source: "",
    metadata: {},
    outputs: [],
    execution_count: null,
  };
}

export function createDragState(): DragState {
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);
  return { draggedIndex, dragOverIndex, setDraggedIndex, setDragOverIndex };
}

export function createCollapseState(): CollapseState {
  const [collapsedCells, setCollapsedCells] = createSignal<Record<string, boolean>>({});
  const toggleCellCollapse = (cellId: string) => {
    setCollapsedCells((prev) => ({ ...prev, [cellId]: !prev[cellId] }));
  };
  return { collapsedCells, toggleCellCollapse };
}

export function createCellManager(
  state: NotebookState,
  setState: SetStoreFunction<NotebookState>,
) {
  const addCell = (type: CellType, afterIndex?: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const newCell = createEmptyCell(type);

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      const insertIndex = afterIndex !== undefined
        ? Math.min(afterIndex + 1, cells.length)
        : cells.length;

      cells.splice(insertIndex, 0, newCell);
      notebookData.modified = true;
      s.activeCellId = newCell.id;
    }));
  };

  const deleteCell = (index: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (cells.length <= 1) {
        cells[0] = createEmptyCell(cells[0].cell_type);
        s.activeCellId = cells[0].id;
      } else if (index >= 0 && index < cells.length) {
        const deletedCellId = cells[index].id;
        cells.splice(index, 1);
        if (s.activeCellId === deletedCellId) {
          const newIndex = Math.min(index, cells.length - 1);
          s.activeCellId = cells[newIndex]?.id || null;
        }
      }
      notebookData.modified = true;
    }));
  };

  const moveCell = (fromIndex: number, toIndex: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath || fromIndex === toIndex) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (fromIndex < 0 || fromIndex >= cells.length ||
          toIndex < 0 || toIndex >= cells.length) {
        return;
      }

      const [movedCell] = cells.splice(fromIndex, 1);
      cells.splice(toIndex, 0, movedCell);
      notebookData.modified = true;
    }));
  };

  const updateCellSource = (cellId: string, source: string): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cell = notebookData.notebook.cells.find((c) => c.id === cellId);
      if (cell) {
        cell.source = source;
        notebookData.modified = true;
      }
    }));
  };

  const changeCellType = (index: number, type: CellType): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (index >= 0 && index < cells.length) {
        const cell = cells[index];
        const previousType = cell.cell_type;
        cell.cell_type = type;
        if (type !== "code" && previousType === "code") {
          cell.outputs = [];
          cell.execution_count = null;
        }
        notebookData.modified = true;
      }
    }));
  };

  const duplicateCell = (index: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (index >= 0 && index < cells.length) {
        const originalCell = cells[index];
        const duplicatedCell: NotebookCell = {
          ...originalCell,
          id: generateCellId(),
          outputs: [],
          execution_count: null,
        };
        cells.splice(index + 1, 0, duplicatedCell);
        notebookData.modified = true;
        s.activeCellId = duplicatedCell.id;
      }
    }));
  };

  const mergeCells = (startIndex: number, endIndex: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath || startIndex >= endIndex) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (startIndex < 0 || endIndex >= cells.length) return;

      const mergedSource = cells
        .slice(startIndex, endIndex + 1)
        .map((c) => c.source)
        .join("\n\n");

      const mergedCell: NotebookCell = {
        id: generateCellId(),
        cell_type: cells[startIndex].cell_type,
        source: mergedSource,
        metadata: { ...cells[startIndex].metadata },
        outputs: [],
        execution_count: null,
      };

      cells.splice(startIndex, endIndex - startIndex + 1, mergedCell);
      notebookData.modified = true;
      s.activeCellId = mergedCell.id;
    }));
  };

  const splitCell = (index: number, splitPosition: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (index < 0 || index >= cells.length) return;

      const originalCell = cells[index];
      const source = originalCell.source;
      if (splitPosition <= 0 || splitPosition >= source.length) return;

      const newCell: NotebookCell = {
        id: generateCellId(),
        cell_type: originalCell.cell_type,
        source: source.substring(splitPosition).trimStart(),
        metadata: {},
        outputs: [],
        execution_count: null,
      };

      originalCell.source = source.substring(0, splitPosition).trimEnd();
      originalCell.outputs = [];
      originalCell.execution_count = null;

      cells.splice(index + 1, 0, newCell);
      notebookData.modified = true;
      s.activeCellId = newCell.id;
    }));
  };

  return {
    addCell,
    deleteCell,
    moveCell,
    updateCellSource,
    changeCellType,
    duplicateCell,
    mergeCells,
    splitCell,
  };
}
