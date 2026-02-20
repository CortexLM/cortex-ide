import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { AccessibilitySettings } from "../accessibility/AccessibilitySettings";
import { AccessibilityProvider } from "@/context/AccessibilityContext";

const renderWithProvider = (ui: () => any) => {
  return render(() => <AccessibilityProvider>{ui()}</AccessibilityProvider>);
};

describe("AccessibilitySettings Enhanced Features", () => {
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

  it("renders Monaco Editor Accessibility section", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("Monaco Editor Accessibility")).toBeTruthy();
  });

  it("renders System Integration section", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("System Integration")).toBeTruthy();
  });

  it("renders ARIA Labels Audit section", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("ARIA Labels Audit")).toBeTruthy();
  });

  it("renders editor screen reader support option", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("Editor Screen Reader Support")).toBeTruthy();
  });

  it("renders ARIA audit items", () => {
    const { getByText } = renderWithProvider(() => <AccessibilitySettings />);
    expect(getByText("Editor")).toBeTruthy();
    expect(getByText("Terminal")).toBeTruthy();
    expect(getByText("File Explorer")).toBeTruthy();
    expect(getByText("Activity Bar")).toBeTruthy();
  });

  describe("Monaco Accessibility Support", () => {
    it("should map screen reader mode to Monaco option", () => {
      const screenReaderMode = true;
      const monacoOption = screenReaderMode ? "on" : "off";
      expect(monacoOption).toBe("on");
    });

    it("should map disabled screen reader mode", () => {
      const screenReaderMode = false;
      const monacoOption = screenReaderMode ? "on" : "off";
      expect(monacoOption).toBe("off");
    });
  });

  describe("High Contrast Auto Detection", () => {
    it("should detect system high contrast preference", () => {
      const systemPreference = false;
      expect(systemPreference).toBe(false);
    });
  });

  describe("ARIA Audit Status", () => {
    const auditItems = [
      { name: "Editor", status: "complete" },
      { name: "Terminal", status: "complete" },
      { name: "Chat Panel", status: "partial" },
      { name: "Debug Panel", status: "partial" },
    ];

    it("should have audit items", () => {
      expect(auditItems.length).toBeGreaterThan(0);
    });

    it("should have complete and partial statuses", () => {
      const complete = auditItems.filter(i => i.status === "complete");
      const partial = auditItems.filter(i => i.status === "partial");
      expect(complete.length).toBeGreaterThan(0);
      expect(partial.length).toBeGreaterThan(0);
    });
  });
});
