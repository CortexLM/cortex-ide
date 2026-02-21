import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { CortexSearchPanel } from "../CortexSearchPanel";

vi.mock("@/context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    folders: () => [{ path: "/workspace/project", name: "project" }],
  }),
}));

describe("CortexSearchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Rendering", () => {
    it("should render search input with placeholder", () => {
      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector('input[placeholder="Search"]');
      expect(input).toBeTruthy();
    });

    it("should render the Search header", () => {
      const { container } = render(() => <CortexSearchPanel />);
      expect(container.textContent).toContain("Search");
    });

    it("should render Replace toggle button", () => {
      const { container } = render(() => <CortexSearchPanel />);
      const buttons = container.querySelectorAll("button");
      const replaceBtn = Array.from(buttons).find(
        (b) => b.textContent?.includes("Replace") && !b.textContent?.includes("All")
      );
      expect(replaceBtn).toBeTruthy();
    });

    it("should render Filters toggle button", () => {
      const { container } = render(() => <CortexSearchPanel />);
      const buttons = container.querySelectorAll("button");
      const filtersBtn = Array.from(buttons).find((b) =>
        b.textContent?.includes("Filters")
      );
      expect(filtersBtn).toBeTruthy();
    });

    it("should render filter toggle buttons (Aa, ab, .*)", () => {
      const { container } = render(() => <CortexSearchPanel />);
      const buttons = container.querySelectorAll("button");
      const labels = Array.from(buttons).map((b) => b.textContent?.trim());
      expect(labels).toContain("Aa");
      expect(labels).toContain("ab");
      expect(labels).toContain(".*");
    });
  });

  describe("Search Input", () => {
    it("should update value when typing in search input", async () => {
      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "hello" } });
      expect(input.value).toBe("hello");
    });

    it("should trigger search on Enter key", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        results: [],
        totalMatches: 0,
        filesSearched: 10,
        rootsSearched: 1,
      });

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(invoke).toHaveBeenCalledWith(
        "search_workspace_ripgrep",
        expect.objectContaining({ query: "test" })
      );
    });
  });

  describe("Search Results", () => {
    it("should display results when search returns matches", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        results: [
          {
            file: "/workspace/project/src/main.ts",
            root: "/workspace/project",
            matches: [
              { line: 10, column: 5, text: "const test = 1;", matchStart: 6, matchEnd: 10 },
              { line: 20, column: 3, text: "let test = 2;", matchStart: 4, matchEnd: 8 },
            ],
          },
        ],
        totalMatches: 2,
        filesSearched: 50,
        rootsSearched: 1,
      });

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("2 results in 1 files");
      });

      expect(container.textContent).toContain("main.ts");
    });

    it("should show 'No results found' when search returns empty", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        results: [],
        totalMatches: 0,
        filesSearched: 50,
        rootsSearched: 1,
      });

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "nonexistent" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No results found");
      });
    });

    it("should dispatch editor:goto event when clicking a match", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        results: [
          {
            file: "/workspace/project/src/main.ts",
            root: "/workspace/project",
            matches: [
              { line: 10, column: 5, text: "const test = 1;", matchStart: 6, matchEnd: 10 },
            ],
          },
        ],
        totalMatches: 1,
        filesSearched: 50,
        rootsSearched: 1,
      });

      const gotoHandler = vi.fn();
      window.addEventListener("editor:goto", gotoHandler);

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("main.ts");
      });

      const matchRow = container.querySelector(".sp-match-row") as HTMLElement;
      expect(matchRow).toBeTruthy();
      await fireEvent.click(matchRow);

      expect(gotoHandler).toHaveBeenCalled();
      const detail = (gotoHandler.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.file).toBe("/workspace/project/src/main.ts");
      expect(detail.line).toBe(10);
      expect(detail.column).toBe(5);

      window.removeEventListener("editor:goto", gotoHandler);
    });

    it("should toggle file expansion when clicking file row", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        results: [
          {
            file: "/workspace/project/src/main.ts",
            root: "/workspace/project",
            matches: [
              { line: 10, column: 5, text: "const test = 1;", matchStart: 6, matchEnd: 10 },
            ],
          },
        ],
        totalMatches: 1,
        filesSearched: 50,
        rootsSearched: 1,
      });

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("main.ts");
      });

      const matchRow = container.querySelector(".sp-match-row");
      expect(matchRow).toBeTruthy();

      const fileRow = container.querySelector(".sp-file-row") as HTMLElement;
      await fireEvent.click(fileRow);

      expect(container.querySelector(".sp-match-row")).toBeNull();

      await fireEvent.click(fileRow);
      expect(container.querySelector(".sp-match-row")).toBeTruthy();
    });
  });

  describe("Search Filters", () => {
    it("should toggle case sensitive filter", async () => {
      const { container } = render(() => <CortexSearchPanel />);
      const aaBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Aa" && b.title === "Match Case"
      ) as HTMLButtonElement;

      expect(aaBtn).toBeTruthy();
      expect(aaBtn.style.borderColor).not.toBe("var(--cortex-accent-primary)");

      await fireEvent.click(aaBtn);

      const updatedBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Aa" && b.title === "Match Case"
      ) as HTMLButtonElement;
      expect(updatedBtn.style.border).toContain("var(--cortex-accent-primary)");
    });

    it("should toggle whole word filter", async () => {
      const { container } = render(() => <CortexSearchPanel />);
      const abBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "ab" && b.title === "Match Whole Word"
      ) as HTMLButtonElement;

      expect(abBtn).toBeTruthy();

      await fireEvent.click(abBtn);

      const updatedBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "ab" && b.title === "Match Whole Word"
      ) as HTMLButtonElement;
      expect(updatedBtn.style.border).toContain("var(--cortex-accent-primary)");
    });

    it("should toggle regex filter", async () => {
      const { container } = render(() => <CortexSearchPanel />);
      const regexBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === ".*" && b.title === "Use Regex"
      ) as HTMLButtonElement;

      expect(regexBtn).toBeTruthy();

      await fireEvent.click(regexBtn);

      const updatedBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === ".*" && b.title === "Use Regex"
      ) as HTMLButtonElement;
      expect(updatedBtn.style.border).toContain("var(--cortex-accent-primary)");
    });

    it("should pass filter options to search invoke", async () => {
      vi.mocked(invoke).mockResolvedValue({
        results: [],
        totalMatches: 0,
        filesSearched: 10,
        rootsSearched: 1,
      });

      const { container } = render(() => <CortexSearchPanel />);

      const aaBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Aa" && b.title === "Match Case"
      ) as HTMLButtonElement;
      await fireEvent.click(aaBtn);

      const abBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "ab" && b.title === "Match Whole Word"
      ) as HTMLButtonElement;
      await fireEvent.click(abBtn);

      const regexBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === ".*" && b.title === "Use Regex"
      ) as HTMLButtonElement;
      await fireEvent.click(regexBtn);

      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;
      await fireEvent.input(input, { target: { value: "query" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(invoke).toHaveBeenCalledWith(
        "search_workspace_ripgrep",
        expect.objectContaining({
          query: "query",
          caseSensitive: true,
          wholeWord: true,
          regex: true,
        })
      );
    });
  });

  describe("Replace Mode", () => {
    it("should show replace input when replace mode is enabled", async () => {
      const { container } = render(() => <CortexSearchPanel />);

      expect(container.querySelector('input[placeholder="Replace"]')).toBeNull();

      const replaceBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Replace") && !b.textContent?.includes("All")
      ) as HTMLButtonElement;
      await fireEvent.click(replaceBtn);

      expect(
        container.querySelector('input[placeholder="Replace"]')
      ).toBeTruthy();
    });

    it("should show Replace All button when replace mode is enabled", async () => {
      const { container } = render(() => <CortexSearchPanel />);

      const replaceBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Replace") && !b.textContent?.includes("All")
      ) as HTMLButtonElement;
      await fireEvent.click(replaceBtn);

      const replaceAllBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Replace All"
      );
      expect(replaceAllBtn).toBeTruthy();
    });

    it("should hide replace input when toggled off", async () => {
      const { container } = render(() => <CortexSearchPanel />);

      const replaceBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Replace") && !b.textContent?.includes("All")
      ) as HTMLButtonElement;

      await fireEvent.click(replaceBtn);
      expect(
        container.querySelector('input[placeholder="Replace"]')
      ).toBeTruthy();

      await fireEvent.click(replaceBtn);
      expect(container.querySelector('input[placeholder="Replace"]')).toBeNull();
    });
  });

  describe("Filters Section", () => {
    it("should show include/exclude inputs when Filters section is toggled", async () => {
      const { container } = render(() => <CortexSearchPanel />);

      expect(
        container.querySelector('input[placeholder*="include"]')
      ).toBeNull();
      expect(
        container.querySelector('input[placeholder*="exclude"]')
      ).toBeNull();

      const filtersBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Filters")
      ) as HTMLButtonElement;
      await fireEvent.click(filtersBtn);

      expect(
        container.querySelector('input[placeholder*="include"]')
      ).toBeTruthy();
      expect(
        container.querySelector('input[placeholder*="exclude"]')
      ).toBeTruthy();
    });

    it("should hide include/exclude inputs when Filters section is toggled off", async () => {
      const { container } = render(() => <CortexSearchPanel />);

      const filtersBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Filters")
      ) as HTMLButtonElement;

      await fireEvent.click(filtersBtn);
      expect(
        container.querySelector('input[placeholder*="include"]')
      ).toBeTruthy();

      await fireEvent.click(filtersBtn);
      expect(
        container.querySelector('input[placeholder*="include"]')
      ).toBeNull();
    });

    it("should pass include/exclude patterns to search invoke", async () => {
      vi.mocked(invoke).mockResolvedValue({
        results: [],
        totalMatches: 0,
        filesSearched: 10,
        rootsSearched: 1,
      });

      const { container } = render(() => <CortexSearchPanel />);

      const filtersBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Filters")
      ) as HTMLButtonElement;
      await fireEvent.click(filtersBtn);

      const includeInput = container.querySelector(
        'input[placeholder*="include"]'
      ) as HTMLInputElement;
      const excludeInput = container.querySelector(
        'input[placeholder*="exclude"]'
      ) as HTMLInputElement;

      await fireEvent.input(includeInput, { target: { value: "*.ts, *.tsx" } });
      await fireEvent.input(excludeInput, {
        target: { value: "node_modules" },
      });

      const searchInput = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: "query" } });
      await fireEvent.keyDown(searchInput, { key: "Enter" });

      expect(invoke).toHaveBeenCalledWith(
        "search_workspace_ripgrep",
        expect.objectContaining({
          includePatterns: ["*.ts", "*.tsx"],
          excludePatterns: ["node_modules"],
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should show error when no workspace folders are open", async () => {
      const mod = await import("@/context/WorkspaceContext");
      const spy = vi.spyOn(mod, "useWorkspace").mockReturnValue({
        folders: () => [],
      } as any);

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No workspace folders open");
      });

      spy.mockRestore();
    });

    it("should show error when search fails", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Search failed"));

      const { container } = render(() => <CortexSearchPanel />);
      const input = container.querySelector(
        'input[placeholder="Search"]'
      ) as HTMLInputElement;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Search failed");
      });
    });
  });
});
