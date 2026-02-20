/**
 * useInlayHints Hook
 *
 * Extracted from CodeEditor.tsx - manages inlay hints provider registration
 * and settings synchronization for Monaco editor.
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

interface InlayHintLabelPart {
  value: string;
  tooltip?: string;
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
}

interface LSPInlayHint {
  position: { line: number; character: number };
  label: string | InlayHintLabelPart[];
  kind?: 1 | 2;
  tooltip?: string;
  paddingLeft?: boolean;
  paddingRight?: boolean;
  textEdits?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    newText: string;
  }>;
  data?: unknown;
}

interface LSPInlayHintsResponse {
  hints: LSPInlayHint[];
}

export interface InlayHintSettings {
  enabled: "on" | "off" | "offUnlessPressed";
  showTypeHints: boolean;
  showParameterNames: boolean;
  showEnumMemberValues: boolean;
  showPropertyDeclarationTypes: boolean;
  showVariableTypes: boolean;
}

const DEFAULT_INLAY_HINT_SETTINGS: InlayHintSettings = {
  enabled: "on",
  showTypeHints: true,
  showParameterNames: true,
  showEnumMemberValues: true,
  showPropertyDeclarationTypes: true,
  showVariableTypes: true,
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
];

export interface InlayHintsManager {
  dispose: () => void;
  updateSettings: (settings: Partial<InlayHintSettings>) => void;
  getSettings: () => InlayHintSettings;
}

export function createInlayHintsManager(
  monaco: typeof Monaco,
  initialSettings?: Partial<InlayHintSettings>
): InlayHintsManager {
  let settings: InlayHintSettings = { ...DEFAULT_INLAY_HINT_SETTINGS, ...initialSettings };
  const disposables: Monaco.IDisposable[] = [];

  function registerProvider(): void {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    for (const language of SUPPORTED_LANGUAGES) {
      const disposable = monaco.languages.registerInlayHintsProvider(language, {
        provideInlayHints: async (
          model: Monaco.editor.ITextModel,
          range: Monaco.Range,
          _token: Monaco.CancellationToken
        ): Promise<Monaco.languages.InlayHintList> => {
          if (settings.enabled === "off") {
            return { hints: [], dispose: () => {} };
          }

          const uri = model.uri.toString();

          try {
            const response = await invoke<LSPInlayHintsResponse>("lsp_inlay_hints", {
              params: {
                uri,
                range: {
                  start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
                  end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
                },
              },
            });

            if (!response || !response.hints || response.hints.length === 0) {
              return { hints: [], dispose: () => {} };
            }

            const monacoHints: Monaco.languages.InlayHint[] = response.hints
              .filter((hint) => {
                const isTypeHint = hint.kind === 1;
                const isParameterHint = hint.kind === 2;

                if (isTypeHint && !settings.showTypeHints) return false;
                if (isParameterHint && !settings.showParameterNames) return false;

                return true;
              })
              .map((hint) => {
                const labelText =
                  typeof hint.label === "string"
                    ? hint.label
                    : hint.label.map((part) => part.value).join("");

                let monacoKind: Monaco.languages.InlayHintKind;
                if (hint.kind === 1) {
                  monacoKind = monaco.languages.InlayHintKind.Type;
                } else if (hint.kind === 2) {
                  monacoKind = monaco.languages.InlayHintKind.Parameter;
                } else {
                  monacoKind = monaco.languages.InlayHintKind.Type;
                }

                const monacoHint: Monaco.languages.InlayHint = {
                  position: {
                    lineNumber: hint.position.line + 1,
                    column: hint.position.character + 1,
                  },
                  label: labelText,
                  kind: monacoKind,
                  paddingLeft: hint.paddingLeft ?? hint.kind === 1,
                  paddingRight: hint.paddingRight ?? hint.kind === 2,
                };

                if (hint.tooltip) {
                  monacoHint.tooltip = hint.tooltip;
                }

                return monacoHint;
              });

            return {
              hints: monacoHints,
              dispose: () => {},
            };
          } catch (error) {
            console.debug("Inlay hints not available:", error);
            return { hints: [], dispose: () => {} };
          }
        },
      });

      disposables.push(disposable);
    }
  }

  registerProvider();

  return {
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;
    },
    updateSettings: (newSettings: Partial<InlayHintSettings>) => {
      settings = { ...settings, ...newSettings };
    },
    getSettings: () => ({ ...settings }),
  };
}

export function getInlayHintsEditorOptions(
  settings: InlayHintSettings
): Monaco.editor.IEditorOptions {
  return {
    inlayHints: {
      enabled: settings.enabled,
    },
  };
}
