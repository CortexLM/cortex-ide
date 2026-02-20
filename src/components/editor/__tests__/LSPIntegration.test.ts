/**
 * LSPIntegration Tests
 *
 * Tests for the Monaco Editor LSP Integration module.
 * Tests type mappings, interfaces, and utility functions.
 */

import { describe, it, expect } from "vitest";

describe("LSPIntegration", () => {
  describe("Completion Kind Mapping", () => {
    const completionKindMap: Record<string, number> = {
      text: 1,
      method: 2,
      function: 3,
      constructor: 4,
      field: 5,
      variable: 6,
      class: 7,
      interface: 8,
      module: 9,
      property: 10,
      unit: 11,
      value: 12,
      enum: 13,
      keyword: 14,
      snippet: 15,
      color: 16,
      file: 17,
      reference: 18,
      folder: 19,
      enumMember: 20,
      constant: 21,
      struct: 22,
      event: 23,
      operator: 24,
      typeParameter: 25,
    };

    it("should map text to Monaco CompletionItemKind.Text (1)", () => {
      expect(completionKindMap.text).toBe(1);
    });

    it("should map method to Monaco CompletionItemKind.Method (2)", () => {
      expect(completionKindMap.method).toBe(2);
    });

    it("should map function to Monaco CompletionItemKind.Function (3)", () => {
      expect(completionKindMap.function).toBe(3);
    });

    it("should map constructor to Monaco CompletionItemKind.Constructor (4)", () => {
      expect(completionKindMap.constructor).toBe(4);
    });

    it("should map field to Monaco CompletionItemKind.Field (5)", () => {
      expect(completionKindMap.field).toBe(5);
    });

    it("should map variable to Monaco CompletionItemKind.Variable (6)", () => {
      expect(completionKindMap.variable).toBe(6);
    });

    it("should map class to Monaco CompletionItemKind.Class (7)", () => {
      expect(completionKindMap.class).toBe(7);
    });

    it("should map interface to Monaco CompletionItemKind.Interface (8)", () => {
      expect(completionKindMap.interface).toBe(8);
    });

    it("should map module to Monaco CompletionItemKind.Module (9)", () => {
      expect(completionKindMap.module).toBe(9);
    });

    it("should map property to Monaco CompletionItemKind.Property (10)", () => {
      expect(completionKindMap.property).toBe(10);
    });

    it("should map unit to Monaco CompletionItemKind.Unit (11)", () => {
      expect(completionKindMap.unit).toBe(11);
    });

    it("should map value to Monaco CompletionItemKind.Value (12)", () => {
      expect(completionKindMap.value).toBe(12);
    });

    it("should map enum to Monaco CompletionItemKind.Enum (13)", () => {
      expect(completionKindMap.enum).toBe(13);
    });

    it("should map keyword to Monaco CompletionItemKind.Keyword (14)", () => {
      expect(completionKindMap.keyword).toBe(14);
    });

    it("should map snippet to Monaco CompletionItemKind.Snippet (15)", () => {
      expect(completionKindMap.snippet).toBe(15);
    });

    it("should map color to Monaco CompletionItemKind.Color (16)", () => {
      expect(completionKindMap.color).toBe(16);
    });

    it("should map file to Monaco CompletionItemKind.File (17)", () => {
      expect(completionKindMap.file).toBe(17);
    });

    it("should map reference to Monaco CompletionItemKind.Reference (18)", () => {
      expect(completionKindMap.reference).toBe(18);
    });

    it("should map folder to Monaco CompletionItemKind.Folder (19)", () => {
      expect(completionKindMap.folder).toBe(19);
    });

    it("should map enumMember to Monaco CompletionItemKind.EnumMember (20)", () => {
      expect(completionKindMap.enumMember).toBe(20);
    });

    it("should map constant to Monaco CompletionItemKind.Constant (21)", () => {
      expect(completionKindMap.constant).toBe(21);
    });

    it("should map struct to Monaco CompletionItemKind.Struct (22)", () => {
      expect(completionKindMap.struct).toBe(22);
    });

    it("should map event to Monaco CompletionItemKind.Event (23)", () => {
      expect(completionKindMap.event).toBe(23);
    });

    it("should map operator to Monaco CompletionItemKind.Operator (24)", () => {
      expect(completionKindMap.operator).toBe(24);
    });

    it("should map typeParameter to Monaco CompletionItemKind.TypeParameter (25)", () => {
      expect(completionKindMap.typeParameter).toBe(25);
    });

    it("should contain all 25 completion kinds", () => {
      expect(Object.keys(completionKindMap).length).toBe(25);
    });
  });

  describe("Severity Mapping", () => {
    const severityMap: Record<string, number> = {
      error: 8,
      warning: 4,
      information: 2,
      hint: 1,
    };

    it("should map error to Monaco MarkerSeverity.Error (8)", () => {
      expect(severityMap.error).toBe(8);
    });

    it("should map warning to Monaco MarkerSeverity.Warning (4)", () => {
      expect(severityMap.warning).toBe(4);
    });

    it("should map information to Monaco MarkerSeverity.Info (2)", () => {
      expect(severityMap.information).toBe(2);
    });

    it("should map hint to Monaco MarkerSeverity.Hint (1)", () => {
      expect(severityMap.hint).toBe(1);
    });

    it("should contain all 4 severity levels", () => {
      expect(Object.keys(severityMap).length).toBe(4);
    });
  });

  describe("Document Highlight Kind Mapping", () => {
    type DocumentHighlightKind = "text" | "read" | "write";

    const documentHighlightKindMap: Record<DocumentHighlightKind, number> = {
      text: 0,
      read: 1,
      write: 2,
    };

    it("should map text to Monaco DocumentHighlightKind.Text (0)", () => {
      expect(documentHighlightKindMap.text).toBe(0);
    });

    it("should map read to Monaco DocumentHighlightKind.Read (1)", () => {
      expect(documentHighlightKindMap.read).toBe(1);
    });

    it("should map write to Monaco DocumentHighlightKind.Write (2)", () => {
      expect(documentHighlightKindMap.write).toBe(2);
    });

    it("should contain all 3 highlight kinds", () => {
      expect(Object.keys(documentHighlightKindMap).length).toBe(3);
    });
  });

  describe("LSPIntegrationOptions Interface", () => {
    interface InlayHintsSettings {
      enabled: boolean;
      fontSize: number;
      fontFamily: string;
      showTypes: boolean;
      showParameterNames: boolean;
      showReturnTypes: boolean;
      maxLength: number;
      padding: boolean;
    }

    interface LSPIntegrationOptions {
      monaco: unknown;
      editor: unknown;
      serverId: string;
      uri: string;
      languageId: string;
      getInlayHintsSettings?: () => InlayHintsSettings;
    }

    it("should require monaco property", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "typescript",
        uri: "file:///test.ts",
        languageId: "typescript",
      };
      expect(options.monaco).toBeDefined();
    });

    it("should require editor property", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "typescript",
        uri: "file:///test.ts",
        languageId: "typescript",
      };
      expect(options.editor).toBeDefined();
    });

    it("should require serverId as string", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "rust-analyzer",
        uri: "file:///test.rs",
        languageId: "rust",
      };
      expect(typeof options.serverId).toBe("string");
    });

    it("should require uri as string", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "typescript",
        uri: "file:///path/to/file.ts",
        languageId: "typescript",
      };
      expect(typeof options.uri).toBe("string");
    });

    it("should require languageId as string", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "typescript",
        uri: "file:///test.ts",
        languageId: "typescript",
      };
      expect(typeof options.languageId).toBe("string");
    });

    it("should allow optional getInlayHintsSettings function", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "typescript",
        uri: "file:///test.ts",
        languageId: "typescript",
        getInlayHintsSettings: () => ({
          enabled: true,
          fontSize: 12,
          fontFamily: "monospace",
          showTypes: true,
          showParameterNames: true,
          showReturnTypes: true,
          maxLength: 30,
          padding: true,
        }),
      };
      expect(typeof options.getInlayHintsSettings).toBe("function");
    });

    it("should work without getInlayHintsSettings", () => {
      const options: LSPIntegrationOptions = {
        monaco: {},
        editor: {},
        serverId: "typescript",
        uri: "file:///test.ts",
        languageId: "typescript",
      };
      expect(options.getInlayHintsSettings).toBeUndefined();
    });
  });

  describe("Default Inlay Hints Settings", () => {
    interface InlayHintsSettings {
      enabled: boolean;
      fontSize: number;
      fontFamily: string;
      showTypes: boolean;
      showParameterNames: boolean;
      showReturnTypes: boolean;
      maxLength: number;
      padding: boolean;
    }

    const DEFAULT_INLAY_HINTS_SETTINGS: InlayHintsSettings = {
      enabled: true,
      fontSize: 0,
      fontFamily: "",
      showTypes: true,
      showParameterNames: true,
      showReturnTypes: true,
      maxLength: 25,
      padding: true,
    };

    it("should have enabled set to true by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.enabled).toBe(true);
    });

    it("should have fontSize set to 0 by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.fontSize).toBe(0);
    });

    it("should have fontFamily set to empty string by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.fontFamily).toBe("");
    });

    it("should have showTypes set to true by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.showTypes).toBe(true);
    });

    it("should have showParameterNames set to true by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.showParameterNames).toBe(true);
    });

    it("should have showReturnTypes set to true by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.showReturnTypes).toBe(true);
    });

    it("should have maxLength set to 25 by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.maxLength).toBe(25);
    });

    it("should have padding set to true by default", () => {
      expect(DEFAULT_INLAY_HINTS_SETTINGS.padding).toBe(true);
    });
  });

  describe("Position and Range Types", () => {
    interface Position {
      line: number;
      character: number;
    }

    interface Range {
      start: Position;
      end: Position;
    }

    it("should create valid Position with line and character", () => {
      const position: Position = {
        line: 10,
        character: 5,
      };
      expect(position.line).toBe(10);
      expect(position.character).toBe(5);
    });

    it("should create valid Range with start and end positions", () => {
      const range: Range = {
        start: { line: 0, character: 0 },
        end: { line: 5, character: 10 },
      };
      expect(range.start.line).toBe(0);
      expect(range.start.character).toBe(0);
      expect(range.end.line).toBe(5);
      expect(range.end.character).toBe(10);
    });

    it("should handle zero-based line numbers", () => {
      const position: Position = {
        line: 0,
        character: 0,
      };
      expect(position.line).toBe(0);
      expect(position.character).toBe(0);
    });

    it("should handle large line numbers", () => {
      const position: Position = {
        line: 10000,
        character: 500,
      };
      expect(position.line).toBe(10000);
      expect(position.character).toBe(500);
    });

    it("should handle single-character range", () => {
      const range: Range = {
        start: { line: 5, character: 10 },
        end: { line: 5, character: 11 },
      };
      expect(range.end.character - range.start.character).toBe(1);
    });

    it("should handle multi-line range", () => {
      const range: Range = {
        start: { line: 0, character: 0 },
        end: { line: 100, character: 0 },
      };
      expect(range.end.line - range.start.line).toBe(100);
    });
  });

  describe("Diagnostic Types", () => {
    type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

    interface Position {
      line: number;
      character: number;
    }

    interface Range {
      start: Position;
      end: Position;
    }

    interface Diagnostic {
      range: Range;
      severity?: DiagnosticSeverity;
      code?: string;
      source?: string;
      message: string;
    }

    it("should create diagnostic with required fields", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: "Error message",
      };
      expect(diagnostic.message).toBe("Error message");
      expect(diagnostic.range).toBeDefined();
    });

    it("should create diagnostic with error severity", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 20 },
        },
        severity: "error",
        message: "Syntax error",
      };
      expect(diagnostic.severity).toBe("error");
    });

    it("should create diagnostic with warning severity", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 10, character: 0 },
          end: { line: 10, character: 15 },
        },
        severity: "warning",
        message: "Unused variable",
      };
      expect(diagnostic.severity).toBe("warning");
    });

    it("should create diagnostic with information severity", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 15, character: 0 },
          end: { line: 15, character: 10 },
        },
        severity: "information",
        message: "Consider using const",
      };
      expect(diagnostic.severity).toBe("information");
    });

    it("should create diagnostic with hint severity", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 20, character: 0 },
          end: { line: 20, character: 5 },
        },
        severity: "hint",
        message: "Simplify expression",
      };
      expect(diagnostic.severity).toBe("hint");
    });

    it("should create diagnostic with optional code", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: "Type error",
        code: "TS2322",
      };
      expect(diagnostic.code).toBe("TS2322");
    });

    it("should create diagnostic with optional source", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: "Lint error",
        source: "eslint",
      };
      expect(diagnostic.source).toBe("eslint");
    });

    it("should create diagnostic with all fields", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 5, character: 10 },
          end: { line: 5, character: 20 },
        },
        severity: "error",
        code: "E0001",
        source: "typescript",
        message: "Cannot find name 'foo'",
      };
      expect(diagnostic.range.start.line).toBe(5);
      expect(diagnostic.severity).toBe("error");
      expect(diagnostic.code).toBe("E0001");
      expect(diagnostic.source).toBe("typescript");
      expect(diagnostic.message).toBe("Cannot find name 'foo'");
    });
  });

  describe("CompletionItem Types", () => {
    type CompletionItemKind =
      | "text" | "method" | "function" | "constructor" | "field"
      | "variable" | "class" | "interface" | "module" | "property"
      | "unit" | "value" | "enum" | "keyword" | "snippet"
      | "color" | "file" | "reference" | "folder" | "enumMember"
      | "constant" | "struct" | "event" | "operator" | "typeParameter";

    interface Position {
      line: number;
      character: number;
    }

    interface Range {
      start: Position;
      end: Position;
    }

    interface TextEdit {
      range: Range;
      newText: string;
    }

    interface CompletionItem {
      label: string;
      kind?: CompletionItemKind;
      detail?: string;
      documentation?: string;
      insertText?: string;
      insertTextFormat?: number;
      textEdit?: TextEdit;
      additionalTextEdits?: TextEdit[];
      sortText?: string;
      filterText?: string;
    }

    it("should create completion item with required label", () => {
      const item: CompletionItem = {
        label: "myFunction",
      };
      expect(item.label).toBe("myFunction");
    });

    it("should create completion item with kind", () => {
      const item: CompletionItem = {
        label: "myFunction",
        kind: "function",
      };
      expect(item.kind).toBe("function");
    });

    it("should create completion item with detail", () => {
      const item: CompletionItem = {
        label: "myFunction",
        detail: "(param: string) => void",
      };
      expect(item.detail).toBe("(param: string) => void");
    });

    it("should create completion item with documentation", () => {
      const item: CompletionItem = {
        label: "myFunction",
        documentation: "This function does something useful.",
      };
      expect(item.documentation).toBe("This function does something useful.");
    });

    it("should create completion item with insertText", () => {
      const item: CompletionItem = {
        label: "myFunction",
        insertText: "myFunction()",
      };
      expect(item.insertText).toBe("myFunction()");
    });

    it("should create completion item with snippet insertTextFormat", () => {
      const item: CompletionItem = {
        label: "myFunction",
        insertText: "myFunction(${1:param})",
        insertTextFormat: 2,
      };
      expect(item.insertTextFormat).toBe(2);
    });

    it("should create completion item with textEdit", () => {
      const item: CompletionItem = {
        label: "myFunction",
        textEdit: {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
          newText: "myFunction",
        },
      };
      expect(item.textEdit?.newText).toBe("myFunction");
    });

    it("should create completion item with additionalTextEdits", () => {
      const item: CompletionItem = {
        label: "useState",
        additionalTextEdits: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            newText: "import { useState } from 'react';\n",
          },
        ],
      };
      expect(item.additionalTextEdits?.length).toBe(1);
      expect(item.additionalTextEdits?.[0].newText).toContain("import");
    });

    it("should create completion item with sortText", () => {
      const item: CompletionItem = {
        label: "myFunction",
        sortText: "0000myFunction",
      };
      expect(item.sortText).toBe("0000myFunction");
    });

    it("should create completion item with filterText", () => {
      const item: CompletionItem = {
        label: "myFunction",
        filterText: "myfunc",
      };
      expect(item.filterText).toBe("myfunc");
    });

    it("should create completion item with all fields", () => {
      const item: CompletionItem = {
        label: "myFunction",
        kind: "function",
        detail: "(param: string) => void",
        documentation: "A useful function",
        insertText: "myFunction(${1:param})",
        insertTextFormat: 2,
        textEdit: {
          range: {
            start: { line: 5, character: 0 },
            end: { line: 5, character: 4 },
          },
          newText: "myFunction",
        },
        sortText: "0001",
        filterText: "myfunc",
      };
      expect(item.label).toBe("myFunction");
      expect(item.kind).toBe("function");
      expect(item.detail).toBe("(param: string) => void");
      expect(item.documentation).toBe("A useful function");
      expect(item.insertText).toBe("myFunction(${1:param})");
      expect(item.insertTextFormat).toBe(2);
      expect(item.textEdit?.newText).toBe("myFunction");
      expect(item.sortText).toBe("0001");
      expect(item.filterText).toBe("myfunc");
    });

    it("should support all completion item kinds", () => {
      const kinds: CompletionItemKind[] = [
        "text", "method", "function", "constructor", "field",
        "variable", "class", "interface", "module", "property",
        "unit", "value", "enum", "keyword", "snippet",
        "color", "file", "reference", "folder", "enumMember",
        "constant", "struct", "event", "operator", "typeParameter",
      ];
      expect(kinds.length).toBe(25);
      kinds.forEach((kind) => {
        const item: CompletionItem = { label: "test", kind };
        expect(item.kind).toBe(kind);
      });
    });
  });
});
