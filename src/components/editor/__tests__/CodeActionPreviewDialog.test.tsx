/**
 * CodeActionPreviewDialog Tests
 *
 * Tests for the code action preview dialog component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import {
  CodeActionPreviewDialog,
  type CodeActionPreviewDialogProps,
  type CodeActionEdit,
} from "../CodeActionPreviewDialog";

vi.mock("@/components/cortex/primitives", () => ({
  CortexModal: (props: {
    open: boolean;
    onClose?: () => void;
    title?: string;
    children?: any;
  }) => (
    <div data-testid="cortex-modal" data-open={props.open}>
      {props.open && (
        <>
          <div data-testid="modal-title">{props.title}</div>
          {props.children}
        </>
      )}
    </div>
  ),
  CortexButton: (props: {
    variant?: string;
    onClick?: () => void;
    loading?: boolean;
    icon?: string;
    children?: any;
  }) => (
    <button
      data-testid={`button-${props.variant || "default"}`}
      data-loading={props.loading}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
  CortexIcon: (props: { name: string; size?: number }) => (
    <span data-testid={`icon-${props.name}`} />
  ),
}));

describe("CodeActionPreviewDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnApply = vi.fn();

  const sampleEdits: CodeActionEdit[] = [
    {
      filePath: "src/utils/helper.ts",
      range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 20 },
      newText: "const newValue = 42;",
      originalText: "const oldValue = 0;",
    },
  ];

  const multiFileEdits: CodeActionEdit[] = [
    {
      filePath: "src/utils/helper.ts",
      range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 20 },
      newText: "const newValue = 42;",
      originalText: "const oldValue = 0;",
    },
    {
      filePath: "src/components/App.tsx",
      range: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 30 },
      newText: 'import { newValue } from "./utils/helper";',
      originalText: 'import { oldValue } from "./utils/helper";',
    },
  ];

  const defaultProps: CodeActionPreviewDialogProps = {
    open: false,
    onClose: mockOnClose,
    onApply: mockOnApply,
    title: "Rename Symbol",
    edits: sampleEdits,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Visibility", () => {
    it("should not render content when open is false", () => {
      const { queryByTestId } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={false} />
      ));

      const modal = queryByTestId("cortex-modal");
      expect(modal).toBeTruthy();
      expect(modal?.getAttribute("data-open")).toBe("false");
      expect(queryByTestId("modal-title")).toBeFalsy();
    });

    it("should render content when open is true", () => {
      const { queryByTestId } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const modal = queryByTestId("cortex-modal");
      expect(modal?.getAttribute("data-open")).toBe("true");
      expect(queryByTestId("modal-title")).toBeTruthy();
    });

    it("should display the title when open", () => {
      const { getByTestId } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} title="Rename Symbol" />
      ));

      expect(getByTestId("modal-title").textContent).toBe("Rename Symbol");
    });
  });

  describe("Edit Summary", () => {
    it("should show edit count summary", () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const text = container.textContent || "";
      expect(text).toContain("1 edit");
      expect(text).toContain("1 file");
    });

    it("should show plural edits count for multiple edits", () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog
          {...defaultProps}
          open={true}
          edits={multiFileEdits}
        />
      ));

      const text = container.textContent || "";
      expect(text).toContain("2 edits");
      expect(text).toContain("2 files");
    });
  });

  describe("Affected Files", () => {
    it("should show affected file paths", () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const text = container.textContent || "";
      expect(text).toContain("src/utils/helper.ts");
    });
  });

  describe("Diff Display", () => {
    it("should show original text with minus prefix", () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const text = container.textContent || "";
      expect(text).toContain("- const oldValue = 0;");
    });

    it("should show new text with plus prefix", () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const text = container.textContent || "";
      expect(text).toContain("+ const newValue = 42;");
    });
  });

  describe("Actions", () => {
    it("should call onClose when Cancel button is clicked", () => {
      const { getByTestId } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const cancelButton = getByTestId("button-secondary");
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onApply when Apply button is clicked", () => {
      const { getByTestId } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} />
      ));

      const applyButton = getByTestId("button-primary");
      fireEvent.click(applyButton);

      expect(mockOnApply).toHaveBeenCalledTimes(1);
    });

    it("should show loading state on apply button", () => {
      const { getByTestId } = render(() => (
        <CodeActionPreviewDialog {...defaultProps} open={true} isApplying={true} />
      ));

      const applyButton = getByTestId("button-primary");
      expect(applyButton.getAttribute("data-loading")).toBe("true");
    });
  });

  describe("File Filter", () => {
    it("should show file filter buttons when multiple files", () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog
          {...defaultProps}
          open={true}
          edits={multiFileEdits}
        />
      ));

      const text = container.textContent || "";
      expect(text).toContain("All files");
      expect(text).toContain("helper.ts");
      expect(text).toContain("App.tsx");
    });

    it("should filter edits when a file button is clicked", async () => {
      const { container } = render(() => (
        <CodeActionPreviewDialog
          {...defaultProps}
          open={true}
          edits={multiFileEdits}
        />
      ));

      const buttons = container.querySelectorAll("button");
      const appButton = Array.from(buttons).find(
        (b) => b.textContent?.includes("App.tsx")
      );

      if (appButton) {
        fireEvent.click(appButton);
        await new Promise((r) => setTimeout(r, 0));

        const text = container.textContent || "";
        expect(text).toContain("src/components/App.tsx");
      }
    });
  });
});
