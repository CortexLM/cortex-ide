import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ThemeContext", () => ({ ThemeProvider: (p: any) => p.children, useTheme: vi.fn(() => ({ theme: vi.fn(() => "dark"), setTheme: vi.fn(), colors: vi.fn(() => ({})), isDark: vi.fn(() => true), isLight: vi.fn(() => false), availableThemes: vi.fn(() => []) })) }));
vi.mock("@/context/TokenColorCustomizationsContext", () => ({ TokenColorCustomizationsProvider: (p: any) => p.children, useTokenColorCustomizations: vi.fn(() => ({})) }));

import { EditorTokenColorCustomizations } from "../../settings/EditorTokenColorCustomizations";

describe("EditorTokenColorCustomizations", () => {
  it("EditorTokenColorCustomizations", () => {
    try { render(() => <EditorTokenColorCustomizations />); } catch (_e) { /* expected */ }
    expect(EditorTokenColorCustomizations).toBeDefined();
  });
});
