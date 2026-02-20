import {
  type ColorCustomizations,
  type ThemeColors,
  type EditorColors,
  type SyntaxColors,
  DEFAULT_CUSTOMIZATIONS,
  STORAGE_KEY_CUSTOMIZATIONS,
} from "./types";

// ============================================================================
// Monaco Theme Data Interface
// ============================================================================

interface MonacoThemeData {
  base: "vs" | "vs-dark" | "hc-black" | "hc-light";
  inherit: boolean;
  rules: Array<{ token: string; foreground?: string; fontStyle?: string }>;
  colors: Record<string, string>;
}

// ============================================================================
// Storage Helpers
// ============================================================================

export function loadCustomizationsFromStorage(): ColorCustomizations {
  if (typeof localStorage === "undefined") {
    return DEFAULT_CUSTOMIZATIONS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOMIZATIONS);
    if (!stored) {
      return DEFAULT_CUSTOMIZATIONS;
    }

    const parsed = JSON.parse(stored);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.ui !== "object" ||
      typeof parsed.editor !== "object" ||
      typeof parsed.syntax !== "object" ||
      typeof parsed.terminal !== "object"
    ) {
      console.warn("[Theme] Invalid customizations format in storage, using defaults");
      return DEFAULT_CUSTOMIZATIONS;
    }

    return {
      ui: parsed.ui || {},
      editor: parsed.editor || {},
      syntax: parsed.syntax || {},
      terminal: parsed.terminal || {},
    };
  } catch (e) {
    console.error("[Theme] Failed to parse customizations from storage:", e);
    return DEFAULT_CUSTOMIZATIONS;
  }
}

export function saveCustomizationsToStorage(customizations: ColorCustomizations): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY_CUSTOMIZATIONS, JSON.stringify(customizations));
  } catch (e) {
    console.error("[Theme] Failed to save customizations to storage:", e);
  }
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

// ============================================================================
// Internal Helpers
// ============================================================================

function stripHash(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

// ============================================================================
// Monaco Theme Generation
// ============================================================================

export function generateMonacoThemeData(
  colors: ThemeColors,
  editorColors: EditorColors,
  syntaxColors: SyntaxColors,
  isDark: boolean,
): MonacoThemeData {
  const base = isDark ? "vs-dark" : "vs";

  const themeColors: Record<string, string> = {
    "editor.background": editorColors.editorBackground,
    "editor.foreground": editorColors.editorForeground,
    "editor.lineHighlightBackground": editorColors.editorLineHighlight,
    "editor.selectionBackground": editorColors.editorSelectionBackground,
    "editor.selectionForeground": editorColors.editorSelectionForeground,
    "editorCursor.foreground": editorColors.editorCursor,
    "editorWhitespace.foreground": editorColors.editorWhitespace,
    "editorIndentGuide.background": editorColors.editorIndentGuide,
    "editorIndentGuide.activeBackground": editorColors.editorIndentGuideActive,
    "editorLineNumber.foreground": editorColors.editorLineNumber,
    "editorLineNumber.activeForeground": editorColors.editorLineNumberActive,
    "editorRuler.foreground": editorColors.editorRuler,
    "editorGutter.background": editorColors.editorGutter,
    "editorWidget.background": colors.backgroundSecondary,
    "editorWidget.foreground": colors.foreground,
    "editorWidget.border": colors.border,
    "editorSuggestWidget.background": colors.backgroundSecondary,
    "editorSuggestWidget.foreground": colors.foreground,
    "editorSuggestWidget.selectedBackground": colors.backgroundTertiary,
    "editorSuggestWidget.border": colors.border,
    "editorHoverWidget.background": colors.backgroundSecondary,
    "editorHoverWidget.border": colors.border,
    "editorError.foreground": colors.error,
    "editorWarning.foreground": colors.warning,
    "editorInfo.foreground": colors.info,
  };

  const rules: MonacoThemeData["rules"] = [
    { token: "", foreground: stripHash(editorColors.editorForeground) },
    { token: "comment", foreground: stripHash(syntaxColors.comment), fontStyle: "italic" },
    { token: "comment.doc", foreground: stripHash(syntaxColors.comment), fontStyle: "italic" },
    { token: "comment.block", foreground: stripHash(syntaxColors.comment), fontStyle: "italic" },
    { token: "string", foreground: stripHash(syntaxColors.string) },
    { token: "string.escape", foreground: stripHash(syntaxColors.escape) },
    { token: "number", foreground: stripHash(syntaxColors.number) },
    { token: "number.float", foreground: stripHash(syntaxColors.number) },
    { token: "number.hex", foreground: stripHash(syntaxColors.number) },
    { token: "keyword", foreground: stripHash(syntaxColors.keyword) },
    { token: "keyword.control", foreground: stripHash(syntaxColors.keyword) },
    { token: "operator", foreground: stripHash(syntaxColors.operator) },
    { token: "keyword.operator", foreground: stripHash(syntaxColors.operator) },
    { token: "entity.name.function", foreground: stripHash(syntaxColors.function) },
    { token: "support.function", foreground: stripHash(syntaxColors.function) },
    { token: "variable", foreground: stripHash(syntaxColors.variable) },
    { token: "variable.parameter", foreground: stripHash(syntaxColors.parameter) },
    { token: "variable.property", foreground: stripHash(syntaxColors.property) },
    { token: "type", foreground: stripHash(syntaxColors.type) },
    { token: "entity.name.type", foreground: stripHash(syntaxColors.type) },
    { token: "support.type", foreground: stripHash(syntaxColors.type) },
    { token: "entity.name.class", foreground: stripHash(syntaxColors.class) },
    { token: "support.class", foreground: stripHash(syntaxColors.class) },
    { token: "constant", foreground: stripHash(syntaxColors.constant) },
    { token: "constant.language", foreground: stripHash(syntaxColors.constant) },
    { token: "delimiter", foreground: stripHash(syntaxColors.punctuation) },
    { token: "tag", foreground: stripHash(syntaxColors.tag) },
    { token: "attribute.name", foreground: stripHash(syntaxColors.attribute) },
    { token: "regexp", foreground: stripHash(syntaxColors.regexp) },
    { token: "invalid", foreground: stripHash(syntaxColors.invalid) },
    { token: "storage.type", foreground: stripHash(syntaxColors.keyword) },
    { token: "storage.modifier", foreground: stripHash(syntaxColors.keyword) },
  ];

  return { base, inherit: true, rules, colors: themeColors };
}

// ============================================================================
// Semantic Token Rules
// ============================================================================

export function generateSemanticTokenRules(
  syntaxColors: SyntaxColors,
): Record<string, string> {
  return {
    variable: syntaxColors.variable,
    parameter: syntaxColors.parameter,
    property: syntaxColors.property,
    function: syntaxColors.function,
    method: syntaxColors.function,
    type: syntaxColors.type,
    class: syntaxColors.class,
    interface: syntaxColors.type,
    enum: syntaxColors.type,
    enumMember: syntaxColors.constant,
    namespace: syntaxColors.class,
    decorator: syntaxColors.attribute,
    macro: syntaxColors.keyword,
    string: syntaxColors.string,
    number: syntaxColors.number,
    keyword: syntaxColors.keyword,
    comment: syntaxColors.comment,
    regexp: syntaxColors.regexp,
    operator: syntaxColors.operator,
  };
}

// ============================================================================
// Bracket Pair Colorization
// ============================================================================

export function generateBracketPairColors(
  syntaxColors: SyntaxColors,
  _isDark: boolean,
): { enabled: boolean; colors: string[] } {
  return {
    enabled: true,
    colors: [
      syntaxColors.keyword,
      syntaxColors.string,
      syntaxColors.function,
      syntaxColors.type,
      syntaxColors.constant,
      syntaxColors.variable,
    ],
  };
}

// ============================================================================
// Monaco Theme Sync
// ============================================================================

export function syncThemeToMonaco(
  monaco: { editor: { defineTheme: (name: string, data: MonacoThemeData) => void; setTheme: (name: string) => void } },
  colors: ThemeColors,
  editorColors: EditorColors,
  syntaxColors: SyntaxColors,
  isDark: boolean,
): void {
  const themeData = generateMonacoThemeData(colors, editorColors, syntaxColors, isDark);
  monaco.editor.defineTheme("cortex-theme", themeData);
  monaco.editor.setTheme("cortex-theme");
}
