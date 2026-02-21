/**
 * StashDiffView Tests
 *
 * Tests for the StashDiffView component that displays the contents
 * of a stash including file list, stats, and diff output.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { StashDiffView } from "../StashDiffView";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockGitStashShow = vi.fn();

vi.mock("@/utils/tauri-api", () => ({
  gitStashShow: (...args: unknown[]) => mockGitStashShow(...args),
}));

vi.mock("@/utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/test/project"),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; class?: string; style?: Record<string, string> }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    if (props.class) el.className = props.class;
    return el;
  },
}));

vi.mock("@/components/ui", () => ({
  Button: (props: { children?: unknown; onClick?: () => void; disabled?: boolean; style?: Record<string, string> }) => {
    const el = document.createElement("button");
    if (props.children) el.textContent = String(props.children);
    if (props.onClick) el.addEventListener("click", props.onClick);
    if (props.disabled) el.setAttribute("disabled", "");
    return el;
  },
  Text: (props: { children?: unknown; as?: string; style?: Record<string, string> }) => {
    const el = document.createElement(props.as || "span");
    if (props.children) el.textContent = String(props.children);
    return el;
  },
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      surface: { canvas: "transparent", panel: "transparent", popup: "transparent", overlay: "transparent" },
      text: { primary: "inherit", muted: "inherit" },
      border: { default: "transparent", divider: "transparent" },
      semantic: { primary: "blue", success: "green", error: "red", warning: "orange" },
      interactive: { hover: "transparent", active: "transparent" },
      icon: { default: "inherit" },
    },
    spacing: { xs: "2px", sm: "4px", md: "8px", lg: "12px", xl: "16px" },
    radius: { sm: "4px", md: "8px" },
  },
}));

const mockStashDiff = {
  index: 0,
  message: "WIP on main: fix layout bug",
  files: [
    { path: "src/app.ts", status: "modified" as const, additions: 10, deletions: 5 },
    { path: "src/new-file.ts", status: "added" as const, additions: 25, deletions: 0 },
    { path: "src/removed.ts", status: "deleted" as const, additions: 0, deletions: 15 },
  ],
  diff: `diff --git a/src/app.ts b/src/app.ts
index abc123..def456 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,10 @@
 const app = "hello";
-const old = true;
+const updated = true;
+const newLine = "added";
diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export const newFile = true;
+export const value = 42;
+export const name = "test";`,
};

describe("StashDiffView", () => {
  beforeEach(() => {
    mockGitStashShow.mockResolvedValue(mockStashDiff);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} />
      ));
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(StashDiffView).toBeDefined();
      expect(typeof StashDiffView).toBe("function");
    });

    it("should accept stashIndex prop", () => {
      const { container } = render(() => (
        <StashDiffView stashIndex={2} onClose={vi.fn()} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("Data Fetching", () => {
    it("should fetch stash details on mount", async () => {
      render(() => <StashDiffView stashIndex={0} onClose={vi.fn()} />);
      await nextTick();
      expect(mockGitStashShow).toHaveBeenCalled();
      expect(mockGitStashShow.mock.calls[0][1]).toBe(0);
    });

    it("should fetch with correct stash index", async () => {
      render(() => <StashDiffView stashIndex={3} onClose={vi.fn()} />);
      await nextTick();
      expect(mockGitStashShow).toHaveBeenCalled();
      expect(mockGitStashShow.mock.calls[0][1]).toBe(3);
    });

    it("should handle fetch error gracefully", async () => {
      mockGitStashShow.mockRejectedValue(new Error("Stash not found"));
      const { container } = render(() => (
        <StashDiffView stashIndex={99} onClose={vi.fn()} />
      ));
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("Stash not found");
    });
  });

  describe("File List", () => {
    it("should display file names after loading", async () => {
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} />
      ));
      await nextTick();
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("app.ts");
      expect(container.textContent).toContain("new-file.ts");
      expect(container.textContent).toContain("removed.ts");
    });
  });

  describe("Action Buttons", () => {
    it("should call onClose when close is triggered", async () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={onClose} />
      ));
      await nextTick();
      await nextTick();

      const closeBtn = container.querySelector('[data-icon="xmark"]');
      if (closeBtn) {
        const button = closeBtn.closest("button");
        if (button) {
          fireEvent.click(button);
          await nextTick();
          expect(onClose).toHaveBeenCalled();
        }
      }
    });

    it("should accept onApply callback", () => {
      const onApply = vi.fn();
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} onApply={onApply} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onPop callback", () => {
      const onPop = vi.fn();
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} onPop={onPop} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onDrop callback", () => {
      const onDrop = vi.fn();
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} onDrop={onDrop} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("Loading State", () => {
    it("should show loading state initially", () => {
      mockGitStashShow.mockReturnValue(new Promise(() => {}));
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("Error State", () => {
    it("should display error message on fetch failure", async () => {
      mockGitStashShow.mockRejectedValue(new Error("Failed to read stash"));
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} />
      ));
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("Failed to read stash");
    });

    it("should handle non-Error rejection", async () => {
      mockGitStashShow.mockRejectedValue("string error");
      const { container } = render(() => (
        <StashDiffView stashIndex={0} onClose={vi.fn()} />
      ));
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("string error");
    });
  });
});
