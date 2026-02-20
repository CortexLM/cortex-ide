import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexModal } from "../CortexModal";
import type { CortexModalSize } from "../CortexModal";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number }) => (
    <span data-testid="cortex-icon" data-name={props.name} data-size={props.size} />
  ),
}));

describe("CortexModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders dialog when open is true", () => {
      render(() => <CortexModal open={true} />);
      vi.advanceTimersByTime(0);
      const dialog = document.body.querySelector("[role='dialog']");
      expect(dialog).toBeTruthy();
    });

    it("does not render dialog when open is false", () => {
      render(() => <CortexModal open={false} />);
      vi.advanceTimersByTime(300);
      const dialog = document.body.querySelector("[role='dialog']");
      expect(dialog).toBeFalsy();
    });

    it("renders with aria-modal attribute", () => {
      render(() => <CortexModal open={true} />);
      vi.advanceTimersByTime(0);
      const dialog = document.body.querySelector("[role='dialog']");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
    });
  });

  describe("title and description", () => {
    it("renders title when provided", () => {
      render(() => <CortexModal open={true} title="Test Title" />);
      vi.advanceTimersByTime(0);
      const title = document.body.querySelector("#modal-title");
      expect(title).toBeTruthy();
      expect(title?.textContent).toBe("Test Title");
    });

    it("renders description when provided", () => {
      render(() => (
        <CortexModal open={true} title="Title" description="Test description" />
      ));
      vi.advanceTimersByTime(0);
      const desc = document.body.querySelector("#modal-description");
      expect(desc).toBeTruthy();
      expect(desc?.textContent).toBe("Test description");
    });

    it("sets aria-labelledby when title is provided", () => {
      render(() => <CortexModal open={true} title="Title" />);
      vi.advanceTimersByTime(0);
      const dialog = document.body.querySelector("[role='dialog']");
      expect(dialog?.getAttribute("aria-labelledby")).toBe("modal-title");
    });

    it("sets aria-describedby when description is provided", () => {
      render(() => (
        <CortexModal open={true} title="Title" description="Desc" />
      ));
      vi.advanceTimersByTime(0);
      const dialog = document.body.querySelector("[role='dialog']");
      expect(dialog?.getAttribute("aria-describedby")).toBe("modal-description");
    });
  });

  describe("children", () => {
    it("renders children content", () => {
      render(() => (
        <CortexModal open={true}>
          <p data-testid="modal-content">Hello World</p>
        </CortexModal>
      ));
      vi.advanceTimersByTime(0);
      const content = document.body.querySelector("[data-testid='modal-content']");
      expect(content).toBeTruthy();
      expect(content?.textContent).toBe("Hello World");
    });
  });

  describe("close button", () => {
    it("renders close button when closable is true (default)", () => {
      render(() => <CortexModal open={true} title="Title" />);
      vi.advanceTimersByTime(0);
      const closeBtn = document.body.querySelector("[aria-label='Close modal']");
      expect(closeBtn).toBeTruthy();
    });

    it("does not render close button when closable is false", () => {
      render(() => <CortexModal open={true} title="Title" closable={false} />);
      vi.advanceTimersByTime(0);
      const closeBtn = document.body.querySelector("[aria-label='Close modal']");
      expect(closeBtn).toBeFalsy();
    });

    it("calls onClose when close button is clicked", async () => {
      const handleClose = vi.fn();
      render(() => <CortexModal open={true} title="Title" onClose={handleClose} />);
      vi.advanceTimersByTime(0);
      const closeBtn = document.body.querySelector("[aria-label='Close modal']") as HTMLElement;
      await fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("overlay click", () => {
    it("calls onClose when overlay is clicked and closeOnOverlay is true", async () => {
      const handleClose = vi.fn();
      render(() => (
        <CortexModal open={true} onClose={handleClose} closeOnOverlay={true} />
      ));
      vi.advanceTimersByTime(0);
      const overlay = document.body.querySelector("[role='dialog']") as HTMLElement;
      await fireEvent.click(overlay);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when closeOnOverlay is false", async () => {
      const handleClose = vi.fn();
      render(() => (
        <CortexModal open={true} onClose={handleClose} closeOnOverlay={false} />
      ));
      vi.advanceTimersByTime(0);
      const overlay = document.body.querySelector("[role='dialog']") as HTMLElement;
      await fireEvent.click(overlay);
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("escape key", () => {
    it("calls onClose when Escape is pressed and closeOnEscape is true", async () => {
      const handleClose = vi.fn();
      render(() => (
        <CortexModal open={true} onClose={handleClose} closeOnEscape={true} />
      ));
      vi.advanceTimersByTime(0);
      const overlay = document.body.querySelector("[role='dialog']") as HTMLElement;
      await fireEvent.keyDown(overlay, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when closeOnEscape is false", async () => {
      const handleClose = vi.fn();
      render(() => (
        <CortexModal open={true} onClose={handleClose} closeOnEscape={false} />
      ));
      vi.advanceTimersByTime(0);
      const overlay = document.body.querySelector("[role='dialog']") as HTMLElement;
      await fireEvent.keyDown(overlay, { key: "Escape" });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("footer", () => {
    it("renders footer with confirm and cancel buttons", () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();
      render(() => (
        <CortexModal
          open={true}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          confirmText="Save"
          cancelText="Discard"
        />
      ));
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const buttonTexts = Array.from(buttons).map((b) => b.textContent);
      expect(buttonTexts).toContain("Save");
      expect(buttonTexts).toContain("Discard");
    });

    it("calls onConfirm when confirm button is clicked", async () => {
      const handleConfirm = vi.fn();
      render(() => (
        <CortexModal open={true} onConfirm={handleConfirm} confirmText="OK" />
      ));
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const confirmBtn = Array.from(buttons).find((b) => b.textContent === "OK");
      await fireEvent.click(confirmBtn!);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button is clicked", async () => {
      const handleCancel = vi.fn();
      render(() => (
        <CortexModal
          open={true}
          onConfirm={vi.fn()}
          onCancel={handleCancel}
          cancelText="Cancel"
        />
      ));
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const cancelBtn = Array.from(buttons).find((b) => b.textContent === "Cancel");
      await fireEvent.click(cancelBtn!);
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it("defaults confirm text to Confirm", () => {
      render(() => <CortexModal open={true} onConfirm={vi.fn()} />);
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const confirmBtn = Array.from(buttons).find((b) => b.textContent === "Confirm");
      expect(confirmBtn).toBeTruthy();
    });

    it("defaults cancel text to Cancel", () => {
      render(() => <CortexModal open={true} onCancel={vi.fn()} />);
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const cancelBtn = Array.from(buttons).find((b) => b.textContent === "Cancel");
      expect(cancelBtn).toBeTruthy();
    });

    it("does not render footer when showFooter is false and no confirm/cancel", () => {
      render(() => <CortexModal open={true} title="Title" />);
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const footerButtons = Array.from(buttons).filter(
        (b) => b.textContent === "Confirm" || b.textContent === "Cancel"
      );
      expect(footerButtons.length).toBe(0);
    });
  });

  describe("sizes", () => {
    const sizeWidths: Record<CortexModalSize, string> = {
      sm: "360px",
      md: "480px",
      lg: "640px",
      xl: "800px",
      full: "90vw",
    };

    (Object.entries(sizeWidths) as [CortexModalSize, string][]).forEach(([size, width]) => {
      it(`applies correct width for ${size} size`, () => {
        render(() => <CortexModal open={true} size={size} />);
        vi.advanceTimersByTime(0);
        const dialog = document.body.querySelector("[role='dialog']");
        const modalContent = dialog?.firstElementChild as HTMLElement;
        expect(modalContent?.style.width).toBe(width);
      });
    });
  });

  describe("custom header", () => {
    it("renders custom header slot instead of title", () => {
      render(() => (
        <CortexModal
          open={true}
          title="Default Title"
          header={<div data-testid="custom-header">Custom Header</div>}
        />
      ));
      vi.advanceTimersByTime(0);
      const customHeader = document.body.querySelector("[data-testid='custom-header']");
      expect(customHeader).toBeTruthy();
      expect(customHeader?.textContent).toBe("Custom Header");
      const defaultTitle = document.body.querySelector("#modal-title");
      expect(defaultTitle).toBeFalsy();
    });
  });

  describe("custom footer", () => {
    it("renders custom footer slot instead of default buttons", () => {
      render(() => (
        <CortexModal
          open={true}
          onConfirm={vi.fn()}
          footer={<div data-testid="custom-footer">Custom Footer</div>}
        />
      ));
      vi.advanceTimersByTime(0);
      const customFooter = document.body.querySelector("[data-testid='custom-footer']");
      expect(customFooter).toBeTruthy();
      expect(customFooter?.textContent).toBe("Custom Footer");
    });
  });

  describe("confirm loading state", () => {
    it("disables confirm button when confirmLoading is true", () => {
      render(() => (
        <CortexModal
          open={true}
          onConfirm={vi.fn()}
          confirmText="Save"
          confirmLoading={true}
        />
      ));
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const confirmBtn = Array.from(buttons).find((b) =>
        b.textContent?.includes("Save") || b.textContent?.includes("Confirm")
      ) as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(true);
    });
  });

  describe("confirm disabled state", () => {
    it("disables confirm button when confirmDisabled is true", () => {
      render(() => (
        <CortexModal
          open={true}
          onConfirm={vi.fn()}
          confirmText="Save"
          confirmDisabled={true}
        />
      ));
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const confirmBtn = Array.from(buttons).find((b) =>
        b.textContent?.includes("Save")
      ) as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(true);
    });
  });

  describe("portal rendering", () => {
    it("renders modal in a portal outside component tree", () => {
      const { container } = render(() => (
        <CortexModal open={true} title="Portal Test" />
      ));
      vi.advanceTimersByTime(0);
      const dialogInContainer = container.querySelector("[role='dialog']");
      expect(dialogInContainer).toBeFalsy();
      const dialogInBody = document.body.querySelector("[role='dialog']");
      expect(dialogInBody).toBeTruthy();
    });
  });

  describe("cancel fallback to close", () => {
    it("calls onClose when cancel is clicked and no onCancel provided", async () => {
      const handleClose = vi.fn();
      render(() => (
        <CortexModal
          open={true}
          onClose={handleClose}
          onConfirm={vi.fn()}
          cancelText="Cancel"
        />
      ));
      vi.advanceTimersByTime(0);
      const buttons = document.body.querySelectorAll("button[type='button']");
      const cancelBtn = Array.from(buttons).find((b) => b.textContent === "Cancel");
      await fireEvent.click(cancelBtn!);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
