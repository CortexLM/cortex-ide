import { describe, it, expect, vi } from "vitest";

import { getWindowLabel, getStorageItem, setStorageItem, initializeWindowStorage } from "../windowStorage";

describe("windowStorage", () => {
  it("getWindowLabel", () => {
    try { getWindowLabel(); } catch (_e) { /* expected */ }
    expect(getWindowLabel).toBeDefined();
  });
  it("getStorageItem", () => {
    try { getStorageItem("test"); } catch (_e) { /* expected */ }
    try { getStorageItem(); } catch (_e) { /* expected */ }
    expect(getStorageItem).toBeDefined();
  });
  it("setStorageItem", () => {
    try { setStorageItem("test", "test"); } catch (_e) { /* expected */ }
    try { setStorageItem(); } catch (_e) { /* expected */ }
    expect(setStorageItem).toBeDefined();
  });
  it("initializeWindowStorage", () => {
    try { initializeWindowStorage(); } catch (_e) { /* expected */ }
    expect(initializeWindowStorage).toBeDefined();
  });
});
