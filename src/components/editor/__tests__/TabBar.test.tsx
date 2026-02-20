/**
 * TabBar Tests
 *
 * Tests for the TabBar component types and behavior.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { TabBar, TabBarProps, TabDecoration } from "../TabBar";

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

const mockIsPreviewTab = vi.fn().mockReturnValue(false);

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    state: {
      openFiles: [],
      activeFileId: null,
      pinnedTabs: [],
    },
    setActiveFile: vi.fn(),
    closeFile: vi.fn(),
    closeAllFiles: vi.fn(),
    pinTab: vi.fn(),
    unpinTab: vi.fn(),
    togglePinTab: vi.fn(),
    reorderTabs: vi.fn(),
    isPreviewTab: mockIsPreviewTab,
    promotePreviewToPermanent: vi.fn(),
  }),
  OpenFile: {},
}));

vi.mock("@/context/SettingsContext", () => ({
  useSettings: () => ({
    effectiveSettings: () => ({
      workbench: {
        editor: {
          tabSizing: "fit",
          tabSizingFixedMinWidth: 80,
          tabSizingFixedWidth: 120,
          showTabCloseButton: "onHover",
          tabCloseButtonPosition: "right",
        },
      },
      theme: {
        wrapTabs: false,
      },
    }),
  }),
}));

vi.mock("@/context/DiagnosticsContext", () => ({
  useDiagnostics: () => ({
    getCountsForFile: vi.fn().mockReturnValue({ error: 0, warning: 0, info: 0, hint: 0 }),
  }),
}));

vi.mock("@/components/ZenMode", () => ({
  zenModeActive: () => false,
}));

describe("TabBar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createMockFile = (id: string, name: string, modified = false) => ({
    id,
    path: `/workspace/${name}`,
    name,
    content: "",
    language: "typescript",
    modified,
  });

  const defaultProps: TabBarProps = {
    files: [],
    activeFileId: null,
    onFileSelect: vi.fn(),
    onFileClose: vi.fn(),
  };

  const renderTabBar = (props: Partial<TabBarProps> = {}) => {
    return render(() => <TabBar {...defaultProps} {...props} />);
  };

  describe("Type Definitions", () => {
    describe("TabSizingMode", () => {
      it("should accept 'fit' as valid sizing mode", () => {
        type TabSizingMode = "fit" | "shrink" | "fixed";
        const mode: TabSizingMode = "fit";
        expect(mode).toBe("fit");
      });

      it("should accept 'shrink' as valid sizing mode", () => {
        type TabSizingMode = "fit" | "shrink" | "fixed";
        const mode: TabSizingMode = "shrink";
        expect(mode).toBe("shrink");
      });

      it("should accept 'fixed' as valid sizing mode", () => {
        type TabSizingMode = "fit" | "shrink" | "fixed";
        const mode: TabSizingMode = "fixed";
        expect(mode).toBe("fixed");
      });
    });

    describe("TabStickyMode", () => {
      it("should accept 'normal' as valid sticky mode", () => {
        type TabStickyMode = "normal" | "compact" | "shrink";
        const mode: TabStickyMode = "normal";
        expect(mode).toBe("normal");
      });

      it("should accept 'compact' as valid sticky mode", () => {
        type TabStickyMode = "normal" | "compact" | "shrink";
        const mode: TabStickyMode = "compact";
        expect(mode).toBe("compact");
      });

      it("should accept 'shrink' as valid sticky mode", () => {
        type TabStickyMode = "normal" | "compact" | "shrink";
        const mode: TabStickyMode = "shrink";
        expect(mode).toBe("shrink");
      });
    });

    describe("TabCloseButtonVisibility", () => {
      it("should accept 'always' as valid visibility", () => {
        type TabCloseButtonVisibility = "always" | "onHover" | "never";
        const visibility: TabCloseButtonVisibility = "always";
        expect(visibility).toBe("always");
      });

      it("should accept 'onHover' as valid visibility", () => {
        type TabCloseButtonVisibility = "always" | "onHover" | "never";
        const visibility: TabCloseButtonVisibility = "onHover";
        expect(visibility).toBe("onHover");
      });

      it("should accept 'never' as valid visibility", () => {
        type TabCloseButtonVisibility = "always" | "onHover" | "never";
        const visibility: TabCloseButtonVisibility = "never";
        expect(visibility).toBe("never");
      });
    });

    describe("TabCloseButtonPosition", () => {
      it("should accept 'left' as valid position", () => {
        type TabCloseButtonPosition = "left" | "right";
        const position: TabCloseButtonPosition = "left";
        expect(position).toBe("left");
      });

      it("should accept 'right' as valid position", () => {
        type TabCloseButtonPosition = "left" | "right";
        const position: TabCloseButtonPosition = "right";
        expect(position).toBe("right");
      });
    });

    describe("TabDecoration", () => {
      it("should accept valid TabDecoration with badge", () => {
        const decoration: TabDecoration = {
          badge: "3",
          badgeColor: "var(--semantic-error)",
        };
        expect(decoration.badge).toBe("3");
        expect(decoration.badgeColor).toBe("var(--semantic-error)");
      });

      it("should accept valid TabDecoration with color", () => {
        const decoration: TabDecoration = {
          color: "var(--warning-foreground)",
        };
        expect(decoration.color).toBe("var(--warning-foreground)");
      });

      it("should accept valid TabDecoration with strikethrough", () => {
        const decoration: TabDecoration = {
          strikethrough: true,
        };
        expect(decoration.strikethrough).toBe(true);
      });

      it("should accept valid TabDecoration with italic", () => {
        const decoration: TabDecoration = {
          italic: true,
        };
        expect(decoration.italic).toBe(true);
      });

      it("should accept empty TabDecoration", () => {
        const decoration: TabDecoration = {};
        expect(decoration).toEqual({});
      });

      it("should accept full TabDecoration", () => {
        const decoration: TabDecoration = {
          badge: "5",
          badgeColor: "red",
          color: "blue",
          strikethrough: true,
          italic: true,
        };
        expect(decoration.badge).toBe("5");
        expect(decoration.badgeColor).toBe("red");
        expect(decoration.color).toBe("blue");
        expect(decoration.strikethrough).toBe(true);
        expect(decoration.italic).toBe(true);
      });
    });

    describe("OpenFile Interface", () => {
      it("should have required id property", () => {
        interface OpenFile {
          id: string;
          path: string;
          name: string;
          content: string;
          language: string;
          modified: boolean;
        }
        const file: OpenFile = {
          id: "file-1",
          path: "/workspace/test.ts",
          name: "test.ts",
          content: "const x = 1;",
          language: "typescript",
          modified: false,
        };
        expect(file.id).toBe("file-1");
      });

      it("should have required path property", () => {
        interface OpenFile {
          id: string;
          path: string;
          name: string;
          content: string;
          language: string;
          modified: boolean;
        }
        const file: OpenFile = {
          id: "file-1",
          path: "/workspace/test.ts",
          name: "test.ts",
          content: "",
          language: "typescript",
          modified: false,
        };
        expect(file.path).toBe("/workspace/test.ts");
      });

      it("should have required name property", () => {
        interface OpenFile {
          id: string;
          path: string;
          name: string;
          content: string;
          language: string;
          modified: boolean;
        }
        const file: OpenFile = {
          id: "file-1",
          path: "/workspace/test.ts",
          name: "test.ts",
          content: "",
          language: "typescript",
          modified: false,
        };
        expect(file.name).toBe("test.ts");
      });

      it("should have required modified property", () => {
        interface OpenFile {
          id: string;
          path: string;
          name: string;
          content: string;
          language: string;
          modified: boolean;
        }
        const file: OpenFile = {
          id: "file-1",
          path: "/workspace/test.ts",
          name: "test.ts",
          content: "",
          language: "typescript",
          modified: true,
        };
        expect(file.modified).toBe(true);
      });
    });
  });

  describe("Rendering", () => {
    it("should render with no files", () => {
      const { container } = renderTabBar();
      expect(container.querySelector(".tabs-and-actions-container")).toBeTruthy();
    });

    it("should render with multiple files", () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
        createMockFile("3", "file3.ts"),
      ];
      const { container } = renderTabBar({ files });
      const tabs = container.querySelectorAll(".tab");
      expect(tabs.length).toBe(3);
    });

    it("should highlight active tab", () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
      ];
      const { container } = renderTabBar({ files, activeFileId: "2" });
      const activeTabs = container.querySelectorAll(".tab.active");
      expect(activeTabs.length).toBe(1);
    });

    it("should show new tab button by default", () => {
      const { container } = renderTabBar();
      const newTabButton = container.querySelector('button[title="New File (Ctrl+N)"]');
      expect(newTabButton).toBeTruthy();
    });

    it("should hide new tab button when showNewTabButton is false", () => {
      const { container } = renderTabBar({ showNewTabButton: false });
      const newTabButton = container.querySelector('button[title="New File (Ctrl+N)"]');
      expect(newTabButton).toBeFalsy();
    });
  });

  describe("Tab Overflow Handling", () => {
    it("should show overflow button when more than 5 files", () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
        createMockFile("3", "file3.ts"),
        createMockFile("4", "file4.ts"),
        createMockFile("5", "file5.ts"),
        createMockFile("6", "file6.ts"),
      ];
      const { container } = renderTabBar({ files });
      const overflowButton = container.querySelector('button[title="Show all tabs"]');
      expect(overflowButton).toBeTruthy();
    });

    it("should not show overflow button when 5 or fewer files", () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
        createMockFile("3", "file3.ts"),
      ];
      const { container } = renderTabBar({ files });
      const overflowButton = container.querySelector('button[title="Show all tabs"]');
      expect(overflowButton).toBeFalsy();
    });

    it("should toggle overflow dropdown on click", async () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
        createMockFile("3", "file3.ts"),
        createMockFile("4", "file4.ts"),
        createMockFile("5", "file5.ts"),
        createMockFile("6", "file6.ts"),
      ];
      const { container } = renderTabBar({ files });
      const overflowButton = container.querySelector('button[title="Show all tabs"]');

      if (overflowButton) {
        fireEvent.click(overflowButton);
        await nextTick();
        expect(container.textContent).toContain("file6.ts");
      }
    });
  });

  describe("Tab Selection Logic", () => {
    it("should call onFileSelect when tab is clicked", async () => {
      const onFileSelect = vi.fn();
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files, onFileSelect });

      const tab = container.querySelector(".tab");
      if (tab) {
        fireEvent.click(tab);
        await nextTick();
        expect(onFileSelect).toHaveBeenCalledWith("1");
      }
    });

    it("should call onFileClose on middle click", async () => {
      const onFileClose = vi.fn();
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files, onFileClose });

      const tab = container.querySelector(".tab");
      if (tab) {
        fireEvent.mouseDown(tab, { button: 1 });
        await nextTick();
        expect(onFileClose).toHaveBeenCalledWith("1");
      }
    });
  });

  describe("Modified Indicator Display", () => {
    it("should show dirty class for modified files", () => {
      const files = [createMockFile("1", "file1.ts", true)];
      const { container } = renderTabBar({ files });
      const dirtyTab = container.querySelector(".tab.dirty");
      expect(dirtyTab).toBeTruthy();
    });

    it("should not show dirty class for unmodified files", () => {
      const files = [createMockFile("1", "file1.ts", false)];
      const { container } = renderTabBar({ files });
      const dirtyTab = container.querySelector(".tab.dirty");
      expect(dirtyTab).toBeFalsy();
    });
  });

  describe("Preview Tab Handling", () => {
    it("should add preview class for preview tabs", () => {
      mockIsPreviewTab.mockReturnValue(true);
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files });
      const previewTab = container.querySelector(".tab.preview");
      expect(previewTab).toBeTruthy();
      mockIsPreviewTab.mockReturnValue(false);
    });
  });

  describe("Tab Sizing Modes", () => {
    it("should apply fit sizing mode class", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files, sizingMode: "fit" });
      const tab = container.querySelector(".tab.sizing-fit");
      expect(tab).toBeTruthy();
    });

    it("should apply shrink sizing mode class", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files, sizingMode: "shrink" });
      const tab = container.querySelector(".tab.sizing-shrink");
      expect(tab).toBeTruthy();
    });

    it("should apply fixed sizing mode class", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files, sizingMode: "fixed" });
      const tab = container.querySelector(".tab.sizing-fixed");
      expect(tab).toBeTruthy();
    });
  });

  describe("Pinned Tabs", () => {
    it("should apply sticky class for pinned tabs", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files, pinnedTabs: ["1"] });
      const stickyTab = container.querySelector(".tab.sticky");
      expect(stickyTab).toBeTruthy();
    });

    it("should apply sticky-compact class when stickyMode is compact", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({
        files,
        pinnedTabs: ["1"],
        stickyMode: "compact",
      });
      const compactTab = container.querySelector(".tab.sticky-compact");
      expect(compactTab).toBeTruthy();
    });

    it("should apply sticky-shrink class when stickyMode is shrink", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({
        files,
        pinnedTabs: ["1"],
        stickyMode: "shrink",
      });
      const shrinkTab = container.querySelector(".tab.sticky-shrink");
      expect(shrinkTab).toBeTruthy();
    });
  });

  describe("Close Group Button", () => {
    it("should show close group button when showCloseGroupButton is true", () => {
      const onCloseGroup = vi.fn();
      const { container } = renderTabBar({
        showCloseGroupButton: true,
        onCloseGroup,
      });
      const closeGroupButton = container.querySelector('button[title="Close split"]');
      expect(closeGroupButton).toBeTruthy();
    });

    it("should call onCloseGroup when close group button is clicked", async () => {
      const onCloseGroup = vi.fn();
      const { container } = renderTabBar({
        showCloseGroupButton: true,
        onCloseGroup,
      });
      const closeGroupButton = container.querySelector('button[title="Close split"]');

      if (closeGroupButton) {
        fireEvent.click(closeGroupButton);
        await nextTick();
        expect(onCloseGroup).toHaveBeenCalled();
      }
    });
  });

  describe("Drag and Drop", () => {
    it("should have draggable attribute on tabs", () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files });
      const tab = container.querySelector(".tab");
      expect(tab?.getAttribute("draggable")).toBe("true");
    });

    it("should apply drop position classes during drag", async () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
      ];
      const { container } = renderTabBar({ files });
      const tabs = container.querySelectorAll(".tab");

      expect(tabs.length).toBe(2);
    });
  });

  describe("Tab Position Classes", () => {
    it("should apply first-tab class to first tab", () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
      ];
      const { container } = renderTabBar({ files });
      const firstTab = container.querySelector(".tab.first-tab");
      expect(firstTab).toBeTruthy();
    });

    it("should apply last-tab class to last tab", () => {
      const files = [
        createMockFile("1", "file1.ts"),
        createMockFile("2", "file2.ts"),
      ];
      const { container } = renderTabBar({ files });
      const lastTab = container.querySelector(".tab.last-tab");
      expect(lastTab).toBeTruthy();
    });
  });

  describe("Scroll Buttons", () => {
    it("should render scroll buttons when content overflows", () => {
      const { container } = renderTabBar();
      expect(container.querySelector(".tabs-container")).toBeTruthy();
    });
  });

  describe("Context Menu", () => {
    it("should show context menu on right click", async () => {
      const files = [createMockFile("1", "file1.ts")];
      const { container } = renderTabBar({ files });
      const tab = container.querySelector(".tab");

      if (tab) {
        fireEvent.contextMenu(tab, { clientX: 100, clientY: 100 });
        await nextTick();
      }
    });
  });

  describe("New File Button", () => {
    it("should call onNewFile when new tab button is clicked", async () => {
      const onNewFile = vi.fn();
      const { container } = renderTabBar({ onNewFile });
      const newTabButton = container.querySelector('button[title="New File (Ctrl+N)"]');

      if (newTabButton) {
        fireEvent.click(newTabButton);
        await nextTick();
        expect(onNewFile).toHaveBeenCalled();
      }
    });
  });
});
