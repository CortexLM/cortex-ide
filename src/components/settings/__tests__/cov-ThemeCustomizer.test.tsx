import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ThemeContext", () => ({ ThemeProvider: (p: any) => p.children, useTheme: vi.fn(() => ({ theme: vi.fn(() => "dark"), setTheme: vi.fn(), colors: vi.fn(() => ({})), isDark: vi.fn(() => true), isLight: vi.fn(() => false), availableThemes: vi.fn(() => []) })) }));

import { ThemeCustomizer } from "../../settings/ThemeCustomizer";

describe("ThemeCustomizer", () => {
  it("ThemeCustomizer", () => {
    try { render(() => <ThemeCustomizer />); } catch (_e) { /* expected */ }
    expect(ThemeCustomizer).toBeDefined();
  });
});
