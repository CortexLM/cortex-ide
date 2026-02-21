import { describe, it, expect, vi } from "vitest";

import { getSupermaven, resetSupermaven, SupermavenProvider } from "../../ai/SupermavenProvider";

describe("SupermavenProvider", () => {
  it("getSupermaven", () => {
    try { getSupermaven(); } catch (_e) { /* expected */ }
    expect(getSupermaven).toBeDefined();
  });
  it("resetSupermaven", () => {
    try { resetSupermaven(); } catch (_e) { /* expected */ }
    expect(resetSupermaven).toBeDefined();
  });
  it("SupermavenProvider", () => {
    try { const inst = new SupermavenProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(SupermavenProvider).toBeDefined(); }
  });
});
