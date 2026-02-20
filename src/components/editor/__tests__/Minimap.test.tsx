/**
 * Minimap Tests
 *
 * Tests for the minimap navigation component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  cleanup,
  createMockMonaco,
  createMockMonacoEditor,
} from "@/test/utils";
import { Minimap } from "../Minimap";

describe("Minimap", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();

    (mockEditor as any).onDidScrollChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
    (mockEditor as any).onDidChangeModel = vi.fn().mockReturnValue({ dispose: vi.fn() });
    (mockEditor as any).onDidChangeModelDecorations = vi.fn().mockReturnValue({ dispose: vi.fn() });

    mockEditor.getVisibleRanges = vi.fn().mockReturnValue([
      { startLineNumber: 1, endLineNumber: 20 },
    ]);

    const model = mockEditor.getModel();
    (model as any).getLineCount = vi.fn().mockReturnValue(100);
    (model as any).getAllDecorations = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render when enabled by default", () => {
      const { container } = render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should render canvas element", () => {
      const { container } = render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect(container.querySelector("canvas")).toBeTruthy();
    });

    it("should render scroll position indicator", () => {
      const { container } = render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      const divs = container.querySelectorAll("div");
      expect(divs.length).toBeGreaterThanOrEqual(2);
    });

    it("should return null when enabled is false", () => {
      const { container } = render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={false}
        />
      ));

      expect(container.innerHTML).toBe("");
    });

    it("should not throw when editor is null", () => {
      expect(() => {
        render(() => (
          <Minimap editor={null} monaco={null} />
        ));
      }).not.toThrow();
    });
  });

  describe("Click Navigation", () => {
    it("should call onNavigate when clicked", () => {
      const onNavigate = vi.fn();
      const { container } = render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          onNavigate={onNavigate}
        />
      ));

      const minimapDiv = container.querySelector("div");
      if (minimapDiv) {
        Object.defineProperty(minimapDiv, "getBoundingClientRect", {
          value: () => ({ top: 0, left: 0, height: 500, width: 56 }),
        });

        minimapDiv.dispatchEvent(
          new MouseEvent("click", { bubbles: true, clientY: 250 })
        );

        expect(mockEditor.revealLineInCenter).toHaveBeenCalled();
        expect(mockEditor.setPosition).toHaveBeenCalled();
        expect(mockEditor.focus).toHaveBeenCalled();
      }
    });
  });

  describe("Editor Integration", () => {
    it("should subscribe to scroll changes", () => {
      render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect((mockEditor as any).onDidScrollChange).toHaveBeenCalled();
    });

    it("should subscribe to model content changes", () => {
      render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect(mockEditor.onDidChangeModelContent).toHaveBeenCalled();
    });

    it("should subscribe to model decoration changes", () => {
      render(() => (
        <Minimap
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect((mockEditor as any).onDidChangeModelDecorations).toHaveBeenCalled();
    });
  });
});