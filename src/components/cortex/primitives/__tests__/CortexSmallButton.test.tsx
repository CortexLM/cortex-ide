import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexSmallButton } from "../CortexSmallButton";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number; color?: string }) => (
    <span data-testid="cortex-icon" data-name={props.name} data-size={props.size} />
  ),
}));

describe("CortexSmallButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("renders children content", () => {
      const { getByText } = render(() => <CortexSmallButton>Label</CortexSmallButton>);
      expect(getByText("Label")).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("has 24px height", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.height).toBe("24px");
    });

    it("has 8px border radius", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.borderRadius).toBe("8px");
    });
  });

  describe("icon", () => {
    it("renders icon when provided", () => {
      const { container } = render(() => (
        <CortexSmallButton icon="plus">Add</CortexSmallButton>
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("plus");
    });

    it("does not render icon when not provided", () => {
      const { container } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeNull();
    });

    it("renders icon-only button without children", () => {
      const { container } = render(() => <CortexSmallButton icon="gear" />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexSmallButton onClick={handleClick}>Click</CortexSmallButton>
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexSmallButton onClick={handleClick}>Click</CortexSmallButton>
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute when disabled", () => {
      const { getByRole } = render(() => (
        <CortexSmallButton disabled>Click</CortexSmallButton>
      ));
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { getByRole } = render(() => (
        <CortexSmallButton disabled>Click</CortexSmallButton>
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.opacity).toBe("0.5");
    });

    it("applies not-allowed cursor when disabled", () => {
      const { getByRole } = render(() => (
        <CortexSmallButton disabled>Click</CortexSmallButton>
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.cursor).toBe("not-allowed");
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexSmallButton disabled onClick={handleClick}>Click</CortexSmallButton>
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not change background on hover when disabled", () => {
      const { getByRole } = render(() => (
        <CortexSmallButton disabled>Click</CortexSmallButton>
      ));
      const button = getByRole("button") as HTMLElement;
      const initialBackground = button.style.background;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toBe(initialBackground);
    });
  });

  describe("hover states", () => {
    it("changes background on mouse enter", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toContain("cortex-bg-hover");
    });

    it("restores background on mouse leave", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toContain("cortex-small-btn-bg");
    });
  });

  describe("active state", () => {
    it("changes background on mouse down", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLElement;
      const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true });
      button.dispatchEvent(mouseDownEvent);
      expect(button.style.background).toContain("cortex-bg-primary");
    });

    it("restores background on mouse up", () => {
      const { getByRole } = render(() => <CortexSmallButton>Click</CortexSmallButton>);
      const button = getByRole("button") as HTMLElement;
      const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true });
      const mouseUpEvent = new MouseEvent("mouseup", { bubbles: true });
      button.dispatchEvent(mouseDownEvent);
      button.dispatchEvent(mouseUpEvent);
      expect(button.style.background).toContain("cortex-small-btn-bg");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexSmallButton class="custom-small-btn">Click</CortexSmallButton>
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-small-btn")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexSmallButton style={{ "margin-top": "10px" }}>Click</CortexSmallButton>
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
