/**
 * BranchComparison Tests
 *
 * Tests for the BranchComparison component that displays a comparison
 * between two branches including commits, files, and ahead/behind stats.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { BranchComparison } from "../BranchComparison";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockGitCompare = vi.fn().mockResolvedValue({
  ahead: 0,
  behind: 0,
  commits: [],
  files: [],
  totalAdditions: 0,
  totalDeletions: 0,
});

vi.mock("@/utils/tauri-api", () => ({
  gitCompare: (...args: unknown[]) => mockGitCompare(...args),
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

const mockBranches = [
  { name: "main", current: true },
  { name: "feature-a", current: false },
  { name: "feature-b", current: false },
  { name: "develop", current: false },
];

const mockCompareResult = {
  ahead: 3,
  behind: 1,
  commits: [
    {
      hash: "abc123",
      shortHash: "abc123",
      message: "Add new feature",
      author: "Test User",
      date: new Date().toISOString(),
    },
    {
      hash: "def456",
      shortHash: "def456",
      message: "Fix bug in feature",
      author: "Test User",
      date: new Date().toISOString(),
    },
  ],
  files: [
    { path: "src/app.ts", status: "modified", additions: 10, deletions: 5 },
    { path: "src/new.ts", status: "added", additions: 50, deletions: 0 },
    { path: "src/old.ts", status: "deleted", additions: 0, deletions: 30 },
  ],
  totalAdditions: 60,
  totalDeletions: 35,
};

describe("BranchComparison", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(BranchComparison).toBeDefined();
      expect(typeof BranchComparison).toBe("function");
    });

    it("should display Compare Branches header", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));
      expect(container.textContent).toContain("Compare Branches");
    });

    it("should display branch selector placeholders", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));
      expect(container.textContent).toContain("Select base branch");
      expect(container.textContent).toContain("Select compare branch");
    });
  });

  describe("Branch Selection", () => {
    it("should accept baseBranch prop", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} baseBranch="main" />
      ));
      expect(container.textContent).toContain("main");
    });

    it("should accept compareBranch prop", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} compareBranch="feature-a" />
      ));
      expect(container.textContent).toContain("feature-a");
    });

    it("should show base branch dropdown on click", async () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));

      const baseSelector = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Select base branch")
      );
      if (baseSelector) {
        fireEvent.click(baseSelector);
        await nextTick();
        expect(container.textContent).toContain("feature-a");
        expect(container.textContent).toContain("feature-b");
      }
    });

    it("should show compare branch dropdown on click", async () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));

      const compareSelector = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Select compare branch")
      );
      if (compareSelector) {
        fireEvent.click(compareSelector);
        await nextTick();
        expect(container.textContent).toContain("feature-a");
      }
    });

    it("should mark current branch in dropdown", async () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));

      const baseSelector = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Select base branch")
      );
      if (baseSelector) {
        fireEvent.click(baseSelector);
        await nextTick();
        expect(container.textContent).toContain("current");
      }
    });

    it("should fetch comparison when both branches are selected", async () => {
      mockGitCompare.mockResolvedValue(mockCompareResult);
      render(() => (
        <BranchComparison
          branches={mockBranches}
          baseBranch="main"
          compareBranch="feature-a"
        />
      ));
      await nextTick();
      await nextTick();
      expect(mockGitCompare).toHaveBeenCalled();
      expect(mockGitCompare.mock.calls[0][1]).toBe("main");
      expect(mockGitCompare.mock.calls[0][2]).toBe("feature-a");
    });
  });

  describe("Swap Branches", () => {
    it("should render swap button", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));
      const swapBtn = container.querySelector('button[title="Swap branches"]');
      expect(swapBtn).toBeTruthy();
    });
  });

  describe("Comparison Stats", () => {
    it("should display ahead/behind stats", async () => {
      mockGitCompare.mockResolvedValue(mockCompareResult);
      const { container } = render(() => (
        <BranchComparison
          branches={mockBranches}
          baseBranch="main"
          compareBranch="feature-a"
        />
      ));
      await nextTick();
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("3 commits ahead");
      expect(container.textContent).toContain("1 commit behind");
    });

    it("should display total additions and deletions", async () => {
      mockGitCompare.mockResolvedValue(mockCompareResult);
      const { container } = render(() => (
        <BranchComparison
          branches={mockBranches}
          baseBranch="main"
          compareBranch="feature-a"
        />
      ));
      await nextTick();
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("+60");
      expect(container.textContent).toContain("-35");
    });

    it("should display file count", async () => {
      mockGitCompare.mockResolvedValue(mockCompareResult);
      const { container } = render(() => (
        <BranchComparison
          branches={mockBranches}
          baseBranch="main"
          compareBranch="feature-a"
        />
      ));
      await nextTick();
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("3 files");
    });
  });

  describe("View Modes", () => {
    it("should display Commits tab", async () => {
      mockGitCompare.mockResolvedValue(mockCompareResult);
      const { container } = render(() => (
        <BranchComparison
          branches={mockBranches}
          baseBranch="main"
          compareBranch="feature-a"
        />
      ));
      await nextTick();
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("Commits");
    });

    it("should display Files tab", async () => {
      mockGitCompare.mockResolvedValue(mockCompareResult);
      const { container } = render(() => (
        <BranchComparison
          branches={mockBranches}
          baseBranch="main"
          compareBranch="feature-a"
        />
      ));
      await nextTick();
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("Files");
    });
  });

  describe("Close Button", () => {
    it("should render close button when onClose is provided", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} onClose={onClose} />
      ));
      const closeIcon = container.querySelector('[data-icon="xmark"]');
      expect(closeIcon).toBeTruthy();
    });

    it("should not render close button when onClose is not provided", () => {
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} />
      ));
      const buttons = Array.from(container.querySelectorAll("button"));
      const closeButton = buttons.find((btn) => {
        const icon = btn.querySelector('[data-icon="xmark"]');
        return icon !== null;
      });
      expect(closeButton).toBeFalsy();
    });
  });

  describe("Callbacks", () => {
    it("should accept onFileSelect callback", () => {
      const onFileSelect = vi.fn();
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} onFileSelect={onFileSelect} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onMerge callback", () => {
      const onMerge = vi.fn();
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} onMerge={onMerge} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept onCreatePR callback", () => {
      const onCreatePR = vi.fn();
      const { container } = render(() => (
        <BranchComparison branches={mockBranches} onCreatePR={onCreatePR} />
      ));
      expect(container).toBeTruthy();
    });
  });
});
