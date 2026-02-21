import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { CortexDiffViewer } from "../CortexDiffViewer";
import type { CortexDiffViewerProps } from "../CortexDiffViewer";

const mockGitDiff = vi.fn().mockResolvedValue("");
const mockFsReadFile = vi.fn().mockResolvedValue("");

vi.mock("@/utils/tauri-api", () => ({
  gitDiff: (...args: unknown[]) => mockGitDiff(...args),
  fsReadFile: (...args: unknown[]) => mockFsReadFile(...args),
}));

vi.mock("@/context/MultiRepoContext", () => ({
  useMultiRepo: () => ({
    repositories: () => [{ id: "repo-1", path: "/home/user/project" }],
    activeRepository: () => ({ id: "repo-1", path: "/home/user/project" }),
  }),
}));

import { detectLanguage } from "@/context/editor/languageDetection";

vi.mock("@/context/editor/languageDetection", () => ({
  detectLanguage: vi.fn().mockReturnValue("typescript"),
}));

vi.mock("../CortexGitDiffView", () => ({
  CortexGitDiffView: (props: {
    filePath: string;
    originalContent: string;
    modifiedContent: string;
    language: string;
    staged?: boolean;
    onClose?: () => void;
  }) => (
    <div data-testid="git-diff-view">
      <span data-testid="diff-file-path">{props.filePath}</span>
      <span data-testid="diff-language">{props.language}</span>
      <span data-testid="diff-original">{props.originalContent}</span>
      <span data-testid="diff-modified">{props.modifiedContent}</span>
      <span data-testid="diff-staged">{String(props.staged)}</span>
      <button data-testid="diff-close" onClick={props.onClose}>Close</button>
    </div>
  ),
}));

describe("CortexDiffViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct CortexDiffViewerProps interface structure", () => {
      const props: CortexDiffViewerProps = {
        style: { height: "500px" },
      };

      expect(props.style).toEqual({ height: "500px" });
    });

    it("should accept empty props", () => {
      const props: CortexDiffViewerProps = {};
      expect(props).toBeDefined();
    });
  });

  describe("Rendering", () => {
    it("should render empty state by default", () => {
      const { container } = render(() => <CortexDiffViewer />);
      expect(container.textContent).toContain("Click a file in Source Control to view its diff");
    });

    it("should render as a flex column container", () => {
      const { container } = render(() => <CortexDiffViewer />);
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.display).toBe("flex");
      expect(root?.style.flexDirection).toBe("column");
      expect(root?.style.height).toBe("100%");
    });

    it("should render empty state with folder icon svg", () => {
      const { container } = render(() => <CortexDiffViewer />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("width")).toBe("40");
      expect(svg?.getAttribute("height")).toBe("40");
    });

    it("should not render loading, error, or diff view in initial state", () => {
      const { container } = render(() => <CortexDiffViewer />);
      expect(container.textContent).not.toContain("Loading diff...");
      expect(container.querySelector('[data-testid="git-diff-view"]')).toBeFalsy();
    });
  });

  describe("Custom Event Handling", () => {
    it("should listen for cortex:git:diff events on mount", async () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      render(() => <CortexDiffViewer />);
      expect(addSpy).toHaveBeenCalledWith("cortex:git:diff", expect.any(Function));
    });

    it("should remove event listener on cleanup", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(() => <CortexDiffViewer />);
      unmount();
      expect(removeSpy).toHaveBeenCalledWith("cortex:git:diff", expect.any(Function));
    });

    it("should load diff when cortex:git:diff event is dispatched", async () => {
      mockGitDiff.mockResolvedValue("@@ -1,1 +1,1 @@\n-old\n+new");
      mockFsReadFile.mockResolvedValue("new");

      render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/index.ts", staged: false },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(mockGitDiff).toHaveBeenCalled();
      });
    });

    it("should pass repoId from event detail", async () => {
      mockGitDiff.mockResolvedValue("");
      mockFsReadFile.mockResolvedValue("");

      render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/index.ts", repoId: "repo-1", staged: true },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(mockGitDiff).toHaveBeenCalledWith("/home/user/project", "src/index.ts", true);
      });
    });

    it("should not call loadDiff when event has no path", () => {
      render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: {},
      });
      window.dispatchEvent(event);

      expect(mockGitDiff).not.toHaveBeenCalled();
    });
  });

  describe("Diff Loading", () => {
    it("should show diff view after successful load", async () => {
      mockGitDiff.mockResolvedValue("");
      mockFsReadFile.mockResolvedValue("console.log('hello');");

      const { container } = render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/app.ts" },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="git-diff-view"]')).toBeTruthy();
      });
    });

    it("should pass correct props to CortexGitDiffView", async () => {
      mockGitDiff.mockResolvedValue("");
      mockFsReadFile.mockResolvedValue("const x = 1;");
      vi.mocked(detectLanguage).mockReturnValue("typescript");

      const { container } = render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/main.ts", staged: true },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        const diffView = container.querySelector('[data-testid="diff-file-path"]');
        expect(diffView?.textContent).toBe("src/main.ts");
      });

      expect(container.querySelector('[data-testid="diff-staged"]')?.textContent).toBe("true");
      expect(container.querySelector('[data-testid="diff-language"]')?.textContent).toBe("typescript");
    });

    it("should show error state when loading fails", async () => {
      mockGitDiff.mockRejectedValue(new Error("Git error: not a repository"));
      mockFsReadFile.mockResolvedValue("");

      const { container } = render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/fail.ts" },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Git error: not a repository");
      });
    });

    it("should show error state for non-Error exceptions", async () => {
      mockGitDiff.mockRejectedValue("string error");
      mockFsReadFile.mockResolvedValue("");

      const { container } = render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/fail.ts" },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("string error");
      });
    });
  });

  describe("Close Handling", () => {
    it("should return to empty state when diff view is closed", async () => {
      mockGitDiff.mockResolvedValue("");
      mockFsReadFile.mockResolvedValue("code");

      const { container } = render(() => <CortexDiffViewer />);

      const event = new CustomEvent("cortex:git:diff", {
        detail: { path: "src/app.ts" },
      });
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="git-diff-view"]')).toBeTruthy();
      });

      const closeButton = container.querySelector('[data-testid="diff-close"]') as HTMLButtonElement;
      closeButton.click();

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Click a file in Source Control to view its diff");
      });
    });
  });

  describe("Styling", () => {
    it("should apply custom style prop", () => {
      const { container } = render(() => (
        <CortexDiffViewer style={{ "background-color": "red" }} />
      ));
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.backgroundColor).toBe("red");
    });

    it("should maintain overflow hidden", () => {
      const { container } = render(() => <CortexDiffViewer />);
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.overflow).toBe("hidden");
    });
  });
});
