import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { CortexGitPanel } from "../CortexGitPanel";

const mockMultiRepo = {
  activeRepository: vi.fn(),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  unstageFiles: vi.fn().mockResolvedValue(undefined),
  stageAll: vi.fn().mockResolvedValue(undefined),
  unstageAll: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(true),
  pull: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue(undefined),
  discardChanges: vi.fn().mockResolvedValue(undefined),
  refreshRepository: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
};

const mockGitStashListEnhanced = vi.fn().mockResolvedValue([]);
const mockGitStashCreate = vi.fn().mockResolvedValue(undefined);
const mockGitStashPop = vi.fn().mockResolvedValue(undefined);
const mockGitStashDrop = vi.fn().mockResolvedValue(undefined);

vi.mock("@/context/MultiRepoContext", () => ({
  useMultiRepo: () => mockMultiRepo,
}));

vi.mock("@/utils/tauri-api", () => ({
  gitStashListEnhanced: (...args: unknown[]) => mockGitStashListEnhanced(...args),
  gitStashCreate: (...args: unknown[]) => mockGitStashCreate(...args),
  gitStashPop: (...args: unknown[]) => mockGitStashPop(...args),
  gitStashDrop: (...args: unknown[]) => mockGitStashDrop(...args),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string; style?: Record<string, string> }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: { icon: string; size?: number; onClick?: (e: MouseEvent) => void; disabled?: boolean }) => (
    <button data-testid={`icon-btn-${props.icon}`} onClick={props.onClick} disabled={props.disabled}>
      {props.icon}
    </button>
  ),
}));

vi.mock("../primitives/CortexDropdown", () => ({
  CortexDropdown: (props: { options?: unknown[]; value?: string; onChange?: (v: string) => void; placeholder?: string }) => (
    <select data-testid="branch-dropdown" value={props.value} onChange={(e) => props.onChange?.(e.currentTarget.value)}>
      <option>{props.placeholder}</option>
    </select>
  ),
}));

vi.mock("../primitives/CortexDropdownMenu", () => ({
  CortexDropdownMenu: (props: { children?: JSX.Element; width?: number; style?: Record<string, string> }) => (
    <div data-testid="dropdown-menu">{props.children}</div>
  ),
}));

vi.mock("../primitives/CortexDropdownItem", () => ({
  CortexDropdownItem: (props: { label: string; onClick?: (e: MouseEvent) => void }) => (
    <button data-testid={`dropdown-item-${props.label}`} onClick={props.onClick}>
      {props.label}
    </button>
  ),
}));

vi.mock("../primitives/CortexTooltip", () => ({
  CortexTooltip: (props: { content: string; children: JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
}));

function createMockRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: "repo-1",
    path: "/test/repo",
    name: "test-repo",
    branch: "main",
    branches: [{ name: "main", current: true }, { name: "develop", current: false }],
    remotes: [],
    stagedFiles: [],
    unstagedFiles: [],
    conflictFiles: [],
    stashes: [],
    ahead: 0,
    behind: 0,
    headSha: "abc123",
    isMerging: false,
    isRebasing: false,
    status: "idle" as const,
    lastError: null,
    lastRefresh: Date.now(),
    ...overrides,
  };
}

describe("CortexGitPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockMultiRepo.activeRepository.mockReturnValue(createMockRepo());
  });

  describe("Rendering", () => {
    it("should render 'Source Control' header", () => {
      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("Source Control");
    });

    it("should render without crashing when no active repository", () => {
      mockMultiRepo.activeRepository.mockReturnValue(null);
      const { container } = render(() => <CortexGitPanel />);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Source Control");
    });
  });

  describe("Staged Files Section", () => {
    it("should show staged files section with correct count", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
            { path: "src/app.ts", status: "added", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("Staged Changes");
      expect(container.textContent).toContain("2");
    });

    it("should display staged file names", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("index.ts");
    });
  });

  describe("Unstaged/Changes Section", () => {
    it("should show unstaged/changes section with correct count", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/a.ts", status: "modified", staged: false },
            { path: "src/b.ts", status: "deleted", staged: false },
            { path: "src/c.ts", status: "untracked", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("Changes");
      expect(container.textContent).toContain("3");
    });

    it("should display unstaged file names", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/utils.ts", status: "modified", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("utils.ts");
    });
  });

  describe("Commit Message Input", () => {
    it("should have a commit message input with placeholder", () => {
      const { container } = render(() => <CortexGitPanel />);
      const input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      expect(input).toBeTruthy();
    });

    it("should update commit message on input", async () => {
      const { container } = render(() => <CortexGitPanel />);
      const input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      expect(input).toBeTruthy();

      await fireEvent.input(input, { target: { value: "fix: update tests" } });
      expect(input.value).toBe("fix: update tests");
    });
  });

  describe("Commit Button", () => {
    it("should call multiRepo.commit with message when commit button is clicked", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "feat: add feature" } });

      const commitButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Commit")
      );
      expect(commitButton).toBeTruthy();

      await fireEvent.click(commitButton!);
      expect(mockMultiRepo.commit).toHaveBeenCalledWith("repo-1", "feat: add feature");
    });

    it("should not call commit when message is empty", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const commitButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Commit")
      );
      await fireEvent.click(commitButton!);
      expect(mockMultiRepo.commit).not.toHaveBeenCalled();
    });

    it("should not call commit when no staged files", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(createMockRepo());

      const { container } = render(() => <CortexGitPanel />);
      const input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "some message" } });

      const commitButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Commit")
      );
      await fireEvent.click(commitButton!);
      expect(mockMultiRepo.commit).not.toHaveBeenCalled();
    });

    it("should clear commit message after successful commit", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "feat: something" } });

      const commitButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Commit")
      );
      await fireEvent.click(commitButton!);
      expect(input.value).toBe("");
    });
  });

  describe("Stage/Unstage Individual Files", () => {
    it("should call stageFiles when stage button is clicked on an unstaged file", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/file.ts", status: "modified", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const stageButtons = container.querySelectorAll("[data-testid='icon-btn-plus']");
      const fileRowStageBtn = Array.from(stageButtons).find((btn) => {
        const row = btn.closest(".cortex-git-file-row");
        return row !== null;
      });
      expect(fileRowStageBtn).toBeTruthy();

      await fireEvent.click(fileRowStageBtn!);
      expect(mockMultiRepo.stageFiles).toHaveBeenCalledWith("repo-1", ["src/file.ts"]);
    });

    it("should call unstageFiles when unstage button is clicked on a staged file", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/staged.ts", status: "added", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const unstageButtons = container.querySelectorAll("[data-testid='icon-btn-minus']");
      const fileRowUnstageBtn = Array.from(unstageButtons).find((btn) => {
        const row = btn.closest(".cortex-git-file-row");
        return row !== null;
      });
      expect(fileRowUnstageBtn).toBeTruthy();

      await fireEvent.click(fileRowUnstageBtn!);
      expect(mockMultiRepo.unstageFiles).toHaveBeenCalledWith("repo-1", ["src/staged.ts"]);
    });
  });

  describe("Stage All Button", () => {
    it("should call stageAll when stage all button is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);
      const stageAllTooltips = container.querySelectorAll("[data-tooltip='Stage All']");
      expect(stageAllTooltips.length).toBeGreaterThan(0);

      const btn = stageAllTooltips[0].querySelector("button");
      expect(btn).toBeTruthy();
      await fireEvent.click(btn!);
      expect(mockMultiRepo.stageAll).toHaveBeenCalledWith("repo-1");
    });
  });

  describe("Refresh Button", () => {
    it("should call refreshRepository when refresh button is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);
      const refreshTooltip = container.querySelector("[data-tooltip='Refresh']");
      expect(refreshTooltip).toBeTruthy();

      const btn = refreshTooltip!.querySelector("button");
      expect(btn).toBeTruthy();
      await fireEvent.click(btn!);
      expect(mockMultiRepo.refreshRepository).toHaveBeenCalledWith("repo-1");
    });
  });

  describe("Dots Menu (More Actions)", () => {
    it("should open dots menu when more actions button is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);

      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeNull();

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      const moreBtn = moreTooltip!.querySelector("button");
      await fireEvent.click(moreBtn!);

      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeTruthy();
    });

    it("should close dots menu when more actions button is clicked again", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      const moreBtn = moreTooltip!.querySelector("button");

      await fireEvent.click(moreBtn!);
      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeTruthy();

      await fireEvent.click(moreBtn!);
      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeNull();
    });

    it("should call pull when Pull menu item is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      await fireEvent.click(moreTooltip!.querySelector("button")!);

      const pullItem = container.querySelector("[data-testid='dropdown-item-Pull']");
      expect(pullItem).toBeTruthy();
      await fireEvent.click(pullItem!);
      expect(mockMultiRepo.pull).toHaveBeenCalledWith("repo-1");
    });

    it("should call push when Push menu item is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      await fireEvent.click(moreTooltip!.querySelector("button")!);

      const pushItem = container.querySelector("[data-testid='dropdown-item-Push']");
      expect(pushItem).toBeTruthy();
      await fireEvent.click(pushItem!);
      expect(mockMultiRepo.push).toHaveBeenCalledWith("repo-1");
    });

    it("should call fetch when Fetch menu item is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      await fireEvent.click(moreTooltip!.querySelector("button")!);

      const fetchItem = container.querySelector("[data-testid='dropdown-item-Fetch']");
      expect(fetchItem).toBeTruthy();
      await fireEvent.click(fetchItem!);
      expect(mockMultiRepo.fetch).toHaveBeenCalledWith("repo-1");
    });

    it("should call stash create when Stash menu item is clicked", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      await fireEvent.click(moreTooltip!.querySelector("button")!);

      const stashItem = container.querySelector("[data-testid='dropdown-item-Stash']");
      expect(stashItem).toBeTruthy();
      await fireEvent.click(stashItem!);

      await vi.waitFor(() => {
        expect(mockGitStashCreate).toHaveBeenCalledWith("/test/repo", "", true);
      });
    });
  });

  describe("Click Outside Closes Dots Menu", () => {
    it("should close dots menu when clicking outside", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      await fireEvent.click(moreTooltip!.querySelector("button")!);
      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeTruthy();

      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeNull();
    });

    it("should not close dots menu when clicking inside the menu ref", async () => {
      const { container } = render(() => <CortexGitPanel />);

      const moreTooltip = container.querySelector("[data-tooltip='More Actions']");
      const moreBtn = moreTooltip!.querySelector("button")!;
      await fireEvent.click(moreBtn);
      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeTruthy();

      const dotsRefDiv = moreTooltip!.parentElement!;
      dotsRefDiv.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      expect(container.querySelector("[data-testid='dropdown-menu']")).toBeTruthy();
    });
  });

  describe("Stash Section", () => {
    it("should load and display stashes when stash section is expanded", async () => {
      mockGitStashListEnhanced.mockResolvedValue([
        { index: 0, message: "WIP on main", date: "2024-01-01", branch: "main" },
        { index: 1, message: "feature work", date: "2024-01-02", branch: "develop" },
      ]);

      const { container } = render(() => <CortexGitPanel />);

      const stashesHeader = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent === "Stashes"
      );
      expect(stashesHeader).toBeTruthy();

      const headerRow = stashesHeader!.closest("div[style]")!;
      await fireEvent.click(headerRow);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("stash@{0}");
        expect(container.textContent).toContain("WIP on main");
        expect(container.textContent).toContain("stash@{1}");
        expect(container.textContent).toContain("feature work");
      });
    });

    it("should show 'No stashes' when stash list is empty", async () => {
      mockGitStashListEnhanced.mockResolvedValue([]);

      const { container } = render(() => <CortexGitPanel />);

      const stashesHeader = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent === "Stashes"
      );
      const headerRow = stashesHeader!.closest("div[style]")!;
      await fireEvent.click(headerRow);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No stashes");
      });
    });
  });

  describe("Error State / No Repository", () => {
    it("should render gracefully when no active repository is available", () => {
      mockMultiRepo.activeRepository.mockReturnValue(null);
      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("Source Control");
      expect(container.textContent).toContain("Changes");
      expect(container.textContent).toContain("Staged Changes");
    });

    it("should not call any actions when no repository is active", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(null);
      const { container } = render(() => <CortexGitPanel />);

      const refreshTooltip = container.querySelector("[data-tooltip='Refresh']");
      await fireEvent.click(refreshTooltip!.querySelector("button")!);
      expect(mockMultiRepo.refreshRepository).not.toHaveBeenCalled();

      const stageAllTooltip = container.querySelectorAll("[data-tooltip='Stage All']")[0];
      await fireEvent.click(stageAllTooltip!.querySelector("button")!);
      expect(mockMultiRepo.stageAll).not.toHaveBeenCalled();
    });

    it("should render when repository has a lastError", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({ lastError: "Failed to fetch remote" })
      );
      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("Source Control");
    });
  });

  describe("Amend Checkbox", () => {
    it("should toggle amend mode when checkbox is clicked", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);

      const commitButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Commit")
      );
      expect(commitButton!.textContent).toContain("Commit");
      expect(commitButton!.textContent).not.toContain("Amend");

      const amendCheckbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
      expect(amendCheckbox).toBeTruthy();

      await fireEvent.click(amendCheckbox);

      const amendButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Amend")
      );
      expect(amendButton).toBeTruthy();
    });

    it("should change placeholder when amend is toggled", async () => {
      const { container } = render(() => <CortexGitPanel />);

      let input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      expect(input).toBeTruthy();

      const amendCheckbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
      await fireEvent.click(amendCheckbox);

      const amendInput = container.querySelector("input[placeholder*='Amend commit message']") as HTMLInputElement;
      expect(amendInput).toBeTruthy();
    });
  });

  describe("Status Letters and Colors", () => {
    it("should render correct status letter 'M' for modified files", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/modified.ts", status: "modified", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const fileRows = container.querySelectorAll(".cortex-git-file-row");
      expect(fileRows.length).toBeGreaterThan(0);

      const statusSpan = fileRows[0].querySelector("span[style*='font-weight']");
      expect(statusSpan).toBeTruthy();
      expect(statusSpan!.textContent).toBe("M");
      expect((statusSpan as HTMLElement).style.color).toBe("var(--cortex-git-modified)");
    });

    it("should render correct status letter 'A' for added files", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/new.ts", status: "added", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const fileRows = container.querySelectorAll(".cortex-git-file-row");
      const statusSpan = fileRows[0].querySelector("span[style*='font-weight']");
      expect(statusSpan!.textContent).toBe("A");
      expect((statusSpan as HTMLElement).style.color).toBe("var(--cortex-git-added)");
    });

    it("should render correct status letter 'D' for deleted files", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/removed.ts", status: "deleted", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const fileRows = container.querySelectorAll(".cortex-git-file-row");
      const statusSpan = fileRows[0].querySelector("span[style*='font-weight']");
      expect(statusSpan!.textContent).toBe("D");
      expect((statusSpan as HTMLElement).style.color).toBe("var(--cortex-git-deleted)");
    });

    it("should render correct status letter 'R' for renamed files", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/renamed.ts", status: "renamed", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const fileRows = container.querySelectorAll(".cortex-git-file-row");
      const statusSpan = fileRows[0].querySelector("span[style*='font-weight']");
      expect(statusSpan!.textContent).toBe("R");
      expect((statusSpan as HTMLElement).style.color).toBe("var(--cortex-git-renamed)");
    });

    it("should render correct status letter '?' for untracked files", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/new-file.ts", status: "untracked", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const fileRows = container.querySelectorAll(".cortex-git-file-row");
      const statusSpan = fileRows[0].querySelector("span[style*='font-weight']");
      expect(statusSpan!.textContent).toBe("?");
      expect((statusSpan as HTMLElement).style.color).toBe("var(--cortex-git-untracked)");
    });

    it("should render correct status letter 'U' for conflict files", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/conflict.ts", status: "conflict", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const fileRows = container.querySelectorAll(".cortex-git-file-row");
      const statusSpan = fileRows[0].querySelector("span[style*='font-weight']");
      expect(statusSpan!.textContent).toBe("U");
      expect((statusSpan as HTMLElement).style.color).toBe("var(--cortex-git-conflict)");
    });
  });

  describe("Total Changes Footer", () => {
    it("should show total changes count when there are changes", () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/a.ts", status: "modified", staged: true },
          ],
          unstagedFiles: [
            { path: "src/b.ts", status: "added", staged: false },
            { path: "src/c.ts", status: "deleted", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).toContain("Total Changes: 3");
    });

    it("should not show total changes when there are no changes", () => {
      mockMultiRepo.activeRepository.mockReturnValue(createMockRepo());

      const { container } = render(() => <CortexGitPanel />);
      expect(container.textContent).not.toContain("Total Changes");
    });
  });

  describe("Ctrl+Enter Commit Shortcut", () => {
    it("should commit when Ctrl+Enter is pressed in input", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/index.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const input = container.querySelector("input[placeholder*='Commit message']") as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "feat: shortcut commit" } });

      await fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

      expect(mockMultiRepo.commit).toHaveBeenCalledWith("repo-1", "feat: shortcut commit");
    });
  });

  describe("Discard Changes", () => {
    it("should call discardChanges when discard button is clicked on an unstaged file", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          unstagedFiles: [
            { path: "src/file.ts", status: "modified", staged: false },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const discardBtn = container.querySelector("[data-testid='icon-btn-reverse-left']");
      expect(discardBtn).toBeTruthy();

      await fireEvent.click(discardBtn!);
      expect(mockMultiRepo.discardChanges).toHaveBeenCalledWith("repo-1", ["src/file.ts"]);
    });
  });

  describe("Unstage All Button", () => {
    it("should call unstageAll when unstage all button is clicked", async () => {
      mockMultiRepo.activeRepository.mockReturnValue(
        createMockRepo({
          stagedFiles: [
            { path: "src/a.ts", status: "modified", staged: true },
          ],
        })
      );

      const { container } = render(() => <CortexGitPanel />);
      const unstageAllTooltip = container.querySelector("[data-tooltip='Unstage All']");
      expect(unstageAllTooltip).toBeTruthy();

      const btn = unstageAllTooltip!.querySelector("button");
      await fireEvent.click(btn!);
      expect(mockMultiRepo.unstageAll).toHaveBeenCalledWith("repo-1");
    });
  });
});
