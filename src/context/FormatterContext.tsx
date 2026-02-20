/**
 * FormatterContext - Code formatting state management
 *
 * Provides formatting capabilities via Prettier and other formatters:
 * - Format on save
 * - Format selection
 * - Format document
 * - Detect prettier config
 * - Support multiple formatters per language
 */

import { createContext, useContext, ParentProps, createEffect, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

/** Supported formatter types */
export type FormatterType = "prettier" | "rustfmt" | "black" | "gofmt" | "clangformat" | "biome" | "deno";

/** Format range for partial formatting */
export interface FormatRange {
  startLine: number;
  endLine: number;
}

/** Formatter options */
export interface FormatterOptions {
  tabWidth?: number;
  useTabs?: boolean;
  printWidth?: number;
  singleQuote?: boolean;
  trailingComma?: "none" | "es5" | "all";
  bracketSpacing?: boolean;
  semi?: boolean;
  jsxSingleQuote?: boolean;
  arrowParens?: "always" | "avoid";
  proseWrap?: "always" | "never" | "preserve";
  endOfLine?: "lf" | "crlf" | "cr" | "auto";
}

/** Format request */
export interface FormatRequest {
  content: string;
  filePath: string;
  workingDirectory?: string;
  parser?: string;
  range?: FormatRange;
  options?: FormatterOptions;
}

/** Format result */
export interface FormatResult {
  content: string;
  changed: boolean;
  formatter: FormatterType;
  warnings: string[];
}

/** Configuration info for a file */
export interface ConfigInfo {
  configPath: string | null;
  prettierAvailable: boolean;
  prettierVersion: string | null;
  availableFormatters: FormatterType[];
  hasIgnoreFile: boolean;
  ignorePath: string | null;
}

/** Information about formatter availability */
export interface FormatterInfo {
  formatter: FormatterType;
  available: boolean;
  version: string | null;
  path: string | null;
}

/** LSP Formatter provider info */
export interface LSPFormatterProvider {
  id: string;
  name: string;
  languages: string[];
  priority: number;
}

/** Available formatters for a language */
export interface LanguageFormatters {
  language: string;
  formatters: FormatterType[];
  lspFormatters: LSPFormatterProvider[];
  defaultFormatter: FormatterType | string | null;
}

/** Formatter settings stored in the app */
export interface FormatterSettings {
  enabled: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  defaultFormatter: FormatterType;
  options: FormatterOptions;
  languageFormatters: Record<string, FormatterType | string>;
}

/** Formatting status */
export type FormattingStatus = "idle" | "formatting" | "success" | "error";

/** Formatter state */
interface FormatterState {
  settings: FormatterSettings;
  status: FormattingStatus;
  lastError: string | null;
  availableFormatters: FormatterInfo[];
  currentConfig: ConfigInfo | null;
  isCheckingFormatters: boolean;
  /** Map of language ID to available formatters for that language */
  languageFormattersMap: Map<string, LanguageFormatters>;
  /** Registered LSP formatter providers */
  lspFormatterProviders: LSPFormatterProvider[];
  /** Whether the formatter selector should be shown */
  showFormatterSelector: boolean;
  /** Current language for formatter selection */
  selectorLanguage: string | null;
}

/** Formatter context value */
export interface FormatterContextValue {
  state: FormatterState;
  /** Format content with auto-detected formatter */
  format: (request: FormatRequest) => Promise<FormatResult>;
  /** Format content with specific formatter */
  formatWith: (request: FormatRequest, formatter: FormatterType) => Promise<FormatResult>;
  /** Detect formatter config for a file */
  detectConfig: (filePath: string, workingDirectory?: string) => Promise<ConfigInfo>;
  /** Check which formatters are available */
  checkAvailable: (workingDirectory?: string) => Promise<FormatterInfo[]>;
  /** Get the parser for a file extension */
  getParser: (filePath: string) => Promise<string | null>;
  /** Update formatter settings */
  updateSettings: (settings: Partial<FormatterSettings>) => void;
  /** Reset settings to defaults */
  resetSettings: () => void;
  /** Get formatter for a language */
  getFormatterForLanguage: (language: string) => FormatterType | string;
  /** Set formatter for a language (also serves as setDefaultFormatter) */
  setFormatterForLanguage: (language: string, formatter: FormatterType | string) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Get all available formatters for a language */
  getFormatters: (language: string) => LanguageFormatters;
  /** Get all formatters map */
  getFormattersMap: () => Map<string, LanguageFormatters>;
  /** Register an LSP formatter provider */
  registerLSPFormatter: (provider: LSPFormatterProvider) => void;
  /** Unregister an LSP formatter provider */
  unregisterLSPFormatter: (providerId: string) => void;
  /** Open formatter selector for a language */
  openFormatterSelector: (language: string) => void;
  /** Close formatter selector */
  closeFormatterSelector: () => void;
  /** Set default formatter for a language (alias for setFormatterForLanguage) */
  setDefaultFormatter: (language: string, formatter: FormatterType | string) => void;
  /** Check if multiple formatters are available for a language */
  hasMultipleFormatters: (language: string) => boolean;
}

const FormatterContext = createContext<FormatterContextValue>();

const SETTINGS_KEY = "cortex-formatter-settings";

const defaultSettings: FormatterSettings = {
  enabled: true,
  formatOnSave: true,
  formatOnPaste: false,
  defaultFormatter: "prettier",
  options: {
    tabWidth: 2,
    useTabs: false,
    printWidth: 80,
    singleQuote: true,
    trailingComma: "es5",
    bracketSpacing: true,
    semi: true,
    endOfLine: "lf",
  },
  languageFormatters: {
    typescript: "prettier",
    javascript: "prettier",
    typescriptreact: "prettier",
    javascriptreact: "prettier",
    json: "prettier",
    html: "prettier",
    css: "prettier",
    scss: "prettier",
    less: "prettier",
    markdown: "prettier",
    yaml: "prettier",
    rust: "rustfmt",
    python: "black",
    go: "gofmt",
  },
};

/** Load settings from localStorage */
function loadSettings(): FormatterSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load formatter settings:", e);
  }
  return defaultSettings;
}

/** Save settings to localStorage */
function saveSettings(settings: FormatterSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save formatter settings:", e);
  }
}

/** Built-in formatters for each language */
const BUILTIN_LANGUAGE_FORMATTERS: Record<string, FormatterType[]> = {
  typescript: ["prettier", "biome", "deno"],
  javascript: ["prettier", "biome", "deno"],
  typescriptreact: ["prettier", "biome", "deno"],
  javascriptreact: ["prettier", "biome", "deno"],
  json: ["prettier", "biome", "deno"],
  html: ["prettier"],
  css: ["prettier", "biome"],
  scss: ["prettier"],
  less: ["prettier"],
  markdown: ["prettier", "deno"],
  yaml: ["prettier"],
  rust: ["rustfmt"],
  python: ["black"],
  go: ["gofmt"],
  c: ["clangformat"],
  cpp: ["clangformat"],
};

export function FormatterProvider(props: ParentProps) {
  const [state, setState] = createStore<FormatterState>({
    settings: loadSettings(),
    status: "idle",
    lastError: null,
    availableFormatters: [],
    currentConfig: null,
    isCheckingFormatters: false,
    languageFormattersMap: new Map<string, LanguageFormatters>(),
    lspFormatterProviders: [],
    showFormatterSelector: false,
    selectorLanguage: null,
  });

  // Save settings when they change
  createEffect(() => {
    saveSettings(state.settings);
  });

  // Check available formatters on mount
  onMount(async () => {
    try {
      await checkAvailable();
    } catch (e) {
      console.warn("Failed to check available formatters:", e);
    }
  });

  const format = async (request: FormatRequest): Promise<FormatResult> => {
    if (!state.settings.enabled) {
      return {
        content: request.content,
        changed: false,
        formatter: "prettier",
        warnings: ["Formatter is disabled"],
      };
    }

    setState("status", "formatting");
    setState("lastError", null);

    try {
      // Build the request with current settings options merged
      const formattedRequest = {
        content: request.content,
        filePath: request.filePath,
        workingDirectory: request.workingDirectory,
        parser: request.parser,
        range: request.range,
        options: { ...state.settings.options, ...request.options },
      };

      const result = await invoke<FormatResult>("formatter_format", {
        request: formattedRequest,
      });

      setState("status", result.changed ? "success" : "idle");
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("status", "error");
      setState("lastError", errorMessage);
      throw new Error(errorMessage);
    }
  };

  const formatWith = async (request: FormatRequest, formatter: FormatterType): Promise<FormatResult> => {
    if (!state.settings.enabled) {
      return {
        content: request.content,
        changed: false,
        formatter,
        warnings: ["Formatter is disabled"],
      };
    }

    setState("status", "formatting");
    setState("lastError", null);

    try {
      const formattedRequest = {
        content: request.content,
        filePath: request.filePath,
        workingDirectory: request.workingDirectory,
        parser: request.parser,
        range: request.range,
        options: { ...state.settings.options, ...request.options },
      };

      const result = await invoke<FormatResult>("formatter_format_with", {
        request: formattedRequest,
        formatter,
      });

      setState("status", result.changed ? "success" : "idle");
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("status", "error");
      setState("lastError", errorMessage);
      throw new Error(errorMessage);
    }
  };

  const detectConfig = async (filePath: string, workingDirectory?: string): Promise<ConfigInfo> => {
    try {
      const result = await invoke<ConfigInfo>("formatter_detect_config", {
        filePath,
        workingDirectory,
      });
      setState("currentConfig", result);
      return result;
    } catch (e) {
      console.error("Failed to detect formatter config:", e);
      throw e;
    }
  };

  const checkAvailable = async (workingDirectory?: string): Promise<FormatterInfo[]> => {
    setState("isCheckingFormatters", true);
    try {
      const result = await invoke<FormatterInfo[]>("formatter_check_available", {
        workingDirectory,
      });
      setState("availableFormatters", result);
      return result;
    } catch (e) {
      console.error("Failed to check available formatters:", e);
      throw e;
    } finally {
      setState("isCheckingFormatters", false);
    }
  };

  const getParser = async (filePath: string): Promise<string | null> => {
    try {
      return await invoke<string | null>("formatter_get_parser", { filePath });
    } catch (e) {
      console.error("Failed to get parser:", e);
      return null;
    }
  };

  const updateSettings = (settings: Partial<FormatterSettings>): void => {
    setState(
      produce((draft) => {
        if (settings.enabled !== undefined) draft.settings.enabled = settings.enabled;
        if (settings.formatOnSave !== undefined) draft.settings.formatOnSave = settings.formatOnSave;
        if (settings.formatOnPaste !== undefined) draft.settings.formatOnPaste = settings.formatOnPaste;
        if (settings.defaultFormatter !== undefined) draft.settings.defaultFormatter = settings.defaultFormatter;
        if (settings.options !== undefined) {
          draft.settings.options = { ...draft.settings.options, ...settings.options };
        }
        if (settings.languageFormatters !== undefined) {
          draft.settings.languageFormatters = { ...draft.settings.languageFormatters, ...settings.languageFormatters };
        }
      })
    );
  };

  const resetSettings = (): void => {
    setState("settings", defaultSettings);
  };

  const getFormatterForLanguage = (language: string): FormatterType | string => {
    return state.settings.languageFormatters[language] || state.settings.defaultFormatter;
  };

  const setFormatterForLanguage = (language: string, formatter: FormatterType | string): void => {
    setState(
      produce((draft) => {
        draft.settings.languageFormatters[language] = formatter;
      })
    );
  };

  const clearError = (): void => {
    setState("lastError", null);
    setState("status", "idle");
  };

  const buildLanguageFormatters = (language: string): LanguageFormatters => {
    const builtinFormatters = BUILTIN_LANGUAGE_FORMATTERS[language] || [];
    const availableBuiltin = builtinFormatters.filter((formatter) =>
      state.availableFormatters.some((f) => f.formatter === formatter && f.available)
    );
    const lspFormatters = state.lspFormatterProviders.filter((provider) =>
      provider.languages.includes(language)
    );
    const defaultFormatter = state.settings.languageFormatters[language] || null;

    return {
      language,
      formatters: availableBuiltin.length > 0 ? availableBuiltin : builtinFormatters,
      lspFormatters,
      defaultFormatter,
    };
  };

  const getFormatters = (language: string): LanguageFormatters => {
    const cached = state.languageFormattersMap.get(language);
    if (cached) {
      return cached;
    }
    const formatters = buildLanguageFormatters(language);
    setState("languageFormattersMap", (map) => {
      const newMap = new Map(map);
      newMap.set(language, formatters);
      return newMap;
    });
    return formatters;
  };

  const getFormattersMap = (): Map<string, LanguageFormatters> => {
    return state.languageFormattersMap;
  };

  const registerLSPFormatter = (provider: LSPFormatterProvider): void => {
    setState("lspFormatterProviders", (providers) => {
      const existingIndex = providers.findIndex((p) => p.id === provider.id);
      if (existingIndex >= 0) {
        const updated = [...providers];
        updated[existingIndex] = provider;
        return updated;
      }
      return [...providers, provider];
    });
    setState("languageFormattersMap", new Map());
  };

  const unregisterLSPFormatter = (providerId: string): void => {
    setState("lspFormatterProviders", (providers) =>
      providers.filter((p) => p.id !== providerId)
    );
    setState("languageFormattersMap", new Map());
  };

  const openFormatterSelector = (language: string): void => {
    setState("selectorLanguage", language);
    setState("showFormatterSelector", true);
  };

  const closeFormatterSelector = (): void => {
    setState("showFormatterSelector", false);
    setState("selectorLanguage", null);
  };

  const setDefaultFormatter = (language: string, formatter: FormatterType | string): void => {
    setFormatterForLanguage(language, formatter);
    setState("languageFormattersMap", (map) => {
      const newMap = new Map(map);
      const existing = newMap.get(language);
      if (existing) {
        newMap.set(language, { ...existing, defaultFormatter: formatter });
      }
      return newMap;
    });
    window.dispatchEvent(
      new CustomEvent("formatter:default-changed", {
        detail: { language, formatter },
      })
    );
  };

  const hasMultipleFormatters = (language: string): boolean => {
    const formatters = getFormatters(language);
    const totalCount = formatters.formatters.length + formatters.lspFormatters.length;
    return totalCount > 1;
  };

  return (
    <FormatterContext.Provider
      value={{
        state,
        format,
        formatWith,
        detectConfig,
        checkAvailable,
        getParser,
        updateSettings,
        resetSettings,
        getFormatterForLanguage,
        setFormatterForLanguage,
        clearError,
        getFormatters,
        getFormattersMap,
        registerLSPFormatter,
        unregisterLSPFormatter,
        openFormatterSelector,
        closeFormatterSelector,
        setDefaultFormatter,
        hasMultipleFormatters,
      }}
    >
      {props.children}
    </FormatterContext.Provider>
  );
}

export function useFormatter(): FormatterContextValue {
  const context = useContext(FormatterContext);
  if (!context) {
    throw new Error("useFormatter must be used within FormatterProvider");
  }
  return context;
}
