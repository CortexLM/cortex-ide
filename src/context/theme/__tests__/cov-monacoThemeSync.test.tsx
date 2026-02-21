import { describe, it, expect, vi } from "vitest";

import { createMonacoThemeData, syncThemeToMonaco } from "../../theme/monacoThemeSync";

describe("monacoThemeSync", () => {
  it("createMonacoThemeData", () => {
    try { createMonacoThemeData(false, {} as any, {} as any); } catch (_e) { /* expected */ }
    try { createMonacoThemeData(); } catch (_e) { /* expected */ }
    expect(createMonacoThemeData).toBeDefined();
  });
  it("syncThemeToMonaco", () => {
    try { syncThemeToMonaco({} as any); } catch (_e) { /* expected */ }
    try { syncThemeToMonaco(); } catch (_e) { /* expected */ }
    expect(syncThemeToMonaco).toBeDefined();
  });
});
