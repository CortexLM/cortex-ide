/**
 * useCodeLens Hook
 *
 * Extracted from CodeEditor.tsx - manages CodeLens provider registration
 * for showing inline actions like references count, test actions, etc.
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

interface LSPCodeLens {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
  data?: unknown;
}

interface LSPCodeLensResult {
  lenses: LSPCodeLens[];
}

export interface CodeLensSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  showReferences: boolean;
  showImplementations: boolean;
  showTestActions: boolean;
}

const DEFAULT_CODE_LENS_SETTINGS: CodeLensSettings = {
  enabled: true,
  fontFamily: "",
  fontSize: 12,
  showReferences: true,
  showImplementations: true,
  showTestActions: true,
};

const TEST_PATTERNS = {
  jest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe)\s*\(/,
  vitest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe|suite)\s*\(/,
  rust: /^#\[test\]|^#\[tokio::test\]/,
  pytest: /^(?:async\s+)?def\s+test_/,
  go: /^func\s+Test[A-Z]/,
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

function isReferenceLens(command?: { title: string; command?: string }): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes("reference") || title.includes("usage");
}

function isImplementationLens(command?: { title: string; command?: string }): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes("implementation");
}

function isTestLens(command?: { title: string; command?: string }): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes("run") || title.includes("debug") || title.includes("test");
}

function isTestLine(lineText: string, language: string): boolean {
  const trimmed = lineText.trim();
  switch (language) {
    case "typescript":
    case "javascript":
    case "typescriptreact":
    case "javascriptreact":
      return TEST_PATTERNS.jest.test(trimmed) || TEST_PATTERNS.vitest.test(trimmed);
    case "rust":
      return TEST_PATTERNS.rust.test(trimmed);
    case "python":
      return TEST_PATTERNS.pytest.test(trimmed);
    case "go":
      return TEST_PATTERNS.go.test(trimmed);
    default:
      return false;
  }
}

function extractTestName(lineText: string, language: string): string | null {
  const trimmed = lineText.trim();
  switch (language) {
    case "typescript":
    case "javascript":
    case "typescriptreact":
    case "javascriptreact": {
      const match = trimmed.match(/(?:it|test|describe|suite)\s*\(\s*['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    }
    case "rust": {
      const match = trimmed.match(/(?:async\s+)?fn\s+(\w+)/);
      return match ? match[1] : null;
    }
    case "python": {
      const match = trimmed.match(/(?:async\s+)?def\s+(test_\w+)/);
      return match ? match[1] : null;
    }
    case "go": {
      const match = trimmed.match(/func\s+(Test\w+)/);
      return match ? match[1] : null;
    }
    default:
      return null;
  }
}

export interface CodeLensManager {
  dispose: () => void;
  updateSettings: (settings: Partial<CodeLensSettings>) => void;
  getSettings: () => CodeLensSettings;
}

export function createCodeLensManager(
  monaco: typeof Monaco,
  initialSettings?: Partial<CodeLensSettings>
): CodeLensManager {
  let settings: CodeLensSettings = { ...DEFAULT_CODE_LENS_SETTINGS, ...initialSettings };
  const disposables: Monaco.IDisposable[] = [];

  function registerProviders(): void {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    for (const language of SUPPORTED_LANGUAGES) {
      const disposable = monaco.languages.registerCodeLensProvider(language, {
        provideCodeLenses: async (
          model: Monaco.editor.ITextModel,
          _token: Monaco.CancellationToken
        ): Promise<Monaco.languages.CodeLensList> => {
          if (!settings.enabled) {
            return { lenses: [], dispose: () => {} };
          }

          const uri = model.uri.toString();
          const filePath = uri.replace("file://", "");
          const allLenses: Monaco.languages.CodeLens[] = [];

          try {
            const response = await invoke<LSPCodeLensResult>("lsp_multi_code_lens", {
              language,
              params: {
                uri: filePath,
              },
            });

            if (response && response.lenses && response.lenses.length > 0) {
              for (const lens of response.lenses) {
                if (isReferenceLens(lens.command) && !settings.showReferences) continue;
                if (isImplementationLens(lens.command) && !settings.showImplementations) continue;
                if (isTestLens(lens.command) && !settings.showTestActions) continue;

                allLenses.push({
                  range: new monaco.Range(
                    lens.range.start.line + 1,
                    lens.range.start.character + 1,
                    lens.range.end.line + 1,
                    lens.range.end.character + 1
                  ),
                  command: lens.command
                    ? {
                        id: lens.command.command,
                        title: lens.command.title,
                        arguments: lens.command.arguments,
                      }
                    : undefined,
                });
              }
            }
          } catch (error) {
            console.debug("Code lens not available:", error);
          }

          if (settings.showTestActions) {
            const lineCount = model.getLineCount();
            for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
              const lineText = model.getLineContent(lineNumber);
              if (isTestLine(lineText, language)) {
                const testName = extractTestName(lineText, language);
                if (testName) {
                  allLenses.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                    command: {
                      id: "orion.runTest",
                      title: "Run Test",
                      arguments: [filePath, testName, lineNumber],
                    },
                  });

                  allLenses.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                    command: {
                      id: "orion.debugTest",
                      title: "Debug",
                      arguments: [filePath, testName, lineNumber],
                    },
                  });
                }
              }
            }
          }

          return {
            lenses: allLenses,
            dispose: () => {},
          };
        },

        resolveCodeLens: async (
          _model: Monaco.editor.ITextModel,
          codeLens: Monaco.languages.CodeLens,
          _token: Monaco.CancellationToken
        ): Promise<Monaco.languages.CodeLens> => {
          return codeLens;
        },
      });

      disposables.push(disposable);
    }

    const runTestCommand = monaco.editor.registerCommand(
      "orion.runTest",
      async (_accessor, filePath, testName, lineNumber) => {
        try {
          await invoke("testing_run_single_test", {
            filePath,
            testName,
            lineNumber,
            debug: false,
          });
        } catch (e) {
          console.error("Failed to run test:", e);
        }
      }
    );
    disposables.push(runTestCommand);

    const debugTestCommand = monaco.editor.registerCommand(
      "orion.debugTest",
      async (_accessor, filePath, testName, lineNumber) => {
        try {
          await invoke("testing_run_single_test", {
            filePath,
            testName,
            lineNumber,
            debug: true,
          });
        } catch (e) {
          console.error("Failed to debug test:", e);
        }
      }
    );
    disposables.push(debugTestCommand);
  }

  registerProviders();

  return {
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;
    },
    updateSettings: (newSettings: Partial<CodeLensSettings>) => {
      settings = { ...settings, ...newSettings };
    },
    getSettings: () => ({ ...settings }),
  };
}

export function getCodeLensEditorOptions(
  settings: CodeLensSettings
): Monaco.editor.IEditorOptions {
  return {
    codeLens: settings.enabled,
    codeLensFontFamily: settings.fontFamily || undefined,
    codeLensFontSize: settings.fontSize,
  };
}
