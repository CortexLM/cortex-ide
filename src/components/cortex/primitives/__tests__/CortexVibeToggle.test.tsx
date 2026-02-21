import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexVibeToggle } from "../CortexVibeToggle";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexVibeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Vibe and IDE buttons", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      expect(getByText("Vibe")).toBeTruthy();
      expect(getByText("IDE")).toBeTruthy();
    });

    it("renders both segments as button elements", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(2);
    });

    it("has correct container dimensions", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.width).toBe("92px");
      expect(wrapper.style.height).toBe("32px");
    });

    it("has correct border radius on container", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.borderRadius).toBe("12px");
    });
  });

  describe("mode state", () => {
    it("applies active background to Vibe when mode is vibe", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      const vibeButton = getByText("Vibe") as HTMLElement;
      expect(vibeButton.style.background).toContain("cortex-accent-blue");
    });

    it("applies active background to IDE when mode is ide", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="ide" />);
      const ideButton = getByText("IDE") as HTMLElement;
      expect(ideButton.style.background).toContain("cortex-accent-blue");
    });

    it("applies transparent background to IDE when mode is vibe", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      const ideButton = getByText("IDE") as HTMLElement;
      expect(ideButton.style.background).toBe("transparent");
    });

    it("applies transparent background to Vibe when mode is ide", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="ide" />);
      const vibeButton = getByText("Vibe") as HTMLElement;
      expect(vibeButton.style.background).toBe("transparent");
    });

    it("applies active text color to active segment", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      const vibeButton = getByText("Vibe") as HTMLElement;
      expect(vibeButton.style.color).toContain("cortex-text-on-surface");
    });

    it("applies secondary text color to inactive segment", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      const ideButton = getByText("IDE") as HTMLElement;
      expect(ideButton.style.color).toContain("cortex-text-secondary");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange with 'vibe' when Vibe is clicked", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <CortexVibeToggle mode="ide" onChange={handleChange} />
      ));
      await fireEvent.click(getByText("Vibe"));
      expect(handleChange).toHaveBeenCalledWith("vibe");
    });

    it("calls onChange with 'ide' when IDE is clicked", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <CortexVibeToggle mode="vibe" onChange={handleChange} />
      ));
      await fireEvent.click(getByText("IDE"));
      expect(handleChange).toHaveBeenCalledWith("ide");
    });

    it("calls onChange even when clicking already active mode", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <CortexVibeToggle mode="vibe" onChange={handleChange} />
      ));
      await fireEvent.click(getByText("Vibe"));
      expect(handleChange).toHaveBeenCalledWith("vibe");
    });
  });

  describe("accessibility", () => {
    it("has aria-label on Vibe button", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const vibeButton = container.querySelector("button[aria-label='Vibe mode']");
      expect(vibeButton).toBeTruthy();
    });

    it("has aria-label on IDE button", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const ideButton = container.querySelector("button[aria-label='IDE mode']");
      expect(ideButton).toBeTruthy();
    });

    it("sets aria-pressed to true on active Vibe segment", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const vibeButton = container.querySelector("button[aria-label='Vibe mode']");
      expect(vibeButton?.getAttribute("aria-pressed")).toBe("true");
    });

    it("sets aria-pressed to false on inactive IDE segment", () => {
      const { container } = render(() => <CortexVibeToggle mode="vibe" />);
      const ideButton = container.querySelector("button[aria-label='IDE mode']");
      expect(ideButton?.getAttribute("aria-pressed")).toBe("false");
    });

    it("sets aria-pressed to true on active IDE segment", () => {
      const { container } = render(() => <CortexVibeToggle mode="ide" />);
      const ideButton = container.querySelector("button[aria-label='IDE mode']");
      expect(ideButton?.getAttribute("aria-pressed")).toBe("true");
    });

    it("sets aria-pressed to false on inactive Vibe segment", () => {
      const { container } = render(() => <CortexVibeToggle mode="ide" />);
      const vibeButton = container.querySelector("button[aria-label='Vibe mode']");
      expect(vibeButton?.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("hover states", () => {
    it("applies hover background on inactive segment hover", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      const ideButton = getByText("IDE") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      ideButton.dispatchEvent(mouseEnterEvent);
      expect(ideButton.style.background).toContain("rgba(255, 255, 255, 0.05)");
    });

    it("restores transparent background on mouse leave", () => {
      const { getByText } = render(() => <CortexVibeToggle mode="vibe" />);
      const ideButton = getByText("IDE") as HTMLElement;
      const mouseEnterEvent = new MouseEvent("mouseenter", { bubbles: true });
      const mouseLeaveEvent = new MouseEvent("mouseleave", { bubbles: true });
      ideButton.dispatchEvent(mouseEnterEvent);
      ideButton.dispatchEvent(mouseLeaveEvent);
      expect(ideButton.style.background).toBe("transparent");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { container } = render(() => (
        <CortexVibeToggle mode="vibe" class="custom-vibe-toggle" />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("custom-vibe-toggle")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { container } = render(() => (
        <CortexVibeToggle mode="vibe" style={{ "margin-left": "8px" }} />
      ));
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.marginLeft).toBe("8px");
    });
  });
});
