import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { CortexIconButton } from "../CortexIconButton";

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

describe("CortexIconButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("renders the icon inside the button", () => {
      const { container } = render(() => <CortexIconButton icon="gear" />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("gear");
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });
  });

  describe("size prop", () => {
    it("defaults to 20px container size", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.width).toBe("20px");
      expect(button.style.height).toBe("20px");
    });

    it("applies custom size", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" size={32} />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.width).toBe("32px");
      expect(button.style.height).toBe("32px");
    });

    it("passes 80% icon size to CortexIcon", () => {
      const { container } = render(() => <CortexIconButton icon="plus" size={20} />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon?.getAttribute("data-size")).toBe("16");
    });

    it("passes correct icon size for custom container size", () => {
      const { container } = render(() => <CortexIconButton icon="plus" size={40} />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon?.getAttribute("data-size")).toBe("32");
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" onClick={handleClick} />
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" onClick={handleClick} />
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute when disabled", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" disabled />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" disabled />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.opacity).toBe("0.5");
    });

    it("applies not-allowed cursor when disabled", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" disabled />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.cursor).toBe("not-allowed");
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" disabled onClick={handleClick} />
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not change background on hover when disabled", () => {
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" disabled />
      ));
      const button = getByRole("button") as HTMLElement;
      const initialBackground = button.style.background;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toBe(initialBackground);
    });
  });

  describe("title / tooltip", () => {
    it("applies title attribute when provided", () => {
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" title="Add item" />
      ));
      const button = getByRole("button");
      expect(button.getAttribute("title")).toBe("Add item");
    });

    it("has no title when not provided", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button");
      expect(button.getAttribute("title")).toBeNull();
    });
  });

  describe("hover states", () => {
    it("changes background on mouse enter", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toBe("transparent");
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toContain("cortex-icon-button-hover-bg");
    });

    it("restores background on mouse leave", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toBe("transparent");
    });

    it("applies border-radius on hover", () => {
      const { getByRole } = render(() => <CortexIconButton icon="plus" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.borderRadius).toBe("0px");
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.borderRadius).toBe("4px");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" class="custom-icon-btn" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-icon-btn")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexIconButton icon="plus" style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
