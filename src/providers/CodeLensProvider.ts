/**
 * Monaco Code Lens Provider
 *
 * Provides Code Lens integration for Monaco editor using LSP.
 * Displays:
 * - Reference counts above functions/classes
 * - Implementation counts for interfaces
 * - Run/Debug actions for test functions
 *
 * Code Lenses appear as clickable annotations above code, typically showing
 * metadata like "3 references" or "Run Test".
 */

import type * as Monaco from "monaco-editor";
import type { CodeLens, CodeLensResult, Range, Position, Command } from "@/context/LSPContext";
import type { CodeLensSettings } from "@/context/SettingsContext";
import { invoke } from "@tauri-apps/api/core";

// Test function patterns for common testing frameworks
const TEST_PATTERNS = {
  // JavaScript/TypeScript
  jest: /^(it|test|describe)\s*\(/,
  vitest: /^(it|test|describe|suite)\s*\(/,
  mocha: /^(it|describe|context)\s*\(/,
  // Rust
  rust: /^#\[test\]|^#\[tokio::test\]/,
  // Python
  pytest: /^def test_|^async def test_/,
  unittest: /^def test_/,
  // Go
  go: /^func Test[A-Z]/,
} as const;

export interface CodeLensProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  getCodeLenses: (serverId: string, uri: string) => Promise<CodeLensResult>;
  resolveCodeLens: (serverId: string, codeLens: CodeLens) => Promise<CodeLens>;
  getReferences: (serverId: string, uri: string, position: Position) => Promise<{ locations: Array<{ uri: string; range: Range }> }>;
  getImplementation: (serverId: string, uri: string, position: Position) => Promise<{ locations: Array<{ uri: string; range: Range }> }>;
  getSettings: () => CodeLensSettings;
  onCommand?: (command: string, args?: unknown[]) => void;
}

export interface CodeLensProviderResult {
  provider: Monaco.IDisposable;
  refresh: () => void;
}

/**
 * Determine if a code lens represents a reference count
 */
function isReferenceLens(command?: Command): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return (
    title.includes("reference") ||
    title.includes("usage") ||
    command.command === "editor.action.findReferences" ||
    command.command.includes("references")
  );
}

/**
 * Determine if a code lens represents an implementation count
 */
function isImplementationLens(command?: Command): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return (
    title.includes("implementation") ||
    title.includes("implements") ||
    command.command === "editor.action.goToImplementation" ||
    command.command.includes("implementation")
  );
}

/**
 * Determine if a code lens represents a test action
 */
function isTestLens(command?: Command): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return (
    title.includes("run test") ||
    title.includes("debug test") ||
    title.includes("run ") ||
    title.includes("debug ") ||
    command.command.includes("test") ||
    command.command.includes("runTest") ||
    command.command.includes("debugTest")
  );
}

/**
 * Parse reference count from a code lens title like "3 references" or "1 reference"
 */
export function parseReferenceCount(title: string): number | null {
  const match = title.match(/(\d+)\s*references?/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse implementation count from a code lens title like "2 implementations"
 */
export function parseImplementationCount(title: string): number | null {
  const match = title.match(/(\d+)\s*implementations?/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Generate a reference count code lens by querying the LSP
 */
export async function generateReferenceLens(
  options: CodeLensProviderOptions,
  position: Position
): Promise<CodeLens | null> {
  try {
    const result = await options.getReferences(
      options.serverId,
      options.filePath,
      position
    );

    const count = result.locations.length;
    if (count === 0) return null;

    const title = count === 1 ? "1 reference" : `${count} references`;

    return {
      range: {
        start: position,
        end: { line: position.line, character: position.character + 1 },
      },
      command: {
        title,
        command: "editor.action.findReferences",
        arguments: [options.filePath, position],
      },
    };
  } catch {
    return null;
  }
}

/**
 * Generate an implementation count code lens by querying the LSP
 */
export async function generateImplementationLens(
  options: CodeLensProviderOptions,
  position: Position
): Promise<CodeLens | null> {
  try {
    const result = await options.getImplementation(
      options.serverId,
      options.filePath,
      position
    );

    const count = result.locations.length;
    if (count === 0) return null;

    const title = count === 1 ? "1 implementation" : `${count} implementations`;

    return {
      range: {
        start: position,
        end: { line: position.line, character: position.character + 1 },
      },
      command: {
        title,
        command: "editor.action.goToImplementation",
        arguments: [options.filePath, position],
      },
    };
  } catch {
    return null;
  }
}

/**
 * Check if a line contains a test function definition
 */
function isTestLine(lineText: string, languageId: string): boolean {
  const trimmed = lineText.trim();

  switch (languageId) {
    case "typescript":
    case "typescriptreact":
    case "javascript":
    case "javascriptreact":
      return (
        TEST_PATTERNS.jest.test(trimmed) ||
        TEST_PATTERNS.vitest.test(trimmed) ||
        TEST_PATTERNS.mocha.test(trimmed)
      );
    case "rust":
      return TEST_PATTERNS.rust.test(trimmed);
    case "python":
      return (
        TEST_PATTERNS.pytest.test(trimmed) ||
        TEST_PATTERNS.unittest.test(trimmed)
      );
    case "go":
      return TEST_PATTERNS.go.test(trimmed);
    default:
      return false;
  }
}

/**
 * Extract the test name from a line
 */
function extractTestName(lineText: string, languageId: string): string | null {
  const trimmed = lineText.trim();

  switch (languageId) {
    case "typescript":
    case "typescriptreact":
    case "javascript":
    case "javascriptreact": {
      // Match: it('test name', ...) or test("test name", ...) or describe('suite', ...)
      const match = trimmed.match(/(?:it|test|describe|suite|context)\s*\(\s*['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    }
    case "rust": {
      // Match: fn test_name() or async fn test_name()
      const match = trimmed.match(/(?:async\s+)?fn\s+(\w+)/);
      return match ? match[1] : null;
    }
    case "python": {
      // Match: def test_name(...) or async def test_name(...)
      const match = trimmed.match(/(?:async\s+)?def\s+(test_\w+)/);
      return match ? match[1] : null;
    }
    case "go": {
      // Match: func TestName(t *testing.T)
      const match = trimmed.match(/func\s+(Test\w+)/);
      return match ? match[1] : null;
    }
    default:
      return null;
  }
}

/**
 * Create a Monaco code lens provider for LSP integration
 */
export function createCodeLensProvider(
  options: CodeLensProviderOptions
): CodeLensProviderResult {
  const { monaco, languageId, serverId, filePath, getCodeLenses, resolveCodeLens, getSettings, onCommand } = options;

  // The onDidChange callback receives a listener function that we can call to trigger refresh
  let refreshTrigger: (() => void) | null = null;

  const provider = monaco.languages.registerCodeLensProvider(languageId, {
    onDidChange: (listener) => {
      // Store the listener to call when we want to refresh code lenses
      refreshTrigger = () => listener(null!);
      return { dispose: () => { refreshTrigger = null; } };
    },

    async provideCodeLenses(
      model: Monaco.editor.ITextModel,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.CodeLensList | null> {
      const settings = getSettings();

      // Check if code lens is enabled
      if (!settings.enabled) {
        return { lenses: [], dispose: () => {} };
      }

      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return { lenses: [], dispose: () => {} };
      }

      const allLenses: Monaco.languages.CodeLens[] = [];

      try {
        // Fetch code lenses from LSP
        const result = await getCodeLenses(serverId, filePath);

        for (const lens of result.lenses) {
          // Filter based on settings
          if (isReferenceLens(lens.command) && !settings.showReferences) continue;
          if (isImplementationLens(lens.command) && !settings.showImplementations) continue;
          if (isTestLens(lens.command) && !settings.showTestActions) continue;

          const monacoLens: Monaco.languages.CodeLens = {
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
          };

          allLenses.push(monacoLens);
        }

        // Generate test code lenses if enabled
        if (settings.showTestActions) {
          const lineCount = model.getLineCount();
          for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
            const lineText = model.getLineContent(lineNumber);
            if (isTestLine(lineText, languageId)) {
              const testName = extractTestName(lineText, languageId);
              if (testName) {
                // Run test lens
                allLenses.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                  command: {
                    id: "orion.runTest",
                    title: "Run Test",
                    arguments: [filePath, testName, lineNumber],
                  },
                });

                // Debug test lens
                allLenses.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                  command: {
                    id: "orion.debugTest",
                    title: "Debug Test",
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
      } catch (e) {
        console.debug("Code lens provider error:", e);
        return { lenses: [], dispose: () => {} };
      }
    },

    async resolveCodeLens(
      _model: Monaco.editor.ITextModel,
      codeLens: Monaco.languages.CodeLens,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.CodeLens> {
      // If the lens already has a resolved command, return it
      if (codeLens.command && codeLens.command.title) {
        return codeLens;
      }

      try {
        // Resolve the code lens through LSP
        const resolved = await resolveCodeLens(serverId, {
          range: {
            start: {
              line: codeLens.range.startLineNumber - 1,
              character: codeLens.range.startColumn - 1,
            },
            end: {
              line: codeLens.range.endLineNumber - 1,
              character: codeLens.range.endColumn - 1,
            },
          },
          command: codeLens.command
            ? {
                title: codeLens.command.title,
                command: codeLens.command.id,
                arguments: codeLens.command.arguments,
              }
            : undefined,
        });

        return {
          ...codeLens,
          command: resolved.command
            ? {
                id: resolved.command.command,
                title: resolved.command.title,
                arguments: resolved.command.arguments,
              }
            : undefined,
        };
      } catch (e) {
        console.debug("Code lens resolve error:", e);
        return codeLens;
      }
    },
  });

  // Register command handlers
  if (onCommand) {
    const commandDisposables: Monaco.IDisposable[] = [];

    // Register Run Test command
    commandDisposables.push(
      monaco.editor.registerCommand("orion.runTest", (_accessor, ...args) => {
        onCommand("runTest", args);
      })
    );

    // Register Debug Test command
    commandDisposables.push(
      monaco.editor.registerCommand("orion.debugTest", (_accessor, ...args) => {
        onCommand("debugTest", args);
      })
    );

    // Register Find References command
    commandDisposables.push(
      monaco.editor.registerCommand("editor.action.findReferences", (_accessor, ...args) => {
        onCommand("findReferences", args);
      })
    );

    // Register Go To Implementation command
    commandDisposables.push(
      monaco.editor.registerCommand("editor.action.goToImplementation", (_accessor, ...args) => {
        onCommand("goToImplementation", args);
      })
    );

    // Return combined disposable
    return {
      provider: {
        dispose: () => {
          provider.dispose();
          commandDisposables.forEach((d) => d.dispose());
        },
      },
      refresh: () => {
        if (refreshTrigger) {
          refreshTrigger();
        }
      },
    };
  }

  return {
    provider,
    refresh: () => {
      if (refreshTrigger) {
        refreshTrigger();
      }
    },
  };
}

/**
 * Get Monaco editor options for code lens styling
 */
export function getCodeLensEditorOptions(
  settings: CodeLensSettings
): Monaco.editor.IEditorOptions {
  const options: Monaco.editor.IEditorOptions = {
    codeLens: settings.enabled,
    codeLensFontFamily: settings.fontFamily || undefined,
    codeLensFontSize: settings.fontSize > 0 ? settings.fontSize : undefined,
  };

  return options;
}

/**
 * Code Lens command types for the command handler
 */
export type CodeLensCommandType =
  | "runTest"
  | "debugTest"
  | "findReferences"
  | "goToImplementation";

/**
 * Execute a code lens command through the Tauri backend
 */
export async function executeCodeLensCommand(
  commandType: CodeLensCommandType,
  args: unknown[]
): Promise<void> {
  try {
    switch (commandType) {
      case "runTest": {
        const [filePath, testName, lineNumber] = args as [string, string, number];
        await invoke("testing_run_single_test", {
          filePath,
          testName,
          lineNumber,
          debug: false,
        });
        break;
      }
      case "debugTest": {
        const [filePath, testName, lineNumber] = args as [string, string, number];
        await invoke("testing_run_single_test", {
          filePath,
          testName,
          lineNumber,
          debug: true,
        });
        break;
      }
      case "findReferences": {
        // This is typically handled by Monaco's built-in command
        // but can be customized here if needed
        console.debug("Find references:", args);
        break;
      }
      case "goToImplementation": {
        // This is typically handled by Monaco's built-in command
        console.debug("Go to implementation:", args);
        break;
      }
    }
  } catch (e) {
    console.error("Failed to execute code lens command:", e);
  }
}
