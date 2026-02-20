import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { OpenFile } from "@/context/EditorContext";
import type * as Monaco from "monaco-editor";


interface SmartSelectManagerRef {
  expandSelection: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ) => Promise<void>;
  shrinkSelection: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ) => void;
}

interface EditorBreadcrumbsProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  activeFile: Accessor<OpenFile | undefined>;
  smartSelectManager: SmartSelectManagerRef;
}

export function EditorBreadcrumbs(props: EditorBreadcrumbsProps) {
  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    const handleGotoLine = (e: CustomEvent<{ line: number; column?: number }>) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    const handleEditorGotoLine = (e: CustomEvent<{ line: number; column?: number }>) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    const handleOutlineNavigate = (e: CustomEvent<{ fileId: string; line: number; column: number }>) => {
      const currentFile = props.activeFile();
      if (!currentFile || e.detail.fileId !== currentFile.id) return;
      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    const handleBufferSearchGoto = (e: CustomEvent<{ line: number; start: number; end: number }>) => {
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

    const handleSetCursorPosition = (e: CustomEvent<{ filePath: string; line: number; column: number }>) => {
      const currentFile = props.activeFile();
      if (!currentFile || e.detail.filePath !== currentFile.path) return;
      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
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

    const handleEditorAction = (e: CustomEvent<{ action: string }>) => {
      const { action } = e.detail;
      if (action) {
        const monacoAction = editor.getAction(action);
        if (monacoAction) monacoAction.run();
        editor.focus();
      }
    };

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
        "transform-to-snakecase", "transform-to-camelcase",
        "transform-to-pascalcase", "transform-to-kebabcase", "transform-to-constantcase",
      ];
      if (customTransformCommands.includes(command)) {
        const action = editor.getAction(command);
        if (action) { action.run(); editor.focus(); return; }
      }

      if (
        command === "sort-lines-ascending" || command === "sort-lines-descending" ||
        command === "sort-lines-ascending-case-insensitive" || command === "sort-lines-descending-case-insensitive" ||
        command === "sort-lines-natural" || command === "sort-lines-by-length" ||
        command === "reverse-lines" || command === "shuffle-lines" || command === "remove-duplicate-lines"
      ) {
        const model = editor.getModel();
        if (!model) return;
        const selection = editor.getSelection();
        const startLine = selection?.startLineNumber || 1;
        const endLine = selection?.endLineNumber || model.getLineCount();
        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) lines.push(model.getLineContent(i));

        let sortedLines: string[];
        switch (command) {
          case "sort-lines-ascending": sortedLines = [...lines].sort((a, b) => a.localeCompare(b)); break;
          case "sort-lines-descending": sortedLines = [...lines].sort((a, b) => b.localeCompare(a)); break;
          case "sort-lines-ascending-case-insensitive": sortedLines = [...lines].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); break;
          case "sort-lines-descending-case-insensitive": sortedLines = [...lines].sort((a, b) => b.toLowerCase().localeCompare(a.toLowerCase())); break;
          case "sort-lines-natural": sortedLines = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })); break;
          case "sort-lines-by-length": sortedLines = [...lines].sort((a, b) => a.length - b.length); break;
          case "reverse-lines": sortedLines = [...lines].reverse(); break;
          case "shuffle-lines": {
            sortedLines = [...lines];
            for (let i = sortedLines.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [sortedLines[i], sortedLines[j]] = [sortedLines[j], sortedLines[i]];
            }
            break;
          }
          case "remove-duplicate-lines": {
            const seen = new Set<string>();
            sortedLines = lines.filter((line) => { if (seen.has(line)) return false; seen.add(line); return true; });
            break;
          }
          default: sortedLines = lines;
        }

        editor.pushUndoStop();
        editor.executeEdits("sortLines", [{
          range: { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: model.getLineMaxColumn(endLine) },
          text: sortedLines.join("\n"),
        }]);
        editor.pushUndoStop();
        editor.focus();
        return;
      }

      const commandMap: Record<string, string> = {
        undo: "undo", redo: "redo",
        cut: "editor.action.clipboardCutAction", copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction", "select-all": "editor.action.selectAll",
        "add-cursor-above": "editor.action.insertCursorAbove", "add-cursor-below": "editor.action.insertCursorBelow",
        "select-all-occurrences": "editor.action.selectHighlights",
        "add-selection-to-next-find-match": "editor.action.addSelectionToNextFindMatch",
        "add-cursors-to-line-ends": "editor.action.insertCursorAtEndOfEachLineSelected",
        "undo-cursor": "cursorUndo",
        "duplicate-selection": "editor.action.copyLinesDownAction",
        "move-line-up": "editor.action.moveLinesUpAction", "move-line-down": "editor.action.moveLinesDownAction",
        "copy-line-up": "editor.action.copyLinesUpAction", "copy-line-down": "editor.action.copyLinesDownAction",
        "select-line": "expandLineSelection",
        "transform-to-uppercase": "editor.action.transformToUppercase",
        "transform-to-lowercase": "editor.action.transformToLowercase",
        "transform-to-titlecase": "editor.action.transformToTitlecase",
        "toggle-line-comment": "editor.action.commentLine",
        "toggle-block-comment": "editor.action.blockComment",
        "format-document": "editor.action.formatDocument",
        "indent-lines": "editor.action.indentLines", "outdent-lines": "editor.action.outdentLines",
        "fold-all": "editor.foldAll", "unfold-all": "editor.unfoldAll", "toggle-fold": "editor.toggleFold",
        "fold-level-1": "editor.foldLevel1", "fold-level-2": "editor.foldLevel2",
        "fold-level-3": "editor.foldLevel3", "fold-level-4": "editor.foldLevel4",
        "fold-level-5": "editor.foldLevel5", "fold-level-6": "editor.foldLevel6",
        "fold-level-7": "editor.foldLevel7",
        "fold-all-block-comments": "editor.foldAllBlockComments",
        "fold-all-regions": "editor.foldAllMarkerRegions",
        "unfold-all-regions": "editor.unfoldAllMarkerRegions",
        "fold-recursively": "editor.foldRecursively", "unfold-recursively": "editor.unfoldRecursively",
        "jump-to-bracket": "editor.action.jumpToBracket", "select-to-bracket": "editor.action.selectToBracket",
        "peek-definition": "editor.action.peekDefinition",
        "peek-references": "editor.action.referenceSearch.trigger",
        "peek-implementation": "editor.action.peekImplementation",
        "go-to-implementation": "editor.action.goToImplementation",
        "transpose-characters": "editor.action.transposeLetters",
        "delete-word-part-left": "deleteWordPartLeft", "delete-word-part-right": "deleteWordPartRight",
        "in-place-replace-up": "editor.action.inPlaceReplace.up",
        "in-place-replace-down": "editor.action.inPlaceReplace.down",
        "toggle-linked-editing": "editor.action.linkedEditing",
        "show-hover": "editor.action.showHover",
        "trigger-suggest": "editor.action.triggerSuggest",
        "trigger-parameter-hints": "editor.action.triggerParameterHints",
        "smart-select-expand": "editor.action.smartSelect.expand",
        "smart-select-shrink": "editor.action.smartSelect.shrink",
        "quick-fix": "editor.action.quickFix", refactor: "editor.action.refactor",
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

    window.addEventListener("goto-line", handleGotoLine as EventListener);
    window.addEventListener("editor:goto-line", handleEditorGotoLine as EventListener);
    window.addEventListener("editor:set-cursor-position", handleSetCursorPosition as EventListener);
    window.addEventListener("outline:navigate", handleOutlineNavigate as EventListener);
    window.addEventListener("buffer-search-goto", handleBufferSearchGoto as EventListener);
    window.addEventListener("buffer-search:get-selection", handleBufferSearchGetSelection);
    window.addEventListener("editor-command", handleEditorCommand as unknown as EventListener);
    window.addEventListener("editor:action", handleEditorAction as EventListener);
    window.addEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
    window.addEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);

    onCleanup(() => {
      window.removeEventListener("goto-line", handleGotoLine as EventListener);
      window.removeEventListener("editor:goto-line", handleEditorGotoLine as EventListener);
      window.removeEventListener("editor:set-cursor-position", handleSetCursorPosition as EventListener);
      window.removeEventListener("outline:navigate", handleOutlineNavigate as EventListener);
      window.removeEventListener("buffer-search-goto", handleBufferSearchGoto as EventListener);
      window.removeEventListener("buffer-search:get-selection", handleBufferSearchGetSelection);
      window.removeEventListener("editor-command", handleEditorCommand as unknown as EventListener);
      window.removeEventListener("editor:action", handleEditorAction as EventListener);
      window.removeEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
      window.removeEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
    });
  });

  return null;
}
