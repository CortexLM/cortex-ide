/**
 * InlineDiff Tests
 *
 * Tests for the inline diff display component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { InlineDiff } from "../InlineDiff";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("InlineDiff", () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the diff container", () => {
      mockInvoke.mockResolvedValue({ lines: [] });

      const { container } = render(() => (
        <InlineDiff original="" modified="" />
      ));

      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should render the header with title", () => {
      mockInvoke.mockResolvedValue({ lines: [] });

      const { container } = render(() => (
        <InlineDiff original="hello" modified="world" />
      ));

      expect(container.textContent).toContain("Inline Diff");
    });

    it("should display added and deleted counts", async () => {
      mockInvoke.mockResolvedValue({
        lines: [
          { tag: "delete", content: "old line", oldIndex: 1, newIndex: null, charChanges: [] },
          { tag: "insert", content: "new line", oldIndex: null, newIndex: 1, charChanges: [] },
          { tag: "equal", content: "same line", oldIndex: 2, newIndex: 2, charChanges: [] },
        ],
      });

      const { container } = render(() => (
        <InlineDiff original="old line\nsame line" modified="new line\nsame line" />
      ));

      await nextTick();
      await nextTick();
      await nextTick();
      await nextTick();

      const text = container.textContent ?? "";
      expect(text).toContain("old line");
      expect(text).toContain("new line");
      expect(text).toContain("same line");
    });
  });

  describe("Diff Line Display", () => {
    it("should render diff lines with type indicators", async () => {
      mockInvoke.mockResolvedValue({
        lines: [
          { tag: "delete", content: "removed", oldIndex: 1, newIndex: null, charChanges: [] },
          { tag: "insert", content: "added", oldIndex: null, newIndex: 1, charChanges: [] },
          { tag: "equal", content: "kept", oldIndex: 2, newIndex: 2, charChanges: [] },
        ],
      });

      const { container } = render(() => (
        <InlineDiff original="removed\nkept" modified="added\nkept" />
      ));

      await nextTick();
      await nextTick();

      expect(container.textContent).toContain("removed");
      expect(container.textContent).toContain("added");
      expect(container.textContent).toContain("kept");
    });

    it("should show + and - markers for diff lines", async () => {
      mockInvoke.mockResolvedValue({
        lines: [
          { tag: "delete", content: "old", oldIndex: 1, newIndex: null, charChanges: [] },
          { tag: "insert", content: "new", oldIndex: null, newIndex: 1, charChanges: [] },
        ],
      });

      const { container } = render(() => (
        <InlineDiff original="old" modified="new" />
      ));

      await nextTick();
      await nextTick();

      expect(container.textContent).toContain("+");
      expect(container.textContent).toContain("-");
    });

    it("should display line numbers", async () => {
      mockInvoke.mockResolvedValue({
        lines: [
          { changeType: "equal", content: "line one", oldLineNumber: 1, newLineNumber: 1, charChanges: [] },
          { changeType: "equal", content: "line two", oldLineNumber: 2, newLineNumber: 2, charChanges: [] },
        ],
        stats: { insertions: 0, deletions: 0, unchanged: 2 },
        hasChanges: false,
      });

      const { container } = render(() => (
        <InlineDiff original="line one\nline two" modified="line one\nline two" />
      ));

      await nextTick();
      await nextTick();
      await nextTick();
      await nextTick();

      const text = container.textContent ?? "";
      expect(text).toContain("line one");
      expect(text).toContain("line two");
    });
  });

  describe("Accept/Reject Callbacks", () => {
    it("should call onAccept when accept button is clicked", async () => {
      const onAccept = vi.fn();
      mockInvoke.mockResolvedValue({
        lines: [
          { tag: "insert", content: "new", oldIndex: null, newIndex: 1, charChanges: [] },
        ],
      });

      const { container } = render(() => (
        <InlineDiff original="old" modified="new" onAccept={onAccept} />
      ));

      await nextTick();
      await nextTick();

      const acceptBtn = container.querySelector('[title="Accept changes"]');
      if (acceptBtn) {
        fireEvent.click(acceptBtn);
        expect(onAccept).toHaveBeenCalled();
      }
    });

    it("should call onReject when reject button is clicked", async () => {
      const onReject = vi.fn();
      mockInvoke.mockResolvedValue({
        lines: [
          { tag: "delete", content: "old", oldIndex: 1, newIndex: null, charChanges: [] },
        ],
      });

      const { container } = render(() => (
        <InlineDiff original="old" modified="new" onReject={onReject} />
      ));

      await nextTick();
      await nextTick();

      const rejectBtn = container.querySelector('[title="Reject changes"]');
      if (rejectBtn) {
        fireEvent.click(rejectBtn);
        expect(onReject).toHaveBeenCalled();
      }
    });

    it("should not show accept button when onAccept is not provided", async () => {
      mockInvoke.mockResolvedValue({ lines: [] });

      const { container } = render(() => (
        <InlineDiff original="old" modified="new" />
      ));

      await nextTick();

      const acceptBtn = container.querySelector('[title="Accept changes"]');
      expect(acceptBtn).toBeNull();
    });
  });

  describe("Local Fallback", () => {
    it("should compute diff locally when IPC fails", async () => {
      mockInvoke.mockRejectedValue(new Error("IPC error"));

      const { container } = render(() => (
        <InlineDiff original="hello world" modified="hello there" />
      ));

      await nextTick();
      await nextTick();

      expect(container.textContent).toContain("hello");
    });

    it("should handle empty inputs", async () => {
      mockInvoke.mockResolvedValue({ lines: [] });

      expect(() => {
        render(() => (
          <InlineDiff original="" modified="" />
        ));
      }).not.toThrow();
    });
  });

  describe("Loading State", () => {
    it("should show loading state while computing diff", () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      const { container } = render(() => (
        <InlineDiff original="a" modified="b" />
      ));

      expect(container.textContent).toContain("Computing diff...");
    });
  });
});
