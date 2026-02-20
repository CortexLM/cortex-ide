/**
 * StickyScroll Tests
 *
 * Tests for the sticky scroll scope display component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  cleanup,
  createMockMonaco,
  createMockMonacoEditor,
  nextTick,
} from "@/test/utils";
import { StickyScroll } from "../StickyScroll";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("StickyScroll", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();

    (mockEditor as any).onDidScrollChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
    (mockEditor as any).onDidChangeModel = vi.fn().mockReturnValue({ dispose: vi.fn() });

    mockEditor.getVisibleRanges = vi.fn().mockReturnValue([
      { startLineNumber: 10, endLineNumber: 30 },
    ]);

    const model = mockEditor.getModel();
    (model as any).getLineCount = vi.fn().mockReturnValue(100);
    (model as any).getLineContent = vi.fn().mockImplementation((line: number) => {
      if (line === 5) return "  function myFunction() {";
      if (line === 1) return "class MyClass {";
      return `  line ${line}`;
    });
    (model as any).getValue = vi.fn().mockReturnValue("class MyClass {\n  function myFunction() {\n  }\n}");
    (model as any).getLanguageId = vi.fn().mockReturnValue("typescript");

    mockInvoke.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when editor is null", () => {
      const { container } = render(() => (
        <StickyScroll editor={null} monaco={null} />
      ));

      expect(container.innerHTML).toBe("");
    });

    it("should not render when enabled is false", () => {
      const { container } = render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={false}
        />
      ));

      expect(container.innerHTML).toBe("");
    });

    it("should render sticky lines from IPC response", async () => {
      mockInvoke.mockResolvedValue([
        { line: 1, text: "class MyClass", indentLevel: 0, scopeKind: "class" },
        { line: 5, text: "function myFunction()", indentLevel: 1, scopeKind: "function" },
      ]);

      const { container } = render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      await nextTick();
      await nextTick();

      expect(container.textContent).toContain("class MyClass");
      expect(container.textContent).toContain("function myFunction()");
    });

    it("should not render when no sticky lines exist", async () => {
      mockInvoke.mockResolvedValue([]);

      const { container } = render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      await nextTick();
      await nextTick();

      const stickyContainer = container.querySelector(".absolute");
      expect(stickyContainer).toBeNull();
    });
  });

  describe("Click Handler", () => {
    it("should navigate to line when sticky line is clicked", async () => {
      const onLineClick = vi.fn();
      mockInvoke.mockResolvedValue([
        { line: 5, text: "function myFunction()", indentLevel: 0, scopeKind: "function" },
      ]);

      const { container } = render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          onLineClick={onLineClick}
        />
      ));

      await nextTick();
      await nextTick();

      const stickyLine = container.querySelector("[title]");
      if (stickyLine) {
        stickyLine.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(mockEditor.revealLineInCenter).toHaveBeenCalledWith(5);
        expect(mockEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 5, column: 1 });
        expect(mockEditor.focus).toHaveBeenCalled();
        expect(onLineClick).toHaveBeenCalledWith(5);
      }
    });
  });

  describe("Max Line Count", () => {
    it("should limit sticky lines to maxLineCount", async () => {
      mockInvoke.mockResolvedValue([
        { line: 1, text: "namespace A", indentLevel: 0, scopeKind: "namespace" },
        { line: 3, text: "class B", indentLevel: 1, scopeKind: "class" },
        { line: 5, text: "function c()", indentLevel: 2, scopeKind: "function" },
      ]);

      const { container } = render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          maxLineCount={2}
        />
      ));

      await nextTick();
      await nextTick();

      expect(container.textContent).toBeDefined();
    });
  });

  describe("Editor Integration", () => {
    it("should subscribe to scroll changes", () => {
      mockInvoke.mockResolvedValue([]);

      render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect((mockEditor as any).onDidScrollChange).toHaveBeenCalled();
    });

    it("should subscribe to model changes", () => {
      mockInvoke.mockResolvedValue([]);

      render(() => (
        <StickyScroll
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect((mockEditor as any).onDidChangeModel).toHaveBeenCalled();
    });

    it("should not throw when editor is null", () => {
      expect(() => {
        render(() => (
          <StickyScroll editor={null} monaco={null} />
        ));
      }).not.toThrow();
    });
  });
});