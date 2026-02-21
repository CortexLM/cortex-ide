/**
 * ConflictResolver Tests
 *
 * Tests for the ConflictResolver component that displays merge conflict hunks
 * and allows resolution via ours/theirs/both/custom strategies.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { ConflictResolver } from "../ConflictResolver";

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

const createMockConflictFile = (hunkCount = 2) => ({
  path: "src/app.ts",
  oursLabel: "HEAD",
  theirsLabel: "feature-branch",
  hunks: Array.from({ length: hunkCount }, (_, i) => ({
    id: `hunk-${i}`,
    startLine: 10 + i * 20,
    endLine: 18 + i * 20,
    oursContent: [`const value${i} = "ours";`, `console.log("ours-${i}");`],
    theirsContent: [`const value${i} = "theirs";`, `console.log("theirs-${i}");`],
    oursLabel: "HEAD",
    theirsLabel: "feature-branch",
    resolved: false,
  })),
});

describe("ConflictResolver", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const file = createMockConflictFile();
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(ConflictResolver).toBeDefined();
      expect(typeof ConflictResolver).toBe("function");
    });

    it("should display Resolve Conflicts header", () => {
      const file = createMockConflictFile();
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Resolve Conflicts");
    });

    it("should display the file path", () => {
      const file = createMockConflictFile();
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("src/app.ts");
    });

    it("should display resolution counter", () => {
      const file = createMockConflictFile(3);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("0/3 resolved");
    });
  });

  describe("Conflict Hunks List", () => {
    it("should display conflict entries in sidebar", () => {
      const file = createMockConflictFile(3);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Conflict 1");
      expect(container.textContent).toContain("Conflict 2");
      expect(container.textContent).toContain("Conflict 3");
    });

    it("should show line numbers for each hunk", () => {
      const file = createMockConflictFile(2);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Lines 10-18");
      expect(container.textContent).toContain("Lines 30-38");
    });

    it("should show unresolved warning icon for unresolved hunks", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      const warningIcons = container.querySelectorAll('[data-icon="triangle-exclamation"]');
      expect(warningIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Resolution Buttons", () => {
    it("should display Accept Ours button with label", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Accept HEAD");
    });

    it("should display Accept Theirs button with label", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Accept feature-branch");
    });

    it("should display Accept Both button", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Accept Both");
    });

    it("should display Edit Manually button", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Edit Manually");
    });

    it("should update resolved count when ours is selected", async () => {
      const file = createMockConflictFile(2);
      const { container } = render(() => <ConflictResolver file={file} />);

      const acceptOursBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Accept HEAD")
      );
      if (acceptOursBtn) {
        fireEvent.click(acceptOursBtn);
        await nextTick();
        expect(container.textContent).toContain("1/2 resolved");
      }
    });

    it("should update resolved count when theirs is selected", async () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);

      const acceptTheirsBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Accept feature-branch")
      );
      if (acceptTheirsBtn) {
        fireEvent.click(acceptTheirsBtn);
        await nextTick();
        expect(container.textContent).toContain("1/1 resolved");
      }
    });

    it("should update resolved count when both is selected", async () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);

      const acceptBothBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Accept Both")
      );
      if (acceptBothBtn) {
        fireEvent.click(acceptBothBtn);
        await nextTick();
        expect(container.textContent).toContain("1/1 resolved");
      }
    });
  });

  describe("View Modes", () => {
    it("should display Side by Side view mode button", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Side by Side");
    });

    it("should display Inline view mode button", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("Inline");
    });

    it("should show ours and theirs labels in side-by-side mode", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("(Current)");
      expect(container.textContent).toContain("(Incoming)");
    });

    it("should display ours content lines", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain('const value0 = "ours";');
    });

    it("should display theirs content lines", () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain('const value0 = "theirs";');
    });
  });

  describe("Apply Resolution", () => {
    it("should show disabled Apply Resolution button when not all resolved", () => {
      const file = createMockConflictFile(2);
      const { container } = render(() => <ConflictResolver file={file} />);
      const applyBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("conflicts remaining")
      );
      expect(applyBtn).toBeTruthy();
      if (applyBtn) {
        expect(applyBtn.hasAttribute("disabled")).toBe(true);
      }
    });

    it("should show remaining conflicts count", () => {
      const file = createMockConflictFile(3);
      const { container } = render(() => <ConflictResolver file={file} />);
      expect(container.textContent).toContain("3 conflicts remaining");
    });

    it("should call onResolve when all hunks resolved and apply clicked", async () => {
      const file = createMockConflictFile(1);
      const onResolve = vi.fn();
      const { container } = render(() => (
        <ConflictResolver file={file} onResolve={onResolve} />
      ));

      const acceptOursBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Accept HEAD")
      );
      if (acceptOursBtn) {
        fireEvent.click(acceptOursBtn);
        await nextTick();

        const applyBtn = Array.from(container.querySelectorAll("button")).find(
          (btn) => btn.textContent?.includes("Apply Resolution")
        );
        if (applyBtn) {
          fireEvent.click(applyBtn);
          await nextTick();
          expect(onResolve).toHaveBeenCalledWith("src/app.ts", expect.objectContaining({
            path: "src/app.ts",
            hunks: expect.arrayContaining([
              expect.objectContaining({
                id: "hunk-0",
                resolution: "ours",
              }),
            ]),
          }));
        }
      }
    });
  });

  describe("Cancel", () => {
    it("should call onCancel when cancel button is clicked", async () => {
      const file = createMockConflictFile(1);
      const onCancel = vi.fn();
      const { container } = render(() => (
        <ConflictResolver file={file} onCancel={onCancel} />
      ));

      const cancelBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "Cancel"
      );
      if (cancelBtn) {
        fireEvent.click(cancelBtn);
        await nextTick();
        expect(onCancel).toHaveBeenCalled();
      }
    });
  });

  describe("Reset Resolution", () => {
    it("should show Reset button after resolving a hunk", async () => {
      const file = createMockConflictFile(1);
      const { container } = render(() => <ConflictResolver file={file} />);

      const acceptOursBtn = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Accept HEAD")
      );
      if (acceptOursBtn) {
        fireEvent.click(acceptOursBtn);
        await nextTick();
        expect(container.textContent).toContain("Reset");
      }
    });
  });
});
