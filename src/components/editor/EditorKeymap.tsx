/**
 * EditorKeymap - Renderless SolidJS component for editor keybinding/action registration.
 *
 * Extracts ALL keybinding and action registration from CodeEditor.tsx into a
 * dedicated component. Registers editor actions, commands, and event handlers
 * when the editor and monaco instances become available, and disposes them
 * on cleanup.
 */

import { createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useEditor, type OpenFile } from "@/context/EditorContext";
import { invoke } from "@tauri-apps/api/core";
import {
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toConstantCase,
} from "./modules/EditorUtils";
import { toggleInlineBlame, setInlineBlameMode } from "./InlineBlame";
import {
  showPeekWidget,
  hidePeekWidget,
  type PeekLocation,
} from "./PeekWidget";
import { showPeekReferences } from "./PeekReferences";
import { showReferencesPanel } from "../ReferencesPanel";
import { showRenameWidget } from "./RenameWidget";
import { goToNextChange, goToPrevChange } from "./GitGutterDecorations";
import {
  expandEmmetAbbreviation,
  getAbbreviationRange,
} from "@/utils/emmet";
import {
  updateInlayHintSettings,
  getInlayHintSettings,
  updateUnicodeHighlightSettings,
  getUnicodeHighlightSettings,
} from "./modules/EditorLSP";

// ============================================================================
// LSP Selection Range Types
// ============================================================================

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

// ============================================================================
// Smart Select Manager
// ============================================================================

class SmartSelectManager {
  private selectionHistory: Map<string, Monaco.IRange[]> = new Map();
  private lastPosition: Map<string, { line: number; column: number }> =
    new Map();
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

  private hasPositionChanged(
    uri: string,
    currentPos: { line: number; column: number },
  ): boolean {
    const key = this.getEditorKey(uri);
    const lastPos = this.lastPosition.get(key);
    if (!lastPos) return true;
    return (
      lastPos.line !== currentPos.line || lastPos.column !== currentPos.column
    );
  }

  private updatePosition(
    uri: string,
    pos: { line: number; column: number },
  ): void {
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
    position: { line: number; character: number },
  ): Promise<LSPSelectionRange[] | null> {
    const key = this.getEditorKey(uri);
    const now = Date.now();
    const cachedTimestamp = this.cacheTimestamps.get(key);

    if (cachedTimestamp && now - cachedTimestamp < this.CACHE_TTL_MS) {
      return this.cachedRanges.get(key) || null;
    }

    try {
      const response = await invoke<LSPSelectionRangeResponse>(
        "lsp_selection_range",
        {
          params: {
            uri,
            positions: [position],
          },
        },
      );

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

  private flattenSelectionRanges(
    lspRange: LSPSelectionRange,
    _monaco: typeof Monaco,
  ): Monaco.IRange[] {
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
    availableRanges: Monaco.IRange[],
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
    monaco: typeof Monaco,
  ): Promise<void> {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();
    const position = selection.getPosition();

    if (
      this.hasPositionChanged(uri, {
        line: position.lineNumber,
        column: position.column,
      })
    ) {
      this.clearHistory(uri);
    }

    this.pushToHistory(uri, {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    });

    const lspRanges = await this.getSelectionRanges(uri, {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });

    if (lspRanges && lspRanges.length > 0) {
      const flatRanges = this.flattenSelectionRanges(lspRanges[0], monaco);
      const nextRange = this.findNextLargerRange(
        {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        flatRanges,
      );

      if (nextRange) {
        editor.setSelection(
          new monaco.Selection(
            nextRange.startLineNumber,
            nextRange.startColumn,
            nextRange.endLineNumber,
            nextRange.endColumn,
          ),
        );
        this.pushToHistory(uri, nextRange);
        this.updatePosition(uri, {
          line: position.lineNumber,
          column: position.column,
        });
        return;
      }
    }

    editor.trigger("smartSelect", "editor.action.smartSelect.expand", null);

    const newSelection = editor.getSelection();
    if (newSelection) {
      this.pushToHistory(uri, {
        startLineNumber: newSelection.startLineNumber,
        startColumn: newSelection.startColumn,
        endLineNumber: newSelection.endLineNumber,
        endColumn: newSelection.endColumn,
      });
    }
    this.updatePosition(uri, {
      line: position.lineNumber,
      column: position.column,
    });
  }

  shrinkSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): void {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();

    const previousRange = this.popFromHistory(uri);

    if (previousRange) {
      editor.setSelection(
        new monaco.Selection(
          previousRange.startLineNumber,
          previousRange.startColumn,
          previousRange.endLineNumber,
          previousRange.endColumn,
        ),
      );
      return;
    }

    editor.trigger("smartSelect", "editor.action.smartSelect.shrink", null);
  }
}

const smartSelectManager = new SmartSelectManager();

let formatOnPasteEnabled = false;

function updateFormatOnPasteEnabled(enabled: boolean): void {
  formatOnPasteEnabled = enabled;
}

// ============================================================================
// Props
// ============================================================================

export interface EditorKeymapProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  activeFile: () => OpenFile | undefined;
  settingsState: any;
  updateEditorSetting: any;
  testing: any;
}

// ============================================================================
// Component
// ============================================================================

export function EditorKeymap(props: EditorKeymapProps): null {
  const { updateFileContent, saveFile, updateCursorInfo } = useEditor();

  const disposables: Monaco.IDisposable[] = [];
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    // Dispose previous registrations
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;
    if (keydownHandler) {
      window.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }

    // ========================================================================
    // Critical (sync) actions
    // ========================================================================

    const openIDECommandPalette = () => {
      window.dispatchEvent(new CustomEvent("command-palette:toggle"));
    };

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      openIDECommandPalette,
    );

    editor.addCommand(monaco.KeyCode.F1, openIDECommandPalette);

    const originalTrigger = editor.trigger.bind(editor);
    editor.trigger = (
      source: string,
      handlerId: string,
      payload: any,
    ) => {
      if (handlerId === "editor.action.quickCommand") {
        openIDECommandPalette();
        return;
      }
      return originalTrigger(source, handlerId, payload);
    };

    const originalGetAction = editor.getAction.bind(editor);
    editor.getAction = (
      id: string,
    ): Monaco.editor.IEditorAction | null => {
      if (id === "editor.action.quickCommand") {
        return {
          id: "editor.action.quickCommand",
          label: "Command Palette",
          alias: "",
          isSupported: () => true,
          run: openIDECommandPalette,
        } as Monaco.editor.IEditorAction;
      }
      return originalGetAction(id);
    };

    disposables.push(
      editor.addAction({
        id: "toggle-line-comment",
        label: "Toggle Line Comment",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.commentLine", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-block-comment",
        label: "Toggle Block Comment",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.Slash,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.blockComment", null);
        },
      }),
    );

    // ========================================================================
    // Deferred actions
    // ========================================================================

    disposables.push(
      editor.addAction({
        id: "toggle-word-wrap",
        label: "Toggle Word Wrap",
        keybindings: [
          monaco.KeyMod.Alt | monaco.KeyCode.KeyZ,
        ],
        run: (ed) => {
          const currentWrap = ed.getOption(
            monaco.editor.EditorOption.wordWrap,
          );
          ed.updateOptions({
            wordWrap: currentWrap === "off" ? "on" : "off",
          });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-minimap",
        label: "Toggle Minimap",
        run: (ed) => {
          const currentOption = ed.getOption(
            monaco.editor.EditorOption.minimap,
          );
          ed.updateOptions({
            minimap: { enabled: !currentOption.enabled },
          });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-sticky-scroll",
        label: "Toggle Sticky Scroll",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.KeyY,
        ],
        run: (ed) => {
          const currentOption = ed.getOption(
            monaco.editor.EditorOption.stickyScroll,
          );
          const newEnabled = !currentOption.enabled;
          ed.updateOptions({
            stickyScroll: { enabled: newEnabled, maxLineCount: 5 },
          });
          props.updateEditorSetting("stickyScrollEnabled", newEnabled);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-bracket-colorization",
        label: "Toggle Bracket Pair Colorization",
        run: (ed) => {
          const currentOption = ed.getOption(
            monaco.editor.EditorOption.bracketPairColorization,
          );
          const newEnabled = !currentOption.enabled;
          ed.updateOptions({
            bracketPairColorization: {
              enabled: newEnabled,
              independentColorPoolPerBracketType: true,
            },
          });
          props.updateEditorSetting("bracketPairColorization", newEnabled);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-bracket-guides",
        label: "Toggle Bracket Pair Guides",
        run: (ed) => {
          const currentOption = ed.getOption(
            monaco.editor.EditorOption.guides,
          );
          const newEnabled = !currentOption.bracketPairs;
          ed.updateOptions({
            guides: {
              ...currentOption,
              bracketPairs: newEnabled,
              bracketPairsHorizontal: newEnabled,
            },
          });
          props.updateEditorSetting("guidesBracketPairs", newEnabled);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-indentation-guides",
        label: "Toggle Indentation Guides",
        run: (ed) => {
          const currentOption = ed.getOption(
            monaco.editor.EditorOption.guides,
          );
          const newEnabled = !currentOption.indentation;
          ed.updateOptions({
            guides: {
              ...currentOption,
              indentation: newEnabled,
              highlightActiveIndentation: newEnabled,
            },
          });
          props.updateEditorSetting("guidesIndentation", newEnabled);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-inlay-hints",
        label: "Toggle Inlay Hints",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Alt |
            monaco.KeyCode.KeyI,
        ],
        run: (ed) => {
          const currentOption = ed.getOption(
            monaco.editor.EditorOption.inlayHints,
          );
          const currentEnabled = currentOption.enabled;
          const newEnabled: "on" | "off" =
            currentEnabled === "on" ? "off" : "on";
          ed.updateOptions({
            inlayHints: {
              ...currentOption,
              enabled: newEnabled,
            },
          });
          updateInlayHintSettings({ enabled: newEnabled });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-inlay-hints-parameter-names",
        label: "Toggle Inlay Hints: Parameter Names",
        run: () => {
          const newValue = !getInlayHintSettings().showParameterNames;
          updateInlayHintSettings({ showParameterNames: newValue });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-inlay-hints-type-hints",
        label: "Toggle Inlay Hints: Type Hints",
        run: () => {
          const newValue = !getInlayHintSettings().showTypeHints;
          updateInlayHintSettings({ showTypeHints: newValue });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-unicode-highlight",
        label: "Toggle Unicode Highlighting",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.KeyU,
        ],
        run: (ed) => {
          const newEnabled = !getUnicodeHighlightSettings().enabled;
          updateUnicodeHighlightSettings({ enabled: newEnabled });
          ed.updateOptions({
            unicodeHighlight: {
              ambiguousCharacters: newEnabled
                ? getUnicodeHighlightSettings().ambiguousCharacters
                : false,
              invisibleCharacters: newEnabled
                ? getUnicodeHighlightSettings().invisibleCharacters
                : false,
              nonBasicASCII: newEnabled
                ? getUnicodeHighlightSettings().nonBasicASCII
                : false,
            },
          });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-unicode-highlight-invisible",
        label: "Toggle Unicode Highlight: Invisible Characters",
        run: (ed) => {
          const newValue =
            !getUnicodeHighlightSettings().invisibleCharacters;
          updateUnicodeHighlightSettings({ invisibleCharacters: newValue });
          ed.updateOptions({
            unicodeHighlight: { invisibleCharacters: newValue },
          });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-unicode-highlight-ambiguous",
        label:
          "Toggle Unicode Highlight: Ambiguous Characters (Homoglyphs)",
        run: (ed) => {
          const newValue =
            !getUnicodeHighlightSettings().ambiguousCharacters;
          updateUnicodeHighlightSettings({ ambiguousCharacters: newValue });
          ed.updateOptions({
            unicodeHighlight: { ambiguousCharacters: newValue },
          });
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "format-document",
        label: "Format Document",
        keybindings: [
          monaco.KeyMod.Shift |
            monaco.KeyMod.Alt |
            monaco.KeyCode.KeyF,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.formatDocument", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-format-on-paste",
        label: "Toggle Format on Paste",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.KeyV,
        ],
        run: () => {
          const newEnabled = !formatOnPasteEnabled;
          updateFormatOnPasteEnabled(newEnabled);
          props.updateEditorSetting("formatOnPaste", newEnabled);
          window.dispatchEvent(
            new CustomEvent("editor-format-on-paste-changed", {
              detail: { enabled: newEnabled },
            }),
          );
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "indent-lines",
        label: "Indent Lines",
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.indentLines", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "outdent-lines",
        label: "Outdent Lines",
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.outdentLines", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.action.joinLines",
        label: "Join Lines",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ,
        ],
        run: (ed) => {
          const edModel = ed.getModel();
          if (!edModel) return;

          const selections = ed.getSelections();
          if (!selections) return;

          ed.pushUndoStop();

          const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];

          for (const selection of selections) {
            const startLine = selection.startLineNumber;
            const endLine =
              selection.endLineNumber === startLine
                ? startLine + 1
                : selection.endLineNumber;

            for (
              let line = startLine;
              line < endLine && line < edModel.getLineCount();
              line++
            ) {
              const currentLineEnd = edModel.getLineMaxColumn(line);
              const nextLineStart = edModel.getLineFirstNonWhitespaceColumn(
                line + 1,
              );

              edits.push({
                range: {
                  startLineNumber: line,
                  startColumn: currentLineEnd,
                  endLineNumber: line + 1,
                  endColumn: nextLineStart || 1,
                },
                text: " ",
              });
            }
          }

          ed.executeEdits("joinLines", edits);
          ed.pushUndoStop();
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-coverage-decorations",
        label: "Toggle Test Coverage Decorations",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.KeyC,
        ],
        run: () => {
          props.testing.toggleCoverageDecorations();
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "toggle-inline-blame",
        label: "Toggle Inline Git Blame",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Alt |
            monaco.KeyCode.KeyB,
        ],
        run: () => {
          toggleInlineBlame();
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "inline-blame-current-line",
        label: "Inline Blame: Show Current Line Only",
        run: () => {
          setInlineBlameMode("currentLine");
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "inline-blame-all-lines",
        label: "Inline Blame: Show All Lines",
        run: () => {
          setInlineBlameMode("allLines");
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "inline-blame-off",
        label: "Inline Blame: Turn Off",
        run: () => {
          setInlineBlameMode("off");
        },
      }),
    );

    // Fold/Unfold actions
    disposables.push(
      editor.addAction({
        id: "editor.foldAll",
        label: "Fold All",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.BracketLeft,
        ],
        run: (ed) => ed.trigger("keyboard", "editor.foldAll", null),
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.unfoldAll",
        label: "Unfold All",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.BracketRight,
        ],
        run: (ed) =>
          ed.trigger("keyboard", "editor.unfoldAll", null),
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.toggleFold",
        label: "Toggle Fold",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyCode.BracketLeft,
        ],
        run: (ed) =>
          ed.trigger("keyboard", "editor.toggleFold", null),
      }),
    );

    for (let level = 1; level <= 7; level++) {
      disposables.push(
        editor.addAction({
          id: `editor.foldLevel${level}`,
          label: `Fold Level ${level}`,
          keybindings: [
            monaco.KeyMod.CtrlCmd |
              monaco.KeyCode[
                `Digit${level}` as keyof typeof Monaco.KeyCode
              ],
          ],
          run: (ed) =>
            ed.trigger("keyboard", `editor.foldLevel${level}`, null),
        }),
      );
    }

    disposables.push(
      editor.addAction({
        id: "editor.foldAllBlockComments",
        label: "Fold All Block Comments",
        run: (ed) =>
          ed.trigger("keyboard", "editor.foldAllBlockComments", null),
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.foldAllMarkerRegions",
        label: "Fold All Regions",
        run: (ed) =>
          ed.trigger("keyboard", "editor.foldAllMarkerRegions", null),
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.unfoldAllMarkerRegions",
        label: "Unfold All Regions",
        run: (ed) =>
          ed.trigger("keyboard", "editor.unfoldAllMarkerRegions", null),
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.foldRecursively",
        label: "Fold Recursively",
        run: (ed) =>
          ed.trigger("keyboard", "editor.foldRecursively", null),
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.unfoldRecursively",
        label: "Unfold Recursively",
        run: (ed) =>
          ed.trigger("keyboard", "editor.unfoldRecursively", null),
      }),
    );

    // Peek Definition (deferred section)
    disposables.push(
      editor.addAction({
        id: "editor.action.peekDefinition",
        label: "Peek Definition",
        keybindings: [
          monaco.KeyMod.Alt | monaco.KeyCode.F12,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.peekDefinition", null);
        },
      }),
    );

    // Peek References (Shift+F12)
    disposables.push(
      editor.addAction({
        id: "editor.action.referenceSearch.trigger",
        label: "Peek References",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyCode.F12,
        ],
        run: async (ed) => {
          const edModel = ed.getModel();
          const position = ed.getPosition();
          if (!edModel || !position) return;

          const uri = edModel.uri.toString();
          const filePath = uri.replace("file://", "");
          const languageId = edModel.getLanguageId();

          const wordInfo = edModel.getWordAtPosition(position);
          const symbolName = wordInfo?.word || "";

          try {
            const result = await invoke<{
              locations: Array<{
                uri: string;
                range: {
                  start: { line: number; character: number };
                  end: { line: number; character: number };
                };
              }>;
            }>("lsp_multi_references", {
              language: languageId,
              params: {
                uri: filePath,
                position: {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                },
              },
            });

            if (
              !result ||
              !result.locations ||
              result.locations.length === 0
            ) {
              const standardResult = await invoke<{
                locations: Array<{
                  uri: string;
                  range: {
                    start: { line: number; character: number };
                    end: { line: number; character: number };
                  };
                }>;
              }>("lsp_references", {
                serverId: languageId,
                params: {
                  uri: filePath,
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                },
              });

              if (
                !standardResult ||
                !standardResult.locations ||
                standardResult.locations.length === 0
              ) {
                console.debug("No references found for peek");
                return;
              }

              const locations = standardResult.locations.map((loc) => ({
                uri: loc.uri.startsWith("file://")
                  ? loc.uri
                  : `file://${loc.uri}`,
                range: {
                  start: {
                    line: loc.range.start.line,
                    character: loc.range.start.character,
                  },
                  end: {
                    line: loc.range.end.line,
                    character: loc.range.end.character,
                  },
                },
              }));

              showPeekReferences(locations, symbolName, position, uri);
              return;
            }

            const locations = result.locations.map((loc) => ({
              uri: loc.uri.startsWith("file://")
                ? loc.uri
                : `file://${loc.uri}`,
              range: {
                start: {
                  line: loc.range.start.line,
                  character: loc.range.start.character,
                },
                end: {
                  line: loc.range.end.line,
                  character: loc.range.end.character,
                },
              },
            }));

            showPeekReferences(locations, symbolName, position, uri);
          } catch (error) {
            console.error("Failed to get references for peek:", error);
          }
        },
      }),
    );

    // Find All References (Shift+Alt+F12)
    disposables.push(
      editor.addAction({
        id: "editor.action.findAllReferences",
        label: "Find All References",
        keybindings: [
          monaco.KeyMod.Shift |
            monaco.KeyMod.Alt |
            monaco.KeyCode.F12,
        ],
        run: async (ed) => {
          const edModel = ed.getModel();
          const position = ed.getPosition();
          if (!edModel || !position) return;

          const uri = edModel.uri.toString();
          const filePath = uri.replace("file://", "");
          const languageId = edModel.getLanguageId();

          const wordInfo = edModel.getWordAtPosition(position);
          const symbolName = wordInfo?.word || "";

          try {
            const result = await invoke<{
              locations: Array<{
                uri: string;
                range: {
                  start: { line: number; character: number };
                  end: { line: number; character: number };
                };
              }>;
            }>("lsp_multi_references", {
              language: languageId,
              params: {
                uri: filePath,
                position: {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                },
              },
            });

            if (
              !result ||
              !result.locations ||
              result.locations.length === 0
            ) {
              const standardResult = await invoke<{
                locations: Array<{
                  uri: string;
                  range: {
                    start: { line: number; character: number };
                    end: { line: number; character: number };
                  };
                }>;
              }>("lsp_references", {
                serverId: languageId,
                params: {
                  uri: filePath,
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                },
              });

              if (
                !standardResult ||
                !standardResult.locations ||
                standardResult.locations.length === 0
              ) {
                console.debug("No references found");
                return;
              }

              const locations = standardResult.locations.map((loc) => ({
                uri: loc.uri.startsWith("file://")
                  ? loc.uri
                  : `file://${loc.uri}`,
                range: {
                  start: {
                    line: loc.range.start.line,
                    character: loc.range.start.character,
                  },
                  end: {
                    line: loc.range.end.line,
                    character: loc.range.end.character,
                  },
                },
              }));

              showReferencesPanel(locations, symbolName, uri, {
                line: position.lineNumber - 1,
                character: position.column - 1,
              });
              return;
            }

            const locations = result.locations.map((loc) => ({
              uri: loc.uri.startsWith("file://")
                ? loc.uri
                : `file://${loc.uri}`,
              range: {
                start: {
                  line: loc.range.start.line,
                  character: loc.range.start.character,
                },
                end: {
                  line: loc.range.end.line,
                  character: loc.range.end.character,
                },
              },
            }));

            showReferencesPanel(locations, symbolName, uri, {
              line: position.lineNumber - 1,
              character: position.column - 1,
            });
          } catch (error) {
            console.error("Failed to find all references:", error);
          }
        },
      }),
    );

    // Peek Implementation (Ctrl+Shift+F12)
    disposables.push(
      editor.addAction({
        id: "editor.action.peekImplementation",
        label: "Peek Implementation",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyCode.F12,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.peekImplementation", null);
        },
      }),
    );

    // Content change handler
    disposables.push(
      editor.onDidChangeModelContent(() => {
        const currentFile = props.activeFile();
        if (!currentFile) return;
        const content = editor.getValue();
        updateFileContent(currentFile.id, content);
      }),
    );

    // Cursor position handler
    disposables.push(
      editor.onDidChangeCursorPosition((e) => {
        const selections = editor.getSelections() || [];
        const cursorCount = selections.length;
        const selectionCount = selections.filter(
          (s) => !s.isEmpty(),
        ).length;

        updateCursorInfo(cursorCount, selectionCount);

        const position = e.position;
        const currentFile = props.activeFile();
        window.dispatchEvent(
          new CustomEvent("editor-cursor-change", {
            detail: {
              line: position.lineNumber,
              column: position.column,
              cursorCount,
              selectionCount,
            },
          }),
        );

        if (
          currentFile &&
          monaco &&
          e.reason === monaco.editor.CursorChangeReason.Explicit
        ) {
          window.dispatchEvent(
            new CustomEvent("editor:cursor-changed", {
              detail: {
                filePath: currentFile.path,
                line: position.lineNumber,
                column: position.column,
              },
            }),
          );
        }
      }),
    );

    // Cursor selection handler
    disposables.push(
      editor.onDidChangeCursorSelection(() => {
        const selections = editor.getSelections() || [];
        const cursorCount = selections.length;
        const selectionCount = selections.filter(
          (s) => !s.isEmpty(),
        ).length;
        updateCursorInfo(cursorCount, selectionCount);
      }),
    );

    // Save command (Ctrl+S)
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        const currentFile = props.activeFile();
        if (currentFile) saveFile(currentFile.id);
      },
    );

    // Emmet abbreviation expansion on Tab
    editor.addCommand(
      monaco.KeyCode.Tab,
      () => {
        const position = editor.getPosition();
        if (!position) {
          editor.trigger("keyboard", "tab", null);
          return;
        }
        const edModel = editor.getModel();
        if (!edModel) {
          editor.trigger("keyboard", "tab", null);
          return;
        }
        const language = edModel.getLanguageId();
        const range = getAbbreviationRange(
          edModel,
          position,
          monaco,
        );
        if (!range) {
          editor.trigger("keyboard", "tab", null);
          return;
        }
        const abbreviation = edModel.getValueInRange(range);
        const expanded = expandEmmetAbbreviation(abbreviation, language);
        if (expanded) {
          editor.executeEdits("emmet", [
            { range, text: expanded },
          ]);
        } else {
          editor.trigger("keyboard", "tab", null);
        }
      },
      "editorTextFocus && !suggestWidgetVisible && !inSnippetMode",
    );

    // Rename Symbol (F2)
    disposables.push(
      editor.addAction({
        id: "editor.action.rename",
        label: "Rename Symbol",
        keybindings: [monaco.KeyCode.F2],
        run: () => {
          showRenameWidget();
        },
      }),
    );

    // ========================================================================
    // Multi-cursor actions
    // ========================================================================

    disposables.push(
      editor.addAction({
        id: "add-cursor-above",
        label: "Add Cursor Above",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.insertCursorAbove", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "add-cursor-below",
        label: "Add Cursor Below",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.insertCursorBelow", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "select-all-occurrences",
        label: "Select All Occurrences",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.selectHighlights", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "add-selection-to-next-find-match",
        label: "Add Selection to Next Find Match",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
        run: (ed) => {
          ed.trigger(
            "keyboard",
            "editor.action.addSelectionToNextFindMatch",
            null,
          );
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "add-cursors-to-line-ends",
        label: "Add Cursors to Line Ends",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyI,
        ],
        run: (ed) => {
          ed.trigger(
            "keyboard",
            "editor.action.insertCursorAtEndOfEachLineSelected",
            null,
          );
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "expand-selection",
        label: "Expand Selection",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
        ],
        run: async (ed) => {
          await smartSelectManager.expandSelection(
            ed as Monaco.editor.IStandaloneCodeEditor,
            monaco,
          );
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "shrink-selection",
        label: "Shrink Selection",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
        ],
        run: (ed) => {
          smartSelectManager.shrinkSelection(
            ed as Monaco.editor.IStandaloneCodeEditor,
            monaco,
          );
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "undo-cursor",
        label: "Undo Last Cursor Operation",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU],
        run: (ed) => {
          ed.trigger("keyboard", "cursorUndo", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "remove-secondary-cursors",
        label: "Remove Secondary Cursors",
        keybindings: [monaco.KeyCode.Escape],
        precondition: "hasMultipleSelections",
        run: (ed) => {
          const selections = ed.getSelections();
          if (selections && selections.length > 1) {
            ed.setSelection(selections[0]);
          }
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "select-line",
        label: "Select Line",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
        run: (ed) => {
          ed.trigger("keyboard", "expandLineSelection", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "move-line-up",
        label: "Move Line Up",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.moveLinesUpAction", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "move-line-down",
        label: "Move Line Down",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.moveLinesDownAction", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "copy-line-up",
        label: "Copy Line Up",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.copyLinesUpAction", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "copy-line-down",
        label: "Copy Line Down",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.copyLinesDownAction", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "duplicate-selection",
        label: "Duplicate Selection",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD,
        ],
        run: (ed) => {
          const selections = ed.getSelections();
          if (!selections || selections.length === 0) return;

          const edModel = ed.getModel();
          if (!edModel) return;

          const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
          const newSelections: Monaco.Selection[] = [];

          selections.forEach((selection) => {
            const text = edModel.getValueInRange(selection);

            if (selection.isEmpty()) {
              const lineNumber = selection.startLineNumber;
              const lineContent = edModel.getLineContent(lineNumber);
              const lineEndColumn = edModel.getLineMaxColumn(lineNumber);

              edits.push({
                range: new monaco.Range(
                  lineNumber,
                  lineEndColumn,
                  lineNumber,
                  lineEndColumn,
                ),
                text: "\n" + lineContent,
              });

              newSelections.push(
                new monaco.Selection(
                  lineNumber + 1,
                  selection.startColumn,
                  lineNumber + 1,
                  selection.endColumn,
                ),
              );
            } else {
              edits.push({
                range: new monaco.Range(
                  selection.endLineNumber,
                  selection.endColumn,
                  selection.endLineNumber,
                  selection.endColumn,
                ),
                text: text,
              });

              const linesAdded = text.split("\n").length - 1;
              const newStartLine = selection.endLineNumber;
              const newStartColumn = selection.endColumn;

              newSelections.push(
                new monaco.Selection(
                  newStartLine,
                  newStartColumn,
                  newStartLine + linesAdded,
                  linesAdded > 0
                    ? text.split("\n").pop()!.length + 1
                    : newStartColumn + text.length,
                ),
              );
            }
          });

          ed.executeEdits("duplicate-selection", edits);
          ed.setSelections(newSelections);
        },
      }),
    );

    // Text transforms (built-in)
    disposables.push(
      editor.addAction({
        id: "transform-to-uppercase",
        label: "Transform to Uppercase",
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.transformToUppercase", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "transform-to-lowercase",
        label: "Transform to Lowercase",
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.transformToLowercase", null);
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "transform-to-titlecase",
        label: "Transform to Title Case",
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.transformToTitlecase", null);
        },
      }),
    );

    // Custom text case transforms
    const textTransforms = [
      {
        id: "transform-to-snakecase",
        label: "Transform to snake_case",
        fn: toSnakeCase,
      },
      {
        id: "transform-to-camelcase",
        label: "Transform to camelCase",
        fn: toCamelCase,
      },
      {
        id: "transform-to-pascalcase",
        label: "Transform to PascalCase",
        fn: toPascalCase,
      },
      {
        id: "transform-to-kebabcase",
        label: "Transform to kebab-case",
        fn: toKebabCase,
      },
      {
        id: "transform-to-constantcase",
        label: "Transform to CONSTANT_CASE",
        fn: toConstantCase,
      },
    ];

    for (const { id, label, fn } of textTransforms) {
      disposables.push(
        editor.addAction({
          id,
          label,
          run: (ed) => {
            const selections = ed.getSelections();
            if (!selections) return;

            const edModel = ed.getModel();
            if (!edModel) return;

            ed.pushUndoStop();

            const edits = selections.map((sel) => ({
              range: sel,
              text: fn(edModel.getValueInRange(sel)),
            }));

            ed.executeEdits("transform", edits);
            ed.pushUndoStop();
          },
        }),
      );
    }

    // Column selection via mouse
    let isColumnSelecting = false;
    let columnSelectStart: { lineNumber: number; column: number } | null = null;

    disposables.push(
      editor.onMouseDown((e) => {
        if (e.event.shiftKey && e.event.altKey && e.target.position) {
          isColumnSelecting = true;
          columnSelectStart = e.target.position;
        }
      }),
    );

    disposables.push(
      editor.onMouseMove((e) => {
        if (isColumnSelecting && columnSelectStart && e.target.position) {
          const startLine = Math.min(
            columnSelectStart.lineNumber,
            e.target.position.lineNumber,
          );
          const endLine = Math.max(
            columnSelectStart.lineNumber,
            e.target.position.lineNumber,
          );
          const startColumn = Math.min(
            columnSelectStart.column,
            e.target.position.column,
          );
          const endColumn = Math.max(
            columnSelectStart.column,
            e.target.position.column,
          );

          const selections: Monaco.Selection[] = [];
          for (let line = startLine; line <= endLine; line++) {
            selections.push(
              new monaco.Selection(line, startColumn, line, endColumn),
            );
          }

          if (selections.length > 0) {
            editor.setSelections(selections);
          }
        }
      }),
    );

    disposables.push(
      editor.onMouseUp(() => {
        isColumnSelecting = false;
        columnSelectStart = null;
      }),
    );

    // Window keydown handler for multi-cursor shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
        e.preventDefault();
        editor.trigger("keyboard", "editor.action.selectHighlights", null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        editor.trigger(
          "keyboard",
          "editor.action.addSelectionToNextFindMatch",
          null,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    keydownHandler = handleKeyDown;

    disposables.push(
      editor.onDidDispose(() => {
        window.removeEventListener("keydown", handleKeyDown);
      }),
    );

    // Git diff navigation
    disposables.push(
      editor.addAction({
        id: "editor.action.dirtydiff.next",
        label: "Go to Next Change",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F3],
        run: () => {
          const file = props.activeFile();
          if (file?.path) {
            goToNextChange(editor, file.path);
          }
        },
      }),
    );

    disposables.push(
      editor.addAction({
        id: "editor.action.dirtydiff.previous",
        label: "Go to Previous Change",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F3,
        ],
        run: () => {
          const file = props.activeFile();
          if (file?.path) {
            goToPrevChange(editor, file.path);
          }
        },
      }),
    );

    // Go to Bracket
    disposables.push(
      editor.addAction({
        id: "editor.action.jumpToBracket",
        label: "Go to Bracket",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backslash,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.jumpToBracket", null);
        },
      }),
    );

    // Select to Bracket
    disposables.push(
      editor.addAction({
        id: "editor.action.selectToBracket",
        label: "Select to Bracket",
        keybindings: [
          monaco.KeyMod.CtrlCmd |
            monaco.KeyMod.Shift |
            monaco.KeyMod.Alt |
            monaco.KeyCode.Backslash,
        ],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.selectToBracket", null);
        },
      }),
    );

    // Peek Definition with LSP (multi-cursor section)
    disposables.push(
      editor.addAction({
        id: "editor.action.peekDefinition",
        label: "Peek Definition",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
        run: async (ed) => {
          const edModel = ed.getModel();
          const position = ed.getPosition();
          if (!edModel || !position) return;

          const uri = edModel.uri.toString();
          const filePath = uri.replace("file://", "");

          try {
            const languageId = edModel.getLanguageId();

            const result = await invoke<{
              locations: Array<{
                uri: string;
                range: {
                  start: { line: number; character: number };
                  end: { line: number; character: number };
                };
              }>;
            }>("lsp_multi_definition", {
              language: languageId,
              params: {
                uri: filePath,
                position: {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                },
              },
            });

            if (!result || !result.locations || result.locations.length === 0) {
              const standardResult = await invoke<{
                locations: Array<{
                  uri: string;
                  range: {
                    start: { line: number; character: number };
                    end: { line: number; character: number };
                  };
                }>;
              }>("lsp_definition", {
                serverId: languageId,
                params: {
                  uri: filePath,
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                },
              });

              if (
                !standardResult ||
                !standardResult.locations ||
                standardResult.locations.length === 0
              ) {
                console.debug("No definition found for peek");
                return;
              }

              const peekLocations: PeekLocation[] = standardResult.locations.map(
                (loc) => ({
                  uri: loc.uri.startsWith("file://")
                    ? loc.uri
                    : `file://${loc.uri}`,
                  range: {
                    startLineNumber: loc.range.start.line + 1,
                    startColumn: loc.range.start.character + 1,
                    endLineNumber: loc.range.end.line + 1,
                    endColumn: loc.range.end.character + 1,
                  },
                }),
              );

              showPeekWidget(peekLocations, position, uri);
              return;
            }

            const peekLocations: PeekLocation[] = result.locations.map((loc) => ({
              uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
              range: {
                startLineNumber: loc.range.start.line + 1,
                startColumn: loc.range.start.character + 1,
                endLineNumber: loc.range.end.line + 1,
                endColumn: loc.range.end.character + 1,
              },
            }));

            showPeekWidget(peekLocations, position, uri);
          } catch (error) {
            console.error("Failed to get definition for peek:", error);
          }
        },
      }),
    );

    // Close Peek Widget
    disposables.push(
      editor.addAction({
        id: "editor.action.closePeekWidget",
        label: "Close Peek Widget",
        keybindings: [monaco.KeyCode.Escape],
        precondition: undefined,
        run: () => {
          hidePeekWidget();
        },
      }),
    );
  });

  onCleanup(() => {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;
    if (keydownHandler) {
      window.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
    smartSelectManager.clearAllCaches();
  });

  return null;
}
