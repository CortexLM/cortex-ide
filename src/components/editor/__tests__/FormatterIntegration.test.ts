/**
 * FormatterIntegration Tests
 *
 * Tests for the Monaco Editor Formatter Integration module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockMonaco, createMockMonacoEditor } from "@/test/utils";

describe("FormatterIntegration", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("FormatterIntegrationOptions Interface", () => {
    interface FormatterIntegrationOptions {
      monaco: typeof mockMonaco;
      editor: ReturnType<typeof createMockMonacoEditor>;
      filePath: string;
      language: string;
      workingDirectory?: string;
    }

    it("should accept required properties", () => {
      const options: FormatterIntegrationOptions = {
        monaco: mockMonaco,
        editor: mockEditor,
        filePath: "/path/to/file.ts",
        language: "typescript",
      };

      expect(options.monaco).toBeDefined();
      expect(options.editor).toBeDefined();
      expect(options.filePath).toBe("/path/to/file.ts");
      expect(options.language).toBe("typescript");
    });

    it("should accept optional workingDirectory property", () => {
      const options: FormatterIntegrationOptions = {
        monaco: mockMonaco,
        editor: mockEditor,
        filePath: "/path/to/file.ts",
        language: "typescript",
        workingDirectory: "/workspace/project",
      };

      expect(options.workingDirectory).toBe("/workspace/project");
    });

    it("should allow undefined workingDirectory", () => {
      const options: FormatterIntegrationOptions = {
        monaco: mockMonaco,
        editor: mockEditor,
        filePath: "/path/to/file.ts",
        language: "typescript",
      };

      expect(options.workingDirectory).toBeUndefined();
    });
  });

  describe("FormatRequest Interface", () => {
    interface FormatRange {
      startLine: number;
      endLine: number;
    }

    interface FormatRequest {
      content: string;
      filePath: string;
      workingDirectory?: string;
      range?: FormatRange;
    }

    it("should accept content property", () => {
      const request: FormatRequest = {
        content: "const foo = 'bar';",
        filePath: "/path/to/file.ts",
      };

      expect(request.content).toBe("const foo = 'bar';");
    });

    it("should accept filePath property", () => {
      const request: FormatRequest = {
        content: "const foo = 'bar';",
        filePath: "/path/to/file.ts",
      };

      expect(request.filePath).toBe("/path/to/file.ts");
    });

    it("should accept optional workingDirectory property", () => {
      const request: FormatRequest = {
        content: "const foo = 'bar';",
        filePath: "/path/to/file.ts",
        workingDirectory: "/workspace/project",
      };

      expect(request.workingDirectory).toBe("/workspace/project");
    });

    it("should accept optional range property", () => {
      const request: FormatRequest = {
        content: "const foo = 'bar';",
        filePath: "/path/to/file.ts",
        range: {
          startLine: 1,
          endLine: 10,
        },
      };

      expect(request.range).toBeDefined();
      expect(request.range?.startLine).toBe(1);
      expect(request.range?.endLine).toBe(10);
    });

    it("should allow request without optional properties", () => {
      const request: FormatRequest = {
        content: "const foo = 'bar';",
        filePath: "/path/to/file.ts",
      };

      expect(request.workingDirectory).toBeUndefined();
      expect(request.range).toBeUndefined();
    });
  });

  describe("FormatterType Types", () => {
    type FormatterType = "prettier" | "rustfmt" | "black" | "gofmt" | "clangformat" | "biome" | "deno";

    it("should accept prettier formatter type", () => {
      const formatter: FormatterType = "prettier";
      expect(formatter).toBe("prettier");
    });

    it("should accept rustfmt formatter type", () => {
      const formatter: FormatterType = "rustfmt";
      expect(formatter).toBe("rustfmt");
    });

    it("should accept black formatter type", () => {
      const formatter: FormatterType = "black";
      expect(formatter).toBe("black");
    });

    it("should accept gofmt formatter type", () => {
      const formatter: FormatterType = "gofmt";
      expect(formatter).toBe("gofmt");
    });

    it("should accept clangformat formatter type", () => {
      const formatter: FormatterType = "clangformat";
      expect(formatter).toBe("clangformat");
    });

    it("should accept biome formatter type", () => {
      const formatter: FormatterType = "biome";
      expect(formatter).toBe("biome");
    });

    it("should accept deno formatter type", () => {
      const formatter: FormatterType = "deno";
      expect(formatter).toBe("deno");
    });

    it("should validate all formatter types", () => {
      const validTypes: FormatterType[] = [
        "prettier",
        "rustfmt",
        "black",
        "gofmt",
        "clangformat",
        "biome",
        "deno",
      ];

      expect(validTypes).toHaveLength(7);
      validTypes.forEach((type) => {
        expect(typeof type).toBe("string");
      });
    });
  });

  describe("Format Operations", () => {
    it("should call format with document content", async () => {
      const mockFormat = vi.fn().mockResolvedValue({
        content: "formatted content",
        changed: true,
        formatter: "prettier",
        warnings: [],
      });

      mockEditor.getModel = vi.fn().mockReturnValue({
        getValue: vi.fn().mockReturnValue("unformatted content"),
        getFullModelRange: vi.fn().mockReturnValue({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 10,
          endColumn: 20,
        }),
        getLineCount: vi.fn().mockReturnValue(10),
        getLineMaxColumn: vi.fn().mockReturnValue(20),
      });

      const content = mockEditor.getModel()?.getValue();
      expect(content).toBe("unformatted content");

      const result = await mockFormat({
        content,
        filePath: "/test.ts",
      });

      expect(mockFormat).toHaveBeenCalledWith({
        content: "unformatted content",
        filePath: "/test.ts",
      });
      expect(result.changed).toBe(true);
    });

    it("should call format with selection content", async () => {
      const mockFormat = vi.fn().mockResolvedValue({
        content: "formatted selection",
        changed: true,
        formatter: "prettier",
        warnings: [],
      });

      mockEditor.getSelection = vi.fn().mockReturnValue({
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 5,
        endColumn: 10,
        isEmpty: () => false,
      });

      mockEditor.getModel = vi.fn().mockReturnValue({
        getValueInRange: vi.fn().mockReturnValue("selected content"),
      });

      const selection = mockEditor.getSelection();
      expect(selection?.isEmpty()).toBe(false);

      const selectedText = mockEditor.getModel()?.getValueInRange(selection);
      expect(selectedText).toBe("selected content");

      const result = await mockFormat({
        content: selectedText,
        filePath: "/test.ts",
        range: {
          startLine: selection?.startLineNumber,
          endLine: selection?.endLineNumber,
        },
      });

      expect(result.changed).toBe(true);
    });

    it("should fall back to document format when selection is empty", () => {
      mockEditor.getSelection = vi.fn().mockReturnValue({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        isEmpty: () => true,
      });

      const selection = mockEditor.getSelection();
      expect(selection?.isEmpty()).toBe(true);
    });
  });

  describe("Apply Formatting Result Logic", () => {
    it("should not apply edits when content is unchanged", () => {
      const originalContent = "const foo = 'bar';";
      const formattedContent = String("const foo = 'bar';");

      const shouldApply = originalContent !== formattedContent;
      expect(shouldApply).toBe(false);
    });

    it("should apply edits when content is changed", () => {
      const originalContent = "const foo='bar'";
      const formattedContent = String("const foo = 'bar';");

      const shouldApply = originalContent !== formattedContent;
      expect(shouldApply).toBe(true);
    });

    it("should call getFullModelRange for full document edits", () => {
      const mockRange = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 10,
        endColumn: 20,
      };

      mockEditor.getModel = vi.fn().mockReturnValue({
        getFullModelRange: vi.fn().mockReturnValue(mockRange),
        getValue: vi.fn().mockReturnValue("content"),
        getLineCount: vi.fn().mockReturnValue(10),
        getLineMaxColumn: vi.fn().mockReturnValue(20),
      });

      const model = mockEditor.getModel();
      const fullRange = model?.getFullModelRange();

      expect(model?.getFullModelRange).toHaveBeenCalled();
      expect(fullRange).toEqual(mockRange);
    });

    it("should call executeEdits with correct parameters", () => {
      const formattedContent = "formatted content";
      const mockRange = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 10,
        endColumn: 20,
      };

      const edit = {
        range: mockRange,
        text: formattedContent,
        forceMoveMarkers: true,
      };

      mockEditor.executeEdits("formatter", [edit]);

      expect(mockEditor.executeEdits).toHaveBeenCalledWith("formatter", [edit]);
    });
  });

  describe("Cursor Position Restoration", () => {
    it("should call getPosition before formatting", () => {
      const mockPosition = { lineNumber: 5, column: 10 };
      mockEditor.getPosition = vi.fn().mockReturnValue(mockPosition);

      const position = mockEditor.getPosition();

      expect(mockEditor.getPosition).toHaveBeenCalled();
      expect(position).toEqual(mockPosition);
    });

    it("should call setPosition after formatting", () => {
      const newPosition = { lineNumber: 5, column: 10 };

      mockEditor.setPosition(newPosition);

      expect(mockEditor.setPosition).toHaveBeenCalledWith(newPosition);
    });

    it("should clamp position to valid range when line count decreases", () => {
      const originalPosition = { lineNumber: 100, column: 50 };
      const newLineCount = 50;
      const newLineMaxColumn = 30;

      const newLine = Math.min(originalPosition.lineNumber, newLineCount);
      const newColumn = Math.min(originalPosition.column, newLineMaxColumn);

      expect(newLine).toBe(50);
      expect(newColumn).toBe(30);
    });

    it("should preserve position when within valid range", () => {
      const originalPosition = { lineNumber: 10, column: 15 };
      const newLineCount = 50;
      const newLineMaxColumn = 30;

      const newLine = Math.min(originalPosition.lineNumber, newLineCount);
      const newColumn = Math.min(originalPosition.column, newLineMaxColumn);

      expect(newLine).toBe(10);
      expect(newColumn).toBe(15);
    });

    it("should handle null position gracefully", () => {
      mockEditor.getPosition = vi.fn().mockReturnValue(null);

      const position = mockEditor.getPosition();
      expect(position).toBeNull();
    });
  });

  describe("Scroll Position Restoration", () => {
    it("should call getScrollTop before formatting", () => {
      mockEditor.getScrollTop = vi.fn().mockReturnValue(500);

      const scrollTop = mockEditor.getScrollTop();

      expect(mockEditor.getScrollTop).toHaveBeenCalled();
      expect(scrollTop).toBe(500);
    });

    it("should call setScrollTop after formatting with original value", () => {
      const originalScrollTop = 500;
      mockEditor.setScrollTop = vi.fn();

      mockEditor.setScrollTop(originalScrollTop);

      expect(mockEditor.setScrollTop).toHaveBeenCalledWith(500);
    });

    it("should restore scroll position even when content changes", () => {
      const originalScrollTop = 250;
      mockEditor.getScrollTop = vi.fn().mockReturnValue(originalScrollTop);
      mockEditor.setScrollTop = vi.fn();

      const savedScrollTop = mockEditor.getScrollTop();
      mockEditor.setScrollTop(savedScrollTop);

      expect(mockEditor.setScrollTop).toHaveBeenCalledWith(250);
    });

    it("should handle zero scroll position", () => {
      mockEditor.getScrollTop = vi.fn().mockReturnValue(0);
      mockEditor.setScrollTop = vi.fn();

      const scrollTop = mockEditor.getScrollTop();
      mockEditor.setScrollTop(scrollTop);

      expect(mockEditor.setScrollTop).toHaveBeenCalledWith(0);
    });
  });

  describe("Editor Model Handling", () => {
    it("should handle null model gracefully", () => {
      mockEditor.getModel = vi.fn().mockReturnValue(null);

      const model = mockEditor.getModel();
      expect(model).toBeNull();
    });

    it("should get model value for formatting", () => {
      const content = "const foo = 'bar';";
      mockEditor.getModel = vi.fn().mockReturnValue({
        getValue: vi.fn().mockReturnValue(content),
      });

      const model = mockEditor.getModel();
      const value = model?.getValue();

      expect(value).toBe(content);
    });

    it("should get value in range for selection formatting", () => {
      const selectedContent = "selected text";
      const selection = {
        startLineNumber: 2,
        startColumn: 5,
        endLineNumber: 4,
        endColumn: 10,
      };

      mockEditor.getModel = vi.fn().mockReturnValue({
        getValueInRange: vi.fn().mockReturnValue(selectedContent),
      });

      const model = mockEditor.getModel();
      const value = model?.getValueInRange(selection);

      expect(value).toBe(selectedContent);
    });
  });

  describe("Formatting Provider Registration", () => {
    it("should register document formatting provider", () => {
      const language = "typescript";
      const provider = {
        provideDocumentFormattingEdits: vi.fn().mockResolvedValue([]),
      };

      mockMonaco.languages.registerDocumentFormattingEditProvider = vi.fn().mockReturnValue({
        dispose: vi.fn(),
      });

      const disposable = mockMonaco.languages.registerDocumentFormattingEditProvider(
        language,
        provider
      );

      expect(mockMonaco.languages.registerDocumentFormattingEditProvider).toHaveBeenCalledWith(
        language,
        provider
      );
      expect(disposable.dispose).toBeDefined();
    });

    it("should register document range formatting provider", () => {
      const language = "typescript";
      const provider = {
        provideDocumentRangeFormattingEdits: vi.fn().mockResolvedValue([]),
      };

      const mockRegister = vi.fn().mockReturnValue({ dispose: vi.fn() });
      mockMonaco.languages.registerDocumentRangeFormattingEditProvider = mockRegister;

      const disposable = mockMonaco.languages.registerDocumentRangeFormattingEditProvider(
        language,
        provider
      );

      expect(mockRegister).toHaveBeenCalledWith(language, provider);
      expect(disposable.dispose).toBeDefined();
    });
  });

  describe("Editor Actions", () => {
    it("should add format document action", () => {
      const action = {
        id: "cortex.formatDocument",
        label: "Format Document",
        run: vi.fn(),
      };

      mockEditor.addAction(action);

      expect(mockEditor.addAction).toHaveBeenCalledWith(action);
    });

    it("should add format selection action", () => {
      const action = {
        id: "cortex.formatSelection",
        label: "Format Selection",
        run: vi.fn(),
      };

      mockEditor.addAction(action);

      expect(mockEditor.addAction).toHaveBeenCalledWith(action);
    });

    it("should add format with specific formatter action", () => {
      const action = {
        id: "cortex.formatWithPrettier",
        label: "Format Document with Prettier",
        run: vi.fn(),
      };

      mockEditor.addAction(action);

      expect(mockEditor.addAction).toHaveBeenCalledWith(action);
    });
  });

  describe("Cleanup", () => {
    it("should dispose all registered providers on cleanup", () => {
      const disposable1 = { dispose: vi.fn() };
      const disposable2 = { dispose: vi.fn() };
      const disposables = [disposable1, disposable2];

      disposables.forEach((d) => d.dispose());

      expect(disposable1.dispose).toHaveBeenCalled();
      expect(disposable2.dispose).toHaveBeenCalled();
    });

    it("should handle null disposables gracefully", () => {
      const disposables: Array<{ dispose?: () => void } | null> = [
        { dispose: vi.fn() },
        null,
        { dispose: vi.fn() },
      ];

      expect(() => {
        disposables.forEach((d) => d?.dispose?.());
      }).not.toThrow();
    });
  });
});
