import { describe, it, expect } from "vitest";
import {
  createEmptyState,
  createInitialState,
  addCursorAbove,
  addCursorBelow,
  addCursorAt,
  removeCursor,
  sortCursors,
  selectionsOverlap,
  mergeSelections,
  getWordAtPosition,
  selectAllOccurrences,
  getVisualColumn,
  getActualColumn,
  getCursorsFromSelections,
  createSelectionsFromCursors,
  hasMultipleCursors,
  moveAllCursors,
  undoLastCursorAction,
} from "../multiCursor";

describe("multiCursor", () => {
  describe("createEmptyState", () => {
    it("returns empty state", () => {
      const state = createEmptyState();
      expect(state.cursors).toEqual([]);
      expect(state.selections).toEqual([]);
      expect(state.primaryIndex).toBe(0);
    });
  });

  describe("createInitialState", () => {
    it("creates state from position", () => {
      const state = createInitialState({ lineNumber: 1, column: 5 });
      expect(state.cursors).toHaveLength(1);
      expect(state.cursors[0]).toEqual({ lineNumber: 1, column: 5 });
      expect(state.selections).toHaveLength(1);
    });
  });

  describe("addCursorAbove", () => {
    it("adds cursor one line above", () => {
      const state = createInitialState({ lineNumber: 5, column: 1 });
      const result = addCursorAbove(state, 10);
      expect(result.cursors).toHaveLength(2);
      expect(result.cursors.some((c) => c.lineNumber === 4)).toBe(true);
    });
    it("does nothing at line 1", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      const result = addCursorAbove(state, 10);
      expect(result.cursors).toHaveLength(1);
    });
    it("does nothing for empty state", () => {
      const result = addCursorAbove(createEmptyState(), 10);
      expect(result.cursors).toEqual([]);
    });
  });

  describe("addCursorBelow", () => {
    it("adds cursor one line below", () => {
      const state = createInitialState({ lineNumber: 5, column: 1 });
      const result = addCursorBelow(state, 10);
      expect(result.cursors).toHaveLength(2);
      expect(result.cursors.some((c) => c.lineNumber === 6)).toBe(true);
    });
    it("does nothing at last line", () => {
      const state = createInitialState({ lineNumber: 10, column: 1 });
      const result = addCursorBelow(state, 10);
      expect(result.cursors).toHaveLength(1);
    });
  });

  describe("addCursorAt", () => {
    it("adds cursor at position", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      const result = addCursorAt(state, { lineNumber: 3, column: 5 });
      expect(result.cursors).toHaveLength(2);
    });
    it("does not add duplicate cursor", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      const result = addCursorAt(state, { lineNumber: 1, column: 1 });
      expect(result.cursors).toHaveLength(1);
    });
  });

  describe("removeCursor", () => {
    it("removes cursor at index", () => {
      let state = createInitialState({ lineNumber: 1, column: 1 });
      state = addCursorAt(state, { lineNumber: 2, column: 1 });
      const result = removeCursor(state, 0);
      expect(result.cursors).toHaveLength(1);
      expect(result.cursors[0].lineNumber).toBe(2);
    });
    it("does not remove last cursor", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      const result = removeCursor(state, 0);
      expect(result.cursors).toHaveLength(1);
    });
  });

  describe("sortCursors", () => {
    it("sorts by line then column", () => {
      const cursors = [
        { lineNumber: 3, column: 1 },
        { lineNumber: 1, column: 5 },
        { lineNumber: 1, column: 1 },
      ];
      const sorted = sortCursors(cursors);
      expect(sorted[0]).toEqual({ lineNumber: 1, column: 1 });
      expect(sorted[1]).toEqual({ lineNumber: 1, column: 5 });
      expect(sorted[2]).toEqual({ lineNumber: 3, column: 1 });
    });
  });

  describe("selectionsOverlap", () => {
    it("detects overlapping selections", () => {
      const a = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 };
      const b = { startLineNumber: 1, startColumn: 5, endLineNumber: 1, endColumn: 15 };
      expect(selectionsOverlap(a, b)).toBe(true);
    });
    it("detects non-overlapping selections", () => {
      const a = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 };
      const b = { startLineNumber: 1, startColumn: 10, endLineNumber: 1, endColumn: 15 };
      expect(selectionsOverlap(a, b)).toBe(false);
    });
  });

  describe("mergeSelections", () => {
    it("merges overlapping selections", () => {
      const selections = [
        { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 },
        { startLineNumber: 1, startColumn: 5, endLineNumber: 1, endColumn: 15 },
      ];
      const merged = mergeSelections(selections);
      expect(merged).toHaveLength(1);
      expect(merged[0].startColumn).toBe(1);
      expect(merged[0].endColumn).toBe(15);
    });
    it("keeps non-overlapping selections separate", () => {
      const selections = [
        { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 },
        { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 5 },
      ];
      const merged = mergeSelections(selections);
      expect(merged).toHaveLength(2);
    });
  });

  describe("getWordAtPosition", () => {
    it("returns word at position", () => {
      const result = getWordAtPosition("hello world", 3);
      expect(result).toBeDefined();
      expect(result!.word).toBe("hello");
    });
    it("returns word for boundary position", () => {
      const result = getWordAtPosition("hello world", 7);
      expect(result).toBeDefined();
      expect(result!.word).toBe("world");
    });
  });

  describe("selectAllOccurrences", () => {
    it("selects all occurrences of word", () => {
      const text = "hello world hello\nhello again";
      const sel = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 };
      const result = selectAllOccurrences(text, sel);
      expect(result.length).toBe(3);
    });
    it("returns current selection for no matches", () => {
      const sel = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 4 };
      const result = selectAllOccurrences("xyz", sel);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getVisualColumn", () => {
    it("handles spaces", () => {
      expect(getVisualColumn("    hello", 5, 4)).toBe(4);
    });
    it("handles tabs", () => {
      expect(getVisualColumn("\thello", 2, 4)).toBe(4);
    });
  });

  describe("getActualColumn", () => {
    it("converts visual column to actual", () => {
      expect(getActualColumn("    hello", 4, 4)).toBe(5);
    });
    it("handles tabs", () => {
      expect(getActualColumn("\thello", 4, 4)).toBe(2);
    });
  });

  describe("getCursorsFromSelections", () => {
    it("extracts cursor positions from selections", () => {
      const selections = [
        { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 },
      ];
      const cursors = getCursorsFromSelections(selections);
      expect(cursors).toHaveLength(1);
      expect(cursors[0].lineNumber).toBe(1);
    });
  });

  describe("createSelectionsFromCursors", () => {
    it("creates zero-width selections from cursors", () => {
      const cursors = [{ lineNumber: 1, column: 5 }];
      const selections = createSelectionsFromCursors(cursors);
      expect(selections).toHaveLength(1);
      expect(selections[0].startColumn).toBe(5);
      expect(selections[0].endColumn).toBe(5);
    });
  });

  describe("hasMultipleCursors", () => {
    it("returns false for single cursor", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      expect(hasMultipleCursors(state)).toBe(false);
    });
    it("returns true for multiple cursors", () => {
      let state = createInitialState({ lineNumber: 1, column: 1 });
      state = addCursorAt(state, { lineNumber: 2, column: 1 });
      expect(hasMultipleCursors(state)).toBe(true);
    });
  });

  describe("moveAllCursors", () => {
    it("moves all cursors down", () => {
      let state = createInitialState({ lineNumber: 1, column: 1 });
      state = addCursorAt(state, { lineNumber: 2, column: 1 });
      const lines = ["hello", "world", "foo", "bar"];
      const result = moveAllCursors(state, "down", lines);
      expect(result.cursors[0].lineNumber).toBe(2);
      expect(result.cursors[1].lineNumber).toBe(3);
    });
    it("moves all cursors right", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      const lines = ["hello"];
      const result = moveAllCursors(state, "right", lines);
      expect(result.cursors[0].column).toBe(2);
    });
  });

  describe("undoLastCursorAction", () => {
    it("removes last added cursor with empty history", () => {
      let state = createInitialState({ lineNumber: 1, column: 1 });
      state = addCursorAt(state, { lineNumber: 2, column: 1 });
      state = addCursorAt(state, { lineNumber: 3, column: 1 });
      const result = undoLastCursorAction(state, []);
      expect(result.state.cursors).toHaveLength(2);
    });
    it("does nothing for single cursor with empty history", () => {
      const state = createInitialState({ lineNumber: 1, column: 1 });
      const result = undoLastCursorAction(state, []);
      expect(result.state.cursors).toHaveLength(1);
    });
    it("restores from history if available", () => {
      const prev = createInitialState({ lineNumber: 1, column: 1 });
      let state = createInitialState({ lineNumber: 1, column: 1 });
      state = addCursorAt(state, { lineNumber: 2, column: 1 });
      const result = undoLastCursorAction(state, [prev]);
      expect(result.state.cursors).toHaveLength(1);
      expect(result.history).toHaveLength(0);
    });
  });
});
