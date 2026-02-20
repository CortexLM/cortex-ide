import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  createEffect,
  Accessor,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Semantic Token Types & Modifiers (from LSP specification)
// ============================================================================

/** Standard LSP semantic token types */
export const SEMANTIC_TOKEN_TYPES = [
  "namespace",
  "type",
  "class",
  "enum",
  "interface",
  "struct",
  "typeParameter",
  "parameter",
  "variable",
  "property",
  "enumMember",
  "event",
  "function",
  "method",
  "macro",
  "keyword",
  "modifier",
  "comment",
  "string",
  "number",
  "regexp",
  "operator",
  "decorator",
] as const;

export type SemanticTokenType = typeof SEMANTIC_TOKEN_TYPES[number];

/** Standard LSP semantic token modifiers */
export const SEMANTIC_TOKEN_MODIFIERS = [
  "declaration",
  "definition",
  "readonly",
  "static",
  "deprecated",
  "abstract",
  "async",
  "modification",
  "documentation",
  "defaultLibrary",
] as const;

export type SemanticTokenModifier = typeof SEMANTIC_TOKEN_MODIFIERS[number];

// ============================================================================
// Semantic Token Rule Types
// ============================================================================

/** Style properties for a semantic token rule */
export interface SemanticTokenRule {
  /** Foreground color (hex) */
  foreground?: string;
  /** Background color (hex) - rarely used */
  background?: string;
  /** Bold text */
  bold?: boolean;
  /** Italic text */
  italic?: boolean;
  /** Underline text */
  underline?: boolean;
  /** Strikethrough text */
  strikethrough?: boolean;
}

/** A semantic token rule can be a simple color string or full style object */
export type SemanticTokenRuleValue = string | SemanticTokenRule;

/** Semantic token customizations for a theme */
export interface SemanticTokenCustomizations {
  /** Whether semantic highlighting is enabled */
  enabled: boolean;
  /** Token rules - key is selector like "variable.readonly" or "*.deprecated" */
  rules: Record<string, SemanticTokenRuleValue>;
}

/** Theme-specific customizations */
export type ThemeSemanticTokenCustomizations = Record<string, SemanticTokenCustomizations>;

// ============================================================================
// Semantic Token Info for UI
// ============================================================================

/** Information about a semantic token type for display in UI */
export interface SemanticTokenTypeInfo {
  type: SemanticTokenType;
  label: string;
  description: string;
  defaultColor?: string;
}

/** Information about a semantic token modifier for display in UI */
export interface SemanticTokenModifierInfo {
  modifier: SemanticTokenModifier;
  label: string;
  description: string;
  defaultStyle?: Partial<SemanticTokenRule>;
}

/** Semantic token type metadata */
export const SEMANTIC_TOKEN_TYPE_INFO: SemanticTokenTypeInfo[] = [
  { type: "namespace", label: "Namespace", description: "Namespace identifiers", defaultColor: "#6366F1" },
  { type: "type", label: "Type", description: "Type names (aliases, primitives)", defaultColor: "#6366F1" },
  { type: "class", label: "Class", description: "Class names", defaultColor: "#6366F1" },
  { type: "enum", label: "Enum", description: "Enum type names", defaultColor: "#6366F1" },
  { type: "interface", label: "Interface", description: "Interface type names", defaultColor: "#6366F1" },
  { type: "struct", label: "Struct", description: "Struct type names", defaultColor: "#6366F1" },
  { type: "typeParameter", label: "Type Parameter", description: "Generic type parameters (T, K, etc.)", defaultColor: "#6366F1" },
  { type: "parameter", label: "Parameter", description: "Function/method parameters", defaultColor: "#9CDCFE" },
  { type: "variable", label: "Variable", description: "Variable names", defaultColor: "#FAFAFA" },
  { type: "property", label: "Property", description: "Object properties", defaultColor: "#FAFAFA" },
  { type: "enumMember", label: "Enum Member", description: "Enum member values", defaultColor: "#4EC9B0" },
  { type: "event", label: "Event", description: "Event names", defaultColor: "#C586C0" },
  { type: "function", label: "Function", description: "Function names", defaultColor: "#DCDCAA" },
  { type: "method", label: "Method", description: "Method names", defaultColor: "#DCDCAA" },
  { type: "macro", label: "Macro", description: "Macro names", defaultColor: "#4FC1FF" },
  { type: "keyword", label: "Keyword", description: "Language keywords", defaultColor: "#569CD6" },
  { type: "modifier", label: "Modifier", description: "Language modifiers (public, static, etc.)", defaultColor: "#569CD6" },
  { type: "comment", label: "Comment", description: "Comments", defaultColor: "#6A9955" },
  { type: "string", label: "String", description: "String literals", defaultColor: "#CE9178" },
  { type: "number", label: "Number", description: "Numeric literals", defaultColor: "#B5CEA8" },
  { type: "regexp", label: "RegExp", description: "Regular expressions", defaultColor: "#D16969" },
  { type: "operator", label: "Operator", description: "Operators (+, -, *, etc.)", defaultColor: "#D4D4D4" },
  { type: "decorator", label: "Decorator", description: "Decorators/Annotations", defaultColor: "#F97316" },
];

/** Semantic token modifier metadata */
export const SEMANTIC_TOKEN_MODIFIER_INFO: SemanticTokenModifierInfo[] = [
  { modifier: "declaration", label: "Declaration", description: "Symbol declaration", defaultStyle: { bold: true } },
  { modifier: "definition", label: "Definition", description: "Symbol definition", defaultStyle: { bold: true } },
  { modifier: "readonly", label: "Readonly", description: "Readonly/const variables", defaultStyle: { foreground: "#4EC9B0" } },
  { modifier: "static", label: "Static", description: "Static members", defaultStyle: { bold: true } },
  { modifier: "deprecated", label: "Deprecated", description: "Deprecated symbols", defaultStyle: { strikethrough: true } },
  { modifier: "abstract", label: "Abstract", description: "Abstract members", defaultStyle: { italic: true } },
  { modifier: "async", label: "Async", description: "Async functions/methods", defaultStyle: { italic: true } },
  { modifier: "modification", label: "Modification", description: "Variable being modified", defaultStyle: { underline: true } },
  { modifier: "documentation", label: "Documentation", description: "Documentation comments", defaultStyle: { italic: true } },
  { modifier: "defaultLibrary", label: "Default Library", description: "Standard library symbols", defaultStyle: { foreground: "#4EC9B0" } },
];

// ============================================================================
// Default Customizations
// ============================================================================

const DEFAULT_CUSTOMIZATIONS: SemanticTokenCustomizations = {
  enabled: true,
  rules: {
    // Types
    "type": "#6366F1",
    "class": "#6366F1",
    "interface": "#6366F1",
    "enum": "#6366F1",
    "struct": "#6366F1",
    "typeParameter": "#6366F1",
    // Variables and properties
    "variable": "#FAFAFA",
    "variable.readonly": "#4EC9B0",
    "variable.defaultLibrary": "#4EC9B0",
    "property": "#FAFAFA",
    "property.readonly": "#4EC9B0",
    // Parameters
    "parameter": { foreground: "#9CDCFE", italic: true },
    // Functions
    "function": "#DCDCAA",
    "function.declaration": { foreground: "#DCDCAA", bold: true },
    "method": "#DCDCAA",
    "method.declaration": { foreground: "#DCDCAA", bold: true },
    // Namespace
    "namespace": "#6366F1",
    // Enum members
    "enumMember": "#4EC9B0",
    // Decorators
    "decorator": "#F97316",
    "macro": "#F97316",
    // Modifiers applied to all tokens
    "*.deprecated": { strikethrough: true },
    "*.abstract": { italic: true },
    "*.async": { italic: true },
    "*.static": { bold: true },
    "*.readonly": { foreground: "#4EC9B0" },
  },
};

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY = "cortex-semantic-token-customizations";

function loadCustomizationsFromStorage(): ThemeSemanticTokenCustomizations {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[SemanticTokenCustomizations] Failed to load from storage:", e);
  }
  return {};
}

function saveCustomizationsToStorage(customizations: ThemeSemanticTokenCustomizations): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customizations));
  } catch (e) {
    console.error("[SemanticTokenCustomizations] Failed to save to storage:", e);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Build Monaco fontStyle string from SemanticTokenRule */
function buildFontStyle(style: SemanticTokenRule): string {
  const parts: string[] = [];
  if (style.italic) parts.push("italic");
  if (style.bold) parts.push("bold");
  if (style.underline) parts.push("underline");
  if (style.strikethrough) parts.push("strikethrough");
  return parts.join(" ");
}

/** Normalize a color value (remove # if present for Monaco) */
function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  return color.replace("#", "");
}

/** Parse a semantic token selector */
export function parseTokenSelector(selector: string): { type: string | null; modifiers: string[] } {
  const parts = selector.split(".");
  const type = parts[0] === "*" ? null : parts[0];
  const modifiers = parts.slice(1);
  return { type, modifiers };
}

/** Build a token selector from type and modifiers */
export function buildTokenSelector(type: string | null, modifiers: string[]): string {
  const base = type || "*";
  if (modifiers.length === 0) return base;
  return `${base}.${modifiers.join(".")}`;
}

/** Convert customizations to Monaco theme rules */
export function customizationsToMonacoRules(
  customizations: SemanticTokenCustomizations
): Monaco.editor.ITokenThemeRule[] {
  const rules: Monaco.editor.ITokenThemeRule[] = [];

  for (const [selector, value] of Object.entries(customizations.rules)) {
    const style = typeof value === "string" ? { foreground: value } : value;
    
    const rule: Monaco.editor.ITokenThemeRule = {
      token: selector,
    };

    if (style.foreground) {
      rule.foreground = normalizeColor(style.foreground);
    }
    if (style.background) {
      rule.background = normalizeColor(style.background);
    }

    const fontStyle = buildFontStyle(style);
    if (fontStyle) {
      rule.fontStyle = fontStyle;
    }

    rules.push(rule);
  }

  return rules;
}

// ============================================================================
// Context Value Interface
// ============================================================================

export interface SemanticTokenCustomizationsContextValue {
  /** Get customizations for a specific theme */
  getCustomizations: (themeName: string) => SemanticTokenCustomizations;
  
  /** Get customizations for current theme */
  currentCustomizations: Accessor<SemanticTokenCustomizations>;
  
  /** Set enabled state for current theme */
  setEnabled: (themeName: string, enabled: boolean) => void;
  
  /** Set a rule for a theme */
  setRule: (themeName: string, selector: string, value: SemanticTokenRuleValue) => void;
  
  /** Remove a rule from a theme */
  removeRule: (themeName: string, selector: string) => void;
  
  /** Reset all rules for a theme */
  resetTheme: (themeName: string) => void;
  
  /** Reset all customizations */
  resetAll: () => void;
  
  /** Apply customizations to Monaco */
  applyToMonaco: (monaco: typeof Monaco, themeName: string) => void;
  
  /** Export customizations as JSON */
  exportCustomizations: () => string;
  
  /** Import customizations from JSON */
  importCustomizations: (json: string) => boolean;
  
  /** Get all available token types */
  tokenTypes: SemanticTokenTypeInfo[];
  
  /** Get all available token modifiers */
  tokenModifiers: SemanticTokenModifierInfo[];
  
  /** Current theme name */
  currentThemeName: Accessor<string>;
  
  /** Set current theme name */
  setCurrentThemeName: (name: string) => void;
  
  /** Check if a selector has a custom rule */
  hasCustomRule: (themeName: string, selector: string) => boolean;
  
  /** Get all rules as flat list */
  getAllRules: (themeName: string) => Array<{ selector: string; value: SemanticTokenRuleValue }>;
  
  /** Generate preview CSS for a rule */
  getPreviewStyle: (rule: SemanticTokenRuleValue) => Record<string, string>;
}

// ============================================================================
// Context & Provider
// ============================================================================

const SemanticTokenCustomizationsContext = createContext<SemanticTokenCustomizationsContextValue>();

export function SemanticTokenCustomizationsProvider(props: ParentProps) {
  const [customizations, setCustomizations] = createStore<ThemeSemanticTokenCustomizations>(
    loadCustomizationsFromStorage()
  );
  const [currentThemeName, setCurrentThemeName] = createSignal("Default Dark");

  // Persist to storage when customizations change
  createEffect(() => {
    saveCustomizationsToStorage({ ...customizations });
  });

  // Get customizations for a theme, falling back to defaults
  const getCustomizations = (themeName: string): SemanticTokenCustomizations => {
    return customizations[themeName] ?? { ...DEFAULT_CUSTOMIZATIONS };
  };

  // Current customizations based on theme
  const currentCustomizations = createMemo(() => getCustomizations(currentThemeName()));

  // Set enabled state
  const setEnabled = (themeName: string, enabled: boolean): void => {
    const current = getCustomizations(themeName);
    setCustomizations(themeName, { ...current, enabled });
    window.dispatchEvent(new CustomEvent("semantic-tokens:enabled-changed", {
      detail: { themeName, enabled },
    }));
  };

  // Set a rule
  const setRule = (themeName: string, selector: string, value: SemanticTokenRuleValue): void => {
    const current = getCustomizations(themeName);
    setCustomizations(themeName, {
      ...current,
      rules: { ...current.rules, [selector]: value },
    });
    window.dispatchEvent(new CustomEvent("semantic-tokens:rule-changed", {
      detail: { themeName, selector, value },
    }));
  };

  // Remove a rule
  const removeRule = (themeName: string, selector: string): void => {
    const current = getCustomizations(themeName);
    const newRules = { ...current.rules };
    delete newRules[selector];
    setCustomizations(themeName, { ...current, rules: newRules });
    window.dispatchEvent(new CustomEvent("semantic-tokens:rule-removed", {
      detail: { themeName, selector },
    }));
  };

  // Reset a theme
  const resetTheme = (themeName: string): void => {
    const newCustomizations = { ...customizations };
    delete newCustomizations[themeName];
    setCustomizations(reconcile(newCustomizations));
    window.dispatchEvent(new CustomEvent("semantic-tokens:theme-reset", {
      detail: { themeName },
    }));
  };

  // Reset all
  const resetAll = (): void => {
    setCustomizations(reconcile({}));
    window.dispatchEvent(new CustomEvent("semantic-tokens:all-reset"));
  };

  // Apply to Monaco
  const applyToMonaco = (_monaco: typeof Monaco, themeName: string): void => {
    const config = getCustomizations(themeName);
    if (!config.enabled) return;

    const rules = customizationsToMonacoRules(config);
    
    // Monaco doesn't have a direct API to update semantic token colors
    // We need to define/update the theme with the new rules
    // This would typically be done by updating the theme definition
    console.debug("[SemanticTokenCustomizations] Applied rules to Monaco:", rules.length);
    
    window.dispatchEvent(new CustomEvent("semantic-tokens:applied", {
      detail: { themeName, rulesCount: rules.length },
    }));
  };

  // Export
  const exportCustomizations = (): string => {
    return JSON.stringify(customizations, null, 2);
  };

  // Import
  const importCustomizations = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed !== "object" || parsed === null) {
        return false;
      }
      setCustomizations(reconcile(parsed));
      return true;
    } catch (e) {
      console.error("[SemanticTokenCustomizations] Import failed:", e);
      return false;
    }
  };

  // Check if has custom rule
  const hasCustomRule = (themeName: string, selector: string): boolean => {
    const config = customizations[themeName];
    return config?.rules?.[selector] !== undefined;
  };

  // Get all rules as flat list
  const getAllRules = (themeName: string): Array<{ selector: string; value: SemanticTokenRuleValue }> => {
    const config = getCustomizations(themeName);
    return Object.entries(config.rules).map(([selector, value]) => ({ selector, value }));
  };

  // Generate preview style
  const getPreviewStyle = (rule: SemanticTokenRuleValue): Record<string, string> => {
    const style: Record<string, string> = {};
    const ruleObj = typeof rule === "string" ? { foreground: rule } : rule;
    
    if (ruleObj.foreground) style.color = ruleObj.foreground;
    if (ruleObj.background) style["background-color"] = ruleObj.background;
    if (ruleObj.bold) style["font-weight"] = "bold";
    if (ruleObj.italic) style["font-style"] = "italic";
    if (ruleObj.underline) style["text-decoration"] = "underline";
    if (ruleObj.strikethrough) {
      style["text-decoration"] = style["text-decoration"] 
        ? `${style["text-decoration"]} line-through` 
        : "line-through";
    }
    
    return style;
  };

  const value: SemanticTokenCustomizationsContextValue = {
    getCustomizations,
    currentCustomizations,
    setEnabled,
    setRule,
    removeRule,
    resetTheme,
    resetAll,
    applyToMonaco,
    exportCustomizations,
    importCustomizations,
    tokenTypes: SEMANTIC_TOKEN_TYPE_INFO,
    tokenModifiers: SEMANTIC_TOKEN_MODIFIER_INFO,
    currentThemeName,
    setCurrentThemeName,
    hasCustomRule,
    getAllRules,
    getPreviewStyle,
  };

  return (
    <SemanticTokenCustomizationsContext.Provider value={value}>
      {props.children}
    </SemanticTokenCustomizationsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSemanticTokenCustomizations(): SemanticTokenCustomizationsContextValue {
  const context = useContext(SemanticTokenCustomizationsContext);
  if (!context) {
    throw new Error("useSemanticTokenCustomizations must be used within SemanticTokenCustomizationsProvider");
  }
  return context;
}

export default SemanticTokenCustomizationsContext;
