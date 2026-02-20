/**
 * useLinkedEditing Hook
 *
 * Extracted from CodeEditor.tsx - manages linked editing for HTML/JSX/XML tags.
 * Enables synchronized editing of opening and closing tags.
 */

import type * as Monaco from "monaco-editor";

export interface LinkedEditingSettings {
  enabled: boolean;
}

const DEFAULT_LINKED_EDITING_SETTINGS: LinkedEditingSettings = {
  enabled: true,
};

const SUPPORTED_LANGUAGES = [
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

interface TagInfo {
  tagName: string;
  isClosingTag: boolean;
  isSelfClosing: boolean;
  startColumn: number;
  endColumn: number;
}

function getTagAtPosition(lineContent: string, column: number): TagInfo | null {
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
      const isSelfClosing = !isClosingTag && selfClosingPattern.test(restOfLine);

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
  monaco: typeof Monaco
): Monaco.Range | null {
  let depth = 1;
  const closingTagPattern = new RegExp(`</${tagName}(?:\\s|>|$)`, "gi");
  const openingTagPattern = new RegExp(`<${tagName}(?:\\s|>|/|$)`, "gi");
  const selfClosingPattern = new RegExp(`<${tagName}[^>]*/\\s*>`, "gi");

  for (let line = fromLine; line >= 0; line--) {
    const lineContent = line === fromLine ? lines[line].substring(0, fromColumn) : lines[line];

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
      const isSelfClosing = selfClosingPattern.test(restOfLine.split(">")[0] + ">");

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
  monaco: typeof Monaco
): Monaco.Range | null {
  let depth = 1;
  const closingTagPattern = new RegExp(`</${tagName}(?:\\s|>|$)`, "gi");
  const openingTagPattern = new RegExp(`<${tagName}(?:\\s|>|/|$)`, "gi");
  const selfClosingPattern = new RegExp(`<${tagName}[^>]*/\\s*>`, "gi");

  for (let line = fromLine; line < lines.length; line++) {
    const lineContent = line === fromLine ? lines[line].substring(fromColumn) : lines[line];
    const columnOffset = line === fromLine ? fromColumn : 0;

    let openMatch: RegExpExecArray | null;
    openingTagPattern.lastIndex = 0;
    while ((openMatch = openingTagPattern.exec(lineContent)) !== null) {
      const restOfLine = lineContent.substring(openMatch.index);
      selfClosingPattern.lastIndex = 0;
      const isSelfClosing = selfClosingPattern.test(restOfLine.split(">")[0] + ">");

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

function findLinkedEditingRanges(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  monaco: typeof Monaco,
  enabled: boolean
): Monaco.languages.LinkedEditingRanges | null {
  if (!enabled) return null;

  const lineContent = model.getLineContent(position.lineNumber);
  const column = position.column;

  const tagInfo = getTagAtPosition(lineContent, column);
  if (!tagInfo) return null;

  const { tagName, isClosingTag, isSelfClosing, startColumn, endColumn } = tagInfo;

  if (isSelfClosing) return null;

  const content = model.getValue();
  const lines = content.split("\n");

  let matchingRange: Monaco.Range | null;
  if (isClosingTag) {
    matchingRange = findOpeningTag(lines, position.lineNumber - 1, startColumn - 1, tagName, monaco);
  } else {
    matchingRange = findClosingTag(lines, position.lineNumber - 1, endColumn - 1, tagName, monaco);
  }

  if (!matchingRange) return null;

  const currentRange = new monaco.Range(position.lineNumber, startColumn, position.lineNumber, endColumn);

  return {
    ranges: [currentRange, matchingRange],
    wordPattern: /[a-zA-Z][a-zA-Z0-9-]*/,
  };
}

export interface LinkedEditingManager {
  dispose: () => void;
  updateSettings: (settings: Partial<LinkedEditingSettings>) => void;
  getSettings: () => LinkedEditingSettings;
  setupVisualIndicators: (editor: Monaco.editor.IStandaloneCodeEditor) => Monaco.IDisposable;
}

export function createLinkedEditingManager(
  monaco: typeof Monaco,
  initialSettings?: Partial<LinkedEditingSettings>
): LinkedEditingManager {
  let settings: LinkedEditingSettings = { ...DEFAULT_LINKED_EDITING_SETTINGS, ...initialSettings };
  const disposables: Monaco.IDisposable[] = [];

  function registerProviders(): void {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    for (const language of SUPPORTED_LANGUAGES) {
      const disposable = monaco.languages.registerLinkedEditingRangeProvider(language, {
        provideLinkedEditingRanges: (
          model: Monaco.editor.ITextModel,
          position: Monaco.Position,
          _token: Monaco.CancellationToken
        ): Monaco.languages.ProviderResult<Monaco.languages.LinkedEditingRanges> => {
          return findLinkedEditingRanges(model, position, monaco, settings.enabled);
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
    updateSettings: (newSettings: Partial<LinkedEditingSettings>) => {
      settings = { ...settings, ...newSettings };
    },
    getSettings: () => ({ ...settings }),
    setupVisualIndicators: (editor: Monaco.editor.IStandaloneCodeEditor): Monaco.IDisposable => {
      let linkedEditDecorations: string[] = [];
      let decorationUpdateTimer: number | null = null;

      const updateDecorations = () => {
        if (!settings.enabled) {
          linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
          return;
        }

        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) {
          linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
          return;
        }

        const linkedRanges = findLinkedEditingRanges(model, position, monaco, settings.enabled);
        if (!linkedRanges || linkedRanges.ranges.length < 2) {
          linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
          return;
        }

        const newDecorations = linkedRanges.ranges.map((range, index) => ({
          range,
          options: {
            className: "linked-editing-range",
            borderColor: "var(--cortex-info)",
            inlineClassName: index === 0 ? "linked-editing-current" : "linked-editing-matched",
            overviewRuler: {
              color: "var(--cortex-info)80",
              position: monaco.editor.OverviewRulerLane.Center,
            },
          },
        }));

        linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, newDecorations);
      };

      const cursorDisposable = editor.onDidChangeCursorPosition(() => {
        if (decorationUpdateTimer !== null) {
          window.clearTimeout(decorationUpdateTimer);
        }
        decorationUpdateTimer = window.setTimeout(() => {
          updateDecorations();
          decorationUpdateTimer = null;
        }, 50) as unknown as number;
      });

      const blurDisposable = editor.onDidBlurEditorWidget(() => {
        linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
      });

      return {
        dispose: () => {
          if (decorationUpdateTimer !== null) {
            window.clearTimeout(decorationUpdateTimer);
          }
          cursorDisposable.dispose();
          blurDisposable.dispose();
          linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
        },
      };
    },
  };
}

export function getLinkedEditingEditorOptions(
  settings: LinkedEditingSettings
): Monaco.editor.IEditorOptions {
  return {
    linkedEditing: settings.enabled,
  };
}

export { getTagAtPosition, findOpeningTag, findClosingTag };
