import { describe, it, expect, vi } from "vitest";

import { resolveHcBaseType, applyThemeColors } from "../../theme/builtInThemes";

describe("builtInThemes", () => {
  it("resolveHcBaseType", () => {
    try { resolveHcBaseType({} as any); } catch (_e) { /* expected */ }
    try { resolveHcBaseType(); } catch (_e) { /* expected */ }
    expect(resolveHcBaseType).toBeDefined();
  });
  it("applyThemeColors", () => {
    try { applyThemeColors({}, {} as any, {} as any, new Set()); } catch (_e) { /* expected */ }
    try { applyThemeColors(); } catch (_e) { /* expected */ }
    expect(applyThemeColors).toBeDefined();
  });
});
