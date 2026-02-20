/**
 * GridCellView - Recursive grid cell renderer for the EditorGrid system.
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
  type Component,
} from "solid-js";
import { GridSash } from "../GridSash";
import type { GridCell, DropPosition } from "./types";
import { EDGE_DROP_THRESHOLD } from "./types";

export interface GridCellViewProps {
  cell: GridCell;
  isActive: boolean;
  onActivate: () => void;
  onResize: (index: number, delta: number, containerSize: number) => void;
  onDoubleClickSash: (index: number) => void;
  renderEditor: (fileId: string, cellId: string) => JSX.Element;
  renderEmpty?: (cellId: string) => JSX.Element;
  minCellSize: number;
  depth: number;
  onDrop?: (fileId: string, position: DropPosition, mimeType?: string) => void;
}

export const GridCellView: Component<GridCellViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [dropPosition, setDropPosition] = createSignal<DropPosition | null>(null);

  // Calculate sizes as CSS flex values
  const flexSizes = createMemo(() => {
    if (!props.cell.children || !props.cell.sizes) return [];
    return props.cell.sizes.map((size) => `${size * 100}%`);
  });

  const isVertical = () => props.cell.direction === "vertical";

  // Handle drag events for dropping editors
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (props.cell.type !== "editor" && props.cell.type !== "group") return;
    
    setIsDragOver(true);
    
    const rect = containerRef?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Determine drop position based on cursor location
    if (x < EDGE_DROP_THRESHOLD) {
      setDropPosition("left");
    } else if (x > 1 - EDGE_DROP_THRESHOLD) {
      setDropPosition("right");
    } else if (y < EDGE_DROP_THRESHOLD) {
      setDropPosition("top");
    } else if (y > 1 - EDGE_DROP_THRESHOLD) {
      setDropPosition("bottom");
    } else {
      setDropPosition("center");
    }
    
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPosition(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const tabData = e.dataTransfer?.getData("application/cortex-tab");
    const plainData = e.dataTransfer?.getData("text/plain");
    const fileId = tabData || plainData;
    const mimeType = tabData ? "application/cortex-tab" : "text/plain";
    const pos = dropPosition();
    
    setIsDragOver(false);
    setDropPosition(null);
    
    if (fileId && pos && props.onDrop) {
      props.onDrop(fileId, pos, mimeType);
    }
  };

  // Render drop indicator overlay
  const renderDropIndicator = () => {
    const pos = dropPosition();
    if (!isDragOver() || !pos) return null;

    const indicatorStyle: JSX.CSSProperties = {
      position: "absolute",
      background: "var(--accent)",
      opacity: "0.3",
      "pointer-events": "none",
      transition: "all 150ms ease",
      "z-index": "10",
    };

    switch (pos) {
      case "left":
        return <div style={{ ...indicatorStyle, left: "0", top: "0", width: "50%", height: "100%" }} />;
      case "right":
        return <div style={{ ...indicatorStyle, right: "0", top: "0", width: "50%", height: "100%" }} />;
      case "top":
        return <div style={{ ...indicatorStyle, left: "0", top: "0", width: "100%", height: "50%" }} />;
      case "bottom":
        return <div style={{ ...indicatorStyle, left: "0", bottom: "0", width: "100%", height: "50%" }} />;
      case "center":
        return <div style={{ ...indicatorStyle, inset: "8px", "border-radius": "var(--cortex-radius-sm)" }} />;
    }
  };

  // Render leaf cell (editor or group)
  if (props.cell.type === "editor" || props.cell.type === "group") {
    return (
      <div
        ref={containerRef}
        class={`grid-cell${isDragOver() ? " border-2 border-accent" : ""}`}
        style={{
          flex: "1",
          display: "flex",
          "flex-direction": "column",
          position: "relative",
          "min-width": `${props.minCellSize}px`,
          "min-height": `${props.minCellSize}px`,
          overflow: "hidden",
          outline: props.isActive ? "2px solid var(--accent)" : "none",
          "outline-offset": "-2px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          props.onActivate();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-cell-id={props.cell.id}
        data-cell-type={props.cell.type}
      >
        <Show
          when={props.cell.fileId}
          fallback={props.renderEmpty?.(props.cell.id) ?? <div class="empty-cell" />}
        >
          {props.renderEditor(props.cell.fileId!, props.cell.id)}
        </Show>
        {renderDropIndicator()}
      </div>
    );
  }

  // Render grid cell with children
  if (props.cell.type === "grid" && props.cell.children) {
    return (
      <div
        ref={containerRef}
        class="grid-container"
        style={{
          flex: "1",
          display: "flex",
          "flex-direction": isVertical() ? "row" : "column",
          position: "relative",
          overflow: "hidden",
          "min-width": `${props.minCellSize}px`,
          "min-height": `${props.minCellSize}px`,
        }}
        data-cell-id={props.cell.id}
        data-cell-type="grid"
        data-direction={props.cell.direction}
      >
        <For each={props.cell.children}>
          {(child, index) => (
            <>
              <div
                style={{
                  flex: `0 0 ${flexSizes()[index()]}`,
                  display: "flex",
                  overflow: "hidden",
                  "min-width": isVertical() ? `${props.minCellSize}px` : undefined,
                  "min-height": !isVertical() ? `${props.minCellSize}px` : undefined,
                }}
              >
                <GridCellView
                  cell={child}
                  isActive={props.isActive}
                  onActivate={props.onActivate}
                  onResize={(i, delta, size) => {
                    // Pass resize up to parent with correct indices
                    props.onResize(i, delta, size);
                  }}
                  onDoubleClickSash={(i) => props.onDoubleClickSash(i)}
                  renderEditor={props.renderEditor}
                  renderEmpty={props.renderEmpty}
                  minCellSize={props.minCellSize}
                  depth={props.depth + 1}
                  onDrop={props.onDrop}
                />
              </div>
              {/* Add sash between children */}
              <Show when={index() < props.cell.children!.length - 1}>
                <GridSash
                  direction={props.cell.direction!}
                  onResize={(delta) => {
                    const containerSize = isVertical()
                      ? containerRef?.clientWidth ?? 0
                      : containerRef?.clientHeight ?? 0;
                    props.onResize(index(), delta, containerSize);
                  }}
                  onDoubleClick={() => props.onDoubleClickSash(index())}
                />
              </Show>
            </>
          )}
        </For>
      </div>
    );
  }

  return null;
};
