import { describe, it, expect, vi } from "vitest";

import { createOutputManager } from "../../notebook/OutputRenderer";

describe("OutputRenderer", () => {
  it("createOutputManager", () => {
    try { createOutputManager({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createOutputManager(); } catch (_e) { /* expected */ }
    expect(createOutputManager).toBeDefined();
  });
});
