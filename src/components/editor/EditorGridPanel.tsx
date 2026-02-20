/**
 * EditorGridPanel - Grid-based editor layout component
 * 
 * This component provides an alternative to MultiBuffer with a more
 * flexible grid-based layout system that supports:
 * - Complex N×M arrangements
 * - Nested grids
 * - Drag to resize
 * - Drop editors into cells or edges to split
 * - Persistent layout state
 */

import {
  Show,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  type JSX,
} from "solid-js";
import { EditorGrid, type EditorGridState, type DropPosition } from "./EditorGrid";
import { useEditor } from "@/context/EditorContext";
import { CodeEditor } from "./CodeEditor";
import { ImageViewer, isImageFile, SVGPreview, isSVGFile } from "../viewers";
import { Card, Text } from "@/components/ui";
import { Icon } from "../ui/Icon";
import {
  createSingleEditorLayout,
  splitCell,
  create2x2Layout,
  create3ColumnLayout,
} from "@/utils/gridSerializer";

// ============================================================================
// Empty Cell State
// ============================================================================

interface EmptyCellProps {
  cellId: string;
  onDrop?: (fileId: string) => void;
}

function EmptyCellState(props: EmptyCellProps) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fileId = e.dataTransfer?.getData("text/plain");
    if (fileId && props.onDrop) {
      props.onDrop(fileId);
    }
  };

  const kbdStyle: JSX.CSSProperties = {
    padding: "2px 8px",
    background: "var(--jb-surface-active)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-sm)",
    "font-family": "var(--jb-font-mono)",
    "font-size": "var(--jb-text-muted-size)",
  };

  return (
    <div
      style={{
        flex: "1",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background: isDragOver()
          ? "var(--accent-subtle, rgba(0, 122, 204, 0.1))"
          : "var(--jb-canvas)",
        border: isDragOver() ? "2px dashed var(--accent)" : "none",
        transition: "all 150ms ease",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Card padding="lg" style={{ "text-align": "center", "max-width": "280px" }}>
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            gap: "12px",
          }}
        >
          <Icon name="file"
            style={{
              width: "32px",
              height: "32px",
              color: "var(--jb-text-muted-color)",
            }}
          />
          <Text variant="body">No file open</Text>
          <Text variant="muted" size="sm">
            Drag a file here or use keyboard shortcuts
          </Text>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              gap: "8px",
              "margin-top": "4px",
            }}
          >
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                gap: "8px",
              }}
            >
              <kbd style={kbdStyle}>Ctrl+P</kbd>
              <Text variant="muted" size="sm">
                Open file
              </Text>
            </div>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                gap: "8px",
              }}
            >
              <kbd style={kbdStyle}>Ctrl+\</kbd>
              <Text variant="muted" size="sm">
                Split right
              </Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Editor Cell Renderer
// ============================================================================

interface EditorCellRendererProps {
  fileId: string;
  cellId: string;
  isActive: boolean;
}

function EditorCellRenderer(props: EditorCellRendererProps) {
  const { state, updateFileContent } = useEditor();

  const file = createMemo(() => state.openFiles.find((f) => f.id === props.fileId));

  // Determine content type
  const isSvg = createMemo(() => {
    const f = file();
    return f ? isSVGFile(f.name) : false;
  });

  const isNonSvgImage = createMemo(() => {
    const f = file();
    return f ? isImageFile(f.name) && !isSvg() : false;
  });

  return (
    <Show when={file()} fallback={<EmptyCellState cellId={props.cellId} />}>
      {(fileAccessor) => (
        <div
          class="editor-cell flex-1 flex flex-col min-h-0 overflow-hidden"
          style={{
            outline: props.isActive ? "2px solid var(--accent)" : "none",
            "outline-offset": "-2px",
          }}
        >
          {/* Content based on file type */}
          <Show
            when={isSvg()}
            fallback={
              <Show
                when={isNonSvgImage()}
                fallback={<CodeEditor file={fileAccessor()} groupId={props.cellId} />}
              >
                <ImageViewer path={fileAccessor().path} name={fileAccessor().name} />
              </Show>
            }
          >
            <SVGPreview
              content={fileAccessor().content}
              filePath={fileAccessor().path}
              fileName={fileAccessor().name}
              onContentChange={(content) => updateFileContent(fileAccessor().id, content)}
            />
          </Show>
        </div>
      )}
    </Show>
  );
}

// ============================================================================
// Grid Toolbar
// ============================================================================

interface GridToolbarProps {
  onSplitRight: () => void;
  onSplitDown: () => void;
  onCreate2x2: () => void;
  onCreate3Column: () => void;
  onReset: () => void;
}

function GridToolbar(props: GridToolbarProps) {
  return (
    <div
      class="grid-toolbar"
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "4px 8px",
        "border-bottom": "1px solid var(--border-weak)",
        background: "var(--surface-base)",
        "flex-shrink": "0",
      }}
    >
      <button
        class="toolbar-btn"
        onClick={props.onSplitRight}
        title="Split Editor Right (Ctrl+\)"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "4px",
          background: "transparent",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          cursor: "pointer",
          color: "var(--text-weak)",
        }}
      >
        <Icon name="columns" style={{ width: "14px", height: "14px" }} />
      </button>
      <button
        class="toolbar-btn"
        onClick={props.onSplitDown}
        title="Split Editor Down (Ctrl+K Ctrl+\)"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "4px",
          background: "transparent",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          cursor: "pointer",
          color: "var(--text-weak)",
        }}
      >
        <Icon name="table-columns" style={{ width: "14px", height: "14px" }} />
      </button>
      <div style={{ width: "1px", height: "16px", background: "var(--border-weak)" }} />
      <button
        class="toolbar-btn"
        onClick={props.onCreate2x2}
        title="Create 2x2 Grid"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "4px",
          background: "transparent",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          cursor: "pointer",
          color: "var(--text-weak)",
        }}
      >
        <Icon name="grid" style={{ width: "14px", height: "14px" }} />
      </button>
      <button
        class="toolbar-btn"
        onClick={props.onCreate3Column}
        title="Create 3 Column Layout"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "4px 8px",
          background: "transparent",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          cursor: "pointer",
          color: "var(--text-weak)",
          "font-size": "11px",
        }}
      >
        3-Col
      </button>
      <div style={{ flex: "1" }} />
      <button
        class="toolbar-btn"
        onClick={props.onReset}
        title="Reset to Single Editor"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "4px 8px",
          background: "transparent",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          cursor: "pointer",
          color: "var(--text-weak)",
          "font-size": "11px",
        }}
      >
        Reset
      </button>
    </div>
  );
}

// ============================================================================
// Main EditorGridPanel Component
// ============================================================================

export function EditorGridPanel() {
  const {
    state,
    gridState,
    updateGridState,
    splitEditorInGrid,
    setActiveFile,
    moveEditorToGridCell,
  } = useEditor();

  // Initialize grid state if not present
  const ensureGridState = (): EditorGridState => {
    if (gridState) return gridState;
    const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
    return createSingleEditorLayout(activeFile?.id);
  };

  // Handle state changes from the grid
  const handleStateChange = (newState: EditorGridState) => {
    updateGridState(newState);
  };

  // Handle cell activation
  const handleCellActivate = (cellId: string) => {
    // Find the file ID in this cell and activate it
    const currentState = ensureGridState();
    const findFileInCell = (cell: any): string | undefined => {
      if (cell.id === cellId && cell.fileId) return cell.fileId;
      if (cell.children) {
        for (const child of cell.children) {
          const found = findFileInCell(child);
          if (found) return found;
        }
      }
      return undefined;
    };
    const fileId = findFileInCell(currentState.root);
    if (fileId) {
      setActiveFile(fileId);
    }
  };

  // Handle editor drop into cells
  const handleEditorDrop = (fileId: string, targetCellId: string, position: DropPosition) => {
    const currentState = ensureGridState();

    if (position === "center") {
      // Move editor to this cell
      moveEditorToGridCell(fileId, targetCellId);
    } else {
      // Split the cell
      const direction = position === "left" || position === "right" ? "vertical" : "horizontal";
      const newState = splitCell(currentState, targetCellId, direction, fileId);
      updateGridState(newState);
    }
  };

  // Render an editor for a cell
  const renderEditor = (fileId: string, cellId: string): JSX.Element => {
    const currentState = ensureGridState();
    const isActive = currentState.activeCell === cellId;
    return <EditorCellRenderer fileId={fileId} cellId={cellId} isActive={isActive} />;
  };

  // Render empty cell
  const renderEmpty = (cellId: string): JSX.Element => {
    return (
      <EmptyCellState
        cellId={cellId}
        onDrop={(fileId) => moveEditorToGridCell(fileId, cellId)}
      />
    );
  };

  // Toolbar actions
  const handleSplitRight = () => {
    splitEditorInGrid("vertical");
  };

  const handleSplitDown = () => {
    splitEditorInGrid("horizontal");
  };

  const handleCreate2x2 = () => {
    const files = state.openFiles.slice(0, 4);
    const fileIds = files.map((f) => f.id);
    const newState = create2x2Layout([fileIds[0], fileIds[1], fileIds[2], fileIds[3]]);
    updateGridState(newState);
  };

  const handleCreate3Column = () => {
    const files = state.openFiles.slice(0, 3);
    const fileIds = files.map((f) => f.id);
    const newState = create3ColumnLayout([fileIds[0], fileIds[1], fileIds[2]]);
    updateGridState(newState);
  };

  const handleReset = () => {
    const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
    const newState = createSingleEditorLayout(activeFile?.id);
    updateGridState(newState);
  };

  // Keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+\ : Split right
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "\\") {
        e.preventDefault();
        handleSplitRight();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const currentGridState = createMemo(() => ensureGridState());

  return (
    <div
      class="editor-grid-panel flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{
        position: "relative",
        background: "var(--vscode-editor-background, var(--cortex-bg-base))",
      }}
    >
      {/* Grid Toolbar */}
      <GridToolbar
        onSplitRight={handleSplitRight}
        onSplitDown={handleSplitDown}
        onCreate2x2={handleCreate2x2}
        onCreate3Column={handleCreate3Column}
        onReset={handleReset}
      />

      {/* Main Grid */}
      <div class="flex-1 flex overflow-hidden">
        <EditorGrid
          state={currentGridState()}
          onStateChange={handleStateChange}
          renderEditor={renderEditor}
          renderEmpty={renderEmpty}
          minCellSize={150}
          onCellActivate={handleCellActivate}
          onEditorDrop={handleEditorDrop}
        />
      </div>
    </div>
  );
}

export default EditorGridPanel;

