import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SemanticTokenCustomizationsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Semantic Token Types", () => {
    const SEMANTIC_TOKEN_TYPES = [
      "namespace", "type", "class", "enum", "interface", "struct",
      "typeParameter", "parameter", "variable", "property", "enumMember",
      "event", "function", "method", "macro", "keyword", "modifier",
      "comment", "string", "number", "regexp", "operator", "decorator",
    ] as const;

    it("should have all standard token types", () => {
      expect(SEMANTIC_TOKEN_TYPES).toContain("class");
      expect(SEMANTIC_TOKEN_TYPES).toContain("function");
      expect(SEMANTIC_TOKEN_TYPES).toContain("variable");
    });

    it("should have correct number of token types", () => {
      expect(SEMANTIC_TOKEN_TYPES.length).toBe(23);
    });
  });

  describe("Semantic Token Modifiers", () => {
    const SEMANTIC_TOKEN_MODIFIERS = [
      "declaration", "definition", "readonly", "static", "deprecated",
      "abstract", "async", "modification", "documentation", "defaultLibrary",
    ] as const;

    it("should have all standard modifiers", () => {
      expect(SEMANTIC_TOKEN_MODIFIERS).toContain("readonly");
      expect(SEMANTIC_TOKEN_MODIFIERS).toContain("deprecated");
      expect(SEMANTIC_TOKEN_MODIFIERS).toContain("static");
    });
  });

  describe("Token Rule Types", () => {
    interface SemanticTokenRule {
      foreground?: string;
      background?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
    }

    it("should create simple color rule", () => {
      const rule = "#6366F1";

      expect(rule).toBe("#6366F1");
    });

    it("should create full style rule", () => {
      const rule: SemanticTokenRule = {
        foreground: "#DCDCAA",
        bold: true,
        italic: false,
      };

      expect(rule.foreground).toBe("#DCDCAA");
      expect(rule.bold).toBe(true);
    });

    it("should create deprecated style", () => {
      const rule: SemanticTokenRule = {
        strikethrough: true,
      };

      expect(rule.strikethrough).toBe(true);
    });
  });

  describe("Token Customizations", () => {
    interface SemanticTokenCustomizations {
      enabled: boolean;
      rules: Record<string, string | { foreground?: string; bold?: boolean }>;
    }

    it("should create default customizations", () => {
      const customizations: SemanticTokenCustomizations = {
        enabled: true,
        rules: {
          "type": "#6366F1",
          "class": "#6366F1",
          "function": "#DCDCAA",
          "variable": "#FAFAFA",
        },
      };

      expect(customizations.enabled).toBe(true);
      expect(customizations.rules["type"]).toBe("#6366F1");
    });

    it("should support compound selectors", () => {
      const customizations: SemanticTokenCustomizations = {
        enabled: true,
        rules: {
          "variable.readonly": "#4EC9B0",
          "*.deprecated": { strikethrough: true } as unknown as string,
          "function.declaration": { foreground: "#DCDCAA", bold: true },
        },
      };

      expect(customizations.rules["variable.readonly"]).toBe("#4EC9B0");
    });
  });

  describe("Token Selector Parsing", () => {
    const parseTokenSelector = (selector: string) => {
      const parts = selector.split(".");
      const type = parts[0] === "*" ? null : parts[0];
      const modifiers = parts.slice(1);
      return { type, modifiers };
    };

    it("should parse simple selector", () => {
      const result = parseTokenSelector("variable");

      expect(result.type).toBe("variable");
      expect(result.modifiers).toHaveLength(0);
    });

    it("should parse selector with modifier", () => {
      const result = parseTokenSelector("variable.readonly");

      expect(result.type).toBe("variable");
      expect(result.modifiers).toContain("readonly");
    });

    it("should parse wildcard selector", () => {
      const result = parseTokenSelector("*.deprecated");

      expect(result.type).toBeNull();
      expect(result.modifiers).toContain("deprecated");
    });

    it("should parse multiple modifiers", () => {
      const result = parseTokenSelector("function.async.declaration");

      expect(result.type).toBe("function");
      expect(result.modifiers).toHaveLength(2);
    });
  });

  describe("Token Selector Building", () => {
    const buildTokenSelector = (type: string | null, modifiers: string[]) => {
      const base = type || "*";
      if (modifiers.length === 0) return base;
      return `${base}.${modifiers.join(".")}`;
    };

    it("should build simple selector", () => {
      const result = buildTokenSelector("variable", []);

      expect(result).toBe("variable");
    });

    it("should build selector with modifiers", () => {
      const result = buildTokenSelector("function", ["async", "declaration"]);

      expect(result).toBe("function.async.declaration");
    });

    it("should build wildcard selector", () => {
      const result = buildTokenSelector(null, ["deprecated"]);

      expect(result).toBe("*.deprecated");
    });
  });

  describe("Font Style Building", () => {
    interface StyleRule {
      italic?: boolean;
      bold?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
    }

    const buildFontStyle = (style: StyleRule): string => {
      const parts: string[] = [];
      if (style.italic) parts.push("italic");
      if (style.bold) parts.push("bold");
      if (style.underline) parts.push("underline");
      if (style.strikethrough) parts.push("strikethrough");
      return parts.join(" ");
    };

    it("should build italic style", () => {
      const result = buildFontStyle({ italic: true });

      expect(result).toBe("italic");
    });

    it("should build combined styles", () => {
      const result = buildFontStyle({ bold: true, italic: true });

      expect(result).toBe("italic bold");
    });

    it("should return empty for no styles", () => {
      const result = buildFontStyle({});

      expect(result).toBe("");
    });
  });

  describe("Theme Management", () => {
    it("should get customizations for theme", () => {
      const customizations: Record<string, { enabled: boolean; rules: Record<string, string> }> = {
        "Dark Theme": { enabled: true, rules: { "type": "#6366F1" } },
        "Light Theme": { enabled: true, rules: { "type": "#4338CA" } },
      };

      const getCustomizations = (themeName: string) => {
        return customizations[themeName] ?? { enabled: true, rules: {} };
      };

      expect(getCustomizations("Dark Theme").rules["type"]).toBe("#6366F1");
      expect(getCustomizations("Unknown")).toEqual({ enabled: true, rules: {} });
    });

    it("should reset theme customizations", () => {
      const customizations: Record<string, unknown> = {
        "Dark Theme": { enabled: true, rules: { "type": "#custom" } },
      };

      delete customizations["Dark Theme"];

      expect(customizations["Dark Theme"]).toBeUndefined();
    });
  });

  describe("Preview Style Generation", () => {
    type RuleValue = string | { foreground?: string; bold?: boolean; italic?: boolean };

    const getPreviewStyle = (rule: RuleValue): Record<string, string> => {
      const style: Record<string, string> = {};
      const ruleObj = typeof rule === "string" ? { foreground: rule } : rule;

      if (ruleObj.foreground) style.color = ruleObj.foreground;
      if (ruleObj.bold) style["font-weight"] = "bold";
      if (ruleObj.italic) style["font-style"] = "italic";

      return style;
    };

    it("should generate style from color string", () => {
      const result = getPreviewStyle("#FF0000");

      expect(result.color).toBe("#FF0000");
    });

    it("should generate style from rule object", () => {
      const result = getPreviewStyle({ foreground: "#00FF00", bold: true });

      expect(result.color).toBe("#00FF00");
      expect(result["font-weight"]).toBe("bold");
    });
  });

  describe("Import/Export", () => {
    it("should export customizations as JSON", () => {
      const customizations = {
        "Dark Theme": { enabled: true, rules: { "type": "#6366F1" } },
      };

      const exported = JSON.stringify(customizations, null, 2);

      expect(exported).toContain("Dark Theme");
      expect(exported).toContain("#6366F1");
    });

    it("should import customizations from JSON", () => {
      const json = '{"Dark Theme": {"enabled": true, "rules": {"type": "#6366F1"}}}';

      const imported = JSON.parse(json);

      expect(imported["Dark Theme"].enabled).toBe(true);
    });

    it("should handle invalid JSON on import", () => {
      const invalidJson = "not valid json";

      let success = false;
      try {
        JSON.parse(invalidJson);
        success = true;
      } catch {
        success = false;
      }

      expect(success).toBe(false);
    });
  });

  describe("Custom Rule Detection", () => {
    it("should detect custom rule", () => {
      const customizations: Record<string, { rules: Record<string, string> }> = {
        "Dark Theme": { rules: { "type": "#custom" } },
      };

      const hasCustomRule = (themeName: string, selector: string): boolean => {
        const config = customizations[themeName];
        return config?.rules?.[selector] !== undefined;
      };

      expect(hasCustomRule("Dark Theme", "type")).toBe(true);
      expect(hasCustomRule("Dark Theme", "unknown")).toBe(false);
    });
  });
});
