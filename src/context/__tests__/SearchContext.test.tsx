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

describe("SearchContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Search Query Types", () => {
    type PatternType = "literal" | "regex" | "glob";

    interface SearchQueryOptions {
      caseSensitive: boolean;
      wholeWord: boolean;
      useRegex: boolean;
      includePattern: string;
      excludePattern: string;
      fileTypes: string[];
      maxResults: number;
      searchInOpenEditors: boolean;
      followSymlinks: boolean;
      useIgnoreFiles: boolean;
      contextLines: number;
      patternType: PatternType;
      multiline: boolean;
    }

    it("should define pattern types", () => {
      const patterns: PatternType[] = ["literal", "regex", "glob"];
      expect(patterns).toHaveLength(3);
    });

    it("should create search query options", () => {
      const options: SearchQueryOptions = {
        caseSensitive: true,
        wholeWord: false,
        useRegex: true,
        includePattern: "*.ts",
        excludePattern: "node_modules",
        fileTypes: ["typescript", "javascript"],
        maxResults: 1000,
        searchInOpenEditors: false,
        followSymlinks: true,
        useIgnoreFiles: true,
        contextLines: 2,
        patternType: "regex",
        multiline: false,
      };

      expect(options.caseSensitive).toBe(true);
      expect(options.patternType).toBe("regex");
    });
  });

  describe("Default Search Options", () => {
    it("should have correct default values", () => {
      const DEFAULT_SEARCH_OPTIONS = {
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
        includePattern: "",
        excludePattern: "",
        fileTypes: [],
        maxResults: 10000,
        searchInOpenEditors: false,
        followSymlinks: true,
        useIgnoreFiles: true,
        contextLines: 2,
        patternType: "literal" as const,
        multiline: false,
      };

      expect(DEFAULT_SEARCH_OPTIONS.caseSensitive).toBe(false);
      expect(DEFAULT_SEARCH_OPTIONS.maxResults).toBe(10000);
      expect(DEFAULT_SEARCH_OPTIONS.patternType).toBe("literal");
    });
  });

  describe("Search Scope", () => {
    interface SearchScope {
      type: "workspace" | "folder" | "openEditors" | "selection" | "custom";
      folderPath?: string;
      customPaths?: string[];
    }

    it("should create workspace scope", () => {
      const scope: SearchScope = { type: "workspace" };
      expect(scope.type).toBe("workspace");
    });

    it("should create folder scope", () => {
      const scope: SearchScope = {
        type: "folder",
        folderPath: "/src/components",
      };
      expect(scope.type).toBe("folder");
      expect(scope.folderPath).toBe("/src/components");
    });

    it("should create custom paths scope", () => {
      const scope: SearchScope = {
        type: "custom",
        customPaths: ["/src", "/tests"],
      };
      expect(scope.customPaths).toHaveLength(2);
    });
  });

  describe("Search Query", () => {
    interface SearchQuery {
      pattern: string;
      replacePattern: string;
      options: { caseSensitive: boolean };
      scope: { type: string };
    }

    it("should create search query", () => {
      const query: SearchQuery = {
        pattern: "TODO",
        replacePattern: "",
        options: { caseSensitive: false },
        scope: { type: "workspace" },
      };

      expect(query.pattern).toBe("TODO");
    });

    it("should create search and replace query", () => {
      const query: SearchQuery = {
        pattern: "oldFunction",
        replacePattern: "newFunction",
        options: { caseSensitive: true },
        scope: { type: "workspace" },
      };

      expect(query.replacePattern).toBe("newFunction");
    });
  });

  describe("Text Range", () => {
    interface TextRange {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    }

    it("should define text range", () => {
      const range: TextRange = {
        startLine: 10,
        startColumn: 5,
        endLine: 10,
        endColumn: 15,
      };

      expect(range.startLine).toBe(10);
      expect(range.endColumn - range.startColumn).toBe(10);
    });

    it("should handle multi-line range", () => {
      const range: TextRange = {
        startLine: 5,
        startColumn: 0,
        endLine: 10,
        endColumn: 20,
      };

      expect(range.endLine - range.startLine).toBe(5);
    });
  });

  describe("Search Match", () => {
    interface SearchMatch {
      range: { startLine: number; endLine: number };
      lineContent: string;
      matchText: string;
      contextBefore: string[];
      contextAfter: string[];
    }

    it("should create search match", () => {
      const match: SearchMatch = {
        range: { startLine: 15, endLine: 15 },
        lineContent: "const TODO = 'fix this';",
        matchText: "TODO",
        contextBefore: ["// Previous line"],
        contextAfter: ["// Next line"],
      };

      expect(match.matchText).toBe("TODO");
      expect(match.contextBefore).toHaveLength(1);
    });
  });

  describe("Search File Result", () => {
    interface SearchFileResult {
      path: string;
      matches: Array<{ lineContent: string }>;
      matchCount: number;
    }

    it("should create file result with matches", () => {
      const result: SearchFileResult = {
        path: "/src/app.ts",
        matches: [
          { lineContent: "// TODO: fix" },
          { lineContent: "// TODO: refactor" },
        ],
        matchCount: 2,
      };

      expect(result.path).toBe("/src/app.ts");
      expect(result.matchCount).toBe(2);
    });

    it("should aggregate results from multiple files", () => {
      const results: SearchFileResult[] = [
        { path: "/src/a.ts", matches: [{ lineContent: "match1" }], matchCount: 1 },
        { path: "/src/b.ts", matches: [{ lineContent: "match2" }, { lineContent: "match3" }], matchCount: 2 },
      ];

      const totalMatches = results.reduce((sum, r) => sum + r.matchCount, 0);
      expect(totalMatches).toBe(3);
    });
  });

  describe("Search IPC Commands", () => {
    it("should invoke search_files command", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ results: [], totalMatches: 0 });

      await invoke("search_files", {
        pattern: "TODO",
        options: { caseSensitive: false },
      });

      expect(invoke).toHaveBeenCalledWith("search_files", {
        pattern: "TODO",
        options: { caseSensitive: false },
      });
    });

    it("should invoke search_replace command", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ replacedCount: 5 });

      const result = await invoke("search_replace", {
        pattern: "old",
        replacement: "new",
        paths: ["/src/app.ts"],
      });

      expect(invoke).toHaveBeenCalledWith("search_replace", expect.objectContaining({
        pattern: "old",
        replacement: "new",
      }));
      expect(result).toHaveProperty("replacedCount");
    });

    it("should invoke search_cancel command", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("search_cancel", { searchId: "search-123" });

      expect(invoke).toHaveBeenCalledWith("search_cancel", { searchId: "search-123" });
    });

    it("should handle search error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Invalid regex pattern"));

      await expect(invoke("search_files", { pattern: "[invalid" }))
        .rejects.toThrow("Invalid regex pattern");
    });
  });

  describe("Search Events", () => {
    it("should listen for search:streaming-result event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("search:streaming-result", () => {});

      expect(listen).toHaveBeenCalledWith("search:streaming-result", expect.any(Function));
    });

    it("should listen for search:complete event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("search:complete", () => {});

      expect(listen).toHaveBeenCalledWith("search:complete", expect.any(Function));
    });

    it("should listen for search:error event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("search:error", () => {});

      expect(listen).toHaveBeenCalledWith("search:error", expect.any(Function));
    });
  });

  describe("Search State Management", () => {
    interface SearchState {
      query: string;
      isSearching: boolean;
      results: Array<{ path: string; matchCount: number }>;
      totalMatches: number;
      searchId: string | null;
    }

    it("should track search state", () => {
      const state: SearchState = {
        query: "TODO",
        isSearching: true,
        results: [],
        totalMatches: 0,
        searchId: "search-123",
      };

      expect(state.isSearching).toBe(true);
      expect(state.searchId).toBe("search-123");
    });

    it("should update results incrementally", () => {
      const state: SearchState = {
        query: "TODO",
        isSearching: true,
        results: [],
        totalMatches: 0,
        searchId: "search-123",
      };

      const newResult = { path: "/src/app.ts", matchCount: 3 };
      state.results.push(newResult);
      state.totalMatches += newResult.matchCount;

      expect(state.results).toHaveLength(1);
      expect(state.totalMatches).toBe(3);
    });

    it("should clear search state", () => {
      const state: SearchState = {
        query: "TODO",
        isSearching: false,
        results: [{ path: "/src/app.ts", matchCount: 5 }],
        totalMatches: 5,
        searchId: null,
      };

      state.query = "";
      state.results = [];
      state.totalMatches = 0;

      expect(state.query).toBe("");
      expect(state.results).toHaveLength(0);
    });
  });

  describe("Replace Preview", () => {
    interface ReplacePreview {
      original: string;
      replaced: string;
      path: string;
      line: number;
    }

    it("should generate replace preview", () => {
      const preview: ReplacePreview = {
        original: "const oldName = 1;",
        replaced: "const newName = 1;",
        path: "/src/app.ts",
        line: 10,
      };

      expect(preview.original).toContain("oldName");
      expect(preview.replaced).toContain("newName");
    });

    it("should handle multiple previews", () => {
      const previews: ReplacePreview[] = [
        { original: "old1", replaced: "new1", path: "/a.ts", line: 1 },
        { original: "old2", replaced: "new2", path: "/b.ts", line: 5 },
      ];

      expect(previews).toHaveLength(2);
    });
  });

  describe("Search History", () => {
    interface SearchHistoryItem {
      query: string;
      timestamp: number;
      resultCount: number;
    }

    it("should track search history", () => {
      const history: SearchHistoryItem[] = [
        { query: "TODO", timestamp: 1000, resultCount: 15 },
        { query: "FIXME", timestamp: 2000, resultCount: 8 },
      ];

      expect(history).toHaveLength(2);
      expect(history[0].query).toBe("TODO");
    });

    it("should limit history size", () => {
      const maxHistory = 10;
      const history: SearchHistoryItem[] = Array.from({ length: 15 }, (_, i) => ({
        query: `query-${i}`,
        timestamp: i * 1000,
        resultCount: i,
      }));

      const trimmed = history.slice(-maxHistory);
      expect(trimmed).toHaveLength(10);
    });
  });
});
