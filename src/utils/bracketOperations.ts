/**
 * Bracket Operations for Monaco Editor
 * Provides utilities for bracket matching, navigation, and selection
 */

import * as monaco from 'monaco-editor';

// Supported bracket pairs
export const BRACKET_PAIRS: ReadonlyArray<[string, string]> = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
  ['<', '>'],
];

export const QUOTE_PAIRS: ReadonlyArray<[string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ['`', '`'],
];

export const ALL_PAIRS: ReadonlyArray<[string, string]> = [
  ...BRACKET_PAIRS,
  ...QUOTE_PAIRS,
];

export interface BracketPosition {
  position: monaco.Position;
  character: string;
  type: 'open' | 'close';
  pairIndex: number;
}

export interface BracketPair {
  open: BracketPosition;
  close: BracketPosition;
  pairType: [string, string];
}

export interface BracketMatch {
  position: monaco.Position;
  matchingPosition: monaco.Position | null;
  bracket: string;
  matchingBracket: string | null;
}

type Direction = 'forward' | 'backward';

/**
 * Get the opening brackets map
 */
function getOpeningBrackets(pairs: ReadonlyArray<[string, string]> = ALL_PAIRS): Map<string, string> {
  const map = new Map<string, string>();
  pairs.forEach(([open, close]) => map.set(open, close));
  return map;
}

/**
 * Get the closing brackets map
 */
function getClosingBrackets(pairs: ReadonlyArray<[string, string]> = ALL_PAIRS): Map<string, string> {
  const map = new Map<string, string>();
  pairs.forEach(([open, close]) => map.set(close, open));
  return map;
}

/**
 * Check if a character is an opening bracket
 */
export function isOpeningBracket(char: string, pairs: ReadonlyArray<[string, string]> = ALL_PAIRS): boolean {
  return getOpeningBrackets(pairs).has(char);
}

/**
 * Check if a character is a closing bracket
 */
export function isClosingBracket(char: string, pairs: ReadonlyArray<[string, string]> = ALL_PAIRS): boolean {
  return getClosingBrackets(pairs).has(char);
}

/**
 * Check if a character is any bracket
 */
export function isBracket(char: string, pairs: ReadonlyArray<[string, string]> = ALL_PAIRS): boolean {
  return isOpeningBracket(char, pairs) || isClosingBracket(char, pairs);
}

/**
 * Check if a character is a quote
 */
export function isQuote(char: string): boolean {
  return QUOTE_PAIRS.some(([open]) => open === char);
}

/**
 * Get the matching bracket for a given bracket character
 */
export function getMatchingBracket(char: string, pairs: ReadonlyArray<[string, string]> = ALL_PAIRS): string | null {
  const openingBrackets = getOpeningBrackets(pairs);
  const closingBrackets = getClosingBrackets(pairs);
  
  if (openingBrackets.has(char)) {
    return openingBrackets.get(char) || null;
  }
  if (closingBrackets.has(char)) {
    return closingBrackets.get(char) || null;
  }
  return null;
}

/**
 * Get character at a specific position in the model
 */
export function getCharacterAtPosition(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): string {
  const lineContent = model.getLineContent(position.lineNumber);
  if (position.column <= 0 || position.column > lineContent.length) {
    return '';
  }
  return lineContent.charAt(position.column - 1);
}

/**
 * Find matching bracket position from a given position
 */
export function findMatchingBracket(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): monaco.Position | null {
  const char = getCharacterAtPosition(model, position);
  
  if (!isBracket(char, pairs)) {
    return null;
  }
  
  const isOpening = isOpeningBracket(char, pairs);
  const matchingChar = getMatchingBracket(char, pairs);
  
  if (!matchingChar) {
    return null;
  }
  
  const direction: Direction = isOpening ? 'forward' : 'backward';
  
  return findBracketInDirection(model, position, char, matchingChar, direction, pairs);
}

/**
 * Find a bracket in a specific direction, handling nesting
 */
function findBracketInDirection(
  model: monaco.editor.ITextModel,
  startPosition: monaco.Position,
  bracket: string,
  matchingBracket: string,
  direction: Direction,
  _pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): monaco.Position | null {
  const lineCount = model.getLineCount();
  let depth = 1;
  let lineNumber = startPosition.lineNumber;
  let column = startPosition.column;
  
  // Handle quotes specially (they don't nest)
  const isQuotePair = isQuote(bracket);
  
  while (lineNumber >= 1 && lineNumber <= lineCount) {
    const lineContent = model.getLineContent(lineNumber);
    
    // Adjust starting column based on direction
    if (direction === 'forward') {
      column = lineNumber === startPosition.lineNumber ? column + 1 : 1;
      
      while (column <= lineContent.length) {
        const char = lineContent.charAt(column - 1);
        
        if (isQuotePair) {
          // For quotes, just find the next occurrence
          if (char === matchingBracket && !isEscaped(lineContent, column - 1)) {
            return new monaco.Position(lineNumber, column);
          }
        } else {
          if (char === bracket && !isInString(model, new monaco.Position(lineNumber, column))) {
            depth++;
          } else if (char === matchingBracket && !isInString(model, new monaco.Position(lineNumber, column))) {
            depth--;
            if (depth === 0) {
              return new monaco.Position(lineNumber, column);
            }
          }
        }
        column++;
      }
      lineNumber++;
    } else {
      column = lineNumber === startPosition.lineNumber ? column - 1 : lineContent.length;
      
      while (column >= 1) {
        const char = lineContent.charAt(column - 1);
        
        if (isQuotePair) {
          // For quotes, just find the previous occurrence
          if (char === matchingBracket && !isEscaped(lineContent, column - 1)) {
            return new monaco.Position(lineNumber, column);
          }
        } else {
          if (char === bracket && !isInString(model, new monaco.Position(lineNumber, column))) {
            depth++;
          } else if (char === matchingBracket && !isInString(model, new monaco.Position(lineNumber, column))) {
            depth--;
            if (depth === 0) {
              return new monaco.Position(lineNumber, column);
            }
          }
        }
        column--;
      }
      lineNumber--;
    }
  }
  
  return null;
}

/**
 * Check if a character at index is escaped (preceded by backslash)
 */
function isEscaped(lineContent: string, index: number): boolean {
  let backslashCount = 0;
  let i = index - 1;
  
  while (i >= 0 && lineContent.charAt(i) === '\\') {
    backslashCount++;
    i--;
  }
  
  return backslashCount % 2 === 1;
}

/**
 * Simple heuristic to check if position might be inside a string
 * Note: This is a simplified check; for accurate results, use Monaco's tokenization
 */
function isInString(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): boolean {
  const lineContent = model.getLineContent(position.lineNumber);
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < position.column - 1; i++) {
    const char = lineContent.charAt(i);
    
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      if (!isEscaped(lineContent, i)) {
        inString = true;
        stringChar = char;
      }
    } else if (inString && char === stringChar) {
      if (!isEscaped(lineContent, i)) {
        inString = false;
        stringChar = '';
      }
    }
  }
  
  return inString;
}

/**
 * Jump to the matching bracket from current cursor position
 */
export function jumpToMatchingBracket(
  editor: monaco.editor.IStandaloneCodeEditor
): monaco.Position | null {
  const model = editor.getModel();
  const position = editor.getPosition();
  
  if (!model || !position) {
    return null;
  }
  
  // Check character at current position
  let matchingPosition = findMatchingBracket(model, position);
  
  // If no match, check character before cursor
  if (!matchingPosition && position.column > 1) {
    const prevPosition = new monaco.Position(position.lineNumber, position.column - 1);
    matchingPosition = findMatchingBracket(model, prevPosition);
  }
  
  if (matchingPosition) {
    editor.setPosition(matchingPosition);
    editor.revealPositionInCenter(matchingPosition);
    return matchingPosition;
  }
  
  return null;
}

/**
 * Select from current position to matching bracket
 */
export function selectToBracket(
  editor: monaco.editor.IStandaloneCodeEditor,
  includesBrackets: boolean = true
): monaco.Selection | null {
  const model = editor.getModel();
  const position = editor.getPosition();
  
  if (!model || !position) {
    return null;
  }
  
  // Find bracket at or near current position
  let bracketPosition = position;
  let char = getCharacterAtPosition(model, position);
  
  if (!isBracket(char, BRACKET_PAIRS)) {
    if (position.column > 1) {
      bracketPosition = new monaco.Position(position.lineNumber, position.column - 1);
      char = getCharacterAtPosition(model, bracketPosition);
    }
  }
  
  if (!isBracket(char, BRACKET_PAIRS)) {
    // Find enclosing brackets
    const enclosing = findEnclosingBrackets(model, position);
    if (enclosing) {
      bracketPosition = enclosing.open.position;
      char = enclosing.open.character;
    } else {
      return null;
    }
  }
  
  const matchingPosition = findMatchingBracket(model, bracketPosition);
  
  if (!matchingPosition) {
    return null;
  }
  
  let startPos: monaco.Position;
  let endPos: monaco.Position;
  
  if (bracketPosition.isBefore(matchingPosition)) {
    startPos = includesBrackets 
      ? bracketPosition 
      : new monaco.Position(bracketPosition.lineNumber, bracketPosition.column + 1);
    endPos = includesBrackets 
      ? new monaco.Position(matchingPosition.lineNumber, matchingPosition.column + 1)
      : matchingPosition;
  } else {
    startPos = includesBrackets 
      ? matchingPosition 
      : new monaco.Position(matchingPosition.lineNumber, matchingPosition.column + 1);
    endPos = includesBrackets 
      ? new monaco.Position(bracketPosition.lineNumber, bracketPosition.column + 1)
      : bracketPosition;
  }
  
  const selection = new monaco.Selection(
    startPos.lineNumber,
    startPos.column,
    endPos.lineNumber,
    endPos.column
  );
  
  editor.setSelection(selection);
  editor.revealRangeInCenter(selection);
  
  return selection;
}

/**
 * Jump to bracket in a specific direction
 */
export function jumpToBracketInDirection(
  editor: monaco.editor.IStandaloneCodeEditor,
  direction: Direction,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): monaco.Position | null {
  const model = editor.getModel();
  const position = editor.getPosition();
  
  if (!model || !position) {
    return null;
  }
  
  const lineCount = model.getLineCount();
  let lineNumber = position.lineNumber;
  let column = position.column;
  
  while (lineNumber >= 1 && lineNumber <= lineCount) {
    const lineContent = model.getLineContent(lineNumber);
    
    if (direction === 'forward') {
      const startCol = lineNumber === position.lineNumber ? column + 1 : 1;
      
      for (let col = startCol; col <= lineContent.length; col++) {
        const char = lineContent.charAt(col - 1);
        if (isBracket(char, pairs)) {
          const newPosition = new monaco.Position(lineNumber, col);
          editor.setPosition(newPosition);
          editor.revealPositionInCenter(newPosition);
          return newPosition;
        }
      }
      lineNumber++;
    } else {
      const startCol = lineNumber === position.lineNumber ? column - 1 : lineContent.length;
      
      for (let col = startCol; col >= 1; col--) {
        const char = lineContent.charAt(col - 1);
        if (isBracket(char, pairs)) {
          const newPosition = new monaco.Position(lineNumber, col);
          editor.setPosition(newPosition);
          editor.revealPositionInCenter(newPosition);
          return newPosition;
        }
      }
      lineNumber--;
    }
  }
  
  return null;
}

/**
 * Find all brackets in the document
 */
export function findAllBrackets(
  model: monaco.editor.ITextModel,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): BracketPosition[] {
  const brackets: BracketPosition[] = [];
  const lineCount = model.getLineCount();
  const openingBrackets = getOpeningBrackets(pairs);
  
  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineContent = model.getLineContent(lineNumber);
    
    for (let column = 1; column <= lineContent.length; column++) {
      const char = lineContent.charAt(column - 1);
      
      if (isBracket(char, pairs)) {
        const pairIndex = pairs.findIndex(
          ([open, close]) => open === char || close === char
        );
        
        brackets.push({
          position: new monaco.Position(lineNumber, column),
          character: char,
          type: openingBrackets.has(char) ? 'open' : 'close',
          pairIndex,
        });
      }
    }
  }
  
  return brackets;
}

/**
 * Find all matched bracket pairs in the document
 */
export function findAllBracketPairs(
  model: monaco.editor.ITextModel,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): BracketPair[] {
  const allBrackets = findAllBrackets(model, pairs);
  const matchedPairs: BracketPair[] = [];
  const openStack: BracketPosition[][] = pairs.map(() => []);
  
  for (const bracket of allBrackets) {
    if (bracket.type === 'open') {
      openStack[bracket.pairIndex].push(bracket);
    } else {
      const stack = openStack[bracket.pairIndex];
      if (stack.length > 0) {
        const openBracket = stack.pop()!;
        matchedPairs.push({
          open: openBracket,
          close: bracket,
          pairType: pairs[bracket.pairIndex],
        });
      }
    }
  }
  
  return matchedPairs;
}

/**
 * Check if a position is inside brackets
 */
export function isPositionInsideBrackets(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): boolean {
  return findEnclosingBrackets(model, position, pairs) !== null;
}

/**
 * Find the enclosing bracket pair for a position
 */
export function findEnclosingBrackets(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): BracketPair | null {
  // Search backwards for opening bracket
  let lineNumber = position.lineNumber;
  let column = position.column - 1;
  
  const openStack: { char: string; position: monaco.Position; pairIndex: number }[] = [];
  const openingBrackets = getOpeningBrackets(pairs);
  const closingBrackets = getClosingBrackets(pairs);
  
  // First, search backwards to find potential opening brackets
  while (lineNumber >= 1) {
    const lineContent = model.getLineContent(lineNumber);
    const startCol = lineNumber === position.lineNumber ? column : lineContent.length;
    
    for (let col = startCol; col >= 1; col--) {
      const char = lineContent.charAt(col - 1);
      const pos = new monaco.Position(lineNumber, col);
      
      if (closingBrackets.has(char)) {
        // Found a closing bracket, add to stack
        const pairIndex = pairs.findIndex(([, close]) => close === char);
        openStack.push({ char, position: pos, pairIndex });
      } else if (openingBrackets.has(char)) {
        const pairIndex = pairs.findIndex(([open]) => open === char);
        
        // Check if there's a matching close in our stack
        const stackIdx = openStack.findIndex(
          (item) => item.pairIndex === pairIndex
        );
        
        if (stackIdx !== -1) {
          // Remove the matching close from stack
          openStack.splice(stackIdx, 1);
        } else {
          // This is our enclosing opening bracket
          const matchingClose = findMatchingBracket(model, pos, pairs);
          
          if (matchingClose && (matchingClose.lineNumber > position.lineNumber || 
        (matchingClose.lineNumber === position.lineNumber && matchingClose.column > position.column))) {
            return {
              open: {
                position: pos,
                character: char,
                type: 'open',
                pairIndex,
              },
              close: {
                position: matchingClose,
                character: pairs[pairIndex][1],
                type: 'close',
                pairIndex,
              },
              pairType: pairs[pairIndex],
            };
          }
        }
      }
    }
    
    lineNumber--;
    column = lineNumber >= 1 ? model.getLineContent(lineNumber).length : 0;
  }
  
  return null;
}

/**
 * Get the bracket pair at a specific position
 */
export function getBracketPairAtPosition(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): BracketPair | null {
  const char = getCharacterAtPosition(model, position);
  
  if (!isBracket(char, pairs)) {
    return null;
  }
  
  const isOpening = isOpeningBracket(char, pairs);
  const matchingPosition = findMatchingBracket(model, position, pairs);
  
  if (!matchingPosition) {
    return null;
  }
  
  const pairIndex = pairs.findIndex(
    ([open, close]) => open === char || close === char
  );
  
  if (isOpening) {
    return {
      open: {
        position,
        character: char,
        type: 'open',
        pairIndex,
      },
      close: {
        position: matchingPosition,
        character: pairs[pairIndex][1],
        type: 'close',
        pairIndex,
      },
      pairType: pairs[pairIndex],
    };
  } else {
    return {
      open: {
        position: matchingPosition,
        character: pairs[pairIndex][0],
        type: 'open',
        pairIndex,
      },
      close: {
        position,
        character: char,
        type: 'close',
        pairIndex,
      },
      pairType: pairs[pairIndex],
    };
  }
}

/**
 * Get all nested bracket levels at a position
 */
export function getNestedBracketLevels(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): BracketPair[] {
  const levels: BracketPair[] = [];
  let currentPosition = position;
  
  while (true) {
    const enclosing = findEnclosingBrackets(model, currentPosition, pairs);
    
    if (!enclosing) {
      break;
    }
    
    levels.push(enclosing);
    
    // Move to just before the opening bracket for next iteration
    if (enclosing.open.position.column > 1) {
      currentPosition = new monaco.Position(
        enclosing.open.position.lineNumber,
        enclosing.open.position.column - 1
      );
    } else if (enclosing.open.position.lineNumber > 1) {
      const prevLineLength = model.getLineContent(enclosing.open.position.lineNumber - 1).length;
      currentPosition = new monaco.Position(
        enclosing.open.position.lineNumber - 1,
        prevLineLength
      );
    } else {
      break;
    }
  }
  
  return levels;
}

/**
 * Highlight matching brackets in the editor
 */
export function highlightMatchingBrackets(
  editor: monaco.editor.IStandaloneCodeEditor,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): monaco.editor.IEditorDecorationsCollection | null {
  const model = editor.getModel();
  const position = editor.getPosition();
  
  if (!model || !position) {
    return null;
  }
  
  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  
  // Check current position and position before cursor
  const positions = [position];
  if (position.column > 1) {
    positions.push(new monaco.Position(position.lineNumber, position.column - 1));
  }
  
  for (const pos of positions) {
    const bracketPair = getBracketPairAtPosition(model, pos, pairs);
    
    if (bracketPair) {
      decorations.push(
        {
          range: new monaco.Range(
            bracketPair.open.position.lineNumber,
            bracketPair.open.position.column,
            bracketPair.open.position.lineNumber,
            bracketPair.open.position.column + 1
          ),
          options: {
            className: 'bracket-match',
            inlineClassName: 'bracket-match-inline',
          },
        },
        {
          range: new monaco.Range(
            bracketPair.close.position.lineNumber,
            bracketPair.close.position.column,
            bracketPair.close.position.lineNumber,
            bracketPair.close.position.column + 1
          ),
          options: {
            className: 'bracket-match',
            inlineClassName: 'bracket-match-inline',
          },
        }
      );
      break;
    }
  }
  
  return editor.createDecorationsCollection(decorations);
}

/**
 * Select content between brackets (excluding brackets)
 */
export function selectInsideBrackets(
  editor: monaco.editor.IStandaloneCodeEditor,
  _pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): monaco.Selection | null {
  return selectToBracket(editor, false);
}

/**
 * Select content including brackets
 */
export function selectAroundBrackets(
  editor: monaco.editor.IStandaloneCodeEditor,
  _pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): monaco.Selection | null {
  return selectToBracket(editor, true);
}

/**
 * Remove brackets while keeping content
 */
export function removeSurroundingBrackets(
  editor: monaco.editor.IStandaloneCodeEditor,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): boolean {
  const model = editor.getModel();
  const position = editor.getPosition();
  
  if (!model || !position) {
    return false;
  }
  
  const enclosing = findEnclosingBrackets(model, position, pairs);
  
  if (!enclosing) {
    return false;
  }
  
  // Create edits to remove both brackets
  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [
    {
      range: new monaco.Range(
        enclosing.close.position.lineNumber,
        enclosing.close.position.column,
        enclosing.close.position.lineNumber,
        enclosing.close.position.column + 1
      ),
      text: '',
    },
    {
      range: new monaco.Range(
        enclosing.open.position.lineNumber,
        enclosing.open.position.column,
        enclosing.open.position.lineNumber,
        enclosing.open.position.column + 1
      ),
      text: '',
    },
  ];
  
  editor.executeEdits('removeSurroundingBrackets', edits);
  return true;
}

/**
 * Wrap selection with brackets
 */
export function wrapWithBrackets(
  editor: monaco.editor.IStandaloneCodeEditor,
  openBracket: string,
  closeBracket: string
): boolean {
  const selection = editor.getSelection();
  
  if (!selection) {
    return false;
  }
  
  const model = editor.getModel();
  
  if (!model) {
    return false;
  }
  
  const selectedText = model.getValueInRange(selection);
  const newText = openBracket + selectedText + closeBracket;
  
  editor.executeEdits('wrapWithBrackets', [
    {
      range: selection,
      text: newText,
    },
  ]);
  
  // Adjust selection to be inside brackets
  const newSelection = new monaco.Selection(
    selection.startLineNumber,
    selection.startColumn + openBracket.length,
    selection.endLineNumber,
    selection.endColumn + openBracket.length
  );
  
  editor.setSelection(newSelection);
  return true;
}

/**
 * Change surrounding brackets to a different type
 */
export function changeSurroundingBrackets(
  editor: monaco.editor.IStandaloneCodeEditor,
  newOpen: string,
  newClose: string,
  pairs: ReadonlyArray<[string, string]> = BRACKET_PAIRS
): boolean {
  const model = editor.getModel();
  const position = editor.getPosition();
  
  if (!model || !position) {
    return false;
  }
  
  const enclosing = findEnclosingBrackets(model, position, pairs);
  
  if (!enclosing) {
    return false;
  }
  
  // Create edits to replace both brackets
  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [
    {
      range: new monaco.Range(
        enclosing.close.position.lineNumber,
        enclosing.close.position.column,
        enclosing.close.position.lineNumber,
        enclosing.close.position.column + 1
      ),
      text: newClose,
    },
    {
      range: new monaco.Range(
        enclosing.open.position.lineNumber,
        enclosing.open.position.column,
        enclosing.open.position.lineNumber,
        enclosing.open.position.column + 1
      ),
      text: newOpen,
    },
  ];
  
  editor.executeEdits('changeSurroundingBrackets', edits);
  return true;
}

/**
 * Register bracket operation commands with Monaco editor
 */
export function registerBracketCommands(
  editor: monaco.editor.IStandaloneCodeEditor
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];
  
  // Jump to matching bracket
  disposables.push(
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backslash,
      () => jumpToMatchingBracket(editor)
    ) as unknown as monaco.IDisposable
  );
  
  // Select to bracket (including brackets)
  disposables.push(
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketLeft,
      () => selectAroundBrackets(editor)
    ) as unknown as monaco.IDisposable
  );
  
  // Select inside brackets
  disposables.push(
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketLeft,
      () => selectInsideBrackets(editor)
    ) as unknown as monaco.IDisposable
  );
  
  return disposables;
}

export default {
  // Constants
  BRACKET_PAIRS,
  QUOTE_PAIRS,
  ALL_PAIRS,
  
  // Utility functions
  isOpeningBracket,
  isClosingBracket,
  isBracket,
  isQuote,
  getMatchingBracket,
  getCharacterAtPosition,
  
  // Navigation
  findMatchingBracket,
  jumpToMatchingBracket,
  jumpToBracketInDirection,
  
  // Selection
  selectToBracket,
  selectInsideBrackets,
  selectAroundBrackets,
  
  // Finding brackets
  findAllBrackets,
  findAllBracketPairs,
  
  // Position checks
  isPositionInsideBrackets,
  findEnclosingBrackets,
  getBracketPairAtPosition,
  getNestedBracketLevels,
  
  // Editing
  removeSurroundingBrackets,
  wrapWithBrackets,
  changeSurroundingBrackets,
  
  // Decorations
  highlightMatchingBrackets,
  
  // Registration
  registerBracketCommands,
};
