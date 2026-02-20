/**
 * Monaco Linked Editing Range Provider
 *
 * Provides linked editing (synced editing) integration for Monaco editor using LSP.
 * Features:
 * - LSP-based linked editing ranges (textDocument/linkedEditingRange)
 * - Used for synchronized editing of matching HTML/JSX tags
 * - Automatically renames closing tag when opening tag is edited and vice versa
 */

import type * as Monaco from "monaco-editor";
import type { Position, Range } from "@/context/LSPContext";

/**
 * Linked Editing Ranges response from LSP
 */
export interface LinkedEditingRanges {
  ranges: Range[];
  wordPattern?: string;
}

/**
 * Linked Editing Provider Options
 */
export interface LinkedEditingProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  getLinkedEditingRanges: (
    serverId: string,
    uri: string,
    position: Position
  ) => Promise<LinkedEditingRanges | null>;
  getCapabilities: () => { linkedEditingRangeProvider: boolean };
}

/**
 * Linked Editing Provider Result
 */
export interface LinkedEditingProviderResult {
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
 * Create fallback linked editing ranges for HTML/JSX tags
 * This provides basic tag synchronization when LSP is not available
 */
function createFallbackLinkedRanges(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition
): Monaco.languages.LinkedEditingRanges | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const column = position.column - 1;

  // Check if cursor is inside a tag name
  const beforeCursor = lineContent.substring(0, column);
  const afterCursor = lineContent.substring(column);

  // Match opening tag: <tagName or </tagName
  const openTagMatch = beforeCursor.match(/<\/?([a-zA-Z][a-zA-Z0-9-]*)?$/);
  const tagContinue = afterCursor.match(/^([a-zA-Z0-9-]*)/);

  if (!openTagMatch) {
    return null;
  }

  const tagPrefix = openTagMatch[1] || "";
  const tagSuffix = tagContinue ? tagContinue[1] : "";
  const fullTagName = tagPrefix + tagSuffix;

  if (!fullTagName) {
    return null;
  }

  const isClosingTag = openTagMatch[0].startsWith("</");
  const tagStartCol = column - tagPrefix.length;
  const tagEndCol = column + tagSuffix.length;

  // Find the matching tag
  const fullText = model.getValue();
  const currentTagRange: Monaco.IRange = {
    startLineNumber: position.lineNumber,
    startColumn: tagStartCol + 1,
    endLineNumber: position.lineNumber,
    endColumn: tagEndCol + 1,
  };

  // Simple regex-based matching (not perfect but works for common cases)
  const tagRegex = isClosingTag
    ? new RegExp(`<${fullTagName}(?:\\s|>|/>)`, "g")
    : new RegExp(`</${fullTagName}>`, "g");

  const ranges: Monaco.IRange[] = [currentTagRange];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(fullText)) !== null) {
    const matchPosition = model.getPositionAt(match.index + 1 + (isClosingTag ? 0 : 1));
    const matchRange: Monaco.IRange = {
      startLineNumber: matchPosition.lineNumber,
      startColumn: matchPosition.column,
      endLineNumber: matchPosition.lineNumber,
      endColumn: matchPosition.column + fullTagName.length,
    };

    // Don't add duplicate of current range
    if (
      matchRange.startLineNumber !== currentTagRange.startLineNumber ||
      matchRange.startColumn !== currentTagRange.startColumn
    ) {
      ranges.push(matchRange);
      break; // Only link to first match for simplicity
    }
  }

  if (ranges.length < 2) {
    return null;
  }

  return {
    ranges,
    wordPattern: /[a-zA-Z][a-zA-Z0-9-]*/,
  };
}

/**
 * Create a Monaco linked editing range provider for LSP integration
 */
export function createLinkedEditingProvider(
  options: LinkedEditingProviderOptions
): LinkedEditingProviderResult {
  const { monaco, languageId, serverId, filePath, getLinkedEditingRanges, getCapabilities } = options;

  const provider = monaco.languages.registerLinkedEditingRangeProvider(languageId, {
    async provideLinkedEditingRanges(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.LinkedEditingRanges | null> {
      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return null;
      }

      const capabilities = getCapabilities();

      // If LSP linked editing is available, use it
      if (capabilities.linkedEditingRangeProvider) {
        try {
          const lspPosition = toLSPPosition(position);
          const lspResult = await getLinkedEditingRanges(serverId, filePath, lspPosition);

          if (lspResult && lspResult.ranges.length > 0) {
            const monacoRanges = lspResult.ranges.map((r) => toMonacoRange(r));
            return {
              ranges: monacoRanges,
              wordPattern: lspResult.wordPattern
                ? new RegExp(lspResult.wordPattern)
                : undefined,
            };
          }
        } catch (e) {
          console.debug("LSP linked editing range error:", e);
          // Fall back to default implementation
        }
      }

      // Use fallback implementation for HTML/JSX when LSP is not available
      if (
        languageId === "html" ||
        languageId === "xml" ||
        languageId === "javascriptreact" ||
        languageId === "typescriptreact"
      ) {
        return createFallbackLinkedRanges(model, position);
      }

      return null;
    },
  });

  return {
    provider,
  };
}

/**
 * Languages that support linked editing
 */
export const LINKED_EDITING_LANGUAGES = [
  "html",
  "xml",
  "javascriptreact",
  "typescriptreact",
  "vue",
  "svelte",
] as const;

/**
 * Get editor options for linked editing
 */
export function getLinkedEditingEditorOptions(): Monaco.editor.IEditorOptions {
  return {
    linkedEditing: true,
  };
}
