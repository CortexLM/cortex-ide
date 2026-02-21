import { describe, it, expect } from "vitest";
import {
  sortLinesAscending,
  sortLinesDescending,
  sortLinesCaseInsensitive,
  sortLinesByLength,
  sortLinesNatural,
  deleteDuplicateLines,
  deleteDuplicateLinesCaseInsensitive,
  joinLines,
  joinLinesSmartly,
  duplicateLinesDown,
  duplicateLinesUp,
  moveLinesUp,
  moveLinesDown,
  transformToUppercase,
  transformToLowercase,
  transformToTitleCase,
  transformToSnakeCase,
  transformToCamelCase,
  transformToPascalCase,
  transformToKebabCase,
  transformToConstantCase,
  transposeCharacters,
  transposeWords,
  transposeLines,
  indentLines,
  outdentLines,
  trimTrailingWhitespace,
  addLineComment,
  removeLineComment,
  toggleLineComment,
  reverseLines,
  shuffleLines,
  getUniqueLines,
} from "../lineOperations";

const lines = ["banana", "apple", "cherry", "date"];
const range = { startLine: 0, endLine: 3 };

describe("lineOperations", () => {
  describe("sortLinesAscending", () => {
    it("sorts lines alphabetically", () => {
      const result = sortLinesAscending(lines, range);
      expect(result.lines).toEqual(["apple", "banana", "cherry", "date"]);
    });
    it("sorts partial range", () => {
      const result = sortLinesAscending(lines, { startLine: 1, endLine: 2 });
      expect(result.lines).toEqual(["banana", "apple", "cherry", "date"]);
    });
  });

  describe("sortLinesDescending", () => {
    it("sorts lines reverse alphabetically", () => {
      const result = sortLinesDescending(lines, range);
      expect(result.lines).toEqual(["date", "cherry", "banana", "apple"]);
    });
  });

  describe("sortLinesCaseInsensitive", () => {
    it("sorts case insensitively", () => {
      const mixed = ["Banana", "apple", "Cherry"];
      const result = sortLinesCaseInsensitive(mixed, { startLine: 0, endLine: 2 });
      expect(result.lines).toEqual(["apple", "Banana", "Cherry"]);
    });
    it("sorts descending when flag set", () => {
      const mixed = ["apple", "Banana", "cherry"];
      const result = sortLinesCaseInsensitive(mixed, { startLine: 0, endLine: 2 }, true);
      expect(result.lines).toEqual(["cherry", "Banana", "apple"]);
    });
  });

  describe("sortLinesByLength", () => {
    it("sorts by length ascending", () => {
      const result = sortLinesByLength(lines, range);
      expect(result.lines[0]).toBe("date");
      expect(result.lines[3]).toBe("cherry");
    });
    it("sorts by length descending", () => {
      const result = sortLinesByLength(lines, range, true);
      expect(result.lines[0]).toBe("cherry");
    });
  });

  describe("sortLinesNatural", () => {
    it("handles numbers naturally", () => {
      const numbered = ["item10", "item2", "item1"];
      const result = sortLinesNatural(numbered, { startLine: 0, endLine: 2 });
      expect(result.lines).toEqual(["item1", "item2", "item10"]);
    });
  });

  describe("deleteDuplicateLines", () => {
    it("removes exact duplicates", () => {
      const dupes = ["a", "b", "a", "c"];
      const result = deleteDuplicateLines(dupes, { startLine: 0, endLine: 3 });
      expect(result.lines).toEqual(["a", "b", "c"]);
    });
  });

  describe("deleteDuplicateLinesCaseInsensitive", () => {
    it("removes case-insensitive duplicates", () => {
      const dupes = ["Hello", "hello", "World"];
      const result = deleteDuplicateLinesCaseInsensitive(dupes, { startLine: 0, endLine: 2 });
      expect(result.lines).toEqual(["Hello", "World"]);
    });
  });

  describe("joinLines", () => {
    it("joins with default separator", () => {
      const result = joinLines(["a", "b", "c"], { startLine: 0, endLine: 2 });
      expect(result.lines).toEqual(["a b c"]);
    });
    it("joins with custom separator", () => {
      const result = joinLines(["a", "b", "c"], { startLine: 0, endLine: 2 }, ", ");
      expect(result.lines).toEqual(["a, b, c"]);
    });
  });

  describe("joinLinesSmartly", () => {
    it("trims subsequent lines but keeps first line indent", () => {
      const indented = ["  first", "  second", "  third"];
      const result = joinLinesSmartly(indented, { startLine: 0, endLine: 2 });
      expect(result.lines[0]).toBe("  first second third");
    });
  });

  describe("duplicateLinesDown", () => {
    it("duplicates lines below", () => {
      const result = duplicateLinesDown(["a", "b", "c"], { startLine: 0, endLine: 1 });
      expect(result.lines).toEqual(["a", "b", "a", "b", "c"]);
      expect(result.cursorLine).toBe(2);
    });
  });

  describe("duplicateLinesUp", () => {
    it("duplicates lines above", () => {
      const result = duplicateLinesUp(["a", "b", "c"], { startLine: 1, endLine: 2 });
      expect(result.lines).toEqual(["a", "b", "c", "b", "c"]);
    });
  });

  describe("moveLinesUp", () => {
    it("moves lines up", () => {
      const result = moveLinesUp(["a", "b", "c"], { startLine: 1, endLine: 1 });
      expect(result.lines).toEqual(["b", "a", "c"]);
    });
    it("does nothing at top", () => {
      const result = moveLinesUp(["a", "b"], { startLine: 0, endLine: 0 });
      expect(result.lines).toEqual(["a", "b"]);
    });
  });

  describe("moveLinesDown", () => {
    it("moves lines down", () => {
      const result = moveLinesDown(["a", "b", "c"], { startLine: 0, endLine: 0 });
      expect(result.lines).toEqual(["b", "a", "c"]);
    });
    it("does nothing at bottom", () => {
      const result = moveLinesDown(["a", "b"], { startLine: 1, endLine: 1 });
      expect(result.lines).toEqual(["a", "b"]);
    });
  });

  describe("case transforms", () => {
    it("transforms to uppercase", () => {
      expect(transformToUppercase("hello")).toBe("HELLO");
    });
    it("transforms to lowercase", () => {
      expect(transformToLowercase("HELLO")).toBe("hello");
    });
    it("transforms to title case", () => {
      expect(transformToTitleCase("hello world")).toBe("Hello World");
    });
    it("transforms to snake_case", () => {
      expect(transformToSnakeCase("helloWorld")).toBe("hello_world");
      expect(transformToSnakeCase("Hello World")).toBe("hello_world");
    });
    it("transforms to camelCase", () => {
      expect(transformToCamelCase("hello_world")).toBe("helloWorld");
      expect(transformToCamelCase("Hello World")).toBe("helloWorld");
    });
    it("transforms to PascalCase", () => {
      expect(transformToPascalCase("hello_world")).toBe("HelloWorld");
    });
    it("transforms to kebab-case", () => {
      expect(transformToKebabCase("helloWorld")).toBe("hello-world");
    });
    it("transforms to CONSTANT_CASE", () => {
      expect(transformToConstantCase("helloWorld")).toBe("HELLO_WORLD");
    });
  });

  describe("transposeCharacters", () => {
    it("swaps characters at cursor", () => {
      const result = transposeCharacters("abc", 1);
      expect(result.line).toBe("bac");
    });
    it("handles end of line", () => {
      const result = transposeCharacters("abc", 3);
      expect(result.line).toBe("acb");
    });
    it("handles too-short string", () => {
      const result = transposeCharacters("a", 0);
      expect(result.line).toBe("a");
    });
  });

  describe("transposeWords", () => {
    it("swaps adjacent words", () => {
      const result = transposeWords("hello world", 0);
      expect(result.line).toBe("world hello");
    });
    it("handles single word", () => {
      const result = transposeWords("hello", 0);
      expect(result.line).toBe("hello");
    });
  });

  describe("transposeLines", () => {
    it("swaps current line with next", () => {
      const result = transposeLines(["a", "b", "c"], 0);
      expect(result.lines).toEqual(["b", "a", "c"]);
      expect(result.lineNumber).toBe(1);
    });
    it("handles last line", () => {
      const result = transposeLines(["a", "b"], 1);
      expect(result.lines).toEqual(["a", "b"]);
    });
  });

  describe("indentLines", () => {
    it("adds indentation", () => {
      const result = indentLines(["a", "b"], { startLine: 0, endLine: 1 }, "  ");
      expect(result.lines).toEqual(["  a", "  b"]);
    });
    it("skips empty lines", () => {
      const result = indentLines(["a", "", "b"], { startLine: 0, endLine: 2 }, "  ");
      expect(result.lines).toEqual(["  a", "", "  b"]);
    });
  });

  describe("outdentLines", () => {
    it("removes spaces", () => {
      const result = outdentLines(["  a", "  b"], { startLine: 0, endLine: 1 }, 2, true);
      expect(result.lines).toEqual(["a", "b"]);
    });
    it("removes tab", () => {
      const result = outdentLines(["\ta", "\tb"], { startLine: 0, endLine: 1 }, 1, false);
      expect(result.lines).toEqual(["a", "b"]);
    });
  });

  describe("trimTrailingWhitespace", () => {
    it("trims all lines without range", () => {
      const result = trimTrailingWhitespace(["a  ", "b  "]);
      expect(result.lines).toEqual(["a", "b"]);
    });
    it("trims only range", () => {
      const result = trimTrailingWhitespace(["a  ", "b  ", "c  "], { startLine: 0, endLine: 0 });
      expect(result.lines).toEqual(["a", "b  ", "c  "]);
    });
  });

  describe("addLineComment", () => {
    it("adds comment to lines", () => {
      const result = addLineComment(["a", "b"], { startLine: 0, endLine: 1 }, "//");
      expect(result.lines).toEqual(["// a", "// b"]);
    });
    it("preserves indentation", () => {
      const result = addLineComment(["  a", "  b"], { startLine: 0, endLine: 1 }, "//");
      expect(result.lines).toEqual(["  // a", "  // b"]);
    });
  });

  describe("removeLineComment", () => {
    it("removes comment from lines", () => {
      const result = removeLineComment(["// a", "// b"], { startLine: 0, endLine: 1 }, "//");
      expect(result.lines).toEqual(["a", "b"]);
    });
  });

  describe("toggleLineComment", () => {
    it("adds comments when not all commented", () => {
      const result = toggleLineComment(["a", "// b"], { startLine: 0, endLine: 1 }, "//");
      expect(result.lines[0]).toContain("//");
    });
    it("removes comments when all commented", () => {
      const result = toggleLineComment(["// a", "// b"], { startLine: 0, endLine: 1 }, "//");
      expect(result.lines).toEqual(["a", "b"]);
    });
  });

  describe("reverseLines", () => {
    it("reverses line order", () => {
      const result = reverseLines(["a", "b", "c"], { startLine: 0, endLine: 2 });
      expect(result.lines).toEqual(["c", "b", "a"]);
    });
  });

  describe("shuffleLines", () => {
    it("returns same number of lines", () => {
      const result = shuffleLines(["a", "b", "c"], { startLine: 0, endLine: 2 });
      expect(result.lines).toHaveLength(3);
    });
  });

  describe("getUniqueLines", () => {
    it("delegates to deleteDuplicateLines", () => {
      const result = getUniqueLines(["a", "b", "a"], { startLine: 0, endLine: 2 });
      expect(result.lines).toEqual(["a", "b"]);
    });
  });
});
