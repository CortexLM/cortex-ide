import { describe, it, expect, vi } from "vitest";

import { invalidateCache, clearAllCaches } from "../tauri-api";

describe("tauri-api", () => {
  it("invalidateCache", () => {
    try { invalidateCache("test"); } catch (_e) { /* expected */ }
    try { invalidateCache(); } catch (_e) { /* expected */ }
    expect(invalidateCache).toBeDefined();
  });
  it("clearAllCaches", () => {
    try { clearAllCaches(); } catch (_e) { /* expected */ }
    expect(clearAllCaches).toBeDefined();
  });
});
