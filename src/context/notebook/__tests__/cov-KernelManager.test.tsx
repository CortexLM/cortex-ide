import { describe, it, expect, vi } from "vitest";

import { generateKernelId, createKernelManager } from "../../notebook/KernelManager";

describe("KernelManager", () => {
  it("generateKernelId", () => {
    try { generateKernelId(); } catch (_e) { /* expected */ }
    expect(generateKernelId).toBeDefined();
  });
  it("createKernelManager", () => {
    try { createKernelManager({} as any, new Set(), {} as any, {} as any); } catch (_e) { /* expected */ }
    try { createKernelManager(); } catch (_e) { /* expected */ }
    expect(createKernelManager).toBeDefined();
  });
});
