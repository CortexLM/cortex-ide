import { describe, it, expect } from "vitest";

describe("ANSI Parser", () => {
  describe("AnsiStyle Interface", () => {
    interface AnsiStyle {
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
    }

    it("should create empty style", () => {
      const style: AnsiStyle = {};

      expect(style.color).toBeUndefined();
      expect(style.bold).toBeUndefined();
    });

    it("should create style with color", () => {
      const style: AnsiStyle = {
        color: "#ff0000",
      };

      expect(style.color).toBe("#ff0000");
    });

    it("should create style with all properties", () => {
      const style: AnsiStyle = {
        color: "#00ff00",
        backgroundColor: "#000000",
        bold: true,
        italic: true,
        underline: true,
      };

      expect(style.bold).toBe(true);
      expect(style.italic).toBe(true);
      expect(style.underline).toBe(true);
    });
  });

  describe("AnsiSegment Interface", () => {
    interface AnsiStyle {
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
    }

    interface AnsiSegment {
      text: string;
      style: AnsiStyle;
    }

    it("should create segment with text and style", () => {
      const segment: AnsiSegment = {
        text: "Hello, World!",
        style: { color: "#ff0000" },
      };

      expect(segment.text).toBe("Hello, World!");
      expect(segment.style.color).toBe("#ff0000");
    });

    it("should create segment with empty style", () => {
      const segment: AnsiSegment = {
        text: "Plain text",
        style: {},
      };

      expect(segment.text).toBe("Plain text");
      expect(Object.keys(segment.style)).toHaveLength(0);
    });
  });

  describe("ANSI Color Codes", () => {
    const ANSI_COLORS: Record<number, string> = {
      30: "#000000",
      31: "#cd0000",
      32: "#00cd00",
      33: "#cdcd00",
      34: "#0000ee",
      35: "#cd00cd",
      36: "#00cdcd",
      37: "#e5e5e5",
    };

    it("should map standard foreground colors", () => {
      expect(ANSI_COLORS[30]).toBe("#000000");
      expect(ANSI_COLORS[31]).toBe("#cd0000");
      expect(ANSI_COLORS[32]).toBe("#00cd00");
    });

    it("should have all 8 standard colors", () => {
      expect(Object.keys(ANSI_COLORS)).toHaveLength(8);
    });
  });

  describe("ANSI Bright Colors", () => {
    const ANSI_BRIGHT_COLORS: Record<number, string> = {
      90: "#7f7f7f",
      91: "#ff0000",
      92: "#00ff00",
      93: "#ffff00",
      94: "#5c5cff",
      95: "#ff00ff",
      96: "#00ffff",
      97: "#ffffff",
    };

    it("should map bright foreground colors", () => {
      expect(ANSI_BRIGHT_COLORS[90]).toBe("#7f7f7f");
      expect(ANSI_BRIGHT_COLORS[91]).toBe("#ff0000");
      expect(ANSI_BRIGHT_COLORS[97]).toBe("#ffffff");
    });
  });

  describe("ANSI Background Colors", () => {
    const ANSI_BG_COLORS: Record<number, string> = {
      40: "#000000",
      41: "#cd0000",
      42: "#00cd00",
      43: "#cdcd00",
      44: "#0000ee",
      45: "#cd00cd",
      46: "#00cdcd",
      47: "#e5e5e5",
    };

    it("should map standard background colors", () => {
      expect(ANSI_BG_COLORS[40]).toBe("#000000");
      expect(ANSI_BG_COLORS[41]).toBe("#cd0000");
    });
  });

  describe("ANSI Escape Sequence Regex", () => {
    const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

    it("should match simple escape sequence", () => {
      const text = "\x1b[31mRed text\x1b[0m";
      const matches = [...text.matchAll(ANSI_REGEX)];

      expect(matches).toHaveLength(2);
      expect(matches[0][1]).toBe("31");
      expect(matches[1][1]).toBe("0");
    });

    it("should match compound escape sequence", () => {
      const text = "\x1b[1;31;40mBold red on black\x1b[0m";
      ANSI_REGEX.lastIndex = 0;
      const matches = [...text.matchAll(ANSI_REGEX)];

      expect(matches).toHaveLength(2);
      expect(matches[0][1]).toBe("1;31;40");
    });

    it("should not match plain text", () => {
      const text = "Plain text without ANSI codes";
      ANSI_REGEX.lastIndex = 0;
      const matches = [...text.matchAll(ANSI_REGEX)];

      expect(matches).toHaveLength(0);
    });
  });

  describe("SGR Code Processing", () => {
    interface AnsiStyle {
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
    }

    const processCode = (code: number, style: AnsiStyle): AnsiStyle => {
      const newStyle = { ...style };

      if (code === 0) return {};
      if (code === 1) newStyle.bold = true;
      if (code === 3) newStyle.italic = true;
      if (code === 4) newStyle.underline = true;
      if (code === 21 || code === 22) newStyle.bold = false;
      if (code === 23) newStyle.italic = false;
      if (code === 24) newStyle.underline = false;

      return newStyle;
    };

    it("should handle reset code (0)", () => {
      const style: AnsiStyle = { bold: true, color: "#ff0000" };
      const result = processCode(0, style);

      expect(result).toEqual({});
    });

    it("should handle bold code (1)", () => {
      const result = processCode(1, {});

      expect(result.bold).toBe(true);
    });

    it("should handle italic code (3)", () => {
      const result = processCode(3, {});

      expect(result.italic).toBe(true);
    });

    it("should handle underline code (4)", () => {
      const result = processCode(4, {});

      expect(result.underline).toBe(true);
    });

    it("should handle bold off code (22)", () => {
      const result = processCode(22, { bold: true });

      expect(result.bold).toBe(false);
    });
  });

  describe("Text Parsing", () => {
    interface AnsiSegment {
      text: string;
      style: { color?: string; bold?: boolean };
    }

    const parseSimple = (text: string): AnsiSegment[] => {
      const segments: AnsiSegment[] = [];
      const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;
      let lastIndex = 0;
      let currentStyle: { color?: string; bold?: boolean } = {};

      ANSI_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = ANSI_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          segments.push({
            text: text.slice(lastIndex, match.index),
            style: { ...currentStyle },
          });
        }

        const code = parseInt(match[1] || "0", 10);
        if (code === 0) currentStyle = {};
        else if (code === 1) currentStyle.bold = true;
        else if (code === 31) currentStyle.color = "#cd0000";
        else if (code === 32) currentStyle.color = "#00cd00";

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        segments.push({
          text: text.slice(lastIndex),
          style: { ...currentStyle },
        });
      }

      return segments;
    };

    it("should parse plain text", () => {
      const segments = parseSimple("Hello, World!");

      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe("Hello, World!");
      expect(segments[0].style).toEqual({});
    });

    it("should parse colored text", () => {
      const segments = parseSimple("\x1b[31mRed\x1b[0m");

      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe("Red");
      expect(segments[0].style.color).toBe("#cd0000");
    });

    it("should parse multiple segments", () => {
      const segments = parseSimple("\x1b[31mRed\x1b[32mGreen\x1b[0m");

      expect(segments).toHaveLength(2);
      expect(segments[0].text).toBe("Red");
      expect(segments[0].style.color).toBe("#cd0000");
      expect(segments[1].text).toBe("Green");
      expect(segments[1].style.color).toBe("#00cd00");
    });

    it("should handle text after reset", () => {
      const segments = parseSimple("\x1b[31mRed\x1b[0mPlain");

      expect(segments).toHaveLength(2);
      expect(segments[1].text).toBe("Plain");
      expect(segments[1].style).toEqual({});
    });
  });

  describe("256 Color Mode", () => {
    const get256Color = (index: number): string => {
      if (index < 16) {
        const standardColors = [
          "#000000", "#800000", "#008000", "#808000",
          "#000080", "#800080", "#008080", "#c0c0c0",
          "#808080", "#ff0000", "#00ff00", "#ffff00",
          "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
        ];
        return standardColors[index];
      }

      if (index < 232) {
        const i = index - 16;
        const r = Math.floor(i / 36);
        const g = Math.floor((i % 36) / 6);
        const b = i % 6;
        const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }

      const gray = (index - 232) * 10 + 8;
      const hex = gray.toString(16).padStart(2, "0");
      return `#${hex}${hex}${hex}`;
    };

    it("should return standard colors for 0-15", () => {
      expect(get256Color(0)).toBe("#000000");
      expect(get256Color(1)).toBe("#800000");
      expect(get256Color(15)).toBe("#ffffff");
    });

    it("should return 216 color cube colors for 16-231", () => {
      const color = get256Color(16);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should return grayscale colors for 232-255", () => {
      const color = get256Color(232);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe("Strip ANSI Codes", () => {
    const stripAnsi = (text: string): string => {
      return text.replace(/\x1b\[[0-9;]*m/g, "");
    };

    it("should strip single escape sequence", () => {
      const result = stripAnsi("\x1b[31mRed text\x1b[0m");

      expect(result).toBe("Red text");
    });

    it("should strip multiple escape sequences", () => {
      const result = stripAnsi("\x1b[1;31mBold red\x1b[0m \x1b[32mgreen\x1b[0m");

      expect(result).toBe("Bold red green");
    });

    it("should return plain text unchanged", () => {
      const result = stripAnsi("Plain text");

      expect(result).toBe("Plain text");
    });

    it("should handle empty string", () => {
      const result = stripAnsi("");

      expect(result).toBe("");
    });
  });

  describe("Style to CSS", () => {
    interface AnsiStyle {
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
    }

    const styleToCss = (style: AnsiStyle): string => {
      const parts: string[] = [];

      if (style.color) parts.push(`color: ${style.color}`);
      if (style.backgroundColor) parts.push(`background-color: ${style.backgroundColor}`);
      if (style.bold) parts.push("font-weight: bold");
      if (style.italic) parts.push("font-style: italic");
      if (style.underline) parts.push("text-decoration: underline");

      return parts.join("; ");
    };

    it("should convert color to CSS", () => {
      const css = styleToCss({ color: "#ff0000" });

      expect(css).toBe("color: #ff0000");
    });

    it("should convert multiple properties", () => {
      const css = styleToCss({ color: "#ff0000", bold: true });

      expect(css).toContain("color: #ff0000");
      expect(css).toContain("font-weight: bold");
    });

    it("should return empty string for empty style", () => {
      const css = styleToCss({});

      expect(css).toBe("");
    });
  });
});
