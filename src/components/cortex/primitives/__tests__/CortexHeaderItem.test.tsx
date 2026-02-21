import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexHeaderItem } from "../CortexHeaderItem";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexHeaderItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("renders the label text", () => {
      const { getByText } = render(() => <CortexHeaderItem label="File" />);
      expect(getByText("File")).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("renders different labels", () => {
      const { getByText } = render(() => <CortexHeaderItem label="Edit" />);
      expect(getByText("Edit")).toBeTruthy();
    });
  });

  describe("default state", () => {
    it("has transparent background by default", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toBe("transparent");
    });

    it("has secondary text color by default", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.color).toBe("rgb(140, 141, 143)");
    });

    it("has no border radius by default", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.borderRadius).toBe("0px");
    });
  });

  describe("active state", () => {
    it("has highlighted background when active", () => {
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" isActive={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toBe("rgb(28, 28, 29)");
    });

    it("has primary text color when active", () => {
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" isActive={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.color).toBe("rgb(252, 252, 252)");
    });

    it("has border radius when active", () => {
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" isActive={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.borderRadius).toBe("8px");
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("onMouseEnter handler", () => {
    it("calls onMouseEnter when mouse enters", () => {
      const handleMouseEnter = vi.fn();
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" onMouseEnter={handleMouseEnter} />
      ));
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(handleMouseEnter).toHaveBeenCalledTimes(1);
    });
  });

  describe("hover states", () => {
    it("applies highlighted background on hover", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toBe("rgb(28, 28, 29)");
    });

    it("applies primary text color on hover", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.color).toBe("rgb(252, 252, 252)");
    });

    it("applies border radius on hover", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.borderRadius).toBe("8px");
    });

    it("restores default styling on mouse leave", () => {
      const { getByRole } = render(() => <CortexHeaderItem label="File" />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toBe("transparent");
      expect(button.style.color).toBe("rgb(140, 141, 143)");
      expect(button.style.borderRadius).toBe("0px");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" class="custom-header-item" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-header-item")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexHeaderItem label="File" style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
