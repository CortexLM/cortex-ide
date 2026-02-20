import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexFileExplorer } from "../CortexFileExplorer";
import type { CortexFileExplorerProps } from "../CortexFileExplorer";

interface TreeItemData {
  id: string;
  name: string;
  type: "file" | "folder";
  icon?: string;
  isExpanded?: boolean;
  children?: TreeItemData[];
}

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
  CortexTooltip: (props: { content: string; position?: string; children: import("solid-js").JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
  CortexTreeItem: (props: {
    item: TreeItemData;
    level: number;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (item: TreeItemData) => void;
    onToggle: (item: TreeItemData) => void;
  }) => (
    <div
      data-testid={`tree-item-${props.item.id}`}
      data-selected={props.isSelected}
      data-expanded={props.isExpanded}
      onClick={() => props.onSelect(props.item)}
      onDblClick={() => props.onToggle(props.item)}
    >
      {props.item.name}
    </div>
  ),
}));

describe("CortexFileExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct TreeItemData interface structure", () => {
      const item: TreeItemData = {
        id: "folder-1",
        name: "src",
        type: "folder",
        icon: "folder",
        isExpanded: true,
        children: [
          { id: "file-1", name: "index.ts", type: "file", icon: "file-code" },
        ],
      };

      expect(item.id).toBe("folder-1");
      expect(item.type).toBe("folder");
      expect(item.children).toHaveLength(1);
    });

    it("should have correct CortexFileExplorerProps interface structure", () => {
      const props: CortexFileExplorerProps = {
        title: "Project",
        items: [],
        selectedId: "1",
        expandedIds: new Set(["folder-1"]),
        onSelect: vi.fn(),
        onToggle: vi.fn(),
        onSearch: vi.fn(),
        onAdd: vi.fn(),
        onRefresh: vi.fn(),
        onCollapseAll: vi.fn(),
        onContextMenu: vi.fn(),
        projectType: "Docker",
        projectName: "my-project",
        class: "custom-class",
        style: { width: "300px" },
      };

      expect(props.title).toBe("Project");
      expect(props.expandedIds?.has("folder-1")).toBe(true);
    });
  });

  describe("Rendering", () => {
    it("should render with default sample data when no items provided", () => {
      const { container } = render(() => <CortexFileExplorer />);
      const treeItems = container.querySelectorAll('[data-testid^="tree-item-"]');
      expect(treeItems.length).toBeGreaterThan(0);
    });

    it("should render custom items when provided", () => {
      const customItems: TreeItemData[] = [
        { id: "1", name: "folder1", type: "folder" },
        { id: "2", name: "file1.ts", type: "file" },
      ];

      const { getByTestId } = render(() => <CortexFileExplorer items={customItems} />);
      expect(getByTestId("tree-item-1")).toBeTruthy();
      expect(getByTestId("tree-item-2")).toBeTruthy();
    });

    it("should render header with title", () => {
      const { container } = render(() => <CortexFileExplorer title="My Project" />);
      const header = container.querySelector("header");
      expect(header?.textContent).toContain("My Project");
    });

    it("should render default title when not provided", () => {
      const { container } = render(() => <CortexFileExplorer />);
      const header = container.querySelector("header");
      expect(header?.textContent).toContain("Project");
    });

    it("should render header action buttons", () => {
      const { container } = render(() => <CortexFileExplorer />);
      const searchIcon = container.querySelector('[data-testid="icon-search"]');
      const plusIcon = container.querySelector('[data-testid="icon-plus"]');
      const refreshIcon = container.querySelector('[data-testid="icon-refresh"]');
      
      expect(searchIcon).toBeTruthy();
      expect(plusIcon).toBeTruthy();
      expect(refreshIcon).toBeTruthy();
    });

    it("should render footer with project info", () => {
      const { container } = render(() => (
        <CortexFileExplorer projectType="Docker" projectName="my-app" />
      ));
      const footer = container.querySelector("footer");
      expect(footer?.textContent).toContain("my-app");
    });

    it("should render footer with default project name", () => {
      const { container } = render(() => <CortexFileExplorer projectType="Node" />);
      const footer = container.querySelector("footer");
      expect(footer?.textContent).toContain("Node Project");
    });
  });

  describe("State Management", () => {
    it("should track selected item internally when not controlled", async () => {
      const items: TreeItemData[] = [
        { id: "1", name: "file1.ts", type: "file" },
        { id: "2", name: "file2.ts", type: "file" },
      ];

      const { getByTestId } = render(() => <CortexFileExplorer items={items} />);

      const item1 = getByTestId("tree-item-1");
      await fireEvent.click(item1);

      expect(item1.getAttribute("data-selected")).toBe("true");
    });

    it("should use controlled selectedId when provided", () => {
      const items: TreeItemData[] = [
        { id: "1", name: "file1.ts", type: "file" },
        { id: "2", name: "file2.ts", type: "file" },
      ];

      const { getByTestId } = render(() => (
        <CortexFileExplorer items={items} selectedId="2" />
      ));

      expect(getByTestId("tree-item-2").getAttribute("data-selected")).toBe("true");
    });

    it("should track expanded items internally when not controlled", async () => {
      const items: TreeItemData[] = [
        { id: "folder-1", name: "src", type: "folder", children: [] },
      ];

      const { getByTestId } = render(() => <CortexFileExplorer items={items} />);

      const folder = getByTestId("tree-item-folder-1");
      await fireEvent.dblClick(folder);

      expect(folder.getAttribute("data-expanded")).toBe("true");
    });

    it("should use controlled expandedIds when provided", () => {
      const items: TreeItemData[] = [
        { id: "folder-1", name: "src", type: "folder", children: [] },
      ];

      const { getByTestId } = render(() => (
        <CortexFileExplorer items={items} expandedIds={new Set(["folder-1"])} />
      ));

      expect(getByTestId("tree-item-folder-1").getAttribute("data-expanded")).toBe("true");
    });
  });

  describe("User Interactions", () => {
    it("should call onSelect when item is clicked", async () => {
      const onSelect = vi.fn();
      const items: TreeItemData[] = [
        { id: "1", name: "file1.ts", type: "file" },
      ];

      const { getByTestId } = render(() => (
        <CortexFileExplorer items={items} onSelect={onSelect} />
      ));

      await fireEvent.click(getByTestId("tree-item-1"));

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    });

    it("should call onToggle when folder is toggled", async () => {
      const onToggle = vi.fn();
      const items: TreeItemData[] = [
        { id: "folder-1", name: "src", type: "folder", children: [] },
      ];

      const { getByTestId } = render(() => (
        <CortexFileExplorer items={items} onToggle={onToggle} />
      ));

      await fireEvent.dblClick(getByTestId("tree-item-folder-1"));

      expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "folder-1" }));
    });

    it("should call onSearch when search button is clicked", async () => {
      const onSearch = vi.fn();

      const { container } = render(() => <CortexFileExplorer onSearch={onSearch} />);

      const searchButton = container.querySelector('[aria-label="Search (Ctrl+Shift+F)"]');
      if (searchButton) {
        await fireEvent.click(searchButton);
      }

      expect(onSearch).toHaveBeenCalled();
    });

    it("should call onAdd when add button is clicked", async () => {
      const onAdd = vi.fn();

      const { container } = render(() => <CortexFileExplorer onAdd={onAdd} />);

      const addButton = container.querySelector('[aria-label="New File"]');
      if (addButton) {
        await fireEvent.click(addButton);
      }

      expect(onAdd).toHaveBeenCalled();
    });

    it("should call onRefresh when refresh button is clicked", async () => {
      const onRefresh = vi.fn();

      const { container } = render(() => <CortexFileExplorer onRefresh={onRefresh} />);

      const refreshButton = container.querySelector('[aria-label="Refresh"]');
      if (refreshButton) {
        await fireEvent.click(refreshButton);
      }

      expect(onRefresh).toHaveBeenCalled();
    });

    it("should call onCollapseAll when collapse button is clicked", async () => {
      const onCollapseAll = vi.fn();

      const { container } = render(() => <CortexFileExplorer onCollapseAll={onCollapseAll} />);

      const collapseButton = container.querySelector('[aria-label="Collapse All"]');
      if (collapseButton) {
        await fireEvent.click(collapseButton);
      }

      expect(onCollapseAll).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => <CortexFileExplorer class="custom-class" />);
      const div = container.firstChild as HTMLElement;
      expect(div?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexFileExplorer style={{ "background-color": "blue" }} />
      ));
      const div = container.firstChild as HTMLElement;
      expect(div?.style.backgroundColor).toBe("blue");
    });

    it("should have correct container width of 317px", () => {
      const { container } = render(() => <CortexFileExplorer />);
      const div = container.firstChild as HTMLElement;
      expect(div?.style.width).toBe("317px");
    });
  });
});
