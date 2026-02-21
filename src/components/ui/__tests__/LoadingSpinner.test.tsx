import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { LoadingSpinner } from "../LoadingSpinner";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("LoadingSpinner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders an SVG element", () => {
      const { container } = render(() => <LoadingSpinner />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("renders a circle element inside SVG", () => {
      const { container } = render(() => <LoadingSpinner />);
      const circle = container.querySelector("circle");
      expect(circle).toBeTruthy();
    });

    it("has correct viewBox", () => {
      const { container } = render(() => <LoadingSpinner />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
    });
  });

  describe("sizes", () => {
    it("applies md size by default (16px)", () => {
      const { container } = render(() => <LoadingSpinner />);
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.width).toBe("16px");
      expect(svg.style.height).toBe("16px");
    });

    it("applies sm size (12px)", () => {
      const { container } = render(() => <LoadingSpinner size="sm" />);
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.width).toBe("12px");
      expect(svg.style.height).toBe("12px");
    });

    it("applies md size (16px)", () => {
      const { container } = render(() => <LoadingSpinner size="md" />);
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.width).toBe("16px");
      expect(svg.style.height).toBe("16px");
    });

    it("applies lg size (24px)", () => {
      const { container } = render(() => <LoadingSpinner size="lg" />);
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.width).toBe("24px");
      expect(svg.style.height).toBe("24px");
    });

    it("applies custom numeric size", () => {
      const { container } = render(() => <LoadingSpinner size={32} />);
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.width).toBe("32px");
      expect(svg.style.height).toBe("32px");
    });
  });

  describe("animation", () => {
    it("applies spin animation", () => {
      const { container } = render(() => <LoadingSpinner />);
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.animation).toContain("ui-spin");
    });

    it("injects keyframes style element", () => {
      const { container } = render(() => <LoadingSpinner />);
      const style = container.querySelector("style");
      expect(style).toBeTruthy();
      expect(style!.textContent).toContain("ui-spin");
    });
  });

  describe("color", () => {
    it("uses currentColor by default", () => {
      const { container } = render(() => <LoadingSpinner />);
      const circle = container.querySelector("circle");
      expect(circle?.getAttribute("stroke")).toBe("currentColor");
    });

    it("applies custom color", () => {
      const { container } = render(() => <LoadingSpinner color="#ff0000" />);
      const circle = container.querySelector("circle");
      expect(circle?.getAttribute("stroke")).toBe("#ff0000");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <LoadingSpinner style={{ "margin-left": "8px" }} />
      ));
      const svg = container.querySelector("svg") as SVGElement;
      expect(svg.style.marginLeft).toBe("8px");
    });
  });
});
