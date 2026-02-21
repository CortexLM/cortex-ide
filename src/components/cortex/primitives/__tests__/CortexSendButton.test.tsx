import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexSendButton } from "../CortexSendButton";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexSendButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("has 32x32 dimensions", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.width).toBe("32px");
      expect(button.style.height).toBe("32px");
    });

    it("has circular border radius", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.borderRadius).toBe("16px");
    });

    it("renders send SVG icon", () => {
      const { container } = render(() => <CortexSendButton />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const path = svg?.querySelector("path");
      expect(path).toBeTruthy();
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexSendButton onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexSendButton onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute when disabled", () => {
      const { getByRole } = render(() => <CortexSendButton disabled />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexSendButton disabled onClick={handleClick} />
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("applies not-allowed cursor when disabled", () => {
      const { getByRole } = render(() => <CortexSendButton disabled />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.cursor).toBe("not-allowed");
    });

    it("applies pointer cursor when enabled", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.cursor).toBe("pointer");
    });

    it("applies disabled background when disabled", () => {
      const { getByRole } = render(() => <CortexSendButton disabled />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-accent-disabled");
    });

    it("applies accent background when enabled", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-accent-primary");
    });

    it("does not change background on hover when disabled", () => {
      const { getByRole } = render(() => <CortexSendButton disabled />);
      const button = getByRole("button") as HTMLElement;
      const initialBackground = button.style.background;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toBe(initialBackground);
    });
  });

  describe("hover states", () => {
    it("changes background on mouse enter", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toContain("cortex-accent-hover");
    });

    it("restores background on mouse leave", () => {
      const { getByRole } = render(() => <CortexSendButton />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toContain("cortex-accent-primary");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexSendButton class="custom-send-btn" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-send-btn")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexSendButton style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
