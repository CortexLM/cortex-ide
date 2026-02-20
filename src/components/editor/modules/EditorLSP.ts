/**
 * EditorLSP - Monaco LSP Provider Registration
 *
 * Contains functions to register Monaco language providers that integrate with
 * the LSP backend via Tauri invoke. Includes:
 * - Inlay Hints Provider
 * - On Type Formatting Provider
 * - CodeLens Provider
 * - Semantic Tokens Provider
 * - Debug Hover Provider
 * - Linked Editing Range Provider
 * - Unicode Hover/CodeAction Providers
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import {
  type LSPInlayHintsResponse,
  type LSPOnTypeFormattingResponse,
  type LSPCodeLensResult,
  type LSPSemanticTokensResult,
  type FormatOnTypeSettings,
  type InlayHintSettings,
  type CodeLensSettings,
  type DebugHoverState,
  type UnicodeHighlightSettings,
  SEMANTIC_TOKEN_TYPES,
  SEMANTIC_TOKEN_MODIFIERS,
  DEFAULT_FORMAT_ON_TYPE_SETTINGS,
  DEFAULT_INLAY_HINT_SETTINGS,
} from "./EditorTypes";
import {
  isTestLine,
  extractTestName,
  isReferenceLens,
  isImplementationLens,
  isTestLens,
  getDebugValueTypeClass,
  escapeDebugHtml,
  getUnicodeCharacterInfo,
  shouldHighlightCharacter,
  formatUnicodeCategory,
} from "./EditorUtils";

// ============================================================================
// Provider State Management
// ============================================================================

let inlayHintsProviderDisposable: Monaco.IDisposable | null = null;
let onTypeFormattingProviderDisposable: Monaco.IDisposable | null = null;
let codeLensProviderDisposables: Monaco.IDisposable[] = [];
let semanticTokensProviderDisposables: Monaco.IDisposable[] = [];
let debugHoverProviderDisposable: Monaco.IDisposable | null = null;
let linkedEditingProviderDisposables: Monaco.IDisposable[] = [];
let unicodeHoverProviderDisposable: Monaco.IDisposable | null = null;
let unicodeCodeActionProviderDisposable: Monaco.IDisposable | null = null;

let inlayHintSettings: InlayHintSettings = { ...DEFAULT_INLAY_HINT_SETTINGS };
let formatOnTypeSettings: FormatOnTypeSettings = {
  ...DEFAULT_FORMAT_ON_TYPE_SETTINGS,
};
let codeLensSettings: CodeLensSettings = {
  enabled: true,
  fontFamily: "",
  fontSize: 12,
  showReferences: true,
  showImplementations: true,
  showTestActions: true,
};
let debugHoverState: DebugHoverState | null = null;
let unicodeHighlightSettings: UnicodeHighlightSettings = {
  enabled: true,
  invisibleCharacters: true,
  ambiguousCharacters: true,
  nonBasicASCII: false,
  includeComments: "inUntrustedWorkspace",
  includeStrings: true,
  allowedCharacters: {},
  allowedLocales: { _os: true, _vscode: true },
};
let linkedEditingEnabled = true;

// ============================================================================
// Inlay Hints Provider
// ============================================================================

export function registerInlayHintsProvider(monaco: typeof Monaco): void {
  if (inlayHintsProviderDisposable) {
    inlayHintsProviderDisposable?.dispose?.();
    inlayHintsProviderDisposable = null;
  }

  const supportedLanguages = [
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

  const disposables: Monaco.IDisposable[] = [];

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerInlayHintsProvider(language, {
      provideInlayHints: async (
        model: Monaco.editor.ITextModel,
        range: Monaco.Range,
        _token: Monaco.CancellationToken,
      ): Promise<Monaco.languages.InlayHintList> => {
        if (inlayHintSettings.enabled === "off") {
          return { hints: [], dispose: () => {} };
        }

        const uri = model.uri.toString();

        try {
          const response = await invoke<LSPInlayHintsResponse>(
            "lsp_inlay_hints",
            {
              params: {
                uri,
                range: {
                  start: {
                    line: range.startLineNumber - 1,
                    character: range.startColumn - 1,
                  },
                  end: {
                    line: range.endLineNumber - 1,
                    character: range.endColumn - 1,
                  },
                },
              },
            },
          );

          if (!response || !response.hints || response.hints.length === 0) {
            return { hints: [], dispose: () => {} };
          }

          const monacoHints: Monaco.languages.InlayHint[] = response.hints
            .filter((hint) => {
              const isTypeHint = hint.kind === 1;
              const isParameterHint = hint.kind === 2;
              if (isTypeHint && !inlayHintSettings.showTypeHints) return false;
              if (isParameterHint && !inlayHintSettings.showParameterNames)
                return false;
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

          return { hints: monacoHints, dispose: () => {} };
        } catch (error) {
          console.debug("Inlay hints not available:", error);
          return { hints: [], dispose: () => {} };
        }
      },
    });

    disposables.push(disposable);
  }

  inlayHintsProviderDisposable = {
    dispose: () => disposables.forEach((d) => d?.dispose?.()),
  };
}

export function updateInlayHintSettings(
  settings: Partial<InlayHintSettings>,
): void {
  inlayHintSettings = { ...inlayHintSettings, ...settings };
}

// ============================================================================
// On Type Formatting Provider
// ============================================================================

export function registerOnTypeFormattingProvider(monaco: typeof Monaco): void {
  if (onTypeFormattingProviderDisposable) {
    onTypeFormattingProviderDisposable?.dispose?.();
    onTypeFormattingProviderDisposable = null;
  }

  const supportedLanguages = [
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

  const disposables: Monaco.IDisposable[] = [];
  const triggerChars = formatOnTypeSettings.triggerCharacters;

  if (triggerChars.length === 0) return;

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerOnTypeFormattingEditProvider(
      language,
      {
        autoFormatTriggerCharacters: triggerChars,
        provideOnTypeFormattingEdits: async (
          model: Monaco.editor.ITextModel,
          position: Monaco.Position,
          ch: string,
          options: Monaco.languages.FormattingOptions,
          _token: Monaco.CancellationToken,
        ): Promise<Monaco.languages.TextEdit[]> => {
          if (!formatOnTypeSettings.enabled) return [];
          if (!formatOnTypeSettings.triggerCharacters.includes(ch)) return [];

          const uri = model.uri.toString();

          try {
            const response = await invoke<LSPOnTypeFormattingResponse>(
              "lsp_on_type_formatting",
              {
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
              },
            );

            if (!response || !response.edits || response.edits.length === 0)
              return [];

            return response.edits.map((edit) => ({
              range: new monaco.Range(
                edit.range.start.line + 1,
                edit.range.start.character + 1,
                edit.range.end.line + 1,
                edit.range.end.character + 1,
              ),
              text: edit.newText,
            }));
          } catch (error) {
            console.debug("On type formatting not available:", error);
            return [];
          }
        },
      },
    );

    disposables.push(disposable);
  }

  onTypeFormattingProviderDisposable = {
    dispose: () => disposables.forEach((d) => d?.dispose?.()),
  };
}

export function updateFormatOnTypeSettings(
  settings: Partial<FormatOnTypeSettings>,
  monaco?: typeof Monaco,
): void {
  const needsReregister =
    settings.triggerCharacters !== undefined &&
    JSON.stringify(settings.triggerCharacters) !==
      JSON.stringify(formatOnTypeSettings.triggerCharacters);

  formatOnTypeSettings = { ...formatOnTypeSettings, ...settings };

  if (needsReregister && monaco) {
    registerOnTypeFormattingProvider(monaco);
  }
}

// ============================================================================
// CodeLens Provider
// ============================================================================

export function registerCodeLensProvider(monaco: typeof Monaco): void {
  codeLensProviderDisposables.forEach((d) => d?.dispose?.());
  codeLensProviderDisposables = [];

  const supportedLanguages = [
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

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerCodeLensProvider(language, {
      provideCodeLenses: async (
        model: Monaco.editor.ITextModel,
        _token: Monaco.CancellationToken,
      ): Promise<Monaco.languages.CodeLensList> => {
        if (!codeLensSettings.enabled) {
          return { lenses: [], dispose: () => {} };
        }

        const uri = model.uri.toString();
        const filePath = uri.replace("file://", "");
        const allLenses: Monaco.languages.CodeLens[] = [];

        try {
          const response = await invoke<LSPCodeLensResult>(
            "lsp_multi_code_lens",
            {
              language,
              params: { uri: filePath },
            },
          );

          if (response && response.lenses && response.lenses.length > 0) {
            for (const lens of response.lenses) {
              if (
                isReferenceLens(lens.command) &&
                !codeLensSettings.showReferences
              )
                continue;
              if (
                isImplementationLens(lens.command) &&
                !codeLensSettings.showImplementations
              )
                continue;
              if (isTestLens(lens.command) && !codeLensSettings.showTestActions)
                continue;

              allLenses.push({
                range: new monaco.Range(
                  lens.range.start.line + 1,
                  lens.range.start.character + 1,
                  lens.range.end.line + 1,
                  lens.range.end.character + 1,
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

        if (codeLensSettings.showTestActions) {
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

        return { lenses: allLenses, dispose: () => {} };
      },

      resolveCodeLens: async (
        _model: Monaco.editor.ITextModel,
        codeLens: Monaco.languages.CodeLens,
        _token: Monaco.CancellationToken,
      ): Promise<Monaco.languages.CodeLens> => {
        return codeLens;
      },
    });

    codeLensProviderDisposables.push(disposable);
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
    },
  );
  codeLensProviderDisposables.push(runTestCommand);

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
    },
  );
  codeLensProviderDisposables.push(debugTestCommand);
}

export function updateCodeLensSettings(
  settings: Partial<CodeLensSettings>,
): void {
  codeLensSettings = { ...codeLensSettings, ...settings };
}

// ============================================================================
// Semantic Tokens Provider
// ============================================================================

export function registerSemanticTokensProvider(monaco: typeof Monaco): void {
  semanticTokensProviderDisposables.forEach((d) => d?.dispose?.());
  semanticTokensProviderDisposables = [];

  const legend: Monaco.languages.SemanticTokensLegend = {
    tokenTypes: [...SEMANTIC_TOKEN_TYPES],
    tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
  };

  const supportedLanguages = [
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

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerDocumentSemanticTokensProvider(
      language,
      {
        getLegend: () => legend,

        provideDocumentSemanticTokens: async (
          model: Monaco.editor.ITextModel,
          _lastResultId: string | null,
          _token: Monaco.CancellationToken,
        ): Promise<Monaco.languages.SemanticTokens | null> => {
          const uri = model.uri.toString();
          const filePath = uri.replace("file://", "");

          try {
            const response = await invoke<LSPSemanticTokensResult>(
              "lsp_multi_semantic_tokens",
              {
                language,
                params: { uri: filePath },
              },
            );

            if (!response || !response.data || response.data.length === 0) {
              return null;
            }

            return {
              data: new Uint32Array(response.data),
              resultId: response.resultId,
            };
          } catch (error) {
            console.debug("Semantic tokens not available:", error);
            return null;
          }
        },

        releaseDocumentSemanticTokens: (_resultId: string | undefined) => {},
      },
    );

    semanticTokensProviderDisposables.push(disposable);
  }
}

// ============================================================================
// Debug Hover Provider
// ============================================================================

const DEBUG_HOVER_ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  watch:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  chevronRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
};

function createDebugTreeNodeHtml(
  name: string,
  value: string,
  type: string | undefined,
  variablesReference: number,
  depth: number,
): string {
  const hasChildren = variablesReference > 0;
  const valueClass = getDebugValueTypeClass(type, value);
  const indentStyle = `padding-left: ${10 + depth * 16}px`;
  const nodeId = `debug-hover-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let html = `<li class="debug-hover-tree-item" data-node-id="${nodeId}" data-var-ref="${variablesReference}" data-depth="${depth}">`;
  html += `<div class="debug-hover-tree-row" style="${indentStyle}">`;

  if (hasChildren) {
    html += `<div class="debug-hover-tree-toggle" data-action="toggle">${DEBUG_HOVER_ICONS.chevronRight}</div>`;
  } else {
    html += `<div class="debug-hover-tree-indent"></div>`;
  }

  html += `<span class="debug-hover-tree-key">${escapeDebugHtml(name)}</span>`;
  html += `<span class="debug-hover-tree-separator">:</span>`;

  if (type) {
    html += `<span class="debug-hover-tree-type">${escapeDebugHtml(type)}</span>`;
  }

  html += `<span class="debug-hover-tree-value ${valueClass}" title="${escapeDebugHtml(value)}">${escapeDebugHtml(value)}</span>`;
  html += `</div>`;
  html += `<ul class="debug-hover-tree-children" style="display: none;"></ul>`;
  html += `</li>`;

  return html;
}

function buildDebugHoverHtml(
  expression: string,
  value: string,
  type: string | undefined,
  variablesReference: number,
): string {
  const valueClass = getDebugValueTypeClass(type, value);
  const hasChildren = variablesReference > 0;

  let html = `<div class="debug-hover-container" data-expression="${escapeDebugHtml(expression)}" data-value="${escapeDebugHtml(value)}" data-var-ref="${variablesReference}">`;

  html += `<div class="debug-hover-header">`;
  html += `<div class="debug-hover-name-section">`;
  html += `<span class="debug-hover-name">${escapeDebugHtml(expression)}</span>`;
  if (type) {
    html += `<span class="debug-hover-type">${escapeDebugHtml(type)}</span>`;
  }
  html += `</div>`;

  html += `<div class="debug-hover-actions">`;
  html += `<button class="debug-hover-btn" data-action="copy" title="Copy value">${DEBUG_HOVER_ICONS.copy}</button>`;
  html += `<button class="debug-hover-btn" data-action="watch" title="Add to watch">${DEBUG_HOVER_ICONS.watch}</button>`;
  html += `</div>`;
  html += `</div>`;

  html += `<div class="debug-hover-content">`;

  if (hasChildren) {
    html += `<ul class="debug-hover-tree">`;
    html += createDebugTreeNodeHtml(
      expression,
      value,
      type,
      variablesReference,
      0,
    );
    html += `</ul>`;
  } else {
    html += `<div class="debug-hover-value ${valueClass}">${escapeDebugHtml(value)}</div>`;
  }

  html += `</div>`;
  html += `</div>`;

  return html;
}

function extractDebugExpression(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  wordInfo: Monaco.editor.IWordAtPosition,
): string {
  const word = wordInfo.word;
  const lineContent = model.getLineContent(position.lineNumber);

  let startCol = wordInfo.startColumn - 1;
  let potentialExpr = word;

  while (startCol > 0) {
    const charBefore = lineContent[startCol - 1];

    if (charBefore === ".") {
      let identEnd = startCol - 1;
      let identStart = identEnd;

      while (identStart > 0 && /[\w$]/.test(lineContent[identStart - 1])) {
        identStart--;
      }

      if (identStart < identEnd) {
        const prevIdent = lineContent.substring(identStart, identEnd);
        potentialExpr = prevIdent + "." + potentialExpr;
        startCol = identStart;
        continue;
      }
    } else if (charBefore === "]") {
      let bracketDepth = 1;
      let bracketStart = startCol - 2;

      while (bracketStart >= 0 && bracketDepth > 0) {
        if (lineContent[bracketStart] === "[") bracketDepth--;
        else if (lineContent[bracketStart] === "]") bracketDepth++;
        bracketStart--;
      }

      if (bracketDepth === 0 && bracketStart >= 0) {
        let identEnd = bracketStart + 1;
        let identStart = identEnd;

        while (identStart > 0 && /[\w$]/.test(lineContent[identStart - 1])) {
          identStart--;
        }

        if (identStart < identEnd) {
          const prevIdent = lineContent.substring(identStart, identEnd);
          const bracketContent = lineContent.substring(
            bracketStart + 2,
            startCol - 1,
          );
          potentialExpr =
            prevIdent +
            "[" +
            bracketContent +
            "]" +
            (potentialExpr !== word ? "." + potentialExpr : "");
          startCol = identStart;
          continue;
        }
      }
    }

    break;
  }

  return potentialExpr.length > word.length ? potentialExpr : word;
}

async function copyDebugValueToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showDebugHoverToast("Value copied to clipboard");
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
}

function showDebugHoverToast(message: string): void {
  const existingToast = document.querySelector(".debug-hover-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = "debug-hover-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

async function handleDebugTreeToggle(toggleButton: HTMLElement): Promise<void> {
  const treeItem = toggleButton.closest(
    ".debug-hover-tree-item",
  ) as HTMLElement;
  if (!treeItem) return;

  const childrenContainer = treeItem.querySelector(
    ".debug-hover-tree-children",
  ) as HTMLElement;
  if (!childrenContainer) return;

  const isExpanded = toggleButton.classList.contains("expanded");

  if (isExpanded) {
    toggleButton.classList.remove("expanded");
    childrenContainer.style.display = "none";
  } else {
    toggleButton.classList.add("expanded");
    childrenContainer.style.display = "block";

    if (childrenContainer.children.length === 0 && debugHoverState) {
      const varRef = parseInt(treeItem.getAttribute("data-var-ref") || "0", 10);
      const depth = parseInt(treeItem.getAttribute("data-depth") || "0", 10);

      if (varRef > 0) {
        childrenContainer.innerHTML = `<li class="debug-hover-loading"><div class="debug-hover-loading-spinner"></div>Loading...</li>`;

        try {
          const children = await debugHoverState.expandVariable(varRef);

          if (children.length === 0) {
            childrenContainer.innerHTML = `<li class="debug-hover-empty">No properties</li>`;
          } else {
            childrenContainer.innerHTML = children
              .map((child) =>
                createDebugTreeNodeHtml(
                  child.name,
                  child.value,
                  child.type,
                  child.variablesReference,
                  depth + 1,
                ),
              )
              .join("");
          }
        } catch (err) {
          childrenContainer.innerHTML = `<li class="debug-hover-error">Failed to load properties</li>`;
          console.error("Failed to expand variable:", err);
        }
      }
    }
  }
}

async function handleDebugHoverClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement;

  const actionButton = target.closest("[data-action]") as HTMLElement;
  if (!actionButton) return;

  const action = actionButton.getAttribute("data-action");
  const container = target.closest(".debug-hover-container") as HTMLElement;

  if (!container) return;

  switch (action) {
    case "copy": {
      const value = container.getAttribute("data-value") || "";
      await copyDebugValueToClipboard(value);
      break;
    }

    case "watch": {
      const expression = container.getAttribute("data-expression") || "";
      if (debugHoverState && expression) {
        debugHoverState.addWatchExpression(expression);
        showDebugHoverToast(`Added "${expression}" to watch`);
      }
      break;
    }

    case "toggle": {
      await handleDebugTreeToggle(actionButton);
      break;
    }
  }
}

export function registerDebugHoverProvider(monaco: typeof Monaco): void {
  if (debugHoverProviderDisposable) {
    debugHoverProviderDisposable?.dispose?.();
    debugHoverProviderDisposable = null;
  }

  debugHoverProviderDisposable = monaco.languages.registerHoverProvider("*", {
    provideHover: async (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken,
    ): Promise<Monaco.languages.Hover | null> => {
      if (
        !debugHoverState ||
        !debugHoverState.isPaused ||
        !debugHoverState.activeSessionId
      ) {
        return null;
      }

      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo || wordInfo.word.length < 1) {
        return null;
      }

      const expression = extractDebugExpression(model, position, wordInfo);

      try {
        const result = await debugHoverState.evaluate(expression, "hover");

        const hoverHtml = buildDebugHoverHtml(
          expression,
          result.result,
          result.type,
          result.variablesReference,
        );

        return {
          range: new monaco.Range(
            position.lineNumber,
            wordInfo.startColumn,
            position.lineNumber,
            wordInfo.endColumn,
          ),
          contents: [
            {
              value: hoverHtml,
              supportHtml: true,
              isTrusted: true,
            } as Monaco.IMarkdownString,
          ],
        };
      } catch {
        return null;
      }
    },
  });

  document.addEventListener("click", handleDebugHoverClick);
}

export function disposeDebugHoverProvider(): void {
  if (debugHoverProviderDisposable) {
    debugHoverProviderDisposable?.dispose?.();
    debugHoverProviderDisposable = null;
  }
  document.removeEventListener("click", handleDebugHoverClick);
}

export function updateDebugHoverState(state: DebugHoverState | null): void {
  debugHoverState = state;
}

// ============================================================================
// Linked Editing Range Provider
// ============================================================================

function getTagAtPosition(
  lineContent: string,
  column: number,
): {
  tagName: string;
  isClosingTag: boolean;
  isSelfClosing: boolean;
  startColumn: number;
  endColumn: number;
} | null {
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9.-]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(lineContent)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const isClosingTag = fullMatch.startsWith("</");
    const tagNameStart = match.index + (isClosingTag ? 2 : 1) + 1;
    const tagNameEnd = tagNameStart + tagName.length;

    if (column >= tagNameStart && column <= tagNameEnd) {
      const restOfLine = lineContent.substring(match.index);
      const selfClosingPattern = new RegExp(`<${tagName}[^>]*/>`);
      const isSelfClosing =
        !isClosingTag && selfClosingPattern.test(restOfLine);

      return {
        tagName,
        isClosingTag,
        isSelfClosing,
        startColumn: tagNameStart,
        endColumn: tagNameEnd,
      };
    }
  }

  return null;
}

function findOpeningTag(
  lines: string[],
  fromLine: number,
  fromColumn: number,
  tagName: string,
  monaco: typeof Monaco,
): Monaco.Range | null {
  let depth = 1;
  const closingTagPattern = new RegExp(`</${tagName}(?:\\s|>|$)`, "gi");
  const openingTagPattern = new RegExp(`<${tagName}(?:\\s|>|/|$)`, "gi");
  const selfClosingPattern = new RegExp(`<${tagName}[^>]*/\\s*>`, "gi");

  for (let line = fromLine; line >= 0; line--) {
    const lineContent =
      line === fromLine ? lines[line].substring(0, fromColumn) : lines[line];

    closingTagPattern.lastIndex = 0;
    while (closingTagPattern.exec(lineContent) !== null) {
      depth++;
    }

    let openMatch: RegExpExecArray | null;
    const openMatches: Array<{ index: number; length: number }> = [];
    openingTagPattern.lastIndex = 0;
    while ((openMatch = openingTagPattern.exec(lineContent)) !== null) {
      const restOfLine = lines[line].substring(openMatch.index);
      selfClosingPattern.lastIndex = 0;
      const isSelfClosing = selfClosingPattern.test(
        restOfLine.split(">")[0] + ">",
      );

      if (!isSelfClosing) {
        openMatches.push({ index: openMatch.index, length: tagName.length });
      }
    }

    for (let i = openMatches.length - 1; i >= 0; i--) {
      depth--;
      if (depth === 0) {
        const startColumn = openMatches[i].index + 2;
        const endColumn = startColumn + tagName.length;
        return new monaco.Range(line + 1, startColumn, line + 1, endColumn);
      }
    }
  }

  return null;
}

function findClosingTag(
  lines: string[],
  fromLine: number,
  fromColumn: number,
  tagName: string,
  monaco: typeof Monaco,
): Monaco.Range | null {
  let depth = 1;
  const closingTagPattern = new RegExp(`</${tagName}(?:\\s|>|$)`, "gi");
  const openingTagPattern = new RegExp(`<${tagName}(?:\\s|>|/|$)`, "gi");
  const selfClosingPattern = new RegExp(`<${tagName}[^>]*/\\s*>`, "gi");

  for (let line = fromLine; line < lines.length; line++) {
    const lineContent =
      line === fromLine ? lines[line].substring(fromColumn) : lines[line];
    const columnOffset = line === fromLine ? fromColumn : 0;

    let openMatch: RegExpExecArray | null;
    openingTagPattern.lastIndex = 0;
    while ((openMatch = openingTagPattern.exec(lineContent)) !== null) {
      const restOfLine = lineContent.substring(openMatch.index);
      selfClosingPattern.lastIndex = 0;
      const isSelfClosing = selfClosingPattern.test(
        restOfLine.split(">")[0] + ">",
      );

      if (!isSelfClosing) {
        depth++;
      }
    }

    let closeMatch: RegExpExecArray | null;
    const closeMatches: Array<{ index: number; length: number }> = [];
    closingTagPattern.lastIndex = 0;
    while ((closeMatch = closingTagPattern.exec(lineContent)) !== null) {
      closeMatches.push({ index: closeMatch.index, length: tagName.length });
    }

    for (let i = 0; i < closeMatches.length; i++) {
      depth--;
      if (depth === 0) {
        const startColumn = columnOffset + closeMatches[i].index + 3;
        const endColumn = startColumn + tagName.length;
        return new monaco.Range(line + 1, startColumn, line + 1, endColumn);
      }
    }
  }

  return null;
}

function findMatchingTag(
  content: string,
  _model: Monaco.editor.ITextModel,
  lineNumber: number,
  startColumn: number,
  endColumn: number,
  tagName: string,
  isClosingTag: boolean,
  monaco: typeof Monaco,
): Monaco.Range | null {
  const lines = content.split("\n");

  if (isClosingTag) {
    return findOpeningTag(
      lines,
      lineNumber - 1,
      startColumn - 1,
      tagName,
      monaco,
    );
  } else {
    return findClosingTag(
      lines,
      lineNumber - 1,
      endColumn - 1,
      tagName,
      monaco,
    );
  }
}

function findLinkedEditingRanges(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  monaco: typeof Monaco,
): Monaco.languages.LinkedEditingRanges | null {
  if (!linkedEditingEnabled) return null;

  const lineContent = model.getLineContent(position.lineNumber);
  const column = position.column;

  const tagInfo = getTagAtPosition(lineContent, column);
  if (!tagInfo) return null;

  const { tagName, isClosingTag, startColumn, endColumn } = tagInfo;

  if (tagInfo.isSelfClosing) return null;

  const content = model.getValue();

  const matchingRange = findMatchingTag(
    content,
    model,
    position.lineNumber,
    startColumn,
    endColumn,
    tagName,
    isClosingTag,
    monaco,
  );

  if (!matchingRange) return null;

  const currentRange = new monaco.Range(
    position.lineNumber,
    startColumn,
    position.lineNumber,
    endColumn,
  );

  return {
    ranges: [currentRange, matchingRange],
    wordPattern: /[a-zA-Z][a-zA-Z0-9-]*/,
  };
}

export function registerLinkedEditingProviders(monaco: typeof Monaco): void {
  linkedEditingProviderDisposables.forEach((d) => d?.dispose?.());
  linkedEditingProviderDisposables = [];

  const supportedLanguages = [
    "html",
    "xml",
    "xhtml",
    "javascriptreact",
    "typescriptreact",
    "vue",
    "svelte",
    "php",
    "handlebars",
    "razor",
  ];

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerLinkedEditingRangeProvider(
      language,
      {
        provideLinkedEditingRanges: (
          model: Monaco.editor.ITextModel,
          position: Monaco.Position,
          _token: Monaco.CancellationToken,
        ): Monaco.languages.ProviderResult<Monaco.languages.LinkedEditingRanges> => {
          return findLinkedEditingRanges(model, position, monaco);
        },
      },
    );

    linkedEditingProviderDisposables.push(disposable);
  }
}

export function updateLinkedEditingEnabled(enabled: boolean): void {
  linkedEditingEnabled = enabled;
}

export { findLinkedEditingRanges, getTagAtPosition, findMatchingTag };

// ============================================================================
// Unicode Hover and CodeAction Providers
// ============================================================================

export function registerUnicodeHoverProvider(monaco: typeof Monaco): void {
  if (unicodeHoverProviderDisposable) {
    unicodeHoverProviderDisposable?.dispose?.();
    unicodeHoverProviderDisposable = null;
  }

  unicodeHoverProviderDisposable = monaco.languages.registerHoverProvider("*", {
    provideHover: (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken,
    ): Monaco.languages.Hover | null => {
      if (!unicodeHighlightSettings.enabled) return null;

      const lineContent = model.getLineContent(position.lineNumber);
      const column = position.column - 1;

      if (column < 0 || column >= lineContent.length) return null;

      const char = lineContent[column];

      if (!shouldHighlightCharacter(char, unicodeHighlightSettings))
        return null;

      const info = getUnicodeCharacterInfo(char);

      let markdown = `**Unicode Character Detected**\n\n`;
      markdown += `- **Code Point:** \`${info.codePoint}\`\n`;
      markdown += `- **Category:** ${formatUnicodeCategory(info.category)}\n`;
      markdown += `- **Name:** ${info.name}\n`;

      if (info.replacement !== undefined) {
        markdown += `- **ASCII Equivalent:** \`${info.replacement || "(empty)"}\`\n`;
      }

      return {
        range: new monaco.Range(
          position.lineNumber,
          column + 1,
          position.lineNumber,
          column + 2,
        ),
        contents: [{ value: markdown }],
      };
    },
  });
}

export function registerUnicodeCodeActionProvider(monaco: typeof Monaco): void {
  if (unicodeCodeActionProviderDisposable) {
    unicodeCodeActionProviderDisposable?.dispose?.();
    unicodeCodeActionProviderDisposable = null;
  }

  unicodeCodeActionProviderDisposable =
    monaco.languages.registerCodeActionProvider("*", {
      provideCodeActions: (
        model: Monaco.editor.ITextModel,
        range: Monaco.Range,
        _context: Monaco.languages.CodeActionContext,
        _token: Monaco.CancellationToken,
      ): Monaco.languages.CodeActionList | null => {
        if (!unicodeHighlightSettings.enabled) return null;

        const lineContent = model.getLineContent(range.startLineNumber);
        const actions: Monaco.languages.CodeAction[] = [];

        for (
          let col = range.startColumn - 1;
          col < range.endColumn - 1 && col < lineContent.length;
          col++
        ) {
          const char = lineContent[col];

          if (shouldHighlightCharacter(char, unicodeHighlightSettings)) {
            const info = getUnicodeCharacterInfo(char);

            if (info.replacement !== undefined) {
              actions.push({
                title: `Replace ${info.codePoint} with ASCII equivalent`,
                kind: "quickfix",
                edit: {
                  edits: [
                    {
                      resource: model.uri,
                      textEdit: {
                        range: new monaco.Range(
                          range.startLineNumber,
                          col + 1,
                          range.startLineNumber,
                          col + 2,
                        ),
                        text: info.replacement,
                      },
                      versionId: model.getVersionId(),
                    },
                  ],
                },
                isPreferred: true,
              });
            }
          }
        }

        if (actions.length === 0) return null;

        return { actions, dispose: () => {} };
      },
    });
}

export function updateUnicodeHighlightSettings(
  settings: Partial<UnicodeHighlightSettings>,
): void {
  unicodeHighlightSettings = { ...unicodeHighlightSettings, ...settings };
}

export function getInlayHintSettings(): InlayHintSettings {
  return { ...inlayHintSettings };
}

export function getFormatOnTypeSettings(): FormatOnTypeSettings {
  return { ...formatOnTypeSettings };
}

export function getUnicodeHighlightSettings(): UnicodeHighlightSettings {
  return { ...unicodeHighlightSettings };
}

// ============================================================================
// Cleanup
// ============================================================================

export function disposeAllProviders(): void {
  inlayHintsProviderDisposable?.dispose?.();
  inlayHintsProviderDisposable = null;

  onTypeFormattingProviderDisposable?.dispose?.();
  onTypeFormattingProviderDisposable = null;

  codeLensProviderDisposables.forEach((d) => d?.dispose?.());
  codeLensProviderDisposables = [];

  semanticTokensProviderDisposables.forEach((d) => d?.dispose?.());
  semanticTokensProviderDisposables = [];

  disposeDebugHoverProvider();

  linkedEditingProviderDisposables.forEach((d) => d?.dispose?.());
  linkedEditingProviderDisposables = [];

  unicodeHoverProviderDisposable?.dispose?.();
  unicodeHoverProviderDisposable = null;

  unicodeCodeActionProviderDisposable?.dispose?.();
  unicodeCodeActionProviderDisposable = null;
}

export function registerAllProviders(monaco: typeof Monaco): void {
  registerInlayHintsProvider(monaco);
  registerOnTypeFormattingProvider(monaco);
  registerCodeLensProvider(monaco);
  registerSemanticTokensProvider(monaco);
  registerDebugHoverProvider(monaco);
  registerLinkedEditingProviders(monaco);
  registerUnicodeHoverProvider(monaco);
  registerUnicodeCodeActionProvider(monaco);
}
