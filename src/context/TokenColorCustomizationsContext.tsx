/**
 * TokenColorCustomizationsContext
 * 
 * Customizes syntax highlighting colors in the editor.
 * Follows the VS Code editor.tokenColorCustomizations pattern.
 * 
 * Settings format:
 * "editor.tokenColorCustomizations": {
 *   "[Theme Name]": {
 *     "comments": "#6a9955",
 *     "keywords": "#569cd6",
 *     "strings": "#ce9178",
 *     "functions": "#dcdcaa",
 *     "variables": "#9cdcfe",
 *     "textMateRules": [
 *       {
 *         "scope": ["comment", "punctuation.definition.comment"],
 *         "settings": { "foreground": "#6a9955", "fontStyle": "italic" }
 *       }
 *     ]
 *   }
 * }
 */

import {
  createContext,
  useContext,
  createEffect,
  onCleanup,
  ParentProps,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

/** Font style options for token rules */
export type TokenFontStyle = "italic" | "bold" | "underline" | "strikethrough" | "italic bold" | "bold italic" | "italic underline" | "";

/** Settings for a single token color rule */
export interface TokenColorSettings {
  /** Foreground color (text color) */
  foreground?: string;
  /** Background color */
  background?: string;
  /** Font style (italic, bold, underline, or combinations) */
  fontStyle?: TokenFontStyle;
}

/** TextMate-style scope rule */
export interface TextMateRule {
  /** Name/description of the rule */
  name?: string;
  /** Scope(s) this rule applies to */
  scope: string | string[];
  /** Color and style settings */
  settings: TokenColorSettings;
}

/** Simple token customizations (shortcuts) */
export interface SimpleTokenCustomizations {
  /** Comment color */
  comments?: string;
  /** Keyword color (if, else, for, etc.) */
  keywords?: string;
  /** String literal color */
  strings?: string;
  /** Numeric literal color */
  numbers?: string;
  /** Type/class name color */
  types?: string;
  /** Function name color */
  functions?: string;
  /** Variable name color */
  variables?: string;
  /** Regex pattern color */
  regexes?: string;
}

/** Complete token color customizations for a theme */
export interface TokenColorCustomization extends SimpleTokenCustomizations {
  /** TextMate scope rules for fine-grained control */
  textMateRules?: TextMateRule[];
}

/** Theme-specific token customizations - can include global simple tokens, textMateRules, and [ThemeName] entries */
export interface ThemeTokenCustomizations {
  [themeKey: string]: string | TokenColorCustomization | TextMateRule[];
}

/** Parsed token color customizations */
export interface ParsedTokenCustomizations {
  /** Global customizations (all themes) */
  global: TokenColorCustomization;
  /** Per-theme customizations */
  perTheme: Record<string, TokenColorCustomization>;
}

/** State for the token color customizations context */
export interface TokenColorCustomizationsState {
  /** Raw customizations from settings */
  raw: ThemeTokenCustomizations;
  /** Parsed customizations */
  parsed: ParsedTokenCustomizations;
  /** Currently applied theme name */
  appliedTheme: string | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
}

/** Context value interface */
export interface TokenColorCustomizationsContextValue {
  /** Current state */
  state: TokenColorCustomizationsState;
  /** Get customizations for current theme */
  customizations: () => ParsedTokenCustomizations;
  /** Get effective customization for a token type */
  getTokenCustomization: (tokenType: keyof SimpleTokenCustomizations, themeName: string) => string | undefined;
  /** Get effective textMateRules for a theme */
  getTextMateRules: (themeName: string) => TextMateRule[];
  /** Check if a token type has customization */
  hasCustomization: (tokenType: keyof SimpleTokenCustomizations, themeName: string) => boolean;
  /** Set a simple token customization globally */
  setGlobalTokenCustomization: (tokenType: keyof SimpleTokenCustomizations, value: string) => Promise<void>;
  /** Set a simple token customization for a theme */
  setThemeTokenCustomization: (themeName: string, tokenType: keyof SimpleTokenCustomizations, value: string) => Promise<void>;
  /** Remove a global token customization */
  removeGlobalTokenCustomization: (tokenType: keyof SimpleTokenCustomizations) => Promise<void>;
  /** Remove a theme-specific token customization */
  removeThemeTokenCustomization: (themeName: string, tokenType: keyof SimpleTokenCustomizations) => Promise<void>;
  /** Add a TextMate rule globally */
  addGlobalTextMateRule: (rule: TextMateRule) => Promise<void>;
  /** Add a TextMate rule for a theme */
  addThemeTextMateRule: (themeName: string, rule: TextMateRule) => Promise<void>;
  /** Remove a TextMate rule globally by index */
  removeGlobalTextMateRule: (index: number) => Promise<void>;
  /** Remove a TextMate rule for a theme by index */
  removeThemeTextMateRule: (themeName: string, index: number) => Promise<void>;
  /** Update a TextMate rule globally */
  updateGlobalTextMateRule: (index: number, rule: TextMateRule) => Promise<void>;
  /** Update a TextMate rule for a theme */
  updateThemeTextMateRule: (themeName: string, index: number, rule: TextMateRule) => Promise<void>;
  /** Reset all customizations */
  resetAllCustomizations: () => Promise<void>;
  /** Reset customizations for a specific theme */
  resetThemeCustomizations: (themeName: string) => Promise<void>;
  /** Apply customizations to Monaco editor */
  applyToMonaco: (monaco: typeof Monaco, themeName: string, baseTheme?: string) => void;
  /** Export customizations as JSON */
  exportCustomizations: () => string;
  /** Import customizations from JSON */
  importCustomizations: (json: string) => Promise<boolean>;
  /** Count of customizations */
  customizationCount: () => number;
  /** Count of global customizations */
  globalCustomizationCount: () => number;
  /** Count of theme-specific customizations */
  themeCustomizationCount: (themeName: string) => number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "orion-editor-token-color-customizations";

/** Default empty parsed customizations */
const DEFAULT_PARSED: ParsedTokenCustomizations = {
  global: {},
  perTheme: {},
};

/** Simple token types and their corresponding Monaco/TextMate scopes */
const TOKEN_SCOPE_MAP: Record<keyof SimpleTokenCustomizations, string[]> = {
  comments: ["comment", "punctuation.definition.comment", "comment.line", "comment.block"],
  keywords: ["keyword", "keyword.control", "keyword.operator", "storage.type", "storage.modifier"],
  strings: ["string", "string.quoted", "string.template", "string.regexp"],
  numbers: ["constant.numeric", "constant.numeric.integer", "constant.numeric.float", "constant.numeric.hex"],
  types: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
  functions: ["entity.name.function", "support.function", "meta.function-call"],
  variables: ["variable", "variable.other", "variable.parameter", "variable.language"],
  regexes: ["string.regexp", "constant.regexp"],
};

/** Token type metadata for UI */
export interface TokenTypeInfo {
  key: keyof SimpleTokenCustomizations;
  label: string;
  description: string;
  scopes: string[];
}

const TOKEN_TYPES: TokenTypeInfo[] = [
  { key: "comments", label: "Comments", description: "Code comments", scopes: TOKEN_SCOPE_MAP.comments },
  { key: "keywords", label: "Keywords", description: "Language keywords (if, else, for, etc.)", scopes: TOKEN_SCOPE_MAP.keywords },
  { key: "strings", label: "Strings", description: "String literals", scopes: TOKEN_SCOPE_MAP.strings },
  { key: "numbers", label: "Numbers", description: "Numeric literals", scopes: TOKEN_SCOPE_MAP.numbers },
  { key: "types", label: "Types", description: "Type and class names", scopes: TOKEN_SCOPE_MAP.types },
  { key: "functions", label: "Functions", description: "Function names", scopes: TOKEN_SCOPE_MAP.functions },
  { key: "variables", label: "Variables", description: "Variable names", scopes: TOKEN_SCOPE_MAP.variables },
  { key: "regexes", label: "Regular Expressions", description: "Regex patterns", scopes: TOKEN_SCOPE_MAP.regexes },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse raw token customizations into structured format
 */
function parseTokenCustomizations(raw: ThemeTokenCustomizations): ParsedTokenCustomizations {
  const result: ParsedTokenCustomizations = {
    global: {},
    perTheme: {},
  };

  for (const [key, value] of Object.entries(raw)) {
    // Theme-specific customization: "[Theme Name]"
    if (key.startsWith("[") && key.endsWith("]")) {
      const themeName = key.slice(1, -1);
      if (typeof value === "object" && value !== null) {
        result.perTheme[themeName] = value as TokenColorCustomization;
      }
    } else if (typeof value === "string") {
      // Global simple token customization
      (result.global as Record<string, unknown>)[key] = value;
    } else if (key === "textMateRules" && Array.isArray(value)) {
      // Global textMateRules
      result.global.textMateRules = value as TextMateRule[];
    }
  }

  return result;
}

/**
 * Validate hex color format
 */
function isValidColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

/**
 * Convert hex color to Monaco format (without #)
 */
function colorToMonaco(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

/**
 * Load customizations from storage
 */
function loadFromStorage(): ThemeTokenCustomizations {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return parsed as ThemeTokenCustomizations;
  } catch (e) {
    console.error("[TokenColorCustomizations] Failed to load from storage:", e);
    return {};
  }
}

/**
 * Save customizations to storage
 */
function saveToStorage(customizations: ThemeTokenCustomizations): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customizations));
  } catch (e) {
    console.error("[TokenColorCustomizations] Failed to save to storage:", e);
  }
}

/**
 * Convert simple token customizations to Monaco theme rules
 */
function simpleCustomizationsToRules(customization: TokenColorCustomization): Monaco.editor.ITokenThemeRule[] {
  const rules: Monaco.editor.ITokenThemeRule[] = [];

  // Add simple customizations
  const simpleKeys: (keyof SimpleTokenCustomizations)[] = [
    "comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"
  ];

  for (const key of simpleKeys) {
    const color = customization[key];
    if (color && isValidColor(color)) {
      const scopes = TOKEN_SCOPE_MAP[key];
      for (const scope of scopes) {
        rules.push({
          token: scope,
          foreground: colorToMonaco(color),
        });
      }
    }
  }

  return rules;
}

/**
 * Convert TextMate rules to Monaco theme rules
 */
function textMateRulesToMonacoRules(textMateRules: TextMateRule[]): Monaco.editor.ITokenThemeRule[] {
  const rules: Monaco.editor.ITokenThemeRule[] = [];

  for (const rule of textMateRules) {
    const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
    
    for (const scope of scopes) {
      const monacoRule: Monaco.editor.ITokenThemeRule = {
        token: scope,
      };

      if (rule.settings.foreground && isValidColor(rule.settings.foreground)) {
        monacoRule.foreground = colorToMonaco(rule.settings.foreground);
      }

      if (rule.settings.background && isValidColor(rule.settings.background)) {
        monacoRule.background = colorToMonaco(rule.settings.background);
      }

      if (rule.settings.fontStyle) {
        monacoRule.fontStyle = rule.settings.fontStyle;
      }

      rules.push(monacoRule);
    }
  }

  return rules;
}

// ============================================================================
// Context
// ============================================================================

const TokenColorCustomizationsContext = createContext<TokenColorCustomizationsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function TokenColorCustomizationsProvider(props: ParentProps) {
  const [state, setState] = createStore<TokenColorCustomizationsState>({
    raw: loadFromStorage(),
    parsed: DEFAULT_PARSED,
    appliedTheme: null,
    loading: false,
    error: null,
  });

  // Parse raw customizations on change
  createEffect(() => {
    const parsed = parseTokenCustomizations(state.raw);
    setState("parsed", reconcile(parsed));
  });

  // Accessors
  const customizations = () => state.parsed;

  const getTokenCustomization = (tokenType: keyof SimpleTokenCustomizations, themeName: string): string | undefined => {
    const { parsed } = state;
    
    // Check theme-specific first
    const themeCustomization = parsed.perTheme[themeName];
    if (themeCustomization?.[tokenType]) {
      return themeCustomization[tokenType];
    }
    
    // Fall back to global
    return parsed.global[tokenType];
  };

  const getTextMateRules = (themeName: string): TextMateRule[] => {
    const { parsed } = state;
    const globalRules = parsed.global.textMateRules || [];
    const themeRules = parsed.perTheme[themeName]?.textMateRules || [];
    
    // Theme-specific rules take precedence (come after global rules)
    return [...globalRules, ...themeRules];
  };

  const hasCustomization = (tokenType: keyof SimpleTokenCustomizations, themeName: string): boolean => {
    return getTokenCustomization(tokenType, themeName) !== undefined;
  };

  // Helper to save and update state
  const updateState = (newRaw: ThemeTokenCustomizations): void => {
    setState("raw", newRaw);
    saveToStorage(newRaw);
  };

  // Simple token customization mutations
  const setGlobalTokenCustomization = async (tokenType: keyof SimpleTokenCustomizations, value: string): Promise<void> => {
    if (!isValidColor(value)) {
      console.warn(`[TokenColorCustomizations] Invalid color format: ${value}`);
      return;
    }

    const newRaw = { ...state.raw, [tokenType]: value };
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:changed", {
      detail: { tokenType, value, scope: "global" },
    }));
  };

  const setThemeTokenCustomization = async (themeName: string, tokenType: keyof SimpleTokenCustomizations, value: string): Promise<void> => {
    if (!isValidColor(value)) {
      console.warn(`[TokenColorCustomizations] Invalid color format: ${value}`);
      return;
    }

    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as TokenColorCustomization) || {};
    const newTheme = { ...existingTheme, [tokenType]: value };
    const newRaw = { ...state.raw, [themeKey]: newTheme };
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:changed", {
      detail: { tokenType, value, scope: "theme", themeName },
    }));
  };

  const removeGlobalTokenCustomization = async (tokenType: keyof SimpleTokenCustomizations): Promise<void> => {
    const newRaw = { ...state.raw };
    delete newRaw[tokenType];
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:removed", {
      detail: { tokenType, scope: "global" },
    }));
  };

  const removeThemeTokenCustomization = async (themeName: string, tokenType: keyof SimpleTokenCustomizations): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as TokenColorCustomization) || {};
    
    const newTheme = { ...existingTheme };
    delete newTheme[tokenType];
    
    const newRaw = { ...state.raw };
    if (Object.keys(newTheme).length === 0 || (Object.keys(newTheme).length === 1 && newTheme.textMateRules?.length === 0)) {
      delete newRaw[themeKey];
    } else {
      newRaw[themeKey] = newTheme;
    }
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:removed", {
      detail: { tokenType, scope: "theme", themeName },
    }));
  };

  // TextMate rule mutations
  const addGlobalTextMateRule = async (rule: TextMateRule): Promise<void> => {
    const existingRules = (state.raw.textMateRules as TextMateRule[]) || [];
    const newRaw = { ...state.raw, textMateRules: [...existingRules, rule] };
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:textmate-added", {
      detail: { rule, scope: "global" },
    }));
  };

  const addThemeTextMateRule = async (themeName: string, rule: TextMateRule): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as TokenColorCustomization) || {};
    const existingRules = existingTheme.textMateRules || [];
    const newTheme = { ...existingTheme, textMateRules: [...existingRules, rule] };
    const newRaw = { ...state.raw, [themeKey]: newTheme };
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:textmate-added", {
      detail: { rule, scope: "theme", themeName },
    }));
  };

  const removeGlobalTextMateRule = async (index: number): Promise<void> => {
    const existingRules = (state.raw.textMateRules as TextMateRule[]) || [];
    if (index < 0 || index >= existingRules.length) return;
    
    const newRules = [...existingRules];
    newRules.splice(index, 1);
    
    const newRaw = { ...state.raw };
    if (newRules.length === 0) {
      delete newRaw.textMateRules;
    } else {
      newRaw.textMateRules = newRules;
    }
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:textmate-removed", {
      detail: { index, scope: "global" },
    }));
  };

  const removeThemeTextMateRule = async (themeName: string, index: number): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as TokenColorCustomization) || {};
    const existingRules = existingTheme.textMateRules || [];
    
    if (index < 0 || index >= existingRules.length) return;
    
    const newRules = [...existingRules];
    newRules.splice(index, 1);
    
    const newTheme = { ...existingTheme };
    if (newRules.length === 0) {
      delete newTheme.textMateRules;
    } else {
      newTheme.textMateRules = newRules;
    }
    
    const newRaw = { ...state.raw };
    if (Object.keys(newTheme).length === 0) {
      delete newRaw[themeKey];
    } else {
      newRaw[themeKey] = newTheme;
    }
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:textmate-removed", {
      detail: { index, scope: "theme", themeName },
    }));
  };

  const updateGlobalTextMateRule = async (index: number, rule: TextMateRule): Promise<void> => {
    const existingRules = (state.raw.textMateRules as TextMateRule[]) || [];
    if (index < 0 || index >= existingRules.length) return;
    
    const newRules = [...existingRules];
    newRules[index] = rule;
    
    const newRaw = { ...state.raw, textMateRules: newRules };
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:textmate-updated", {
      detail: { index, rule, scope: "global" },
    }));
  };

  const updateThemeTextMateRule = async (themeName: string, index: number, rule: TextMateRule): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as TokenColorCustomization) || {};
    const existingRules = existingTheme.textMateRules || [];
    
    if (index < 0 || index >= existingRules.length) return;
    
    const newRules = [...existingRules];
    newRules[index] = rule;
    
    const newTheme = { ...existingTheme, textMateRules: newRules };
    const newRaw = { ...state.raw, [themeKey]: newTheme };
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:textmate-updated", {
      detail: { index, rule, scope: "theme", themeName },
    }));
  };

  const resetAllCustomizations = async (): Promise<void> => {
    updateState({});
    
    window.dispatchEvent(new CustomEvent("token-color-customizations:reset"));
  };

  const resetThemeCustomizations = async (themeName: string): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const newRaw = { ...state.raw };
    delete newRaw[themeKey];
    
    updateState(newRaw);

    window.dispatchEvent(new CustomEvent("token-color-customizations:theme-reset", {
      detail: { themeName },
    }));
  };

  const applyToMonaco = (monaco: typeof Monaco, themeName: string, baseTheme: string = "vs-dark"): void => {
    const { parsed } = state;
    
    // Merge global and theme-specific customizations
    const effectiveCustomization: TokenColorCustomization = {
      ...parsed.global,
      ...(parsed.perTheme[themeName] || {}),
    };

    // Merge textMateRules
    const globalRules = parsed.global.textMateRules || [];
    const themeRules = parsed.perTheme[themeName]?.textMateRules || [];
    effectiveCustomization.textMateRules = [...globalRules, ...themeRules];

    // Convert to Monaco rules
    const simpleRules = simpleCustomizationsToRules(effectiveCustomization);
    const textMateRules = textMateRulesToMonacoRules(effectiveCustomization.textMateRules || []);
    const allRules = [...simpleRules, ...textMateRules];

    if (allRules.length === 0) {
      return;
    }

    // Create custom theme name
    const customThemeName = `${themeName}-custom`;

    // Define the custom theme
    try {
      monaco.editor.defineTheme(customThemeName, {
        base: baseTheme === "vs" ? "vs" : baseTheme === "hc-black" ? "hc-black" : "vs-dark",
        inherit: true,
        rules: allRules,
        colors: {},
      });

      // Apply the theme
      monaco.editor.setTheme(customThemeName);
      setState("appliedTheme", customThemeName);

      window.dispatchEvent(new CustomEvent("token-color-customizations:applied", {
        detail: { themeName: customThemeName, rulesCount: allRules.length },
      }));
    } catch (e) {
      console.error("[TokenColorCustomizations] Failed to apply to Monaco:", e);
      setState("error", e instanceof Error ? e.message : String(e));
    }
  };

  const exportCustomizations = (): string => {
    return JSON.stringify(state.raw, null, 2);
  };

  const importCustomizations = async (json: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(json);
      
      if (typeof parsed !== "object" || parsed === null) {
        console.error("[TokenColorCustomizations] Invalid import format");
        return false;
      }

      // Validate structure
      const validated: ThemeTokenCustomizations = {};
      
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith("[") && key.endsWith("]")) {
          // Theme-specific
          if (typeof value === "object" && value !== null) {
            const themeCustomization: TokenColorCustomization = {};
            const v = value as Record<string, unknown>;
            
            // Validate simple token colors
            for (const tokenKey of ["comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"]) {
              if (typeof v[tokenKey] === "string" && isValidColor(v[tokenKey] as string)) {
                (themeCustomization as Record<string, unknown>)[tokenKey] = v[tokenKey];
              }
            }
            
            // Validate textMateRules
            if (Array.isArray(v.textMateRules)) {
              themeCustomization.textMateRules = v.textMateRules.filter(rule => 
                typeof rule === "object" && 
                rule !== null && 
                (typeof rule.scope === "string" || Array.isArray(rule.scope)) &&
                typeof rule.settings === "object"
              ) as TextMateRule[];
            }
            
            if (Object.keys(themeCustomization).length > 0) {
              validated[key] = themeCustomization;
            }
          }
        } else if (typeof value === "string" && ["comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"].includes(key)) {
          // Global simple token
          if (isValidColor(value)) {
            validated[key] = value;
          }
        } else if (key === "textMateRules" && Array.isArray(value)) {
          // Global textMateRules
          validated.textMateRules = value.filter(rule => 
            typeof rule === "object" && 
            rule !== null && 
            (typeof rule.scope === "string" || Array.isArray(rule.scope)) &&
            typeof rule.settings === "object"
          ) as TextMateRule[];
        }
      }

      updateState(validated);

      window.dispatchEvent(new CustomEvent("token-color-customizations:imported"));
      return true;
    } catch (e) {
      console.error("[TokenColorCustomizations] Failed to import:", e);
      return false;
    }
  };

  const customizationCount = (): number => {
    const { parsed } = state;
    let count = 0;
    
    // Count global simple tokens
    for (const key of ["comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"]) {
      if ((parsed.global as Record<string, unknown>)[key]) count++;
    }
    
    // Count global textMateRules
    count += parsed.global.textMateRules?.length || 0;
    
    // Count per-theme
    for (const themeCustomization of Object.values(parsed.perTheme)) {
      for (const key of ["comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"]) {
        if ((themeCustomization as Record<string, unknown>)[key]) count++;
      }
      count += themeCustomization.textMateRules?.length || 0;
    }
    
    return count;
  };

  const globalCustomizationCount = (): number => {
    const { parsed } = state;
    let count = 0;
    
    for (const key of ["comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"]) {
      if ((parsed.global as Record<string, unknown>)[key]) count++;
    }
    
    count += parsed.global.textMateRules?.length || 0;
    return count;
  };

  const themeCustomizationCount = (themeName: string): number => {
    const themeCustomization = state.parsed.perTheme[themeName];
    if (!themeCustomization) return 0;
    
    let count = 0;
    for (const key of ["comments", "keywords", "strings", "numbers", "types", "functions", "variables", "regexes"]) {
      if ((themeCustomization as Record<string, unknown>)[key]) count++;
    }
    
    count += themeCustomization.textMateRules?.length || 0;
    return count;
  };

  // Listen for theme changes to auto-apply customizations
  createEffect(() => {
    const handleThemeChange = (e: CustomEvent<{ theme: string; monaco?: typeof Monaco }>) => {
      if (e.detail.monaco) {
        applyToMonaco(e.detail.monaco, e.detail.theme);
      }
    };

    window.addEventListener("theme:changed", handleThemeChange as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("theme:changed", handleThemeChange as EventListener);
    });
  });

  const value: TokenColorCustomizationsContextValue = {
    state,
    customizations,
    getTokenCustomization,
    getTextMateRules,
    hasCustomization,
    setGlobalTokenCustomization,
    setThemeTokenCustomization,
    removeGlobalTokenCustomization,
    removeThemeTokenCustomization,
    addGlobalTextMateRule,
    addThemeTextMateRule,
    removeGlobalTextMateRule,
    removeThemeTextMateRule,
    updateGlobalTextMateRule,
    updateThemeTextMateRule,
    resetAllCustomizations,
    resetThemeCustomizations,
    applyToMonaco,
    exportCustomizations,
    importCustomizations,
    customizationCount,
    globalCustomizationCount,
    themeCustomizationCount,
  };

  return (
    <TokenColorCustomizationsContext.Provider value={value}>
      {props.children}
    </TokenColorCustomizationsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTokenColorCustomizations(): TokenColorCustomizationsContextValue {
  const ctx = useContext(TokenColorCustomizationsContext);
  if (!ctx) {
    throw new Error("useTokenColorCustomizations must be used within TokenColorCustomizationsProvider");
  }
  return ctx;
}

// ============================================================================
// Exports
// ============================================================================

export { TOKEN_TYPES, TOKEN_SCOPE_MAP };
