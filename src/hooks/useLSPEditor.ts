/**
 * LSP Editor Hook
 *
 * This hook provides LSP integration for Monaco editor instances.
 * It handles:
 * - Connecting to language servers
 * - Document synchronization
 * - Completion, hover, definition, and references
 * - Diagnostics display
 * - Inlay hints
 * - Semantic tokens highlighting
 */

import { createEffect, onCleanup } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useLSP, getLanguageServerConfig } from "@/context/LSPContext";
import { createInlayHintsProvider, getInlayHintsEditorOptions } from "@/providers/InlayHintsProvider";
import type { InlayHintsSettings, SemanticHighlightingSettings } from "@/context/SettingsContext";
import {
  registerSemanticTokensProviders,
  type SemanticTokensProviderConfig,
} from "@/utils/semanticTokensProvider";

interface UseLSPEditorOptions {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  filePath: string | null;
  fileName: string | null;
  language: string | null;
  content: string | null;
  /** Inlay hints settings - pass a function that returns current settings */
  getInlayHintsSettings?: () => InlayHintsSettings;
  /** Semantic highlighting settings - pass a function that returns current settings */
  getSemanticHighlightingSettings?: () => SemanticHighlightingSettings;
}

// Default inlay hints settings if not provided
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

// Default semantic highlighting settings if not provided
const DEFAULT_SEMANTIC_HIGHLIGHTING_SETTINGS: SemanticHighlightingSettings = {
  enabled: true,
  strings: true,
  comments: true,
};

// Monaco completion kind mapping
const COMPLETION_KIND_MAP: Record<string, number> = {
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
const SEVERITY_MAP: Record<string, number> = {
  error: 8, // MarkerSeverity.Error
  warning: 4, // MarkerSeverity.Warning
  information: 2, // MarkerSeverity.Info
  hint: 1, // MarkerSeverity.Hint
};

export function useLSPEditor(options: UseLSPEditorOptions) {
  const lsp = useLSP();
  
  let cleanup: (() => void) | null = null;
  let documentVersion = 0;
  let currentServerId: string | null = null;
  let disposables: Monaco.IDisposable[] = [];

  const filePathToUri = (filePath: string): string => {
    const normalized = filePath.replace(/\\/g, "/");
    return `file://${normalized}`;
  };

  createEffect(() => {
    const { editor, monaco, filePath, fileName, language, content, getInlayHintsSettings, getSemanticHighlightingSettings } = options;
    
    // Cleanup previous setup
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    disposables.forEach(d => d?.dispose?.());
    disposables = [];
    currentServerId = null;
    documentVersion = 0;

    // Require all parameters
    if (!editor || !monaco || !filePath || !fileName || !language || content === null) {
      return;
    }

    // Try to setup LSP for this file
    const setupLSP = async () => {
      const serverConfig = getLanguageServerConfig(fileName, filePath.replace(/[/\\][^/\\]+$/, "") || ".");
      if (!serverConfig) {
        return;
      }

      try {
        // Try to start or connect to the language server
        let server = lsp.getServerForFile(filePath);
        
        if (!server || server.status !== "running") {
          try {
            server = await lsp.startServer(serverConfig);
          } catch (e) {
            console.debug("LSP server not available:", serverConfig.name, e);
            return;
          }
        }

        if (!server || server.status !== "running") {
          return;
        }

        currentServerId = server.id;
        const uri = filePathToUri(filePath);

        // Register document with the language server
        await lsp.didOpen(server.id, filePath, serverConfig.languageId, documentVersion, content);

        // Register completion provider
        const completionProvider = monaco.languages.registerCompletionItemProvider(language, {
          triggerCharacters: [".", ":", "<", '"', "'", "/", "@", "*"],
          
          async provideCompletionItems(
            _model: Monaco.editor.ITextModel,
            position: Monaco.Position,
            context: Monaco.languages.CompletionContext
          ): Promise<Monaco.languages.CompletionList> {
            if (!currentServerId) {
              return { suggestions: [] };
            }

            try {
              const result = await lsp.getCompletions(
                currentServerId,
                filePath,
                { line: position.lineNumber - 1, character: position.column - 1 },
                context.triggerKind,
                context.triggerCharacter
              );

              const suggestions: Monaco.languages.CompletionItem[] = result.items.map((item) => ({
                label: item.label,
                kind: item.kind ? COMPLETION_KIND_MAP[item.kind] ?? 1 : 1,
                detail: item.detail,
                documentation: item.documentation ? { value: item.documentation } : undefined,
                insertText: item.insertText ?? item.label,
                insertTextRules: item.insertTextFormat === 2 
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                  : undefined,
                range: item.textEdit ? {
                  startLineNumber: item.textEdit.range.start.line + 1,
                  startColumn: item.textEdit.range.start.character + 1,
                  endLineNumber: item.textEdit.range.end.line + 1,
                  endColumn: item.textEdit.range.end.character + 1,
                } : undefined,
                sortText: item.sortText,
                filterText: item.filterText,
              } as Monaco.languages.CompletionItem));

              return {
                suggestions,
                incomplete: result.isIncomplete,
              };
            } catch (e) {
              console.debug("LSP completion error:", e);
              return { suggestions: [] };
            }
          },
        });
        disposables.push(completionProvider);

        // Register hover provider
        const hoverProvider = monaco.languages.registerHoverProvider(language, {
          async provideHover(
            _model: Monaco.editor.ITextModel,
            position: Monaco.Position
          ): Promise<Monaco.languages.Hover | null> {
            if (!currentServerId) return null;

            try {
              const result = await lsp.getHover(currentServerId, filePath, {
                line: position.lineNumber - 1,
                character: position.column - 1,
              });

              if (!result) return null;

              return {
                contents: [{ value: result.contents }],
                range: result.range ? {
                  startLineNumber: result.range.start.line + 1,
                  startColumn: result.range.start.character + 1,
                  endLineNumber: result.range.end.line + 1,
                  endColumn: result.range.end.character + 1,
                } : undefined,
              };
            } catch (e) {
              console.debug("LSP hover error:", e);
              return null;
            }
          },
        });
        disposables.push(hoverProvider);

        // Register definition provider
        const definitionProvider = monaco.languages.registerDefinitionProvider(language, {
          async provideDefinition(
            _model: Monaco.editor.ITextModel,
            position: Monaco.Position
          ): Promise<Monaco.languages.Definition | null> {
            if (!currentServerId) return null;

            try {
              const result = await lsp.getDefinition(currentServerId, filePath, {
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
              console.debug("LSP definition error:", e);
              return null;
            }
          },
        });
        disposables.push(definitionProvider);

        // Register references provider
        const referencesProvider = monaco.languages.registerReferenceProvider(language, {
          async provideReferences(
            _model: Monaco.editor.ITextModel,
            position: Monaco.Position,
            _context: Monaco.languages.ReferenceContext
          ): Promise<Monaco.languages.Location[] | null> {
            if (!currentServerId) return null;

            try {
              const result = await lsp.getReferences(currentServerId, filePath, {
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
              console.debug("LSP references error:", e);
              return null;
            }
          },
        });
        disposables.push(referencesProvider);

        // Register inlay hints provider
        const inlayHintsSettings = getInlayHintsSettings ?? (() => DEFAULT_INLAY_HINTS_SETTINGS);
        
        // Check if the server supports inlay hints
        const serverCapabilities = server.capabilities;
        if (serverCapabilities?.inlayHints) {
          const inlayHintsProvider = createInlayHintsProvider({
            monaco,
            languageId: language,
            serverId: server.id,
            filePath,
            getInlayHints: lsp.getInlayHints,
            getSettings: inlayHintsSettings,
          });
          disposables.push(inlayHintsProvider);

          // Apply inlay hints editor options
          const inlayHintsOptions = getInlayHintsEditorOptions(inlayHintsSettings());
          editor.updateOptions(inlayHintsOptions);
        }

        // Register semantic tokens provider
        const semanticSettings = getSemanticHighlightingSettings ?? (() => DEFAULT_SEMANTIC_HIGHLIGHTING_SETTINGS);
        
        // Check if the server supports semantic tokens
        if (serverCapabilities?.semanticTokens) {
          const semanticConfig: SemanticTokensProviderConfig = {
            enabled: semanticSettings().enabled,
            showStrings: semanticSettings().strings,
            showComments: semanticSettings().comments,
          };

          // Create fetcher functions that use the current server ID
          const fetchTokens = async (uri: string) => {
            if (!currentServerId) return null;
            return lsp.getSemanticTokens(currentServerId, uri);
          };

          const fetchTokensRange = async (uri: string, range: Parameters<typeof lsp.getSemanticTokensRange>[2]) => {
            if (!currentServerId) return null;
            return lsp.getSemanticTokensRange(currentServerId, uri, range);
          };

          const fetchLegend = async () => {
            if (!currentServerId) return null;
            return lsp.getSemanticTokensLegend(currentServerId);
          };

          const semanticProviders = registerSemanticTokensProviders(
            monaco,
            language,
            fetchTokens,
            fetchTokensRange,
            fetchLegend,
            semanticConfig
          );
          disposables.push(...semanticProviders);
          
          // Enable semantic highlighting in editor options
          editor.updateOptions({
            "semanticHighlighting.enabled": semanticSettings().enabled,
          } as Monaco.editor.IEditorOptions);
        }

        // Listen for content changes
        const changeDisposable = editor.onDidChangeModelContent(() => {
          if (!currentServerId) return;
          documentVersion++;
          const newContent = editor.getValue();
          lsp.didChange(currentServerId, filePath, documentVersion, newContent).catch(console.error);
        });
        disposables.push(changeDisposable);

        // Update diagnostics
        const updateDiagnostics = () => {
          const model = editor.getModel();
          if (!model) return;

          const diagnostics = lsp.getDiagnosticsForFile(uri);
          const markers: Monaco.editor.IMarkerData[] = diagnostics.map((diag) => ({
            severity: diag.severity ? SEVERITY_MAP[diag.severity] ?? 2 : 2,
            startLineNumber: diag.range.start.line + 1,
            startColumn: diag.range.start.character + 1,
            endLineNumber: diag.range.end.line + 1,
            endColumn: diag.range.end.character + 1,
            message: diag.message,
            source: diag.source ?? undefined,
            code: diag.code ?? undefined,
          }));

          monaco.editor.setModelMarkers(model, "lsp", markers);
        };

        // Initial diagnostics update
        updateDiagnostics();

        // Poll for diagnostics updates (could be replaced with reactive approach)
        const diagnosticsInterval = setInterval(updateDiagnostics, 1000);

        cleanup = () => {
          clearInterval(diagnosticsInterval);
          
          // Close document in language server
          if (currentServerId) {
            lsp.didClose(currentServerId, filePath).catch(console.error);
          }

          // Clear markers
          const model = editor.getModel();
          if (model) {
            monaco.editor.setModelMarkers(model, "lsp", []);
          }

          // Dispose all providers
          disposables.forEach(d => d?.dispose?.());
          disposables = [];
        };

      } catch (e) {
        console.debug("Failed to setup LSP for file:", fileName, e);
      }
    };

    // Start LSP setup
    setupLSP();
  });

  onCleanup(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    disposables.forEach(d => d?.dispose?.());
    disposables = [];
  });

  return {
    getServerId: () => currentServerId,
  };
}

/**
 * Hook to update inlay hints settings on the editor
 */
export function useInlayHintsEditorOptions(
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  settings: InlayHintsSettings
): void {
  createEffect(() => {
    if (!editor) return;
    
    const options = getInlayHintsEditorOptions(settings);
    editor.updateOptions(options);
  });
}
