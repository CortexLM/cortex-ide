import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexUpdateFileView } from "../CortexUpdateFileView";
import type { DiffLine, FileUpdate, CortexUpdateFileViewProps } from "../CortexUpdateFileView";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../primitives/CortexButton", () => ({
  CortexButton: (props: { children?: any; onClick?: () => void; variant?: string; size?: string; loading?: boolean; [key: string]: any }) => (
    <button
      data-testid={`button-${props.variant || "default"}`}
      data-variant={props.variant}
      data-size={props.size}
      data-loading={String(props.loading ?? false)}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("@/utils/shikiHighlighter", () => ({
  highlightCode: vi.fn().mockResolvedValue("<pre><code>highlighted</code></pre>"),
  detectLanguageFromPath: vi.fn().mockReturnValue("typescript"),
}));

const createMockUpdate = (overrides?: Partial<FileUpdate>): FileUpdate => ({
  filePath: "src/components/App.tsx",
  oldContent: "const x = 1;",
  newContent: "const x = 2;",
  diffLines: [
    { type: "removed", content: "const x = 1;", lineNumber: 1 },
    { type: "added", content: "const x = 2;", lineNumber: 1 },
    { type: "unchanged", content: "", lineNumber: 2 },
  ],
  ...overrides,
});

describe("CortexUpdateFileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct DiffLine interface structure", () => {
      const line: DiffLine = {
        type: "added",
        content: "new line",
        lineNumber: 5,
      };

      expect(line.type).toBe("added");
      expect(line.content).toBe("new line");
      expect(line.lineNumber).toBe(5);
    });

    it("should have correct FileUpdate interface structure", () => {
      const update: FileUpdate = {
        filePath: "/src/index.ts",
        oldContent: "old",
        newContent: "new",
        diffLines: [{ type: "added", content: "new" }],
        timestamp: new Date("2024-01-01"),
      };

      expect(update.filePath).toBe("/src/index.ts");
      expect(update.diffLines).toHaveLength(1);
      expect(update.timestamp).toBeInstanceOf(Date);
    });

    it("should have correct CortexUpdateFileViewProps interface structure", () => {
      const props: CortexUpdateFileViewProps = {
        update: createMockUpdate(),
        onAccept: vi.fn(),
        onReject: vi.fn(),
        onClose: vi.fn(),
      };

      expect(props.update.filePath).toBe("src/components/App.tsx");
      expect(typeof props.onAccept).toBe("function");
      expect(typeof props.onReject).toBe("function");
      expect(typeof props.onClose).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render file name from path", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("App.tsx");
    });

    it("should render directory path", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("src/components");
    });

    it("should render file icon", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      const fileIcon = container.querySelector('[data-testid="icon-file"]');
      expect(fileIcon).toBeTruthy();
    });

    it("should render additions count", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("+1");
    });

    it("should render deletions count", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("-1");
    });

    it("should render diff lines with correct prefixes", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      const spans = Array.from(container.querySelectorAll("span"));
      const prefixes = spans.filter((s) => s.textContent === "+" || s.textContent === "-" || s.textContent === " ");
      expect(prefixes.length).toBeGreaterThanOrEqual(3);
    });

    it("should render diff line content", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("const x = 1;");
      expect(container.textContent).toContain("const x = 2;");
    });

    it("should render line numbers", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("1");
    });

    it("should render Apply Changes button", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("Apply Changes");
    });

    it("should render Discard button", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      expect(container.textContent).toContain("Discard");
    });

    it("should handle file with no directory path", () => {
      const update = createMockUpdate({ filePath: "README.md" });
      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));
      expect(container.textContent).toContain("README.md");
    });

    it("should handle windows-style paths", () => {
      const update = createMockUpdate({ filePath: "src\\components\\App.tsx" });
      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));
      expect(container.textContent).toContain("App.tsx");
      expect(container.textContent).toContain("src/components");
    });
  });

  describe("Show More Lines", () => {
    it("should show 'Show more lines' button when diff has more than 50 lines", () => {
      const manyLines: DiffLine[] = Array.from({ length: 60 }, (_, i) => ({
        type: "unchanged" as const,
        content: `line ${i + 1}`,
        lineNumber: i + 1,
      }));
      const update = createMockUpdate({ diffLines: manyLines });

      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));

      expect(container.textContent).toContain("Show 10 more lines...");
    });

    it("should not show 'Show more' button when diff has 50 or fewer lines", () => {
      const fewLines: DiffLine[] = Array.from({ length: 10 }, (_, i) => ({
        type: "unchanged" as const,
        content: `line ${i + 1}`,
        lineNumber: i + 1,
      }));
      const update = createMockUpdate({ diffLines: fewLines });

      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));

      expect(container.textContent).not.toContain("more lines...");
    });

    it("should expand full diff when 'Show more' is clicked", async () => {
      const manyLines: DiffLine[] = Array.from({ length: 60 }, (_, i) => ({
        type: "unchanged" as const,
        content: `line ${i + 1}`,
        lineNumber: i + 1,
      }));
      const update = createMockUpdate({ diffLines: manyLines });

      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));

      const showMoreButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("more lines")
      );
      expect(showMoreButton).toBeTruthy();

      if (showMoreButton) {
        await fireEvent.click(showMoreButton);
      }

      expect(container.textContent).not.toContain("more lines...");
      expect(container.textContent).toContain("line 60");
    });
  });

  describe("Actions", () => {
    it("should call invoke and onAccept when Apply Changes is clicked", async () => {
      const onAccept = vi.fn();
      vi.mocked(invoke).mockResolvedValue(undefined);

      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} onAccept={onAccept} />
      ));

      const applyButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Apply Changes")
      );
      if (applyButton) {
        await fireEvent.click(applyButton);
      }

      await vi.waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("fs_write_file", {
          path: "src/components/App.tsx",
          content: "const x = 2;",
        });
        expect(onAccept).toHaveBeenCalled();
      });
    });

    it("should call onReject when Discard is clicked", async () => {
      const onReject = vi.fn();

      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} onReject={onReject} />
      ));

      const discardButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.includes("Discard")
      );
      if (discardButton) {
        await fireEvent.click(discardButton);
      }

      expect(onReject).toHaveBeenCalled();
    });

    it("should render close button when onClose is provided", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} onClose={onClose} />
      ));

      const closeIcon = container.querySelector('[data-testid="icon-xmark"]');
      expect(closeIcon).toBeTruthy();
    });

    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} onClose={onClose} />
      ));

      const closeButton = container.querySelector('[data-testid="icon-xmark"]')?.closest("button");
      if (closeButton) {
        await fireEvent.click(closeButton);
      }

      expect(onClose).toHaveBeenCalled();
    });

    it("should not render close button when onClose is not provided", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));

      const closeIcon = container.querySelector('[data-testid="icon-xmark"]');
      expect(closeIcon).toBeFalsy();
    });
  });

  describe("Timestamp", () => {
    it("should show timestamp when provided", () => {
      const timestamp = new Date("2024-06-15T10:30:00");
      const update = createMockUpdate({ timestamp });

      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));

      expect(container.textContent).toContain("Updated");
    });

    it("should not show timestamp when not provided", () => {
      const update = createMockUpdate({ timestamp: undefined });

      const { container } = render(() => (
        <CortexUpdateFileView update={update} />
      ));

      expect(container.textContent).not.toContain("Updated");
    });
  });

  describe("Styling", () => {
    it("should have rounded border", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      const root = container.firstElementChild as HTMLElement;
      const style = root?.getAttribute("style") || "";
      expect(style).toContain("border-radius:var(--cortex-radius-lg)");
    });

    it("should have flex column layout", () => {
      const { container } = render(() => (
        <CortexUpdateFileView update={createMockUpdate()} />
      ));
      const root = container.firstElementChild as HTMLElement;
      const style = root?.getAttribute("style") || "";
      expect(style).toContain("display:flex");
      expect(style).toContain("flex-direction:column");
      expect(style).toContain("height:100%");
    });
  });
});
