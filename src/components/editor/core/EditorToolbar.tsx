import { createEffect } from "solid-js";
import type { Accessor } from "solid-js";
import type { OpenFile } from "@/context/EditorContext";
import { useEditor } from "@/context/EditorContext";
import { useSettings } from "@/context/SettingsContext";
import { useTesting } from "@/context/TestingContext";
import type * as Monaco from "monaco-editor";
import {
  updateInlayHintSettings,
  getInlayHintSettings,
  getUnicodeHighlightSettings,
  updateUnicodeHighlightSettings,
} from "@/components/editor/modules/EditorLSP";
import {
  expandEmmetAbbreviation,
  getAbbreviationRange,
} from "@/utils/emmet";
import {
  toggleInlineBlame,
  setInlineBlameMode,
} from "@/components/editor/InlineBlame";
import { showPeekReferences } from "@/components/editor/PeekReferences";
import { showReferencesPanel } from "@/components/ReferencesPanel";
import { showRenameWidget } from "@/components/editor/RenameWidget";
import { invoke } from "@tauri-apps/api/core";
import {
  getFormatOnPasteEnabled,
  updateFormatOnPasteEnabled,
} from "@/components/editor/core/EditorInstance";

interface EditorToolbarProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  activeFile: Accessor<OpenFile | undefined>;
}

export function EditorToolbar(props: EditorToolbarProps) {
  const { updateFileContent, saveFile, updateCursorInfo } = useEditor();
  const { updateEditorSetting } = useSettings();
  const testing = useTesting();
  let registered = false;

  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco || registered) return;
    registered = true;

    const deferredSetup = () => {
      if (!editor || editor.getModel() === null) return;

      editor.addAction({
        id: "toggle-word-wrap",
        label: "Toggle Word Wrap",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
        run: (ed) => {
          const currentWrap = ed.getOption(monaco.editor.EditorOption.wordWrap);
          ed.updateOptions({ wordWrap: currentWrap === "off" ? "on" : "off" });
        },
      });

      editor.addAction({
        id: "toggle-minimap",
        label: "Toggle Minimap",
        run: (ed) => {
          const opt = ed.getOption(monaco.editor.EditorOption.minimap);
          ed.updateOptions({ minimap: { enabled: !opt.enabled } });
        },
      });

      editor.addAction({
        id: "toggle-sticky-scroll",
        label: "Toggle Sticky Scroll",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyY,
        ],
        run: (ed) => {
          const opt = ed.getOption(monaco.editor.EditorOption.stickyScroll);
          const newEnabled = !opt.enabled;
          ed.updateOptions({ stickyScroll: { enabled: newEnabled, maxLineCount: 5 } });
          updateEditorSetting("stickyScrollEnabled", newEnabled);
        },
      });

      editor.addAction({
        id: "toggle-bracket-colorization",
        label: "Toggle Bracket Pair Colorization",
        run: (ed) => {
          const opt = ed.getOption(monaco.editor.EditorOption.bracketPairColorization);
          const newEnabled = !opt.enabled;
          ed.updateOptions({
            bracketPairColorization: { enabled: newEnabled, independentColorPoolPerBracketType: true },
          });
          updateEditorSetting("bracketPairColorization", newEnabled);
        },
      });

      editor.addAction({
        id: "toggle-bracket-guides",
        label: "Toggle Bracket Pair Guides",
        run: (ed) => {
          const opt = ed.getOption(monaco.editor.EditorOption.guides);
          const newEnabled = !opt.bracketPairs;
          ed.updateOptions({
            guides: { ...opt, bracketPairs: newEnabled, bracketPairsHorizontal: newEnabled },
          });
          updateEditorSetting("guidesBracketPairs", newEnabled);
        },
      });

      editor.addAction({
        id: "toggle-indentation-guides",
        label: "Toggle Indentation Guides",
        run: (ed) => {
          const opt = ed.getOption(monaco.editor.EditorOption.guides);
          const newEnabled = !opt.indentation;
          ed.updateOptions({
            guides: { ...opt, indentation: newEnabled, highlightActiveIndentation: newEnabled },
          });
          updateEditorSetting("guidesIndentation", newEnabled);
        },
      });

      editor.addAction({
        id: "toggle-inlay-hints",
        label: "Toggle Inlay Hints",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyI,
        ],
        run: (ed) => {
          const opt = ed.getOption(monaco.editor.EditorOption.inlayHints);
          const newEnabled: "on" | "off" = opt.enabled === "on" ? "off" : "on";
          ed.updateOptions({ inlayHints: { ...opt, enabled: newEnabled } });
          updateInlayHintSettings({ enabled: newEnabled });
        },
      });

      editor.addAction({
        id: "toggle-inlay-hints-parameter-names",
        label: "Toggle Inlay Hints: Parameter Names",
        run: () => {
          const newValue = !getInlayHintSettings().showParameterNames;
          updateInlayHintSettings({ showParameterNames: newValue });
        },
      });

      editor.addAction({
        id: "toggle-inlay-hints-type-hints",
        label: "Toggle Inlay Hints: Type Hints",
        run: () => {
          const newValue = !getInlayHintSettings().showTypeHints;
          updateInlayHintSettings({ showTypeHints: newValue });
        },
      });

      editor.addAction({
        id: "toggle-unicode-highlight",
        label: "Toggle Unicode Highlighting",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyU,
        ],
        run: (ed) => {
          const newEnabled = !getUnicodeHighlightSettings().enabled;
          updateUnicodeHighlightSettings({ enabled: newEnabled });
          ed.updateOptions({
            unicodeHighlight: {
              ambiguousCharacters: newEnabled ? getUnicodeHighlightSettings().ambiguousCharacters : false,
              invisibleCharacters: newEnabled ? getUnicodeHighlightSettings().invisibleCharacters : false,
              nonBasicASCII: newEnabled ? getUnicodeHighlightSettings().nonBasicASCII : false,
            },
          });
        },
      });

      editor.addAction({
        id: "toggle-unicode-highlight-invisible",
        label: "Toggle Unicode Highlight: Invisible Characters",
        run: (ed) => {
          const newValue = !getUnicodeHighlightSettings().invisibleCharacters;
          updateUnicodeHighlightSettings({ invisibleCharacters: newValue });
          ed.updateOptions({ unicodeHighlight: { invisibleCharacters: newValue } });
        },
      });

      editor.addAction({
        id: "toggle-unicode-highlight-ambiguous",
        label: "Toggle Unicode Highlight: Ambiguous Characters (Homoglyphs)",
        run: (ed) => {
          const newValue = !getUnicodeHighlightSettings().ambiguousCharacters;
          updateUnicodeHighlightSettings({ ambiguousCharacters: newValue });
          ed.updateOptions({ unicodeHighlight: { ambiguousCharacters: newValue } });
        },
      });

      editor.addAction({
        id: "format-document",
        label: "Format Document",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.formatDocument", null);
        },
      });

      editor.addAction({
        id: "toggle-format-on-paste",
        label: "Toggle Format on Paste",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
        ],
        run: () => {
          const newEnabled = !getFormatOnPasteEnabled();
          updateFormatOnPasteEnabled(newEnabled);
          updateEditorSetting("formatOnPaste", newEnabled);
          window.dispatchEvent(
            new CustomEvent("editor:format-on-paste-changed", {
              detail: { enabled: newEnabled },
            }),
          );
        },
      });

      editor.addAction({
        id: "indent-lines",
        label: "Indent Lines",
        run: (ed) => ed.trigger("keyboard", "editor.action.indentLines", null),
      });

      editor.addAction({
        id: "outdent-lines",
        label: "Outdent Lines",
        run: (ed) => ed.trigger("keyboard", "editor.action.outdentLines", null),
      });

      editor.addAction({
        id: "editor.action.joinLines",
        label: "Join Lines",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ],
        run: (ed) => {
          const model = ed.getModel();
          if (!model) return;
          const selections = ed.getSelections();
          if (!selections) return;
          ed.pushUndoStop();
          const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
          for (const selection of selections) {
            const startLine = selection.startLineNumber;
            const endLine = selection.endLineNumber === startLine ? startLine + 1 : selection.endLineNumber;
            for (let line = startLine; line < endLine && line < model.getLineCount(); line++) {
              const currentLineEnd = model.getLineMaxColumn(line);
              const nextLineStart = model.getLineFirstNonWhitespaceColumn(line + 1);
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
      });

      editor.addAction({
        id: "toggle-coverage-decorations",
        label: "Toggle Test Coverage Decorations",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
        ],
        run: () => testing.toggleCoverageDecorations(),
      });

      editor.addAction({
        id: "toggle-inline-blame",
        label: "Toggle Inline Git Blame",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyB,
        ],
        run: () => toggleInlineBlame(),
      });

      editor.addAction({ id: "inline-blame-current-line", label: "Inline Blame: Show Current Line Only", run: () => setInlineBlameMode("currentLine") });
      editor.addAction({ id: "inline-blame-all-lines", label: "Inline Blame: Show All Lines", run: () => setInlineBlameMode("allLines") });
      editor.addAction({ id: "inline-blame-off", label: "Inline Blame: Turn Off", run: () => setInlineBlameMode("off") });

      editor.addAction({
        id: "editor.foldAll", label: "Fold All",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketLeft],
        run: (ed) => ed.trigger("keyboard", "editor.foldAll", null),
      });
      editor.addAction({
        id: "editor.unfoldAll", label: "Unfold All",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketRight],
        run: (ed) => ed.trigger("keyboard", "editor.unfoldAll", null),
      });
      editor.addAction({
        id: "editor.toggleFold", label: "Toggle Fold",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketLeft],
        run: (ed) => ed.trigger("keyboard", "editor.toggleFold", null),
      });

      for (let level = 1; level <= 7; level++) {
        editor.addAction({
          id: `editor.foldLevel${level}`,
          label: `Fold Level ${level}`,
          keybindings: [
            monaco.KeyMod.CtrlCmd |
              monaco.KeyCode[`Digit${level}` as keyof typeof Monaco.KeyCode],
          ],
          run: (ed) => ed.trigger("keyboard", `editor.foldLevel${level}`, null),
        });
      }

      editor.addAction({ id: "editor.foldAllBlockComments", label: "Fold All Block Comments", run: (ed) => ed.trigger("keyboard", "editor.foldAllBlockComments", null) });
      editor.addAction({ id: "editor.foldAllMarkerRegions", label: "Fold All Regions", run: (ed) => ed.trigger("keyboard", "editor.foldAllMarkerRegions", null) });
      editor.addAction({ id: "editor.unfoldAllMarkerRegions", label: "Unfold All Regions", run: (ed) => ed.trigger("keyboard", "editor.unfoldAllMarkerRegions", null) });
      editor.addAction({ id: "editor.foldRecursively", label: "Fold Recursively", run: (ed) => ed.trigger("keyboard", "editor.foldRecursively", null) });
      editor.addAction({ id: "editor.unfoldRecursively", label: "Unfold Recursively", run: (ed) => ed.trigger("keyboard", "editor.unfoldRecursively", null) });

      editor.addAction({
        id: "editor.action.peekDefinition", label: "Peek Definition",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
        run: (ed) => ed.trigger("keyboard", "editor.action.peekDefinition", null),
      });

      editor.addAction({
        id: "editor.action.referenceSearch.trigger",
        label: "Peek References",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
        run: async (ed) => {
          const model = ed.getModel();
          const position = ed.getPosition();
          if (!model || !position) return;
          const uri = model.uri.toString();
          const filePath = uri.replace("file://", "");
          const languageId = model.getLanguageId();
          const wordInfo = model.getWordAtPosition(position);
          const symbolName = wordInfo?.word || "";
          try {
            const result = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_multi_references", {
              language: languageId, params: { uri: filePath, position: { line: position.lineNumber - 1, character: position.column - 1 } },
            });
            if (!result?.locations?.length) {
              const stdResult = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_references", {
                serverId: languageId, params: { uri: filePath, position: { line: position.lineNumber - 1, character: position.column - 1 } },
              });
              if (!stdResult?.locations?.length) { console.debug("No references found for peek"); return; }
              const locs = stdResult.locations.map((loc) => ({ uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`, range: { start: { line: loc.range.start.line, character: loc.range.start.character }, end: { line: loc.range.end.line, character: loc.range.end.character } } }));
              showPeekReferences(locs, symbolName, position, uri);
              return;
            }
            const locs = result.locations.map((loc) => ({ uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`, range: { start: { line: loc.range.start.line, character: loc.range.start.character }, end: { line: loc.range.end.line, character: loc.range.end.character } } }));
            showPeekReferences(locs, symbolName, position, uri);
          } catch (error) { console.error("Failed to get references for peek:", error); }
        },
      });

      editor.addAction({
        id: "editor.action.findAllReferences",
        label: "Find All References",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F12],
        run: async (ed) => {
          const model = ed.getModel();
          const position = ed.getPosition();
          if (!model || !position) return;
          const uri = model.uri.toString();
          const filePath = uri.replace("file://", "");
          const languageId = model.getLanguageId();
          const wordInfo = model.getWordAtPosition(position);
          const symbolName = wordInfo?.word || "";
          try {
            const result = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_multi_references", {
              language: languageId, params: { uri: filePath, position: { line: position.lineNumber - 1, character: position.column - 1 } },
            });
            if (!result?.locations?.length) {
              const stdResult = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_references", {
                serverId: languageId, params: { uri: filePath, position: { line: position.lineNumber - 1, character: position.column - 1 } },
              });
              if (!stdResult?.locations?.length) { console.debug("No references found"); return; }
              const locs = stdResult.locations.map((loc) => ({ uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`, range: { start: { line: loc.range.start.line, character: loc.range.start.character }, end: { line: loc.range.end.line, character: loc.range.end.character } } }));
              showReferencesPanel(locs, symbolName, uri, { line: position.lineNumber - 1, character: position.column - 1 });
              return;
            }
            const locs = result.locations.map((loc) => ({ uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`, range: { start: { line: loc.range.start.line, character: loc.range.start.character }, end: { line: loc.range.end.line, character: loc.range.end.character } } }));
            showReferencesPanel(locs, symbolName, uri, { line: position.lineNumber - 1, character: position.column - 1 });
          } catch (error) { console.error("Failed to find all references:", error); }
        },
      });

      editor.addAction({
        id: "editor.action.peekImplementation", label: "Peek Implementation",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F12],
        run: (ed) => ed.trigger("keyboard", "editor.action.peekImplementation", null),
      });

      editor.onDidChangeModelContent(() => {
        const ed = props.editor();
        if (!ed) return;
        const currentFile = props.activeFile();
        if (!currentFile) return;
        const content = ed.getValue();
        updateFileContent(currentFile.id, content);
      });

      editor.onDidChangeCursorPosition((e) => {
        const ed = props.editor();
        const mon = props.monaco();
        if (!ed) return;
        const selections = ed.getSelections() || [];
        const cursorCount = selections.length;
        const selectionCount = selections.filter((s) => !s.isEmpty()).length;
        updateCursorInfo(cursorCount, selectionCount);
        const position = e.position;
        const currentFile = props.activeFile();
        window.dispatchEvent(
          new CustomEvent("editor:cursor-change", {
            detail: { line: position.lineNumber, column: position.column, cursorCount, selectionCount },
          }),
        );
        if (currentFile && mon && e.reason === mon.editor.CursorChangeReason.Explicit) {
          window.dispatchEvent(
            new CustomEvent("editor:cursor-changed", {
              detail: { filePath: currentFile.path, line: position.lineNumber, column: position.column },
            }),
          );
        }
      });

      editor.onDidChangeCursorSelection(() => {
        const ed = props.editor();
        if (!ed) return;
        const selections = ed.getSelections() || [];
        const cursorCount = selections.length;
        const selectionCount = selections.filter((s) => !s.isEmpty()).length;
        updateCursorInfo(cursorCount, selectionCount);
      });

      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          const currentFile = props.activeFile();
          if (currentFile) saveFile(currentFile.id);
        },
      );

      editor.addCommand(
        monaco.KeyCode.Tab,
        () => {
          const ed = props.editor();
          if (!ed) return;
          const position = ed.getPosition();
          if (!position) { ed.trigger("keyboard", "tab", null); return; }
          const model = ed.getModel();
          if (!model) { ed.trigger("keyboard", "tab", null); return; }
          const language = model.getLanguageId();
          const range = getAbbreviationRange(model, position, monaco);
          if (!range) { ed.trigger("keyboard", "tab", null); return; }
          const abbreviation = model.getValueInRange(range);
          const expanded = expandEmmetAbbreviation(abbreviation, language);
          if (expanded) {
            ed.executeEdits("emmet", [{ range, text: expanded }]);
          } else {
            ed.trigger("keyboard", "tab", null);
          }
        },
        "editorTextFocus && !suggestWidgetVisible && !inSnippetMode",
      );

      editor.addAction({
        id: "editor.action.rename",
        label: "Rename Symbol",
        keybindings: [monaco.KeyCode.F2],
        run: () => showRenameWidget(),
      });
    };

    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(deferredSetup, { timeout: 150 });
    } else {
      setTimeout(deferredSetup, 0);
    }
  });

  return null;
}
