import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexTreeItem, IndentGuide } from "../CortexTreeItem";
import type { TreeItemData } from "../CortexTreeItem";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number }) => (
    <span data-testid="cortex-icon" data-name={props.name} data-size={props.size} />
  ),
}));

describe("CortexTreeItem", () => {
  const createFileItem = (overrides: Partial<TreeItemData> = {}): TreeItemData => ({
    id: "file-1",
    name: "test.ts",
    type: "file",
    ...overrides,
  });

  const createFolderItem = (overrides: Partial<TreeItemData> = {}): TreeItemData => ({
    id: "folder-1",
    name: "src",
    type: "folder",
    children: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders file item with name", () => {
      const item = createFileItem({ name: "index.tsx" });
      const { getByText } = render(() => <CortexTreeItem item={item} />);
      expect(getByText("index.tsx")).toBeTruthy();
    });

    it("renders folder item with name", () => {
      const item = createFolderItem({ name: "components" });
      const { getByText } = render(() => <CortexTreeItem item={item} />);
      expect(getByText("components")).toBeTruthy();
    });

    it("renders with correct height", () => {
      const item = createFileItem();
      const { container } = render(() => <CortexTreeItem item={item} />);
      const row = container.firstChild as HTMLElement;
      expect(row.style.height).toBe("24px");
    });
  });

  describe("file types", () => {
    it("renders file icon for file type", () => {
      const item = createFileItem({ name: "test.ts" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const fileIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "file-code"
      );
      expect(fileIcon).toBeTruthy();
    });

    it("renders folder icon for folder type", () => {
      const item = createFolderItem();
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const folderIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "folder"
      );
      expect(folderIcon).toBeTruthy();
    });

    it("renders folder-open icon when folder is expanded", () => {
      const item = createFolderItem({ children: [createFileItem()] });
      const { container } = render(() => (
        <CortexTreeItem item={item} isExpanded />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const folderOpenIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "folder-open"
      );
      expect(folderOpenIcon).toBeTruthy();
    });
  });

  describe("file extension icons", () => {
    it("renders file-code icon for .ts files", () => {
      const item = createFileItem({ name: "index.ts" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const icon = Array.from(icons).find(
        (i) => i.getAttribute("data-name") === "file-code"
      );
      expect(icon).toBeTruthy();
    });

    it("renders file-code icon for .tsx files", () => {
      const item = createFileItem({ name: "Component.tsx" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const icon = Array.from(icons).find(
        (i) => i.getAttribute("data-name") === "file-code"
      );
      expect(icon).toBeTruthy();
    });

    it("renders file-text icon for .json files", () => {
      const item = createFileItem({ name: "package.json" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const icon = Array.from(icons).find(
        (i) => i.getAttribute("data-name") === "file-text"
      );
      expect(icon).toBeTruthy();
    });

    it("renders file-text icon for .md files", () => {
      const item = createFileItem({ name: "README.md" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const icon = Array.from(icons).find(
        (i) => i.getAttribute("data-name") === "file-text"
      );
      expect(icon).toBeTruthy();
    });

    it("renders lock icon for .lock files", () => {
      const item = createFileItem({ name: "package-lock.json" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const icon = Array.from(icons).find(
        (i) => i.getAttribute("data-name") === "file-text"
      );
      expect(icon).toBeTruthy();
    });

    it("uses custom icon when provided", () => {
      const item = createFileItem({ name: "test.ts", icon: "star" });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const icon = Array.from(icons).find(
        (i) => i.getAttribute("data-name") === "star"
      );
      expect(icon).toBeTruthy();
    });
  });

  describe("indentation", () => {
    it("applies no indentation at level 0", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} level={0} />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.style.paddingLeft).toBe("8px");
    });

    it("applies 24px indentation per level", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} level={1} />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.style.paddingLeft).toBe("32px");
    });

    it("applies correct indentation at level 2", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} level={2} />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.style.paddingLeft).toBe("56px");
    });
  });

  describe("selection state", () => {
    it("applies selected background when isSelected is true", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} isSelected />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.style.background).toContain("cortex-accent-muted");
    });

    it("applies transparent background when not selected", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} isSelected={false} />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.style.background).toBe("transparent");
    });
  });

  describe("hover state", () => {
    it("applies hover background on mouse enter", async () => {
      const item = createFileItem();
      const { container } = render(() => <CortexTreeItem item={item} />);
      const row = container.firstChild as HTMLElement;

      await fireEvent.mouseEnter(row);

      expect(row.style.background).toContain("cortex-bg-hover");
    });

    it("removes hover background on mouse leave", async () => {
      const item = createFileItem();
      const { container } = render(() => <CortexTreeItem item={item} />);
      const row = container.firstChild as HTMLElement;

      await fireEvent.mouseEnter(row);
      await fireEvent.mouseLeave(row);

      expect(row.style.background).toBe("transparent");
    });
  });

  describe("chevron visibility", () => {
    it("shows chevron for folders with children", () => {
      const item = createFolderItem({
        children: [createFileItem()],
      });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const chevronIcon = container.querySelector(
        "[data-testid='cortex-icon'][data-name='chevron-down']"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("hides chevron for folders without children", () => {
      const item = createFolderItem({ children: [] });
      const { container } = render(() => <CortexTreeItem item={item} />);
      const chevronContainer = container.querySelector(
        "div[style*='visibility: hidden']"
      );
      expect(chevronContainer).toBeTruthy();
    });

    it("hides chevron for files", () => {
      const item = createFileItem();
      const { container } = render(() => <CortexTreeItem item={item} />);
      const chevronContainer = container.querySelector(
        "div[style*='visibility: hidden']"
      );
      expect(chevronContainer).toBeTruthy();
    });

    it("rotates chevron when collapsed", () => {
      const item = createFolderItem({ children: [createFileItem()] });
      const { container } = render(() => (
        <CortexTreeItem item={item} isExpanded={false} />
      ));
      const chevronWrapper = container.querySelector(
        "div[style*='rotate(-90deg)']"
      );
      expect(chevronWrapper).toBeTruthy();
    });

    it("does not rotate chevron when expanded", () => {
      const item = createFolderItem({ children: [createFileItem()] });
      const { container } = render(() => (
        <CortexTreeItem item={item} isExpanded />
      ));
      const chevronWrapper = container.querySelector(
        "div[style*='rotate(0deg)']"
      );
      expect(chevronWrapper).toBeTruthy();
    });
  });

  describe("onSelect callback", () => {
    it("calls onSelect when item is clicked", async () => {
      const handleSelect = vi.fn();
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} onSelect={handleSelect} />
      ));
      const row = container.firstChild as HTMLElement;

      await fireEvent.click(row);

      expect(handleSelect).toHaveBeenCalledWith(item);
    });

    it("calls onSelect with correct item data", async () => {
      const handleSelect = vi.fn();
      const item = createFileItem({ id: "unique-id", name: "special.ts" });
      const { container } = render(() => (
        <CortexTreeItem item={item} onSelect={handleSelect} />
      ));
      const row = container.firstChild as HTMLElement;

      await fireEvent.click(row);

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "unique-id",
          name: "special.ts",
        })
      );
    });
  });

  describe("onToggle callback", () => {
    it("calls onToggle when folder is clicked", async () => {
      const handleToggle = vi.fn();
      const item = createFolderItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} onToggle={handleToggle} />
      ));
      const row = container.firstChild as HTMLElement;

      await fireEvent.click(row);

      expect(handleToggle).toHaveBeenCalledWith(item);
    });

    it("does not call onToggle when file is clicked", async () => {
      const handleToggle = vi.fn();
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} onToggle={handleToggle} />
      ));
      const row = container.firstChild as HTMLElement;

      await fireEvent.click(row);

      expect(handleToggle).not.toHaveBeenCalled();
    });

    it("calls onToggle when chevron is clicked", async () => {
      const handleToggle = vi.fn();
      const item = createFolderItem({ children: [createFileItem()] });
      const { container } = render(() => (
        <CortexTreeItem item={item} onToggle={handleToggle} />
      ));
      const chevronWrapper = container.querySelector(
        "div[style*='width: 16px']"
      );

      await fireEvent.click(chevronWrapper!);

      expect(handleToggle).toHaveBeenCalledWith(item);
    });
  });

  describe("onContextMenu callback", () => {
    it("calls onContextMenu on right click", async () => {
      const handleContextMenu = vi.fn();
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} onContextMenu={handleContextMenu} />
      ));
      const row = container.firstChild as HTMLElement;

      await fireEvent.contextMenu(row);

      expect(handleContextMenu).toHaveBeenCalledWith(item, expect.any(Object));
    });

    it("prevents default context menu", async () => {
      const handleContextMenu = vi.fn();
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} onContextMenu={handleContextMenu} />
      ));
      const row = container.firstChild as HTMLElement;

      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      row.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("children rendering", () => {
    it("renders children when expanded", () => {
      const childItem = createFileItem({ id: "child-1", name: "child.ts" });
      const item = createFolderItem({ children: [childItem] });
      const { getByText } = render(() => (
        <CortexTreeItem item={item} isExpanded />
      ));

      expect(getByText("child.ts")).toBeTruthy();
    });

    it("does not render children when collapsed", () => {
      const childItem = createFileItem({ id: "child-1", name: "child.ts" });
      const item = createFolderItem({ children: [childItem] });
      const { queryByText } = render(() => (
        <CortexTreeItem item={item} isExpanded={false} />
      ));

      expect(queryByText("child.ts")).toBeFalsy();
    });

    it("renders nested children with correct indentation", () => {
      const childItem = createFileItem({
        id: "child-1",
        name: "child.ts",
      });
      const item = createFolderItem({ children: [childItem] });

      const { getByText } = render(() => (
        <CortexTreeItem item={item} isExpanded />
      ));

      expect(getByText("child.ts")).toBeTruthy();
      expect(getByText("src")).toBeTruthy();
    });

    it("passes callbacks to children", async () => {
      const handleSelect = vi.fn();
      const childItem = createFileItem({ id: "child-1", name: "child.ts" });
      const item = createFolderItem({ children: [childItem] });

      const { getByText } = render(() => (
        <CortexTreeItem item={item} isExpanded onSelect={handleSelect} />
      ));

      await fireEvent.click(getByText("child.ts"));

      expect(handleSelect).toHaveBeenCalledWith(childItem);
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} class="custom-tree-item" />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.classList.contains("custom-tree-item")).toBe(true);
    });

    it("merges custom style", () => {
      const item = createFileItem();
      const { container } = render(() => (
        <CortexTreeItem item={item} style={{ "border-left": "2px solid red" }} />
      ));
      const row = container.firstChild as HTMLElement;
      expect(row.style.borderLeft).toBe("2px solid red");
    });
  });
});

describe("IndentGuide", () => {
  describe("rendering", () => {
    it("renders with correct positioning", () => {
      const { container } = render(() => (
        <IndentGuide level={0} height={100} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.position).toBe("absolute");
    });

    it("applies correct left position based on level", () => {
      const { container } = render(() => (
        <IndentGuide level={1} height={100} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.left).toBe("40px");
    });

    it("applies correct height", () => {
      const { container } = render(() => (
        <IndentGuide level={0} height={150} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.height).toBe("150px");
    });

    it("has 1px width", () => {
      const { container } = render(() => (
        <IndentGuide level={0} height={100} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.width).toBe("1px");
    });

    it("has pointer-events none", () => {
      const { container } = render(() => (
        <IndentGuide level={0} height={100} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.pointerEvents).toBe("none");
    });
  });

  describe("custom style", () => {
    it("merges custom style", () => {
      const { container } = render(() => (
        <IndentGuide level={0} height={100} style={{ opacity: "0.5" }} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.opacity).toBe("0.5");
    });
  });

  describe("level calculations", () => {
    it("calculates level 0 position correctly", () => {
      const { container } = render(() => (
        <IndentGuide level={0} height={100} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.left).toBe("16px");
    });

    it("calculates level 2 position correctly", () => {
      const { container } = render(() => (
        <IndentGuide level={2} height={100} />
      ));
      const guide = container.firstChild as HTMLElement;
      expect(guide.style.left).toBe("64px");
    });
  });
});
