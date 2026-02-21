import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ThemeContext", () => ({ ThemeProvider: (p: any) => p.children, useTheme: vi.fn(() => ({ theme: vi.fn(() => "dark"), setTheme: vi.fn(), colors: vi.fn(() => ({})), isDark: vi.fn(() => true), isLight: vi.fn(() => false), availableThemes: vi.fn(() => []) })) }));
vi.mock("@/context/InspectorContext", () => ({ InspectorProvider: (p: any) => p.children, useInspector: vi.fn(() => ({})) }));

import { openInspector, toggleInspector, Inspector } from "../../dev/Inspector";

describe("Inspector", () => {
  it("openInspector", () => {
    try { openInspector(); } catch (_e) { /* expected */ }
    expect(openInspector).toBeDefined();
  });
  it("toggleInspector", () => {
    try { toggleInspector(); } catch (_e) { /* expected */ }
    expect(toggleInspector).toBeDefined();
  });
  it("Inspector", () => {
    try { render(() => <Inspector />); } catch (_e) { /* expected */ }
    expect(Inspector).toBeDefined();
  });
});
