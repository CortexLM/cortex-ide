import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("monaco-editor", () => ({
  Range: class MockRange {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
  editor: {
    TrackedRangeStickiness: { NeverGrowsWhenTypingAtEdges: 1 },
  },
}));

import {
  IndentGuidesService,
  injectIndentGuideStyles,
} from "../indentGuides";

interface MockEditor {
  getModel: ReturnType<typeof vi.fn>;
  onDidChangeModelContent: ReturnType<typeof vi.fn>;
  onDidChangeModel: ReturnType<typeof vi.fn>;
  createDecorationsCollection: ReturnType<typeof vi.fn>;
  _decorationsCollection: {
    clear: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
}

function createMockEditor(lines: string[] = [""]): MockEditor {
  const decorationsCollection = {
    clear: vi.fn(),
    set: vi.fn(),
  };
  return {
    getModel: vi.fn().mockReturnValue({
      getLineCount: vi.fn().mockReturnValue(lines.length),
      getLineContent: vi
        .fn()
        .mockImplementation((line: number) => lines[line - 1] || ""),
    }),
    onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidChangeModel: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    createDecorationsCollection: vi
      .fn()
      .mockReturnValue(decorationsCollection),
    _decorationsCollection: decorationsCollection,
  };
}

function getDecorations(editor: MockEditor) {
  const call = editor.createDecorationsCollection.mock.calls[0];
  if (!call) return [];
  return call[0] as Array<{
    range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
    options: { className: string; stickiness: number };
  }>;
}

function getLatestDecorations(editor: MockEditor) {
  const setCalls = editor._decorationsCollection.set.mock.calls;
  if (setCalls.length > 0) {
    return setCalls[setCalls.length - 1][0] as Array<{
      range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
      options: { className: string; stickiness: number };
    }>;
  }
  return getDecorations(editor);
}

const STYLE_ELEMENT_ID = "cortex-indent-guide-styles";

describe("injectIndentGuideStyles", () => {
  beforeEach(() => {
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) existing.remove();
  });

  it("injects a style element with correct CSS", () => {
    injectIndentGuideStyles();

    const style = document.getElementById(STYLE_ELEMENT_ID);
    expect(style).not.toBeNull();
    expect(style!.tagName).toBe("STYLE");
    expect(style!.textContent).toContain(".indent-guide");
    expect(style!.textContent).toContain("border-left: 1px solid");
    expect(style!.textContent).toContain(".indent-guide-active");
    expect(style!.textContent).toContain("--cortex-border");
  });

  it("is idempotent - only injects once", () => {
    injectIndentGuideStyles();
    injectIndentGuideStyles();
    injectIndentGuideStyles();

    const elements = document.querySelectorAll(`#${STYLE_ELEMENT_ID}`);
    expect(elements.length).toBe(1);
  });
});

describe("IndentGuidesService", () => {
  describe("constructor", () => {
    it("registers event listeners for content and model changes", () => {
      const editor = createMockEditor();
      new IndentGuidesService(editor as never);

      expect(editor.onDidChangeModelContent).toHaveBeenCalledOnce();
      expect(editor.onDidChangeModel).toHaveBeenCalledOnce();
      expect(typeof editor.onDidChangeModelContent.mock.calls[0][0]).toBe(
        "function",
      );
      expect(typeof editor.onDidChangeModel.mock.calls[0][0]).toBe("function");
    });

    it("calls update on creation", () => {
      const editor = createMockEditor(["    hello"]);
      new IndentGuidesService(editor as never);

      expect(editor.createDecorationsCollection).toHaveBeenCalledOnce();
    });

    it("accepts options for enabled and tabSize", () => {
      const editor = createMockEditor(["    hello"]);
      new IndentGuidesService(editor as never, {
        enabled: false,
        tabSize: 2,
      });

      expect(editor.createDecorationsCollection).not.toHaveBeenCalled();
    });
  });

  describe("setEnabled", () => {
    it("clears decorations when disabled", () => {
      const editor = createMockEditor(["    hello"]);
      const service = new IndentGuidesService(editor as never);

      expect(editor.createDecorationsCollection).toHaveBeenCalledOnce();

      service.setEnabled(false);

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
    });

    it("updates decorations when enabled", () => {
      const editor = createMockEditor(["    hello"]);
      const service = new IndentGuidesService(editor as never, {
        enabled: false,
      });

      expect(editor.createDecorationsCollection).not.toHaveBeenCalled();

      service.setEnabled(true);

      expect(editor.createDecorationsCollection).toHaveBeenCalledOnce();
    });
  });

  describe("setTabSize", () => {
    it("updates tabSize and recalculates decorations", () => {
      const editor = createMockEditor(["    code"]);
      const service = new IndentGuidesService(editor as never, { tabSize: 4 });

      const initialDecorations = getDecorations(editor);
      expect(initialDecorations).toHaveLength(1);

      service.setTabSize(2);

      const updatedDecorations = getLatestDecorations(editor);
      expect(updatedDecorations).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("clears decorations when no model is available", () => {
      const editor = createMockEditor(["    hello"]);
      const service = new IndentGuidesService(editor as never);

      editor.getModel.mockReturnValue(null);
      service.update();

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
    });

    it("creates no decorations for an empty file", () => {
      const editor = createMockEditor([""]);
      new IndentGuidesService(editor as never);

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(0);
    });

    it("creates one guide for a single indented line (4 spaces)", () => {
      const editor = createMockEditor(["    hello"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(1);
      expect(decorations[0].range.startLineNumber).toBe(1);
      expect(decorations[0].range.startColumn).toBe(1);
      expect(decorations[0].options.className).toBe("indent-guide");
      expect(decorations[0].options.stickiness).toBe(1);
    });

    it("creates multiple guides for multiple indent levels (8 spaces)", () => {
      const editor = createMockEditor(["        hello"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(2);
      expect(decorations[0].range.startLineNumber).toBe(1);
      expect(decorations[0].range.startColumn).toBe(1);
      expect(decorations[1].range.startLineNumber).toBe(1);
      expect(decorations[1].range.startColumn).toBe(5);
    });

    it("handles tab indentation", () => {
      const editor = createMockEditor(["\thello"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(1);
      expect(decorations[0].range.startLineNumber).toBe(1);
      expect(decorations[0].range.startColumn).toBe(1);
    });

    it("handles mixed tabs and spaces", () => {
      const editor = createMockEditor(["\t    hello"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(2);
      expect(decorations[0].range.startColumn).toBe(1);
      expect(decorations[1].range.startColumn).toBe(5);
    });

    it("creates no guides for non-indented lines", () => {
      const editor = createMockEditor(["hello", "world"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(0);
    });

    it("handles multiple lines with varying indentation", () => {
      const editor = createMockEditor([
        "function foo() {",
        "    if (true) {",
        "        return;",
        "    }",
        "}",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);

      const line1Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 1,
      );
      expect(line1Decorations).toHaveLength(0);

      const line2Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 2,
      );
      expect(line2Decorations).toHaveLength(1);
      expect(line2Decorations[0].range.startColumn).toBe(1);

      const line3Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 3,
      );
      expect(line3Decorations).toHaveLength(2);
      expect(line3Decorations[0].range.startColumn).toBe(1);
      expect(line3Decorations[1].range.startColumn).toBe(5);

      const line4Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 4,
      );
      expect(line4Decorations).toHaveLength(1);

      const line5Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 5,
      );
      expect(line5Decorations).toHaveLength(0);
    });

    it("reuses existing decorations collection on subsequent updates", () => {
      const editor = createMockEditor(["    hello"]);
      const service = new IndentGuidesService(editor as never);

      expect(editor.createDecorationsCollection).toHaveBeenCalledOnce();

      service.update();

      expect(editor.createDecorationsCollection).toHaveBeenCalledOnce();
      expect(editor._decorationsCollection.set).toHaveBeenCalledOnce();
    });
  });

  describe("dispose", () => {
    it("clears decorations and disposes all listeners", () => {
      const editor = createMockEditor(["    hello"]);
      const service = new IndentGuidesService(editor as never);

      const contentDispose =
        editor.onDidChangeModelContent.mock.results[0].value.dispose;
      const modelDispose =
        editor.onDidChangeModel.mock.results[0].value.dispose;

      service.dispose();

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
      expect(contentDispose).toHaveBeenCalledOnce();
      expect(modelDispose).toHaveBeenCalledOnce();
    });
  });

  describe("indent level computation", () => {
    it("treats 4 spaces as 1 level with tabSize=4", () => {
      const editor = createMockEditor(["    x"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(1);
    });

    it("treats 8 spaces as 2 levels with tabSize=4", () => {
      const editor = createMockEditor(["        x"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(2);
    });

    it("treats 4 spaces as 2 levels with tabSize=2", () => {
      const editor = createMockEditor(["    x"]);
      new IndentGuidesService(editor as never, { tabSize: 2 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(2);
      expect(decorations[0].range.startColumn).toBe(1);
      expect(decorations[1].range.startColumn).toBe(3);
    });

    it("counts each tab as one indent level", () => {
      const editor = createMockEditor(["\t\tx"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(2);
      expect(decorations[0].range.startColumn).toBe(1);
      expect(decorations[1].range.startColumn).toBe(5);
    });

    it("handles partial indentation (3 spaces with tabSize=4 gives 0 levels)", () => {
      const editor = createMockEditor(["   x"]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      expect(decorations).toHaveLength(0);
    });
  });

  describe("blank line handling", () => {
    it("gives blank line between indented blocks the minimum of surrounding levels", () => {
      const editor = createMockEditor([
        "    line1",
        "",
        "    line3",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      const blankLineDecorations = decorations.filter(
        (d) => d.range.startLineNumber === 2,
      );
      expect(blankLineDecorations).toHaveLength(1);
      expect(blankLineDecorations[0].range.startColumn).toBe(1);
    });

    it("gives blank line at start of file no guides", () => {
      const editor = createMockEditor([
        "",
        "    hello",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      const blankLineDecorations = decorations.filter(
        (d) => d.range.startLineNumber === 1,
      );
      expect(blankLineDecorations).toHaveLength(0);
    });

    it("continues guides through multiple blank lines", () => {
      const editor = createMockEditor([
        "        deep",
        "",
        "",
        "        deep",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);

      const line2Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 2,
      );
      expect(line2Decorations).toHaveLength(2);

      const line3Decorations = decorations.filter(
        (d) => d.range.startLineNumber === 3,
      );
      expect(line3Decorations).toHaveLength(2);
    });

    it("takes the minimum when surrounding lines have different indent levels", () => {
      const editor = createMockEditor([
        "        deep",
        "",
        "    shallow",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      const blankLineDecorations = decorations.filter(
        (d) => d.range.startLineNumber === 2,
      );
      expect(blankLineDecorations).toHaveLength(1);
    });

    it("gives blank line at end of file no guides when last non-blank is unindented", () => {
      const editor = createMockEditor([
        "hello",
        "",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      const blankLineDecorations = decorations.filter(
        (d) => d.range.startLineNumber === 2,
      );
      expect(blankLineDecorations).toHaveLength(0);
    });

    it("handles whitespace-only lines as blank", () => {
      const editor = createMockEditor([
        "    indented",
        "   ",
        "    indented",
      ]);
      new IndentGuidesService(editor as never, { tabSize: 4 });

      const decorations = getDecorations(editor);
      const blankLineDecorations = decorations.filter(
        (d) => d.range.startLineNumber === 2,
      );
      expect(blankLineDecorations).toHaveLength(1);
    });
  });
});
