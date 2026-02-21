import {
  Show,
  createEffect,
  onCleanup,
  createSignal,
  createMemo,
} from "solid-js";
import type { OpenFile } from "@/context/EditorContext";
import { useSettings } from "@/context/SettingsContext";
import { useDebug } from "@/context/DebugContext";
import { useCollabEditor } from "@/hooks/useCollabEditor";
import { useSnippetCompletions } from "@/hooks/useSnippetCompletions";
import { editorLogger } from "../../utils/logger";
import type * as Monaco from "monaco-editor";
import { VimMode } from "./VimMode";
import { LanguageTools } from "./LanguageTools";
import { EditorSkeleton } from "./EditorSkeleton";
import { GitGutterDecorations } from "./GitGutterDecorations";
import { invoke } from "@tauri-apps/api/core";
import {
  PeekWidget,
  showPeekWidget,
  type PeekLocation,
} from "./PeekWidget";
import { PeekReferences } from "./PeekReferences";
import { StickyScrollWidget } from "./StickyScrollWidget";
import { RenameWidget } from "./RenameWidget";
import type { RenameLocation } from "@/types/editor";
import { DebugHoverWidget, useDebugHover } from "../debug/DebugHoverWidget";
import { InlineValuesOverlay } from "../debug/InlineValuesDecorations";
import { toSnakeCase, toCamelCase, toPascalCase, toKebabCase, toConstantCase } from "./modules/EditorUtils";
import { ExceptionWidget } from "../debug/ExceptionWidget";
import {
  ParameterHintsWidget,
  useParameterHints,
} from "./ParameterHintsWidget";
import type {
  SignatureHelp,
  Position as LSPPosition,
} from "@/context/LSPContext";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("editor");
loadStylesheet("editor-features");
import { LightBulbWidget } from "./LightBulbWidget";
import {
  updateCodeLensSettings,
  updateDebugHoverState,
  findLinkedEditingRanges,
  getTagAtPosition,
  findMatchingTag,
} from "./modules/EditorLSP";
import { LANGUAGE_MAP } from "./modules/EditorTypes";
import { hidePeekWidget } from "./PeekWidget";
import {
  createEditorInstance,
  getMonacoInstance,
  getLinkedEditingEnabled,
  setLinkedEditingEnabledState,
} from "./core/EditorInstance";
import { EditorToolbar } from "./core/EditorToolbar";
import { EditorMinimap } from "./core/EditorMinimap";
import { EditorBreadcrumbs } from "./core/EditorBreadcrumbs";
import { EditorDiffView } from "./core/EditorDiffView";
import { EditorFindReplace } from "./core/EditorFindReplace";
import { EditorStickyScroll } from "./core/EditorStickyScroll";
import { EditorInlineBlame } from "./core/EditorInlineBlame";
import { EditorEmmet } from "./core/EditorEmmet";
import {
  goToNextChange,
  goToPrevChange,
} from "./GitGutterDecorations";

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

class SmartSelectManager {
  private selectionHistory: Map<string, Monaco.IRange[]> = new Map();
  private lastPosition: Map<string, { line: number; column: number }> = new Map();
  private cachedRanges: Map<string, LSPSelectionRange[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 2000;

  private getEditorKey(uri: string): string { return uri; }

  clearHistory(uri: string): void {
    const key = this.getEditorKey(uri);
    this.selectionHistory.delete(key);
    this.lastPosition.delete(key);
    this.cachedRanges.delete(key);
    this.cacheTimestamps.delete(key);
  }

  clearFileCache(uri: string): void { this.clearHistory(uri); }

  clearAllCaches(): void {
    this.selectionHistory.clear();
    this.lastPosition.clear();
    this.cachedRanges.clear();
    this.cacheTimestamps.clear();
  }

  pruneOldCaches(maxAge: number = 300000): void {
    const now = Date.now();
    for (const [uri, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > maxAge) this.clearFileCache(uri);
    }
  }

  private hasPositionChanged(uri: string, currentPos: { line: number; column: number }): boolean {
    const lastPos = this.lastPosition.get(this.getEditorKey(uri));
    if (!lastPos) return true;
    return lastPos.line !== currentPos.line || lastPos.column !== currentPos.column;
  }

  private updatePosition(uri: string, pos: { line: number; column: number }): void {
    this.lastPosition.set(this.getEditorKey(uri), { ...pos });
  }

  private pushToHistory(uri: string, range: Monaco.IRange): void {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];
    const lastRange = history[history.length - 1];
    if (lastRange && lastRange.startLineNumber === range.startLineNumber && lastRange.startColumn === range.startColumn && lastRange.endLineNumber === range.endLineNumber && lastRange.endColumn === range.endColumn) return;
    history.push({ ...range });
    this.selectionHistory.set(key, history);
  }

  private popFromHistory(uri: string): Monaco.IRange | null {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];
    if (history.length <= 1) return null;
    history.pop();
    this.selectionHistory.set(key, history);
    return history[history.length - 1] || null;
  }

  private async getSelectionRanges(uri: string, position: { line: number; character: number }): Promise<LSPSelectionRange[] | null> {
    const key = this.getEditorKey(uri);
    const now = Date.now();
    const cachedTimestamp = this.cacheTimestamps.get(key);
    if (cachedTimestamp && now - cachedTimestamp < this.CACHE_TTL_MS) return this.cachedRanges.get(key) || null;
    try {
      const response = await invoke<LSPSelectionRangeResponse>("lsp_selection_range", { params: { uri, positions: [position] } });
      if (response?.ranges && response.ranges.length > 0) {
        this.cachedRanges.set(key, response.ranges);
        this.cacheTimestamps.set(key, now);
        return response.ranges;
      }
    } catch (error) { console.debug("LSP selection range not available:", error); }
    return null;
  }

  private flattenSelectionRanges(lspRange: LSPSelectionRange, _monaco: typeof Monaco): Monaco.IRange[] {
    const ranges: Monaco.IRange[] = [];
    let current: LSPSelectionRange | undefined = lspRange;
    while (current) {
      ranges.push({ startLineNumber: current.range.start.line + 1, startColumn: current.range.start.character + 1, endLineNumber: current.range.end.line + 1, endColumn: current.range.end.character + 1 });
      current = current.parent;
    }
    return ranges;
  }

  private findNextLargerRange(currentSelection: Monaco.IRange, availableRanges: Monaco.IRange[]): Monaco.IRange | null {
    for (const range of availableRanges) {
      const containsCurrent = (range.startLineNumber < currentSelection.startLineNumber || (range.startLineNumber === currentSelection.startLineNumber && range.startColumn <= currentSelection.startColumn)) && (range.endLineNumber > currentSelection.endLineNumber || (range.endLineNumber === currentSelection.endLineNumber && range.endColumn >= currentSelection.endColumn));
      const isLarger = range.startLineNumber < currentSelection.startLineNumber || range.startColumn < currentSelection.startColumn || range.endLineNumber > currentSelection.endLineNumber || range.endColumn > currentSelection.endColumn;
      if (containsCurrent && isLarger) return range;
    }
    return null;
  }

  async expandSelection(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco): Promise<void> {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;
    const uri = model.uri.toString();
    const position = selection.getPosition();
    if (this.hasPositionChanged(uri, { line: position.lineNumber, column: position.column })) this.clearHistory(uri);
    this.pushToHistory(uri, { startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn });
    const lspRanges = await this.getSelectionRanges(uri, { line: position.lineNumber - 1, character: position.column - 1 });
    if (lspRanges && lspRanges.length > 0) {
      const flatRanges = this.flattenSelectionRanges(lspRanges[0], monaco);
      const nextRange = this.findNextLargerRange({ startLineNumber: selection.startLineNumber, startColumn: selection.startColumn, endLineNumber: selection.endLineNumber, endColumn: selection.endColumn }, flatRanges);
      if (nextRange) {
        editor.setSelection(new monaco.Selection(nextRange.startLineNumber, nextRange.startColumn, nextRange.endLineNumber, nextRange.endColumn));
        this.pushToHistory(uri, nextRange);
        this.updatePosition(uri, { line: position.lineNumber, column: position.column });
        return;
      }
    }
    editor.trigger("smartSelect", "editor.action.smartSelect.expand", null);
    const newSelection = editor.getSelection();
    if (newSelection) this.pushToHistory(uri, { startLineNumber: newSelection.startLineNumber, startColumn: newSelection.startColumn, endLineNumber: newSelection.endLineNumber, endColumn: newSelection.endColumn });
    this.updatePosition(uri, { line: position.lineNumber, column: position.column });
  }

  shrinkSelection(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco): void {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;
    const uri = model.uri.toString();
    const previousRange = this.popFromHistory(uri);
    if (previousRange) {
      editor.setSelection(new monaco.Selection(previousRange.startLineNumber, previousRange.startColumn, previousRange.endLineNumber, previousRange.endColumn));
      return;
    }
    editor.trigger("smartSelect", "editor.action.smartSelect.shrink", null);
  }
}

const smartSelectManager = new SmartSelectManager();

function setupLinkedEditing(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
): void {
  let linkedEditDecorations: string[] = [];
  let decorationUpdateTimer: number | null = null;

  const updateLinkedEditDecorations = () => {
    if (!getLinkedEditingEnabled()) {
      linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
      return;
    }
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) {
      linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
      return;
    }
    const linkedRanges = findLinkedEditingRanges(model, position, monaco);
    if (!linkedRanges || linkedRanges.ranges.length < 2) {
      linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
      return;
    }
    const newDecorations = linkedRanges.ranges.map((range, index) => ({
      range,
      options: {
        className: "linked-editing-range",
        borderColor: "var(--cortex-info)",
        inlineClassName: index === 0 ? "linked-editing-current" : "linked-editing-matched",
        overviewRuler: { color: "var(--cortex-info)80", position: monaco.editor.OverviewRulerLane.Center },
      },
    }));
    linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, newDecorations);
  };

  editor.onDidChangeCursorPosition(() => {
    if (decorationUpdateTimer !== null) window.clearTimeout(decorationUpdateTimer);
    decorationUpdateTimer = window.setTimeout(() => { updateLinkedEditDecorations(); decorationUpdateTimer = null; }, 50) as unknown as number;
  });

  editor.onDidBlurEditorWidget(() => {
    linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
  });

  editor.addAction({
    id: "toggle-linked-editing",
    label: "Toggle Linked Editing",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
    run: (ed) => {
      const newEnabled = !getLinkedEditingEnabled();
      setLinkedEditingEnabledState(newEnabled);
      ed.updateOptions({ linkedEditing: newEnabled });
      if (!newEnabled) {
        linkedEditDecorations = ed.deltaDecorations(linkedEditDecorations, []);
      } else {
        updateLinkedEditDecorations();
      }
      window.dispatchEvent(new CustomEvent("editor:linked-editing-changed", { detail: { enabled: newEnabled } }));
    },
  });

  editor.addAction({
    id: "convert-jsx-tag",
    label: "Convert JSX Tag (Self-closing ↔ Paired)",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Slash],
    run: (ed) => {
      const model = ed.getModel();
      const position = ed.getPosition();
      if (!model || !position) return;
      const lineContent = model.getLineContent(position.lineNumber);
      const tagInfo = getTagAtPosition(lineContent, position.column);
      if (!tagInfo) return;
      const { tagName, isClosingTag, isSelfClosing, startColumn } = tagInfo;
      if (isSelfClosing) {
        const selfClosingPattern = new RegExp(`<${tagName}([^>]*)/>`);
        const match = selfClosingPattern.exec(lineContent);
        if (match) {
          const fullMatchStart = match.index + 1;
          const fullMatchEnd = fullMatchStart + match[0].length;
          const attributes = match[1];
          const newText = `<${tagName}${attributes}></${tagName}>`;
          ed.executeEdits("convert-jsx-tag", [{ range: new monaco.Range(position.lineNumber, fullMatchStart, position.lineNumber, fullMatchEnd), text: newText }]);
          ed.setPosition({ lineNumber: position.lineNumber, column: fullMatchStart + tagName.length + 1 + attributes.length });
        }
      } else if (!isClosingTag) {
        const content = model.getValue();
        const matchingRange = findMatchingTag(content, model, position.lineNumber, startColumn, startColumn + tagName.length, tagName, false, monaco);
        if (matchingRange) {
          const openingTagLine = model.getLineContent(position.lineNumber);
          const openingTagPattern = new RegExp(`<${tagName}([^>]*)>`);
          const openingMatch = openingTagPattern.exec(openingTagLine);
          if (openingMatch) {
            const openingStart = openingMatch.index + 1;
            const openingEnd = openingStart + openingMatch[0].length;
            const attributes = openingMatch[1].trimEnd();
            const fullRange = new monaco.Range(position.lineNumber, openingStart, matchingRange.endLineNumber, matchingRange.endColumn + 1);
            const contentBetween = model.getValueInRange(new monaco.Range(position.lineNumber, openingEnd, matchingRange.startLineNumber, matchingRange.startColumn - 2)).trim();
            if (contentBetween === "") {
              const newText = `<${tagName}${attributes} />`;
              ed.executeEdits("convert-jsx-tag", [{ range: fullRange, text: newText }]);
              ed.setPosition({ lineNumber: position.lineNumber, column: openingStart + newText.length - 2 });
            }
          }
        }
      }
    },
  });

  editor.onDidDispose(() => {
    if (decorationUpdateTimer !== null) window.clearTimeout(decorationUpdateTimer);
  });
}

function setupMultiCursorActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  activeFile: () => OpenFile | undefined,
) {
  editor.addAction({ id: "add-cursor-above", label: "Add Cursor Above", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow], run: (ed) => ed.trigger("keyboard", "editor.action.insertCursorAbove", null) });
  editor.addAction({ id: "add-cursor-below", label: "Add Cursor Below", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow], run: (ed) => ed.trigger("keyboard", "editor.action.insertCursorBelow", null) });
  editor.addAction({ id: "select-all-occurrences", label: "Select All Occurrences", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL], run: (ed) => ed.trigger("keyboard", "editor.action.selectHighlights", null) });
  editor.addAction({ id: "add-selection-to-next-find-match", label: "Add Selection to Next Find Match", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD], run: (ed) => ed.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null) });
  editor.addAction({ id: "add-cursors-to-line-ends", label: "Add Cursors to Line Ends", keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyI], run: (ed) => ed.trigger("keyboard", "editor.action.insertCursorAtEndOfEachLineSelected", null) });

  editor.addAction({
    id: "expand-selection", label: "Expand Selection",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow],
    run: async (ed) => { await smartSelectManager.expandSelection(ed as Monaco.editor.IStandaloneCodeEditor, monaco); },
  });
  editor.addAction({
    id: "shrink-selection", label: "Shrink Selection",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow],
    run: (ed) => { smartSelectManager.shrinkSelection(ed as Monaco.editor.IStandaloneCodeEditor, monaco); },
  });
  editor.addAction({ id: "undo-cursor", label: "Undo Last Cursor Operation", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU], run: (ed) => ed.trigger("keyboard", "cursorUndo", null) });
  editor.addAction({ id: "remove-secondary-cursors", label: "Remove Secondary Cursors", keybindings: [monaco.KeyCode.Escape], precondition: "hasMultipleSelections", run: (ed) => { const s = ed.getSelections(); if (s && s.length > 1) ed.setSelection(s[0]); } });
  editor.addAction({ id: "select-line", label: "Select Line", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL], run: (ed) => ed.trigger("keyboard", "expandLineSelection", null) });
  editor.addAction({ id: "move-line-up", label: "Move Line Up", keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow], run: (ed) => ed.trigger("keyboard", "editor.action.moveLinesUpAction", null) });
  editor.addAction({ id: "move-line-down", label: "Move Line Down", keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow], run: (ed) => ed.trigger("keyboard", "editor.action.moveLinesDownAction", null) });
  editor.addAction({ id: "copy-line-up", label: "Copy Line Up", keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow], run: (ed) => ed.trigger("keyboard", "editor.action.copyLinesUpAction", null) });
  editor.addAction({ id: "copy-line-down", label: "Copy Line Down", keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow], run: (ed) => ed.trigger("keyboard", "editor.action.copyLinesDownAction", null) });

  editor.addAction({
    id: "duplicate-selection", label: "Duplicate Selection",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD],
    run: (ed) => {
      const selections = ed.getSelections();
      if (!selections || selections.length === 0) return;
      const model = ed.getModel();
      if (!model) return;
      const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
      const newSelections: Monaco.Selection[] = [];
      selections.forEach((selection) => {
        const text = model.getValueInRange(selection);
        if (selection.isEmpty()) {
          const lineNumber = selection.startLineNumber;
          const lineContent = model.getLineContent(lineNumber);
          const lineEndColumn = model.getLineMaxColumn(lineNumber);
          edits.push({ range: new monaco.Range(lineNumber, lineEndColumn, lineNumber, lineEndColumn), text: "\n" + lineContent });
          newSelections.push(new monaco.Selection(lineNumber + 1, selection.startColumn, lineNumber + 1, selection.endColumn));
        } else {
          edits.push({ range: new monaco.Range(selection.endLineNumber, selection.endColumn, selection.endLineNumber, selection.endColumn), text: text });
          const linesAdded = text.split("\n").length - 1;
          const newStartLine = selection.endLineNumber;
          const newStartColumn = selection.endColumn;
          newSelections.push(new monaco.Selection(newStartLine, newStartColumn, newStartLine + linesAdded, linesAdded > 0 ? text.split("\n").pop()!.length + 1 : newStartColumn + text.length));
        }
      });
      ed.executeEdits("duplicate-selection", edits);
      ed.setSelections(newSelections);
    },
  });

  editor.addAction({ id: "transform-to-uppercase", label: "Transform to Uppercase", run: (ed) => ed.trigger("keyboard", "editor.action.transformToUppercase", null) });
  editor.addAction({ id: "transform-to-lowercase", label: "Transform to Lowercase", run: (ed) => ed.trigger("keyboard", "editor.action.transformToLowercase", null) });
  editor.addAction({ id: "transform-to-titlecase", label: "Transform to Title Case", run: (ed) => ed.trigger("keyboard", "editor.action.transformToTitlecase", null) });

  const textTransforms = [
    { id: "transform-to-snakecase", label: "Transform to snake_case", fn: toSnakeCase },
    { id: "transform-to-camelcase", label: "Transform to camelCase", fn: toCamelCase },
    { id: "transform-to-pascalcase", label: "Transform to PascalCase", fn: toPascalCase },
    { id: "transform-to-kebabcase", label: "Transform to kebab-case", fn: toKebabCase },
    { id: "transform-to-constantcase", label: "Transform to CONSTANT_CASE", fn: toConstantCase },
  ];
  for (const { id, label, fn } of textTransforms) {
    editor.addAction({ id, label, run: (ed) => {
      const selections = ed.getSelections();
      if (!selections) return;
      const model = ed.getModel();
      if (!model) return;
      ed.pushUndoStop();
      const edits = selections.map((sel) => ({ range: sel, text: fn(model.getValueInRange(sel)) }));
      ed.executeEdits("transform", edits);
      ed.pushUndoStop();
    }});
  }

  let isColumnSelecting = false;
  let columnSelectStart: { lineNumber: number; column: number } | null = null;
  editor.onMouseDown((e) => { if (e.event.shiftKey && e.event.altKey && e.target.position) { isColumnSelecting = true; columnSelectStart = e.target.position; } });
  editor.onMouseMove((e) => {
    if (isColumnSelecting && columnSelectStart && e.target.position) {
      const startLine = Math.min(columnSelectStart.lineNumber, e.target.position.lineNumber);
      const endLine = Math.max(columnSelectStart.lineNumber, e.target.position.lineNumber);
      const startColumn = Math.min(columnSelectStart.column, e.target.position.column);
      const endColumn = Math.max(columnSelectStart.column, e.target.position.column);
      const selections: Monaco.Selection[] = [];
      for (let line = startLine; line <= endLine; line++) selections.push(new monaco.Selection(line, startColumn, line, endColumn));
      if (selections.length > 0) editor.setSelections(selections);
    }
  });
  editor.onMouseUp(() => { isColumnSelecting = false; columnSelectStart = null; });

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") { e.preventDefault(); editor.trigger("keyboard", "editor.action.selectHighlights", null); }
    if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); editor.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null); }
  };
  window.addEventListener("keydown", handleKeyDown);
  editor.onDidDispose(() => { window.removeEventListener("keydown", handleKeyDown); });

  editor.addAction({ id: "editor.action.dirtydiff.next", label: "Go to Next Change", keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F3], run: () => { const file = activeFile(); if (file?.path) goToNextChange(editor, file.path); } });
  editor.addAction({ id: "editor.action.dirtydiff.previous", label: "Go to Previous Change", keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F3], run: () => { const file = activeFile(); if (file?.path) goToPrevChange(editor, file.path); } });
  editor.addAction({ id: "editor.action.jumpToBracket", label: "Go to Bracket", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backslash], run: (ed) => ed.trigger("keyboard", "editor.action.jumpToBracket", null) });
  editor.addAction({ id: "editor.action.selectToBracket", label: "Select to Bracket", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.Backslash], run: (ed) => ed.trigger("keyboard", "editor.action.selectToBracket", null) });

  editor.addAction({
    id: "editor.action.peekDefinition", label: "Peek Definition",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
    run: async (ed) => {
      const model = ed.getModel();
      const position = ed.getPosition();
      if (!model || !position) return;
      const uri = model.uri.toString();
      const filePath = uri.replace("file://", "");
      try {
        const languageId = model.getLanguageId();
        const result = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_multi_definition", { language: languageId, params: { uri: filePath, position: { line: position.lineNumber - 1, character: position.column - 1 } } });
        if (!result?.locations?.length) {
          const stdResult = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_definition", { serverId: languageId, params: { uri: filePath, position: { line: position.lineNumber - 1, character: position.column - 1 } } });
          if (!stdResult?.locations?.length) { console.debug("No definition found for peek"); return; }
          const peekLocations: PeekLocation[] = stdResult.locations.map((loc) => ({ uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`, range: { startLineNumber: loc.range.start.line + 1, startColumn: loc.range.start.character + 1, endLineNumber: loc.range.end.line + 1, endColumn: loc.range.end.character + 1 } }));
          showPeekWidget(peekLocations, position, uri);
          return;
        }
        const peekLocations: PeekLocation[] = result.locations.map((loc) => ({ uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`, range: { startLineNumber: loc.range.start.line + 1, startColumn: loc.range.start.character + 1, endLineNumber: loc.range.end.line + 1, endColumn: loc.range.end.character + 1 } }));
        showPeekWidget(peekLocations, position, uri);
      } catch (error) { console.error("Failed to get definition for peek:", error); }
    },
  });

  editor.addAction({ id: "editor.action.closePeekWidget", label: "Close Peek Widget", keybindings: [monaco.KeyCode.Escape], precondition: undefined, run: () => hidePeekWidget() });
}

interface CodeEditorProps {
  file?: OpenFile;
  groupId?: string;
}

export function CodeEditor(props: CodeEditorProps) {
  const {
    state: settingsState,
    getEffectiveEditorSettings,
  } = useSettings();
  const debug = useDebug();
  const [agentActive, setAgentActive] = createSignal(false);
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);

  const debugHover = useDebugHover();

  const instance = createEditorInstance({
    file: () => props.file,
    groupId: props.groupId,
    onEditorReady: (editor, monaco, isNewEditor) => {
      if (isNewEditor) {
        setupLinkedEditing(editor, monaco);
        setupMultiCursorActions(editor, monaco, instance.activeFile);

        const openIDECommandPalette = () => {
          window.dispatchEvent(new CustomEvent("command-palette:toggle"));
        };
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, openIDECommandPalette);
        editor.addCommand(monaco.KeyCode.F1, openIDECommandPalette);

        const originalTrigger = editor.trigger.bind(editor);
        editor.trigger = (source: string, handlerId: string, payload: any) => {
          if (handlerId === "editor.action.quickCommand") { openIDECommandPalette(); return; }
          return originalTrigger(source, handlerId, payload);
        };

        const originalGetAction = editor.getAction.bind(editor);
        editor.getAction = (id: string): Monaco.editor.IEditorAction | null => {
          if (id === "editor.action.quickCommand") {
            return { id: "editor.action.quickCommand", label: "Command Palette", alias: "", isSupported: () => true, run: openIDECommandPalette } as Monaco.editor.IEditorAction;
          }
          return originalGetAction(id);
        };

        editor.addAction({ id: "toggle-line-comment", label: "Toggle Line Comment", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash], run: (ed) => ed.trigger("keyboard", "editor.action.commentLine", null) });
        editor.addAction({ id: "toggle-block-comment", label: "Toggle Block Comment", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Slash], run: (ed) => ed.trigger("keyboard", "editor.action.blockComment", null) });
      }

    },
  });

  const currentFilePathMemo = createMemo(() => instance.activeFile()?.path || null);
  const currentUri = createMemo(() => {
    const file = instance.activeFile();
    return file ? `file://${file.path.replace(/\\/g, "/")}` : undefined;
  });
  const currentLanguage = createMemo(() => {
    const file = instance.activeFile();
    return file ? LANGUAGE_MAP[file.language] || file.language || "plaintext" : "plaintext";
  });
  const currentFileIdMemo = createMemo(() => instance.activeFile()?.id || null);

  useCollabEditor({
    editor: instance.editor(),
    monaco: instance.monaco(),
    fileId: currentFileIdMemo(),
  });

  useSnippetCompletions({
    editor: instance.editor(),
    monaco: instance.monaco(),
    language: currentLanguage(),
  });

  const stickyScrollEnabled = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    return langSettings.stickyScrollEnabled ?? false;
  });
  const stickyScrollMaxLines = createMemo(() => settingsState.settings.editor.stickyScrollMaxLines ?? 5);
  const editorFontFamily = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    return langSettings.fontFamily ?? "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";
  });
  const editorFontSize = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    return langSettings.fontSize ?? 13;
  });
  const editorLineHeight = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    const fontSize = langSettings.fontSize ?? 13;
    const lineHeightMultiplier = langSettings.lineHeight ?? 1.5;
    return Math.round(fontSize * lineHeightMultiplier);
  });

  const getSignatureHelpFromLSP = async (
    position: LSPPosition,
    triggerCharacter?: string,
    isRetrigger?: boolean,
  ): Promise<SignatureHelp | null> => {
    const file = instance.activeFile();
    const editor = instance.editor();
    if (!file || !editor) return null;
    const model = editor.getModel();
    if (!model) return null;
    const languageId = model.getLanguageId();
    try {
      const result = await invoke<SignatureHelp | null>("lsp_signature_help", {
        serverId: languageId,
        params: { uri: file.path, position, trigger_kind: triggerCharacter ? 2 : isRetrigger ? 3 : 1, trigger_character: triggerCharacter, is_retrigger: isRetrigger ?? false },
      });
      return result;
    } catch (err) { console.debug("Signature help request failed:", err); return null; }
  };

  const parameterHints = useParameterHints(instance.editor(), instance.monaco(), getSignatureHelpFromLSP);

  createEffect(() => {
    const codeLensConfig = settingsState.settings.editor.codeLens;
    if (codeLensConfig) updateCodeLensSettings(codeLensConfig);
  });

  createEffect(() => {
    const handleVSCodeThemeApplied = (e: Event) => {
      const monacoInst = getMonacoInstance();
      if (!monacoInst) return;
      const detail = (e as CustomEvent).detail;
      if (detail?.theme) {
        import("@/utils/monaco-theme").then(({ applyThemeToMonaco }) => { applyThemeToMonaco(monacoInst, detail.theme); });
      }
    };
    const handleVSCodeThemeCleared = () => {
      const monacoInst = getMonacoInstance();
      if (!monacoInst) return;
      monacoInst.editor.setTheme("cortex-dark");
    };
    window.addEventListener("theme:vscode-extension-applied", handleVSCodeThemeApplied);
    window.addEventListener("theme:vscode-extension-cleared", handleVSCodeThemeCleared);
    onCleanup(() => {
      window.removeEventListener("theme:vscode-extension-applied", handleVSCodeThemeApplied);
      window.removeEventListener("theme:vscode-extension-cleared", handleVSCodeThemeCleared);
    });
  });

  createEffect(() => {
    const handleLanguageChange = (e: CustomEvent<{ fileId: string; languageId: string }>) => {
      if (!e.detail) return;
      const file = instance.activeFile();
      const ed = instance.editor();
      const monacoInst = instance.monaco();
      if (!file || !ed || !monacoInst) return;
      if (e.detail.fileId !== file.id) return;
      const model = ed.getModel();
      if (model) {
        const monacoLanguage = LANGUAGE_MAP[e.detail.languageId] || e.detail.languageId || "plaintext";
        monacoInst.editor.setModelLanguage(model, monacoLanguage);
      }
    };
    window.addEventListener("language:changed", handleLanguageChange as EventListener);
    onCleanup(() => { window.removeEventListener("language:changed", handleLanguageChange as EventListener); });
  });

  createEffect(() => {
    const isPaused = debug.state.isPaused;
    const inlineValuesEnabled = debug.state.inlineValuesEnabled;
    const currentFile = debug.state.currentFile;
    const variables = debug.state.variables;
    void isPaused; void inlineValuesEnabled; void currentFile; void variables;
    if (isPaused && inlineValuesEnabled && currentFile) { debug.refreshInlineValues(); }
    else if (!isPaused || !inlineValuesEnabled) { window.dispatchEvent(new CustomEvent("debug:cleared")); }
  });

  createEffect(() => {
    const isPaused = debug.state.isPaused;
    const activeSessionId = debug.state.activeSessionId;
    if (isPaused && activeSessionId) {
      updateDebugHoverState({ isPaused: true, activeSessionId, evaluate: debug.evaluate, expandVariable: debug.expandVariable, addWatchExpression: debug.addWatchExpression });
    } else { updateDebugHoverState(null); }
  });

  let agentActiveTimer: ReturnType<typeof setTimeout> | null = null;
  const handleAgentActive = (e: CustomEvent<{ path?: string; paths?: string[]; action: string; duration: number; allSplits?: boolean }>) => {
    const file = instance.activeFile();
    const detail = e.detail;
    const shouldActivate = detail.allSplits || (file && detail.path === file.path) || (file && detail.paths?.includes(file.path));
    if (shouldActivate) {
      setAgentActive(true);
      if (agentActiveTimer) clearTimeout(agentActiveTimer);
      if (detail.duration > 0) { agentActiveTimer = setTimeout(() => setAgentActive(false), detail.duration); }
    }
  };
  const handleAgentInactive = () => { setAgentActive(false); if (agentActiveTimer) { clearTimeout(agentActiveTimer); agentActiveTimer = null; } };
  window.addEventListener("editor:agent-active", handleAgentActive as EventListener);
  window.addEventListener("editor:agent-inactive", handleAgentInactive);
  onCleanup(() => {
    window.removeEventListener("editor:agent-active", handleAgentActive as EventListener);
    window.removeEventListener("editor:agent-inactive", handleAgentInactive);
    if (agentActiveTimer) clearTimeout(agentActiveTimer);
  });

  const handleFileClose = (e: CustomEvent<{ path: string }>) => {
    const monacoInst = instance.monaco();
    if (monacoInst && e.detail?.path) {
      const uri = monacoInst.Uri.file(e.detail.path).toString();
      smartSelectManager.clearFileCache(uri);
    }
  };
  window.addEventListener("editor:file-closed", handleFileClose as EventListener);
  const smartSelectPruneInterval = setInterval(() => smartSelectManager.pruneOldCaches(), 60000);
  onCleanup(() => {
    clearInterval(smartSelectPruneInterval);
    window.removeEventListener("editor:file-closed", handleFileClose as EventListener);
    smartSelectManager.clearAllCaches();
  });

  onCleanup(() => { updateDebugHoverState(null); });

  let dragEnterCounter = 0;
  const handleDragEnter = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); dragEnterCounter++; if (dragEnterCounter === 1) setIsDraggingOver(true); };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); dragEnterCounter--; if (dragEnterCounter === 0) setIsDraggingOver(false); };
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragEnterCounter = 0; setIsDraggingOver(false);
    const ed = instance.editorInstance();
    const monacoInst = instance.monaco();
    if (!ed || !monacoInst || !e.dataTransfer) return;
    const target = ed.getTargetAtClientPoint(e.clientX, e.clientY);
    let position = ed.getPosition();
    if (target && target.position) position = target.position;
    if (!position) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      interface TauriFile extends File { path?: string; }
      const filePathsOrContent: string[] = [];
      for (let i = 0; i < files.length; i++) { const file = files[i] as TauriFile; filePathsOrContent.push(file.path || file.name); }
      if (filePathsOrContent.length > 0) {
        const textToInsert = filePathsOrContent.join("\n");
        ed.executeEdits("drop-files", [{ range: new monacoInst.Range(position.lineNumber, position.column, position.lineNumber, position.column), text: textToInsert }]);
        const lines = textToInsert.split("\n");
        const lastLine = lines[lines.length - 1];
        ed.setPosition({ lineNumber: position.lineNumber + lines.length - 1, column: lines.length === 1 ? position.column + lastLine.length : lastLine.length + 1 });
        ed.focus();
        return;
      }
    }
    const droppedText = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
    if (droppedText) {
      ed.executeEdits("drop-text", [{ range: new monacoInst.Range(position.lineNumber, position.column, position.lineNumber, position.column), text: droppedText }]);
      const lines = droppedText.split("\n");
      const lastLine = lines[lines.length - 1];
      ed.setPosition({ lineNumber: position.lineNumber + lines.length - 1, column: lines.length === 1 ? position.column + lastLine.length : lastLine.length + 1 });
      ed.focus();
    }
  };

  return (
    <div
      class="flex-1 flex flex-col overflow-hidden relative transition-all duration-300"
      style={{
        background: "var(--cortex-bg-secondary, var(--cortex-bg-primary))",
        "box-shadow": agentActive() ? "inset 0 0 0 2px var(--cortex-warning)" : "none",
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Show when={agentActive()}>
        <div
          class="absolute inset-0 pointer-events-none z-50 animate-pulse"
          style={{ "box-shadow": "inset 0 0 20px rgba(249, 115, 22, 0.3)", border: "2px solid var(--jb-color-warning, var(--cortex-warning))", "border-radius": "var(--cortex-radius-sm)" }}
        />
      </Show>
      <Show when={isDraggingOver()}>
        <div
          class="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
          style={{ background: "rgba(99, 102, 241, 0.15)", border: "2px dashed var(--jb-border-focus, var(--cortex-info))", "border-radius": "var(--cortex-radius-sm)" }}
        >
          <div class="px-4 py-2 rounded-lg" style={{ background: "var(--jb-panel)", border: "1px solid var(--jb-border-focus, var(--cortex-info))", color: "var(--jb-text-body-color)", "font-size": "var(--jb-text-body-size, 14px)" }}>
            Drop files or text here
          </div>
        </div>
      </Show>
      <Show when={instance.isLoading() && instance.activeFile()}>
        <EditorSkeleton lineCount={25} showMessage={true} />
      </Show>
      <div
        ref={(el) => instance.setContainerRef(el)}
        class="flex-1 relative"
        style={{ display: instance.isLoading() || !instance.activeFile() ? "none" : "block" }}
      >
        <StickyScrollWidget
          editor={instance.editor()}
          monaco={instance.monaco()}
          enabled={stickyScrollEnabled()}
          maxLineCount={stickyScrollMaxLines()}
          fontFamily={editorFontFamily()}
          fontSize={editorFontSize()}
          lineHeight={editorLineHeight()}
          onLineClick={(lineNumber) => {
            const editor = instance.editor();
            if (editor) { editor.revealLineInCenter(lineNumber); editor.setPosition({ lineNumber, column: 1 }); editor.focus(); }
          }}
        />
      </div>
      {/* Sub-components for event handling */}
      <EditorToolbar editor={instance.editor} monaco={instance.monaco} activeFile={instance.activeFile} />
      <EditorMinimap editor={instance.editor} monaco={instance.monaco} />
      <EditorBreadcrumbs editor={instance.editor} monaco={instance.monaco} activeFile={instance.activeFile} smartSelectManager={smartSelectManager} />
      <EditorDiffView editor={instance.editor} monaco={instance.monaco} activeFile={instance.activeFile} />
      <EditorFindReplace editor={instance.editor} monaco={instance.monaco} />
      <EditorStickyScroll editor={instance.editor} monaco={instance.monaco} />
      <EditorInlineBlame editor={instance.editor} monaco={instance.monaco} activeFile={instance.activeFile} filePath={currentFilePathMemo} />
      <EditorEmmet editor={instance.editor} monaco={instance.monaco} />
      <VimMode editor={instance.editor()} monaco={instance.monaco()} />
      <LanguageTools editor={instance.editor()} monaco={instance.monaco()} uri={currentUri()} />
      <GitGutterDecorations editor={instance.editor()} monaco={instance.monaco()} filePath={currentFilePathMemo()} />
      <PeekWidget
        editor={instance.editor()}
        monaco={instance.monaco()}
        onNavigate={(location) => {
          const filePath = location.uri.replace(/^file:\/\//, "").replace(/\//g, "\\");
          window.dispatchEvent(new CustomEvent("editor:open-file", { detail: { path: filePath, line: location.range.startLineNumber, column: location.range.startColumn } }));
        }}
      />
      <PeekReferences
        editor={instance.editor()}
        monaco={instance.monaco()}
        onNavigate={(uri, line, column) => {
          const filePath = uri.replace(/^file:\/\//, "").replace(/\//g, "\\");
          window.dispatchEvent(new CustomEvent("editor:open-file", { detail: { path: filePath, line, column } }));
        }}
      />
      <RenameWidget
        editor={instance.editor()}
        monaco={instance.monaco()}
        serverId={currentLanguage()}
        onClose={() => instance.editor()?.focus()}
        onRename={(oldName: string, newName: string, locations: RenameLocation[]) => {
          console.debug(`[RenameWidget] Renamed "${oldName}" to "${newName}" in ${locations.length} locations`);
          window.dispatchEvent(new CustomEvent("editor:refresh-content", { detail: { locations } }));
        }}
      />
      <ParameterHintsWidget
        editor={instance.editor()}
        monaco={instance.monaco()}
        signatureHelp={parameterHints.signatureHelp()}
        onClose={parameterHints.onClose}
        onRequestSignatureHelp={async (position, triggerChar, isRetrigger) => { await getSignatureHelpFromLSP(position, triggerChar, isRetrigger); }}
      />
      <Show when={debug.state.isPaused && debug.state.activeSessionId}>
        <DebugHoverWidget state={debugHover.state()} onClose={debugHover.hideHover} onToggleExpand={debugHover.toggleExpand} onLoadChildren={debugHover.loadChildren} onAddToWatch={debugHover.addToWatch} />
      </Show>
      <Show when={debug.state.isPaused && debug.state.inlineValuesEnabled}>
        <InlineValuesOverlay editor={instance.editor()} filePath={currentFilePathMemo()} settings={{ enabled: debug.state.inlineValuesEnabled, maxValueLength: 50, showTypes: true, debounceMs: 100 }} />
      </Show>
      <Show when={debug.state.isPaused && debug.getExceptionWidgetState().visible}>
        <ExceptionWidget lineHeight={20} editorTopOffset={0} onContinue={() => debug.continue_()} onConfigureBreakpoint={(exceptionId) => { editorLogger.debug("Configure breakpoint for exception:", exceptionId); }} />
      </Show>
      <LightBulbWidget editor={instance.editor()} monaco={instance.monaco()} uri={currentUri()} />
    </div>
  );
}