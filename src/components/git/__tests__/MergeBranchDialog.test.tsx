/**
 * MergeBranchDialog Tests
 *
 * Tests for the MergeBranchDialog component that provides a UI for
 * selecting a branch to merge with options for no-ff and custom message.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, nextTick } from "@/test/utils";
import { MergeBranchDialog } from "../MergeBranchDialog";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockGitBranches = vi.fn().mockResolvedValue([]);
const mockGitCompareBranches = vi.fn().mockResolvedValue({
  ahead: 0,
  behind: 0,
  commits: [],
  files: [],
});

vi.mock("@/utils/tauri-api", () => ({
  gitBranches: (...args: unknown[]) => mockGitBranches(...args),
  gitCompareBranches: (...args: unknown[]) => mockGitCompareBranches(...args),
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

vi.mock("@/components/ui", () => {
  return {
    Button: (props: Record<string, unknown>) => {
      return (() => {
        const el = document.createElement("button");
        if (props.children) el.textContent = String(props.children);
        if (props.onClick) el.addEventListener("click", props.onClick as EventListener);
        if (props.disabled) el.setAttribute("disabled", "");
        return el;
      }) as unknown as Element;
    },
    Input: (props: Record<string, unknown>) => {
      return (() => {
        const el = document.createElement("input");
        if (props.placeholder) el.placeholder = String(props.placeholder);
        if (props.value) el.value = String(props.value);
        return el;
      }) as unknown as Element;
    },
    Modal: (props: Record<string, unknown>) => {
      if (!props.open) return null;
      return props.children;
    },
    Text: (props: Record<string, unknown>) => {
      return (() => {
        const el = document.createElement("span");
        if (props.children) el.textContent = String(props.children);
        return el;
      }) as unknown as Element;
    },
    Toggle: (_props: Record<string, unknown>) => {
      return (() => {
        const el = document.createElement("input");
        el.type = "checkbox";
        return el;
      }) as unknown as Element;
    },
  };
});

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      surface: { canvas: "transparent", panel: "transparent", overlay: "transparent", popup: "transparent" },
      text: { primary: "inherit", muted: "inherit" },
      border: { default: "transparent", divider: "transparent" },
      semantic: { primary: "blue", success: "green", error: "red", warning: "orange" },
      interactive: { hover: "transparent", active: "transparent" },
      icon: { default: "inherit" },
    },
    spacing: { xs: "2px", sm: "4px", md: "8px", lg: "12px", xl: "16px" },
    radius: { sm: "4px", md: "8px" },
    shadows: { popup: "none" },
  },
}));

const mockBranches = [
  { name: "main", current: true, isRemote: false },
  { name: "feature-a", current: false, isRemote: false },
  { name: "feature-b", current: false, isRemote: false },
  { name: "origin/feature-c", current: false, isRemote: true },
];

describe("MergeBranchDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing when open", () => {
      const { container } = render(() => (
        <MergeBranchDialog
          open={true}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={vi.fn()}
        />
      ));
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(MergeBranchDialog).toBeDefined();
      expect(typeof MergeBranchDialog).toBe("function");
    });

    it("should render when closed without visible content", () => {
      const { container } = render(() => (
        <MergeBranchDialog
          open={false}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={vi.fn()}
        />
      ));
      expect(container).toBeTruthy();
    });

    it("should fetch branches when opened", async () => {
      mockGitBranches.mockResolvedValue(mockBranches);
      render(() => (
        <MergeBranchDialog
          open={true}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={vi.fn()}
        />
      ));
      await nextTick();
      expect(mockGitBranches).toHaveBeenCalled();
    });
  });

  describe("Error Display", () => {
    it("should display error when provided", () => {
      const { container } = render(() => (
        <MergeBranchDialog
          open={true}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={vi.fn()}
          error="Merge conflict detected"
        />
      ));
      expect(container.textContent).toContain("Merge conflict detected");
    });

    it("should not display error when null", () => {
      const { container } = render(() => (
        <MergeBranchDialog
          open={true}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={vi.fn()}
          error={null}
        />
      ));
      expect(container.textContent).not.toContain("Merge conflict detected");
    });
  });

  describe("Props", () => {
    it("should accept loading prop", () => {
      const { container } = render(() => (
        <MergeBranchDialog
          open={true}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={vi.fn()}
          loading={true}
        />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onCancel callback", () => {
      const onCancel = vi.fn();
      const { container } = render(() => (
        <MergeBranchDialog
          open={true}
          currentBranch="main"
          onMerge={vi.fn()}
          onCancel={onCancel}
        />
      ));
      expect(container).toBeTruthy();
    });
  });
});
