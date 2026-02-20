/**
 * useFormatOnType Hook
 *
 * Extracted from CodeEditor.tsx - manages on-type formatting provider
 * registration for automatic code formatting after trigger characters.
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

interface LSPTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

interface LSPOnTypeFormattingResponse {
  edits: LSPTextEdit[] | null;
}

export interface FormatOnTypeSettings {
  enabled: boolean;
  triggerCharacters: string[];
}

const DEFAULT_FORMAT_ON_TYPE_SETTINGS: FormatOnTypeSettings = {
  enabled: true,
  triggerCharacters: [";", "}", "\n"],
};

const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
  "rust",
  "go",
  "python",
  "java",
  "kotlin",
  "c",
  "cpp",
  "csharp",
  "json",
  "html",
  "css",
  "scss",
  "less",
];

export interface FormatOnTypeManager {
  dispose: () => void;
  updateSettings: (settings: Partial<FormatOnTypeSettings>) => void;
  getSettings: () => FormatOnTypeSettings;
}

export function createFormatOnTypeManager(
  monaco: typeof Monaco,
  initialSettings?: Partial<FormatOnTypeSettings>
): FormatOnTypeManager {
  let settings: FormatOnTypeSettings = { ...DEFAULT_FORMAT_ON_TYPE_SETTINGS, ...initialSettings };
  const disposables: Monaco.IDisposable[] = [];

  function registerProviders(): void {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    const triggerChars = settings.triggerCharacters;
    if (triggerChars.length === 0) return;

    for (const language of SUPPORTED_LANGUAGES) {
      const disposable = monaco.languages.registerOnTypeFormattingEditProvider(language, {
        autoFormatTriggerCharacters: triggerChars,
        provideOnTypeFormattingEdits: async (
          model: Monaco.editor.ITextModel,
          position: Monaco.Position,
          ch: string,
          options: Monaco.languages.FormattingOptions,
          _token: Monaco.CancellationToken
        ): Promise<Monaco.languages.TextEdit[]> => {
          if (!settings.enabled) {
            return [];
          }

          if (!settings.triggerCharacters.includes(ch)) {
            return [];
          }

          const uri = model.uri.toString();

          try {
            const response = await invoke<LSPOnTypeFormattingResponse>("lsp_on_type_formatting", {
              params: {
                uri,
                position: {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                },
                ch,
                options: {
                  tabSize: options.tabSize,
                  insertSpaces: options.insertSpaces,
                },
              },
            });

            if (!response || !response.edits || response.edits.length === 0) {
              return [];
            }

            const monacoEdits: Monaco.languages.TextEdit[] = response.edits.map((edit) => ({
              range: new monaco.Range(
                edit.range.start.line + 1,
                edit.range.start.character + 1,
                edit.range.end.line + 1,
                edit.range.end.character + 1
              ),
              text: edit.newText,
            }));

            return monacoEdits;
          } catch (error) {
            console.debug("On type formatting not available:", error);
            return [];
          }
        },
      });

      disposables.push(disposable);
    }
  }

  registerProviders();

  return {
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;
    },
    updateSettings: (newSettings: Partial<FormatOnTypeSettings>) => {
      const needsReregister =
        newSettings.triggerCharacters !== undefined &&
        JSON.stringify(newSettings.triggerCharacters) !==
          JSON.stringify(settings.triggerCharacters);

      settings = { ...settings, ...newSettings };

      if (needsReregister) {
        registerProviders();
      }
    },
    getSettings: () => ({ ...settings }),
  };
}

export function getFormatOnTypeEditorOptions(
  settings: FormatOnTypeSettings
): Monaco.editor.IEditorOptions {
  return {
    formatOnType: settings.enabled,
  };
}
