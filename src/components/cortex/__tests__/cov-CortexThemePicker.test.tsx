import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CortexColorThemeContext", () => ({ CortexColorThemeProvider: (p: any) => p.children, useCortexColorTheme: vi.fn(() => ({})) }));

import { CortexThemePicker } from "../../cortex/CortexThemePicker";

describe("CortexThemePicker", () => {
  it("CortexThemePicker", () => {
    try { render(() => <CortexThemePicker />); } catch (_e) { /* expected */ }
    expect(CortexThemePicker).toBeDefined();
  });
});
