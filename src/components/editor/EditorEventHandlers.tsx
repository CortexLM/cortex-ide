import { createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import type { OpenFile } from "@/context/EditorContext";
import type { InlineValueInfo } from "@/context/DebugContext";
import {
  updateInlayHintSettings,
  getInlayHintSettings,
  updateFormatOnTypeSettings,
  getFormatOnTypeSettings,
  updateUnicodeHighlightSettings,
  getUnicodeHighlightSettings,
  updateLinkedEditingEnabled,
} from "./modules/EditorLSP";
import {
  applyCoverageDecorations,
  clearCoverageDecorations,
} from "./modules/EditorUtils";
import {
  type InlineBlameMode,
  type InlineBlameManager,
  toggleInlineBlame,
} from "./InlineBlame";
import { goToNextChange, goToPrevChange } from "./GitGutterDecorations";
import {
  balanceInward,
  balanceOutward,
  getSelectionForWrap,
  wrapWithAbbreviation,
} from "@/utils/emmet";

// ============================================================================
// SmartSelectManager Interface
// ============================================================================

interface SmartSelectManagerLike {
  expandSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): Promise<void>;
  shrinkSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): void;
}

// ============================================================================
// Props
// ============================================================================

export interface EditorEventHandlersProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  activeFile: () => OpenFile | undefined;
  settingsState: any;
  updateEditorSetting: any;
  testing: any;
  debug: any;
  smartSelectManager: SmartSelectManagerLike;
  inlineBlameManager: InlineBlameManager | null;
  linkedEditingEnabled: boolean;
  formatOnPasteEnabled: boolean;
  updateFormatOnPasteEnabled: (enabled: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function EditorEventHandlers(props: EditorEventHandlersProps): null {
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;

    // =========================================================================
    // Navigation Event Handlers
    // =========================================================================

    const handleGotoLine = (
      e: CustomEvent<{ line: number; column?: number }>,
    ) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    const handleEditorGotoLine = (
      e: CustomEvent<{ line: number; column?: number }>,
    ) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    const handleOutlineNavigate = (
      e: CustomEvent<{ fileId: string; line: number; column: number }>,
    ) => {
      const currentFile = props.activeFile();
      if (!currentFile || e.detail.fileId !== currentFile.id) return;

      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // =========================================================================
    // Search Event Handlers
    // =========================================================================

    const handleBufferSearchGoto = (
      e: CustomEvent<{ line: number; start: number; end: number }>,
    ) => {
      const { line, start, end } = e.detail;
      const model = editor.getModel();
      if (!model) return;

      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(end);

      editor.setSelection({
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      });

      editor.revealLineInCenter(line);
      editor.focus();
    };

    const handleBufferSearchGetSelection = () => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        window.dispatchEvent(
          new CustomEvent("buffer-search:selection-response", {
            detail: {
              selection: {
                startLine: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLine: selection.endLineNumber,
                endColumn: selection.endColumn,
              },
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("buffer-search:selection-response", {
            detail: { selection: null },
          }),
        );
      }
    };

    let searchDecorations: string[] = [];

    const handleBufferSearchHighlights = (
      e: CustomEvent<{
        decorations: Array<{
          range: {
            startLine: number;
            startColumn: number;
            endLine: number;
            endColumn: number;
          };
          isCurrent: boolean;
        }>;
      }>,
    ) => {
      const { decorations } = e.detail;
      const model = editor.getModel();
      if (!model) return;

      const newDecorations = decorations.map((dec) => ({
        range: new monaco.Range(
          dec.range.startLine,
          dec.range.startColumn,
          dec.range.endLine,
          dec.range.endColumn,
        ),
        options: {
          className: dec.isCurrent ? "search-match-current" : "search-match",
          overviewRuler: {
            color: dec.isCurrent
              ? "rgba(249, 168, 37, 1)"
              : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.OverviewRulerLane.Center,
          },
          minimap: {
            color: dec.isCurrent
              ? "rgba(249, 168, 37, 1)"
              : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.MinimapPosition.Inline,
          },
        },
      }));

      searchDecorations = editor.deltaDecorations(
        searchDecorations,
        newDecorations,
      );
    };

    // =========================================================================
    // Terminal Integration Event Handlers
    // =========================================================================

    const handleGetSelectionForTerminal = () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (model && selection && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        window.dispatchEvent(
          new CustomEvent("editor:selection-for-terminal", {
            detail: { selection: selectedText },
          }),
        );
      }
    };

    const handleGetActiveFileForTerminal = () => {
      const currentFile = props.activeFile();
      if (currentFile?.path) {
        window.dispatchEvent(
          new CustomEvent("editor:active-file-for-terminal", {
            detail: { filePath: currentFile.path },
          }),
        );
      }
    };

    // =========================================================================
    // Editor Command Handler
    // =========================================================================

    const handleEditorCommand = async (e: CustomEvent<{ command: string }>) => {
      const { command } = e.detail;

      if (command === "expand-selection") {
        await props.smartSelectManager.expandSelection(editor, monaco);
        editor.focus();
        return;
      }

      if (command === "shrink-selection") {
        props.smartSelectManager.shrinkSelection(editor, monaco);
        editor.focus();
        return;
      }

      const customTransformCommands = [
        "transform-to-snakecase",
        "transform-to-camelcase",
        "transform-to-pascalcase",
        "transform-to-kebabcase",
        "transform-to-constantcase",
      ];

      if (customTransformCommands.includes(command)) {
        const action = editor.getAction(command);
        if (action) {
          action.run();
          editor.focus();
          return;
        }
      }

      if (
        command === "sort-lines-ascending" ||
        command === "sort-lines-descending" ||
        command === "sort-lines-ascending-case-insensitive" ||
        command === "sort-lines-descending-case-insensitive" ||
        command === "sort-lines-natural" ||
        command === "sort-lines-by-length" ||
        command === "reverse-lines" ||
        command === "shuffle-lines" ||
        command === "remove-duplicate-lines"
      ) {
        const model = editor.getModel();
        if (!model) return;

        const selection = editor.getSelection();
        const startLine = selection?.startLineNumber || 1;
        const endLine = selection?.endLineNumber || model.getLineCount();

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
          lines.push(model.getLineContent(i));
        }

        let sortedLines: string[];

        switch (command) {
          case "sort-lines-ascending":
            sortedLines = [...lines].sort((a, b) => a.localeCompare(b));
            break;
          case "sort-lines-descending":
            sortedLines = [...lines].sort((a, b) => b.localeCompare(a));
            break;
          case "sort-lines-ascending-case-insensitive":
            sortedLines = [...lines].sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase()),
            );
            break;
          case "sort-lines-descending-case-insensitive":
            sortedLines = [...lines].sort((a, b) =>
              b.toLowerCase().localeCompare(a.toLowerCase()),
            );
            break;
          case "sort-lines-natural":
            sortedLines = [...lines].sort((a, b) =>
              a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: "base",
              }),
            );
            break;
          case "sort-lines-by-length":
            sortedLines = [...lines].sort((a, b) => a.length - b.length);
            break;
          case "reverse-lines":
            sortedLines = [...lines].reverse();
            break;
          case "shuffle-lines":
            sortedLines = [...lines];
            for (let i = sortedLines.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [sortedLines[i], sortedLines[j]] = [
                sortedLines[j],
                sortedLines[i],
              ];
            }
            break;
          case "remove-duplicate-lines": {
            const seen = new Set<string>();
            sortedLines = lines.filter((line) => {
              if (seen.has(line)) {
                return false;
              }
              seen.add(line);
              return true;
            });
            break;
          }
          default:
            sortedLines = lines;
        }

        editor.pushUndoStop();
        editor.executeEdits("sortLines", [
          {
            range: {
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: endLine,
              endColumn: model.getLineMaxColumn(endLine),
            },
            text: sortedLines.join("\n"),
          },
        ]);
        editor.pushUndoStop();
        editor.focus();
        return;
      }

      const commandMap: Record<string, string> = {
        undo: "undo",
        redo: "redo",
        cut: "editor.action.clipboardCutAction",
        copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction",
        "select-all": "editor.action.selectAll",
        "add-cursor-above": "editor.action.insertCursorAbove",
        "add-cursor-below": "editor.action.insertCursorBelow",
        "select-all-occurrences": "editor.action.selectHighlights",
        "add-selection-to-next-find-match":
          "editor.action.addSelectionToNextFindMatch",
        "add-cursors-to-line-ends":
          "editor.action.insertCursorAtEndOfEachLineSelected",
        "undo-cursor": "cursorUndo",
        "duplicate-selection": "editor.action.copyLinesDownAction",
        "move-line-up": "editor.action.moveLinesUpAction",
        "move-line-down": "editor.action.moveLinesDownAction",
        "copy-line-up": "editor.action.copyLinesUpAction",
        "copy-line-down": "editor.action.copyLinesDownAction",
        "select-line": "expandLineSelection",
        "transform-to-uppercase": "editor.action.transformToUppercase",
        "transform-to-lowercase": "editor.action.transformToLowercase",
        "transform-to-titlecase": "editor.action.transformToTitlecase",
        "toggle-line-comment": "editor.action.commentLine",
        "toggle-block-comment": "editor.action.blockComment",
        "format-document": "editor.action.formatDocument",
        "indent-lines": "editor.action.indentLines",
        "outdent-lines": "editor.action.outdentLines",
        "fold-all": "editor.foldAll",
        "unfold-all": "editor.unfoldAll",
        "toggle-fold": "editor.toggleFold",
        "fold-level-1": "editor.foldLevel1",
        "fold-level-2": "editor.foldLevel2",
        "fold-level-3": "editor.foldLevel3",
        "fold-level-4": "editor.foldLevel4",
        "fold-level-5": "editor.foldLevel5",
        "fold-level-6": "editor.foldLevel6",
        "fold-level-7": "editor.foldLevel7",
        "fold-all-block-comments": "editor.foldAllBlockComments",
        "fold-all-regions": "editor.foldAllMarkerRegions",
        "unfold-all-regions": "editor.unfoldAllMarkerRegions",
        "fold-recursively": "editor.foldRecursively",
        "unfold-recursively": "editor.unfoldRecursively",
        "jump-to-bracket": "editor.action.jumpToBracket",
        "select-to-bracket": "editor.action.selectToBracket",
        "peek-definition": "editor.action.peekDefinition",
        "peek-references": "editor.action.referenceSearch.trigger",
        "peek-implementation": "editor.action.peekImplementation",
        "go-to-implementation": "editor.action.goToImplementation",
        "transpose-characters": "editor.action.transposeLetters",
        "delete-word-part-left": "deleteWordPartLeft",
        "delete-word-part-right": "deleteWordPartRight",
        "in-place-replace-up": "editor.action.inPlaceReplace.up",
        "in-place-replace-down": "editor.action.inPlaceReplace.down",
        "toggle-linked-editing": "editor.action.linkedEditing",
        "show-hover": "editor.action.showHover",
        "trigger-suggest": "editor.action.triggerSuggest",
        "trigger-parameter-hints": "editor.action.triggerParameterHints",
        "smart-select-expand": "editor.action.smartSelect.expand",
        "smart-select-shrink": "editor.action.smartSelect.shrink",
        "quick-fix": "editor.action.quickFix",
        refactor: "editor.action.refactor",
        "source-action": "editor.action.sourceAction",
        "rename-symbol": "editor.action.rename",
        "go-to-type-definition": "editor.action.goToTypeDefinition",
        "find-all-references": "editor.action.referenceSearch.trigger",
        "show-call-hierarchy": "editor.showCallHierarchy",
        "show-type-hierarchy": "editor.showTypeHierarchy",
        "organize-imports": "editor.action.organizeImports",
        "sort-imports": "editor.action.sortImports",
        "remove-unused-imports": "editor.action.removeUnusedImports",
        "add-missing-imports": "editor.action.addMissingImports",
        "toggle-column-selection": "editor.action.toggleColumnSelection",
      };

      const monacoCommand = commandMap[command];
      if (monacoCommand) {
        editor.trigger("external", monacoCommand, null);
        editor.focus();
      }
    };

    // =========================================================================
    // Editor Toggle Handlers
    // =========================================================================

    const handleFormatDocument = () => {
      editor.trigger("format", "editor.action.formatDocument", null);
    };

    const handleToggleWordWrap = () => {
      const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
      editor.updateOptions({ wordWrap: currentWrap === "off" ? "on" : "off" });
    };

    const handleToggleMinimap = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.minimap,
      );
      editor.updateOptions({ minimap: { enabled: !currentOption.enabled } });
    };

    const handleToggleStickyScroll = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.stickyScroll,
      );
      const newEnabled = !currentOption.enabled;
      editor.updateOptions({
        stickyScroll: { enabled: newEnabled, maxLineCount: 5 },
      });
      props.updateEditorSetting("stickyScrollEnabled", newEnabled);
    };

    const handleToggleBracketColorization = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.bracketPairColorization,
      );
      const newEnabled = !currentOption.enabled;
      editor.updateOptions({
        bracketPairColorization: {
          enabled: newEnabled,
          independentColorPoolPerBracketType: true,
        },
      });
      props.updateEditorSetting("bracketPairColorization", newEnabled);
    };

    const handleToggleBracketGuides = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.guides);
      const newEnabled = !currentOption.bracketPairs;
      editor.updateOptions({
        guides: {
          ...currentOption,
          bracketPairs: newEnabled,
          bracketPairsHorizontal: newEnabled,
        },
      });
      props.updateEditorSetting("guidesBracketPairs", newEnabled);
    };

    const handleToggleIndentationGuides = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.guides);
      const newEnabled = !currentOption.indentation;
      editor.updateOptions({
        guides: {
          ...currentOption,
          indentation: newEnabled,
          highlightActiveIndentation: newEnabled,
        },
      });
      props.updateEditorSetting("guidesIndentation", newEnabled);
    };

    // =========================================================================
    // Settings Event Handlers
    // =========================================================================

    const handleToggleInlayHints = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.inlayHints,
      );
      const currentEnabled = currentOption.enabled;
      const newEnabled: "on" | "off" = currentEnabled === "on" ? "off" : "on";
      editor.updateOptions({
        inlayHints: {
          ...currentOption,
          enabled: newEnabled,
        },
      });
      updateInlayHintSettings({ enabled: newEnabled });
    };

    const handleToggleUnicodeHighlight = () => {
      const newEnabled = !getUnicodeHighlightSettings().enabled;
      updateUnicodeHighlightSettings({ enabled: newEnabled });
      editor.updateOptions({
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
    };

    const handleUnicodeHighlightSettingsChange = (
      e: CustomEvent<{
        enabled?: boolean;
        invisibleCharacters?: boolean;
        ambiguousCharacters?: boolean;
        nonBasicASCII?: boolean;
      }>,
    ) => {
      const {
        enabled,
        invisibleCharacters,
        ambiguousCharacters,
        nonBasicASCII,
      } = e.detail;

      updateUnicodeHighlightSettings({
        enabled: enabled ?? getUnicodeHighlightSettings().enabled,
        invisibleCharacters:
          invisibleCharacters ??
          getUnicodeHighlightSettings().invisibleCharacters,
        ambiguousCharacters:
          ambiguousCharacters ??
          getUnicodeHighlightSettings().ambiguousCharacters,
        nonBasicASCII:
          nonBasicASCII ?? getUnicodeHighlightSettings().nonBasicASCII,
      });

      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters:
            ambiguousCharacters ??
            getUnicodeHighlightSettings().ambiguousCharacters,
          invisibleCharacters:
            invisibleCharacters ??
            getUnicodeHighlightSettings().invisibleCharacters,
          nonBasicASCII:
            nonBasicASCII ?? getUnicodeHighlightSettings().nonBasicASCII,
        },
      });
    };

    const handleToggleLinkedEditing = () => {
      const newEnabled = !props.linkedEditingEnabled;
      updateLinkedEditingEnabled(newEnabled);
      editor.updateOptions({ linkedEditing: newEnabled });
      props.updateEditorSetting("linkedEditing", newEnabled);
    };

    const handleToggleFormatOnType = () => {
      const newEnabled = !getFormatOnTypeSettings().enabled;
      updateFormatOnTypeSettings({ enabled: newEnabled });
      editor.updateOptions({ formatOnType: newEnabled });
      props.updateEditorSetting("formatOnType", newEnabled);
    };

    const handleToggleFormatOnPaste = () => {
      const newEnabled = !props.formatOnPasteEnabled;
      props.updateFormatOnPasteEnabled(newEnabled);
      props.updateEditorSetting("formatOnPaste", newEnabled);
    };

    const handleFormatOnTypeSettingsChange = (
      e: CustomEvent<{
        enabled?: boolean;
        triggerCharacters?: string[];
      }>,
    ) => {
      const { enabled, triggerCharacters } = e.detail;

      if (enabled !== undefined) {
        editor.updateOptions({ formatOnType: enabled });
      }

      updateFormatOnTypeSettings({
        enabled: enabled ?? getFormatOnTypeSettings().enabled,
        triggerCharacters:
          triggerCharacters ?? getFormatOnTypeSettings().triggerCharacters,
      });
    };

    const handleInlayHintsSettingsChange = (
      e: CustomEvent<{
        enabled?: "on" | "off" | "onUnlessPressed" | "offUnlessPressed";
        fontSize?: number;
        showParameterNames?: boolean;
        showTypeHints?: boolean;
      }>,
    ) => {
      const { enabled, fontSize, showParameterNames, showTypeHints } = e.detail;
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.inlayHints,
      );

      editor.updateOptions({
        inlayHints: {
          ...currentOption,
          enabled: enabled ?? currentOption.enabled,
          fontSize: fontSize ?? currentOption.fontSize,
        },
      });

      updateInlayHintSettings({
        enabled: enabled ?? getInlayHintSettings().enabled,
        fontSize: fontSize ?? getInlayHintSettings().fontSize,
        showParameterNames:
          showParameterNames ?? getInlayHintSettings().showParameterNames,
        showTypeHints: showTypeHints ?? getInlayHintSettings().showTypeHints,
      });
    };

    // =========================================================================
    // Coverage Decoration Event Handlers
    // =========================================================================

    const updateCoverageDecorationsForFile = () => {
      const file = props.activeFile();
      if (!file || !props.testing.state.showCoverageDecorations) {
        clearCoverageDecorations(editor);
        return;
      }

      const coverage = props.testing.getCoverageForFile(file.path);
      if (coverage && coverage.lines.length > 0) {
        applyCoverageDecorations(editor, monaco, coverage.lines);
      } else {
        clearCoverageDecorations(editor);
      }
    };

    const handleCoverageUpdated = () => {
      updateCoverageDecorationsForFile();
    };

    const handleCoverageVisibilityChanged = (
      e: CustomEvent<{ visible: boolean }>,
    ) => {
      if (!e.detail) return;
      if (e.detail.visible) {
        updateCoverageDecorationsForFile();
      } else {
        clearCoverageDecorations(editor);
      }
    };

    const handleCoverageCleared = () => {
      clearCoverageDecorations(editor);
    };

    const handleToggleCoverageDecorations = () => {
      props.testing.toggleCoverageDecorations();
    };

    if (props.testing.state.showCoverageDecorations) {
      updateCoverageDecorationsForFile();
    }

    // =========================================================================
    // Debug Inline Values Decorations
    // =========================================================================

    let inlineValueDecorations: string[] = [];

    const updateInlineValueDecorations = (
      values: InlineValueInfo[],
      filePath: string,
    ) => {
      const model = editor.getModel();
      if (!model) {
        inlineValueDecorations = editor.deltaDecorations(
          inlineValueDecorations,
          [],
        );
        return;
      }
      const currentFile = props.activeFile();
      if (!currentFile || currentFile.path !== filePath) {
        return;
      }
      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
      const escapeRegExp = (str: string): string =>
        str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      for (const inlineValue of values) {
        const lineContent = model.getLineContent(inlineValue.line);
        const regex = new RegExp(
          `\\b${escapeRegExp(inlineValue.name)}\\b`,
          "g",
        );
        let match: RegExpExecArray | null;
        let firstMatch = true;

        while ((match = regex.exec(lineContent)) !== null) {
          if (firstMatch) {
            firstMatch = false;
            const endColumn = match.index + inlineValue.name.length + 1;
            newDecorations.push({
              range: new monaco.Range(
                inlineValue.line,
                endColumn,
                inlineValue.line,
                endColumn,
              ),
              options: {
                after: {
                  content: ` = ${inlineValue.value}`,
                  inlineClassName: "debug-inline-value",
                },
                hoverMessage: {
                  value: `**${inlineValue.name}**${inlineValue.type ? ` (${inlineValue.type})` : ""}\n\n\`\`\`\n${inlineValue.fullValue}\n\`\`\``,
                },
              },
            });
          }
        }
      }
      inlineValueDecorations = editor.deltaDecorations(
        inlineValueDecorations,
        newDecorations,
      );
    };

    const clearInlineValueDecorations = () => {
      inlineValueDecorations = editor.deltaDecorations(
        inlineValueDecorations,
        [],
      );
    };

    const handleDebugInlineValuesUpdated = (
      e: CustomEvent<{ path: string; values: InlineValueInfo[] }>,
    ) => {
      const { path, values } = e.detail;
      updateInlineValueDecorations(values, path);
    };

    const handleDebugCleared = () => {
      clearInlineValueDecorations();
    };

    const handleDebugToggleBreakpoint = (e: CustomEvent<{ path: string }>) => {
      const currentFile = props.activeFile();
      if (!currentFile || e.detail.path !== currentFile.path) return;

      const position = editor.getPosition();
      if (position) {
        window.dispatchEvent(
          new CustomEvent("debug:toggle-breakpoint-at-line", {
            detail: { path: currentFile.path, line: position.lineNumber },
          }),
        );
      }
    };

    const handleDebugJumpToCursorRequest = (
      e: CustomEvent<{ path: string }>,
    ) => {
      const currentFile = props.activeFile();
      if (!currentFile || e.detail.path !== currentFile.path) return;

      const position = editor.getPosition();
      if (position) {
        window.dispatchEvent(
          new CustomEvent("debug:jump-to-cursor-execute", {
            detail: { path: currentFile.path, line: position.lineNumber },
          }),
        );
      }
    };

    // =========================================================================
    // Emmet Event Handlers
    // =========================================================================

    const handleEmmetBalanceInward = () => {
      balanceInward(editor, monaco);
      editor.focus();
    };

    const handleEmmetBalanceOutward = () => {
      balanceOutward(editor, monaco);
      editor.focus();
    };

    const handleEmmetGetSelection = () => {
      const text = getSelectionForWrap(editor);
      window.dispatchEvent(
        new CustomEvent("emmet:selection-response", {
          detail: { text },
        }),
      );
    };

    const handleEmmetWrap = (e: CustomEvent<{ abbreviation: string }>) => {
      const { abbreviation } = e.detail;
      if (abbreviation) {
        wrapWithAbbreviation(editor, monaco, abbreviation);
        editor.focus();
      }
    };

    // =========================================================================
    // Inline Blame Event Handlers
    // =========================================================================

    const handleInlineBlameModeChange = (
      e: CustomEvent<{ mode: InlineBlameMode }>,
    ) => {
      const { mode } = e.detail;
      if (props.inlineBlameManager) {
        props.inlineBlameManager.setMode(mode);
      }
    };

    const handleToggleInlineBlame = () => {
      toggleInlineBlame();
    };

    // =========================================================================
    // Zen Mode Line Numbers Event Handlers
    // =========================================================================

    let zenModeOriginalLineNumbers: "on" | "off" | "relative" | "interval" =
      "on";

    const handleZenModeEnter = (
      e: CustomEvent<{ settings: { hideLineNumbers?: boolean } }>,
    ) => {
      const { settings } = e.detail || {};
      if (settings?.hideLineNumbers) {
        const currentOption = editor.getOption(
          monaco.editor.EditorOption.lineNumbers,
        );
        zenModeOriginalLineNumbers =
          currentOption.renderType === 0
            ? "off"
            : currentOption.renderType === 1
              ? "on"
              : currentOption.renderType === 2
                ? "relative"
                : "interval";
        editor.updateOptions({ lineNumbers: "off" });
      }
    };

    const handleZenModeExit = (
      e: CustomEvent<{ savedState?: { lineNumbers?: string } }>,
    ) => {
      const { savedState } = e.detail || {};
      const restoreTo =
        (savedState?.lineNumbers as "on" | "off" | "relative" | "interval") ||
        zenModeOriginalLineNumbers ||
        "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };

    const handleZenModeHideLineNumbers = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.lineNumbers,
      );
      zenModeOriginalLineNumbers =
        currentOption.renderType === 0
          ? "off"
          : currentOption.renderType === 1
            ? "on"
            : currentOption.renderType === 2
              ? "relative"
              : "interval";
      editor.updateOptions({ lineNumbers: "off" });
    };

    const handleZenModeRestoreLineNumbers = (
      e: CustomEvent<{ lineNumbers?: string }>,
    ) => {
      const restoreTo =
        (e.detail?.lineNumbers as "on" | "off" | "relative" | "interval") ||
        zenModeOriginalLineNumbers ||
        "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };

    // =========================================================================
    // Git Diff Navigation Event Handlers
    // =========================================================================

    const handleGoToNextChange = () => {
      const file = props.activeFile();
      if (file?.path) {
        goToNextChange(editor, file.path);
      }
    };

    const handleGoToPrevChange = () => {
      const file = props.activeFile();
      if (file?.path) {
        goToPrevChange(editor, file.path);
      }
    };

    // =========================================================================
    // Editor Action & Cursor Position Handlers
    // =========================================================================

    const handleEditorAction = (e: CustomEvent<{ action: string }>) => {
      const { action } = e.detail;
      if (action) {
        const monacoAction = editor.getAction(action);
        if (monacoAction) {
          monacoAction.run();
        }
        editor.focus();
      }
    };

    const handleSetCursorPosition = (
      e: CustomEvent<{ filePath: string; line: number; column: number }>,
    ) => {
      const currentFile = props.activeFile();
      if (!currentFile || e.detail.filePath !== currentFile.path) return;

      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // =========================================================================
    // Register All Event Listeners
    // =========================================================================

    window.addEventListener("editor:goto-line", handleGotoLine as EventListener);
    window.addEventListener(
      "editor:goto-line",
      handleEditorGotoLine as EventListener,
    );
    window.addEventListener(
      "editor:set-cursor-position",
      handleSetCursorPosition as EventListener,
    );
    window.addEventListener(
      "outline:navigate",
      handleOutlineNavigate as EventListener,
    );
    window.addEventListener(
      "buffer-search:goto",
      handleBufferSearchGoto as EventListener,
    );
    window.addEventListener(
      "buffer-search:highlights",
      handleBufferSearchHighlights as EventListener,
    );
    window.addEventListener(
      "buffer-search:get-selection",
      handleBufferSearchGetSelection,
    );
    window.addEventListener(
      "editor:command",
      handleEditorCommand as unknown as EventListener,
    );
    window.addEventListener("editor:format-document", handleFormatDocument);
    window.addEventListener("editor:toggle-word-wrap", handleToggleWordWrap);
    window.addEventListener("editor:toggle-minimap", handleToggleMinimap);
    window.addEventListener(
      "editor:toggle-sticky-scroll",
      handleToggleStickyScroll,
    );
    window.addEventListener(
      "editor:toggle-bracket-colorization",
      handleToggleBracketColorization,
    );
    window.addEventListener(
      "editor:toggle-bracket-guides",
      handleToggleBracketGuides,
    );
    window.addEventListener(
      "editor:toggle-indentation-guides",
      handleToggleIndentationGuides,
    );
    window.addEventListener(
      "editor:toggle-inlay-hints",
      handleToggleInlayHints,
    );
    window.addEventListener(
      "editor:toggle-unicode-highlight",
      handleToggleUnicodeHighlight,
    );
    window.addEventListener(
      "editor:unicode-highlight-settings",
      handleUnicodeHighlightSettingsChange as EventListener,
    );
    window.addEventListener(
      "editor:toggle-linked-editing",
      handleToggleLinkedEditing,
    );
    window.addEventListener(
      "editor:toggle-format-on-type",
      handleToggleFormatOnType,
    );
    window.addEventListener(
      "editor:toggle-format-on-paste",
      handleToggleFormatOnPaste,
    );
    window.addEventListener(
      "editor:inlay-hints-settings",
      handleInlayHintsSettingsChange as EventListener,
    );
    window.addEventListener(
      "editor:format-on-type-settings",
      handleFormatOnTypeSettingsChange as EventListener,
    );
    window.addEventListener("testing:coverage-updated", handleCoverageUpdated);
    window.addEventListener(
      "testing:coverage-visibility-changed",
      handleCoverageVisibilityChanged as EventListener,
    );
    window.addEventListener("testing:coverage-cleared", handleCoverageCleared);
    window.addEventListener(
      "editor:toggle-coverage-decorations",
      handleToggleCoverageDecorations,
    );
    window.addEventListener(
      "debug:inline-values-updated",
      handleDebugInlineValuesUpdated as EventListener,
    );
    window.addEventListener("debug:cleared", handleDebugCleared);
    window.addEventListener(
      "debug:toggle-breakpoint",
      handleDebugToggleBreakpoint as EventListener,
    );
    window.addEventListener(
      "debug:jump-to-cursor-request",
      handleDebugJumpToCursorRequest as EventListener,
    );
    window.addEventListener("emmet:balance-inward", handleEmmetBalanceInward);
    window.addEventListener("emmet:balance-outward", handleEmmetBalanceOutward);
    window.addEventListener("emmet:get-selection", handleEmmetGetSelection);
    window.addEventListener("emmet:wrap", handleEmmetWrap as EventListener);
    window.addEventListener(
      "inline-blame:mode-changed",
      handleInlineBlameModeChange as EventListener,
    );
    window.addEventListener("inline-blame:toggle", handleToggleInlineBlame);
    window.addEventListener("git:go-to-next-change", handleGoToNextChange);
    window.addEventListener("git:go-to-prev-change", handleGoToPrevChange);
    window.addEventListener(
      "editor:action",
      handleEditorAction as EventListener,
    );
    window.addEventListener(
      "zenmode:enter",
      handleZenModeEnter as EventListener,
    );
    window.addEventListener("zenmode:exit", handleZenModeExit as EventListener);
    window.addEventListener(
      "zenmode:hide-line-numbers",
      handleZenModeHideLineNumbers,
    );
    window.addEventListener(
      "zenmode:restore-line-numbers",
      handleZenModeRestoreLineNumbers as EventListener,
    );
    window.addEventListener(
      "editor:get-selection-for-terminal",
      handleGetSelectionForTerminal,
    );
    window.addEventListener(
      "editor:get-active-file-for-terminal",
      handleGetActiveFileForTerminal,
    );

    // =========================================================================
    // Cleanup
    // =========================================================================

    const disposeListener = editor.onDidDispose(() => {
      cleanup();
    });

    const cleanup = () => {
      window.removeEventListener(
        "editor:goto-line",
        handleGotoLine as EventListener,
      );
      window.removeEventListener(
        "editor:goto-line",
        handleEditorGotoLine as EventListener,
      );
      window.removeEventListener(
        "editor:set-cursor-position",
        handleSetCursorPosition as EventListener,
      );
      window.removeEventListener(
        "outline:navigate",
        handleOutlineNavigate as EventListener,
      );
      window.removeEventListener(
        "buffer-search:goto",
        handleBufferSearchGoto as EventListener,
      );
      window.removeEventListener(
        "buffer-search:highlights",
        handleBufferSearchHighlights as EventListener,
      );
      window.removeEventListener(
        "buffer-search:get-selection",
        handleBufferSearchGetSelection,
      );
      window.removeEventListener(
        "editor:command",
        handleEditorCommand as unknown as EventListener,
      );
      window.removeEventListener(
        "editor:format-document",
        handleFormatDocument,
      );
      window.removeEventListener(
        "editor:toggle-word-wrap",
        handleToggleWordWrap,
      );
      window.removeEventListener(
        "editor:toggle-minimap",
        handleToggleMinimap,
      );
      window.removeEventListener(
        "editor:toggle-sticky-scroll",
        handleToggleStickyScroll,
      );
      window.removeEventListener(
        "editor:toggle-bracket-colorization",
        handleToggleBracketColorization,
      );
      window.removeEventListener(
        "editor:toggle-bracket-guides",
        handleToggleBracketGuides,
      );
      window.removeEventListener(
        "editor:toggle-indentation-guides",
        handleToggleIndentationGuides,
      );
      window.removeEventListener(
        "editor:toggle-inlay-hints",
        handleToggleInlayHints,
      );
      window.removeEventListener(
        "editor:toggle-unicode-highlight",
        handleToggleUnicodeHighlight,
      );
      window.removeEventListener(
        "editor:unicode-highlight-settings",
        handleUnicodeHighlightSettingsChange as EventListener,
      );
      window.removeEventListener(
        "editor:toggle-linked-editing",
        handleToggleLinkedEditing,
      );
      window.removeEventListener(
        "editor:toggle-format-on-type",
        handleToggleFormatOnType,
      );
      window.removeEventListener(
        "editor:toggle-format-on-paste",
        handleToggleFormatOnPaste,
      );
      window.removeEventListener(
        "editor:inlay-hints-settings",
        handleInlayHintsSettingsChange as EventListener,
      );
      window.removeEventListener(
        "editor:format-on-type-settings",
        handleFormatOnTypeSettingsChange as EventListener,
      );
      window.removeEventListener(
        "testing:coverage-updated",
        handleCoverageUpdated,
      );
      window.removeEventListener(
        "testing:coverage-visibility-changed",
        handleCoverageVisibilityChanged as EventListener,
      );
      window.removeEventListener(
        "testing:coverage-cleared",
        handleCoverageCleared,
      );
      window.removeEventListener(
        "editor:toggle-coverage-decorations",
        handleToggleCoverageDecorations,
      );
      window.removeEventListener(
        "debug:inline-values-updated",
        handleDebugInlineValuesUpdated as EventListener,
      );
      window.removeEventListener("debug:cleared", handleDebugCleared);
      window.removeEventListener(
        "debug:toggle-breakpoint",
        handleDebugToggleBreakpoint as EventListener,
      );
      window.removeEventListener(
        "debug:jump-to-cursor-request",
        handleDebugJumpToCursorRequest as EventListener,
      );
      window.removeEventListener(
        "emmet:balance-inward",
        handleEmmetBalanceInward,
      );
      window.removeEventListener(
        "emmet:balance-outward",
        handleEmmetBalanceOutward,
      );
      window.removeEventListener(
        "emmet:get-selection",
        handleEmmetGetSelection,
      );
      window.removeEventListener(
        "emmet:wrap",
        handleEmmetWrap as EventListener,
      );
      window.removeEventListener(
        "inline-blame:mode-changed",
        handleInlineBlameModeChange as EventListener,
      );
      window.removeEventListener(
        "inline-blame:toggle",
        handleToggleInlineBlame,
      );
      window.removeEventListener(
        "git:go-to-next-change",
        handleGoToNextChange,
      );
      window.removeEventListener(
        "git:go-to-prev-change",
        handleGoToPrevChange,
      );
      window.removeEventListener(
        "editor:action",
        handleEditorAction as EventListener,
      );
      window.removeEventListener(
        "zenmode:enter",
        handleZenModeEnter as EventListener,
      );
      window.removeEventListener(
        "zenmode:exit",
        handleZenModeExit as EventListener,
      );
      window.removeEventListener(
        "zenmode:hide-line-numbers",
        handleZenModeHideLineNumbers,
      );
      window.removeEventListener(
        "zenmode:restore-line-numbers",
        handleZenModeRestoreLineNumbers as EventListener,
      );
      window.removeEventListener(
        "editor:get-selection-for-terminal",
        handleGetSelectionForTerminal,
      );
      window.removeEventListener(
        "editor:get-active-file-for-terminal",
        handleGetActiveFileForTerminal,
      );
      searchDecorations = editor.deltaDecorations(searchDecorations, []);
      clearCoverageDecorations(editor);
      clearInlineValueDecorations();
      if (props.inlineBlameManager) {
        props.inlineBlameManager.dispose();
      }
      disposeListener.dispose();
    };

    onCleanup(cleanup);
  });

  return null;
}
