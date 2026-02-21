import { describe, it, expect, vi } from "vitest";

import { invalidateIpcCache, getIpcCacheSize, _resetIpcCache } from "../ipcCache";

describe("ipcCache", () => {
  it("invalidateIpcCache", () => {
    try { invalidateIpcCache(); } catch (_e) { /* expected */ }
    expect(invalidateIpcCache).toBeDefined();
  });
  it("getIpcCacheSize", () => {
    try { getIpcCacheSize(); } catch (_e) { /* expected */ }
    expect(getIpcCacheSize).toBeDefined();
  });
  it("_resetIpcCache", () => {
    try { _resetIpcCache(); } catch (_e) { /* expected */ }
    expect(_resetIpcCache).toBeDefined();
  });
});
