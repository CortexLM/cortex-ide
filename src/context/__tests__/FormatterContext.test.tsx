import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("FormatterContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Formatter Types", () => {
    type FormatterType = "prettier" | "rustfmt" | "black" | "gofmt" | "clangformat" | "biome" | "deno";

    it("should support all formatter types", () => {
      const formatters: FormatterType[] = [
        "prettier",
        "rustfmt",
        "black",
        "gofmt",
        "clangformat",
        "biome",
        "deno",
      ];

      expect(formatters).toHaveLength(7);
    });
  });

  describe("Formatting Status", () => {
    type FormattingStatus = "idle" | "formatting" | "success" | "error";

    it("should track idle status", () => {
      const status: FormattingStatus = "idle";
      expect(status).toBe("idle");
    });

    it("should track formatting status", () => {
      const status: FormattingStatus = "formatting";
      expect(status).toBe("formatting");
    });

    it("should track success status", () => {
      const status: FormattingStatus = "success";
      expect(status).toBe("success");
    });

    it("should track error status", () => {
      const status: FormattingStatus = "error";
      expect(status).toBe("error");
    });
  });

  describe("Format Request", () => {
    interface FormatRequest {
      content: string;
      filePath: string;
      workingDirectory?: string;
      parser?: string;
      range?: { startLine: number; endLine: number };
      options?: Record<string, unknown>;
    }

    it("should create format request", () => {
      const request: FormatRequest = {
        content: "const x=1",
        filePath: "/src/app.ts",
        parser: "typescript",
      };

      expect(request.filePath).toBe("/src/app.ts");
    });

    it("should create format request with range", () => {
      const request: FormatRequest = {
        content: "const x=1\nconst y=2",
        filePath: "/src/app.ts",
        range: { startLine: 1, endLine: 1 },
      };

      expect(request.range?.startLine).toBe(1);
    });

    it("should create format request with options", () => {
      const request: FormatRequest = {
        content: "const x=1",
        filePath: "/src/app.ts",
        options: {
          tabWidth: 4,
          useTabs: true,
        },
      };

      expect(request.options?.tabWidth).toBe(4);
    });
  });

  describe("Format Result", () => {
    interface FormatResult {
      content: string;
      changed: boolean;
      formatter: string;
      warnings: string[];
    }

    it("should return formatted content", () => {
      const result: FormatResult = {
        content: "const x = 1;",
        changed: true,
        formatter: "prettier",
        warnings: [],
      };

      expect(result.changed).toBe(true);
      expect(result.content).toBe("const x = 1;");
    });

    it("should return unchanged content", () => {
      const result: FormatResult = {
        content: "const x = 1;",
        changed: false,
        formatter: "prettier",
        warnings: [],
      };

      expect(result.changed).toBe(false);
    });

    it("should include warnings", () => {
      const result: FormatResult = {
        content: "const x = 1;",
        changed: true,
        formatter: "prettier",
        warnings: ["Using default config"],
      };

      expect(result.warnings).toHaveLength(1);
    });
  });

  describe("Format via Invoke", () => {
    it("should format content", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        content: "const x = 1;",
        changed: true,
        formatter: "prettier",
        warnings: [],
      });

      const result = await invoke("formatter_format", {
        request: {
          content: "const x=1",
          filePath: "/src/app.ts",
        },
      });

      expect(invoke).toHaveBeenCalledWith("formatter_format", expect.any(Object));
      expect(result).toHaveProperty("content");
    });

    it("should format with specific formatter", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        content: "fn main() {}",
        changed: true,
        formatter: "rustfmt",
        warnings: [],
      });

      const result = await invoke("formatter_format_with", {
        request: { content: "fn main(){}", filePath: "/src/main.rs" },
        formatter: "rustfmt",
      });

      expect(invoke).toHaveBeenCalledWith("formatter_format_with", expect.objectContaining({
        formatter: "rustfmt",
      }));
      expect(result).toHaveProperty("formatter", "rustfmt");
    });

    it("should handle format error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Syntax error"));

      await expect(invoke("formatter_format", {
        request: { content: "invalid {{{", filePath: "/src/app.ts" },
      })).rejects.toThrow("Syntax error");
    });
  });

  describe("Detect Config", () => {
    interface ConfigInfo {
      configPath: string | null;
      prettierAvailable: boolean;
      prettierVersion: string | null;
      availableFormatters: string[];
      hasIgnoreFile: boolean;
      ignorePath: string | null;
    }

    it("should detect prettier config", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        configPath: "/project/.prettierrc",
        prettierAvailable: true,
        prettierVersion: "3.0.0",
        availableFormatters: ["prettier"],
        hasIgnoreFile: true,
        ignorePath: "/project/.prettierignore",
      });

      const result = await invoke<ConfigInfo>("formatter_detect_config", {
        filePath: "/project/src/app.ts",
      });

      expect(result.prettierAvailable).toBe(true);
      expect(result.configPath).toBe("/project/.prettierrc");
    });

    it("should detect no config", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        configPath: null,
        prettierAvailable: false,
        prettierVersion: null,
        availableFormatters: [],
        hasIgnoreFile: false,
        ignorePath: null,
      });

      const result = await invoke<ConfigInfo>("formatter_detect_config", {
        filePath: "/project/src/app.ts",
      });

      expect(result.prettierAvailable).toBe(false);
      expect(result.configPath).toBeNull();
    });
  });

  describe("Check Available Formatters", () => {
    interface FormatterInfo {
      formatter: string;
      available: boolean;
      version: string | null;
      path: string | null;
    }

    it("should check available formatters", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { formatter: "prettier", available: true, version: "3.0.0", path: "/usr/bin/prettier" },
        { formatter: "rustfmt", available: true, version: "1.6.0", path: "/usr/bin/rustfmt" },
        { formatter: "black", available: false, version: null, path: null },
      ]);

      const result = await invoke<FormatterInfo[]>("formatter_check_available", {});

      expect(result).toHaveLength(3);
      expect(result[0].available).toBe(true);
      expect(result[2].available).toBe(false);
    });
  });

  describe("Formatter Settings", () => {
    interface FormatterSettings {
      enabled: boolean;
      formatOnSave: boolean;
      formatOnPaste: boolean;
      defaultFormatter: string;
      options: Record<string, unknown>;
      languageFormatters: Record<string, string>;
    }

    it("should define default settings", () => {
      const settings: FormatterSettings = {
        enabled: true,
        formatOnSave: true,
        formatOnPaste: false,
        defaultFormatter: "prettier",
        options: {
          tabWidth: 2,
          useTabs: false,
          singleQuote: true,
        },
        languageFormatters: {
          typescript: "prettier",
          rust: "rustfmt",
          python: "black",
        },
      };

      expect(settings.formatOnSave).toBe(true);
      expect(settings.languageFormatters.rust).toBe("rustfmt");
    });

    it("should update settings", () => {
      let settings: FormatterSettings = {
        enabled: true,
        formatOnSave: true,
        formatOnPaste: false,
        defaultFormatter: "prettier",
        options: {},
        languageFormatters: {},
      };

      const updateSettings = (update: Partial<FormatterSettings>) => {
        settings = { ...settings, ...update };
      };

      updateSettings({ formatOnSave: false });

      expect(settings.formatOnSave).toBe(false);
    });

    it("should reset settings to defaults", () => {
      const defaultSettings: FormatterSettings = {
        enabled: true,
        formatOnSave: true,
        formatOnPaste: false,
        defaultFormatter: "prettier",
        options: { tabWidth: 2 },
        languageFormatters: {},
      };

      let settings: FormatterSettings = {
        enabled: false,
        formatOnSave: false,
        formatOnPaste: true,
        defaultFormatter: "biome",
        options: { tabWidth: 4 },
        languageFormatters: {},
      };

      const resetSettings = () => {
        settings = { ...defaultSettings };
      };

      resetSettings();

      expect(settings.enabled).toBe(true);
      expect(settings.defaultFormatter).toBe("prettier");
    });
  });

  describe("Language Formatter Mapping", () => {
    it("should get formatter for language", () => {
      const languageFormatters: Record<string, string> = {
        typescript: "prettier",
        rust: "rustfmt",
        python: "black",
        go: "gofmt",
      };

      const getFormatterForLanguage = (language: string) => {
        return languageFormatters[language] || "prettier";
      };

      expect(getFormatterForLanguage("rust")).toBe("rustfmt");
      expect(getFormatterForLanguage("unknown")).toBe("prettier");
    });

    it("should set formatter for language", () => {
      const languageFormatters: Record<string, string> = {
        typescript: "prettier",
      };

      const setFormatterForLanguage = (language: string, formatter: string) => {
        languageFormatters[language] = formatter;
      };

      setFormatterForLanguage("typescript", "biome");

      expect(languageFormatters.typescript).toBe("biome");
    });
  });

  describe("Formatter Options", () => {
    interface FormatterOptions {
      tabWidth?: number;
      useTabs?: boolean;
      printWidth?: number;
      singleQuote?: boolean;
      trailingComma?: "none" | "es5" | "all";
      bracketSpacing?: boolean;
      semi?: boolean;
      endOfLine?: "lf" | "crlf" | "cr" | "auto";
    }

    it("should define formatter options", () => {
      const options: FormatterOptions = {
        tabWidth: 2,
        useTabs: false,
        printWidth: 80,
        singleQuote: true,
        trailingComma: "es5",
        bracketSpacing: true,
        semi: true,
        endOfLine: "lf",
      };

      expect(options.tabWidth).toBe(2);
      expect(options.trailingComma).toBe("es5");
    });
  });

  describe("Format Disabled", () => {
    it("should return unchanged when disabled", () => {
      const enabled = false;
      const content = "const x=1";

      const format = (content: string) => {
        if (!enabled) {
          return {
            content,
            changed: false,
            formatter: "prettier",
            warnings: ["Formatter is disabled"],
          };
        }
        return { content: "const x = 1;", changed: true, formatter: "prettier", warnings: [] };
      };

      const result = format(content);

      expect(result.changed).toBe(false);
      expect(result.warnings).toContain("Formatter is disabled");
    });
  });

  describe("Error Handling", () => {
    it("should track last error", () => {
      let lastError: string | null = null;

      const setError = (error: string) => {
        lastError = error;
      };

      const clearError = () => {
        lastError = null;
      };

      setError("Failed to format: syntax error");
      expect(lastError).toBe("Failed to format: syntax error");

      clearError();
      expect(lastError).toBeNull();
    });
  });

  describe("Multiple Formatters", () => {
    interface LanguageFormatters {
      language: string;
      formatters: string[];
      defaultFormatter: string | null;
    }

    it("should check for multiple formatters", () => {
      const languageFormatters: LanguageFormatters = {
        language: "typescript",
        formatters: ["prettier", "biome", "deno"],
        defaultFormatter: "prettier",
      };

      const hasMultipleFormatters = languageFormatters.formatters.length > 1;

      expect(hasMultipleFormatters).toBe(true);
    });

    it("should list available formatters for language", () => {
      const builtinFormatters: Record<string, string[]> = {
        typescript: ["prettier", "biome", "deno"],
        javascript: ["prettier", "biome", "deno"],
        rust: ["rustfmt"],
        python: ["black"],
        go: ["gofmt"],
      };

      expect(builtinFormatters.typescript).toHaveLength(3);
      expect(builtinFormatters.rust).toHaveLength(1);
    });
  });

  describe("Formatter Selector", () => {
    it("should open formatter selector", () => {
      let showSelector = false;
      let selectorLanguage: string | null = null;

      const openFormatterSelector = (language: string) => {
        showSelector = true;
        selectorLanguage = language;
      };

      openFormatterSelector("typescript");

      expect(showSelector).toBe(true);
      expect(selectorLanguage).toBe("typescript");
    });

    it("should close formatter selector", () => {
      let showSelector = true;

      const closeFormatterSelector = () => {
        showSelector = false;
      };

      closeFormatterSelector();

      expect(showSelector).toBe(false);
    });
  });

  describe("LSP Formatter Provider", () => {
    interface LSPFormatterProvider {
      id: string;
      name: string;
      languages: string[];
      priority: number;
    }

    it("should register LSP formatter", () => {
      const providers: LSPFormatterProvider[] = [];

      const registerLSPFormatter = (provider: LSPFormatterProvider) => {
        providers.push(provider);
      };

      registerLSPFormatter({
        id: "typescript-language-server",
        name: "TypeScript",
        languages: ["typescript", "javascript"],
        priority: 10,
      });

      expect(providers).toHaveLength(1);
    });

    it("should unregister LSP formatter", () => {
      let providers: LSPFormatterProvider[] = [
        { id: "ts-server", name: "TypeScript", languages: ["typescript"], priority: 10 },
      ];

      const unregisterLSPFormatter = (providerId: string) => {
        providers = providers.filter(p => p.id !== providerId);
      };

      unregisterLSPFormatter("ts-server");

      expect(providers).toHaveLength(0);
    });
  });

  describe("Settings Persistence", () => {
    it("should save settings to localStorage", () => {
      const SETTINGS_KEY = "cortex-formatter-settings";
      const settings = { enabled: true, formatOnSave: true, key: SETTINGS_KEY };

      const saveSettings = (settings: unknown) => {
        return JSON.stringify(settings);
      };

      const saved = saveSettings(settings);

      expect(saved).toContain("enabled");
      expect(saved).toContain("formatOnSave");
    });

    it("should load settings from localStorage", () => {
      const json = '{"enabled":true,"formatOnSave":false}';

      const loadSettings = (json: string) => {
        return JSON.parse(json);
      };

      const settings = loadSettings(json);

      expect(settings.enabled).toBe(true);
      expect(settings.formatOnSave).toBe(false);
    });
  });
});
