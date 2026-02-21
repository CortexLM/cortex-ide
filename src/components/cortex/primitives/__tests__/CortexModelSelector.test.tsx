import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexModelSelector } from "../CortexModelSelector";

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

describe("CortexModelSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" />
      ));
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" />
      ));
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("has 32px height", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.height).toBe("32px");
    });
  });

  describe("model name", () => {
    it("renders the model name", () => {
      const { getByText } = render(() => (
        <CortexModelSelector modelName="GPT-4" />
      ));
      expect(getByText("GPT-4")).toBeTruthy();
    });

    it("renders a different model name", () => {
      const { getByText } = render(() => (
        <CortexModelSelector modelName="Claude 3.5 Sonnet" />
      ));
      expect(getByText("Claude 3.5 Sonnet")).toBeTruthy();
    });
  });

  describe("model icon", () => {
    it("renders model icon when provided", () => {
      const { container } = render(() => (
        <CortexModelSelector modelName="GPT-4" modelIcon="openai" />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const modelIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "openai"
      );
      expect(modelIcon).toBeTruthy();
    });

    it("does not render model icon when not provided", () => {
      const { container } = render(() => (
        <CortexModelSelector modelName="GPT-4" />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const nonChevronIcons = Array.from(icons).filter(
        (icon) => !icon.getAttribute("data-name")?.startsWith("chevron")
      );
      expect(nonChevronIcons.length).toBe(0);
    });
  });

  describe("open/close state", () => {
    it("renders chevron-down when closed", () => {
      const { container } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={false} />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const chevronIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "chevron-down"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("renders chevron-up when open", () => {
      const { container } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={true} />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const chevronIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "chevron-up"
      );
      expect(chevronIcon).toBeTruthy();
    });

    it("renders children when isOpen is true", () => {
      const { getByText } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={true}>
          <div>Model List</div>
        </CortexModelSelector>
      ));
      expect(getByText("Model List")).toBeTruthy();
    });

    it("does not render children when isOpen is false", () => {
      const { queryByText } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={false}>
          <div>Model List</div>
        </CortexModelSelector>
      ));
      expect(queryByText("Model List")).toBeNull();
    });

    it("applies secondary background when open", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-bg-secondary");
    });

    it("applies primary background when closed", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toContain("cortex-bg-primary");
    });

    it("applies transparent border when open", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={true} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.border).toContain("transparent");
    });

    it("applies visible border when closed", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.border).toContain("cortex-border-hover");
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("hover states", () => {
    it("changes background on mouse enter when closed", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toContain("cortex-bg-elevated");
    });

    it("restores background on mouse leave", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" isOpen={false} />
      ));
      const button = getByRole("button") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toContain("cortex-bg-primary");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" class="custom-model-selector" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-model-selector")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexModelSelector modelName="GPT-4" style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
