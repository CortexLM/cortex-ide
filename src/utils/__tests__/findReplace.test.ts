import { describe, it, expect } from "vitest";
import {
  escapeRegexSpecialChars,
  buildWholeWordPattern,
  validateRegex,
  buildSearchRegex,
  preserveCaseReplace,
  parseReplacePattern,
  buildReplacementString,
  findAllMatches,
  findMatchesInDocument,
  replaceMatch,
  replaceAllMatches,
  addToSearchHistory,
  createDefaultFindState,
  createDefaultSearchHistory,
  countMatches,
  compareMatchPositions,
  sortMatchesByPosition,
} from "../findReplace";

describe("findReplace", () => {
  describe("escapeRegexSpecialChars", () => {
    it("escapes special regex characters", () => {
      expect(escapeRegexSpecialChars("hello.world")).toBe("hello\\.world");
      expect(escapeRegexSpecialChars("a+b*c")).toBe("a\\+b\\*c");
      expect(escapeRegexSpecialChars("[test]")).toBe("\\[test\\]");
    });
    it("leaves normal characters unchanged", () => {
      expect(escapeRegexSpecialChars("hello")).toBe("hello");
    });
  });

  describe("buildWholeWordPattern", () => {
    it("wraps in word boundaries", () => {
      expect(buildWholeWordPattern("test")).toBe("\\btest\\b");
    });
  });

  describe("validateRegex", () => {
    it("returns valid for valid regex", () => {
      expect(validateRegex("hello")).toEqual({ valid: true });
      expect(validateRegex("[a-z]+")).toEqual({ valid: true });
    });
    it("returns error for invalid regex", () => {
      const result = validateRegex("[invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("buildSearchRegex", () => {
    it("returns null for empty string", () => {
      expect(buildSearchRegex("", {})).toBeNull();
    });
    it("escapes pattern for literal search", () => {
      const regex = buildSearchRegex("hello.world", {});
      expect(regex).not.toBeNull();
      expect(regex!.test("hello.world")).toBe(true);
      expect(regex!.test("helloXworld")).toBe(false);
    });
    it("uses raw pattern for regex search", () => {
      const regex = buildSearchRegex("hello.*world", { isRegex: true });
      expect(regex).not.toBeNull();
      expect(regex!.test("helloXYZworld")).toBe(true);
    });
    it("adds case insensitive flag", () => {
      const regex = buildSearchRegex("hello", { isCaseSensitive: false });
      expect(regex!.test("HELLO")).toBe(true);
    });
    it("case sensitive when set", () => {
      const regex = buildSearchRegex("hello", { isCaseSensitive: true });
      expect(regex!.test("HELLO")).toBe(false);
    });
    it("adds word boundaries for whole word", () => {
      const regex = buildSearchRegex("test", { isWholeWord: true });
      expect(regex!.test("test")).toBe(true);
      expect(regex!.test("testing")).toBe(false);
    });
    it("returns null for invalid regex", () => {
      expect(buildSearchRegex("[invalid", { isRegex: true })).toBeNull();
    });
  });

  describe("preserveCaseReplace", () => {
    it("preserves uppercase", () => {
      expect(preserveCaseReplace("FOO", "bar")).toBe("BAR");
    });
    it("preserves lowercase", () => {
      expect(preserveCaseReplace("foo", "BAR")).toBe("bar");
    });
    it("preserves title case", () => {
      expect(preserveCaseReplace("Foo", "bar")).toBe("Bar");
    });
    it("handles empty inputs", () => {
      expect(preserveCaseReplace("", "bar")).toBe("bar");
      expect(preserveCaseReplace("foo", "")).toBe("");
    });
  });

  describe("parseReplacePattern", () => {
    it("parses plain text", () => {
      const result = parseReplacePattern("hello");
      expect(result).toEqual([{ type: "text", value: "hello" }]);
    });
    it("parses group references", () => {
      const result = parseReplacePattern("$1 and $2");
      expect(result).toEqual([
        { type: "group", value: 1 },
        { type: "text", value: " and " },
        { type: "group", value: 2 },
      ]);
    });
    it("parses $$ as literal $", () => {
      const result = parseReplacePattern("$$");
      expect(result).toEqual([{ type: "text", value: "$" }]);
    });
    it("parses $& as entire match", () => {
      const result = parseReplacePattern("$&");
      expect(result).toEqual([{ type: "group", value: 0 }]);
    });
  });

  describe("buildReplacementString", () => {
    it("builds simple replacement", () => {
      const match = { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 3 }, matches: ["foo"] };
      expect(buildReplacementString("bar", match, {})).toBe("bar");
    });
    it("substitutes capture groups", () => {
      const match = { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 5 }, matches: ["hello", "hel", "lo"] };
      expect(buildReplacementString("$2-$1", match, {})).toBe("lo-hel");
    });
    it("preserves case", () => {
      const match = { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 3 }, matches: ["FOO"] };
      expect(buildReplacementString("bar", match, { preserveCase: true })).toBe("BAR");
    });
  });

  describe("findAllMatches", () => {
    it("finds all matches in text", () => {
      const matches = findAllMatches("hello world hello", "hello", {});
      expect(matches).toHaveLength(2);
    });
    it("returns empty for no matches", () => {
      expect(findAllMatches("hello", "xyz", {})).toEqual([]);
    });
    it("returns empty for empty search", () => {
      expect(findAllMatches("hello", "", {})).toEqual([]);
    });
  });

  describe("findMatchesInDocument", () => {
    it("finds matches across lines", () => {
      const lines = ["hello world", "hello again"];
      const matches = findMatchesInDocument(lines, "hello", {});
      expect(matches).toHaveLength(2);
      expect(matches[0].range.startLine).toBe(0);
      expect(matches[1].range.startLine).toBe(1);
    });
  });

  describe("replaceMatch", () => {
    it("replaces single match", () => {
      const text = "hello world";
      const match = { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 5 }, matches: ["hello"] };
      const result = replaceMatch(text, match, "hi", {});
      expect(result.newText).toBe("hi world");
    });
  });

  describe("replaceAllMatches", () => {
    it("replaces all matches", () => {
      const text = "hello world hello";
      const result = replaceAllMatches(text, "hello", "hi", {});
      expect(result.newText).toBe("hi world hi");
      expect(result.replacements).toBe(2);
    });
  });

  describe("createDefaultFindState", () => {
    it("returns default state", () => {
      const state = createDefaultFindState();
      expect(state.searchString).toBe("");
      expect(state.isRegex).toBe(false);
      expect(state.isCaseSensitive).toBe(false);
    });
  });

  describe("createDefaultSearchHistory", () => {
    it("returns empty history", () => {
      const history = createDefaultSearchHistory();
      expect(history.searches).toEqual([]);
      expect(history.replaces).toEqual([]);
    });
    it("respects maxItems", () => {
      const history = createDefaultSearchHistory(10);
      expect(history.maxItems).toBe(10);
    });
  });

  describe("addToSearchHistory", () => {
    it("adds to search history", () => {
      const history = createDefaultSearchHistory();
      const updated = addToSearchHistory(history, "search", "test");
      expect(updated.searches).toContain("test");
    });
    it("adds to replace history", () => {
      const history = createDefaultSearchHistory();
      const updated = addToSearchHistory(history, "replace", "replacement");
      expect(updated.replaces).toContain("replacement");
    });
    it("avoids duplicates", () => {
      const history = createDefaultSearchHistory();
      const h1 = addToSearchHistory(history, "search", "test");
      const h2 = addToSearchHistory(h1, "search", "test");
      expect(h2.searches.filter((s) => s === "test")).toHaveLength(1);
    });
  });

  describe("countMatches", () => {
    it("counts matches in text", () => {
      expect(countMatches("hello world hello", "hello", {})).toBe(2);
    });
    it("returns 0 for no matches", () => {
      expect(countMatches("hello", "xyz", {})).toBe(0);
    });
  });

  describe("compareMatchPositions", () => {
    it("compares by line first", () => {
      const a = { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 }, matches: [] };
      const b = { range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 }, matches: [] };
      expect(compareMatchPositions(a, b)).toBeLessThan(0);
    });
    it("compares by column when same line", () => {
      const a = { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 }, matches: [] };
      const b = { range: { startLine: 0, startColumn: 5, endLine: 0, endColumn: 6 }, matches: [] };
      expect(compareMatchPositions(a, b)).toBeLessThan(0);
    });
  });

  describe("sortMatchesByPosition", () => {
    it("sorts matches by position", () => {
      const matches = [
        { range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 }, matches: [] },
        { range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 1 }, matches: [] },
      ];
      const sorted = sortMatchesByPosition(matches);
      expect(sorted[0].range.startLine).toBe(0);
      expect(sorted[1].range.startLine).toBe(1);
    });
  });
});
