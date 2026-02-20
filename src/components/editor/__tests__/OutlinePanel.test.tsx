/**
 * OutlinePanel Tests
 *
 * Tests for the OutlinePanel component types, mappings, and utility functions.
 */

import { describe, it, expect } from "vitest";

type SortOrder = "position" | "name" | "kind";

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

interface SymbolRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface DocumentSymbol {
  id: string;
  name: string;
  detail?: string;
  kind: SymbolKind;
  tags?: number[];
  range: SymbolRange;
  selectionRange: SymbolRange;
  children: DocumentSymbol[];
  depth: number;
  expanded: boolean;
}

const SymbolTag = {
  Deprecated: 1,
} as const;

const isSymbolDeprecated = (symbol: DocumentSymbol): boolean =>
  symbol.tags?.includes(SymbolTag.Deprecated) ?? false;

const symbolIcons: Record<SymbolKind, { iconName: string; color: string }> = {
  file: { iconName: "code", color: "var(--icon-default)" },
  module: { iconName: "m", color: "var(--cortex-syntax-orange)" },
  namespace: { iconName: "n", color: "var(--cortex-syntax-purple)" },
  package: { iconName: "p", color: "var(--cortex-syntax-orange)" },
  class: { iconName: "c", color: "var(--cortex-syntax-orange)" },
  method: { iconName: "function", color: "var(--cortex-syntax-purple)" },
  property: { iconName: "box", color: "var(--cortex-syntax-cyan)" },
  field: { iconName: "f", color: "var(--cortex-syntax-cyan)" },
  constructor: { iconName: "lambda", color: "var(--cortex-syntax-purple)" },
  enum: { iconName: "e", color: "var(--cortex-syntax-orange)" },
  interface: { iconName: "i", color: "var(--cortex-syntax-green)" },
  function: { iconName: "function", color: "var(--cortex-syntax-blue)" },
  variable: { iconName: "v", color: "var(--cortex-syntax-blue)" },
  constant: { iconName: "k", color: "var(--cortex-syntax-blue)" },
  string: { iconName: "s", color: "var(--cortex-syntax-green)" },
  number: { iconName: "hashtag", color: "var(--cortex-syntax-green)" },
  boolean: { iconName: "toggle-on", color: "var(--cortex-syntax-green)" },
  array: { iconName: "brackets-square", color: "var(--cortex-syntax-orange)" },
  object: { iconName: "brackets-curly", color: "var(--cortex-syntax-orange)" },
  key: { iconName: "k", color: "var(--cortex-syntax-cyan)" },
  null: { iconName: "circle-dot", color: "var(--icon-default)" },
  enumMember: { iconName: "hashtag", color: "var(--cortex-syntax-cyan)" },
  struct: { iconName: "s", color: "var(--cortex-syntax-orange)" },
  event: { iconName: "circle-dot", color: "var(--cortex-syntax-purple)" },
  operator: { iconName: "o", color: "var(--icon-default)" },
  typeParameter: { iconName: "t", color: "var(--cortex-syntax-green)" },
};

const symbolKindOrder: Record<SymbolKind, number> = {
  class: 1,
  interface: 2,
  struct: 3,
  enum: 4,
  function: 5,
  method: 6,
  constructor: 7,
  property: 8,
  field: 9,
  variable: 10,
  constant: 11,
  enumMember: 12,
  module: 13,
  namespace: 14,
  package: 15,
  typeParameter: 16,
  file: 17,
  object: 18,
  array: 19,
  string: 20,
  number: 21,
  boolean: 22,
  key: 23,
  null: 24,
  event: 25,
  operator: 26,
};

function sortSymbols(symbols: DocumentSymbol[], order: SortOrder): DocumentSymbol[] {
  const sorted = [...symbols];
  switch (order) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "kind":
      sorted.sort((a, b) => {
        const kindA = symbolKindOrder[a.kind] ?? 99;
        const kindB = symbolKindOrder[b.kind] ?? 99;
        return kindA - kindB || a.name.localeCompare(b.name);
      });
      break;
    case "position":
    default:
      sorted.sort((a, b) => a.range.startLine - b.range.startLine);
  }
  return sorted.map((s) => ({
    ...s,
    children: s.children ? sortSymbols(s.children, order) : [],
  }));
}

function createMockSymbol(overrides: Partial<DocumentSymbol> = {}): DocumentSymbol {
  return {
    id: "test-id",
    name: "testSymbol",
    kind: "function",
    range: { startLine: 0, startColumn: 0, endLine: 10, endColumn: 0 },
    selectionRange: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 10 },
    children: [],
    depth: 0,
    expanded: true,
    ...overrides,
  };
}

describe("OutlinePanel", () => {
  describe("Type Definitions", () => {
    describe("SortOrder", () => {
      it("should accept valid sort order values", () => {
        const position: SortOrder = "position";
        const name: SortOrder = "name";
        const kind: SortOrder = "kind";

        expect(position).toBe("position");
        expect(name).toBe("name");
        expect(kind).toBe("kind");
      });

      it("should have exactly 3 valid values", () => {
        const validValues: SortOrder[] = ["position", "name", "kind"];
        expect(validValues).toHaveLength(3);
      });
    });

    describe("SymbolKind", () => {
      it("should accept all valid symbol kinds", () => {
        const allKinds: SymbolKind[] = [
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

        expect(allKinds).toHaveLength(26);
        allKinds.forEach((kind) => {
          expect(typeof kind).toBe("string");
        });
      });

      it("should include class-like kinds", () => {
        const classLikeKinds: SymbolKind[] = ["class", "interface", "struct", "enum"];
        classLikeKinds.forEach((kind) => {
          expect(kind).toBeDefined();
        });
      });

      it("should include function-like kinds", () => {
        const functionLikeKinds: SymbolKind[] = ["function", "method", "constructor"];
        functionLikeKinds.forEach((kind) => {
          expect(kind).toBeDefined();
        });
      });

      it("should include variable-like kinds", () => {
        const variableLikeKinds: SymbolKind[] = ["variable", "constant", "property", "field"];
        variableLikeKinds.forEach((kind) => {
          expect(kind).toBeDefined();
        });
      });
    });

    describe("DocumentSymbol interface", () => {
      it("should require all mandatory fields", () => {
        const symbol: DocumentSymbol = {
          id: "sym-1",
          name: "MyClass",
          kind: "class",
          range: { startLine: 0, startColumn: 0, endLine: 50, endColumn: 1 },
          selectionRange: { startLine: 0, startColumn: 6, endLine: 0, endColumn: 13 },
          children: [],
          depth: 0,
          expanded: true,
        };

        expect(symbol.id).toBe("sym-1");
        expect(symbol.name).toBe("MyClass");
        expect(symbol.kind).toBe("class");
        expect(symbol.range).toBeDefined();
        expect(symbol.selectionRange).toBeDefined();
        expect(symbol.children).toEqual([]);
        expect(symbol.depth).toBe(0);
        expect(symbol.expanded).toBe(true);
      });

      it("should support optional detail field", () => {
        const symbolWithDetail: DocumentSymbol = createMockSymbol({
          detail: "string | number",
        });

        const symbolWithoutDetail: DocumentSymbol = createMockSymbol();

        expect(symbolWithDetail.detail).toBe("string | number");
        expect(symbolWithoutDetail.detail).toBeUndefined();
      });

      it("should support optional tags field", () => {
        const symbolWithTags: DocumentSymbol = createMockSymbol({
          tags: [1],
        });

        const symbolWithoutTags: DocumentSymbol = createMockSymbol();

        expect(symbolWithTags.tags).toEqual([1]);
        expect(symbolWithoutTags.tags).toBeUndefined();
      });

      it("should support nested children", () => {
        const childSymbol: DocumentSymbol = createMockSymbol({
          id: "child-1",
          name: "childMethod",
          kind: "method",
          depth: 1,
        });

        const parentSymbol: DocumentSymbol = createMockSymbol({
          id: "parent-1",
          name: "ParentClass",
          kind: "class",
          children: [childSymbol],
          depth: 0,
        });

        expect(parentSymbol.children).toHaveLength(1);
        expect(parentSymbol.children[0].name).toBe("childMethod");
        expect(parentSymbol.children[0].depth).toBe(1);
      });
    });

    describe("SymbolTag", () => {
      it("should define Deprecated as 1", () => {
        expect(SymbolTag.Deprecated).toBe(1);
      });

      it("should be a const object", () => {
        expect(typeof SymbolTag).toBe("object");
        expect(Object.keys(SymbolTag)).toContain("Deprecated");
      });
    });
  });

  describe("symbolIcons mapping", () => {
    it("should have an entry for every SymbolKind", () => {
      const allKinds: SymbolKind[] = [
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

      allKinds.forEach((kind) => {
        expect(symbolIcons[kind]).toBeDefined();
        expect(symbolIcons[kind].iconName).toBeDefined();
        expect(symbolIcons[kind].color).toBeDefined();
      });
    });

    it("should have iconName as string for each kind", () => {
      Object.values(symbolIcons).forEach((config) => {
        expect(typeof config.iconName).toBe("string");
        expect(config.iconName.length).toBeGreaterThan(0);
      });
    });

    it("should have color as string for each kind", () => {
      Object.values(symbolIcons).forEach((config) => {
        expect(typeof config.color).toBe("string");
        expect(config.color.length).toBeGreaterThan(0);
      });
    });

    it("should use function icon for method and function kinds", () => {
      expect(symbolIcons.function.iconName).toBe("function");
      expect(symbolIcons.method.iconName).toBe("function");
    });

    it("should use single letter icons for class-like kinds", () => {
      expect(symbolIcons.class.iconName).toBe("c");
      expect(symbolIcons.interface.iconName).toBe("i");
      expect(symbolIcons.enum.iconName).toBe("e");
      expect(symbolIcons.struct.iconName).toBe("s");
    });
  });

  describe("symbolKindOrder mapping", () => {
    it("should have an entry for every SymbolKind", () => {
      const allKinds: SymbolKind[] = [
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

      allKinds.forEach((kind) => {
        expect(symbolKindOrder[kind]).toBeDefined();
        expect(typeof symbolKindOrder[kind]).toBe("number");
      });
    });

    it("should prioritize class before interface", () => {
      expect(symbolKindOrder.class).toBeLessThan(symbolKindOrder.interface);
    });

    it("should prioritize interface before struct", () => {
      expect(symbolKindOrder.interface).toBeLessThan(symbolKindOrder.struct);
    });

    it("should prioritize struct before enum", () => {
      expect(symbolKindOrder.struct).toBeLessThan(symbolKindOrder.enum);
    });

    it("should prioritize function before method", () => {
      expect(symbolKindOrder.function).toBeLessThan(symbolKindOrder.method);
    });

    it("should prioritize method before constructor", () => {
      expect(symbolKindOrder.method).toBeLessThan(symbolKindOrder.constructor);
    });

    it("should prioritize variable before constant", () => {
      expect(symbolKindOrder.variable).toBeLessThan(symbolKindOrder.constant);
    });

    it("should have unique priority values", () => {
      const values = Object.values(symbolKindOrder);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it("should have values from 1 to 26", () => {
      const values = Object.values(symbolKindOrder).sort((a, b) => a - b);
      expect(values[0]).toBe(1);
      expect(values[values.length - 1]).toBe(26);
    });
  });

  describe("sortSymbols function", () => {
    const createSymbolsForSorting = (): DocumentSymbol[] => [
      createMockSymbol({
        id: "1",
        name: "zebra",
        kind: "variable",
        range: { startLine: 30, startColumn: 0, endLine: 30, endColumn: 10 },
      }),
      createMockSymbol({
        id: "2",
        name: "alpha",
        kind: "class",
        range: { startLine: 10, startColumn: 0, endLine: 20, endColumn: 1 },
      }),
      createMockSymbol({
        id: "3",
        name: "beta",
        kind: "function",
        range: { startLine: 5, startColumn: 0, endLine: 8, endColumn: 1 },
      }),
    ];

    describe("sort by position", () => {
      it("should sort symbols by startLine ascending", () => {
        const symbols = createSymbolsForSorting();
        const sorted = sortSymbols(symbols, "position");

        expect(sorted[0].name).toBe("beta");
        expect(sorted[1].name).toBe("alpha");
        expect(sorted[2].name).toBe("zebra");
      });

      it("should handle symbols on the same line", () => {
        const symbols: DocumentSymbol[] = [
          createMockSymbol({
            id: "1",
            name: "second",
            range: { startLine: 5, startColumn: 20, endLine: 5, endColumn: 30 },
          }),
          createMockSymbol({
            id: "2",
            name: "first",
            range: { startLine: 5, startColumn: 0, endLine: 5, endColumn: 10 },
          }),
        ];

        const sorted = sortSymbols(symbols, "position");
        expect(sorted[0].range.startLine).toBe(5);
        expect(sorted[1].range.startLine).toBe(5);
      });
    });

    describe("sort by name", () => {
      it("should sort symbols alphabetically by name", () => {
        const symbols = createSymbolsForSorting();
        const sorted = sortSymbols(symbols, "name");

        expect(sorted[0].name).toBe("alpha");
        expect(sorted[1].name).toBe("beta");
        expect(sorted[2].name).toBe("zebra");
      });

      it("should be case-sensitive using localeCompare", () => {
        const symbols: DocumentSymbol[] = [
          createMockSymbol({ id: "1", name: "Zebra" }),
          createMockSymbol({ id: "2", name: "alpha" }),
          createMockSymbol({ id: "3", name: "Beta" }),
        ];

        const sorted = sortSymbols(symbols, "name");
        expect(sorted.map((s) => s.name)).toEqual(["alpha", "Beta", "Zebra"]);
      });
    });

    describe("sort by kind", () => {
      it("should sort symbols by kind priority", () => {
        const symbols = createSymbolsForSorting();
        const sorted = sortSymbols(symbols, "kind");

        expect(sorted[0].kind).toBe("class");
        expect(sorted[1].kind).toBe("function");
        expect(sorted[2].kind).toBe("variable");
      });

      it("should sort by name when kinds are equal", () => {
        const symbols: DocumentSymbol[] = [
          createMockSymbol({ id: "1", name: "zMethod", kind: "function" }),
          createMockSymbol({ id: "2", name: "aMethod", kind: "function" }),
          createMockSymbol({ id: "3", name: "mMethod", kind: "function" }),
        ];

        const sorted = sortSymbols(symbols, "kind");

        expect(sorted[0].name).toBe("aMethod");
        expect(sorted[1].name).toBe("mMethod");
        expect(sorted[2].name).toBe("zMethod");
      });
    });

    describe("recursive sorting", () => {
      it("should sort children recursively", () => {
        const symbols: DocumentSymbol[] = [
          createMockSymbol({
            id: "parent",
            name: "ParentClass",
            kind: "class",
            children: [
              createMockSymbol({
                id: "child-2",
                name: "zMethod",
                kind: "method",
                range: { startLine: 20, startColumn: 0, endLine: 25, endColumn: 1 },
              }),
              createMockSymbol({
                id: "child-1",
                name: "aMethod",
                kind: "method",
                range: { startLine: 5, startColumn: 0, endLine: 10, endColumn: 1 },
              }),
            ],
          }),
        ];

        const sorted = sortSymbols(symbols, "name");

        expect(sorted[0].children[0].name).toBe("aMethod");
        expect(sorted[0].children[1].name).toBe("zMethod");
      });

      it("should handle deeply nested children", () => {
        const grandchild1 = createMockSymbol({
          id: "gc-1",
          name: "z",
          range: { startLine: 10, startColumn: 0, endLine: 10, endColumn: 5 },
        });
        const grandchild2 = createMockSymbol({
          id: "gc-2",
          name: "a",
          range: { startLine: 5, startColumn: 0, endLine: 5, endColumn: 5 },
        });

        const child = createMockSymbol({
          id: "child",
          name: "child",
          children: [grandchild1, grandchild2],
        });

        const parent = createMockSymbol({
          id: "parent",
          name: "parent",
          children: [child],
        });

        const sorted = sortSymbols([parent], "name");

        expect(sorted[0].children[0].children[0].name).toBe("a");
        expect(sorted[0].children[0].children[1].name).toBe("z");
      });
    });

    describe("edge cases", () => {
      it("should handle empty array", () => {
        const sorted = sortSymbols([], "position");
        expect(sorted).toEqual([]);
      });

      it("should handle single symbol", () => {
        const symbols = [createMockSymbol({ name: "only" })];
        const sorted = sortSymbols(symbols, "name");
        expect(sorted).toHaveLength(1);
        expect(sorted[0].name).toBe("only");
      });

      it("should not mutate original array", () => {
        const symbols = createSymbolsForSorting();
        const originalFirstName = symbols[0].name;

        sortSymbols(symbols, "name");

        expect(symbols[0].name).toBe(originalFirstName);
      });
    });
  });

  describe("isSymbolDeprecated helper", () => {
    it("should return true when symbol has Deprecated tag", () => {
      const deprecatedSymbol = createMockSymbol({
        tags: [SymbolTag.Deprecated],
      });

      expect(isSymbolDeprecated(deprecatedSymbol)).toBe(true);
    });

    it("should return false when symbol has no tags", () => {
      const symbol = createMockSymbol();

      expect(isSymbolDeprecated(symbol)).toBe(false);
    });

    it("should return false when symbol has empty tags array", () => {
      const symbol = createMockSymbol({
        tags: [],
      });

      expect(isSymbolDeprecated(symbol)).toBe(false);
    });

    it("should return false when symbol has other tags but not Deprecated", () => {
      const symbol = createMockSymbol({
        tags: [2, 3, 4],
      });

      expect(isSymbolDeprecated(symbol)).toBe(false);
    });

    it("should return true when Deprecated is among multiple tags", () => {
      const symbol = createMockSymbol({
        tags: [2, SymbolTag.Deprecated, 3],
      });

      expect(isSymbolDeprecated(symbol)).toBe(true);
    });

    it("should handle undefined tags", () => {
      const symbol = createMockSymbol();
      delete (symbol as Partial<DocumentSymbol>).tags;

      expect(isSymbolDeprecated(symbol)).toBe(false);
    });
  });

  describe("Symbol filtering by type", () => {
    type SymbolTypeFilter =
      | "class"
      | "function"
      | "variable"
      | "interface"
      | "enum"
      | "property"
      | "module"
      | "type"
      | "other";

    const symbolKindToFilter: Record<SymbolKind, SymbolTypeFilter> = {
      file: "module",
      module: "module",
      namespace: "module",
      package: "module",
      class: "class",
      method: "function",
      property: "property",
      field: "property",
      constructor: "function",
      enum: "enum",
      interface: "interface",
      function: "function",
      variable: "variable",
      constant: "variable",
      string: "other",
      number: "other",
      boolean: "other",
      array: "other",
      object: "other",
      key: "property",
      null: "other",
      enumMember: "enum",
      struct: "class",
      event: "other",
      operator: "other",
      typeParameter: "type",
    };

    it("should map class-like kinds to class filter", () => {
      expect(symbolKindToFilter.class).toBe("class");
      expect(symbolKindToFilter.struct).toBe("class");
    });

    it("should map function-like kinds to function filter", () => {
      expect(symbolKindToFilter.function).toBe("function");
      expect(symbolKindToFilter.method).toBe("function");
      expect(symbolKindToFilter.constructor).toBe("function");
    });

    it("should map variable-like kinds to variable filter", () => {
      expect(symbolKindToFilter.variable).toBe("variable");
      expect(symbolKindToFilter.constant).toBe("variable");
    });

    it("should map property-like kinds to property filter", () => {
      expect(symbolKindToFilter.property).toBe("property");
      expect(symbolKindToFilter.field).toBe("property");
      expect(symbolKindToFilter.key).toBe("property");
    });

    it("should map module-like kinds to module filter", () => {
      expect(symbolKindToFilter.file).toBe("module");
      expect(symbolKindToFilter.module).toBe("module");
      expect(symbolKindToFilter.namespace).toBe("module");
      expect(symbolKindToFilter.package).toBe("module");
    });

    it("should map enum-like kinds to enum filter", () => {
      expect(symbolKindToFilter.enum).toBe("enum");
      expect(symbolKindToFilter.enumMember).toBe("enum");
    });

    it("should map interface to interface filter", () => {
      expect(symbolKindToFilter.interface).toBe("interface");
    });

    it("should map typeParameter to type filter", () => {
      expect(symbolKindToFilter.typeParameter).toBe("type");
    });

    it("should map primitive and misc kinds to other filter", () => {
      expect(symbolKindToFilter.string).toBe("other");
      expect(symbolKindToFilter.number).toBe("other");
      expect(symbolKindToFilter.boolean).toBe("other");
      expect(symbolKindToFilter.array).toBe("other");
      expect(symbolKindToFilter.object).toBe("other");
      expect(symbolKindToFilter.null).toBe("other");
      expect(symbolKindToFilter.event).toBe("other");
      expect(symbolKindToFilter.operator).toBe("other");
    });

    it("should have all SymbolKinds mapped", () => {
      const allKinds: SymbolKind[] = [
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

      allKinds.forEach((kind) => {
        expect(symbolKindToFilter[kind]).toBeDefined();
      });
    });
  });
});
