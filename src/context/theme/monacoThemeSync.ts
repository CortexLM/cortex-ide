import type { EditorColors, SyntaxColors, ThemeColors } from "./types";

interface MonacoThemeRule {
  token: string;
  foreground?: string;
  fontStyle?: string;
}

function stripHash(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

function withAlpha(hexColor: string, alpha: string): string {
  const base = hexColor.startsWith("#") ? hexColor : `#${hexColor}`;
  return base.length === 7 ? `${base}${alpha}` : base;
}

export function createMonacoThemeData(
  isDark: boolean,
  editorColors: EditorColors,
  syntaxColors: SyntaxColors,
  uiColors?: ThemeColors,
): { base: "vs" | "vs-dark" | "hc-black"; inherit: boolean; rules: MonacoThemeRule[]; colors: Record<string, string>; semanticHighlighting: boolean } {
  const base = isDark ? "vs-dark" : "vs";

  const rules: MonacoThemeRule[] = [
    { token: "comment", foreground: stripHash(syntaxColors.comment), fontStyle: "italic" },
    { token: "string", foreground: stripHash(syntaxColors.string) },
    { token: "number", foreground: stripHash(syntaxColors.number) },
    { token: "keyword", foreground: stripHash(syntaxColors.keyword) },
    { token: "operator", foreground: stripHash(syntaxColors.operator) },
    { token: "type", foreground: stripHash(syntaxColors.type) },
    { token: "type.identifier", foreground: stripHash(syntaxColors.type) },
    { token: "function", foreground: stripHash(syntaxColors.function) },
    { token: "variable", foreground: stripHash(syntaxColors.variable) },
    { token: "constant", foreground: stripHash(syntaxColors.constant) },
    { token: "parameter", foreground: stripHash(syntaxColors.parameter) },
    { token: "property", foreground: stripHash(syntaxColors.property) },
    { token: "punctuation", foreground: stripHash(syntaxColors.punctuation) },
    { token: "tag", foreground: stripHash(syntaxColors.tag) },
    { token: "attribute.name", foreground: stripHash(syntaxColors.attribute) },
    { token: "attribute.value", foreground: stripHash(syntaxColors.string) },
    { token: "regexp", foreground: stripHash(syntaxColors.regexp) },
    { token: "escape", foreground: stripHash(syntaxColors.escape) },
    { token: "invalid", foreground: stripHash(syntaxColors.invalid) },
    { token: "class", foreground: stripHash(syntaxColors.class) },
    { token: "*.declaration", foreground: stripHash(syntaxColors.keyword), fontStyle: "bold" },
    { token: "*.definition", foreground: stripHash(syntaxColors.function), fontStyle: "bold" },
    { token: "*.readonly", foreground: stripHash(syntaxColors.constant) },
    { token: "class.declaration", foreground: stripHash(syntaxColors.class) },
    { token: "namespace", foreground: stripHash(syntaxColors.type) },
    { token: "enum", foreground: stripHash(syntaxColors.type) },
    { token: "interface", foreground: stripHash(syntaxColors.type), fontStyle: "italic" },
    { token: "struct", foreground: stripHash(syntaxColors.type) },
    { token: "typeParameter", foreground: stripHash(syntaxColors.type), fontStyle: "italic" },
    { token: "decorator", foreground: stripHash(syntaxColors.keyword) },
    { token: "macro", foreground: stripHash(syntaxColors.keyword) },
  ];

  const colors: Record<string, string> = {
    "editor.background": editorColors.editorBackground,
    "editor.foreground": editorColors.editorForeground,
    "editor.lineHighlightBackground": editorColors.editorLineHighlight,
    "editor.selectionBackground": editorColors.editorSelectionBackground,
    "editorCursor.foreground": editorColors.editorCursor,
    "editorWhitespace.foreground": editorColors.editorWhitespace,
    "editorIndentGuide.background": editorColors.editorIndentGuide,
    "editorIndentGuide.activeBackground": editorColors.editorIndentGuideActive,
    "editorLineNumber.foreground": editorColors.editorLineNumber,
    "editorLineNumber.activeForeground": editorColors.editorLineNumberActive,
    "editorRuler.foreground": editorColors.editorRuler,
    "editorGutter.background": editorColors.editorGutter,
    "editor.foldBackground": editorColors.editorFoldBackground,
    "editorBracketHighlight.foreground1": syntaxColors.keyword,
    "editorBracketHighlight.foreground2": syntaxColors.string,
    "editorBracketHighlight.foreground3": syntaxColors.type,
    "editorBracketHighlight.foreground4": syntaxColors.function,
    "editorBracketHighlight.foreground5": syntaxColors.constant,
    "editorBracketHighlight.foreground6": syntaxColors.parameter,
    "editorBracketPairGuide.activeBackground1": withAlpha(syntaxColors.keyword, "40"),
    "editorBracketPairGuide.activeBackground2": withAlpha(syntaxColors.string, "40"),
    "editorBracketPairGuide.activeBackground3": withAlpha(syntaxColors.type, "40"),
  };

  if (editorColors.editorSelectionForeground) {
    colors["editor.selectionForeground"] = editorColors.editorSelectionForeground;
  }

  if (uiColors) {
    colors["editorWidget.background"] = uiColors.backgroundSecondary;
    colors["editorWidget.border"] = uiColors.border;
    colors["editorSuggestWidget.background"] = uiColors.backgroundSecondary;
    colors["editorSuggestWidget.border"] = uiColors.border;
    colors["editorSuggestWidget.selectedBackground"] = uiColors.backgroundTertiary;
  }

  return { base, inherit: true, rules, colors, semanticHighlighting: true };
}

export function syncThemeToMonaco(
  monaco: typeof import("monaco-editor"),
  isDark: boolean,
  editorColors: EditorColors,
  syntaxColors: SyntaxColors,
  uiColors?: ThemeColors,
): void {
  try {
    const themeData = createMonacoThemeData(isDark, editorColors, syntaxColors, uiColors);
    monaco.editor.defineTheme("cortex-theme", themeData);
    monaco.editor.setTheme("cortex-theme");
  } catch (e) {
    console.error("[MonacoThemeSync] Failed to sync theme:", e);
  }
}
