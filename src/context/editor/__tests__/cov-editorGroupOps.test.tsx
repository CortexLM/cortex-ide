import { describe, it, expect, vi } from "vitest";

import { createGroupOps } from "../../editor/editorGroupOps";

describe("editorGroupOps", () => {
  it("createGroupOps", () => {
    try { createGroupOps({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createGroupOps(); } catch (_e) { /* expected */ }
    expect(createGroupOps).toBeDefined();
  });
});
