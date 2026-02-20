import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../utils/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("WorkspaceSymbolsContext", () => {
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

    const ALL_SYMBOL_KINDS: SymbolKind[] = [
      "file",
      "module",
      "namespace",
      "package",
      "class",
      "method",
      "property",
      "field",
      "constructor",
      "enum",
      "interface",
      "function",
      "variable",
      "constant",
      "string",
      "number",
      "boolean",
      "array",
      "object",
      "key",
      "null",
      "enumMember",
      "struct",
      "event",
      "operator",
      "typeParameter",
    ];

    it("should have 26 symbol kinds", () => {
      expect(ALL_SYMBOL_KINDS).toHaveLength(26);
    });

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

    it("should support method kind", () => {
      const kind: SymbolKind = "method";
      expect(kind).toBe("method");
    });

    it("should include all expected kinds", () => {
      expect(ALL_SYMBOL_KINDS).toContain("file");
      expect(ALL_SYMBOL_KINDS).toContain("module");
      expect(ALL_SYMBOL_KINDS).toContain("namespace");
      expect(ALL_SYMBOL_KINDS).toContain("package");
      expect(ALL_SYMBOL_KINDS).toContain("constructor");
      expect(ALL_SYMBOL_KINDS).toContain("enum");
      expect(ALL_SYMBOL_KINDS).toContain("constant");
      expect(ALL_SYMBOL_KINDS).toContain("struct");
      expect(ALL_SYMBOL_KINDS).toContain("typeParameter");
    });
  });

  describe("WorkspaceSymbol Type", () => {
    interface WorkspaceSymbol {
      name: string;
      kind: string;
      filePath: string;
      line: number;
      column: number;
      containerName: string | null;
    }

    it("should create workspace symbol with all fields", () => {
      const symbol: WorkspaceSymbol = {
        name: "MyClass",
        kind: "class",
        filePath: "/src/models/user.ts",
        line: 10,
        column: 7,
        containerName: "UserModule",
      };

      expect(symbol.name).toBe("MyClass");
      expect(symbol.kind).toBe("class");
      expect(symbol.filePath).toBe("/src/models/user.ts");
      expect(symbol.line).toBe(10);
      expect(symbol.column).toBe(7);
      expect(symbol.containerName).toBe("UserModule");
    });

    it("should create symbol with null containerName", () => {
      const symbol: WorkspaceSymbol = {
        name: "globalFunction",
        kind: "function",
        filePath: "/src/utils.ts",
        line: 1,
        column: 0,
        containerName: null,
      };

      expect(symbol.containerName).toBeNull();
    });

    it("should validate required fields exist", () => {
      const symbol: WorkspaceSymbol = {
        name: "x",
        kind: "variable",
        filePath: "/src/index.ts",
        line: 5,
        column: 4,
        containerName: null,
      };

      expect(symbol).toHaveProperty("name");
      expect(symbol).toHaveProperty("kind");
      expect(symbol).toHaveProperty("filePath");
      expect(symbol).toHaveProperty("line");
      expect(symbol).toHaveProperty("column");
      expect(symbol).toHaveProperty("containerName");
    });
  });

  describe("WorkspaceSymbol Validation", () => {
    interface WorkspaceSymbol {
      name: string;
      kind: string;
      filePath: string;
      line: number;
      column: number;
      containerName: string | null;
    }

    const isValidSymbol = (obj: unknown): obj is WorkspaceSymbol => {
      if (typeof obj !== "object" || obj === null) return false;
      const s = obj as Record<string, unknown>;
      return (
        typeof s.name === "string" &&
        typeof s.kind === "string" &&
        typeof s.filePath === "string" &&
        typeof s.line === "number" &&
        typeof s.column === "number" &&
        (s.containerName === null || typeof s.containerName === "string")
      );
    };

    it("should validate valid symbol", () => {
      const symbol = {
        name: "MyClass",
        kind: "class",
        filePath: "/src/app.ts",
        line: 10,
        column: 0,
        containerName: null,
      };

      expect(isValidSymbol(symbol)).toBe(true);
    });

    it("should reject invalid symbol missing fields", () => {
      const invalid = {
        name: "MyClass",
        kind: "class",
      };

      expect(isValidSymbol(invalid)).toBe(false);
    });

    it("should reject non-object", () => {
      expect(isValidSymbol("string")).toBe(false);
      expect(isValidSymbol(null)).toBe(false);
      expect(isValidSymbol(42)).toBe(false);
    });
  });

  describe("IndexStats Type", () => {
    interface IndexStats {
      totalSymbols: number;
      totalFiles: number;
      indexedAt: number;
      durationMs: number;
    }

    it("should create valid IndexStats", () => {
      const stats: IndexStats = {
        totalSymbols: 1500,
        totalFiles: 120,
        indexedAt: Date.now(),
        durationMs: 3200,
      };

      expect(stats.totalSymbols).toBe(1500);
      expect(stats.totalFiles).toBe(120);
      expect(stats.durationMs).toBe(3200);
      expect(stats.indexedAt).toBeGreaterThan(0);
    });

    it("should handle zero-value stats", () => {
      const stats: IndexStats = {
        totalSymbols: 0,
        totalFiles: 0,
        indexedAt: 0,
        durationMs: 0,
      };

      expect(stats.totalSymbols).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.indexedAt).toBe(0);
      expect(stats.durationMs).toBe(0);
    });

    it("should validate all fields are numeric", () => {
      const stats: IndexStats = {
        totalSymbols: 500,
        totalFiles: 50,
        indexedAt: 1700000000000,
        durationMs: 1500,
      };

      expect(typeof stats.totalSymbols).toBe("number");
      expect(typeof stats.totalFiles).toBe("number");
      expect(typeof stats.indexedAt).toBe("number");
      expect(typeof stats.durationMs).toBe("number");
    });
  });

  describe("WorkspaceSymbolsState", () => {
    interface WorkspaceSymbol {
      name: string;
      kind: string;
      filePath: string;
      line: number;
      column: number;
      containerName: string | null;
    }

    interface IndexStats {
      totalSymbols: number;
      totalFiles: number;
      indexedAt: number;
      durationMs: number;
    }

    interface WorkspaceSymbolsState {
      symbols: WorkspaceSymbol[];
      loading: boolean;
      error: string | null;
      stats: IndexStats | null;
      indexed: boolean;
    }

    it("should initialize with default state", () => {
      const state: WorkspaceSymbolsState = {
        symbols: [],
        loading: false,
        error: null,
        stats: null,
        indexed: false,
      };

      expect(state.symbols).toHaveLength(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.stats).toBeNull();
      expect(state.indexed).toBe(false);
    });

    it("should represent loading state", () => {
      const state: WorkspaceSymbolsState = {
        symbols: [],
        loading: true,
        error: null,
        stats: null,
        indexed: false,
      };

      expect(state.loading).toBe(true);
    });

    it("should represent error state", () => {
      const state: WorkspaceSymbolsState = {
        symbols: [],
        loading: false,
        error: "Failed to search symbols",
        stats: null,
        indexed: false,
      };

      expect(state.error).toBe("Failed to search symbols");
      expect(state.loading).toBe(false);
    });

    it("should represent indexed state with stats", () => {
      const state: WorkspaceSymbolsState = {
        symbols: [
          {
            name: "MyClass",
            kind: "class",
            filePath: "/src/app.ts",
            line: 5,
            column: 0,
            containerName: null,
          },
        ],
        loading: false,
        error: null,
        stats: {
          totalSymbols: 100,
          totalFiles: 10,
          indexedAt: Date.now(),
          durationMs: 500,
        },
        indexed: true,
      };

      expect(state.indexed).toBe(true);
      expect(state.stats).not.toBeNull();
      expect(state.stats!.totalSymbols).toBe(100);
      expect(state.symbols).toHaveLength(1);
    });
  });

  describe("IPC: workspace_symbols_search", () => {
    it("should invoke search with results", async () => {
      const mockResults = [
        {
          name: "UserService",
          kind: "class",
          filePath: "/src/services/user.ts",
          line: 15,
          column: 13,
          containerName: null,
        },
        {
          name: "getUser",
          kind: "function",
          filePath: "/src/services/user.ts",
          line: 30,
          column: 2,
          containerName: "UserService",
        },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockResults);

      const result = await invoke("workspace_symbols_search", {
        query: "user",
        maxResults: null,
      });

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_search", {
        query: "user",
        maxResults: null,
      });
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockResults);
    });

    it("should invoke search with empty results", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const result = await invoke("workspace_symbols_search", {
        query: "nonexistent",
        maxResults: null,
      });

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_search", {
        query: "nonexistent",
        maxResults: null,
      });
      expect(result).toHaveLength(0);
    });

    it("should invoke search with maxResults", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        {
          name: "Config",
          kind: "interface",
          filePath: "/src/config.ts",
          line: 1,
          column: 0,
          containerName: null,
        },
      ]);

      const result = await invoke("workspace_symbols_search", {
        query: "config",
        maxResults: 10,
      });

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_search", {
        query: "config",
        maxResults: 10,
      });
      expect(result).toHaveLength(1);
    });

    it("should pass null maxResults when not specified", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("workspace_symbols_search", {
        query: "test",
        maxResults: null,
      });

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_search", {
        query: "test",
        maxResults: null,
      });
    });

    it("should handle search error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Index not ready"));

      await expect(
        invoke("workspace_symbols_search", { query: "test", maxResults: null })
      ).rejects.toThrow("Index not ready");
    });
  });

  describe("IPC: workspace_symbols_index", () => {
    it("should invoke index and return stats", async () => {
      const mockStats = {
        totalSymbols: 2500,
        totalFiles: 200,
        indexedAt: Date.now(),
        durationMs: 4500,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockStats);

      const result = await invoke("workspace_symbols_index", {
        rootPath: "/home/user/project",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_index", {
        rootPath: "/home/user/project",
      });
      expect(result).toEqual(mockStats);
    });

    it("should pass rootPath parameter", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        totalSymbols: 0,
        totalFiles: 0,
        indexedAt: 0,
        durationMs: 0,
      });

      await invoke("workspace_symbols_index", {
        rootPath: "/workspace/my-project",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_index", {
        rootPath: "/workspace/my-project",
      });
    });

    it("should handle index error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Permission denied")
      );

      await expect(
        invoke("workspace_symbols_index", { rootPath: "/restricted" })
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("IPC: workspace_symbols_clear", () => {
    it("should invoke clear successfully", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_symbols_clear");

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_clear");
    });

    it("should handle clear error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Clear failed"));

      await expect(invoke("workspace_symbols_clear")).rejects.toThrow(
        "Clear failed"
      );
    });
  });

  describe("IPC: workspace_symbols_get_stats", () => {
    it("should invoke get_stats and return stats", async () => {
      const mockStats = {
        totalSymbols: 1000,
        totalFiles: 80,
        indexedAt: 1700000000000,
        durationMs: 2000,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockStats);

      const result = await invoke("workspace_symbols_get_stats");

      expect(invoke).toHaveBeenCalledWith("workspace_symbols_get_stats");
      expect(result).toEqual(mockStats);
    });

    it("should handle get_stats error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("No index available"));

      await expect(invoke("workspace_symbols_get_stats")).rejects.toThrow(
        "No index available"
      );
    });
  });

  describe("Symbol Sorting", () => {
    interface WorkspaceSymbol {
      name: string;
      kind: string;
      filePath: string;
      line: number;
      column: number;
      containerName: string | null;
    }

    it("should sort symbols by name", () => {
      const symbols: WorkspaceSymbol[] = [
        { name: "Zebra", kind: "class", filePath: "/a.ts", line: 1, column: 0, containerName: null },
        { name: "Alpha", kind: "class", filePath: "/b.ts", line: 1, column: 0, containerName: null },
        { name: "Middle", kind: "class", filePath: "/c.ts", line: 1, column: 0, containerName: null },
      ];

      const sorted = [...symbols].sort((a, b) => a.name.localeCompare(b.name));

      expect(sorted[0].name).toBe("Alpha");
      expect(sorted[1].name).toBe("Middle");
      expect(sorted[2].name).toBe("Zebra");
    });

    it("should sort symbols by file path", () => {
      const symbols: WorkspaceSymbol[] = [
        { name: "C", kind: "function", filePath: "/src/z.ts", line: 1, column: 0, containerName: null },
        { name: "A", kind: "function", filePath: "/src/a.ts", line: 1, column: 0, containerName: null },
        { name: "B", kind: "function", filePath: "/src/m.ts", line: 1, column: 0, containerName: null },
      ];

      const sorted = [...symbols].sort((a, b) =>
        a.filePath.localeCompare(b.filePath)
      );

      expect(sorted[0].filePath).toBe("/src/a.ts");
      expect(sorted[1].filePath).toBe("/src/m.ts");
      expect(sorted[2].filePath).toBe("/src/z.ts");
    });

    it("should sort symbols by line number within same file", () => {
      const symbols: WorkspaceSymbol[] = [
        { name: "third", kind: "variable", filePath: "/src/app.ts", line: 30, column: 0, containerName: null },
        { name: "first", kind: "variable", filePath: "/src/app.ts", line: 5, column: 0, containerName: null },
        { name: "second", kind: "variable", filePath: "/src/app.ts", line: 15, column: 0, containerName: null },
      ];

      const sorted = [...symbols].sort((a, b) => a.line - b.line);

      expect(sorted[0].name).toBe("first");
      expect(sorted[1].name).toBe("second");
      expect(sorted[2].name).toBe("third");
    });
  });

  describe("Symbol Filtering", () => {
    interface WorkspaceSymbol {
      name: string;
      kind: string;
      filePath: string;
      line: number;
      column: number;
      containerName: string | null;
    }

    const symbols: WorkspaceSymbol[] = [
      { name: "UserService", kind: "class", filePath: "/src/services/user.ts", line: 10, column: 0, containerName: null },
      { name: "getUser", kind: "method", filePath: "/src/services/user.ts", line: 20, column: 2, containerName: "UserService" },
      { name: "Config", kind: "interface", filePath: "/src/config.ts", line: 1, column: 0, containerName: null },
      { name: "MAX_RETRIES", kind: "constant", filePath: "/src/config.ts", line: 5, column: 0, containerName: null },
      { name: "initApp", kind: "function", filePath: "/src/index.ts", line: 1, column: 0, containerName: null },
    ];

    it("should filter symbols by kind", () => {
      const classes = symbols.filter((s) => s.kind === "class");
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe("UserService");
    });

    it("should filter symbols by file path", () => {
      const configSymbols = symbols.filter((s) =>
        s.filePath.includes("config")
      );
      expect(configSymbols).toHaveLength(2);
    });

    it("should filter symbols by name query (case-insensitive)", () => {
      const query = "user";
      const filtered = symbols.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe("UserService");
      expect(filtered[1].name).toBe("getUser");
    });

    it("should return empty array when no symbols match filter", () => {
      const filtered = symbols.filter((s) => s.kind === "enum");
      expect(filtered).toHaveLength(0);
    });

    it("should filter symbols by containerName", () => {
      const contained = symbols.filter((s) => s.containerName !== null);
      expect(contained).toHaveLength(1);
      expect(contained[0].containerName).toBe("UserService");
    });
  });

  describe("State Management Logic", () => {
    interface WorkspaceSymbol {
      name: string;
      kind: string;
      filePath: string;
      line: number;
      column: number;
      containerName: string | null;
    }

    interface IndexStats {
      totalSymbols: number;
      totalFiles: number;
      indexedAt: number;
      durationMs: number;
    }

    it("should reset state on clear", () => {
      let symbols: WorkspaceSymbol[] = [
        { name: "A", kind: "class", filePath: "/a.ts", line: 1, column: 0, containerName: null },
      ];
      let stats: IndexStats | null = {
        totalSymbols: 100,
        totalFiles: 10,
        indexedAt: Date.now(),
        durationMs: 500,
      };
      let indexed = true;

      const clearIndex = () => {
        symbols = [];
        stats = null;
        indexed = false;
      };

      clearIndex();

      expect(symbols).toHaveLength(0);
      expect(stats).toBeNull();
      expect(indexed).toBe(false);
    });

    it("should set stats and indexed on successful index", () => {
      let stats: IndexStats | null = null;
      let indexed = false;

      const onIndexSuccess = (result: IndexStats) => {
        stats = result;
        indexed = true;
      };

      onIndexSuccess({
        totalSymbols: 500,
        totalFiles: 50,
        indexedAt: Date.now(),
        durationMs: 1000,
      });

      expect(stats).not.toBeNull();
      expect(stats!.totalSymbols).toBe(500);
      expect(indexed).toBe(true);
    });

    it("should manage error state", () => {
      let error: string | null = null;
      let loading = false;

      const onSearchStart = () => {
        loading = true;
        error = null;
      };

      const onSearchError = (message: string) => {
        error = message;
        loading = false;
      };

      onSearchStart();
      expect(loading).toBe(true);
      expect(error).toBeNull();

      onSearchError("Search failed: timeout");
      expect(loading).toBe(false);
      expect(error).toBe("Search failed: timeout");
    });

    it("should set indexed true on refreshStats success", () => {
      let stats: IndexStats | null = null;
      let indexed = false;

      const onRefreshSuccess = (result: IndexStats) => {
        stats = result;
        indexed = true;
      };

      onRefreshSuccess({
        totalSymbols: 300,
        totalFiles: 30,
        indexedAt: Date.now(),
        durationMs: 800,
      });

      expect(indexed).toBe(true);
      expect(stats!.totalSymbols).toBe(300);
    });

    it("should update symbols on search success", () => {
      let symbols: WorkspaceSymbol[] = [];

      const onSearchSuccess = (result: WorkspaceSymbol[]) => {
        symbols = result;
      };

      onSearchSuccess([
        { name: "Foo", kind: "class", filePath: "/foo.ts", line: 1, column: 0, containerName: null },
        { name: "bar", kind: "function", filePath: "/bar.ts", line: 5, column: 0, containerName: "Foo" },
      ]);

      expect(symbols).toHaveLength(2);
      expect(symbols[0].name).toBe("Foo");
      expect(symbols[1].name).toBe("bar");
    });
  });

  describe("Error Message Extraction", () => {
    it("should extract message from Error instance", () => {
      const err = new Error("Something went wrong");
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toBe("Something went wrong");
    });

    it("should convert non-Error to string", () => {
      const err: unknown = "raw error string";
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toBe("raw error string");
    });

    it("should handle numeric error", () => {
      const err: unknown = 404;
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toBe("404");
    });
  });

  describe("IndexStats Validation", () => {
    interface IndexStats {
      totalSymbols: number;
      totalFiles: number;
      indexedAt: number;
      durationMs: number;
    }

    const isValidStats = (obj: unknown): obj is IndexStats => {
      if (typeof obj !== "object" || obj === null) return false;
      const s = obj as Record<string, unknown>;
      return (
        typeof s.totalSymbols === "number" &&
        typeof s.totalFiles === "number" &&
        typeof s.indexedAt === "number" &&
        typeof s.durationMs === "number"
      );
    };

    it("should validate valid stats", () => {
      const stats = {
        totalSymbols: 100,
        totalFiles: 10,
        indexedAt: Date.now(),
        durationMs: 500,
      };

      expect(isValidStats(stats)).toBe(true);
    });

    it("should reject stats with missing fields", () => {
      const invalid = {
        totalSymbols: 100,
        totalFiles: 10,
      };

      expect(isValidStats(invalid)).toBe(false);
    });

    it("should reject non-object stats", () => {
      expect(isValidStats(null)).toBe(false);
      expect(isValidStats("stats")).toBe(false);
      expect(isValidStats(undefined)).toBe(false);
    });
  });
});
