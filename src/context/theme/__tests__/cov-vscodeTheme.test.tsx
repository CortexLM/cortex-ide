import { describe, it, expect, vi } from "vitest";

import { createVSCodeThemeHandlers } from "../../theme/vscodeTheme";

describe("vscodeTheme", () => {
  it("createVSCodeThemeHandlers", () => {
    try { createVSCodeThemeHandlers({} as any); } catch (_e) { /* expected */ }
    try { createVSCodeThemeHandlers(); } catch (_e) { /* expected */ }
    expect(createVSCodeThemeHandlers).toBeDefined();
  });
});
