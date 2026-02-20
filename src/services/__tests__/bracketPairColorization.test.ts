import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BracketPosition } from "@/utils/bracketOperations";

vi.mock("monaco-editor", () => ({
  Range: class MockRange {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number
    ) {}
  },
  editor: {
    TrackedRangeStickiness: { NeverGrowsWhenTypingAtEdges: 1 },
  },
}));

vi.mock("@/utils/bracketOperations", () => ({
  findAllBrackets: vi.fn().mockReturnValue([]),
  BRACKET_PAIRS: [
    ["(", ")"],
    ["{", "}"],
    ["[", "]"],
  ],
}));

import {
  BracketPairColorizationService,
  injectBracketColorStyles,
} from "@/services/bracketPairColorization";
import { findAllBrackets } from "@/utils/bracketOperations";

const STYLE_ELEMENT_ID = "cortex-bracket-colorization-styles";

function ensureFindAllBracketsMock(
  returnValue: BracketPosition[] = []
): void {
  vi.mocked(findAllBrackets).mockReturnValue(returnValue);
}

function createMockEditor() {
  const decorationsCollection = {
    clear: vi.fn(),
    set: vi.fn(),
  };
  return {
    getModel: vi.fn().mockReturnValue({
      getLineCount: vi.fn().mockReturnValue(1),
      getLineContent: vi.fn().mockReturnValue(""),
    }),
    onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidChangeModel: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    createDecorationsCollection: vi.fn().mockReturnValue(decorationsCollection),
    _decorationsCollection: decorationsCollection,
  };
}

function makeBracket(
  lineNumber: number,
  column: number,
  character: string,
  type: "open" | "close",
  pairIndex: number
): BracketPosition {
  return {
    position: { lineNumber, column } as BracketPosition["position"],
    character,
    type,
    pairIndex,
  };
}

describe("injectBracketColorStyles", () => {
  beforeEach(() => {
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) {
      existing.remove();
    }
  });

  it("creates and appends a style element to document.head", () => {
    injectBracketColorStyles();

    const el = document.getElementById(STYLE_ELEMENT_ID);
    expect(el).not.toBeNull();
    expect(el!.tagName.toLowerCase()).toBe("style");
    expect(document.head.contains(el)).toBe(true);
  });

  it("style element contains CSS rules for all 6 bracket colors", () => {
    injectBracketColorStyles();

    const el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement;
    const text = el.textContent ?? "";

    for (let i = 0; i < 6; i++) {
      expect(text).toContain(`.bracket-color-${i}`);
    }

    expect(text).toContain("#ffd700");
    expect(text).toContain("#da70d6");
    expect(text).toContain("#179fff");
    expect(text).toContain("#00fa9a");
    expect(text).toContain("#ff6347");
    expect(text).toContain("#87ceeb");
  });

  it("is idempotent — only injects once when called multiple times", () => {
    injectBracketColorStyles();
    injectBracketColorStyles();
    injectBracketColorStyles();

    const elements = document.querySelectorAll(`#${STYLE_ELEMENT_ID}`);
    expect(elements.length).toBe(1);
  });
});

describe("BracketPairColorizationService", () => {
  beforeEach(() => {
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) {
      existing.remove();
    }
    ensureFindAllBracketsMock();
  });

  describe("constructor", () => {
    it("registers onDidChangeModelContent listener", () => {
      const editor = createMockEditor();
      new BracketPairColorizationService(editor as never);

      expect(editor.onDidChangeModelContent).toHaveBeenCalledOnce();
      expect(editor.onDidChangeModelContent).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it("registers onDidChangeModel listener", () => {
      const editor = createMockEditor();
      new BracketPairColorizationService(editor as never);

      expect(editor.onDidChangeModel).toHaveBeenCalledOnce();
      expect(editor.onDidChangeModel).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it("calls update when enabled is true (default)", () => {
      const editor = createMockEditor();
      new BracketPairColorizationService(editor as never);

      expect(editor.getModel).toHaveBeenCalled();
      expect(editor.createDecorationsCollection).toHaveBeenCalled();
    });

    it("does not call update when enabled is false", () => {
      const editor = createMockEditor();
      new BracketPairColorizationService(editor as never, false);

      expect(editor.getModel).not.toHaveBeenCalled();
      expect(editor.createDecorationsCollection).not.toHaveBeenCalled();
    });

    it("injects bracket color styles when enabled", () => {
      const editor = createMockEditor();
      new BracketPairColorizationService(editor as never, true);

      expect(document.getElementById(STYLE_ELEMENT_ID)).not.toBeNull();
    });

    it("does not inject bracket color styles when disabled", () => {
      const editor = createMockEditor();
      new BracketPairColorizationService(editor as never, false);

      expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    });
  });

  describe("setEnabled(true)", () => {
    it("enables and triggers update", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, false);

      expect(editor.getModel).not.toHaveBeenCalled();

      service.setEnabled(true);

      expect(editor.getModel).toHaveBeenCalled();
    });

    it("injects bracket color styles when enabling", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, false);

      expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();

      service.setEnabled(true);

      expect(document.getElementById(STYLE_ELEMENT_ID)).not.toBeNull();
    });
  });

  describe("setEnabled(false)", () => {
    it("disables and clears decorations", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, true);

      expect(editor.createDecorationsCollection).toHaveBeenCalled();

      service.setEnabled(false);

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
    });

    it("after disabling, update returns early without processing", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, true);

      editor.getModel.mockClear();
      service.setEnabled(false);

      service.update();

      expect(editor.getModel).not.toHaveBeenCalled();
    });
  });

  describe("update()", () => {
    it("with no model clears decorations and returns early", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, true);

      editor.getModel.mockReturnValue(null);
      service.update();

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
    });

    it("when disabled returns early without calling getModel", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, false);

      service.update();

      expect(editor.getModel).not.toHaveBeenCalled();
    });

    it("with empty brackets creates decorations collection with empty array", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([]);

      new BracketPairColorizationService(editor as never, true);

      expect(editor.createDecorationsCollection).toHaveBeenCalledWith([]);
    });

    it("with matched pair creates 2 decorations with bracket-color-0", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 5, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(2);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-0");
    });

    it("with nested brackets creates decorations with correct depth colors", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "(", "open", 0),
        makeBracket(1, 3, ")", "close", 0),
        makeBracket(1, 4, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(4);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[3].options.inlineClassName).toBe("bracket-color-0");
    });

    it("creates decorations via createDecorationsCollection", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "{", "open", 1),
        makeBracket(1, 5, "}", "close", 1),
      ]);

      new BracketPairColorizationService(editor as never, true);

      expect(editor.createDecorationsCollection).toHaveBeenCalledOnce();
      expect(editor.createDecorationsCollection).toHaveBeenCalledWith(
        expect.any(Array)
      );
    });

    it("clears previous decorations before setting new ones", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([]);

      const service = new BracketPairColorizationService(editor as never, true);

      expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(1);

      service.update();

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
      expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(2);
    });
  });

  describe("decoration building", () => {
    it("open bracket gets color based on stack depth", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "[", "open", 2),
        makeBracket(1, 3, "{", "open", 1),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-2");
    });

    it("close bracket matches nearest open bracket and uses same color", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "{", "open", 1),
        makeBracket(1, 3, "}", "close", 1),
        makeBracket(1, 4, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(4);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[3].options.inlineClassName).toBe("bracket-color-0");
    });

    it("unmatched close brackets are skipped", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, ")", "close", 0),
        makeBracket(1, 2, "(", "open", 0),
        makeBracket(1, 3, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(2);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-0");
    });

    it("mixed bracket types correctly match by pairIndex", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "{", "open", 1),
        makeBracket(1, 3, "}", "close", 1),
        makeBracket(1, 4, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(4);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[3].options.inlineClassName).toBe("bracket-color-0");
    });

    it("multiple sequential pairs each get depth 0", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, ")", "close", 0),
        makeBracket(1, 3, "{", "open", 1),
        makeBracket(1, 4, "}", "close", 1),
        makeBracket(1, 5, "[", "open", 2),
        makeBracket(1, 6, "]", "close", 2),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(6);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[3].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[4].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[5].options.inlineClassName).toBe("bracket-color-0");
    });

    it("decorations have correct range positions", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(3, 7, "(", "open", 0),
        makeBracket(5, 12, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          range: {
            startLineNumber: number;
            startColumn: number;
            endLineNumber: number;
            endColumn: number;
          };
        }>;
      expect(decorations[0].range.startLineNumber).toBe(3);
      expect(decorations[0].range.startColumn).toBe(7);
      expect(decorations[0].range.endLineNumber).toBe(3);
      expect(decorations[0].range.endColumn).toBe(8);

      expect(decorations[1].range.startLineNumber).toBe(5);
      expect(decorations[1].range.startColumn).toBe(12);
      expect(decorations[1].range.endLineNumber).toBe(5);
      expect(decorations[1].range.endColumn).toBe(13);
    });
  });

  describe("color cycling", () => {
    it("depth 0 through 5 use colors 0 through 5", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "(", "open", 0),
        makeBracket(1, 3, "(", "open", 0),
        makeBracket(1, 4, "(", "open", 0),
        makeBracket(1, 5, "(", "open", 0),
        makeBracket(1, 6, "(", "open", 0),
        makeBracket(1, 7, ")", "close", 0),
        makeBracket(1, 8, ")", "close", 0),
        makeBracket(1, 9, ")", "close", 0),
        makeBracket(1, 10, ")", "close", 0),
        makeBracket(1, 11, ")", "close", 0),
        makeBracket(1, 12, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-2");
      expect(decorations[3].options.inlineClassName).toBe("bracket-color-3");
      expect(decorations[4].options.inlineClassName).toBe("bracket-color-4");
      expect(decorations[5].options.inlineClassName).toBe("bracket-color-5");
    });

    it("depth 6 wraps back to color 0", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "(", "open", 0),
        makeBracket(1, 3, "(", "open", 0),
        makeBracket(1, 4, "(", "open", 0),
        makeBracket(1, 5, "(", "open", 0),
        makeBracket(1, 6, "(", "open", 0),
        makeBracket(1, 7, "(", "open", 0),
        makeBracket(1, 8, ")", "close", 0),
        makeBracket(1, 9, ")", "close", 0),
        makeBracket(1, 10, ")", "close", 0),
        makeBracket(1, 11, ")", "close", 0),
        makeBracket(1, 12, ")", "close", 0),
        makeBracket(1, 13, ")", "close", 0),
        makeBracket(1, 14, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations[6].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[7].options.inlineClassName).toBe("bracket-color-0");
    });

    it("depth 7 wraps to color 1", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "(", "open", 0),
        makeBracket(1, 3, "(", "open", 0),
        makeBracket(1, 4, "(", "open", 0),
        makeBracket(1, 5, "(", "open", 0),
        makeBracket(1, 6, "(", "open", 0),
        makeBracket(1, 7, "(", "open", 0),
        makeBracket(1, 8, "(", "open", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations[7].options.inlineClassName).toBe("bracket-color-1");
    });
  });

  describe("dispose()", () => {
    it("clears decorations", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, true);

      service.dispose();

      expect(editor._decorationsCollection.clear).toHaveBeenCalled();
    });

    it("disposes all event listeners", () => {
      const editor = createMockEditor();
      const contentDispose = vi.fn();
      const modelDispose = vi.fn();
      editor.onDidChangeModelContent.mockReturnValue({
        dispose: contentDispose,
      });
      editor.onDidChangeModel.mockReturnValue({ dispose: modelDispose });

      const service = new BracketPairColorizationService(editor as never, true);

      service.dispose();

      expect(contentDispose).toHaveBeenCalledOnce();
      expect(modelDispose).toHaveBeenCalledOnce();
    });

    it("can be called multiple times safely", () => {
      const editor = createMockEditor();
      const service = new BracketPairColorizationService(editor as never, true);

      service.dispose();
      service.dispose();

      expect(editor._decorationsCollection.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe("event listener callbacks", () => {
    it("onDidChangeModelContent callback triggers update", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([]);

      new BracketPairColorizationService(editor as never, true);

      expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(1);

      const contentCallback =
        editor.onDidChangeModelContent.mock.calls[0][0] as () => void;
      contentCallback();

      expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(2);
    });

    it("onDidChangeModel callback triggers update", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([]);

      new BracketPairColorizationService(editor as never, true);

      expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(1);

      const modelCallback =
        editor.onDidChangeModel.mock.calls[0][0] as () => void;
      modelCallback();

      expect(editor.createDecorationsCollection).toHaveBeenCalledTimes(2);
    });
  });

  describe("close bracket matching with findMatchingOpenIndex", () => {
    it("close bracket with no matching open on stack is skipped", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "}", "close", 1),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(0);
    });

    it("close bracket matches by pairIndex not by character", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "[", "open", 2),
        makeBracket(1, 3, ")", "close", 0),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(3);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-0");
    });

    it("close bracket splices stack at matching index", () => {
      const editor = createMockEditor();
      vi.mocked(findAllBrackets).mockReturnValue([
        makeBracket(1, 1, "(", "open", 0),
        makeBracket(1, 2, "[", "open", 2),
        makeBracket(1, 3, ")", "close", 0),
        makeBracket(1, 4, "]", "close", 2),
      ]);

      new BracketPairColorizationService(editor as never, true);

      const decorations =
        editor.createDecorationsCollection.mock.calls[0][0] as Array<{
          options: { inlineClassName: string };
        }>;
      expect(decorations).toHaveLength(3);
      expect(decorations[0].options.inlineClassName).toBe("bracket-color-0");
      expect(decorations[1].options.inlineClassName).toBe("bracket-color-1");
      expect(decorations[2].options.inlineClassName).toBe("bracket-color-0");
    });
  });
});
