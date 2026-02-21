/**
 * MergeEditor Tests
 *
 * Tests for the MergeEditor component and the parseConflictMarkers utility
 * that parses git conflict markers from file content.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { parseConflictMarkers, MergeEditor } from "../MergeEditor";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; class?: string; style?: Record<string, string> }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    if (props.class) el.className = props.class;
    return el;
  },
}));

vi.mock("@/utils/monacoManager", () => ({
  MonacoManager: {
    getInstance: () => ({
      ensureLoaded: vi.fn().mockResolvedValue({
        editor: {
          create: vi.fn().mockReturnValue({
            setModel: vi.fn(),
            dispose: vi.fn(),
            getModel: vi.fn().mockReturnValue(null),
            updateOptions: vi.fn(),
            onDidChangeCursorPosition: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            onDidScrollChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            getScrollTop: vi.fn().mockReturnValue(0),
            setScrollTop: vi.fn(),
            getValue: vi.fn().mockReturnValue(""),
            setValue: vi.fn(),
            deltaDecorations: vi.fn().mockReturnValue([]),
            createDecorationsCollection: vi.fn().mockReturnValue({ set: vi.fn(), clear: vi.fn() }),
            revealLineInCenter: vi.fn(),
            layout: vi.fn(),
            focus: vi.fn(),
            getPosition: vi.fn().mockReturnValue({ lineNumber: 1, column: 1 }),
          }),
          createDiffEditor: vi.fn().mockReturnValue({
            setModel: vi.fn(),
            dispose: vi.fn(),
            getModel: vi.fn().mockReturnValue(null),
            updateOptions: vi.fn(),
          }),
          createModel: vi.fn().mockReturnValue({
            dispose: vi.fn(),
            onDidChangeContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            getValue: vi.fn().mockReturnValue(""),
            setValue: vi.fn(),
          }),
          getModel: vi.fn().mockReturnValue(null),
        },
        languages: {
          registerCodeLensProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        },
        Uri: { parse: vi.fn().mockReturnValue({}) },
      }),
    }),
  },
}));

const standardConflict = `line 1
line 2
<<<<<<< HEAD
const x = "ours";
=======
const x = "theirs";
>>>>>>> feature-branch
line 3
line 4`;

const diff3Conflict = `line 1
<<<<<<< HEAD
const x = "ours";
||||||| merged common ancestors
const x = "base";
=======
const x = "theirs";
>>>>>>> feature-branch
line 2`;

const multipleConflicts = `line 1
<<<<<<< HEAD
const a = 1;
=======
const a = 2;
>>>>>>> feature
line 2
<<<<<<< HEAD
const b = 3;
=======
const b = 4;
>>>>>>> feature
line 3`;

const noConflicts = `line 1
line 2
line 3
const x = "no conflicts here";`;

describe("parseConflictMarkers", () => {
  describe("Standard 2-way conflicts", () => {
    it("should parse a standard conflict", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts).toHaveLength(1);
    });

    it("should extract ours content", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].oursContent).toEqual(['const x = "ours";']);
    });

    it("should extract theirs content", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].theirsContent).toEqual(['const x = "theirs";']);
    });

    it("should extract ours label as HEAD", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].oursLabel).toBe("HEAD");
    });

    it("should extract theirs label as feature-branch", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].theirsLabel).toBe("feature-branch");
    });

    it("should set correct start and end lines", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].startLine).toBe(3);
      expect(result.conflicts[0].endLine).toBe(7);
    });

    it("should set separator line", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].separatorLine).toBe(5);
    });

    it("should mark conflicts as unresolved", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.conflicts[0].resolved).toBe(false);
    });

    it("should not have base content for standard conflicts", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.hasBaseContent).toBe(false);
    });

    it("should generate ours content string", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.oursContent).toContain('const x = "ours";');
    });

    it("should generate theirs content string", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.theirsContent).toContain('const x = "theirs";');
    });

    it("should preserve non-conflict lines in ours content", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.oursContent).toContain("line 1");
      expect(result.oursContent).toContain("line 3");
    });

    it("should preserve non-conflict lines in theirs content", () => {
      const result = parseConflictMarkers(standardConflict);
      expect(result.theirsContent).toContain("line 1");
      expect(result.theirsContent).toContain("line 3");
    });
  });

  describe("Diff3 3-way conflicts", () => {
    it("should parse diff3 conflict with base content", () => {
      const result = parseConflictMarkers(diff3Conflict);
      expect(result.conflicts).toHaveLength(1);
      expect(result.hasBaseContent).toBe(true);
    });

    it("should extract base content", () => {
      const result = parseConflictMarkers(diff3Conflict);
      expect(result.conflicts[0].baseContent).toEqual(['const x = "base";']);
    });

    it("should set base marker line", () => {
      const result = parseConflictMarkers(diff3Conflict);
      expect(result.conflicts[0].baseMarkerLine).toBeDefined();
    });

    it("should still extract ours and theirs content", () => {
      const result = parseConflictMarkers(diff3Conflict);
      expect(result.conflicts[0].oursContent).toEqual(['const x = "ours";']);
      expect(result.conflicts[0].theirsContent).toEqual(['const x = "theirs";']);
    });
  });

  describe("Multiple conflicts", () => {
    it("should parse multiple conflicts", () => {
      const result = parseConflictMarkers(multipleConflicts);
      expect(result.conflicts).toHaveLength(2);
    });

    it("should assign correct indices", () => {
      const result = parseConflictMarkers(multipleConflicts);
      expect(result.conflicts[0].index).toBe(1);
      expect(result.conflicts[1].index).toBe(2);
    });

    it("should assign unique IDs", () => {
      const result = parseConflictMarkers(multipleConflicts);
      expect(result.conflicts[0].id).not.toBe(result.conflicts[1].id);
    });

    it("should extract correct content for each conflict", () => {
      const result = parseConflictMarkers(multipleConflicts);
      expect(result.conflicts[0].oursContent).toEqual(["const a = 1;"]);
      expect(result.conflicts[0].theirsContent).toEqual(["const a = 2;"]);
      expect(result.conflicts[1].oursContent).toEqual(["const b = 3;"]);
      expect(result.conflicts[1].theirsContent).toEqual(["const b = 4;"]);
    });
  });

  describe("No conflicts", () => {
    it("should return empty conflicts array for clean content", () => {
      const result = parseConflictMarkers(noConflicts);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should return identical ours/theirs content", () => {
      const result = parseConflictMarkers(noConflicts);
      expect(result.oursContent).toBe(result.theirsContent);
    });

    it("should not have base content", () => {
      const result = parseConflictMarkers(noConflicts);
      expect(result.hasBaseContent).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty content", () => {
      const result = parseConflictMarkers("");
      expect(result.conflicts).toHaveLength(0);
    });

    it("should handle single line content", () => {
      const result = parseConflictMarkers("single line");
      expect(result.conflicts).toHaveLength(0);
    });
  });
});

describe("MergeEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => (
        <MergeEditor filePath="test.ts" conflictedContent={standardConflict} />
      ));
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(MergeEditor).toBeDefined();
      expect(typeof MergeEditor).toBe("function");
    });

    it("should accept filePath prop", () => {
      const { container } = render(() => (
        <MergeEditor filePath="src/index.ts" conflictedContent={standardConflict} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onSave prop", () => {
      const onSave = vi.fn();
      const { container } = render(() => (
        <MergeEditor filePath="test.ts" conflictedContent={standardConflict} onSave={onSave} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onCancel prop", () => {
      const onCancel = vi.fn();
      const { container } = render(() => (
        <MergeEditor filePath="test.ts" conflictedContent={standardConflict} onCancel={onCancel} />
      ));
      expect(container).toBeTruthy();
    });

    it("should display file name", () => {
      const { container } = render(() => (
        <MergeEditor filePath="src/utils/helper.ts" conflictedContent={standardConflict} />
      ));
      expect(container.textContent).toContain("helper.ts");
    });

    it("should show conflict count", () => {
      const { container } = render(() => (
        <MergeEditor filePath="test.ts" conflictedContent={multipleConflicts} />
      ));
      expect(container.textContent).toContain("2");
    });
  });
});
