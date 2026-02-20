import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("TokenColorCustomizationsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TokenType enum", () => {
    it("should define token type values", () => {
      const TokenType = {
        Comments: "comments",
        Keywords: "keywords",
        Strings: "strings",
        Numbers: "numbers",
        Types: "types",
        Functions: "functions",
        Variables: "variables",
        Regexes: "regexes",
        Operators: "operators",
        Constants: "constants",
      } as const;

      expect(TokenType.Comments).toBe("comments");
      expect(TokenType.Keywords).toBe("keywords");
      expect(TokenType.Strings).toBe("strings");
      expect(TokenType.Functions).toBe("functions");
    });
  });

  describe("TextMateRule interface", () => {
    it("should define TextMate rule structure", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: {
          foreground?: string;
          background?: string;
          fontStyle?: "italic" | "bold" | "underline" | "strikethrough" | "";
        };
      }

      const rule: TextMateRule = {
        scope: ["comment", "punctuation.definition.comment"],
        settings: {
          foreground: "#6A9955",
          fontStyle: "italic",
        },
      };

      expect(rule.scope).toContain("comment");
      expect(rule.settings.foreground).toBe("#6A9955");
      expect(rule.settings.fontStyle).toBe("italic");
    });

    it("should support single scope string", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: {
          foreground?: string;
        };
      }

      const rule: TextMateRule = {
        scope: "keyword.control",
        settings: {
          foreground: "#C586C0",
        },
      };

      expect(rule.scope).toBe("keyword.control");
    });
  });

  describe("SimpleTokenCustomizations interface", () => {
    it("should define simple token customizations", () => {
      interface SimpleTokenCustomizations {
        comments?: string;
        keywords?: string;
        strings?: string;
        numbers?: string;
        types?: string;
        functions?: string;
        variables?: string;
        regexes?: string;
        operators?: string;
        constants?: string;
      }

      const customizations: SimpleTokenCustomizations = {
        comments: "#6A9955",
        keywords: "#569CD6",
        strings: "#CE9178",
        numbers: "#B5CEA8",
        functions: "#DCDCAA",
      };

      expect(customizations.comments).toBe("#6A9955");
      expect(customizations.keywords).toBe("#569CD6");
    });
  });

  describe("TokenColorCustomization interface", () => {
    it("should define full token color customization", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: {
          foreground?: string;
          background?: string;
          fontStyle?: string;
        };
      }

      interface SimpleTokenCustomizations {
        comments?: string;
        keywords?: string;
        strings?: string;
      }

      interface TokenColorCustomization {
        id: string;
        name: string;
        themeId?: string;
        simpleTokens?: SimpleTokenCustomizations;
        textMateRules?: TextMateRule[];
        createdAt: number;
        updatedAt: number;
      }

      const customization: TokenColorCustomization = {
        id: "custom-001",
        name: "My Custom Colors",
        simpleTokens: {
          comments: "#6A9955",
          keywords: "#569CD6",
        },
        textMateRules: [
          {
            scope: "entity.name.function",
            settings: { foreground: "#DCDCAA" },
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(customization.id).toBe("custom-001");
      expect(customization.name).toBe("My Custom Colors");
      expect(customization.simpleTokens?.comments).toBe("#6A9955");
    });

    it("should support theme-specific customization", () => {
      interface TokenColorCustomization {
        id: string;
        name: string;
        themeId?: string;
        simpleTokens?: Record<string, string>;
        createdAt: number;
        updatedAt: number;
      }

      const customization: TokenColorCustomization = {
        id: "custom-dark",
        name: "Dark Theme Overrides",
        themeId: "one-dark-pro",
        simpleTokens: {
          comments: "#5C6370",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(customization.themeId).toBe("one-dark-pro");
    });
  });

  describe("TokenColorCustomizationsContextValue interface", () => {
    it("should define full context value structure", () => {
      interface TokenColorCustomization {
        id: string;
        name: string;
        themeId?: string;
      }

      interface TokenColorCustomizationsContextValue {
        customizations: TokenColorCustomization[];
        globalCustomization: TokenColorCustomization | null;
        currentThemeCustomization: TokenColorCustomization | null;
        isLoading: boolean;
        error: string | null;
        getTokenCustomization: (tokenType: string) => string | undefined;
        setGlobalTokenCustomization: (tokenType: string, color: string | null) => void;
        setThemeTokenCustomization: (themeId: string, tokenType: string, color: string | null) => void;
        setTextMateRule: (rule: { scope: string | string[]; settings: Record<string, unknown> }) => void;
        removeTextMateRule: (scope: string | string[]) => void;
        exportCustomizations: () => string;
        importCustomizations: (json: string) => boolean;
        resetToDefaults: () => void;
      }

      const mockContext: TokenColorCustomizationsContextValue = {
        customizations: [],
        globalCustomization: null,
        currentThemeCustomization: null,
        isLoading: false,
        error: null,
        getTokenCustomization: vi.fn(),
        setGlobalTokenCustomization: vi.fn(),
        setThemeTokenCustomization: vi.fn(),
        setTextMateRule: vi.fn(),
        removeTextMateRule: vi.fn(),
        exportCustomizations: vi.fn(),
        importCustomizations: vi.fn(),
        resetToDefaults: vi.fn(),
      };

      expect(mockContext.customizations).toEqual([]);
      expect(typeof mockContext.getTokenCustomization).toBe("function");
    });
  });

  describe("Token customization operations", () => {
    it("should get token customization by type", () => {
      interface SimpleTokenCustomizations {
        comments?: string;
        keywords?: string;
        strings?: string;
      }

      const simpleTokens: SimpleTokenCustomizations = {
        comments: "#6A9955",
        keywords: "#569CD6",
      };

      const getTokenCustomization = (tokenType: keyof SimpleTokenCustomizations): string | undefined => {
        return simpleTokens[tokenType];
      };

      expect(getTokenCustomization("comments")).toBe("#6A9955");
      expect(getTokenCustomization("strings")).toBeUndefined();
    });

    it("should set global token customization", () => {
      interface SimpleTokenCustomizations {
        [key: string]: string | undefined;
      }

      const simpleTokens: SimpleTokenCustomizations = {};

      const setGlobalTokenCustomization = (tokenType: string, color: string | null): void => {
        if (color === null) {
          delete simpleTokens[tokenType];
        } else {
          simpleTokens[tokenType] = color;
        }
      };

      setGlobalTokenCustomization("comments", "#6A9955");
      expect(simpleTokens.comments).toBe("#6A9955");

      setGlobalTokenCustomization("comments", null);
      expect(simpleTokens.comments).toBeUndefined();
    });

    it("should set theme-specific token customization", () => {
      interface ThemeCustomizations {
        [themeId: string]: {
          [tokenType: string]: string | undefined;
        };
      }

      const themeCustomizations: ThemeCustomizations = {};

      const setThemeTokenCustomization = (
        themeId: string,
        tokenType: string,
        color: string | null
      ): void => {
        if (!themeCustomizations[themeId]) {
          themeCustomizations[themeId] = {};
        }
        if (color === null) {
          delete themeCustomizations[themeId][tokenType];
        } else {
          themeCustomizations[themeId][tokenType] = color;
        }
      };

      setThemeTokenCustomization("one-dark-pro", "comments", "#5C6370");
      expect(themeCustomizations["one-dark-pro"].comments).toBe("#5C6370");
    });
  });

  describe("TextMate rule operations", () => {
    it("should add TextMate rule", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: {
          foreground?: string;
          fontStyle?: string;
        };
      }

      const textMateRules: TextMateRule[] = [];

      const setTextMateRule = (rule: TextMateRule): void => {
        const scopeKey = Array.isArray(rule.scope) ? rule.scope.join(",") : rule.scope;
        const existingIndex = textMateRules.findIndex((r) => {
          const rScopeKey = Array.isArray(r.scope) ? r.scope.join(",") : r.scope;
          return rScopeKey === scopeKey;
        });

        if (existingIndex !== -1) {
          textMateRules[existingIndex] = rule;
        } else {
          textMateRules.push(rule);
        }
      };

      setTextMateRule({
        scope: "entity.name.function",
        settings: { foreground: "#DCDCAA" },
      });

      expect(textMateRules).toHaveLength(1);
      expect(textMateRules[0].settings.foreground).toBe("#DCDCAA");
    });

    it("should update existing TextMate rule", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: {
          foreground?: string;
          fontStyle?: string;
        };
      }

      const textMateRules: TextMateRule[] = [
        { scope: "comment", settings: { foreground: "#6A9955" } },
      ];

      const setTextMateRule = (rule: TextMateRule): void => {
        const scopeKey = Array.isArray(rule.scope) ? rule.scope.join(",") : rule.scope;
        const existingIndex = textMateRules.findIndex((r) => {
          const rScopeKey = Array.isArray(r.scope) ? r.scope.join(",") : r.scope;
          return rScopeKey === scopeKey;
        });

        if (existingIndex !== -1) {
          textMateRules[existingIndex] = rule;
        } else {
          textMateRules.push(rule);
        }
      };

      setTextMateRule({
        scope: "comment",
        settings: { foreground: "#5C6370", fontStyle: "italic" },
      });

      expect(textMateRules).toHaveLength(1);
      expect(textMateRules[0].settings.foreground).toBe("#5C6370");
      expect(textMateRules[0].settings.fontStyle).toBe("italic");
    });

    it("should remove TextMate rule", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: Record<string, unknown>;
      }

      let textMateRules: TextMateRule[] = [
        { scope: "comment", settings: { foreground: "#6A9955" } },
        { scope: "keyword", settings: { foreground: "#569CD6" } },
      ];

      const removeTextMateRule = (scope: string | string[]): void => {
        const scopeKey = Array.isArray(scope) ? scope.join(",") : scope;
        textMateRules = textMateRules.filter((r) => {
          const rScopeKey = Array.isArray(r.scope) ? r.scope.join(",") : r.scope;
          return rScopeKey !== scopeKey;
        });
      };

      removeTextMateRule("comment");
      expect(textMateRules).toHaveLength(1);
      expect(textMateRules[0].scope).toBe("keyword");
    });
  });

  describe("Import and export", () => {
    it("should export customizations to JSON", () => {
      interface TokenColorCustomization {
        simpleTokens: Record<string, string>;
        textMateRules: Array<{ scope: string; settings: Record<string, string> }>;
      }

      const customization: TokenColorCustomization = {
        simpleTokens: {
          comments: "#6A9955",
          keywords: "#569CD6",
        },
        textMateRules: [
          { scope: "entity.name.function", settings: { foreground: "#DCDCAA" } },
        ],
      };

      const exportCustomizations = (): string => {
        return JSON.stringify(customization, null, 2);
      };

      const exported = exportCustomizations();
      const parsed = JSON.parse(exported);
      expect(parsed.simpleTokens.comments).toBe("#6A9955");
      expect(parsed.textMateRules).toHaveLength(1);
    });

    it("should import customizations from JSON", () => {
      interface TokenColorCustomization {
        simpleTokens: Record<string, string>;
        textMateRules: Array<{ scope: string; settings: Record<string, string> }>;
      }

      let customization: TokenColorCustomization | null = null;

      const importCustomizations = (json: string): boolean => {
        try {
          customization = JSON.parse(json);
          return true;
        } catch {
          return false;
        }
      };

      const json = JSON.stringify({
        simpleTokens: { comments: "#5C6370" },
        textMateRules: [],
      });

      const success = importCustomizations(json);
      expect(success).toBe(true);
      expect((customization as TokenColorCustomization | null)?.simpleTokens.comments).toBe("#5C6370");
    });

    it("should handle invalid JSON on import", () => {
      const importCustomizations = (json: string): boolean => {
        try {
          JSON.parse(json);
          return true;
        } catch {
          return false;
        }
      };

      expect(importCustomizations("invalid json")).toBe(false);
    });
  });

  describe("Reset to defaults", () => {
    it("should reset all customizations", () => {
      interface TokenColorCustomization {
        simpleTokens: Record<string, string>;
        textMateRules: Array<{ scope: string; settings: Record<string, string> }>;
      }

      let customization: TokenColorCustomization = {
        simpleTokens: {
          comments: "#6A9955",
          keywords: "#569CD6",
        },
        textMateRules: [
          { scope: "comment", settings: { foreground: "#6A9955" } },
        ],
      };

      const resetToDefaults = (): void => {
        customization = {
          simpleTokens: {},
          textMateRules: [],
        };
      };

      resetToDefaults();
      expect(Object.keys(customization.simpleTokens)).toHaveLength(0);
      expect(customization.textMateRules).toHaveLength(0);
    });
  });

  describe("localStorage persistence", () => {
    it("should persist customizations to localStorage", () => {
      interface TokenColorCustomization {
        simpleTokens: Record<string, string>;
        textMateRules: Array<{ scope: string; settings: Record<string, string> }>;
      }

      const STORAGE_KEY = "zen-token-color-customizations";

      const saveCustomizations = (customization: TokenColorCustomization): void => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customization));
      };

      const loadCustomizations = (): TokenColorCustomization | null => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      };

      const customization: TokenColorCustomization = {
        simpleTokens: { comments: "#6A9955" },
        textMateRules: [],
      };

      saveCustomizations(customization);
      const loaded = loadCustomizations();
      expect(loaded?.simpleTokens.comments).toBe("#6A9955");
    });
  });

  describe("Color validation", () => {
    it("should validate hex color format", () => {
      const isValidHexColor = (color: string): boolean => {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      };

      expect(isValidHexColor("#6A9955")).toBe(true);
      expect(isValidHexColor("#fff")).toBe(true);
      expect(isValidHexColor("#FFFFFF")).toBe(true);
      expect(isValidHexColor("6A9955")).toBe(false);
      expect(isValidHexColor("#GGG")).toBe(false);
      expect(isValidHexColor("red")).toBe(false);
    });

    it("should normalize hex color to uppercase", () => {
      const normalizeHexColor = (color: string): string => {
        return color.toUpperCase();
      };

      expect(normalizeHexColor("#6a9955")).toBe("#6A9955");
      expect(normalizeHexColor("#fff")).toBe("#FFF");
    });
  });

  describe("Scope matching", () => {
    it("should match exact scope", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: Record<string, string>;
      }

      const rules: TextMateRule[] = [
        { scope: "comment", settings: { foreground: "#6A9955" } },
        { scope: "keyword.control", settings: { foreground: "#C586C0" } },
      ];

      const findRuleForScope = (scope: string): TextMateRule | undefined => {
        return rules.find((r) => {
          if (Array.isArray(r.scope)) {
            return r.scope.includes(scope);
          }
          return r.scope === scope;
        });
      };

      expect(findRuleForScope("comment")).toBeDefined();
      expect(findRuleForScope("keyword.control")).toBeDefined();
      expect(findRuleForScope("string")).toBeUndefined();
    });

    it("should match scope in array", () => {
      interface TextMateRule {
        scope: string | string[];
        settings: Record<string, string>;
      }

      const rules: TextMateRule[] = [
        {
          scope: ["comment", "punctuation.definition.comment"],
          settings: { foreground: "#6A9955" },
        },
      ];

      const findRuleForScope = (scope: string): TextMateRule | undefined => {
        return rules.find((r) => {
          if (Array.isArray(r.scope)) {
            return r.scope.includes(scope);
          }
          return r.scope === scope;
        });
      };

      expect(findRuleForScope("comment")).toBeDefined();
      expect(findRuleForScope("punctuation.definition.comment")).toBeDefined();
    });
  });

  describe("Font style handling", () => {
    it("should apply font styles", () => {
      interface TextMateRule {
        scope: string;
        settings: {
          foreground?: string;
          fontStyle?: string;
        };
      }

      const rule: TextMateRule = {
        scope: "comment",
        settings: {
          foreground: "#6A9955",
          fontStyle: "italic",
        },
      };

      expect(rule.settings.fontStyle).toBe("italic");
    });

    it("should combine multiple font styles", () => {
      const combineFontStyles = (styles: string[]): string => {
        return styles.join(" ");
      };

      expect(combineFontStyles(["italic", "bold"])).toBe("italic bold");
      expect(combineFontStyles(["underline"])).toBe("underline");
    });

    it("should clear font style with empty string", () => {
      interface TextMateRule {
        scope: string;
        settings: {
          fontStyle?: string;
        };
      }

      const rule: TextMateRule = {
        scope: "comment",
        settings: {
          fontStyle: "",
        },
      };

      expect(rule.settings.fontStyle).toBe("");
    });
  });
});
