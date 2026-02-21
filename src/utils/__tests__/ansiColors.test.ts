import { describe, it, expect } from "vitest";
import {
  DEFAULT_ANSI_COLORS,
  index256ToHex,
  rgbToHex,
  getThemeColor,
  parseSGR,
  parseOSC8,
  parseAnsiText,
  styleToCss,
  styleToInlineCss,
  stripAnsiCodes,
  containsAnsiCodes,
  getVisibleLength,
  truncateAnsiText,
  ansiToHtml,
  formatDebugOutput,
  highlightSearchTerm,
} from "../ansiColors";

describe("ansiColors", () => {
  describe("DEFAULT_ANSI_COLORS", () => {
    it("has all standard colors", () => {
      expect(DEFAULT_ANSI_COLORS.black).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.red).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.green).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.yellow).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.blue).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.magenta).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.cyan).toBeDefined();
      expect(DEFAULT_ANSI_COLORS.white).toBeDefined();
    });
  });

  describe("index256ToHex", () => {
    it("returns standard colors for 0-7", () => {
      const result = index256ToHex(0);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
    it("returns bright colors for 8-15", () => {
      const result = index256ToHex(8);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
    it("returns 6x6x6 cube colors for 16-231", () => {
      const result = index256ToHex(16);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
    it("returns grayscale for 232-255", () => {
      const result = index256ToHex(232);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe("rgbToHex", () => {
    it("converts RGB to hex", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
      expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
      expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
    });
  });

  describe("getThemeColor", () => {
    it("returns color for standard index", () => {
      expect(getThemeColor(0)).toBe(DEFAULT_ANSI_COLORS.black);
      expect(getThemeColor(1)).toBe(DEFAULT_ANSI_COLORS.red);
    });
    it("returns color for bright index", () => {
      expect(getThemeColor(8)).toBe(DEFAULT_ANSI_COLORS.brightBlack);
    });
  });

  describe("parseSGR", () => {
    it("resets style with code 0", () => {
      const style = { bold: true, foreground: "#ff0000" };
      const result = parseSGR([0], style);
      expect(result.bold).toBeUndefined();
      expect(result.foreground).toBeUndefined();
    });
    it("sets bold with code 1", () => {
      const result = parseSGR([1], {});
      expect(result.bold).toBe(true);
    });
    it("sets italic with code 3", () => {
      const result = parseSGR([3], {});
      expect(result.italic).toBe(true);
    });
    it("sets underline with code 4", () => {
      const result = parseSGR([4], {});
      expect(result.underline).toBe(true);
    });
    it("sets foreground color with codes 30-37", () => {
      const result = parseSGR([31], {});
      expect(result.foreground).toBeDefined();
    });
    it("sets background color with codes 40-47", () => {
      const result = parseSGR([41], {});
      expect(result.background).toBeDefined();
    });
  });

  describe("parseOSC8", () => {
    it("parses hyperlink", () => {
      const result = parseOSC8("8;;https://example.com");
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://example.com");
    });
    it("parses hyperlink with params", () => {
      const result = parseOSC8("8;id=123;https://example.com");
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://example.com");
    });
    it("returns null for invalid input", () => {
      expect(parseOSC8("")).toBeNull();
      expect(parseOSC8(";;https://example.com")).toBeNull();
    });
  });

  describe("parseAnsiText", () => {
    it("parses plain text", () => {
      const segments = parseAnsiText("hello world");
      expect(segments.length).toBeGreaterThanOrEqual(1);
      expect(segments.some((s) => s.text === "hello world")).toBe(true);
    });
    it("parses text with ANSI codes", () => {
      const segments = parseAnsiText("\x1b[31mred\x1b[0m normal");
      expect(segments.length).toBeGreaterThanOrEqual(1);
      const redSegment = segments.find((s) => s.text === "red");
      expect(redSegment).toBeDefined();
      expect(redSegment!.style.foreground).toBeDefined();
    });
    it("handles bold text", () => {
      const segments = parseAnsiText("\x1b[1mbold\x1b[0m");
      const boldSegment = segments.find((s) => s.text === "bold");
      expect(boldSegment).toBeDefined();
      expect(boldSegment!.style.bold).toBe(true);
    });
    it("handles empty text", () => {
      const segments = parseAnsiText("");
      expect(segments).toHaveLength(0);
    });
  });

  describe("styleToCss", () => {
    it("returns empty object for empty style", () => {
      expect(styleToCss({})).toEqual({});
    });
    it("includes color for foreground", () => {
      const css = styleToCss({ foreground: "#ff0000" });
      expect(css.color).toBe("#ff0000");
    });
    it("includes backgroundColor", () => {
      const css = styleToCss({ background: "#00ff00" });
      expect(css["backgroundColor"]).toBe("#00ff00");
    });
    it("includes fontWeight for bold", () => {
      const css = styleToCss({ bold: true });
      expect(css["fontWeight"]).toBe("bold");
    });
    it("includes fontStyle for italic", () => {
      const css = styleToCss({ italic: true });
      expect(css["fontStyle"]).toBe("italic");
    });
  });

  describe("styleToInlineCss", () => {
    it("returns empty string for empty style", () => {
      expect(styleToInlineCss({})).toBe("");
    });
    it("returns inline CSS string", () => {
      const result = styleToInlineCss({ bold: true });
      expect(result).toContain("font-weight");
    });
  });

  describe("stripAnsiCodes", () => {
    it("strips ANSI escape codes", () => {
      expect(stripAnsiCodes("\x1b[31mhello\x1b[0m")).toBe("hello");
    });
    it("returns plain text unchanged", () => {
      expect(stripAnsiCodes("hello")).toBe("hello");
    });
    it("handles multiple codes", () => {
      expect(stripAnsiCodes("\x1b[1m\x1b[31mbold red\x1b[0m")).toBe("bold red");
    });
  });

  describe("containsAnsiCodes", () => {
    it("returns true for ANSI text", () => {
      expect(containsAnsiCodes("\x1b[31mred\x1b[0m")).toBe(true);
    });
    it("returns false for plain text", () => {
      expect(containsAnsiCodes("hello")).toBe(false);
    });
  });

  describe("getVisibleLength", () => {
    it("returns length excluding ANSI codes", () => {
      expect(getVisibleLength("\x1b[31mhello\x1b[0m")).toBe(5);
    });
    it("returns normal length for plain text", () => {
      expect(getVisibleLength("hello")).toBe(5);
    });
  });

  describe("truncateAnsiText", () => {
    it("truncates plain text", () => {
      expect(truncateAnsiText("hello world", 8)).toBe("hello...");
    });
    it("returns short text unchanged", () => {
      expect(truncateAnsiText("hi", 10)).toBe("hi");
    });
  });

  describe("ansiToHtml", () => {
    it("converts plain text", () => {
      const html = ansiToHtml("hello");
      expect(html).toContain("hello");
    });
    it("converts colored text to span with style", () => {
      const html = ansiToHtml("\x1b[31mred\x1b[0m");
      expect(html).toContain("red");
      expect(html).toContain("color");
    });
  });

  describe("formatDebugOutput", () => {
    it("formats debug output as segments", () => {
      const result = formatDebugOutput("test output", "stdout");
      expect(Array.isArray(result)).toBe(true);
      expect(result.some((s: any) => s.text === "test output")).toBe(true);
    });
  });

  describe("highlightSearchTerm", () => {
    it("highlights search term in text", () => {
      const result = highlightSearchTerm("hello world", "world");
      expect(Array.isArray(result)).toBe(true);
      const highlighted = result.find((s: any) => s.text === "world");
      expect(highlighted).toBeDefined();
    });
    it("returns segments when no match", () => {
      const result = highlightSearchTerm("hello", "xyz");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
