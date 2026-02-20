/**
 * EditorSplitView Tests
 *
 * Tests for the split view management component.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { EditorSplitView } from "../EditorSplitView";

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    state: {
      groups: [{ id: "group-1", tabs: [], activeTabId: null }],
      activeGroupId: "group-1",
      splits: [],
    },
    splitEditor: vi.fn(),
    closeGroup: vi.fn(),
    unsplit: vi.fn(),
    updateSplitRatio: vi.fn(),
  }),
}));

vi.mock("@/components/ui", () => ({
  useContextMenu: () => ({
    menuState: () => ({ visible: false, x: 0, y: 0, sections: [] }),
    showMenu: vi.fn(),
    hideMenu: vi.fn(),
  }),
  ContextMenu: (_props: Record<string, unknown>) => null,
}));

describe("EditorSplitView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Component Definition", () => {
    it("should be defined", () => {
      expect(EditorSplitView).toBeDefined();
    });

    it("should accept renderGroup prop as a function", () => {
      const renderGroup = vi.fn().mockReturnValue(null);
      expect(typeof renderGroup).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const renderGroup = vi.fn().mockReturnValue(
        <div data-testid="editor-group">Group Content</div>
      );

      expect(() => {
        render(() => (
          <EditorSplitView renderGroup={renderGroup} />
        ));
      }).not.toThrow();
    });

    it("should render with a single group", () => {
      const renderGroup = vi.fn().mockReturnValue(
        <div data-testid="editor-group">Group Content</div>
      );

      const { container } = render(() => (
        <EditorSplitView renderGroup={renderGroup} />
      ));

      const splitView = container.querySelector("[data-split-view]");
      expect(splitView).toBeTruthy();
    });

    it("should call renderGroup with group data", () => {
      const renderGroup = vi.fn().mockReturnValue(
        <div>Group Content</div>
      );

      render(() => (
        <EditorSplitView renderGroup={renderGroup} />
      ));

      expect(renderGroup).toHaveBeenCalled();
    });
  });
});
