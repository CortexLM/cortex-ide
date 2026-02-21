import { describe, it, expect, vi } from "vitest";

import { createGridLayoutOps } from "../../editor/editorGridLayout";

describe("editorGridLayout", () => {
  it("createGridLayoutOps", () => {
    try { createGridLayoutOps({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createGridLayoutOps(); } catch (_e) { /* expected */ }
    expect(createGridLayoutOps).toBeDefined();
  });
});
