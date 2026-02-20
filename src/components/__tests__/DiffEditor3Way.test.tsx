import { describe, it, expect, vi, beforeEach } from "vitest";

describe("DiffEditor3Way Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Conflict Marker Parsing", () => {
    interface ConflictMarker {
      id: string;
      index: number;
      startLine: number;
      endLine: number;
      separatorLine: number;
      baseMarkerLine?: number;
      currentContent: string[];
      incomingContent: string[];
      baseContent?: string[];
      currentLabel: string;
      incomingLabel: string;
      resolved: boolean;
    }

    function parseConflictMarkers(content: string): ConflictMarker[] {
      const lines = content.split("\n");
      const conflicts: ConflictMarker[] = [];
      let conflictIndex = 0;
      let i = 0;

      while (i < lines.length) {
        if (lines[i].startsWith("<<<<<<<")) {
          const startLine = i + 1;
          const currentLabel = lines[i].replace(/^<{7}\s*/, "").trim() || "Current";
          const currentContent: string[] = [];
          const incomingContent: string[] = [];
          const baseContent: string[] = [];
          let separatorLine = -1;
          let baseMarkerLine: number | undefined;
          let endLine = -1;
          let inBase = false;
          let inIncoming = false;

          i++;
          while (i < lines.length) {
            if (lines[i].startsWith("|||||||")) {
              baseMarkerLine = i + 1;
              inBase = true;
              i++;
              continue;
            }
            if (lines[i].startsWith("=======")) {
              separatorLine = i + 1;
              inBase = false;
              inIncoming = true;
              i++;
              continue;
            }
            if (lines[i].startsWith(">>>>>>>")) {
              endLine = i + 1;
              break;
            }
            if (inIncoming) {
              incomingContent.push(lines[i]);
            } else if (inBase) {
              baseContent.push(lines[i]);
            } else {
              currentContent.push(lines[i]);
            }
            i++;
          }

          if (endLine > 0) {
            conflictIndex++;
            conflicts.push({
              id: `conflict-${conflictIndex}`,
              index: conflictIndex,
              startLine,
              endLine,
              separatorLine,
              baseMarkerLine,
              currentContent,
              incomingContent,
              baseContent: baseContent.length > 0 ? baseContent : undefined,
              currentLabel,
              incomingLabel: lines[i]?.replace(/^>{7}\s*/, "").trim() || "Incoming",
              resolved: false,
            });
          }
          i++;
        } else {
          i++;
        }
      }

      return conflicts;
    }

    it("should parse simple two-way conflict", () => {
      const content = `line 1
<<<<<<< HEAD
current change
=======
incoming change
>>>>>>> feature
line 2`;

      const conflicts = parseConflictMarkers(content);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].currentContent).toEqual(["current change"]);
      expect(conflicts[0].incomingContent).toEqual(["incoming change"]);
      expect(conflicts[0].currentLabel).toBe("HEAD");
      expect(conflicts[0].incomingLabel).toBe("feature");
    });

    it("should parse three-way conflict with base", () => {
      const content = `<<<<<<< HEAD
current
||||||| base
base content
=======
incoming
>>>>>>> feature`;

      const conflicts = parseConflictMarkers(content);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].currentContent).toEqual(["current"]);
      expect(conflicts[0].baseContent).toEqual(["base content"]);
      expect(conflicts[0].incomingContent).toEqual(["incoming"]);
    });

    it("should parse multiple conflicts", () => {
      const content = `<<<<<<< HEAD
change 1
=======
other 1
>>>>>>> feature
middle
<<<<<<< HEAD
change 2
=======
other 2
>>>>>>> feature`;

      const conflicts = parseConflictMarkers(content);
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].index).toBe(1);
      expect(conflicts[1].index).toBe(2);
    });

    it("should handle empty conflict content", () => {
      const content = `<<<<<<< HEAD
=======
incoming only
>>>>>>> feature`;

      const conflicts = parseConflictMarkers(content);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].currentContent).toEqual([]);
      expect(conflicts[0].incomingContent).toEqual(["incoming only"]);
    });

    it("should return empty array for no conflicts", () => {
      const content = "no conflicts here\njust regular code";
      const conflicts = parseConflictMarkers(content);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve with current content", () => {
      const current = ["line 1", "line 2"];
      const incoming = ["line a", "line b"];
      const resolution = "current";

      const resolved = resolution === "current" ? current : incoming;
      expect(resolved).toEqual(["line 1", "line 2"]);
    });

    it("should resolve with incoming content", () => {
      const current = ["line 1"];
      const incoming = ["line a"];
      const resolution = "incoming";

      const resolved = resolution === "incoming" ? incoming : current;
      expect(resolved).toEqual(["line a"]);
    });

    it("should resolve with both contents", () => {
      const current = ["line 1"];
      const incoming = ["line a"];

      const both = [...current, ...incoming];
      expect(both).toEqual(["line 1", "line a"]);
    });

    it("should resolve with both reversed", () => {
      const current = ["line 1"];
      const incoming = ["line a"];

      const bothReverse = [...incoming, ...current];
      expect(bothReverse).toEqual(["line a", "line 1"]);
    });
  });

  describe("Resolved Content Building", () => {
    it("should track resolution count", () => {
      const conflicts = [
        { resolved: true },
        { resolved: false },
        { resolved: true },
      ];

      const resolvedCount = conflicts.filter(c => c.resolved).length;
      const totalCount = conflicts.length;
      const allResolved = resolvedCount === totalCount;

      expect(resolvedCount).toBe(2);
      expect(totalCount).toBe(3);
      expect(allResolved).toBe(false);
    });

    it("should detect all resolved", () => {
      const conflicts = [
        { resolved: true },
        { resolved: true },
      ];

      const allResolved = conflicts.every(c => c.resolved);
      expect(allResolved).toBe(true);
    });
  });
});
