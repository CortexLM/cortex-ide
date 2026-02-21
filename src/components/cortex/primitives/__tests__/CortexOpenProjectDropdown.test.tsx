import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexOpenProjectDropdown } from "../CortexOpenProjectDropdown";

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

describe("CortexOpenProjectDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexOpenProjectDropdown />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexOpenProjectDropdown />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });
  });

  describe("label", () => {
    it("renders default label 'Open File' when no label provided", () => {
      const { getByText } = render(() => <CortexOpenProjectDropdown />);
      expect(getByText("Open File")).toBeTruthy();
    });

    it("renders custom label when provided", () => {
      const { getByText } = render(() => (
        <CortexOpenProjectDropdown label="My Project" />
      ));
      expect(getByText("My Project")).toBeTruthy();
    });
  });

  describe("open/close state", () => {
    it("renders chevron-down when closed", () => {
      const { container } = render(() => (
        <CortexOpenProjectDropdown isOpen={false} />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const chevronIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "chevron-down"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("renders chevron-up when open", () => {
      const { container } = render(() => (
        <CortexOpenProjectDropdown isOpen={true} />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const chevronIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "chevron-up"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("renders children when isOpen is true", () => {
      const { getByText } = render(() => (
        <CortexOpenProjectDropdown isOpen={true}>
          <div>Project List</div>
        </CortexOpenProjectDropdown>
      ));
      expect(getByText("Project List")).toBeTruthy();
    });

    it("does not render children when isOpen is false", () => {
      const { queryByText } = render(() => (
        <CortexOpenProjectDropdown isOpen={false}>
          <div>Project List</div>
        </CortexOpenProjectDropdown>
      ));
      expect(queryByText("Project List")).toBeNull();
    });

    it("applies open background when isOpen is true", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-open-project-open-bg");
    });

    it("applies default background when isOpen is false", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-open-project-bg");
    });

    it("applies transparent border when open", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.border).toContain("transparent");
    });

    it("applies visible border when closed", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.border).toContain("cortex-open-project-border");
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("hover states", () => {
    it("reduces opacity on hover when closed", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.opacity).toBe("0.5");
    });

    it("does not reduce opacity on hover when open", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.opacity).toBe("1");
    });

    it("restores opacity on mouse leave", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown isOpen={false} />
      ));
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
        <CortexOpenProjectDropdown class="custom-dropdown" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-dropdown")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexOpenProjectDropdown style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
