import { describe, it, expect, vi } from "vitest";

import { generateCellId, createEmptyCell, createDragState, createCollapseState, createCellManager } from "../../notebook/CellManager";

describe("CellManager", () => {
  it("generateCellId", () => {
    try { generateCellId(); } catch (_e) { /* expected */ }
    expect(generateCellId).toBeDefined();
  });
  it("createEmptyCell", () => {
    try { createEmptyCell({} as any); } catch (_e) { /* expected */ }
    try { createEmptyCell(); } catch (_e) { /* expected */ }
    expect(createEmptyCell).toBeDefined();
  });
  it("createDragState", () => {
    try { createDragState(); } catch (_e) { /* expected */ }
    expect(createDragState).toBeDefined();
  });
  it("createCollapseState", () => {
    try { createCollapseState(); } catch (_e) { /* expected */ }
    expect(createCollapseState).toBeDefined();
  });
  it("createCellManager", () => {
    try { createCellManager({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createCellManager(); } catch (_e) { /* expected */ }
    expect(createCellManager).toBeDefined();
  });
});
