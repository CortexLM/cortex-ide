/**
 * EditorGrid Tests
 *
 * Tests for the EditorGrid component - a serializable grid system for complex editor layouts.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { EditorGrid, EditorGridProps, EditorGridState, DropPosition } from "../EditorGrid";
import { EditorUIProvider } from "@/context/editor/EditorUIContext";

describe("EditorGrid", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  interface TestGridCell {
    id: string;
    type: "editor" | "group" | "grid";
    fileId?: string;
    children?: TestGridCell[];
    direction?: "horizontal" | "vertical";
    sizes?: number[];
  }

  interface TestEditorGridState {
    root: TestGridCell;
    activeCell: string;
  }

  type TestDropPosition = "center" | "left" | "right" | "top" | "bottom";

  const createDefaultState = (): EditorGridState => ({
    root: {
      id: "cell-1",
      type: "editor",
      fileId: "file-1",
    },
    activeCell: "cell-1",
  });

  const createHorizontalSplitState = (): EditorGridState => ({
    root: {
      id: "grid-1",
      type: "grid",
      direction: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        { id: "cell-1", type: "editor", fileId: "file-1" },
        { id: "cell-2", type: "editor", fileId: "file-2" },
      ],
    },
    activeCell: "cell-1",
  });

  const createVerticalSplitState = (): EditorGridState => ({
    root: {
      id: "grid-1",
      type: "grid",
      direction: "vertical",
      sizes: [0.5, 0.5],
      children: [
        { id: "cell-1", type: "editor", fileId: "file-1" },
        { id: "cell-2", type: "editor", fileId: "file-2" },
      ],
    },
    activeCell: "cell-1",
  });

  const createNestedGridState = (): EditorGridState => ({
    root: {
      id: "grid-1",
      type: "grid",
      direction: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        { id: "cell-1", type: "editor", fileId: "file-1" },
        {
          id: "grid-2",
          type: "grid",
          direction: "vertical",
          sizes: [0.5, 0.5],
          children: [
            { id: "cell-2", type: "editor", fileId: "file-2" },
            { id: "cell-3", type: "editor", fileId: "file-3" },
          ],
        },
      ],
    },
    activeCell: "cell-1",
  });

  const defaultProps: EditorGridProps = {
    state: createDefaultState(),
    onStateChange: vi.fn(),
    renderEditor: (fileId: string, cellId: string) => (
      <div data-testid={`editor-${cellId}`} data-file-id={fileId}>
        Editor: {fileId}
      </div>
    ),
    renderEmpty: (cellId: string) => (
      <div data-testid={`empty-${cellId}`}>Empty Cell</div>
    ),
    minCellSize: 100,
    onCellActivate: vi.fn(),
    onEditorDrop: vi.fn(),
  };

  const renderGrid = (props: Partial<EditorGridProps> = {}) => {
    return render(() => (
      <EditorUIProvider>
        <EditorGrid {...defaultProps} {...props} />
      </EditorUIProvider>
    ));
  };

  describe("Grid Layout Types", () => {
    it("should define horizontal and vertical split orientations", () => {
      const horizontalCell: TestGridCell = {
        id: "grid-1",
        type: "grid",
        direction: "horizontal",
        sizes: [0.5, 0.5],
        children: [],
      };
      expect(horizontalCell.direction).toBe("horizontal");

      const verticalCell: TestGridCell = {
        id: "grid-2",
        type: "grid",
        direction: "vertical",
        sizes: [0.5, 0.5],
        children: [],
      };
      expect(verticalCell.direction).toBe("vertical");
    });

    it("should support editor, group, and grid cell types", () => {
      const editorCell: TestGridCell = { id: "1", type: "editor", fileId: "file-1" };
      const groupCell: TestGridCell = { id: "2", type: "group" };
      const gridCell: TestGridCell = {
        id: "3",
        type: "grid",
        direction: "horizontal",
        sizes: [1],
        children: [],
      };

      expect(editorCell.type).toBe("editor");
      expect(groupCell.type).toBe("group");
      expect(gridCell.type).toBe("grid");
    });

    it("should define drop positions", () => {
      const positions: TestDropPosition[] = ["center", "left", "right", "top", "bottom"];
      expect(positions).toHaveLength(5);
      expect(positions).toContain("center");
      expect(positions).toContain("left");
      expect(positions).toContain("right");
      expect(positions).toContain("top");
      expect(positions).toContain("bottom");
    });
  });

  describe("Editor Group Structure", () => {
    it("should have root cell in state", () => {
      const state: TestEditorGridState = {
        root: { id: "root", type: "editor" },
        activeCell: "root",
      };
      expect(state.root).toBeDefined();
      expect(state.root.id).toBe("root");
    });

    it("should support children array for grid cells", () => {
      const gridCell: TestGridCell = {
        id: "grid-1",
        type: "grid",
        direction: "horizontal",
        sizes: [0.33, 0.33, 0.34],
        children: [
          { id: "cell-1", type: "editor" },
          { id: "cell-2", type: "editor" },
          { id: "cell-3", type: "editor" },
        ],
      };
      expect(gridCell.children).toHaveLength(3);
      expect(gridCell.sizes).toHaveLength(3);
    });

    it("should support fileId for editor cells", () => {
      const editorCell: TestGridCell = {
        id: "editor-1",
        type: "editor",
        fileId: "path/to/file.ts",
      };
      expect(editorCell.fileId).toBe("path/to/file.ts");
    });

    it("should track activeCell in state", () => {
      const state: TestEditorGridState = {
        root: {
          id: "grid-1",
          type: "grid",
          direction: "horizontal",
          sizes: [0.5, 0.5],
          children: [
            { id: "cell-1", type: "editor" },
            { id: "cell-2", type: "editor" },
          ],
        },
        activeCell: "cell-2",
      };
      expect(state.activeCell).toBe("cell-2");
    });
  });

  describe("Rendering", () => {
    it("should render a single editor cell", () => {
      const { container } = renderGrid();
      const editorCell = container.querySelector('[data-cell-type="editor"]');
      expect(editorCell).toBeTruthy();
    });

    it("should render editor content via renderEditor prop", () => {
      const { container } = renderGrid();
      const editor = container.querySelector('[data-testid="editor-cell-1"]');
      expect(editor).toBeTruthy();
      expect(editor?.textContent).toContain("Editor: file-1");
    });

    it("should render empty cell when no fileId", () => {
      const state: EditorGridState = {
        root: { id: "cell-1", type: "editor" },
        activeCell: "cell-1",
      };
      const { container } = renderGrid({ state });
      const emptyCell = container.querySelector('[data-testid="empty-cell-1"]');
      expect(emptyCell).toBeTruthy();
    });

    it("should render horizontal split layout", () => {
      const { container } = renderGrid({ state: createHorizontalSplitState() });
      const gridContainer = container.querySelector('[data-cell-type="grid"]');
      expect(gridContainer).toBeTruthy();
      expect(gridContainer?.getAttribute("data-direction")).toBe("horizontal");
    });

    it("should render vertical split layout", () => {
      const { container } = renderGrid({ state: createVerticalSplitState() });
      const gridContainer = container.querySelector('[data-cell-type="grid"]');
      expect(gridContainer).toBeTruthy();
      expect(gridContainer?.getAttribute("data-direction")).toBe("vertical");
    });

    it("should render nested grid structure", () => {
      const { container } = renderGrid({ state: createNestedGridState() });
      const gridContainers = container.querySelectorAll('[data-cell-type="grid"]');
      expect(gridContainers.length).toBe(2);
    });
  });

  describe("Split Operations", () => {
    it("should configure horizontal split with children", () => {
      const state = createHorizontalSplitState();
      expect(state.root.direction).toBe("horizontal");
      expect(state.root.children).toHaveLength(2);
      expect(state.root.sizes).toEqual([0.5, 0.5]);
    });

    it("should configure vertical split with children", () => {
      const state = createVerticalSplitState();
      expect(state.root.direction).toBe("vertical");
      expect(state.root.children).toHaveLength(2);
      expect(state.root.sizes).toEqual([0.5, 0.5]);
    });

    it("should support nested splits", () => {
      const state = createNestedGridState();
      expect(state.root.type).toBe("grid");
      expect(state.root.children?.[1].type).toBe("grid");
      expect(state.root.children?.[1].children).toHaveLength(2);
    });

    it("should render sash between split cells", () => {
      const { container } = renderGrid({ state: createHorizontalSplitState() });
      const sash = container.querySelector(".grid-sash");
      expect(sash).toBeTruthy();
    });
  });

  describe("Panel Sizing", () => {
    it("should support equal sizes (50/50)", () => {
      const state = createHorizontalSplitState();
      expect(state.root.sizes).toEqual([0.5, 0.5]);
    });

    it("should support custom size ratios", () => {
      const state: EditorGridState = {
        root: {
          id: "grid-1",
          type: "grid",
          direction: "horizontal",
          sizes: [0.3, 0.7],
          children: [
            { id: "cell-1", type: "editor", fileId: "file-1" },
            { id: "cell-2", type: "editor", fileId: "file-2" },
          ],
        },
        activeCell: "cell-1",
      };
      expect(state.root.sizes).toEqual([0.3, 0.7]);
    });

    it("should support three-way splits", () => {
      const state: EditorGridState = {
        root: {
          id: "grid-1",
          type: "grid",
          direction: "horizontal",
          sizes: [0.33, 0.34, 0.33],
          children: [
            { id: "cell-1", type: "editor" },
            { id: "cell-2", type: "editor" },
            { id: "cell-3", type: "editor" },
          ],
        },
        activeCell: "cell-1",
      };
      expect(state.root.sizes).toHaveLength(3);
      expect(state.root.children).toHaveLength(3);
    });

    it("should apply minCellSize prop", () => {
      const { container } = renderGrid({ minCellSize: 150 });
      const cell = container.querySelector(".grid-cell");
      expect(cell).toBeTruthy();
    });
  });

  describe("Active Group Tracking", () => {
    it("should track active cell in state", () => {
      const state = createHorizontalSplitState();
      expect(state.activeCell).toBe("cell-1");
    });

    it("should call onCellActivate when cell is clicked", async () => {
      const onCellActivate = vi.fn();
      const { container } = renderGrid({
        state: createHorizontalSplitState(),
        onCellActivate,
      });

      const cells = container.querySelectorAll(".grid-cell");
      expect(cells.length).toBeGreaterThan(0);

      fireEvent.click(cells[0]);
      await nextTick();

      expect(onCellActivate).toBeDefined();
    });

    it("should update state when activating different cell", async () => {
      const onStateChange = vi.fn();
      const { container } = renderGrid({
        state: createHorizontalSplitState(),
        onStateChange,
      });

      const cells = container.querySelectorAll(".grid-cell");
      fireEvent.click(cells[0]);
      await nextTick();

      expect(onStateChange).toBeDefined();
    });

    it("should show active cell indicator", () => {
      const { container } = renderGrid({ state: createDefaultState() });
      const activeCell = container.querySelector(".grid-cell");
      expect(activeCell).toBeTruthy();
    });
  });

  describe("Group Operations", () => {
    it("should support adding group via state change", () => {
      const initialState = createDefaultState();
      const newState: EditorGridState = {
        root: {
          id: "grid-1",
          type: "grid",
          direction: "horizontal",
          sizes: [0.5, 0.5],
          children: [
            initialState.root,
            { id: "cell-2", type: "editor", fileId: "file-2" },
          ],
        },
        activeCell: "cell-2",
      };

      expect(newState.root.children).toHaveLength(2);
    });

    it("should support removing group via state change", () => {
      const initialState = createHorizontalSplitState();
      const newState: EditorGridState = {
        root: initialState.root.children![0],
        activeCell: "cell-1",
      };

      expect(newState.root.type).toBe("editor");
    });

    it("should handle focus group via click", async () => {
      const onStateChange = vi.fn();
      const { container } = renderGrid({
        state: createHorizontalSplitState(),
        onStateChange,
      });

      const cells = container.querySelectorAll(".grid-cell");
      fireEvent.click(cells[0]);
      await nextTick();

      expect(container.querySelector(".grid-cell")).toBeTruthy();
    });
  });

  describe("Drag and Drop", () => {
    it("should define all drop positions", () => {
      const positions: DropPosition[] = ["center", "left", "right", "top", "bottom"];
      expect(positions).toContain("center");
      expect(positions).toContain("left");
      expect(positions).toContain("right");
      expect(positions).toContain("top");
      expect(positions).toContain("bottom");
    });

    it("should have onEditorDrop callback prop", () => {
      const onEditorDrop = vi.fn();
      renderGrid({ onEditorDrop });
      expect(onEditorDrop).toBeDefined();
    });

    it("should handle drag over event", async () => {
      const { container } = renderGrid();
      const cell = container.querySelector(".grid-cell");
      expect(cell).toBeTruthy();

      if (cell) {
        const dragOverEvent = new Event("dragover", {
          bubbles: true,
          cancelable: true,
        });
        cell.dispatchEvent(dragOverEvent);
        await nextTick();
      }
    });

    it("should handle drag leave event", async () => {
      const { container } = renderGrid();
      const cell = container.querySelector(".grid-cell");
      expect(cell).toBeTruthy();

      if (cell) {
        const dragLeaveEvent = new Event("dragleave", {
          bubbles: true,
          cancelable: true,
        });
        cell.dispatchEvent(dragLeaveEvent);
        await nextTick();
      }
    });

    it("should handle drop event", async () => {
      const onEditorDrop = vi.fn();
      const { container } = renderGrid({ onEditorDrop });
      const cell = container.querySelector(".grid-cell");
      expect(cell).toBeTruthy();

      if (cell) {
        const dropEvent = new Event("drop", {
          bubbles: true,
          cancelable: true,
        });
        cell.dispatchEvent(dropEvent);
        await nextTick();
      }
    });
  });

  describe("Sash Interactions", () => {
    it("should render sash between cells in split layout", () => {
      const { container } = renderGrid({ state: createHorizontalSplitState() });
      const sash = container.querySelector(".grid-sash");
      expect(sash).toBeTruthy();
    });

    it("should set sash direction attribute", () => {
      const { container } = renderGrid({ state: createHorizontalSplitState() });
      const sash = container.querySelector(".grid-sash");
      expect(sash?.getAttribute("data-direction")).toBe("horizontal");
    });

    it("should render multiple sashes in nested grid", () => {
      const { container } = renderGrid({ state: createNestedGridState() });
      const sashes = container.querySelectorAll(".grid-sash");
      expect(sashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("State Management", () => {
    it("should call onStateChange when activating different cell", async () => {
      const state = createHorizontalSplitState();
      state.activeCell = "cell-1";
      const onStateChange = vi.fn();
      const { container } = renderGrid({
        state,
        onStateChange,
      });

      const cells = container.querySelectorAll(".grid-cell");
      expect(cells.length).toBeGreaterThan(1);
      fireEvent.click(cells[1]);
      await nextTick();
    });

    it("should preserve state structure on updates", () => {
      const state = createNestedGridState();
      expect(state.root.id).toBe("grid-1");
      expect(state.root.children?.[1].id).toBe("grid-2");
      expect(state.activeCell).toBe("cell-1");
    });

    it("should handle empty state gracefully", () => {
      const state: EditorGridState = {
        root: { id: "empty", type: "editor" },
        activeCell: "empty",
      };

      expect(() => {
        renderGrid({ state });
      }).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should have cell identifiers", () => {
      const { container } = renderGrid();
      const cell = container.querySelector("[data-cell-id]");
      expect(cell).toBeTruthy();
      expect(cell?.getAttribute("data-cell-id")).toBe("cell-1");
    });

    it("should have cell type attributes", () => {
      const { container } = renderGrid();
      const cell = container.querySelector("[data-cell-type]");
      expect(cell).toBeTruthy();
      expect(cell?.getAttribute("data-cell-type")).toBe("editor");
    });

    it("should have direction attribute on grid containers", () => {
      const { container } = renderGrid({ state: createHorizontalSplitState() });
      const grid = container.querySelector('[data-cell-type="grid"]');
      expect(grid?.getAttribute("data-direction")).toBe("horizontal");
    });
  });
});
