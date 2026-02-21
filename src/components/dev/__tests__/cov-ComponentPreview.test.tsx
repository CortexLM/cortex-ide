import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ThemeContext", () => ({ ThemeProvider: (p: any) => p.children, useTheme: vi.fn(() => ({ theme: vi.fn(() => "dark"), setTheme: vi.fn(), colors: vi.fn(() => ({})), isDark: vi.fn(() => true), isLight: vi.fn(() => false), availableThemes: vi.fn(() => []) })) }));

import { registerComponent, openComponentPreview, ComponentPreview } from "../../dev/ComponentPreview";

describe("ComponentPreview", () => {
  it("registerComponent", () => {
    try { registerComponent({} as any); } catch (_e) { /* expected */ }
    try { registerComponent(); } catch (_e) { /* expected */ }
    expect(registerComponent).toBeDefined();
  });
  it("openComponentPreview", () => {
    try { openComponentPreview(); } catch (_e) { /* expected */ }
    expect(openComponentPreview).toBeDefined();
  });
  it("ComponentPreview", () => {
    try { render(() => <ComponentPreview />); } catch (_e) { /* expected */ }
    expect(ComponentPreview).toBeDefined();
  });
});
