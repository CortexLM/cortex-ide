/**
 * FormatterIntegration - Monaco Editor Formatter Integration
 *
 * This module provides formatting integration for Monaco editor, including:
 * - Format on save (configurable)
 * - Format selection
 * - Format document (Shift+Alt+F)
 * - Detect prettier config (.prettierrc)
 * - Support multiple formatters per language
 */

import { createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useFormatter, type FormatRequest, type FormatterType } from "@/context/FormatterContext";
import { editorLogger } from "../../utils/logger";

export interface FormatterIntegrationOptions {
  monaco: typeof Monaco;
  editor: Monaco.editor.IStandaloneCodeEditor;
  filePath: string;
  language: string;
  workingDirectory?: string;
}

/**
 * Apply formatting result to the editor
 */
function applyFormattingResult(
  editor: Monaco.editor.IStandaloneCodeEditor,
  _monaco: typeof Monaco,
  originalContent: string,
  formattedContent: string,
): void {
  if (originalContent === formattedContent) {
    return;
  }

  const model = editor.getModel();
  if (!model) return;

  // Save cursor position
  const position = editor.getPosition();
  const scrollTop = editor.getScrollTop();

  // Create edit operations
  const fullRange = model.getFullModelRange();
  const edit: Monaco.editor.IIdentifiedSingleEditOperation = {
    range: fullRange,
    text: formattedContent,
    forceMoveMarkers: true,
  };

  // Apply edit
  editor.executeEdits("formatter", [edit]);

  // Restore cursor position (approximately)
  if (position) {
    const newLineCount = model.getLineCount();
    const newLine = Math.min(position.lineNumber, newLineCount);
    const newColumn = Math.min(position.column, model.getLineMaxColumn(newLine));
    editor.setPosition({ lineNumber: newLine, column: newColumn });
  }

  // Restore scroll position
  editor.setScrollTop(scrollTop);
}

/**
 * Format the selected range in the editor
 */
async function formatSelection(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  filePath: string,
  formatter: ReturnType<typeof useFormatter>,
  workingDirectory?: string,
): Promise<void> {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection || selection.isEmpty()) {
    // If no selection, format the entire document
    await formatDocument(editor, monaco, filePath, formatter, workingDirectory);
    return;
  }

  const selectedText = model.getValueInRange(selection);
  const startLine = selection.startLineNumber;
  const endLine = selection.endLineNumber;

  try {
    const request: FormatRequest = {
      content: selectedText,
      filePath,
      workingDirectory,
      range: {
        startLine,
        endLine,
      },
    };

    const result = await formatter.format(request);

    if (result.changed) {
      // Apply the formatted text to the selection
      const edit: Monaco.editor.IIdentifiedSingleEditOperation = {
        range: selection,
        text: result.content,
        forceMoveMarkers: true,
      };
      editor.executeEdits("formatter", [edit]);
    }
  } catch (e) {
    console.error("Format selection failed:", e);
  }
}

/**
 * Format the entire document
 */
async function formatDocument(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  filePath: string,
  formatter: ReturnType<typeof useFormatter>,
  workingDirectory?: string,
): Promise<void> {
  const model = editor.getModel();
  if (!model) return;

  const content = model.getValue();

  try {
    const request: FormatRequest = {
      content,
      filePath,
      workingDirectory,
    };

    const result = await formatter.format(request);

    if (result.changed) {
      applyFormattingResult(editor, monaco, content, result.content);
    }
  } catch (e) {
    console.error("Format document failed:", e);
  }
}

/**
 * Format the document with a specific formatter
 */
async function formatDocumentWith(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  filePath: string,
  formatter: ReturnType<typeof useFormatter>,
  formatterType: FormatterType,
  workingDirectory?: string,
): Promise<void> {
  const model = editor.getModel();
  if (!model) return;

  const content = model.getValue();

  try {
    const request: FormatRequest = {
      content,
      filePath,
      workingDirectory,
    };

    const result = await formatter.formatWith(request, formatterType);

    if (result.changed) {
      applyFormattingResult(editor, monaco, content, result.content);
    }
  } catch (e) {
    console.error("Format document with specific formatter failed:", e);
  }
}

/**
 * Set up formatter integration for a Monaco editor instance
 */
export function setupFormatterIntegration(options: FormatterIntegrationOptions): () => void {
  const { monaco, editor, filePath, language, workingDirectory } = options;
  const formatter = useFormatter();
  const disposables: Monaco.IDisposable[] = [];
  let isFormatting = false;

  // Detect config on setup
  formatter.detectConfig(filePath, workingDirectory).catch((e) => {
    editorLogger.warn("Failed to detect formatter config:", e);
  });

  // Register document formatting provider
  const documentFormattingProvider = monaco.languages.registerDocumentFormattingEditProvider(language, {
    async provideDocumentFormattingEdits(
      model: Monaco.editor.ITextModel,
    ): Promise<Monaco.languages.TextEdit[]> {
      if (isFormatting || !formatter.state.settings.enabled) {
        return [];
      }

      isFormatting = true;

      try {
        const content = model.getValue();
        const request: FormatRequest = {
          content,
          filePath,
          workingDirectory,
        };

        const result = await formatter.format(request);

        if (result.changed) {
          return [
            {
              range: model.getFullModelRange(),
              text: result.content,
            },
          ];
        }
      } catch (e) {
        console.error("Document formatting failed:", e);
      } finally {
        isFormatting = false;
      }

      return [];
    },
  });
  disposables.push(documentFormattingProvider);

  // Register document range formatting provider
  const rangeFormattingProvider = monaco.languages.registerDocumentRangeFormattingEditProvider(language, {
    async provideDocumentRangeFormattingEdits(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
    ): Promise<Monaco.languages.TextEdit[]> {
      if (isFormatting || !formatter.state.settings.enabled) {
        return [];
      }

      isFormatting = true;

      try {
        const content = model.getValueInRange(range);
        const request: FormatRequest = {
          content,
          filePath,
          workingDirectory,
          range: {
            startLine: range.startLineNumber,
            endLine: range.endLineNumber,
          },
        };

        const result = await formatter.format(request);

        if (result.changed) {
          return [
            {
              range,
              text: result.content,
            },
          ];
        }
      } catch (e) {
        console.error("Range formatting failed:", e);
      } finally {
        isFormatting = false;
      }

      return [];
    },
  });
  disposables.push(rangeFormattingProvider);

  // Add Format Document action (Shift+Alt+F)
  const formatDocumentAction = editor.addAction({
    id: "cortex.formatDocument",
    label: "Format Document",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
    contextMenuGroupId: "1_modification",
    contextMenuOrder: 1.5,
    run: async () => {
      await formatDocument(editor, monaco, filePath, formatter, workingDirectory);
    },
  });
  disposables.push(formatDocumentAction);

  // Add Format Selection action
  const formatSelectionAction = editor.addAction({
    id: "cortex.formatSelection",
    label: "Format Selection",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
    contextMenuGroupId: "1_modification",
    contextMenuOrder: 1.6,
    run: async () => {
      await formatSelection(editor, monaco, filePath, formatter, workingDirectory);
    },
  });
  disposables.push(formatSelectionAction);

  // Format with Prettier action
  const formatWithPrettierAction = editor.addAction({
    id: "cortex.formatWithPrettier",
    label: "Format Document with Prettier",
    contextMenuGroupId: "1_modification",
    contextMenuOrder: 1.7,
    run: async () => {
      await formatDocumentWith(editor, monaco, filePath, formatter, "prettier", workingDirectory);
    },
  });
  disposables.push(formatWithPrettierAction);

  // Handle format on save
  const handleSave = async (): Promise<void> => {
    if (!formatter.state.settings.formatOnSave || !formatter.state.settings.enabled || isFormatting) {
      return;
    }

    isFormatting = true;
    try {
      await formatDocument(editor, monaco, filePath, formatter, workingDirectory);
    } finally {
      isFormatting = false;
    }
  };

  // Listen for Ctrl+S to format before save
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    async () => {
      await handleSave();
      // Dispatch a custom event that can be caught by the editor to trigger save
      window.dispatchEvent(
        new CustomEvent("editor-save-requested", {
          detail: { filePath },
        })
      );
    }
  );

  // Handle format on paste
  if (formatter.state.settings.formatOnPaste) {
    const pasteHandler = editor.onDidPaste(async (e) => {
      if (!formatter.state.settings.formatOnPaste || !formatter.state.settings.enabled || isFormatting) {
        return;
      }

      const selection = editor.getSelection();
      if (!selection) return;

      const model = editor.getModel();
      if (!model) return;

      isFormatting = true;
      try {
        // Format the pasted range
        const pastedRange = e.range;
        const pastedText = model.getValueInRange(pastedRange);

        const request: FormatRequest = {
          content: pastedText,
          filePath,
          workingDirectory,
          range: {
            startLine: pastedRange.startLineNumber,
            endLine: pastedRange.endLineNumber,
          },
        };

        const result = await formatter.format(request);

        if (result.changed) {
          const edit: Monaco.editor.IIdentifiedSingleEditOperation = {
            range: pastedRange,
            text: result.content,
            forceMoveMarkers: true,
          };
          editor.executeEdits("formatter-paste", [edit]);
        }
      } catch (e) {
        console.error("Format on paste failed:", e);
      } finally {
        isFormatting = false;
      }
    });
    disposables.push(pasteHandler);
  }

  // Cleanup function
  return () => {
    disposables.forEach((d) => d?.dispose?.());
  };
}

/**
 * Hook for using formatter integration in SolidJS components
 */
export interface UseFormatterIntegrationProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  filePath: string | null;
  language: string | null;
  workingDirectory?: string;
}

export function useFormatterIntegration(props: UseFormatterIntegrationProps): void {
  let cleanup: (() => void) | null = null;

  createEffect(() => {
    // Clean up previous integration
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    const { editor, monaco, filePath, language, workingDirectory } = props;

    if (!editor || !monaco || !filePath || !language) {
      return;
    }

    cleanup = setupFormatterIntegration({
      monaco,
      editor,
      filePath,
      language,
      workingDirectory,
    });
  });

  onCleanup(() => {
    if (cleanup) {
      cleanup();
    }
  });
}

/**
 * Format document utility for external use
 */
export async function formatEditorDocument(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  filePath: string,
  workingDirectory?: string,
): Promise<void> {
  const formatter = useFormatter();
  await formatDocument(editor, monaco, filePath, formatter, workingDirectory);
}

/**
 * Format selection utility for external use
 */
export async function formatEditorSelection(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  filePath: string,
  workingDirectory?: string,
): Promise<void> {
  const formatter = useFormatter();
  await formatSelection(editor, monaco, filePath, formatter, workingDirectory);
}
