import { describe, it, expect, vi } from "vitest";
import {
  buildResultsTree,
  buildSimpleTree,
  flattenTree,
  serializeToCodeSearch,
  parseCodeSearchFile,
  isCodeSearchFile,
  generateCodeSearchFilename,
} from "../searchUtils";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

describe("searchUtils", () => {
  const results = [
    {
      file: "src/utils/format.ts",
      matches: [
        { line: 1, column: 0, text: "export function formatDate", matchStart: 16, matchEnd: 26 },
      ],
    },
    {
      file: "src/utils/json.ts",
      matches: [
        { line: 5, column: 0, text: "export function safeJsonParse", matchStart: 16, matchEnd: 29 },
      ],
    },
  ];

  describe("buildResultsTree", () => {
    it("builds tree from results", () => {
      const tree = buildResultsTree(results);
      expect(tree.length).toBeGreaterThan(0);
    });
    it("handles empty results", () => {
      expect(buildResultsTree([])).toEqual([]);
    });
  });

  describe("buildSimpleTree", () => {
    it("builds folder-grouped tree", () => {
      const tree = buildSimpleTree(results);
      expect(tree.length).toBeGreaterThan(0);
      expect(tree[0].type).toBe("folder");
      expect(tree[0].children!.length).toBeGreaterThan(0);
    });
    it("handles empty results", () => {
      expect(buildSimpleTree([])).toEqual([]);
    });
  });

  describe("flattenTree", () => {
    it("flattens tree nodes with expanded paths", () => {
      const tree = buildSimpleTree(results);
      const expandedPaths = new Set(tree.map((n) => n.path));
      const flat = flattenTree(tree, expandedPaths);
      expect(flat.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("serializeToCodeSearch", () => {
    it("serializes search state", () => {
      const serialized = serializeToCodeSearch({
        query: "test",
        isRegex: false,
        isCaseSensitive: false,
        isWholeWord: false,
        includePattern: "",
        excludePattern: "",
        contextLines: 2,
        results,
      });
      expect(serialized).toContain("test");
      expect(typeof serialized).toBe("string");
    });
  });

  describe("parseCodeSearchFile", () => {
    it("parses serialized code search", () => {
      const serialized = serializeToCodeSearch({
        query: "test",
        isRegex: false,
        isCaseSensitive: true,
        isWholeWord: false,
        includePattern: "*.ts",
        excludePattern: "node_modules",
        contextLines: 2,
        results,
      });
      const parsed = parseCodeSearchFile(serialized);
      expect(parsed.query).toBe("test");
      expect(parsed.isCaseSensitive).toBe(true);
      expect(parsed.results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isCodeSearchFile", () => {
    it("returns true for .code-search files", () => {
      expect(isCodeSearchFile("search.code-search")).toBe(true);
    });
    it("returns false for other files", () => {
      expect(isCodeSearchFile("search.ts")).toBe(false);
    });
  });

  describe("generateCodeSearchFilename", () => {
    it("generates filename from query", () => {
      const filename = generateCodeSearchFilename("my search");
      expect(filename).toContain("code-search");
    });
  });
});
