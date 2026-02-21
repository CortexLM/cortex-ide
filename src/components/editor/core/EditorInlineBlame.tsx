import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { OpenFile } from "@/context/EditorContext";
import type { InlineValueInfo } from "@/context/DebugContext";
import type * as Monaco from "monaco-editor";
import {
  InlineBlameManager,
  type InlineBlameMode,
  getInlineBlameMode,
  toggleInlineBlame,
} from "@/components/editor/InlineBlame";

interface EditorInlineBlameProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  activeFile: Accessor<OpenFile | undefined>;
  filePath: Accessor<string | null>;
}

export function EditorInlineBlame(props: EditorInlineBlameProps) {
  let inlineBlameManager: InlineBlameManager | null = null;

  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    if (!inlineBlameManager) {
      inlineBlameManager = new InlineBlameManager();
    }

    const file = props.activeFile();
    if (file && inlineBlameManager) {
      inlineBlameManager.initialize(
        editor, monaco, file.path, getInlineBlameMode(), true, 50,
      );
    }

    const handleInlineBlameModeChange = (e: CustomEvent<{ mode: InlineBlameMode }>) => {
      if (inlineBlameManager) inlineBlameManager.setMode(e.detail.mode);
    };

    const handleToggleInlineBlame = () => toggleInlineBlame();

    let inlineValueDecorations: string[] = [];

    const updateInlineValueDecorations = (values: InlineValueInfo[], filePath: string) => {
      const model = editor.getModel();
      if (!model) {
        inlineValueDecorations = editor.deltaDecorations(inlineValueDecorations, []);
        return;
      }
      const currentFile = props.activeFile();
      if (!currentFile || currentFile.path !== filePath) return;

      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
      const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      for (const inlineValue of values) {
        const lineContent = model.getLineContent(inlineValue.line);
        const regex = new RegExp(`\\b${escapeRegExp(inlineValue.name)}\\b`, "g");
        let match: RegExpExecArray | null;
        let firstMatch = true;
        while ((match = regex.exec(lineContent)) !== null) {
          if (firstMatch) {
            firstMatch = false;
            const endColumn = match.index + inlineValue.name.length + 1;
            newDecorations.push({
              range: new monaco.Range(inlineValue.line, endColumn, inlineValue.line, endColumn),
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
      inlineValueDecorations = editor.deltaDecorations(inlineValueDecorations, newDecorations);
    };

    const clearInlineValueDecorations = () => {
      inlineValueDecorations = editor.deltaDecorations(inlineValueDecorations, []);
    };

    const handleDebugInlineValuesUpdated = (e: CustomEvent<{ path: string; values: InlineValueInfo[] }>) => {
      updateInlineValueDecorations(e.detail.values, e.detail.path);
    };

    const handleDebugCleared = () => clearInlineValueDecorations();

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

    const handleDebugJumpToCursorRequest = (e: CustomEvent<{ path: string }>) => {
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

    window.addEventListener("inline-blame:mode-changed", handleInlineBlameModeChange as EventListener);
    window.addEventListener("inline-blame:toggle", handleToggleInlineBlame);
    window.addEventListener("debug:inline-values-updated", handleDebugInlineValuesUpdated as EventListener);
    window.addEventListener("debug:cleared", handleDebugCleared);
    window.addEventListener("debug:toggle-breakpoint", handleDebugToggleBreakpoint as EventListener);
    window.addEventListener("debug:jump-to-cursor-request", handleDebugJumpToCursorRequest as EventListener);

    onCleanup(() => {
      window.removeEventListener("inline-blame:mode-changed", handleInlineBlameModeChange as EventListener);
      window.removeEventListener("inline-blame:toggle", handleToggleInlineBlame);
      window.removeEventListener("debug:inline-values-updated", handleDebugInlineValuesUpdated as EventListener);
      window.removeEventListener("debug:cleared", handleDebugCleared);
      window.removeEventListener("debug:toggle-breakpoint", handleDebugToggleBreakpoint as EventListener);
      window.removeEventListener("debug:jump-to-cursor-request", handleDebugJumpToCursorRequest as EventListener);
      clearInlineValueDecorations();
      if (inlineBlameManager) {
        inlineBlameManager.dispose();
        inlineBlameManager = null;
      }
    });
  });

  return null;
}
