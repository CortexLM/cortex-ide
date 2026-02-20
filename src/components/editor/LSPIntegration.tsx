/**
 * Monaco Editor LSP Integration
 *
 * This module provides LSP integration for Monaco editor, including:
 * - Auto-completion via LSP with lazy-loaded details (completionItem/resolve)
 * - Hover information
 * - Go to definition (Ctrl+Click)
 * - Go to declaration (Ctrl+F12) - navigates to interface/abstract definitions
 * - Go to type definition
 * - Go to implementation
 * - Find references
 * - Document highlights (symbol occurrences)
 * - Rename with validation (prepareRename)
 * - Diagnostics display
 * - Inlay hints
 * - Code actions and quick fixes
 * - Document formatting
 * - Signature help
 * - Folding ranges (LSP-based code folding)
 * - Selection ranges (smart selection for expand/shrink selection)
 * - Document colors (color picker for CSS/SCSS/Less/JS/TS)
 * - Document links (clickable URLs and file paths)
 */

import type * as Monaco from "monaco-editor";
import { useLSP, type Position, type Diagnostic, type CompletionItem, type DocumentHighlightKind, type InlayHintLabelPart, type Range } from "@/context/LSPContext";
import type { InlayHintsSettings } from "@/context/SettingsContext";

/**
 * Internal type to store original LSP completion item data
 * for later use in resolveCompletionItem
 */
interface CompletionItemData {
  /** Original LSP completion item for resolve requests */
  originalItem: CompletionItem;
  /** Server ID for the LSP server */
  serverId: string;
}

// Monaco completion kind mapping
const completionKindMap: Record<string, number> = {
  text: 1,
  method: 2,
  function: 3,
  constructor: 4,
  field: 5,
  variable: 6,
  class: 7,
  interface: 8,
  module: 9,
  property: 10,
  unit: 11,
  value: 12,
  enum: 13,
  keyword: 14,
  snippet: 15,
  color: 16,
  file: 17,
  reference: 18,
  folder: 19,
  enumMember: 20,
  constant: 21,
  struct: 22,
  event: 23,
  operator: 24,
  typeParameter: 25,
};

// Monaco diagnostic severity mapping
const severityMap: Record<string, number> = {
  error: 8, // MarkerSeverity.Error
  warning: 4, // MarkerSeverity.Warning
  information: 2, // MarkerSeverity.Info
  hint: 1, // MarkerSeverity.Hint
};

// Monaco document highlight kind mapping
// Maps LSP DocumentHighlightKind to Monaco DocumentHighlightKind
const documentHighlightKindMap: Record<DocumentHighlightKind, number> = {
  text: 0,  // DocumentHighlightKind.Text
  read: 1,  // DocumentHighlightKind.Read
  write: 2, // DocumentHighlightKind.Write
};

export interface LSPIntegrationOptions {
  monaco: typeof Monaco;
  editor: Monaco.editor.IStandaloneCodeEditor;
  serverId: string;
  uri: string;
  languageId: string;
  /** Optional function to get current inlay hints settings */
  getInlayHintsSettings?: () => InlayHintsSettings;
}

// Default inlay hints settings
const DEFAULT_INLAY_HINTS_SETTINGS: InlayHintsSettings = {
  enabled: true,
  fontSize: 0,
  fontFamily: "",
  showTypes: true,
  showParameterNames: true,
  showReturnTypes: true,
  maxLength: 25,
  padding: true,
};

/**
 * Set up LSP integration for a Monaco editor instance
 */
export function setupLSPIntegration(options: LSPIntegrationOptions): () => void {
  const { monaco, editor, serverId, uri, languageId, getInlayHintsSettings } = options;
  const lsp = useLSP();
  const disposables: Monaco.IDisposable[] = [];
  const inlayHintsSettings = getInlayHintsSettings ?? (() => DEFAULT_INLAY_HINTS_SETTINGS);

  // Register "Go to Declaration" editor action (Ctrl+F12)
  const goToDeclarationAction = editor.addAction({
    id: "editor.action.goToDeclaration",
    label: "Go to Declaration",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12,
    ],
    contextMenuGroupId: "navigation",
    contextMenuOrder: 1.4, // After "Go to Definition" (1.3)
    async run(ed: Monaco.editor.ICodeEditor): Promise<void> {
      const position = ed.getPosition();
      const model = ed.getModel();
      if (!position || !model || model.uri.toString() !== uri) return;

      try {
        const result = await lsp.getDeclaration(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.locations.length) {
          // No declaration found - could show a message or fall back to definition
          return;
        }

        if (result.locations.length === 1) {
          // Single declaration - navigate directly
          const loc = result.locations[0];
          const targetUri = monaco.Uri.parse(loc.uri);
          const targetRange = {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          };

          // If same file, just move cursor
          if (targetUri.toString() === model.uri.toString()) {
            ed.setPosition({
              lineNumber: targetRange.startLineNumber,
              column: targetRange.startColumn,
            });
            ed.revealLineInCenter(targetRange.startLineNumber);
          } else {
            // For different file, we'd need to trigger a file open event
            // This would typically be handled by the parent component
            // For now, just reveal in peek widget if available
            editor.trigger("goToDeclaration", "editor.action.peekDeclaration", null);
          }
        } else {
          // Multiple declarations - show peek widget
          editor.trigger("goToDeclaration", "editor.action.peekDeclaration", null);
        }
      } catch (e) {
        console.error("Go to Declaration error:", e);
      }
    },
  });
  disposables.push(goToDeclarationAction);

  // Map to store original completion items for resolve requests
  const completionItemDataMap = new WeakMap<object, CompletionItemData>();

  // Register completion provider with resolve support
  const completionProvider = monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: [".", ":", "<", '"', "'", "/", "@", "*"],
    
    async provideCompletionItems(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      context: Monaco.languages.CompletionContext,
    ): Promise<Monaco.languages.CompletionList> {
      if (model.uri.toString() !== uri) {
        return { suggestions: [] };
      }

      try {
        const result = await lsp.getCompletions(
          serverId,
          uri,
          { line: position.lineNumber - 1, character: position.column - 1 },
          context.triggerKind,
          context.triggerCharacter,
        );

        const suggestions: Monaco.languages.CompletionItem[] = result.items.map((item) => {
          const monacoItem = convertCompletionItem(monaco, item, position);
          // Store original item data for resolve
          completionItemDataMap.set(monacoItem, {
            originalItem: item,
            serverId,
          });
          return monacoItem;
        });

        return {
          suggestions,
          incomplete: result.isIncomplete,
        };
      } catch (e) {
        console.error("LSP completion error:", e);
        return { suggestions: [] };
      }
    },

    async resolveCompletionItem(
      item: Monaco.languages.CompletionItem,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.CompletionItem> {
      // Retrieve original item data
      const itemData = completionItemDataMap.get(item);
      if (!itemData) {
        // No original data available, return as-is
        return item;
      }

      try {
        const resolved = await lsp.resolveCompletionItem(
          itemData.serverId,
          itemData.originalItem,
        );

        // Update the Monaco completion item with resolved details
        const updatedItem: Monaco.languages.CompletionItem = {
          ...item,
        };

        // Update documentation if resolved
        if (resolved.documentation) {
          updatedItem.documentation = { value: resolved.documentation };
        }

        // Update detail if resolved
        if (resolved.detail) {
          updatedItem.detail = resolved.detail;
        }

        // Update additional text edits if resolved
        if (resolved.additionalTextEdits && resolved.additionalTextEdits.length > 0) {
          updatedItem.additionalTextEdits = resolved.additionalTextEdits.map((edit) => ({
            range: {
              startLineNumber: edit.range.start.line + 1,
              startColumn: edit.range.start.character + 1,
              endLineNumber: edit.range.end.line + 1,
              endColumn: edit.range.end.character + 1,
            },
            text: edit.newText,
          }));
        }

        // Update insert text if resolved and different
        if (resolved.insertText && resolved.insertText !== itemData.originalItem.insertText) {
          updatedItem.insertText = resolved.insertText;
        }

        // Handle command if present (Monaco will execute it after insertion)
        if (resolved.command) {
          updatedItem.command = {
            id: resolved.command.command,
            title: resolved.command.title,
            arguments: resolved.command.arguments,
          };
        }

        return updatedItem;
      } catch (e) {
        console.debug("LSP completion resolve error:", e);
        return item;
      }
    },
  });
  disposables.push(completionProvider);

  // Register hover provider
  const hoverProvider = monaco.languages.registerHoverProvider(languageId, {
    async provideHover(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Promise<Monaco.languages.Hover | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getHover(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result) return null;

        return {
          contents: [{ value: result.contents }],
          range: result.range
            ? {
                startLineNumber: result.range.start.line + 1,
                startColumn: result.range.start.character + 1,
                endLineNumber: result.range.end.line + 1,
                endColumn: result.range.end.character + 1,
              }
            : undefined,
        };
      } catch (e) {
        console.error("LSP hover error:", e);
        return null;
      }
    },
  });
  disposables.push(hoverProvider);

  // Register definition provider
  const definitionProvider = monaco.languages.registerDefinitionProvider(languageId, {
    async provideDefinition(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Promise<Monaco.languages.Definition | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getDefinition(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.locations.length) return null;

        return result.locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (e) {
        console.error("LSP definition error:", e);
        return null;
      }
    },
  });
  disposables.push(definitionProvider);

  // Register references provider
  const referencesProvider = monaco.languages.registerReferenceProvider(languageId, {
    async provideReferences(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _context: Monaco.languages.ReferenceContext,
    ): Promise<Monaco.languages.Location[] | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getReferences(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.locations.length) return null;

        return result.locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (e) {
        console.error("LSP references error:", e);
        return null;
      }
    },
  });
  disposables.push(referencesProvider);

  // Register type definition provider
  const typeDefinitionProvider = monaco.languages.registerTypeDefinitionProvider(languageId, {
    async provideTypeDefinition(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Promise<Monaco.languages.Definition | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getTypeDefinition(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.locations.length) return null;

        return result.locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (e) {
        console.error("LSP type definition error:", e);
        return null;
      }
    },
  });
  disposables.push(typeDefinitionProvider);

  // Register implementation provider
  const implementationProvider = monaco.languages.registerImplementationProvider(languageId, {
    async provideImplementation(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Promise<Monaco.languages.Definition | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getImplementation(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.locations.length) return null;

        return result.locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (e) {
        console.error("LSP implementation error:", e);
        return null;
      }
    },
  });
  disposables.push(implementationProvider);

  // Register declaration provider
  // Declaration: Goes to interface/abstract definition (e.g., interface method signature)
  // Definition: Goes to concrete implementation
  const declarationProvider = monaco.languages.registerDeclarationProvider(languageId, {
    async provideDeclaration(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.Definition | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getDeclaration(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.locations.length) return null;

        return result.locations.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: {
            startLineNumber: loc.range.start.line + 1,
            startColumn: loc.range.start.character + 1,
            endLineNumber: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
          },
        }));
      } catch (e) {
        console.error("LSP declaration error:", e);
        return null;
      }
    },
  });
  disposables.push(declarationProvider);

  // Register signature help provider
  const signatureHelpProvider = monaco.languages.registerSignatureHelpProvider(languageId, {
    signatureHelpTriggerCharacters: ["(", ","],
    signatureHelpRetriggerCharacters: [","],

    async provideSignatureHelp(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken,
      context: Monaco.languages.SignatureHelpContext,
    ): Promise<Monaco.languages.SignatureHelpResult | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getSignatureHelp(
          serverId,
          uri,
          { line: position.lineNumber - 1, character: position.column - 1 },
          context.triggerKind,
          context.triggerCharacter,
          context.isRetrigger,
        );

        if (!result || !result.signatures.length) return null;

        return {
          value: {
            signatures: result.signatures.map((sig) => ({
              label: sig.label,
              documentation: sig.documentation ? { value: sig.documentation } : undefined,
              parameters: sig.parameters?.map((param) => ({
                label: param.label,
                documentation: param.documentation ? { value: param.documentation } : undefined,
              })) ?? [],
              activeParameter: sig.activeParameter,
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
          },
          dispose: () => {},
        };
      } catch (e) {
        console.error("LSP signature help error:", e);
        return null;
      }
    },
  });
  disposables.push(signatureHelpProvider);

  // Register rename provider with prepare rename support
  const renameProvider = monaco.languages.registerRenameProvider(languageId, {
    /**
     * Validates the rename target before allowing rename to proceed.
     * Uses textDocument/prepareRename to check if the symbol can be renamed.
     * 
     * The return type is RenameLocation & Rejection which means:
     * - If rename is allowed: return { range, text }
     * - If rename is rejected: return { range, text, rejectReason } where rejectReason is set
     */
    async resolveRenameLocation(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.RenameLocation & Monaco.languages.Rejection> {
      if (model.uri.toString() !== uri) {
        // Return a rejection with placeholder range and text
        return {
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: "",
          rejectReason: "Cannot rename in this file",
        };
      }

      try {
        const result = await lsp.prepareRename(
          serverId,
          uri,
          { line: position.lineNumber - 1, character: position.column - 1 },
        );

        if (!result) {
          // Server returned null - symbol cannot be renamed
          // Get word at position for the required range/text
          const wordAtPosition = model.getWordAtPosition(position);
          return {
            range: wordAtPosition 
              ? new monaco.Range(
                  position.lineNumber,
                  wordAtPosition.startColumn,
                  position.lineNumber,
                  wordAtPosition.endColumn
                )
              : new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: wordAtPosition?.word ?? "",
            rejectReason: "Cannot rename this symbol",
          };
        }

        // Return the range and placeholder text for the rename input
        // No rejectReason means rename is allowed
        return {
          range: new monaco.Range(
            result.range.start.line + 1,
            result.range.start.character + 1,
            result.range.end.line + 1,
            result.range.end.character + 1,
          ),
          text: result.placeholder,
          rejectReason: undefined,
        };
      } catch (e) {
        // If prepareRename fails, fall back to allowing rename
        // Some servers don't support prepareRename
        console.debug("LSP prepareRename not supported or failed:", e);
        
        // Get the word at position as fallback
        const wordAtPosition = model.getWordAtPosition(position);
        if (!wordAtPosition) {
          return {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: "",
            rejectReason: "Cannot rename at this position",
          };
        }
        
        // Allow rename with fallback word
        return {
          range: new monaco.Range(
            position.lineNumber,
            wordAtPosition.startColumn,
            position.lineNumber,
            wordAtPosition.endColumn,
          ),
          text: wordAtPosition.word,
          rejectReason: undefined,
        };
      }
    },

    async provideRenameEdits(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      newName: string,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.WorkspaceEdit | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.rename(
          serverId,
          uri,
          { line: position.lineNumber - 1, character: position.column - 1 },
          newName,
        );

        if (!result.changes) return null;

        const edits: Monaco.languages.IWorkspaceTextEdit[] = [];

        for (const [fileUri, fileEdits] of Object.entries(result.changes)) {
          for (const edit of fileEdits) {
            edits.push({
              resource: monaco.Uri.parse(fileUri),
              textEdit: {
                range: {
                  startLineNumber: edit.range.start.line + 1,
                  startColumn: edit.range.start.character + 1,
                  endLineNumber: edit.range.end.line + 1,
                  endColumn: edit.range.end.character + 1,
                },
                text: edit.newText,
              },
              versionId: undefined,
            });
          }
        }

        return { edits };
      } catch (e) {
        console.error("LSP rename error:", e);
        return null;
      }
    },
  });
  disposables.push(renameProvider);

  // Register code action provider
  const codeActionProvider = monaco.languages.registerCodeActionProvider(languageId, {
    async provideCodeActions(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
      context: Monaco.languages.CodeActionContext,
    ): Promise<Monaco.languages.CodeActionList | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        // Convert Monaco diagnostics to LSP diagnostics
        const diagnostics = context.markers.map((marker) => ({
          range: {
            start: { line: marker.startLineNumber - 1, character: marker.startColumn - 1 },
            end: { line: marker.endLineNumber - 1, character: marker.endColumn - 1 },
          },
          severity: marker.severity === 8 ? "error" as const :
                    marker.severity === 4 ? "warning" as const :
                    marker.severity === 2 ? "information" as const : "hint" as const,
          code: marker.code?.toString(),
          source: marker.source,
          message: marker.message,
        }));

        const result = await lsp.getCodeActions(
          serverId,
          uri,
          {
            start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
            end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
          },
          diagnostics,
        );

        if (!result.actions.length) return null;

        const actions: Monaco.languages.CodeAction[] = result.actions.map((action) => {
          const monacoAction: Monaco.languages.CodeAction = {
            title: action.title,
            kind: action.kind,
            isPreferred: action.isPreferred,
          };

          if (action.edit?.changes) {
            const edits: Monaco.languages.IWorkspaceTextEdit[] = [];
            for (const [fileUri, fileEdits] of Object.entries(action.edit.changes)) {
              for (const edit of fileEdits) {
                edits.push({
                  resource: monaco.Uri.parse(fileUri),
                  textEdit: {
                    range: {
                      startLineNumber: edit.range.start.line + 1,
                      startColumn: edit.range.start.character + 1,
                      endLineNumber: edit.range.end.line + 1,
                      endColumn: edit.range.end.character + 1,
                    },
                    text: edit.newText,
                  },
                  versionId: undefined,
                });
              }
            }
            monacoAction.edit = { edits };
          }

          return monacoAction;
        });

        return { actions, dispose: () => {} };
      } catch (e) {
        console.error("LSP code action error:", e);
        return null;
      }
    },
  });
  disposables.push(codeActionProvider);

  // Register document formatting provider
  const documentFormattingProvider = monaco.languages.registerDocumentFormattingEditProvider(languageId, {
    async provideDocumentFormattingEdits(
      model: Monaco.editor.ITextModel,
      options: Monaco.languages.FormattingOptions,
    ): Promise<Monaco.languages.TextEdit[] | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.formatDocument(
          serverId,
          uri,
          options.tabSize,
          options.insertSpaces,
        );

        if (!result.edits.length) return null;

        return result.edits.map((edit) => ({
          range: {
            startLineNumber: edit.range.start.line + 1,
            startColumn: edit.range.start.character + 1,
            endLineNumber: edit.range.end.line + 1,
            endColumn: edit.range.end.character + 1,
          },
          text: edit.newText,
        }));
      } catch (e) {
        console.error("LSP format document error:", e);
        return null;
      }
    },
  });
  disposables.push(documentFormattingProvider);

  // Register document range formatting provider
  const rangeFormattingProvider = monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
    async provideDocumentRangeFormattingEdits(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
      options: Monaco.languages.FormattingOptions,
    ): Promise<Monaco.languages.TextEdit[] | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.formatRange(
          serverId,
          uri,
          {
            start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
            end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
          },
          options.tabSize,
          options.insertSpaces,
        );

        if (!result.edits.length) return null;

        return result.edits.map((edit) => ({
          range: {
            startLineNumber: edit.range.start.line + 1,
            startColumn: edit.range.start.character + 1,
            endLineNumber: edit.range.end.line + 1,
            endColumn: edit.range.end.character + 1,
          },
          text: edit.newText,
        }));
      } catch (e) {
        console.error("LSP format range error:", e);
        return null;
      }
    },
  });
  disposables.push(rangeFormattingProvider);

  // Register document highlight provider
  // Highlights all occurrences of the symbol at the current cursor position
  const documentHighlightProvider = monaco.languages.registerDocumentHighlightProvider(languageId, {
    async provideDocumentHighlights(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.DocumentHighlight[] | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getDocumentHighlights(serverId, uri, {
          line: position.lineNumber - 1,
          character: position.column - 1,
        });

        if (!result.highlights.length) return null;

        return result.highlights.map((highlight) => ({
          range: {
            startLineNumber: highlight.range.start.line + 1,
            startColumn: highlight.range.start.character + 1,
            endLineNumber: highlight.range.end.line + 1,
            endColumn: highlight.range.end.character + 1,
          },
          // Map the highlight kind, defaulting to Text (0) if not specified
          kind: highlight.kind 
            ? documentHighlightKindMap[highlight.kind] 
            : monaco.languages.DocumentHighlightKind.Text,
        }));
      } catch (e) {
        console.error("LSP document highlights error:", e);
        return null;
      }
    },
  });
  disposables.push(documentHighlightProvider);

  // Register inlay hints provider
  const inlayHintsProvider = monaco.languages.registerInlayHintsProvider(languageId, {
    async provideInlayHints(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.InlayHintList | null> {
      const settings = inlayHintsSettings();

      // Check if inlay hints are enabled
      if (!settings.enabled) {
        return { hints: [], dispose: () => {} };
      }

      if (model.uri.toString() !== uri) {
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

        const result = await lsp.getInlayHints(serverId, uri, lspRange);

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
            label: convertInlayHintLabel(monaco, hint.label, settings.maxLength),
            kind: convertInlayHintKind(monaco, hint.kind),
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
        console.debug("LSP inlay hints error:", e);
        return { hints: [], dispose: () => {} };
      }
    },
  });
  disposables.push(inlayHintsProvider);

  // Apply inlay hints editor options
  const settings = inlayHintsSettings();
  options.editor.updateOptions({
    inlayHints: {
      enabled: settings.enabled ? "on" : "off",
      fontSize: settings.fontSize > 0 ? settings.fontSize : undefined,
      fontFamily: settings.fontFamily || undefined,
      padding: settings.padding,
    },
  });

  // Register folding range provider
  const foldingRangeProvider = monaco.languages.registerFoldingRangeProvider(languageId, {
    async provideFoldingRanges(
      model: Monaco.editor.ITextModel,
      _context: Monaco.languages.FoldingContext,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.FoldingRange[] | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getFoldingRanges(serverId, uri);

        if (!result || result.length === 0) {
          return null;
        }

        // Convert LSP folding ranges to Monaco format
        return result.map((range) => ({
          // Monaco uses 1-based line numbers
          start: range.startLine + 1,
          end: range.endLine + 1,
          kind: convertFoldingRangeKind(monaco, range.kind),
        }));
      } catch (e) {
        console.debug("LSP folding range error:", e);
        return null;
      }
    },
  });
  disposables.push(foldingRangeProvider);

  // Update editor folding strategy to "auto" when LSP folding is available
  options.editor.updateOptions({
    folding: true,
    foldingStrategy: "auto",
    showFoldingControls: "mouseover",
    foldingHighlight: true,
  });

  // Register selection range provider (smart selection)
  const selectionRangeProvider = monaco.languages.registerSelectionRangeProvider(languageId, {
    async provideSelectionRanges(
      model: Monaco.editor.ITextModel,
      positions: Monaco.Position[],
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.SelectionRange[][] | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        // Convert Monaco positions to LSP positions
        const lspPositions = positions.map((pos) => ({
          line: pos.lineNumber - 1,
          character: pos.column - 1,
        }));

        const result = await lsp.getSelectionRanges(serverId, uri, lspPositions);

        if (!result || result.length === 0) {
          return null;
        }

        // Convert LSP selection ranges to Monaco format
        return result.map((selRange) => [convertSelectionRange(selRange)]);
      } catch (e) {
        console.debug("LSP selection range error:", e);
        return null;
      }
    },
  });
  disposables.push(selectionRangeProvider);

  // Register color provider for CSS, SCSS, Less, JS, TS
  // Shows inline color decorations and color picker
  const colorProvider = monaco.languages.registerColorProvider(languageId, {
    async provideDocumentColors(
      model: Monaco.editor.ITextModel,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.IColorInformation[]> {
      if (model.uri.toString() !== uri) {
        return [];
      }

      try {
        const result = await lsp.getDocumentColors(serverId, uri);

        return result.map((colorInfo) => ({
          range: new monaco.Range(
            colorInfo.range.start.line + 1,
            colorInfo.range.start.character + 1,
            colorInfo.range.end.line + 1,
            colorInfo.range.end.character + 1
          ),
          color: {
            red: colorInfo.color.red,
            green: colorInfo.color.green,
            blue: colorInfo.color.blue,
            alpha: colorInfo.color.alpha,
          },
        }));
      } catch (e) {
        console.debug("LSP document colors error:", e);
        return [];
      }
    },

    async provideColorPresentations(
      _model: Monaco.editor.ITextModel,
      colorInfo: Monaco.languages.IColorInformation,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.IColorPresentation[]> {
      const lspRange: Range = {
        start: {
          line: colorInfo.range.startLineNumber - 1,
          character: colorInfo.range.startColumn - 1,
        },
        end: {
          line: colorInfo.range.endLineNumber - 1,
          character: colorInfo.range.endColumn - 1,
        },
      };

      try {
        const result = await lsp.getColorPresentations(
          serverId,
          uri,
          {
            red: colorInfo.color.red,
            green: colorInfo.color.green,
            blue: colorInfo.color.blue,
            alpha: colorInfo.color.alpha,
          },
          lspRange
        );

        return result.map((pres) => {
          const presentation: Monaco.languages.IColorPresentation = {
            label: pres.label,
          };

          if (pres.textEdit) {
            presentation.textEdit = {
              range: new monaco.Range(
                pres.textEdit.range.start.line + 1,
                pres.textEdit.range.start.character + 1,
                pres.textEdit.range.end.line + 1,
                pres.textEdit.range.end.character + 1
              ),
              text: pres.textEdit.newText,
            };
          }

          if (pres.additionalTextEdits) {
            presentation.additionalTextEdits = pres.additionalTextEdits.map((edit) => ({
              range: new monaco.Range(
                edit.range.start.line + 1,
                edit.range.start.character + 1,
                edit.range.end.line + 1,
                edit.range.end.character + 1
              ),
              text: edit.newText,
            }));
          }

          return presentation;
        });
      } catch (e) {
        console.debug("LSP color presentations error:", e);
        // Return default presentations as fallback
        return getDefaultColorPresentations(colorInfo.color);
      }
    },
  });
  disposables.push(colorProvider);

  // Enable color decorators in editor
  editor.updateOptions({
    colorDecorators: true,
    colorDecoratorsLimit: 500,
  });

  // Register document link provider
  // Detects URLs and file paths, makes them clickable
  const linkProvider = monaco.languages.registerLinkProvider(languageId, {
    async provideLinks(
      model: Monaco.editor.ITextModel,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.ILinksList | null> {
      if (model.uri.toString() !== uri) {
        return null;
      }

      try {
        const result = await lsp.getDocumentLinks(serverId, uri);

        const links: Monaco.languages.ILink[] = result.map((link) => ({
          range: new monaco.Range(
            link.range.start.line + 1,
            link.range.start.character + 1,
            link.range.end.line + 1,
            link.range.end.character + 1
          ),
          url: link.target,
          tooltip: link.tooltip,
        }));

        return { links };
      } catch (e) {
        console.debug("LSP document links error:", e);
        return null;
      }
    },

    async resolveLink(
      link: Monaco.languages.ILink,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.ILink | null> {
      // If link already has a URL, return as-is
      if (link.url) {
        return link;
      }

      try {
        const lspRange: Range = {
          start: {
            line: link.range.startLineNumber - 1,
            character: link.range.startColumn - 1,
          },
          end: {
            line: link.range.endLineNumber - 1,
            character: link.range.endColumn - 1,
          },
        };

        const resolved = await lsp.resolveDocumentLink(serverId, {
          range: lspRange,
          target: link.url?.toString(),
          tooltip: link.tooltip,
        });

        if (resolved.target) {
          return {
            ...link,
            url: resolved.target,
            tooltip: resolved.tooltip || link.tooltip,
          };
        }
      } catch (e) {
        console.debug("LSP document link resolve error:", e);
      }

      return link;
    },
  });
  disposables.push(linkProvider);

  // Enable links in editor
  editor.updateOptions({
    links: true,
  });

  // Cleanup function
  return () => {
    disposables.forEach((d) => d?.dispose?.());
  };
}

/**
 * Get default color presentations (fallback when LSP doesn't provide them)
 */
function getDefaultColorPresentations(
  color: Monaco.languages.IColor
): Monaco.languages.IColorPresentation[] {
  const r = Math.round(color.red * 255);
  const g = Math.round(color.green * 255);
  const b = Math.round(color.blue * 255);
  const a = color.alpha;

  const presentations: Monaco.languages.IColorPresentation[] = [];

  // HEX format
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  presentations.push({ label: hex });

  // HEX with alpha if not fully opaque
  if (a < 1) {
    const hexA = `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
    presentations.push({ label: hexA });
  }

  // RGB/RGBA format
  if (a < 1) {
    presentations.push({ label: `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})` });
  } else {
    presentations.push({ label: `rgb(${r}, ${g}, ${b})` });
  }

  // HSL/HSLA format
  const hsl = rgbToHsl(color.red, color.green, color.blue);
  if (a < 1) {
    presentations.push({
      label: `hsla(${Math.round(hsl.h * 360)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%, ${a.toFixed(2)})`,
    });
  } else {
    presentations.push({
      label: `hsl(${Math.round(hsl.h * 360)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`,
    });
  }

  return presentations;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

/**
 * Convert LSP completion item to Monaco completion item
 */
function convertCompletionItem(
  monaco: typeof Monaco,
  item: CompletionItem,
  _position: Monaco.Position,
): Monaco.languages.CompletionItem {
  const kind = item.kind ? completionKindMap[item.kind] ?? 1 : 1;

  let insertText = item.insertText ?? item.label;
  let insertTextRules: Monaco.languages.CompletionItemInsertTextRule | undefined;

  // Handle snippet insert text format (2 = Snippet)
  if (item.insertTextFormat === 2) {
    insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  }

  let range: Monaco.IRange | Monaco.languages.CompletionItemRanges | undefined;

  if (item.textEdit) {
    range = {
      startLineNumber: item.textEdit.range.start.line + 1,
      startColumn: item.textEdit.range.start.character + 1,
      endLineNumber: item.textEdit.range.end.line + 1,
      endColumn: item.textEdit.range.end.character + 1,
    };
    insertText = item.textEdit.newText;
  }

  return {
    label: item.label,
    kind,
    detail: item.detail,
    documentation: item.documentation ? { value: item.documentation } : undefined,
    insertText,
    insertTextRules,
    range: range as Monaco.IRange,
    sortText: item.sortText,
    filterText: item.filterText,
    additionalTextEdits: item.additionalTextEdits?.map((edit) => ({
      range: {
        startLineNumber: edit.range.start.line + 1,
        startColumn: edit.range.start.character + 1,
        endLineNumber: edit.range.end.line + 1,
        endColumn: edit.range.end.character + 1,
      },
      text: edit.newText,
    })),
  };
}

/**
 * Update Monaco editor markers from LSP diagnostics
 */
export function updateDiagnosticsMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  diagnostics: Diagnostic[],
): void {
  const markers: Monaco.editor.IMarkerData[] = diagnostics.map((diag) => ({
    severity: diag.severity ? severityMap[diag.severity] ?? 2 : 2,
    startLineNumber: diag.range.start.line + 1,
    startColumn: diag.range.start.character + 1,
    endLineNumber: diag.range.end.line + 1,
    endColumn: diag.range.end.character + 1,
    message: diag.message,
    source: diag.source,
    code: diag.code,
  }));

  monaco.editor.setModelMarkers(model, "lsp", markers);
}

/**
 * Clear all LSP markers from a model
 */
export function clearDiagnosticsMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
): void {
  monaco.editor.setModelMarkers(model, "lsp", []);
}

/**
 * Convert Monaco position to LSP position
 */
export function toPosition(position: Monaco.Position): Position {
  return {
    line: position.lineNumber - 1,
    character: position.column - 1,
  };
}

/**
 * Convert LSP position to Monaco position
 */
export function fromPosition(
  monaco: typeof Monaco,
  position: Position,
): Monaco.Position {
  return new monaco.Position(position.line + 1, position.character + 1);
}

/**
 * File URI utilities
 */
export function filePathToUri(filePath: string): string {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");
  return `file://${normalized}`;
}

export function uriToFilePath(uri: string): string {
  if (uri.startsWith("file://")) {
    return uri.substring(7);
  }
  return uri;
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
function convertInlayHintLabel(
  monaco: typeof Monaco,
  label: string | InlayHintLabelPart[],
  maxLength: number,
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
 * Convert LSP InlayHintKind to Monaco InlayHintKind
 */
function convertInlayHintKind(
  monaco: typeof Monaco,
  kind?: "type" | "parameter",
): Monaco.languages.InlayHintKind | undefined {
  if (!kind) return undefined;
  return kind === "type"
    ? monaco.languages.InlayHintKind.Type
    : monaco.languages.InlayHintKind.Parameter;
}

/**
 * Get Monaco editor options for inlay hints styling
 */
export function getInlayHintsEditorOptions(
  settings: InlayHintsSettings,
): Monaco.editor.IEditorOptions {
  return {
    inlayHints: {
      enabled: settings.enabled ? "on" : "off",
      fontSize: settings.fontSize > 0 ? settings.fontSize : undefined,
      fontFamily: settings.fontFamily || undefined,
      padding: settings.padding,
    },
  };
}

/**
 * Convert LSP FoldingRangeKind to Monaco FoldingRangeKind
 */
function convertFoldingRangeKind(
  monaco: typeof Monaco,
  kind?: "comment" | "imports" | "region",
): Monaco.languages.FoldingRangeKind | undefined {
  if (!kind) return undefined;
  switch (kind) {
    case "comment":
      return monaco.languages.FoldingRangeKind.Comment;
    case "imports":
      return monaco.languages.FoldingRangeKind.Imports;
    case "region":
      return monaco.languages.FoldingRangeKind.Region;
    default:
      return undefined;
  }
}

/**
 * Convert LSP SelectionRange to Monaco SelectionRange (recursive)
 */
function convertSelectionRange(
  selRange: { range: Range; parent?: { range: Range; parent?: unknown } },
): Monaco.languages.SelectionRange {
  const monacoRange: Monaco.languages.SelectionRange = {
    range: {
      startLineNumber: selRange.range.start.line + 1,
      startColumn: selRange.range.start.character + 1,
      endLineNumber: selRange.range.end.line + 1,
      endColumn: selRange.range.end.character + 1,
    },
  };

  // Recursively convert parent if present
  if (selRange.parent) {
    (monacoRange as Monaco.languages.SelectionRange & { parent?: Monaco.languages.SelectionRange }).parent = convertSelectionRange(
      selRange.parent as { range: Range; parent?: { range: Range; parent?: unknown } }
    );
  }

  return monacoRange;
}

/**
 * Get Monaco editor options for folding
 */
export function getFoldingEditorOptions(
  hasLSPFolding: boolean,
): Monaco.editor.IEditorOptions {
  return {
    folding: true,
    foldingStrategy: hasLSPFolding ? "auto" : "indentation",
    showFoldingControls: "mouseover",
    foldingHighlight: true,
    foldingMaximumRegions: 5000,
  };
}
