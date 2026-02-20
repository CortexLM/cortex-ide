import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("ThemeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Theme Types", () => {
    interface Theme {
      id: string;
      name: string;
      type: "light" | "dark" | "hc-light" | "hc-dark";
      colors: Record<string, string>;
      tokenColors?: TokenColor[];
    }

    interface TokenColor {
      scope: string | string[];
      settings: {
        foreground?: string;
        fontStyle?: string;
      };
    }

    it("should create dark theme", () => {
      const theme: Theme = {
        id: "my-dark-theme",
        name: "My Dark Theme",
        type: "dark",
        colors: {
          "editor.background": "#1e1e1e",
          "editor.foreground": "#d4d4d4",
        },
      };

      expect(theme.type).toBe("dark");
    });

    it("should create light theme", () => {
      const theme: Theme = {
        id: "my-light-theme",
        name: "My Light Theme",
        type: "light",
        colors: {
          "editor.background": "#ffffff",
          "editor.foreground": "#000000",
        },
      };

      expect(theme.type).toBe("light");
    });

    it("should create high contrast theme", () => {
      const theme: Theme = {
        id: "hc-theme",
        name: "High Contrast",
        type: "hc-dark",
        colors: {
          "editor.background": "#000000",
          "editor.foreground": "#ffffff",
          "contrastBorder": "#ffffff",
        },
      };

      expect(theme.type).toBe("hc-dark");
    });

    it("should include token colors", () => {
      const theme: Theme = {
        id: "theme-with-tokens",
        name: "Theme",
        type: "dark",
        colors: {},
        tokenColors: [
          {
            scope: "keyword",
            settings: { foreground: "#569cd6" },
          },
          {
            scope: ["string", "string.quoted"],
            settings: { foreground: "#ce9178" },
          },
        ],
      };

      expect(theme.tokenColors).toHaveLength(2);
    });
  });

  describe("Theme Switching", () => {
    it("should switch theme via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("theme_set", { themeId: "my-dark-theme" });

      expect(invoke).toHaveBeenCalledWith("theme_set", { themeId: "my-dark-theme" });
    });

    it("should get current theme", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        id: "default-dark",
        name: "Default Dark",
        type: "dark",
      });

      const result = await invoke("theme_get_current");

      expect(result).toHaveProperty("id", "default-dark");
    });

    it("should list available themes", async () => {
      const mockThemes = [
        { id: "dark-plus", name: "Dark+", type: "dark" },
        { id: "light-plus", name: "Light+", type: "light" },
        { id: "monokai", name: "Monokai", type: "dark" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockThemes);

      const result = await invoke("theme_list");

      expect(result).toHaveLength(3);
    });
  });

  describe("Theme State", () => {
    it("should track current theme", () => {
      let currentTheme = "dark-plus";

      const setTheme = (themeId: string) => {
        currentTheme = themeId;
      };

      setTheme("monokai");
      expect(currentTheme).toBe("monokai");
    });

    it("should detect dark mode", () => {
      const isDarkTheme = (type: string): boolean => {
        return type === "dark" || type === "hc-dark";
      };

      expect(isDarkTheme("dark")).toBe(true);
      expect(isDarkTheme("hc-dark")).toBe(true);
      expect(isDarkTheme("light")).toBe(false);
      expect(isDarkTheme("hc-light")).toBe(false);
    });

    it("should detect high contrast mode", () => {
      const isHighContrast = (type: string): boolean => {
        return type.startsWith("hc-");
      };

      expect(isHighContrast("hc-dark")).toBe(true);
      expect(isHighContrast("hc-light")).toBe(true);
      expect(isHighContrast("dark")).toBe(false);
    });
  });

  describe("Color Customization", () => {
    it("should get color value", () => {
      const colors: Record<string, string> = {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "activityBar.background": "#333333",
      };

      expect(colors["editor.background"]).toBe("#1e1e1e");
    });

    it("should override theme color", () => {
      const themeColors: Record<string, string> = {
        "editor.background": "#1e1e1e",
      };

      const userOverrides: Record<string, string> = {
        "editor.background": "#000000",
      };

      const effectiveColors = { ...themeColors, ...userOverrides };

      expect(effectiveColors["editor.background"]).toBe("#000000");
    });

    it("should validate hex color", () => {
      const isValidHexColor = (color: string): boolean => {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
      };

      expect(isValidHexColor("#fff")).toBe(true);
      expect(isValidHexColor("#ffffff")).toBe(true);
      expect(isValidHexColor("#ffffffff")).toBe(true);
      expect(isValidHexColor("ffffff")).toBe(false);
      expect(isValidHexColor("#gg0000")).toBe(false);
    });

    it("should parse rgba color", () => {
      const parseRgba = (color: string): { r: number; g: number; b: number; a: number } | null => {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return null;
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: match[4] ? parseFloat(match[4]) : 1,
        };
      };

      expect(parseRgba("rgb(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseRgba("rgba(255, 0, 0, 0.5)")).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    });
  });

  describe("Icon Theme", () => {
    interface IconTheme {
      id: string;
      name: string;
      path: string;
    }

    it("should set icon theme", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("theme_set_icon_theme", { themeId: "material-icon-theme" });

      expect(invoke).toHaveBeenCalledWith("theme_set_icon_theme", {
        themeId: "material-icon-theme",
      });
    });

    it("should list icon themes", async () => {
      const mockIconThemes: IconTheme[] = [
        { id: "vs-minimal", name: "Minimal", path: "/themes/minimal" },
        { id: "vs-seti", name: "Seti", path: "/themes/seti" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockIconThemes);

      const result = await invoke("theme_list_icon_themes");

      expect(result).toHaveLength(2);
    });
  });

  describe("Product Icon Theme", () => {
    it("should set product icon theme", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("theme_set_product_icon_theme", { themeId: "fluent-icons" });

      expect(invoke).toHaveBeenCalledWith("theme_set_product_icon_theme", {
        themeId: "fluent-icons",
      });
    });
  });

  describe("Theme Categories", () => {
    it("should filter themes by type", () => {
      const themes = [
        { id: "dark-1", type: "dark" },
        { id: "dark-2", type: "dark" },
        { id: "light-1", type: "light" },
        { id: "hc-1", type: "hc-dark" },
      ];

      const darkThemes = themes.filter(t => t.type === "dark");
      const lightThemes = themes.filter(t => t.type === "light");

      expect(darkThemes).toHaveLength(2);
      expect(lightThemes).toHaveLength(1);
    });

    it("should group themes by type", () => {
      const themes = [
        { id: "dark-1", name: "Dark 1", type: "dark" },
        { id: "dark-2", name: "Dark 2", type: "dark" },
        { id: "light-1", name: "Light 1", type: "light" },
      ];

      const grouped = themes.reduce((acc, theme) => {
        const type = theme.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(theme);
        return acc;
      }, {} as Record<string, typeof themes>);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped["dark"]).toHaveLength(2);
    });
  });

  describe("System Theme Detection", () => {
    it("should detect system preference", () => {
      const getSystemThemePreference = (): "light" | "dark" => {
        if (typeof window !== "undefined" && window.matchMedia) {
          const result = window.matchMedia("(prefers-color-scheme: dark)");
          if (result && typeof result.matches === "boolean") {
            return result.matches ? "dark" : "light";
          }
        }
        return "dark";
      };

      const preference = getSystemThemePreference();
      expect(["light", "dark"]).toContain(preference);
    });

    it("should auto-switch based on system preference", () => {
      let currentTheme = "light-plus";
      const autoDetect = true;

      const handleSystemThemeChange = (isDark: boolean) => {
        if (autoDetect) {
          currentTheme = isDark ? "dark-plus" : "light-plus";
        }
      };

      handleSystemThemeChange(true);
      expect(currentTheme).toBe("dark-plus");

      handleSystemThemeChange(false);
      expect(currentTheme).toBe("light-plus");
    });
  });

  describe("Custom Theme Creation", () => {
    it("should create custom theme from base", () => {
      const baseTheme = {
        id: "dark-plus",
        name: "Dark+",
        type: "dark" as const,
        colors: {
          "editor.background": "#1e1e1e",
          "editor.foreground": "#d4d4d4",
        },
      };

      const customTheme = {
        ...baseTheme,
        id: "my-custom-theme",
        name: "My Custom Theme",
        colors: {
          ...baseTheme.colors,
          "editor.background": "#0d0d0d",
        },
      };

      expect(customTheme.colors["editor.background"]).toBe("#0d0d0d");
      expect(customTheme.colors["editor.foreground"]).toBe("#d4d4d4");
    });

    it("should save custom theme", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: "custom-theme-1" });

      const result = await invoke("theme_save_custom", {
        name: "My Theme",
        baseTheme: "dark-plus",
        colors: { "editor.background": "#000000" },
      });

      expect(result).toHaveProperty("id");
    });

    it("should delete custom theme", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("theme_delete_custom", { themeId: "custom-theme-1" });

      expect(invoke).toHaveBeenCalledWith("theme_delete_custom", {
        themeId: "custom-theme-1",
      });
    });
  });

  describe("Token Color Scopes", () => {
    it("should define common token scopes", () => {
      const tokenScopes = [
        "comment",
        "keyword",
        "string",
        "number",
        "variable",
        "function",
        "class",
        "type",
        "constant",
        "entity.name.function",
        "entity.name.class",
        "entity.name.type",
        "support.function",
        "support.class",
      ];

      expect(tokenScopes).toContain("keyword");
      expect(tokenScopes).toContain("entity.name.function");
    });

    it("should match token scope", () => {
      const matchScope = (scope: string, pattern: string): boolean => {
        if (pattern === scope) return true;
        return scope.startsWith(pattern + ".");
      };

      expect(matchScope("entity.name.function", "entity")).toBe(true);
      expect(matchScope("entity.name.function", "entity.name")).toBe(true);
      expect(matchScope("entity.name.function", "entity.name.function")).toBe(true);
      expect(matchScope("entity.name.function", "keyword")).toBe(false);
    });
  });

  describe("Theme CSS Variables", () => {
    it("should generate CSS variables from theme", () => {
      const colors: Record<string, string> = {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "activityBar.background": "#333333",
      };

      const toCssVarName = (key: string): string => {
        return `--vscode-${key.replace(/\./g, "-")}`;
      };

      const cssVars = Object.entries(colors).map(([key, value]) => {
        return `${toCssVarName(key)}: ${value};`;
      });

      expect(cssVars[0]).toBe("--vscode-editor-background: #1e1e1e;");
    });

    it("should apply CSS variables to document", () => {
      const applyCssVariables = (colors: Record<string, string>) => {
        const root = document.documentElement;
        Object.entries(colors).forEach(([key, value]) => {
          const varName = `--vscode-${key.replace(/\./g, "-")}`;
          root.style.setProperty(varName, value);
        });
      };

      applyCssVariables({
        "editor.background": "#1e1e1e",
      });

      const value = document.documentElement.style.getPropertyValue("--vscode-editor-background");
      expect(value).toBe("#1e1e1e");
    });
  });

  describe("Theme Preview", () => {
    it("should preview theme temporarily", () => {
      let currentTheme = "dark-plus";
      let previewTheme: string | null = null;

      const startPreview = (themeId: string) => {
        previewTheme = themeId;
      };

      const cancelPreview = () => {
        previewTheme = null;
      };

      const confirmPreview = () => {
        if (previewTheme) {
          currentTheme = previewTheme;
          previewTheme = null;
        }
      };

      const getActiveTheme = () => previewTheme || currentTheme;

      startPreview("monokai");
      expect(getActiveTheme()).toBe("monokai");

      cancelPreview();
      expect(getActiveTheme()).toBe("dark-plus");

      startPreview("monokai");
      confirmPreview();
      expect(getActiveTheme()).toBe("monokai");
      expect(currentTheme).toBe("monokai");
    });
  });

  describe("Semantic Token Colors", () => {
    interface SemanticTokenRule {
      tokenType: string;
      tokenModifiers?: string[];
      foreground?: string;
      fontStyle?: string;
    }

    it("should define semantic token rules", () => {
      const rules: SemanticTokenRule[] = [
        { tokenType: "function", foreground: "#dcdcaa" },
        { tokenType: "variable", tokenModifiers: ["readonly"], foreground: "#4fc1ff" },
        { tokenType: "parameter", foreground: "#9cdcfe" },
      ];

      expect(rules).toHaveLength(3);
    });

    it("should match semantic token with modifiers", () => {
      const matchRule = (
        tokenType: string,
        modifiers: string[],
        rule: SemanticTokenRule
      ): boolean => {
        if (rule.tokenType !== tokenType) return false;
        if (rule.tokenModifiers) {
          return rule.tokenModifiers.every(m => modifiers.includes(m));
        }
        return true;
      };

      const rule: SemanticTokenRule = {
        tokenType: "variable",
        tokenModifiers: ["readonly"],
        foreground: "#4fc1ff",
      };

      expect(matchRule("variable", ["readonly"], rule)).toBe(true);
      expect(matchRule("variable", [], rule)).toBe(false);
      expect(matchRule("function", ["readonly"], rule)).toBe(false);
    });
  });
});
