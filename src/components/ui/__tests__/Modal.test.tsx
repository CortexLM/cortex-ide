import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Modal } from "../Modal";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../../cortex/primitives/CortexModal", () => ({
  CortexModal: (props: any) => {
    const handleOverlayClick = () => {
      if (props.closeOnOverlay !== false) {
        props.onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.closeOnEscape !== false) {
        props.onClose?.();
      }
    };

    if (!props.open) return null;

    return (
      <div data-testid="modal-overlay" onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
        <div
          role="dialog"
          aria-modal="true"
          data-size={props.size || "md"}
          style={props.style}
        >
          {props.title && <div data-testid="modal-title">{props.title}</div>}
          <div data-testid="modal-body">{props.children}</div>
        </div>
      </div>
    );
  },
}));

describe("Modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders when open is true", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()}>
          Modal content
        </Modal>
      ));
      expect(getByRole("dialog")).toBeTruthy();
    });

    it("does not render when open is false", () => {
      const { queryByRole } = render(() => (
        <Modal open={false} onClose={vi.fn()}>
          Modal content
        </Modal>
      ));
      expect(queryByRole("dialog")).toBeNull();
    });

    it("renders children content", () => {
      const { getByText } = render(() => (
        <Modal open={true} onClose={vi.fn()}>
          Hello World
        </Modal>
      ));
      expect(getByText("Hello World")).toBeTruthy();
    });

    it("renders title when provided", () => {
      const { getByTestId } = render(() => (
        <Modal open={true} onClose={vi.fn()} title="My Modal">
          Content
        </Modal>
      ));
      expect(getByTestId("modal-title").textContent).toBe("My Modal");
    });

    it("renders footer when provided", () => {
      const { getByText } = render(() => (
        <Modal
          open={true}
          onClose={vi.fn()}
          footer={<button>Save</button>}
        >
          Content
        </Modal>
      ));
      expect(getByText("Save")).toBeTruthy();
    });
  });

  describe("close behavior", () => {
    it("calls onClose when overlay is clicked", async () => {
      const handleClose = vi.fn();
      const { getByTestId } = render(() => (
        <Modal open={true} onClose={handleClose}>
          Content
        </Modal>
      ));
      await fireEvent.click(getByTestId("modal-overlay"));
      expect(handleClose).toHaveBeenCalled();
    });

    it("calls onClose on Escape key", async () => {
      const handleClose = vi.fn();
      const { getByTestId } = render(() => (
        <Modal open={true} onClose={handleClose}>
          Content
        </Modal>
      ));
      await fireEvent.keyDown(getByTestId("modal-overlay"), { key: "Escape" });
      expect(handleClose).toHaveBeenCalled();
    });

    it("does not call onClose on overlay click when closeOnOverlay is false", async () => {
      const handleClose = vi.fn();
      const { getByTestId } = render(() => (
        <Modal open={true} onClose={handleClose} closeOnOverlay={false}>
          Content
        </Modal>
      ));
      await fireEvent.click(getByTestId("modal-overlay"));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it("does not call onClose on Escape when closeOnEscape is false", async () => {
      const handleClose = vi.fn();
      const { getByTestId } = render(() => (
        <Modal open={true} onClose={handleClose} closeOnEscape={false}>
          Content
        </Modal>
      ));
      await fireEvent.keyDown(getByTestId("modal-overlay"), { key: "Escape" });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("sizes", () => {
    it("defaults to md size", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()}>
          Content
        </Modal>
      ));
      expect(getByRole("dialog").getAttribute("data-size")).toBe("md");
    });

    it("passes sm size", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()} size="sm">
          Content
        </Modal>
      ));
      expect(getByRole("dialog").getAttribute("data-size")).toBe("sm");
    });

    it("passes lg size", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()} size="lg">
          Content
        </Modal>
      ));
      expect(getByRole("dialog").getAttribute("data-size")).toBe("lg");
    });

    it("passes xl size", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()} size="xl">
          Content
        </Modal>
      ));
      expect(getByRole("dialog").getAttribute("data-size")).toBe("xl");
    });
  });

  describe("accessibility", () => {
    it("has aria-modal set to true", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()}>
          Content
        </Modal>
      ));
      expect(getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    });
  });

  describe("custom styles", () => {
    it("passes custom style to modal", () => {
      const { getByRole } = render(() => (
        <Modal open={true} onClose={vi.fn()} style={{ "max-height": "400px" }}>
          Content
        </Modal>
      ));
      const dialog = getByRole("dialog") as HTMLElement;
      expect(dialog.style.maxHeight).toBe("400px");
    });
  });
});
