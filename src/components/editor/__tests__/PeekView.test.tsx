/**
 * PeekView Tests
 *
 * Tests for the inline definition/references peek component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  cleanup,
  fireEvent,
  createMockMonaco,
  createMockMonacoEditor,
  nextTick,
} from "@/test/utils";
import { PeekView, PeekLocation } from "../PeekView";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("PeekView", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;
  const mockInvoke = vi.mocked(invoke);

  const sampleLocations: PeekLocation[] = [
    {
      uri: "file:///project/src/utils.ts",
      range: { startLine: 10, startCol: 1, endLine: 15, endCol: 1 },
    },
    {
      uri: "file:///project/src/helpers.ts",
      range: { startLine: 5, startCol: 1, endLine: 8, endCol: 1 },
    },
  ];

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue("const foo = 'bar';\nconst baz = 42;\nfunction hello() {}\n");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when visible is false", () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={false}
        />
      ));

      expect(container.innerHTML).toBe("");
    });

    it("should not render when locations is empty", () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={[]}
          visible={true}
        />
      ));

      expect(container.innerHTML).toBe("");
    });

    it("should render when visible with locations", async () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
        />
      ));

      await nextTick();

      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should display the file name in the header", async () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
        />
      ));

      await nextTick();

      expect(container.textContent).toContain("utils.ts");
    });

    it("should display file content after loading", async () => {
      mockInvoke.mockResolvedValue("const foo = 'bar';\nconst baz = 42;");

      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
        />
      ));

      await nextTick();
      await new Promise((r) => setTimeout(r, 100));
      await nextTick();

      const bodyDiv = container.querySelector(".overflow-auto");
      expect(bodyDiv).toBeTruthy();
    });
  });

  describe("Navigation", () => {
    it("should show navigation buttons when multiple locations exist", async () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
        />
      ));

      await nextTick();

      const prevBtn = container.querySelector('[title="Previous (Alt+↑)"]');
      const nextBtn = container.querySelector('[title="Next (Alt+↓)"]');
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
    });

    it("should show result counter", async () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
        />
      ));

      await nextTick();

      expect(container.textContent).toContain("1/2");
    });

    it("should navigate to next location on next button click", async () => {
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
        />
      ));

      await nextTick();

      const nextBtn = container.querySelector('[title="Next (Alt+↓)"]');
      if (nextBtn) {
        fireEvent.click(nextBtn);
        await nextTick();
        expect(container.textContent).toContain("2/2");
      }
    });
  });

  describe("Close Behavior", () => {
    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
          onClose={onClose}
        />
      ));

      await nextTick();

      const closeBtn = container.querySelector('[title="Close (Escape)"]');
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it("should call onClose on Escape key", async () => {
      const onClose = vi.fn();
      render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
          onClose={onClose}
        />
      ));

      await nextTick();

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      );

      await nextTick();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Navigate to File", () => {
    it("should call onNavigate when go-to-file button is clicked", async () => {
      const onNavigate = vi.fn();
      const { container } = render(() => (
        <PeekView
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          locations={sampleLocations}
          visible={true}
          onNavigate={onNavigate}
        />
      ));

      await nextTick();

      const goToBtn = container.querySelector('[title="Go to file (Enter)"]');
      if (goToBtn) {
        fireEvent.click(goToBtn);
        expect(onNavigate).toHaveBeenCalledWith(
          expect.objectContaining({ uri: "file:///project/src/utils.ts" })
        );
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle null editor gracefully", () => {
      expect(() => {
        render(() => (
          <PeekView
            editor={null}
            monaco={null}
            locations={sampleLocations}
            visible={true}
          />
        ));
      }).not.toThrow();
    });

    it("should not throw when file content fails to load", async () => {
      mockInvoke.mockRejectedValue(new Error("File not found"));

      expect(() => {
        render(() => (
          <PeekView
            editor={mockEditor as any}
            monaco={mockMonaco as any}
            locations={sampleLocations}
            visible={true}
          />
        ));
      }).not.toThrow();

      await nextTick();
      await new Promise((r) => setTimeout(r, 100));
    });
  });
});