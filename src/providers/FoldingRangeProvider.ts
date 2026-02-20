/**
 * Monaco Folding Range Provider
 *
 * Provides folding range integration for Monaco editor using LSP.
 * Features:
 * - LSP-based folding ranges (textDocument/foldingRange)
 * - Folding kinds: comment, imports, region
 * - Custom region markers support: //#region, //# region, //#endregion
 * - Changes editor foldingStrategy from "indentation" to "auto" when LSP available
 */

import type * as Monaco from "monaco-editor";

/**
 * LSP FoldingRangeKind values
 */
export type FoldingRangeKind = "comment" | "imports" | "region";

/**
 * LSP FoldingRange interface
 */
export interface FoldingRange {
  /** The start line (0-based, inclusive) */
  startLine: number;
  /** The start character (0-based, optional) */
  startCharacter?: number;
  /** The end line (0-based, inclusive) */
  endLine: number;
  /** The end character (0-based, optional) */
  endCharacter?: number;
  /** The kind of folding range */
  kind?: FoldingRangeKind;
  /** Optional collapsed text to show when folded */
  collapsedText?: string;
}

/**
 * Folding Range Provider Options
 */
export interface FoldingRangeProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  getFoldingRanges: (serverId: string, uri: string) => Promise<FoldingRange[]>;
  getCapabilities: () => { foldingRangeProvider: boolean };
}

/**
 * Folding Range Provider Result
 */
export interface FoldingRangeProviderResult {
  provider: Monaco.IDisposable;
  updateEditorOptions: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
}

/**
 * Custom region marker patterns for various languages
 */
const REGION_MARKERS = {
  // JavaScript/TypeScript style
  jsStart: /^\s*\/\/\s*#?\s*region\b/i,
  jsEnd: /^\s*\/\/\s*#?\s*endregion\b/i,
  // C/C++/C# style
  cStart: /^\s*#\s*region\b/i,
  cEnd: /^\s*#\s*endregion\b/i,
  // Python style
  pyStart: /^\s*#\s*region\b/i,
  pyEnd: /^\s*#\s*endregion\b/i,
  // HTML/XML style
  htmlStart: /^\s*<!--\s*#?\s*region\b/i,
  htmlEnd: /^\s*<!--\s*#?\s*endregion\b/i,
};

/**
 * Check if a line is a region start marker
 */
function isRegionStart(line: string, languageId: string): boolean {
  switch (languageId) {
    case "typescript":
    case "typescriptreact":
    case "javascript":
    case "javascriptreact":
      return REGION_MARKERS.jsStart.test(line);
    case "c":
    case "cpp":
    case "csharp":
      return REGION_MARKERS.cStart.test(line);
    case "python":
      return REGION_MARKERS.pyStart.test(line);
    case "html":
    case "xml":
      return REGION_MARKERS.htmlStart.test(line);
    default:
      // Try all patterns for unknown languages
      return (
        REGION_MARKERS.jsStart.test(line) ||
        REGION_MARKERS.cStart.test(line) ||
        REGION_MARKERS.htmlStart.test(line)
      );
  }
}

/**
 * Check if a line is a region end marker
 */
function isRegionEnd(line: string, languageId: string): boolean {
  switch (languageId) {
    case "typescript":
    case "typescriptreact":
    case "javascript":
    case "javascriptreact":
      return REGION_MARKERS.jsEnd.test(line);
    case "c":
    case "cpp":
    case "csharp":
      return REGION_MARKERS.cEnd.test(line);
    case "python":
      return REGION_MARKERS.pyEnd.test(line);
    case "html":
    case "xml":
      return REGION_MARKERS.htmlEnd.test(line);
    default:
      // Try all patterns for unknown languages
      return (
        REGION_MARKERS.jsEnd.test(line) ||
        REGION_MARKERS.cEnd.test(line) ||
        REGION_MARKERS.htmlEnd.test(line)
      );
  }
}

/**
 * Extract region name from a region start marker
 */
function extractRegionName(line: string): string | undefined {
  // Match patterns like: // #region Name, //#region Name, <!-- #region Name -->
  const match = line.match(/(?:\/\/|#|<!--)\s*#?\s*region\s+(.+?)(?:-->)?$/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Find custom region markers in the document
 */
function findCustomRegions(
  model: Monaco.editor.ITextModel,
  languageId: string
): FoldingRange[] {
  const regions: FoldingRange[] = [];
  const stack: { line: number; name?: string }[] = [];
  const lineCount = model.getLineCount();

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineText = model.getLineContent(lineNumber);

    if (isRegionStart(lineText, languageId)) {
      const name = extractRegionName(lineText);
      stack.push({ line: lineNumber - 1, name }); // Convert to 0-based
    } else if (isRegionEnd(lineText, languageId) && stack.length > 0) {
      const start = stack.pop()!;
      regions.push({
        startLine: start.line,
        endLine: lineNumber - 1, // Convert to 0-based
        kind: "region",
        collapsedText: start.name,
      });
    }
  }

  return regions;
}

/**
 * Convert LSP FoldingRangeKind to Monaco FoldingRangeKind
 */
function toMonacoFoldingKind(
  monaco: typeof Monaco,
  kind?: FoldingRangeKind
): Monaco.languages.FoldingRangeKind | undefined {
  if (!kind) return undefined;

  switch (kind) {
    case "comment":
      return monaco.languages.FoldingRangeKind.Comment;
    case "imports":
      return monaco.languages.FoldingRangeKind.Imports;
    case "region":
      return monaco.languages.FoldingRangeKind.Region;
    default:
      return undefined;
  }
}

/**
 * Merge LSP ranges with custom region ranges, avoiding duplicates
 */
function mergeRanges(lspRanges: FoldingRange[], customRanges: FoldingRange[]): FoldingRange[] {
  // Create a set of existing ranges to avoid duplicates
  const rangeSet = new Set<string>();
  const result: FoldingRange[] = [];

  // Helper to create a unique key for a range
  const toKey = (range: FoldingRange) => `${range.startLine}:${range.endLine}`;

  // Add LSP ranges first
  for (const range of lspRanges) {
    const key = toKey(range);
    if (!rangeSet.has(key)) {
      rangeSet.add(key);
      result.push(range);
    }
  }

  // Add custom ranges that don't overlap with LSP ranges
  for (const range of customRanges) {
    const key = toKey(range);
    if (!rangeSet.has(key)) {
      rangeSet.add(key);
      result.push(range);
    }
  }

  return result;
}

/**
 * Create a Monaco folding range provider for LSP integration
 */
export function createFoldingRangeProvider(
  options: FoldingRangeProviderOptions
): FoldingRangeProviderResult {
  const { monaco, languageId, serverId, filePath, getFoldingRanges, getCapabilities } = options;

  const provider = monaco.languages.registerFoldingRangeProvider(languageId, {
    async provideFoldingRanges(
      model: Monaco.editor.ITextModel,
      _context: Monaco.languages.FoldingContext,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.FoldingRange[] | null> {
      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return null;
      }

      let lspRanges: FoldingRange[] = [];

      // Try to get folding ranges from LSP if available
      const capabilities = getCapabilities();
      if (capabilities.foldingRangeProvider) {
        try {
          lspRanges = await getFoldingRanges(serverId, filePath);
        } catch (e) {
          console.debug("LSP folding range error:", e);
        }
      }

      // Find custom region markers in the document
      const customRegions = findCustomRegions(model, languageId);

      // Merge LSP ranges with custom regions
      const allRanges = mergeRanges(lspRanges, customRegions);

      // Convert to Monaco folding ranges
      const monacoRanges: Monaco.languages.FoldingRange[] = allRanges.map((range) => ({
        // Monaco uses 1-based line numbers
        start: range.startLine + 1,
        end: range.endLine + 1,
        kind: toMonacoFoldingKind(monaco, range.kind),
      }));

      return monacoRanges;
    },
  });

  /**
   * Update editor options for folding
   * Changes foldingStrategy from "indentation" to "auto" when LSP is available
   */
  const updateEditorOptions = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    const capabilities = getCapabilities();
    
    editor.updateOptions({
      folding: true,
      // Use "auto" strategy when LSP folding is available, otherwise fall back to "indentation"
      foldingStrategy: capabilities.foldingRangeProvider ? "auto" : "indentation",
      // Show folding controls (the +/- icons in the gutter)
      showFoldingControls: "mouseover",
      // Enable folding highlights
      foldingHighlight: true,
      // Maximum number of foldable regions
      foldingMaximumRegions: 5000,
    });
  };

  return {
    provider,
    updateEditorOptions,
  };
}

/**
 * Get Monaco editor options for folding
 */
export function getFoldingEditorOptions(
  hasLSPFolding: boolean
): Monaco.editor.IEditorOptions {
  return {
    folding: true,
    foldingStrategy: hasLSPFolding ? "auto" : "indentation",
    showFoldingControls: "mouseover",
    foldingHighlight: true,
    foldingMaximumRegions: 5000,
  };
}

/**
 * Default folding range implementation for when LSP is not available
 * This provides basic folding based on indentation and braces
 */
export function createDefaultFoldingRanges(
  model: Monaco.editor.ITextModel,
  languageId: string
): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  const lineCount = model.getLineCount();

  // Find custom regions
  ranges.push(...findCustomRegions(model, languageId));

  // Add brace-based folding for common patterns
  const braceStack: { line: number; char: string }[] = [];

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineText = model.getLineContent(lineNumber);

    // Count opening and closing braces
    for (let i = 0; i < lineText.length; i++) {
      const char = lineText[i];
      if (char === "{" || char === "[") {
        braceStack.push({ line: lineNumber - 1, char });
      } else if (char === "}" || char === "]") {
        const expected = char === "}" ? "{" : "[";
        if (braceStack.length > 0 && braceStack[braceStack.length - 1].char === expected) {
          const start = braceStack.pop()!;
          // Only create a folding range if it spans multiple lines
          if (lineNumber - 1 > start.line) {
            ranges.push({
              startLine: start.line,
              endLine: lineNumber - 1,
            });
          }
        }
      }
    }
  }

  return ranges;
}
