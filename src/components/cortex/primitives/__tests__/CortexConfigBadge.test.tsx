import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexConfigBadge } from "../CortexConfigBadge";

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

describe("CortexConfigBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexConfigBadge />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("renders gear icon", () => {
      const { container } = render(() => <CortexConfigBadge />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const gearIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "gear"
      );
      expect(gearIcon).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexConfigBadge />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });
  });

  describe("label", () => {
    it("renders label when provided", () => {
      const { getByText } = render(() => <CortexConfigBadge label="Settings" />);
      expect(getByText("Settings")).toBeTruthy();
    });

    it("does not render label text when label is not provided", () => {
      const { container } = render(() => <CortexConfigBadge />);
      const button = container.querySelector("button");
      const textContent = button?.textContent ?? "";
      const iconTexts = Array.from(
        button?.querySelectorAll("[data-testid='cortex-icon']") ?? []
      ).map((el) => el.textContent);
      const nonIconText = textContent.replace(iconTexts.join(""), "").trim();
      expect(nonIconText).toBe("");
    });
  });

  describe("open/close state", () => {
    it("renders chevron-down when closed", () => {
      const { container } = render(() => <CortexConfigBadge isOpen={false} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const chevronIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "chevron-down"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("renders chevron-up when open", () => {
      const { container } = render(() => <CortexConfigBadge isOpen={true} />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const chevronIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "chevron-up"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("renders children when isOpen is true", () => {
      const { getByText } = render(() => (
        <CortexConfigBadge isOpen={true}>
          <div>Dropdown Content</div>
        </CortexConfigBadge>
      ));
      expect(getByText("Dropdown Content")).toBeTruthy();
    });

    it("does not render children when isOpen is false", () => {
      const { queryByText } = render(() => (
        <CortexConfigBadge isOpen={false}>
          <div>Dropdown Content</div>
        </CortexConfigBadge>
      ));
      expect(queryByText("Dropdown Content")).toBeNull();
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexConfigBadge onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexConfigBadge onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("variant states", () => {
    it("has transparent background in default variant", () => {
      const { getByRole } = render(() => <CortexConfigBadge variant="default" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toBe("transparent");
    });

    it("has hover background in hover variant", () => {
      const { getByRole } = render(() => <CortexConfigBadge variant="hover" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-bg-hover");
    });

    it("has active background in active variant", () => {
      const { getByRole } = render(() => <CortexConfigBadge variant="active" />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-bg-secondary");
    });
  });

  describe("hover states", () => {
    it("changes background on mouse enter", () => {
      const { getByRole } = render(() => <CortexConfigBadge />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toBe("transparent");
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toContain("cortex-bg-hover");
    });

    it("restores background on mouse leave", () => {
      const { getByRole } = render(() => <CortexConfigBadge />);
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toBe("transparent");
    });

    it("applies border-radius on hover", () => {
      const { getByRole } = render(() => <CortexConfigBadge />);
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
        <CortexConfigBadge class="custom-badge" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-badge")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexConfigBadge style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
