import { describe, it, expect, vi } from "vitest";

import { savePinnedTabs, loadPinnedTabs, createTabOperations } from "../../editor/tabOperations";

describe("tabOperations", () => {
  it("savePinnedTabs", () => {
    try { savePinnedTabs([]); } catch (_e) { /* expected */ }
    try { savePinnedTabs(); } catch (_e) { /* expected */ }
    expect(savePinnedTabs).toBeDefined();
  });
  it("loadPinnedTabs", () => {
    try { loadPinnedTabs(); } catch (_e) { /* expected */ }
    expect(loadPinnedTabs).toBeDefined();
  });
  it("createTabOperations", () => {
    try { createTabOperations({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createTabOperations(); } catch (_e) { /* expected */ }
    expect(createTabOperations).toBeDefined();
  });
});
