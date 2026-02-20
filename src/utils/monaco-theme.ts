/**
 * Monaco editor theme synchronization utility.
 *
 * Converts VS Code `tokenColors` (TextMate scope rules) into Monaco
 * `ITokenThemeRule[]` format and applies them via
 * `monaco.editor.defineTheme()` / `monaco.editor.setTheme()`.
 */

import type * as Monaco from "monaco-editor";
import type { CortexTheme, VSCodeTokenColor } from "@/utils/theme-converter";

// ============================================================================
// Types
// ============================================================================

interface MonacoTokenRule {
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

interface MonacoThemeColors {
  [colorKey: string]: string;
}

// ============================================================================
// TextMate scope → Monaco token mapping
// ============================================================================

/**
 * Map common TextMate scopes to Monaco token names.
 * Monaco uses a dot-separated token naming convention that differs from
 * TextMate scopes. This mapping covers the most common scopes.
 */
const TEXTMATE_TO_MONACO: ReadonlyArray<[string, string]> = [
  ["comment.block.documentation", "comment.doc"],
  ["comment.block", "comment.block"],
  ["comment.line", "comment.line"],
  ["comment", "comment"],
  ["string.quoted.double", "string"],
  ["string.quoted.single", "string"],
  ["string.template", "string.template"],
  ["string.regexp", "regexp"],
  ["string", "string"],
  ["constant.numeric.hex", "number.hex"],
  ["constant.numeric.float", "number.float"],
  ["constant.numeric", "number"],
  ["constant.character.escape", "string.escape"],
  ["constant.language.boolean", "constant.language.boolean"],
  ["constant.language.null", "constant.language.null"],
  ["constant.language", "constant.language"],
  ["constant.other", "constant"],
  ["constant", "constant"],
  ["variable.parameter", "variable.parameter"],
  ["variable.other.property", "variable.property"],
  ["variable.other.readwrite", "variable"],
  ["variable.other", "variable"],
  ["variable.language", "variable.predefined"],
  ["variable", "variable"],
  ["keyword.control", "keyword.control"],
  ["keyword.operator.assignment", "keyword.operator.assignment"],
  ["keyword.operator.arithmetic", "keyword.operator.arithmetic"],
  ["keyword.operator.logical", "keyword.operator.logical"],
  ["keyword.operator.comparison", "keyword.operator.comparison"],
  ["keyword.operator", "keyword.operator"],
  ["keyword.other", "keyword.other"],
  ["keyword", "keyword"],
  ["storage.type", "storage.type"],
  ["storage.modifier", "storage.modifier"],
  ["storage", "storage"],
  ["entity.name.function", "entity.name.function"],
  ["entity.name.type", "entity.name.type"],
  ["entity.name.class", "entity.name.class"],
  ["entity.name.tag", "tag"],
  ["entity.other.attribute-name", "attribute.name"],
  ["entity.other.inherited-class", "type"],
  ["support.function", "support.function"],
  ["support.type", "support.type"],
  ["support.class", "support.class"],
  ["support.variable.property", "support.property"],
  ["support.variable", "support.variable"],
  ["support.constant", "support.constant"],
  ["meta.decorator", "meta.decorator"],
  ["meta.function-call", "meta.function-call"],
  ["meta.brace", "meta.brace"],
  ["punctuation.definition.comment", "comment"],
  ["punctuation.definition.string", "string"],
  ["punctuation.definition.tag", "delimiter.html"],
  ["punctuation", "delimiter"],
  ["invalid.illegal", "invalid"],
  ["invalid", "invalid"],
];

/**
 * Convert a single TextMate scope string to a Monaco token name.
 * Falls back to the scope itself with dots replaced if no mapping exists.
 */
function textMateToMonacoToken(scope: string): string {
  for (const [tmScope, monacoToken] of TEXTMATE_TO_MONACO) {
    if (scope === tmScope || scope.startsWith(tmScope + ".")) {
      return monacoToken;
    }
  }
  return scope;
}

/**
 * Strip leading '#' and return just the hex digits for Monaco rules.
 */
function stripHash(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

// ============================================================================
// Conversion
// ============================================================================

/**
 * Convert an array of VS Code `tokenColors` into Monaco `ITokenThemeRule[]`.
 */
export function convertTokenColorsToMonacoRules(
  tokenColors: VSCodeTokenColor[],
): MonacoTokenRule[] {
  const rules: MonacoTokenRule[] = [];

  for (const tc of tokenColors) {
    const scopes = Array.isArray(tc.scope)
      ? tc.scope
      : tc.scope
        ? [tc.scope]
        : [""];

    const foreground = tc.settings.foreground
      ? stripHash(tc.settings.foreground)
      : undefined;
    const background = tc.settings.background
      ? stripHash(tc.settings.background)
      : undefined;
    const fontStyle = tc.settings.fontStyle ?? undefined;

    for (const scope of scopes) {
      const token = scope ? textMateToMonacoToken(scope) : "";
      rules.push({
        token,
        ...(foreground ? { foreground } : {}),
        ...(background ? { background } : {}),
        ...(fontStyle !== undefined ? { fontStyle } : {}),
      });
    }
  }

  return rules;
}

/**
 * Build Monaco theme `colors` from VS Code workbench colors.
 * Only includes keys that Monaco understands.
 */
export function convertWorkbenchColorsToMonaco(
  colors: Record<string, string>,
): MonacoThemeColors {
  const result: MonacoThemeColors = {};
  for (const [key, value] of Object.entries(colors)) {
    if (key.startsWith("editor.") || key.startsWith("editorCursor.") ||
        key.startsWith("editorLineNumber.") || key.startsWith("editorWhitespace.") ||
        key.startsWith("editorIndentGuide.") || key.startsWith("editorBracket") ||
        key.startsWith("editorGutter.") || key.startsWith("editorOverviewRuler.") ||
        key.startsWith("editorWidget.") || key.startsWith("editorSuggestWidget.") ||
        key.startsWith("editorHoverWidget.") || key.startsWith("editorGroup") ||
        key.startsWith("minimap") || key.startsWith("scrollbar") ||
        key.startsWith("editorError.") || key.startsWith("editorWarning.") ||
        key.startsWith("editorInfo.") || key.startsWith("editorHint.") ||
        key.startsWith("editorInlayHint.") || key.startsWith("editorRuler.") ||
        key.startsWith("editorCodeLens.") || key.startsWith("peekView")) {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// Apply to Monaco
// ============================================================================

/**
 * Determine the Monaco base theme from a CortexTheme.
 */
function getMonacoBase(
  theme: CortexTheme,
): "vs" | "vs-dark" | "hc-black" | "hc-light" {
  const raw = (theme.colors as Record<string, string>);
  const typeName = raw?.["__type"] ?? theme.type;
  if (typeName === "hc" || typeName === "hcBlack") return "hc-black";
  if (typeName === "hcLight") return "hc-light";
  return theme.type === "light" ? "vs" : "vs-dark";
}

/**
 * Define and apply a CortexTheme as a Monaco editor theme.
 *
 * @param monaco  The Monaco editor namespace
 * @param theme   The converted CortexTheme
 * @param id      Unique theme id for Monaco (default: "cortex-vscode-theme")
 */
export function applyThemeToMonaco(
  monaco: typeof Monaco,
  theme: CortexTheme,
  id = "cortex-vscode-theme",
): void {
  const rules = convertTokenColorsToMonacoRules(theme.tokenColors);
  const colors = convertWorkbenchColorsToMonaco(theme.colors);
  const base = getMonacoBase(theme);

  monaco.editor.defineTheme(id, {
    base,
    inherit: true,
    rules: rules as Monaco.editor.ITokenThemeRule[],
    colors,
  });

  monaco.editor.setTheme(id);
}

/**
 * Apply color customization overrides on top of an existing Monaco theme.
 * Used for `workbench.colorCustomizations` and `editor.tokenColorCustomizations`.
 */
export function applyCustomizationOverrides(
  monaco: typeof Monaco,
  baseThemeId: string,
  colorOverrides: Record<string, string>,
  tokenRuleOverrides: MonacoTokenRule[],
): void {
  const overrideId = `${baseThemeId}-custom`;

  monaco.editor.defineTheme(overrideId, {
    base: "vs-dark",
    inherit: true,
    rules: tokenRuleOverrides as Monaco.editor.ITokenThemeRule[],
    colors: colorOverrides,
  });

  monaco.editor.setTheme(overrideId);
}
