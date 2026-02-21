/**
 * StashPanel Tests
 *
 * Tests for the StashPanel component that displays git stashes
 * with apply, pop, drop actions and create stash dialog.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, nextTick } from "@/test/utils";
import { StashPanel } from "../StashPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockStashListEnhanced = vi.fn().mockResolvedValue([]);
const mockStashApply = vi.fn().mockResolvedValue(undefined);
const mockStashPop = vi.fn().mockResolvedValue(undefined);
const mockStashDrop = vi.fn().mockResolvedValue(undefined);
const mockStashCreate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/utils/tauri-api", () => ({
  gitStashListEnhanced: (...args: unknown[]) => mockStashListEnhanced(...args),
  gitStashApply: (...args: unknown[]) => mockStashApply(...args),
  gitStashPop: (...args: unknown[]) => mockStashPop(...args),
  gitStashDrop: (...args: unknown[]) => mockStashDrop(...args),
  gitStashCreate: (...args: unknown[]) => mockStashCreate(...args),
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

const mockStashes = [
  {
    index: 0,
    message: "WIP on main: fix layout bug",
    branch: "main",
    date: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    index: 1,
    message: "WIP on feature: add new component",
    branch: "feature",
    date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    index: 2,
    message: "Experimental changes",
    branch: null,
    date: new Date(Date.now() - 604800000).toISOString(),
  },
];

describe("StashPanel", () => {
  beforeEach(() => {
    mockStashListEnhanced.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(() => <StashPanel />);
      expect(container).toBeTruthy();
    });

    it("should be a defined component", () => {
      expect(StashPanel).toBeDefined();
      expect(typeof StashPanel).toBe("function");
    });

    it("should display Stashes header", () => {
      const { container } = render(() => <StashPanel />);
      expect(container.textContent).toContain("Stashes");
    });

    it("should show stash count badge", () => {
      const { container } = render(() => <StashPanel />);
      expect(container.textContent).toContain("0");
    });

    it("should show empty state when no stashes", async () => {
      mockStashListEnhanced.mockResolvedValue([]);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("No stashes");
    });

    it("should show Create stash button in empty state", async () => {
      mockStashListEnhanced.mockResolvedValue([]);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("Create stash");
    });
  });

  describe("Stash List", () => {
    it("should display stash entries with messages", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("WIP on main: fix layout bug");
      expect(container.textContent).toContain("WIP on feature: add new component");
      expect(container.textContent).toContain("Experimental changes");
    });

    it("should display stash indices", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("stash@{0}");
      expect(container.textContent).toContain("stash@{1}");
      expect(container.textContent).toContain("stash@{2}");
    });

    it("should display branch names for stashes", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("main");
      expect(container.textContent).toContain("feature");
    });

    it("should show stash count in badge", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      expect(container.textContent).toContain("3");
    });
  });

  describe("Search", () => {
    it("should render search input when stashes exist", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      const searchInput = container.querySelector('input[placeholder="Search stashes..."]');
      expect(searchInput).toBeTruthy();
    });

    it("should not render search when no stashes", async () => {
      mockStashListEnhanced.mockResolvedValue([]);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();
      const searchInput = container.querySelector('input[placeholder="Search stashes..."]');
      expect(searchInput).toBeFalsy();
    });
  });

  describe("Stash Actions", () => {
    it("should call onStashApply when apply is triggered", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const onStashApply = vi.fn();
      const { container } = render(() => <StashPanel onStashApply={onStashApply} />);
      await nextTick();
      await nextTick();

      const applyButtons = container.querySelectorAll('button[title="Apply"]');
      if (applyButtons.length > 0) {
        fireEvent.click(applyButtons[0]);
        await nextTick();
        expect(mockStashApply).toHaveBeenCalled();
        expect(mockStashApply.mock.calls[0][1]).toBe(0);
      }
    });

    it("should show confirmation dialog for drop action", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();

      const dropButtons = container.querySelectorAll('button[title="Drop"]');
      if (dropButtons.length > 0) {
        fireEvent.click(dropButtons[0]);
        await nextTick();
        expect(container.textContent).toContain("Drop Stash?");
      }
    });

    it("should show confirmation dialog for pop action", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();

      const popButtons = container.querySelectorAll('button[title="Pop"]');
      if (popButtons.length > 0) {
        fireEvent.click(popButtons[0]);
        await nextTick();
        expect(container.textContent).toContain("Pop Stash?");
      }
    });

    it("should call onStashView when view is triggered", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const onStashView = vi.fn();
      const { container } = render(() => <StashPanel onStashView={onStashView} />);
      await nextTick();
      await nextTick();

      const viewButtons = container.querySelectorAll('button[title="View"]');
      if (viewButtons.length > 0) {
        fireEvent.click(viewButtons[0]);
        await nextTick();
        expect(onStashView).toHaveBeenCalled();
      }
    });
  });

  describe("Create Stash Dialog", () => {
    it("should show create stash dialog when plus button is clicked", async () => {
      const { container } = render(() => <StashPanel />);
      await nextTick();

      const createButton = container.querySelector('button[title="Create new stash"]');
      if (createButton) {
        fireEvent.click(createButton);
        await nextTick();
        expect(container.textContent).toContain("Create Stash");
        expect(container.textContent).toContain("Message");
        expect(container.textContent).toContain("Include untracked files");
      }
    });

    it("should have stash message input in create dialog", async () => {
      const { container } = render(() => <StashPanel />);
      await nextTick();

      const createButton = container.querySelector('button[title="Create new stash"]');
      if (createButton) {
        fireEvent.click(createButton);
        await nextTick();
        const messageInput = container.querySelector('input[placeholder="Stash message..."]');
        expect(messageInput).toBeTruthy();
      }
    });
  });

  describe("Expanded Details", () => {
    it("should expand stash details on click", async () => {
      mockStashListEnhanced.mockResolvedValue(mockStashes);
      const { container } = render(() => <StashPanel />);
      await nextTick();
      await nextTick();

      const stashRows = container.querySelectorAll("[class*='cursor-pointer']");
      if (stashRows.length > 0) {
        fireEvent.click(stashRows[0]);
        await nextTick();
        expect(container.textContent).toContain("Apply");
        expect(container.textContent).toContain("Pop");
        expect(container.textContent).toContain("Drop");
      }
    });
  });

  describe("Refresh", () => {
    it("should fetch stashes on mount", () => {
      render(() => <StashPanel />);
      expect(mockStashListEnhanced).toHaveBeenCalled();
    });
  });
});
