/**
 * Monaco Selection Range Provider
 *
 * Provides selection range (smart selection) integration for Monaco editor using LSP.
 * Features:
 * - LSP-based selection ranges (textDocument/selectionRange)
 * - Used for "Expand Selection" (Shift+Alt+Right) and "Shrink Selection" (Shift+Alt+Left)
 * - Returns nested selection ranges for semantic expansion
 */

import type * as Monaco from "monaco-editor";
import type { Position, Range, SelectionRange } from "@/context/LSPContext";

// Extended Monaco SelectionRange that includes parent property
// Note: Monaco 0.55.1 doesn't include parent in the type definition,
// but the runtime API and VS Code's implementation support it
interface MonacoSelectionRangeWithParent extends Monaco.languages.SelectionRange {
  parent?: MonacoSelectionRangeWithParent;
}

/**
 * Selection Range Provider Options
 */
export interface SelectionRangeProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  getSelectionRanges: (
    serverId: string,
    uri: string,
    positions: Position[]
  ) => Promise<SelectionRange[]>;
  getCapabilities: () => { selectionRangeProvider: boolean };
}

/**
 * Selection Range Provider Result
 */
export interface SelectionRangeProviderResult {
  provider: Monaco.IDisposable;
}

/**
 * Convert Monaco Position to LSP Position
 */
function toLSPPosition(position: Monaco.IPosition): Position {
  return {
    line: position.lineNumber - 1,
    character: position.column - 1,
  };
}

/**
 * Convert LSP Range to Monaco IRange
 */
function toMonacoRange(range: Range): Monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

/**
 * Convert LSP SelectionRange to Monaco SelectionRange
 * This recursively converts the nested parent structure
 */
function toMonacoSelectionRange(
  selectionRange: SelectionRange
): MonacoSelectionRangeWithParent {
  const monacoRange: MonacoSelectionRangeWithParent = {
    range: toMonacoRange(selectionRange.range),
  };

  // Recursively convert parent if present
  if (selectionRange.parent) {
    monacoRange.parent = toMonacoSelectionRange(selectionRange.parent);
  }

  return monacoRange;
}

/**
 * Create fallback selection ranges based on syntax
 * This provides basic selection expansion when LSP is not available
 */
function createFallbackSelectionRanges(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition
): MonacoSelectionRangeWithParent {
  const lineNumber = position.lineNumber;
  const lineContent = model.getLineContent(lineNumber);
  const lineLength = lineContent.length;

  // Start with the word at position
  const wordRange = model.getWordAtPosition(position);

  // Level 1: Select the full line content (excluding leading/trailing whitespace)
  const trimmedLine = lineContent.trim();
  const leadingSpaces = lineContent.length - lineContent.trimStart().length;
  const lineRange: MonacoSelectionRangeWithParent = {
    range: {
      startLineNumber: lineNumber,
      startColumn: leadingSpaces + 1,
      endLineNumber: lineNumber,
      endColumn: leadingSpaces + trimmedLine.length + 1,
    },
  };

  // Level 2: Select the entire line including whitespace
  const fullLineRange: MonacoSelectionRangeWithParent = {
    range: {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: lineLength + 1,
    },
    parent: undefined,
  };
  lineRange.parent = fullLineRange;

  // Level 3: Try to find enclosing brackets/braces
  const bracketRange = findEnclosingBrackets(model, position);
  if (bracketRange) {
    fullLineRange.parent = {
      range: bracketRange,
    };

    // Level 4: Select to document end
    const documentRange: MonacoSelectionRangeWithParent = {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: model.getLineCount(),
        endColumn: model.getLineLength(model.getLineCount()) + 1,
      },
    };
    fullLineRange.parent.parent = documentRange;
  } else {
    // No brackets found, jump to document selection
    fullLineRange.parent = {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: model.getLineCount(),
        endColumn: model.getLineLength(model.getLineCount()) + 1,
      },
    };
  }

  // Build the final chain starting from word selection
  if (wordRange) {
    return {
      range: {
        startLineNumber: lineNumber,
        startColumn: wordRange.startColumn,
        endLineNumber: lineNumber,
        endColumn: wordRange.endColumn,
      },
      parent: lineRange,
    };
  } else {
    // No word at position, start from line range
    return lineRange;
  }
}

/**
 * Find the innermost enclosing brackets around a position
 */
function findEnclosingBrackets(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition
): Monaco.IRange | null {
  const bracketPairs = [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
  ];

  let bestRange: Monaco.IRange | null = null;
  let bestSize = Infinity;

  for (const pair of bracketPairs) {
    const range = findMatchingBrackets(model, position, pair.open, pair.close);
    if (range) {
      const size = 
        (range.endLineNumber - range.startLineNumber) * 10000 +
        (range.endColumn - range.startColumn);
      if (size < bestSize) {
        bestSize = size;
        bestRange = range;
      }
    }
  }

  return bestRange;
}

/**
 * Find matching brackets around a position
 */
function findMatchingBrackets(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition,
  openBracket: string,
  closeBracket: string
): Monaco.IRange | null {
  const lineCount = model.getLineCount();
  let depth = 0;
  let openPos: Monaco.IPosition | null = null;

  // Search backwards for opening bracket
  for (let line = position.lineNumber; line >= 1; line--) {
    const lineContent = model.getLineContent(line);
    const startCol = line === position.lineNumber ? position.column - 2 : lineContent.length - 1;

    for (let col = startCol; col >= 0; col--) {
      const char = lineContent[col];
      if (char === closeBracket) {
        depth++;
      } else if (char === openBracket) {
        if (depth === 0) {
          openPos = { lineNumber: line, column: col + 1 };
          break;
        }
        depth--;
      }
    }

    if (openPos) break;
  }

  if (!openPos) return null;

  // Search forwards for closing bracket
  depth = 0;
  for (let line = openPos.lineNumber; line <= lineCount; line++) {
    const lineContent = model.getLineContent(line);
    const startCol = line === openPos.lineNumber ? openPos.column : 0;

    for (let col = startCol; col < lineContent.length; col++) {
      const char = lineContent[col];
      if (char === openBracket) {
        depth++;
      } else if (char === closeBracket) {
        if (depth === 1) {
          return {
            startLineNumber: openPos.lineNumber,
            startColumn: openPos.column,
            endLineNumber: line,
            endColumn: col + 2,
          };
        }
        depth--;
      }
    }
  }

  return null;
}

/**
 * Create a Monaco selection range provider for LSP integration
 */
export function createSelectionRangeProvider(
  options: SelectionRangeProviderOptions
): SelectionRangeProviderResult {
  const { monaco, languageId, serverId, filePath, getSelectionRanges, getCapabilities } = options;

  const provider = monaco.languages.registerSelectionRangeProvider(languageId, {
    async provideSelectionRanges(
      model: Monaco.editor.ITextModel,
      positions: Monaco.Position[],
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.SelectionRange[][] | null> {
      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return null;
      }

      const capabilities = getCapabilities();

      // If LSP selection range is available, use it
      if (capabilities.selectionRangeProvider) {
        try {
          // Convert Monaco positions to LSP positions
          const lspPositions: Position[] = positions.map((pos) => toLSPPosition(pos));

          // Get selection ranges from LSP
          const lspRanges = await getSelectionRanges(serverId, filePath, lspPositions);

          // Convert to Monaco selection ranges
          const result: Monaco.languages.SelectionRange[][] = [];

          for (let i = 0; i < positions.length; i++) {
            const lspRange = lspRanges[i];
            if (lspRange) {
              // Convert the nested structure to Monaco format
              const monacoRange = toMonacoSelectionRange(lspRange);
              result.push([monacoRange]);
            } else {
              // Fall back to default for this position
              result.push([createFallbackSelectionRanges(model, positions[i])]);
            }
          }

          return result;
        } catch (e) {
          console.debug("LSP selection range error:", e);
          // Fall back to default implementation
        }
      }

      // Use fallback implementation when LSP is not available
      const result: Monaco.languages.SelectionRange[][] = positions.map((position) => [
        createFallbackSelectionRanges(model, position),
      ]);

      return result;
    },
  });

  return {
    provider,
  };
}

/**
 * Flatten a nested SelectionRange into an array of ranges
 * Useful for debugging or displaying the selection hierarchy
 */
export function flattenSelectionRanges(selectionRange: SelectionRange): Range[] {
  const ranges: Range[] = [];
  let current: SelectionRange | undefined = selectionRange;

  while (current) {
    ranges.push(current.range);
    current = current.parent;
  }

  return ranges;
}

/**
 * Get the depth of a SelectionRange chain
 */
export function getSelectionRangeDepth(selectionRange: SelectionRange): number {
  let depth = 0;
  let current: SelectionRange | undefined = selectionRange;

  while (current) {
    depth++;
    current = current.parent;
  }

  return depth;
}
