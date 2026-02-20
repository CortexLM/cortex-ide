/**
 * Indent Guides Service for Monaco Editor
 *
 * Renders visual indent guide decorations by applying Monaco decorations
 * to show indentation levels. Automatically updates when editor content
 * or model changes.
 */

import * as monaco from "monaco-editor";

const STYLE_ELEMENT_ID = "cortex-indent-guide-styles";

interface IndentGuidesOptions {
  enabled?: boolean;
  tabSize?: number;
}

/**
 * Compute the indentation level for a single line of text.
 * Counts leading tabs as 1 level each, or groups of spaces by tabSize.
 */
function computeIndentLevel(lineContent: string, tabSize: number): number {
  let spaces = 0;
  for (let i = 0; i < lineContent.length; i++) {
    const ch = lineContent.charAt(i);
    if (ch === "\t") {
      spaces += tabSize - (spaces % tabSize);
    } else if (ch === " ") {
      spaces++;
    } else {
      break;
    }
  }
  return Math.floor(spaces / tabSize);
}

/**
 * Determine whether a line is blank (empty or whitespace-only).
 */
function isBlankLine(lineContent: string): boolean {
  return lineContent.trim().length === 0;
}

/**
 * For a blank line, find the effective indent level by looking at the nearest
 * non-blank lines above and below and taking the minimum of their levels.
 * This allows indent guides to continue through blank lines within a block.
 */
function getBlankLineIndentLevel(
  lineNumber: number,
  lineCount: number,
  getLineContent: (line: number) => string,
  tabSize: number,
): number {
  let aboveLevel = 0;
  for (let i = lineNumber - 1; i >= 1; i--) {
    const content = getLineContent(i);
    if (!isBlankLine(content)) {
      aboveLevel = computeIndentLevel(content, tabSize);
      break;
    }
  }

  let belowLevel = 0;
  for (let i = lineNumber + 1; i <= lineCount; i++) {
    const content = getLineContent(i);
    if (!isBlankLine(content)) {
      belowLevel = computeIndentLevel(content, tabSize);
      break;
    }
  }

  return Math.min(aboveLevel, belowLevel);
}

export class IndentGuidesService {
  private decorations: monaco.editor.IEditorDecorationsCollection | null = null;
  private disposables: monaco.IDisposable[] = [];
  private enabled: boolean;
  private tabSize: number;
  private editor: monaco.editor.IStandaloneCodeEditor;

  constructor(
    editor: monaco.editor.IStandaloneCodeEditor,
    options?: IndentGuidesOptions,
  ) {
    this.editor = editor;
    this.enabled = options?.enabled ?? true;
    this.tabSize = options?.tabSize ?? 4;

    this.disposables.push(
      editor.onDidChangeModelContent(() => {
        this.update();
      }),
    );

    this.disposables.push(
      editor.onDidChangeModel(() => {
        this.update();
      }),
    );

    this.update();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.update();
    } else {
      this.clearDecorations();
    }
  }

  setTabSize(tabSize: number): void {
    this.tabSize = tabSize;
    this.update();
  }

  update(): void {
    if (!this.enabled) {
      this.clearDecorations();
      return;
    }

    const model = this.editor.getModel();
    if (!model) {
      this.clearDecorations();
      return;
    }

    const lineCount = model.getLineCount();
    const tabSize = this.tabSize;
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      const lineContent = model.getLineContent(lineNumber);
      let indentLevel: number;

      if (isBlankLine(lineContent)) {
        indentLevel = getBlankLineIndentLevel(
          lineNumber,
          lineCount,
          (line: number) => model.getLineContent(line),
          tabSize,
        );
      } else {
        indentLevel = computeIndentLevel(lineContent, tabSize);
      }

      for (let level = 0; level < indentLevel; level++) {
        const column = level * tabSize + 1;
        newDecorations.push({
          range: new monaco.Range(lineNumber, column, lineNumber, column),
          options: {
            className: "indent-guide",
            stickiness:
              monaco.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    }

    if (this.decorations) {
      this.decorations.set(newDecorations);
    } else {
      this.decorations =
        this.editor.createDecorationsCollection(newDecorations);
    }
  }

  dispose(): void {
    this.clearDecorations();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  private clearDecorations(): void {
    if (this.decorations) {
      this.decorations.clear();
    }
  }
}

/**
 * Inject CSS styles for indent guide decorations into the document head.
 * Safe to call multiple times; the style element is only created once.
 */
export function injectIndentGuideStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = [
    ".indent-guide {",
    "  border-left: 1px solid var(--cortex-border, rgba(255,255,255,0.1));",
    "}",
    ".indent-guide-active {",
    "  border-left: 1px solid var(--cortex-border-active, rgba(255,255,255,0.3));",
    "}",
  ].join("\n");

  document.head.appendChild(style);
}
