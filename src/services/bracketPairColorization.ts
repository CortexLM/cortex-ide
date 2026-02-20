/**
 * Bracket Pair Colorization Service for Monaco Editor
 * Applies color decorations to matched bracket pairs based on nesting depth.
 */

import * as monaco from 'monaco-editor';
import { findAllBrackets, BRACKET_PAIRS, type BracketPosition } from '@/utils/bracketOperations';

const BRACKET_COLORS = [
  '#ffd700', // gold
  '#da70d6', // orchid
  '#179fff', // dodger blue
  '#00fa9a', // medium spring green
  '#ff6347', // tomato
  '#87ceeb', // sky blue
];

const STYLE_ELEMENT_ID = 'cortex-bracket-colorization-styles';

/**
 * Inject CSS classes for bracket colorization into the document head.
 * Safe to call multiple times — only injects once.
 */
export function injectBracketColorStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }

  const rules = BRACKET_COLORS.map(
    (color, i) => `.bracket-color-${i} { color: ${color} !important; }`
  ).join('\n');

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = rules;
  document.head.appendChild(style);
}

/**
 * Service that colorizes matched bracket pairs in a Monaco editor
 * based on their nesting depth, cycling through a fixed color palette.
 */
export class BracketPairColorizationService {
  private decorations: monaco.editor.IEditorDecorationsCollection | null = null;
  private disposables: monaco.IDisposable[] = [];
  private enabled: boolean;
  private readonly editor: monaco.editor.IStandaloneCodeEditor;

  constructor(editor: monaco.editor.IStandaloneCodeEditor, enabled: boolean = true) {
    this.editor = editor;
    this.enabled = enabled;

    this.disposables.push(
      editor.onDidChangeModelContent(() => this.update())
    );
    this.disposables.push(
      editor.onDidChangeModel(() => this.update())
    );

    if (this.enabled) {
      injectBracketColorStyles();
      this.update();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (enabled) {
      injectBracketColorStyles();
      this.update();
    } else {
      this.clearDecorations();
    }
  }

  update(): void {
    if (!this.enabled) {
      return;
    }

    const model = this.editor.getModel();
    if (!model) {
      this.clearDecorations();
      return;
    }

    const allBrackets = findAllBrackets(model, BRACKET_PAIRS);
    const deltaDecorations = this.buildDecorations(allBrackets);

    this.clearDecorations();
    this.decorations = this.editor.createDecorationsCollection(deltaDecorations);
  }

  dispose(): void {
    this.clearDecorations();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  private clearDecorations(): void {
    if (this.decorations) {
      this.decorations.clear();
      this.decorations = null;
    }
  }

  private buildDecorations(
    brackets: BracketPosition[]
  ): monaco.editor.IModelDeltaDecoration[] {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const stack: BracketPosition[] = [];

    for (const bracket of brackets) {
      if (bracket.type === 'open') {
        stack.push(bracket);
        const depth = stack.length - 1;
        const colorIndex = depth % BRACKET_COLORS.length;

        decorations.push({
          range: new monaco.Range(
            bracket.position.lineNumber,
            bracket.position.column,
            bracket.position.lineNumber,
            bracket.position.column + 1
          ),
          options: {
            inlineClassName: `bracket-color-${colorIndex}`,
          },
        });
      } else {
        const topIndex = this.findMatchingOpenIndex(stack, bracket);
        if (topIndex !== -1) {
          const depth = topIndex;
          const colorIndex = depth % BRACKET_COLORS.length;
          stack.splice(topIndex);

          decorations.push({
            range: new monaco.Range(
              bracket.position.lineNumber,
              bracket.position.column,
              bracket.position.lineNumber,
              bracket.position.column + 1
            ),
            options: {
              inlineClassName: `bracket-color-${colorIndex}`,
            },
          });
        }
      }
    }

    return decorations;
  }

  /**
   * Find the index of the most recent matching open bracket on the stack
   * for the given closing bracket. Returns -1 if no match is found.
   */
  private findMatchingOpenIndex(
    stack: BracketPosition[],
    closeBracket: BracketPosition
  ): number {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].pairIndex === closeBracket.pairIndex) {
        return i;
      }
    }
    return -1;
  }
}
