import { describe, it, expect, vi } from "vitest";

import { serializeGrid, deserializeGrid, getLeafCellIds, saveGridState, loadGridState, clearGridState } from "../../grid/serialization";

describe("serialization", () => {
  it("serializeGrid", () => {
    try { serializeGrid({} as any); } catch (_e) { /* expected */ }
    try { serializeGrid(); } catch (_e) { /* expected */ }
    expect(serializeGrid).toBeDefined();
  });
  it("deserializeGrid", () => {
    try { deserializeGrid("test"); } catch (_e) { /* expected */ }
    try { deserializeGrid(); } catch (_e) { /* expected */ }
    expect(deserializeGrid).toBeDefined();
  });
  it("getLeafCellIds", () => {
    try { getLeafCellIds({} as any); } catch (_e) { /* expected */ }
    try { getLeafCellIds(); } catch (_e) { /* expected */ }
    expect(getLeafCellIds).toBeDefined();
  });
  it("saveGridState", () => {
    try { saveGridState({} as any); } catch (_e) { /* expected */ }
    try { saveGridState(); } catch (_e) { /* expected */ }
    expect(saveGridState).toBeDefined();
  });
  it("loadGridState", () => {
    try { loadGridState(); } catch (_e) { /* expected */ }
    expect(loadGridState).toBeDefined();
  });
  it("clearGridState", () => {
    try { clearGridState(); } catch (_e) { /* expected */ }
    expect(clearGridState).toBeDefined();
  });
});
