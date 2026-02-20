import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { AccessibilitySettings } from "../AccessibilitySettings";
import { AccessibilityProvider } from "@/context/AccessibilityContext";

const renderWithProvider = (ui: () => any) => {
  return render(() => <AccessibilityProvider>{ui()}</AccessibilityProvider>);
};

describe("AccessibilitySettings", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders without crashing", () => {
    const { container } = renderWithProvider(() => <AccessibilitySettings />);
    expect(container).toBeTruthy();
  });

  it("component is defined", () => {
    expect(AccessibilitySettings).toBeDefined();
    expect(typeof AccessibilitySettings).toBe("function");
  });

  it("renders visual settings section", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("Visual Settings")).toBeTruthy();
  });

  it("renders screen reader mode option", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("Screen Reader Mode")).toBeTruthy();
  });

  it("renders high contrast mode option", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("High Contrast Mode")).toBeTruthy();
  });

  it("renders reduced motion option", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("Reduced Motion")).toBeTruthy();
  });

  it("accepts style prop", () => {
    const { container } = renderWithProvider(() => (
      <AccessibilitySettings style={{ padding: "20px" }} />
    ));
    expect(container).toBeTruthy();
  });

  it("accepts class prop", () => {
    const { container } = renderWithProvider(() => (
      <AccessibilitySettings class="settings-panel" />
    ));
    expect(container).toBeTruthy();
  });
});
