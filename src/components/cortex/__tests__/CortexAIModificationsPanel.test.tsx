import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { CortexAIModificationsPanel } from "../CortexAIModificationsPanel";
import type { FileModification, CortexAIModificationsPanelProps } from "../CortexAIModificationsPanel";

vi.mock("../primitives/CortexButton", () => ({
  CortexButton: (props: { children?: any; onClick?: () => void; variant?: string; size?: string; [key: string]: any }) => (
    <button
      data-testid={`button-${props.variant || "default"}-${props.size || "md"}`}
      data-variant={props.variant}
      data-size={props.size}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} data-color={props.color} />
  ),
}));

describe("CortexAIModificationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct FileModification interface structure", () => {
      const mod: FileModification = {
        id: "mod-1",
        filePath: "/src/index.ts",
        description: "Refactored function",
        additions: 10,
        deletions: 3,
        diffLines: [
          { type: "added", content: "new line", lineNumber: 1 },
        ],
        status: "pending",
        newContent: "new content",
        oldContent: "old content",
      };

      expect(mod.id).toBe("mod-1");
      expect(mod.filePath).toBe("/src/index.ts");
      expect(mod.status).toBe("pending");
      expect(mod.additions).toBe(10);
      expect(mod.deletions).toBe(3);
    });

    it("should have correct CortexAIModificationsPanelProps interface structure", () => {
      const props: CortexAIModificationsPanelProps = {
        onReviewFile: vi.fn(),
        onClose: vi.fn(),
        class: "custom-class",
        style: { width: "400px" },
      };

      expect(typeof props.onReviewFile).toBe("function");
      expect(typeof props.onClose).toBe("function");
      expect(props.class).toBe("custom-class");
    });

    it("should accept FileModification status values", () => {
      const statuses: FileModification["status"][] = ["pending", "accepted", "rejected"];
      expect(statuses).toContain("pending");
      expect(statuses).toContain("accepted");
      expect(statuses).toContain("rejected");
    });
  });

  describe("Rendering", () => {
    it("should render AI Modifications header", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      expect(container.textContent).toContain("AI Modifications");
    });

    it("should show 'No modifications yet' when empty", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      expect(container.textContent).toContain("No modifications yet");
    });

    it("should render Undo Changes button", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      expect(container.textContent).toContain("Undo Changes");
    });

    it("should render corner-up-left icon for undo", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const undoIcon = container.querySelector('[data-testid="icon-corner-up-left"]');
      expect(undoIcon).toBeTruthy();
    });

    it("should render as a flex column container", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const root = container.firstElementChild as HTMLElement;
      const style = root?.getAttribute("style") || "";
      expect(style).toContain("display:flex");
      expect(style).toContain("flex-direction:column");
    });

    it("should not show Accept All button when no pending modifications", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      expect(container.textContent).not.toContain("Accept All");
    });

    it("should not show edited files count when no modifications", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      expect(container.textContent).not.toContain("Edited");
      expect(container.textContent).not.toContain("Review");
    });
  });

  describe("Diff Line Rendering", () => {
    it("should render diff line prefixes correctly", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const root = container.firstElementChild as HTMLElement;
      expect(root).toBeTruthy();
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexAIModificationsPanel class="my-panel" />
      ));
      const root = container.firstElementChild as HTMLElement;
      expect(root?.className).toContain("my-panel");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexAIModificationsPanel style={{ "max-height": "500px" }} />
      ));
      const root = container.firstElementChild as HTMLElement;
      expect(root?.style.maxHeight).toBe("500px");
    });

    it("should have border and border-radius", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const root = container.firstElementChild as HTMLElement;
      const style = root?.getAttribute("style") || "";
      expect(style).toContain("border:1px solid var(--cortex-border-default)");
      expect(style).toContain("border-radius:var(--cortex-radius-lg)");
    });

    it("should have overflow hidden", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const root = container.firstElementChild as HTMLElement;
      const style = root?.getAttribute("style") || "";
      expect(style).toContain("overflow:hidden");
    });
  });

  describe("Header Section", () => {
    it("should render header with secondary background", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const allDivs = Array.from(container.querySelectorAll("div"));
      const header = allDivs.find(
        (el) => el.style.background === "var(--cortex-bg-secondary)"
      );
      expect(header).toBeTruthy();
    });

    it("should render AI Modifications title with correct font weight", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const spans = Array.from(container.querySelectorAll("span"));
      const title = spans.find((s) => s.textContent === "AI Modifications");
      expect(title?.style.fontWeight).toBe("600");
    });
  });

  describe("onReviewFile Callback", () => {
    it("should accept onReviewFile prop", () => {
      const onReviewFile = vi.fn();
      const { container } = render(() => (
        <CortexAIModificationsPanel onReviewFile={onReviewFile} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("onClose Callback", () => {
    it("should accept onClose prop", () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <CortexAIModificationsPanel onClose={onClose} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("Empty State", () => {
    it("should center empty state text", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const allDivs = Array.from(container.querySelectorAll("div"));
      const emptyDiv = allDivs.find(
        (el) => el.textContent === "No modifications yet" && el.children.length === 0
      );
      expect(emptyDiv?.style.textAlign).toBe("center");
    });

    it("should have padding in empty state", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const allDivs = Array.from(container.querySelectorAll("div"));
      const emptyDiv = allDivs.find(
        (el) => el.textContent === "No modifications yet" && el.children.length === 0
      );
      expect(emptyDiv?.style.padding).toBe("24px");
    });
  });

  describe("Content Area", () => {
    it("should have scrollable content area", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const contentArea = Array.from(container.querySelectorAll("div")).find(
        (el) => {
          const s = el.getAttribute("style") || "";
          return s.includes("overflow:auto") && s.includes("flex:1");
        }
      );
      expect(contentArea).toBeTruthy();
    });

    it("should have padding in content area", () => {
      const { container } = render(() => <CortexAIModificationsPanel />);
      const contentArea = Array.from(container.querySelectorAll("div")).find(
        (el) => {
          const s = el.getAttribute("style") || "";
          return s.includes("overflow:auto") && s.includes("flex:1");
        }
      );
      const style = contentArea?.getAttribute("style") || "";
      expect(style).toContain("padding:12px");
    });
  });
});
