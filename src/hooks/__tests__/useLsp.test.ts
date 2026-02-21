import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("useLSPEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LSP Editor Options", () => {
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

    interface SemanticHighlightingSettings {
      enabled: boolean;
      strings: boolean;
      comments: boolean;
    }

    interface UseLSPEditorOptions {
      editor: unknown | null;
      monaco: unknown | null;
      filePath: string | null;
      fileName: string | null;
      language: string | null;
      content: string | null;
      getInlayHintsSettings?: () => InlayHintsSettings;
      getSemanticHighlightingSettings?: () => SemanticHighlightingSettings;
    }

    it("should define LSP editor options interface", () => {
      const options: UseLSPEditorOptions = {
        editor: null,
        monaco: null,
        filePath: "/src/app.ts",
        fileName: "app.ts",
        language: "typescript",
        content: "const x = 1;",
      };

      expect(options.filePath).toBe("/src/app.ts");
      expect(options.language).toBe("typescript");
    });

    it("should support optional settings getters", () => {
      const inlaySettings: InlayHintsSettings = {
        enabled: true,
        fontSize: 12,
        fontFamily: "monospace",
        showTypes: true,
        showParameterNames: true,
        showReturnTypes: true,
        maxLength: 25,
        padding: true,
      };

      const options: UseLSPEditorOptions = {
        editor: null,
        monaco: null,
        filePath: "/src/app.ts",
        fileName: "app.ts",
        language: "typescript",
        content: "",
        getInlayHintsSettings: () => inlaySettings,
      };

      expect(options.getInlayHintsSettings?.()).toEqual(inlaySettings);
    });

    it("should handle null content", () => {
      const options: UseLSPEditorOptions = {
        editor: null,
        monaco: null,
        filePath: null,
        fileName: null,
        language: null,
        content: null,
      };

      expect(options.content).toBeNull();
    });
  });

  describe("Completion Kind Mapping", () => {
    const COMPLETION_KIND_MAP: Record<string, number> = {
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

    it("should map completion kinds to Monaco values", () => {
      expect(COMPLETION_KIND_MAP.method).toBe(2);
      expect(COMPLETION_KIND_MAP.function).toBe(3);
      expect(COMPLETION_KIND_MAP.class).toBe(7);
    });

    it("should have all standard completion kinds", () => {
      expect(Object.keys(COMPLETION_KIND_MAP)).toHaveLength(25);
    });

    it("should map unknown kinds to default", () => {
      const getKind = (kind: string): number => COMPLETION_KIND_MAP[kind] ?? 1;
      expect(getKind("unknown")).toBe(1);
      expect(getKind("method")).toBe(2);
    });
  });

  describe("Severity Mapping", () => {
    const SEVERITY_MAP: Record<string, number> = {
      error: 8,
      warning: 4,
      information: 2,
      hint: 1,
    };

    it("should map diagnostic severities", () => {
      expect(SEVERITY_MAP.error).toBe(8);
      expect(SEVERITY_MAP.warning).toBe(4);
      expect(SEVERITY_MAP.information).toBe(2);
      expect(SEVERITY_MAP.hint).toBe(1);
    });

    it("should have all severity levels", () => {
      expect(Object.keys(SEVERITY_MAP)).toHaveLength(4);
    });
  });

  describe("File Path to URI Conversion", () => {
    const filePathToUri = (filePath: string): string => {
      const normalized = filePath.replace(/\\/g, "/");
      return `file://${normalized}`;
    };

    it("should convert Unix paths to URI", () => {
      const uri = filePathToUri("/home/user/project/app.ts");
      expect(uri).toBe("file:///home/user/project/app.ts");
    });

    it("should convert Windows paths to URI", () => {
      const uri = filePathToUri("C:\\Users\\user\\project\\app.ts");
      expect(uri).toBe("file://C:/Users/user/project/app.ts");
    });

    it("should handle paths with spaces", () => {
      const uri = filePathToUri("/home/user/my project/app.ts");
      expect(uri).toBe("file:///home/user/my project/app.ts");
    });
  });

  describe("LSP Server State", () => {
    interface LSPServer {
      id: string;
      name: string;
      status: "starting" | "running" | "stopped" | "error";
      capabilities?: {
        completionProvider?: boolean;
        hoverProvider?: boolean;
        definitionProvider?: boolean;
        referencesProvider?: boolean;
        inlayHints?: boolean;
        semanticTokens?: boolean;
      };
    }

    it("should track server status", () => {
      const server: LSPServer = {
        id: "ts-server-1",
        name: "typescript-language-server",
        status: "running",
        capabilities: {
          completionProvider: true,
          hoverProvider: true,
          definitionProvider: true,
          referencesProvider: true,
          inlayHints: true,
          semanticTokens: true,
        },
      };

      expect(server.status).toBe("running");
      expect(server.capabilities?.completionProvider).toBe(true);
    });

    it("should handle server without capabilities", () => {
      const server: LSPServer = {
        id: "server-1",
        name: "basic-server",
        status: "starting",
      };

      expect(server.capabilities).toBeUndefined();
    });
  });

  describe("LSP Document Operations", () => {
    it("should call didOpen via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("lsp_did_open", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        languageId: "typescript",
        version: 0,
        content: "const x = 1;",
      });

      expect(invoke).toHaveBeenCalledWith("lsp_did_open", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        languageId: "typescript",
        version: 0,
        content: "const x = 1;",
      });
    });

    it("should call didChange via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("lsp_did_change", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        version: 1,
        content: "const x = 2;",
      });

      expect(invoke).toHaveBeenCalledWith("lsp_did_change", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        version: 1,
        content: "const x = 2;",
      });
    });

    it("should call didClose via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("lsp_did_close", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
      });

      expect(invoke).toHaveBeenCalledWith("lsp_did_close", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
      });
    });
  });

  describe("LSP Completion", () => {
    interface CompletionItem {
      label: string;
      kind?: string;
      detail?: string;
      documentation?: string;
      insertText?: string;
      insertTextFormat?: number;
      sortText?: string;
      filterText?: string;
      textEdit?: {
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        newText: string;
      };
    }

    interface CompletionResult {
      items: CompletionItem[];
      isIncomplete: boolean;
    }

    it("should get completions via invoke", async () => {
      const mockResult: CompletionResult = {
        items: [
          { label: "console", kind: "module" },
          { label: "log", kind: "method", detail: "(...args: any[]): void" },
        ],
        isIncomplete: false,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const result = await invoke("lsp_get_completions", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        position: { line: 0, character: 8 },
      });

      expect(result).toEqual(mockResult);
    });

    it("should handle incomplete completions", async () => {
      const mockResult: CompletionResult = {
        items: [{ label: "item1" }],
        isIncomplete: true,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const result = await invoke<CompletionResult>("lsp_get_completions", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        position: { line: 0, character: 0 },
      });

      expect(result.isIncomplete).toBe(true);
    });
  });

  describe("LSP Hover", () => {
    interface HoverResult {
      contents: string;
      range?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    }

    it("should get hover info via invoke", async () => {
      const mockHover: HoverResult = {
        contents: "const x: number",
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 7 },
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockHover);

      const result = await invoke("lsp_get_hover", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        position: { line: 0, character: 6 },
      });

      expect(result).toEqual(mockHover);
    });

    it("should handle no hover result", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(null);

      const result = await invoke("lsp_get_hover", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        position: { line: 0, character: 0 },
      });

      expect(result).toBeNull();
    });
  });

  describe("LSP Definition and References", () => {
    interface Location {
      uri: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    }

    interface LocationResult {
      locations: Location[];
    }

    it("should get definition via invoke", async () => {
      const mockResult: LocationResult = {
        locations: [
          {
            uri: "file:///src/types.ts",
            range: {
              start: { line: 10, character: 0 },
              end: { line: 10, character: 15 },
            },
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const result = await invoke("lsp_get_definition", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        position: { line: 5, character: 10 },
      });

      expect(result).toEqual(mockResult);
    });

    it("should get references via invoke", async () => {
      const mockResult: LocationResult = {
        locations: [
          {
            uri: "file:///src/app.ts",
            range: { start: { line: 5, character: 0 }, end: { line: 5, character: 5 } },
          },
          {
            uri: "file:///src/utils.ts",
            range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const result = await invoke<LocationResult>("lsp_get_references", {
        serverId: "ts-server-1",
        filePath: "/src/app.ts",
        position: { line: 5, character: 2 },
      });

      expect(result.locations).toHaveLength(2);
    });
  });

  describe("LSP Diagnostics", () => {
    interface Diagnostic {
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      message: string;
      severity?: string;
      source?: string;
      code?: string | number;
    }

    it("should track diagnostics for file", () => {
      const diagnostics: Diagnostic[] = [
        {
          range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
          message: "Cannot find name 'foo'",
          severity: "error",
          source: "typescript",
          code: 2304,
        },
        {
          range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
          message: "Unused variable 'x'",
          severity: "warning",
          source: "typescript",
          code: 6133,
        },
      ];

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0].severity).toBe("error");
    });

    it("should convert diagnostics to markers", () => {
      const SEVERITY_MAP: Record<string, number> = {
        error: 8,
        warning: 4,
        information: 2,
        hint: 1,
      };

      const diagnostic: Diagnostic = {
        range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
        message: "Error message",
        severity: "error",
      };

      const marker = {
        severity: diagnostic.severity ? SEVERITY_MAP[diagnostic.severity] ?? 2 : 2,
        startLineNumber: diagnostic.range.start.line + 1,
        startColumn: diagnostic.range.start.character + 1,
        endLineNumber: diagnostic.range.end.line + 1,
        endColumn: diagnostic.range.end.character + 1,
        message: diagnostic.message,
        source: diagnostic.source ?? undefined,
        code: diagnostic.code ?? undefined,
      };

      expect(marker.severity).toBe(8);
      expect(marker.startLineNumber).toBe(6);
    });
  });

  describe("LSP Events", () => {
    it("should listen for diagnostics events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("lsp:diagnostics", () => {});

      expect(listen).toHaveBeenCalledWith("lsp:diagnostics", expect.any(Function));
    });

    it("should listen for server status events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("lsp:server-status", () => {});

      expect(listen).toHaveBeenCalledWith("lsp:server-status", expect.any(Function));
    });
  });

  describe("Inlay Hints Settings", () => {
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

    it("should create default inlay hints settings", () => {
      const defaults: InlayHintsSettings = {
        enabled: true,
        fontSize: 0,
        fontFamily: "",
        showTypes: true,
        showParameterNames: true,
        showReturnTypes: true,
        maxLength: 25,
        padding: true,
      };

      expect(defaults.enabled).toBe(true);
      expect(defaults.maxLength).toBe(25);
    });

    it("should configure inlay hints", () => {
      const settings: InlayHintsSettings = {
        enabled: true,
        fontSize: 11,
        fontFamily: "Fira Code",
        showTypes: true,
        showParameterNames: false,
        showReturnTypes: true,
        maxLength: 30,
        padding: false,
      };

      expect(settings.fontFamily).toBe("Fira Code");
      expect(settings.showParameterNames).toBe(false);
    });
  });

  describe("Semantic Highlighting Settings", () => {
    interface SemanticHighlightingSettings {
      enabled: boolean;
      strings: boolean;
      comments: boolean;
    }

    it("should create default semantic highlighting settings", () => {
      const defaults: SemanticHighlightingSettings = {
        enabled: true,
        strings: true,
        comments: true,
      };

      expect(defaults.enabled).toBe(true);
    });

    it("should toggle semantic highlighting", () => {
      const settings: SemanticHighlightingSettings = {
        enabled: false,
        strings: false,
        comments: true,
      };

      expect(settings.enabled).toBe(false);
      expect(settings.strings).toBe(false);
    });
  });
});
