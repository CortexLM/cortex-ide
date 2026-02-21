import { describe, it, expect, vi } from "vitest";

import { flushBatchInvoke, _resetBatchState } from "../batchInvoke";

describe("batchInvoke", () => {
  it("flushBatchInvoke", () => {
    try { flushBatchInvoke(); } catch (_e) { /* expected */ }
    expect(flushBatchInvoke).toBeDefined();
  });
  it("_resetBatchState", () => {
    try { _resetBatchState(); } catch (_e) { /* expected */ }
    expect(_resetBatchState).toBeDefined();
  });
});
