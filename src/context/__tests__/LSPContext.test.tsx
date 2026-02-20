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

describe("LSPContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LSP Types", () => {
    interface Position {
      line: number;
      character: number;
    }

    interface Range {
      start: Position;
      end: Position;
    }

    it("should create position", () => {
      const pos: Position = { line: 10, character: 5 };
      expect(pos.line).toBe(10);
      expect(pos.character).toBe(5);
    });

    it("should create range", () => {
      const range: Range = {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 20 },
      };
      expect(range.start.line).toBe(10);
      expect(range.end.character).toBe(20);
    });

    it("should compare positions", () => {
      const comparePositions = (a: Position, b: Position): number => {
        if (a.line !== b.line) return a.line - b.line;
        return a.character - b.character;
      };

      expect(comparePositions({ line: 1, character: 0 }, { line: 2, character: 0 })).toBeLessThan(0);
      expect(comparePositions({ line: 2, character: 0 }, { line: 1, character: 0 })).toBeGreaterThan(0);
      expect(comparePositions({ line: 1, character: 5 }, { line: 1, character: 10 })).toBeLessThan(0);
      expect(comparePositions({ line: 1, character: 5 }, { line: 1, character: 5 })).toBe(0);
    });
  });

  describe("Diagnostics", () => {
    type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

    interface Diagnostic {
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      severity?: DiagnosticSeverity;
      code?: string;
      source?: string;
      message: string;
    }

    it("should create diagnostic", () => {
      const diagnostic: Diagnostic = {
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 10 },
        },
        severity: "error",
        code: "TS2322",
        source: "typescript",
        message: "Type 'string' is not assignable to type 'number'",
      };

      expect(diagnostic.severity).toBe("error");
      expect(diagnostic.source).toBe("typescript");
    });

    it("should filter diagnostics by severity", () => {
      const diagnostics: Diagnostic[] = [
        { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }, severity: "error", message: "Error 1" },
        { range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } }, severity: "warning", message: "Warning 1" },
        { range: { start: { line: 3, character: 0 }, end: { line: 3, character: 5 } }, severity: "error", message: "Error 2" },
        { range: { start: { line: 4, character: 0 }, end: { line: 4, character: 5 } }, severity: "hint", message: "Hint 1" },
      ];

      const errors = diagnostics.filter(d => d.severity === "error");
      const warnings = diagnostics.filter(d => d.severity === "warning");

      expect(errors).toHaveLength(2);
      expect(warnings).toHaveLength(1);
    });

    it("should group diagnostics by file", () => {
      const diagnosticsByFile = new Map<string, Diagnostic[]>();

      const addDiagnostic = (uri: string, diagnostic: Diagnostic) => {
        const existing = diagnosticsByFile.get(uri) || [];
        existing.push(diagnostic);
        diagnosticsByFile.set(uri, existing);
      };

      addDiagnostic("file:///src/app.ts", {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
        message: "Error in app.ts",
      });

      addDiagnostic("file:///src/utils.ts", {
        range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
        message: "Error in utils.ts",
      });

      expect(diagnosticsByFile.size).toBe(2);
      expect(diagnosticsByFile.get("file:///src/app.ts")).toHaveLength(1);
    });

    it("should count diagnostics by severity", () => {
      const diagnostics: Diagnostic[] = [
        { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }, severity: "error", message: "E1" },
        { range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } }, severity: "error", message: "E2" },
        { range: { start: { line: 3, character: 0 }, end: { line: 3, character: 5 } }, severity: "warning", message: "W1" },
        { range: { start: { line: 4, character: 0 }, end: { line: 4, character: 5 } }, severity: "information", message: "I1" },
      ];

      const counts = diagnostics.reduce((acc, d) => {
        const severity = d.severity || "information";
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(counts.error).toBe(2);
      expect(counts.warning).toBe(1);
      expect(counts.information).toBe(1);
    });
  });

  describe("Completions", () => {
    interface CompletionItem {
      label: string;
      kind?: string;
      detail?: string;
      documentation?: string;
      insertText?: string;
      sortText?: string;
    }

    it("should request completions via invoke", async () => {
      const mockCompletions = {
        items: [
          { label: "console", kind: "variable" },
          { label: "const", kind: "keyword" },
        ],
        isIncomplete: false,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockCompletions);

      const result = await invoke("lsp_completion", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 10, character: 5 },
      });

      expect(invoke).toHaveBeenCalledWith("lsp_completion", expect.any(Object));
      expect(result).toEqual(mockCompletions);
    });

    it("should filter completions by prefix", () => {
      const items: CompletionItem[] = [
        { label: "console" },
        { label: "const" },
        { label: "constructor" },
        { label: "continue" },
        { label: "Array" },
      ];

      const filterByPrefix = (items: CompletionItem[], prefix: string): CompletionItem[] => {
        const lower = prefix.toLowerCase();
        return items.filter(item => item.label.toLowerCase().startsWith(lower));
      };

      const filtered = filterByPrefix(items, "con");
      expect(filtered).toHaveLength(4);
      expect(filtered.map(i => i.label)).toContain("console");
      expect(filtered.map(i => i.label)).not.toContain("Array");
    });

    it("should sort completions by sortText", () => {
      const items: CompletionItem[] = [
        { label: "zebra", sortText: "3" },
        { label: "apple", sortText: "1" },
        { label: "banana", sortText: "2" },
      ];

      const sorted = [...items].sort((a, b) => {
        const aSort = a.sortText || a.label;
        const bSort = b.sortText || b.label;
        return aSort.localeCompare(bSort);
      });

      expect(sorted[0].label).toBe("apple");
      expect(sorted[1].label).toBe("banana");
      expect(sorted[2].label).toBe("zebra");
    });

    it("should resolve completion item details", async () => {
      const resolvedItem = {
        label: "useState",
        kind: "function",
        detail: "(initialState: S) => [S, Dispatch<SetStateAction<S>>]",
        documentation: "Returns a stateful value and a function to update it.",
      };

      vi.mocked(invoke).mockResolvedValueOnce(resolvedItem);

      const result = await invoke("lsp_completion_resolve", {
        serverId: "typescript",
        item: { label: "useState" },
      });

      expect(result).toHaveProperty("documentation");
    });
  });

  describe("Hover", () => {
    interface HoverInfo {
      contents: string;
      range?: { start: { line: number; character: number }; end: { line: number; character: number } };
    }

    it("should request hover info via invoke", async () => {
      const mockHover: HoverInfo = {
        contents: "```typescript\nconst x: number\n```\nA numeric variable",
        range: {
          start: { line: 5, character: 6 },
          end: { line: 5, character: 7 },
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockHover);

      const result = await invoke("lsp_hover", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 5, character: 6 },
      });

      expect(result).toEqual(mockHover);
    });

    it("should handle no hover info", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(null);

      const result = await invoke("lsp_hover", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 100, character: 0 },
      });

      expect(result).toBe(null);
    });
  });

  describe("Go to Definition", () => {
    interface Location {
      uri: string;
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
    }

    it("should request definition via invoke", async () => {
      const mockLocations: Location[] = [
        {
          uri: "file:///src/types.ts",
          range: {
            start: { line: 10, character: 0 },
            end: { line: 10, character: 15 },
          },
        },
      ];

      vi.mocked(invoke).mockResolvedValueOnce({ locations: mockLocations });

      const result = await invoke("lsp_definition", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 5, character: 10 },
      });

      expect(result).toEqual({ locations: mockLocations });
    });

    it("should handle multiple definition locations", async () => {
      const mockLocations: Location[] = [
        { uri: "file:///src/a.ts", range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } } },
        { uri: "file:///src/b.ts", range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } } },
      ];

      vi.mocked(invoke).mockResolvedValueOnce({ locations: mockLocations });

      const result = await invoke<{ locations: Location[] }>("lsp_definition", {});
      expect(result.locations).toHaveLength(2);
    });
  });

  describe("Find References", () => {
    it("should request references via invoke", async () => {
      const mockReferences = {
        locations: [
          { uri: "file:///src/app.ts", range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } } },
          { uri: "file:///src/utils.ts", range: { start: { line: 15, character: 0 }, end: { line: 15, character: 10 } } },
          { uri: "file:///src/test.ts", range: { start: { line: 25, character: 0 }, end: { line: 25, character: 10 } } },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockReferences);

      const result = await invoke("lsp_references", {
        serverId: "typescript",
        uri: "file:///src/types.ts",
        position: { line: 10, character: 5 },
        includeDeclaration: true,
      });

      expect(result).toEqual(mockReferences);
    });
  });

  describe("Semantic Tokens", () => {
    interface SemanticTokensResult {
      resultId?: string;
      data: number[];
    }

    it("should request semantic tokens via invoke", async () => {
      const mockTokens: SemanticTokensResult = {
        resultId: "1",
        data: [0, 0, 5, 0, 0, 0, 6, 3, 1, 0, 1, 0, 10, 2, 0],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockTokens);

      const result = await invoke("lsp_semantic_tokens", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
      });

      expect(result).toEqual(mockTokens);
    });

    it("should decode semantic tokens", () => {
      const data = [0, 0, 5, 0, 0, 0, 6, 3, 1, 0, 1, 0, 10, 2, 0];
      
      interface DecodedToken {
        line: number;
        startChar: number;
        length: number;
        tokenType: number;
        tokenModifiers: number;
      }

      const decodeTokens = (data: number[]): DecodedToken[] => {
        const tokens: DecodedToken[] = [];
        let line = 0;
        let char = 0;

        for (let i = 0; i < data.length; i += 5) {
          const deltaLine = data[i];
          const deltaStart = data[i + 1];
          const length = data[i + 2];
          const tokenType = data[i + 3];
          const tokenModifiers = data[i + 4];

          line += deltaLine;
          char = deltaLine > 0 ? deltaStart : char + deltaStart;

          tokens.push({ line, startChar: char, length, tokenType, tokenModifiers });
        }

        return tokens;
      };

      const decoded = decodeTokens(data);
      expect(decoded).toHaveLength(3);
      expect(decoded[0]).toEqual({ line: 0, startChar: 0, length: 5, tokenType: 0, tokenModifiers: 0 });
    });
  });

  describe("Language Server Management", () => {
    type ServerStatus = "starting" | "running" | "stopped" | "error";

    interface ServerInfo {
      id: string;
      name: string;
      status: ServerStatus;
    }

    it("should start language server", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: "typescript", status: "running" });

      const result = await invoke("lsp_start_server", {
        id: "typescript",
        command: "typescript-language-server",
        args: ["--stdio"],
        rootPath: "/project",
      });

      expect(result).toHaveProperty("status", "running");
    });

    it("should stop language server", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("lsp_stop_server", { id: "typescript" });

      expect(invoke).toHaveBeenCalledWith("lsp_stop_server", { id: "typescript" });
    });

    it("should track server status", () => {
      const servers: ServerInfo[] = [
        { id: "typescript", name: "TypeScript", status: "running" },
        { id: "rust-analyzer", name: "Rust Analyzer", status: "stopped" },
      ];

      const runningServers = servers.filter(s => s.status === "running");
      expect(runningServers).toHaveLength(1);
      expect(runningServers[0].id).toBe("typescript");
    });

    it("should listen for server status changes", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("lsp:server-status", () => {});

      expect(listen).toHaveBeenCalledWith("lsp:server-status", expect.any(Function));
    });
  });

  describe("Code Actions", () => {
    interface CodeAction {
      title: string;
      kind?: string;
      diagnostics?: unknown[];
      isPreferred?: boolean;
      edit?: unknown;
      command?: unknown;
    }

    it("should request code actions via invoke", async () => {
      const mockActions: CodeAction[] = [
        { title: "Add missing import", kind: "quickfix", isPreferred: true },
        { title: "Remove unused variable", kind: "quickfix" },
        { title: "Extract to function", kind: "refactor.extract" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockActions);

      const result = await invoke("lsp_code_actions", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
      });

      expect(result).toEqual(mockActions);
    });

    it("should filter code actions by kind", () => {
      const actions: CodeAction[] = [
        { title: "Fix 1", kind: "quickfix" },
        { title: "Fix 2", kind: "quickfix" },
        { title: "Refactor 1", kind: "refactor.extract" },
        { title: "Refactor 2", kind: "refactor.inline" },
      ];

      const quickfixes = actions.filter(a => a.kind?.startsWith("quickfix"));
      const refactors = actions.filter(a => a.kind?.startsWith("refactor"));

      expect(quickfixes).toHaveLength(2);
      expect(refactors).toHaveLength(2);
    });
  });

  describe("Rename", () => {
    it("should prepare rename", async () => {
      const mockPrepare = {
        range: { start: { line: 5, character: 6 }, end: { line: 5, character: 12 } },
        placeholder: "myFunc",
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockPrepare);

      const result = await invoke("lsp_prepare_rename", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 5, character: 8 },
      });

      expect(result).toEqual(mockPrepare);
    });

    it("should perform rename", async () => {
      const mockEdit = {
        changes: {
          "file:///src/app.ts": [
            { range: { start: { line: 5, character: 6 }, end: { line: 5, character: 12 } }, newText: "newFunc" },
          ],
          "file:///src/utils.ts": [
            { range: { start: { line: 10, character: 0 }, end: { line: 10, character: 6 } }, newText: "newFunc" },
          ],
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockEdit);

      const result = await invoke("lsp_rename", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 5, character: 8 },
        newName: "newFunc",
      });

      expect(result).toEqual(mockEdit);
    });
  });

  describe("Document Formatting", () => {
    it("should format document", async () => {
      const mockEdits = [
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, newText: "  " },
        { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } }, newText: "    " },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockEdits);

      const result = await invoke("lsp_format", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        options: { tabSize: 2, insertSpaces: true },
      });

      expect(result).toEqual(mockEdits);
    });

    it("should format document range", async () => {
      const mockEdits = [
        { range: { start: { line: 5, character: 0 }, end: { line: 5, character: 2 } }, newText: "    " },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockEdits);

      const result = await invoke("lsp_format_range", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        range: { start: { line: 5, character: 0 }, end: { line: 10, character: 0 } },
        options: { tabSize: 4, insertSpaces: true },
      });

      expect(result).toEqual(mockEdits);
    });
  });

  describe("Signature Help", () => {
    interface SignatureHelp {
      signatures: Array<{
        label: string;
        documentation?: string;
        parameters?: Array<{ label: string; documentation?: string }>;
      }>;
      activeSignature?: number;
      activeParameter?: number;
    }

    it("should request signature help", async () => {
      const mockSignature: SignatureHelp = {
        signatures: [
          {
            label: "console.log(message?: any, ...optionalParams: any[]): void",
            documentation: "Prints to stdout with newline.",
            parameters: [
              { label: "message?: any" },
              { label: "...optionalParams: any[]" },
            ],
          },
        ],
        activeSignature: 0,
        activeParameter: 0,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockSignature);

      const result = await invoke("lsp_signature_help", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        position: { line: 5, character: 15 },
      });

      expect(result).toEqual(mockSignature);
    });
  });

  describe("Document Symbols", () => {
    interface DocumentSymbol {
      name: string;
      kind: number;
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      children?: DocumentSymbol[];
    }

    it("should request document symbols", async () => {
      const mockSymbols: DocumentSymbol[] = [
        {
          name: "MyClass",
          kind: 5,
          range: { start: { line: 0, character: 0 }, end: { line: 50, character: 1 } },
          children: [
            { name: "constructor", kind: 9, range: { start: { line: 2, character: 2 }, end: { line: 5, character: 3 } } },
            { name: "myMethod", kind: 6, range: { start: { line: 7, character: 2 }, end: { line: 15, character: 3 } } },
          ],
        },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockSymbols);

      const result = await invoke("lsp_document_symbols", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
      });

      expect(result).toEqual(mockSymbols);
    });
  });

  describe("Inlay Hints", () => {
    interface InlayHint {
      position: { line: number; character: number };
      label: string;
      kind: number;
    }

    it("should request inlay hints", async () => {
      const mockHints: InlayHint[] = [
        { position: { line: 5, character: 10 }, label: ": number", kind: 1 },
        { position: { line: 7, character: 15 }, label: "param: ", kind: 2 },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockHints);

      const result = await invoke("lsp_inlay_hints", {
        serverId: "typescript",
        uri: "file:///src/app.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 100, character: 0 } },
      });

      expect(result).toEqual(mockHints);
    });
  });

  describe("Server Health", () => {
    type ServerHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

    interface ServerHealth {
      serverId: string;
      status: ServerHealthStatus;
      uptime?: number;
      lastResponseTime?: number;
      errorCount: number;
    }

    const getServerHealth = (servers: ServerHealth[], serverId: string): ServerHealth | null => {
      return servers.find(s => s.serverId === serverId) || null;
    };

    it("should return status per server", () => {
      const servers: ServerHealth[] = [
        { serverId: "typescript", status: "healthy", uptime: 3600, lastResponseTime: 50, errorCount: 0 },
        { serverId: "rust-analyzer", status: "degraded", uptime: 1800, lastResponseTime: 500, errorCount: 3 },
      ];

      const tsHealth = getServerHealth(servers, "typescript");
      expect(tsHealth).toBeDefined();
      expect(tsHealth!.status).toBe("healthy");

      const rustHealth = getServerHealth(servers, "rust-analyzer");
      expect(rustHealth).toBeDefined();
      expect(rustHealth!.status).toBe("degraded");
    });

    it("should report health for running server", () => {
      const health: ServerHealth = {
        serverId: "typescript",
        status: "healthy",
        uptime: 7200,
        lastResponseTime: 25,
        errorCount: 0,
      };

      expect(health.status).toBe("healthy");
      expect(health.errorCount).toBe(0);
      expect(health.uptime).toBeGreaterThan(0);
    });

    it("should report health for stopped server", () => {
      const health: ServerHealth = {
        serverId: "python-lsp",
        status: "unhealthy",
        errorCount: 0,
      };

      expect(health.status).toBe("unhealthy");
      expect(health.uptime).toBeUndefined();
    });

    it("should report health for error server", () => {
      const health: ServerHealth = {
        serverId: "clangd",
        status: "unhealthy",
        lastResponseTime: 0,
        errorCount: 15,
      };

      expect(health.status).toBe("unhealthy");
      expect(health.errorCount).toBe(15);
    });

    it("should handle multiple servers", () => {
      const servers: ServerHealth[] = [
        { serverId: "typescript", status: "healthy", errorCount: 0 },
        { serverId: "rust-analyzer", status: "healthy", errorCount: 0 },
        { serverId: "python-lsp", status: "unhealthy", errorCount: 5 },
        { serverId: "clangd", status: "degraded", errorCount: 2 },
      ];

      const healthyCount = servers.filter(s => s.status === "healthy").length;
      const unhealthyCount = servers.filter(s => s.status === "unhealthy").length;

      expect(healthyCount).toBe(2);
      expect(unhealthyCount).toBe(1);
      expect(servers).toHaveLength(4);
    });
  });

  describe("Capabilities Per Language", () => {
    interface ServerCapabilities {
      completion: boolean;
      hover: boolean;
      definition: boolean;
      references: boolean;
      rename: boolean;
      formatting: boolean;
      codeActions: boolean;
      signatureHelp: boolean;
      documentSymbols: boolean;
      inlayHints: boolean;
    }

    interface LanguageCapabilities {
      languageId: string;
      serverId: string;
      capabilities: ServerCapabilities;
    }

    const getCapabilitiesForLanguage = (
      allCapabilities: LanguageCapabilities[],
      languageId: string
    ): ServerCapabilities | null => {
      const entry = allCapabilities.find(c => c.languageId === languageId);
      return entry ? entry.capabilities : null;
    };

    const ALL_CAPABILITIES: LanguageCapabilities[] = [
      {
        languageId: "typescript",
        serverId: "typescript-language-server",
        capabilities: {
          completion: true,
          hover: true,
          definition: true,
          references: true,
          rename: true,
          formatting: true,
          codeActions: true,
          signatureHelp: true,
          documentSymbols: true,
          inlayHints: true,
        },
      },
      {
        languageId: "rust",
        serverId: "rust-analyzer",
        capabilities: {
          completion: true,
          hover: true,
          definition: true,
          references: true,
          rename: true,
          formatting: true,
          codeActions: true,
          signatureHelp: true,
          documentSymbols: true,
          inlayHints: true,
        },
      },
    ];

    it("should return capabilities for a language", () => {
      const caps = getCapabilitiesForLanguage(ALL_CAPABILITIES, "typescript");
      expect(caps).toBeDefined();
      expect(caps!.completion).toBe(true);
    });

    it("should return full capabilities for typescript", () => {
      const caps = getCapabilitiesForLanguage(ALL_CAPABILITIES, "typescript");
      expect(caps).toBeDefined();
      expect(caps!.hover).toBe(true);
      expect(caps!.definition).toBe(true);
      expect(caps!.references).toBe(true);
      expect(caps!.rename).toBe(true);
      expect(caps!.formatting).toBe(true);
    });

    it("should return null for unknown language", () => {
      const caps = getCapabilitiesForLanguage(ALL_CAPABILITIES, "brainfuck");
      expect(caps).toBeNull();
    });

    it("should include completion, hover, and definition capabilities", () => {
      const caps = getCapabilitiesForLanguage(ALL_CAPABILITIES, "rust");
      expect(caps).toBeDefined();
      expect(caps!.completion).toBe(true);
      expect(caps!.hover).toBe(true);
      expect(caps!.definition).toBe(true);
    });

    it("should track capabilities per server", () => {
      const serverCapMap = new Map<string, ServerCapabilities>();

      for (const entry of ALL_CAPABILITIES) {
        serverCapMap.set(entry.serverId, entry.capabilities);
      }

      expect(serverCapMap.size).toBe(2);
      expect(serverCapMap.has("typescript-language-server")).toBe(true);
      expect(serverCapMap.has("rust-analyzer")).toBe(true);
      expect(serverCapMap.get("typescript-language-server")!.inlayHints).toBe(true);
    });
  });
});
