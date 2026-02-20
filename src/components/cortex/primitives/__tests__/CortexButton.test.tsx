import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { CortexButton } from "../CortexButton";
import type { CortexButtonVariant, CortexButtonSize } from "../CortexButton";

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

describe("CortexButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      const { getByRole } = render(() => <CortexButton>Click me</CortexButton>);
      const button = getByRole("button");
      expect(button).toBeTruthy();
      expect(button.textContent).toContain("Click me");
    });

    it("renders with children content", () => {
      const { getByText } = render(() => <CortexButton>Test Button</CortexButton>);
      expect(getByText("Test Button")).toBeTruthy();
    });

    it("renders without children (icon-only button)", () => {
      const { getByRole } = render(() => <CortexButton icon="plus" />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });
  });

  describe("variants", () => {
    const variants: CortexButtonVariant[] = ["primary", "secondary", "ghost", "danger"];

    variants.forEach((variant) => {
      it(`renders ${variant} variant`, () => {
        const { getByRole } = render(() => (
          <CortexButton variant={variant}>Button</CortexButton>
        ));
        const button = getByRole("button");
        expect(button).toBeTruthy();
      });
    });

    it("defaults to primary variant when not specified", () => {
      const { getByRole } = render(() => <CortexButton>Button</CortexButton>);
      const button = getByRole("button");
      expect(button.style.background).toContain("cortex-btn-primary-bg");
    });
  });

  describe("sizes", () => {
    const sizes: CortexButtonSize[] = ["xs", "sm", "md", "lg"];

    sizes.forEach((size) => {
      it(`renders ${size} size`, () => {
        const { getByRole } = render(() => (
          <CortexButton size={size}>Button</CortexButton>
        ));
        const button = getByRole("button");
        expect(button).toBeTruthy();
      });
    });

    it("defaults to md size when not specified", () => {
      const { getByRole } = render(() => <CortexButton>Button</CortexButton>);
      const button = getByRole("button");
      expect(button.style.height).toBe("40px");
    });

    it("applies correct height for xs size", () => {
      const { getByRole } = render(() => <CortexButton size="xs">Button</CortexButton>);
      const button = getByRole("button");
      expect(button.style.height).toBe("24px");
    });

    it("applies correct height for lg size", () => {
      const { getByRole } = render(() => <CortexButton size="lg">Button</CortexButton>);
      const button = getByRole("button");
      expect(button.style.height).toBe("48px");
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute when disabled", () => {
      const { getByRole } = render(() => <CortexButton disabled>Button</CortexButton>);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { getByRole } = render(() => <CortexButton disabled>Button</CortexButton>);
      const button = getByRole("button");
      expect(button.style.opacity).toBe("0.5");
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexButton disabled onClick={handleClick}>Button</CortexButton>
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("disables button when loading", () => {
      const { getByRole } = render(() => <CortexButton loading>Button</CortexButton>);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("does not call onClick when loading", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexButton loading onClick={handleClick}>Button</CortexButton>
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("icon", () => {
    it("renders icon on the left by default", () => {
      const { container } = render(() => (
        <CortexButton icon="plus">Add</CortexButton>
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("plus");
    });

    it("renders icon on the right when iconPosition is right", () => {
      const { container } = render(() => (
        <CortexButton icon="chevron-right" iconPosition="right">Next</CortexButton>
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
    });

    it("does not render icon when loading", () => {
      const { container } = render(() => (
        <CortexButton icon="plus" loading>Add</CortexButton>
      ));
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeFalsy();
    });
  });

  describe("fullWidth", () => {
    it("applies full width when fullWidth is true", () => {
      const { getByRole } = render(() => (
        <CortexButton fullWidth>Button</CortexButton>
      ));
      const button = getByRole("button");
      expect(button.style.width).toBe("100%");
    });

    it("applies auto width when fullWidth is false", () => {
      const { getByRole } = render(() => <CortexButton>Button</CortexButton>);
      const button = getByRole("button");
      expect(button.style.width).toBe("auto");
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexButton onClick={handleClick}>Button</CortexButton>
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexButton onClick={handleClick}>Button</CortexButton>
      ));
      const button = getByRole("button");
      button.click();
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("button type", () => {
    it("defaults to button type", () => {
      const { getByRole } = render(() => <CortexButton>Button</CortexButton>);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("applies submit type when specified", () => {
      const { getByRole } = render(() => <CortexButton type="submit">Submit</CortexButton>);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("submit");
    });

    it("applies reset type when specified", () => {
      const { getByRole } = render(() => <CortexButton type="reset">Reset</CortexButton>);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("reset");
    });
  });

  describe("title attribute", () => {
    it("applies title attribute when provided", () => {
      const { getByRole } = render(() => (
        <CortexButton title="Click to submit">Button</CortexButton>
      ));
      const button = getByRole("button");
      expect(button.getAttribute("title")).toBe("Click to submit");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexButton class="custom-class">Button</CortexButton>
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-class")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexButton style={{ "margin-top": "10px" }}>Button</CortexButton>
      ));
      const button = getByRole("button");
      expect(button.style.marginTop).toBe("10px");
    });
  });

  describe("hover states", () => {
    it("changes background on mouse enter for primary variant", () => {
      const { getByRole } = render(() => (
        <CortexButton variant="primary">Button</CortexButton>
      ));
      const button = getByRole("button");
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toContain("cortex-btn-primary-bg-hover");
    });

    it("restores background on mouse leave", () => {
      const { getByRole } = render(() => (
        <CortexButton variant="primary">Button</CortexButton>
      ));
      const button = getByRole("button");
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      button.dispatchEvent(mouseLeaveEvent);
      expect(button.style.background).toContain("cortex-btn-primary-bg");
    });

    it("does not change background on hover when disabled", () => {
      const { getByRole } = render(() => (
        <CortexButton variant="primary" disabled>Button</CortexButton>
      ));
      const button = getByRole("button");
      const initialBackground = button.style.background;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      expect(button.style.background).toBe(initialBackground);
    });
  });
});
