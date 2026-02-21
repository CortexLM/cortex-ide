import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@solidjs/testing-library";

const mockSetTheme = vi.fn();
const mockStartPreview = vi.fn();
const mockStopPreview = vi.fn();
const mockApplyPluginTheme = vi.fn();
const mockClearVSCodeExtensionTheme = vi.fn();

let mockTheme = "dark";
let mockPluginThemes: any[] = [];
let mockActiveVSCodeTheme: any = null;
let mockIsDark = true;

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: () => mockTheme,
    setTheme: mockSetTheme,
    isDark: () => mockIsDark,
    startPreview: mockStartPreview,
    stopPreview: mockStopPreview,
    pluginThemes: () => mockPluginThemes,
    applyPluginTheme: mockApplyPluginTheme,
    activeVSCodeTheme: () => mockActiveVSCodeTheme,
    clearVSCodeExtensionTheme: mockClearVSCodeExtensionTheme,
  }),
}));

vi.mock("../ui/Icon", () => ({
  Icon: (props: any) => <span data-testid={`icon-${props.name}`} />,
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      text: { primary: "#fff", muted: "#888", secondary: "#aaa" },
      surface: { input: "#1e1e1e", panel: "#252526", card: "#2d2d2d", active: "#37373d" },
      border: { default: "#3c3c3c", focus: "#007acc" },
      accent: { primary: "#007acc" },
      radius: { sm: "4px", md: "6px", full: "9999px" },
    },
    radius: { sm: "4px", md: "6px", full: "9999px" },
  },
}));

import { ThemeSelector } from "../ThemeSelector";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockTheme = "dark";
  mockPluginThemes = [];
  mockActiveVSCodeTheme = null;
  mockIsDark = true;
});

describe("ThemeSelector", () => {
  it("renders the Theme Selector heading", () => {
    const { getByText } = render(() => <ThemeSelector />);
    expect(getByText("Theme Selector")).toBeTruthy();
  });

  it("renders Built-in Themes section header", () => {
    const { getByText } = render(() => <ThemeSelector />);
    expect(getByText("Built-in Themes")).toBeTruthy();
  });

  it("renders all five built-in themes", () => {
    const { getByText, getAllByText } = render(() => <ThemeSelector />);
    expect(getByText("Dark+")).toBeTruthy();
    expect(getByText("Light+")).toBeTruthy();
    expect(getAllByText("System").length).toBeGreaterThan(0);
    expect(getByText("High Contrast")).toBeTruthy();
    expect(getByText("High Contrast Light")).toBeTruthy();
  });

  it("renders theme type badges", () => {
    const { getAllByText } = render(() => <ThemeSelector />);
    expect(getAllByText("Dark").length).toBeGreaterThan(0);
    expect(getAllByText("Light").length).toBeGreaterThan(0);
  });

  it("renders search input", () => {
    const { container } = render(() => <ThemeSelector />);
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Search themes...");
  });

  it("calls setTheme when a theme card is clicked", () => {
    const { getByText } = render(() => <ThemeSelector />);
    const lightCard = getByText("Light+").closest("[role='button']") as HTMLElement;
    fireEvent.click(lightCard);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("filters themes by search query", () => {
    const { container, queryByText } = render(() => <ThemeSelector />);
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "high" } });
    expect(queryByText("High Contrast")).toBeTruthy();
    expect(queryByText("High Contrast Light")).toBeTruthy();
    expect(queryByText("Dark+")).toBeNull();
    expect(queryByText("Light+")).toBeNull();
  });

  it("shows no themes message when search has no results", () => {
    const { container, getByText } = render(() => <ThemeSelector />);
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "nonexistent_xyz" } });
    expect(getByText("No themes match your search")).toBeTruthy();
  });

  it("renders plugin themes section when plugins available", () => {
    mockPluginThemes = [
      { id: "plugin-monokai", name: "Monokai Pro", type: "dark", colors: {} },
    ];
    const { getByText } = render(() => <ThemeSelector />);
    expect(getByText("Plugin Themes")).toBeTruthy();
    expect(getByText("Monokai Pro")).toBeTruthy();
  });

  it("calls applyPluginTheme when plugin theme clicked", () => {
    mockPluginThemes = [
      { id: "plugin-monokai", name: "Monokai Pro", type: "dark", colors: {} },
    ];
    const { getByText } = render(() => <ThemeSelector />);
    const card = getByText("Monokai Pro").closest("[role='button']") as HTMLElement;
    fireEvent.click(card);
    expect(mockApplyPluginTheme).toHaveBeenCalledWith("plugin-monokai");
  });

  it("renders custom VS Code theme section when active", () => {
    mockActiveVSCodeTheme = { name: "My Custom Theme" };
    const { getByText } = render(() => <ThemeSelector />);
    expect(getByText("Custom Themes")).toBeTruthy();
    expect(getByText("My Custom Theme")).toBeTruthy();
  });

  it("does not render plugin section when no plugins", () => {
    mockPluginThemes = [];
    const { queryByText } = render(() => <ThemeSelector />);
    expect(queryByText("Plugin Themes")).toBeNull();
  });

  it("does not render custom section when no VS Code theme", () => {
    mockActiveVSCodeTheme = null;
    const { queryByText } = render(() => <ThemeSelector />);
    expect(queryByText("Custom Themes")).toBeNull();
  });

  it("renders color swatches for each theme", () => {
    const { container } = render(() => <ThemeSelector />);
    const cards = container.querySelectorAll("[role='button']");
    expect(cards.length).toBeGreaterThanOrEqual(5);
  });

  it("renders theme descriptions", () => {
    const { getByText } = render(() => <ThemeSelector />);
    expect(getByText("Default dark color theme")).toBeTruthy();
    expect(getByText("Default light color theme")).toBeTruthy();
    expect(getByText("Follow OS color scheme")).toBeTruthy();
  });

  it("filters plugin themes by search query", () => {
    mockPluginThemes = [
      { id: "p1", name: "Monokai Pro", type: "dark", colors: {} },
      { id: "p2", name: "Solarized", type: "light", colors: {} },
    ];
    const { container, queryByText } = render(() => <ThemeSelector />);
    const input = container.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "mono" } });
    expect(queryByText("Monokai Pro")).toBeTruthy();
    expect(queryByText("Solarized")).toBeNull();
  });
});
