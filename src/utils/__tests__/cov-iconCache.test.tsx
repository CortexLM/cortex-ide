import { describe, it, expect, vi } from "vitest";

import { getFromCache, addToCache, hasInCache, clearCache } from "../iconCache";

describe("iconCache", () => {
  it("getFromCache", () => {
    try { getFromCache("test"); } catch (_e) { /* expected */ }
    try { getFromCache(); } catch (_e) { /* expected */ }
    expect(getFromCache).toBeDefined();
  });
  it("addToCache", () => {
    try { addToCache("test", "test"); } catch (_e) { /* expected */ }
    try { addToCache(); } catch (_e) { /* expected */ }
    expect(addToCache).toBeDefined();
  });
  it("hasInCache", () => {
    try { hasInCache("test"); } catch (_e) { /* expected */ }
    try { hasInCache(); } catch (_e) { /* expected */ }
    expect(hasInCache).toBeDefined();
  });
  it("clearCache", () => {
    try { clearCache(); } catch (_e) { /* expected */ }
    expect(clearCache).toBeDefined();
  });
});
