/**
 * EditorActions - Multi-cursor actions, text transforms, and editor commands
 *
 * Contains functions to set up Monaco editor actions including:
 * - Multi-cursor operations (add cursor above/below, select all occurrences)
 * - Text transformations (case conversions)
 * - Line operations (move, copy, duplicate)
 * - Column/block selection
 * - Git diff navigation
 * - Bracket matching
 * - Peek definition
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import {
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toConstantCase,
} from "./EditorUtils";

export interface PeekLocation {
  uri: string;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface SmartSelectManager {
  expandSelection: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => Promise<void>;
  shrinkSelection: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => void;
}

export interface GitDiffNavigator {
  goToNextChange: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    filePath: string
  ) => void;
  goToPrevChange: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    filePath: string
  ) => void;
}

export interface PeekWidgetController {
  showPeekWidget: (
    locations: PeekLocation[],
    position: Monaco.Position,
    originUri: string
  ) => void;
  hidePeekWidget: () => void;
}

export function setupMultiCursorActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  _fileId: string,
  smartSelectManager: SmartSelectManager,
  gitDiffNavigator: GitDiffNavigator,
  peekWidgetController: PeekWidgetController,
  getActiveFile: () => { path: string } | undefined
): void {
  editor.addAction({
    id: "add-cursor-above",
    label: "Add Cursor Above",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.insertCursorAbove", null);
    },
  });

  editor.addAction({
    id: "add-cursor-below",
    label: "Add Cursor Below",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.insertCursorBelow", null);
    },
  });

  editor.addAction({
    id: "select-all-occurrences",
    label: "Select All Occurrences",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.selectHighlights", null);
    },
  });

  editor.addAction({
    id: "add-selection-to-next-find-match",
    label: "Add Selection to Next Find Match",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null);
    },
  });

  editor.addAction({
    id: "add-cursors-to-line-ends",
    label: "Add Cursors to Line Ends",
    keybindings: [
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyI,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.insertCursorAtEndOfEachLineSelected", null);
    },
  });

  editor.addAction({
    id: "expand-selection",
    label: "Expand Selection",
    keybindings: [
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
    ],
    run: async (ed) => {
      await smartSelectManager.expandSelection(
        ed as Monaco.editor.IStandaloneCodeEditor,
        monaco
      );
    },
  });

  editor.addAction({
    id: "shrink-selection",
    label: "Shrink Selection",
    keybindings: [
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
    ],
    run: (ed) => {
      smartSelectManager.shrinkSelection(
        ed as Monaco.editor.IStandaloneCodeEditor,
        monaco
      );
    },
  });

  editor.addAction({
    id: "undo-cursor",
    label: "Undo Last Cursor Operation",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU],
    run: (ed) => {
      ed.trigger("keyboard", "cursorUndo", null);
    },
  });

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
  });

  editor.addAction({
    id: "select-line",
    label: "Select Line",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
    run: (ed) => {
      ed.trigger("keyboard", "expandLineSelection", null);
    },
  });

  editor.addAction({
    id: "move-line-up",
    label: "Move Line Up",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.moveLinesUpAction", null);
    },
  });

  editor.addAction({
    id: "move-line-down",
    label: "Move Line Down",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.moveLinesDownAction", null);
    },
  });

  editor.addAction({
    id: "copy-line-up",
    label: "Copy Line Up",
    keybindings: [
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.copyLinesUpAction", null);
    },
  });

  editor.addAction({
    id: "copy-line-down",
    label: "Copy Line Down",
    keybindings: [
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.copyLinesDownAction", null);
    },
  });

  editor.addAction({
    id: "duplicate-selection",
    label: "Duplicate Selection",
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

          edits.push({
            range: new monaco.Range(lineNumber, lineEndColumn, lineNumber, lineEndColumn),
            text: "\n" + lineContent,
          });

          newSelections.push(
            new monaco.Selection(
              lineNumber + 1,
              selection.startColumn,
              lineNumber + 1,
              selection.endColumn
            )
          );
        } else {
          edits.push({
            range: new monaco.Range(
              selection.endLineNumber,
              selection.endColumn,
              selection.endLineNumber,
              selection.endColumn
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
                : newStartColumn + text.length
            )
          );
        }
      });

      ed.executeEdits("duplicate-selection", edits);
      ed.setSelections(newSelections);
    },
  });

  editor.addAction({
    id: "transform-to-uppercase",
    label: "Transform to Uppercase",
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.transformToUppercase", null);
    },
  });

  editor.addAction({
    id: "transform-to-lowercase",
    label: "Transform to Lowercase",
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.transformToLowercase", null);
    },
  });

  editor.addAction({
    id: "transform-to-titlecase",
    label: "Transform to Title Case",
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.transformToTitlecase", null);
    },
  });

  const textTransforms = [
    { id: "transform-to-snakecase", label: "Transform to snake_case", fn: toSnakeCase },
    { id: "transform-to-camelcase", label: "Transform to camelCase", fn: toCamelCase },
    { id: "transform-to-pascalcase", label: "Transform to PascalCase", fn: toPascalCase },
    { id: "transform-to-kebabcase", label: "Transform to kebab-case", fn: toKebabCase },
    { id: "transform-to-constantcase", label: "Transform to CONSTANT_CASE", fn: toConstantCase },
  ];

  for (const { id, label, fn } of textTransforms) {
    editor.addAction({
      id,
      label,
      run: (ed) => {
        const selections = ed.getSelections();
        if (!selections) return;

        const model = ed.getModel();
        if (!model) return;

        ed.pushUndoStop();

        const edits = selections.map((sel) => ({
          range: sel,
          text: fn(model.getValueInRange(sel)),
        }));

        ed.executeEdits("transform", edits);
        ed.pushUndoStop();
      },
    });
  }

  let isColumnSelecting = false;
  let columnSelectStart: { lineNumber: number; column: number } | null = null;

  editor.onMouseDown((e) => {
    if (e.event.shiftKey && e.event.altKey && e.target.position) {
      isColumnSelecting = true;
      columnSelectStart = e.target.position;
    }
  });

  editor.onMouseMove((e) => {
    if (isColumnSelecting && columnSelectStart && e.target.position) {
      const startLine = Math.min(columnSelectStart.lineNumber, e.target.position.lineNumber);
      const endLine = Math.max(columnSelectStart.lineNumber, e.target.position.lineNumber);
      const startColumn = Math.min(columnSelectStart.column, e.target.position.column);
      const endColumn = Math.max(columnSelectStart.column, e.target.position.column);

      const selections: Monaco.Selection[] = [];
      for (let line = startLine; line <= endLine; line++) {
        selections.push(new monaco.Selection(line, startColumn, line, endColumn));
      }

      if (selections.length > 0) {
        editor.setSelections(selections);
      }
    }
  });

  editor.onMouseUp(() => {
    isColumnSelecting = false;
    columnSelectStart = null;
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
      e.preventDefault();
      editor.trigger("keyboard", "editor.action.selectHighlights", null);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault();
      editor.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null);
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  editor.onDidDispose(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  editor.addAction({
    id: "editor.action.dirtydiff.next",
    label: "Go to Next Change",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F3],
    run: () => {
      const file = getActiveFile();
      if (file?.path) {
        gitDiffNavigator.goToNextChange(editor, file.path);
      }
    },
  });

  editor.addAction({
    id: "editor.action.dirtydiff.previous",
    label: "Go to Previous Change",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F3],
    run: () => {
      const file = getActiveFile();
      if (file?.path) {
        gitDiffNavigator.goToPrevChange(editor, file.path);
      }
    },
  });

  editor.addAction({
    id: "editor.action.jumpToBracket",
    label: "Go to Bracket",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backslash,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.jumpToBracket", null);
    },
  });

  editor.addAction({
    id: "editor.action.selectToBracket",
    label: "Select to Bracket",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.Backslash,
    ],
    run: (ed) => {
      ed.trigger("keyboard", "editor.action.selectToBracket", null);
    },
  });

  editor.addAction({
    id: "editor.action.peekDefinition",
    label: "Peek Definition",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
    run: async (ed) => {
      const model = ed.getModel();
      const position = ed.getPosition();
      if (!model || !position) return;

      const uri = model.uri.toString();
      const filePath = uri.replace("file://", "");

      try {
        const languageId = model.getLanguageId();

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

          if (!standardResult || !standardResult.locations || standardResult.locations.length === 0) {
            console.debug("No definition found for peek");
            return;
          }

          const peekLocations: PeekLocation[] = standardResult.locations.map((loc) => ({
            uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
            range: {
              startLineNumber: loc.range.start.line + 1,
              startColumn: loc.range.start.character + 1,
              endLineNumber: loc.range.end.line + 1,
              endColumn: loc.range.end.character + 1,
            },
          }));

          peekWidgetController.showPeekWidget(peekLocations, position, uri);
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

        peekWidgetController.showPeekWidget(peekLocations, position, uri);
      } catch (error) {
        console.error("Failed to get definition for peek:", error);
      }
    },
  });

  editor.addAction({
    id: "editor.action.closePeekWidget",
    label: "Close Peek Widget",
    keybindings: [monaco.KeyCode.Escape],
    precondition: undefined,
    run: () => {
      peekWidgetController.hidePeekWidget();
    },
  });
}

export function setupFormatOnPaste(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  isFormatOnPasteEnabled: () => boolean
): Monaco.IDisposable {
  let isPasteOperation = false;

  const domNode = editor.getDomNode();

  const handlePaste = (_e: ClipboardEvent) => {
    if (!isFormatOnPasteEnabled()) return;
    isPasteOperation = true;
  };

  if (domNode) {
    domNode.addEventListener("paste", handlePaste, true);
  }

  const contentChangeDisposable = editor.onDidChangeModelContent(async (e) => {
    if (!isPasteOperation) return;
    isPasteOperation = false;

    if (!isFormatOnPasteEnabled()) {
      return;
    }

    if (e.changes.length === 0) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    let minStartLine = Infinity;
    let maxEndLine = -Infinity;

    for (const change of e.changes) {
      const lines = change.text.split("\n");
      const startLine = change.range.startLineNumber;
      const endLine = startLine + lines.length - 1;

      minStartLine = Math.min(minStartLine, startLine);
      maxEndLine = Math.max(maxEndLine, endLine);
    }

    if (minStartLine > maxEndLine || minStartLine > model.getLineCount()) {
      return;
    }

    maxEndLine = Math.min(maxEndLine, model.getLineCount());

    const rangeToFormat = new monaco.Range(
      minStartLine,
      1,
      maxEndLine,
      model.getLineMaxColumn(maxEndLine)
    );

    const cursorAfterPaste = editor.getPosition();

    requestAnimationFrame(async () => {
      try {
        editor.setSelection(rangeToFormat);

        const formatAction = editor.getAction("editor.action.formatSelection");
        if (formatAction) {
          await formatAction.run();
        }

        if (cursorAfterPaste) {
          const newModel = editor.getModel();
          if (newModel) {
            const maxLine = newModel.getLineCount();
            const targetLine = Math.min(cursorAfterPaste.lineNumber, maxLine);
            const maxColumn = newModel.getLineMaxColumn(targetLine);
            const targetColumn = Math.min(cursorAfterPaste.column, maxColumn);
            editor.setPosition({ lineNumber: targetLine, column: targetColumn });
          }
        }
      } catch (err) {
        console.debug("[FormatOnPaste] Formatting failed:", err);
      }
    });
  });

  return {
    dispose: () => {
      if (domNode) {
        domNode.removeEventListener("paste", handlePaste, true);
      }
      contentChangeDisposable?.dispose?.();
    },
  };
}

export function setupLinkedEditingActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  findLinkedEditingRanges: (
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    monaco: typeof Monaco
  ) => Monaco.languages.LinkedEditingRanges | null,
  getTagAtPosition: (
    lineContent: string,
    column: number
  ) => {
    tagName: string;
    isClosingTag: boolean;
    isSelfClosing: boolean;
    startColumn: number;
    endColumn: number;
  } | null,
  findMatchingTag: (
    content: string,
    model: Monaco.editor.ITextModel,
    lineNumber: number,
    startColumn: number,
    endColumn: number,
    tagName: string,
    isClosingTag: boolean,
    monaco: typeof Monaco
  ) => Monaco.Range | null,
  getLinkedEditingEnabled: () => boolean,
  setLinkedEditingEnabled: (enabled: boolean) => void
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
        overviewRuler: {
          color: "var(--cortex-info)80",
          position: monaco.editor.OverviewRulerLane.Center,
        },
      },
    }));

    linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, newDecorations);
  };

  editor.onDidChangeCursorPosition(() => {
    if (decorationUpdateTimer !== null) {
      window.clearTimeout(decorationUpdateTimer);
    }
    decorationUpdateTimer = window.setTimeout(() => {
      updateLinkedEditDecorations();
      decorationUpdateTimer = null;
    }, 50) as unknown as number;
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
      setLinkedEditingEnabled(newEnabled);
      ed.updateOptions({ linkedEditing: newEnabled });

      if (!newEnabled) {
        linkedEditDecorations = ed.deltaDecorations(linkedEditDecorations, []);
      } else {
        updateLinkedEditDecorations();
      }

      window.dispatchEvent(
        new CustomEvent("editor:linked-editing-changed", {
          detail: { enabled: newEnabled },
        })
      );
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
          const editRange = new monaco.Range(
            position.lineNumber,
            fullMatchStart,
            position.lineNumber,
            fullMatchEnd
          );

          ed.executeEdits("convert-jsx-tag", [{ range: editRange, text: newText }]);

          ed.setPosition({
            lineNumber: position.lineNumber,
            column: fullMatchStart + tagName.length + 1 + attributes.length,
          });
        }
      } else if (!isClosingTag) {
        const content = model.getValue();
        const matchingRange = findMatchingTag(
          content,
          model,
          position.lineNumber,
          startColumn,
          startColumn + tagName.length,
          tagName,
          false,
          monaco
        );

        if (matchingRange) {
          const openingTagLine = model.getLineContent(position.lineNumber);

          const openingTagPattern = new RegExp(`<${tagName}([^>]*)>`);
          const openingMatch = openingTagPattern.exec(openingTagLine);

          if (openingMatch) {
            const openingStart = openingMatch.index + 1;
            const openingEnd = openingStart + openingMatch[0].length;
            const attributes = openingMatch[1].trimEnd();

            const fullRange = new monaco.Range(
              position.lineNumber,
              openingStart,
              matchingRange.endLineNumber,
              matchingRange.endColumn + 1
            );

            const contentBetween = model
              .getValueInRange(
                new monaco.Range(
                  position.lineNumber,
                  openingEnd,
                  matchingRange.startLineNumber,
                  matchingRange.startColumn - 2
                )
              )
              .trim();

            if (contentBetween === "") {
              const newText = `<${tagName}${attributes} />`;

              ed.executeEdits("convert-jsx-tag", [{ range: fullRange, text: newText }]);

              ed.setPosition({
                lineNumber: position.lineNumber,
                column: openingStart + newText.length - 2,
              });
            }
          }
        }
      }
    },
  });

  editor.onDidDispose(() => {
    if (decorationUpdateTimer !== null) {
      window.clearTimeout(decorationUpdateTimer);
    }
  });
}
