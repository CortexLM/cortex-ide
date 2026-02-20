/**
 * Monaco Inlay Hints Provider
 *
 * Provides inlay hints integration for Monaco editor using LSP.
 * Displays:
 * - Type annotations for variables
 * - Parameter names in function calls
 * - Return type hints
 */

import type * as Monaco from "monaco-editor";
import type { InlayHint, InlayHintLabelPart, Range } from "@/context/LSPContext";
import type { InlayHintsSettings } from "@/context/SettingsContext";



export interface InlayHintsProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  getInlayHints: (serverId: string, uri: string, range: Range) => Promise<{ hints: InlayHint[] }>;
  getSettings: () => InlayHintsSettings;
}

/**
 * Convert LSP InlayHintKind to Monaco InlayHintKind
 */
function toMonacoInlayHintKind(
  monaco: typeof Monaco,
  kind?: "type" | "parameter"
): Monaco.languages.InlayHintKind | undefined {
  if (!kind) return undefined;
  return kind === "type"
    ? monaco.languages.InlayHintKind.Type
    : monaco.languages.InlayHintKind.Parameter;
}

/**
 * Truncate text if it exceeds maxLength
 */
function truncateLabel(text: string, maxLength: number): string {
  if (maxLength <= 0 || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + "\u2026"; // ellipsis
}

/**
 * Convert LSP InlayHint label to Monaco format
 */
function convertLabel(
  monaco: typeof Monaco,
  label: string | InlayHintLabelPart[],
  maxLength: number
): string | Monaco.languages.InlayHintLabelPart[] {
  if (typeof label === "string") {
    return truncateLabel(label, maxLength);
  }

  return label.map((part) => {
    const monacoPart: Monaco.languages.InlayHintLabelPart = {
      label: truncateLabel(part.value, maxLength),
    };

    if (part.tooltip) {
      monacoPart.tooltip = part.tooltip;
    }

    if (part.location) {
      monacoPart.location = {
        uri: monaco.Uri.parse(part.location.uri),
        range: {
          startLineNumber: part.location.range.start.line + 1,
          startColumn: part.location.range.start.character + 1,
          endLineNumber: part.location.range.end.line + 1,
          endColumn: part.location.range.end.character + 1,
        },
      };
    }

    if (part.command) {
      monacoPart.command = {
        id: part.command.command,
        title: part.command.title,
        arguments: part.command.arguments,
      };
    }

    return monacoPart;
  });
}

/**
 * Create a Monaco inlay hints provider for LSP integration
 */
export function createInlayHintsProvider(
  options: InlayHintsProviderOptions
): Monaco.IDisposable {
  const { monaco, languageId, serverId, filePath, getInlayHints, getSettings } = options;

  const provider = monaco.languages.registerInlayHintsProvider(languageId, {
    async provideInlayHints(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.InlayHintList | null> {
      const settings = getSettings();

      // Check if inlay hints are enabled
      if (!settings.enabled) {
        return { hints: [], dispose: () => {} };
      }

      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return { hints: [], dispose: () => {} };
      }

      try {
        const lspRange: Range = {
          start: {
            line: range.startLineNumber - 1,
            character: range.startColumn - 1,
          },
          end: {
            line: range.endLineNumber - 1,
            character: range.endColumn - 1,
          },
        };

        const result = await getInlayHints(serverId, filePath, lspRange);

        if (!result.hints || result.hints.length === 0) {
          return { hints: [], dispose: () => {} };
        }

        const hints: Monaco.languages.InlayHint[] = [];

        for (const hint of result.hints) {
          // Filter based on settings
          if (hint.kind === "type" && !settings.showTypes) continue;
          if (hint.kind === "parameter" && !settings.showParameterNames) continue;

          const monacoHint: Monaco.languages.InlayHint = {
            position: {
              lineNumber: hint.position.line + 1,
              column: hint.position.character + 1,
            },
            label: convertLabel(monaco, hint.label, settings.maxLength),
            kind: toMonacoInlayHintKind(monaco, hint.kind),
            paddingLeft: settings.padding ? (hint.paddingLeft ?? true) : false,
            paddingRight: settings.padding ? (hint.paddingRight ?? false) : false,
          };

          if (hint.tooltip) {
            monacoHint.tooltip = hint.tooltip;
          }

          if (hint.textEdits && hint.textEdits.length > 0) {
            monacoHint.textEdits = hint.textEdits.map((edit) => ({
              range: {
                startLineNumber: edit.range.start.line + 1,
                startColumn: edit.range.start.character + 1,
                endLineNumber: edit.range.end.line + 1,
                endColumn: edit.range.end.character + 1,
              },
              text: edit.newText,
            }));
          }

          hints.push(monacoHint);
        }

        return {
          hints,
          dispose: () => {},
        };
      } catch (e) {
        console.debug("Inlay hints provider error:", e);
        return { hints: [], dispose: () => {} };
      }
    },
  });

  return provider;
}

/**
 * Get Monaco editor options for inlay hints styling
 */
export function getInlayHintsEditorOptions(
  settings: InlayHintsSettings
): Monaco.editor.IEditorOptions {
  const options: Monaco.editor.IEditorOptions = {
    inlayHints: {
      enabled: settings.enabled ? "on" : "off",
      fontSize: settings.fontSize > 0 ? settings.fontSize : undefined,
      fontFamily: settings.fontFamily || undefined,
      padding: settings.padding,
    },
  };

  return options;
}
