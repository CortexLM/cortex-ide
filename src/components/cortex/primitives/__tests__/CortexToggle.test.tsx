import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexToggle, CortexThemeToggle, CortexModeToggle } from "../CortexToggle";

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

describe("CortexToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      const { getByRole } = render(() => <CortexToggle />);
      const toggle = getByRole("switch");
      expect(toggle).toBeTruthy();
    });

    it("renders as a button element", () => {
      const { container } = render(() => <CortexToggle />);
      const button = container.querySelector("button");
      expect(button).toBeTruthy();
    });
  });

  describe("sizes", () => {
    it("renders sm size with correct dimensions", () => {
      const { getByRole } = render(() => <CortexToggle size="sm" />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.width).toBe("32px");
      expect(toggle.style.height).toBe("16px");
    });

    it("renders md size with correct dimensions (default)", () => {
      const { getByRole } = render(() => <CortexToggle />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.width).toBe("44px");
      expect(toggle.style.height).toBe("24px");
    });

    it("renders lg size with correct dimensions", () => {
      const { getByRole } = render(() => <CortexToggle size="lg" />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.width).toBe("56px");
      expect(toggle.style.height).toBe("28px");
    });
  });

  describe("checked state", () => {
    it("applies unchecked styles by default", () => {
      const { getByRole } = render(() => <CortexToggle />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.background).toContain("cortex-switch-bg-off");
    });

    it("applies checked styles when checked is true", () => {
      const { getByRole } = render(() => <CortexToggle checked />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.background).toContain("cortex-switch-bg-on");
    });

    it("sets aria-pressed to false when unchecked", () => {
      const { getByRole } = render(() => <CortexToggle checked={false} />);
      const toggle = getByRole("switch");
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });

    it("sets aria-pressed to true when checked", () => {
      const { getByRole } = render(() => <CortexToggle checked />);
      const toggle = getByRole("switch");
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange with true when clicking unchecked toggle", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <CortexToggle checked={false} onChange={handleChange} />
      ));
      const toggle = getByRole("switch");
      await fireEvent.click(toggle);
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it("calls onChange with false when clicking checked toggle", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <CortexToggle checked onChange={handleChange} />
      ));
      const toggle = getByRole("switch");
      await fireEvent.click(toggle);
      expect(handleChange).toHaveBeenCalledWith(false);
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute", () => {
      const { getByRole } = render(() => <CortexToggle disabled />);
      const toggle = getByRole("switch") as HTMLButtonElement;
      expect(toggle.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { getByRole } = render(() => <CortexToggle disabled />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.opacity).toBe("0.5");
    });

    it("does not call onChange when disabled", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <CortexToggle disabled onChange={handleChange} />
      ));
      const toggle = getByRole("switch");
      await fireEvent.click(toggle);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("applies not-allowed cursor when disabled", () => {
      const { getByRole } = render(() => <CortexToggle disabled />);
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.cursor).toBe("not-allowed");
    });
  });

  describe("accessibility", () => {
    it("has role switch", () => {
      const { getByRole } = render(() => <CortexToggle />);
      expect(getByRole("switch")).toBeTruthy();
    });

    it("has type button", () => {
      const { container } = render(() => <CortexToggle />);
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexToggle class="custom-toggle-class" />
      ));
      const toggle = getByRole("switch");
      expect(toggle.classList.contains("custom-toggle-class")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexToggle style={{ "margin-top": "10px" }} />
      ));
      const toggle = getByRole("switch") as HTMLElement;
      expect(toggle.style.marginTop).toBe("10px");
    });
  });

  describe("thumb animation", () => {
    it("positions thumb at start when unchecked", () => {
      const { container } = render(() => <CortexToggle checked={false} />);
      const thumb = container.querySelector("button > div") as HTMLElement;
      expect(thumb).toBeTruthy();
      expect(thumb.style.transform).toBe("translateX(0)");
    });

    it("positions thumb at end when checked", () => {
      const { container } = render(() => <CortexToggle checked />);
      const thumb = container.querySelector("button > div") as HTMLElement;
      expect(thumb).toBeTruthy();
      expect(thumb.style.transform).toContain("translateX");
    });
  });
});

describe("CortexThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      const { container } = render(() => <CortexThemeToggle />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders sun and moon icons", () => {
      const { container } = render(() => <CortexThemeToggle />);
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const iconNames = Array.from(icons).map((icon) =>
        icon.getAttribute("data-name")
      );
      expect(iconNames).toContain("sun");
      expect(iconNames).toContain("moon");
    });

    it("renders with correct container dimensions", () => {
      const { container } = render(() => <CortexThemeToggle />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.width).toBe("100px");
      expect(wrapper.style.height).toBe("28px");
    });
  });

  describe("theme state", () => {
    it("highlights sun button when isDark is false", () => {
      const { container } = render(() => <CortexThemeToggle isDark={false} />);
      const sunButton = container.querySelector(
        "button[aria-label='Light mode']"
      ) as HTMLElement;
      expect(sunButton.style.color).toContain("cortex-accent-primary");
    });

    it("highlights moon button when isDark is true", () => {
      const { container } = render(() => <CortexThemeToggle isDark />);
      const moonButton = container.querySelector(
        "button[aria-label='Dark mode']"
      ) as HTMLElement;
      expect(moonButton.style.color).toContain("cortex-accent-primary");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange with false when sun button is clicked", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexThemeToggle isDark onChange={handleChange} />
      ));
      const sunButton = container.querySelector(
        "button[aria-label='Light mode']"
      );
      await fireEvent.click(sunButton!);
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it("calls onChange with true when moon button is clicked", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexThemeToggle isDark={false} onChange={handleChange} />
      ));
      const moonButton = container.querySelector(
        "button[aria-label='Dark mode']"
      );
      await fireEvent.click(moonButton!);
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe("accessibility", () => {
    it("has aria-label on sun button", () => {
      const { container } = render(() => <CortexThemeToggle />);
      const sunButton = container.querySelector(
        "button[aria-label='Light mode']"
      );
      expect(sunButton).toBeTruthy();
    });

    it("has aria-label on moon button", () => {
      const { container } = render(() => <CortexThemeToggle />);
      const moonButton = container.querySelector(
        "button[aria-label='Dark mode']"
      );
      expect(moonButton).toBeTruthy();
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { container } = render(() => (
        <CortexThemeToggle class="custom-theme-toggle" />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("custom-theme-toggle")).toBe(true);
    });
  });

  describe("indicator animation", () => {
    it("renders indicator element for light mode", () => {
      const { container } = render(() => <CortexThemeToggle isDark={false} />);
      const indicator = container.querySelector("div > div") as HTMLElement;
      expect(indicator).toBeTruthy();
    });

    it("renders indicator element for dark mode", () => {
      const { container } = render(() => <CortexThemeToggle isDark />);
      const indicator = container.querySelector("div > div") as HTMLElement;
      expect(indicator).toBeTruthy();
    });
  });
});

describe("CortexModeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with vibe mode", () => {
      const { getByText } = render(() => <CortexModeToggle mode="vibe" />);
      expect(getByText("Vibe")).toBeTruthy();
      expect(getByText("IDE")).toBeTruthy();
    });

    it("renders with ide mode", () => {
      const { getByText } = render(() => <CortexModeToggle mode="ide" />);
      expect(getByText("Vibe")).toBeTruthy();
      expect(getByText("IDE")).toBeTruthy();
    });
  });

  describe("mode state", () => {
    it("highlights Vibe text when mode is vibe", () => {
      const { getByText } = render(() => <CortexModeToggle mode="vibe" />);
      const vibeText = getByText("Vibe") as HTMLElement;
      expect(vibeText.style.color).toBe("rgb(255, 255, 255)");
    });

    it("highlights IDE text when mode is ide", () => {
      const { getByText } = render(() => <CortexModeToggle mode="ide" />);
      const ideText = getByText("IDE") as HTMLElement;
      expect(ideText.style.color).toBe("rgb(255, 255, 255)");
    });

    it("dims Vibe text when mode is ide", () => {
      const { getByText } = render(() => <CortexModeToggle mode="ide" />);
      const vibeText = getByText("Vibe") as HTMLElement;
      expect(vibeText.style.color).toContain("cortex-text-inactive");
    });

    it("dims IDE text when mode is vibe", () => {
      const { getByText } = render(() => <CortexModeToggle mode="vibe" />);
      const ideText = getByText("IDE") as HTMLElement;
      expect(ideText.style.color).toContain("cortex-text-inactive");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange with vibe when Vibe is clicked", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <CortexModeToggle mode="ide" onChange={handleChange} />
      ));
      await fireEvent.click(getByText("Vibe"));
      expect(handleChange).toHaveBeenCalledWith("vibe");
    });

    it("calls onChange with ide when IDE is clicked", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <CortexModeToggle mode="vibe" onChange={handleChange} />
      ));
      await fireEvent.click(getByText("IDE"));
      expect(handleChange).toHaveBeenCalledWith("ide");
    });
  });

  describe("indicator styling", () => {
    it("renders indicator element for vibe mode", () => {
      const { container } = render(() => <CortexModeToggle mode="vibe" />);
      const indicator = container.querySelector("div > div") as HTMLElement;
      expect(indicator).toBeTruthy();
    });

    it("renders indicator element for ide mode", () => {
      const { container } = render(() => <CortexModeToggle mode="ide" />);
      const indicator = container.querySelector("div > div") as HTMLElement;
      expect(indicator).toBeTruthy();
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { container } = render(() => (
        <CortexModeToggle mode="vibe" class="custom-mode-toggle" />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("custom-mode-toggle")).toBe(true);
    });

    it("merges custom style", () => {
      const { container } = render(() => (
        <CortexModeToggle mode="vibe" style={{ "margin-left": "8px" }} />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginLeft).toBe("8px");
    });
  });

  describe("container styling", () => {
    it("has correct border radius", () => {
      const { container } = render(() => <CortexModeToggle mode="vibe" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.borderRadius).toBe("12px");
    });

    it("has correct background", () => {
      const { container } = render(() => <CortexModeToggle mode="vibe" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.background).toBe("rgb(26, 27, 31)");
    });
  });
});
