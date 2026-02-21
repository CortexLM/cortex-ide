import { describe, it, expect } from "vitest";
import { parseJsonc, parseJsoncSafe, isValidJsonc } from "../jsonc";

describe("jsonc", () => {
  describe("parseJsonc", () => {
    it("parses standard JSON", () => {
      expect(parseJsonc('{"a": 1}')).toEqual({ a: 1 });
    });
    it("removes single-line comments", () => {
      const input = `{
        // This is a comment
        "key": "value"
      }`;
      expect(parseJsonc(input)).toEqual({ key: "value" });
    });
    it("removes multi-line comments", () => {
      const input = `{
        /* This is a
           multi-line comment */
        "key": "value"
      }`;
      expect(parseJsonc(input)).toEqual({ key: "value" });
    });
    it("removes trailing commas", () => {
      const input = `{
        "a": 1,
        "b": 2,
      }`;
      expect(parseJsonc(input)).toEqual({ a: 1, b: 2 });
    });
    it("handles trailing commas in arrays", () => {
      const input = `[1, 2, 3,]`;
      expect(parseJsonc(input)).toEqual([1, 2, 3]);
    });
    it("preserves comment-like strings inside quotes", () => {
      const input = `{"url": "http://example.com"}`;
      expect(parseJsonc(input)).toEqual({ url: "http://example.com" });
    });
    it("preserves // inside strings", () => {
      const input = `{"comment": "this has // inside"}`;
      expect(parseJsonc(input)).toEqual({ comment: "this has // inside" });
    });
    it("handles escaped quotes in strings", () => {
      const input = `{"key": "value with \\"quotes\\""}`;
      expect(parseJsonc(input)).toEqual({ key: 'value with "quotes"' });
    });
    it("handles complex JSONC", () => {
      const input = `{
        // Database config
        "host": "localhost", // inline comment
        "port": 5432,
        /* Credentials
           section */
        "user": "admin",
        "pass": "p@ss",
      }`;
      expect(parseJsonc(input)).toEqual({
        host: "localhost",
        port: 5432,
        user: "admin",
        pass: "p@ss",
      });
    });
    it("throws on invalid JSON after comment removal", () => {
      expect(() => parseJsonc("{invalid}")).toThrow();
    });
  });

  describe("parseJsoncSafe", () => {
    it("returns parsed value for valid JSONC", () => {
      expect(parseJsoncSafe('{"a": 1}', {})).toEqual({ a: 1 });
    });
    it("returns default value for invalid JSONC", () => {
      expect(parseJsoncSafe("not valid", { fallback: true })).toEqual({ fallback: true });
    });
  });

  describe("isValidJsonc", () => {
    it("returns true for valid JSON", () => {
      expect(isValidJsonc('{"a": 1}')).toBe(true);
    });
    it("returns true for JSON with comments", () => {
      expect(isValidJsonc('{"a": 1} // comment')).toBe(true);
    });
    it("returns false for invalid content", () => {
      expect(isValidJsonc("{not valid}")).toBe(false);
    });
  });
});
