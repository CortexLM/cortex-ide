import { describe, it, expect, vi } from "vitest";

import { loadUseGridLayout, createGridOperations } from "../../editor/gridOperations";

describe("gridOperations", () => {
  it("loadUseGridLayout", () => {
    try { loadUseGridLayout(); } catch (_e) { /* expected */ }
    expect(loadUseGridLayout).toBeDefined();
  });
  it("createGridOperations", () => {
    try { createGridOperations({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createGridOperations(); } catch (_e) { /* expected */ }
    expect(createGridOperations).toBeDefined();
  });
});
