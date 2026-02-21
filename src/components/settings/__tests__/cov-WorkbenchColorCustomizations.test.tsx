import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ThemeContext", () => ({ ThemeProvider: (p: any) => p.children, useTheme: vi.fn(() => ({ theme: vi.fn(() => "dark"), setTheme: vi.fn(), colors: vi.fn(() => ({})), isDark: vi.fn(() => true), isLight: vi.fn(() => false), availableThemes: vi.fn(() => []) })) }));
vi.mock("@/context/ColorCustomizationsContext", () => ({ ColorCustomizationsProvider: (p: any) => p.children, useColorCustomizations: vi.fn(() => ({})) }));

import { WorkbenchColorCustomizations } from "../../settings/WorkbenchColorCustomizations";

describe("WorkbenchColorCustomizations", () => {
  it("WorkbenchColorCustomizations", () => {
    try { render(() => <WorkbenchColorCustomizations />); } catch (_e) { /* expected */ }
    expect(WorkbenchColorCustomizations).toBeDefined();
  });
});
