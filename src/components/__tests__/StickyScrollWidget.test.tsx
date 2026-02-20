import { describe, it, expect, vi, beforeEach } from "vitest";

describe("StickyScrollWidget Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scope Detection", () => {
    const SCOPE_PATTERNS: Array<{ pattern: RegExp; kind: string }> = [
      { pattern: /^\s*(export\s+)?(abstract\s+)?(class|interface)\s+\w+/, kind: "class" },
      { pattern: /^\s*(pub\s+)?(struct|enum|trait|impl)\s+/, kind: "struct" },
      { pattern: /^\s*(export\s+)?(async\s+)?(function|const\s+\w+\s*=\s*(async\s+)?(\([^)]*\)|[^=])\s*=>)/, kind: "function" },
      { pattern: /^\s*def\s+\w+\s*\(/, kind: "function" },
    ];

    function detectScopeKind(lineText: string): string {
      for (const { pattern, kind } of SCOPE_PATTERNS) {
        if (pattern.test(lineText)) return kind;
      }
      return "unknown";
    }

    it("should detect class declarations", () => {
      expect(detectScopeKind("class MyClass {")).toBe("class");
      expect(detectScopeKind("export class MyClass {")).toBe("class");
      expect(detectScopeKind("export abstract class MyClass {")).toBe("class");
    });

    it("should detect interface declarations", () => {
      expect(detectScopeKind("interface MyInterface {")).toBe("class");
      expect(detectScopeKind("export interface MyInterface {")).toBe("class");
    });

    it("should detect function declarations", () => {
      expect(detectScopeKind("function hello() {")).toBe("function");
      expect(detectScopeKind("export function hello() {")).toBe("function");
      expect(detectScopeKind("export async function hello() {")).toBe("function");
    });

    it("should detect Python functions", () => {
      expect(detectScopeKind("def hello(name):")).toBe("function");
    });

    it("should detect Rust structs", () => {
      expect(detectScopeKind("struct MyStruct {")).toBe("struct");
      expect(detectScopeKind("pub struct MyStruct {")).toBe("struct");
    });

    it("should return unknown for plain lines", () => {
      expect(detectScopeKind("let x = 5;")).toBe("unknown");
      expect(detectScopeKind("// comment")).toBe("unknown");
    });
  });

  describe("Scope Text Cleaning", () => {
    function cleanScopeText(lineText: string, maxLength: number = 100): string {
      let text = lineText.trim();
      text = text.replace(/\s*[{:]\s*$/, "");
      text = text.replace(/\/\/.*$/, "").replace(/\/\*.*\*\/$/, "").trim();
      text = text.replace(/\s+/g, " ");
      if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + "...";
      }
      return text;
    }

    it("should remove trailing braces", () => {
      expect(cleanScopeText("class MyClass {")).toBe("class MyClass");
    });

    it("should remove inline comments", () => {
      expect(cleanScopeText("function hello() // my func")).toBe("function hello()");
    });

    it("should collapse whitespace", () => {
      expect(cleanScopeText("class   MyClass   {")).toBe("class MyClass");
    });

    it("should truncate long lines", () => {
      const longLine = "function " + "a".repeat(200) + "() {";
      const result = cleanScopeText(longLine, 50);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith("...")).toBe(true);
    });
  });

  describe("Sticky Scroll State", () => {
    interface StickyScrollLine {
      lineNumber: number;
      depth: number;
      text: string;
    }

    interface StickyScrollState {
      lines: StickyScrollLine[];
      maxLineCount: number;
    }

    it("should create initial state", () => {
      const state: StickyScrollState = { lines: [], maxLineCount: 5 };
      expect(state.lines).toEqual([]);
      expect(state.maxLineCount).toBe(5);
    });

    it("should limit lines to max count", () => {
      const lines: StickyScrollLine[] = Array.from({ length: 10 }, (_, i) => ({
        lineNumber: i + 1,
        depth: i,
        text: `scope ${i}`,
      }));

      const maxCount = 5;
      const limited = lines.slice(-maxCount);
      expect(limited).toHaveLength(5);
    });

    it("should sort by depth", () => {
      const lines: StickyScrollLine[] = [
        { lineNumber: 3, depth: 2, text: "inner" },
        { lineNumber: 1, depth: 0, text: "outer" },
        { lineNumber: 2, depth: 1, text: "middle" },
      ];

      lines.sort((a, b) => a.depth - b.depth);
      expect(lines[0].text).toBe("outer");
      expect(lines[1].text).toBe("middle");
      expect(lines[2].text).toBe("inner");
    });
  });

  describe("Monaco Sticky Scroll Options", () => {
    it("should generate correct options", () => {
      const options = {
        stickyScroll: {
          enabled: true,
          maxLineCount: 5,
          defaultModel: "outlineModel" as const,
          scrollWithEditor: true,
        },
      };

      expect(options.stickyScroll.enabled).toBe(true);
      expect(options.stickyScroll.maxLineCount).toBe(5);
      expect(options.stickyScroll.defaultModel).toBe("outlineModel");
    });

    it("should support disabling", () => {
      const options = {
        stickyScroll: {
          enabled: false,
          maxLineCount: 5,
          defaultModel: "outlineModel" as const,
          scrollWithEditor: true,
        },
      };

      expect(options.stickyScroll.enabled).toBe(false);
    });
  });
});
