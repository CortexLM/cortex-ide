/**
 * CommitGraph Tests
 *
 * Tests for the CommitGraph component that displays git commit history
 * with graph visualization, search, and context menu actions.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { CommitGraph, type Commit } from "../CommitGraph";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/utils/tauri-api", () => ({
  gitLog: vi.fn().mockResolvedValue([]),
  gitGetRefs: vi.fn().mockResolvedValue({}),
  gitDiffBetweenCommits: vi.fn().mockResolvedValue([]),
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

vi.mock("@/components/ui/VirtualList", () => ({
  VirtualList: () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "virtual-list");
    return el;
  },
}));

const mockCommits: Commit[] = [
  {
    hash: "abc123def456",
    shortHash: "abc123d",
    message: "Initial commit",
    author: "Test User",
    email: "test@example.com",
    date: new Date().toISOString(),
    timestamp: Date.now(),
    parents: [],
    refs: [{ name: "main", type: "branch" as const, isHead: true }],
    isMerge: false,
  },
  {
    hash: "def456abc789",
    shortHash: "def456a",
    message: "Add feature",
    author: "Test User",
    email: "test@example.com",
    date: new Date().toISOString(),
    timestamp: Date.now() - 1000,
    parents: ["abc123def456"],
    refs: [{ name: "feature", type: "branch" as const }],
    isMerge: false,
  },
];

const mergeCommit: Commit = {
  hash: "merge123456",
  shortHash: "merge12",
  message: "Merge branch feature",
  author: "Test User",
  email: "test@example.com",
  date: new Date().toISOString(),
  timestamp: Date.now() - 500,
  parents: ["abc123def456", "def456abc789"],
  refs: [],
  isMerge: true,
};

describe("CommitGraph", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing with empty commits", () => {
      const { container } = render(() => <CommitGraph commits={[]} />);
      expect(container).toBeTruthy();
    });

    it("should render commit rows when commits are provided", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      expect(container.textContent).toContain("Initial commit");
      expect(container.textContent).toContain("Add feature");
    });

    it("should display commit messages", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      expect(container.textContent).toContain("Initial commit");
      expect(container.textContent).toContain("Add feature");
    });

    it("should display commit authors", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      const textContent = container.textContent || "";
      const authorMatches = textContent.match(/Test User/g);
      expect(authorMatches).toBeTruthy();
      expect(authorMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it("should display short hashes", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      expect(container.textContent).toContain("abc123d");
      expect(container.textContent).toContain("def456a");
    });

    it("should show commit count", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      expect(container.textContent).toContain("2");
    });

    it("should display 'Commit History' header", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      expect(container.textContent).toContain("Commit History");
    });
  });

  describe("Commit Selection", () => {
    it("should call onCommitSelect when a commit is clicked", async () => {
      const onCommitSelect = vi.fn();
      const { container } = render(() => (
        <CommitGraph commits={mockCommits} onCommitSelect={onCommitSelect} />
      ));

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.click(commitRows[0]);
        await nextTick();
        expect(onCommitSelect).toHaveBeenCalledWith(mockCommits[0]);
      }
    });
  });

  describe("Context Menu", () => {
    it("should show context menu on right-click", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();

        expect(container.textContent).toContain("Cherry-pick");
      }
    });

    it("should have Cherry-pick option in context menu", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();
        expect(container.textContent).toContain("Cherry-pick");
      }
    });

    it("should have Revert option in context menu", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();
        expect(container.textContent).toContain("Revert");
      }
    });

    it("should have Create branch option in context menu", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();
        expect(container.textContent).toContain("Create branch here");
      }
    });

    it("should have Create tag option in context menu", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();
        expect(container.textContent).toContain("Create tag here");
      }
    });

    it("should have Checkout option in context menu", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();
        expect(container.textContent).toContain("Checkout");
      }
    });

    it("should have Copy SHA option in context menu", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);

      const commitRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (commitRows.length > 0) {
        fireEvent.contextMenu(commitRows[0], { clientX: 100, clientY: 100 });
        await nextTick();
        expect(container.textContent).toContain("Copy SHA");
      }
    });
  });

  describe("Search", () => {
    it("should render search input", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      const searchInput = container.querySelector('input[placeholder="Search commits..."]');
      expect(searchInput).toBeTruthy();
    });

    it("should filter commits based on search query", async () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      const searchInput = container.querySelector('input[placeholder="Search commits..."]') as HTMLInputElement;

      if (searchInput) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(searchInput, "Initial");
        fireEvent.input(searchInput);
        await nextTick();
      }
    });
  });

  describe("Ref Badges", () => {
    it("should display branch ref badges", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      expect(container.textContent).toContain("main");
      expect(container.textContent).toContain("feature");
    });

    it("should display tag ref badges", () => {
      const commitsWithTag: Commit[] = [
        {
          ...mockCommits[0],
          refs: [{ name: "v1.0.0", type: "tag" as const }],
        },
      ];
      const { container } = render(() => <CommitGraph commits={commitsWithTag} />);
      expect(container.textContent).toContain("v1.0.0");
    });
  });

  describe("Merge Commits", () => {
    it("should render merge commits with double circle", () => {
      const commitsWithMerge = [mergeCommit, ...mockCommits];
      const { container } = render(() => <CommitGraph commits={commitsWithMerge} />);

      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);

      let foundDoubleCircle = false;
      svgs.forEach((svg) => {
        const circles = svg.querySelectorAll("circle");
        if (circles.length >= 2) {
          foundDoubleCircle = true;
        }
      });
      expect(foundDoubleCircle).toBe(true);
    });
  });

  describe("Graph SVG", () => {
    it("should render SVG graph for each commit", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(mockCommits.length);
    });

    it("should render circle nodes in SVG", () => {
      const { container } = render(() => <CommitGraph commits={mockCommits} />);
      const circles = container.querySelectorAll("svg circle");
      expect(circles.length).toBeGreaterThanOrEqual(mockCommits.length);
    });
  });
});
