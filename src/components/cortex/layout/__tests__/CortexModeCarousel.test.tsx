import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { CortexModeCarousel } from "../CortexModeCarousel";

describe("CortexModeCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const vibeContent = () => <div data-testid="vibe-content">Vibe Mode</div>;
  const ideContent = () => <div data-testid="ide-content">IDE Mode</div>;

  describe("Mode: vibe", () => {
    it("should render vibe content when mode is vibe", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="vibe" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      expect(container.querySelector('[data-testid="vibe-content"]')).toBeTruthy();
      expect(container.textContent).toContain("Vibe Mode");
    });

    it("should not render ide content when mode is vibe", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="vibe" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      expect(container.querySelector('[data-testid="ide-content"]')).toBeFalsy();
    });
  });

  describe("Mode: ide", () => {
    it("should render ide content when mode is ide", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="ide" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      expect(container.querySelector('[data-testid="ide-content"]')).toBeTruthy();
      expect(container.textContent).toContain("IDE Mode");
    });

    it("should not render vibe content when mode is ide", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="ide" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      expect(container.querySelector('[data-testid="vibe-content"]')).toBeFalsy();
    });
  });

  describe("Container Styling", () => {
    it("should have flex: 1 on the container", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="vibe" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.style.flex).toContain("1");
      expect(outerDiv.style.display).toBe("flex");
    });
  });

  describe("Mode Switching", () => {
    it("should show correct layout for each mode value", () => {
      const { container: vibeContainer } = render(() => (
        <CortexModeCarousel mode="vibe" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      expect(vibeContainer.querySelector('[data-testid="vibe-content"]')).toBeTruthy();
      expect(vibeContainer.querySelector('[data-testid="ide-content"]')).toBeFalsy();

      cleanup();

      const { container: ideContainer } = render(() => (
        <CortexModeCarousel mode="ide" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      expect(ideContainer.querySelector('[data-testid="ide-content"]')).toBeTruthy();
      expect(ideContainer.querySelector('[data-testid="vibe-content"]')).toBeFalsy();
    });

    it("should render vibe wrapper with correct styles", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="vibe" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      const wrapper = container.querySelector('[data-testid="vibe-content"]')?.parentElement as HTMLElement;
      expect(wrapper.style.width).toBe("100%");
      expect(wrapper.style.height).toBe("100%");
      expect(wrapper.style.display).toBe("flex");
    });

    it("should render ide wrapper with correct styles", () => {
      const { container } = render(() => (
        <CortexModeCarousel mode="ide" vibeContent={vibeContent} ideContent={ideContent} />
      ));
      const wrapper = container.querySelector('[data-testid="ide-content"]')?.parentElement as HTMLElement;
      expect(wrapper.style.width).toBe("100%");
      expect(wrapper.style.height).toBe("100%");
      expect(wrapper.style.display).toBe("flex");
    });
  });
});
