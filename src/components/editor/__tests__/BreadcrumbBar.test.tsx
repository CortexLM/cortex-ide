/**
 * BreadcrumbBar Tests
 *
 * Tests for the file path breadcrumb navigation component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { BreadcrumbBar } from "../BreadcrumbBar";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("BreadcrumbBar", () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the breadcrumb bar container", () => {
      mockInvoke.mockResolvedValue([
        { name: "src", kind: "directory", line: 0, column: 0, depth: 0 },
        { name: "App.tsx", kind: "file", line: 1, column: 1, depth: 1 },
      ]);

      const { container } = render(() => (
        <BreadcrumbBar filePath="/project/src/App.tsx" line={1} column={1} />
      ));

      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should render file path segments from IPC response", async () => {
      mockInvoke.mockResolvedValue([
        { name: "src", kind: "directory", line: 0, column: 0, depth: 0 },
        { name: "App.tsx", kind: "file", line: 1, column: 1, depth: 1 },
      ]);

      const { container } = render(() => (
        <BreadcrumbBar filePath="/project/src/App.tsx" line={1} column={1} />
      ));

      await nextTick();
      await nextTick();

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("should render separator between segments", async () => {
      mockInvoke.mockResolvedValue([
        { name: "src", kind: "directory", line: 0, column: 0, depth: 0 },
        { name: "components", kind: "directory", line: 0, column: 0, depth: 1 },
        { name: "App.tsx", kind: "file", line: 1, column: 1, depth: 2 },
      ]);

      const { container } = render(() => (
        <BreadcrumbBar filePath="/project/src/components/App.tsx" line={1} column={1} />
      ));

      await nextTick();
      await nextTick();

      const separators = container.querySelectorAll("[aria-hidden='true']");
      expect(separators.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Fallback Path Parsing", () => {
    it("should build fallback segments when IPC fails", async () => {
      mockInvoke.mockRejectedValue(new Error("IPC error"));

      const { container } = render(() => (
        <BreadcrumbBar
          filePath="/project/src/App.tsx"
          line={1}
          column={1}
          workspaceRoot="/project"
        />
      ));

      await nextTick();
      await nextTick();

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("should use relative path for fallback segments", async () => {
      mockInvoke.mockRejectedValue(new Error("IPC error"));

      const { container } = render(() => (
        <BreadcrumbBar
          filePath="/workspace/src/utils/helpers.ts"
          line={1}
          column={1}
          workspaceRoot="/workspace"
        />
      ));

      await nextTick();
      await nextTick();

      expect(container.textContent).toContain("src");
      expect(container.textContent).toContain("utils");
      expect(container.textContent).toContain("helpers.ts");
    });
  });

  describe("Segment Click Navigation", () => {
    it("should call onNavigate when a segment is clicked", async () => {
      const onNavigate = vi.fn();
      mockInvoke.mockResolvedValue([
        { name: "project", kind: "directory", line: 0, column: 0 },
        { name: "src", kind: "directory", line: 0, column: 0 },
      ]);

      const { container } = render(() => (
        <BreadcrumbBar
          filePath="/project/src/App.tsx"
          line={1}
          column={1}
          onNavigate={onNavigate}
        />
      ));

      await nextTick();
      await nextTick();

      const buttons = container.querySelectorAll("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        expect(onNavigate).toHaveBeenCalledWith(
          expect.objectContaining({ name: "project", kind: "directory" })
        );
      }
    });
  });

  describe("Icon Rendering", () => {
    it("should render icons for different segment kinds", async () => {
      mockInvoke.mockResolvedValue([
        { name: "src", kind: "directory", line: 0, column: 0, depth: 0 },
        { name: "App.tsx", kind: "file", line: 1, column: 1, depth: 1 },
        { name: "MyClass", kind: "class", line: 5, column: 1, depth: 2 },
      ]);

      const { container } = render(() => (
        <BreadcrumbBar filePath="/project/src/App.tsx" line={5} column={1} />
      ));

      await nextTick();
      await nextTick();

      const iconSpans = container.querySelectorAll("[aria-hidden='true']");
      expect(iconSpans.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty file path", async () => {
      mockInvoke.mockResolvedValue([]);

      expect(() => {
        render(() => (
          <BreadcrumbBar filePath="" line={1} column={1} />
        ));
      }).not.toThrow();
    });

    it("should show loading state", () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      const { container } = render(() => (
        <BreadcrumbBar filePath="/project/src/App.tsx" line={1} column={1} />
      ));

      expect(container.textContent).toContain("Loading...");
    });
  });
});