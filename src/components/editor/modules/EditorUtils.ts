/**
 * EditorUtils - Helper functions for the CodeEditor module
 *
 * Contains text transformation utilities, coverage decorations, unicode handling,
 * and other helper functions extracted from CodeEditor.tsx.
 */

import type * as Monaco from "monaco-editor";
import type {
  LineCoverageData,
  LineCoverageStatus,
} from "@/context/TestingContext";
import {
  type UnicodeHighlightSettings,
  type UnicodeCharacterInfo,
  type UnicodeCategory,
  type WindowWithIdleCallback,
  COVERAGE_COLORS,
  COVERAGE_GLYPH_CLASSES,
} from "./EditorTypes";

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Yields to the main thread to prevent blocking UI.
 * Uses requestIdleCallback if available, falls back to setTimeout.
 */
export const yieldToMain = (): Promise<void> => {
  return new Promise((resolve) => {
    const win = window as WindowWithIdleCallback;
    if (win.requestIdleCallback) {
      win.requestIdleCallback(() => resolve(), { timeout: 16 });
    } else {
      setTimeout(resolve, 0);
    }
  });
};

/**
 * Executes an array of functions in batches, yielding to main thread between batches.
 * This prevents long-running synchronous operations from blocking the UI.
 */
export const executeBatched = async (
  tasks: (() => void)[],
  batchSize: number = 10,
): Promise<void> => {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    batch.forEach((task) => task());
    if (i + batchSize < tasks.length) {
      await yieldToMain();
    }
  }
};

/**
 * Creates a debounced version of a function that delays invocation until after
 * `wait` milliseconds have elapsed since the last call.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: unknown[]) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, wait);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Fast line count estimation for large files.
 * Uses a sampling approach for files over 100KB to avoid blocking.
 */
export function estimateLineCount(content: string): number {
  const length = content.length;

  if (length < 100000) {
    let count = 1;
    for (let i = 0; i < length; i++) {
      if (content.charCodeAt(i) === 10) count++;
    }
    return count;
  }

  const sampleSize = 10000;
  let newlines = 0;
  for (let i = 0; i < sampleSize && i < length; i++) {
    if (content.charCodeAt(i) === 10) newlines++;
  }

  if (newlines === 0) return 1;
  const avgBytesPerLine = sampleSize / newlines;
  return Math.ceil(length / avgBytesPerLine);
}

// ============================================================================
// Text Transform Utilities
// ============================================================================

/**
 * Convert a string to snake_case
 * Examples: "camelCase" -> "camel_case", "PascalCase" -> "pascal_case", "kebab-case" -> "kebab_case"
 */
export const toSnakeCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
};

/**
 * Convert a string to camelCase
 * Examples: "snake_case" -> "snakeCase", "kebab-case" -> "kebabCase", "PascalCase" -> "pascalCase"
 */
export const toCamelCase = (str: string): string => {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
};

/**
 * Convert a string to PascalCase
 * Examples: "snake_case" -> "SnakeCase", "kebab-case" -> "KebabCase", "camelCase" -> "CamelCase"
 */
export const toPascalCase = (str: string): string => {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[a-z]/, (c) => c.toUpperCase());
};

/**
 * Convert a string to kebab-case
 * Examples: "camelCase" -> "camel-case", "PascalCase" -> "pascal-case", "snake_case" -> "snake-case"
 */
export const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
};

/**
 * Convert a string to CONSTANT_CASE
 * Examples: "camelCase" -> "CAMEL_CASE", "kebab-case" -> "KEBAB_CASE"
 */
export const toConstantCase = (str: string): string => {
  return toSnakeCase(str).toUpperCase();
};

// ============================================================================
// Unicode Handling Utilities
// ============================================================================

/**
 * Map of commonly confused Unicode characters (homoglyphs) to their ASCII equivalents.
 */
export const UNICODE_TO_ASCII_MAP: Record<string, string> = {
  // Cyrillic homoglyphs
  "\u0410": "A",
  "\u0412": "B",
  "\u0421": "C",
  "\u0415": "E",
  "\u041D": "H",
  "\u0406": "I",
  "\u041A": "K",
  "\u041C": "M",
  "\u041E": "O",
  "\u0420": "P",
  "\u0422": "T",
  "\u0425": "X",
  "\u0430": "a",
  "\u0435": "e",
  "\u043E": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0443": "y",
  "\u0445": "x",
  "\u0456": "i",
  "\u0458": "j",
  "\u04BB": "h",
  // Greek homoglyphs
  "\u0391": "A",
  "\u0392": "B",
  "\u0395": "E",
  "\u0396": "Z",
  "\u0397": "H",
  "\u0399": "I",
  "\u039A": "K",
  "\u039C": "M",
  "\u039D": "N",
  "\u039F": "O",
  "\u03A1": "P",
  "\u03A4": "T",
  "\u03A5": "Y",
  "\u03A7": "X",
  "\u03BF": "o",
  "\u03B1": "a",
  // Invisible/special characters
  "\u00A0": " ",
  "\u2000": " ",
  "\u2001": " ",
  "\u2002": " ",
  "\u2003": " ",
  "\u2004": " ",
  "\u2005": " ",
  "\u2006": " ",
  "\u2007": " ",
  "\u2008": " ",
  "\u2009": " ",
  "\u200A": " ",
  "\u200B": "",
  "\u200C": "",
  "\u200D": "",
  "\u200E": "",
  "\u200F": "",
  "\u2028": "\n",
  "\u2029": "\n",
  "\u202A": "",
  "\u202B": "",
  "\u202C": "",
  "\u202D": "",
  "\u202E": "",
  "\u2060": "",
  "\u2061": "",
  "\u2062": "",
  "\u2063": "",
  "\u2064": "",
  "\uFEFF": "",
  // Common confusables (dashes, quotes, etc.)
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u201B": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u201F": '"',
  "\u2024": ".",
  "\u2025": "..",
  "\u2026": "...",
  "\u2032": "'",
  "\u2033": '"',
  "\u2039": "<",
  "\u203A": ">",
  "\u2044": "/",
  "\u2215": "/",
  "\u2216": "\\",
  "\u2217": "*",
  "\u2218": "o",
  "\u2219": ".",
  "\u22C5": ".",
  // Fullwidth characters
  "\uFF01": "!",
  "\uFF02": '"',
  "\uFF03": "#",
  "\uFF04": "$",
  "\uFF05": "%",
  "\uFF06": "&",
  "\uFF07": "'",
  "\uFF08": "(",
  "\uFF09": ")",
  "\uFF0A": "*",
  "\uFF0B": "+",
  "\uFF0C": ",",
  "\uFF0D": "-",
  "\uFF0E": ".",
  "\uFF0F": "/",
  "\uFF1A": ":",
  "\uFF1B": ";",
  "\uFF1C": "<",
  "\uFF1D": "=",
  "\uFF1E": ">",
  "\uFF1F": "?",
  "\uFF20": "@",
  "\uFF3B": "[",
  "\uFF3C": "\\",
  "\uFF3D": "]",
  "\uFF3E": "^",
  "\uFF3F": "_",
  "\uFF40": "`",
  "\uFF5B": "{",
  "\uFF5C": "|",
  "\uFF5D": "}",
  "\uFF5E": "~",
};

/**
 * Get Unicode character category and description
 */
export function getUnicodeCharacterInfo(char: string): UnicodeCharacterInfo {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return { codePoint: "U+????", name: "Unknown", category: "unknown" };
  }

  const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
  const codePointStr = `U+${hex}`;

  // Invisible characters
  if (
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2060 && codePoint <= 0x2064) ||
    codePoint === 0xfeff ||
    codePoint === 0x00a0 ||
    (codePoint >= 0x2000 && codePoint <= 0x200a) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029
  ) {
    const invisibleNames: Record<number, string> = {
      0x200b: "Zero Width Space",
      0x200c: "Zero Width Non-Joiner",
      0x200d: "Zero Width Joiner",
      0x200e: "Left-to-Right Mark",
      0x200f: "Right-to-Left Mark",
      0x202a: "Left-to-Right Embedding",
      0x202b: "Right-to-Left Embedding",
      0x202c: "Pop Directional Formatting",
      0x202d: "Left-to-Right Override",
      0x202e: "Right-to-Left Override",
      0x2060: "Word Joiner",
      0xfeff: "Byte Order Mark",
      0x00a0: "Non-Breaking Space",
      0x2028: "Line Separator",
      0x2029: "Paragraph Separator",
    };
    return {
      codePoint: codePointStr,
      name: invisibleNames[codePoint] || "Invisible Character",
      category: "invisible",
      replacement: UNICODE_TO_ASCII_MAP[char],
    };
  }

  // Bidirectional control characters
  if (
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    codePoint === 0x061c ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  ) {
    return {
      codePoint: codePointStr,
      name: "Bidirectional Control Character",
      category: "bidirectional",
      replacement: UNICODE_TO_ASCII_MAP[char] ?? "",
    };
  }

  // Homoglyphs
  const replacement = UNICODE_TO_ASCII_MAP[char];
  if (replacement !== undefined) {
    let scriptName = "Unicode";
    if (codePoint >= 0x0400 && codePoint <= 0x04ff) scriptName = "Cyrillic";
    else if (codePoint >= 0x0370 && codePoint <= 0x03ff) scriptName = "Greek";
    else if (codePoint >= 0xff00 && codePoint <= 0xffef)
      scriptName = "Fullwidth";
    else if (codePoint >= 0x2010 && codePoint <= 0x2027)
      scriptName = "General Punctuation";

    return {
      codePoint: codePointStr,
      name: `${scriptName} character resembling "${replacement}"`,
      category: "homoglyph",
      replacement,
    };
  }

  // Non-basic ASCII
  if (codePoint < 0x20 || codePoint > 0x7e) {
    return {
      codePoint: codePointStr,
      name: "Non-Basic ASCII Character",
      category: "nonBasicASCII",
    };
  }

  return { codePoint: codePointStr, name: char, category: "unknown" };
}

/**
 * Check if character should be highlighted based on settings
 */
export function shouldHighlightCharacter(
  char: string,
  settings: UnicodeHighlightSettings,
): boolean {
  if (!settings.enabled) return false;
  const info = getUnicodeCharacterInfo(char);
  if (settings.allowedCharacters[char]) return false;

  switch (info.category) {
    case "invisible":
      return settings.invisibleCharacters;
    case "homoglyph":
      return settings.ambiguousCharacters;
    case "bidirectional":
      return settings.invisibleCharacters;
    case "nonBasicASCII":
      return settings.nonBasicASCII;
    default:
      return false;
  }
}

/**
 * Find all confusable Unicode characters in text
 */
export function findConfusableCharacters(
  text: string,
  settings: UnicodeHighlightSettings,
): Array<{ char: string; index: number; info: UnicodeCharacterInfo }> {
  const results: Array<{
    char: string;
    index: number;
    info: UnicodeCharacterInfo;
  }> = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (shouldHighlightCharacter(char, settings)) {
      results.push({ char, index: i, info: getUnicodeCharacterInfo(char) });
    }
  }
  return results;
}

/**
 * Format category for display
 */
export function formatUnicodeCategory(category: UnicodeCategory): string {
  switch (category) {
    case "invisible":
      return "Invisible/Whitespace";
    case "homoglyph":
      return "Confusable (Homoglyph)";
    case "bidirectional":
      return "Bidirectional Control";
    case "nonBasicASCII":
      return "Non-Basic ASCII";
    default:
      return category;
  }
}

// ============================================================================
// Coverage Decoration Utilities
// ============================================================================

/**
 * Create Monaco decoration options for a coverage line
 */
export function createCoverageDecoration(
  lineNumber: number,
  status: LineCoverageStatus,
  hits: number,
  branches: { covered: number; total: number } | undefined,
  monaco: typeof Monaco,
): Monaco.editor.IModelDeltaDecoration | null {
  if (!monaco) return null;

  const color = COVERAGE_COLORS[status];
  const glyphClass = COVERAGE_GLYPH_CLASSES[status];

  let hoverMessage = "";
  if (status === "covered") {
    hoverMessage = `✓ Covered (${hits} hit${hits !== 1 ? "s" : ""})`;
  } else if (status === "uncovered") {
    hoverMessage = "✗ Not covered";
  } else if (status === "partial" && branches) {
    hoverMessage = `◐ Partial coverage: ${branches.covered}/${branches.total} branches (${hits} hit${hits !== 1 ? "s" : ""})`;
  }

  return {
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      isWholeLine: true,
      glyphMarginClassName: glyphClass,
      glyphMarginHoverMessage: { value: hoverMessage },
      overviewRuler: {
        color: color,
        position: monaco.editor.OverviewRulerLane.Left,
      },
      minimap: {
        color: color,
        position: monaco.editor.MinimapPosition.Gutter,
      },
    },
  };
}

// Internal state for coverage decorations per editor
const coverageDecorationsMap = new WeakMap<
  Monaco.editor.IStandaloneCodeEditor,
  string[]
>();

/**
 * Apply coverage decorations to an editor
 */
export function applyCoverageDecorations(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  coverageLines: LineCoverageData[],
): void {
  const existingDecorations = coverageDecorationsMap.get(editor) || [];
  const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

  for (const line of coverageLines) {
    const decoration = createCoverageDecoration(
      line.lineNumber,
      line.status,
      line.hits,
      line.branches,
      monaco,
    );
    if (decoration) {
      newDecorations.push(decoration);
    }
  }

  const updatedDecorations = editor.deltaDecorations(
    existingDecorations,
    newDecorations,
  );
  coverageDecorationsMap.set(editor, updatedDecorations);
}

/**
 * Clear all coverage decorations from an editor
 */
export function clearCoverageDecorations(
  editor: Monaco.editor.IStandaloneCodeEditor,
): void {
  const existingDecorations = coverageDecorationsMap.get(editor) || [];
  editor.deltaDecorations(existingDecorations, []);
  coverageDecorationsMap.set(editor, []);
}

// ============================================================================
// Debug Hover Utilities
// ============================================================================

/**
 * Determines the value type class for syntax highlighting in hover.
 */
export function getDebugValueTypeClass(
  type: string | undefined,
  value: string,
): string {
  const typeLower = type?.toLowerCase() || "";

  if (
    typeLower.includes("string") ||
    value.startsWith('"') ||
    value.startsWith("'")
  ) {
    return "string";
  }
  if (
    typeLower.includes("number") ||
    typeLower.includes("int") ||
    typeLower.includes("float") ||
    /^-?\d+\.?\d*$/.test(value)
  ) {
    return "number";
  }
  if (value === "true" || value === "false" || typeLower.includes("bool")) {
    return "boolean";
  }
  if (
    value === "null" ||
    value === "undefined" ||
    value === "None" ||
    value === "nil"
  ) {
    return "null";
  }
  if (
    typeLower.includes("function") ||
    typeLower.includes("method") ||
    value.startsWith("function") ||
    value.startsWith("ƒ")
  ) {
    return "function";
  }
  return "object";
}

/**
 * Escapes HTML special characters for safe rendering.
 */
export function escapeDebugHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// CodeLens Utilities
// ============================================================================

/**
 * Check if a code lens command is for references
 */
export function isReferenceLens(command?: {
  title: string;
  command?: string;
}): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes("reference") || title.includes("usage");
}

/**
 * Check if a code lens command is for implementations
 */
export function isImplementationLens(command?: {
  title: string;
  command?: string;
}): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes("implementation");
}

/**
 * Check if a code lens command is for test actions
 */
export function isTestLens(command?: {
  title: string;
  command?: string;
}): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return (
    title.includes("run") || title.includes("debug") || title.includes("test")
  );
}

/**
 * Check if a line is a test function definition
 */
export function isTestLine(lineText: string, language: string): boolean {
  const trimmed = lineText.trim();
  const TEST_PATTERNS = {
    jest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe)\s*\(/,
    vitest:
      /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe|suite)\s*\(/,
    rust: /^#\[test\]|^#\[tokio::test\]/,
    pytest: /^(?:async\s+)?def\s+test_/,
    go: /^func\s+Test[A-Z]/,
  };

  switch (language) {
    case "typescript":
    case "javascript":
    case "typescriptreact":
    case "javascriptreact":
      return (
        TEST_PATTERNS.jest.test(trimmed) || TEST_PATTERNS.vitest.test(trimmed)
      );
    case "rust":
      return TEST_PATTERNS.rust.test(trimmed);
    case "python":
      return TEST_PATTERNS.pytest.test(trimmed);
    case "go":
      return TEST_PATTERNS.go.test(trimmed);
    default:
      return false;
  }
}

/**
 * Extract test name from a line
 */
export function extractTestName(
  lineText: string,
  language: string,
): string | null {
  const trimmed = lineText.trim();
  switch (language) {
    case "typescript":
    case "javascript":
    case "typescriptreact":
    case "javascriptreact": {
      const match = trimmed.match(
        /(?:it|test|describe|suite)\s*\(\s*['"`]([^'"`]+)['"`]/,
      );
      return match ? match[1] : null;
    }
    case "rust": {
      const match = trimmed.match(/(?:async\s+)?fn\s+(\w+)/);
      return match ? match[1] : null;
    }
    case "python": {
      const match = trimmed.match(/(?:async\s+)?def\s+(test_\w+)/);
      return match ? match[1] : null;
    }
    case "go": {
      const match = trimmed.match(/func\s+(Test\w+)/);
      return match ? match[1] : null;
    }
    default:
      return null;
  }
}
