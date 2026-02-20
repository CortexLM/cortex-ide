import { describe, it, expect } from "vitest";

describe("Diff Algorithm", () => {
  describe("DiffOperation Enum", () => {
    enum DiffOperation {
      Equal = "equal",
      Insert = "insert",
      Delete = "delete",
      Replace = "replace",
    }

    it("should define all operations", () => {
      expect(DiffOperation.Equal).toBe("equal");
      expect(DiffOperation.Insert).toBe("insert");
      expect(DiffOperation.Delete).toBe("delete");
      expect(DiffOperation.Replace).toBe("replace");
    });
  });

  describe("DiffResult Interface", () => {
    interface DiffResult<T = string> {
      operation: "equal" | "insert" | "delete" | "replace";
      value: T;
      oldIndex?: number;
      newIndex?: number;
    }

    it("should create equal result", () => {
      const result: DiffResult = {
        operation: "equal",
        value: "hello",
        oldIndex: 0,
        newIndex: 0,
      };

      expect(result.operation).toBe("equal");
      expect(result.value).toBe("hello");
    });

    it("should create insert result", () => {
      const result: DiffResult = {
        operation: "insert",
        value: "new line",
        newIndex: 5,
      };

      expect(result.operation).toBe("insert");
      expect(result.oldIndex).toBeUndefined();
    });

    it("should create delete result", () => {
      const result: DiffResult = {
        operation: "delete",
        value: "removed line",
        oldIndex: 3,
      };

      expect(result.operation).toBe("delete");
      expect(result.newIndex).toBeUndefined();
    });
  });

  describe("LineDiff Interface", () => {
    interface LineDiff {
      operation: "equal" | "insert" | "delete" | "replace";
      lineNumber: { old?: number; new?: number };
      content: string;
      context?: string[];
    }

    it("should create line diff with both line numbers", () => {
      const diff: LineDiff = {
        operation: "equal",
        lineNumber: { old: 10, new: 10 },
        content: "unchanged line",
      };

      expect(diff.lineNumber.old).toBe(10);
      expect(diff.lineNumber.new).toBe(10);
    });

    it("should create line diff with context", () => {
      const diff: LineDiff = {
        operation: "delete",
        lineNumber: { old: 5 },
        content: "deleted line",
        context: ["line before", "line after"],
      };

      expect(diff.context).toHaveLength(2);
    });
  });

  describe("Myers Diff Algorithm", () => {
    const myersDiff = <T>(oldSeq: T[], newSeq: T[]): Array<{ op: string; value: T }> => {
      const results: Array<{ op: string; value: T }> = [];

      if (oldSeq.length === 0) {
        return newSeq.map(v => ({ op: "insert", value: v }));
      }
      if (newSeq.length === 0) {
        return oldSeq.map(v => ({ op: "delete", value: v }));
      }

      let i = 0;
      let j = 0;

      while (i < oldSeq.length && j < newSeq.length) {
        if (oldSeq[i] === newSeq[j]) {
          results.push({ op: "equal", value: oldSeq[i] });
          i++;
          j++;
        } else {
          results.push({ op: "delete", value: oldSeq[i] });
          i++;
        }
      }

      while (i < oldSeq.length) {
        results.push({ op: "delete", value: oldSeq[i] });
        i++;
      }

      while (j < newSeq.length) {
        results.push({ op: "insert", value: newSeq[j] });
        j++;
      }

      return results;
    };

    it("should handle empty sequences", () => {
      expect(myersDiff([], [])).toEqual([]);
    });

    it("should handle all inserts", () => {
      const result = myersDiff([], ["a", "b", "c"]);

      expect(result).toHaveLength(3);
      expect(result.every(r => r.op === "insert")).toBe(true);
    });

    it("should handle all deletes", () => {
      const result = myersDiff(["a", "b", "c"], []);

      expect(result).toHaveLength(3);
      expect(result.every(r => r.op === "delete")).toBe(true);
    });

    it("should handle equal sequences", () => {
      const result = myersDiff(["a", "b", "c"], ["a", "b", "c"]);

      expect(result).toHaveLength(3);
      expect(result.every(r => r.op === "equal")).toBe(true);
    });
  });

  describe("Line-Based Diff", () => {
    const diffLines = (oldText: string, newText: string) => {
      const oldLines = oldText.split("\n");
      const newLines = newText.split("\n");

      const results: Array<{ op: string; line: string }> = [];
      const oldSet = new Set(oldLines);
      const newSet = new Set(newLines);

      for (const line of oldLines) {
        if (!newSet.has(line)) {
          results.push({ op: "delete", line });
        }
      }

      for (const line of newLines) {
        if (!oldSet.has(line)) {
          results.push({ op: "insert", line });
        }
      }

      return results;
    };

    it("should detect deleted lines", () => {
      const result = diffLines("line1\nline2\nline3", "line1\nline3");

      expect(result.some(r => r.op === "delete" && r.line === "line2")).toBe(true);
    });

    it("should detect inserted lines", () => {
      const result = diffLines("line1\nline3", "line1\nline2\nline3");

      expect(result.some(r => r.op === "insert" && r.line === "line2")).toBe(true);
    });

    it("should handle identical text", () => {
      const result = diffLines("line1\nline2", "line1\nline2");

      expect(result).toHaveLength(0);
    });
  });

  describe("Unified Diff Format", () => {
    interface UnifiedDiffOptions {
      contextLines?: number;
      oldFileName?: string;
      newFileName?: string;
    }

    const generateUnifiedHeader = (options: UnifiedDiffOptions): string => {
      const oldName = options.oldFileName || "a";
      const newName = options.newFileName || "b";
      return `--- ${oldName}\n+++ ${newName}`;
    };

    it("should generate unified diff header", () => {
      const header = generateUnifiedHeader({
        oldFileName: "old.txt",
        newFileName: "new.txt",
      });

      expect(header).toContain("--- old.txt");
      expect(header).toContain("+++ new.txt");
    });

    it("should use defaults for missing filenames", () => {
      const header = generateUnifiedHeader({});

      expect(header).toContain("--- a");
      expect(header).toContain("+++ b");
    });
  });

  describe("Side-by-Side Diff", () => {
    interface SideBySideLine {
      lineNumber?: number;
      content: string;
      type: "equal" | "insert" | "delete";
    }

    interface SideBySideDiff {
      left: SideBySideLine[];
      right: SideBySideLine[];
    }

    it("should create side-by-side diff structure", () => {
      const diff: SideBySideDiff = {
        left: [
          { lineNumber: 1, content: "line 1", type: "equal" },
          { lineNumber: 2, content: "old line", type: "delete" },
        ],
        right: [
          { lineNumber: 1, content: "line 1", type: "equal" },
          { lineNumber: 2, content: "new line", type: "insert" },
        ],
      };

      expect(diff.left).toHaveLength(2);
      expect(diff.right).toHaveLength(2);
    });
  });

  describe("Hunk Generation", () => {
    interface Hunk {
      oldStart: number;
      oldCount: number;
      newStart: number;
      newCount: number;
      lines: string[];
    }

    it("should create hunk structure", () => {
      const hunk: Hunk = {
        oldStart: 10,
        oldCount: 5,
        newStart: 10,
        newCount: 7,
        lines: [" context", "-deleted", "+inserted", " context"],
      };

      expect(hunk.oldStart).toBe(10);
      expect(hunk.newCount).toBe(7);
    });

    it("should format hunk header", () => {
      const formatHunkHeader = (hunk: Hunk): string => {
        return `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
      };

      const header = formatHunkHeader({
        oldStart: 10,
        oldCount: 5,
        newStart: 10,
        newCount: 7,
        lines: [],
      });

      expect(header).toBe("@@ -10,5 +10,7 @@");
    });
  });

  describe("Diff Statistics", () => {
    interface DiffStats {
      additions: number;
      deletions: number;
      changes: number;
    }

    const calculateStats = (diffs: Array<{ op: string }>): DiffStats => {
      return {
        additions: diffs.filter(d => d.op === "insert").length,
        deletions: diffs.filter(d => d.op === "delete").length,
        changes: diffs.filter(d => d.op === "replace").length,
      };
    };

    it("should calculate diff statistics", () => {
      const diffs = [
        { op: "equal" },
        { op: "insert" },
        { op: "insert" },
        { op: "delete" },
        { op: "replace" },
      ];

      const stats = calculateStats(diffs);

      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(1);
      expect(stats.changes).toBe(1);
    });
  });

  describe("Word-Level Diff", () => {
    const diffWords = (oldText: string, newText: string) => {
      const oldWords = oldText.split(/\s+/);
      const newWords = newText.split(/\s+/);

      const results: Array<{ op: string; word: string }> = [];
      const oldSet = new Set(oldWords);
      const newSet = new Set(newWords);

      for (const word of oldWords) {
        if (!newSet.has(word)) {
          results.push({ op: "delete", word });
        }
      }

      for (const word of newWords) {
        if (!oldSet.has(word)) {
          results.push({ op: "insert", word });
        }
      }

      return results;
    };

    it("should detect word changes", () => {
      const result = diffWords("hello world", "hello universe");

      expect(result.some(r => r.op === "delete" && r.word === "world")).toBe(true);
      expect(result.some(r => r.op === "insert" && r.word === "universe")).toBe(true);
    });
  });

  describe("Character-Level Diff", () => {
    const diffChars = (oldStr: string, newStr: string) => {
      const results: Array<{ op: string; char: string }> = [];
      const oldChars = oldStr.split("");
      const newChars = newStr.split("");

      let i = 0;
      let j = 0;

      while (i < oldChars.length && j < newChars.length) {
        if (oldChars[i] === newChars[j]) {
          results.push({ op: "equal", char: oldChars[i] });
          i++;
          j++;
        } else {
          results.push({ op: "delete", char: oldChars[i] });
          i++;
        }
      }

      while (i < oldChars.length) {
        results.push({ op: "delete", char: oldChars[i++] });
      }

      while (j < newChars.length) {
        results.push({ op: "insert", char: newChars[j++] });
      }

      return results;
    };

    it("should detect character changes", () => {
      const result = diffChars("cat", "car");

      expect(result.some(r => r.op === "delete" && r.char === "t")).toBe(true);
      expect(result.some(r => r.op === "insert" && r.char === "r")).toBe(true);
    });
  });

  describe("Patience Diff", () => {
    const findUniqueLines = (lines: string[]): Map<string, number> => {
      const counts = new Map<string, number>();
      const positions = new Map<string, number>();

      lines.forEach((line, i) => {
        counts.set(line, (counts.get(line) || 0) + 1);
        positions.set(line, i);
      });

      const unique = new Map<string, number>();
      for (const [line, count] of counts) {
        if (count === 1) {
          unique.set(line, positions.get(line)!);
        }
      }

      return unique;
    };

    it("should find unique lines", () => {
      const lines = ["a", "b", "c", "b", "d"];
      const unique = findUniqueLines(lines);

      expect(unique.has("a")).toBe(true);
      expect(unique.has("b")).toBe(false);
      expect(unique.has("c")).toBe(true);
      expect(unique.has("d")).toBe(true);
    });
  });

  describe("Diff Apply", () => {
    interface Patch {
      hunks: Array<{
        oldStart: number;
        lines: Array<{ op: string; content: string }>;
      }>;
    }

    const applyPatch = (original: string[], patch: Patch): string[] => {
      const result = [...original];

      for (const hunk of patch.hunks) {
        let offset = 0;
        for (const line of hunk.lines) {
          if (line.op === "delete") {
            result.splice(hunk.oldStart + offset - 1, 1);
          } else if (line.op === "insert") {
            result.splice(hunk.oldStart + offset - 1, 0, line.content);
            offset++;
          }
        }
      }

      return result;
    };

    it("should apply simple patch", () => {
      const original = ["line1", "line2", "line3"];
      const patch: Patch = {
        hunks: [
          {
            oldStart: 2,
            lines: [
              { op: "delete", content: "line2" },
              { op: "insert", content: "new line2" },
            ],
          },
        ],
      };

      const result = applyPatch(original, patch);

      expect(result).toContain("new line2");
    });
  });
});
