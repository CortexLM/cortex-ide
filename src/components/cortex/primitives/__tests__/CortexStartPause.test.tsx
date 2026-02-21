import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexStartPause } from "../CortexStartPause";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexStartPause", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexStartPause state="start" />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexStartPause state="start" />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("has 16x16 dimensions", () => {
      const { getByRole } = render(() => <CortexStartPause state="start" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.width).toBe("16px");
      expect(button.style.height).toBe("16px");
    });
  });

  describe("play/pause icon", () => {
    it("renders play SVG when state is start", () => {
      const { container } = render(() => <CortexStartPause state="start" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const path = svg?.querySelector("path");
      expect(path).toBeTruthy();
      expect(path?.getAttribute("d")).toContain("4 3L13 8L4 13");
    });

    it("renders pause SVG when state is pause", () => {
      const { container } = render(() => <CortexStartPause state="pause" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      const rects = svg?.querySelectorAll("rect");
      expect(rects?.length).toBe(2);
    });

    it("does not render pause rects when state is start", () => {
      const { container } = render(() => <CortexStartPause state="start" />);
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBe(0);
    });

    it("does not render play path when state is pause", () => {
      const { container } = render(() => <CortexStartPause state="pause" />);
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(0);
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexStartPause state="start" onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexStartPause state="start" onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("hover states", () => {
    it("has full opacity by default", () => {
      const { getByRole } = render(() => <CortexStartPause state="start" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.opacity).toBe("1");
    });

    it("reduces opacity on mouse enter", () => {
      const { getByRole } = render(() => <CortexStartPause state="start" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.opacity).toBe("0.5");
    });

    it("restores opacity on mouse leave", () => {
      const { getByRole } = render(() => <CortexStartPause state="start" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.opacity).toBe("1");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexStartPause state="start" class="custom-start-pause" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-start-pause")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexStartPause state="start" style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
