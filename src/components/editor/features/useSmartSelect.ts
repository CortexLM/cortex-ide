/**
 * useSmartSelect Hook
 *
 * Extracted from CodeEditor.tsx - manages smart selection (expand/shrink)
 * using LSP selection ranges for semantic selection expansion.
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

interface LSPSelectionRange {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  parent?: LSPSelectionRange;
}

interface LSPSelectionRangeResponse {
  ranges: LSPSelectionRange[] | null;
}

export class SmartSelectManager {
  private selectionHistory: Map<string, Monaco.IRange[]> = new Map();
  private lastPosition: Map<string, { line: number; column: number }> = new Map();
  private cachedRanges: Map<string, LSPSelectionRange[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 2000;

  private getEditorKey(uri: string): string {
    return uri;
  }

  clearHistory(uri: string): void {
    const key = this.getEditorKey(uri);
    this.selectionHistory.delete(key);
    this.lastPosition.delete(key);
    this.cachedRanges.delete(key);
    this.cacheTimestamps.delete(key);
  }

  clearFileCache(uri: string): void {
    this.clearHistory(uri);
  }

  clearAllCaches(): void {
    this.selectionHistory.clear();
    this.lastPosition.clear();
    this.cachedRanges.clear();
    this.cacheTimestamps.clear();
  }

  pruneOldCaches(maxAge: number = 300000): void {
    const now = Date.now();
    for (const [uri, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > maxAge) {
        this.clearFileCache(uri);
      }
    }
  }

  private hasPositionChanged(uri: string, currentPos: { line: number; column: number }): boolean {
    const key = this.getEditorKey(uri);
    const lastPos = this.lastPosition.get(key);
    if (!lastPos) return true;
    return lastPos.line !== currentPos.line || lastPos.column !== currentPos.column;
  }

  private updatePosition(uri: string, pos: { line: number; column: number }): void {
    const key = this.getEditorKey(uri);
    this.lastPosition.set(key, { ...pos });
  }

  private pushToHistory(uri: string, range: Monaco.IRange): void {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];

    const lastRange = history[history.length - 1];
    if (
      lastRange &&
      lastRange.startLineNumber === range.startLineNumber &&
      lastRange.startColumn === range.startColumn &&
      lastRange.endLineNumber === range.endLineNumber &&
      lastRange.endColumn === range.endColumn
    ) {
      return;
    }

    history.push({ ...range });
    this.selectionHistory.set(key, history);
  }

  private popFromHistory(uri: string): Monaco.IRange | null {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];

    if (history.length <= 1) {
      return null;
    }

    history.pop();
    this.selectionHistory.set(key, history);

    return history[history.length - 1] || null;
  }

  private async getSelectionRanges(
    uri: string,
    position: { line: number; character: number }
  ): Promise<LSPSelectionRange[] | null> {
    const key = this.getEditorKey(uri);
    const now = Date.now();
    const cachedTimestamp = this.cacheTimestamps.get(key);

    if (cachedTimestamp && now - cachedTimestamp < this.CACHE_TTL_MS) {
      return this.cachedRanges.get(key) || null;
    }

    try {
      const response = await invoke<LSPSelectionRangeResponse>("lsp_selection_range", {
        params: {
          uri,
          positions: [position],
        },
      });

      if (response?.ranges && response.ranges.length > 0) {
        this.cachedRanges.set(key, response.ranges);
        this.cacheTimestamps.set(key, now);
        return response.ranges;
      }
    } catch (error) {
      console.debug("LSP selection range not available:", error);
    }

    return null;
  }

  private flattenSelectionRanges(lspRange: LSPSelectionRange): Monaco.IRange[] {
    const ranges: Monaco.IRange[] = [];
    let current: LSPSelectionRange | undefined = lspRange;

    while (current) {
      ranges.push({
        startLineNumber: current.range.start.line + 1,
        startColumn: current.range.start.character + 1,
        endLineNumber: current.range.end.line + 1,
        endColumn: current.range.end.character + 1,
      });
      current = current.parent;
    }

    return ranges;
  }

  private findNextLargerRange(
    currentSelection: Monaco.IRange,
    availableRanges: Monaco.IRange[]
  ): Monaco.IRange | null {
    for (const range of availableRanges) {
      const containsCurrent =
        (range.startLineNumber < currentSelection.startLineNumber ||
          (range.startLineNumber === currentSelection.startLineNumber &&
            range.startColumn <= currentSelection.startColumn)) &&
        (range.endLineNumber > currentSelection.endLineNumber ||
          (range.endLineNumber === currentSelection.endLineNumber &&
            range.endColumn >= currentSelection.endColumn));

      const isLarger =
        range.startLineNumber < currentSelection.startLineNumber ||
        range.startColumn < currentSelection.startColumn ||
        range.endLineNumber > currentSelection.endLineNumber ||
        range.endColumn > currentSelection.endColumn;

      if (containsCurrent && isLarger) {
        return range;
      }
    }
    return null;
  }

  async expandSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ): Promise<void> {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();
    const position = selection.getStartPosition();
    const currentPos = { line: position.lineNumber, column: position.column };

    if (this.hasPositionChanged(uri, currentPos)) {
      this.clearHistory(uri);
    }
    this.updatePosition(uri, currentPos);

    const currentRange: Monaco.IRange = {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    };

    this.pushToHistory(uri, currentRange);

    const lspRanges = await this.getSelectionRanges(uri, {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });

    let nextRange: Monaco.IRange | null = null;

    if (lspRanges && lspRanges.length > 0) {
      const flatRanges = this.flattenSelectionRanges(lspRanges[0]);
      nextRange = this.findNextLargerRange(currentRange, flatRanges);
    }

    if (!nextRange) {
      const hasSelection =
        selection.startLineNumber !== selection.endLineNumber ||
        selection.startColumn !== selection.endColumn;

      if (!hasSelection) {
        const wordAtPosition = model.getWordAtPosition(position);
        if (wordAtPosition) {
          nextRange = {
            startLineNumber: position.lineNumber,
            startColumn: wordAtPosition.startColumn,
            endLineNumber: position.lineNumber,
            endColumn: wordAtPosition.endColumn,
          };
        }
      }

      if (!nextRange) {
        nextRange = {
          startLineNumber: selection.startLineNumber,
          startColumn: 1,
          endLineNumber: selection.endLineNumber,
          endColumn: model.getLineMaxColumn(selection.endLineNumber),
        };
      }
    }

    if (nextRange) {
      this.pushToHistory(uri, nextRange);
      editor.setSelection(
        new monaco.Selection(
          nextRange.startLineNumber,
          nextRange.startColumn,
          nextRange.endLineNumber,
          nextRange.endColumn
        )
      );
    }
  }

  async shrinkSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ): Promise<void> {
    const model = editor.getModel();
    if (!model) return;

    const uri = model.uri.toString();
    const previousRange = this.popFromHistory(uri);

    if (previousRange) {
      editor.setSelection(
        new monaco.Selection(
          previousRange.startLineNumber,
          previousRange.startColumn,
          previousRange.endLineNumber,
          previousRange.endColumn
        )
      );
    }
  }
}

export function createSmartSelectManager(): SmartSelectManager {
  return new SmartSelectManager();
}

export function registerSmartSelectActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  manager: SmartSelectManager
): Monaco.IDisposable[] {
  const disposables: Monaco.IDisposable[] = [];

  disposables.push(
    editor.addAction({
      id: "editor.action.smartSelect.expand",
      label: "Expand Selection",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.RightArrow],
      run: async () => {
        await manager.expandSelection(editor, monaco);
      },
    })
  );

  disposables.push(
    editor.addAction({
      id: "editor.action.smartSelect.shrink",
      label: "Shrink Selection",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.LeftArrow],
      run: async () => {
        await manager.shrinkSelection(editor, monaco);
      },
    })
  );

  return disposables;
}
