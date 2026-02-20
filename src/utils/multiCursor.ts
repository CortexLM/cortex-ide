/**
 * Multi-Cursor Utilities for Cortex IDE
 * Add cursor, select all occurrences, column selection
 */

import type * as monaco from 'monaco-editor';

// Cursor position
export interface CursorPosition {
  lineNumber: number;
  column: number;
}

// Selection
export interface Selection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  direction?: 'ltr' | 'rtl';
}

// Multi-cursor state
export interface MultiCursorState {
  cursors: CursorPosition[];
  selections: Selection[];
  primaryIndex: number;
}

/**
 * Default word separators for word boundary detection
 */
const DEFAULT_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

/**
 * Create an empty multi-cursor state
 */
export function createEmptyState(): MultiCursorState {
  return {
    cursors: [],
    selections: [],
    primaryIndex: 0,
  };
}

/**
 * Create initial state from a single cursor position
 */
export function createInitialState(position: CursorPosition): MultiCursorState {
  return {
    cursors: [position],
    selections: [
      {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    ],
    primaryIndex: 0,
  };
}

/**
 * Add cursor above current cursor
 */
export function addCursorAbove(
  state: MultiCursorState,
  _lineCount: number
): MultiCursorState {
  if (state.cursors.length === 0) {
    return state;
  }

  const primaryCursor = state.cursors[state.primaryIndex];
  const newLineNumber = primaryCursor.lineNumber - 1;

  if (newLineNumber < 1) {
    return state;
  }

  const newCursor: CursorPosition = {
    lineNumber: newLineNumber,
    column: primaryCursor.column,
  };

  // Check if cursor already exists at this position
  const exists = state.cursors.some(
    (c) => c.lineNumber === newCursor.lineNumber && c.column === newCursor.column
  );

  if (exists) {
    return state;
  }

  const newSelection: Selection = {
    startLineNumber: newLineNumber,
    startColumn: primaryCursor.column,
    endLineNumber: newLineNumber,
    endColumn: primaryCursor.column,
  };

  const newCursors = [...state.cursors, newCursor];
  const newSelections = [...state.selections, newSelection];

  return {
    cursors: sortCursors(newCursors),
    selections: mergeSelections(newSelections),
    primaryIndex: 0, // Primary becomes the topmost cursor
  };
}

/**
 * Add cursor below current cursor
 */
export function addCursorBelow(
  state: MultiCursorState,
  lineCount: number
): MultiCursorState {
  if (state.cursors.length === 0) {
    return state;
  }

  const primaryCursor = state.cursors[state.primaryIndex];
  const newLineNumber = primaryCursor.lineNumber + 1;

  if (newLineNumber > lineCount) {
    return state;
  }

  const newCursor: CursorPosition = {
    lineNumber: newLineNumber,
    column: primaryCursor.column,
  };

  // Check if cursor already exists at this position
  const exists = state.cursors.some(
    (c) => c.lineNumber === newCursor.lineNumber && c.column === newCursor.column
  );

  if (exists) {
    return state;
  }

  const newSelection: Selection = {
    startLineNumber: newLineNumber,
    startColumn: primaryCursor.column,
    endLineNumber: newLineNumber,
    endColumn: primaryCursor.column,
  };

  const newCursors = [...state.cursors, newCursor];
  const newSelections = [...state.selections, newSelection];
  const sortedCursors = sortCursors(newCursors);
  const newPrimaryIndex = sortedCursors.findIndex(
    (c) => c.lineNumber === newCursor.lineNumber && c.column === newCursor.column
  );

  return {
    cursors: sortedCursors,
    selections: mergeSelections(newSelections),
    primaryIndex: newPrimaryIndex,
  };
}

/**
 * Add cursor at position
 */
export function addCursorAt(
  state: MultiCursorState,
  position: CursorPosition
): MultiCursorState {
  // Check if cursor already exists at this position
  const existingIndex = state.cursors.findIndex(
    (c) => c.lineNumber === position.lineNumber && c.column === position.column
  );

  if (existingIndex !== -1) {
    // If clicking on existing cursor, remove it (unless it's the only one)
    if (state.cursors.length > 1) {
      return removeCursor(state, existingIndex);
    }
    return state;
  }

  const newSelection: Selection = {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  };

  const newCursors = [...state.cursors, position];
  const newSelections = [...state.selections, newSelection];
  const sortedCursors = sortCursors(newCursors);
  const newPrimaryIndex = sortedCursors.findIndex(
    (c) => c.lineNumber === position.lineNumber && c.column === position.column
  );

  return {
    cursors: sortedCursors,
    selections: mergeSelections(newSelections),
    primaryIndex: newPrimaryIndex,
  };
}

/**
 * Remove cursor at index
 */
export function removeCursor(
  state: MultiCursorState,
  index: number
): MultiCursorState {
  if (index < 0 || index >= state.cursors.length) {
    return state;
  }

  if (state.cursors.length <= 1) {
    // Cannot remove the last cursor
    return state;
  }

  const newCursors = state.cursors.filter((_, i) => i !== index);
  const newSelections = state.selections.filter((_, i) => i !== index);

  let newPrimaryIndex = state.primaryIndex;
  if (index === state.primaryIndex) {
    // If removing primary, make the next one primary (or previous if at end)
    newPrimaryIndex = Math.min(index, newCursors.length - 1);
  } else if (index < state.primaryIndex) {
    newPrimaryIndex = state.primaryIndex - 1;
  }

  return {
    cursors: newCursors,
    selections: newSelections,
    primaryIndex: newPrimaryIndex,
  };
}

/**
 * Compare two positions
 */
function comparePositions(a: CursorPosition, b: CursorPosition): number {
  if (a.lineNumber !== b.lineNumber) {
    return a.lineNumber - b.lineNumber;
  }
  return a.column - b.column;
}

/**
 * Compare two selections by start position
 */
function compareSelections(a: Selection, b: Selection): number {
  if (a.startLineNumber !== b.startLineNumber) {
    return a.startLineNumber - b.startLineNumber;
  }
  return a.startColumn - b.startColumn;
}

/**
 * Sort cursors by position
 */
export function sortCursors(cursors: CursorPosition[]): CursorPosition[] {
  return [...cursors].sort(comparePositions);
}

/**
 * Check if selections overlap
 */
export function selectionsOverlap(a: Selection, b: Selection): boolean {
  // Selection a ends before b starts
  if (
    a.endLineNumber < b.startLineNumber ||
    (a.endLineNumber === b.startLineNumber && a.endColumn <= b.startColumn)
  ) {
    return false;
  }

  // Selection b ends before a starts
  if (
    b.endLineNumber < a.startLineNumber ||
    (b.endLineNumber === a.startLineNumber && b.endColumn <= a.startColumn)
  ) {
    return false;
  }

  return true;
}

/**
 * Merge overlapping selections
 */
export function mergeSelections(selections: Selection[]): Selection[] {
  if (selections.length <= 1) {
    return selections;
  }

  // Sort selections by start position
  const sorted = [...selections].sort(compareSelections);
  const merged: Selection[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (selectionsOverlap(last, current)) {
      // Merge overlapping selections
      const mergedSelection: Selection = {
        startLineNumber: Math.min(last.startLineNumber, current.startLineNumber),
        startColumn:
          last.startLineNumber < current.startLineNumber
            ? last.startColumn
            : last.startLineNumber > current.startLineNumber
              ? current.startColumn
              : Math.min(last.startColumn, current.startColumn),
        endLineNumber: Math.max(last.endLineNumber, current.endLineNumber),
        endColumn:
          last.endLineNumber > current.endLineNumber
            ? last.endColumn
            : last.endLineNumber < current.endLineNumber
              ? current.endColumn
              : Math.max(last.endColumn, current.endColumn),
      };
      merged[merged.length - 1] = mergedSelection;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Get word at position
 */
export function getWordAtPosition(
  lineText: string,
  column: number,
  wordSeparators: string = DEFAULT_WORD_SEPARATORS
): { word: string; startColumn: number; endColumn: number } | undefined {
  if (column < 1 || column > lineText.length + 1) {
    return undefined;
  }

  const separatorSet = new Set(wordSeparators.split(''));
  separatorSet.add(' ');
  separatorSet.add('\t');

  const isWordChar = (ch: string): boolean => !separatorSet.has(ch);

  // Find word boundaries
  let startColumn = column;
  let endColumn = column;

  // Search backwards for word start
  while (startColumn > 1 && isWordChar(lineText[startColumn - 2])) {
    startColumn--;
  }

  // Search forwards for word end
  while (endColumn <= lineText.length && isWordChar(lineText[endColumn - 1])) {
    endColumn++;
  }

  if (startColumn === endColumn) {
    return undefined;
  }

  const word = lineText.substring(startColumn - 1, endColumn - 1);
  return { word, startColumn, endColumn };
}

/**
 * Get text from selection in document
 */
function getTextFromSelection(lines: string[], selection: Selection): string {
  if (selection.startLineNumber === selection.endLineNumber) {
    const line = lines[selection.startLineNumber - 1] || '';
    return line.substring(selection.startColumn - 1, selection.endColumn - 1);
  }

  const result: string[] = [];
  for (
    let lineNum = selection.startLineNumber;
    lineNum <= selection.endLineNumber;
    lineNum++
  ) {
    const line = lines[lineNum - 1] || '';
    if (lineNum === selection.startLineNumber) {
      result.push(line.substring(selection.startColumn - 1));
    } else if (lineNum === selection.endLineNumber) {
      result.push(line.substring(0, selection.endColumn - 1));
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

/**
 * Check if a position is at a word boundary
 */
function isWordBoundary(
  text: string,
  index: number,
  searchText: string,
  wordSeparators: string = DEFAULT_WORD_SEPARATORS
): boolean {
  const separatorSet = new Set(wordSeparators.split(''));
  separatorSet.add(' ');
  separatorSet.add('\t');
  separatorSet.add('\n');
  separatorSet.add('\r');

  const isWordChar = (ch: string | undefined): boolean =>
    ch !== undefined && !separatorSet.has(ch);

  const beforeChar = index > 0 ? text[index - 1] : undefined;
  const afterChar =
    index + searchText.length < text.length
      ? text[index + searchText.length]
      : undefined;

  const startsAtBoundary = !isWordChar(beforeChar);
  const endsAtBoundary = !isWordChar(afterChar);

  return startsAtBoundary && endsAtBoundary;
}

/**
 * Convert line/column offset to flat index
 */
function positionToIndex(lines: string[], lineNumber: number, column: number): number {
  let index = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    index += lines[i].length + 1; // +1 for newline
  }
  index += column - 1;
  return index;
}

/**
 * Convert flat index to line/column position
 */
function indexToPosition(
  lines: string[],
  index: number
): { lineNumber: number; column: number } {
  let currentIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (currentIndex + lineLength > index) {
      return {
        lineNumber: i + 1,
        column: index - currentIndex + 1,
      };
    }
    currentIndex += lineLength;
  }
  // Past end of document
  return {
    lineNumber: lines.length,
    column: (lines[lines.length - 1]?.length || 0) + 1,
  };
}

/**
 * Find all occurrences of a search string in text
 */
function findAllOccurrences(
  text: string,
  searchText: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): number[] {
  const { caseSensitive = true, wholeWord = false } = options;

  if (!searchText) {
    return [];
  }

  const indices: number[] = [];
  const searchIn = caseSensitive ? text : text.toLowerCase();
  const searchFor = caseSensitive ? searchText : searchText.toLowerCase();

  let startIndex = 0;
  while (startIndex < searchIn.length) {
    const index = searchIn.indexOf(searchFor, startIndex);
    if (index === -1) {
      break;
    }

    if (!wholeWord || isWordBoundary(text, index, searchText)) {
      indices.push(index);
    }
    startIndex = index + 1;
  }

  return indices;
}

/**
 * Select all occurrences of current word/selection
 * (Ctrl+Shift+L equivalent)
 */
export function selectAllOccurrences(
  text: string,
  currentSelection: Selection,
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): Selection[] {
  const lines = text.split('\n');
  let searchText = getTextFromSelection(lines, currentSelection);

  // If selection is empty, get word at cursor
  if (!searchText) {
    const line = lines[currentSelection.startLineNumber - 1] || '';
    const wordInfo = getWordAtPosition(line, currentSelection.startColumn);
    if (!wordInfo) {
      return [currentSelection];
    }
    searchText = wordInfo.word;
    options = { ...options, wholeWord: true };
  }

  const occurrences = findAllOccurrences(text, searchText, options);

  if (occurrences.length === 0) {
    return [currentSelection];
  }

  return occurrences.map((index) => {
    const startPos = indexToPosition(lines, index);
    const endPos = indexToPosition(lines, index + searchText.length);
    return {
      startLineNumber: startPos.lineNumber,
      startColumn: startPos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column,
    };
  });
}

/**
 * Add selection to next find match
 * (Ctrl+D equivalent)
 */
export function addSelectionToNextFindMatch(
  text: string,
  currentSelections: Selection[],
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): Selection[] {
  if (currentSelections.length === 0) {
    return currentSelections;
  }

  const lines = text.split('\n');

  // Get the search text from the first selection
  const firstSelection = currentSelections[0];
  let searchText = getTextFromSelection(lines, firstSelection);

  // If selection is empty, get word at cursor
  if (!searchText) {
    const line = lines[firstSelection.startLineNumber - 1] || '';
    const wordInfo = getWordAtPosition(line, firstSelection.startColumn);
    if (!wordInfo) {
      return currentSelections;
    }
    searchText = wordInfo.word;
    options = { ...options, wholeWord: true };
  }

  // Find all occurrences
  const allOccurrences = findAllOccurrences(text, searchText, options);
  if (allOccurrences.length === 0) {
    return currentSelections;
  }

  // Find the last selection's end position
  const lastSelection = currentSelections[currentSelections.length - 1];
  const lastEndIndex = positionToIndex(
    lines,
    lastSelection.endLineNumber,
    lastSelection.endColumn
  );

  // Find next occurrence after last selection
  let nextIndex = allOccurrences.find((idx) => idx >= lastEndIndex);

  // Wrap around if needed
  if (nextIndex === undefined && allOccurrences.length > 0) {
    nextIndex = allOccurrences[0];
  }

  if (nextIndex === undefined) {
    return currentSelections;
  }

  // Check if this occurrence is already selected
  const startPos = indexToPosition(lines, nextIndex);
  const alreadySelected = currentSelections.some(
    (sel) =>
      sel.startLineNumber === startPos.lineNumber &&
      sel.startColumn === startPos.column
  );

  if (alreadySelected) {
    // Try to find the next one that's not selected
    for (const idx of allOccurrences) {
      const pos = indexToPosition(lines, idx);
      const isSelected = currentSelections.some(
        (sel) =>
          sel.startLineNumber === pos.lineNumber && sel.startColumn === pos.column
      );
      if (!isSelected) {
        nextIndex = idx;
        break;
      }
    }
  }

  const newStartPos = indexToPosition(lines, nextIndex);
  const newEndPos = indexToPosition(lines, nextIndex + searchText.length);

  // Check again if already selected after potentially finding a new one
  const stillAlreadySelected = currentSelections.some(
    (sel) =>
      sel.startLineNumber === newStartPos.lineNumber &&
      sel.startColumn === newStartPos.column
  );

  if (stillAlreadySelected) {
    return currentSelections;
  }

  const newSelection: Selection = {
    startLineNumber: newStartPos.lineNumber,
    startColumn: newStartPos.column,
    endLineNumber: newEndPos.lineNumber,
    endColumn: newEndPos.column,
  };

  return [...currentSelections, newSelection];
}

/**
 * Skip current occurrence and select next
 * (Ctrl+K Ctrl+D equivalent)
 */
export function skipToNextFindMatch(
  text: string,
  currentSelections: Selection[],
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): Selection[] {
  if (currentSelections.length === 0) {
    return currentSelections;
  }

  const lines = text.split('\n');

  // Get the search text from the first selection
  const firstSelection = currentSelections[0];
  let searchText = getTextFromSelection(lines, firstSelection);

  if (!searchText) {
    const line = lines[firstSelection.startLineNumber - 1] || '';
    const wordInfo = getWordAtPosition(line, firstSelection.startColumn);
    if (!wordInfo) {
      return currentSelections;
    }
    searchText = wordInfo.word;
    options = { ...options, wholeWord: true };
  }

  // Find all occurrences
  const allOccurrences = findAllOccurrences(text, searchText, options);
  if (allOccurrences.length === 0) {
    return currentSelections;
  }

  // Get the last selection (the one to skip)
  const lastSelection = currentSelections[currentSelections.length - 1];
  const lastEndIndex = positionToIndex(
    lines,
    lastSelection.endLineNumber,
    lastSelection.endColumn
  );

  // Find next occurrence after current
  let nextIndex = allOccurrences.find((idx) => idx >= lastEndIndex);

  // Wrap around if needed
  if (nextIndex === undefined && allOccurrences.length > 0) {
    nextIndex = allOccurrences[0];
  }

  if (nextIndex === undefined) {
    // No more occurrences, just remove the last selection
    return currentSelections.slice(0, -1);
  }

  // Check if we'd be selecting an already selected occurrence
  const newStartPos = indexToPosition(lines, nextIndex);
  const alreadySelected = currentSelections.some(
    (sel) =>
      sel.startLineNumber === newStartPos.lineNumber &&
      sel.startColumn === newStartPos.column
  );

  if (alreadySelected && currentSelections.length > 1) {
    // Just remove the last selection without adding a new one
    return currentSelections.slice(0, -1);
  }

  const newEndPos = indexToPosition(lines, nextIndex + searchText.length);
  const newSelection: Selection = {
    startLineNumber: newStartPos.lineNumber,
    startColumn: newStartPos.column,
    endLineNumber: newEndPos.lineNumber,
    endColumn: newEndPos.column,
  };

  // Remove last selection, add new one
  return [...currentSelections.slice(0, -1), newSelection];
}

/**
 * Column selection (box selection)
 */
export interface ColumnSelection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Get visual column (accounting for tabs)
 */
export function getVisualColumn(
  lineText: string,
  column: number,
  tabSize: number
): number {
  let visualColumn = 0;
  const maxCol = Math.min(column - 1, lineText.length);

  for (let i = 0; i < maxCol; i++) {
    if (lineText[i] === '\t') {
      // Tab advances to next tab stop
      visualColumn = Math.floor(visualColumn / tabSize) * tabSize + tabSize;
    } else {
      visualColumn++;
    }
  }

  // If column is beyond line length, add the remaining columns
  if (column - 1 > lineText.length) {
    visualColumn += column - 1 - lineText.length;
  }

  return visualColumn;
}

/**
 * Get actual column from visual column
 */
export function getActualColumn(
  lineText: string,
  visualColumn: number,
  tabSize: number
): number {
  let currentVisualCol = 0;
  let actualCol = 0;

  while (actualCol < lineText.length && currentVisualCol < visualColumn) {
    if (lineText[actualCol] === '\t') {
      const nextTabStop = Math.floor(currentVisualCol / tabSize) * tabSize + tabSize;
      if (nextTabStop > visualColumn) {
        // Visual column is within this tab
        break;
      }
      currentVisualCol = nextTabStop;
    } else {
      currentVisualCol++;
    }
    actualCol++;
  }

  // Add remaining visual columns if needed (for virtual space)
  if (currentVisualCol < visualColumn) {
    actualCol += visualColumn - currentVisualCol;
  }

  return actualCol + 1; // Convert to 1-based
}

/**
 * Create column selection from anchor and active positions
 */
export function createColumnSelection(
  anchor: CursorPosition,
  active: CursorPosition,
  lines: string[],
  tabSize: number
): Selection[] {
  const startLine = Math.min(anchor.lineNumber, active.lineNumber);
  const endLine = Math.max(anchor.lineNumber, active.lineNumber);

  // Get visual columns
  const anchorLine = lines[anchor.lineNumber - 1] || '';
  const activeLine = lines[active.lineNumber - 1] || '';
  const anchorVisualCol = getVisualColumn(anchorLine, anchor.column, tabSize);
  const activeVisualCol = getVisualColumn(activeLine, active.column, tabSize);

  const startVisualCol = Math.min(anchorVisualCol, activeVisualCol);
  const endVisualCol = Math.max(anchorVisualCol, activeVisualCol);

  const selections: Selection[] = [];

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineText = lines[lineNum - 1] || '';
    const startCol = getActualColumn(lineText, startVisualCol, tabSize);
    const endCol = getActualColumn(lineText, endVisualCol, tabSize);

    selections.push({
      startLineNumber: lineNum,
      startColumn: startCol,
      endLineNumber: lineNum,
      endColumn: endCol,
      direction: anchor.lineNumber <= active.lineNumber ? 'ltr' : 'rtl',
    });
  }

  return selections;
}

/**
 * Convert column selection to regular selections
 */
export function columnSelectionToSelections(
  columnSelection: ColumnSelection,
  lines: string[],
  tabSize: number
): Selection[] {
  const startLine = Math.min(columnSelection.startLine, columnSelection.endLine);
  const endLine = Math.max(columnSelection.startLine, columnSelection.endLine);
  const startVisualCol = Math.min(columnSelection.startColumn, columnSelection.endColumn);
  const endVisualCol = Math.max(columnSelection.startColumn, columnSelection.endColumn);

  const selections: Selection[] = [];

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineText = lines[lineNum - 1] || '';
    const startCol = getActualColumn(lineText, startVisualCol, tabSize);
    const endCol = getActualColumn(lineText, endVisualCol, tabSize);

    selections.push({
      startLineNumber: lineNum,
      startColumn: startCol,
      endLineNumber: lineNum,
      endColumn: endCol,
    });
  }

  return selections;
}

/**
 * Apply edit to all cursors
 */
export interface MultiCursorEdit {
  text: string;
  range?: Selection; // If undefined, insert at cursor
}

export function applyMultiCursorEdit(
  document: string[],
  state: MultiCursorState,
  edit: MultiCursorEdit
): { newDocument: string[]; newState: MultiCursorState } {
  if (state.cursors.length === 0) {
    return { newDocument: document, newState: state };
  }

  // Sort selections from bottom to top to avoid offset issues
  const indexedSelections = state.selections.map((sel, idx) => ({ sel, idx }));
  indexedSelections.sort((a, b) => {
    if (a.sel.startLineNumber !== b.sel.startLineNumber) {
      return b.sel.startLineNumber - a.sel.startLineNumber;
    }
    return b.sel.startColumn - a.sel.startColumn;
  });

  let newDoc = [...document];
  const newCursors: CursorPosition[] = new Array(state.cursors.length);
  const newSelections: Selection[] = new Array(state.selections.length);

  for (const { sel, idx } of indexedSelections) {
    const range = edit.range
      ? {
          startLineNumber: sel.startLineNumber + (edit.range.startLineNumber - 1),
          startColumn: sel.startColumn + (edit.range.startColumn - 1),
          endLineNumber: sel.startLineNumber + (edit.range.endLineNumber - 1),
          endColumn: sel.startColumn + (edit.range.endColumn - 1),
        }
      : sel;

    // Apply the edit
    const { lines: editedLines, cursor: newCursorPos } = applyEditToLines(
      newDoc,
      range,
      edit.text
    );
    newDoc = editedLines;

    // Update cursor and selection for this edit
    newCursors[idx] = newCursorPos;
    newSelections[idx] = {
      startLineNumber: newCursorPos.lineNumber,
      startColumn: newCursorPos.column,
      endLineNumber: newCursorPos.lineNumber,
      endColumn: newCursorPos.column,
    };
  }

  return {
    newDocument: newDoc,
    newState: {
      cursors: sortCursors(newCursors),
      selections: newSelections.sort(compareSelections),
      primaryIndex: state.primaryIndex,
    },
  };
}

/**
 * Apply a single edit to document lines
 */
function applyEditToLines(
  lines: string[],
  range: Selection,
  text: string
): { lines: string[]; cursor: CursorPosition } {
  const newLines = [...lines];
  const insertLines = text.split('\n');

  // Get the parts to keep
  const startLine = newLines[range.startLineNumber - 1] || '';
  const endLine = newLines[range.endLineNumber - 1] || '';
  const prefix = startLine.substring(0, range.startColumn - 1);
  const suffix = endLine.substring(range.endColumn - 1);

  // Create the new content
  if (insertLines.length === 1) {
    // Single line insert
    const newContent = prefix + insertLines[0] + suffix;
    newLines.splice(
      range.startLineNumber - 1,
      range.endLineNumber - range.startLineNumber + 1,
      newContent
    );
  } else {
    // Multi-line insert
    const firstLine = prefix + insertLines[0];
    const lastLine = insertLines[insertLines.length - 1] + suffix;
    const middleLines = insertLines.slice(1, -1);

    newLines.splice(
      range.startLineNumber - 1,
      range.endLineNumber - range.startLineNumber + 1,
      firstLine,
      ...middleLines,
      lastLine
    );
  }

  // Calculate new cursor position
  const cursorLine =
    range.startLineNumber + insertLines.length - 1;
  const cursorColumn =
    insertLines.length === 1
      ? range.startColumn + text.length
      : insertLines[insertLines.length - 1].length + 1;

  return {
    lines: newLines,
    cursor: { lineNumber: cursorLine, column: cursorColumn },
  };
}

/**
 * Move all cursors
 */
export function moveAllCursors(
  state: MultiCursorState,
  direction: 'left' | 'right' | 'up' | 'down',
  lines: string[],
  options: { wordWise?: boolean; selecting?: boolean } = {}
): MultiCursorState {
  const { wordWise = false, selecting = false } = options;

  const newCursors: CursorPosition[] = [];
  const newSelections: Selection[] = [];

  for (let i = 0; i < state.cursors.length; i++) {
    const cursor = state.cursors[i];
    const selection = state.selections[i];
    const lineText = lines[cursor.lineNumber - 1] || '';

    let newCursor: CursorPosition;

    switch (direction) {
      case 'left':
        if (wordWise) {
          newCursor = moveWordLeft(cursor, lines);
        } else if (cursor.column > 1) {
          newCursor = { lineNumber: cursor.lineNumber, column: cursor.column - 1 };
        } else if (cursor.lineNumber > 1) {
          const prevLine = lines[cursor.lineNumber - 2] || '';
          newCursor = {
            lineNumber: cursor.lineNumber - 1,
            column: prevLine.length + 1,
          };
        } else {
          newCursor = cursor;
        }
        break;

      case 'right':
        if (wordWise) {
          newCursor = moveWordRight(cursor, lines);
        } else if (cursor.column <= lineText.length) {
          newCursor = { lineNumber: cursor.lineNumber, column: cursor.column + 1 };
        } else if (cursor.lineNumber < lines.length) {
          newCursor = { lineNumber: cursor.lineNumber + 1, column: 1 };
        } else {
          newCursor = cursor;
        }
        break;

      case 'up':
        if (cursor.lineNumber > 1) {
          const prevLine = lines[cursor.lineNumber - 2] || '';
          newCursor = {
            lineNumber: cursor.lineNumber - 1,
            column: Math.min(cursor.column, prevLine.length + 1),
          };
        } else {
          newCursor = { lineNumber: 1, column: 1 };
        }
        break;

      case 'down':
        if (cursor.lineNumber < lines.length) {
          const nextLine = lines[cursor.lineNumber] || '';
          newCursor = {
            lineNumber: cursor.lineNumber + 1,
            column: Math.min(cursor.column, nextLine.length + 1),
          };
        } else {
          newCursor = {
            lineNumber: cursor.lineNumber,
            column: lineText.length + 1,
          };
        }
        break;
    }

    newCursors.push(newCursor);

    if (selecting) {
      // Extend selection
      newSelections.push({
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: newCursor.lineNumber,
        endColumn: newCursor.column,
        direction:
          comparePositions(
            { lineNumber: selection.startLineNumber, column: selection.startColumn },
            newCursor
          ) <= 0
            ? 'ltr'
            : 'rtl',
      });
    } else {
      // Collapse selection to cursor
      newSelections.push({
        startLineNumber: newCursor.lineNumber,
        startColumn: newCursor.column,
        endLineNumber: newCursor.lineNumber,
        endColumn: newCursor.column,
      });
    }
  }

  return {
    cursors: newCursors,
    selections: mergeSelections(newSelections),
    primaryIndex: state.primaryIndex,
  };
}

/**
 * Move cursor to the start of the previous word
 */
function moveWordLeft(cursor: CursorPosition, lines: string[]): CursorPosition {
  let { lineNumber, column } = cursor;
  let lineText = lines[lineNumber - 1] || '';

  // Skip whitespace backwards
  while (column > 1 && /\s/.test(lineText[column - 2])) {
    column--;
  }

  // If at beginning of line, move to end of previous line
  if (column === 1 && lineNumber > 1) {
    lineNumber--;
    lineText = lines[lineNumber - 1] || '';
    column = lineText.length + 1;
    // Skip trailing whitespace on previous line
    while (column > 1 && /\s/.test(lineText[column - 2])) {
      column--;
    }
  }

  // Skip word characters backwards
  while (column > 1 && !/\s/.test(lineText[column - 2])) {
    column--;
  }

  return { lineNumber, column };
}

/**
 * Move cursor to the end of the next word
 */
function moveWordRight(cursor: CursorPosition, lines: string[]): CursorPosition {
  let { lineNumber, column } = cursor;
  let lineText = lines[lineNumber - 1] || '';

  // Skip current word
  while (column <= lineText.length && !/\s/.test(lineText[column - 1])) {
    column++;
  }

  // Skip whitespace
  while (column <= lineText.length && /\s/.test(lineText[column - 1])) {
    column++;
  }

  // If at end of line, move to next line
  if (column > lineText.length && lineNumber < lines.length) {
    lineNumber++;
    column = 1;
    lineText = lines[lineNumber - 1] || '';
    // Skip leading whitespace on next line
    while (column <= lineText.length && /\s/.test(lineText[column - 1])) {
      column++;
    }
  }

  return { lineNumber, column };
}

/**
 * Undo last cursor action
 */
export function undoLastCursorAction(
  state: MultiCursorState,
  history: MultiCursorState[]
): { state: MultiCursorState; history: MultiCursorState[] } {
  if (history.length === 0) {
    // If no history, remove last cursor
    if (state.cursors.length > 1) {
      return {
        state: removeCursor(state, state.cursors.length - 1),
        history,
      };
    }
    return { state, history };
  }

  const previousState = history[history.length - 1];
  return {
    state: previousState,
    history: history.slice(0, -1),
  };
}

/**
 * Convert Monaco selections to our format
 */
export function fromMonacoSelections(selections: monaco.Selection[]): Selection[] {
  return selections.map((sel) => ({
    startLineNumber: sel.startLineNumber,
    startColumn: sel.startColumn,
    endLineNumber: sel.endLineNumber,
    endColumn: sel.endColumn,
    direction: sel.getDirection() === 0 ? 'ltr' : 'rtl', // Monaco: 0 = LTR, 1 = RTL
  }));
}

/**
 * Convert to Monaco selections
 * Note: This returns a format compatible with Monaco but actual monaco.Selection
 * instances would need to be created using the Monaco API
 */
export function toMonacoSelections(
  selections: Selection[]
): Array<{
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}> {
  return selections.map((sel) => {
    const isReversed = sel.direction === 'rtl';
    return {
      selectionStartLineNumber: isReversed ? sel.endLineNumber : sel.startLineNumber,
      selectionStartColumn: isReversed ? sel.endColumn : sel.startColumn,
      positionLineNumber: isReversed ? sel.startLineNumber : sel.endLineNumber,
      positionColumn: isReversed ? sel.startColumn : sel.endColumn,
    };
  });
}

/**
 * Get cursors from selections (cursor is at the active/end position)
 */
export function getCursorsFromSelections(selections: Selection[]): CursorPosition[] {
  return selections.map((sel) => {
    if (sel.direction === 'rtl') {
      return { lineNumber: sel.startLineNumber, column: sel.startColumn };
    }
    return { lineNumber: sel.endLineNumber, column: sel.endColumn };
  });
}

/**
 * Create selections from cursor positions (empty selections)
 */
export function createSelectionsFromCursors(cursors: CursorPosition[]): Selection[] {
  return cursors.map((cursor) => ({
    startLineNumber: cursor.lineNumber,
    startColumn: cursor.column,
    endLineNumber: cursor.lineNumber,
    endColumn: cursor.column,
  }));
}

/**
 * Check if state has multiple cursors
 */
export function hasMultipleCursors(state: MultiCursorState): boolean {
  return state.cursors.length > 1;
}

/**
 * Get primary cursor
 */
export function getPrimaryCursor(state: MultiCursorState): CursorPosition | undefined {
  return state.cursors[state.primaryIndex];
}

/**
 * Get primary selection
 */
export function getPrimarySelection(state: MultiCursorState): Selection | undefined {
  return state.selections[state.primaryIndex];
}

/**
 * Reset to single cursor
 */
export function resetToSingleCursor(state: MultiCursorState): MultiCursorState {
  if (state.cursors.length <= 1) {
    return state;
  }

  const primaryCursor = state.cursors[state.primaryIndex];
  const primarySelection = state.selections[state.primaryIndex];

  return {
    cursors: primaryCursor ? [primaryCursor] : [],
    selections: primarySelection ? [primarySelection] : [],
    primaryIndex: 0,
  };
}

/**
 * Normalize selections (ensure start <= end)
 */
export function normalizeSelection(selection: Selection): Selection {
  const startBeforeEnd =
    selection.startLineNumber < selection.endLineNumber ||
    (selection.startLineNumber === selection.endLineNumber &&
      selection.startColumn <= selection.endColumn);

  if (startBeforeEnd) {
    return selection;
  }

  return {
    startLineNumber: selection.endLineNumber,
    startColumn: selection.endColumn,
    endLineNumber: selection.startLineNumber,
    endColumn: selection.startColumn,
    direction: 'rtl',
  };
}

/**
 * Check if selection is empty (cursor with no actual selection)
 */
export function isSelectionEmpty(selection: Selection): boolean {
  return (
    selection.startLineNumber === selection.endLineNumber &&
    selection.startColumn === selection.endColumn
  );
}

/**
 * Get selection length in characters
 */
export function getSelectionLength(selection: Selection, lines: string[]): number {
  if (isSelectionEmpty(selection)) {
    return 0;
  }

  const normalized = normalizeSelection(selection);

  if (normalized.startLineNumber === normalized.endLineNumber) {
    return normalized.endColumn - normalized.startColumn;
  }

  let length = 0;

  // First line (from start column to end)
  const firstLine = lines[normalized.startLineNumber - 1] || '';
  length += firstLine.length - normalized.startColumn + 1;

  // Middle lines (full lines + newline)
  for (
    let i = normalized.startLineNumber;
    i < normalized.endLineNumber - 1;
    i++
  ) {
    length += (lines[i]?.length || 0) + 1; // +1 for newline
  }

  // Last line (from start to end column)
  length += normalized.endColumn - 1;

  // Add newlines between lines
  length += normalized.endLineNumber - normalized.startLineNumber;

  return length;
}
