import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { CortexLogo } from "../CortexLogo";

describe("CortexLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Rendering", () => {
    it("should render a container div", () => {
      const { container } = render(() => <CortexLogo />);
      const div = container.querySelector("div");
      expect(div).toBeTruthy();
    });

    it("should render an SVG element inside", () => {
      const { container } = render(() => <CortexLogo />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("should render SVG with correct viewBox", () => {
      const { container } = render(() => <CortexLogo />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    });

    it("should render multiple path elements inside SVG", () => {
      const { container } = render(() => <CortexLogo />);
      const paths = container.querySelectorAll("svg path");
      expect(paths.length).toBe(8);
    });
  });

  describe("Size", () => {
    it("should render with default size of 40px", () => {
      const { container } = render(() => <CortexLogo />);
      const div = container.querySelector("div");
      expect(div?.style.width).toBe("40px");
      expect(div?.style.height).toBe("40px");
    });

    it("should render with custom size prop", () => {
      const { container } = render(() => <CortexLogo size={60} />);
      const div = container.querySelector("div");
      expect(div?.style.width).toBe("60px");
      expect(div?.style.height).toBe("60px");
    });

    it("should render with small size", () => {
      const { container } = render(() => <CortexLogo size={24} />);
      const div = container.querySelector("div");
      expect(div?.style.width).toBe("24px");
      expect(div?.style.height).toBe("24px");
    });
  });

  describe("Styling", () => {
    it("should render wrapper div with SVG child", () => {
      const { container } = render(() => <CortexLogo />);
      const div = container.querySelector("div");
      expect(div).toBeTruthy();
      expect(div?.querySelector("svg")).toBeTruthy();
    });

    it("should render with size-based width and height", () => {
      const { container } = render(() => <CortexLogo />);
      const div = container.querySelector("div");
      expect(div?.style.width).toBe("40px");
      expect(div?.style.height).toBe("40px");
    });

    it("should render custom size with correct dimensions", () => {
      const { container } = render(() => <CortexLogo size={32} />);
      const div = container.querySelector("div");
      expect(div?.style.width).toBe("32px");
      expect(div?.style.height).toBe("32px");
    });
  });
});
