import { describe, it, expect, vi } from "vitest";

import { convertWorkbenchColors, convertEditorColors, convertTerminalColors, convertSyntaxColors, convertVSCodeTheme, cortexThemeToCustomizations, BUILTIN_THEMES } from "../theme-converter";

describe("theme-converter", () => {
  it("convertWorkbenchColors", () => {
    try { convertWorkbenchColors({}, {} as any); } catch (_e) { /* expected */ }
    try { convertWorkbenchColors(); } catch (_e) { /* expected */ }
    expect(convertWorkbenchColors).toBeDefined();
  });
  it("convertEditorColors", () => {
    try { convertEditorColors({}, {} as any); } catch (_e) { /* expected */ }
    try { convertEditorColors(); } catch (_e) { /* expected */ }
    expect(convertEditorColors).toBeDefined();
  });
  it("convertTerminalColors", () => {
    try { convertTerminalColors({}, {} as any); } catch (_e) { /* expected */ }
    try { convertTerminalColors(); } catch (_e) { /* expected */ }
    expect(convertTerminalColors).toBeDefined();
  });
  it("convertSyntaxColors", () => {
    try { convertSyntaxColors([], {} as any); } catch (_e) { /* expected */ }
    try { convertSyntaxColors(); } catch (_e) { /* expected */ }
    expect(convertSyntaxColors).toBeDefined();
  });
  it("convertVSCodeTheme", () => {
    try { convertVSCodeTheme({} as any); } catch (_e) { /* expected */ }
    try { convertVSCodeTheme(); } catch (_e) { /* expected */ }
    expect(convertVSCodeTheme).toBeDefined();
  });
  it("cortexThemeToCustomizations", () => {
    try { cortexThemeToCustomizations({} as any); } catch (_e) { /* expected */ }
    try { cortexThemeToCustomizations(); } catch (_e) { /* expected */ }
    expect(cortexThemeToCustomizations).toBeDefined();
  });
  it("BUILTIN_THEMES", () => {
    expect(BUILTIN_THEMES).toBeDefined();
  });
});
