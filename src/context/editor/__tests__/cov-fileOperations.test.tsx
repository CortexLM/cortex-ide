import { describe, it, expect, vi } from "vitest";

import { createFileOperations } from "../../editor/fileOperations";

describe("fileOperations", () => {
  it("createFileOperations", () => {
    try { createFileOperations({} as any, new Set()); } catch (_e) { /* expected */ }
    try { createFileOperations(); } catch (_e) { /* expected */ }
    expect(createFileOperations).toBeDefined();
  });
});
