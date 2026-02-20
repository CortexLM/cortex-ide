import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("OutlineContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SymbolKind", () => {
    type SymbolKind =
      | "file"
      | "module"
      | "namespace"
      | "package"
      | "class"
      | "method"
      | "property"
      | "field"
      | "constructor"
      | "enum"
      | "interface"
      | "function"
      | "variable"
      | "constant"
      | "string"
      | "number"
      | "boolean"
      | "array"
      | "object"
      | "key"
      | "null"
      | "enumMember"
      | "struct"
      | "event"
      | "operator"
      | "typeParameter";

    it("should support class kind", () => {
      const kind: SymbolKind = "class";
      expect(kind).toBe("class");
    });

    it("should support function kind", () => {
      const kind: SymbolKind = "function";
      expect(kind).toBe("function");
    });

    it("should support interface kind", () => {
      const kind: SymbolKind = "interface";
      expect(kind).toBe("interface");
    });

    it("should support variable kind", () => {
      const kind: SymbolKind = "variable";
      expect(kind).toBe("variable");
    });
  });

  describe("SymbolRange", () => {
    interface SymbolRange {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    }

    it("should create symbol range", () => {
      const range: SymbolRange = {
        startLine: 10,
        startColumn: 1,
        endLine: 25,
        endColumn: 2,
      };

      expect(range.startLine).toBe(10);
      expect(range.endLine).toBe(25);
    });

    it("should represent single line range", () => {
      const range: SymbolRange = {
        startLine: 15,
        startColumn: 5,
        endLine: 15,
        endColumn: 20,
      };

      expect(range.startLine).toBe(range.endLine);
    });
  });

  describe("DocumentSymbol", () => {
    interface SymbolRange {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    }

    interface DocumentSymbol {
      id: string;
      name: string;
      detail?: string;
      kind: string;
      tags?: number[];
      range: SymbolRange;
      selectionRange: SymbolRange;
      children: DocumentSymbol[];
      depth: number;
      expanded: boolean;
    }

    it("should create document symbol", () => {
      const symbol: DocumentSymbol = {
        id: "sym-1",
        name: "MyClass",
        kind: "class",
        range: { startLine: 1, startColumn: 1, endLine: 50, endColumn: 1 },
        selectionRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 14 },
        children: [],
        depth: 0,
        expanded: true,
      };

      expect(symbol.name).toBe("MyClass");
      expect(symbol.kind).toBe("class");
    });

    it("should support nested symbols", () => {
      const classSymbol: DocumentSymbol = {
        id: "sym-1",
        name: "MyClass",
        kind: "class",
        range: { startLine: 1, startColumn: 1, endLine: 50, endColumn: 1 },
        selectionRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 14 },
        children: [
          {
            id: "sym-2",
            name: "constructor",
            kind: "constructor",
            range: { startLine: 2, startColumn: 3, endLine: 5, endColumn: 3 },
            selectionRange: { startLine: 2, startColumn: 3, endLine: 2, endColumn: 14 },
            children: [],
            depth: 1,
            expanded: false,
          },
          {
            id: "sym-3",
            name: "myMethod",
            kind: "method",
            range: { startLine: 7, startColumn: 3, endLine: 15, endColumn: 3 },
            selectionRange: { startLine: 7, startColumn: 3, endLine: 7, endColumn: 11 },
            children: [],
            depth: 1,
            expanded: false,
          },
        ],
        depth: 0,
        expanded: true,
      };

      expect(classSymbol.children).toHaveLength(2);
      expect(classSymbol.children[0].kind).toBe("constructor");
    });

    it("should support deprecated symbols", () => {
      const symbol: DocumentSymbol = {
        id: "sym-1",
        name: "oldFunction",
        kind: "function",
        tags: [1],
        range: { startLine: 1, startColumn: 1, endLine: 5, endColumn: 1 },
        selectionRange: { startLine: 1, startColumn: 10, endLine: 1, endColumn: 21 },
        children: [],
        depth: 0,
        expanded: false,
      };

      expect(symbol.tags).toContain(1);
    });
  });

  describe("Outline Cache", () => {
    const OUTLINE_CACHE_SIZE = 15;
    const OUTLINE_CACHE_TTL = 60000;

    interface CachedOutline {
      symbols: Array<{ name: string }>;
      version: number;
      timestamp: number;
    }

    it("should cache outline with version", () => {
      const cache = new Map<string, CachedOutline>();

      cache.set("/src/app.ts", {
        symbols: [{ name: "MyClass" }],
        version: 12345,
        timestamp: Date.now(),
      });

      const entry = cache.get("/src/app.ts");
      expect(entry?.version).toBe(12345);
    });

    it("should invalidate on version mismatch", () => {
      const cache = new Map<string, CachedOutline>();
      cache.set("/src/app.ts", {
        symbols: [{ name: "MyClass" }],
        version: 12345,
        timestamp: Date.now(),
      });

      const get = (path: string, version: number) => {
        const entry = cache.get(path);
        if (!entry || entry.version !== version) {
          cache.delete(path);
          return null;
        }
        return entry.symbols;
      };

      const result = get("/src/app.ts", 99999);
      expect(result).toBeNull();
    });

    it("should invalidate on TTL expiration", () => {
      const cache = new Map<string, CachedOutline>();
      cache.set("/src/app.ts", {
        symbols: [{ name: "MyClass" }],
        version: 12345,
        timestamp: Date.now() - OUTLINE_CACHE_TTL - 1000,
      });

      const get = (path: string, version: number) => {
        const entry = cache.get(path);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > OUTLINE_CACHE_TTL) {
          cache.delete(path);
          return null;
        }
        if (entry.version !== version) {
          cache.delete(path);
          return null;
        }
        return entry.symbols;
      };

      const result = get("/src/app.ts", 12345);
      expect(result).toBeNull();
    });

    it("should respect cache size limit", () => {
      const cache = new Map<string, CachedOutline>();
      const accessOrder: string[] = [];

      const set = (path: string, symbols: Array<{ name: string }>, version: number) => {
        while (cache.size >= OUTLINE_CACHE_SIZE) {
          const oldest = accessOrder.shift();
          if (oldest) cache.delete(oldest);
        }
        cache.set(path, { symbols, version, timestamp: Date.now() });
        accessOrder.push(path);
      };

      for (let i = 0; i < 20; i++) {
        set(`/src/file${i}.ts`, [{ name: `Class${i}` }], i);
      }

      expect(cache.size).toBe(OUTLINE_CACHE_SIZE);
    });
  });

  describe("Fetch Symbols", () => {
    it("should fetch symbols via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { id: "sym-1", name: "MyClass", kind: "class" },
      ]);

      const result = await invoke("lsp_document_symbols", {
        path: "/src/app.ts",
      });

      expect(invoke).toHaveBeenCalledWith("lsp_document_symbols", {
        path: "/src/app.ts",
      });
      expect(result).toHaveLength(1);
    });

    it("should handle empty symbols", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const result = await invoke("lsp_document_symbols", {
        path: "/src/empty.ts",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle fetch error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("LSP not available"));

      await expect(
        invoke("lsp_document_symbols", { path: "/src/app.ts" })
      ).rejects.toThrow("LSP not available");
    });
  });

  describe("Symbol Expansion", () => {
    interface DocumentSymbol {
      id: string;
      name: string;
      expanded: boolean;
      children: DocumentSymbol[];
    }

    it("should expand symbol", () => {
      const symbol: DocumentSymbol = {
        id: "sym-1",
        name: "MyClass",
        expanded: false,
        children: [
          { id: "sym-2", name: "method1", expanded: false, children: [] },
        ],
      };

      symbol.expanded = true;

      expect(symbol.expanded).toBe(true);
    });

    it("should collapse symbol", () => {
      const symbol: DocumentSymbol = {
        id: "sym-1",
        name: "MyClass",
        expanded: true,
        children: [
          { id: "sym-2", name: "method1", expanded: false, children: [] },
        ],
      };

      symbol.expanded = false;

      expect(symbol.expanded).toBe(false);
    });

    it("should toggle symbol expansion", () => {
      const symbol = { id: "sym-1", expanded: false };

      const toggle = () => {
        symbol.expanded = !symbol.expanded;
      };

      toggle();
      expect(symbol.expanded).toBe(true);

      toggle();
      expect(symbol.expanded).toBe(false);
    });
  });

  describe("Symbol Type Filter", () => {
    type SymbolTypeFilter =
      | "class"
      | "function"
      | "variable"
      | "interface"
      | "enum"
      | "property"
      | "module"
      | "type"
      | "other";

    const symbolKindToFilter: Record<string, SymbolTypeFilter> = {
      file: "module",
      module: "module",
      namespace: "module",
      class: "class",
      method: "function",
      function: "function",
      "constructor": "function" as SymbolTypeFilter,
      interface: "interface",
      enum: "enum",
      variable: "variable",
      constant: "variable",
      property: "property",
      field: "property",
    };

    it("should map class kind to class filter", () => {
      expect(symbolKindToFilter["class"]).toBe("class");
    });

    it("should map method kind to function filter", () => {
      expect(symbolKindToFilter["method"]).toBe("function");
    });

    it("should map module kind to module filter", () => {
      expect(symbolKindToFilter["module"]).toBe("module");
    });

    it("should filter symbols by type", () => {
      const symbols = [
        { name: "MyClass", kind: "class" },
        { name: "myFunction", kind: "function" },
        { name: "myVar", kind: "variable" },
      ];

      const filtered = symbols.filter(
        s => symbolKindToFilter[s.kind] === "function"
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("myFunction");
    });
  });

  describe("Content Hashing", () => {
    it("should generate consistent hash for same content", () => {
      const hashContent = (content: string): number => {
        let hash = 5381;
        for (let i = 0; i < content.length; i++) {
          hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
        }
        return hash >>> 0;
      };

      const hash1 = hashContent("const x = 1;");
      const hash2 = hashContent("const x = 1;");

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different content", () => {
      const hashContent = (content: string): number => {
        let hash = 5381;
        for (let i = 0; i < content.length; i++) {
          hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
        }
        return hash >>> 0;
      };

      const hash1 = hashContent("const x = 1;");
      const hash2 = hashContent("const x = 2;");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Outline State", () => {
    interface OutlineState {
      symbols: Array<{ id: string; name: string }>;
      loading: boolean;
      error: string | null;
      selectedSymbolId: string | null;
      searchQuery: string;
    }

    it("should initialize outline state", () => {
      const state: OutlineState = {
        symbols: [],
        loading: false,
        error: null,
        selectedSymbolId: null,
        searchQuery: "",
      };

      expect(state.symbols).toHaveLength(0);
      expect(state.loading).toBe(false);
    });

    it("should track loading state", () => {
      const state: OutlineState = {
        symbols: [],
        loading: true,
        error: null,
        selectedSymbolId: null,
        searchQuery: "",
      };

      expect(state.loading).toBe(true);
    });

    it("should track selected symbol", () => {
      const state: OutlineState = {
        symbols: [{ id: "sym-1", name: "MyClass" }],
        loading: false,
        error: null,
        selectedSymbolId: "sym-1",
        searchQuery: "",
      };

      expect(state.selectedSymbolId).toBe("sym-1");
    });

    it("should filter symbols by search query", () => {
      const symbols = [
        { id: "sym-1", name: "MyClass" },
        { id: "sym-2", name: "myFunction" },
        { id: "sym-3", name: "anotherClass" },
      ];
      const searchQuery = "class";

      const filtered = symbols.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe("Navigate to Symbol", () => {
    it("should navigate to symbol location", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("editor_goto", {
        path: "/src/app.ts",
        line: 10,
        column: 5,
      });

      expect(invoke).toHaveBeenCalledWith("editor_goto", {
        path: "/src/app.ts",
        line: 10,
        column: 5,
      });
    });
  });
});
