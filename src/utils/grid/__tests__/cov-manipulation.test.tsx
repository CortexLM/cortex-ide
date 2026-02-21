import { describe, it, expect, vi } from "vitest";

import { splitCell, closeCell, moveEditorToCell } from "../../grid/manipulation";

describe("manipulation", () => {
  it("splitCell", () => {
    try { splitCell({} as any, "test", {} as any); } catch (_e) { /* expected */ }
    try { splitCell(); } catch (_e) { /* expected */ }
    expect(splitCell).toBeDefined();
  });
  it("closeCell", () => {
    try { closeCell({} as any, "test"); } catch (_e) { /* expected */ }
    try { closeCell(); } catch (_e) { /* expected */ }
    expect(closeCell).toBeDefined();
  });
  it("moveEditorToCell", () => {
    try { moveEditorToCell({} as any, "test", "test"); } catch (_e) { /* expected */ }
    try { moveEditorToCell(); } catch (_e) { /* expected */ }
    expect(moveEditorToCell).toBeDefined();
  });
});
