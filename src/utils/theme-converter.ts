/**
 * VS Code theme converter utility.
 *
 * Parses VS Code theme JSON files (with `colors` and `tokenColors`) and
 * converts them into the app's CSS custom-property / token system so they
 * can be applied to the DOM and to Monaco editor.
 */

/**
 * Re-exported from ThemeContext to avoid circular dependency.
 * These interfaces match the ones in ThemeContext exactly.
 */
interface EditorColors {
  editorBackground: string;
  editorForeground: string;
  editorLineHighlight: string;
  editorSelectionBackground: string;
  editorSelectionForeground: string;
  editorCursor: string;
  editorWhitespace: string;
  editorIndentGuide: string;
  editorIndentGuideActive: string;
  editorLineNumber: string;
  editorLineNumberActive: string;
  editorRuler: string;
  editorGutter: string;
  editorFoldBackground: string;
}

interface SyntaxColors {
  comment: string;
  string: string;
  number: string;
  keyword: string;
  operator: string;
  function: string;
  variable: string;
  type: string;
  class: string;
  constant: string;
  parameter: string;
  property: string;
  punctuation: string;
  tag: string;
  attribute: string;
  regexp: string;
  escape: string;
  invalid: string;
}

interface TerminalColors {
  terminalBackground: string;
  terminalForeground: string;
  terminalCursor: string;
  terminalCursorAccent: string;
  terminalSelection: string;
  terminalBlack: string;
  terminalRed: string;
  terminalGreen: string;
  terminalYellow: string;
  terminalBlue: string;
  terminalMagenta: string;
  terminalCyan: string;
  terminalWhite: string;
  terminalBrightBlack: string;
  terminalBrightRed: string;
  terminalBrightGreen: string;
  terminalBrightYellow: string;
  terminalBrightBlue: string;
  terminalBrightMagenta: string;
  terminalBrightCyan: string;
  terminalBrightWhite: string;
}

// ============================================================================
// VS Code Theme JSON Types
// ============================================================================

export interface VSCodeTokenColorSetting {
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

export interface VSCodeTokenColor {
  name?: string;
  scope?: string | string[];
  settings: VSCodeTokenColorSetting;
}

export interface VSCodeThemeJSON {
  name?: string;
  type?: "dark" | "light" | "hc" | "hcLight";
  colors?: Record<string, string>;
  tokenColors?: VSCodeTokenColor[];
  include?: string;
}

// ============================================================================
// Converted Theme (internal representation)
// ============================================================================

export interface CortexTheme {
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>;
  tokenColors: VSCodeTokenColor[];
}

// ============================================================================
// Built-in Theme IDs
// ============================================================================

export type BuiltinThemeId =
  | "dark-plus"
  | "light-plus"
  | "high-contrast"
  | "high-contrast-light";

export const BUILTIN_THEMES: ReadonlyArray<{
  id: BuiltinThemeId;
  label: string;
  type: "dark" | "light";
  path: string;
}> = [
  { id: "dark-plus", label: "Dark+", type: "dark", path: "/themes/dark-plus.json" },
  { id: "light-plus", label: "Light+", type: "light", path: "/themes/light-plus.json" },
  { id: "high-contrast", label: "High Contrast", type: "dark", path: "/themes/high-contrast.json" },
  { id: "high-contrast-light", label: "High Contrast Light", type: "light", path: "/themes/high-contrast-light.json" },
];

// ============================================================================
// Color Helpers
// ============================================================================

function get(
  colors: Record<string, string> | undefined,
  key: string,
  fallback = "",
): string {
  return colors?.[key] ?? fallback;
}

function alpha(hex: string, a: number): string {
  const base = hex.replace(/^#/, "").slice(0, 6);
  const alphaHex = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${base}${alphaHex}`;
}

// ============================================================================
// VS Code → App UI Colors
// ============================================================================

interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderActive: string;
}

export function convertWorkbenchColors(
  c: Record<string, string>,
  themeType: "dark" | "light",
): ThemeColors {
  const isDark = themeType === "dark";
  const bg = get(c, "editor.background", isDark ? "#1e1e1e" : "#ffffff");
  const fg = get(c, "editor.foreground", isDark ? "#d4d4d4" : "#000000");

  return {
    background: get(c, "sideBar.background", bg),
    backgroundSecondary: get(c, "editorGroupHeader.tabsBackground", bg),
    backgroundTertiary: get(c, "panel.background", bg),
    foreground: fg,
    foregroundMuted: get(c, "descriptionForeground", alpha(fg, 0.7)),
    primary: get(c, "focusBorder", isDark ? "#007fd4" : "#0066bf"),
    primaryHover: get(
      c,
      "button.hoverBackground",
      isDark ? "#1a8cff" : "#0055a3",
    ),
    secondary: get(c, "button.secondaryBackground", isDark ? "#565656" : "#d4d4d4"),
    accent: get(c, "activityBar.activeBorder", isDark ? "#ffffff" : "#000000"),
    success: get(c, "editorGutter.addedBackground", "#22c55e"),
    warning: get(c, "editorWarning.foreground", "#d97706"),
    error: get(c, "editorError.foreground", "#dc2626"),
    info: get(c, "editorInfo.foreground", "#2563eb"),
    border: get(c, "panel.border", isDark ? "#2a2a2a" : "#e4e4e7"),
    borderActive: get(c, "focusBorder", isDark ? "#404040" : "#d4d4d8"),
  };
}

// ============================================================================
// VS Code → App Editor Colors
// ============================================================================

export function convertEditorColors(
  c: Record<string, string>,
  themeType: "dark" | "light",
): EditorColors {
  const isDark = themeType === "dark";
  const bg = get(c, "editor.background", isDark ? "#1e1e1e" : "#ffffff");
  const fg = get(c, "editor.foreground", isDark ? "#d4d4d4" : "#000000");

  return {
    editorBackground: bg,
    editorForeground: fg,
    editorLineHighlight: get(
      c,
      "editor.lineHighlightBackground",
      isDark ? "rgba(255,255,255,0.05)" : "#f4f4f5",
    ),
    editorSelectionBackground: get(
      c,
      "editor.selectionBackground",
      isDark ? "#264f78" : "#add6ff",
    ),
    editorSelectionForeground: get(c, "editor.selectionForeground", fg),
    editorCursor: get(c, "editorCursor.foreground", fg),
    editorWhitespace: get(
      c,
      "editorWhitespace.foreground",
      isDark ? "#3f3f46" : "#d4d4d8",
    ),
    editorIndentGuide: get(
      c,
      "editorIndentGuide.background",
      isDark ? "#3f3f46" : "#e4e4e7",
    ),
    editorIndentGuideActive: get(
      c,
      "editorIndentGuide.activeBackground",
      isDark ? "#52525b" : "#a1a1aa",
    ),
    editorLineNumber: get(
      c,
      "editorLineNumber.foreground",
      isDark ? "#858585" : "#a1a1aa",
    ),
    editorLineNumberActive: get(
      c,
      "editorLineNumber.activeForeground",
      isDark ? "#c6c6c6" : "#52525b",
    ),
    editorRuler: get(c, "editorRuler.foreground", isDark ? "#5a5a5a" : "#e4e4e7"),
    editorGutter: get(c, "editorGutter.background", bg),
    editorFoldBackground: get(
      c,
      "editor.foldBackground",
      isDark ? "rgba(255,255,255,0.05)" : "#f4f4f5",
    ),
  };
}

// ============================================================================
// VS Code → App Terminal Colors
// ============================================================================

export function convertTerminalColors(
  c: Record<string, string>,
  themeType: "dark" | "light",
): TerminalColors {
  const isDark = themeType === "dark";
  return {
    terminalBackground: get(c, "terminal.background", isDark ? "#1e1e1e" : "#ffffff"),
    terminalForeground: get(c, "terminal.foreground", isDark ? "#cccccc" : "#333333"),
    terminalCursor: get(c, "terminalCursor.foreground", isDark ? "#ffffff" : "#000000"),
    terminalCursorAccent: get(c, "terminalCursor.background", isDark ? "#000000" : "#ffffff"),
    terminalSelection: get(c, "terminal.selectionBackground", isDark ? "#40404080" : "#add6ff80"),
    terminalBlack: get(c, "terminal.ansiBlack", isDark ? "#000000" : "#000000"),
    terminalRed: get(c, "terminal.ansiRed", isDark ? "#cd3131" : "#cd3131"),
    terminalGreen: get(c, "terminal.ansiGreen", isDark ? "#0dbc79" : "#00bc00"),
    terminalYellow: get(c, "terminal.ansiYellow", isDark ? "#e5e510" : "#949800"),
    terminalBlue: get(c, "terminal.ansiBlue", isDark ? "#2472c8" : "#0451a5"),
    terminalMagenta: get(c, "terminal.ansiMagenta", isDark ? "#bc3fbc" : "#bc05bc"),
    terminalCyan: get(c, "terminal.ansiCyan", isDark ? "#11a8cd" : "#0598bc"),
    terminalWhite: get(c, "terminal.ansiWhite", isDark ? "#e5e5e5" : "#555555"),
    terminalBrightBlack: get(c, "terminal.ansiBrightBlack", isDark ? "#666666" : "#666666"),
    terminalBrightRed: get(c, "terminal.ansiBrightRed", isDark ? "#f14c4c" : "#cd3131"),
    terminalBrightGreen: get(c, "terminal.ansiBrightGreen", isDark ? "#23d18b" : "#14ce14"),
    terminalBrightYellow: get(c, "terminal.ansiBrightYellow", isDark ? "#f5f543" : "#b5ba00"),
    terminalBrightBlue: get(c, "terminal.ansiBrightBlue", isDark ? "#3b8eea" : "#0451a5"),
    terminalBrightMagenta: get(c, "terminal.ansiBrightMagenta", isDark ? "#d670d6" : "#bc05bc"),
    terminalBrightCyan: get(c, "terminal.ansiBrightCyan", isDark ? "#29b8db" : "#0598bc"),
    terminalBrightWhite: get(c, "terminal.ansiBrightWhite", isDark ? "#e5e5e5" : "#a5a5a5"),
  };
}

// ============================================================================
// VS Code tokenColors → App SyntaxColors
// ============================================================================

function findTokenForeground(
  tokenColors: VSCodeTokenColor[],
  scopes: string[],
): string | undefined {
  for (let i = tokenColors.length - 1; i >= 0; i--) {
    const rule = tokenColors[i];
    const ruleScopes = Array.isArray(rule.scope)
      ? rule.scope
      : rule.scope
        ? [rule.scope]
        : [];
    for (const s of scopes) {
      if (ruleScopes.some((rs) => rs === s || rs.startsWith(s + "."))) {
        return rule.settings.foreground;
      }
    }
  }
  return undefined;
}

export function convertSyntaxColors(
  tokenColors: VSCodeTokenColor[],
  themeType: "dark" | "light",
): SyntaxColors {
  const isDark = themeType === "dark";
  const f = (scopes: string[], fallback: string): string =>
    findTokenForeground(tokenColors, scopes) ?? fallback;

  return {
    comment: f(["comment"], isDark ? "#6a9955" : "#008000"),
    string: f(["string"], isDark ? "#ce9178" : "#a31515"),
    number: f(["constant.numeric"], isDark ? "#b5cea8" : "#098658"),
    keyword: f(["keyword", "storage.type"], isDark ? "#569cd6" : "#0000ff"),
    operator: f(["keyword.operator"], isDark ? "#d4d4d4" : "#000000"),
    function: f(["entity.name.function", "support.function"], isDark ? "#dcdcaa" : "#795e26"),
    variable: f(["variable"], isDark ? "#9cdcfe" : "#001080"),
    type: f(["entity.name.type", "support.type"], isDark ? "#4ec9b0" : "#267f99"),
    class: f(["entity.name.class", "support.class"], isDark ? "#4ec9b0" : "#267f99"),
    constant: f(["constant.language", "constant.other"], isDark ? "#569cd6" : "#0000ff"),
    parameter: f(["variable.parameter"], isDark ? "#9cdcfe" : "#001080"),
    property: f(["variable.other.property", "support.variable.property"], isDark ? "#9cdcfe" : "#001080"),
    punctuation: f(["punctuation"], isDark ? "#d4d4d4" : "#000000"),
    tag: f(["entity.name.tag"], isDark ? "#569cd6" : "#800000"),
    attribute: f(["entity.other.attribute-name"], isDark ? "#9cdcfe" : "#ff0000"),
    regexp: f(["string.regexp"], isDark ? "#d16969" : "#811f3f"),
    escape: f(["constant.character.escape"], isDark ? "#d7ba7d" : "#ee0000"),
    invalid: f(["invalid"], isDark ? "#f44747" : "#cd3131"),
  };
}

// ============================================================================
// Full VS Code Theme → CortexTheme conversion
// ============================================================================

export function convertVSCodeTheme(json: VSCodeThemeJSON, name?: string): CortexTheme {
  const themeType: "dark" | "light" =
    json.type === "light" || json.type === "hcLight" ? "light" : "dark";

  return {
    name: name ?? json.name ?? "Custom Theme",
    type: themeType,
    colors: json.colors ?? {},
    tokenColors: json.tokenColors ?? [],
  };
}

// ============================================================================
// CortexTheme → ColorCustomizations (for ThemeContext integration)
// ============================================================================

interface ColorCustomizations {
  ui: Partial<ThemeColors>;
  editor: Partial<EditorColors>;
  syntax: Partial<SyntaxColors>;
  terminal: Partial<TerminalColors>;
}

export function cortexThemeToCustomizations(theme: CortexTheme): ColorCustomizations {
  const ui = convertWorkbenchColors(theme.colors, theme.type);
  const editor = convertEditorColors(theme.colors, theme.type);
  const syntax = convertSyntaxColors(theme.tokenColors, theme.type);
  const terminal = convertTerminalColors(theme.colors, theme.type);

  return { ui, editor, syntax, terminal };
}

// ============================================================================
// Load a VS Code theme JSON from a URL or file path
// ============================================================================

export async function loadVSCodeThemeFromURL(url: string): Promise<VSCodeThemeJSON> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch theme: ${response.statusText}`);
  }
  return response.json() as Promise<VSCodeThemeJSON>;
}

export async function loadAndConvertVSCodeTheme(
  pathOrUrl: string,
  name?: string,
): Promise<CortexTheme> {
  const json = await loadVSCodeThemeFromURL(pathOrUrl);
  return convertVSCodeTheme(json, name);
}
