import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexStatusBar } from "../CortexStatusBar";
import type { StatusBarItem, CortexStatusBarProps } from "../CortexStatusBar";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

describe("CortexStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct StatusBarItem interface structure", () => {
      const item: StatusBarItem = {
        id: "terminal",
        icon: "terminal",
        label: "Toggle Terminal",
        onClick: vi.fn(),
      };

      expect(item.id).toBe("terminal");
      expect(item.icon).toBe("terminal");
      expect(item.label).toBe("Toggle Terminal");
      expect(typeof item.onClick).toBe("function");
    });

    it("should have correct CortexStatusBarProps interface structure", () => {
      const props: CortexStatusBarProps = {
        branchName: "main",
        cursorLine: 10,
        cursorColumn: 5,
        languageName: "TypeScript",
        encoding: "UTF-8",
        lineEnding: "LF",
        indentType: "spaces",
        indentSize: 2,
        class: "custom-class",
        style: { padding: "10px" },
      };

      expect(props.branchName).toBe("main");
      expect(props.cursorLine).toBe(10);
      expect(props.languageName).toBe("TypeScript");
    });
  });

  describe("Rendering", () => {
    it("should render cursor position", () => {
      const { container } = render(() => (
        <CortexStatusBar cursorLine={42} cursorColumn={15} />
      ));

      expect(container.textContent).toContain("Ln 42, Col 15");
    });

    it("should render default cursor position when not provided", () => {
      const { container } = render(() => <CortexStatusBar />);

      expect(container.textContent).toContain("Ln 1, Col 1");
    });

    it("should render language name", () => {
      const { container } = render(() => (
        <CortexStatusBar languageName="Rust" />
      ));

      expect(container.textContent).toContain("Rust");
    });

    it("should render default language when not provided", () => {
      const { container } = render(() => <CortexStatusBar />);

      expect(container.textContent).toContain("Plain Text");
    });

    it("should render encoding", () => {
      const { container } = render(() => (
        <CortexStatusBar encoding="UTF-16 LE" />
      ));

      expect(container.textContent).toContain("UTF-16 LE");
    });

    it("should render default encoding when not provided", () => {
      const { container } = render(() => <CortexStatusBar />);

      expect(container.textContent).toContain("UTF-8");
    });

    it("should render line ending", () => {
      const { container } = render(() => (
        <CortexStatusBar lineEnding="CRLF" />
      ));

      expect(container.textContent).toContain("CRLF");
    });

    it("should render default line ending when not provided", () => {
      const { container } = render(() => <CortexStatusBar />);

      expect(container.textContent).toContain("LF");
    });

    it("should render indentation info", () => {
      const { container } = render(() => (
        <CortexStatusBar indentType="spaces" indentSize={4} />
      ));

      expect(container.textContent).toContain("Spaces: 4");
    });

    it("should render tab indentation", () => {
      const { container } = render(() => (
        <CortexStatusBar indentType="tabs" indentSize={4} />
      ));

      expect(container.textContent).toContain("Tabs: 4");
    });

    it("should render git branch name", () => {
      const { container } = render(() => (
        <CortexStatusBar branchName="feature/new-ui" />
      ));

      expect(container.textContent).toContain("feature/new-ui");
    });

    it("should render git icon with branch", () => {
      const { container } = render(() => (
        <CortexStatusBar branchName="main" />
      ));

      const gitIcon = container.querySelector('[data-testid="icon-git"]');
      expect(gitIcon).toBeTruthy();
    });

    it("should show changes indicator when hasChanges", () => {
      const { container } = render(() => (
        <CortexStatusBar branchName="main" hasChanges={true} />
      ));

      expect(container.textContent).toContain("●");
    });

    it("should show selection count when provided", () => {
      const { container } = render(() => (
        <CortexStatusBar selectionCount={5} />
      ));

      expect(container.textContent).toContain("5 selected");
    });

    it("should not show selection count when zero", () => {
      const { container } = render(() => (
        <CortexStatusBar selectionCount={0} />
      ));

      expect(container.textContent).not.toContain("selected");
    });
  });

  describe("User Interactions", () => {
    it("should call onLanguageClick when language is clicked", async () => {
      const onLanguageClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar languageName="TypeScript" onLanguageClick={onLanguageClick} />
      ));

      const langButton = container.querySelector('[aria-label="Select Language Mode"]');
      if (langButton) {
        await fireEvent.click(langButton);
      }

      expect(onLanguageClick).toHaveBeenCalled();
    });

    it("should call onEncodingClick when encoding is clicked", async () => {
      const onEncodingClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onEncodingClick={onEncodingClick} />
      ));

      const encodingButton = container.querySelector('[aria-label="Select Encoding"]');
      if (encodingButton) {
        await fireEvent.click(encodingButton);
      }

      expect(onEncodingClick).toHaveBeenCalled();
    });

    it("should call onLineEndingClick when line ending is clicked", async () => {
      const onLineEndingClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onLineEndingClick={onLineEndingClick} />
      ));

      const eolButton = container.querySelector('[aria-label="Select End of Line Sequence"]');
      if (eolButton) {
        await fireEvent.click(eolButton);
      }

      expect(onLineEndingClick).toHaveBeenCalled();
    });

    it("should call onIndentationClick when indentation is clicked", async () => {
      const onIndentationClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onIndentationClick={onIndentationClick} />
      ));

      const indentButton = container.querySelector('[aria-label="Select Indentation"]');
      if (indentButton) {
        await fireEvent.click(indentButton);
      }

      expect(onIndentationClick).toHaveBeenCalled();
    });

    it("should call onBranchClick when branch is clicked", async () => {
      const onBranchClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar branchName="main" onBranchClick={onBranchClick} />
      ));

      const branchButton = container.querySelector('[aria-label="Source Control"]');
      if (branchButton) {
        await fireEvent.click(branchButton);
      }

      expect(onBranchClick).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => <CortexStatusBar class="custom-class" />);
      const footer = container.querySelector("footer");
      expect(footer?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexStatusBar style={{ "background-color": "green" }} />
      ));
      const footer = container.querySelector("footer");
      expect(footer?.style.backgroundColor).toBe("green");
    });

    it("should have correct height of 28px", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.height).toBe("28px");
    });

    it("should have correct padding", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.padding).toBe("8px 24px");
    });
  });

  describe("Notification Badge", () => {
    it("should show notification count when provided", () => {
      const { container } = render(() => (
        <CortexStatusBar
          notificationCount={3}
          onNotificationClick={() => {}}
        />
      ));

      expect(container.textContent).toContain("3");
    });

    it("should render bell icon when onNotificationClick provided", () => {
      const { container } = render(() => (
        <CortexStatusBar onNotificationClick={() => {}} />
      ));

      const bellIcon = container.querySelector('[data-testid="icon-bell"]');
      expect(bellIcon).toBeTruthy();
    });
  });
});
