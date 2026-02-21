import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import type { ColorThemeId } from "@/context/CortexColorThemeContext";

const mockSetColorTheme = vi.fn();
const mockSetAccentColor = vi.fn();
const mockSetCustomCss = vi.fn();

let currentTheme: () => ColorThemeId;
let setCurrentTheme: (id: ColorThemeId) => void;
let currentAccent: () => string;
let setCurrentAccent: (c: string) => void;
let currentCustomCss: () => string;

vi.mock("@/context/CortexColorThemeContext", () => ({
  useColorTheme: () => ({
    colorTheme: currentTheme,
    setColorTheme: (id: ColorThemeId) => {
      mockSetColorTheme(id);
      setCurrentTheme(id);
    },
    accentColor: currentAccent,
    setAccentColor: (c: string) => {
      mockSetAccentColor(c);
      setCurrentAccent(c);
    },
    customCss: currentCustomCss,
    setCustomCss: mockSetCustomCss,
  }),
}));

vi.mock("./primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

import { CortexThemePicker } from "../CortexThemePicker";

describe("CortexThemePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    const [theme, setTheme] = createSignal<ColorThemeId>("01");
    currentTheme = theme;
    setCurrentTheme = setTheme;

    const [accent, setAcc] = createSignal("#B2FF22");
    currentAccent = accent;
    setCurrentAccent = setAcc;

    const [css] = createSignal("");
    currentCustomCss = css;
  });

  describe("Rendering", () => {
    it("should render the panel header", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Color Themes");
    });

    it("should render the Theme section title", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Theme");
    });

    it("should render all five theme presets", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Default Dark");
      expect(container.textContent).toContain("Deeper Dark");
      expect(container.textContent).toContain("Midnight");
      expect(container.textContent).toContain("Soft Dark");
      expect(container.textContent).toContain("Purple Haze");
    });

    it("should render theme descriptions", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Standard dark theme");
      expect(container.textContent).toContain("Darker background");
      expect(container.textContent).toContain("Darkest variant");
      expect(container.textContent).toContain("Lighter dark theme");
      expect(container.textContent).toContain("Purple tint");
    });

    it("should render accent color section", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Accent Color");
    });

    it("should render all accent color swatches", () => {
      const { container } = render(() => <CortexThemePicker />);
      const swatchButtons = container.querySelectorAll(
        'button[style*="border-radius: 50%"]'
      );
      expect(swatchButtons.length).toBe(8);
    });

    it("should render preview section", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Preview");
    });

    it("should render custom CSS overrides toggle", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("Custom CSS Overrides");
    });

    it("should render footer description", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain(
        "Themes adjust the background and accent colors"
      );
    });
  });

  describe("Theme Categories", () => {
    it("should render dark themes (all presets are dark variants)", () => {
      const { container } = render(() => <CortexThemePicker />);
      const darkThemeLabels = [
        "Default Dark",
        "Deeper Dark",
        "Midnight",
        "Soft Dark",
        "Purple Haze",
      ];
      darkThemeLabels.forEach((label) => {
        expect(container.textContent).toContain(label);
      });
    });

    it("should render theme cards with color preview swatches", () => {
      const { container } = render(() => <CortexThemePicker />);
      const sidebarSwatches = container.querySelectorAll(
        'div[style*="border-radius: 3px 0 0 3px"]'
      );
      const bgSwatches = container.querySelectorAll(
        'div[style*="border-radius: 0 3px 3px 0"]'
      );
      expect(sidebarSwatches.length).toBe(5);
      expect(bgSwatches.length).toBe(5);
    });
  });

  describe("Theme Selection", () => {
    it("should call setColorTheme when a theme card is clicked", async () => {
      const { container } = render(() => <CortexThemePicker />);

      const themeButtons = Array.from(
        container.querySelectorAll('button[style*="text-align: left"]')
      );
      const midnightBtn = themeButtons.find((b) =>
        b.textContent?.includes("Midnight")
      );
      expect(midnightBtn).toBeTruthy();

      await fireEvent.click(midnightBtn!);
      expect(mockSetColorTheme).toHaveBeenCalledWith("03");
    });

    it("should call setColorTheme with correct id for each theme", async () => {
      const { container } = render(() => <CortexThemePicker />);

      const themeMap: Array<{ label: string; id: ColorThemeId }> = [
        { label: "Default Dark", id: "01" },
        { label: "Deeper Dark", id: "02" },
        { label: "Midnight", id: "03" },
        { label: "Soft Dark", id: "04" },
        { label: "Purple Haze", id: "05" },
      ];

      for (const { label, id } of themeMap) {
        const btn = Array.from(
          container.querySelectorAll('button[style*="text-align: left"]')
        ).find((b) => b.textContent?.includes(label));
        expect(btn).toBeTruthy();
        await fireEvent.click(btn!);
        expect(mockSetColorTheme).toHaveBeenCalledWith(id);
      }
    });
  });

  describe("Current Theme Highlighted", () => {
    it("should show active indicator dot for current theme", () => {
      const { container } = render(() => <CortexThemePicker />);

      const activeDots = container.querySelectorAll(
        'div[style*="border-radius: 50%"][style*="width: 8px"][style*="height: 8px"]'
      );
      expect(activeDots.length).toBe(1);
    });

    it("should move indicator when theme changes", async () => {
      const { container } = render(() => <CortexThemePicker />);

      let activeDots = container.querySelectorAll(
        'div[style*="border-radius: 50%"][style*="width: 8px"][style*="height: 8px"]'
      );
      expect(activeDots.length).toBe(1);

      const midnightBtn = Array.from(
        container.querySelectorAll('button[style*="text-align: left"]')
      ).find((b) => b.textContent?.includes("Midnight"));
      await fireEvent.click(midnightBtn!);

      activeDots = container.querySelectorAll(
        'div[style*="border-radius: 50%"][style*="width: 8px"][style*="height: 8px"]'
      );
      expect(activeDots.length).toBe(1);
    });

    it("should apply accent-colored border to active theme card", () => {
      const { container } = render(() => <CortexThemePicker />);

      const themeButtons = container.querySelectorAll(
        'button[style*="text-align: left"]'
      );
      const defaultDarkBtn = Array.from(themeButtons).find((b) =>
        b.textContent?.includes("Default Dark")
      ) as HTMLElement;

      expect(defaultDarkBtn).toBeTruthy();
      const style = defaultDarkBtn.style.border;
      expect(style).toMatch(/(#B2FF22|rgb\(178,\s*255,\s*34\))/i);
    });
  });

  describe("Theme Preview", () => {
    it("should render the LivePreview section", () => {
      const { container } = render(() => <CortexThemePicker />);

      expect(container.textContent).toContain("Preview");

      const allDivs = Array.from(container.querySelectorAll("div"));
      const previewContainer = allDivs.find((d) => {
        const s = (d as HTMLElement).getAttribute("style") || "";
        return s.includes("overflow:hidden") && s.includes("gap:2px");
      });
      expect(previewContainer).toBeTruthy();
    });

    it("should render preview with background color from current theme", () => {
      const { container } = render(() => <CortexThemePicker />);

      const allDivs = Array.from(container.querySelectorAll("div"));
      const hasBgColor = allDivs.some((d) => {
        const bg = (d as HTMLElement).style.background;
        return (
          bg.includes("#141415") || bg === "rgb(20, 20, 21)"
        );
      });
      expect(hasBgColor).toBe(true);
    });

    it("should render preview with accent-colored elements", () => {
      const { container } = render(() => <CortexThemePicker />);

      const allDivs = Array.from(container.querySelectorAll("div"));
      const hasAccent = allDivs.some((d) => {
        const bg = (d as HTMLElement).style.background;
        return (
          bg.includes("#B2FF22") || bg.includes("rgb(178, 255, 34)")
        );
      });
      expect(hasAccent).toBe(true);
    });
  });

  describe("Accent Color Selection", () => {
    it("should call setAccentColor when a swatch is clicked", async () => {
      const { container } = render(() => <CortexThemePicker />);

      const swatches = container.querySelectorAll(
        'button[style*="border-radius: 50%"][style*="width: 32px"]'
      );
      expect(swatches.length).toBe(8);

      await fireEvent.click(swatches[1]);
      expect(mockSetAccentColor).toHaveBeenCalledWith("#FEAB78");
    });

    it("should highlight the currently active accent swatch", () => {
      const { container } = render(() => <CortexThemePicker />);

      const swatches = container.querySelectorAll(
        'button[style*="border-radius: 50%"][style*="width: 32px"]'
      );
      const limeBtn = swatches[0] as HTMLElement;
      expect(limeBtn.style.border).toContain("3px solid");
    });

    it("should render color picker input", () => {
      const { container } = render(() => <CortexThemePicker />);

      const colorInput = container.querySelector('input[type="color"]');
      expect(colorInput).toBeTruthy();
    });

    it("should display current accent hex value", () => {
      const { container } = render(() => <CortexThemePicker />);
      expect(container.textContent).toContain("#B2FF22");
    });
  });

  describe("Custom CSS", () => {
    it("should expand CSS section when clicked", async () => {
      const { container } = render(() => <CortexThemePicker />);

      const cssToggle = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Custom CSS Overrides"));
      expect(cssToggle).toBeTruthy();

      await fireEvent.click(cssToggle!);

      const textarea = container.querySelector("textarea");
      expect(textarea).toBeTruthy();
    });

    it("should render Apply and Reset buttons in CSS section", async () => {
      const { container } = render(() => <CortexThemePicker />);

      const cssToggle = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Custom CSS Overrides"));
      await fireEvent.click(cssToggle!);

      expect(container.textContent).toContain("Apply");
      expect(container.textContent).toContain("Reset");
    });

    it("should call setCustomCss when Apply is clicked", async () => {
      const { container } = render(() => <CortexThemePicker />);

      const cssToggle = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Custom CSS Overrides"));
      await fireEvent.click(cssToggle!);

      const textarea = container.querySelector("textarea")!;
      await fireEvent.input(textarea, {
        target: { value: ":root { --test: red; }" },
      });

      const applyBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent === "Apply");
      await fireEvent.click(applyBtn!);

      expect(mockSetCustomCss).toHaveBeenCalled();
    });
  });
});
