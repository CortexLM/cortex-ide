/**
 * EditorGrid - Main grid component for complex editor layouts.
 */

import {
  createEffect,
  createMemo,
  onCleanup,
  JSX,
  type Component,
} from "solid-js";
import type { EditorGridProps, GridCell, DropPosition } from "./types";
import { DEFAULT_MIN_CELL_SIZE } from "./types";
import { cloneCell, findCell, replaceCell, getLeafCellIds } from "./gridHelpers";
import { GridCellView } from "./GridCellView";
import { useEditorUI } from "@/context/editor/EditorUIContext";
import { MaximizeRestoreButton } from "./MaximizeRestoreButton";

export const EditorGrid: Component<EditorGridProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const editorUI = useEditorUI();
  const minCellSize = () => props.minCellSize ?? DEFAULT_MIN_CELL_SIZE;

  createEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "1") { editorUI.focusGroup(0); e.preventDefault(); }
        else if (e.key === "2") { editorUI.focusGroup(1); e.preventDefault(); }
        else if (e.key === "3") { editorUI.focusGroup(2); e.preventDefault(); }
        else if (e.key === "4") { editorUI.focusGroup(3); e.preventDefault(); }
      }
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  const visibleRoot = createMemo(() => {
    const maxId = editorUI.maximizedGroupId();
    if (!maxId) return props.state.root;
    const found = findCell(props.state.root, maxId);
    return found ?? props.state.root;
  });

  const handleResize = (cellId: string, childIndex: number, delta: number, containerSize: number) => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);
    const cell = findCell(root, cellId);

    if (!cell || !cell.sizes || !cell.children) return;

    const currentSizes = [...cell.sizes];
    const deltaRatio = delta / containerSize;

    const minRatio = minCellSize() / containerSize;
    const newSize1 = Math.max(minRatio, Math.min(1 - minRatio, currentSizes[childIndex] + deltaRatio));
    const newSize2 = Math.max(minRatio, Math.min(1 - minRatio, currentSizes[childIndex + 1] - deltaRatio));

    if (newSize1 >= minRatio && newSize2 >= minRatio) {
      currentSizes[childIndex] = newSize1;
      currentSizes[childIndex + 1] = newSize2;

      const sum = currentSizes.reduce((a, b) => a + b, 0);
      cell.sizes = currentSizes.map((s) => s / sum);

      newState.root = replaceCell(root, cellId, cell);
      props.onStateChange(newState);
    }
  };

  const handleDoubleClickSash = (cellId: string, _childIndex: number) => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);
    const cell = findCell(root, cellId);

    if (!cell || !cell.children) return;

    const equalSize = 1 / cell.children.length;
    cell.sizes = cell.children.map(() => equalSize);

    newState.root = replaceCell(root, cellId, cell);
    props.onStateChange(newState);
  };

  const equalizeSplits = () => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);

    const equalizeChildren = (cell: GridCell) => {
      if (cell.children && cell.children.length > 0) {
        const equalSize = 1 / cell.children.length;
        cell.sizes = cell.children.map(() => equalSize);
        cell.children.forEach(equalizeChildren);
      }
    };

    equalizeChildren(root);
    newState.root = root;
    props.onStateChange(newState);
    editorUI.equalizeSplits();
  };

  if (containerRef) {
    (containerRef as HTMLDivElement & { equalizeSplits: typeof equalizeSplits }).equalizeSplits = equalizeSplits;
  }

  const handleCellActivate = (cellId: string) => {
    if (props.state.activeCell !== cellId) {
      props.onStateChange({
        ...props.state,
        activeCell: cellId,
      });
      props.onCellActivate?.(cellId);
    }
  };

  const handleEditorDrop = (cellId: string, data: string, position: DropPosition, mimeType?: string) => {
    const fileId = mimeType === "application/cortex-tab" ? data : data;
    if (props.onEditorDrop) {
      props.onEditorDrop(fileId, cellId, position);
    }
  };

  const renderCell = (cell: GridCell): JSX.Element => {
    const isActive = createMemo(() => {
      const leafIds = getLeafCellIds(cell);
      return leafIds.includes(props.state.activeCell);
    });

    return (
      <GridCellView
        cell={cell}
        isActive={isActive()}
        onActivate={() => {
          const leafIds = getLeafCellIds(cell);
          if (leafIds.length > 0) {
            handleCellActivate(leafIds[0]);
          }
        }}
        onResize={(index, delta, containerSize) => {
          handleResize(cell.id, index, delta, containerSize);
        }}
        onDoubleClickSash={(index) => handleDoubleClickSash(cell.id, index)}
        renderEditor={props.renderEditor}
        renderEmpty={props.renderEmpty}
        minCellSize={minCellSize()}
        depth={0}
        onDrop={(fileId, position, mimeType) => {
          const leafIds = getLeafCellIds(cell);
          if (leafIds.length > 0) {
            handleEditorDrop(leafIds[0], fileId, position, mimeType);
          }
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      class="editor-grid"
      style={{
        flex: "1",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {renderCell(visibleRoot())}
      <MaximizeRestoreButton
        groupId={editorUI.activeGroupId()}
        isMaximized={editorUI.isGroupMaximized()}
        onMaximize={() => editorUI.maximizeGroup(editorUI.activeGroupId())}
        onRestore={() => editorUI.restoreGroups()}
      />
    </div>
  );
};
