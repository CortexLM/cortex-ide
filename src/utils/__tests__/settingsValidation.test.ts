import { describe, it, expect } from "vitest";
import {
  validateSetting,
  validateSettings,
  coerceValue,
  formatSettingsJSON,
  parseSettingsJSON,
  getSchemaDefault,
  type JSONSchema,
} from "../settingsValidation";

describe("settingsValidation", () => {
  describe("validateSetting", () => {
    describe("type validation", () => {
      it("validates string type", () => {
        const r = validateSetting("hello", { type: "string" });
        expect(r.valid).toBe(true);
        expect(r.errors).toHaveLength(0);
      });
      it("coerces number to string type", () => {
        const r = validateSetting(42, { type: "string" });
        expect(r.valid).toBe(true);
        expect(r.coercedValue).toBe("42");
      });
      it("validates number type", () => {
        expect(validateSetting(42, { type: "number" }).valid).toBe(true);
      });
      it("rejects NaN for number type", () => {
        expect(validateSetting(NaN, { type: "number" }).valid).toBe(false);
      });
      it("validates integer type", () => {
        expect(validateSetting(42, { type: "integer" }).valid).toBe(true);
        expect(validateSetting(42.5, { type: "integer" }).valid).toBe(false);
      });
      it("validates boolean type", () => {
        expect(validateSetting(true, { type: "boolean" }).valid).toBe(true);
        expect(validateSetting("true", { type: "boolean" }).valid).toBe(true); // coerced
      });
      it("validates array type", () => {
        expect(validateSetting([1, 2], { type: "array" }).valid).toBe(true);
        expect(validateSetting("not-array", { type: "array" }).valid).toBe(false);
      });
      it("validates object type", () => {
        expect(validateSetting({ a: 1 }, { type: "object" }).valid).toBe(true);
        expect(validateSetting(null, { type: "object" }).valid).toBe(false);
      });
      it("validates null type", () => {
        expect(validateSetting(null, { type: "null" }).valid).toBe(true);
        expect(validateSetting(0, { type: "null" }).valid).toBe(false);
      });
      it("validates union types", () => {
        const schema: JSONSchema = { type: ["string", "number"] };
        expect(validateSetting("hi", schema).valid).toBe(true);
        expect(validateSetting(42, schema).valid).toBe(true);
        expect(validateSetting(true, schema).valid).toBe(true); // coerced: boolean -> string "true"
      });
    });

    describe("number constraints", () => {
      it("validates minimum", () => {
        expect(validateSetting(5, { type: "number", minimum: 0 }).valid).toBe(true);
        expect(validateSetting(-1, { type: "number", minimum: 0 }).valid).toBe(false);
      });
      it("validates maximum", () => {
        expect(validateSetting(5, { type: "number", maximum: 10 }).valid).toBe(true);
        expect(validateSetting(11, { type: "number", maximum: 10 }).valid).toBe(false);
      });
      it("validates exclusiveMinimum", () => {
        expect(validateSetting(1, { type: "number", exclusiveMinimum: 0 }).valid).toBe(true);
        expect(validateSetting(0, { type: "number", exclusiveMinimum: 0 }).valid).toBe(false);
      });
      it("validates exclusiveMaximum", () => {
        expect(validateSetting(9, { type: "number", exclusiveMaximum: 10 }).valid).toBe(true);
        expect(validateSetting(10, { type: "number", exclusiveMaximum: 10 }).valid).toBe(false);
      });
      it("validates multipleOf", () => {
        expect(validateSetting(6, { type: "number", multipleOf: 3 }).valid).toBe(true);
        expect(validateSetting(7, { type: "number", multipleOf: 3 }).valid).toBe(false);
      });
    });

    describe("string constraints", () => {
      it("validates minLength", () => {
        expect(validateSetting("abc", { type: "string", minLength: 2 }).valid).toBe(true);
        expect(validateSetting("a", { type: "string", minLength: 2 }).valid).toBe(false);
      });
      it("validates maxLength", () => {
        expect(validateSetting("ab", { type: "string", maxLength: 5 }).valid).toBe(true);
        expect(validateSetting("abcdef", { type: "string", maxLength: 5 }).valid).toBe(false);
      });
      it("validates pattern", () => {
        expect(validateSetting("abc123", { type: "string", pattern: "^[a-z]+\\d+$" }).valid).toBe(true);
        expect(validateSetting("ABC", { type: "string", pattern: "^[a-z]+$" }).valid).toBe(false);
      });
      it("handles invalid pattern gracefully", () => {
        const r = validateSetting("test", { type: "string", pattern: "[invalid" });
        expect(r.valid).toBe(false);
        expect(r.errors[0].message).toContain("Invalid regex");
      });
      it("validates format: email", () => {
        expect(validateSetting("user@example.com", { type: "string", format: "email" }).valid).toBe(true);
        expect(validateSetting("not-email", { type: "string", format: "email" }).valid).toBe(false);
      });
      it("validates format: uri", () => {
        expect(validateSetting("https://example.com", { type: "string", format: "uri" }).valid).toBe(true);
        expect(validateSetting("not a url", { type: "string", format: "uri" }).valid).toBe(false);
      });
      it("validates format: uri-reference", () => {
        expect(validateSetting("/path/to/file", { type: "string", format: "uri-reference" }).valid).toBe(true);
      });
      it("validates format: date", () => {
        expect(validateSetting("2024-01-15", { type: "string", format: "date" }).valid).toBe(true);
        expect(validateSetting("not-a-date", { type: "string", format: "date" }).valid).toBe(false);
      });
      it("validates format: date-time", () => {
        expect(validateSetting("2024-01-15T10:30:00Z", { type: "string", format: "date-time" }).valid).toBe(true);
      });
      it("validates format: time", () => {
        expect(validateSetting("10:30:00", { type: "string", format: "time" }).valid).toBe(true);
      });
      it("validates format: hostname", () => {
        expect(validateSetting("example.com", { type: "string", format: "hostname" }).valid).toBe(true);
      });
      it("validates format: ipv4", () => {
        expect(validateSetting("192.168.1.1", { type: "string", format: "ipv4" }).valid).toBe(true);
        expect(validateSetting("999.999.999.999", { type: "string", format: "ipv4" }).valid).toBe(false);
      });
      it("validates format: ipv6", () => {
        expect(validateSetting("::1", { type: "string", format: "ipv6" }).valid).toBe(true);
      });
      it("validates format: uuid", () => {
        expect(validateSetting("550e8400-e29b-41d4-a716-446655440000", { type: "string", format: "uuid" }).valid).toBe(true);
        expect(validateSetting("not-a-uuid", { type: "string", format: "uuid" }).valid).toBe(false);
      });
      it("validates format: color", () => {
        expect(validateSetting("#ff0000", { type: "string", format: "color" }).valid).toBe(true);
        expect(validateSetting("#fff", { type: "string", format: "color" }).valid).toBe(true);
        expect(validateSetting("red", { type: "string", format: "color" }).valid).toBe(false);
      });
      it("validates format: regex", () => {
        expect(validateSetting("^[a-z]+$", { type: "string", format: "regex" }).valid).toBe(true);
        expect(validateSetting("[invalid", { type: "string", format: "regex" }).valid).toBe(false);
      });
      it("ignores unknown format", () => {
        expect(validateSetting("test", { type: "string", format: "custom-format" }).valid).toBe(true);
      });
    });

    describe("array validation", () => {
      it("validates minItems", () => {
        expect(validateSetting([1, 2], { type: "array", minItems: 1 }).valid).toBe(true);
        expect(validateSetting([], { type: "array", minItems: 1 }).valid).toBe(false);
      });
      it("validates maxItems", () => {
        expect(validateSetting([1], { type: "array", maxItems: 2 }).valid).toBe(true);
        expect(validateSetting([1, 2, 3], { type: "array", maxItems: 2 }).valid).toBe(false);
      });
      it("validates uniqueItems", () => {
        expect(validateSetting([1, 2, 3], { type: "array", uniqueItems: true }).valid).toBe(true);
        expect(validateSetting([1, 2, 1], { type: "array", uniqueItems: true }).valid).toBe(false);
      });
      it("validates items schema", () => {
        const schema: JSONSchema = { type: "array", items: { type: "number" } };
        expect(validateSetting([1, 2, 3], schema).valid).toBe(true);
        expect(validateSetting([1, "two", 3], schema).valid).toBe(false);
      });
      it("validates tuple items", () => {
        const schema: JSONSchema = { type: "array", items: [{ type: "string" }, { type: "number" }] };
        expect(validateSetting(["hello", 42], schema).valid).toBe(true);
        expect(validateSetting([42, "hello"], schema).valid).toBe(false);
      });
    });

    describe("object validation", () => {
      it("validates required properties", () => {
        const schema: JSONSchema = { type: "object", required: ["name"], properties: { name: { type: "string" } } };
        expect(validateSetting({ name: "test" }, schema).valid).toBe(true);
        expect(validateSetting({}, schema).valid).toBe(false);
      });
      it("validates property schemas", () => {
        const schema: JSONSchema = { type: "object", properties: { age: { type: "number", minimum: 0 } } };
        expect(validateSetting({ age: 25 }, schema).valid).toBe(true);
        expect(validateSetting({ age: -1 }, schema).valid).toBe(false);
      });
      it("validates additionalProperties false", () => {
        const schema: JSONSchema = { type: "object", properties: { a: { type: "string" } }, additionalProperties: false };
        expect(validateSetting({ a: "x" }, schema).valid).toBe(true);
        expect(validateSetting({ a: "x", b: "y" }, schema).valid).toBe(false);
      });
      it("validates additionalProperties with schema", () => {
        const schema: JSONSchema = { type: "object", properties: {}, additionalProperties: { type: "number" } };
        expect(validateSetting({ x: 1, y: 2 }, schema).valid).toBe(true);
        expect(validateSetting({ x: "str" }, schema).valid).toBe(false);
      });
      it("validates patternProperties", () => {
        const schema: JSONSchema = { type: "object", patternProperties: { "^x-": { type: "string" } } };
        expect(validateSetting({ "x-custom": "hello" }, schema).valid).toBe(true);
        expect(validateSetting({ "x-custom": 42 }, schema).valid).toBe(true); // coerced: number -> string "42"
      });
    });

    describe("enum validation", () => {
      it("validates enum values", () => {
        const schema: JSONSchema = { enum: ["a", "b", "c"] };
        expect(validateSetting("a", schema).valid).toBe(true);
        expect(validateSetting("d", schema).valid).toBe(false);
      });
      it("validates enum with different types", () => {
        const schema: JSONSchema = { enum: [1, "two", true, null] };
        expect(validateSetting(1, schema).valid).toBe(true);
        expect(validateSetting("two", schema).valid).toBe(true);
        expect(validateSetting(true, schema).valid).toBe(true);
        expect(validateSetting(null, schema).valid).toBe(true);
        expect(validateSetting(2, schema).valid).toBe(false);
      });
      it("validates enum with objects via deep equality", () => {
        const schema: JSONSchema = { enum: [{ a: 1 }] };
        expect(validateSetting({ a: 1 }, schema).valid).toBe(true);
      });
    });

    describe("const validation", () => {
      it("validates const value", () => {
        expect(validateSetting(42, { const: 42 }).valid).toBe(true);
        expect(validateSetting(43, { const: 42 }).valid).toBe(false);
      });
      it("uses custom errorMessage", () => {
        const r = validateSetting(1, { const: 2, errorMessage: "Must be 2" });
        expect(r.errors[0].message).toBe("Must be 2");
      });
    });

    describe("combinators", () => {
      it("validates anyOf", () => {
        const schema: JSONSchema = { anyOf: [{ type: "string" }, { type: "number" }] };
        expect(validateSetting("hi", schema).valid).toBe(true);
        expect(validateSetting(42, schema).valid).toBe(true);
        expect(validateSetting(true, schema).valid).toBe(true); // coerced: boolean -> string "true"
      });
      it("validates oneOf", () => {
        const schema: JSONSchema = { oneOf: [{ type: "string", maxLength: 5 }, { type: "string", minLength: 10 }] };
        expect(validateSetting("hi", schema).valid).toBe(true);
        expect(validateSetting("a very long string here", schema).valid).toBe(true);
      });
      it("oneOf fails when multiple match", () => {
        const schema: JSONSchema = { oneOf: [{ type: "string" }, { type: "string", minLength: 1 }] };
        const r = validateSetting("hello", schema);
        expect(r.valid).toBe(false);
        expect(r.errors[0].message).toContain("matches 2 schemas");
      });
      it("validates allOf", () => {
        const schema: JSONSchema = { allOf: [{ type: "number", minimum: 0 }, { type: "number", maximum: 100 }] };
        expect(validateSetting(50, schema).valid).toBe(true);
        expect(validateSetting(150, schema).valid).toBe(false);
      });
      it("validates not", () => {
        expect(validateSetting(42, { not: { const: 99 } }).valid).toBe(true);
        expect(validateSetting(42, { not: { const: 42 } }).valid).toBe(false);
      });
    });

    describe("conditional (if/then/else)", () => {
      it("applies then when if matches", () => {
        const schema: JSONSchema = {
          if: { type: "number", minimum: 10 },
          then: { type: "number", maximum: 100 },
        };
        expect(validateSetting(50, schema).valid).toBe(true);
        expect(validateSetting(150, schema).valid).toBe(false);
      });
      it("applies else when if does not match", () => {
        const schema: JSONSchema = {
          if: { type: "number" },
          else: { type: "string", minLength: 1 },
        };
        expect(validateSetting("hello", schema).valid).toBe(true);
        expect(validateSetting("", schema).valid).toBe(false);
      });
      it("returns valid when no if", () => {
        const schema: JSONSchema = { then: { type: "string" } };
        expect(validateSetting(42, schema).valid).toBe(true);
      });
    });

    describe("deprecation warnings", () => {
      it("adds deprecation warning", () => {
        const r = validateSetting("val", { type: "string", deprecationMessage: "Use newSetting instead" });
        expect(r.valid).toBe(true);
        expect(r.warnings).toHaveLength(1);
        expect(r.warnings[0].type).toBe("deprecation");
      });
    });

    describe("path building", () => {
      it("builds nested paths", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            editor: {
              type: "object",
              properties: {
                tabSize: { type: "number", minimum: 1 },
              },
            },
          },
        };
        const r = validateSetting({ editor: { tabSize: 0 } }, schema);
        expect(r.valid).toBe(false);
        expect(r.errors[0].path).toBe("editor.tabSize");
      });
      it("builds array index paths", () => {
        const schema: JSONSchema = { type: "array", items: { type: "number" } };
        const r = validateSetting([1, "two"], schema);
        expect(r.valid).toBe(false);
        expect(r.errors[0].path).toBe("[1]");
      });
    });
  });

  describe("coerceValue", () => {
    it("returns value unchanged when type matches", () => {
      expect(coerceValue("hello", { type: "string" })).toEqual({ success: true, value: "hello" });
    });
    it("coerces string to number", () => {
      expect(coerceValue("42", { type: "number" })).toEqual({ success: true, value: 42 });
    });
    it("coerces string to integer", () => {
      expect(coerceValue("42", { type: "integer" })).toEqual({ success: true, value: 42 });
      expect(coerceValue("42.5", { type: "integer" }).success).toBe(false);
    });
    it("coerces string to boolean", () => {
      expect(coerceValue("true", { type: "boolean" })).toEqual({ success: true, value: true });
      expect(coerceValue("false", { type: "boolean" })).toEqual({ success: true, value: false });
      expect(coerceValue("yes", { type: "boolean" })).toEqual({ success: true, value: true });
      expect(coerceValue("no", { type: "boolean" })).toEqual({ success: true, value: false });
      expect(coerceValue("1", { type: "boolean" })).toEqual({ success: true, value: true });
      expect(coerceValue("0", { type: "boolean" })).toEqual({ success: true, value: false });
      expect(coerceValue("on", { type: "boolean" })).toEqual({ success: true, value: true });
      expect(coerceValue("off", { type: "boolean" })).toEqual({ success: true, value: false });
    });
    it("coerces string to null", () => {
      expect(coerceValue("null", { type: "null" })).toEqual({ success: true, value: null });
    });
    it("coerces string to array via JSON parse", () => {
      expect(coerceValue("[1,2,3]", { type: "array" })).toEqual({ success: true, value: [1, 2, 3] });
    });
    it("coerces string to object via JSON parse", () => {
      expect(coerceValue('{"a":1}', { type: "object" })).toEqual({ success: true, value: { a: 1 } });
    });
    it("coerces number to string", () => {
      expect(coerceValue(42, { type: "string" })).toEqual({ success: true, value: "42" });
    });
    it("coerces boolean to string", () => {
      expect(coerceValue(true, { type: "string" })).toEqual({ success: true, value: "true" });
    });
    it("coerces number to boolean", () => {
      expect(coerceValue(1, { type: "boolean" })).toEqual({ success: true, value: true });
      expect(coerceValue(0, { type: "boolean" })).toEqual({ success: true, value: false });
    });
    it("returns success when no type specified", () => {
      expect(coerceValue("anything", {}).success).toBe(true);
    });
    it("fails when coercion not possible", () => {
      expect(coerceValue([], { type: "number" }).success).toBe(false);
    });
    it("fails for empty string to number", () => {
      expect(coerceValue("", { type: "number" }).success).toBe(false);
    });
    it("fails for non-JSON string to array", () => {
      expect(coerceValue("not-json", { type: "array" }).success).toBe(false);
    });
    it("fails for non-object JSON string to object", () => {
      expect(coerceValue("[1,2]", { type: "object" }).success).toBe(false);
    });
    it("fails for random string to boolean", () => {
      expect(coerceValue("maybe", { type: "boolean" }).success).toBe(false);
    });
  });

  describe("formatSettingsJSON", () => {
    it("formats settings as JSON", () => {
      const result = formatSettingsJSON({ a: 1, b: "two" });
      expect(result).toBe('{\n  "a": 1,\n  "b": "two"\n}');
    });
    it("uses custom indent", () => {
      const result = formatSettingsJSON({ a: 1 }, 4);
      expect(result).toBe('{\n    "a": 1\n}');
    });
  });

  describe("parseSettingsJSON", () => {
    it("parses valid JSON", () => {
      const r = parseSettingsJSON('{"a": 1}');
      expect(r.success).toBe(true);
      expect(r.value).toEqual({ a: 1 });
    });
    it("rejects non-object JSON", () => {
      const r = parseSettingsJSON("[1,2,3]");
      expect(r.success).toBe(false);
      expect(r.errors![0].message).toContain("JSON object");
    });
    it("recovers from comments (JSONC)", () => {
      const r = parseSettingsJSON('{\n  // comment\n  "a": 1\n}');
      expect(r.success).toBe(true);
      expect(r.value).toEqual({ a: 1 });
    });
    it("recovers from block comments", () => {
      const r = parseSettingsJSON('{\n  /* comment */\n  "a": 1\n}');
      expect(r.success).toBe(true);
    });
    it("recovers from trailing commas", () => {
      const r = parseSettingsJSON('{"a": 1, "b": 2,}');
      expect(r.success).toBe(true);
      expect(r.value).toEqual({ a: 1, b: 2 });
    });
    it("reports errors for truly invalid JSON", () => {
      const r = parseSettingsJSON("{invalid json}");
      expect(r.success).toBe(false);
      expect(r.errors).toBeDefined();
      expect(r.errors!.length).toBeGreaterThan(0);
    });
    it("extracts position from error message", () => {
      const r = parseSettingsJSON('{"a": }');
      expect(r.success).toBe(false);
    });
  });

  describe("validateSettings (batch)", () => {
    it("validates multiple settings", () => {
      const schemas: Record<string, JSONSchema> = {
        "editor.tabSize": { type: "number", minimum: 1 },
        "editor.wordWrap": { type: "string", enum: ["on", "off", "wordWrapColumn"] },
      };
      const r = validateSettings({ "editor.tabSize": 4, "editor.wordWrap": "on" }, schemas);
      expect(r.valid).toBe(true);
    });
    it("reports errors for invalid settings", () => {
      const schemas: Record<string, JSONSchema> = {
        "editor.tabSize": { type: "number", minimum: 1 },
      };
      const r = validateSettings({ "editor.tabSize": 0 }, schemas);
      expect(r.valid).toBe(false);
    });
    it("ignores settings without schemas", () => {
      const r = validateSettings({ unknown: "value" }, {});
      expect(r.valid).toBe(true);
    });
  });

  describe("getSchemaDefault", () => {
    it("returns explicit default", () => {
      expect(getSchemaDefault({ default: 42 })).toBe(42);
    });
    it("builds object default from property defaults", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          a: { default: 1 },
          b: { default: "hello" },
          c: { type: "string" },
        },
      };
      expect(getSchemaDefault(schema)).toEqual({ a: 1, b: "hello" });
    });
    it("returns empty array for array type", () => {
      expect(getSchemaDefault({ type: "array" })).toEqual([]);
    });
    it("returns undefined for type without default", () => {
      expect(getSchemaDefault({ type: "string" })).toBeUndefined();
    });
    it("returns undefined for object with no property defaults", () => {
      expect(getSchemaDefault({ type: "object", properties: { a: { type: "string" } } })).toBeUndefined();
    });
  });
});
